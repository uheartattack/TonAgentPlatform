import { drizzle } from 'drizzle-orm/node-postgres';
import { pgSchema, serial, bigint, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { eq, and, desc } from 'drizzle-orm';
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
    if (userId) {
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

  // Поиск по имени/описанию
  async search(userId: number, query: string): Promise<Agent[]> {
    const userAgents = await this.getByUserId(userId);
    const lowerQuery = query.toLowerCase();

    return userAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(lowerQuery) ||
        agent.description.toLowerCase().includes(lowerQuery)
    );
  }

  // Получить статистику
  async getStats(userId: number): Promise<{
    total: number;
    active: number;
    inactive: number;
    byTrigger: Record<string, number>;
  }> {
    const userAgents = await this.getByUserId(userId);

    const byTrigger: Record<string, number> = {};
    userAgents.forEach((agent) => {
      byTrigger[agent.triggerType] = (byTrigger[agent.triggerType] || 0) + 1;
    });

    return {
      total: userAgents.length,
      active: userAgents.filter((a) => a.isActive).length,
      inactive: userAgents.filter((a) => !a.isActive).length,
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

  // Проверить существование имени
  async isNameExists(userId: number, name: string, excludeId?: number): Promise<boolean> {
    const conditions = [
      eq(agents.userId, userId),
      eq(agents.name, name),
    ];

    if (excludeId) {
      conditions.push(eq(agents.id, excludeId));
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
  if (!agentsRepo) {
    throw new Error('AgentsRepository not initialized. Call initAgentsRepository first.');
  }
  return agentsRepo;
}
