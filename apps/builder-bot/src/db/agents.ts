import { drizzle } from 'drizzle-orm/node-postgres';
import { pgSchema, serial, bigint, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { eq, ne, and, desc, sql } from 'drizzle-orm';
import { Pool } from 'pg';

// Используем схему builder_bot (не конфликтует с platform)
const builderSchema = pgSchema('builder_bot');

// Таблица агентов
export const agents = builderSchema.table('agents', {
  id: serial('id').primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  code: text('code').notNull(),
  triggerType: text('trigger_type').notNull().default('manual'),
  triggerConfig: jsonb('trigger_config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

// Класс для работы с агентами (дополнительные методы)
export class AgentsRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  // Получить агента по ID
  async getById(agentId: number, userId?: number): Promise<Agent | null> {
    const conditions = [eq(agents.id, agentId)];
    if (userId != null) {
      conditions.push(eq(agents.userId, userId));
    }

    const [agent] = await this.db
      .select()
      .from(agents)
      .where(and(...conditions))
      .limit(1);

    return agent || null;
  }

  // Получить всех агентов пользователя
  async getByUserId(userId: number): Promise<Agent[]> {
    return this.db
      .select()
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(desc(agents.updatedAt));
  }

  // Создать агента
  async create(data: {
    userId: number;
    name: string;
    description?: string;
    code: string;
    triggerType?: string;
    triggerConfig?: Record<string, any>;
    isActive?: boolean;
  }): Promise<Agent> {
    const [agent] = await this.db
      .insert(agents)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description || '',
        code: data.code,
        triggerType: data.triggerType || 'manual',
        triggerConfig: data.triggerConfig || {},
        isActive: data.isActive ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return agent;
  }

  // Обновить агента
  async update(
    agentId: number,
    userId: number,
    updates: Partial<{
      name: string;
      description: string;
      code: string;
      triggerType: string;
      triggerConfig: Record<string, any>;
      isActive: boolean;
    }>
  ): Promise<Agent | null> {
    const [updated] = await this.db
      .update(agents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(agents.id, agentId),
        eq(agents.userId, userId)
      ))
      .returning();

    return updated || null;
  }

  // Обновить только код
  async updateCode(agentId: number, userId: number, code: string): Promise<Agent | null> {
    return this.update(agentId, userId, { code });
  }

  // Обновить триггер
  async updateTrigger(
    agentId: number,
    userId: number,
    triggerType: string,
    triggerConfig: Record<string, any>
  ): Promise<Agent | null> {
    return this.update(agentId, userId, { triggerType, triggerConfig });
  }

  // Удалить агента
  async delete(agentId: number, userId: number): Promise<boolean> {
    const result = await this.db
      .delete(agents)
      .where(and(
        eq(agents.id, agentId),
        eq(agents.userId, userId)
      ));

    return (result.rowCount ?? 0) > 0;
  }

  // Переключить активность
  async toggle(agentId: number, userId: number): Promise<Agent | null> {
    const agent = await this.getById(agentId, userId);
    if (!agent) return null;

    return this.update(agentId, userId, { isActive: !agent.isActive });
  }

  // Поиск по имени/описанию (SQL ILIKE — не тянет все записи в память)
  async search(userId: number, query: string): Promise<Agent[]> {
    const pattern = `%${query}%`;
    return this.db
      .select()
      .from(agents)
      .where(and(
        eq(agents.userId, userId),
        sql`(${agents.name} ILIKE ${pattern} OR ${agents.description} ILIKE ${pattern})`
      ))
      .orderBy(desc(agents.updatedAt));
  }

  // Получить статистику (SQL COUNT — не тянет все записи в память)
  async getStats(userId: number): Promise<{
    total: number;
    active: number;
    inactive: number;
    byTrigger: Record<string, number>;
  }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where is_active)::int`,
        inactive: sql<number>`count(*) filter (where not is_active)::int`,
      })
      .from(agents)
      .where(eq(agents.userId, userId));

    const triggerRows = await this.db
      .select({
        triggerType: agents.triggerType,
        cnt: sql<number>`count(*)::int`,
      })
      .from(agents)
      .where(eq(agents.userId, userId))
      .groupBy(agents.triggerType);

    const byTrigger: Record<string, number> = {};
    for (const r of triggerRows) {
      byTrigger[r.triggerType] = r.cnt;
    }

    return {
      total: row?.total ?? 0,
      active: row?.active ?? 0,
      inactive: row?.inactive ?? 0,
      byTrigger,
    };
  }

  // Получить всех активных агентов (для планировщика)
  async getAllActive(): Promise<Agent[]> {
    return this.db
      .select()
      .from(agents)
      .where(eq(agents.isActive, true));
  }

  // Глобальная статистика платформы (для /start и лендинга)
  async getGlobalStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalUsers: number;
  }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where is_active)::int`,
        users: sql<number>`count(distinct user_id)::int`,
      })
      .from(agents);
    return {
      totalAgents: row?.total ?? 0,
      activeAgents: row?.active ?? 0,
      totalUsers: row?.users ?? 0,
    };
  }

  // Проверить существование имени
  async isNameExists(userId: number, name: string, excludeId?: number): Promise<boolean> {
    const conditions = [
      eq(agents.userId, userId),
      eq(agents.name, name),
    ];

    if (excludeId) {
      conditions.push(ne(agents.id, excludeId));
    }

    const [existing] = await this.db
      .select()
      .from(agents)
      .where(and(...conditions))
      .limit(1);

    return !!existing;
  }
}

// Singleton instance
let agentsRepo: AgentsRepository | null = null;

export function initAgentsRepository(pool: Pool): AgentsRepository {
  if (!agentsRepo) {
    agentsRepo = new AgentsRepository(pool);
  }
  return agentsRepo;
}

export function getAgentsRepository(): AgentsRepository {
  if (!agentsRepo) throw new Error('AgentsRepository not initialized. Call initAgentsRepository first.');
  return agentsRepo;
}
