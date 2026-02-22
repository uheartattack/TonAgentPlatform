import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { Pool } from 'pg';
import { agents, type Agent, type NewAgent } from '../../db/agents';
import { getMemoryManager } from '../../db/memory';

// Результаты операций
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== CRUD операции с агентами =====

export class DBTools {
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  // Создать нового агента
  async createAgent(params: {
    userId: number;
    name: string;
    description?: string;
    code: string;
    triggerType: 'manual' | 'scheduled' | 'webhook' | 'event';
    triggerConfig?: Record<string, any>;
    isActive?: boolean;
  }): Promise<ToolResult<Agent>> {
    try {
      // Проверка на дубликат имени
      const existing = await this.db
        .select()
        .from(agents)
        .where(and(
          eq(agents.userId, params.userId),
          eq(agents.name, params.name)
        ))
        .limit(1);

      if (existing.length > 0) {
        return {
          success: false,
          error: `Агент с именем "${params.name}" уже существует`,
        };
      }

      const [agent] = await this.db
        .insert(agents)
        .values({
          userId: params.userId,
          name: params.name,
          description: params.description || '',
          code: params.code,
          triggerType: params.triggerType,
          triggerConfig: params.triggerConfig || {},
          isActive: params.isActive ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Логируем в память
      await getMemoryManager().addMessage(
        params.userId,
        'system',
        `Создан агент "${params.name}" (ID: ${agent.id})`,
        { type: 'agent_created', agentId: agent.id }
      );

      return {
        success: true,
        data: agent,
        message: `Агент "${params.name}" успешно создан!`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка создания агента: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Получить агента по ID
  async getAgent(agentId: number, userId?: number): Promise<ToolResult<Agent>> {
    try {
      const conditions = [eq(agents.id, agentId)];
      if (userId) {
        conditions.push(eq(agents.userId, userId));
      }

      const [agent] = await this.db
        .select()
        .from(agents)
        .where(and(...conditions))
        .limit(1);

      if (!agent) {
        return {
          success: false,
          error: 'Агент не найден',
        };
      }

      return {
        success: true,
        data: agent,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка получения агента: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Получить всех агентов пользователя
  async getUserAgents(userId: number): Promise<ToolResult<Agent[]>> {
    try {
      const userAgents = await this.db
        .select()
        .from(agents)
        .where(eq(agents.userId, userId))
        .orderBy(desc(agents.updatedAt));

      return {
        success: true,
        data: userAgents,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка получения списка агентов: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Обновить агента
  async updateAgent(
    agentId: number,
    userId: number,
    updates: Partial<{
      name: string;
      description: string;
      code: string;
      triggerType: 'manual' | 'scheduled' | 'webhook' | 'event';
      triggerConfig: Record<string, any>;
      isActive: boolean;
    }>
  ): Promise<ToolResult<Agent>> {
    try {
      // Проверяем существование
      const existing = await this.getAgent(agentId, userId);
      if (!existing.success) {
        return existing;
      }

      // Если меняем имя - проверяем уникальность
      if (updates.name && updates.name !== existing.data!.name) {
        const duplicate = await this.db
          .select()
          .from(agents)
          .where(and(
            eq(agents.userId, userId),
            eq(agents.name, updates.name)
          ))
          .limit(1);

        if (duplicate.length > 0) {
          return {
            success: false,
            error: `Агент с именем "${updates.name}" уже существует`,
          };
        }
      }

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

      // Логируем в память
      await getMemoryManager().addMessage(
        userId,
        'system',
        `Обновлён агент "${updated.name}" (ID: ${updated.id})`,
        { type: 'agent_updated', agentId: updated.id, fields: Object.keys(updates) }
      );

      return {
        success: true,
        data: updated,
        message: `Агент "${updated.name}" успешно обновлён!`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка обновления агента: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Удалить агента
  async deleteAgent(agentId: number, userId: number): Promise<ToolResult<void>> {
    try {
      const existing = await this.getAgent(agentId, userId);
      if (!existing.success) {
        return existing as unknown as ToolResult<void>;
      }

      await this.db
        .delete(agents)
        .where(and(
          eq(agents.id, agentId),
          eq(agents.userId, userId)
        ));

      // Логируем в память
      await getMemoryManager().addMessage(
        userId,
        'system',
        `Удалён агент "${existing.data!.name}" (ID: ${agentId})`,
        { type: 'agent_deleted', agentId }
      );

      return {
        success: true,
        message: `Агент "${existing.data!.name}" удалён`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка удаления агента: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Активировать/деактивировать агента
  async toggleAgent(agentId: number, userId: number): Promise<ToolResult<Agent>> {
    try {
      const existing = await this.getAgent(agentId, userId);
      if (!existing.success) {
        return existing;
      }

      const [updated] = await this.db
        .update(agents)
        .set({
          isActive: !existing.data!.isActive,
          updatedAt: new Date(),
        })
        .where(and(
          eq(agents.id, agentId),
          eq(agents.userId, userId)
        ))
        .returning();

      const status = updated.isActive ? 'активирован' : 'деактивирован';

      return {
        success: true,
        data: updated,
        message: `Агент "${updated.name}" ${status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка изменения статуса: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Получить код агента
  async getAgentCode(agentId: number, userId: number): Promise<ToolResult<string>> {
    const result = await this.getAgent(agentId, userId);
    if (!result.success) {
      return result as unknown as ToolResult<string>;
    }
    return {
      success: true,
      data: result.data!.code,
    };
  }

  // Обновить только код агента
  async updateAgentCode(
    agentId: number,
    userId: number,
    code: string
  ): Promise<ToolResult<Agent>> {
    return this.updateAgent(agentId, userId, { code });
  }

  // Обновить триггер агента
  async updateAgentTrigger(
    agentId: number,
    userId: number,
    triggerType: 'manual' | 'scheduled' | 'webhook' | 'event',
    triggerConfig: Record<string, any>
  ): Promise<ToolResult<Agent>> {
    return this.updateAgent(agentId, userId, { triggerType, triggerConfig });
  }

  // Поиск агентов по названию/описанию
  async searchAgents(userId: number, query: string): Promise<ToolResult<Agent[]>> {
    try {
      const userAgents = await this.getUserAgents(userId);
      if (!userAgents.success) {
        return userAgents;
      }

      const lowerQuery = query.toLowerCase();
      const filtered = userAgents.data!.filter(
        (agent) =>
          agent.name.toLowerCase().includes(lowerQuery) ||
          agent.description.toLowerCase().includes(lowerQuery)
      );

      return {
        success: true,
        data: filtered,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка поиска: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Получить статистику агентов пользователя
  async getAgentStats(userId: number): Promise<ToolResult<{
    total: number;
    active: number;
    inactive: number;
    byTrigger: Record<string, number>;
  }>> {
    try {
      const userAgents = await this.getUserAgents(userId);
      if (!userAgents.success) {
        return userAgents as unknown as ToolResult<{ total: number; active: number; inactive: number; byTrigger: Record<string, number> }>;
      }

      const data = userAgents.data!;
      const byTrigger: Record<string, number> = {};

      data.forEach((agent) => {
        byTrigger[agent.triggerType] = (byTrigger[agent.triggerType] || 0) + 1;
      });

      return {
        success: true,
        data: {
          total: data.length,
          active: data.filter((a) => a.isActive).length,
          inactive: data.filter((a) => !a.isActive).length,
          byTrigger,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка получения статистики: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Singleton instance
let dbTools: DBTools | null = null;

export function initDBTools(pool: Pool): DBTools {
  if (!dbTools) {
    dbTools = new DBTools(pool);
  }
  return dbTools;
}

export function getDBTools(): DBTools {
  if (!dbTools) {
    throw new Error('DBTools not initialized. Call initDBTools first.');
  }
  return dbTools;
}