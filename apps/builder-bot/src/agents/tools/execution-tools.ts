import { NodeVM } from 'vm2';
// Native fetch is available in Node 18+
import { ToolResult } from './db-tools';
import { getMemoryManager } from '../../db/memory';
import { notifyUser } from '../../notifier';

// Лог выполнения
interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
}

// Результат выполнения
export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  logs: ExecutionLog[];
  executionTime: number;
}

// Статус агента
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';

// Данные запущенного агента
interface AgentRunData {
  status: AgentStatus;
  startTime?: Date;
  logs: ExecutionLog[];
  intervalHandle?: ReturnType<typeof setInterval>;
  intervalMs?: number;
  agentId: number;
  userId: number;
}

// ===== Персистентное состояние агентов (между запусками) =====
// agentState[agentId][key] = value — хранится в памяти процесса, сбрасывается при рестарте
const agentState: Map<number, Map<string, any>> = new Map();

// Последняя ошибка для auto-repair
export const agentLastErrors: Map<number, { error: string; code: string; timestamp: Date }> = new Map();

// ===== Инструменты для выполнения агентов =====

export class ExecutionTools {
  private runningAgents: Map<number, AgentRunData> = new Map();

  // Запустить агента
  async runAgent(params: {
    agentId: number;
    userId: number;
    code: string;
    triggerType?: string;
    triggerConfig?: Record<string, any>;
    context?: {
      wallet?: string;
      config?: Record<string, any>;
    };
    onResult?: (result: ExecutionResult) => void; // callback for scheduler
  }): Promise<ToolResult<ExecutionResult>> {
    const startTime = Date.now();
    const logs: ExecutionLog[] = [];

    const addLog = (level: ExecutionLog['level'], message: string, details?: any) => {
      const log = { timestamp: new Date(), level, message, details };
      logs.push(log);

      getMemoryManager().addMessage(
        params.userId,
        'system',
        `[${level.toUpperCase()}] ${message}`,
        { agentId: params.agentId, level, details }
      ).catch(() => {});
    };

    try {
      // Проверяем, не запущен ли уже
      const current = this.runningAgents.get(params.agentId);
      if (current?.status === 'running') {
        return {
          success: false,
          error: 'Агент уже запущен',
        };
      }

      // Устанавливаем статус
      this.runningAgents.set(params.agentId, {
        status: 'running',
        startTime: new Date(),
        logs,
        agentId: params.agentId,
        userId: params.userId,
      });

      addLog('info', `Запуск агента #${params.agentId}`);

      // Выполняем код в VM с реальным fetch
      const result = await this._executeCode(params.code, params, logs, addLog);

      const executionTime = Date.now() - startTime;

      // Обновляем статус
      const existing = this.runningAgents.get(params.agentId);
      if (existing) {
        existing.status = 'idle';
        this.runningAgents.set(params.agentId, existing);
      }

      if (params.onResult) {
        params.onResult({ success: result.success, result: result.result, error: result.error, logs, executionTime });
      }

      return {
        success: true,
        data: {
          success: result.success,
          result: result.result,
          error: result.error,
          logs,
          executionTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Ошибка выполнения: ${errorMessage}`);

      const existing = this.runningAgents.get(params.agentId);
      if (existing) {
        existing.status = 'error';
        this.runningAgents.set(params.agentId, existing);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: errorMessage,
        data: {
          success: false,
          error: errorMessage,
          logs,
          executionTime,
        },
      };
    }
  }

  // Выполнить код агента в изолированной VM с реальным fetch
  private async _executeCode(
    code: string,
    params: { agentId: number; userId: number; context?: any; triggerConfig?: any },
    logs: ExecutionLog[],
    addLog: (level: ExecutionLog['level'], message: string, details?: any) => void
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // NodeVM с доступом к fetch через sandbox
      // Node 18+ имеет глобальный fetch, передаем его в sandbox
      const nativeFetch = (globalThis as any).fetch;

      const agentId = params.agentId;

      // Persistent state helpers for this agent
      if (!agentState.has(agentId)) agentState.set(agentId, new Map());
      const stateMap = agentState.get(agentId)!;

      const vm = new NodeVM({
        timeout: 55000, // 55s — у API иногда долгий response
        sandbox: {
          // ── Реальный fetch из Node 18+ ──
          fetch: nativeFetch,

          // ── Контекст агента ──
          context: {
            userId: params.userId,
            agentId: params.agentId,
            wallet: params.context?.wallet,
            config: params.context?.config || params.triggerConfig || {},
            soul: params.triggerConfig?.soul || params.context?.soul || null,
          },

          // ── Объект логирования ──
          console: {
            log: (...args: any[]) => addLog('info', args.map(String).join(' ')),
            warn: (...args: any[]) => addLog('warn', args.map(String).join(' ')),
            error: (...args: any[]) => addLog('error', args.map(String).join(' ')),
            info: (...args: any[]) => addLog('info', args.map(String).join(' ')),
          },

          // ── notify(text) — отправить Telegram сообщение пользователю СРАЗУ ──
          // Используй для алертов: если баланс упал, цена изменилась и т.д.
          notify: (text: string) => {
            const msg = String(text).slice(0, 4000);
            addLog('info', `[notify] → user ${params.userId}: ${msg.slice(0, 80)}`);
            notifyUser(params.userId, msg).catch(e =>
              addLog('warn', `[notify] failed: ${e?.message}`)
            );
          },

          // ── getState(key) / setState(key, val) — персистентное состояние между запусками ──
          // Живёт пока бот работает (in-memory). Используй для change-detection.
          // Пример: const prevBalance = getState('balance'); setState('balance', newBalance);
          getState: (key: string) => {
            const val = stateMap.get(String(key));
            return val !== undefined ? val : null;
          },
          setState: (key: string, value: any) => {
            stateMap.set(String(key), value);
          },

          // ── getTonBalance(address) — helper: баланс TON в TON (не нанотонах) ──
          getTonBalance: async (address: string): Promise<number> => {
            const res = await nativeFetch(
              `https://toncenter.com/api/v2/getAddressBalance?address=${encodeURIComponent(address)}`
            );
            if (!res.ok) throw new Error(`TonCenter ${res.status}`);
            const data = await res.json() as any;
            if (!data.ok) throw new Error(`TonCenter error: ${data.error}`);
            return parseInt(data.result || '0', 10) / 1e9;
          },

          // ── getPrice(symbol) — helper: цена в USD ──
          getPrice: async (symbol: string = 'TON'): Promise<number> => {
            const id = symbol.toLowerCase() === 'ton' ? 'the-open-network' : symbol.toLowerCase();
            const res = await nativeFetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
            );
            if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
            const data = await res.json() as any;
            return data[id]?.usd ?? 0;
          },

          // ── Cross-agent messaging (OpenClaw sessions_send pattern) ──
          agent_send: (toAgentId: number, data: any) => {
            sendAgentMessage(agentId, toAgentId, data);
            addLog('info', `[agent_send] → агент #${toAgentId}: ${JSON.stringify(data).slice(0, 80)}`);
          },
          agent_receive: () => {
            const msgs = receiveAgentMessages(agentId);
            if (msgs.length) addLog('info', `[agent_receive] ${msgs.length} сообщений`);
            return msgs.map(m => ({ from: m.fromAgentId, data: m.data, time: m.timestamp.toISOString() }));
          },

          // ── Стандартные глобалы ──
          JSON,
          Math,
          Date,
          parseInt,
          parseFloat,
          isNaN,
          isFinite,
          Buffer,
          URL,
          URLSearchParams,
          setTimeout: undefined,
          setInterval: undefined,
        },
        require: {
          external: false,
          builtin: [],
        },
        eval: false,
        wasm: false,
      });

      // Оборачиваем код агента в async функцию.
      // Если код определяет функцию agent/main/run — вызываем её автоматически.
      // Если код написан напрямую (без функции) — он выполняется как есть и должен вернуть результат.
      const wrappedCode = `
module.exports = async function agentMain() {
${code}

  // ── Авто-вызов именованной функции агента ──
  // AI может написать: async function agent(ctx){...} или async function main(){...}
  // Мы вызываем её автоматически, передавая sandbox-контекст.
  if (typeof agent === 'function') return await agent(context);
  if (typeof main === 'function')  return await main(context);
  if (typeof run === 'function')   return await run(context);
  // Если функции нет — код выполнился напрямую (IIFE-стиль), возвращаем undefined
};
`;

      const agentFn = vm.run(wrappedCode, 'agent.js');
      const result = await agentFn();
      addLog('success', 'Выполнение завершено', result);
      return { success: true, result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog('error', `Ошибка: ${msg}`);
      // Сохраняем для auto-repair
      agentLastErrors.set(params.agentId, { error: msg, code, timestamp: new Date() });
      return { success: false, error: msg };
    }
  }

  // Запустить агента как scheduled (с интервалом)
  async activateScheduledAgent(params: {
    agentId: number;
    userId: number;
    code: string;
    intervalMs: number;
    triggerConfig?: Record<string, any>;
    onResult: (result: ExecutionResult) => void;
  }): Promise<ToolResult<void>> {
    try {
      // Останавливаем предыдущий если был
      await this.deactivateAgent(params.agentId);

      // Первый запуск сразу
      await this.runAgent({
        agentId: params.agentId,
        userId: params.userId,
        code: params.code,
        triggerConfig: params.triggerConfig,
        onResult: params.onResult,
      });

      // Создаём интервал
      const intervalHandle = setInterval(async () => {
        const current = this.runningAgents.get(params.agentId);
        if (!current || current.status === 'running') return; // Пропускаем если уже бежит

        await this.runAgent({
          agentId: params.agentId,
          userId: params.userId,
          code: params.code,
          triggerConfig: params.triggerConfig,
          onResult: params.onResult,
        });
      }, params.intervalMs);

      // Сохраняем состояние
      this.runningAgents.set(params.agentId, {
        status: 'idle',
        startTime: new Date(),
        logs: [],
        intervalHandle,
        intervalMs: params.intervalMs,
        agentId: params.agentId,
        userId: params.userId,
      });

      return { success: true, message: `Агент активирован, интервал ${params.intervalMs}ms` };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка активации: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Деактивировать агента (остановить интервал)
  async deactivateAgent(agentId: number): Promise<ToolResult<void>> {
    const current = this.runningAgents.get(agentId);
    if (current?.intervalHandle) {
      clearInterval(current.intervalHandle);
    }
    this.runningAgents.delete(agentId);
    return { success: true, message: 'Агент деактивирован' };
  }

  // Приостановить агента
  async pauseAgent(agentId: number, userId: number): Promise<ToolResult<void>> {
    const agent = this.runningAgents.get(agentId);

    // Если есть интервал — останавливаем его
    if (agent?.intervalHandle) {
      clearInterval(agent.intervalHandle);
      agent.intervalHandle = undefined;
      agent.status = 'paused';
      this.runningAgents.set(agentId, agent);
    } else if (agent) {
      agent.status = 'paused';
      this.runningAgents.set(agentId, agent);
    }

    await getMemoryManager().addMessage(
      userId,
      'system',
      `Агент #${agentId} приостановлен`,
      { agentId, action: 'paused' }
    ).catch(() => {});

    return { success: true, message: 'Агент приостановлен' };
  }

  // Активировать (возобновить) агента — просто меняем статус
  async activateAgent(agentId: number, userId: number): Promise<ToolResult<void>> {
    const agent = this.runningAgents.get(agentId);
    if (agent) {
      agent.status = 'idle';
      this.runningAgents.set(agentId, agent);
    }

    await getMemoryManager().addMessage(
      userId,
      'system',
      `Агент #${agentId} активирован`,
      { agentId, action: 'activated' }
    ).catch(() => {});

    return { success: true, message: 'Агент активирован' };
  }

  // Получить логи агента
  async getLogs(agentId: number, userId: number, limit: number = 50): Promise<ToolResult<ExecutionLog[]>> {
    const agent = this.runningAgents.get(agentId);
    if (!agent) {
      return { success: true, data: [] };
    }
    return { success: true, data: agent.logs.slice(-limit) };
  }

  // Получить статус агента
  getAgentStatus(agentId: number): ToolResult<{
    status: AgentStatus;
    uptime?: number;
    logCount: number;
    hasScheduler: boolean;
  }> {
    const agent = this.runningAgents.get(agentId);
    if (!agent) {
      return {
        success: true,
        data: { status: 'idle', logCount: 0, hasScheduler: false },
      };
    }

    const uptime = agent.startTime ? Date.now() - agent.startTime.getTime() : undefined;

    return {
      success: true,
      data: {
        status: agent.status,
        uptime,
        logCount: agent.logs.length,
        hasScheduler: !!agent.intervalHandle,
      },
    };
  }

  // Получить всех запущенных агентов
  getRunningAgents(): Array<{ agentId: number; status: AgentStatus; startTime?: Date }> {
    return Array.from(this.runningAgents.entries())
      .filter(([, data]) => data.status === 'running' || data.intervalHandle)
      .map(([agentId, data]) => ({
        agentId,
        status: data.status,
        startTime: data.startTime,
      }));
  }

  // Остановить всех агентов пользователя
  async stopUserAgents(userId: number): Promise<ToolResult<void>> {
    try {
      for (const [agentId, data] of this.runningAgents.entries()) {
        if (data.userId === userId) {
          if (data.intervalHandle) clearInterval(data.intervalHandle);
          this.runningAgents.delete(agentId);
        }
      }
      return { success: true, message: 'Все агенты пользователя остановлены' };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка остановки: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Тестовый запуск кода (без сохранения)
  async testRun(params: {
    code: string;
    userId: number;
    context?: { wallet?: string; config?: Record<string, any> };
  }): Promise<ToolResult<ExecutionResult>> {
    const startTime = Date.now();
    const logs: ExecutionLog[] = [];
    const addLog = (level: ExecutionLog['level'], message: string, details?: any) => {
      logs.push({ timestamp: new Date(), level, message, details });
    };

    try {
      addLog('info', 'Тестовый запуск...');
      const result = await this._executeCode(
        params.code,
        { agentId: 0, userId: params.userId, context: params.context },
        logs,
        addLog
      );

      addLog('success', 'Тест выполнен');

      return {
        success: result.success,
        data: {
          success: result.success,
          result: result.result,
          error: result.error,
          logs,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Ошибка: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        data: { success: false, error: errorMessage, logs, executionTime: Date.now() - startTime },
      };
    }
  }

  // Проверить, активен ли агент (есть ли интервал)
  isAgentActive(agentId: number): boolean {
    const agent = this.runningAgents.get(agentId);
    return !!(agent?.intervalHandle);
  }
}

// ─── OpenClaw sessions_send pattern ────────────────────────────────────────
// Межагентная очередь сообщений: агент A может передать данные агенту B.
// Аналог sessions_send из OpenClaw — агент вызывает agent_message(toId, data)
// и это попадает в очередь, которую другой агент читает через agent_receive().

interface AgentMessage {
  fromAgentId: number;
  data: any;
  timestamp: Date;
}

const agentMessageQueue = new Map<number, AgentMessage[]>(); // toAgentId → messages

export function sendAgentMessage(fromAgentId: number, toAgentId: number, data: any): void {
  const queue = agentMessageQueue.get(toAgentId) || [];
  queue.push({ fromAgentId, data, timestamp: new Date() });
  // Храним максимум 50 сообщений в очереди
  if (queue.length > 50) queue.shift();
  agentMessageQueue.set(toAgentId, queue);
}

export function receiveAgentMessages(agentId: number): AgentMessage[] {
  const msgs = agentMessageQueue.get(agentId) || [];
  agentMessageQueue.delete(agentId); // Читаем и удаляем (consume)
  return msgs;
}

// Singleton instance
let executionTools: ExecutionTools | null = null;

export function getExecutionTools(): ExecutionTools {
  if (!executionTools) {
    executionTools = new ExecutionTools();
  }
  return executionTools;
}
