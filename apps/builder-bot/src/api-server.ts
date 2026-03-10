/**
 * api-server.ts — Express REST API для лендинга
 * Порт 3001. Телеграм-авторизация через HMAC-SHA256.
 */
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { getDBTools } from './agents/tools/db-tools';
import { getRunnerAgent } from './agents/sub-agents/runner';
import { getPluginManager } from './plugins-system';
import { pool } from './db/index';
import {
  getAgentLogsRepository,
  getExecutionHistoryRepository,
  getUserPluginsRepository,
  getUserSettingsRepository,
  getMarketplaceRepository,
  getAIProposalsRepository,
  getBalanceTxRepository,
} from './db/schema-extensions';
import { verifyTopupTransaction, PLATFORM_WALLET } from './payments';
import { sendPlatformTransaction } from './services/TonConnect';
import { config as platformConfig } from './config';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const BOT_USERNAME = process.env.BOT_USERNAME || 'TonAgentPlatformBot';
const LANDING_URL = process.env.LANDING_URL || `http://localhost:${PORT}`;
const TG_CLIENT_ID = process.env.TG_CLIENT_ID || '';
const TG_CLIENT_SECRET = process.env.TG_CLIENT_SECRET || '';

// ── In-memory session store: token → userId ──────────────────
const sessions = new Map<string, { userId: number; username: string; firstName: string; expiresAt: number }>();

// ── Pending bot-auth tokens (polling auth без Telegram Widget) ──
// token → { pending: true } или { userId, username, firstName }
export const pendingBotAuth = new Map<string, {
  pending: boolean;
  userId?: number;
  username?: string;
  firstName?: string;
  createdAt: number;
}>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getSession(token: string) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(token); return null; }
  return s;
}

// Создать сессию из bot-auth (вызывается из bot.ts)
export function createSessionFromBot(userId: number, username: string, firstName: string): string {
  const token = generateToken();
  sessions.set(token, {
    userId,
    username,
    firstName,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

// ── Telegram Login Widget verification ───────────────────────
// https://core.telegram.org/widgets/login#checking-authorization
function verifyTelegramAuth(data: Record<string, string>): boolean {
  if (!BOT_TOKEN) return false;
  const { hash, ...fields } = data;
  if (!hash) return false;

  // Проверяем срок (max 24 часа)
  const authDate = parseInt(fields.auth_date || '0', 10);
  if (Date.now() / 1000 - authDate > 86400) return false;

  // Строим data-check-string
  const checkString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  return hmac === hash;
}

// ── Telegram OIDC JWT verification ────────────────────────────
// Verify id_token from new Telegram Login SDK
let _jwksCache: any = null;
let _jwksCacheTime = 0;

async function fetchTelegramJWKS(): Promise<any> {
  if (_jwksCache && Date.now() - _jwksCacheTime < 3600_000) return _jwksCache;
  const res = await fetch('https://oauth.telegram.org/.well-known/jwks.json');
  _jwksCache = await res.json();
  _jwksCacheTime = Date.now();
  return _jwksCache;
}

function base64urlDecode(str: string): Buffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

async function verifyTelegramOIDC(idToken: string): Promise<{ userId: number; username: string; firstName: string } | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(base64urlDecode(parts[0]).toString());
    const payload = JSON.parse(base64urlDecode(parts[1]).toString());

    // Validate claims
    if (payload.iss !== 'https://oauth.telegram.org') return null;
    if (String(payload.aud) !== TG_CLIENT_ID && payload.aud !== parseInt(TG_CLIENT_ID)) return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    // Fetch JWKS and verify signature
    const jwks = await fetchTelegramJWKS();
    const key = jwks.keys?.find((k: any) => k.kid === header.kid);
    if (!key) return null;

    // Build RSA public key from JWK
    const pubKey = crypto.createPublicKey({ key, format: 'jwk' });
    const valid = crypto.createVerify('RSA-SHA256')
      .update(parts[0] + '.' + parts[1])
      .verify(pubKey, base64urlDecode(parts[2]));
    if (!valid) return null;

    return {
      userId: parseInt(payload.sub, 10),
      username: payload.preferred_username || '',
      firstName: payload.name || '',
    };
  } catch (e) {
    console.error('OIDC verify error:', e);
    return null;
  }
}

// ── Auth middleware ───────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-auth-token'] as string || req.query.token as string;
  if (!token) { res.status(401).json({ error: 'No token' }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: 'Invalid or expired token' }); return; }
  (req as any).userId = session.userId;
  (req as any).session = session;
  next();
}

// ── Flow → System Prompt converter ────────────────────────────
const NODE_TOOL_MAP: Record<string, string> = {
  timer: '', manual: '', webhook: '',
  get_balance: 'get_ton_balance', nft_floor: 'get_nft_floor',
  gift_prices: 'get_gift_floor_real', scan_arbitrage: 'scan_real_arbitrage',
  web_search: 'web_search', fetch_url: 'fetch_url',
  notify: 'notify', notify_rich: 'notify_rich',
  condition: '', delay: '',
  get_state: 'get_state', set_state: 'set_state',
  send_message: 'tg_send_message',
};

function flowToSystemPrompt(flow: { nodes: any[]; edges: any[] }): string {
  const nodeMap = new Map(flow.nodes.map((n: any) => [n.id, n]));
  // Build adjacency
  const adj = new Map<string, string[]>();
  for (const e of (flow.edges || [])) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  // Find trigger (root) node
  const triggerNode = flow.nodes.find((n: any) => ['timer', 'manual', 'webhook'].includes(n.type));
  const lines: string[] = [];
  lines.push('You execute the following workflow on every tick. Follow these steps EXACTLY in order:');
  lines.push('');
  // BFS through the flow
  const visited = new Set<string>();
  const queue = [triggerNode?.id || flow.nodes[0]?.id];
  let step = 1;
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) continue;
    const cfg = node.config || {};
    if (node.type === 'timer') {
      const mins = Math.round((cfg.intervalMs || 300000) / 60000);
      lines.push(`Step ${step}: TRIGGER — Execute every ${mins} minutes.`);
    } else if (node.type === 'manual') {
      lines.push(`Step ${step}: TRIGGER — Run on demand (manual start).`);
    } else if (node.type === 'webhook') {
      lines.push(`Step ${step}: TRIGGER — Run when webhook is received.`);
    } else if (node.type === 'condition') {
      const children = adj.get(id) || [];
      lines.push(`Step ${step}: CONDITION — If ${cfg.expression || 'true'}:`);
      if (children[0]) { const cn = nodeMap.get(children[0]); lines.push(`  TRUE \u2192 proceed to next step`); }
      if (children[1]) { const cn = nodeMap.get(children[1]); lines.push(`  FALSE \u2192 skip to alternative branch`); }
    } else if (node.type === 'delay') {
      lines.push(`Step ${step}: DELAY — Wait ${cfg.ms || 5000}ms before continuing.`);
    } else {
      const tool = NODE_TOOL_MAP[node.type] || node.type;
      const params = Object.entries(cfg).map(([k, v]) => `${k}="${v}"`).join(', ');
      lines.push(`Step ${step}: ACTION — Call ${tool}(${params})`);
    }
    step++;
    for (const next of (adj.get(id) || [])) queue.push(next);
  }
  lines.push('');
  lines.push('Use set_state/get_state to persist data between ticks.');
  lines.push('Always call notify() to inform the user about important findings.');
  lines.push('Store previous values in state to detect changes.');
  return lines.join('\n');
}

// ── App setup ─────────────────────────────────────────────────
export function startApiServer() {
  const app = express();
  app.use(express.json());

  // CORS — allow platform domain + localhost for dev
  const ALLOWED_ORIGINS = ['https://tonagentplatform.ru', 'http://tonagentplatform.ru', 'http://localhost:3001', 'http://localhost:3000'];
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '';
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Server-to-server or same-origin requests (no Origin header)
      res.header('Access-Control-Allow-Origin', 'https://tonagentplatform.ru');
    } else {
      res.header('Access-Control-Allow-Origin', 'https://tonagentplatform.ru');
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
    next();
  });

  // Статика лендинга
  const landingPath = path.resolve(__dirname, '../../../apps/landing');
  app.use(express.static(landingPath));

  // ── GET /api/config — публичная конфигурация для лендинга ──
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      botUsername: BOT_USERNAME,
      botLink: `https://t.me/${BOT_USERNAME}`,
      landingUrl: LANDING_URL,
      manifestUrl: `${LANDING_URL}/tonconnect-manifest.json`,
      tgClientId: TG_CLIENT_ID ? parseInt(TG_CLIENT_ID) : undefined,
    });
  });

  // ── GET /tonconnect-manifest.json — самохостируемый манифест TON Connect ──
  app.get('/tonconnect-manifest.json', (_req: Request, res: Response) => {
    res.json({
      url: LANDING_URL,
      name: 'TON Agent Platform',
      iconUrl: `${LANDING_URL}/icon.png`,
    });
  });

  // ── GET /api/auth/request — получить deeplink + токен для auth через бота ──
  app.get('/api/auth/request', (_req: Request, res: Response) => {
    const authToken = generateToken().slice(0, 16); // короткий — идёт в deeplink
    pendingBotAuth.set(authToken, { pending: true, createdAt: Date.now() });
    // Удаляем через 5 минут
    setTimeout(() => pendingBotAuth.delete(authToken), 5 * 60 * 1000);
    const botLink = `https://t.me/${BOT_USERNAME}?start=webauth_${authToken}`;
    res.json({ ok: true, authToken, botLink });
  });

  // ── GET /api/auth/check/:token — polling (pending → approved) ──
  app.get('/api/auth/check/:token', (req: Request, res: Response) => {
    const authToken = req.params.token as string;
    const pending = pendingBotAuth.get(authToken);
    if (!pending) { res.json({ ok: false, status: 'not_found' }); return; }
    if (pending.pending) { res.json({ ok: true, status: 'pending' }); return; }
    // Approved — создаём настоящую session
    const sessionToken = generateToken();
    sessions.set(sessionToken, {
      userId: pending.userId!,
      username: pending.username || '',
      firstName: pending.firstName || '',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    pendingBotAuth.delete(authToken);
    res.json({ ok: true, status: 'approved', token: sessionToken, userId: pending.userId, firstName: pending.firstName, username: pending.username });
  });

  // ── POST /api/auth/telegram ───────────────────────────────
  app.post('/api/auth/telegram', (req: Request, res: Response) => {
    const data = req.body as Record<string, string>;
    if (!verifyTelegramAuth(data)) {
      res.status(401).json({ error: 'Invalid Telegram auth data' });
      return;
    }
    const userId = parseInt(data.id, 10);
    const token = generateToken();
    sessions.set(token, {
      userId,
      username: data.username || '',
      firstName: data.first_name || '',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 дней
    });
    res.json({ ok: true, token, userId, username: data.username, firstName: data.first_name });
  });

  // ── POST /api/auth/telegram-oidc — new Telegram Login SDK (JWT) ──
  app.post('/api/auth/telegram-oidc', async (req: Request, res: Response) => {
    const { id_token } = req.body || {};
    if (!id_token || typeof id_token !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing id_token' });
      return;
    }
    const user = await verifyTelegramOIDC(id_token);
    if (!user) {
      res.status(401).json({ ok: false, error: 'Invalid or expired token' });
      return;
    }
    const token = generateToken();
    sessions.set(token, {
      userId: user.userId,
      username: user.username,
      firstName: user.firstName,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, token, userId: user.userId, username: user.username, firstName: user.firstName });
  });

  // ── POST /api/auth/telegram-code — OIDC code exchange flow ──
  app.post('/api/auth/telegram-code', async (req: Request, res: Response) => {
    const { code, redirect_uri } = req.body || {};
    if (!code || !redirect_uri) {
      res.status(400).json({ ok: false, error: 'Missing code or redirect_uri' });
      return;
    }
    try {
      // Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth.telegram.org/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri,
          client_id: TG_CLIENT_ID,
          client_secret: TG_CLIENT_SECRET,
        }).toString(),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.id_token) {
        res.status(401).json({ ok: false, error: tokenData.error || 'Token exchange failed' });
        return;
      }
      // Verify the id_token JWT
      const user = await verifyTelegramOIDC(tokenData.id_token);
      if (!user) {
        res.status(401).json({ ok: false, error: 'Invalid id_token' });
        return;
      }
      const token = generateToken();
      sessions.set(token, {
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ ok: true, token, userId: user.userId, username: user.username, firstName: user.firstName });
    } catch (e: any) {
      console.error('Code exchange error:', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/me ───────────────────────────────────────────
  app.get('/api/me', requireAuth, (req: Request, res: Response) => {
    const session = (req as any).session;
    res.json({ ok: true, userId: session.userId, username: session.username, firstName: session.firstName });
  });

  // ── GET /api/agents ───────────────────────────────────────
  app.get('/api/agents', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const r = await getDBTools().getUserAgents(userId);
      // Enrich with role/xp/level
      const agents = r.data || [];
      try {
        const roleRes = await pool.query(
          'SELECT id, role, xp, level FROM builder_bot.agents WHERE user_id = $1', [userId]
        );
        const roleMap = new Map(roleRes.rows.map((r: any) => [r.id, r]));
        for (const a of agents) {
          const extra = roleMap.get(a.id);
          if (extra) {
            (a as any).role = extra.role || 'worker';
            (a as any).xp = extra.xp || 0;
            (a as any).level = extra.level || 1;
          }
        }
      } catch {}
      res.json({ ok: true, agents });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/agents — создать агента через описание ──────
  app.post('/api/agents', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const { description } = req.body || {};
      if (!description || typeof description !== 'string' || description.trim().length < 8) {
        res.status(400).json({ ok: false, error: 'Description must be at least 8 characters' });
        return;
      }
      const { getOrchestrator } = await import('./agents/orchestrator');
      const result = await getOrchestrator().handleCreateAgent(userId, description.trim());
      if (result.type === 'agent_created' && (result as any).agentId) {
        const agentData = await getDBTools().getAgent((result as any).agentId, userId);
        res.json({ ok: true, agentId: (result as any).agentId, agent: agentData.data || null, message: (result.content || '').replace(/\\/g, '') });
      } else {
        res.json({ ok: false, error: (result.content || 'Creation failed').replace(/\\/g, '') });
      }
    } catch (e: any) {
      console.error('[API] POST /api/agents error:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── POST /api/agents/flow — создать агента из visual flow ──
  app.post('/api/agents/flow', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const { name, flow } = req.body || {};
      if (!flow || !flow.nodes || !flow.nodes.length) {
        res.status(400).json({ ok: false, error: 'Flow must have at least one node' });
        return;
      }
      const agentName = (name && typeof name === 'string' && name.trim()) || 'Flow Agent';
      const systemPrompt = flowToSystemPrompt(flow);
      // Detect interval from trigger node
      let intervalMs = 300000; // default 5 min
      const timerNode = flow.nodes.find((n: any) => n.type === 'timer');
      if (timerNode && timerNode.config && timerNode.config.intervalMs) {
        intervalMs = parseInt(timerNode.config.intervalMs, 10) || 300000;
      }
      // Load user variables for AI config
      let userVars: Record<string, string> = {};
      try {
        const uv = await getUserSettingsRepository().get(userId, 'user_variables');
        if (uv) userVars = typeof uv === 'string' ? JSON.parse(uv) : uv;
      } catch {}
      const created = await getDBTools().createAgent({
        userId,
        name: agentName,
        description: 'Flow: ' + flow.nodes.map((n: any) => n.type).join(' \u2192 '),
        code: systemPrompt,
        triggerType: 'ai_agent',
        triggerConfig: {
          code: systemPrompt,
          intervalMs,
          flow, // store flow JSON for editing
          config: {
            AI_PROVIDER: userVars.AI_PROVIDER || '',
            AI_API_KEY: userVars.AI_API_KEY || '',
          },
        },
        isActive: false,
      });
      if (!created.success || !created.data) {
        res.json({ ok: false, error: created.error || 'DB error' });
        return;
      }
      const agentId = (created.data as any).id;
      // Auto-start
      try { await getRunnerAgent().runAgent({ agentId, userId }); } catch {}
      res.json({ ok: true, agentId, agent: created.data });
    } catch (e: any) {
      console.error('[API] POST /api/agents/flow error:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/agents/:id ───────────────────────────────────
  app.get('/api/agents/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      const r = await getDBTools().getAgent(agentId, userId);
      if (!r.success || !r.data) { res.status(404).json({ error: 'Agent not found' }); return; }
      res.json({ ok: true, agent: r.data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/agents/:id/run ──────────────────────────────
  app.post('/api/agents/:id/run', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      const r = await getRunnerAgent().runAgent({ agentId, userId });
      res.json({ ok: r.success, data: r.data, error: r.error });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/agents/:id/stop ─────────────────────────────
  app.post('/api/agents/:id/stop', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      const r = await getRunnerAgent().pauseAgent(agentId, userId);
      res.json({ ok: r.success, error: r.error });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/agents/:id — удалить агента ──────────────
  app.delete('/api/agents/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      if (isNaN(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }

      // Verify ownership
      const agentCheck = await getDBTools().getAgent(agentId, userId);
      if (!agentCheck.success || !agentCheck.data) { res.status(404).json({ error: 'Agent not found' }); return; }

      // Stop if running
      try { await getRunnerAgent().pauseAgent(agentId, userId); } catch {}

      // Delete from DB
      const r = await getDBTools().deleteAgent(agentId, userId);
      res.json({ ok: r.success, error: r.error });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/agents/:id/rename — переименовать агента ──
  app.post('/api/agents/:id/rename', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      const { name } = req.body || {};
      if (isNaN(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }
      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
        res.status(400).json({ error: 'Name must be 2-60 characters' }); return;
      }

      // Verify ownership first
      const agentCheck = await getDBTools().getAgent(agentId, userId);
      if (!agentCheck.success || !agentCheck.data) { res.status(404).json({ error: 'Agent not found' }); return; }

      // Direct SQL update for name
      await pool.query('UPDATE builder_bot.agents SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [name.trim(), agentId, userId]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/agents/:id/logs ──────────────────────────────
  // DB-backed: возвращает персистентные логи из agent_logs таблицы
  app.get('/api/agents/:id/logs', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      if (isNaN(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }

      // Verify ownership
      const agentCheck = await getDBTools().getAgent(agentId, userId);
      if (!agentCheck.success || !agentCheck.data) { res.status(404).json({ error: 'Agent not found' }); return; }

      const limit = Math.min(parseInt(req.query.limit as string || '30', 10), 100);
      const offset = Math.max(parseInt(req.query.offset as string || '0', 10), 0);

      let logs: any[] = [];
      try {
        const rows = await getAgentLogsRepository().getByAgent(agentId, limit, offset);
        logs = rows.map(r => ({
          id: r.id,
          level: r.level,
          message: r.message,
          details: r.details,
          timestamp: r.createdAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        }));
      } catch {
        const r = await getRunnerAgent().getLogs(agentId, userId, limit);
        logs = r.data?.logs || [];
      }
      res.json({ ok: true, logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/agents/:id/history — история запусков агента ──
  app.get('/api/agents/:id/history', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      if (isNaN(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }

      // Verify ownership
      const agentCheck = await getDBTools().getAgent(agentId, userId);
      if (!agentCheck.success || !agentCheck.data) { res.status(404).json({ error: 'Agent not found' }); return; }

      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      const offset = Math.max(parseInt(req.query.offset as string || '0', 10), 0);
      const rows = await getExecutionHistoryRepository().getByAgent(agentId, limit, offset);
      res.json({ ok: true, history: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/activity — все логи пользователя (для Activity Stream) ──
  app.get('/api/activity', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const limit = parseInt(req.query.limit as string || '50', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);
      const rows = await getAgentLogsRepository().getByUser(userId, limit, offset);
      const activity = rows.map(r => ({
        id: r.id,
        agentId: r.agentId,
        level: r.level,
        message: r.message,
        details: r.details,
        timestamp: (r.createdAt as any).toISOString
          ? (r.createdAt as any).toISOString()
          : new Date(r.createdAt as any).toISOString(),
      }));
      res.json({ ok: true, activity });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/executions — история выполнений (для Operations page) ──
  app.get('/api/executions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const status = req.query.status as string || 'all';
      const limit = parseInt(req.query.limit as string || '20', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);
      const rows = await getExecutionHistoryRepository().getByUser(userId, status, limit, offset);
      res.json({ ok: true, executions: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/plugins — список плагинов (user-aware если авторизован) ──
  app.get('/api/plugins', async (req: Request, res: Response) => {
    try {
      const token = req.headers['x-auth-token'] as string || req.query.token as string;
      let installedPluginIds = new Set<string>();

      if (token) {
        const session = getSession(token);
        if (session) {
          try {
            const userPlugins = await getUserPluginsRepository().getInstalled(session.userId);
            userPlugins.forEach(p => installedPluginIds.add(p.pluginId));
          } catch { /* repo not ready */ }
        }
      }

      const plugins = getPluginManager().getAllPlugins().map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        type: p.type,
        icon: (p as any).icon || '🔌',
        tags: p.tags,
        rating: p.rating,
        downloads: p.downloads,
        price: p.price,
        // isInstalled reflects per-user state if auth token present
        isInstalled: installedPluginIds.size > 0
          ? installedPluginIds.has(p.id) || p.id === 'drain-detector'
          : p.isInstalled,
      }));
      res.json({ ok: true, plugins });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/plugins/:id/install — установить плагин для пользователя ──
  app.post('/api/plugins/:id/install', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const pluginId = req.params.id as string;
      const config = (req.body && req.body.config) || {};

      const plugin = getPluginManager().getPlugin(pluginId);
      if (!plugin) { res.status(404).json({ error: 'Plugin not found' }); return; }

      await getUserPluginsRepository().install(userId, pluginId, config);
      res.json({ ok: true, pluginId, installed: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/plugins/:id — удалить плагин пользователя ──
  app.delete('/api/plugins/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const pluginId = req.params.id as string;

      // drain-detector нельзя удалить
      if (pluginId === 'drain-detector') {
        res.status(403).json({ error: 'Built-in security plugin cannot be removed' });
        return;
      }

      await getUserPluginsRepository().uninstall(userId, pluginId);
      res.json({ ok: true, pluginId, installed: false });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/settings — настройки пользователя ──
  app.get('/api/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const settings = await getUserSettingsRepository().getAll(userId);
      res.json({ ok: true, settings });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/settings — обновить настройки (deep-merge per key) ──
  // Body: { key: string, value: any } или { settings: Record<string, any> }
  app.post('/api/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const body = req.body as any;

      if (body.key && body.value !== undefined) {
        // Single key update
        await getUserSettingsRepository().set(userId, body.key, body.value);
      } else if (body.settings && typeof body.settings === 'object') {
        // Batch update: multiple keys
        await Promise.all(
          Object.entries(body.settings).map(([k, v]) =>
            getUserSettingsRepository().set(userId, k, v)
          )
        );
      } else {
        res.status(400).json({ error: 'Body must have {key, value} or {settings: {...}}' });
        return;
      }

      const updated = await getUserSettingsRepository().getAll(userId);
      res.json({ ok: true, settings: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/connectors — список подключённых сервисов ──
  app.get('/api/connectors', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const connectors = (await getUserSettingsRepository().get(userId, 'connectors')) || {};
      res.json({ ok: true, connectors });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/connectors/:service — добавить/обновить коннектор ──
  // Body: { config: { webhookUrl?, apiKey?, ... } }
  app.post('/api/connectors/:service', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const service = req.params.service as string;
      const config = (req.body && req.body.config) || {};

      // deep-merge: сохраняем другие коннекторы нетронутыми
      await getUserSettingsRepository().setMerge(userId, 'connectors', {
        [service]: { ...config, connectedAt: new Date().toISOString() }
      });

      const connectors = (await getUserSettingsRepository().get(userId, 'connectors')) || {};
      res.json({ ok: true, service, connectors });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/connectors/:service — отключить коннектор ──
  app.delete('/api/connectors/:service', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const service = req.params.service as string;

      const connectors = (await getUserSettingsRepository().get(userId, 'connectors')) || {} as Record<string, any>;
      delete connectors[service];
      await getUserSettingsRepository().set(userId, 'connectors', connectors);

      res.json({ ok: true, service, connectors });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/stats ────────────────────────────────────────
  // Реальная глобальная статистика из БД
  app.get('/api/stats', async (_req: Request, res: Response) => {
    try {
      const pluginStats = getPluginManager().getStats();
      let activeAgents = 0;
      let totalUsers = 0;
      let agentsCreated = 0;

      try {
        const result = await pool.query<{
          active_agents: string;
          total_users: string;
          total_agents: string;
        }>(`
          SELECT
            COUNT(*) FILTER (WHERE is_active = true)  AS active_agents,
            COUNT(DISTINCT user_id)                    AS total_users,
            COUNT(*)                                   AS total_agents
          FROM builder_bot.agents
        `);
        const row = result.rows[0];
        if (row) {
          activeAgents  = parseInt(row.active_agents, 10) || 0;
          totalUsers    = parseInt(row.total_users, 10) || 0;
          agentsCreated = parseInt(row.total_agents, 10) || 0;
        }
      } catch { /* DB not ready — return zeros */ }

      res.json({
        ok: true,
        plugins:          pluginStats.total,
        pluginsInstalled: pluginStats.installed,
        activeAgents,
        totalUsers,
        agentsCreated,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/stats/me ─────────────────────────────────────
  // Персональная статистика с execution history
  app.get('/api/stats/me', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const r = await getDBTools().getUserAgents(userId);
      const agents = r.data || [];
      const active = agents.filter((a: any) => a.isActive).length;
      const pluginStats = getPluginManager().getStats();

      // Execution stats from history table
      let totalRuns = 0;
      let successRate = 0;
      let last24hRuns = 0;
      let uptimeSeconds = Math.floor(process.uptime());
      try {
        const stats = await getExecutionHistoryRepository().getStats(userId);
        totalRuns = stats.totalRuns;
        successRate = stats.totalRuns > 0
          ? Math.round((stats.successRuns / stats.totalRuns) * 100)
          : 100;
        last24hRuns = stats.last24hRuns;
      } catch { /* repo not ready */ }

      // Per-user installed plugin count
      let userPluginsInstalled = pluginStats.installed;
      try {
        const userPlugins = await getUserPluginsRepository().getInstalled(userId);
        userPluginsInstalled = userPlugins.length;
      } catch { /* repo not ready */ }

      res.json({
        ok: true,
        agentsTotal:       agents.length,
        agentsActive:      active,
        pluginsTotal:      pluginStats.total,
        pluginsInstalled:  userPluginsInstalled,
        totalRuns,
        successRate,
        last24hRuns,
        uptimeSeconds,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/marketplace — все активные листинги ──
  app.get('/api/marketplace', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const listings = await getMarketplaceRepository().getListings(category);
      res.json({ ok: true, listings });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/marketplace/my — мои листинги ──
  app.get('/api/marketplace/my', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
      const listings = await getMarketplaceRepository().getMyListings(userId);
      res.json({ ok: true, listings });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/marketplace/purchases — мои покупки ──
  app.get('/api/marketplace/purchases', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
      const purchases = await getMarketplaceRepository().getMyPurchases(userId);
      res.json({ ok: true, purchases });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/marketplace/:id — листинг по id ──
  app.get('/api/marketplace/:id', async (req: Request, res: Response) => {
    try {
      const listing = await getMarketplaceRepository().getListing(parseInt(req.params["id"] as string));
      if (!listing) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, listing });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── POST /api/marketplace — создать листинг ──
  app.post('/api/marketplace', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { agentId, name, description, category, price, isFree } = req.body;
    if (!agentId || !name) return res.status(400).json({ ok: false, error: 'agentId and name required' });
    try {
      // Проверяем что агент принадлежит пользователю
      const agentResult = await getDBTools().getAgent(agentId, userId);
      if (!agentResult.success || !agentResult.data) {
        return res.status(403).json({ ok: false, error: 'Agent not found or not yours' });
      }
      const listing = await getMarketplaceRepository().createListing({
        agentId, sellerId: userId, name, description: description || '',
        category: category || 'other',
        price: isFree ? 0 : Math.round((price || 0) * 1e9),
        isFree: !!isFree,
      });
      res.json({ ok: true, listing });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── DELETE /api/marketplace/:id — деактивировать листинг ──
  app.delete('/api/marketplace/:id', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
      await getMarketplaceRepository().deactivateListing(parseInt(req.params["id"] as string), userId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/marketplace/:id/canViewCode — может ли пользователь видеть код ──
  app.get('/api/marketplace/:id/canViewCode', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
      const canView = await getMarketplaceRepository().canViewCode(userId, parseInt(req.params["id"] as string));
      res.json({ ok: true, canView });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Owner-only middleware ──────────────────────────────────────────
  function requireOwner(req: Request, res: Response, next: NextFunction): void {
    const token = req.headers['x-auth-token'] as string || req.query.token as string;
    if (!token) { res.status(401).json({ error: 'No token' }); return; }
    const session = getSession(token);
    if (!session) { res.status(401).json({ error: 'Invalid or expired token' }); return; }
    if (session.userId !== platformConfig.owner.id) {
      res.status(403).json({ error: 'Owner only' }); return;
    }
    (req as any).userId = session.userId;
    (req as any).session = session;
    next();
  }

  // ── GET /api/proposals — список AI proposals ──────────────────────
  app.get('/api/proposals', requireOwner, async (req: Request, res: Response) => {
    try {
      const filter = (req.query.status as any) || 'pending';
      const limit  = parseInt(req.query.limit as string || '20', 10);
      const repo   = getAIProposalsRepository();
      const proposals = await repo.list(filter, limit);
      const statusMap = await repo.countByStatus();
      const counts = {
        pending:  statusMap['pending']  || 0,
        approved: statusMap['approved'] || 0,
        rejected: statusMap['rejected'] || 0,
      };
      res.json({ ok: true, proposals, counts });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/proposals/:id ────────────────────────────────────────
  app.get('/api/proposals/:id', requireOwner, async (req: Request, res: Response) => {
    try {
      const proposal = await getAIProposalsRepository().getById(req.params['id'] as string);
      if (!proposal) { res.status(404).json({ error: 'Not found' }); return; }
      res.json({ ok: true, proposal });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/proposals/:id/approve ──────────────────────────────
  app.post('/api/proposals/:id/approve', requireOwner, async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      // Lazy import to avoid circular deps
      const { getSelfImprovementSystem } = await import('./self-improvement');
      const sis = getSelfImprovementSystem();
      if (!sis) { res.status(503).json({ error: 'Self-improvement system not running' }); return; }
      await sis.approveProposal(id);
      res.json({ ok: true, id, action: 'approved' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/proposals/:id/reject ───────────────────────────────
  app.post('/api/proposals/:id/reject', requireOwner, async (req: Request, res: Response) => {
    try {
      const id     = req.params['id'] as string;
      const reason = (req.body && req.body.reason) || 'Rejected via API';
      const { getSelfImprovementSystem } = await import('./self-improvement');
      const sis = getSelfImprovementSystem();
      if (!sis) { res.status(503).json({ error: 'Self-improvement system not running' }); return; }
      await sis.rejectProposal(id, reason);
      res.json({ ok: true, id, action: 'rejected', reason });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/proposals/:id/rollback ─────────────────────────────
  app.post('/api/proposals/:id/rollback', requireOwner, async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const { getSelfImprovementSystem } = await import('./self-improvement');
      const sis = getSelfImprovementSystem();
      if (!sis) { res.status(503).json({ error: 'Self-improvement system not running' }); return; }
      await sis.rollbackProposal(id);
      res.json({ ok: true, id, action: 'rolled_back' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/platform/health — общее состояние платформы ─────────
  app.get('/api/platform/health', requireOwner, async (_req: Request, res: Response) => {
    try {
      const repo = getAIProposalsRepository();
      const [statusMap, recent] = await Promise.all([
        repo.countByStatus(),
        repo.getRecentApplied(5),
      ]);
      const pending  = statusMap['pending']  || 0;
      const approved = statusMap['approved'] || 0;
      const rejected = statusMap['rejected'] || 0;

      let dbOk = false;
      let agentStats = { total: 0, active: 0 };
      try {
        const r = await pool.query<{ total: string; active: string }>(
          `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active FROM builder_bot.agents`
        );
        dbOk = true;
        agentStats = { total: parseInt(r.rows[0]?.total || '0'), active: parseInt(r.rows[0]?.active || '0') };
      } catch { /* db not ready */ }

      res.json({
        ok: true,
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        db: dbOk,
        agents: agentStats,
        proposals: { pending, approved, rejected },
        recentApplied: recent,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/emergency-stop — экстренная остановка бота ─────────
  app.post('/api/emergency-stop', requireOwner, async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'Emergency stop initiated. Bot will restart via PM2.' });
    setTimeout(() => {
      console.error('🚨 EMERGENCY STOP requested via API');
      process.exit(1); // PM2 auto-restarts
    }, 500);
  });

  // ── GET /api/fragment/gift/:slug — floor price для Telegram Star Gift ──
  // Вызывается агентом telegram-gift-monitor через localhost (без JWT-авторизации)
  app.get('/api/fragment/gift/:slug', async (req: Request, res: Response) => {
    const { slug } = req.params;
    try {
      const { isAuthorized, getGiftFloorPrice } = await import('./fragment-service');
      const auth = await isAuthorized();
      if (!auth) {
        return res.json({ ok: false, error: 'not_authenticated', hint: 'Use /tglogin in the bot first' });
      }
      const data = await getGiftFloorPrice(String(slug));
      if (!data) {
        return res.json({ ok: false, error: 'not_found', slug });
      }
      res.json({
        ok: true,
        slug,
        floorStars: data.floorPriceStars,
        floorTon: data.floorPriceTon,
        listed: data.listedCount,
        avgStars: data.avgPriceStars,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/balance — баланс пользователя ───────────────────
  app.get('/api/balance', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const settingsRepo = getUserSettingsRepository();
      const profile = (await settingsRepo.get(userId, 'profile')) || { balance_ton: 0, total_earned: 0, wallet_address: null };
      res.json({
        ok: true,
        balance_ton: profile.balance_ton || 0,
        total_earned: profile.total_earned || 0,
        wallet_address: profile.wallet_address || null,
        wallet_name: profile.wallet_name || null,
        connected_via: profile.connected_via || null,
        wallet_connected_at: profile.wallet_connected_at || null,
        platform_wallet: PLATFORM_WALLET,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/transactions — история транзакций ──────────────
  app.get('/api/transactions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const limit = parseInt(req.query.limit as string || '20', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);
      const type = req.query.type as string || 'all';
      const result = await getBalanceTxRepository().getHistory(userId, limit, offset, type);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/topup/check — проверить пополнение ────────────
  app.post('/api/topup/check', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const afterTs = req.body?.afterTimestamp || Math.floor(Date.now() / 1000) - 900; // 15 min window
      const result = await verifyTopupTransaction(userId, afterTs);

      if (!result.found || !result.txHash) {
        res.json({ ok: false, error: 'Transaction not found' });
        return;
      }

      // Topup amount validation
      if (result.amountTon < 0.1) {
        res.json({ ok: false, error: 'Minimum topup is 0.1 TON' });
        return;
      }
      if (result.amountTon > 1000) {
        res.json({ ok: false, error: 'Maximum topup is 1000 TON per transaction' });
        return;
      }

      // DB dedup
      const existing = await getBalanceTxRepository().getByTxHash(result.txHash);
      if (existing) {
        res.json({ ok: false, error: 'Already credited' });
        return;
      }

      // Credit balance
      const settingsRepo = getUserSettingsRepository();
      const profile = (await settingsRepo.get(userId, 'profile')) || { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
      profile.balance_ton = (profile.balance_ton || 0) + result.amountTon;
      profile.total_earned = (profile.total_earned || 0) + result.amountTon;
      await settingsRepo.set(userId, 'profile', profile);

      // Record in ledger
      await getBalanceTxRepository().record(userId, 'topup', result.amountTon, profile.balance_ton, 'Dashboard topup', result.txHash);

      res.json({ ok: true, credited: result.amountTon, balance: profile.balance_ton, txHash: result.txHash });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/withdraw — вывод средств ──────────────────────
  app.post('/api/withdraw', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;

      // API-level rate limit: 5 requests/minute per user
      if (!checkApiRateLimit(`withdraw:${userId}`, 5, 60_000)) {
        res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
        return;
      }

      const { address, amount } = req.body || {};

      // Input validation
      if (!address || typeof address !== 'string') {
        res.status(400).json({ error: 'Address required' });
        return;
      }
      if (!address.startsWith('EQ') && !address.startsWith('UQ') && !address.startsWith('0:')) {
        res.status(400).json({ error: 'Invalid TON address format' });
        return;
      }
      const amountTon = parseFloat(amount);
      if (isNaN(amountTon) || amountTon <= 0) {
        res.status(400).json({ error: 'Invalid amount' });
        return;
      }

      // Rate limits
      const recentCount = await getBalanceTxRepository().getRecentWithdraws(userId, 24);
      if (recentCount >= 3) {
        res.status(429).json({ error: 'Withdrawal limit exceeded (3/day)' });
        return;
      }
      const lastTime = await getBalanceTxRepository().getLastWithdrawTime(userId);
      if (lastTime && (Date.now() - lastTime.getTime()) < 5 * 60 * 1000) {
        res.status(429).json({ error: 'Cooldown: wait 5 minutes between withdrawals' });
        return;
      }

      // Balance check
      const settingsRepo = getUserSettingsRepository();
      const profile = (await settingsRepo.get(userId, 'profile')) || { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
      const networkFee = 0.05;
      if (amountTon + networkFee > profile.balance_ton) {
        res.status(400).json({ error: 'Insufficient balance' });
        return;
      }
      // Max 80% of balance
      if (amountTon > profile.balance_ton * 0.8) {
        res.status(400).json({ error: `Max withdrawal is 80% of balance (${(profile.balance_ton * 0.8).toFixed(2)} TON)` });
        return;
      }

      // Save wallet address to profile (syncs with bot)
      if (!profile.wallet_address || profile.wallet_address !== address) {
        profile.wallet_address = address;
      }

      // Deduct balance
      profile.balance_ton = Math.max(0, profile.balance_ton - amountTon - networkFee);
      await settingsRepo.set(userId, 'profile', profile);
      await getBalanceTxRepository().record(userId, 'withdraw', -(amountTon + networkFee), profile.balance_ton, `Withdraw to ${address.slice(0,12)}...`);

      // Send TON
      try {
        const result = await sendPlatformTransaction(address, amountTon, `withdraw:${userId}`);
        if (result.ok) {
          try { await getBalanceTxRepository().record(userId, 'withdraw_confirmed', 0, profile.balance_ton, `txHash: ${result.txHash}`, result.txHash); } catch {}
          res.json({ ok: true, txHash: result.txHash, balance: profile.balance_ton });
        } else {
          // Rollback
          profile.balance_ton += amountTon + networkFee;
          await settingsRepo.set(userId, 'profile', profile);
          await getBalanceTxRepository().record(userId, 'refund', amountTon + networkFee, profile.balance_ton, 'Withdraw failed, refunded');
          res.status(500).json({ error: result.error || 'Transaction failed' });
        }
      } catch (sendErr: any) {
        // Rollback on exception
        profile.balance_ton += amountTon + networkFee;
        await settingsRepo.set(userId, 'profile', profile);
        await getBalanceTxRepository().record(userId, 'refund', amountTon + networkFee, profile.balance_ton, 'Withdraw exception, refunded');
        res.status(500).json({ error: sendErr.message || 'Send failed' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/wallet/link — привязать кошелёк ────────────────
  app.post('/api/wallet/link', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const { address } = req.body || {};
      if (!address || typeof address !== 'string') {
        res.status(400).json({ error: 'Address required' });
        return;
      }
      if (!address.startsWith('EQ') && !address.startsWith('UQ') && !address.startsWith('0:')) {
        res.status(400).json({ error: 'Invalid TON address format' });
        return;
      }
      const { wallet_name, connected_via } = req.body || {};
      const settingsRepo = getUserSettingsRepository();
      const profile = (await settingsRepo.get(userId, 'profile')) || { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
      profile.wallet_address = address.trim();
      if (wallet_name) profile.wallet_name = wallet_name;
      if (connected_via) profile.connected_via = connected_via;
      profile.wallet_connected_at = new Date().toISOString();
      await settingsRepo.set(userId, 'profile', profile);
      res.json({ ok: true, wallet_address: profile.wallet_address, wallet_name: profile.wallet_name || null, connected_via: profile.connected_via || null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/wallet/disconnect — отвязать кошелёк ──────────
  app.post('/api/wallet/disconnect', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const settingsRepo = getUserSettingsRepository();
      const profile = (await settingsRepo.get(userId, 'profile')) || { balance_ton: 0, total_earned: 0, wallet_address: null };
      delete profile.wallet_address;
      delete profile.wallet_name;
      delete profile.connected_via;
      delete profile.wallet_connected_at;
      await settingsRepo.set(userId, 'profile', profile);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Simple API rate limiter ──────────────────────────────────
  const apiRateLimits = new Map<string, number[]>();
  function checkApiRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = (apiRateLimits.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) return false;
    timestamps.push(now);
    apiRateLimits.set(key, timestamps);
    return true;
  }
  // Clean up every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of apiRateLimits) {
      const fresh = v.filter(t => now - t < 600_000);
      if (fresh.length === 0) apiRateLimits.delete(k);
      else apiRateLimits.set(k, fresh);
    }
  }, 600_000);

  // ── Public stats (no auth) ────────────────────────────────
  app.get('/api/stats', async (_req: Request, res: Response) => {
    try {
      const [agents, active, users] = await Promise.all([
        pool.query('SELECT COUNT(*) as c FROM builder_bot.agents'),
        pool.query("SELECT COUNT(*) as c FROM builder_bot.agents WHERE status = 'active'"),
        pool.query('SELECT COUNT(DISTINCT user_id) as c FROM builder_bot.agents'),
      ]);
      res.json({
        ok: true,
        agentsCreated: parseInt(agents.rows[0].c) || 0,
        activeAgents: parseInt(active.rows[0].c) || 0,
        totalUsers: parseInt(users.rows[0].c) || 0,
      });
    } catch {
      res.json({ ok: false });
    }
  });

  // Fallback — index.html
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(landingPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🌐 API Server running on http://localhost:${PORT}`);
  });
}
