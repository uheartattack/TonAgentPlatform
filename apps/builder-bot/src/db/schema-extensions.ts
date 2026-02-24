/**
 * schema-extensions.ts — новые таблицы для production-ready MVP
 *
 * Добавляет 5 таблиц в схему builder_bot:
 *   agent_state       — персистентное key/value состояние агентов (getState/setState)
 *   agent_logs        — логи выполнения агентов (хранятся в БД, не теряются при рестарте)
 *   execution_history — история запусков каждого агента (P&L, статистика)
 *   user_plugins      — какие плагины установил каждый пользователь
 *   user_settings     — настройки пользователя (AI persona, capabilities, connectors)
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgSchema, serial, integer, bigint, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { Pool } from 'pg';

const builderSchema = pgSchema('builder_bot');

// ─── Таблица 1: agent_state ────────────────────────────────────────────────
export const agentStateTable = builderSchema.table('agent_state', {
  id:        serial('id').primaryKey(),
  agentId:   integer('agent_id').notNull(),
  userId:    bigint('user_id', { mode: 'number' }).notNull(),
  key:       text('key').notNull(),
  value:     jsonb('value').notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Таблица 2: agent_logs ────────────────────────────────────────────────
export const agentLogsTable = builderSchema.table('agent_logs', {
  id:        serial('id').primaryKey(),
  agentId:   integer('agent_id').notNull(),
  userId:    bigint('user_id', { mode: 'number' }).notNull(),
  level:     text('level').notNull().default('info'),  // info | warn | error | success
  message:   text('message').notNull(),
  details:   jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Таблица 3: execution_history ─────────────────────────────────────────
export const executionHistoryTable = builderSchema.table('execution_history', {
  id:            serial('id').primaryKey(),
  agentId:       integer('agent_id').notNull(),
  userId:        bigint('user_id', { mode: 'number' }).notNull(),
  triggerType:   text('trigger_type').notNull().default('manual'),
  status:        text('status').notNull().default('running'),  // running | success | error
  startedAt:     timestamp('started_at').defaultNow().notNull(),
  finishedAt:    timestamp('finished_at'),
  durationMs:    integer('duration_ms'),
  errorMessage:  text('error_message'),
  resultSummary: jsonb('result_summary'),
});

// ─── Таблица 4: user_plugins ──────────────────────────────────────────────
export const userPluginsTable = builderSchema.table('user_plugins', {
  id:          serial('id').primaryKey(),
  userId:      bigint('user_id', { mode: 'number' }).notNull(),
  pluginId:    text('plugin_id').notNull(),
  config:      jsonb('config').notNull().default({}),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
});

// ─── Таблица 5: user_settings ─────────────────────────────────────────────
export const userSettingsTable = builderSchema.table('user_settings', {
  id:        serial('id').primaryKey(),
  userId:    bigint('user_id', { mode: 'number' }).notNull(),
  key:       text('key').notNull(),
  value:     jsonb('value').notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// DDL: CREATE TABLE IF NOT EXISTS + индексы (idempotent, запускается при старте)
// ─────────────────────────────────────────────────────────────────────────────
export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Убедимся что схема существует
    await client.query('CREATE SCHEMA IF NOT EXISTS builder_bot');

    // agent_state
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_state (
        id         SERIAL PRIMARY KEY,
        agent_id   INTEGER NOT NULL,
        user_id    BIGINT NOT NULL,
        key        TEXT NOT NULL,
        value      JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT agent_state_unique UNIQUE (agent_id, key)
      )
    `);

    // agent_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_logs (
        id         SERIAL PRIMARY KEY,
        agent_id   INTEGER NOT NULL,
        user_id    BIGINT NOT NULL,
        level      TEXT NOT NULL DEFAULT 'info',
        message    TEXT NOT NULL,
        details    JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS agent_logs_agent_id_idx
        ON builder_bot.agent_logs (agent_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS agent_logs_user_id_idx
        ON builder_bot.agent_logs (user_id, created_at DESC)
    `);

    // execution_history
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.execution_history (
        id              SERIAL PRIMARY KEY,
        agent_id        INTEGER NOT NULL,
        user_id         BIGINT NOT NULL,
        trigger_type    TEXT NOT NULL DEFAULT 'manual',
        status          TEXT NOT NULL DEFAULT 'running',
        started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        finished_at     TIMESTAMP,
        duration_ms     INTEGER,
        error_message   TEXT,
        result_summary  JSONB
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS exec_history_agent_id_idx
        ON builder_bot.execution_history (agent_id, started_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS exec_history_user_id_idx
        ON builder_bot.execution_history (user_id, started_at DESC)
    `);

    // user_plugins
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.user_plugins (
        id           SERIAL PRIMARY KEY,
        user_id      BIGINT NOT NULL,
        plugin_id    TEXT NOT NULL,
        config       JSONB NOT NULL DEFAULT '{}',
        installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT user_plugins_unique UNIQUE (user_id, plugin_id)
      )
    `);

    // user_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.user_settings (
        id         SERIAL PRIMARY KEY,
        user_id    BIGINT NOT NULL,
        key        TEXT NOT NULL,
        value      JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT user_settings_unique UNIQUE (user_id, key)
      )
    `);

    await client.query('COMMIT');
    console.log('✅ DB migrations applied (schema-extensions)');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', e);
    throw e;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository: AgentStateRepository
// ─────────────────────────────────────────────────────────────────────────────
export class AgentStateRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async get(agentId: number, key: string): Promise<any | null> {
    const [row] = await this.db
      .select({ value: agentStateTable.value })
      .from(agentStateTable)
      .where(and(eq(agentStateTable.agentId, agentId), eq(agentStateTable.key, key)))
      .limit(1);
    return row ? row.value : null;
  }

  async set(agentId: number, userId: number, key: string, value: any): Promise<void> {
    await this.db
      .insert(agentStateTable)
      .values({ agentId, userId, key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [agentStateTable.agentId, agentStateTable.key],
        set: { value, updatedAt: new Date() },
      });
  }

  async getAll(agentId: number): Promise<Array<{ key: string; value: any }>> {
    return this.db
      .select({ key: agentStateTable.key, value: agentStateTable.value })
      .from(agentStateTable)
      .where(eq(agentStateTable.agentId, agentId));
  }

  async deleteAgent(agentId: number): Promise<void> {
    await this.db.delete(agentStateTable).where(eq(agentStateTable.agentId, agentId));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository: AgentLogsRepository
// ─────────────────────────────────────────────────────────────────────────────
export class AgentLogsRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async insert(entry: {
    agentId: number;
    userId: number;
    level: string;
    message: string;
    details?: any;
  }): Promise<void> {
    await this.db.insert(agentLogsTable).values({
      agentId: entry.agentId,
      userId:  entry.userId,
      level:   entry.level,
      message: entry.message.slice(0, 2000),   // truncate
      details: entry.details ?? null,
      createdAt: new Date(),
    });
  }

  async getByAgent(agentId: number, limit = 30, offset = 0): Promise<Array<{
    id: number; level: string; message: string; details: any; createdAt: Date;
  }>> {
    return this.db
      .select({
        id: agentLogsTable.id,
        level: agentLogsTable.level,
        message: agentLogsTable.message,
        details: agentLogsTable.details,
        createdAt: agentLogsTable.createdAt,
      })
      .from(agentLogsTable)
      .where(eq(agentLogsTable.agentId, agentId))
      .orderBy(desc(agentLogsTable.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getByUser(userId: number, limit = 50, offset = 0): Promise<Array<{
    id: number; agentId: number; level: string; message: string; details: any; createdAt: Date;
  }>> {
    return this.db
      .select({
        id: agentLogsTable.id,
        agentId: agentLogsTable.agentId,
        level: agentLogsTable.level,
        message: agentLogsTable.message,
        details: agentLogsTable.details,
        createdAt: agentLogsTable.createdAt,
      })
      .from(agentLogsTable)
      .where(eq(agentLogsTable.userId, userId))
      .orderBy(desc(agentLogsTable.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async pruneOld(daysToKeep = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(agentLogsTable)
      .where(sql`${agentLogsTable.createdAt} < ${cutoff}`);
    return result.rowCount ?? 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository: ExecutionHistoryRepository
// ─────────────────────────────────────────────────────────────────────────────
export class ExecutionHistoryRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async start(params: {
    agentId: number;
    userId: number;
    triggerType: string;
  }): Promise<number> {
    const [row] = await this.db
      .insert(executionHistoryTable)
      .values({
        agentId: params.agentId,
        userId:  params.userId,
        triggerType: params.triggerType,
        status: 'running',
        startedAt: new Date(),
      })
      .returning({ id: executionHistoryTable.id });
    return row.id;
  }

  async finish(
    id: number,
    status: 'success' | 'error',
    durationMs: number,
    errorMessage?: string,
    resultSummary?: any
  ): Promise<void> {
    await this.db
      .update(executionHistoryTable)
      .set({
        status,
        finishedAt: new Date(),
        durationMs,
        errorMessage: errorMessage || null,
        resultSummary: resultSummary || null,
      })
      .where(eq(executionHistoryTable.id, id));
  }

  async getByAgent(agentId: number, limit = 20, offset = 0) {
    return this.db
      .select()
      .from(executionHistoryTable)
      .where(eq(executionHistoryTable.agentId, agentId))
      .orderBy(desc(executionHistoryTable.startedAt))
      .limit(limit)
      .offset(offset);
  }

  async getByUser(userId: number, status?: string, limit = 20, offset = 0) {
    const conditions = [eq(executionHistoryTable.userId, userId)];
    if (status && status !== 'all') {
      conditions.push(eq(executionHistoryTable.status, status));
    }
    return this.db
      .select()
      .from(executionHistoryTable)
      .where(and(...conditions))
      .orderBy(desc(executionHistoryTable.startedAt))
      .limit(limit)
      .offset(offset);
  }

  async getStats(userId: number): Promise<{
    totalRuns: number;
    successRuns: number;
    errorRuns: number;
    last24hRuns: number;
  }> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totals] = await this.db
      .select({
        totalRuns: sql<number>`COUNT(*)`,
        successRuns: sql<number>`COUNT(*) FILTER (WHERE status = 'success')`,
        errorRuns:   sql<number>`COUNT(*) FILTER (WHERE status = 'error')`,
      })
      .from(executionHistoryTable)
      .where(eq(executionHistoryTable.userId, userId));

    const [recent] = await this.db
      .select({ last24hRuns: sql<number>`COUNT(*)` })
      .from(executionHistoryTable)
      .where(and(
        eq(executionHistoryTable.userId, userId),
        gte(executionHistoryTable.startedAt, yesterday)
      ));

    return {
      totalRuns:   Number(totals?.totalRuns || 0),
      successRuns: Number(totals?.successRuns || 0),
      errorRuns:   Number(totals?.errorRuns || 0),
      last24hRuns: Number(recent?.last24hRuns || 0),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository: UserPluginsRepository
// ─────────────────────────────────────────────────────────────────────────────
export class UserPluginsRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async install(userId: number, pluginId: string, config: Record<string, any> = {}): Promise<void> {
    await this.db
      .insert(userPluginsTable)
      .values({ userId, pluginId, config, installedAt: new Date() })
      .onConflictDoUpdate({
        target: [userPluginsTable.userId, userPluginsTable.pluginId],
        set: { config, installedAt: new Date() },
      });
  }

  async uninstall(userId: number, pluginId: string): Promise<void> {
    await this.db
      .delete(userPluginsTable)
      .where(and(eq(userPluginsTable.userId, userId), eq(userPluginsTable.pluginId, pluginId)));
  }

  async getInstalled(userId: number): Promise<Array<{ pluginId: string; config: any; installedAt: Date }>> {
    return this.db
      .select({
        pluginId:    userPluginsTable.pluginId,
        config:      userPluginsTable.config,
        installedAt: userPluginsTable.installedAt,
      })
      .from(userPluginsTable)
      .where(eq(userPluginsTable.userId, userId));
  }

  async isInstalled(userId: number, pluginId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userPluginsTable.id })
      .from(userPluginsTable)
      .where(and(eq(userPluginsTable.userId, userId), eq(userPluginsTable.pluginId, pluginId)))
      .limit(1);
    return !!row;
  }

  async updateConfig(userId: number, pluginId: string, config: Record<string, any>): Promise<void> {
    await this.db
      .update(userPluginsTable)
      .set({ config })
      .where(and(eq(userPluginsTable.userId, userId), eq(userPluginsTable.pluginId, pluginId)));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository: UserSettingsRepository
// ─────────────────────────────────────────────────────────────────────────────
export class UserSettingsRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async get(userId: number, key: string): Promise<any | null> {
    const [row] = await this.db
      .select({ value: userSettingsTable.value })
      .from(userSettingsTable)
      .where(and(eq(userSettingsTable.userId, userId), eq(userSettingsTable.key, key)))
      .limit(1);
    return row ? row.value : null;
  }

  async set(userId: number, key: string, value: any): Promise<void> {
    await this.db
      .insert(userSettingsTable)
      .values({ userId, key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [userSettingsTable.userId, userSettingsTable.key],
        set: { value, updatedAt: new Date() },
      });
  }

  async getAll(userId: number): Promise<Record<string, any>> {
    const rows = await this.db
      .select({ key: userSettingsTable.key, value: userSettingsTable.value })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId));
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  /**
   * Deep-merge: обновляет только переданные ключи, не затирает остальные
   * Например: setMerge(userId, 'capabilities', { defi: { enabled: true } })
   * не сотрёт существующие capabilities.nft или capabilities.telegram
   */
  async setMerge(userId: number, key: string, partial: Record<string, any>): Promise<void> {
    const existing = (await this.get(userId, key)) || {};
    const merged = deepMerge(existing, partial);
    await this.set(userId, key, merged);
  }
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof result[k] === 'object') {
      result[k] = deepMerge(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton factories (same pattern as AgentsRepository in db/agents.ts)
// ─────────────────────────────────────────────────────────────────────────────
let agentStateRepo: AgentStateRepository | null = null;
let agentLogsRepo: AgentLogsRepository | null = null;
let executionHistoryRepo: ExecutionHistoryRepository | null = null;
let userPluginsRepo: UserPluginsRepository | null = null;
let userSettingsRepo: UserSettingsRepository | null = null;

export function initAgentStateRepository(pool: Pool): AgentStateRepository {
  if (!agentStateRepo) agentStateRepo = new AgentStateRepository(pool);
  return agentStateRepo;
}
export function getAgentStateRepository(): AgentStateRepository {
  if (!agentStateRepo) throw new Error('AgentStateRepository not initialized');
  return agentStateRepo;
}

export function initAgentLogsRepository(pool: Pool): AgentLogsRepository {
  if (!agentLogsRepo) agentLogsRepo = new AgentLogsRepository(pool);
  return agentLogsRepo;
}
export function getAgentLogsRepository(): AgentLogsRepository {
  if (!agentLogsRepo) throw new Error('AgentLogsRepository not initialized');
  return agentLogsRepo;
}

export function initExecutionHistoryRepository(pool: Pool): ExecutionHistoryRepository {
  if (!executionHistoryRepo) executionHistoryRepo = new ExecutionHistoryRepository(pool);
  return executionHistoryRepo;
}
export function getExecutionHistoryRepository(): ExecutionHistoryRepository {
  if (!executionHistoryRepo) throw new Error('ExecutionHistoryRepository not initialized');
  return executionHistoryRepo;
}

export function initUserPluginsRepository(pool: Pool): UserPluginsRepository {
  if (!userPluginsRepo) userPluginsRepo = new UserPluginsRepository(pool);
  return userPluginsRepo;
}
export function getUserPluginsRepository(): UserPluginsRepository {
  if (!userPluginsRepo) throw new Error('UserPluginsRepository not initialized');
  return userPluginsRepo;
}

export function initUserSettingsRepository(pool: Pool): UserSettingsRepository {
  if (!userSettingsRepo) userSettingsRepo = new UserSettingsRepository(pool);
  return userSettingsRepo;
}
export function getUserSettingsRepository(): UserSettingsRepository {
  if (!userSettingsRepo) throw new Error('UserSettingsRepository not initialized');
  return userSettingsRepo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Таблица 6: marketplace_listings
// Таблица 7: marketplace_purchases
// ─────────────────────────────────────────────────────────────────────────────
export const marketplaceListingsTable = builderSchema.table('marketplace_listings', {
  id:          serial('id').primaryKey(),
  agentId:     integer('agent_id').notNull(),      // id агента из agents таблицы
  sellerId:    bigint('seller_id', { mode: 'number' }).notNull(),
  name:        text('name').notNull(),
  description: text('description').notNull().default(''),
  category:    text('category').notNull().default('other'),
  price:       integer('price').notNull().default(0),         // цена в нанотонах (0 = бесплатно)
  rentPrice:   integer('rent_price'),                          // цена аренды/мес (null = нет аренды)
  isActive:    boolean('is_active').notNull().default(true),
  isFree:      boolean('is_free').notNull().default(false),
  totalSales:  integer('total_sales').notNull().default(0),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const marketplacePurchasesTable = builderSchema.table('marketplace_purchases', {
  id:          serial('id').primaryKey(),
  listingId:   integer('listing_id').notNull(),
  buyerId:     bigint('buyer_id', { mode: 'number' }).notNull(),
  sellerId:    bigint('seller_id', { mode: 'number' }).notNull(),
  agentId:     integer('agent_id').notNull(),      // скопированный агент (у покупателя свой id)
  type:        text('type').notNull().default('buy'),  // buy | rent | free
  pricePaid:   integer('price_paid').notNull().default(0),
  txHash:      text('tx_hash'),                    // TON транзакция
  expiresAt:   timestamp('expires_at'),            // для аренды
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Repository: MarketplaceRepository
// ─────────────────────────────────────────────────────────────────────────────
export class MarketplaceRepository {
  private db: ReturnType<typeof drizzle>;
  private pool: Pool;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
    this.pool = pool;
  }

  // Получить все активные листинги
  async getListings(category?: string): Promise<any[]> {
    const rows = await this.db
      .select()
      .from(marketplaceListingsTable)
      .where(
        category && category !== 'all'
          ? and(eq(marketplaceListingsTable.isActive, true), eq(marketplaceListingsTable.category, category))
          : eq(marketplaceListingsTable.isActive, true)
      )
      .orderBy(desc(marketplaceListingsTable.totalSales));
    return rows;
  }

  // Получить листинги конкретного продавца
  async getMyListings(sellerId: number): Promise<any[]> {
    return this.db
      .select()
      .from(marketplaceListingsTable)
      .where(eq(marketplaceListingsTable.sellerId, sellerId))
      .orderBy(desc(marketplaceListingsTable.createdAt));
  }

  // Создать листинг
  async createListing(data: {
    agentId: number; sellerId: number; name: string; description: string;
    category: string; price: number; rentPrice?: number; isFree: boolean;
  }): Promise<any> {
    const [row] = await this.db
      .insert(marketplaceListingsTable)
      .values({ ...data, rentPrice: data.rentPrice ?? null })
      .returning();
    return row;
  }

  // Деактивировать листинг
  async deactivateListing(listingId: number, sellerId: number): Promise<void> {
    await this.db
      .update(marketplaceListingsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(marketplaceListingsTable.id, listingId), eq(marketplaceListingsTable.sellerId, sellerId)));
  }

  // Проверить: покупал ли пользователь этот листинг?
  async hasPurchased(listingId: number, buyerId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: marketplacePurchasesTable.id })
      .from(marketplacePurchasesTable)
      .where(and(eq(marketplacePurchasesTable.listingId, listingId), eq(marketplacePurchasesTable.buyerId, buyerId)))
      .limit(1);
    return !!row;
  }

  // Создать запись о покупке
  async createPurchase(data: {
    listingId: number; buyerId: number; sellerId: number; agentId: number;
    type: 'buy' | 'rent' | 'free'; pricePaid: number; txHash?: string; expiresAt?: Date;
  }): Promise<any> {
    const [row] = await this.db
      .insert(marketplacePurchasesTable)
      .values({ ...data, txHash: data.txHash ?? null, expiresAt: data.expiresAt ?? null })
      .returning();
    // Увеличиваем счётчик продаж
    await this.db
      .update(marketplaceListingsTable)
      .set({ totalSales: sql`total_sales + 1`, updatedAt: new Date() })
      .where(eq(marketplaceListingsTable.id, data.listingId));
    return row;
  }

  // Покупки конкретного пользователя
  async getMyPurchases(buyerId: number): Promise<any[]> {
    return this.db
      .select()
      .from(marketplacePurchasesTable)
      .where(eq(marketplacePurchasesTable.buyerId, buyerId))
      .orderBy(desc(marketplacePurchasesTable.createdAt));
  }

  // Получить листинг по id
  async getListing(listingId: number): Promise<any | null> {
    const [row] = await this.db
      .select()
      .from(marketplaceListingsTable)
      .where(eq(marketplaceListingsTable.id, listingId))
      .limit(1);
    return row ?? null;
  }

  // Может ли пользователь видеть код агента? (только продавец или не купившие)
  async canViewCode(userId: number, agentId: number): Promise<boolean> {
    // Проверяем: пользователь является продавцом листинга этого агента?
    const [listing] = await this.db
      .select({ sellerId: marketplaceListingsTable.sellerId })
      .from(marketplaceListingsTable)
      .where(eq(marketplaceListingsTable.agentId, agentId))
      .limit(1);
    if (!listing) return true;   // нет в маркетплейсе — код виден владельцу
    if (listing.sellerId === userId) return true; // продавец видит всегда
    return false; // покупатель/арендатор — не видит
  }
}

// Singleton
let marketplaceRepo: MarketplaceRepository | null = null;

export function initMarketplaceRepository(pool: Pool): MarketplaceRepository {
  if (!marketplaceRepo) marketplaceRepo = new MarketplaceRepository(pool);
  return marketplaceRepo;
}
export function getMarketplaceRepository(): MarketplaceRepository {
  if (!marketplaceRepo) throw new Error('MarketplaceRepository not initialized');
  return marketplaceRepo;
}

// DDL для маркетплейс таблиц — вызывается из runMigrations
export async function runMarketplaceMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.marketplace_listings (
        id           SERIAL PRIMARY KEY,
        agent_id     INTEGER NOT NULL,
        seller_id    BIGINT NOT NULL,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        category     TEXT NOT NULL DEFAULT 'other',
        price        INTEGER NOT NULL DEFAULT 0,
        rent_price   INTEGER,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        is_free      BOOLEAN NOT NULL DEFAULT FALSE,
        total_sales  INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS marketplace_listings_seller_idx
        ON builder_bot.marketplace_listings (seller_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS marketplace_listings_category_idx
        ON builder_bot.marketplace_listings (category, is_active)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.marketplace_purchases (
        id         SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL,
        buyer_id   BIGINT NOT NULL,
        seller_id  BIGINT NOT NULL,
        agent_id   INTEGER NOT NULL,
        type       TEXT NOT NULL DEFAULT 'buy',
        price_paid INTEGER NOT NULL DEFAULT 0,
        tx_hash    TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS marketplace_purchases_buyer_idx
        ON builder_bot.marketplace_purchases (buyer_id)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS marketplace_purchases_unique_idx
        ON builder_bot.marketplace_purchases (listing_id, buyer_id)
        WHERE type != 'rent'
    `);
    console.log('✅ Marketplace migrations applied');
  } catch (e) {
    console.error('❌ Marketplace migration failed:', e);
  } finally {
    client.release();
  }
}
