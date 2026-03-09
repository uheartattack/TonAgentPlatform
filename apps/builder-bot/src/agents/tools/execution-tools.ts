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
import { isAuthorized } from '../../fragment-service';
import { buildUserbotSandbox } from '../../services/telegram-userbot';

// ── Sanitizer: fix common AI code generation issues ──────────────────────────
// 1. Fixes literal newlines inside string literals (SyntaxError "Unterminated string")
// 2. Fixes invalid escape sequences like \" inside single-quoted strings
//    (SyntaxError "Expecting Unicode escape sequence \uXXXX")
// 3. Fixes literal \n sequences (\\n in source) that should be escape sequences
function fixLiteralNewlinesInStrings(code: string): string {
  let result = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "'") {
      // Single-quoted string: fix literal newlines AND invalid escape sequences
      result += ch; i++;
      while (i < code.length) {
        const c = code[i];
        if (c === '\\') {
          const next = code[i + 1] || '';
          // Valid JS escape sequences in single-quoted strings:
          // \n \r \t \\ \' \0 \b \f \v \uXXXX \xXX
          const validEscapes = new Set(['n', 'r', 't', '\\', "'", '0', 'b', 'f', 'v', 'u', 'x', '\n', '\r']);
          if (validEscapes.has(next)) {
            result += c + next; i += 2;
          } else if (next === '"') {
            // \" inside single-quoted string is invalid — just use "
            result += '"'; i += 2;
          } else {
            // Unknown escape — just output the character without backslash
            result += next; i += 2;
          }
        }
        else if (c === "'") { result += c; i++; break; }
        else if (c === '\n') { result += '\\n'; i++; }
        else if (c === '\r') { i++; }
        else { result += c; i++; }
      }
    } else if (ch === '"') {
      // Double-quoted string
      result += ch; i++;
      while (i < code.length) {
        const c = code[i];
        if (c === '\\') { result += c + (code[i + 1] || ''); i += 2; }
        else if (c === '"') { result += c; i++; break; }
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
            if (!address || typeof address !== 'string') {
              throw new Error('getTonBalance: адрес не передан');
            }
            const cleaned = address.trim();
            const apiKey = process.env.TONAPI_KEY || '';
            try {
              const res = await nativeFetch(
                `https://tonapi.io/v2/accounts/${encodeURIComponent(cleaned)}`,
                { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} }
              );
              if (!res.ok) throw new Error(`TonAPI ${res.status}`);
              const data = await res.json() as any;
              return data.balance ? Number(data.balance) / 1e9 : 0;
            } catch (e: any) {
              throw new Error(`getTonBalance: ${e.message}`);
            }
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

          // ── searchNFTCollection(name) — найти NFT коллекцию по имени ──
          // Возвращает { address, name, floorTon, items } или null если не найдено
          searchNFTCollection: async (name: string): Promise<{ address: string; name: string; floorTon: number; items: number } | null> => {
            const nameLower = name.toLowerCase().trim();
            const slug = nameLower.replace(/[^a-z0-9]/g, '');

            // Метод 1: GetGems GraphQL (работает с правильными заголовками)
            try {
              const gqlBody = JSON.stringify({
                query: `{ alphaNftCollectionSearch(query: ${JSON.stringify(name.replace(/[^\w\s\-]/g, '').slice(0, 100))}, count: 3) { items { address name floorPrice approximateItemsCount } } }`
              });
              const resp = await nativeFetch('https://api.getgems.io/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Origin': 'https://getgems.io',
                  'Referer': 'https://getgems.io/',
                  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                body: gqlBody,
              });
              if (resp.ok) {
                const data = await resp.json() as any;
                const items = data?.data?.alphaNftCollectionSearch?.items || [];
                if (items.length > 0) {
                  const col = items[0];
                  return {
                    address: col.address,
                    name: col.name || name,
                    floorTon: col.floorPrice ? parseInt(col.floorPrice) / 1e9 : 0,
                    items: col.approximateItemsCount || 0,
                  };
                }
              }
            } catch {}

            // Метод 2: Fragment Telegram Gifts — для коллекций типа "Cupid Charm", "Lol Pop" и т.д.
            // Slug = имя без пробелов/спецсимволов в нижнем регистре
            // Адрес получаем через TonAPI поиск по raw_collection_content
            try {
              // Проверяем что Fragment знает эту коллекцию
              const fragResp = await nativeFetch(
                `https://nft.fragment.com/collection/${slug}.json`,
                { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
              );
              if (fragResp.ok) {
                const fragMeta = await fragResp.json() as any;
                if (fragMeta?.name) {
                  // Fragment знает коллекцию — ищем адрес через TonAPI
                  // raw_collection_content содержит URL метаданных в hex
                  // Ищем hex-encoded строку с slug
                  const slugHex = Buffer.from(slug).toString('hex');
                  for (let offset = 0; offset < 500; offset += 100) {
                    const resp = await nativeFetch(
                      `https://tonapi.io/v2/nfts/collections?limit=100&offset=${offset}`,
                      { headers: { 'Accept': 'application/json' } }
                    );
                    if (!resp.ok) break;
                    const data = await resp.json() as any;
                    const cols: any[] = data?.nft_collections || [];
                    if (cols.length === 0) break;
                    const found = cols.find((c: any) =>
                      (c?.raw_collection_content || '').includes(slugHex)
                    );
                    if (found) {
                      return {
                        address: found.address,
                        name: fragMeta.name || name,
                        floorTon: 0,
                        items: found.next_item_index || 0,
                      };
                    }
                  }
                }
              }
            } catch {}

            // Метод 3: TonAPI — поиск по имени в metadata
            try {
              for (let offset = 0; offset < 300; offset += 100) {
                const resp = await nativeFetch(
                  `https://tonapi.io/v2/nfts/collections?limit=100&offset=${offset}`,
                  { headers: { 'Accept': 'application/json' } }
                );
                if (!resp.ok) break;
                const data = await resp.json() as any;
                const cols: any[] = data?.nft_collections || [];
                if (cols.length === 0) break;
                const found = cols.find((c: any) => {
                  const colName = (c?.metadata?.name || '').toLowerCase();
                  return colName.includes(nameLower) || nameLower.includes(colName);
                });
                if (found) {
                  return {
                    address: found.address,
                    name: found?.metadata?.name || name,
                    floorTon: 0,
                    items: found.next_item_index || 0,
                  };
                }
              }
            } catch {}

            return null;
          },

          // ── getNFTFloorPrice(address) — floor price коллекции по адресу ──
          // Возвращает floor price в TON (0 если нет листингов)
          getNFTFloorPrice: async (address: string): Promise<number> => {
            try {
              // Конвертируем EQ/UQ адрес в raw формат (0:hex)
              let rawAddr = address;
              if (address && !address.startsWith('0:')) {
                try {
                  const s = address.replace(/-/g, '+').replace(/_/g, '/');
                  const padded = s + '=='.slice(0, (4 - s.length % 4) % 4);
                  const buf = Buffer.from(padded, 'base64');
                  rawAddr = '0:' + buf.slice(2, 34).toString('hex');
                } catch {}
              }

              // Метод 1: GetGems GraphQL — прямой запрос floor price по адресу (самый точный)
              try {
                const ggBody = JSON.stringify({
                  query: `{ nftCollectionByAddress(address: "${rawAddr}") { floorPrice approximateItemsCount } }`,
                });
                const ggResp = await nativeFetch('https://api.getgems.io/graphql', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': 'https://getgems.io',
                    'Referer': 'https://getgems.io/',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  },
                  body: ggBody,
                });
                if (ggResp.ok) {
                  const ggData = await ggResp.json() as any;
                  const fp = ggData?.data?.nftCollectionByAddress?.floorPrice;
                  if (fp && parseInt(fp) > 0) return parseInt(fp) / 1e9;
                }
              } catch {}

              // Метод 2: TonAPI — сканируем items в поиске активных продаж
              const tonapiKey = process.env.TONAPI_KEY || '';
              const tonapiHeaders: Record<string, string> = { 'Accept': 'application/json' };
              if (tonapiKey) tonapiHeaders['Authorization'] = `Bearer ${tonapiKey}`;
              const prices: number[] = [];
              for (let offset = 0; offset < 400; offset += 100) {
                const r = await nativeFetch(
                  `https://tonapi.io/v2/nfts/collections/${rawAddr}/items?limit=100&offset=${offset}`,
                  { headers: tonapiHeaders }
                );
                if (!r.ok) break;
                const d = await r.json() as any;
                const items: any[] = d.nft_items || [];
                if (items.length === 0) break;
                for (const item of items) {
                  const val = item?.sale?.price?.value;
                  if (val && parseInt(val) > 0) prices.push(parseInt(val) / 1e9);
                }
                // Нашли листинги в первых 100 — не нужно сканировать дальше
                if (prices.length >= 5) break;
              }
              prices.sort((a: number, b: number) => a - b);
              return prices.length > 0 ? prices[0] : 0;
            } catch {
              return 0;
            }
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

          // ── TON кошелёк через TonAPI (TonCenter заблокирован для серверных IP) ──
          // Использует TONAPI_KEY из env

          // tonCreateWallet() → { mnemonic: string, address: string }
          tonCreateWallet: async (): Promise<{ mnemonic: string; address: string }> => {
            const { mnemonicNew, mnemonicToWalletKey } = require('@ton/crypto');
            const { WalletContractV4 } = require('@ton/ton');
            const words   = await mnemonicNew(24);
            const keyPair = await mnemonicToWalletKey(words);
            const wallet  = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
            return {
              mnemonic: words.join(' '),
              address:  wallet.address.toString({ bounceable: false, urlSafe: true }),
            };
          },

          // tonGetWalletAddress(mnemonic) → UQ... адрес кошелька
          tonGetWalletAddress: async (mnemonic: string): Promise<string> => {
            const { mnemonicToWalletKey } = require('@ton/crypto');
            const { WalletContractV4 } = require('@ton/ton');
            const words   = String(mnemonic).trim().split(/\s+/);
            const keyPair = await mnemonicToWalletKey(words);
            const wallet  = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
            return wallet.address.toString({ bounceable: false, urlSafe: true });
          },

          // tonGetBalance(address) → баланс в TON (float) через TonAPI
          tonGetBalance: async (address: string): Promise<number> => {
            const apiKey = process.env.TONAPI_KEY || '';
            try {
              const resp = await nativeFetch(
                `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`,
                { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} }
              );
              const json = await resp.json() as any;
              return json.balance ? Number(json.balance) / 1e9 : 0;
            } catch { return 0; }
          },

          // tonSend({ mnemonic, to, amountNano, payloadBase64?, stateInitBase64? })
          // Подписывает и отправляет транзакцию через TonAPI
          tonSend: async (p: {
            mnemonic: string;
            to: string;
            amountNano: string;
            payloadBase64?: string | null;
            stateInitBase64?: string | null;
          }): Promise<string> => {
            const { mnemonicToWalletKey } = require('@ton/crypto');
            const { WalletContractV4 } = require('@ton/ton');
            const { internal, Cell, Address } = require('@ton/core');
            const apiKey = process.env.TONAPI_KEY || '';
            const apiHeaders = (extra: Record<string,string> = {}) => ({
              'Content-Type': 'application/json',
              ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
              ...extra,
            });

            const words   = String(p.mnemonic).trim().split(/\s+/);
            const keyPair = await mnemonicToWalletKey(words);
            const wallet  = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
            const addr    = wallet.address.toString({ bounceable: false, urlSafe: true });

            // seqno через TonAPI GET /v2/wallet/{address}
            const walletResp = await nativeFetch(
              `https://tonapi.io/v2/wallet/${encodeURIComponent(addr)}`,
              { headers: apiHeaders() }
            );
            const walletJson = await walletResp.json() as any;
            const seqno = walletJson.seqno ?? 0;

            // Собираем и подписываем transfer
            const transfer = wallet.createTransfer({
              seqno,
              secretKey: keyPair.secretKey,
              messages: [internal({
                to:    Address.parse(String(p.to)),
                value: BigInt(String(p.amountNano)),
                body:  p.payloadBase64  ? Cell.fromBase64(String(p.payloadBase64))  : undefined,
                init:  p.stateInitBase64 ? Cell.fromBase64(String(p.stateInitBase64)) : undefined,
              })],
            });

            // Отправляем BOC через TonAPI POST /v2/blockchain/message
            const bocBase64 = transfer.toBoc().toString('base64');
            const sendResp = await nativeFetch('https://tonapi.io/v2/blockchain/message', {
              method:  'POST',
              headers: apiHeaders(),
              body:    JSON.stringify({ boc: bocBase64 }),
            });
            if (!sendResp.ok) {
              const errText = await sendResp.text();
              throw new Error('TonAPI sendBoc ' + sendResp.status + ': ' + errText.slice(0, 200));
            }

            return `tx_${Date.now()}_${String(p.to).slice(0, 8)}`;
          },

          // ── Telegram Gifts helpers (для агентов арбитража подарков) ──
          // Все функции — тонкие обёртки вокруг TelegramGiftsService
          getAvailableGifts: async () => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().getAvailableGifts();
          },
          buyTelegramGift: async (giftId: string, recipientUserId: number, text?: string) => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().buyGiftBot(String(giftId), Number(recipientUserId), text);
          },
          getFragmentListings: async (giftSlug: string, limit?: number) => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().getFragmentListings(String(giftSlug), limit ?? 20);
          },
          listGiftForSale: async (msgId: number, priceStars: number) => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().listGiftForSale(Number(msgId), Number(priceStars));
          },
          appraiseGift: async (slug: string) => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().appraiseGift(String(slug));
          },
          scanArbitrageOpportunities: async (opts?: any) => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().scanArbitrageOpportunities(opts || {});
          },
          getStarsBalance: async () => {
            const { getTelegramGiftsService } = await import('../../services/telegram-gifts');
            return getTelegramGiftsService().getStarsBalance();
          },

          // ── GiftAsset / SwiftGifts — реальные рыночные данные ──
          getGiftFloorReal: async (slug: string) => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            return getGiftAssetClient().getFloorPrices(slug);
          },
          getGiftSalesHistory: async (collectionName: string, limit?: number, modelName?: string) => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            return getGiftAssetClient().getUniqueSales(collectionName, limit ?? 20, modelName);
          },
          getMarketOverview: async () => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            const ga = getGiftAssetClient();
            const [lastSales, upgradeStats] = await Promise.all([
              ga.getAllCollectionsLastSale(),
              ga.getUpgradeStats(),
            ]);
            return { lastSales, upgradeStats };
          },
          getPriceList: async (models?: string) => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            return getGiftAssetClient().getPriceList({ models });
          },
          scanRealArbitrage: async (opts?: any) => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            return getGiftAssetClient().findArbitrageOpportunities(opts || {});
          },
          getGiftAggregator: async (name: string, opts?: any) => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            return getGiftAssetClient().swAggregate({ name, ...opts });
          },
          getUserPortfolio: async (username?: string, telegramId?: string) => {
            const { getGiftAssetClient } = await import('../../services/giftasset');
            return getGiftAssetClient().getUserGifts({ username, telegramId });
          },

          // ── Plugins ──
          listPlugins: async () => {
            const { getPluginManager } = await import('../../plugins-system');
            const pm = getPluginManager();
            return pm.getAllPlugins().map(p => ({
              id: p.id, name: p.name, type: p.type,
              description: p.description, isInstalled: p.isInstalled,
            }));
          },
          suggestPlugin: async (taskDescription: string) => {
            const { getPluginManager } = await import('../../plugins-system');
            const pm = getPluginManager();
            const all = pm.getAllPlugins();
            const task = (taskDescription || '').toLowerCase();
            return all.filter(p => {
              const txt = `${p.name} ${p.description} ${p.id} ${p.type}`.toLowerCase();
              return task.split(/\s+/).some(kw => kw.length >= 3 && txt.includes(kw));
            }).slice(0, 3).map(p => ({ id: p.id, name: p.name, description: p.description, isInstalled: p.isInstalled }));
          },

          // ── Web tools ──
          webSearch: async (query: string) => {
            const encoded = encodeURIComponent(query || '');
            const results: any[] = [];
            // DuckDuckGo HTML search
            try {
              const htmlResp = await nativeFetch('https://html.duckduckgo.com/html/?q=' + encoded, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TONAgentBot/1.0)' },
                signal: AbortSignal.timeout(10000),
              });
              if (htmlResp.ok) {
                const html = await htmlResp.text();
                const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
                const snipRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
                const links: Array<{ url: string; title: string }> = [];
                let m;
                while ((m = linkRe.exec(html)) && links.length < 5) {
                  let url = m[1];
                  const uddg = url.match(/uddg=([^&]+)/);
                  if (uddg) url = decodeURIComponent(uddg[1]);
                  links.push({ url, title: m[2].replace(/<[^>]+>/g, '').trim() });
                }
                const snips: string[] = [];
                while ((m = snipRe.exec(html)) && snips.length < 5) {
                  snips.push(m[1].replace(/<[^>]+>/g, '').trim());
                }
                for (let i = 0; i < links.length; i++) {
                  results.push({ title: links[i].title, url: links[i].url, snippet: snips[i] || '' });
                }
              }
            } catch {}
            // Fallback: Instant Answer API
            if (results.length === 0) {
              try {
                const resp = await nativeFetch('https://api.duckduckgo.com/?q=' + encoded + '&format=json&no_html=1');
                if (resp.ok) {
                  const data = await resp.json() as any;
                  if (data.AbstractText) results.push({ title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL || '' });
                  if (data.RelatedTopics) {
                    for (const topic of data.RelatedTopics.slice(0, 5)) {
                      if (topic.Text && topic.FirstURL) results.push({ title: topic.Text.slice(0, 100), snippet: topic.Text, url: topic.FirstURL });
                    }
                  }
                }
              } catch {}
            }
            return results.slice(0, 5);
          },
          fetchUrl: async (url: string) => {
            // SSRF protection
            try {
              const u = new URL(url);
              const h = u.hostname.toLowerCase();
              if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1'
                || h === '[::1]' || h.startsWith('10.') || h.startsWith('192.168.')
                || h.startsWith('172.16.') || h.startsWith('172.17.') || h.startsWith('172.18.')
                || h.startsWith('172.19.') || h.startsWith('172.2') || h.startsWith('172.3')
                || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')
                || h === '169.254.169.254' || h === 'metadata.google.internal'
                || h.endsWith('.internal') || h.endsWith('.local') || h.endsWith('.localhost')
                || u.port === '22' || u.port === '23' || u.port === '3389' || u.port === '5432'
                || u.port === '6379' || u.port === '27017' || u.port === '3306'
                || u.protocol === 'file:' || u.protocol === 'ftp:') {
                return { error: 'Access to internal addresses is blocked' };
              }
            } catch { return { error: 'Invalid URL' }; }
            const resp = await nativeFetch(url, { headers: { 'User-Agent': 'TONAgentBot/1.0' }, signal: AbortSignal.timeout(10000) });
            if (!resp.ok) return { error: 'Fetch failed: ' + resp.status };
            const ct = resp.headers.get('content-type') || '';
            if (ct.includes('json')) {
              const j = await resp.json() as any;
              return JSON.stringify(j).slice(0, 5000);
            }
            const text = await resp.text();
            return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
          },
          notifyRich: async (message: string, buttons?: Array<{ text: string; url?: string }>) => {
            const { notifyRich } = await import('../../notifier');
            await notifyRich(params.userId, { text: message, agentId, buttons });
            return { ok: true };
          },

          // ── Inter-agent ──
          askAgent: async (targetAgentId: number, message: string) => {
            const { addMessageToAIAgent } = await import('../ai-agent-runtime');
            addMessageToAIAgent(targetAgentId, `[Interagent от #${agentId}]: ${message}`);
            return { sent: true, targetAgentId };
          },
          listMyAgents: async () => {
            const { getDBTools } = await import('./db-tools');
            const result = await getDBTools().getUserAgents(params.userId);
            return (result.data || []).map((a: any) => ({ id: a.id, name: a.name, isActive: a.isActive, triggerType: a.triggerType }));
          },

          // ── Telegram Userbot (доступен если платформа авторизована через /tglogin) ──
          // Позволяет агенту действовать как полноценный Telegram-пользователь:
          //   telegram.sendMessage(chatId, text)
          //   telegram.getMessages(chatId, limit)
          //   telegram.joinChannel(username)
          //   telegram.getDialogs(limit)  и т.д.
          telegram: await (async () => {
            try {
              const auth = await isAuthorized();
              if (auth) return buildUserbotSandbox();
            } catch {}
            // Not authenticated — return stub that throws helpful error
            const notAuthed = (method: string) => async (..._args: any[]) => {
              throw new Error(`telegram.${method}: не авторизован. Используй /tglogin в боте.`);
            };
            return {
              sendMessage:    notAuthed('sendMessage'),
              getMessages:    notAuthed('getMessages'),
              getChannelInfo: notAuthed('getChannelInfo'),
              joinChannel:    notAuthed('joinChannel'),
              leaveChannel:   notAuthed('leaveChannel'),
              getDialogs:     notAuthed('getDialogs'),
              getMembers:     notAuthed('getMembers'),
              forwardMessage: notAuthed('forwardMessage'),
              deleteMessage:  notAuthed('deleteMessage'),
              searchMessages: notAuthed('searchMessages'),
              getUserInfo:    notAuthed('getUserInfo'),
              sendFile:       notAuthed('sendFile'),
            };
          })(),

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
