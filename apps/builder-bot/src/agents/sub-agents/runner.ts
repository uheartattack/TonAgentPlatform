import { getExecutionTools, type ExecutionResult } from '../tools/execution-tools';
import { getDBTools, type ToolResult } from '../tools/db-tools';
import { getSecurityScanner } from '../tools/security-scanner';
import { getMemoryManager } from '../../db/memory';
import { notifyAgentResult, notifyUser } from '../../notifier';
import { getUserSettingsRepository } from '../../db/schema-extensions';
import { getAIAgentRuntime, addMessageToAIAgent } from '../ai-agent-runtime';

// Загрузить пользовательские переменные из user_settings (безопасно, без ошибок)
async function loadUserVariables(userId: number): Promise<Record<string, any>> {
  try {
    const repo = getUserSettingsRepository();
    const all = await repo.getAll(userId);
    return (all.user_variables as Record<string, any>) || {};
  } catch {
    return {};
  }
}

// Параметры для запуска
export interface RunAgentParams {
  agentId: number;
  userId: number;
  context?: {
    wallet?: string;
    config?: Record<string, any>;
    [key: string]: any;
  };
}

// Параметры для тестового запуска
export interface TestRunParams {
  code: string;
  userId: number;
  context?: {
    wallet?: string;
    config?: Record<string, any>;
    [key: string]: any;
  };
}

// Результат управления
export interface ControlResult {
  success: boolean;
  agentId: number;
  action: 'run' | 'pause' | 'activate' | 'test' | 'schedule';
  status?: string;
  executionResult?: ExecutionResult;
  message: string;
  isScheduled?: boolean;
  intervalMs?: number;
}

// Разобрать интервал из description/triggerConfig
function parseIntervalMs(description: string, triggerConfig?: Record<string, any>): number | null {
  // Из triggerConfig
  if (triggerConfig?.intervalMs) return parseInt(String(triggerConfig.intervalMs));
  if (triggerConfig?.interval_ms) return parseInt(String(triggerConfig.interval_ms));

  // Из описания
  const lowerDesc = description.toLowerCase();

  if (/каждую\s+минуту|раз\s+в\s+минуту|every\s+minute/.test(lowerDesc)) return 60_000;

  const minuteMatch = lowerDesc.match(/каждые?\s+(\d+)\s+минут/);
  if (minuteMatch) return parseInt(minuteMatch[1]) * 60_000;

  const minuteMatchEn = lowerDesc.match(/every\s+(\d+)\s+minute/);
  if (minuteMatchEn) return parseInt(minuteMatchEn[1]) * 60_000;

  if (/каждый\s+час|раз\s+в\s+час|every\s+hour/.test(lowerDesc)) return 3_600_000;

  const hourMatch = lowerDesc.match(/каждые?\s+(\d+)\s+час/);
  if (hourMatch) return parseInt(hourMatch[1]) * 3_600_000;

  const hourMatchEn = lowerDesc.match(/every\s+(\d+)\s+hour/);
  if (hourMatchEn) return parseInt(hourMatchEn[1]) * 3_600_000;

  if (/каждый\s+день|ежедневно|every\s+day/.test(lowerDesc)) return 86_400_000;

  return null;
}

// ===== Sub-Agent: Runner =====
// Отвечает за запуск, паузу и управление агентами

export class RunnerAgent {
  private get executionTools() { return getExecutionTools(); }
  private get dbTools() { return getDBTools(); }
  private get securityScanner() { return getSecurityScanner(); }

  // Запустить агента (однократно или активировать scheduler)
  async runAgent(params: RunAgentParams): Promise<ToolResult<ControlResult>> {
    try {
      // Шаг 1: Получаем агента из БД
      const agentResult = await this.dbTools.getAgent(params.agentId, params.userId);
      if (!agentResult.success || !agentResult.data) {
        return { success: false, error: agentResult.error || 'Агент не найден' };
      }

      const agent = agentResult.data;

      // Шаг 2: Быстрая проверка безопасности
      const securityResult = await this.securityScanner.quickScan(agent.code);
      if (!securityResult.success) {
        return { success: false, error: securityResult.error };
      }

      if (!securityResult.data!.safe) {
        return {
          success: true,
          data: {
            success: false,
            agentId: params.agentId,
            action: 'run',
            message: 'Агент не прошел проверку безопасности. Запуск отменён.',
          },
        };
      }

      // Шаг 3: Определяем нужен ли persistent режим
      const triggerConfig = (agent.triggerConfig as Record<string, any>) || {};
      const isScheduled = agent.triggerType === 'scheduled';
      const isAIAgent   = agent.triggerType === 'ai_agent';
      const intervalMs  = parseIntervalMs(agent.description || '', triggerConfig);

      if (isAIAgent) {
        // === AI AGENT MODE: agent.code = system prompt, AI decides tools ===
        const userVarsAI    = await loadUserVariables(params.userId);
        const nestedConfigAI = (triggerConfig.config && typeof triggerConfig.config === 'object') ? triggerConfig.config : {};
        const mergedConfigAI = { ...userVarsAI, ...nestedConfigAI };
        // Pass execCode from trigger_config root level into config so ai-agent-runtime can access it
        if (triggerConfig.execCode) mergedConfigAI.execCode = triggerConfig.execCode;
        const ms             = intervalMs || 5 * 60_000; // default 5 min

        const aiRuntime = getAIAgentRuntime();
        await aiRuntime.activate({
          agentId:      params.agentId,
          userId:       params.userId,
          systemPrompt: agent.code,
          config:       mergedConfigAI,
          intervalMs:   ms,
          onNotify:     (msg) => notifyUser(params.userId, msg),
        });

        // Activate in DB
        await this.dbTools.updateAgent(params.agentId, params.userId, { isActive: true });

        return {
          success: true,
          data: {
            success: true,
            agentId: params.agentId,
            action: 'schedule',
            status: 'active',
            isScheduled: true,
            intervalMs: ms,
            message: `🤖 AI-агент <b>${agent.name}</b> запущен!\n\n🟢 Работает постоянно · 24/7\n💬 Пишите в чат — отвечает мгновенно\n\n📌 Сам найдёт нужную информацию и уведомит`,
          },
        };
      }

      if (isScheduled) {
        // === SCHEDULED MODE: платформа запускает агента по интервалу через setInterval ===
        // Код агента — обычная async function agent(context), не требует while-loop.
        // Платформа сама вызывает её каждые intervalMs миллисекунд.

        // Инжектируем пользовательские переменные в triggerConfig (для доступа через context.config)
        const userVarsForScheduled = await loadUserVariables(params.userId);
        // triggerConfig из DB имеет вид {config:{...user settings...}, intervalMs:...}
        // Разворачиваем вложенный config на верхний уровень, чтобы context.config.KEY работало напрямую
        const nestedConfig = (triggerConfig.config && typeof triggerConfig.config === 'object') ? triggerConfig.config : {};
        const mergedTriggerConfig = { ...userVarsForScheduled, ...nestedConfig, intervalMs: intervalMs || 60_000 };
        const ms = intervalMs || 60_000;

        const activateResult = await this.executionTools.activateScheduledAgent({
          agentId: params.agentId,
          userId: params.userId,
          code: agent.code,
          intervalMs: ms,
          triggerConfig: mergedTriggerConfig,
          onResult: (result) => {
            if (!result.success && result.error) {
              notifyAgentResult({
                userId: params.userId,
                agentId: params.agentId,
                agentName: agent.name,
                success: false,
                error: `Агент упал с ошибкой: ${result.error}`,
                scheduled: true,
              }).catch(() => {});
            }
          },
        });

        if (!activateResult.success) {
          return { success: false, error: activateResult.error };
        }

        // Активируем в БД
        await this.dbTools.updateAgent(params.agentId, params.userId, { isActive: true });

        const intervalLabel = ms >= 3_600_000
          ? `${ms / 3_600_000} ч`
          : ms >= 60_000
            ? `${ms / 60_000} мин`
            : `${ms / 1000} сек`;

        return {
          success: true,
          data: {
            success: true,
            agentId: params.agentId,
            action: 'schedule',
            status: 'active',
            isScheduled: true,
            intervalMs: ms,
            message: `Агент "${agent.name}" запущен!\n\n🔄 Работает 24/7, проверяет каждые ${intervalLabel}\nУведомления придут автоматически при изменениях.`,
          },
        };
      }

      // === MANUAL MODE: однократный запуск ===
      // Инжектируем пользовательские переменные в config (user_variables имеют низший приоритет)
      const userVars = await loadUserVariables(params.userId);
      const mergedContext = {
        ...params.context,
        config: { ...userVars, ...(params.context?.config || {}) },
      };

      const executionResult = await this.executionTools.runAgent({
        agentId: params.agentId,
        userId: params.userId,
        code: agent.code,
        triggerType: agent.triggerType,
        triggerConfig,
        context: mergedContext,
      });

      // Для manual агентов НЕ меняем isActive - они остаются "paused" после однократного выполнения
      // isActive=true только для scheduled агентов которые работают постоянно

      // Логируем
      await getMemoryManager().addMessage(
        params.userId,
        'system',
        `Агент "${agent.name}" выполнен`,
        {
          type: 'agent_executed',
          agentId: params.agentId,
          success: executionResult.data?.success,
        }
      ).catch(() => {});

      return {
        success: true,
        data: {
          success: true,
          agentId: params.agentId,
          action: 'run',
          status: 'completed',
          executionResult: executionResult.data,
          message: `Агент "${agent.name}" выполнен!`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка запуска: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Тестовый запуск (без сохранения)
  async testRun(params: TestRunParams): Promise<ToolResult<ControlResult>> {
    try {
      const securityResult = await this.securityScanner.quickScan(params.code);
      if (!securityResult.success) {
        return { success: false, error: securityResult.error };
      }

      if (!securityResult.data!.safe) {
        return {
          success: true,
          data: {
            success: false,
            agentId: 0,
            action: 'test',
            message: 'Код не прошёл проверку безопасности:\n' + securityResult.data!.issues.join('\n'),
          },
        };
      }

      const executionResult = await this.executionTools.testRun({
        code: params.code,
        userId: params.userId,
        context: params.context,
      });

      return {
        success: true,
        data: {
          success: executionResult.success,
          agentId: 0,
          action: 'test',
          executionResult: executionResult.data,
          message: executionResult.success
            ? 'Тест выполнен успешно!'
            : `Тест завершился с ошибкой: ${executionResult.error}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка теста: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Отправить сообщение AI-агенту (chat feature)
  sendMessageToAgent(agentId: number, text: string): void {
    addMessageToAIAgent(agentId, text);
  }

  // Приостановить агента (остановить scheduler + деактивировать в БД)
  async pauseAgent(agentId: number, userId: number): Promise<ToolResult<ControlResult>> {
    // Останавливаем AI runtime если есть
    getAIAgentRuntime().deactivate(agentId);
    // Останавливаем scheduler если есть
    await this.executionTools.deactivateAgent(agentId);

    // Деактивируем в БД
    const result = await this.dbTools.updateAgent(agentId, userId, { isActive: false });

    return {
      success: result.success,
      data: result.success ? {
        success: true,
        agentId,
        action: 'pause',
        status: 'paused',
        message: `Агент "${result.data?.name || '#' + agentId}" остановлен`,
      } : undefined,
      error: result.error,
    };
  }

  // Активировать/деактивировать агента (toggle)
  async toggleAgent(agentId: number, userId: number): Promise<ToolResult<ControlResult>> {
    const agentResult = await this.dbTools.getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      return { success: false, error: 'Агент не найден' };
    }

    const agent = agentResult.data;

    if (agent.isActive) {
      // Деактивируем
      return this.pauseAgent(agentId, userId);
    } else {
      // Активируем через runAgent
      return this.runAgent({ agentId, userId });
    }
  }

  // Получить логи агента
  async getLogs(
    agentId: number,
    userId: number,
    limit: number = 20
  ): Promise<ToolResult<{ logs: Array<{ timestamp: Date; level: string; message: string }> }>> {
    const result = await this.executionTools.getLogs(agentId, userId, limit);
    if (!result.success) {
      return result as unknown as ToolResult<{ logs: any[] }>;
    }
    return {
      success: true,
      data: { logs: result.data! },
    };
  }

  // Получить статус агента
  async getStatus(agentId: number): Promise<ToolResult<{
    status: string;
    uptime?: number;
    logCount: number;
    hasScheduler?: boolean;
  }>> {
    return this.executionTools.getAgentStatus(agentId);
  }

  // Получить список запущенных агентов
  async getRunningAgents(): Promise<ToolResult<Array<{
    agentId: number;
    status: string;
    startTime?: Date;
  }>>> {
    const running = this.executionTools.getRunningAgents();
    return { success: true, data: running };
  }

  // Остановить всех агентов пользователя
  async stopAllUserAgents(userId: number): Promise<ToolResult<void>> {
    return this.executionTools.stopUserAgents(userId);
  }

  // Получить полную информацию об агенте со статусом
  async getAgentFullInfo(agentId: number, userId: number): Promise<ToolResult<{
    id: number;
    name: string;
    description: string;
    isActive: boolean;
    triggerType: string;
    status: string;
    uptime?: number;
    logCount: number;
    hasScheduler?: boolean;
    lastExecution?: Date;
  }>> {
    const agentResult = await this.dbTools.getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      return { success: false, error: 'Агент не найден' };
    }

    const agent = agentResult.data;
    const statusResult = this.executionTools.getAgentStatus(agentId);

    return {
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isActive: agent.isActive,
        triggerType: agent.triggerType,
        status: statusResult.data?.status || 'idle',
        uptime: statusResult.data?.uptime,
        logCount: statusResult.data?.logCount || 0,
        hasScheduler: statusResult.data?.hasScheduler || false,
        lastExecution: agent.updatedAt,
      },
    };
  }
}

// Singleton instance
let runnerAgent: RunnerAgent | null = null;

export function getRunnerAgent(): RunnerAgent {
  if (!runnerAgent) {
    runnerAgent = new RunnerAgent();
  }
  return runnerAgent;
}

// ── Восстановление активных агентов после перезапуска ─────────────────────
// Вызывается из index.ts после старта бота.
// Читает из БД все агенты с isActive=true и повторно активирует их schedulers.
export async function restoreActiveAgents(): Promise<void> {
  try {
    const { getAgentsRepository } = await import('../../db/agents');
    const activeAgents = await getAgentsRepository().getAllActive();

    if (activeAgents.length === 0) {
      console.log('[Runner] No active agents to restore');
      return;
    }

    console.log(`[Runner] Restoring ${activeAgents.length} active agent(s)...`);
    const runner = getRunnerAgent();

    for (const agent of activeAgents) {
      if (agent.triggerType !== 'scheduled' && agent.triggerType !== 'ai_agent') {
        // Не-scheduled агенты не должны быть постоянно активны — сбрасываем флаг
        await getDBTools().updateAgent(agent.id, agent.userId, { isActive: false }).catch(() => {});
        continue;
      }

      try {
        // Pre-warm in-memory state из DB перед запуском — агент продолжит с того места где остановился
        try {
          const { agentState } = await import('../tools/execution-tools');
          const { getAgentStateRepository } = await import('../../db/schema-extensions');
          const rows = await getAgentStateRepository().getAll(agent.id);
          if (rows.length > 0) {
            if (!agentState.has(agent.id)) agentState.set(agent.id, new Map());
            rows.forEach(r => agentState.get(agent.id)!.set(r.key, r.value));
            console.log(`[Runner] Pre-warmed state for agent #${agent.id}: ${rows.length} key(s)`);
          }
        } catch { /* schema-extensions not yet initialized — will load on first setState */ }

        // Запускаем асинхронно — не блокируем цикл (первый прогон занимает время)
        runner.runAgent({ agentId: agent.id, userId: agent.userId })
          .then(() => console.log(`[Runner] ✅ Restored agent #${agent.id} "${agent.name}" (user ${agent.userId})`))
          .catch(e => console.error(`[Runner] ❌ Failed agent #${agent.id}:`, e));
      } catch (e) {
        console.error(`[Runner] ❌ Failed to restore agent #${agent.id} "${agent.name}":`, e);
        // Один сломавшийся агент не должен блокировать остальные
      }
    }

    console.log('[Runner] Restore complete');
  } catch (e) {
    console.error('[Runner] restoreActiveAgents error:', e);
  }
}