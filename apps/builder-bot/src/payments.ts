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
    generationsPerMonth: 0,       // нет включённых — платно
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
};

// ── Адрес кошелька платформы (куда идут платежи) ───────────
export const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
const OWNER_ID = parseInt(process.env.OWNER_ID || '0');

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

// Защита от double-spend: использованные tx хеши (TTL 24h)
const usedTxHashes = new TTLMap<string, true>(24 * 60 * 60 * 1000, 50000);

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
    `);
  } catch (err) {
    console.error('[Payments] CRITICAL: DB migration failed:', err);
    throw err;
  }
}

// ── Получить подписку пользователя ─────────────────────────
export async function getUserSubscription(userId: number): Promise<UserSubscription> {
  // Owner всегда Unlimited
  if (userId === OWNER_ID) {
    return {
      userId,
      planId: 'unlimited',
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
  usedTxHashes.set(txHash, true); // Mark immediately to prevent concurrent double-spend
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
  const isOwner = sub.userId === OWNER_ID;

  let status = `${plan.icon} *${plan.name}*`;
  if (isOwner) {
    status += ' _(владелец — бесплатно)_';
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
            if (txHash) usedTxHashes.set(txHash, true);
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
