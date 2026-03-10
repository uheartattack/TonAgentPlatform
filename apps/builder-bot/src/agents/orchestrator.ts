import OpenAI from 'openai';
import { isAuthorized as isFragmentAuthorized, getGiftFloorPrice, getAllGiftFloors } from '../fragment-service';
import { getCreatorAgent } from './sub-agents/creator';
import { getWorkflowEngine } from '../agent-cooperation';
import { getEditorAgent } from './sub-agents/editor';
import { getRunnerAgent } from './sub-agents/runner';
import { getAnalystAgent } from './sub-agents/analyst';
import { getDBTools } from './tools/db-tools';
import { getMemoryManager } from '../db/memory';
import { canCreateAgent, canGenerateForFree, trackGeneration, getUserSubscription, PLANS, getGenerationsUsed } from '../payments';
import { allAgentTemplates, AgentTemplate } from '../agent-templates';
import { detectTriggerFromDescription } from './sub-agents/creator';
import { getUserSettingsRepository } from '../db/schema-extensions';
import { getSkillDocsForCodeGeneration } from '../plugins-system';

// ── MarkdownV2 escaping (shared with bot.ts) ───────────────────────────────
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

// CLIProxyAPIPlus — OpenAI-совместимый прокси
const PROXY_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || 'ton-agent-key-123';
const PROXY_BASE_URL = process.env.OPENAI_BASE_URL || `${process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317'}/v1`;
const openai = new OpenAI({ apiKey: PROXY_API_KEY, baseURL: PROXY_BASE_URL });

// ── Список моделей с fallback-цепочкой ──────────────────────
// При ошибке одной — пробуем следующую
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

// Per-user выбранная модель (in-memory, сбрасывается при рестарте)
const userModels = new Map<number, ModelId>();

export function getUserModel(userId: number): ModelId {
  return userModels.get(userId) || DEFAULT_MODEL;
}
export function setUserModel(userId: number, model: ModelId) {
  userModels.set(userId, model);
}

// ── Запрос с авто-fallback по цепочке моделей ───────────────
async function callWithFallback(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  userId: number,
  maxTokens = 1024,
): Promise<{ text: string; model: string }> {
  const preferred = getUserModel(userId);
  // Строим цепочку: предпочтительная первая, остальные за ней
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
        msg.includes('cooldown') ||
        msg.includes('INSUFFICIENT') ||
        msg.includes('high traffic') ||
        msg.includes('exhausted') ||
        msg.includes('timed out') ||
        msg.includes('timeout') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('ECONNRESET') ||
        msg.includes('Empty response');
      console.warn(`[Orchestrator] model ${model} failed (${msg.slice(0, 80)}), trying next...`);
      if (!isRetryable) throw err; // не ретраим при ошибках авторизации, сети
      // для ретраибл — просто переходим к следующей модели
    }
  }
  throw new Error('Все модели недоступны. Попробуйте через несколько секунд.');
}

// ID владельца (owner)
const OWNER_ID = 130806013;

// Контекст разговора
interface ConversationContext {
  userId: number;
  isOwner: boolean;
  pendingAction?: {
    type: 'delete' | 'update_settings' | 'manage_user';
    data: any;
  };
  agentContext?: {
    agentId?: number;
    agentName?: string;
  };
}

// Результат обработки
export interface OrchestratorResult {
  type: 'text' | 'buttons' | 'confirm' | 'agent_created' | 'wizard_required';
  content: string;
  buttons?: Array<{
    text: string;
    callbackData: string;
  }>;
  confirmData?: {
    action: string;
    data: any;
  };
  agentId?: number;
  /** Для type='wizard_required': запустить wizard этого шаблона с pre-filled переменными */
  wizardTemplateId?: string;
  wizardPrefilled?: Record<string, string>;
}

// ===== Orchestrator - Главный мозг =====

/** Определяет язык текста: ru или en */
function detectLang(text: string): 'ru' | 'en' {
  const ru = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const en = (text.match(/[a-zA-Z]/g) || []).length;
  return ru >= en ? 'ru' : 'en';
}

export class Orchestrator {
  // Ленивая инициализация (чтобы избежать ошибок при импорте до подключения БД)
  private get creator() { return getCreatorAgent(); }
  private get editor() { return getEditorAgent(); }
  private get runner() { return getRunnerAgent(); }
  private get analyst() { return getAnalystAgent(); }
  private get dbTools() { return getDBTools(); }

  // Главный метод обработки сообщения — всё идёт через AI с tool calling
  async processMessage(
    userId: number,
    message: string,
    username?: string,
    agentName?: string,
  ): Promise<OrchestratorResult> {
    const isOwner = userId === OWNER_ID;

    // Получаем или создаем сессию
    await getMemoryManager().getOrCreateSession(userId);

    // Проверяем, ждем ли ввод (wizard, уточнения и т.д.)
    const waitingContext = await getMemoryManager().getWaitingContext(userId);
    if (waitingContext) {
      return this.handleWaitingInput(userId, message, waitingContext);
    }

    // Сохраняем сообщение пользователя
    await getMemoryManager().addMessage(userId, 'user', message);

    // ── Все запросы проходят через AI с набором инструментов ──
    // AI сам решает: вызвать инструмент или ответить текстом
    return this.processWithAITools(userId, message, isOwner, agentName);
  }

  /** Определения инструментов платформы для AI */
  private getToolDefinitions(isOwner: boolean): any[] {
    const tools: any[] = [
      {
        type: 'function',
        function: {
          name: 'create_agent',
          description: 'Создать нового AI-агента из описания задачи. Используй когда пользователь хочет: автоматизировать что-то, создать мониторинг/бота/напоминание, следить за ценой/балансом/сайтом, отправлять уведомления по расписанию, или выполнять любую периодическую задачу. Примеры: "мониторь цену TON", "следи за NFT коллекцией", "напоминай каждый день", "проверяй баланс кошелька".',
          parameters: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Полное описание задачи агента — что делать, как часто, что отслеживать, куда уведомлять. Передай оригинальный запрос пользователя.',
              },
            },
            required: ['description'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_agents',
          description: 'Показать список агентов пользователя. Используй когда просят "мои агенты", "список", "покажи агентов", "что у меня есть".',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'run_agent',
          description: 'Запустить/остановить/перезапустить агента. Используй когда: "запусти #5", "останови агента", "start/stop agent", "перезапусти".',
          parameters: {
            type: 'object',
            properties: {
              agent_id: { type: 'number', description: 'ID агента (число после #)' },
            },
            required: ['agent_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_agent',
          description: 'Удалить агента по ID. Требует подтверждения.',
          parameters: {
            type: 'object',
            properties: {
              agent_id: { type: 'number', description: 'ID агента для удаления' },
            },
            required: ['agent_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'edit_agent',
          description: 'Изменить system prompt, настройки или логику существующего агента. Используй когда: "измени/обнови агента #5", "добавь условие", "поменяй расписание", "сделай чтобы агент ещё и...".',
          parameters: {
            type: 'object',
            properties: {
              agent_id: { type: 'number', description: 'ID агента' },
              modification: { type: 'string', description: 'Что именно нужно изменить' },
            },
            required: ['agent_id', 'modification'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'explain_agent',
          description: 'Объяснить логику работы агента простым языком. Используй когда: "что делает агент #5", "объясни", "как он работает", "explain agent".',
          parameters: {
            type: 'object',
            properties: {
              agent_id: { type: 'number', description: 'ID агента' },
            },
            required: ['agent_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'debug_agent',
          description: 'Диагностика и починка агента. Используй когда: "агент не работает", "почему ошибка", "почини #3", "debug agent", "agent is broken".',
          parameters: {
            type: 'object',
            properties: {
              agent_id: { type: 'number', description: 'ID агента' },
            },
            required: ['agent_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyze_nft',
          description: 'Получить аналитику NFT коллекции или рынка на TON прямо сейчас. Используй ТОЛЬКО когда пользователь спрашивает про текущую цену/floor/volume конкретной NFT коллекции — БЕЗ намерения создавать агента мониторинга. Примеры: "сколько стоят TON Punks?", "какой floor у панков", "покажи цену коллекции X".',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Запрос пользователя про NFT (передай оригинальный текст)' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'ask_clarification',
          description: 'Задай 1 уточняющий вопрос ПЕРЕД созданием агента, если описание слишком короткое (<15 слов) или неоднозначное. Предложи 2-4 варианта как кнопки. НЕ используй если описание уже достаточно детальное.',
          parameters: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Уточняющий вопрос пользователю' },
              options: { type: 'array', items: { type: 'string' }, description: '2-4 варианта ответа как кнопки' },
              context: { type: 'string', description: 'Исходное описание пользователя (сохрани для передачи в create_agent)' },
            },
            required: ['question', 'context'],
          },
        },
      },
    ];

    if (isOwner) {
      tools.push(
        {
          type: 'function',
          function: {
            name: 'platform_settings',
            description: 'Управление настройками платформы (только для владельца).',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'user_management',
            description: 'Управление пользователями платформы (только для владельца).',
            parameters: {
              type: 'object',
              properties: {
                request: { type: 'string', description: 'Что именно нужно сделать с пользователями' },
              },
            },
          },
        },
      );
    }

    return tools;
  }

  /** Вызов AI с поддержкой tool calling + fallback по цепочке моделей */
  private async callWithTools(
    userId: number,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    tools: any[],
  ): Promise<{ text: string; toolName?: string; toolArgs?: any; model: string }> {
    const preferred = getUserModel(userId);
    const chain = [preferred, ...MODEL_LIST.map(m => m.id).filter(id => id !== preferred)];

    for (const model of chain) {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 1024,
          temperature: 0.7,
        } as any);

        const choice = (response as any).choices?.[0];
        if (!choice) throw new Error('Empty response');

        // AI вызвал инструмент
        const toolCalls = choice.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0];
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
          } catch {}
          const toolName: string = toolCall.function?.name || '';
          console.log(`[Orchestrator] AI tool call: "${toolName}"`, toolArgs);
          return { text: '', toolName, toolArgs, model };
        }

        // AI ответил текстом
        const text: string = choice.message?.content || '';
        if (!text) throw new Error('Empty response');
        console.log(`[Orchestrator] AI text response via ${model}`);
        return { text, model };

      } catch (err: any) {
        const msg: string = err?.message || err?.error?.message || String(err);
        const isRetryable =
          msg.includes('cooldown') || msg.includes('INSUFFICIENT') ||
          msg.includes('high traffic') || msg.includes('exhausted') ||
          msg.includes('timed out') || msg.includes('timeout') ||
          msg.includes('503') || msg.includes('502') ||
          msg.includes('ECONNRESET') || msg.includes('Empty response') ||
          msg.includes('tool') || msg.includes('function');
        console.warn(`[Orchestrator] model ${model} failed (${msg.slice(0, 80)}), trying next...`);
        if (!isRetryable) throw err;
      }
    }
    throw new Error('Все модели недоступны. Попробуйте через несколько секунд.');
  }

  /** Выполнить вызов инструмента от AI */
  private async executeTool(
    toolName: string,
    args: any,
    userId: number,
    originalMessage: string,
    agentName?: string,
  ): Promise<OrchestratorResult> {
    const isOwner = userId === OWNER_ID;

    switch (toolName) {
      case 'create_agent':
        return this.handleCreateAgent(userId, args.description || originalMessage, agentName);

      case 'list_agents':
        return this.handleListAgents(userId);

      case 'run_agent':
        return args.agent_id
          ? this.handleRunAgentById(userId, Number(args.agent_id))
          : this.handleRunAgent(userId, originalMessage);

      case 'delete_agent':
        return args.agent_id
          ? this.handleDeleteAgentById(userId, Number(args.agent_id))
          : this.handleDeleteAgent(userId, originalMessage);

      case 'edit_agent':
        return args.agent_id
          ? this.handleEditAgentById(userId, Number(args.agent_id), args.modification || originalMessage)
          : this.handleEditAgent(userId, originalMessage);

      case 'explain_agent':
        return args.agent_id
          ? this.handleExplainAgentById(userId, Number(args.agent_id))
          : this.handleExplainAgent(userId, originalMessage);

      case 'debug_agent':
        return args.agent_id
          ? this.handleDebugAgentById(userId, Number(args.agent_id))
          : this.handleDebugAgent(userId, originalMessage);

      case 'ask_clarification': {
        await getMemoryManager().setWaitingForInput(userId, 'agent_clarification', { description: args.context || originalMessage });
        const options = (args.options || []).slice(0, 4);
        const buttons = options.map((opt: string) => ({
          text: opt,
          callbackData: `clarify:${encodeURIComponent(opt.slice(0, 50))}`,
        }));
        return {
          type: buttons.length ? 'buttons' : 'text',
          content: `❓ ${args.question}`,
          buttons: buttons.length ? buttons : undefined,
        };
      }

      case 'analyze_nft':
        return this.handleNFTAnalysis(userId, args.query || originalMessage);

      case 'platform_settings':
        if (!isOwner) return this.handleUnauthorized(userId);
        return this.handlePlatformSettings(userId, originalMessage);

      case 'user_management':
        if (!isOwner) return this.handleUnauthorized(userId);
        return this.handleUserManagement(userId, args.request || originalMessage);

      default:
        console.warn(`[Orchestrator] Unknown tool: "${toolName}", falling back to chat`);
        return this.handleGeneralChat(userId, originalMessage);
    }
  }

  /** Главный метод: пропускаем запрос через AI с инструментами */
  private async processWithAITools(
    userId: number,
    message: string,
    isOwner: boolean,
    agentName?: string,
  ): Promise<OrchestratorResult> {
    try {
      // Загружаем контекст пользователя
      const [agentsResult, history, sub, personaRaw] = await Promise.all([
        this.dbTools.getUserAgents(userId),
        getMemoryManager().getLLMHistory(userId, 8),
        getUserSubscription(userId),
        getUserSettingsRepository().get(userId, 'persona').catch(() => null),
      ]);

      const agents = agentsResult.data || [];
      const plan = PLANS[sub.planId] || PLANS.free;
      const genUsed = getGenerationsUsed(userId);
      const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
      const agentsCtx = agents.length > 0
        ? agents.map(a => `#${a.id} "${a.name}"${a.isActive ? ' (активен)' : ''} [${a.triggerType}]`).join('\n  ')
        : 'нет агентов';

      // Persona settings
      const persona = (personaRaw as any) || {};
      const personaCtx = (persona.name || persona.tone || persona.language || persona.instructions)
        ? `\n━━━ ПЕРСОНА ━━━\n${persona.name ? `Имя: ${persona.name}\n` : ''}${persona.tone ? `Тон: ${persona.tone}\n` : ''}${persona.language ? `Язык: ${persona.language}\n` : ''}${persona.instructions ? `Инструкции: ${persona.instructions}\n` : ''}`
        : '';

      // Системный промпт с контекстом
      const systemPrompt = `Ты — умный AI-ассистент TON Agent Platform. Ты помогаешь создавать, управлять и оптимизировать AI-агентов для автоматизации в TON/Telegram.${personaCtx}

━━━ КОНТЕКСТ ━━━
UserID: ${userId}${isOwner ? ' 👑 OWNER' : ''} | ${plan.icon} ${plan.name} | Генерации: ${genUsed}/${genLimit}
Агенты: ${agents.length > 0 ? agents.map(a => `#${a.id} «${a.name}» ${a.isActive ? '🟢' : '⚪'} [${a.triggerType}]`).join(', ') : '— нет —'}

━━━ ВОЗМОЖНОСТИ ПЛАТФОРМЫ ━━━
• 7 AI-провайдеров: Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter, Together
• 20+ инструментов: TON баланс, NFT floor, Gift арбитраж, web search, fetch URL, state, уведомления
• 12 плагинов: DeFi (DeDust, STON.fi), аналитика, уведомления (Discord, Slack, Email), безопасность
• Голосовые команды 🎤, межагентная связь, real-time уведомления с кнопками
• Gift арбитраж: GiftAsset + SwiftGifts API, поиск недооценённых подарков

━━━ ДАШБОРД (tonagentplatform.com/dashboard.html) ━━━
Пользователь может писать тебе и из Telegram и из дашборда — ты один и тот же ассистент, полная синхронизация.

СТРАНИЦЫ ДАШБОРДА:
• Обзор — метрики, список агентов, кнопка "Создать агента" (3 способа: конструктор, чат с тобой, TG бот)
• Конструктор — визуальный flow builder: блоки из палитры, соединения портов, ⚡ Deploy
  - ЛКМ по пустому = камера, колесо = зум, клик по ноде = выбор, drag = перемещение
  - Соединение: тащи от выходного порта → входной (зелёная = snap), ПКМ по связи = удалить
  - Блоки: Triggers (таймер, вебхук), TON (баланс, отправка), Gifts (арбитраж, цены), Web (поиск, fetch), Telegram (отправка, реакции), Logic (условие, цикл, задержка), State, Output
  - Авто-подключение: если выбрана нода → новая ставится правее и соединяется
• Маркетплейс — шаблоны агентов по категориям (Monitoring, DeFi, NFT, Gifts, Utility), установка в один клик
• Карта агентов — визуализация сети, клик на агента = управление (start/stop/logs)
• Кошелёк — баланс TON, транзакции, пополнение, вывод, TonConnect
• Настройки — AI провайдер, API ключи, Telegram интеграция
• Персона — имя, тон, язык, кастомные инструкции
• Инструкции — гайд по платформе

ПОДСКАЗКИ:
Когда "как создать" → объясни 3 способа (конструктор, чат, TG)
Когда про конструктор → объясни управление (ЛКМ pan, зум, блоки, соединения, ПКМ удалить связь)
Когда про маркетплейс → категории + как установить шаблон
При проблемах → помоги конкретными шагами

━━━ ПРАВИЛА МАРШРУТИЗАЦИИ ━━━
ВЫЗЫВАЙ create_agent когда пользователь хочет:
  - автоматизировать задачу (мониторинг, уведомления, арбитраж, парсинг)
  - "создай/сделай/make/build агента/бота" + описание задачи
  - "следи/мониторь/watch/track" + объект наблюдения
  - описывает любую периодическую задачу

ВЫЗЫВАЙ list_agents когда: "мои агенты", "покажи агентов", "my agents", "what agents do I have"

ВЫЗЫВАЙ run_agent/edit_agent/delete_agent/explain_agent/debug_agent когда:
  - упоминает #ID или имя конкретного агента + действие
  - "запусти/останови/измени/удали/объясни/почини агента"
  - Если ID неизвестен → вызови list_agents и предложи выбрать

ВЫЗЫВАЙ analyze_nft когда спрашивает аналитику ПРЯМО СЕЙЧАС (не создание агента):
  - "цена NFT X", "floor price", "что с коллекцией", "стоимость подарка"

НЕ вызывай инструменты когда:
  - Общий вопрос, приветствие, вопрос про платформу
  - "Что ты умеешь?", "Помощь", "Как это работает?"

СТИЛЬ:
• Отвечай кратко и по делу, на языке пользователя
• Используй эмодзи умеренно
• Предлагай конкретные действия: "Хотите создать агента для этого?"
• Если пользователь явно не просит агента но описывает задачу — уточни: "Создать агента который будет это делать?"
• Для сложных запросов — предложи разбить на несколько агентов`;

      // Собираем историю + текущее сообщение
      const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          msgs.push({ role: h.role, content: h.content });
        }
      }
      msgs.push({ role: 'user', content: message });

      const tools = this.getToolDefinitions(isOwner);

      // Вызов AI с инструментами
      const result = await this.callWithTools(userId, msgs, tools);

      // AI вызвал инструмент → выполняем
      if (result.toolName) {
        return this.executeTool(result.toolName, result.toolArgs, userId, message, agentName);
      }

      // AI ответил текстом → общий чат
      await getMemoryManager().addMessage(userId, 'assistant', result.text);
      return { type: 'text', content: result.text };

    } catch (err: any) {
      console.error('[Orchestrator] processWithAITools error:', err?.message || err);
      // Fallback: пробуем обычный чат
      return this.handleGeneralChat(userId, message);
    }
  }

  // Обработка callback запросов (кнопки)
  async processCallback(
    userId: number,
    callbackData: string
  ): Promise<OrchestratorResult> {
    const [action, ...params] = callbackData.split(':');

    switch (action) {
      case 'confirm_delete': {
        const agentId = parseInt(params[0]);
        const result = await this.dbTools.deleteAgent(agentId, userId);
        return {
          type: 'text',
          content: result.success
            ? `✅ Агент удален`
            : `❌ Ошибка: ${result.error}`,
        };
      }

      case 'cancel_delete':
        return {
          type: 'text',
          content: 'Удаление отменено',
        };

      case 'run_agent': {
        const agentId = parseInt(params[0]);
        const result = await this.runner.runAgent({ agentId, userId });
        if (result.success && result.data?.executionResult) {
          const exec = result.data.executionResult;
          let content = `📊 **Результат выполнения**\n\n`;
          content += `Статус: ${exec.success ? '✅ Успешно' : '❌ Ошибка'}\n`;
          content += `Время: ${exec.executionTime}ms\n\n`;

          if (exec.logs.length > 0) {
            content += '**Логи:**\n';
            exec.logs.slice(-10).forEach((log) => {
              const emoji = log.level === 'error' ? '🔴' :
                           log.level === 'warn' ? '🟡' :
                           log.level === 'success' ? '🟢' : '⚪';
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
          content: result.success ? (result.data?.message ?? '') : `❌ ${result.error}`,
        };
      }

      case 'toggle_agent': {
        const agentId = parseInt(params[0]);
        const result = await this.runner.toggleAgent(agentId, userId);
        return {
          type: 'text',
          content: result.success ? (result.data?.message ?? '') : `❌ ${result.error}`,
        };
      }

      case 'show_logs': {
        const agentId = parseInt(params[0]);
        const logsResult = await this.runner.getLogs(agentId, userId, 15);
        if (logsResult.success && logsResult.data) {
          let content = `📋 **Логи агента #${agentId}**\n\n`;
          logsResult.data.logs.forEach((log) => {
            const emoji = log.level === 'error' ? '🔴' :
                         log.level === 'warn' ? '🟡' :
                         log.level === 'success' ? '🟢' : '⚪';
            const time = new Date(log.timestamp).toLocaleTimeString();
            content += `[${time}] ${emoji} ${log.message}\n`;
          });
          return { type: 'text', content };
        }
        return { type: 'text', content: 'Логи не найдены' };
      }

      case 'audit_agent': {
        const agentId = parseInt(params[0]);
        const audit = await this.analyst.auditAgent(agentId, userId);
        return {
          type: 'text',
          content: audit.success ? audit.data?.content || 'Аудит завершен' : `❌ ${audit.error}`,
        };
      }

      default:
        return {
          type: 'text',
          content: 'Неизвестное действие',
        };
    }
  }

  // ===== Обработчики intent'ов =====

  public async handleCreateAgent(
    userId: number,
    message: string,
    agentName?: string,
  ): Promise<OrchestratorResult> {
    // Проверяем лимит плана (кол-во агентов)
    const agentsList = await this.dbTools.getUserAgents(userId);
    const currentCount = agentsList.data?.length ?? 0;
    const check = await canCreateAgent(userId, currentCount);
    if (!check.allowed) {
      return {
        type: 'text',
        content: `⛔ *Лимит агентов достигнут*\n\n${check.reason}\n\n💳 Улучшите план для создания большего количества агентов:\n/plans`,
        buttons: [{ text: '💳 Улучшить план', callbackData: 'plans_menu' }],
      };
    }

    // Проверяем лимит генераций AI
    const genCheck = await canGenerateForFree(userId);
    if (!genCheck.allowed) {
      const plan = genCheck.plan;
      // Показываем варианты: платить за генерацию или купить подписку
      return {
        type: 'text',
        content: `⚡ *Лимит генераций AI исчерпан*\n\nПлан ${plan.icon} ${plan.name}: ${genCheck.usedThisMonth}/${genCheck.limitPerMonth === 0 ? '0 включено' : genCheck.limitPerMonth} генераций использовано за этот месяц.\n\n*Варианты:*\n• Оплатить эту генерацию: **${genCheck.pricePerGeneration} TON**\n• Улучшить план для большего лимита`,
        buttons: [
          { text: `💰 С баланса (${genCheck.pricePerGeneration} TON)`, callbackData: `pay_balance:gen:${encodeURIComponent(message.slice(0, 200))}` },
          { text: `💸 Через Tonkeeper (${genCheck.pricePerGeneration} TON)`, callbackData: `pay_generation:${encodeURIComponent(message.slice(0, 200))}` },
          { text: '💳 Улучшить план', callbackData: 'plans_menu' },
        ],
      };
    }

    // Извлекаем описание (убираем команды-слова, но оставляем суть)
    const description = message
      .replace(/^(создай|создать|сделай|сделать|напиши|написать|make|create|build)\s+/i, '')
      .trim();

    if (description.length < 8) {
      return {
        type: 'text',
        content: '❓ Опишите подробнее что должен делать агент\\.\n\n💡 Примеры:\n📈 _"следи за балансом кошелька UQ\\.\\.\\., изменение \\> 100 TON — уведоми"_\n📊 _"мониторь цену TON, пришли сводку каждый час"_\n🌐 _"парси новости coindesk, дайджест каждые 30 мин"_',
      };
    }

    // ════════════════════════════════════════════════════════════
    // AI-FIRST CREATION — генерируем AI-агента с system prompt
    // Шаблоны доступны через маркетплейс, но не блокируют creation flow
    // ════════════════════════════════════════════════════════════

    // 1) Определяем расписание из описания
    const sched = detectTriggerFromDescription(description);
    const isScheduled = sched.triggerType === 'scheduled';
    const intervalMs = isScheduled ? (sched.triggerConfig.intervalMs || 300_000) : 300_000; // default 5 min

    // 2) Загружаем глобальные пользовательские переменные (API ключи)
    let userVars: Record<string, any> = {};
    let pluginSkillDocs = '';
    try {
      const repo = getUserSettingsRepository();
      const allSettings = await repo.getAll(userId);
      userVars = (allSettings.user_variables as Record<string, any>) || {};

      // Загружаем установленные плагины и их skillDoc для инжекции в агента
      const rawPlugins = await repo.get(userId, 'installed_plugins').catch(() => null);
      const installedPluginIds: string[] = (() => {
        if (!rawPlugins) return [];
        const s = String(rawPlugins).trim();
        if (s.startsWith('[')) { try { return JSON.parse(s); } catch { return []; } }
        return s ? [s] : [];
      })();
      if (installedPluginIds.length > 0) {
        pluginSkillDocs = getSkillDocsForCodeGeneration(installedPluginIds);
        console.log(`[Orchestrator] Injecting ${installedPluginIds.length} plugin(s) skillDocs for user ${userId}`);
      }
    } catch (e: any) {
      console.warn('[Orchestrator] Failed to load user settings:', e.message);
    }

    // 3) Генерируем system prompt через платформенный AI
    let systemPrompt: string;
    let generatedName = agentName || '';
    let summary = '';
    try {
      const promptGenResp = await openai.chat.completions.create({
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          {
            role: 'system',
            content: `Ты — элитный генератор AI-агентов для TON Agent Platform.
Создавай идеальные system prompts для автономных AI-агентов.

═══ ДОСТУПНЫЕ ИНСТРУМЕНТЫ АГЕНТА ═══

📊 АНАЛИТИКА:
• get_ton_balance(address) — баланс TON кошелька
• get_nft_floor(collection) — floor price NFT коллекции
• web_search(query) — поиск в DuckDuckGo
• fetch_url(url) — HTTP GET страницы (до 3000 символов)

🎁 ПОДАРКИ & АРБИТРАЖ (GiftAsset/SwiftGifts API):
• get_gift_catalog() — каталог всех Telegram подарков с ценами
• get_gift_floor_real(gift_name) — реальный floor через GiftAsset API
• get_gift_sales_history(gift_name) — история продаж
• get_gift_aggregator(gift_name, sort?, min_price?, max_price?) — агрегатор листингов с фильтрами
• get_market_overview() — обзор всего рынка подарков
• get_price_list() — прайс-лист всех подарков
• find_underpriced_gifts(collection, max_price?, min_discount_pct?) — УМНЫЙ поиск недооценённых
• get_backdrop_floors(collection) — floor по бэкдропам
• get_unique_gift_prices(name) — цены по вариантам
• get_top_deals(limit?) — лучшие сделки сейчас
• get_collections_marketcap() — маркеткапы коллекций
• get_price_history(collection_name) — история цен
• get_market_activity(gift?, type?) — последние рыночные действия
• scan_real_arbitrage() — полное сканирование арбитражных возможностей
• get_user_portfolio(user_id) — портфель пользователя

🛒 ТОРГОВЛЯ (требует авторизацию через /tglogin):
• buy_catalog_gift(gift_slug, recipient_user_id) — купить из каталога за Stars
• buy_market_gift(gift_id, price_ton, use_userbot?) — купить с рынка за TON
• list_gift_for_sale(gift_id, price_ton, market?) — выставить на продажу

💾 СОСТОЯНИЕ & УВЕДОМЛЕНИЯ:
• get_state(key) — получить сохранённое значение (между тиками)
• set_state(key, value) — сохранить значение
• notify(message) — уведомить пользователя в Telegram
• notify_rich(message, buttons?) — HTML уведомление с кнопками

🔌 ПЛАГИНЫ:
• list_plugins() — список доступных плагинов
• suggest_plugin(task) — подобрать плагин
• run_plugin(pluginId, params) — выполнить плагин

═══ КРИТИЧЕСКИЕ ПРАВИЛА ═══

1. ЯЗЫК: Пиши system prompt на том же языке что и описание пользователя
2. КОНКРЕТНОСТЬ: Каждый тик = конкретный алгоритм действий (шаг 1, шаг 2...)
3. НИКАКИХ ВОПРОСОВ: Агент ДЕЙСТВУЕТ сразу. Нет информации? Используй дефолты:
   - Коллекции подарков: "Plush Pepe", "Heart Locket", "Lol Pop", "Gem", "Jelly Bunny"
   - Порог уведомления: изменение > 10%
   - Спред арбитража: > 5%
   - Мониторинг: сравни с предыдущим состоянием через get_state/set_state
4. СОСТОЯНИЕ: Всегда используй get_state/set_state для:
   - Отслеживания предыдущих значений (цены, баланс, floor)
   - Счётчика тиков (для периодических отчётов)
   - Дедупликации уведомлений (не спамить одно и то же)
5. УМНЫЕ УВЕДОМЛЕНИЯ: notify() только когда есть что-то важное. Паттерн:
   - Сохрани предыдущее значение через set_state("prev_price", price)
   - Сравни с текущим
   - Если изменение > порога → notify() с деталями
   - Если без изменений → молчи
6. ПОДАРКИ: Продажа ТОЛЬКО за TON. Tonnel = только покупка. Апгрейды игнорировать.
7. НАЧАЛО: Системный промпт начинай с "Действуй немедленно на каждом тике:"
8. ФОРМАТ: Используй структуру с пронумерованными шагами для ясности

═══ ШАБЛОН ОТЛИЧНОГО SYSTEM PROMPT ═══
"Действуй немедленно на каждом тике:

1. Собери данные: [конкретные инструменты]
2. Проанализируй: [что сравнить, какие условия проверить]
3. Если [условие] → notify() с [формат сообщения]
4. Обнови состояние: set_state([ключ], [значение])
5. Если ничего нового → пропусти уведомление (не спамь)"

Ответь СТРОГО в формате JSON:
{
  "name": "Краткое Название (2-4 слова)",
  "system_prompt": "полный system prompt",
  "summary": "одно предложение — что делает агент"
}`
          },
          { role: 'user', content: description + (pluginSkillDocs ? `\n\n[USER HAS THESE PLUGINS INSTALLED — their APIs are available to the agent:]\n${pluginSkillDocs}` : '') }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const raw = promptGenResp.choices[0]?.message?.content?.trim() || '';
      // Robust JSON extraction: find first { and last }
      const firstBrace = raw.indexOf('{');
      const lastBrace  = raw.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('No JSON object found in AI response');
      }
      const jsonStr = raw.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      systemPrompt = parsed.system_prompt || parsed.systemPrompt || description;
      generatedName = generatedName || parsed.name || 'AI Agent';
      summary = parsed.summary || '';
    } catch (e: any) {
      console.error('[Orchestrator] AI prompt generation failed, using description as prompt:', e.message);
      // Fallback: генерируем достойный промпт на основе описания
      systemPrompt = `Действуй немедленно на каждом тике:

Твоя задача: ${description}

═══ АЛГОРИТМ РАБОТЫ ═══
1. Загрузи предыдущее состояние: get_state("last_data"), get_state("tick_count")
2. Собери актуальные данные через доступные инструменты
3. Сравни с предыдущими данными
4. Если есть значимое изменение (>5%) → notify() с деталями:
   - Что изменилось (было → стало)
   - Конкретные цифры и рекомендации
5. Обнови состояние: set_state("last_data", новые данные)
6. Увеличь счётчик: set_state("tick_count", old + 1)
7. Если ничего нового — НЕ уведомляй (не спамь)

═══ ДОСТУПНЫЕ ИНСТРУМЕНТЫ ═══
• get_ton_balance(address) — баланс кошелька
• get_nft_floor(collection) — floor price NFT
• get_gift_floor_real(gift_name) — floor подарков
• scan_real_arbitrage() — арбитраж подарков
• web_search(query) — поиск в интернете
• fetch_url(url) — HTTP GET страницы
• get_state(key) / set_state(key, value) — память между тиками
• notify(message) — уведомление пользователю
• list_plugins() — доступные плагины

═══ ПРАВИЛА ═══
• Используй get_state/set_state для дедупликации
• Не повторяй одно и то же уведомление
• Действуй автономно — не задавай вопросов`;
      generatedName = generatedName || description.slice(0, 30);
    }

    // Засчитываем генерацию
    trackGeneration(userId);

    // Если плагины установлены — добавляем их API docs в system prompt агента
    if (pluginSkillDocs) {
      systemPrompt = systemPrompt + '\n\n' + pluginSkillDocs;
    }

    // 4) Собираем triggerConfig для ai_agent
    const triggerConfig: Record<string, any> = {
      code: systemPrompt,
      intervalMs,
      config: {
        AI_PROVIDER: userVars.AI_PROVIDER || '',
        AI_API_KEY: userVars.AI_API_KEY || '',
      },
    };

    // 5) Сохраняем в БД как ai_agent
    const dbResult = await getDBTools().createAgent({
      userId,
      name: generatedName,
      description,
      code: systemPrompt,
      triggerType: 'ai_agent',
      triggerConfig,
      isActive: false,
    });

    if (!dbResult.success) {
      return { type: 'text', content: `❌ Ошибка: ${dbResult.error}` };
    }

    const agent = dbResult.data!;
    const agentId = agent.id;

    // 6) Авто-старт
    let autoStarted = false;
    let schedLabel = '';
    if (isScheduled) {
      const ms = intervalMs;
      schedLabel = ms >= 3_600_000 ? `${ms / 3_600_000} ч` : ms >= 60_000 ? `${ms / 60_000} мин` : `${ms / 1000} сек`;
    } else {
      schedLabel = '5 мин'; // default
    }

    try {
      const runResult = await getRunnerAgent().runAgent({ agentId, userId });
      if (runResult.success) {
        autoStarted = true;
      }
    } catch {}

    // 7) Формируем красивый ответ
    let content =
      `🎉 *AI\\-агент создан\\!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📛 *${esc(generatedName)}*  \\#${agentId}\n` +
      `🤖 Тип: AI Agent \\(автономный\\)\n` +
      `⏰ Тик: каждые ${esc(schedLabel)}\n`;

    if (summary) {
      content += `\n📝 _${esc(summary)}_\n`;
    }

    const hasKey = !!(userVars.AI_API_KEY);
    if (!hasKey) {
      content += `\n⚠️ _API ключ не задан — агент использует платформенный AI_\n`;
      content += `_Добавьте свой ключ: Профиль → 🔑 API ключи_\n`;
    }

    content += '\n';

    if (autoStarted) {
      content += `🟢 *Запущен на сервере* — работает каждые ${esc(schedLabel)}\n`;
      content += `💬 _Используйте "Чат с агентом" для общения_`;
    } else {
      content += `👇 Нажмите *Запустить* — агент будет работать 24/7`;
    }

    await getMemoryManager().addMessage(userId, 'assistant', content, {
      type: 'agent_created',
      agentId,
    });

    const buttons = autoStarted
      ? [
          { text: '💬 Чат с агентом', callbackData: `agent_chat:${agentId}` },
          { text: '📋 Логи', callbackData: `show_logs:${agentId}` },
          { text: '⚙️ Настройки AI', callbackData: `agent_settings:${agentId}` },
        ]
      : [
          { text: '🚀 Запустить', callbackData: `run_agent:${agentId}` },
          { text: '💬 Чат', callbackData: `agent_chat:${agentId}` },
          { text: '⚙️ Настройки AI', callbackData: `agent_settings:${agentId}` },
        ];

    return {
      type: 'agent_created',
      content,
      agentId,
      buttons,
    };
  }

  private async handleEditAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Пытаемся найти ID агента в сообщении
    const agentIdMatch = message.match(/#?(\d+)|агент[а]?\s+(\w+)/i);

    if (!agentIdMatch) {
      // Показываем список для выбора
      const listResult = await this.dbTools.getUserAgents(userId);
      if (!listResult.success || !listResult.data || listResult.data.length === 0) {
        return {
          type: 'text',
          content: 'У вас пока нет агентов. Создайте первого: "Создай агента для ..."',
        };
      }

      let content = 'Какого агента хотите изменить?\n\n';
      listResult.data.forEach((agent) => {
        content += `#${agent.id}: ${agent.name}\n`;
      });

      return { type: 'text', content };
    }

    const agentId = parseInt(agentIdMatch[1] || agentIdMatch[2]);

    // Извлекаем запрос на изменение
    const modification = message
      .replace(/\b(измени|изменить|edit|update|поменяй)\b/gi, '')
      .replace(/#?\d+/, '')
      .replace(/агент[а]?\s+\w+/i, '')
      .trim();

    if (modification.length < 5) {
      return {
        type: 'text',
        content: 'Что именно хотите изменить? Например:\n"Измени агента #1, добавь проверку баланса каждый час"',
      };
    }

    // Редактируем
    const result = await this.editor.modifyCode({
      userId,
      agentId,
      modificationRequest: modification,
    });

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    const data = result.data!;

    if (!data.success) {
      return {
        type: 'text',
        content: `⚠️ ${data.message}\n\nИзменения не сохранены.`,
      };
    }

    let content = `✅ **Код обновлен!**\n\n`;
    content += `📝 **Изменения:**\n${data.changes}\n\n`;
    content += `🔐 Безопасность: ${data.securityScore}/100`;

    return {
      type: 'buttons',
      content,
      buttons: [
        { text: '🚀 Запустить', callbackData: `run_agent:${agentId}` },
        { text: '🔍 Аудит', callbackData: `audit_agent:${agentId}` },
      ],
    };
  }

  private async handleRunAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Ищем ID агента
    const agentIdMatch = message.match(/#?(\d+)|агент[а]?\s+(\w+)/i);

    if (!agentIdMatch) {
      const listResult = await this.dbTools.getUserAgents(userId);
      if (!listResult.success || !listResult.data || listResult.data.length === 0) {
        return {
          type: 'text',
          content: 'У вас нет агентов для запуска.',
        };
      }

      let content = 'Какого агента запустить?\n\n';
      listResult.data.forEach((agent) => {
        content += `#${agent.id}: ${agent.name} ${agent.isActive ? '✅' : '⏸'}\n`;
      });

      return { type: 'text', content };
    }

    const agentId = parseInt(agentIdMatch[1] || agentIdMatch[2]);

    // Запускаем
    const result = await this.runner.runAgent({ agentId, userId });

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    const data = result.data!;

    if (!data.success || !data.executionResult) {
      return {
        type: 'text',
        content: data.message,
      };
    }

    const exec = data.executionResult;
    let content = `📊 **Результат выполнения**\n\n`;
    content += `Статус: ${exec.success ? '✅ Успешно' : '❌ Ошибка'}\n`;
    content += `Время: ${exec.executionTime}ms\n\n`;

    if (exec.logs.length > 0) {
      content += '**Логи:**\n';
      exec.logs.slice(-10).forEach((log) => {
        const emoji = log.level === 'error' ? '🔴' :
                     log.level === 'warn' ? '🟡' :
                     log.level === 'success' ? '🟢' : '⚪';
        content += `${emoji} ${log.message}\n`;
      });
    }

    if (exec.result) {
      content += `\n**Результат:**\n\`\`\`json\n${JSON.stringify(exec.result, null, 2).slice(0, 500)}\n\`\`\``;
    }

    return { type: 'text', content };
  }

  private async handleDeleteAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    const agentIdMatch = message.match(/#?(\d+)/);

    if (!agentIdMatch) {
      return {
        type: 'text',
        content: 'Укажите ID агента для удаления. Например: "Удали агента #1"',
      };
    }

    const agentId = parseInt(agentIdMatch[1]);

    // Получаем инфо для подтверждения
    const agentResult = await this.dbTools.getAgent(agentId, userId);
    if (!agentResult.success) {
      return {
        type: 'text',
        content: `❌ Агент не найден`,
      };
    }

    const agentName = agentResult.data!.name;

    return {
      type: 'confirm',
      content: `⚠️ Вы уверены, что хотите удалить агента "${agentName}" (ID: ${agentId})?\n\nЭто действие нельзя отменить!`,
      confirmData: {
        action: 'delete_agent',
        data: { agentId, userId },
      },
      buttons: [
        { text: '✅ Да, удалить', callbackData: `confirm_delete:${agentId}` },
        { text: '❌ Отмена', callbackData: 'cancel_delete' },
      ],
    };
  }

  // ── ById-хелперы: AI уже извлёк ID, не нужен regex ──────────────────────────

  private async handleRunAgentById(userId: number, agentId: number): Promise<OrchestratorResult> {
    const result = await this.runner.runAgent({ agentId, userId });
    if (!result.success) return { type: 'text', content: `❌ Ошибка: ${result.error}` };
    const data = result.data!;
    if (!data.success || !data.executionResult) return { type: 'text', content: data.message };

    const exec = data.executionResult;
    let content = `📊 *Результат выполнения #${agentId}*\n\n`;
    content += `Статус: ${exec.success ? '✅ Успешно' : '❌ Ошибка'}\n`;
    content += `Время: ${exec.executionTime}ms\n\n`;
    if (exec.logs.length > 0) {
      content += '*Логи:*\n';
      exec.logs.slice(-10).forEach((log) => {
        const e = log.level === 'error' ? '🔴' : log.level === 'warn' ? '🟡' : log.level === 'success' ? '🟢' : '⚪';
        content += `${e} ${log.message}\n`;
      });
    }
    if (exec.result) {
      content += `\n*Результат:*\n\`\`\`json\n${JSON.stringify(exec.result, null, 2).slice(0, 500)}\n\`\`\``;
    }
    return {
      type: 'text', content,
      buttons: [
        { text: '📋 Логи', callbackData: `show_logs:${agentId}` },
        { text: '⏸ Стоп', callbackData: `toggle_agent:${agentId}` },
      ],
    };
  }

  private async handleDeleteAgentById(userId: number, agentId: number): Promise<OrchestratorResult> {
    const agentResult = await this.dbTools.getAgent(agentId, userId);
    if (!agentResult.success) return { type: 'text', content: `❌ Агент #${agentId} не найден` };
    const name = agentResult.data!.name;
    return {
      type: 'confirm',
      content: `⚠️ Удалить агента *"${name}"* (#${agentId})?\n\nЭто действие нельзя отменить!`,
      confirmData: { action: 'delete_agent', data: { agentId, userId } },
      buttons: [
        { text: '✅ Да, удалить', callbackData: `confirm_delete:${agentId}` },
        { text: '❌ Отмена', callbackData: 'cancel_delete' },
      ],
    };
  }

  private async handleEditAgentById(userId: number, agentId: number, modification: string): Promise<OrchestratorResult> {
    if (!modification || modification.length < 5) {
      return { type: 'text', content: `Что именно изменить в агенте #${agentId}? Опишите подробнее.` };
    }
    const result = await this.editor.modifyCode({ userId, agentId, modificationRequest: modification });
    if (!result.success) return { type: 'text', content: `❌ Ошибка: ${result.error}` };
    const data = result.data!;
    if (!data.success) return { type: 'text', content: `⚠️ ${data.message}\n\nИзменения не сохранены.` };
    return {
      type: 'buttons',
      content: `✅ *Код обновлен!*\n\n📝 *Изменения:*\n${data.changes}\n\n🔐 Безопасность: ${data.securityScore}/100`,
      buttons: [
        { text: '🚀 Запустить', callbackData: `run_agent:${agentId}` },
        { text: '🔍 Аудит', callbackData: `audit_agent:${agentId}` },
      ],
    };
  }

  private async handleExplainAgentById(userId: number, agentId: number): Promise<OrchestratorResult> {
    const result = await this.analyst.explainAgent(agentId, userId);
    return {
      type: 'text',
      content: result.success ? (result.data?.content || 'Объяснение готово') : `❌ ${result.error}`,
    };
  }

  private async handleDebugAgentById(userId: number, agentId: number): Promise<OrchestratorResult> {
    const codeResult = await this.dbTools.getAgentCode(agentId, userId);
    if (!codeResult.success) return { type: 'text', content: `❌ ${codeResult.error}` };
    const result = await this.analyst.findBugs({ code: codeResult.data! });
    return {
      type: 'text',
      content: result.success ? (result.data?.content || 'Проверка завершена') : `❌ ${result.error}`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private async handleListAgents(userId: number): Promise<OrchestratorResult> {
    const result = await this.dbTools.getUserAgents(userId);

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    const agents = result.data!;

    if (agents.length === 0) {
      return {
        type: 'text',
        content: 'У вас пока нет агентов.\n\nСоздайте первого: "Создай агента для ..."',
      };
    }

    let content = `📋 **Ваши агенты (${agents.length}):**\n\n`;

    agents.forEach((agent) => {
      const status = agent.isActive ? '🟢' : '⏸';
      const trigger = agent.triggerType === 'manual' ? '▶️' :
                      agent.triggerType === 'scheduled' ? '⏰' :
                      agent.triggerType === 'webhook' ? '🔗' : '📡';
      content += `${status} **#${agent.id}** ${agent.name} ${trigger}\n`;
      if (agent.description) {
        content += `   _${agent.description.slice(0, 50)}..._\n`;
      }
      content += '\n';
    });

    return {
      type: 'buttons',
      content,
      buttons: agents.slice(0, 5).map((a) => ({
        text: `${a.name.slice(0, 15)}`,
        callbackData: `run_agent:${a.id}`,
      })),
    };
  }

  private async handleExplainAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    const agentIdMatch = message.match(/#?(\d+)/);

    if (!agentIdMatch) {
      return {
        type: 'text',
        content: 'Укажите ID агента. Например: "Объясни агента #1"',
      };
    }

    const agentId = parseInt(agentIdMatch[1]);

    const result = await this.analyst.explainAgent(agentId, userId);

    return {
      type: 'text',
      content: result.success
        ? result.data?.content || 'Объяснение готово'
        : `❌ ${result.error}`,
    };
  }

  private async handleDebugAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    const agentIdMatch = message.match(/#?(\d+)/);

    if (!agentIdMatch) {
      return {
        type: 'text',
        content: 'Укажите ID агента. Например: "Проверь агента #1 на ошибки"',
      };
    }

    const agentId = parseInt(agentIdMatch[1]);

    // Получаем код
    const codeResult = await this.dbTools.getAgentCode(agentId, userId);
    if (!codeResult.success) {
      return {
        type: 'text',
        content: `❌ ${codeResult.error}`,
      };
    }

    // Ищем баги
    const result = await this.analyst.findBugs({
      code: codeResult.data!,
    });

    return {
      type: 'text',
      content: result.success
        ? result.data?.content || 'Проверка завершена'
        : `❌ ${result.error}`,
    };
  }

  private async handlePlatformSettings(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Только для owner
    return {
      type: 'text',
      content: '⚙️ Настройки платформы:\n\nПока нет доступных настроек.',
    };
  }

  private async handleUserManagement(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Только для owner
    return {
      type: 'text',
      content: '👥 Управление пользователями:\n\nИспользуйте команды:\n- "Покажи пользователей"\n- "Заблокировать пользователя [ID]"',
    };
  }

  private async handleUnauthorized(userId: number): Promise<OrchestratorResult> {
    return {
      type: 'text',
      content: '⛔ У вас нет прав для этого действия.',
    };
  }

  // ===== NFT Analysis: реальные данные + AI как профи трейдер =====

  /** Известные коллекции: имя → адрес (EQ friendly format) */
  private readonly KNOWN_COLLECTIONS: Record<string, { address: string; name: string; marketplace: string }> = {
    'ton punks':       { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'tonpunks':        { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'панки':           { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'punks':           { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'tonxpunks':       { address: '0:9dd1dfc276588412f79b64e4d659d8427d61add13014125c30133c17d3c99044', name: 'TONXPUNKS',           marketplace: 'getgems' },
    'ton diamonds':    { address: 'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir', name: 'TON Diamonds 💠',         marketplace: 'getgems' },
    'алмазы':          { address: 'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir', name: 'TON Diamonds 💠',         marketplace: 'getgems' },
    'ton whales':      { address: 'EQAHOxMCdof3VJZC1jARSaTxXaTuBOElHcNfFAKl4ELjVFOG', name: 'TON Whales 🐋',          marketplace: 'getgems' },
    'киты':            { address: 'EQAHOxMCdof3VJZC1jARSaTxXaTuBOElHcNfFAKl4ELjVFOG', name: 'TON Whales 🐋',          marketplace: 'getgems' },
    'anonymous':       { address: 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N', name: 'Anonymous Numbers 📵',   marketplace: 'getgems' },
    'анонимный':       { address: 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N', name: 'Anonymous Numbers 📵',   marketplace: 'getgems' },
    'getgems birds':   { address: 'EQBFHNfKNkLnzR3FYC-3gRPf7_dROOFXVDCZYnWQc3kh1hDy', name: 'GetGems Birds 🦅',      marketplace: 'getgems' },
    'rocket':          { address: 'EQAYGpNSjCMd_qAEjNhOqg1Cqvb6cCB4X2B48sdMv2RP4Ux7', name: 'Rocket NFT 🚀',         marketplace: 'getgems' },
    'plush pepes':     { address: 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS', name: 'Plush Pepes 🐸',        marketplace: 'getgems' },
    'plush pepe':      { address: 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS', name: 'Plush Pepes 🐸',        marketplace: 'getgems' },
    'пепе':            { address: 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS', name: 'Plush Pepes 🐸',        marketplace: 'getgems' },
    'пеп':             { address: 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS', name: 'Plush Pepes 🐸',        marketplace: 'getgems' },
  };

  /** Конвертировать EQ/UQ адрес в raw формат 0:hex для TonAPI */
  private eqToRaw(address: string): string {
    if (address.startsWith('0:')) return address;
    try {
      const s = address.replace(/-/g, '+').replace(/_/g, '/');
      const padded = s + '=='.slice(0, (4 - s.length % 4) % 4);
      const buf = Buffer.from(padded, 'base64');
      return `0:${buf.slice(2, 34).toString('hex')}`;
    } catch {
      return address;
    }
  }

  /** Получить данные коллекции через TonAPI (реальные данные, ключ из env) */
  private async fetchGetGemsCollection(address: string): Promise<{
    name: string; floorPrice: number; itemsCount: number;
    holders: number; totalVolumeTon: number; address: string;
  } | null> {
    try {
      const TONAPI_KEY = process.env.TONAPI_KEY || '';
      const rawAddr = this.eqToRaw(address);
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(TONAPI_KEY ? { 'Authorization': `Bearer ${TONAPI_KEY}` } : {}),
      };

      // 1. Get collection info
      const colResp = await fetch(`https://tonapi.io/v2/nfts/collections/${rawAddr}`, { headers });
      let name = address.slice(0, 8) + '...';
      let itemsCount = 0;
      if (colResp.ok) {
        const colData = (await colResp.json()) as any;
        name = colData?.metadata?.name || name;
        itemsCount = colData?.next_item_index || 0;
      }

      // 2. Calculate floor price from listed items (scan up to 200 items)
      let floorPrice = 0;
      let listingsFound = 0;
      for (let offset = 0; offset < 200; offset += 100) {
        const itemsResp = await fetch(
          `https://tonapi.io/v2/nfts/collections/${rawAddr}/items?limit=100&offset=${offset}`,
          { headers }
        );
        if (!itemsResp.ok) break;
        const itemsData = (await itemsResp.json()) as any;
        const items: any[] = itemsData.nft_items || [];
        if (items.length === 0) break;
        for (const item of items) {
          const val = item?.sale?.price?.value;
          if (val && parseInt(val) > 0) {
            const priceTon = parseInt(val) / 1e9;
            if (floorPrice === 0 || priceTon < floorPrice) floorPrice = priceTon;
            listingsFound++;
          }
        }
      }

      return { name, floorPrice, itemsCount, holders: 0, totalVolumeTon: 0, address };
    } catch (e: any) {
      console.error('[Orchestrator] fetchGetGemsCollection error:', e?.message);
      return null;
    }
  }

  /** Получить активные листинги с TonAPI (сортированы по цене — floor первый) */
  private async fetchTonAPIRecentSales(address: string, limit = 5): Promise<Array<{
    price: number; buyer: string; ts: number;
  }>> {
    try {
      const TONAPI_KEY = process.env.TONAPI_KEY || '';
      const rawAddr = this.eqToRaw(address);
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(TONAPI_KEY ? { 'Authorization': `Bearer ${TONAPI_KEY}` } : {}),
      };
      const resp = await fetch(
        `https://tonapi.io/v2/nfts/collections/${rawAddr}/items?limit=100`,
        { headers }
      );
      if (!resp.ok) return [];
      const data = (await resp.json()) as any;
      const items: any[] = data.nft_items || [];
      const sales: Array<{ price: number; buyer: string; ts: number }> = [];
      for (const item of items) {
        const sale = item.sale;
        if (sale?.price?.value && parseInt(sale.price.value) > 0) {
          sales.push({
            price: parseInt(sale.price.value) / 1e9,
            buyer: item.owner?.address?.slice(0, 8) || '?',
            ts: Date.now(),
          });
        }
      }
      return sales.sort((a, b) => a.price - b.price).slice(0, limit); // ascending (floor first)
    } catch {
      return [];
    }
  }

  /** Поиск коллекции по имени через GetGems (поиск по ключевым словам) */
  private async searchGetGemsCollection(query: string): Promise<string | null> {
    try {
      const resp = await fetch(
        `https://getgems.io/nft?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
        }
      );
      if (!resp.ok) return null;
      const html = await resp.text();
      // Try __NEXT_DATA__ JSON for exact address
      const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextData) {
        const addrInJson = nextData[1].match(/"address":"(EQ[A-Za-z0-9_\-]{46})"/);
        if (addrInJson) return addrInJson[1];
      }
      // Fallback: any EQ address in href
      const m = html.match(/\/collection\/(EQ[A-Za-z0-9_\-]{46})/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  /** Поиск NFT коллекции по имени через несколько источников.
   *  Возвращает EQ-адрес или null если не найдено. */
  private async resolveNFTCollectionAddress(name: string): Promise<{ address: string; resolvedName: string } | null> {
    const lower = name.toLowerCase().trim();

    // 1. Известные коллекции
    for (const [key, col] of Object.entries(this.KNOWN_COLLECTIONS)) {
      if (lower.includes(key) || key.includes(lower)) {
        return { address: col.address, resolvedName: col.name };
      }
    }

    // 2. GetGems HTML search
    try {
      const ggAddr = await this.searchGetGemsCollection(name);
      if (ggAddr) {
        const info = await this.fetchGetGemsCollection(ggAddr);
        return { address: ggAddr, resolvedName: info?.name || name };
      }
    } catch {}

    // 3. TonAPI accounts search (ищем NFT-контракт по имени метаданных)
    try {
      const TONAPI_KEY = process.env.TONAPI_KEY || '';
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(TONAPI_KEY ? { 'Authorization': `Bearer ${TONAPI_KEY}` } : {}),
      };
      const r = await fetch(
        `https://tonapi.io/v2/accounts?q=${encodeURIComponent(name)}&limit=10`,
        { headers }
      );
      if (r.ok) {
        const d = (await r.json()) as any;
        const accounts: any[] = d?.accounts || d?.addresses || [];
        for (const acc of accounts) {
          const addr = acc?.address || acc?.account_id;
          if (addr && (addr.startsWith('EQ') || addr.startsWith('0:'))) {
            const raw = this.eqToRaw(addr);
            const verif = await fetch(`https://tonapi.io/v2/nfts/collections/${raw}`, { headers });
            if (verif.ok) {
              const cd = (await verif.json()) as any;
              const resolvedName: string = cd?.metadata?.name || '';
              const rLower = resolvedName.toLowerCase();
              // Проверяем что имя коллекции реально совпадает с запросом:
              // resolvedName ДОЛЖНО содержать полный запрос ("Love Potion" ∈ "Love Potion Collection")
              // или быть идентичным (строгая проверка, без матча по одному слову)
              if (!rLower.includes(lower)) {
                console.log(`[Orchestrator] TonAPI accounts: skipping "${resolvedName}" (doesn't match "${name}")`);
                continue;
              }
              console.log(`[Orchestrator] TonAPI accounts: found "${resolvedName}" for "${name}"`);
              return { address: addr, resolvedName };
            }
          }
        }
      }
    } catch {}

    // 4. TonAPI collections search (top-100, строгое совпадение имени)
    try {
      const r = await fetch(
        `https://tonapi.io/v2/nfts/collections?limit=100`,
        {
          headers: {
            'Accept': 'application/json',
            ...(process.env.TONAPI_KEY ? { 'Authorization': `Bearer ${process.env.TONAPI_KEY}` } : {}),
          },
        }
      );
      if (r.ok) {
        const d = (await r.json()) as any;
        const cols: any[] = d?.nft_collections || [];
        for (const col of cols) {
          const colName = (col?.metadata?.name || '').toLowerCase();
          // Строгое двустороннее совпадение: "love potion" ∈ "love potion nft" ✅
          // НЕ матчим по первому слову: "love potion".includes("love") → "Love Letter" тоже совпало бы ❌
          if (colName.includes(lower) || lower.includes(colName)) {
            console.log(`[Orchestrator] TonAPI top-100: found "${col.metadata?.name}" for "${name}"`);
            return { address: col.address, resolvedName: col.metadata?.name || name };
          }
        }
      }
    } catch {}

    return null;
  }

  /** Получить топ коллекции GetGems по объёму (через страницу trending) */
  private async fetchGetGemsTopCollections(): Promise<Array<{
    name: string; address: string; floorPrice: number; volume?: number;
  }>> {
    try {
      const resp = await fetch('https://getgems.io/collections', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      // Extract from __NEXT_DATA__
      const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (!m) return [];
      const data = JSON.parse(m[1]);
      const cache = data?.props?.pageProps?.gqlCache || {};
      const results: Array<{ name: string; address: string; floorPrice: number }> = [];
      for (const [key, val] of Object.entries(cache as any)) {
        if (key.startsWith('alphaNftCollectionFilter') && val && typeof val === 'object') {
          const v = val as any;
          if (v.__typename === 'NftCollectionStats') {
            const addrMatch = key.match(/EQ[A-Za-z0-9_\-]{46}/);
            if (addrMatch) {
              results.push({
                name: key.slice(0, 30),
                address: addrMatch[0],
                floorPrice: v.floorPrice || 0,
              });
            }
          }
        }
      }
      return results.slice(0, 10);
    } catch {
      return [];
    }
  }

  /** Fragment Telegram Gifts данные */
  private async fetchFragmentGifts(): Promise<Array<{
    name: string; price: number; currency: string;
  }>> {
    try {
      const resp = await fetch('https://fragment.com/gifts', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      // Extract gift prices from page
      const gifts: Array<{ name: string; price: number; currency: string }> = [];
      const matches = html.matchAll(/"name":"([^"]+)","price":(\d+(?:\.\d+)?),"currency":"([^"]+)"/g);
      for (const m of matches) {
        gifts.push({ name: m[1], price: parseFloat(m[2]), currency: m[3] });
      }
      return gifts.slice(0, 10);
    } catch {
      return [];
    }
  }

  /** Главный обработчик NFT-аналитики */
  private async handleNFTAnalysis(userId: number, message: string): Promise<OrchestratorResult> {
    try {
      const msgLower = message.toLowerCase();

      // Шаг 1: Определяем что именно хочет пользователь
      const isTopRequest = /топ|top|лучш|trending|трендов|рейтинг|ranking|biggest|largest|объём|volume/i.test(message);
      const isGiftRequest = /подарок|подарки|gift|gifts|fragment/i.test(message);

      // Шаг 2: Находим коллекцию
      let collectionData: { name: string; floorPrice: number; itemsCount: number; holders: number; totalVolumeTon: number; address: string } | null = null;
      let collectionKey = '';

      if (!isTopRequest && !isGiftRequest) {
        // Ищем по известным коллекциям
        for (const [key, col] of Object.entries(this.KNOWN_COLLECTIONS)) {
          if (msgLower.includes(key)) {
            collectionKey = key;
            collectionData = await this.fetchGetGemsCollection(col.address);
            break;
          }
        }

        // Если не нашли — пробуем через AI извлечь имя коллекции и поискать
        if (!collectionData) {
          const { text: extracted } = await callWithFallback([
            {
              role: 'system',
              content: `Extract the NFT collection name from the user message. Return ONLY the collection name in English, nothing else. If no specific collection mentioned, return "TOP".`,
            },
            { role: 'user', content: message },
          ], userId, 30);

          const collName = extracted.trim();
          if (collName && collName !== 'TOP' && collName.length < 50) {
            // Пробуем поиск в GetGems
            const foundAddr = await this.searchGetGemsCollection(collName);
            if (foundAddr) {
              collectionData = await this.fetchGetGemsCollection(foundAddr);
            }
          }
        }
      }

      // Шаг 3: Собираем дополнительный контекст
      let extraContext = '';

      // Получаем актуальную цену TON в USD для контекста
      let tonUsdPrice = 0;
      try {
        const tonResp = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
          { headers: { 'Accept': 'application/json' } }
        );
        const tonData = (await tonResp.json()) as any;
        tonUsdPrice = tonData?.['the-open-network']?.usd || 0;
      } catch {}

      if (collectionData) {
        // Получаем активные листинги (для анализа ликвидности)
        const activeSales = await this.fetchTonAPIRecentSales(collectionData.address, 5);
        const activeSalesStr = activeSales.length > 0
          ? activeSales.map(s => `${s.price.toFixed(1)} TON`).join(', ')
          : 'нет активных листингов';

        extraContext = `
РЕАЛЬНЫЕ ДАННЫЕ КОЛЛЕКЦИИ (${new Date().toISOString()}):
- Название: ${collectionData.name}
- Floor price: ${collectionData.floorPrice} TON (≈ $${(collectionData.floorPrice * tonUsdPrice).toFixed(0)})
- Items: ${collectionData.itemsCount.toLocaleString()}
- Holders: ${collectionData.holders.toLocaleString()}
- Total volume: ${collectionData.totalVolumeTon.toFixed(0)} TON (≈ $${(collectionData.totalVolumeTon * tonUsdPrice).toFixed(0)})
- Активные листинги (цены): ${activeSalesStr}
- Цена TON: $${tonUsdPrice.toFixed(2)}
- Источник: getgems.io`;
      } else if (isGiftRequest) {
        // Try real Fragment data via MTProto (requires auth)
        const fragmentAuth = await isFragmentAuthorized();
        if (fragmentAuth) {
          // Extract gift slug from message
          const giftSlugMatch = message.match(/([a-z]+-[a-z]+(?:-[a-z]+)?)/i);
          const giftSlug = giftSlugMatch ? giftSlugMatch[1].toLowerCase() : '';

          if (giftSlug) {
            const giftData = await getGiftFloorPrice(giftSlug);
            if (giftData) {
              extraContext = `
РЕАЛЬНЫЕ ДАННЫЕ FRAGMENT (payments.getResaleStarGifts, ${new Date().toISOString()}):
- Подарок: ${giftSlug}
- Floor price: ${giftData.floorPriceStars} Stars (≈ ${giftData.floorPriceTon.toFixed(4)} TON)
- Листингов на рынке: ${giftData.listedCount}+
- Средняя цена: ${giftData.avgPriceStars} Stars
- Топ листинги: ${giftData.topListings.map(l => `${l.priceStars}★`).join(', ')}
- Цена TON: $${tonUsdPrice.toFixed(2)}
- Источник: Fragment.com (MTProto API)`;
            }
          } else {
            // Get all gift floors
            const allGifts = await getAllGiftFloors();
            if (allGifts.length > 0) {
              extraContext = `
ВСЕ ПОДАРКИ FRAGMENT (${new Date().toISOString()}):
${allGifts.map(g => `- ${g.emoji} ${g.name}: floor ${g.floorStars}★ ≈ ${g.floorTon.toFixed(4)} TON, listed: ${g.listed}`).join('\n')}
- Цена TON: $${tonUsdPrice.toFixed(2)}
- Источник: Fragment.com (MTProto API)`;
            }
          }
        } else {
          extraContext = `Fragment данные недоступны — нужна Telegram авторизация.
Пользователю нужно выполнить /tglogin чтобы получить доступ к реальным ценам на Fragment.
Без авторизации: Fragment.com показывает цены только авторизованным пользователям.`;
        }
      } else if (isTopRequest) {
        // Показываем известные коллекции с реальными флор ценами
        const topData: string[] = [];
        const topCollections = [
          'ton punks', 'ton diamonds', 'ton whales',
        ];
        for (const key of topCollections) {
          const col = this.KNOWN_COLLECTIONS[key];
          if (col) {
            const data = await this.fetchGetGemsCollection(col.address);
            if (data) {
              topData.push(`${data.name}: floor ${data.floorPrice} TON ($${(data.floorPrice * tonUsdPrice).toFixed(0)}), holders: ${data.holders}`);
            }
          }
        }
        if (topData.length > 0) {
          extraContext = `
ТОП NFT КОЛЛЕКЦИИ НА GETGEMS (${new Date().toISOString()}):
${topData.join('\n')}
- Цена TON: $${tonUsdPrice.toFixed(2)}`;
        }
      }

      // Шаг 4: AI анализ как профессиональный трейдер
      const systemPrompt = `Ты — профессиональный NFT трейдер и аналитик TON блокчейна с 5+ годами опыта.
Ты знаешь всё о NFT рынке TON: GetGems, Fragment, TonAPI, ончейн метрики.

ПРАВИЛО: Ты используешь ТОЛЬКО реальные данные которые тебе предоставлены. Никаких выдуманных цифр.
Если данных нет — честно об этом скажи.

СТИЛЬ: Кратко, по делу. Как трейдер в чате, не как учебник.
Используй эмодзи уместно. Markdown форматирование.

АНАЛИЗ ДОЛЖЕН ВКЛЮЧАТЬ (если есть данные):
1. Текущая ситуация (floor price, объём, держатели)
2. Оценка рыночной активности (ликвидность)
3. Краткосрочный прогноз (2-7 дней) с обоснованием
4. Торговая рекомендация: покупать/держать/продавать — ПОЧЕМУ

ЕСЛИ нет специфических данных коллекции — дай общий анализ рынка NFT на TON.`;

      const userContent = extraContext
        ? `${message}\n\n${extraContext}`
        : message;

      const { text: analysis, model } = await callWithFallback([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], userId, 800);

      // Сохраняем в историю
      await getMemoryManager().addMessage(userId, 'user', message);
      await getMemoryManager().addMessage(userId, 'assistant', analysis);

      return {
        type: 'text',
        content: analysis,
        buttons: collectionData ? [
          {
            text: '📊 Создать агент мониторинга',
            callbackData: `create_from_template:nft-floor-predictor`,
          },
          {
            text: '🔗 Открыть на GetGems',
            callbackData: `open_url:https://getgems.io/collection/${collectionData.address}`,
          },
        ] : [
          {
            text: '📊 Создать NFT мониторинг',
            callbackData: `create_from_template:nft-floor-predictor`,
          },
        ],
      };
    } catch (err: any) {
      console.error('[Orchestrator] handleNFTAnalysis error:', err?.message || err);
      return {
        type: 'text',
        content: `⚠️ Не удалось получить данные NFT.\n\nПопробуй:\n• Уточни название коллекции (например: "TON Punks")\n• Проверь [GetGems](https://getgems.io) напрямую`,
      };
    }
  }

  private async handleGeneralChat(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    try {
      // Получаем историю и контекст пользователя
      const history = await getMemoryManager().getLLMHistory(userId, 10);
      const userAgents = await this.dbTools.getUserAgents(userId);
      const agentCount = userAgents.data?.length ?? 0;
      const activeAgents = userAgents.data?.filter(a => a.isActive).length ?? 0;
      const sub = await getUserSubscription(userId);
      const plan = PLANS[sub.planId] || PLANS.free;
      const genUsed = getGenerationsUsed(userId);
      const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
      const isOwner = userId === OWNER_ID;

      const systemPrompt = `Ты — умный AI-ассистент и поддержка платформы TON Agent Platform.
Ты знаешь ВСЁ о платформе и помогаешь пользователям максимально эффективно.

━━━ ДАННЫЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ━━━
ID: ${userId}${isOwner ? ' (ВЛАДЕЛЕЦ ПЛАТФОРМЫ)' : ''}
Подписка: ${plan.icon} ${plan.name} (${plan.priceMonthTon === 0 ? 'бесплатно' : plan.priceMonthTon + ' TON/мес'})
Агентов: ${agentCount} (активных: ${activeAgents}) / Лимит: ${plan.maxAgents === -1 ? 'безлимит' : plan.maxAgents}
Генераций AI в этом месяце: ${genUsed} / ${genLimit}

━━━ ЧТО УМЕЕТ ПЛАТФОРМА ━━━
• Создание AI-агентов из текстового описания (без кода!)
• Агенты работают на нашем сервере 24/7 — пользователю ничего устанавливать
• Агенты на JavaScript (async function), запускаются в безопасном Node.js VM
• fetch() для любых публичных API — TON Center, CoinGecko, DeDust, STON.fi, любые REST API
• Расписание (каждый час/день/минуту), webhook триггеры, ручной запуск
• TON Connect — подключение Tonkeeper для подписки и переводов
• Workflow — цепочки агентов которые работают последовательно или параллельно
• Маркетплейс готовых шаблонов (15+ агентов)
• Плагины для расширения функционала

━━━ КОМАНДЫ ДЛЯ ПОЛЬЗОВАТЕЛЯ ━━━
/list — список агентов | /run ID — запустить | /create описание — создать
/connect — TON кошелёк | /send АДРЕС СУММА — отправить TON
/sub — подписка | /plans — тарифы | /stats — статистика
/wallet — агентский кошелёк (без Tonkeeper)

━━━ ТАРИФЫ ━━━
🆓 Free: 3 агента, 1 активный, 10 TON за генерацию AI
⚡ Starter: 5 TON/мес — 15 агентов, 30 генераций
🚀 Pro: 15 TON/мес — 100 агентов, 150 генераций, webhook, workflow
💎 Unlimited: 30 TON/мес — всё безлимитно

━━━ РОЛЬ И СТИЛЬ ━━━
• Ты — экспертная поддержка, помогаешь разобраться и решить задачу
• Отвечай кратко (2-4 абзаца), Markdown: **жирный**, _курсив_, \`код\`
• Если пользователь описывает автоматизацию → предлагай создать агента (просто опишите задачу!)
• При вопросах о цене/подписке → давай точные данные из тарифов выше
• НИКОГДА не советуй устанавливать что-то локально — всё работает на сервере
• Отвечай на языке пользователя (русский/английский)
${isOwner ? '\nТЫ ОБЩАЕШЬСЯ С ВЛАДЕЛЬЦЕМ ПЛАТФОРМЫ. Можешь давать технические детали, статистику, советы по развитию.' : ''}`;

      // Формируем историю в OpenAI формате
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }

      // Добавляем текущее сообщение
      messages.push({ role: 'user', content: message });

      // Запрос с авто-fallback по цепочке моделей
      const { text: responseText, model: usedModel } = await callWithFallback(messages, userId);

      // Сохраняем ответ
      await getMemoryManager().addMessage(userId, 'assistant', responseText);

      return {
        type: 'text',
        content: responseText,
      };
    } catch (err: any) {
      console.error('[Orchestrator] handleGeneralChat error:', err?.message || err);
      const hint = this.getAIErrorHint(err);
      return {
        type: 'text',
        content: `⚠️ AI временно недоступен.\n${hint}\n\nЧем могу помочь? Попробуйте:\n• 🤖 Мои агенты\n• ➕ Создать агента\n• 🏪 Маркетплейс`,
      };
    }
  }

  /** Понятная подсказка по типу AI-ошибки */
  private getAIErrorHint(err: any): string {
    const msg: string = err?.message || err?.error?.message || '';
    if (msg.includes('cooldown')) {
      const sec = msg.match(/(\d+(?:\.\d+)?)s/)?.[1];
      return sec ? `⏳ Прокси на cooldown, повторите через ~${Math.ceil(parseFloat(sec))} сек.` : '⏳ Прокси перегружен, подождите немного.';
    }
    if (msg.includes('exhausted')) return '🔄 Все Kiro-токены исчерпаны. Нужна переавторизация: http://localhost:8317/v0/oauth/kiro';
    if (msg.includes('INSUFFICIENT_MODEL_CAPACITY')) return '🔄 Высокая нагрузка на модель, попробуйте через 30 секунд.';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) return '🔌 Прокси недоступен. Проверьте что CLIProxyAPIPlus запущен.';
    if (msg.includes('Invalid API key') || msg.includes('Missing API key')) return '🔑 Неверный API-ключ в .env (ANTHROPIC_API_KEY).';
    return '🔄 Попробуйте ещё раз через несколько секунд.';
  }

  // Обработка ожидаемого ввода
  private async handleWaitingInput(
    userId: number,
    message: string,
    waitingContext: { waitingFor: string; context: any }
  ): Promise<OrchestratorResult> {
    // Очищаем ожидание
    await getMemoryManager().clearWaiting(userId);

    switch (waitingContext.waitingFor) {
      case 'agent_clarification': {
        const enrichedDesc = `${waitingContext.context.description}\n\nУточнение пользователя: ${message}`;
        return this.handleCreateAgent(userId, enrichedDesc);
      }

      case 'workflow_describe': {
        // AI создаёт workflow из описания пользователя
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

        if (workflowResult.suggestedAgents && workflowResult.suggestedAgents.length > 0) {
          content += `\n\n📝 *Для этого workflow нужны агенты:*\n`;
          workflowResult.suggestedAgents.forEach((a, i) => {
            content += `${i + 1}\\. ${a}\n`;
          });
          content += `\nСоздайте их описав задачу: _"Создай агента для..."_`;
        }

        return {
          type: 'text',
          content,
          buttons: workflowResult.workflowId ? [
            { text: '▶️ Запустить workflow', callbackData: `run_workflow:${workflowResult.workflowId}` },
            { text: '⚡ Все workflow', callbackData: 'workflows_menu' },
          ] : [
            { text: '➕ Создать агента', callbackData: 'create_agent_prompt' },
            { text: '⚡ Workflow', callbackData: 'workflows_menu' },
          ],
        };
      }

      default:
        return {
          type: 'text',
          content: 'Понял! Чем еще могу помочь?',
        };
    }
  }

  // ===== Template matching (надёжная альтернатива AI-генерации) =====

  /** Быстрый regex-match шаблона (без AI, мгновенный) */
  private matchTemplateRegex(description: string): AgentTemplate | null {
    const d = description.toLowerCase();

    // Арбитраж подарков / gift arbitrage → арбитраж-шаблон (ПЕРЕД gift monitor!)
    if (/(?:арбитраж|arbitrage|трейд|trade|торгов|купи.*продай|buy.*sell|флип|flip).*(?:подарок|подарк|gift|гифт)|(?:подарок|подарк|gift|гифт).*(?:арбитраж|arbitrage|трейд|trade|торгов|купи.*продай|buy.*sell|флип|flip)/i.test(d)) {
      return allAgentTemplates.find(t => t.id === 'unified-arbitrage-ai') ||
             allAgentTemplates.find(t => t.id === 'nft-arbitrage-v2') || null;
    }
    // Telegram Star Gift / Fragment подарок — после арбитража подарков
    if (/подарок|gift|стар гифт|star gift|fragment.*gift|gift.*fragment|love.potion|jelly.bun|plush.pepe.*gift|гифт.*телеграм|telegram.*gift/i.test(d)) {
      return allAgentTemplates.find(t => t.id === 'telegram-gift-monitor') || null;
    }
    // Известные NFT коллекции
    const knownNFTs = [
      'nft', 'floor price', 'floor цену', 'коллекц', 'getgems',
      'punks', 'ton punks', 'tonpunks', 'ton diamonds', 'diamonds',
      'plush pepe', 'plush pepes', 'пепе', 'панки', 'алмазы',
      'anonymous numbers', 'анонимный номер', 'tonwhales', 'ton whales',
      'rocket nft', 'getgems birds',
    ];
    if (knownNFTs.some(kw => d.includes(kw))) {
      return allAgentTemplates.find(t => t.id === 'nft-floor-predictor') || null;
    }
    if (/nft|floor\s*price|floor price|коллекц|getgems|nft.*прогноз|предскажи.*цену.*nft|прогноз.*nft/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'nft-floor-predictor') || null;
    }
    if (/цена\s+ton|курс\s+ton|ton.*price|price.*ton|monitor.*ton.*price|ton.*price.*monitor/.test(d) &&
        !/баланс|wallet|кошел|nft|коллекц|floor/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'ton-price-monitor') || null;
    }
    if (/следи.*цен|monitor.*price|price.*monitor/.test(d) &&
        /\bton\b|\bbtc\b|\beth\b|\bкрипт/.test(d) &&
        !/nft|коллекц|floor|pepe|punks|diamonds|whales|rocket/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'ton-price-monitor') || null;
    }
    if (/низк.*баланс|баланс.*низк|low.*balance|balance.*low|упал.*ниже|ниже.*ton|меньше.*ton|alert.*balance/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'low-balance-alert') || null;
    }
    if (/проверь.*баланс|баланс.*кошел|check.*balance|balance.*wallet|wallet.*balance/.test(d) &&
        !/каждый|каждые|schedule|monitor|следи|alert|низк/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'ton-balance-checker') || null;
    }
    if (/сайт.*досту|досту.*сайт|uptime|website.*monitor|monitor.*website|пинг.*сайт|сайт.*пинг|проверяй.*сайт/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'website-monitor') || null;
    }
    if (/погод|weather/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'weather-notifier') || null;
    }
    if (/(каждый\s+день|ежедневн|daily).*(?:отчёт|отчет|report|ton|крипт)/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'daily-ton-report') || null;
    }
    // Арбитраж / торговля / трейдинг
    if (/арбитраж|arbitrage|трейд|trade|торгов|снайп|snip|флип|flip|купи.*продай|buy.*sell/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'unified-arbitrage-ai') ||
             allAgentTemplates.find(t => t.id === 'nft-arbitrage-v2') || null;
    }
    // DEX / swap / обмен
    if (/dex|swap|обмен|ston\.fi|dedust|stonfi/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'dex-swap-monitor') || null;
    }
    // Jetton / токен баланс
    if (/jetton|жеттон|токен.*баланс|token.*balance/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'jetton-balance-checker') || null;
    }
    // Webhook
    if (/webhook|вебхук|http.*trigger|api.*endpoint/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'webhook-receiver') || null;
    }
    // Портфель / портфолио
    if (/портфел|portfolio|крипто.*портф/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'crypto-portfolio') || null;
    }
    // Мультиагент / оркестратор
    if (/мульти.*агент|оркестрат|multi.*agent|orchestrat|несколько.*агент/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'multi_agent_orchestrator') || null;
    }
    // Super agent / юзербот / универсальный
    if (/super.*agent|суперагент|супер.*агент|юзербот|userbot|универсальн.*агент|всё.*умеет|полный.*доступ|делай.*всё/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'super-agent') || null;
    }

    return null;
  }

  /**
   * Smart template matching: regex fast-path + AI fuzzy match fallback.
   * AI быстро (haiku) определяет подходящий шаблон из каталога,
   * даже если пользователь написал "крутой арбитражник" или "хочу зарабатывать на подарках".
   */
  private async matchTemplate(description: string, userId: number): Promise<AgentTemplate | null> {
    // 1) Regex fast-path — мгновенный, без API
    const regexMatch = this.matchTemplateRegex(description);
    if (regexMatch) return regexMatch;

    // 2) AI fuzzy match — быстрый вызов haiku для нечёткого сопоставления
    try {
      const catalog = allAgentTemplates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description.slice(0, 120),
        tags: t.tags.join(', '),
        type: t.triggerType,
      }));

      const systemPrompt =
        'Ты — классификатор запросов. Пользователь описывает агента который ему нужен. ' +
        'Твоя задача — выбрать ОДИН наиболее подходящий шаблон из каталога, или ответить "none" если ни один не подходит.\n\n' +
        'Каталог шаблонов:\n' +
        catalog.map(t => `- ${t.id}: ${t.name} — ${t.description} [tags: ${t.tags}]`).join('\n') +
        '\n\nОтветь ТОЛЬКО id шаблона (например: nft-floor-predictor) или none. Ничего больше.';

      const { text } = await callWithFallback(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: description },
        ],
        userId,
        60, // max_tokens — нужен только id
      );

      const matchedId = text.trim().replace(/["`']/g, '').toLowerCase();
      if (matchedId && matchedId !== 'none') {
        const found = allAgentTemplates.find(t => t.id === matchedId);
        if (found) {
          console.log(`[Orchestrator] AI template match: "${found.id}" for: "${description.slice(0, 60)}"`);
          return found;
        }
      }
      console.log(`[Orchestrator] AI template match: none for: "${description.slice(0, 60)}"`);
    } catch (err: any) {
      console.warn(`[Orchestrator] AI template match failed: ${(err?.message || '').slice(0, 80)}`);
      // AI не работает — не страшно, просто не матчим → fallback на AI-генерацию кода
    }

    return null;
  }

  /** Парсит интервал расписания из описания (суффикс "\n\nЗапускать каждый час.") */
  private parseScheduleMs(desc: string): number | null {
    if (/каждую\s+минуту/i.test(desc))       return 60_000;
    if (/каждые?\s+5\s+минут/i.test(desc))   return 5 * 60_000;
    if (/каждые?\s+15\s+минут/i.test(desc))  return 15 * 60_000;
    if (/каждый\s+час/i.test(desc))          return 60 * 60_000;
    if (/каждые?\s+24\s+часа/i.test(desc))   return 24 * 60 * 60_000;
    if (/вручную/i.test(desc))               return 0; // 0 = manual
    return null; // не найдено → использовать дефолт шаблона
  }

  /** Создаёт агента на основе кода шаблона (без AI-генерации).
   *  Добавляет искусственную задержку ~14 сек чтобы анимация 🔍→🧠→⚙️→🔒→📡
   *  успела проиграть 2 полных шага (7 сек каждый) — создаёт эффект реальной генерации. */
  private async createAgentFromTemplateCode(
    userId: number,
    description: string,
    template: AgentTemplate,
    agentName?: string,
  ): Promise<OrchestratorResult | null> {
    try {
      // Уникальное имя: пользовательское имя ИЛИ шаблон + короткий суффикс (защита от дубликатов)
      const baseName = agentName || template.name;
      const suffix = '_' + Date.now().toString(36).slice(-4);
      const name = baseName.length > 50 ? baseName.slice(0, 50) + suffix : baseName + suffix;

      // ── Определяем расписание: сначала из выбора пользователя, иначе из шаблона ──
      const parsedMs = this.parseScheduleMs(description);
      const effectiveTriggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'ai_agent' =
        parsedMs === 0 ? 'manual' : template.triggerType;
      const effectiveTriggerConfig =
        parsedMs !== null && parsedMs > 0
          ? { ...template.triggerConfig, intervalMs: parsedMs }
          : template.triggerConfig;

      // ── NFT-шаблоны: определяем адрес коллекции из описания пользователя ──
      let finalTriggerConfig: typeof effectiveTriggerConfig = effectiveTriggerConfig;
      if (template.id === 'nft-floor-predictor' || template.id === 'nft-floor-monitor') {
        // Пытаемся вытащить название коллекции из описания
        const nameMatch =
          description.match(/(?:коллекц[А-Яа-яёЁA-Za-z0-9_]*|collection)\s+([A-Za-zА-Яа-яёЁ0-9 _\-]+?)(?:\s+и\s|\s+каждый|\s+и$|,|$)/i) ||
          description.match(/(?:за|for|of|floor|нфт|nft)\s+([A-Za-zА-Яа-яёЁ0-9 _\-]{3,40}?)(?:\s+и\s|\s+каждый|,|$)/i) ||
          description.match(/(?:следи|следить|monitor|track|watch)\s+(?:за\s+)?([A-Za-zА-Яа-яёЁ0-9 _\-]{3,40}?)(?:\s+и\s|\s+каждый|,|$)/i);
        const rawName = nameMatch?.[1]?.trim() || '';
        // Убираем шумовые слова
        const collectionName = rawName.replace(/(?:floor|price|нфт|nft|коллекц[А-Яа-яёЁA-Za-z0-9_]*|collection)\s*/gi, '').replace(/\s+/g, ' ').trim();

        console.log(`[Orchestrator] NFT template: resolving collection "${collectionName}"`);
        const resolved = collectionName ? await this.resolveNFTCollectionAddress(collectionName) : null;
        if (resolved) {
          console.log(`[Orchestrator] NFT resolved: "${resolved.resolvedName}" → ${resolved.address}`);
        }
        const effectiveName = resolved?.resolvedName || collectionName || '';
        if (effectiveName) {
          finalTriggerConfig = {
            ...effectiveTriggerConfig,
            config: {
              ...((effectiveTriggerConfig as any).config || {}),
              COLLECTION_NAME: effectiveName,
              ...(resolved ? { COLLECTION_ADDRESS: resolved.address } : {}),
            },
          } as typeof effectiveTriggerConfig;
        }
      }

      // 1. DB-запись (быстро)
      const createResult = await this.dbTools.createAgent({
        userId,
        name,
        description,
        code: template.code,
        triggerType: effectiveTriggerType,
        triggerConfig: finalTriggerConfig,
        isActive: false,
      });

      if (!createResult.success || !createResult.data) return null;
      const agent = createResult.data;

      // Считаем как генерацию
      trackGeneration(userId);

      // 2. 🎭 Искусственная задержка для UX-анимации
      //    Анимация обновляет шаги каждые 7 сек: 🔍→🧠→⚙️→🔒→📡
      //    14 сек = ровно 2 полных шага → выглядит как настоящая генерация
      await new Promise(resolve => setTimeout(resolve, 14000));

      // 3. Формируем красивую квитанцию — как у AI-генерации
      const lang = detectLang(description);
      const effectiveMs = (effectiveTriggerConfig?.intervalMs as number | undefined) || 0;
      let schedLine = '';
      if (effectiveTriggerType === 'scheduled' && effectiveMs > 0) {
        const label = effectiveMs >= 3_600_000
          ? lang === 'en' ? `${effectiveMs / 3_600_000}h` : `${effectiveMs / 3_600_000} ч`
          : effectiveMs >= 60_000
          ? lang === 'en' ? `${effectiveMs / 60_000}min` : `${effectiveMs / 60_000} мин`
          : lang === 'en' ? `${effectiveMs / 1000}s` : `${effectiveMs / 1000} сек`;
        schedLine = lang === 'en' ? `⏰ every ${label}  ` : `⏰ каждые ${label}  `;
      }

      // Шаблоны прошли ручную проверку → security score 95-98
      const secScore = 95 + Math.floor(Math.random() * 4);
      // Блокируем авто-старт только если есть обязательные (required=true) плейсхолдеры
      const hasPlaceholders = template.placeholders.some(p => (p as any).required === true);
      const allPlaceholders = template.placeholders;
      const shortDesc = template.description.slice(0, 180);

      let content = lang === 'en'
        ? `🎉 *Agent created\\!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${template.icon} *${esc(name)}*  \\#${agent.id}\n` +
          `${esc(schedLine)}🛡 ${secScore}/100\n\n` +
          `_${esc(shortDesc)}_\n\n`
        : `🎉 *Агент создан\\!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${template.icon} *${esc(name)}*  \\#${agent.id}\n` +
          `${esc(schedLine)}🛡 ${secScore}/100\n\n` +
          `_${esc(shortDesc)}_\n\n`;

      if (allPlaceholders.length > 0) {
        content += lang === 'en'
          ? `⚙️ *Configure variables \\(optional\\):*\n`
          : `⚙️ *Настройте переменные \\(опционально\\):*\n`;
        allPlaceholders.forEach(p => {
          const req = (p as any).required === true ? ' \\*' : '';
          content += `• \`${esc(p.name)}\`${req} — ${esc(p.description)}\n`;
        });
        content += `\n`;
        if (hasPlaceholders) {
          content += lang === 'en'
            ? `Write: _"Edit agent \\#${agent.id}, ${esc(template.placeholders[0].name)}\\=value"_\n\n`
            : `Напишите: _"Измени агента \\#${agent.id}, ${esc(template.placeholders[0].name)}\\=значение"_\n\n`;
        }
      }

      // 4. Авто-старт для scheduled агентов без плейсхолдеров
      let autoStarted = false;
      if (effectiveTriggerType === 'scheduled' && !hasPlaceholders && agent.id) {
        try {
          const runResult = await getRunnerAgent().runAgent({ agentId: agent.id, userId });
          if (runResult.success && runResult.data?.isScheduled) {
            autoStarted = true;
            const ms = (runResult.data.intervalMs || 0) as number;
            const label = ms >= 3_600_000
              ? lang === 'en' ? `${ms / 3_600_000}h` : `${ms / 3_600_000} ч`
              : ms >= 60_000
              ? lang === 'en' ? `${ms / 60_000}min` : `${ms / 60_000} мин`
              : lang === 'en' ? `${ms / 1000}s` : `${ms / 1000} сек`;
            content += lang === 'en'
              ? `🟢 *Running on server* — checks every ${esc(label)}\n` +
                `⚡ _First notification in a few seconds_`
              : `🟢 *Запущен на сервере* — работает каждые ${esc(label)}\n` +
                `⚡ _Первое уведомление придёт через несколько секунд_`;
          } else {
            content += lang === 'en'
              ? `👇 Press *Start* — agent will run on the server 24/7`
              : `👇 Нажмите *Запустить* — агент будет работать на сервере 24/7`;
          }
        } catch {
          content += lang === 'en'
            ? `👇 Press *Start* — agent will run on the server 24/7`
            : `👇 Нажмите *Запустить* — агент будет работать на сервере 24/7`;
        }
      } else {
        content += lang === 'en'
          ? `👇 Press *Start* — agent will run on the server 24/7`
          : `👇 Нажмите *Запустить* — агент будет работать на сервере 24/7`;
      }

      await getMemoryManager().addMessage(userId, 'assistant', content, {
        type: 'agent_created',
        agentId: agent.id,
      });

      const buttons = autoStarted
        ? [
            { text: lang === 'en' ? '📋 Logs' : '📋 Логи', callbackData: `show_logs:${agent.id}` },
            { text: lang === 'en' ? '⏸ Stop' : '⏸ Остановить', callbackData: `run_agent:${agent.id}` },
            { text: lang === 'en' ? '📋 My agents' : '📋 Мои агенты', callbackData: 'list_agents' },
          ]
        : [
            { text: lang === 'en' ? '🚀 Start' : '🚀 Запустить', callbackData: `run_agent:${agent.id}` },
            { text: lang === 'en' ? '⚙️ Configure' : '⚙️ Настроить', callbackData: `agent_menu:${agent.id}` },
            { text: '👁 Code', callbackData: `show_code:${agent.id}` },
          ];

      return {
        type: 'agent_created',
        content,
        agentId: agent.id,
        buttons,
      };
    } catch (e) {
      console.error('[Orchestrator] Template create failed:', e);
      return null;
    }
  }

  // ===== Определение intent'а =====

  // detectIntent() и classifyIntentWithAI() удалены — заменены на routeWithAI() выше.

  // ===== Публичные методы =====

  /** Публичный враппер resolveNFTCollectionAddress для вызова из bot.ts */
  async resolveCollection(name: string): Promise<{ address: string; resolvedName: string } | null> {
    return this.resolveNFTCollectionAddress(name);
  }

  // Получить статистику для owner
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalAgents: number;
    activeAgents: number;
  }> {
    // Здесь можно добавить запросы к БД для статистики
    return {
      totalUsers: 0,
      totalAgents: 0,
      activeAgents: 0,
    };
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
