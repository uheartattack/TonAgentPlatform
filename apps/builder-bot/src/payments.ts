// ============================================================
// TON Agent Platform — Система подписок и оплаты
// Оплата через TON Connect (пользователь подтверждает в Tonkeeper)
// ============================================================

import { Pool } from 'pg';

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
      '3 агента',
      '1 активный одновременно',
      'Ручной запуск',
      'Маркетплейс шаблонов',
      '10 TON за генерацию AI',
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
      '15 агентов',
      '3 активных одновременно',
      'Запуск по расписанию',
      '30 генераций AI/мес',
      'Все шаблоны маркетплейса',
      'Приоритетная очередь AI',
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
      '100 агентов',
      '20 активных одновременно',
      'Webhook триггеры',
      'Workflow цепочки',
      '150 генераций AI/мес',
      'API доступ',
      'Поддержка 24/7',
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
      'Безлимит агентов',
      'Безлимит активных',
      'Безлимит генераций AI',
      'Всё включено',
      'Webhook + Workflow + API',
      'SLA 99.9% + выделенная поддержка',
    ],
  },
};

// ── Адрес кошелька платформы (куда идут платежи) ───────────
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || 'UQB5Ltvn5_q9axVSBXd4GGUVZaAh-hNgPT5emHjNsyYUDgzf';
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

// ── In-memory хранилища (перенести в PostgreSQL позже) ──────
const subscriptions = new Map<number, UserSubscription>();
const pendingPayments = new Map<number, PendingPayment>();

// Трекинг генераций: userId → { month: 'YYYY-MM', count: number }
const generationTracker = new Map<number, { month: string; count: number }>();

// ── Инициализация БД таблицы ────────────────────────────────
let _pool: Pool | null = null;

export function initPayments(pool: Pool): void {
  _pool = pool;
  // Создаём таблицу если не существует
  pool.query(`
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
  `).catch(err => console.error('[Payments] DB init error:', err));
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
    }
    return cached;
  }

  // Загружаем из БД
  if (_pool) {
    try {
      const r = await _pool.query(
        'SELECT * FROM builder_bot.subscriptions WHERE user_id = $1',
        [userId]
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
            'UPDATE builder_bot.subscriptions SET plan_id=$1, updated_at=NOW() WHERE user_id=$2',
            ['free', userId]
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
    tracker.count += 1;
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

  // Сохраняем в БД
  if (_pool) {
    _pool.query(
      'INSERT INTO builder_bot.payments(user_id, plan_id, period, amount_ton, status) VALUES($1,$2,$3,$4,$5)',
      [userId, planId, period, amountTon, 'pending']
    ).catch(console.error);
  }

  return { address: PLATFORM_WALLET, amountTon, comment, expiresAt };
}

// ── Подтвердить платёж (вызывается при получении TON) ───────
export async function confirmPayment(
  userId: number,
  txHash: string
): Promise<{ success: boolean; plan?: Plan; expiresAt?: Date; error?: string }> {
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
  subscriptions.set(userId, sub);
  pendingPayments.delete(userId);

  // Сохраняем в БД
  if (_pool) {
    await _pool.query(`
      INSERT INTO builder_bot.subscriptions(user_id, plan_id, expires_at, is_active)
      VALUES($1,$2,$3,true)
      ON CONFLICT(user_id) DO UPDATE SET plan_id=$2, expires_at=$3, is_active=true, updated_at=NOW()
    `, [userId, pending.planId, expiresAt]).catch(console.error);

    await _pool.query(`
      UPDATE builder_bot.payments SET status='confirmed', tx_hash=$1, confirmed_at=NOW()
      WHERE user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1
    `, [txHash, userId]).catch(console.error);
  }

  return { success: true, plan, expiresAt };
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
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`TON API ${res.status}`);

    const data: any = await res.json();
    const expectedNano = Math.floor(expectedAmountTon * 1e9);
    const comment = `sub:`;

    for (const event of (data.events || [])) {
      for (const action of (event.actions || [])) {
        if (action.type === 'TonTransfer' && action.TonTransfer) {
          const tf = action.TonTransfer;
          const amount = parseInt(tf.amount || '0');
          const msg: string = tf.comment || '';

          if (amount >= expectedNano * 0.99 && msg.includes(comment) && msg.includes(String(userId))) {
            return { found: true, txHash: event.event_id || event.lt };
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
