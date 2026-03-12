/**
 * UserbotManager — Per-AGENT GramJS MTProto session manager
 *
 * EACH AGENT gets its OWN Telegram account.
 * Auth methods: QR code OR phone+code+2FA
 * Sessions stored in DB (agent trigger_config.telegram_session).
 * Always online — auto-reconnect, health checks.
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { Pool } from 'pg';

const API_ID   = parseInt(process.env.TG_API_ID   || '2040');
const API_HASH =          process.env.TG_API_HASH  || 'b18441a1ff607e10a989891a5462e627';

interface AgentClient {
  client: TelegramClient;
  connected: boolean;
  lastUsed: number;
  telegramUserId?: number;
  username?: string;
  phone?: string;
}

interface AuthState {
  client: TelegramClient;
  done: boolean;
  cancelFn: (() => void) | null;
  status: 'pending' | 'waiting_code' | 'need_password' | 'success' | 'error';
  // QR-specific
  currentToken: Buffer | null;
  qrUrl?: string;
  expiresIn?: number;
  // Phone-specific
  phoneHash?: string;
  phone?: string;
  // General
  error?: string;
  complete2FA?: (password: string) => Promise<{ ok: boolean; error?: string }>;
  submitCode?: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      user:     process.env.DB_USER     || 'ton_agent',
      password: process.env.DB_PASSWORD || 'changeme',
      database: process.env.DB_NAME     || 'ton_agent_platform',
    });
  }
  return _pool;
}

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLING PIPELINE
// ══════════════════════════════════════════════════════════════════════════════

/** Parsed incoming Telegram message (TON Agent Platform internal format) */
interface TgInboxMessage {
  id: number;
  chatId: string;          // string for consistency
  senderId: number;
  senderUsername: string;
  senderFirstName: string;
  text: string;
  date: number;            // unix ts
  isGroup: boolean;
  isChannel: boolean;
  isBot: boolean;
  mentionsMe: boolean;
  replyToId?: number;
  hasMedia: boolean;
  mediaType?: string;
  _raw: any;               // original GramJS message
}

/** Context frame — wraps message with metadata for AI context window */
function buildContextFrame(msg: TgInboxMessage, elapsed?: number): string {
  const name = msg.senderUsername ? `@${msg.senderUsername}` : msg.senderFirstName || `id:${msg.senderId}`;
  const time = new Date(msg.date * 1000).toISOString().slice(11, 16);
  const elapsedStr = elapsed ? ` +${elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`}` : '';
  const media = msg.hasMedia ? ` [${msg.mediaType || 'media'}]` : '';
  const reply = msg.replyToId ? ` (reply to #${msg.replyToId})` : '';
  return `[Telegram ${name}${elapsedStr} ${time}${media}${reply}] <user_message>${msg.text}</user_message>`;
}

/** Per-chat serial dispatcher — prevents race conditions */
class ChatDispatcher {
  private chains = new Map<string, Promise<void>>();

  enqueue(chatId: string, task: () => Promise<void>): Promise<void> {
    const prev = this.chains.get(chatId) ?? Promise.resolve();
    const next = prev
      .then(task, () => task())
      .finally(() => {
        if (this.chains.get(chatId) === next) this.chains.delete(chatId);
      });
    this.chains.set(chatId, next);
    return next;
  }
}

/** Duplicate filter — prevents processing same message twice */
class DuplicateFilter {
  private seen = new Set<string>();
  private maxSize = 500;

  isDuplicate(chatId: string, msgId: number): boolean {
    const key = `${chatId}:${msgId}`;
    if (this.seen.has(key)) return true;
    this.seen.add(key);
    if (this.seen.size > this.maxSize) {
      // Evict oldest half
      const arr = [...this.seen];
      this.seen = new Set(arr.slice(arr.length / 2));
    }
    return false;
  }
}

/** Group context buffer — accumulates messages when agent isn't mentioned */
class GroupContextBuffer {
  private history = new Map<string, TgInboxMessage[]>();
  private maxPerChat = 50;
  private maxAgeMs = 30 * 60 * 1000; // 30 min

  add(chatId: string, msg: TgInboxMessage): void {
    if (!this.history.has(chatId)) this.history.set(chatId, []);
    const arr = this.history.get(chatId)!;
    arr.push(msg);
    if (arr.length > this.maxPerChat) arr.splice(0, arr.length - this.maxPerChat);
  }

  flush(chatId: string): TgInboxMessage[] {
    const arr = this.history.get(chatId) || [];
    this.history.delete(chatId);
    const cutoff = Date.now() / 1000 - this.maxAgeMs / 1000;
    return arr.filter(m => m.date > cutoff);
  }
}

/** Chat history ring — recent messages for AI context window */
class ChatHistoryRing {
  private memory = new Map<string, string[]>(); // chatId → last N formatted messages
  private maxPerChat = 30;

  add(chatId: string, envelope: string): void {
    if (!this.memory.has(chatId)) this.memory.set(chatId, []);
    const arr = this.memory.get(chatId)!;
    arr.push(envelope);
    if (arr.length > this.maxPerChat) arr.splice(0, arr.length - this.maxPerChat);
  }

  addResponse(chatId: string, text: string): void {
    this.add(chatId, `[ME] ${text.slice(0, 500)}`);
  }

  getContext(chatId: string): string {
    return (this.memory.get(chatId) || []).join('\n');
  }

  clear(chatId: string): void {
    this.memory.delete(chatId);
  }
}

// Shared instances
const chatDispatcher = new ChatDispatcher();
const dupFilter = new DuplicateFilter();
const groupBuffer = new GroupContextBuffer();
const chatRing = new ChatHistoryRing();

// Per-chat last message timestamp for elapsed time calculation
const _lastMsgTime = new Map<string, number>();

// Agent → message handler config (loaded from DB when agent starts)
interface AgentMessageConfig {
  agentId: number;
  userId: number;
  selfTgId: number;           // agent's own Telegram user ID
  selfUsername: string;
  systemPrompt: string;       // agent's persona/soul
  dmPolicy: 'open' | 'admin-only' | 'disabled';
  groupPolicy: 'open' | 'mention-only' | 'disabled';
  config: Record<string, any>; // AI config (provider, key, model)
}
const _agentMsgConfigs = new Map<number, AgentMessageConfig>();

/** Register a message handler config for an agent */
export function registerAgentMessageConfig(cfg: AgentMessageConfig): void {
  _agentMsgConfigs.set(cfg.agentId, cfg);
}

/** Unregister message handler config */
export function unregisterAgentMessageConfig(agentId: number): void {
  _agentMsgConfigs.delete(agentId);
}

// ══════════════════════════════════════════════════════════════════════════════

class UserbotManager {
  // Key = agentId (number)
  private clients = new Map<number, AgentClient>();
  private authStates = new Map<number, AuthState>();

  constructor() {
    setTimeout(() => this.restoreAllSessions(), 5000);
    setInterval(() => this.healthCheck(), 5 * 60 * 1000);
  }

  // ── Session restore (always online) ─────────────────────────────────

  async restoreAllSessions(): Promise<void> {
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT id, trigger_config FROM builder_bot.agents WHERE trigger_type = 'ai_agent' AND is_active = true`
      );
      let restored = 0;
      for (const row of res.rows) {
        const agentId = Number(row.id);
        const tc = typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : row.trigger_config;
        const sess = tc?.telegram_session;
        if (sess?.session) {
          try {
            await this.connectAgent(agentId, sess.session);
            console.log(`[UserbotMgr] ✅ Restored agent #${agentId} as @${sess.username || '?'}`);
            restored++;
          } catch (e: any) {
            console.warn(`[UserbotMgr] Failed to restore agent #${agentId}:`, e.message);
          }
        }
      }
      console.log(`[UserbotMgr] Restored ${restored} agent Telegram sessions`);
    } catch (e: any) {
      console.error('[UserbotMgr] restoreAllSessions error:', e.message);
    }
  }

  // ── Connect/Disconnect ──────────────────────────────────────────────

  async connectAgent(agentId: number, sessionString: string): Promise<TelegramClient> {
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 10,
      requestRetries: 5,
      autoReconnect: true,
      useWSS: false,
    });
    await client.connect();

    const me = await Promise.race([
      client.getMe(),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
    ]) as any;

    if (!me) throw new Error('Auth failed');

    this.clients.set(agentId, {
      client,
      connected: true,
      lastUsed: Date.now(),
      telegramUserId: me.id?.toJSNumber?.() ?? Number(me.id),
      username: me.username,
      phone: me.phone,
    });

    return client;
  }

  async disconnectAgent(agentId: number): Promise<void> {
    const ac = this.clients.get(agentId);
    if (ac) {
      try { await ac.client.disconnect(); } catch {}
      this.clients.delete(agentId);
    }
    await this.deleteSessionFromDB(agentId);
    this.authStates.delete(agentId);
    console.log(`[UserbotMgr] Disconnected agent #${agentId}`);
  }

  // ── Health check ────────────────────────────────────────────────────

  private async healthCheck(): Promise<void> {
    for (const [agentId, ac] of this.clients) {
      if (!ac.connected) {
        try {
          const sess = await this.loadSessionFromDB(agentId);
          if (sess) {
            await this.connectAgent(agentId, sess);
            console.log(`[UserbotMgr] Reconnected agent #${agentId}`);
          }
        } catch {}
        continue;
      }
      try {
        await Promise.race([
          ac.client.getMe(),
          new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]);
      } catch {
        console.warn(`[UserbotMgr] Client dead for agent #${agentId}, reconnecting...`);
        ac.connected = false;
        try {
          const sess = await this.loadSessionFromDB(agentId);
          if (sess) await this.connectAgent(agentId, sess);
        } catch {}
      }
    }
  }

  // ── DB operations (session stored in agent's trigger_config) ────────

  async loadSessionFromDB(agentId: number): Promise<string | null> {
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT trigger_config FROM builder_bot.agents WHERE id = $1`,
        [agentId]
      );
      if (res.rows.length > 0) {
        const tc = typeof res.rows[0].trigger_config === 'string'
          ? JSON.parse(res.rows[0].trigger_config)
          : res.rows[0].trigger_config;
        return tc?.telegram_session?.session || null;
      }
    } catch (e: any) {
      console.error('[UserbotMgr] loadSession error:', e.message);
    }
    return null;
  }

  async saveSessionToDB(agentId: number, session: string, meta?: { phone?: string; username?: string; telegramUserId?: number }): Promise<void> {
    try {
      const pool = getPool();
      // Read existing trigger_config, merge telegram_session
      const res = await pool.query(`SELECT trigger_config FROM builder_bot.agents WHERE id = $1`, [agentId]);
      if (res.rows.length === 0) return;
      const tc = typeof res.rows[0].trigger_config === 'string'
        ? JSON.parse(res.rows[0].trigger_config)
        : (res.rows[0].trigger_config || {});
      tc.telegram_session = { session, ...meta, updatedAt: new Date().toISOString() };
      await pool.query(
        `UPDATE builder_bot.agents SET trigger_config = $1::jsonb WHERE id = $2`,
        [JSON.stringify(tc), agentId]
      );
    } catch (e: any) {
      console.error('[UserbotMgr] saveSession error:', e.message);
    }
  }

  async deleteSessionFromDB(agentId: number): Promise<void> {
    try {
      const pool = getPool();
      const res = await pool.query(`SELECT trigger_config FROM builder_bot.agents WHERE id = $1`, [agentId]);
      if (res.rows.length === 0) return;
      const tc = typeof res.rows[0].trigger_config === 'string'
        ? JSON.parse(res.rows[0].trigger_config)
        : (res.rows[0].trigger_config || {});
      delete tc.telegram_session;
      await pool.query(
        `UPDATE builder_bot.agents SET trigger_config = $1::jsonb WHERE id = $2`,
        [JSON.stringify(tc), agentId]
      );
    } catch (e: any) {
      console.error('[UserbotMgr] deleteSession error:', e.message);
    }
  }

  // ── Client access ───────────────────────────────────────────────────

  async getClient(agentId: number): Promise<TelegramClient | null> {
    const existing = this.clients.get(agentId);
    if (existing?.connected) {
      existing.lastUsed = Date.now();
      return existing.client;
    }
    const sessionStr = await this.loadSessionFromDB(agentId);
    if (!sessionStr) return null;
    try {
      return await this.connectAgent(agentId, sessionStr);
    } catch (e: any) {
      console.error(`[UserbotMgr] Connect failed for agent #${agentId}:`, e.message);
      return null;
    }
  }

  async isAgentAuthorized(agentId: number): Promise<boolean> {
    const ac = this.clients.get(agentId);
    if (ac?.connected) return true;
    const sessionStr = await this.loadSessionFromDB(agentId);
    return !!sessionStr;
  }

  async getAgentTelegramInfo(agentId: number): Promise<{ authorized: boolean; username?: string; phone?: string; telegramUserId?: number }> {
    const ac = this.clients.get(agentId);
    if (ac?.connected) {
      return { authorized: true, username: ac.username, phone: ac.phone, telegramUserId: ac.telegramUserId };
    }
    try {
      const pool = getPool();
      const res = await pool.query(`SELECT trigger_config FROM builder_bot.agents WHERE id = $1`, [agentId]);
      if (res.rows.length > 0) {
        const tc = typeof res.rows[0].trigger_config === 'string'
          ? JSON.parse(res.rows[0].trigger_config)
          : res.rows[0].trigger_config;
        const sess = tc?.telegram_session;
        if (sess?.session) {
          return { authorized: true, username: sess.username, phone: sess.phone, telegramUserId: sess.telegramUserId };
        }
      }
    } catch {}
    return { authorized: false };
  }

  // ══════════════════════════════════════════════════════════════════════
  // AUTH METHOD 1: QR Code Login
  // ══════════════════════════════════════════════════════════════════════

  async startQRLogin(agentId: number, timeoutMs = 120_000): Promise<{ ok: boolean; qrUrl?: string; expiresIn?: number; error?: string }> {
    const prev = this.authStates.get(agentId);
    if (prev?.cancelFn) prev.cancelFn();

    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 5, requestRetries: 3, autoReconnect: true, useWSS: false,
    });
    await client.connect();

    const state: AuthState = {
      client, done: false, cancelFn: null, currentToken: null, status: 'pending',
    };
    this.authStates.set(agentId, state);

    return new Promise<{ ok: boolean; qrUrl?: string; expiresIn?: number; error?: string }>(async (resolve) => {
      let refreshTimer: NodeJS.Timeout | null = null;
      let updateHandler: ((upd: any) => Promise<void>) | null = null;
      let rawFilter: any = null;

      const finish = (result: { ok: boolean; error?: string }) => {
        if (state.done) return;
        state.done = true;
        state.cancelFn = null;
        if (refreshTimer) clearTimeout(refreshTimer);
        if (updateHandler && rawFilter) {
          try { client.removeEventHandler(updateHandler, rawFilter); } catch {}
        }
        if (!result.ok) { state.status = 'error'; state.error = result.error; }
      };

      state.cancelFn = () => finish({ ok: false, error: 'cancelled' });
      const timeoutHandle = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs);

      const saveAndFinish = async () => {
        const sessionStr = client.session.save() as unknown as string;
        const me = await client.getMe() as any;
        clearTimeout(timeoutHandle);
        await this.saveSessionToDB(agentId, sessionStr, {
          username: me?.username, phone: me?.phone,
          telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
        });
        this.clients.set(agentId, {
          client, connected: true, lastUsed: Date.now(),
          telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
          username: me?.username, phone: me?.phone,
        });
        state.status = 'success';
        console.log(`[UserbotMgr] ✅ Agent #${agentId} QR login as @${me?.username}`);
        finish({ ok: true });
      };

      updateHandler = async (upd: any) => {
        if (state.done || !state.currentToken) return;
        const isLoginToken = upd.className === 'UpdateLoginToken' || upd.CONSTRUCTOR_ID === 0x564FE691;
        if (!isLoginToken) return;
        try {
          const res = await (client as any).invoke(new Api.auth.ImportLoginToken({ token: state.currentToken })) as any;
          if (res.className === 'auth.LoginTokenSuccess') {
            await saveAndFinish();
          } else if (res.className === 'auth.LoginTokenMigrateTo') {
            if (refreshTimer) clearTimeout(refreshTimer);
            generateQR();
          }
        } catch (e: any) {
          if ((e.message || '').includes('SESSION_PASSWORD_NEEDED')) {
            if (refreshTimer) clearTimeout(refreshTimer);
            state.status = 'need_password';
            state.complete2FA = async (password: string) => {
              try {
                const { computeCheck } = require('telegram/Password');
                const accountPwd = await (client as any).invoke(new Api.account.GetPassword());
                const pwdCheck = await computeCheck(accountPwd, password);
                await (client as any).invoke(new Api.auth.CheckPassword({ password: pwdCheck }));
                await saveAndFinish();
                return { ok: true };
              } catch (e2: any) {
                if ((e2.message || '').includes('PASSWORD_HASH_INVALID')) return { ok: false, error: 'Wrong password' };
                finish({ ok: false, error: e2.message });
                return { ok: false, error: e2.message };
              }
            };
          }
        }
      };

      try {
        const { Raw: RawEvt } = require('telegram/events');
        rawFilter = new RawEvt({});
        client.addEventHandler(updateHandler!, rawFilter);
      } catch (e: any) {
        resolve({ ok: false, error: 'Events module unavailable' });
        return;
      }

      const generateQR = async () => {
        if (state.done) return;
        try {
          const res = await (client as any).invoke(new Api.auth.ExportLoginToken({
            apiId: API_ID, apiHash: API_HASH, exceptIds: [],
          })) as any;
          state.currentToken = Buffer.from(res.token as Uint8Array);
          const expiresTs: number = typeof res.expires === 'number' ? res.expires : Number(res.expires);
          const nowSec = Math.floor(Date.now() / 1000);
          const expiresIn = Math.max(10, expiresTs - nowSec);
          state.qrUrl = `tg://login?token=${state.currentToken.toString('base64url')}`;
          state.expiresIn = expiresIn;
          if (!state.done) {
            refreshTimer = setTimeout(generateQR, Math.max(5000, (expiresIn - 5) * 1000));
          }
        } catch (e: any) {
          state.error = e.message;
          finish({ ok: false, error: e.message });
        }
      };

      await generateQR();
      resolve({ ok: true, qrUrl: state.qrUrl, expiresIn: state.expiresIn });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // AUTH METHOD 2: Phone + Code + 2FA
  // ══════════════════════════════════════════════════════════════════════

  async startPhoneLogin(agentId: number, phone: string): Promise<{ ok: boolean; error?: string }> {
    const prev = this.authStates.get(agentId);
    if (prev?.cancelFn) prev.cancelFn();

    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 5, requestRetries: 3, autoReconnect: true, useWSS: false,
    });
    await client.connect();

    const state: AuthState = {
      client, done: false, cancelFn: null, currentToken: null, status: 'pending', phone,
    };

    try {
      const result = await (client as any).invoke(new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({}),
      })) as any;

      state.phoneHash = result.phoneCodeHash;
      state.status = 'waiting_code';

      // Setup code submission handler
      state.submitCode = async (code: string) => {
        try {
          await (client as any).invoke(new Api.auth.SignIn({
            phoneNumber: phone,
            phoneCodeHash: state.phoneHash!,
            phoneCode: code,
          }));
          // Success — save session
          const sessionStr = client.session.save() as unknown as string;
          const me = await client.getMe() as any;
          await this.saveSessionToDB(agentId, sessionStr, {
            username: me?.username, phone: me?.phone,
            telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
          });
          this.clients.set(agentId, {
            client, connected: true, lastUsed: Date.now(),
            telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
            username: me?.username, phone: me?.phone,
          });
          state.status = 'success';
          state.done = true;
          console.log(`[UserbotMgr] ✅ Agent #${agentId} phone login as @${me?.username}`);
          return { ok: true };
        } catch (e: any) {
          const msg = e.message || '';
          if (msg.includes('SESSION_PASSWORD_NEEDED')) {
            state.status = 'need_password';
            // Setup 2FA handler
            state.complete2FA = async (password: string) => {
              try {
                const { computeCheck } = require('telegram/Password');
                const accountPwd = await (client as any).invoke(new Api.account.GetPassword());
                const pwdCheck = await computeCheck(accountPwd, password);
                await (client as any).invoke(new Api.auth.CheckPassword({ password: pwdCheck }));
                const sessionStr2 = client.session.save() as unknown as string;
                const me2 = await client.getMe() as any;
                await this.saveSessionToDB(agentId, sessionStr2, {
                  username: me2?.username, phone: me2?.phone,
                  telegramUserId: me2?.id?.toJSNumber?.() ?? Number(me2?.id),
                });
                this.clients.set(agentId, {
                  client, connected: true, lastUsed: Date.now(),
                  telegramUserId: me2?.id?.toJSNumber?.() ?? Number(me2?.id),
                  username: me2?.username, phone: me2?.phone,
                });
                state.status = 'success';
                state.done = true;
                console.log(`[UserbotMgr] ✅ Agent #${agentId} phone+2FA as @${me2?.username}`);
                return { ok: true };
              } catch (e2: any) {
                if ((e2.message || '').includes('PASSWORD_HASH_INVALID')) return { ok: false, error: 'Wrong password' };
                return { ok: false, error: e2.message };
              }
            };
            return { ok: false, error: 'need_password' };
          }
          if (msg.includes('PHONE_CODE_INVALID')) return { ok: false, error: 'Invalid code' };
          if (msg.includes('PHONE_CODE_EXPIRED')) return { ok: false, error: 'Code expired' };
          return { ok: false, error: msg };
        }
      };

      this.authStates.set(agentId, state);
      return { ok: true };
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('PHONE_NUMBER_INVALID')) return { ok: false, error: 'Invalid phone number' };
      if (msg.includes('PHONE_NUMBER_FLOOD')) return { ok: false, error: 'Too many attempts, try later' };
      return { ok: false, error: msg };
    }
  }

  // ── Polling / submission ────────────────────────────────────────────

  getAuthStatus(agentId: number): { status: string; qrUrl?: string; expiresIn?: number; error?: string } {
    const state = this.authStates.get(agentId);
    if (!state) return { status: 'none' };
    return { status: state.status, qrUrl: state.qrUrl, expiresIn: state.expiresIn, error: state.error };
  }

  async submitCode(agentId: number, code: string): Promise<{ ok: boolean; error?: string }> {
    const state = this.authStates.get(agentId);
    if (!state?.submitCode) return { ok: false, error: 'No code submission pending' };
    return state.submitCode(code);
  }

  async submit2FAPassword(agentId: number, password: string): Promise<{ ok: boolean; error?: string }> {
    const state = this.authStates.get(agentId);
    if (!state?.complete2FA) return { ok: false, error: 'No 2FA pending' };
    return state.complete2FA(password);
  }

  get activeCount(): number { return this.clients.size; }

  // ── Build sandbox for agent runtime ─────────────────────────────────

  async buildAgentSandbox(agentId: number): Promise<Record<string, Function> | null> {
    const client = await this.getClient(agentId);
    if (!client) return null;

    const ac = this.clients.get(agentId);
    if (ac) ac.lastUsed = Date.now();

    const wrap = <T extends (...args: any[]) => any>(fn: (client: TelegramClient, ...args: any[]) => ReturnType<T>) => {
      return (...args: any[]) => fn(client, ...args);
    };

    return {
      sendMessage:    wrap(ubSendMessage),
      getMessages:    wrap(ubGetMessages),
      getChannelInfo: wrap(ubGetChannelInfo),
      joinChannel:    wrap(ubJoinChannel),
      leaveChannel:   wrap(ubLeaveChannel),
      getDialogs:     wrap(ubGetDialogs),
      getMembers:     wrap(ubGetMembers),
      forwardMessage: wrap(ubForwardMessage),
      deleteMessage:  wrap(ubDeleteMessage),
      searchMessages: wrap(ubSearchMessages),
      getUserInfo:    wrap(ubGetUserInfo),
      sendFile:       wrap(ubSendFile),
      replyMessage:   wrap(ubReplyMessage),
      reactMessage:   wrap(ubReactMessage),
      editMessage:    wrap(ubEditMessage),
      pinMessage:     wrap(ubPinMessage),
      markRead:       wrap(ubMarkRead),
      getComments:    wrap(ubGetComments),
      setTyping:      wrap(ubSetTyping),
      sendFormatted:  wrap(ubSendFormatted),
      getMessageById: wrap(ubGetMessageById),
      getUnread:      wrap(ubGetUnread),
    };
  }

  // ── Backward compat wrappers (old per-user calls route to agent) ────

  async buildUserSandbox(userId: number): Promise<Record<string, Function> | null> {
    // Find first active agent for this user that has a telegram session
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT id FROM builder_bot.agents WHERE user_id = $1 AND trigger_type = 'ai_agent' AND is_active = true ORDER BY id DESC LIMIT 1`,
        [userId]
      );
      if (res.rows.length > 0) {
        return this.buildAgentSandbox(Number(res.rows[0].id));
      }
    } catch {}
    return null;
  }

  async getUserInfo(userId: number): Promise<{ authorized: boolean; username?: string; phone?: string; telegramUserId?: number } | null> {
    return { authorized: false };
  }

  async isUserAuthorized(userId: number): Promise<boolean> {
    return false;
  }

  async disconnectUser(userId: number): Promise<void> {
    // noop — use disconnectAgent instead
  }

  async startQRLoginLegacy(userId: number): Promise<any> {
    return { ok: false, error: 'Use per-agent auth instead' };
  }

  getQRStatus(userId: number): any {
    return { status: 'none' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MESSAGE LISTENER — makes agent respond to incoming Telegram messages
  // ══════════════════════════════════════════════════════════════════════

  private messageHandlers = new Map<number, { handler: Function; filter: any }>();

  /**
   * Enable incoming message listener for an agent.
   * The agent will respond to DMs, group mentions, etc. like a real person.
   */
  async enableMessageListener(agentId: number): Promise<boolean> {
    // Try to get client — may need to lazy-connect from DB session
    let client = await this.getClient(agentId);
    if (!client) return false;

    const ac = this.clients.get(agentId);
    if (!ac) return false;

    // Don't register twice
    if (this.messageHandlers.has(agentId)) return true;

    const selfId = ac.telegramUserId || 0;
    const selfUsername = (ac.username || '').toLowerCase();

    try {
      const { NewMessage } = require('telegram/events');
      const filter = new NewMessage({});

      const handler = async (event: any) => {
        try {
          const msg = event.message;
          if (!msg || !msg.message) return; // no text

          // Parse message
          const parsed = await this.parseMessage(client, msg, selfId, selfUsername);
          if (!parsed) return;

          // Skip own messages
          if (parsed.senderId === selfId) return;

          // Dedup
          if (dupFilter.isDuplicate(parsed.chatId, parsed.id)) return;

          // Get agent config
          const cfg = _agentMsgConfigs.get(agentId);
          if (!cfg) return; // agent not configured for message handling

          // Decision: should we respond?
          const shouldRespond = this.shouldRespond(parsed, cfg);

          // Always store to conversation memory (even if not responding)
          const elapsed = _lastMsgTime.has(parsed.chatId)
            ? Math.floor(parsed.date - (_lastMsgTime.get(parsed.chatId) || 0))
            : undefined;
          _lastMsgTime.set(parsed.chatId, parsed.date);
          const envelope = buildContextFrame(parsed, elapsed);
          chatRing.add(parsed.chatId, envelope);

          if (!shouldRespond) {
            // In groups: accumulate pending history for when we ARE mentioned
            if (parsed.isGroup) groupBuffer.add(parsed.chatId, parsed);
            return;
          }

          // Enqueue to per-chat serial queue
          chatDispatcher.enqueue(parsed.chatId, async () => {
            await this.processTgInboxMessage(agentId, parsed, cfg);
          });
        } catch (e: any) {
          console.error(`[UserbotMgr] Message handler error agent #${agentId}:`, e.message);
        }
      };

      client.addEventHandler(handler, filter);
      this.messageHandlers.set(agentId, { handler, filter });
      console.log(`[UserbotMgr] ✅ Message listener enabled for agent #${agentId} (@${selfUsername})`);
      return true;
    } catch (e: any) {
      console.error(`[UserbotMgr] Failed to enable listener for agent #${agentId}:`, e.message);
      return false;
    }
  }

  /** Disable message listener */
  disableMessageListener(agentId: number): void {
    const entry = this.messageHandlers.get(agentId);
    if (!entry) return;
    const ac = this.clients.get(agentId);
    if (ac?.client) {
      try { ac.client.removeEventHandler(entry.handler as any, entry.filter); } catch {}
    }
    this.messageHandlers.delete(agentId);
    unregisterAgentMessageConfig(agentId);
    console.log(`[UserbotMgr] Message listener disabled for agent #${agentId}`);
  }

  /** Parse raw GramJS message into TgInboxMessage */
  private async parseMessage(
    client: TelegramClient,
    msg: any,
    selfId: number,
    selfUsername: string,
  ): Promise<TgInboxMessage | null> {
    try {
      const chatId = String(msg.chatId || msg.peerId?.channelId || msg.peerId?.chatId || msg.peerId?.userId || 0);
      const senderId = msg.senderId?.toJSNumber?.() ?? Number(msg.senderId || msg.fromId?.userId || 0);
      let senderUsername = '';
      let senderFirstName = '';

      try {
        if (msg.sender) {
          senderUsername = msg.sender.username || '';
          senderFirstName = msg.sender.firstName || '';
        }
      } catch {}

      const text = msg.message || '';
      const isChannel = msg.post === true;
      const isGroup = !isChannel && (chatId.startsWith('-') || !!msg.peerId?.chatId);

      // Check if mentions me
      const mentionsMe = msg.mentioned === true
        || (selfUsername && text.toLowerCase().includes(`@${selfUsername}`));

      return {
        id: msg.id,
        chatId,
        senderId,
        senderUsername,
        senderFirstName,
        text,
        date: msg.date || Math.floor(Date.now() / 1000),
        isGroup,
        isChannel,
        isBot: msg.sender?.bot === true,
        mentionsMe,
        replyToId: msg.replyTo?.replyToMsgId,
        hasMedia: !!msg.media,
        mediaType: msg.media?.className || undefined,
        _raw: msg,
      };
    } catch (e: any) {
      console.error('[UserbotMgr] parseMessage error:', e.message);
      return null;
    }
  }

  /** Decide if agent should respond to this message */
  private shouldRespond(msg: TgInboxMessage, cfg: AgentMessageConfig): boolean {
    // Never respond to bots
    if (msg.isBot) return false;
    // Never respond to channel posts
    if (msg.isChannel) return false;

    if (msg.isGroup) {
      if (cfg.groupPolicy === 'disabled') return false;
      if (cfg.groupPolicy === 'mention-only') return msg.mentionsMe;
      return msg.mentionsMe; // default: mention-only for groups
    }

    // DM
    if (cfg.dmPolicy === 'disabled') return false;
    return true; // respond to all DMs by default
  }

  /** Process incoming message through AI and respond */
  private async processTgInboxMessage(
    agentId: number,
    msg: TgInboxMessage,
    cfg: AgentMessageConfig,
  ): Promise<void> {
    const client = await this.getClient(agentId);
    if (!client) return;

    try {
      // Show typing indicator
      try {
        const peer = await (client as any).getInputEntity(msg.chatId);
        await (client as any).invoke(new Api.messages.SetTyping({
          peer, action: new Api.SendMessageTypingAction(),
        }));
      } catch {}

      // Build context: pending history (group) + conversation memory
      let contextMessages = '';
      if (msg.isGroup) {
        const pending = groupBuffer.flush(msg.chatId);
        if (pending.length > 0) {
          contextMessages = '[Сообщения в чате с момента моего последнего ответа]\n'
            + pending.map(p => buildContextFrame(p)).join('\n') + '\n\n';
        }
      }
      contextMessages += '[Текущее сообщение]\n' + buildContextFrame(msg);

      // Get conversation history
      const history = chatRing.getContext(msg.chatId);

      // Build full prompt for AI
      const chatContext = history
        ? `[Контекст чата — последние сообщения]\n${history}\n\n${contextMessages}`
        : contextMessages;

      // Call AI via the agent runtime
      const { runAIAgentTick } = await import('../agents/ai-agent-runtime');
      const result = await runAIAgentTick({
        agentId: cfg.agentId,
        userId: cfg.userId,
        systemPrompt: cfg.systemPrompt + `\n\n[IMPORTANT] Ты отвечаешь в Telegram как реальный пользователь. Будь естественным, коротким, человечным. НЕ используй notify() — отвечай текстом напрямую. Текущий чат: ${msg.isGroup ? 'группа' : 'личные сообщения'}. ${msg.isGroup ? 'Тебя упомянули — ответь.' : 'Это ЛС — ответь.'}`,
        config: cfg.config,
        pendingMessages: [chatContext],
        onNotify: async () => {}, // suppress notify — we send via MTProto
      });

      // Send response via MTProto (as the real user, not bot)
      if (result.finalResponse) {
        const responseText = result.finalResponse.slice(0, 4096); // TG limit
        try {
          await (client as any).sendMessage(msg.chatId, {
            message: responseText,
            replyTo: msg.isGroup ? msg.id : undefined, // reply in groups
          });
          chatRing.addResponse(msg.chatId, responseText);
          console.log(`[UserbotMgr] Agent #${agentId} replied in ${msg.isGroup ? 'group' : 'DM'} ${msg.chatId}: ${responseText.slice(0, 80)}...`);
        } catch (sendErr: any) {
          console.error(`[UserbotMgr] Send failed agent #${agentId}:`, sendErr.message);
        }
      }
    } catch (e: any) {
      console.error(`[UserbotMgr] processMessage error agent #${agentId}:`, e.message);
    }
  }
}

// ── Per-client userbot functions ──────────────────────────────────────

async function ubSendMessage(client: TelegramClient, chatId: string | number, text: string): Promise<number> {
  const result = await (client as any).sendMessage(chatId, { message: text }) as any;
  return result?.id ?? 0;
}

async function ubGetMessages(client: TelegramClient, chatId: string | number, limit = 20) {
  const msgs = await (client as any).getMessages(chatId, { limit }) as any[];
  return msgs.map((m: any) => ({
    id: m.id, text: m.message || '', date: m.date,
    from: m.sender?.username || m.sender?.firstName || '',
    fromId: m.senderId?.toJSNumber?.() ?? m.senderId,
  }));
}

async function ubGetChannelInfo(client: TelegramClient, chatId: string | number) {
  const entity = await (client as any).getEntity(chatId) as any;
  return {
    id: String(entity.id), title: entity.title || entity.firstName || String(chatId),
    username: entity.username, membersCount: entity.participantsCount, description: entity.about,
  };
}

async function ubJoinChannel(client: TelegramClient, username: string) {
  await (client as any).invoke(new Api.channels.JoinChannel({ channel: await (client as any).getEntity(username) }));
}

async function ubLeaveChannel(client: TelegramClient, username: string | number) {
  await (client as any).invoke(new Api.channels.LeaveChannel({ channel: await (client as any).getEntity(username) }));
}

async function ubGetDialogs(client: TelegramClient, limit = 20) {
  const dialogs = await (client as any).getDialogs({ limit }) as any[];
  return dialogs.map((d: any) => ({
    id: String(d.id), title: d.title || d.name || String(d.id),
    type: d.isChannel ? 'channel' : d.isGroup ? 'group' : 'user', unread: d.unreadCount || 0,
  }));
}

async function ubGetMembers(client: TelegramClient, chatId: string | number, limit = 50) {
  const p = await (client as any).getParticipants(chatId, { limit }) as any[];
  return p.map((m: any) => ({
    id: m.id?.toJSNumber?.() ?? Number(m.id), username: m.username,
    name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || String(m.id),
  }));
}

async function ubForwardMessage(client: TelegramClient, fromChatId: string | number, messageId: number, toChatId: string | number) {
  await (client as any).forwardMessages(toChatId, { messages: [messageId], fromPeer: fromChatId });
}

async function ubDeleteMessage(client: TelegramClient, chatId: string | number, messageId: number) {
  await (client as any).deleteMessages(chatId, [messageId], { revoke: true });
}

async function ubSearchMessages(client: TelegramClient, chatId: string | number, query: string, limit = 20) {
  const msgs = await (client as any).getMessages(chatId, { limit, search: query }) as any[];
  return msgs.map((m: any) => ({
    id: m.id, text: m.message || '', date: m.date,
    from: m.sender?.username || m.sender?.firstName || '',
    fromId: m.senderId?.toJSNumber?.() ?? m.senderId,
  }));
}

async function ubGetUserInfo(client: TelegramClient, userIdentifier: string | number) {
  const entity = await (client as any).getEntity(userIdentifier) as any;
  return {
    id: entity.id?.toJSNumber?.() ?? Number(entity.id), username: entity.username,
    firstName: entity.firstName, lastName: entity.lastName, bio: entity.about, phone: entity.phone,
  };
}

async function ubSendFile(client: TelegramClient, chatId: string | number, filePath: string, caption?: string) {
  const result = await (client as any).sendFile(chatId, { file: filePath, caption }) as any;
  return result?.id ?? 0;
}

async function ubReplyMessage(client: TelegramClient, chatId: string | number, replyToMsgId: number, text: string) {
  const result = await (client as any).sendMessage(chatId, { message: text, replyTo: replyToMsgId }) as any;
  return result?.id ?? 0;
}

async function ubReactMessage(client: TelegramClient, chatId: string | number, messageId: number, emoji: string) {
  const peer = await (client as any).getInputEntity(chatId);
  await (client as any).invoke(new Api.messages.SendReaction({ peer, msgId: messageId, reaction: [new Api.ReactionEmoji({ emoticon: emoji })] }));
}

async function ubEditMessage(client: TelegramClient, chatId: string | number, messageId: number, newText: string) {
  await (client as any).editMessage(chatId, { message: messageId, text: newText });
}

async function ubPinMessage(client: TelegramClient, chatId: string | number, messageId: number, silent = true) {
  await (client as any).pinMessage(chatId, messageId, { notify: !silent });
}

async function ubMarkRead(client: TelegramClient, chatId: string | number) {
  await (client as any).markAsRead(chatId);
}

async function ubGetComments(client: TelegramClient, chatId: string | number, postMsgId: number, limit = 30) {
  try {
    const peer = await (client as any).getInputEntity(chatId);
    const result = await (client as any).invoke(new Api.messages.GetReplies({
      peer, msgId: postMsgId, offsetId: 0, offsetDate: 0, addOffset: 0, limit, maxId: 0, minId: 0, hash: 0 as any,
    })) as any;
    return (result.messages || []).map((m: any) => ({
      id: m.id, text: m.message || '', date: m.date,
      from: '', fromId: m.fromId?.userId?.toJSNumber?.() ?? m.fromId?.userId ?? 0,
    }));
  } catch { return []; }
}

async function ubSetTyping(client: TelegramClient, chatId: string | number) {
  const peer = await (client as any).getInputEntity(chatId);
  await (client as any).invoke(new Api.messages.SetTyping({ peer, action: new Api.SendMessageTypingAction() }));
}

async function ubSendFormatted(client: TelegramClient, chatId: string | number, html: string, replyTo?: number) {
  const result = await (client as any).sendMessage(chatId, { message: html, parseMode: 'html', replyTo: replyTo || undefined }) as any;
  return result?.id ?? 0;
}

async function ubGetMessageById(client: TelegramClient, chatId: string | number, messageId: number) {
  try {
    const msgs = await (client as any).getMessages(chatId, { ids: [messageId] }) as any[];
    if (!msgs.length) return null;
    const m = msgs[0];
    return { id: m.id, text: m.message || '', date: m.date, from: m.sender?.username || m.sender?.firstName || '', fromId: m.senderId?.toJSNumber?.() ?? m.senderId };
  } catch { return null; }
}

async function ubGetUnread(client: TelegramClient, limit = 10) {
  const dialogs = await (client as any).getDialogs({ limit: 50 }) as any[];
  return dialogs
    .filter((d: any) => (d.unreadCount || 0) > 0)
    .slice(0, limit)
    .map((d: any) => ({
      chatId: String(d.id), title: d.title || d.name || String(d.id),
      unread: d.unreadCount || 0, lastMessage: d.message?.message?.slice(0, 200) || '',
    }));
}

// ── Singleton export ────────────────────────────────────────────────

export const userbotManager = new UserbotManager();
export default userbotManager;
