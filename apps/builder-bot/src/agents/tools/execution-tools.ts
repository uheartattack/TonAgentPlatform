import { NodeVM } from 'vm2';
// Native fetch is available in Node 18+
import { ToolResult } from './db-tools';
import { getMemoryManager } from '../../db/memory';
import { notifyUser } from '../../notifier';
import {
  getAgentStateRepository,
  getAgentLogsRepository,
  getExecutionHistoryRepository,
} from '../../db/schema-extensions';

// ── Sanitizer: fix literal newlines inside string literals ──────────────────
// AI code generators sometimes emit actual \n characters inside quoted strings
// instead of the escape sequence \\n, causing SyntaxError "Unterminated string".
function fixLiteralNewlinesInStrings(code: string): string {
  let result = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      result += ch; i++;
      while (i < code.length) {
        const c = code[i];
        if (c === '\\') { result += c + (code[i + 1] || ''); i += 2; }
        else if (c === quote) { result += c; i++; break; }
        else if (c === '\n') { result += '\\n'; i++; }
        else if (c === '\r') { i++; }
        else { result += c; i++; }
      }
    } else if (ch === '`') {
      // Template literals — copy verbatim
      result += ch; i++;
      while (i < code.length) {
        const c = code[i];
        if (c === '\\') { result += c + (code[i + 1] || ''); i += 2; }
        else if (c === '`') { result += c; i++; break; }
        else { result += c; i++; }
      }
    } else { result += ch; i++; }
  }
  return result;
}

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
// Write-through cache: быстрые чтения из памяти, асинхронная запись в DB.
// При рестарте бота state восстанавливается из DB (см. runner.ts restoreActiveAgents).
export const agentState: Map<number, Map<string, any>> = new Map();

// Последняя ошибка для auto-repair
export const agentLastErrors: Map<number, { error: string; code: string; timestamp: Date }> = new Map();

// ===== Persistent runner registry =====
// Хранит stopFlag и promise для живых агентов (persistent mode)
interface PersistentRunner {
  stopFlag: { stopped: boolean };
  promise: Promise<void>;
  agentId: number;
  userId: number;
}
const persistentRunners: Map<number, PersistentRunner> = new Map();

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

      // Персистируем лог в DB (fire-and-forget — не блокирует выполнение)
      try {
        getAgentLogsRepository().insert({
          agentId: params.agentId,
          userId:  params.userId,
          level,
          message,
          details,
        }).catch(() => {});
      } catch { /* repository не инициализирован — игнорируем */ }
    };

    // Запись в execution_history
    let runHistoryId: number | null = null;
    try {
      runHistoryId = await getExecutionHistoryRepository().start({
        agentId: params.agentId,
        userId:  params.userId,
        triggerType: params.triggerType || 'manual',
      });
    } catch { /* not initialized */ }

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

      // Завершаем запись в execution_history
      if (runHistoryId !== null) {
        try {
          const status = result.success ? 'success' : 'error';
          await getExecutionHistoryRepository().finish(
            runHistoryId, status, executionTime, result.error,
            result.result ? { preview: String(result.result).slice(0, 200) } : undefined
          );
        } catch { /* ignore */ }
      }

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

      const executionTime = Date.now() - startTime;
      if (runHistoryId !== null) {
        try {
          await getExecutionHistoryRepository().finish(runHistoryId, 'error', executionTime, errorMessage);
        } catch { /* ignore */ }
      }

      const existing = this.runningAgents.get(params.agentId);
      if (existing) {
        existing.status = 'error';
        this.runningAgents.set(params.agentId, existing);
      }

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
    addLog: (level: ExecutionLog['level'], message: string, details?: any) => void,
    stopFlag?: { stopped: boolean }  // передаётся для persistent mode
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // NodeVM с доступом к fetch через sandbox
      // Node 18+ имеет глобальный fetch, передаем его в sandbox
      const nativeFetch = (globalThis as any).fetch;

      const agentId = params.agentId;

      // Persistent state helpers for this agent.
      // Если агент новый в этом процессе — загружаем state из DB (write-through cache).
      if (!agentState.has(agentId)) {
        agentState.set(agentId, new Map());
        try {
          const rows = await getAgentStateRepository().getAll(agentId);
          const map = agentState.get(agentId)!;
          rows.forEach(r => map.set(r.key, r.value));
        } catch { /* repository не инициализирован или DB недоступна */ }
      }
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
          // Write-through cache: in-memory для быстрых чтений, запись в DB в фоне.
          // State выживает рестарты сервера (восстанавливается из DB при startup).
          getState: (key: string) => {
            const val = stateMap.get(String(key));
            return val !== undefined ? val : null;
          },
          setState: (key: string, value: any) => {
            stateMap.set(String(key), value);
            // Фоновая запись в DB — не блокирует VM
            try {
              getAgentStateRepository().set(agentId, params.userId, String(key), value).catch(() => {});
            } catch { /* repository не инициализирован (тест) — игнорируем */ }
          },

          // ── getTonBalance(address) — helper: баланс TON в TON (не нанотонах) ──
          getTonBalance: async (address: string): Promise<number> => {
            // Валидация формата TON-адреса перед запросом
            if (!address || typeof address !== 'string') {
              throw new Error('getTonBalance: адрес не передан');
            }
            const cleaned = address.trim();
            if (!/^[EUk][Qq][0-9A-Za-z_-]{46}$/.test(cleaned)) {
              throw new Error(
                `getTonBalance: некорректный адрес "${cleaned}" ` +
                `(длина ${cleaned.length}, ожидается 48 символов EQ.../UQ... в base64url). ` +
                `Проверьте: в адресе могут пропускаться символы _ или -`
              );
            }
            const res = await nativeFetch(
              `https://toncenter.com/api/v2/getAddressBalance?address=${encodeURIComponent(cleaned)}`
            );
            if (!res.ok) {
              if (res.status === 422) {
                throw new Error(
                  `TonCenter 422: адрес "${cleaned}" не прошёл валидацию сервера. ` +
                  `Убедитесь что адрес скопирован полностью (включая _ и -)`
                );
              }
              throw new Error(`TonCenter ${res.status}`);
            }
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

          // ── Persistent execution helpers ──
          // sleep(ms) — приостанавливает агента на N мс (используй в while-цикле)
          // await sleep(60000)  → пауза 1 минута
          // Досрочно завершается если isStopped() стал true (каждые 200мс проверяет флаг)
          sleep: (ms: number) => {
            const capped = Math.max(0, Math.min(ms, 86_400_000));
            return new Promise<void>((resolve) => {
              let timer: NodeJS.Timeout;
              let checker: NodeJS.Timeout | undefined;
              const done = () => {
                clearTimeout(timer);
                if (checker) clearInterval(checker);
                resolve();
              };
              timer = setTimeout(done, capped);
              // Check stopFlag every 200ms so we can wake up early when stopped
              if (stopFlag) {
                checker = setInterval(() => { if (stopFlag!.stopped) done(); }, 200);
              }
            });
          },

          // isStopped() — вернёт true когда пользователь нажал "Стоп"
          // Используй в while-цикле: while (!isStopped()) { ... }
          isStopped: stopFlag ? () => stopFlag.stopped : () => false,

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
          // AbortController / AbortSignal — необходимы для fetch timeout
          // VM2 не инжектирует Node 18+ глобалы автоматически
          AbortController,
          AbortSignal,
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

      // Sanitize: fix literal newlines inside string literals (common AI codegen mistake)
      // e.g. 'text\nmore' with real \n → 'text\\nmore' → prevents SyntaxError
      code = fixLiteralNewlinesInStrings(code);

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

  // ═══════════════════════════════════════════════════════════
  // PERSISTENT AGENT — живёт 24/7, управляет своим расписанием
  // Агент использует while(!isStopped()) { ... await sleep(X) }
  // ═══════════════════════════════════════════════════════════
  async runPersistentAgent(params: {
    agentId: number;
    userId: number;
    code: string;
    triggerConfig?: Record<string, any>;
    onCrash?: (error: string) => void;
  }): Promise<ToolResult<void>> {
    // Останавливаем предыдущий если был
    await this.deactivateAgent(params.agentId);

    const stopFlag = { stopped: false };
    const logs: ExecutionLog[] = [];

    const addLog = (level: ExecutionLog['level'], message: string, details?: any) => {
      logs.push({ timestamp: new Date(), level, message, details });
      getMemoryManager().addMessage(
        params.userId, 'system', `[${level.toUpperCase()}] ${message}`,
        { agentId: params.agentId, level, details }
      ).catch(() => {});
      // Персистируем лог в DB
      try {
        getAgentLogsRepository().insert({
          agentId: params.agentId,
          userId:  params.userId,
          level,
          message,
          details,
        }).catch(() => {});
      } catch { /* not initialized */ }
    };

    // Регистрируем как running
    this.runningAgents.set(params.agentId, {
      status: 'running',
      startTime: new Date(),
      logs,
      agentId: params.agentId,
      userId: params.userId,
    });

    // Запускаем агента в фоне — НЕ await-им, он живёт самостоятельно
    const promise = this._executeCode(
      params.code,
      { agentId: params.agentId, userId: params.userId, triggerConfig: params.triggerConfig },
      logs,
      addLog,
      stopFlag  // ← cooperative stop
    ).then(result => {
      const runner = this.runningAgents.get(params.agentId);
      if (runner && !stopFlag.stopped) {
        runner.status = 'paused';
        this.runningAgents.set(params.agentId, runner);
      }
      if (result.error && !stopFlag.stopped) {
        agentLastErrors.set(params.agentId, { error: result.error, code: params.code, timestamp: new Date() });
        params.onCrash?.(result.error);
      }
    }).catch(err => {
      const msg = err?.message || String(err);
      addLog('error', `Агент упал: ${msg}`);
      agentLastErrors.set(params.agentId, { error: msg, code: params.code, timestamp: new Date() });
      params.onCrash?.(msg);
    });

    persistentRunners.set(params.agentId, {
      stopFlag,
      promise: promise as Promise<void>,
      agentId: params.agentId,
      userId: params.userId,
    });

    return { success: true, message: `Persistent агент #${params.agentId} запущен` };
  }

  // Деактивировать агента (остановить интервал ИЛИ persistent loop)
  async deactivateAgent(agentId: number): Promise<ToolResult<void>> {
    // Persistent mode — сигнализируем стоп
    const persistent = persistentRunners.get(agentId);
    if (persistent) {
      persistent.stopFlag.stopped = true;
      persistentRunners.delete(agentId);
    }
    // Interval mode — очищаем setInterval
    const current = this.runningAgents.get(agentId);
    if (current?.intervalHandle) {
      clearInterval(current.intervalHandle);
    }
    this.runningAgents.delete(agentId);
    return { success: true, message: 'Агент деактивирован' };
  }

  // Приостановить агента
  async pauseAgent(agentId: number, userId: number): Promise<ToolResult<void>> {
    // Persistent — ставим флаг остановки
    const persistent = persistentRunners.get(agentId);
    if (persistent) {
      persistent.stopFlag.stopped = true;
      persistentRunners.delete(agentId);
    }

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
    const persistent = persistentRunners.get(agentId);
    const agent = this.runningAgents.get(agentId);

    // Persistent агент — живой до явной остановки
    if (persistent && !persistent.stopFlag.stopped) {
      const uptime = agent?.startTime ? Date.now() - agent.startTime.getTime() : undefined;
      return {
        success: true,
        data: {
          status: 'running',
          uptime,
          logCount: agent?.logs.length || 0,
          hasScheduler: true, // persistent = has scheduler (самостоятельный)
        },
      };
    }

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
    // Собираем persistent агентов
    const persistentList = Array.from(persistentRunners.entries())
      .filter(([, runner]) => !runner.stopFlag.stopped)
      .map(([agentId, runner]) => ({
        agentId,
        status: 'running' as AgentStatus,
        startTime: this.runningAgents.get(agentId)?.startTime,
      }));

    // Добавляем interval-based агентов (не дублируем persistent)
    const persistentIds = new Set(persistentList.map(p => p.agentId));
    const intervalList = Array.from(this.runningAgents.entries())
      .filter(([agentId, data]) => !persistentIds.has(agentId) && (data.status === 'running' || data.intervalHandle))
      .map(([agentId, data]) => ({
        agentId,
        status: data.status,
        startTime: data.startTime,
      }));

    return [...persistentList, ...intervalList];
  }

  // Остановить всех агентов пользователя
  async stopUserAgents(userId: number): Promise<ToolResult<void>> {
    try {
      // Stop persistent runners for this user
      for (const [agentId, runner] of persistentRunners.entries()) {
        if (runner.userId === userId) {
          runner.stopFlag.stopped = true;
          persistentRunners.delete(agentId);
        }
      }
      // Stop interval-based agents
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

  // Проверить, активен ли агент (persistent или interval-based)
  isAgentActive(agentId: number): boolean {
    const persistent = persistentRunners.get(agentId);
    if (persistent && !persistent.stopFlag.stopped) return true;
    const agent = this.runningAgents.get(agentId);
    return !!(agent?.intervalHandle) || agent?.status === 'running';
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
