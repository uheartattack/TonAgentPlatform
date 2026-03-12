/**
 * UserbotManager — Per-user GramJS MTProto session manager
 *
 * Like Telethon: each user connects ANY Telegram account,
 * agents operate as that real Telegram user.
 *
 * Sessions stored in DB (user_settings key=telegram_session).
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { Pool } from 'pg';

const API_ID   = parseInt(process.env.TG_API_ID   || '2040');
const API_HASH =          process.env.TG_API_HASH  || 'b18441a1ff607e10a989891a5462e627';

interface UserClient {
  client: TelegramClient;
  connected: boolean;
  lastUsed: number;
  telegramUserId?: number;
  username?: string;
  phone?: string;
}

interface QRAuthState {
  client: TelegramClient;
  done: boolean;
  cancelFn: (() => void) | null;
  currentToken: Buffer | null;
  status: 'pending' | 'success' | 'need_password' | 'error';
  qrUrl?: string;
  expiresIn?: number;
  error?: string;
  complete2FA?: (password: string) => Promise<{ ok: boolean; error?: string }>;
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

class UserbotManager {
  private clients = new Map<number, UserClient>();
  private qrStates = new Map<number, QRAuthState>();

  // Idle TTL: disconnect after 30min of no use (session stays in DB)
  private idleTTL = 30 * 60 * 1000;

  constructor() {
    // Cleanup idle clients every 5min
    setInterval(() => this.cleanupIdle(), 5 * 60 * 1000);
  }

  // ── Session DB operations ─────────────────────────────────────────

  async loadSessionFromDB(userId: number): Promise<string | null> {
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'telegram_session'`,
        [userId]
      );
      if (res.rows.length > 0) {
        const val = res.rows[0].value;
        return typeof val === 'string' ? val : (val as any)?.session || null;
      }
    } catch (e: any) {
      console.error('[UserbotMgr] loadSession error:', e.message);
    }
    return null;
  }

  async saveSessionToDB(userId: number, session: string, meta?: { phone?: string; username?: string; telegramUserId?: number }): Promise<void> {
    try {
      const pool = getPool();
      const value = JSON.stringify({ session, ...meta, updatedAt: new Date().toISOString() });
      await pool.query(
        `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
         VALUES ($1, 'telegram_session', $2::jsonb, NOW())
         ON CONFLICT (user_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [userId, value]
      );
    } catch (e: any) {
      console.error('[UserbotMgr] saveSession error:', e.message);
    }
  }

  async deleteSessionFromDB(userId: number): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `DELETE FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'telegram_session'`,
        [userId]
      );
    } catch (e: any) {
      console.error('[UserbotMgr] deleteSession error:', e.message);
    }
  }

  // ── Client lifecycle ──────────────────────────────────────────────

  async getClient(userId: number): Promise<TelegramClient | null> {
    const existing = this.clients.get(userId);
    if (existing?.connected) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    // Try loading from DB
    const sessionStr = await this.loadSessionFromDB(userId);
    if (!sessionStr) return null;

    try {
      const session = new StringSession(sessionStr);
      const client = new TelegramClient(session, API_ID, API_HASH, {
        connectionRetries: 5,
        requestRetries: 3,
        autoReconnect: true,
        useWSS: false,
      });
      await client.connect();

      // Verify still authorized
      const me = await Promise.race([
        client.getMe(),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (!me) {
        await client.disconnect().catch(() => {});
        return null;
      }

      const uc: UserClient = {
        client,
        connected: true,
        lastUsed: Date.now(),
        telegramUserId: (me as any).id?.toJSNumber?.() ?? Number((me as any).id),
        username: (me as any).username,
        phone: (me as any).phone,
      };
      this.clients.set(userId, uc);

      // Update session (DC info may have changed)
      const newSess = client.session.save() as unknown as string;
      if (newSess) {
        await this.saveSessionToDB(userId, newSess, {
          username: uc.username,
          phone: uc.phone,
          telegramUserId: uc.telegramUserId,
        });
      }

      console.log(`[UserbotMgr] Connected user ${userId} as @${uc.username}`);
      return client;
    } catch (e: any) {
      console.error(`[UserbotMgr] Connect failed for user ${userId}:`, e.message);
      return null;
    }
  }

  async disconnectUser(userId: number): Promise<void> {
    const uc = this.clients.get(userId);
    if (uc) {
      try { await uc.client.disconnect(); } catch {}
      this.clients.delete(userId);
    }
    await this.deleteSessionFromDB(userId);
    this.qrStates.delete(userId);
    console.log(`[UserbotMgr] Disconnected user ${userId}`);
  }

  async isUserAuthorized(userId: number): Promise<boolean> {
    const uc = this.clients.get(userId);
    if (uc?.connected) {
      try {
        const me = await Promise.race([
          uc.client.getMe(),
          new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]);
        return !!me;
      } catch {
        uc.connected = false;
        return false;
      }
    }
    // Check DB
    const sessionStr = await this.loadSessionFromDB(userId);
    return !!sessionStr;
  }

  async getUserInfo(userId: number): Promise<{ authorized: boolean; username?: string; phone?: string; telegramUserId?: number } | null> {
    // Check in-memory first
    const uc = this.clients.get(userId);
    if (uc?.connected) {
      return { authorized: true, username: uc.username, phone: uc.phone, telegramUserId: uc.telegramUserId };
    }
    // Check DB
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'telegram_session'`,
        [userId]
      );
      if (res.rows.length > 0) {
        const val = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
        return { authorized: true, username: val.username, phone: val.phone, telegramUserId: val.telegramUserId };
      }
    } catch {}
    return { authorized: false };
  }

  // ── QR Code Login (per-user, any account) ─────────────────────────

  async startQRLogin(userId: number, timeoutMs = 120_000): Promise<{ ok: boolean; qrUrl?: string; expiresIn?: number; error?: string }> {
    // Cancel previous QR session for this user
    const prev = this.qrStates.get(userId);
    if (prev?.cancelFn) prev.cancelFn();

    // Create fresh client for this user
    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 5,
      requestRetries: 3,
      autoReconnect: true,
      useWSS: false,
    });
    await client.connect();

    const state: QRAuthState = {
      client,
      done: false,
      cancelFn: null,
      currentToken: null,
      status: 'pending',
    };
    this.qrStates.set(userId, state);

    // Setup event-based QR login
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
        if (!result.ok) {
          state.status = 'error';
          state.error = result.error;
        }
      };

      state.cancelFn = () => finish({ ok: false, error: 'cancelled' });

      const timeoutHandle = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs);

      // Handle UpdateLoginToken (user scanned QR)
      updateHandler = async (upd: any) => {
        if (state.done || !state.currentToken) return;
        const isLoginToken = upd.className === 'UpdateLoginToken' || upd.CONSTRUCTOR_ID === 0x564FE691;
        if (!isLoginToken) return;

        try {
          const res = await (client as any).invoke(
            new Api.auth.ImportLoginToken({ token: state.currentToken })
          ) as any;

          if (res.className === 'auth.LoginTokenSuccess') {
            const sessionStr = client.session.save() as unknown as string;
            const me = await client.getMe() as any;
            clearTimeout(timeoutHandle);

            // Save session to DB
            await this.saveSessionToDB(userId, sessionStr, {
              username: me?.username,
              phone: me?.phone,
              telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
            });

            // Store client
            this.clients.set(userId, {
              client,
              connected: true,
              lastUsed: Date.now(),
              telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
              username: me?.username,
              phone: me?.phone,
            });

            state.status = 'success';
            console.log(`[UserbotMgr] ✅ QR login for user ${userId} as @${me?.username}`);
            finish({ ok: true });
          } else if (res.className === 'auth.LoginTokenMigrateTo') {
            if (refreshTimer) clearTimeout(refreshTimer);
            generateQR();
          }
        } catch (e: any) {
          const errMsg: string = e.message || '';
          if (errMsg.includes('SESSION_PASSWORD_NEEDED')) {
            if (refreshTimer) clearTimeout(refreshTimer);
            state.status = 'need_password';

            // Create 2FA completion function
            state.complete2FA = async (password: string) => {
              try {
                const { computeCheck } = require('telegram/Password');
                const accountPwd = await (client as any).invoke(new Api.account.GetPassword());
                const pwdCheck = await computeCheck(accountPwd, password);
                await (client as any).invoke(new Api.auth.CheckPassword({ password: pwdCheck }));

                const sessionStr = client.session.save() as unknown as string;
                const me = await client.getMe() as any;
                clearTimeout(timeoutHandle);

                await this.saveSessionToDB(userId, sessionStr, {
                  username: me?.username,
                  phone: me?.phone,
                  telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
                });

                this.clients.set(userId, {
                  client,
                  connected: true,
                  lastUsed: Date.now(),
                  telegramUserId: me?.id?.toJSNumber?.() ?? Number(me?.id),
                  username: me?.username,
                  phone: me?.phone,
                });

                state.status = 'success';
                console.log(`[UserbotMgr] ✅ QR+2FA for user ${userId} as @${me?.username}`);
                finish({ ok: true });
                return { ok: true };
              } catch (e2: any) {
                const msg = e2.message || '';
                if (msg.includes('PASSWORD_HASH_INVALID')) {
                  return { ok: false, error: 'Wrong password' };
                }
                finish({ ok: false, error: msg });
                return { ok: false, error: msg };
              }
            };
          }
        }
      };

      // Register event handler
      try {
        const { Raw: RawEvt } = require('telegram/events');
        rawFilter = new RawEvt({});
        client.addEventHandler(updateHandler!, rawFilter);
      } catch (e: any) {
        resolve({ ok: false, error: 'Events module unavailable' });
        return;
      }

      // Generate QR
      const generateQR = async () => {
        if (state.done) return;
        try {
          const res = await (client as any).invoke(new Api.auth.ExportLoginToken({
            apiId: API_ID,
            apiHash: API_HASH,
            exceptIds: [],
          })) as any;

          state.currentToken = Buffer.from(res.token as Uint8Array);
          const expiresTs: number = typeof res.expires === 'number' ? res.expires : Number(res.expires);
          const nowSec = Math.floor(Date.now() / 1000);
          const expiresIn = Math.max(10, expiresTs - nowSec);

          const tokenB64 = state.currentToken.toString('base64url');
          state.qrUrl = `tg://login?token=${tokenB64}`;
          state.expiresIn = expiresIn;

          // Auto-refresh 5s before expiry
          if (!state.done) {
            refreshTimer = setTimeout(generateQR, Math.max(5000, (expiresIn - 5) * 1000));
          }
        } catch (e: any) {
          state.error = e.message;
          finish({ ok: false, error: e.message });
        }
      };

      await generateQR();

      // Return immediately with first QR URL (polling handles the rest)
      resolve({ ok: true, qrUrl: state.qrUrl, expiresIn: state.expiresIn });
    });
  }

  /** Poll QR auth status */
  getQRStatus(userId: number): { status: 'pending' | 'success' | 'need_password' | 'error' | 'none'; qrUrl?: string; expiresIn?: number; error?: string } {
    const state = this.qrStates.get(userId);
    if (!state) return { status: 'none' };
    return {
      status: state.status,
      qrUrl: state.qrUrl,
      expiresIn: state.expiresIn,
      error: state.error,
    };
  }

  /** Submit 2FA password after QR scan */
  async submit2FAPassword(userId: number, password: string): Promise<{ ok: boolean; error?: string }> {
    const state = this.qrStates.get(userId);
    if (!state?.complete2FA) return { ok: false, error: 'No 2FA pending' };
    return state.complete2FA(password);
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  private cleanupIdle(): void {
    const now = Date.now();
    for (const [userId, uc] of this.clients) {
      if (now - uc.lastUsed > this.idleTTL) {
        console.log(`[UserbotMgr] Idle disconnect user ${userId}`);
        uc.client.disconnect().catch(() => {});
        uc.connected = false;
        this.clients.delete(userId);
      }
    }
  }

  /** Build per-user userbot sandbox (like Telethon) */
  async buildUserSandbox(userId: number): Promise<Record<string, Function> | null> {
    const client = await this.getClient(userId);
    if (!client) return null;

    const uc = this.clients.get(userId);
    if (uc) uc.lastUsed = Date.now();

    // Wrap each function with the user's client
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
}

// ── Per-client userbot functions (same as telegram-userbot.ts but with explicit client param) ──

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
