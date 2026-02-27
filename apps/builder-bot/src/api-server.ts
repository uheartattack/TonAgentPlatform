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
} from './db/schema-extensions';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const BOT_USERNAME = process.env.BOT_USERNAME || 'TonAgentPlatformBot';
const LANDING_URL = process.env.LANDING_URL || `http://localhost:${PORT}`;

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

  // ── GET /api/config — публичная конфигурация для лендинга ──
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      botUsername: BOT_USERNAME,
      botLink: `https://t.me/${BOT_USERNAME}`,
      landingUrl: LANDING_URL,
      manifestUrl: `${LANDING_URL}/tonconnect-manifest.json`,
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
  // DB-backed: возвращает персистентные логи из agent_logs таблицы
  app.get('/api/agents/:id/logs', requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id as string, 10);
      const limit = parseInt(req.query.limit as string || '30', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);

      let logs: any[] = [];
      try {
        const rows = await getAgentLogsRepository().getByAgent(agentId, limit, offset);
        // Map createdAt → timestamp for dashboard compatibility
        logs = rows.map(r => ({
          id: r.id,
          level: r.level,
          message: r.message,
          details: r.details,
          timestamp: r.createdAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        }));
      } catch {
        // Fallback to in-memory runner logs if DB not ready
        const r = await getRunnerAgent().getLogs(agentId, (req as any).userId, limit);
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
      const agentId = parseInt(req.params.id as string, 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);
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

  // Fallback — index.html
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(landingPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🌐 API Server running on http://localhost:${PORT}`);
  });
}
