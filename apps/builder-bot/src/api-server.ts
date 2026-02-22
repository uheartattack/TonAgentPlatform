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

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const BOT_TOKEN = process.env.BOT_TOKEN || '';

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

// ── App setup ─────────────────────────────────────────────────
export function startApiServer() {
  const app = express();
  app.use(express.json());

  // CORS для лендинга (открытый — лендинг статичный)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
    next();
  });

  // Статика лендинга
  const landingPath = path.resolve(__dirname, '../../../apps/landing');
  app.use(express.static(landingPath));

  // ── GET /api/auth/request — получить deeplink + токен для auth через бота ──
  app.get('/api/auth/request', (_req: Request, res: Response) => {
    const authToken = generateToken().slice(0, 16); // короткий — идёт в deeplink
    pendingBotAuth.set(authToken, { pending: true, createdAt: Date.now() });
    // Удаляем через 5 минут
    setTimeout(() => pendingBotAuth.delete(authToken), 5 * 60 * 1000);
    const botLink = `https://t.me/TonAgentPlatformBot?start=webauth_${authToken}`;
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
      res.json({ ok: true, agents: r.data || [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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

  // ── GET /api/agents/:id/logs ──────────────────────────────
  app.get('/api/agents/:id/logs', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const agentId = parseInt(req.params.id as string, 10);
      const limit = parseInt(req.query.limit as string || '30', 10);
      const r = await getRunnerAgent().getLogs(agentId, userId, limit);
      res.json({ ok: r.success, logs: r.data?.logs || [], error: r.error });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/plugins ──────────────────────────────────────
  app.get('/api/plugins', (_req: Request, res: Response) => {
    try {
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
        isInstalled: p.isInstalled,
      }));
      res.json({ ok: true, plugins });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/stats ────────────────────────────────────────
  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      const pluginStats = getPluginManager().getStats();
      // Глобальная статистика (без userId — для главной страницы)
      res.json({
        ok: true,
        plugins: pluginStats.total,
        pluginsInstalled: pluginStats.installed,
        // Заглушки для публичной статистики
        activeAgents: 42,
        totalUsers: 128,
        agentsCreated: 315,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/stats/me ─────────────────────────────────────
  app.get('/api/stats/me', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const r = await getDBTools().getUserAgents(userId);
      const agents = r.data || [];
      const active = agents.filter((a: any) => a.isActive).length;
      const pluginStats = getPluginManager().getStats();
      res.json({
        ok: true,
        agentsTotal: agents.length,
        agentsActive: active,
        pluginsTotal: pluginStats.total,
        pluginsInstalled: pluginStats.installed,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
