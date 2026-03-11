/**
 * Orchestrator — Главный мозг платформы TON Agent Platform
 *
 * - Agentic Loop: think → call_tool → observe → repeat (до MAX_ITERATIONS итераций)
 * - Native Tool Calling через OpenAI function calling API
 * - Observation Masking: сжимаем старые результаты инструментов для экономии контекста
 * - Tool RAG: выбираем только релевантные инструменты для каждого запроса
 * - Multi-step reasoning: AI планирует перед действием
 * - Self-reflection: валидация результата перед ответом пользователю
 */

import OpenAI from 'openai';
import { getMemoryManager } from '../db/memory';
import { getUserSubscription, PLANS, getGenerationsUsed } from '../payments';
import { PLATFORM_TOOLS, PlatformToolExecutor, type ToolCall } from './tools/platform-tools';
import { getRunnerAgent } from './sub-agents/runner';
import { getWorkflowEngine } from '../agent-cooperation';
import { getDBTools } from './tools/db-tools';

// ── MarkdownV2 escaping ────────────────────────────────────────────────────
function esc(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\').replace(/_/g, '\\_').replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)').replace(/~/g, '\\~').replace(/`/g, '\\`')
    .replace(/>/g, '\\>').replace(/#/g, '\\#').replace(/\+/g, '\\+')
    .replace(/-/g, '\\-').replace(/=/g, '\\=').replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

// ── Platform AI ──────────────────────────────────────────────
const PLATFORM_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const PLATFORM_BASE_URL = process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
const openai = new OpenAI({ apiKey: PLATFORM_API_KEY, baseURL: PLATFORM_BASE_URL });

// ── Список моделей с fallback-цепочкой ────────────────────────────────────
export const MODEL_LIST = [
  { id: 'claude-opus-4-6',              label: 'Claude Opus 4.6',         icon: '🟣', recommended: true },
  { id: 'kiro-claude-opus-4-6-agentic', label: 'Claude Opus 4.6 Agentic', icon: '⚡' },
  { id: 'gemini-3.1-pro-high',          label: 'Gemini 3.1 Pro High',     icon: '🔷' },
  { id: 'claude-sonnet-4-5',            label: 'Claude Sonnet 4.5',       icon: '🔵' },
  { id: 'kiro-claude-sonnet-4-5',       label: 'Claude Sonnet 4.5 Kiro',  icon: '🔵' },
  { id: 'claude-haiku-4-5',             label: 'Claude Haiku 4.5',        icon: '🟢', fast: true },
] as const;
export type ModelId = typeof MODEL_LIST[number]['id'];

const DEFAULT_MODEL: ModelId = (process.env.CLAUDE_MODEL as ModelId) || 'claude-opus-4-6';

// Per-user выбранная модель
const userModels = new Map<number, ModelId>();

export function getUserModel(userId: number): ModelId {
  return userModels.get(userId) || DEFAULT_MODEL;
}
export function setUserModel(userId: number, model: ModelId) {
  userModels.set(userId, model);
}

// ── Agentic Loop константы ─────────────────────────────────────────────────
const MAX_ITERATIONS = 5;
const OWNER_ID = 130806013;

// ── Типы ──────────────────────────────────────────────────────────────────

export interface OrchestratorResult {
  type: 'text' | 'buttons' | 'confirm' | 'agent_created';
  content: string;
  buttons?: Array<{ text: string; callbackData: string }>;
  confirmData?: { action: string; data: any };
  agentId?: number;
}

interface AgentLoopMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

// ── Observation Masking ────────────────────────────────────────────────────
// Сжимаем старые результаты инструментов чтобы сэкономить контекст (~90% экономии)
function maskOldObservations(messages: AgentLoopMessage[], keepLast = 2): AgentLoopMessage[] {
  const toolMessages = messages.filter(m => m.role === 'tool');
  if (toolMessages.length <= keepLast) return messages;

  const toMask = toolMessages.slice(0, toolMessages.length - keepLast);
  const maskedIds = new Set(toMask.map(m => m.tool_call_id));

  return messages.map(m => {
    if (m.role === 'tool' && m.tool_call_id && maskedIds.has(m.tool_call_id)) {
      // Оставляем только краткое резюме
      const content = m.content || '';
      const summary = content.length > 200 ? content.slice(0, 200) + '...[masked]' : content;
      return { ...m, content: summary };
    }
    return m;
  });
}

// ── Tool RAG: выбираем релевантные инструменты ─────────────────────────────
// Вместо отправки всех 17 инструментов — выбираем только нужные для данного запроса
function selectRelevantTools(message: string, allTools = PLATFORM_TOOLS) {
  const msg = message.toLowerCase();

  // Всегда включаем базовые инструменты
  const alwaysInclude = new Set(['list_agents', 'get_platform_stats']);

  // Семантический выбор по ключевым словам
  const toolRelevance: Record<string, string[]> = {
    'create_agent':      ['создай', 'создать', 'сделай', 'make', 'create', 'build', 'агент для', 'мониторь', 'отслеживай', 'уведомляй', 'проверяй', 'каждый', 'автоматически'],
    'run_agent':         ['запусти', 'запустить', 'run', 'execute', 'старт', 'start', 'активируй'],
    'stop_agent':        ['останови', 'стоп', 'stop', 'pause', 'деактивируй'],
    'edit_agent':        ['измени', 'изменить', 'edit', 'update', 'поменяй', 'обнови', 'исправь'],
    'delete_agent':      ['удали', 'удалить', 'delete', 'remove'],
    'get_agent_details': ['покажи агента', 'детали', 'инфо', 'информация', 'код агента', 'show agent'],
    'get_agent_logs':    ['логи', 'logs', 'история', 'что делал', 'результат'],
    'explain_agent':     ['объясни', 'explain', 'расскажи', 'как работает', 'что делает'],
    'debug_agent':       ['debug', 'ошибка', 'баг', 'bug', 'почини', 'найди проблему'],
    'get_ton_price':     ['цена ton', 'курс ton', 'ton price', 'стоимость ton', 'сколько стоит ton'],
    'get_ton_balance':   ['баланс', 'balance', 'кошелёк', 'wallet', 'eq', 'uq'],
    'get_nft_collection':['nft', 'нфт', 'floor', 'флор', 'коллекция', 'getgems', 'punks', 'diamonds', 'whales'],
    'dex_quote':         ['обмен', 'swap', 'dex', 'ston', 'dedust', 'купить', 'продать', 'курс обмена'],
    'web_search':        ['найди', 'поищи', 'search', 'новости', 'что такое', 'расскажи про'],
    'list_templates':    ['шаблон', 'template', 'готовый', 'пример'],
  };

  const selected = new Set<string>(alwaysInclude);

  for (const [toolName, keywords] of Object.entries(toolRelevance)) {
    if (keywords.some(kw => msg.includes(kw))) {
      selected.add(toolName);
    }
  }

  // Если ничего не выбрано кроме базовых — добавляем create_agent и get_ton_price как дефолт
  if (selected.size <= 2) {
    selected.add('create_agent');
    selected.add('get_ton_price');
    selected.add('get_ton_balance');
    selected.add('get_nft_collection');
    selected.add('web_search');
  }

  return allTools.filter(t => selected.has(t.name));
}

// ── Запрос с fallback по цепочке моделей ──────────────────────────────────
async function callWithFallback(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  userId: number,
  maxTokens = 1024,
): Promise<{ text: string; model: string }> {
  const preferred = getUserModel(userId);
  const chain = [preferred, ...MODEL_LIST.map(m => m.id).filter(id => id !== preferred)];

  for (const model of chain) {
    try {
      const response = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages,
        temperature: 0.7,
      });
      const text = response.choices[0]?.message?.content || '';
      if (!text) throw new Error('Empty response');
      return { text, model };
    } catch (err: any) {
      const msg: string = err?.message || err?.error?.message || String(err);
      const isRetryable =
        msg.includes('cooldown') || msg.includes('INSUFFICIENT') ||
        msg.includes('high traffic') || msg.includes('exhausted') ||
        msg.includes('timed out') || msg.includes('timeout') ||
        msg.includes('503') || msg.includes('502') ||
        msg.includes('ECONNRESET') || msg.includes('Empty response');
      console.warn(`[Orchestrator] model ${model} failed (${msg.slice(0, 80)}), trying next...`);
      if (!isRetryable) throw err;
    }
  }
  throw new Error('Все модели недоступны. Попробуйте через несколько секунд.');
}

// ── Запрос с tool calling (agentic loop) ──────────────────────────────────
async function callWithTools(
  messages: AgentLoopMessage[],
  tools: any[],
  userId: number,
  maxTokens = 2048,
): Promise<{
  message: any;
  model: string;
  finishReason: string;
}> {
  const preferred = getUserModel(userId);
  const chain = [preferred, ...MODEL_LIST.map(m => m.id).filter(id => id !== preferred)];

  for (const model of chain) {
    try {
      const response = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: messages as any,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.3, // Ниже температура для более детерминированного tool calling
      });

      const choice = response.choices[0];
      return {
        message: choice.message,
        model,
        finishReason: choice.finish_reason || 'stop',
      };
    } catch (err: any) {
      const msg: string = err?.message || err?.error?.message || String(err);
      const isRetryable =
        msg.includes('cooldown') || msg.includes('INSUFFICIENT') ||
        msg.includes('high traffic') || msg.includes('exhausted') ||
        msg.includes('timed out') || msg.includes('timeout') ||
        msg.includes('503') || msg.includes('502') ||
        msg.includes('ECONNRESET') || msg.includes('Empty response');
      console.warn(`[Orchestrator] tool-call model ${model} failed (${msg.slice(0, 80)}), trying next...`);
      if (!isRetryable) throw err;
    }
  }
  throw new Error('Все модели недоступны для tool calling.');
}

// ── Системный промпт оркестратора ──────────────────────────────────────────
function buildSystemPrompt(userId: number, isOwner: boolean, userContext: {
  agentCount: number;
  activeAgents: number;
  planName: string;
  planIcon: string;
  genUsed: number;
  genLimit: string;
}): string {
  return `Ты — умный AI-оркестратор платформы TON Agent Platform. Ты управляешь автономными агентами которые работают 24/7 на сервере.

━━━ ТВОЯ РОЛЬ ━━━
Ты — не просто чат-бот. Ты — настоящий оркестратор с инструментами. Ты ДУМАЕШЬ, ДЕЙСТВУЕШЬ и НАБЛЮДАЕШЬ.
Когда пользователь что-то просит — ты используешь инструменты чтобы это сделать, а не просто отвечаешь текстом.

━━━ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ━━━
ID: ${userId}${isOwner ? ' (ВЛАДЕЛЕЦ ПЛАТФОРМЫ)' : ''}
Подписка: ${userContext.planIcon} ${userContext.planName}
Агентов: ${userContext.agentCount} (активных: ${userContext.activeAgents})
Генераций AI: ${userContext.genUsed} / ${userContext.genLimit}

━━━ ПРИНЦИПЫ РАБОТЫ ━━━
1. ВСЕГДА используй инструменты для реальных действий (создание, запуск, редактирование агентов)
2. Перед созданием агента — убедись что понял задачу. Если неясно — уточни ОДИН вопрос.
3. После создания агента — предложи его запустить
4. Если агент scheduled — предложи запустить сразу (он будет работать 24/7)
5. При ошибках — объясни что пошло не так и предложи решение

━━━ ЧТО УМЕЮТ АГЕНТЫ ━━━
• Мониторинг: цены TON, балансы кошельков, NFT floor prices, курсы обмена
• Уведомления: в Telegram когда что-то изменилось
• Расписание: каждую минуту / час / день / неделю
• Блокчейн: проверка транзакций, балансов, NFT
• Любые публичные API через fetch()

━━━ СТИЛЬ ОТВЕТОВ ━━━
• Кратко и по делу (2-4 абзаца максимум)
• Markdown: **жирный**, _курсив_, \`код\`
• Эмодзи уместно
• Отвечай на языке пользователя (русский/английский)
• После выполнения действия — кратко сообщи результат и предложи следующий шаг

━━━ ВАЖНО ━━━
• Никогда не выдумывай данные — используй инструменты для получения реальных данных
• Если инструмент вернул ошибку — сообщи об этом честно
• Для удаления агента — ВСЕГДА спрашивай подтверждение
${isOwner ? '\n━━━ РЕЖИМ ВЛАДЕЛЬЦА ━━━\nТы общаешься с владельцем платформы. Можешь давать технические детали и статистику.' : ''}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Orchestrator — главный класс
// ═══════════════════════════════════════════════════════════════════════════

export class Orchestrator {
  private get dbTools() { return getDBTools(); }

  // ── Главный метод: обработка сообщения через agentic loop ─────────────
  async processMessage(
    userId: number,
    message: string,
    username?: string,
    agentName?: string,
  ): Promise<OrchestratorResult> {
    const isOwner = userId === OWNER_ID;

    // Проверяем ожидаемый ввод (legacy waiting context)
    const waitingContext = await getMemoryManager().getWaitingContext(userId);
    if (waitingContext) {
      return this.handleWaitingInput(userId, message, waitingContext);
    }

    // Сохраняем сообщение пользователя
    await getMemoryManager().addMessage(userId, 'user', message);

    // Получаем контекст пользователя
    const userContext = await this.getUserContext(userId);

    // Запускаем agentic loop
    return this.agenticLoop(userId, message, isOwner, userContext, agentName);
  }

  // ── Agentic Loop: think → call_tool → observe → repeat ────────────────
  private async agenticLoop(
    userId: number,
    userMessage: string,
    isOwner: boolean,
    userContext: any,
    agentName?: string,
  ): Promise<OrchestratorResult> {
    const executor = new PlatformToolExecutor(userId);

    // Получаем историю разговора
    const history = await getMemoryManager().getLLMHistory(userId, 8);

    // Системный промпт
    const systemPrompt = buildSystemPrompt(userId, isOwner, userContext);

    // Выбираем релевантные инструменты (Tool RAG)
    const relevantTools = selectRelevantTools(userMessage);
    const toolDefinitions = relevantTools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // Строим начальные сообщения
    const messages: AgentLoopMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Добавляем историю
    for (const h of history) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content });
      }
    }

    // Добавляем текущее сообщение
    messages.push({ role: 'user', content: userMessage });

    // Результаты для формирования финального ответа
    let finalContent = '';
    let finalButtons: Array<{ text: string; callbackData: string }> = [];
    let finalAgentId: number | undefined;
    let finalType: OrchestratorResult['type'] = 'text';
    let lastCreatedAgentId: number | undefined;

    // ── Agentic Loop ──────────────────────────────────────────────────────
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[Orchestrator] Loop iteration ${iteration + 1}/${MAX_ITERATIONS}`);

      // Применяем observation masking для старых результатов
      const maskedMessages = maskOldObservations(messages, 2);

      let response: { message: any; model: string; finishReason: string };
      try {
        response = await callWithTools(maskedMessages, toolDefinitions, userId);
      } catch (err: any) {
        console.error('[Orchestrator] callWithTools error:', err?.message);
        const hint = this.getAIErrorHint(err);
        return {
          type: 'text',
          content: `⚠️ AI временно недоступен.\n${hint}\n\nЧем могу помочь?\n• 🤖 Мои агенты\n• ➕ Создать агента`,
        };
      }

      const assistantMessage = response.message;

      // Добавляем ответ ассистента в историю
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: assistantMessage.tool_calls,
      });

      // Если нет tool calls — это финальный ответ
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        finalContent = assistantMessage.content || '';
        break;
      }

      // ── Выполняем tool calls ──────────────────────────────────────────
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs: any = {};

        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = {};
        }

        console.log(`[Orchestrator] Calling tool: ${toolName}`, JSON.stringify(toolArgs).slice(0, 100));

        const toolResult = await executor.execute({ name: toolName, arguments: toolArgs });

        // Обрабатываем специальные результаты
        if (toolName === 'create_agent' && toolResult.success && toolResult.data?.agentId) {
          lastCreatedAgentId = toolResult.data.agentId;
          finalType = 'agent_created';
          finalAgentId = toolResult.data.agentId;

          // Авто-запуск для scheduled агентов без плейсхолдеров
          if (toolResult.data.autoStart && !toolResult.data.placeholders?.length) {
            try {
              const runResult = await getRunnerAgent().runAgent({
                agentId: toolResult.data.agentId,
                userId,
              });
              if (runResult.success && runResult.data?.isScheduled) {
                toolResult.data.autoStarted = true;
                toolResult.data.intervalMs = runResult.data.intervalMs;
              }
            } catch {}
          }
        }

        if (toolName === 'delete_agent' && toolResult.success) {
          // Запрашиваем подтверждение если не подтверждено
          if (!toolArgs.confirmed) {
            const agentResult = await this.dbTools.getAgent(toolArgs.agent_id, userId);
            const agentName2 = agentResult.data?.name || `#${toolArgs.agent_id}`;
            return {
              type: 'confirm',
              content: `⚠️ Вы уверены, что хотите удалить агента "${agentName2}" (ID: ${toolArgs.agent_id})?\n\nЭто действие нельзя отменить!`,
              confirmData: { action: 'delete_agent', data: { agentId: toolArgs.agent_id, userId } },
              buttons: [
                { text: '✅ Да, удалить', callbackData: `confirm_delete:${toolArgs.agent_id}` },
                { text: '❌ Отмена', callbackData: 'cancel_delete' },
              ],
            };
          }
        }

        // Добавляем результат инструмента в историю
        const resultContent = toolResult.success
          ? JSON.stringify(toolResult.data || { ok: true })
          : `ERROR: ${toolResult.error}`;

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: resultContent,
        });
      }

      // Если это последняя итерация — принудительно завершаем
      if (iteration === MAX_ITERATIONS - 1) {
        console.warn('[Orchestrator] Max iterations reached, forcing final response');
        // Запрашиваем финальный ответ без инструментов
        try {
          const finalResponse = await callWithTools(
            [...messages, {
              role: 'user',
              content: 'Подведи итог выполненных действий кратко.',
            }],
            [], // Без инструментов — только текстовый ответ
            userId,
            512,
          );
          finalContent = finalResponse.message.content || 'Действия выполнены.';
        } catch {
          finalContent = 'Действия выполнены.';
        }
      }
    }

    // ── Формируем финальный ответ ─────────────────────────────────────────
    if (!finalContent) {
      finalContent = 'Готово!';
    }

    // Сохраняем ответ в историю
    await getMemoryManager().addMessage(userId, 'assistant', finalContent);

    // Формируем кнопки на основе контекста
    if (lastCreatedAgentId) {
      const agentResult = await this.dbTools.getAgent(lastCreatedAgentId, userId);
      const agent = agentResult.data;

      if (agent) {
        const isScheduled = agent.triggerType === 'scheduled';
        const isActive = agent.isActive;

        if (isActive && isScheduled) {
          finalButtons = [
            { text: '📋 Логи', callbackData: `show_logs:${lastCreatedAgentId}` },
            { text: '⏸ Остановить', callbackData: `run_agent:${lastCreatedAgentId}` },
            { text: '📋 Мои агенты', callbackData: 'list_agents' },
          ];
        } else {
          finalButtons = [
            { text: '🚀 Запустить', callbackData: `run_agent:${lastCreatedAgentId}` },
            { text: '⚙️ Настроить', callbackData: `agent_menu:${lastCreatedAgentId}` },
            { text: '👁 Код', callbackData: `show_code:${lastCreatedAgentId}` },
          ];
        }
      }
    }

    return {
      type: finalType,
      content: finalContent,
      buttons: finalButtons.length > 0 ? finalButtons : undefined,
      agentId: finalAgentId,
    };
  }

  // ── Обработка callback запросов (кнопки) ──────────────────────────────
  async processCallback(
    userId: number,
    callbackData: string,
  ): Promise<OrchestratorResult> {
    const [action, ...params] = callbackData.split(':');

    switch (action) {
      case 'confirm_delete': {
        const agentId = parseInt(params[0]);
        const result = await this.dbTools.deleteAgent(agentId, userId);
        return {
          type: 'text',
          content: result.success ? `✅ Агент удалён` : `❌ Ошибка: ${result.error}`,
        };
      }

      case 'cancel_delete':
        return { type: 'text', content: 'Удаление отменено' };

      case 'run_agent': {
        const agentId = parseInt(params[0]);
        const result = await getRunnerAgent().runAgent({ agentId, userId });
        if (result.success && result.data?.executionResult) {
          const exec = result.data.executionResult;
          let content = `📊 **Результат выполнения**\n\n`;
          content += `Статус: ${exec.success ? '✅ Успешно' : '❌ Ошибка'}\n`;
          content += `Время: ${exec.executionTime}ms\n\n`;
          if (exec.logs.length > 0) {
            content += '**Логи:**\n';
            exec.logs.slice(-10).forEach(log => {
              const emoji = log.level === 'error' ? '🔴' : log.level === 'warn' ? '🟡' : log.level === 'success' ? '🟢' : '⚪';
              content += `${emoji} ${log.message}\n`;
            });
          }
          if (exec.result) {
            content += `\n**Результат:**\n\`\`\`json\n${JSON.stringify(exec.result, null, 2).slice(0, 500)}\n\`\`\``;
          }
          return { type: 'text', content };
        }
        return {
          type: 'text',
          content: result.success
            ? (result.data?.isScheduled
              ? `🟢 Агент запущен в постоянном режиме (каждые ${this.formatMs(result.data.intervalMs || 0)})`
              : result.data?.message ?? '')
            : `❌ ${result.error}`,
        };
      }

      case 'toggle_agent': {
        const agentId = parseInt(params[0]);
        const result = await getRunnerAgent().toggleAgent(agentId, userId);
        return {
          type: 'text',
          content: result.success ? (result.data?.message ?? '') : `❌ ${result.error}`,
        };
      }

      case 'show_logs': {
        const agentId = parseInt(params[0]);
        const logsResult = await getRunnerAgent().getLogs(agentId, userId, 15);
        if (logsResult.success && logsResult.data) {
          let content = `📋 **Логи агента #${agentId}**\n\n`;
          logsResult.data.logs.forEach(log => {
            const emoji = log.level === 'error' ? '🔴' : log.level === 'warn' ? '🟡' : log.level === 'success' ? '🟢' : '⚪';
            const time = new Date(log.timestamp).toLocaleTimeString();
            content += `[${time}] ${emoji} ${log.message}\n`;
          });
          return { type: 'text', content };
        }
        return { type: 'text', content: 'Логи не найдены' };
      }

      case 'audit_agent': {
        const agentId = parseInt(params[0]);
        // Используем agentic loop для аудита
        return this.processMessage(userId, `Проведи аудит безопасности агента #${agentId}`);
      }

      case 'list_agents':
        return this.processMessage(userId, 'Покажи мои агенты');

      case 'create_agent_prompt':
        return {
          type: 'text',
          content: '➕ Опишите что должен делать агент:\n\n_Например: "Проверяй баланс кошелька EQ... каждый час и уведоми если меньше 5 TON"_',
        };

      case 'run_workflow': {
        const workflowId = params[0];
        const result = await getWorkflowEngine().executeWorkflow(workflowId, userId);
        return {
          type: 'text',
          content: result.success
            ? `✅ Workflow выполнен за ${result.totalExecutionTime}ms`
            : `❌ Ошибка workflow: ${result.error}`,
        };
      }

      case 'workflows_menu':
        return this.processMessage(userId, 'Покажи мои workflow');

      case 'plans_menu':
        return {
          type: 'text',
          content: '💳 **Тарифные планы:**\n\n🆓 **Free**: 3 агента, 1 активный\n⚡ **Starter** (5 TON/мес): 15 агентов, 30 генераций\n🚀 **Pro** (15 TON/мес): 100 агентов, 150 генераций\n💎 **Unlimited** (30 TON/мес): всё безлимитно\n\nИспользуйте /sub для подписки',
        };

      default:
        return { type: 'text', content: 'Неизвестное действие' };
    }
  }

  // ── Обработка ожидаемого ввода (legacy) ───────────────────────────────
  private async handleWaitingInput(
    userId: number,
    message: string,
    waitingContext: { waitingFor: string; context: any },
  ): Promise<OrchestratorResult> {
    await getMemoryManager().clearWaiting(userId);

    switch (waitingContext.waitingFor) {
      case 'agent_clarification': {
        // Повторно создаём с уточнением через agentic loop
        const fullDescription = `${waitingContext.context.description}\n\nУточнение: ${message}`;
        return this.processMessage(userId, `Создай агента: ${fullDescription}`);
      }

      case 'workflow_describe': {
        const agentsResult = await this.dbTools.getUserAgents(userId);
        const agents = (agentsResult.data || []).map(a => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
        }));

        const workflowResult = await getWorkflowEngine().createFromDescription(userId, message, agents);

        if (!workflowResult.success && !workflowResult.plan) {
          return { type: 'text', content: `❌ Не удалось создать workflow: ${workflowResult.error}` };
        }

        let content = `⚡ *AI Workflow Plan*\n\n${workflowResult.plan}\n`;
        if (workflowResult.workflowId) {
          content += `\n✅ Workflow создан\\! ID: \`${workflowResult.workflowId}\``;
        }
        if (workflowResult.suggestedAgents?.length) {
          content += `\n\n📝 *Нужны агенты:*\n`;
          workflowResult.suggestedAgents.forEach((a, i) => {
            content += `${i + 1}\\. ${a}\n`;
          });
        }

        return {
          type: 'text',
          content,
          buttons: workflowResult.workflowId ? [
            { text: '▶️ Запустить workflow', callbackData: `run_workflow:${workflowResult.workflowId}` },
            { text: '⚡ Все workflow', callbackData: 'workflows_menu' },
          ] : [
            { text: '➕ Создать агента', callbackData: 'create_agent_prompt' },
          ],
        };
      }

      default:
        return { type: 'text', content: 'Понял! Чем ещё могу помочь?' };
    }
  }

  // ── Вспомогательные методы ─────────────────────────────────────────────

  private async getUserContext(userId: number) {
    const userAgents = await this.dbTools.getUserAgents(userId);
    const agentCount = userAgents.data?.length ?? 0;
    const activeAgents = userAgents.data?.filter(a => a.isActive).length ?? 0;
    const sub = await getUserSubscription(userId);
    const plan = PLANS[sub.planId] || PLANS.free;
    const genUsed = getGenerationsUsed(userId);
    const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);

    return { agentCount, activeAgents, planName: plan.name, planIcon: plan.icon, genUsed, genLimit };
  }

  private formatMs(ms: number): string {
    if (ms >= 3_600_000) return `${ms / 3_600_000} ч`;
    if (ms >= 60_000) return `${ms / 60_000} мин`;
    return `${ms / 1000} сек`;
  }

  private getAIErrorHint(err: any): string {
    const msg: string = err?.message || err?.error?.message || '';
    if (msg.includes('cooldown')) {
      const sec = msg.match(/(\d+(?:\.\d+)?)s/)?.[1];
      return sec ? `⏳ Сервер на cooldown, повторите через ~${Math.ceil(parseFloat(sec))} сек.` : '⏳ Сервер перегружен, подождите немного.';
    }
    if (msg.includes('INSUFFICIENT_MODEL_CAPACITY')) return '🔄 Высокая нагрузка на модель, попробуйте через 30 секунд.';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) return '🔌 AI сервер недоступен. Проверьте API ключ.';
    if (msg.includes('Invalid API key') || msg.includes('Missing API key')) return '🔑 Неверный API-ключ. Проверьте настройки.';
    return '🔄 Попробуйте ещё раз через несколько секунд.';
  }

  // ── Публичные методы ───────────────────────────────────────────────────

  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalAgents: number;
    activeAgents: number;
  }> {
    return { totalUsers: 0, totalAgents: 0, activeAgents: 0 };
  }
}

// Singleton instance
let orchestrator: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator();
  }
  return orchestrator;
}
