import { getExecutionTools, type ExecutionResult } from '../tools/execution-tools';
import { getDBTools, type ToolResult } from '../tools/db-tools';
import { getSecurityScanner } from '../tools/security-scanner';
import { getMemoryManager } from '../../db/memory';
import { notifyAgentResult, notifyUser } from '../../notifier';
import { getUserSettingsRepository } from '../../db/schema-extensions';
import { getAIAgentRuntime, addMessageToAIAgent } from '../ai-agent-runtime';
import { broadcastWSEvent } from '../../api-server';
import { lifecycleManager } from '../../services/agent-lifecycle';

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
  // Priority 1: explicit config (validate to prevent NaN → 1ms infinite loop)
  if (triggerConfig?.intervalMs) {
    const ms = parseInt(String(triggerConfig.intervalMs));
    if (!isNaN(ms) && ms > 0) return Math.max(10_000, ms); // min 10s
  }
  if (triggerConfig?.interval_ms) {
    const ms = parseInt(String(triggerConfig.interval_ms));
    if (!isNaN(ms) && ms > 0) return Math.max(10_000, ms);
  }

  // Priority 2: parse from description
  const lowerDesc = description.toLowerCase();

  // Seconds
  const secMatch = lowerDesc.match(/(?:каждые?|every)\s+(\d+)\s+(?:секунд|second|sec)/);
  if (secMatch) return Math.max(10_000, parseInt(secMatch[1]) * 1000); // min 10s

  // Minutes
  if (/каждую\s+минуту|раз\s+в\s+минуту|every\s+minute/.test(lowerDesc)) return 60_000;
  const minuteMatch = lowerDesc.match(/(?:каждые?|every)\s+(\d+)\s+(?:минут|minute|min)/);
  if (minuteMatch) return Math.max(10_000, parseInt(minuteMatch[1]) * 60_000);

  // Hours
  if (/каждый\s+час|раз\s+в\s+час|every\s+hour|hourly/.test(lowerDesc)) return 3_600_000;
  const hourMatch = lowerDesc.match(/(?:каждые?|every)\s+(\d+)\s+(?:час|hour)/);
  if (hourMatch) return parseInt(hourMatch[1]) * 3_600_000;

  // Days
  if (/каждый\s+день|ежедневно|every\s+day|daily/.test(lowerDesc)) return 86_400_000;

  // Weekday patterns
  if (/(?:по\s+понедельникам|every\s+monday|каждый\s+понедельник)/.test(lowerDesc)) return 7 * 86_400_000;
  if (/(?:еженедельно|weekly|раз\s+в\s+неделю|every\s+week)/.test(lowerDesc)) return 7 * 86_400_000;

  // Generic number + time unit
  const genericMatch = lowerDesc.match(/(\d+)\s*(?:m|мин|min)(?:ут)?/);
  if (genericMatch) return parseInt(genericMatch[1]) * 60_000;

  // Log unrecognized schedule for debugging
  if (/каждый|every|раз\s+в|интервал|interval|repeat|повтор/.test(lowerDesc)) {
    console.warn(`[Runner] Schedule pattern not recognized in description: "${description.slice(0, 100)}"`);
  }

  return null;
}

/** Merge user variables + trigger config into a single config object (DRY helper) */
/**
 * Auto-upgrade agent config with platform defaults.
 * Old agents created before smart defaults were added get
 * behavior, learning, compaction, masking, flood protection etc.
 * This runs on every load so agents always benefit from new platform features.
 */
export function normalizeAgentConfig(cfg: Record<string, any>): Record<string, any> {
  // Behavior defaults
  if (!cfg.behavior || typeof cfg.behavior !== 'object') {
    cfg.behavior = {};
  }
  const bh = cfg.behavior;
  if (bh.typingDelay === undefined) bh.typingDelay = true;
  if (bh.typingSpeed === undefined) bh.typingSpeed = 40;
  if (bh.readReceipts === undefined) bh.readReceipts = true;
  if (bh.readDelay === undefined) bh.readDelay = 1.5;
  if (bh.messageSplitting === undefined) bh.messageSplitting = true;
  if (bh.thinkingPhrases === undefined) bh.thinkingPhrases = true;
  if (bh.reactions === undefined) bh.reactions = true;
  if (bh.randomVariance === undefined) bh.randomVariance = 25;

  // Learning defaults
  if (!cfg.learning || typeof cfg.learning !== 'object') {
    cfg.learning = {};
  }
  const lr = cfg.learning;
  if (lr.feedbackLoop === undefined) lr.feedbackLoop = true;
  if (lr.errorHealing === undefined) lr.errorHealing = true;
  if (lr.maxRetries === undefined) lr.maxRetries = 3;
  if (lr.circuitBreakerThreshold === undefined) lr.circuitBreakerThreshold = 5;
  if (lr.qualityScoring === undefined) lr.qualityScoring = true;
  if (lr.styleAdaptation === undefined) lr.styleAdaptation = true;
  if (!lr.negativePatterns) lr.negativePatterns = 'нет, не так, неправильно, бред, отстой, фигня';

  // Memory & context management
  if (cfg.compaction_strategy === undefined) cfg.compaction_strategy = 'structured';
  if (cfg.masking_enabled === undefined) cfg.masking_enabled = true;
  if (cfg.masking_keep_recent === undefined) cfg.masking_keep_recent = 8;
  if (cfg.memory_poisoning_protection === undefined) cfg.memory_poisoning_protection = true;

  // Rate limiting & safety
  if (cfg.flood_cooldown_sec === undefined) cfg.flood_cooldown_sec = 30;
  if (cfg.loop_max_responses === undefined) cfg.loop_max_responses = 8;
  if (cfg.loop_window_sec === undefined) cfg.loop_window_sec = 300;

  // Role-aware defaults: role profile provides base config, user overrides on top
  try {
    const { getRoleProfile } = require('./role-profiles');
    const roleId = cfg.AGENT_ROLE || cfg.agentRole || 'worker';
    const profile = getRoleProfile(roleId);
    // Behavior: role defaults < existing config (user wins)
    if (profile.behaviorOverrides) {
      const bh = cfg.behavior;
      for (const [k, v] of Object.entries(profile.behaviorOverrides)) {
        if (bh[k] === undefined) bh[k] = v;
      }
    }
    // Learning: same merge pattern
    if (profile.learningOverrides) {
      const lr = cfg.learning;
      for (const [k, v] of Object.entries(profile.learningOverrides)) {
        if (lr[k] === undefined) lr[k] = v;
      }
    }
  } catch {}

  return cfg;
}

function mergeAgentConfig(
  userVars: Record<string, any>,
  triggerConfig: Record<string, any>,
): Record<string, any> {
  const nestedConfig = (triggerConfig.config && typeof triggerConfig.config === 'object') ? triggerConfig.config : {};
  const merged = { ...userVars, ...nestedConfig };
  // Pass execCode from trigger_config root level
  if (triggerConfig.execCode) merged.execCode = triggerConfig.execCode;
  // Pass telegram_session flag
  if (triggerConfig.telegram_session?.session) merged._hasTgSession = true;
  // Auto-upgrade with platform defaults
  return normalizeAgentConfig(merged);
}

// ── Per-agent serial message queue — prevents concurrent processing crashes ──
// Owner messages jump to front (priority), others go to back.
const agentMessageQueues = new Map<string, Array<{
  message: string;
  userId: number;
  isOwner: boolean;
  context?: Record<string, any>;
  resolve: (result: any) => void;
  reject: (err: any) => void;
}>>();
const agentProcessing = new Map<string, boolean>();

async function processAgentMessageInternal(agentId: string, message: string, userId: number, context?: Record<string, any>): Promise<void> {
  addMessageToAIAgent(parseInt(agentId, 10), message, context);
}

async function drainAgentQueue(agentId: string): Promise<void> {
  if (agentProcessing.get(agentId)) return;
  agentProcessing.set(agentId, true);
  try {
    // Keep draining until queue is empty — items may be added during await yields
    let queue = agentMessageQueues.get(agentId) ?? [];
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        const result = await processAgentMessageInternal(agentId, item.message, item.userId, item.context);
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
      // Re-fetch queue reference in case it was replaced
      queue = agentMessageQueues.get(agentId) ?? [];
    }
  } finally {
    agentProcessing.set(agentId, false);
    // Re-drain if items arrived while we were processing
    const remaining = agentMessageQueues.get(agentId) ?? [];
    if (remaining.length > 0) drainAgentQueue(agentId).catch(e => console.error('[Queue] re-drain error:', e));
  }
}

export async function enqueueAgentMessage(agentId: number, message: string, userId: number, isOwner = false, context?: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const key = String(agentId);
    if (!agentMessageQueues.has(key)) agentMessageQueues.set(key, []);
    const queue = agentMessageQueues.get(key)!;
    const item = { message, userId, isOwner, context, resolve, reject };
    // Owner messages jump to front (priority 'now'), others go to back ('later')
    if (isOwner) {
      queue.unshift(item);
    } else {
      queue.push(item);
    }
    drainAgentQueue(key).catch(err => console.error('[Queue] drainAgentQueue error:', err));
  });
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

      if (!securityResult.data?.safe) {
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
      const runConfig = Object.freeze({ ...((agent.triggerConfig as Record<string, any>) || {}) }); // snapshot once per tick
      const triggerConfig = runConfig;
      const isScheduled = agent.triggerType === 'scheduled';
      const isAIAgent   = agent.triggerType === 'ai_agent';
      const intervalMs  = parseIntervalMs(agent.description || '', triggerConfig);

      if (isAIAgent) {
        // === AI AGENT MODE: agent.code = system prompt, AI decides tools ===
        const userVarsAI    = await loadUserVariables(params.userId);
        const mergedConfigAI = mergeAgentConfig(userVarsAI, triggerConfig);
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
        lifecycleManager.markRunning(params.agentId);

        broadcastWSEvent(params.userId, {
          type: 'agent_started', agentId: params.agentId,
          agentName: agent.name, timestamp: Date.now(),
        });

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

        const userVarsForScheduled = await loadUserVariables(params.userId);
        const mergedTriggerConfig = { ...mergeAgentConfig(userVarsForScheduled, triggerConfig), intervalMs: intervalMs || 60_000 };
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
              broadcastWSEvent(params.userId, {
                type: 'agent_error', agentId: params.agentId,
                agentName: agent.name,
                data: { error: result.error },
                timestamp: Date.now(),
              });
            } else {
              broadcastWSEvent(params.userId, {
                type: 'agent_tick', agentId: params.agentId,
                agentName: agent.name,
                data: { success: result.success },
                timestamp: Date.now(),
              });
            }
          },
        });

        if (!activateResult.success) {
          return { success: false, error: activateResult.error };
        }

        // Активируем в БД
        await this.dbTools.updateAgent(params.agentId, params.userId, { isActive: true });

        broadcastWSEvent(params.userId, {
          type: 'agent_started', agentId: params.agentId,
          agentName: agent.name, timestamp: Date.now(),
        });

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

      broadcastWSEvent(params.userId, {
        type: 'agent_tick', agentId: params.agentId,
        agentName: agent.name,
        data: { success: executionResult.data?.success },
        timestamp: Date.now(),
      });

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

      if (!securityResult.data?.safe) {
        return {
          success: true,
          data: {
            success: false,
            agentId: 0,
            action: 'test',
            message: 'Код не прошёл проверку безопасности:\n' + (securityResult.data?.issues || ['Unknown security issue']).join('\n'),
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

  // Отправить сообщение AI-агенту (chat feature) — serialized via per-agent queue
  sendMessageToAgent(agentId: number, text: string, context?: Record<string, any>): void {
    enqueueAgentMessage(agentId, text, 0, false, context).catch(err =>
      console.error(`[Runner] sendMessageToAgent queue error agent #${agentId}:`, err)
    );
  }

  // Приостановить агента (остановить scheduler + деактивировать в БД)
  async pauseAgent(agentId: number, userId: number): Promise<ToolResult<ControlResult>> {
    // Останавливаем AI runtime если есть
    getAIAgentRuntime().deactivate(agentId);
    // Останавливаем scheduler если есть
    await this.executionTools.deactivateAgent(agentId);

    // Деактивируем в БД
    const result = await this.dbTools.updateAgent(agentId, userId, { isActive: false });

    if (result.success) {
      lifecycleManager.markStopped(agentId);
      broadcastWSEvent(userId, {
        type: 'agent_stopped', agentId,
        agentName: result.data?.name,
        timestamp: Date.now(),
      });
    }

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
    const statusResult = await this.executionTools.getAgentStatus(agentId);

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
// TODO: Add a periodic health-check mechanism (e.g. every 5 min) to detect agents
// that crashed silently (scheduler stopped but DB still shows isActive=true) and
// either restart them or mark them as failed with user notification.
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

        // Rate limit: 500ms delay between activations to avoid overwhelming DB/API on restart
        await new Promise(r => setTimeout(r, 500));
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