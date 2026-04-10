// ============================================================
// TON Agent Platform — Система подписок и оплаты
// Оплата через TON Connect (пользователь подтверждает в Tonkeeper)
// ============================================================

import { Pool } from 'pg';

// ── TTL-based Map to prevent unbounded memory growth ────────
class TTLMap<K, V> {
  private map = new Map<K, { value: V; expiresAt: number }>();
  constructor(private ttlMs: number, private maxSize: number = 10000) {}

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize) this.evict();
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this.map.delete(key); return undefined; }
    return entry.value;
  }

  has(key: K): boolean { return this.get(key) !== undefined; }
  delete(key: K): void { this.map.delete(key); }

  private evict(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (now > v.expiresAt) this.map.delete(k);
    }
    // If still over limit, remove oldest entries down to 80% of maxSize
    const target = Math.floor(this.maxSize * 0.8);
    const iter = this.map.keys();
    while (this.map.size > target) {
      const next = iter.next();
      if (next.done) break;
      this.map.delete(next.value);
    }
  }
}

// ── Планы подписок ─────────────────────────────────────────
export interface Plan {
  id: string;
  name: string;
  icon: string;
  priceMonthTon: number;         // цена за месяц в TON
  priceYearTon: number;          // цена за год в TON (~20% скидка)
  maxAgents: number;             // -1 = безлимит
  maxActiveAgents: number;       // сколько могут работать одновременно
  generationsPerMonth: number;   // бесплатных генераций/мес (-1 = безлимит)
  pricePerGeneration: number;    // TON за 1 генерацию если не хватает лимита
  features: string[];
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    icon: '🆓',
    priceMonthTon: 0,
    priceYearTon: 0,
    maxAgents: 3,
    maxActiveAgents: 1,
    generationsPerMonth: 1,       // 1 бесплатная генерация для новичков
    pricePerGeneration: 10,       // 10 TON за генерацию
    features: [
      '3 agents',
      '1 active simultaneously',
      'All trigger types',
      'Marketplace access',
      '10 TON per AI generation',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    icon: '⚡',
    priceMonthTon: 5,
    priceYearTon: 48,
    maxAgents: 15,
    maxActiveAgents: 3,
    generationsPerMonth: 30,
    pricePerGeneration: 3,
    features: [
      '15 agents',
      '3 active simultaneously',
      '30 AI generations/mo',
      '3 TON per extra generation',
      'All trigger types',
      'Priority AI queue',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    icon: '🚀',
    priceMonthTon: 15,
    priceYearTon: 144,
    maxAgents: 100,
    maxActiveAgents: 20,
    generationsPerMonth: 150,
    pricePerGeneration: 1,
    features: [
      '100 agents',
      '20 active simultaneously',
      '150 AI generations/mo',
      '1 TON per extra generation',
      'All trigger types + API',
      'Priority support',
    ],
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    icon: '💎',
    priceMonthTon: 30,
    priceYearTon: 288,
    maxAgents: -1,
    maxActiveAgents: -1,
    generationsPerMonth: -1,
    pricePerGeneration: 0,
    features: [
      'Unlimited agents',
      'Unlimited active',
      'Unlimited AI generations',
      'Free generations included',
      'All features included',
      'Dedicated support',
    ],
  },
  beta: {
    id: 'beta',
    name: 'Beta Tester',
    icon: '🧪',
    priceMonthTon: 0,
    priceYearTon: 0,
    maxAgents: 10,
    maxActiveAgents: 5,
    generationsPerMonth: 50,
    pricePerGeneration: 0,
    features: [
      '10 agents',
      '5 active simultaneously',
      '50 AI generations/month',
      'Free generations',
      'Early access to new features',
      'Priority support',
      'Bug report system',
    ],
  },
};

// ── Адрес кошелька платформы (куда идут платежи) ───────────
export const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

// ── Platform Admins (loaded from DB, cached in memory) ─────
let _platformAdminIds = new Set<number>();
let _platformAdminUsernames = new Set<string>();
let _adminsLoadedAt = 0;

export function isPlatformAdmin(userId: number): boolean {
  if (userId === OWNER_ID && OWNER_ID > 0) return true;
  return _platformAdminIds.has(userId);
}

export function isPlatformAdminByUsername(username: string): boolean {
  return _platformAdminUsernames.has(username.toLowerCase().replace(/^@/, ''));
}

// ── Beta Testers (loaded from DB, cached in memory) ──────────
let _betaTesterIds = new Set<number>();
let _betaLoadedAt = 0;

export function isBetaTester(userId: number): boolean {
  return _betaTesterIds.has(userId);
}

export async function loadBetaTesters(): Promise<void> {
  try {
    const { pool } = require('./db');
    const res = await pool.query(`SELECT user_id FROM builder_bot.beta_testers WHERE status = 'active'`);
    _betaTesterIds = new Set(res.rows.map((r: any) => Number(r.user_id)));
    _betaLoadedAt = Date.now();
    console.log(`[Beta] Loaded ${_betaTesterIds.size} beta testers`);
  } catch (e: any) {
    console.warn('[Beta] Load failed:', e.message);
  }
}

export async function addBetaTester(userId: number, username?: string, inviteCode?: string, invitedBy?: number, referredBy?: number): Promise<boolean> {
  try {
    const { pool } = require('./db');
    await pool.query(
      `INSERT INTO builder_bot.beta_testers (user_id, username, invite_code, invited_by, referred_by) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', invite_code = COALESCE(EXCLUDED.invite_code, builder_bot.beta_testers.invite_code), referred_by = COALESCE(EXCLUDED.referred_by, builder_bot.beta_testers.referred_by)`,
      [userId, username || null, inviteCode || null, invitedBy || null, referredBy || null]
    );
    _betaTesterIds.add(userId);
    return true;
  } catch (e: any) {
    console.warn('[Beta] Add tester failed:', e.message);
    return false;
  }
}

export async function removeBetaTester(userId: number): Promise<boolean> {
  try {
    const { pool } = require('./db');
    await pool.query(`UPDATE builder_bot.beta_testers SET status = 'revoked' WHERE user_id = $1`, [userId]);
    _betaTesterIds.delete(userId);
    return true;
  } catch { return false; }
}

export async function generateBetaCodes(count: number, createdBy: number, note?: string, maxUses = 1): Promise<string[]> {
  const { pool } = require('./db');
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = 'BETA' + Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
    await pool.query(
      `INSERT INTO builder_bot.beta_invite_codes (code, created_by, max_uses, note) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [code, createdBy, maxUses, note || null]
    );
    codes.push(code);
  }
  return codes;
}

export async function redeemBetaCode(code: string, userId: number, username?: string): Promise<{ ok: boolean; error?: string }> {
  const { pool } = require('./db');
  // Check code validity
  const res = await pool.query(`SELECT * FROM builder_bot.beta_invite_codes WHERE code = $1`, [code.toUpperCase()]);
  if (!res.rows.length) return { ok: false, error: 'Invalid code' };
  const inv = res.rows[0];
  if (!inv.is_active) return { ok: false, error: 'Code deactivated' };
  if (inv.used_count >= inv.max_uses) return { ok: false, error: 'Code fully used' };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { ok: false, error: 'Code expired' };
  // Already a tester?
  if (isBetaTester(userId)) return { ok: false, error: 'Already a beta tester' };
  // Activate
  await pool.query(`UPDATE builder_bot.beta_invite_codes SET used_count = used_count + 1 WHERE code = $1`, [code.toUpperCase()]);
  const added = await addBetaTester(userId, username, code.toUpperCase(), inv.created_by);
  return added ? { ok: true } : { ok: false, error: 'DB error' };
}

export async function loadPlatformAdmins(): Promise<void> {
  if (!_pool) return;
  try {
    const r = await _pool.query(`SELECT telegram_id, username, alt_ids FROM builder_bot.platform_admins`);
    const idSet = new Set<number>();
    const nameSet = new Set<string>();
    for (const row of r.rows) {
      idSet.add(Number(row.telegram_id));
      if (row.username) nameSet.add(row.username.toLowerCase());
      // Also add alternative IDs (for users with changing TG IDs)
      if (Array.isArray(row.alt_ids)) {
        for (const aid of row.alt_ids) idSet.add(Number(aid));
      }
    }
    _platformAdminIds = idSet;
    _platformAdminUsernames = nameSet;
    _adminsLoadedAt = Date.now();
    if (idSet.size > 0) console.log(`[Payments] Loaded ${r.rows.length} platform admins (${idSet.size} IDs)`);
  } catch (e: any) {
    console.error('[Payments] Failed to load platform admins:', e.message?.slice(0, 80));
  }
}

// Refresh admins every 10 minutes
function _ensureAdminsFresh(): void {
  if (Date.now() - _adminsLoadedAt > 10 * 60_000) {
    loadPlatformAdmins().catch(() => {});
  }
}

// ── Интерфейсы ─────────────────────────────────────────────
export interface UserSubscription {
  userId: number;
  planId: string;
  expiresAt: Date | null;   // null = бессрочно (owner/lifetime)
  isActive: boolean;
  createdAt: Date;
}

export interface PendingPayment {
  userId: number;
  planId: string;
  period: 'month' | 'year';
  amountTon: number;
  createdAt: Date;
  expiresAt: Date;  // истекает через 15 минут
}

// ── In-memory хранилища with TTL eviction ───────────────────
const subscriptions = new TTLMap<number, UserSubscription>(60 * 60 * 1000, 10000);           // 1 hour TTL
const pendingPayments = new TTLMap<number, PendingPayment>(30 * 60 * 1000, 5000);            // 30 min TTL
const generationTracker = new TTLMap<number, { month: string; count: number }>(31 * 24 * 60 * 60 * 1000, 10000); // 31 days TTL (monthly limit)

// Защита от double-spend: использованные tx хеши (TTL 32 дня — покрывает полный цикл billing)
// In-memory cache is rebuilt from DB on startup via loadUsedTxHashesFromDB()
const usedTxHashes = new TTLMap<string, true>(32 * 24 * 60 * 60 * 1000, 100000);

// ── Инициализация БД таблицы ────────────────────────────────
let _pool: Pool | null = null;

export async function initPayments(pool: Pool): Promise<void> {
  _pool = pool;
  // Создаём таблицу если не существует
  try {
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS builder_bot;
      CREATE TABLE IF NOT EXISTS builder_bot.subscriptions (
        user_id BIGINT PRIMARY KEY,
        plan_id TEXT NOT NULL DEFAULT 'free',
        expires_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS builder_bot.payments (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        plan_id TEXT NOT NULL,
        period TEXT NOT NULL,
        amount_ton DECIMAL(10,4) NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS builder_bot.used_tx_hashes (
        tx_hash TEXT PRIMARY KEY,
        used_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    // Load recent tx hashes (last 32 days) into in-memory cache to survive restarts
    await loadUsedTxHashesFromDB();
    // Load platform admins
    await loadPlatformAdmins();
    // Load beta testers
    await loadBetaTesters();
  } catch (err) {
    console.error('[Payments] CRITICAL: DB migration failed:', err);
    throw err;
  }
}

async function loadUsedTxHashesFromDB(): Promise<void> {
  if (!_pool) return;
  try {
    const r = await _pool.query(
      `SELECT tx_hash FROM builder_bot.used_tx_hashes WHERE used_at > NOW() - INTERVAL '32 days'`
    );
    for (const row of r.rows) usedTxHashes.set(row.tx_hash, true);
    if (r.rows.length > 0) console.log(`[Payments] Loaded ${r.rows.length} used tx hashes from DB`);
  } catch (e) {
    console.error('[Payments] Failed to load used tx hashes from DB:', (e as any).message);
  }
}

async function persistTxHash(txHash: string): Promise<void> {
  if (!_pool) return;
  _pool.query(
    `INSERT INTO builder_bot.used_tx_hashes(tx_hash) VALUES($1) ON CONFLICT DO NOTHING`,
    [txHash]
  ).catch((e: any) => console.error('[Payments] Failed to persist tx hash:', e.message));
}

// ── Получить подписку пользователя ─────────────────────────
export async function getUserSubscription(userId: number): Promise<UserSubscription> {
  // Platform admins always get Unlimited
  _ensureAdminsFresh();
  if (isPlatformAdmin(userId)) {
    return {
      userId,
      planId: 'unlimited',
      expiresAt: null,
      isActive: true,
      createdAt: new Date(0),
    };
  }
  // Beta testers get beta plan (or upgraded plan from rewards)
  if (isBetaTester(userId)) {
    let betaPlan = 'beta';
    try {
      const { pool } = require('./db');
      const bRes = await pool.query(`SELECT plan_override FROM builder_bot.beta_testers WHERE user_id = $1 AND status = 'active'`, [userId]);
      if (bRes.rows[0]?.plan_override) betaPlan = bRes.rows[0].plan_override;
    } catch {}
    return {
      userId,
      planId: betaPlan,
      expiresAt: null,
      isActive: true,
      createdAt: new Date(0),
    };
  }

  // Проверяем in-memory кэш
  const cached = subscriptions.get(userId);
  if (cached) {
    // Проверяем не истекла ли
    if (cached.expiresAt && cached.expiresAt < new Date()) {
      cached.planId = 'free';
      cached.isActive = true;
      // Persist downgrade to DB
      if (_pool) {
        _pool.query(
          'UPDATE builder_bot.subscriptions SET plan_id=$1, updated_at=NOW() WHERE user_id=$2::NUMERIC',
          ['free', String(userId)]
        ).catch(e => console.error('[Payments] expire downgrade DB error:', (e as any).message));
      }
    }
    return cached;
  }

  // Загружаем из БД
  if (_pool) {
    try {
      const r = await _pool.query(
        'SELECT * FROM builder_bot.subscriptions WHERE user_id = $1::NUMERIC',
        [String(userId)]
      );
      if (r.rows[0]) {
        const row = r.rows[0];
        const sub: UserSubscription = {
          userId,
          planId: row.plan_id,
          expiresAt: row.expires_at ? new Date(row.expires_at) : null,
          isActive: row.is_active,
          createdAt: new Date(row.created_at),
        };
        // Проверяем истечение
        if (sub.expiresAt && sub.expiresAt < new Date()) {
          sub.planId = 'free';
          await _pool.query(
            'UPDATE builder_bot.subscriptions SET plan_id=$1, updated_at=NOW() WHERE user_id=$2::NUMERIC',
            ['free', String(userId)]
          );
        }
        subscriptions.set(userId, sub);
        return sub;
      }
    } catch (err) {
      console.error('[Payments] getUserSubscription DB error:', err);
    }
  }

  // По умолчанию — Free
  const defaultSub: UserSubscription = {
    userId,
    planId: 'free',
    expiresAt: null,
    isActive: true,
    createdAt: new Date(),
  };
  subscriptions.set(userId, defaultSub);
  return defaultSub;
}

// ── Получить текущий план пользователя ─────────────────────
export async function getUserPlan(userId: number): Promise<Plan> {
  const sub = await getUserSubscription(userId);
  return PLANS[sub.planId] || PLANS.free;
}

// ── Проверить может ли пользователь создать агента (лимит кол-ва) ──
export async function canCreateAgent(userId: number, currentAgentCount: number): Promise<{
  allowed: boolean;
  reason?: string;
  plan: Plan;
}> {
  const plan = await getUserPlan(userId);
  if (plan.maxAgents === -1 || currentAgentCount < plan.maxAgents) {
    return { allowed: true, plan };
  }
  return {
    allowed: false,
    reason: `Лимит плана ${plan.icon} ${plan.name}: максимум ${plan.maxAgents} агентов`,
    plan,
  };
}

// ── Получить текущий счётчик генераций пользователя за этот месяц ──
function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getGenerationsUsed(userId: number): number {
  const month = getCurrentMonth();
  const tracker = generationTracker.get(userId);
  if (!tracker || tracker.month !== month) return 0;
  return tracker.count;
}

// ── Проверить может ли пользователь генерировать (бесплатно в рамках плана) ──
export async function canGenerateForFree(userId: number): Promise<{
  allowed: boolean;
  usedThisMonth: number;
  limitPerMonth: number;
  pricePerGeneration: number;
  plan: Plan;
}> {
  const plan = await getUserPlan(userId);
  const used = getGenerationsUsed(userId);

  // Безлимит
  if (plan.generationsPerMonth === -1) {
    return { allowed: true, usedThisMonth: used, limitPerMonth: -1, pricePerGeneration: 0, plan };
  }

  // Есть ещё бесплатные генерации
  if (used < plan.generationsPerMonth) {
    return { allowed: true, usedThisMonth: used, limitPerMonth: plan.generationsPerMonth, pricePerGeneration: 0, plan };
  }

  // Лимит исчерпан — платно
  return {
    allowed: false,
    usedThisMonth: used,
    limitPerMonth: plan.generationsPerMonth,
    pricePerGeneration: plan.pricePerGeneration,
    plan,
  };
}

// ── Засчитать генерацию ──────────────────────────────────────
export function trackGeneration(userId: number): void {
  const month = getCurrentMonth();
  const tracker = generationTracker.get(userId);
  if (!tracker || tracker.month !== month) {
    generationTracker.set(userId, { month, count: 1 });
  } else {
    generationTracker.set(userId, { month, count: tracker.count + 1 });
  }
}

// ── Beta Rewards System ─────────────────────────────────────
// Points (tight economy): bug=2, feature=2, critical=15, support=1, general=1
// Resolved bonus: bug=+5, feature=+10(implemented), critical=+15, support=+2
// Daily limits: 5 bugs, 3 features, 3 critical, 2 support, 2 general

const FEEDBACK_POINTS: Record<string, number> = { bug: 2, feature: 2, support: 1, general: 1, critical: 5 };
const RESOLVE_BONUS: Record<string, number> = { bug: 3, feature: 5, support: 1, general: 1, critical: 10 };

export async function awardFeedbackPoints(userId: number, feedbackType: string, resolved = false): Promise<{ points: number; total: number; reward?: string }> {
  let pts = resolved ? (RESOLVE_BONUS[feedbackType] || 1) : (FEEDBACK_POINTS[feedbackType] || 1);
  try {
    const { pool } = require('./db');
    // Daily limit: max 5 bug reports, 3 features, 2 support per day (resolved bonuses bypass)
    if (!resolved) {
      const dailyLimits: Record<string, number> = { bug: 5, feature: 3, support: 2, general: 2, critical: 3 };
      const limit = dailyLimits[feedbackType] || 3;
      const todayCount = await pool.query(
        `SELECT COUNT(*) as cnt FROM builder_bot.feedback WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId, feedbackType]
      );
      if (parseInt(todayCount.rows[0]?.cnt || '0') >= limit) {
        return { points: 0, total: 0, reward: 'daily_limit' };
      }
    }
    // Apply role multiplier
    try {
      const roleRow = await pool.query(`SELECT tester_role FROM builder_bot.beta_testers WHERE user_id = $1`, [userId]);
      const role = roleRow.rows[0]?.tester_role || 'tester';
      const roleInfo = TESTER_ROLES[role];
      if (roleInfo && roleInfo.multiplier !== 1.0) {
        pts = Math.round(pts * roleInfo.multiplier);
      }
    } catch {}
    // Update beta_testers feedback_count (used as points accumulator)
    await pool.query(
      `UPDATE builder_bot.beta_testers SET feedback_count = feedback_count + $1 WHERE user_id = $2`,
      [pts, userId]
    );
    // Track stats by type
    if (feedbackType === 'bug') await pool.query(`UPDATE builder_bot.beta_testers SET total_bugs = total_bugs + 1 WHERE user_id = $1`, [userId]);
    else if (feedbackType === 'feature') await pool.query(`UPDATE builder_bot.beta_testers SET total_features = total_features + 1 WHERE user_id = $1`, [userId]);
    else if (feedbackType === 'support') await pool.query(`UPDATE builder_bot.beta_testers SET total_support = total_support + 1 WHERE user_id = $1`, [userId]);

    const res = await pool.query(`SELECT feedback_count, level FROM builder_bot.beta_testers WHERE user_id = $1`, [userId]);
    const total = res.rows[0]?.feedback_count || 0;
    const currentLevel = res.rows[0]?.level;

    // Check reward thresholds
    let reward: string | undefined;
    if (total >= 200) {
      // Upgrade to Unlimited
      await pool.query(
        `UPDATE builder_bot.beta_testers SET plan_override = 'unlimited' WHERE user_id = $1 AND plan_override != 'unlimited'`,
        [userId]
      );
      reward = 'unlimited';
    } else if (total >= 100) {
      // Upgrade to Pro
      await pool.query(
        `UPDATE builder_bot.beta_testers SET plan_override = 'pro' WHERE user_id = $1 AND plan_override NOT IN ('pro', 'unlimited')`,
        [userId]
      );
      reward = 'pro';
    } else if (total >= 50 && total - pts < 50) {
      // Bonus: +20 generations (reduce used count)
      const tracker = generationTracker.get(userId);
      if (tracker) {
        tracker.count = Math.max(0, tracker.count - 20);
        generationTracker.set(userId, tracker);
      }
      reward = 'bonus_gens';
    }

    // Auto level-up
    const newLevel = getTesterLevel(total);
    if (newLevel.level > (currentLevel || 1)) {
      await pool.query(`UPDATE builder_bot.beta_testers SET level = $1, plan_override = $2 WHERE user_id = $3`, [newLevel.level, newLevel.plan, userId]);
      reward = 'level_up:' + newLevel.name;
    }

    return { points: pts, total, reward };
  } catch (e: any) {
    console.warn('[BetaRewards] award error:', e.message);
    return { points: pts, total: 0 };
  }
}

export async function getBetaLeaderboard(limit = 20): Promise<Array<{ user_id: number; username: string; feedback_count: number; plan_override: string }>> {
  try {
    const { pool } = require('./db');
    const res = await pool.query(
      `SELECT user_id, username, feedback_count, plan_override FROM builder_bot.beta_testers
       WHERE status = 'active' AND feedback_count > 0 ORDER BY feedback_count DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch { return []; }
}

// ── Tester Economy: Levels, Shop, Checkin, Achievements ─────────

export const TESTER_LEVELS = [
  { level: 1, name: 'Newbie',  nameRu: 'Новичок',  minPts: 0,   maxAgents: 5,  gens: 30,  plan: 'beta' },
  { level: 2, name: 'Tester',  nameRu: 'Тестер',   minPts: 20,  maxAgents: 7,  gens: 40,  plan: 'beta' },
  { level: 3, name: 'Active',  nameRu: 'Активный',  minPts: 60,  maxAgents: 10, gens: 50,  plan: 'beta' },
  { level: 4, name: 'Expert',  nameRu: 'Эксперт',   minPts: 150, maxAgents: 15, gens: 100, plan: 'pro' },
  { level: 5, name: 'Master',  nameRu: 'Мастер',    minPts: 300, maxAgents: 20, gens: 150, plan: 'pro' },
  { level: 6, name: 'Legend',  nameRu: 'Легенда',   minPts: 500, maxAgents: -1, gens: -1,  plan: 'unlimited' },
];

export const SHOP_ITEMS = [
  { id: 'gens_10',        cost: 50,  name: '+10 Generations',    nameRu: '+10 Генераций',    type: 'gens', value: 10 },
  { id: 'early_access',   cost: 100, name: 'Early Access',       nameRu: 'Ранний доступ',    type: 'status' },
  { id: 'vote_x2',        cost: 150, name: 'Vote Power x2',      nameRu: 'Голос x2',         type: 'status' },
  { id: 'custom_agent',   cost: 200, name: 'Custom Agent Setup',  nameRu: 'Настройка агента', type: 'service' },
  { id: 'dev_call',       cost: 250, name: '1:1 with Developer',  nameRu: '1:1 с разработчиком', type: 'service' },
  { id: 'credits_page',   cost: 300, name: 'Name in Credits',     nameRu: 'Имя в Credits',    type: 'status' },
  { id: 'private_channel', cost: 400, name: 'Private Channel',    nameRu: 'Закрытый канал',   type: 'access' },
  { id: 'sticker_pack',   cost: 30,  name: 'Sticker Pack',        nameRu: 'Стикерпак',        type: 'cosmetic' },
];

export const ACHIEVEMENTS = [
  { id: 'first_bug',     name: 'First Blood',      nameRu: 'Первая кровь',     desc: 'Report your first bug', condition: (s: any) => s.total_bugs >= 1 },
  { id: 'bugs_10',       name: 'Bug Hunter',        nameRu: 'Охотник за багами', desc: '10 bugs reported',       condition: (s: any) => s.total_bugs >= 10 },
  { id: 'bugs_50',       name: 'Exterminator',      nameRu: 'Истребитель',       desc: '50 bugs reported',       condition: (s: any) => s.total_bugs >= 50 },
  { id: 'features_5',    name: 'Visionary',         nameRu: 'Визионер',          desc: '5 features proposed',    condition: (s: any) => s.total_features >= 5 },
  { id: 'features_impl', name: 'Architect',         nameRu: 'Архитектор',        desc: 'Your feature was implemented', condition: () => false }, // manual
  { id: 'streak_7',      name: 'Consistent',        nameRu: 'Стабильный',        desc: '7-day streak',           condition: (s: any) => s.streak_days >= 7 },
  { id: 'streak_30',     name: 'Devoted',           nameRu: 'Преданный',         desc: '30-day streak',          condition: (s: any) => s.streak_days >= 30 },
  { id: 'level_expert',  name: 'Expert Badge',      nameRu: 'Эксперт',           desc: 'Reach Expert level',     condition: (s: any) => s.level >= 4 },
  { id: 'level_legend',  name: 'Legendary',         nameRu: 'Легендарный',        desc: 'Reach Legend level',     condition: (s: any) => s.level >= 6 },
  { id: 'mentor',        name: 'Mentor',            nameRu: 'Ментор',             desc: 'Help 3 newbies reach Lv.2', condition: () => false }, // manual
  { id: 'referral_3',    name: 'Recruiter',         nameRu: 'Рекрутер',           desc: 'Refer 3 active testers', condition: (s: any) => s.referral_count >= 3 },
];

export const TESTER_ROLES: Record<string, { name: string; nameRu: string; multiplier: number; canVerifyBugs: boolean; canCloseFeedback: boolean }> = {
  tester: { name: 'Tester', nameRu: 'Тестер', multiplier: 1.0, canVerifyBugs: false, canCloseFeedback: false },
  qa_lead: { name: 'QA Lead', nameRu: 'QA Лид', multiplier: 1.5, canVerifyBugs: true, canCloseFeedback: true },
  feature_scout: { name: 'Feature Scout', nameRu: 'Скаут фич', multiplier: 1.0, canVerifyBugs: false, canCloseFeedback: false },
  community_helper: { name: 'Community Helper', nameRu: 'Хелпер', multiplier: 1.5, canVerifyBugs: false, canCloseFeedback: false },
  stress_tester: { name: 'Stress Tester', nameRu: 'Стресс-тестер', multiplier: 2.0, canVerifyBugs: false, canCloseFeedback: false },
  mobile_tester: { name: 'Mobile Tester', nameRu: 'Мобильный тестер', multiplier: 1.5, canVerifyBugs: false, canCloseFeedback: false },
  mentor: { name: 'Mentor', nameRu: 'Ментор', multiplier: 1.0, canVerifyBugs: false, canCloseFeedback: false },
};

export function getTesterLevel(points: number): typeof TESTER_LEVELS[0] {
  for (let i = TESTER_LEVELS.length - 1; i >= 0; i--) {
    if (points >= TESTER_LEVELS[i].minPts) return TESTER_LEVELS[i];
  }
  return TESTER_LEVELS[0];
}

export function getNextLevel(points: number): typeof TESTER_LEVELS[0] | null {
  const current = getTesterLevel(points);
  const next = TESTER_LEVELS.find(l => l.level === current.level + 1);
  return next || null;
}

export async function dailyCheckin(userId: number): Promise<{ ok: boolean; points?: number; streak?: number; error?: string }> {
  try {
    const { pool } = require('./db');
    const res = await pool.query(`SELECT last_checkin, streak_days, feedback_count FROM builder_bot.beta_testers WHERE user_id = $1 AND status = 'active'`, [userId]);
    if (!res.rows.length) return { ok: false, error: 'Not a beta tester' };
    const row = res.rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const lastCheckin = row.last_checkin ? new Date(row.last_checkin).toISOString().slice(0, 10) : null;
    if (lastCheckin === today) return { ok: false, error: 'Already checked in today' };
    // Calculate streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = lastCheckin === yesterday ? (row.streak_days || 0) + 1 : 1;
    await pool.query(
      `UPDATE builder_bot.beta_testers SET feedback_count = feedback_count + 1, daily_checkins = daily_checkins + 1, last_checkin = $1, streak_days = $2 WHERE user_id = $3`,
      [today, newStreak, userId]
    );
    return { ok: true, points: 1, streak: newStreak };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

export async function shopBuy(userId: number, itemId: string): Promise<{ ok: boolean; error?: string }> {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return { ok: false, error: 'Item not found' };
  try {
    const { pool } = require('./db');
    const res = await pool.query(`SELECT feedback_count, spent_points FROM builder_bot.beta_testers WHERE user_id = $1 AND status = 'active'`, [userId]);
    if (!res.rows.length) return { ok: false, error: 'Not a beta tester' };
    const available = (res.rows[0].feedback_count || 0) - (res.rows[0].spent_points || 0);
    if (available < item.cost) return { ok: false, error: `Need ${item.cost} pts, have ${available}` };
    // Atomic: only update if still enough points (prevents race condition)
    const upd = await pool.query(
      `UPDATE builder_bot.beta_testers SET spent_points = spent_points + $1
       WHERE user_id = $2 AND (feedback_count - spent_points) >= $1 RETURNING spent_points`,
      [item.cost, userId]
    );
    if (!upd.rows.length) return { ok: false, error: 'Insufficient points (concurrent purchase)' };
    // Apply effect
    if (item.type === 'gens' && item.value) {
      const tracker = generationTracker.get(userId);
      if (tracker) { tracker.count = Math.max(0, tracker.count - item.value); generationTracker.set(userId, tracker); }
    }
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

export async function trackReferral(referrerId: number, referredUserId: number): Promise<void> {
  try {
    const { pool } = require('./db');
    // Check if referred user has enough points
    const res = await pool.query(`SELECT feedback_count FROM builder_bot.beta_testers WHERE user_id = $1`, [referredUserId]);
    if (!res.rows.length || res.rows[0].feedback_count < 20) return; // Not yet qualified
    // Check if already credited
    const already = await pool.query(`SELECT 1 FROM builder_bot.beta_testers WHERE user_id = $1 AND referred_by = $2`, [referredUserId, referrerId]);
    // Actually referred_by is on the referred user, not referrer. Check referrer's referral_count
    await pool.query(`UPDATE builder_bot.beta_testers SET feedback_count = feedback_count + 3, referral_count = referral_count + 1 WHERE user_id = $1`, [referrerId]);
  } catch {}
}

export async function setTesterRole(userId: number, role: string): Promise<boolean> {
  if (!TESTER_ROLES[role]) return false;
  try {
    const { pool } = require('./db');
    await pool.query(`UPDATE builder_bot.beta_testers SET tester_role = $1 WHERE user_id = $2`, [role, userId]);
    return true;
  } catch { return false; }
}

export async function assignMentor(menteeId: number, mentorId: number): Promise<boolean> {
  try {
    const { pool } = require('./db');
    await pool.query(`UPDATE builder_bot.beta_testers SET referred_by = $1 WHERE user_id = $2`, [mentorId, menteeId]);
    return true;
  } catch { return false; }
}

export async function getWeeklyTop(limit = 10): Promise<any[]> {
  try {
    const { pool } = require('./db');
    // Get top testers by points earned this week
    // We approximate by looking at feedback created this week
    const res = await pool.query(`
      SELECT bt.user_id, bt.username, bt.feedback_count, bt.level, bt.tester_role,
             COUNT(f.id) as week_activity
      FROM builder_bot.beta_testers bt
      LEFT JOIN builder_bot.feedback f ON f.user_id = bt.user_id AND f.created_at > NOW() - INTERVAL '7 days'
      WHERE bt.status = 'active'
      GROUP BY bt.user_id, bt.username, bt.feedback_count, bt.level, bt.tester_role
      ORDER BY week_activity DESC, bt.feedback_count DESC
      LIMIT $1
    `, [limit]);
    return res.rows;
  } catch { return []; }
}

export async function spamPenalty(userId: number): Promise<void> {
  try {
    const { pool } = require('./db');
    await pool.query(`UPDATE builder_bot.beta_testers SET feedback_count = GREATEST(0, feedback_count - 1) WHERE user_id = $1`, [userId]);
  } catch {}
}

export async function getTesterStats(userId: number): Promise<any> {
  try {
    const { pool } = require('./db');
    const res = await pool.query(
      `SELECT feedback_count, spent_points, level, total_bugs, total_features, total_support, daily_checkins, streak_days, last_checkin, referral_count, tester_role, achievements, created_at
       FROM builder_bot.beta_testers WHERE user_id = $1`,
      [userId]
    );
    if (!res.rows.length) return null;
    const s = res.rows[0];
    const pts = s.feedback_count || 0;
    const spent = s.spent_points || 0;
    const lvl = getTesterLevel(pts);
    const next = getNextLevel(pts);
    return {
      points: pts, available: pts - spent, spent,
      level: lvl.level, levelName: lvl.name, levelNameRu: lvl.nameRu,
      nextLevel: next ? { name: next.name, nameRu: next.nameRu, pointsNeeded: next.minPts - pts } : null,
      totalBugs: s.total_bugs || 0, totalFeatures: s.total_features || 0, totalSupport: s.total_support || 0,
      checkins: s.daily_checkins || 0, streak: s.streak_days || 0, lastCheckin: s.last_checkin,
      referrals: s.referral_count || 0, role: s.tester_role || 'tester',
      achievements: s.achievements || [],
      joinedAt: s.created_at,
    };
  } catch { return null; }
}

// ── Создать платёж — возвращает адрес + сумму для перевода ──
export function createPayment(
  userId: number,
  planId: string,
  period: 'month' | 'year'
): {
  address: string;
  amountTon: number;
  comment: string;
  expiresAt: Date;
} | { error: string } {
  const plan = PLANS[planId];
  if (!plan) return { error: 'Неизвестный план' };
  if (plan.priceMonthTon === 0) return { error: 'Этот план бесплатный' };

  const amountTon = period === 'year' ? plan.priceYearTon : plan.priceMonthTon;
  const comment = `sub:${planId}:${period}:${userId}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут на оплату

  const pending: PendingPayment = {
    userId,
    planId,
    period,
    amountTon,
    createdAt: new Date(),
    expiresAt,
  };
  pendingPayments.set(userId, pending);

  // Сохраняем в БД (non-blocking — function is sync)
  if (_pool) {
    _pool.query(
      'INSERT INTO builder_bot.payments(user_id, plan_id, period, amount_ton, status) VALUES($1,$2,$3,$4,$5)',
      [userId, planId, period, amountTon, 'pending']
    ).catch((e: any) => console.error('[Payments] DB insert failed:', e.message));
  }

  return { address: PLATFORM_WALLET, amountTon, comment, expiresAt };
}

// ── Подтвердить платёж (вызывается при получении TON) ───────
export async function confirmPayment(
  userId: number,
  txHash: string
): Promise<{ success: boolean; plan?: Plan; expiresAt?: Date; error?: string }> {
  if (usedTxHashes.has(txHash)) return { success: false, error: 'Transaction already used' };
  // Mark in-memory immediately (Node.js is single-threaded, so this is safe for same-process concurrency)
  usedTxHashes.set(txHash, true);
  const pending = pendingPayments.get(userId);
  if (!pending) return { success: false, error: 'Нет ожидающего платежа' };
  if (pending.expiresAt < new Date()) {
    pendingPayments.delete(userId);
    return { success: false, error: 'Время платежа истекло, создайте новый' };
  }

  const plan = PLANS[pending.planId];
  const now = new Date();
  const expiresAt = new Date(now);
  if (pending.period === 'year') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const sub: UserSubscription = {
    userId,
    planId: pending.planId,
    expiresAt,
    isActive: true,
    createdAt: now,
  };

  // Persist to DB first, then update in-memory cache
  if (_pool) {
    const client = await _pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO builder_bot.subscriptions(user_id, plan_id, expires_at, is_active)
        VALUES($1,$2,$3,true)
        ON CONFLICT(user_id) DO UPDATE SET plan_id=$2, expires_at=$3, is_active=true, updated_at=NOW()
      `, [userId, pending.planId, expiresAt]);
      // Persist tx hash atomically within the same transaction to prevent double-spend on crash/restart
      await client.query(
        `INSERT INTO builder_bot.used_tx_hashes(tx_hash) VALUES($1) ON CONFLICT DO NOTHING`,
        [txHash]
      );
      await client.query(`
        UPDATE builder_bot.payments SET status='confirmed', tx_hash=$1, confirmed_at=NOW()
        WHERE id = (SELECT id FROM builder_bot.payments WHERE user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1)
      `, [txHash, userId]);
      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK').catch((rbErr: any) => { console.error('[Payments] ROLLBACK failed:', rbErr?.message); });
      console.error('[Payments] confirmPayment DB transaction error:', e.message);
      // DB failed but still update in-memory so user isn't stuck
    } finally {
      client.release();
    }
  }

  // Update in-memory cache after DB commit
  subscriptions.set(userId, sub);
  pendingPayments.delete(userId);

  return { success: true, plan, expiresAt };
}

// ── Обновить in-memory кэш подписки (для API server) ──────
export function updateSubscriptionCache(userId: number, planId: string, expiresAt: Date | null): void {
  subscriptions.set(userId, {
    userId,
    planId,
    expiresAt,
    isActive: true,
    createdAt: new Date(),
  });
}

// ── Отформатировать статус подписки ────────────────────────
export function formatSubscription(sub: UserSubscription): string {
  const plan = PLANS[sub.planId] || PLANS.free;
  const isAdmin = isPlatformAdmin(sub.userId);

  let status = `${plan.icon} *${plan.name}*`;
  if (isAdmin) {
    status += ' _(админ — бесплатно)_';
  } else if (sub.expiresAt) {
    const daysLeft = Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86400000);
    status += daysLeft > 0
      ? ` — ${daysLeft} дн. осталось`
      : ' — _истекла_';
  } else if (plan.id === 'free') {
    status += ' _(бесплатно)_';
  }

  return status;
}

// ── Проверить ожидающий платёж (для кнопки "Проверить оплату") ──
export function getPendingPayment(userId: number): PendingPayment | null {
  const p = pendingPayments.get(userId);
  if (!p || p.expiresAt < new Date()) {
    if (p) pendingPayments.delete(userId);
    return null;
  }
  return p;
}

// ── Верифицировать транзакцию через TON API ─────────────────
// Проверяем что деньги реально пришли на наш кошелёк
export async function verifyTonTransaction(
  userId: number,
  expectedAmountTon: number
): Promise<{ found: boolean; txHash?: string }> {
  try {
    const limit = 5;
    const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(PLATFORM_WALLET)}/events?limit=${limit}`;
    const tonapiKey = process.env.TONAPI_KEY || '';
    const reqHeaders: Record<string, string> = { 'Accept': 'application/json' };
    if (tonapiKey) reqHeaders['Authorization'] = `Bearer ${tonapiKey}`;
    const res = await fetch(url, { headers: reqHeaders });
    if (!res.ok) throw new Error(`TON API ${res.status}`);

    const data: any = await res.json();
    const expectedNano = Math.floor(expectedAmountTon * 1e9);
    // Full pattern match: sub:{planId}:{period}:{userId}
    const commentPattern = new RegExp(`^sub:[a-z]+:(month|year):${userId}$`);

    for (const event of (data.events || [])) {
      for (const action of (event.actions || [])) {
        if (action.type === 'TonTransfer' && action.TonTransfer) {
          const tf = action.TonTransfer;
          const amount = parseInt(tf.amount || '0');
          const msg: string = (tf.comment || '').trim();
          const txHash = event.event_id || event.lt;

          // Check exact amount (no discount), full comment pattern, and not already used
          if (amount >= expectedNano && commentPattern.test(msg) && txHash && !usedTxHashes.has(txHash)) {
            usedTxHashes.set(txHash, true);
            void persistTxHash(txHash);
            return { found: true, txHash };
          }
        }
      }
    }

    return { found: false };
  } catch (err) {
    console.error('[Payments] verifyTonTransaction error:', err);
    return { found: false };
  }
}

// ── Проверить пополнение баланса профиля ─────────────────────
// Ищем входящий перевод с комментарием topup:{userId}
// Возвращает сумму если найдена, иначе 0
export async function verifyTopupTransaction(
  userId: number,
  afterTimestamp?: number  // unix seconds — игнорируем транзакции старше
): Promise<{ found: boolean; amountTon: number; txHash?: string }> {
  try {
    const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(PLATFORM_WALLET)}/events?limit=20`;
    const tonapiKey = process.env.TONAPI_KEY || '';
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (tonapiKey) headers['Authorization'] = `Bearer ${tonapiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`TON API ${res.status}`);

    const data: any = await res.json();
    const expectedComment = `topup:${userId}`;

    for (const event of (data.events || [])) {
      const eventTime: number = event.timestamp || 0;
      // Пропускаем события старше точки отсчёта
      if (afterTimestamp && eventTime < afterTimestamp) continue;

      for (const action of (event.actions || [])) {
        if (action.type === 'TonTransfer' && action.TonTransfer) {
          const tf = action.TonTransfer;
          const amount = parseInt(tf.amount || '0');
          const msg: string = (tf.comment || '').trim();

          const txHash = event.event_id || String(event.lt);
          if (txHash && usedTxHashes.has(txHash)) continue;

          if (msg === expectedComment && amount >= 100_000_000) {  // минимум 0.1 TON
            if (txHash) { usedTxHashes.set(txHash, true); void persistTxHash(txHash); }
            return {
              found: true,
              amountTon: amount / 1e9,
              txHash,
            };
          }
        }
      }
    }

    return { found: false, amountTon: 0 };
  } catch (err) {
    console.error('[Payments] verifyTopupTransaction error:', err);
    return { found: false, amountTon: 0 };
  }
}
