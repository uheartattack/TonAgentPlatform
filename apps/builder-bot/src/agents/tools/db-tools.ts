import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { agents, type Agent, type NewAgent } from '../../db/agents';
import { getMemoryManager } from '../../db/memory';
import { pruneAgentMemory } from './execution-tools';

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
    triggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'ai_agent';
    triggerConfig?: Record<string, any>;
    isActive?: boolean;
  }): Promise<ToolResult<Agent>> {
    try {
      // Проверка на дубликат имени — если есть, добавляем суффикс
      let finalName = params.name;
      const existing = await this.db
        .select()
        .from(agents)
        .where(and(
          eq(agents.userId, params.userId),
          eq(agents.name, params.name)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Авто-суффикс вместо ошибки
        finalName = params.name + '_' + Date.now().toString(36).slice(-4);
      }

      const [agent] = await this.db
        .insert(agents)
        .values({
          userId: params.userId,
          name: finalName,
          description: params.description || '',
          code: params.code,
          triggerType: params.triggerType,
          triggerConfig: params.triggerConfig || {},
          isActive: params.isActive ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Smart role detection from description + code
      try {
        const desc = ((params.description || '') + ' ' + (params.code || '')).toLowerCase();
        let autoRole = 'worker';
        if (params.triggerType === 'ai_agent') {
          if (/модератор|moderator|бан|ban|мьют|mute|антиспам|anti.?spam|admin|правила|rules/i.test(desc)) autoRole = 'admin';
          else if (/трейд|trade|арбитраж|arbitrage|p&l|profit|buy.*sell|swap|defi/i.test(desc)) autoRole = 'trader';
          else if (/мониторинг|monitor|алерт|alert|watch|отслежив|track|цена|price/i.test(desc)) autoRole = 'monitor';
          else if (/контент|content|пост|post|канал|channel|smm|блог|blog|stories/i.test(desc)) autoRole = 'creative';
          else if (/координат|coordinate|делегир|delegat|команд|team|manage|orchestrat/i.test(desc)) autoRole = 'manager';
          else if (/стратег|strateg|директор|director|okr|kpi|бизнес|business/i.test(desc)) autoRole = 'director';
          else if (/анали|analy|эксперт|expert|исследов|research|аудит|audit/i.test(desc)) autoRole = 'specialist';
          else autoRole = 'worker';
        }
        const { pool } = await import('../../db');
        await pool.query('UPDATE builder_bot.agents SET role = $1 WHERE id = $2', [autoRole, agent.id]);
      } catch {}

      // Логируем в память
      await getMemoryManager().addMessage(
        params.userId,
        'system',
        `Создан агент "${finalName}" (ID: ${agent.id})`,
        { type: 'agent_created', agentId: agent.id }
      );

      return {
        success: true,
        data: agent,
        message: `Агент "${finalName}" успешно создан!`,
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
      if (userId != null) {
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
      triggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'ai_agent';
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

      // Name uniqueness: attempt the update and catch unique constraint violations
      // to avoid TOCTOU race between the check and the update.
      let updated: typeof existing.data;
      try {
        [updated] = await this.db
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
      } catch (e: any) {
        // Handle unique constraint violation on (user_id, name)
        if (e.code === '23505' || (e.message && e.message.includes('unique'))) {
          return {
            success: false,
            error: `Агент с именем "${updates.name}" уже существует`,
          };
        }
        throw e;
      }

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

      // Explicit cascade — FK constraints don't exist, so we must manually prune
      // child tables or orphan rows accumulate. Wrap in transaction for atomicity.
      const { pool } = await import('../../db');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Verify ownership inside the transaction
        const check = await client.query(
          'SELECT id FROM builder_bot.agents WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [agentId, userId]
        );
        if (check.rowCount === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Agent not found or not owned by user' };
        }
        // Child tables to clean up (best-effort; missing tables are ignored).
        // Keep this in sync with `SELECT table_name FROM information_schema.columns
        // WHERE table_schema='builder_bot' AND column_name='agent_id'`.
        const childTables = [
          'agent_state',
          'agent_logs',
          'execution_history',
          'agent_daily_spend',
          'agent_tasks',
          'agent_approvals',
          'agent_audit_log',
          'agent_evals',
          'ai_proposals',
          // Newer observability tables
          'agent_traces',
          'agent_evaluations',
          'agent_system_facts',
          // Memory / session / dossier tables
          'agent_sessions',
          'agent_daily_logs',
          'agent_contacts',
          'agent_domains',
          'agent_journal',
          'agent_reviews',
          'agent_skill_tree',
          'agent_token_usage',
          // Wallets & marketplace
          'agentic_wallets',
          'marketplace_listings',
          'marketplace_purchases',
          'shared_agents',
          'trust_scores',
          // Sharing / export
          'agent_shares',
          // Feedback referencing agent_id
          'feedback',
        ];
        // Wrap each child-table DELETE in a SAVEPOINT. Without it, if any
        // single DELETE fails (missing column, FK violation, type mismatch),
        // Postgres puts the WHOLE transaction into aborted state and every
        // subsequent command throws "current transaction is aborted, commands
        // ignored until end of transaction block" — which the user saw as
        // bug #33 (Feedback @gafi_fx, agent #292).
        for (const t of childTables) {
          await client.query('SAVEPOINT del_child');
          try {
            await client.query(`DELETE FROM builder_bot.${t} WHERE agent_id = $1`, [agentId]);
            await client.query('RELEASE SAVEPOINT del_child');
          } catch (e: any) {
            await client.query('ROLLBACK TO SAVEPOINT del_child').catch(() => {});
            // Table might not exist in all deployments — log and continue
            if (!/relation.*does not exist/i.test(e.message)) {
              console.warn(`[deleteAgent] cleanup ${t}: ${e.message}`);
            }
          }
        }
        // Finally, delete the agent itself
        await client.query('DELETE FROM builder_bot.agents WHERE id = $1 AND user_id = $2', [agentId, userId]);
        await client.query('COMMIT');
      } catch (e: any) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }

      // Clean up in-memory state for the deleted agent
      pruneAgentMemory(agentId);
      // Invalidate runtime caches if the runtime exports it
      try {
        const { invalidateAgentCaches } = await import('../ai-agent-runtime');
        invalidateAgentCaches(agentId);
      } catch {}

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
      const [updated] = await this.db
        .update(agents)
        .set({
          isActive: sql`NOT is_active`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(agents.id, agentId),
          eq(agents.userId, userId)
        ))
        .returning();

      if (!updated) {
        return {
          success: false,
          error: 'Агент не найден',
        };
      }

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
    triggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'ai_agent',
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