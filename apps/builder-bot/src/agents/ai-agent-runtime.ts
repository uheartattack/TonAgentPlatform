/**
 * AI Agent Runtime — autonomous agentic loop
 *
 * Instead of running a static JS script, AI agents receive:
 *   - agent.code = system prompt (soul of the agent)
 *   - Tools injected by the platform (TON, gifts, state, notify)
 *
 * Each tick:
 *   1. Build messages: system(soul) + context(state/config) + chat messages
 *   2. Agentic loop (up to 5 iters): call AI → execute tools → append results
 *   3. Send final reply to user if chat was active
 */

import OpenAI from 'openai';
import { notifyUser, notifyRich } from '../notifier';
import { getTelegramGiftsService } from '../services/telegram-gifts';
import {
  getAgentStateRepository,
  getAgentLogsRepository,
} from '../db/schema-extensions';
import { isAuthorized } from '../fragment-service';
import {
  tgSendMessage, tgGetMessages, tgGetChannelInfo,
  tgJoinChannel, tgLeaveChannel, tgGetDialogs,
  tgGetMembers, tgSearchMessages, tgGetUserInfo, tgSendFile,
  tgForwardMessage, tgReplyMessage, tgReactMessage, tgEditMessage,
  tgPinMessage, tgMarkRead, tgGetComments, tgSetTyping,
  tgSendFormatted, tgGetMessageById, tgGetUnread,
} from '../services/telegram-userbot';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AIAgentTickParams {
  agentId:    number;
  userId:     number;
  systemPrompt: string;           // agent.code — the "soul"
  config:     Record<string, any>; // from trigger_config.config
  pendingMessages?: string[];     // chat messages from user since last tick
  onNotify?: (msg: string) => Promise<void>; // send message to user
}

interface ToolCall {
  id:       string;
  name:     string;
  args:     Record<string, any>;
}

// ── AI provider config: maps human-friendly name → baseURL + default model ─

interface ProviderCfg { baseURL: string; defaultModel: string; }

function resolveProvider(provider: string): ProviderCfg {
  const p = (provider || '').toLowerCase();
  if (p.includes('gemini') || p.includes('google')) {
    return { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.5-flash' };
  }
  if (p.includes('anthropic') || p.includes('claude')) {
    // Anthropic native API is NOT OpenAI-compatible, route through OpenRouter
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-haiku-4-5-20251001' };
  }
  if (p.includes('groq')) {
    return { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' };
  }
  if (p.includes('deepseek')) {
    return { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' };
  }
  if (p.includes('openrouter')) {
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.5-flash' };
  }
  if (p.includes('together')) {
    return { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' };
  }
  // Default: OpenAI
  return { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' };
}

// Platform proxy fallback
const PLATFORM_AI_URL   = process.env.AI_API_URL || 'http://127.0.0.1:8317/v1';
const PLATFORM_AI_KEY   = process.env.AI_API_KEY || 'local';
const PLATFORM_AI_MODEL = process.env.AI_MODEL   || 'claude-sonnet-4-5-20250929';

// Priority: config.AI_API_KEY (user's own key) → platform proxy fallback
function getAIClient(config: Record<string, any>): { client: OpenAI; defaultModel: string } {
  const apiKey = (config.AI_API_KEY as string) || '';
  const provider = (config.AI_PROVIDER as string) || '';

  // If user has an actual API key → use their provider
  if (apiKey && apiKey !== 'local') {
    const { baseURL, defaultModel } = resolveProvider(provider);
    const finalURL = (config.AI_BASE_URL as string) || baseURL;
    return { client: new OpenAI({ baseURL: finalURL, apiKey }), defaultModel };
  }

  // Fallback to platform proxy (CLIProxyAPIPlus or env-configured)
  return {
    client: new OpenAI({ baseURL: PLATFORM_AI_URL, apiKey: PLATFORM_AI_KEY }),
    defaultModel: PLATFORM_AI_MODEL,
  };
}

// ── Markdown → HTML converter (for AI-generated text) ─────────────────────
export function mdToHtml(text: string): string {
  // If text already has HTML tags (AI sometimes outputs <b> directly) — pass through as-is.
  // Only strip truly dangerous tags; Telegram supports: b, i, code, pre, s, u, a, tg-spoiler.
  if (/<[a-z][^>]*>/i.test(text)) {
    return text
      .replace(/<(?!\/?(?:b|i|s|u|code|pre|a|tg-spoiler)[\s>\/])[^>]+>/gi, '')
      .trim();
  }
  // Otherwise convert markdown → HTML (don't HTML-escape first; TON numbers rarely contain <>&)
  return text
    // Code blocks (``` ... ```) → <pre><code>
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
    // Inline code (`code`) → <code>
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    // Italic: *text* or _text_ (avoid matching inside words)
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<i>$1</i>')
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Headers: ### H → bold line
    .replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>')
    .trim();
}

// ── In-memory pending messages (chat → agent) ──────────────────────────────

const _pendingMessages = new Map<number, string[]>(); // agentId → messages[]

// ── Notify-called flag per active tick (agentId → bool) ────────────────────
// Used to suppress duplicate sends when AI calls notify() AND produces finalContent
const _tickNotifyFlag = new Map<number, boolean>();

export function addMessageToAIAgent(agentId: number, text: string): void {
  if (!_pendingMessages.has(agentId)) _pendingMessages.set(agentId, []);
  _pendingMessages.get(agentId)!.push(text);
  // Trigger an immediate tick so the user gets a fast response
  runImmediateTick(agentId);
}

function popMessages(agentId: number): string[] {
  const msgs = _pendingMessages.get(agentId) || [];
  _pendingMessages.delete(agentId);
  return msgs;
}

// ── Active AI agent handles ────────────────────────────────────────────────

interface ActiveHandle {
  interval: NodeJS.Timeout;
  tick: () => Promise<void>;
  tickRunning: boolean;
}

const _activeHandles = new Map<number, ActiveHandle>();

/** Run an immediate tick for the given agent (e.g. when a chat message arrives). */
function runImmediateTick(agentId: number): void {
  const handle = _activeHandles.get(agentId);
  if (!handle) return; // agent not active — nothing to trigger
  if (handle.tickRunning) return; // tick already in progress, message will be picked up
  handle.tick().catch(() => {});
}

// ── Tool definitions (OpenAI function_call format) ─────────────────────────

function buildToolDefinitions(): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_ton_balance',
        description: 'Получить баланс TON кошелька',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес (EQ...)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_nft_floor',
        description: '⛔ ТОЛЬКО для настоящих NFT коллекций на TON (TON Punks, TON Diamonds и т.д.) — НЕ для Telegram-подарков (Lol Pop, Jelly Bunny и т.д.). Для подарков используй get_gift_floor_real.',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Адрес NFT коллекции (EQ/UQ/raw) — только настоящие NFT, не подарки' },
            ton_api_key: { type: 'string', description: 'TONAPI_KEY (опционально)' },
          },
          required: ['collection'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_catalog',
        description: 'Получить список доступных Telegram подарков из каталога с ценами',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_fragment_listings',
        description: 'Получить листинги уникального подарка на Fragment (цены перепродажи)',
        parameters: {
          type: 'object',
          properties: {
            gift_slug: { type: 'string', description: 'Slug подарка на Fragment' },
            limit: { type: 'number', description: 'Количество листингов (макс. 50)' },
          },
          required: ['gift_slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'appraise_gift',
        description: 'Оценить уникальный подарок: floor price, средняя цена, последняя продажа',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug подарка' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scan_arbitrage',
        description: '⚠️ УСТАРЕЛО — используй scan_real_arbitrage вместо этого. Данные могут быть неточными.',
        parameters: {
          type: 'object',
          properties: {
            max_price_stars: { type: 'number', description: 'Максимальная цена покупки в Stars' },
            min_profit_pct:  { type: 'number', description: 'Минимальная прибыль в %' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_catalog_gift',
        description: 'Купить подарок из каталога Telegram (требует Stars на балансе бота или userbot)',
        parameters: {
          type: 'object',
          properties: {
            gift_id:      { type: 'string',  description: 'ID подарка из каталога' },
            recipient_id: { type: 'number',  description: 'Telegram user ID получателя' },
            use_userbot:  { type: 'boolean', description: 'Использовать userbot (MTProto) вместо Bot API' },
          },
          required: ['gift_id', 'recipient_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_resale_gift',
        description: 'Купить уникальный подарок с Fragment маркетплейса по slug',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug уникального подарка на Fragment' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_gift_for_sale',
        description: 'Выставить подарок на продажу на Fragment (нужен msg_id подарка в userbot)',
        parameters: {
          type: 'object',
          properties: {
            msg_id:      { type: 'number', description: 'ID сообщения с подарком в userbot' },
            price_stars: { type: 'number', description: 'Цена продажи в Stars' },
          },
          required: ['msg_id', 'price_stars'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_stars_balance',
        description: 'Получить текущий баланс Stars на аккаунте userbot',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_upgrade_stats',
        description: 'Получить статистику апгрейдов подарка — сколько уже улучшено, текущая стоимость апгрейда в Stars, ожидаемый номер следующего. Помогает оценить выгодность апгрейда.',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug/название подарка (например: "homemade-cake", "jelly-bunny")' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_gift_profitability',
        description: 'Полный анализ выгодности подарка: текущая pre-market цена в Stars, стоимость апгрейда, floor price NFT на рынках, потенциальная прибыль. Ответ: стоит ли апгрейдить.',
        parameters: {
          type: 'object',
          properties: {
            slug:       { type: 'string',  description: 'Slug подарка' },
            budget_ton: { type: 'number',  description: 'Максимальный бюджет в TON для покупки' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_market_gift',
        description: 'Купить подарок на маркете используя tx_payload из get_gift_aggregator. Отправляет транзакцию с кошелька агента. Требует: можно_купить=true (can_buy_now=true в листинге). ИСПОЛЬЗУЙ ТОЛЬКО когда get_gift_aggregator вернул item с tx_payload и tx_contract.',
        parameters: {
          type: 'object',
          properties: {
            tx_contract:  { type: 'string', description: 'Адрес смарт-контракта (item.tx_contract из get_gift_aggregator)' },
            tx_payload:   { type: 'string', description: 'Base64 BOC payload транзакции (item.tx_payload из get_gift_aggregator)' },
            price_ton:    { type: 'number', description: 'Цена покупки в TON (item.price_ton)' },
            gift_name:    { type: 'string', description: 'Название подарка для уведомления' },
          },
          required: ['tx_contract', 'tx_payload', 'price_ton'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_agent_wallet',
        description: 'Получить или создать TON кошелёк агента. Агент может хранить TON и совершать транзакции. Пользователь должен задепозитить TON на этот адрес.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_ton',
        description: 'Отправить TON с кошелька агента на указанный адрес (требует предварительного пополнения кошелька агента)',
        parameters: {
          type: 'object',
          properties: {
            to:      { type: 'string', description: 'Адрес получателя (EQ.../UQ...)' },
            amount:  { type: 'number', description: 'Сумма в TON' },
            comment: { type: 'string', description: 'Комментарий к транзакции (опционально)' },
          },
          required: ['to', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_state',
        description: 'Получить сохранённое состояние агента по ключу (persists between ticks)',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Ключ состояния' },
          },
          required: ['key'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_state',
        description: 'Сохранить состояние агента (persists between ticks)',
        parameters: {
          type: 'object',
          properties: {
            key:   { type: 'string', description: 'Ключ состояния' },
            value: { type: 'string', description: 'Значение (строка или JSON-строка)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notify',
        description: 'Отправить уведомление пользователю в Telegram (простой текст)',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Текст уведомления' },
          },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notify_rich',
        description: 'Отправить красивое уведомление с HTML-разметкой и кнопками. Поддерживает <b>жирный</b>, <i>курсив</i>, <code>код</code>.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'HTML-текст уведомления. Используй <b>, <i>, <code> для форматирования.' },
            buttons: {
              type: 'array',
              description: 'Массив кнопок под сообщением (необязательно)',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Текст кнопки' },
                  url: { type: 'string', description: 'URL для перехода (необязательно)' },
                },
                required: ['text'],
              },
            },
          },
          required: ['message'],
        },
      },
    },
    // ── Web tools ─────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Поиск в интернете. Возвращает топ-5 результатов (заголовок, описание, URL).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: 'Получить текстовое содержимое веб-страницы по URL (первые 3000 символов).',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL страницы' },
          },
          required: ['url'],
        },
      },
    },
    // ── Telegram Userbot tools (MTProto) ──────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_send_message',
        description: 'Отправить сообщение через Telegram аккаунт (MTProto userbot). Работает с пользователями, группами, каналами.',
        parameters: {
          type: 'object',
          properties: {
            peer:    { type: 'string', description: 'Username (@channel), chat ID, или ссылка на чат' },
            message: { type: 'string', description: 'Текст сообщения' },
          },
          required: ['peer', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_messages',
        description: 'Получить последние сообщения из чата/канала через MTProto',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username или chat ID' },
            limit: { type: 'number', description: 'Количество сообщений (макс 100)' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_channel_info',
        description: 'Получить информацию о канале/группе: название, подписчики, описание',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username или chat ID канала' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_join_channel',
        description: 'Вступить в канал/группу',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username канала/группы' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_leave_channel',
        description: 'Покинуть канал/группу',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username канала/группы' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_dialogs',
        description: 'Получить список чатов (диалогов) аккаунта',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Количество чатов (по умолчанию 20)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_members',
        description: 'Получить участников канала/группы',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username группы/канала' },
            limit: { type: 'number', description: 'Количество (макс 200)' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_search_messages',
        description: 'Поиск сообщений в чате по ключевым словам',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username или chat ID' },
            query: { type: 'string', description: 'Поисковый запрос' },
            limit: { type: 'number', description: 'Количество результатов' },
          },
          required: ['peer', 'query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_user_info',
        description: 'Получить информацию о пользователе Telegram',
        parameters: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'Username или user ID' },
          },
          required: ['user'],
        },
      },
    },
    // ── Extended Telegram Userbot tools ──
    {
      type: 'function',
      function: {
        name: 'tg_reply',
        description: 'Ответить на конкретное сообщение в чате/канале. Используй для участия в обсуждениях.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:     { type: 'string', description: 'ID чата/канала или username' },
            reply_to_id: { type: 'number', description: 'ID сообщения на которое отвечаем' },
            text:        { type: 'string', description: 'Текст ответа' },
          },
          required: ['chat_id', 'reply_to_id', 'text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_react',
        description: 'Поставить реакцию (эмодзи) на сообщение. Поддерживает: 👍❤️🔥😂😮😢',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
            emoji:      { type: 'string', description: 'Эмодзи реакции (напр. 👍, ❤️, 🔥)' },
          },
          required: ['chat_id', 'message_id', 'emoji'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_edit',
        description: 'Редактировать своё сообщение в чате/канале',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения для редактирования' },
            new_text:   { type: 'string', description: 'Новый текст сообщения' },
          },
          required: ['chat_id', 'message_id', 'new_text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_forward',
        description: 'Переслать сообщение из одного чата в другой',
        parameters: {
          type: 'object',
          properties: {
            from_chat: { type: 'string', description: 'Чат-источник (ID или username)' },
            msg_id:    { type: 'number', description: 'ID сообщения для пересылки' },
            to_chat:   { type: 'string', description: 'Чат-назначение (ID или username)' },
          },
          required: ['from_chat', 'msg_id', 'to_chat'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_pin',
        description: 'Закрепить сообщение в чате/канале',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения для закрепления' },
            silent:     { type: 'boolean', description: 'Без уведомления (по умолчанию true)' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_mark_read',
        description: 'Пометить все сообщения в чате как прочитанные',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата/канала или username' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_comments',
        description: 'Получить комментарии к посту в канале. Для чтения обсуждений.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID канала или username' },
            post_id: { type: 'number', description: 'ID поста в канале' },
            limit:   { type: 'number', description: 'Количество комментариев (по умолчанию 30)' },
          },
          required: ['chat_id', 'post_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_typing',
        description: 'Показать статус "печатает" в чате. Используй перед отправкой сообщения для естественности.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата или username' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_formatted',
        description: 'Отправить сообщение с HTML-форматированием (жирный, курсив, ссылки, код)',
        parameters: {
          type: 'object',
          properties: {
            chat_id:   { type: 'string', description: 'ID чата/канала или username' },
            html:      { type: 'string', description: 'HTML-текст: <b>bold</b>, <i>italic</i>, <a href="url">link</a>, <code>code</code>' },
            reply_to:  { type: 'number', description: 'ID сообщения для ответа (опционально)' },
          },
          required: ['chat_id', 'html'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_message_by_id',
        description: 'Получить конкретное сообщение по ID',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_unread',
        description: 'Получить список чатов с непрочитанными сообщениями. Используй для мониторинга новых сообщений.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Количество чатов (по умолчанию 10)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_file',
        description: 'Отправить файл/изображение в чат. Файл по URL будет скачан и отправлен.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:  { type: 'string', description: 'ID чата/канала или username' },
            file_url: { type: 'string', description: 'URL файла или путь к файлу' },
            caption:  { type: 'string', description: 'Подпись к файлу (опционально)' },
          },
          required: ['chat_id', 'file_url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'http_fetch',
        description: 'HTTP-запрос к любому URL (GET/POST). Для API, вебхуков, парсинга.',
        parameters: {
          type: 'object',
          properties: {
            url:     { type: 'string', description: 'URL запроса' },
            method:  { type: 'string', description: 'HTTP метод (GET/POST/PUT/DELETE)' },
            headers: { type: 'object', description: 'Заголовки запроса' },
            body:    { type: 'string', description: 'Тело запроса (для POST/PUT)' },
          },
          required: ['url'],
        },
      },
    },
    // ── GiftAsset / SwiftGifts market data tools ─────────────────
    {
      type: 'function',
      function: {
        name: 'get_gift_floor_real',
        description: 'Получить РЕАЛЬНЫЕ floor prices подарка на маркетплейсах (GetGems, MRKT, Portals, Fragment и др.) через GiftAsset + SwiftGifts API',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug/название подарка (например: "Plush Pepe", "Lol Pop", "Cupid Charm")' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_sales_history',
        description: 'Получить историю последних продаж подарка (с ценами и датами)',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции подарка' },
            limit:           { type: 'number', description: 'Количество записей (макс 50)' },
            model_name:      { type: 'string', description: 'Фильтр по модели (опционально)' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_overview',
        description: 'Получить обзор рынка подарков: все коллекции с последними продажами + статистика апгрейдов',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_price_list',
        description: 'Получить прайс-лист floor цен по всем подаркам (все маркетплейсы)',
        parameters: {
          type: 'object',
          properties: {
            models: { type: 'string', description: 'Фильтр по моделям (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scan_real_arbitrage',
        description: 'Найти РЕАЛЬНЫЕ кросс-маркет арбитраж возможности (цены в TON). Возвращает buyPriceTon/sellPriceTon. Tonnel исключён из продаж.',
        parameters: {
          type: 'object',
          properties: {
            max_price_ton:  { type: 'number', description: 'Максимальная цена покупки в TON' },
            min_profit_pct: { type: 'number', description: 'Минимальная прибыль в % (default: 5)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_aggregator',
        description: 'Поиск лучших предложений подарка по всем маркетплейсам (SwiftGifts агрегатор). Каждый item содержит options.payload — готовый BOC для TON транзакции (можно сразу покупать!). Сортирует по редкости фона, потом по цене.',
        parameters: {
          type: 'object',
          properties: {
            name:       { type: 'string', description: 'Название подарка (например "Lol Pop", "Plush Pepe")' },
            receiver:   { type: 'number', description: 'Telegram user ID получателя подарка (обязательно для генерации payload)' },
            backdrop:   { type: 'string', description: 'Фильтр по фону: "All" (все), "Black", "Dark" и т.д.' },
            model:      { type: 'string', description: 'Фильтр по модели: "All" (все) или конкретная модель' },
            from_price: { type: 'number', description: 'Минимальная цена в TON' },
            to_price:   { type: 'number', description: 'Максимальная цена в TON' },
            market:     { type: 'array', items: { type: 'string' }, description: 'Маркетплейсы: tonnel, portals, Mrkt, getgems, fragment. По умолчанию offchain (tonnel, portals, Mrkt)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_top_deals',
        description: 'Топ-сделки дня — лучшие арбитражные возможности, ранжированные по прибыли (GiftAsset Pro API). Используй в начале каждого тика для быстрой разведки рынка.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_backdrop_floors',
        description: 'Цены флора по цветам фона (backdrop) для коллекции. Чёрный фон стоит в 2-5 раз дороже обычного. Используй для оценки конкретных листингов.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции (например "Plush Pepe"), пусто = все коллекции' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_user_portfolio',
        description: 'Получить портфель подарков пользователя Telegram (с оценкой стоимости)',
        parameters: {
          type: 'object',
          properties: {
            username:    { type: 'string', description: 'Telegram @username' },
            telegram_id: { type: 'string', description: 'Telegram user ID (альтернатива username)' },
          },
          required: [],
        },
      },
    },
    // ── New GiftAsset Pro tools ──
    {
      type: 'function',
      function: {
        name: 'get_collection_offers',
        description: 'Активные buy offers для коллекции — гарантированные покупатели по конкретным ценам. Если есть offer по цене X = можно продать МГНОВЕННО по X. Самый надёжный источник цены продажи.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
            min_price: { type: 'number', description: 'Минимальная цена оффера в TON' },
            max_price: { type: 'number', description: 'Максимальная цена оффера в TON' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_health',
        description: 'Индекс здоровья и жадности рынка по коллекциям. Высокий greed_index = перегрев (продавай). Низкий = недооценка (покупай). health_index = общая ликвидность.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_attribute_volumes',
        description: 'Объём продаж по атрибутам (backdrop/model) — какие варианты подарков покупают чаще. Полезно для понимания реального спроса.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции (пусто = все)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_unique_gift_prices',
        description: 'Цены уникальных подарков с разбивкой по вариантам (backdrop + model). Точные цены per-variant без смешения разного качества.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
          },
          required: [],
        },
      },
    },
    // ── Smart valuation tools ──
    {
      type: 'function',
      function: {
        name: 'find_underpriced_gifts',
        description: 'УМНЫЙ ПОИСК НЕДООЦЕНЁННЫХ ПОДАРКОВ. Сравнивает цену каждого листинга с fair value (флор по backdrop+model). Возвращает подарки, которые продаются НИЖЕ рыночной стоимости их атрибутов. Лучший инструмент для поиска выгодных покупок.',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Slug коллекции (lol-pop, jelly-bunny, plush-pepe и т.д.)' },
            max_price: { type: 'number', description: 'Максимальная цена в TON (бюджет)' },
            min_discount_pct: { type: 'number', description: 'Минимальный % скидки от fair value (default: 10)' },
          },
          required: ['collection'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_price_history',
        description: 'История цен коллекции за последние дни/недели. Показывает тренды: растёт, падает, стабильна. Используй для принятия решения: покупать сейчас или подождать.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_activity',
        description: 'Лента покупок/продаж/изменений цен в реальном времени. Показывает ЧТО покупают прямо сейчас, по какой цене, на каком маркете. Используй для анализа спроса и определения реальной ликвидности.',
        parameters: {
          type: 'object',
          properties: {
            gift: { type: 'string', description: 'Slug подарка (опционально — для конкретной коллекции)' },
            type: { type: 'string', enum: ['buy', 'listing', 'change_price'], description: 'Тип действия: buy=покупки, listing=новые листинги, change_price=изменения цен' },
            min_price: { type: 'number', description: 'Минимальная цена фильтра' },
            max_price: { type: 'number', description: 'Максимальная цена фильтра' },
            markets: { type: 'array', items: { type: 'string' }, description: 'Маркеты: tonnel, portals, Mrkt, getgems, fragment' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_collections_marketcap',
        description: 'Капитализация всех коллекций подарков. Общий объём рынка, топ коллекции по стоимости. Используй для обзора рынка и выбора перспективных коллекций.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Plugin tools ──
    {
      type: 'function',
      function: {
        name: 'list_plugins',
        description: 'Получить список всех доступных плагинов платформы (DeFi, аналитика, уведомления, безопасность). Используй чтобы узнать какие плагины есть и предложить пользователю нужный.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'suggest_plugin',
        description: 'Порекомендовать плагин пользователю на основе задачи. Возвращает подходящие плагины с описанием.',
        parameters: {
          type: 'object',
          properties: {
            task_description: { type: 'string', description: 'Описание задачи пользователя — агент подберёт подходящий плагин' },
          },
          required: ['task_description'],
        },
      },
    },
    // ── Inter-agent tools ──
    {
      type: 'function',
      function: {
        name: 'list_my_agents',
        description: 'Список всех агентов текущего пользователя. Используй чтобы узнать к кому можно обратиться.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ask_agent',
        description: 'Отправить сообщение другому агенту пользователя. Агент ответит на следующем тике. Используй только если пользователь разрешил межагентную коммуникацию.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'number', description: 'ID агента которому отправляем сообщение' },
            message:  { type: 'string', description: 'Текст сообщения агенту' },
          },
          required: ['agent_id', 'message'],
        },
      },
    },
  ];
}

// ── Tool executor ──────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, any>,
  params: AIAgentTickParams,
): Promise<any> {
  const gifts  = getTelegramGiftsService();
  const stateRepo = getAgentStateRepository();

  switch (name) {
    case 'get_ton_balance': {
      try {
        const addr = args.address as string;
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res  = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        const bal  = data.balance ? (parseInt(data.balance) / 1e9).toFixed(4) : '0';
        return { address: addr, balance_ton: bal, status: data.status };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_nft_floor': {
      try {
        const raw = args.collection as string;
        const tonApiKey = args.ton_api_key || params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;

        // Convert EQ to raw if needed
        function eqToRaw(addr: string): string {
          try {
            const b64 = addr.slice(2).replace(/-/g, '+').replace(/_/g, '/');
            const buf = Buffer.from(b64, 'base64');
            const wc  = buf[1] === 0xff ? -1 : buf[1];
            const hex = buf.slice(2, 34).toString('hex');
            return `${wc}:${hex}`;
          } catch { return addr; }
        }

        let collAddr = raw;
        if (raw.includes('getgems.io')) {
          const m = raw.match(/\/collection\/(EQ[A-Za-z0-9_\-]+)/);
          if (m) collAddr = m[1];
        }
        const rawAddr = /^EQ|^UQ/.test(collAddr) ? eqToRaw(collAddr) : collAddr;

        const url = `https://tonapi.io/v2/nfts/collections/${encodeURIComponent(rawAddr)}/items?limit=30&offset=0`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;

        const prices: number[] = [];
        for (const item of (data.nft_items || [])) {
          const s = item.sale;
          if (s?.price?.value) prices.push(parseInt(s.price.value) / 1e9);
        }
        prices.sort((a, b) => a - b);
        const floor = prices[0] ?? null;
        return { collection: collAddr, floor_ton: floor, listed_count: prices.length, top_prices: prices.slice(0, 5) };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_gift_catalog': {
      const catalog = await gifts.getAvailableGifts();
      return { count: catalog.length, gifts: catalog.slice(0, 30) };
    }

    case 'get_fragment_listings': {
      const listings = await gifts.getFragmentListings(args.gift_slug as string, args.limit ?? 20);
      return { slug: args.gift_slug, count: listings.length, listings };
    }

    case 'appraise_gift': {
      return await gifts.appraiseGift(args.slug as string);
    }

    case 'scan_arbitrage': {
      const opps = await gifts.scanArbitrageOpportunities({
        maxPriceStars: args.max_price_stars,
        minProfitPct:  args.min_profit_pct,
        tonApiKey:     params.config.TONAPI_KEY,
      });
      return { count: opps.length, opportunities: opps };
    }

    case 'buy_catalog_gift': {
      if (args.use_userbot) {
        return await gifts.buyGiftUserbot(String(args.gift_id), Number(args.recipient_id));
      }
      return await gifts.buyGiftBot(String(args.gift_id), Number(args.recipient_id));
    }

    case 'buy_resale_gift': {
      return await gifts.buyResaleGift(args.slug as string);
    }

    case 'list_gift_for_sale': {
      return await gifts.listGiftForSale(Number(args.msg_id), Number(args.price_stars));
    }

    case 'get_stars_balance': {
      return await gifts.getStarsBalance();
    }

    case 'get_gift_upgrade_stats': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const slug = (args.slug as string || '').toLowerCase().replace(/\s+/g, '-');
        // Get upgrade statistics
        const [floorData, catalogData] = await Promise.allSettled([
          ga.getFloorPrices(slug),
          ga.getPriceList(),
        ]);
        const floor = floorData.status === 'fulfilled' ? floorData.value : null;
        const catalog = catalogData.status === 'fulfilled' ? catalogData.value : null;
        // Find this gift in catalog
        const giftCatalogEntry = Array.isArray(catalog)
          ? catalog.find((g: any) =>
              (g.slug || '').toLowerCase().includes(slug) ||
              (g.name || '').toLowerCase().includes(slug)
            )
          : null;
        return {
          slug,
          floor_prices: floor,
          catalog_entry: giftCatalogEntry,
          note: 'Upgrade cost depends on current edition number. Lower numbers cost more Stars. Check floor price to estimate profitability.',
        };
      } catch (e: any) {
        return { slug: args.slug, error: e.message, note: 'Try get_gift_floor_real or get_gift_catalog for available data.' };
      }
    }

    case 'analyze_gift_profitability': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const slug = (args.slug as string || '').toLowerCase().replace(/\s+/g, '-');
        const budgetTon = Number(args.budget_ton || 999999);
        const [floorData, salesData, aggData] = await Promise.allSettled([
          ga.getFloorPrices(slug),
          ga.getUniqueSales(slug, 20),
          ga.swAggregate({ name: slug, page: 0, receiver: Number(params.userId || 0) }),
        ]);
        const floor = floorData.status === 'fulfilled' ? floorData.value : null;
        const sales = salesData.status === 'fulfilled' ? salesData.value : null;
        const agg = aggData.status === 'fulfilled' ? aggData.value : null;
        // Find cheapest offer (swAggregate returns { total, items[] })
        const cheapest = (agg as any)?.items?.[0] || null;
        const cheapestPriceTon = cheapest?.price_ton ? Number(cheapest.price_ton) : (cheapest?.price ? Number(cheapest.price) : null);
        const floorTon = (floor as any)?.min_price_ton || null;
        const withinBudget = cheapestPriceTon && cheapestPriceTon <= budgetTon;
        return {
          slug,
          analysis: {
            cheapest_offer_ton: cheapestPriceTon,
            floor_ton: floorTon,
            within_budget: withinBudget,
            recommendation: withinBudget && floorTon && cheapestPriceTon && floorTon > cheapestPriceTon * 1.1
              ? `✅ BUY: cheapest=${cheapestPriceTon} TON, floor=${floorTon} TON, spread=${((floorTon/cheapestPriceTon-1)*100).toFixed(1)}% profit`
              : '⚠️ Not obviously profitable at current prices',
          },
          floor_data: floor,
          recent_sales: Array.isArray(sales) ? sales.slice(0, 5) : sales,
          cheapest_offers: (agg as any)?.items?.slice(0, 5) || null,
        };
      } catch (e: any) {
        return { slug: args.slug, error: e.message };
      }
    }

    case 'buy_market_gift': {
      try {
        const walletAddr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        const walletMn   = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        if (!walletAddr || !walletMn) {
          return { error: 'Agent wallet not created. Call get_agent_wallet first, then have user deposit TON.' };
        }
        const priceTon = Number(args.price_ton);
        if (!priceTon || priceTon <= 0) return { error: 'price_ton must be > 0' };

        // Check balance before sending
        let balanceTon = 0;
        try {
          const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(walletAddr)}`, {
            headers: { Authorization: `Bearer ${process.env.TONAPI_KEY || ''}` },
            signal: AbortSignal.timeout(10000),
          });
          const j = await r.json() as any;
          balanceTon = Number(j.balance || 0) / 1e9;
        } catch {}
        if (balanceTon < priceTon + 0.05) {
          return {
            error: `Insufficient balance: ${balanceTon.toFixed(3)} TON, need ${(priceTon + 0.05).toFixed(3)} TON (price + 0.05 TON network fee)`,
            wallet_address: walletAddr,
            needed: priceTon + 0.05,
            available: balanceTon,
          };
        }

        const { walletFromMnemonic, sendAgentTransactionWithCell } = await import('../services/TonConnect');
        const wallet = await walletFromMnemonic(walletMn, 'v4r2');
        const result = await sendAgentTransactionWithCell(
          wallet,
          String(args.tx_contract),
          priceTon + 0.01, // +0.01 TON for gas
          String(args.tx_payload)
        );

        if ((result as any)?.ok) {
          const giftName = String(args.gift_name || 'подарок');
          const totalSpent = Number((await stateRepo.get(params.agentId, 'total_ton_spent'))?.value || 0) + priceTon;
          await stateRepo.set(params.agentId, params.userId, 'total_ton_spent', String(totalSpent));
          await notifyUser(params.userId, `✅ Куплен ${giftName} за ${priceTon} TON! Tx: ${(result as any).hash}`);
          return { ok: true, hash: (result as any).hash, price_ton: priceTon, gift: giftName };
        }
        return { ok: false, error: (result as any).error || 'Transaction failed' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_agent_wallet': {
      try {
        let addr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        let mnemonic = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        if (!addr || !mnemonic) {
          const { generateAgentWallet } = await import('../services/TonConnect');
          const w = await generateAgentWallet();
          await stateRepo.set(params.agentId, params.userId, 'wallet_address', w.address);
          await stateRepo.set(params.agentId, params.userId, 'wallet_mnemonic', w.mnemonic);
          addr = w.address;
          mnemonic = w.mnemonic;
        }
        let balanceTon = 0;
        try {
          const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}`, {
            headers: { Authorization: `Bearer ${process.env.TONAPI_KEY || ''}` },
            signal: AbortSignal.timeout(10000),
          });
          const j = await r.json() as any;
          balanceTon = Number(j.balance || 0) / 1e9;
        } catch {}
        return { address: addr, balance_ton: balanceTon, status: 'ok', note: 'User must deposit TON to this address before agent can send transactions.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'send_ton': {
      try {
        const walletAddr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        const walletMn   = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        if (!walletAddr || !walletMn) return { error: 'Agent wallet not created. Call get_agent_wallet first.' };
        const { walletFromMnemonic, sendAgentTransaction } = await import('../services/TonConnect');
        const wallet = await walletFromMnemonic(walletMn, 'v4r2');
        const result = await sendAgentTransaction(wallet, String(args.to), Number(args.amount), String(args.comment || ''));
        if ((result as any)?.ok) {
          // Track spend
          const totalSpent = Number((await stateRepo.get(params.agentId, 'total_ton_spent'))?.value || 0) + Number(args.amount);
          await stateRepo.set(params.agentId, params.userId, 'total_ton_spent', String(totalSpent));
          return { ok: true, hash: (result as any).hash, note: `Sent ${args.amount} TON to ${args.to}` };
        }
        return { ok: false, error: (result as any).error };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_state': {
      try {
        const row = await stateRepo.get(params.agentId, args.key as string);
        return { key: args.key, value: row?.value ?? null };
      } catch { return { key: args.key, value: null }; }
    }

    case 'set_state': {
      try {
        await stateRepo.set(params.agentId, params.userId, args.key as string, args.value);
        return { ok: true, key: args.key };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    }

    case 'notify': {
      const msg = String(args.message || '');
      _tickNotifyFlag.set(params.agentId, true); // mark: notify was called in this tick
      // Use notifyRich for markdown rendering; fallback to plain text
      await notifyRich(params.userId, {
        text: mdToHtml(msg),
        agentId: params.agentId,
      }).catch(async () => {
        if (params.onNotify) await params.onNotify(msg).catch(() => {});
        else await notifyUser(params.userId, msg).catch(() => {});
      });
      return { ok: true };
    }

    // ── Web tools ─────────────────────────────────────────────────
    case 'web_search': {
      const query = String(args.query || '');
      if (!query) return { error: 'query required' };
      try {
        const encoded = encodeURIComponent(query);
        const results: any[] = [];

        // 1) Try DuckDuckGo HTML search (works for general queries)
        try {
          const htmlResp = await fetch('https://html.duckduckgo.com/html/?q=' + encoded, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TONAgentBot/1.0)' },
            signal: AbortSignal.timeout(10000),
          });
          if (htmlResp.ok) {
            const html = await htmlResp.text();
            // Extract results from DuckDuckGo HTML: <a class="result__a" href="...">title</a> <a class="result__snippet">...</a>
            const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
            const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
            const links: Array<{ url: string; title: string }> = [];
            let m;
            while ((m = linkRegex.exec(html)) && links.length < 5) {
              const rawUrl = m[1];
              const title = m[2].replace(/<[^>]+>/g, '').trim();
              // DDG wraps URLs: //duckduckgo.com/l/?uddg=ENCODED_URL
              let url = rawUrl;
              const uddg = rawUrl.match(/uddg=([^&]+)/);
              if (uddg) url = decodeURIComponent(uddg[1]);
              links.push({ url, title });
            }
            const snippets: string[] = [];
            while ((m = snippetRegex.exec(html)) && snippets.length < 5) {
              snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
            }
            for (let i = 0; i < links.length; i++) {
              results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || '' });
            }
          }
        } catch {}

        // 2) Fallback: DuckDuckGo Instant Answer API (for wiki/facts)
        if (results.length === 0) {
          const resp = await fetch('https://api.duckduckgo.com/?q=' + encoded + '&format=json&no_html=1', {
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const data = await resp.json() as any;
            if (data.AbstractText) {
              results.push({ title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL || '' });
            }
            if (data.RelatedTopics) {
              for (const topic of data.RelatedTopics.slice(0, 5)) {
                if (topic.Text && topic.FirstURL) {
                  results.push({ title: topic.Text.slice(0, 100), snippet: topic.Text, url: topic.FirstURL });
                }
              }
            }
          }
        }

        return { results: results.slice(0, 5), total: results.length };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'fetch_url': {
      const url = String(args.url || '');
      if (!url) return { error: 'url required' };
      try {
        // SSRF protection
        const u = new URL(url);
        const h = u.hostname.toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1'
          || h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('172.16.')
          || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')
          || h === '169.254.169.254' || h.endsWith('.internal') || h.endsWith('.local')
          || u.protocol === 'file:') {
          return { error: 'Access to internal addresses is blocked' };
        }
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'TONAgentBot/1.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return { error: 'Fetch failed: ' + resp.status };
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('json')) {
          const json = await resp.json() as any;
          return { content: JSON.stringify(json).slice(0, 5000), type: 'json' };
        }
        const text = await resp.text();
        // Strip HTML tags for readability
        const clean = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const truncated = clean.length > 3000;
        return { content: clean.slice(0, 3000), type: 'text', truncated, originalLength: clean.length };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'notify_rich': {
      const msg = String(args.message || '');
      const buttons = (args.buttons as any[]) || [];
      _tickNotifyFlag.set(params.agentId, true); // mark: notify was called in this tick
      await notifyRich(params.userId, {
        text: msg,
        agentId: params.agentId,
        agentName: (params as any).agentName || 'Agent #' + params.agentId,
        buttons: buttons.map((b: any) => ({
          text: String(b.text || ''),
          url: b.url ? String(b.url) : undefined,
        })),
      }).catch(() => {});
      return { ok: true };
    }

    // ── Telegram Userbot tools (MTProto) ─────────────────────────
    case 'tg_send_message': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgSendMessage(args.peer as string, args.message as string);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_messages': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetMessages(args.peer as string, args.limit ?? 20);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_channel_info': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetChannelInfo(args.peer as string);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_join_channel': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgJoinChannel(args.peer as string);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_leave_channel': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgLeaveChannel(args.peer as string);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_dialogs': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetDialogs(args.limit ?? 20);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_members': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetMembers(args.peer as string, args.limit ?? 50);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_search_messages': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgSearchMessages(args.peer as string, args.query as string, args.limit ?? 20);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_user_info': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetUserInfo(args.user as string);
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Extended Telegram Userbot tools ──
    case 'tg_reply': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        const msgId = await tgReplyMessage(args.chat_id as string, args.reply_to_id as number, args.text as string);
        return { ok: true, message_id: msgId };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_react': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        await tgReactMessage(args.chat_id as string, args.message_id as number, args.emoji as string);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_edit': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        await tgEditMessage(args.chat_id as string, args.message_id as number, args.new_text as string);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_forward': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        await tgForwardMessage(args.from_chat as string, args.msg_id as number, args.to_chat as string);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_pin': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        await tgPinMessage(args.chat_id as string, args.message_id as number, args.silent !== false);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_mark_read': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        await tgMarkRead(args.chat_id as string);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_comments': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetComments(args.chat_id as string, args.post_id as number, args.limit ?? 30);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_set_typing': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        await tgSetTyping(args.chat_id as string);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_send_formatted': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        const msgId = await tgSendFormatted(args.chat_id as string, args.html as string, args.reply_to);
        return { ok: true, message_id: msgId };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_message_by_id': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        const msg = await tgGetMessageById(args.chat_id as string, args.message_id as number);
        return msg || { error: 'Message not found' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_get_unread': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        return await tgGetUnread(args.limit ?? 10);
      } catch (e: any) { return { error: e.message }; }
    }

    case 'tg_send_file': {
      try {
        if (!(await isAuthorized())) return { error: 'Telegram не авторизован. Выполните /tglogin' };
        const msgId = await tgSendFile(args.chat_id as string, args.file_url as string, args.caption);
        return { ok: true, message_id: msgId };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'http_fetch': {
      try {
        const url = args.url as string;
        // SSRF protection: block internal/private IPs
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1'
          || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.')
          || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
          || host === '169.254.169.254' || host.endsWith('.internal') || host.endsWith('.local')
          || host.endsWith('.localhost') || parsed.protocol === 'file:' || parsed.protocol === 'ftp:') {
          return { error: 'Access to internal/private addresses is blocked' };
        }
        const method = (args.method as string || 'GET').toUpperCase();
        const headers = (args.headers || {}) as Record<string, string>;
        const body = args.body as string | undefined;
        const res = await fetch(url, {
          method,
          headers: { 'User-Agent': 'TON-Agent-Platform/1.0', ...headers },
          body: method !== 'GET' ? body : undefined,
          signal: AbortSignal.timeout(15000),
        });
        const text = await res.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        return { status: res.status, ok: res.ok, data: json ?? text.slice(0, 4000) };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── GiftAsset / SwiftGifts tools ──────────────────────────────
    case 'get_gift_floor_real': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().getFloorPrices(args.slug as string);
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_gift_sales_history': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().getUniqueSales(
          args.collection_name as string,
          args.limit ?? 20,
          args.model_name as string | undefined,
        );
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_market_overview': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const [lastSales, upgradeStats] = await Promise.all([
          ga.getAllCollectionsLastSale(),
          ga.getUpgradeStats(),
        ]);
        return { lastSales, upgradeStats };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_price_list': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().getPriceList({ models: args.models });
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'scan_real_arbitrage': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().findArbitrageOpportunities({
          maxPriceStars: args.max_price_stars,
          minProfitPct: args.min_profit_pct,
        });
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_gift_aggregator': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const receiverId = Number(args.receiver || params.config?.OWNER_TELEGRAM_ID || params.userId || 0);
        // If to_price filter set → query ALL markets (offchain + onchain) to find cheapest
        const markets = (args.market as string[] | undefined) || (args.to_price != null ? ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'] : undefined);
        const result = await getGiftAssetClient().swAggregate({
          name:      args.name as string,
          receiver:  receiverId,
          backdrop:  args.backdrop as string | undefined,
          model:     args.model as string | undefined,
          fromPrice: args.from_price as number | undefined,
          toPrice:   args.to_price as number | undefined,
          market:    markets,
        });
        // Use rarity % directly from API — no heuristics
        const parseRarityPct = (r: any): number => {
          if (!r) return 100;
          const n = parseFloat(String(r).replace('%', ''));
          return isNaN(n) ? 100 : n;
        };
        const items = (result?.items || []).map((item: any) => {
          const backdropRarityPct = parseRarityPct(item.attributes?.backdrop?.rarity);
          const modelRarityPct    = parseRarityPct(item.attributes?.model?.rarity);
          const hasTx = !!(item.options?.payload);
          // Lower % = rarer = more valuable
          const isRareBackdrop = backdropRarityPct <= 2;
          const isRareModel    = modelRarityPct    <= 1;
          return {
            provider:            item.provider,
            price_ton:           item.price,
            title:               item.title,
            number:              item.number,
            slug:                item.slug,
            link:                item.link,
            model:               item.attributes?.model?.value,
            model_rarity_pct:    item.attributes?.model?.rarity,   // e.g. "1%"
            backdrop:            item.attributes?.backdrop?.value,
            backdrop_rarity_pct: item.attributes?.backdrop?.rarity, // e.g. "2%"
            symbol:              item.attributes?.symbol?.value,
            symbol_rarity_pct:   item.attributes?.symbol?.rarity,
            is_rare_backdrop:    isRareBackdrop,  // ≤2% = rare
            is_rare_model:       isRareModel,     // ≤1% = rare
            value_note: isRareBackdrop && isRareModel
              ? `🔥🔥 ULTRA RARE: backdrop ${backdropRarityPct}% + model ${modelRarityPct}% — potential 10-100x floor`
              : isRareBackdrop
              ? `🔥 Rare backdrop (${backdropRarityPct}%) — significantly above floor price`
              : isRareModel
              ? `⭐ Rare model (${modelRarityPct}%) — worth more than floor`
              : undefined,
            can_buy_now:  hasTx,
            tx_payload:   hasTx ? item.options?.payload   : undefined,
            tx_contract:  hasTx ? item.options?.contract  : undefined,
          };
        });
        // If price filter specified → sort by price (cheapest first) for floor hunting
        // Otherwise → sort by rarity (rarest first) for discovery/analysis
        const hasPriceFilter = args.to_price != null || args.from_price != null;
        if (hasPriceFilter) {
          items.sort((a: any, b: any) => a.price_ton - b.price_ton);
        } else {
          items.sort((a: any, b: any) => {
            const aRar = parseRarityPct(a.backdrop_rarity_pct);
            const bRar = parseRarityPct(b.backdrop_rarity_pct);
            if (aRar !== bRar) return aRar - bRar; // lower % = rarer = first
            return a.price_ton - b.price_ton;
          });
        }
        const limit = hasPriceFilter ? 50 : 20;
        return {
          total: result?.total || 0,
          items: items.slice(0, limit),
          cheapest_price_ton: items.length > 0 ? items[0].price_ton : null,
          note: hasPriceFilter
            ? 'Sorted by price (cheapest first). can_buy_now=true means tx_payload is ready for instant purchase.'
            : 'Sorted by backdrop rarity (rarest first), then price. can_buy_now=true means tx_payload is ready for purchase.',
        };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('SwiftGifts')) {
          return { status: 'unavailable', message: 'SwiftGifts API temporarily unavailable. Use scan_real_arbitrage (GiftAsset) as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_top_deals': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const deals = await getGiftAssetClient().getTopDeals();
        return {
          deals,
          note: 'Top arbitrage opportunities from GiftAsset Pro API. Each item has attributes with rarity% from API — lower % = rarer = more valuable. Use get_gift_aggregator for full listings with tx_payload to buy.',
        };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset Pro API temporarily unavailable. Falling back to scan_real_arbitrage.' };
        }
        return { error: e.message };
      }
    }

    case 'get_backdrop_floors': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const floors = await getGiftAssetClient().getBackdropFloors(args.collection_name as string | undefined);
        return {
          backdrop_floors: floors,
          note: 'Price premiums by backdrop color. Black/dark backdrops command 5-50x floor multiplier. Use to evaluate specific listings.',
        };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset Pro API temporarily unavailable.' };
        }
        return { error: e.message };
      }
    }

    case 'get_collection_offers': {
      if (!args.collection_name) return { error: 'collection_name required' };
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const offers = await getGiftAssetClient().getCollectionOffers(
          args.collection_name as string,
          { minPrice: args.min_price, maxPrice: args.max_price }
        );
        console.log('[get_collection_offers] raw:', JSON.stringify(offers)?.slice(0, 300));
        const offersArr = Array.isArray(offers) ? offers
          : Array.isArray(offers?.offers) ? offers.offers
          : Array.isArray(offers?.data) ? offers.data
          : offers?.items ?? offers;
        return {
          collection: args.collection_name,
          offers: offersArr,
          total: Array.isArray(offersArr) ? offersArr.length : 'unknown',
          note: 'These are ACTIVE BUY ORDERS — guaranteed buyers. If you list at or below their offer price, sale is instant.',
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_market_health': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const [greed, health] = await Promise.allSettled([ga.getGreedIndex(), ga.getCollectionHealth()]);
        return {
          greed_index:  greed.status  === 'fulfilled' ? greed.value  : null,
          health_index: health.status === 'fulfilled' ? health.value : null,
          note: 'greed_index > 70 = market overheated (sell). < 30 = undervalued (buy). health_index = liquidity & activity.',
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_attribute_volumes': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getAttributeVolumes(args.collection_name as string | undefined);
        return { attribute_volumes: data, note: 'Shows which backdrops/models have highest sales volume. High volume = liquid market.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_unique_gift_prices': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getUniqueGiftsPriceList(args.collection_name as string | undefined);
        return { unique_prices: data, note: 'Per-variant prices by backdrop+model combination. More accurate than collection floor.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_user_portfolio': {
      if (!args.username && !args.telegram_id) return { error: 'Provide username or telegram_id' };
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        // Try SwiftGifts price profile first (includes valuation)
        if (args.username) {
          try {
            const profile = await ga.swPriceProfile(args.username as string);
            return profile;
          } catch {}
        }
        // Fallback to GiftAsset user_gifts
        return await ga.getUserGifts({
          username: args.username as string,
          telegramId: args.telegram_id as string,
        });
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    // ── Smart valuation tools ──
    case 'find_underpriced_gifts': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const collection = args.collection as string;
        const maxPrice = args.max_price as number | undefined;
        const minDiscount = (args.min_discount_pct as number) || 10;

        // 1. Get fair value per backdrop
        const [backdropData, listings] = await Promise.all([
          ga.getBackdropFloors(collection).catch(() => null),
          ga.swAggregate({
            name: collection,
            toPrice: maxPrice || null,
            market: ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'],
            receiver: params.userId,
          }).catch(() => ({ total: 0, items: [] })),
        ]);

        // 2. Build backdrop fair value map
        const fairValues: Record<string, number> = {};
        if (backdropData && typeof backdropData === 'object') {
          const entries = Array.isArray(backdropData) ? backdropData
            : backdropData.backdrops ? backdropData.backdrops
            : backdropData.data ? backdropData.data
            : Object.values(backdropData);
          for (const e of (entries as any[])) {
            if (e && e.backdrop && e.floor_price) {
              fairValues[String(e.backdrop).toLowerCase()] = Number(e.floor_price);
            } else if (e && e.name && e.price) {
              fairValues[String(e.name).toLowerCase()] = Number(e.price);
            }
          }
        }

        // 3. Also get per-variant prices for more precision
        let variantPrices: Record<string, number> = {};
        try {
          const uniqueData = await ga.getUniqueGiftsPriceList(collection);
          if (uniqueData && typeof uniqueData === 'object') {
            const variants = Array.isArray(uniqueData) ? uniqueData
              : uniqueData.variants || uniqueData.data || Object.values(uniqueData);
            for (const v of (variants as any[])) {
              if (v && v.model && v.backdrop && v.floor_price) {
                const key = `${String(v.model).toLowerCase()}:${String(v.backdrop).toLowerCase()}`;
                variantPrices[key] = Number(v.floor_price);
              }
            }
          }
        } catch {}

        // 4. Score each listing
        const underpriced: any[] = [];
        for (const item of (listings.items || [])) {
          const price = Number(item.price_ton || item.price);
          if (!price || price <= 0) continue;
          if (maxPrice && price > maxPrice) continue;

          const backdrop = String(item.backdrop || item.options?.backdrop || '').toLowerCase();
          const model = String(item.model || item.options?.model || '').toLowerCase();

          // Find fair value: variant-specific > backdrop-specific > skip
          const variantKey = `${model}:${backdrop}`;
          let fairValue = variantPrices[variantKey] || fairValues[backdrop] || 0;
          if (!fairValue || fairValue <= 0) continue;

          const discountPct = ((fairValue - price) / fairValue) * 100;
          if (discountPct >= minDiscount) {
            underpriced.push({
              title: item.title || item.name || collection,
              price_ton: price,
              fair_value: Number(fairValue.toFixed(2)),
              discount_pct: Number(discountPct.toFixed(1)),
              backdrop: item.backdrop || item.options?.backdrop,
              model: item.model || item.options?.model,
              provider: item.provider,
              link: item.link,
              can_buy_now: !!item.tx_payload,
              tx_contract: item.tx_contract,
              tx_payload: item.tx_payload,
            });
          }
        }

        // Sort by discount (biggest bargain first)
        underpriced.sort((a, b) => b.discount_pct - a.discount_pct);
        const top = underpriced.slice(0, 15);

        return {
          collection,
          total_listings: listings.total,
          underpriced_count: underpriced.length,
          backdrop_fair_values: fairValues,
          variant_fair_values_count: Object.keys(variantPrices).length,
          top_underpriced: top,
          note: top.length > 0
            ? `Found ${underpriced.length} underpriced items! Best deal: ${top[0].title} at ${top[0].price_ton} TON (fair value ${top[0].fair_value}, ${top[0].discount_pct}% below). Use buy_market_gift if can_buy_now=true.`
            : `No items found ${minDiscount}%+ below fair value in ${collection}. Market is efficiently priced right now.`,
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_price_history': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getPriceListHistory(args.collection_name as string);
        return { price_history: data, note: 'Historical price data. Compare with current floor to determine trend (rising/falling/stable). Use for timing buy/sell decisions.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_market_activity': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getMarketActions({
          gift: args.gift as string | undefined,
          type: (args.type as 'buy' | 'listing' | 'change_price') || 'buy',
          minPrice: args.min_price as number | undefined,
          maxPrice: args.max_price as number | undefined,
          markets: args.markets as string[] | undefined,
        });
        return { activity: data, note: 'Real-time market actions. type=buy shows actual purchases (demand indicator). type=listing shows new offers. Use to gauge liquidity and real demand.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_collections_marketcap': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getCollectionsMarketcap();
        return { marketcap: data, note: 'Total market capitalization of all gift collections. Top collections by value = most liquid markets.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    // ── Plugin tools ──
    case 'list_plugins': {
      const { getPluginManager } = await import('../plugins-system');
      const pm = getPluginManager();
      const all = pm.getAllPlugins();
      return all.map(p => ({
        id: p.id, name: p.name, type: p.type,
        description: p.description,
        rating: p.rating, downloads: p.downloads,
        isInstalled: p.isInstalled,
        price: p.price || 'free',
      }));
    }

    case 'suggest_plugin': {
      const { getPluginManager } = await import('../plugins-system');
      const pm = getPluginManager();
      const all = pm.getAllPlugins();
      const task = (args.task_description as string || '').toLowerCase();

      // Keyword matching for plugin suggestion
      const scored = all.map(p => {
        let score = 0;
        const text = `${p.name} ${p.description} ${p.id} ${p.type}`.toLowerCase();
        const keywords = task.split(/\s+/);
        for (const kw of keywords) {
          if (kw.length >= 3 && text.includes(kw)) score += 2;
        }
        // Type-based boosting
        if (task.match(/defi|swap|обмен|торг|dex|пул|pool|ликвид/i) && p.type === 'defi') score += 3;
        if (task.match(/аналит|stats|стат|мониторинг|отслежив|track/i) && (p.type === 'analytics' || p.type === 'data-source')) score += 3;
        if (task.match(/уведомл|нотиф|alert|сообщ|notif/i) && p.type === 'notification') score += 3;
        if (task.match(/безопас|security|аудит|drain|protect/i) && p.type === 'security') score += 3;
        return { ...p, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

      if (scored.length === 0) {
        return { message: 'Подходящих плагинов не найдено. Попробуй выполнить задачу без плагинов.' };
      }
      return {
        suggestions: scored.map(p => ({
          id: p.id, name: p.name, type: p.type,
          description: p.description,
          isInstalled: p.isInstalled,
          reason: `Релевантность: ${p.score}`,
        })),
        tip: scored[0].isInstalled
          ? `Плагин "${scored[0].name}" уже установлен, можно использовать.`
          : `Для задачи рекомендуется плагин "${scored[0].name}". Попроси пользователя установить его.`,
      };
    }

    // ── Inter-agent tools ──
    case 'list_my_agents': {
      try {
        const db = (await import('./tools/db-tools')).getDBTools();
        const result = await db.getUserAgents(params.userId);
        if (!result.success) return { error: 'Не удалось получить список агентов' };
        return (result.data || []).map((a: any) => ({
          id: a.id, name: a.name, triggerType: a.triggerType,
          isActive: a.isActive,
          description: (a.description || '').slice(0, 100),
        }));
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ask_agent': {
      const targetId = args.agent_id as number;
      const message = args.message as string;
      if (!targetId || !message) return { error: 'Нужны agent_id и message' };

      // Check inter-agent permission via agent state
      try {
        const stateRepo = getAgentStateRepository();
        const interAgentState = await stateRepo.get(params.agentId, 'inter_agent_enabled');
        if (!interAgentState || interAgentState.value !== 'true') {
          return { error: 'Межагентная коммуникация отключена для этого агента. Попроси пользователя включить её в меню агента.' };
        }

        // Verify target agent belongs to same user
        const db = (await import('./tools/db-tools')).getDBTools();
        const targetAgent = await db.getAgent(targetId, params.userId);
        if (!targetAgent.success || !targetAgent.data) {
          return { error: `Агент #${targetId} не найден у этого пользователя` };
        }

        // Send message
        addMessageToAIAgent(targetId, `[От агента #${params.agentId}]: ${message}`);
        return { success: true, message: `Сообщение отправлено агенту #${targetId} «${targetAgent.data.name || ''}». Ответ придёт на следующем тике.` };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'run_plugin': {
      try {
        const pluginId = args.plugin_id as string || args.pluginId as string;
        if (!pluginId) return { error: 'plugin_id required. Use list_plugins() to see available plugins.' };
        const { getPluginManager } = await import('../plugins-system');
        const pm = getPluginManager();
        const result = await pm.executePlugin(pluginId, { ...args.params, userId: params.userId });
        return result;
      } catch (e: any) {
        return { error: e.message };
      }
    }

    default:
      console.warn(`[AI Runtime] Unknown tool called: ${name}, args: ${JSON.stringify(args).slice(0, 200)}`);
      return { error: `Unknown tool: ${name}. Use list_plugins() or check available tools.` };
  }
}

// ── Log to DB ──────────────────────────────────────────────────────────────

async function logToDb(agentId: number, level: string, message: string, userId = 0): Promise<void> {
  try {
    await getAgentLogsRepository().insert({ agentId, userId, level, message });
  } catch (e) {
    console.warn('[logToDb] Failed:', (e as any)?.message);
  }
}

// ── Core tick ──────────────────────────────────────────────────────────────

export async function runAIAgentTick(params: AIAgentTickParams): Promise<{
  finalResponse?: string;
  toolCallCount: number;
  error?: string;
}> {
  // getAIClient handles fallback to platform proxy when user has no key
  const { client: ai, defaultModel } = getAIClient(params.config);
  const msgs = params.pendingMessages || [];

  await logToDb(params.agentId, 'info', `[AI tick] start, pendingMsgs=${msgs.length}`, params.userId);

  // ── Build initial message list ──────────────────────────────────
  // Context message: current state summary + config (without secrets)
  const configSummary = Object.entries(params.config)
    .filter(([k]) => !k.toLowerCase().includes('mnemonic') && !k.toLowerCase().includes('key'))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(', ');

  // Plugin summary for context
  let pluginHint = '';
  try {
    const { getPluginManager } = await import('../plugins-system');
    const pm = getPluginManager();
    const stats = pm.getStats();
    pluginHint = `\nПлагины: ${stats.installed} установлено из ${stats.total} (DeFi: ${stats.byType.defi}, Аналитика: ${stats.byType.analytics}, Уведомления: ${stats.byType.notification}, Безопасность: ${stats.byType.security}). Используй list_plugins/suggest_plugin если нужен плагин.`;
  } catch {}

  // Inter-agent status
  let interAgentHint = '';
  try {
    const iaState = await getAgentStateRepository().get(params.agentId, 'inter_agent_enabled');
    if (iaState && iaState.value === 'true') {
      interAgentHint = '\nМежагентная коммуникация: ВКЛЮЧЕНА. Используй list_my_agents и ask_agent для взаимодействия с другими агентами.';
    }
  } catch {}

  // ── Gift system knowledge (injected for all agents) ────────────────────────
  const GIFT_SYSTEM_KNOWLEDGE = `
[TELEGRAM GIFTS KNOWLEDGE BASE]
🚨 ГЛАВНОЕ ПРАВИЛО:
Для ЛЮБЫХ вопросов о подарках (Lol Pop, Jelly Bunny, Heart Locket, Plush Pepe, и любое другое название коллекции подарков):
→ ТОЛЬКО инструменты: get_gift_floor_real, get_collection_offers, get_gift_aggregator, scan_real_arbitrage, get_price_list, get_market_overview
→ НИКОГДА не используй get_nft_floor, get_ton_balance или другие TON/NFT инструменты для подарков
→ Данные ВСЕГДА доступны через GiftAsset/SwiftGifts API — оффчейн (Tonnel/Portals/Mrkt) и ончейн (GetGems/Fragment)
→ Если get_collection_offers вернул [] — активных buy-ордеров нет прямо сейчас, объясни как продать через листинг на GetGems

📦 Стадии жизни подарка:
1. PRE-MARKET (обычный подарок) — выпускается в обычном виде, ещё НЕ является NFT. Нельзя передать или продать. Хранится у пользователя в боте.
2. UPGRADE (улучшение за Stars) — пользователь платит Stars чтобы улучшить подарок → он становится уникальным NFT с порядковым номером (#1, #2, #3...). Каждый улучшенный получает УНИКАЛЬНЫЙ номер внутри своей коллекции.
3. UNIQUE GIFT (NFT) — можно торговать на маркетах (Fragment/GetGems/GiftAsset/Telegram Market).

💰 Как формируется цена:
- Номер выпуска (#): Чем МЕНЬШЕ номер, тем ДОРОЖЕ. #1 стоит 50,000+ Stars, #100 намного дешевле.
- Фон (background): САМЫЙ важный фактор! Чёрный фон (#000000 или "Black") = максимальная цена. Цветные фоны дешевле. Пример: "Homemade Cake" с чёрным фоном стоит в 10-50x дороже чем с белым.
- Модель (model): Дизайн подарка. Редкие модели (lower drop rate %) стоят дороже.
- Символ/декор (symbol): Дополнительный элемент украшения, влияет на цену незначительно.
- Процент выпадения (supply %): Чем НИЖЕ % вероятности → тем РЕЖЕ → тем ДОРОЖЕ.

📊 Маркетплейсы и типы:
ОФФЧЕЙН маркеты (подарки НЕ на блокчейне — дешевле):
- Tonnel → цены в TON (⚠️ ТОЛЬКО ПОКУПКА — плохая ликвидность для продажи)
- Portals → цены в TON (оффчейн, можно и покупать и продавать)
- MRKT.tg → цены в TON (оффчейн)
ОНЧЕЙН маркеты (NFT на блокчейне — дороже, но лучшая ликвидность):
- GetGems → цены в TON (лучший ликвидный sell-маркет)
- Fragment.com → цены в TON (NFT торговля, высокая ликвидность)
- GiftAsset.pro → цены в TON (агрегатор, Premium API)
- SwiftGifts → цены в TON (агрегатор 7 маркетплейсов)

⚠️ КРИТИЧЕСКИЕ ПРАВИЛА:
- ОНЧЕЙН подарки стоят ДОРОЖЕ чем оффчейн аналоги (разница 10-25%) — это НОРМАЛЬНО
- Когда пишешь флор: ВСЕГДА указывай оффчейн-флор И ончейн-флор ОТДЕЛЬНО
- Пример правильного ответа: "Portals (offchain): 4.74 TON | GetGems (onchain): 5.40 TON"
- Tonnel = только источник покупки, НИКОГДА не продавать на Tonnel
- Апгрейды подарков — ИГНОРИРОВАТЬ. Арбитраж только между маркетплейсами.
- Stars цены — игнорировать. Только TON.
- НИКОГДА не просить пользователя пополнить кошелёк — просто уведомить если баланса недостаточно
- Не повторять одни и те же возможности каждый тик — использовать set_state/get_state для дедупликации

🚫 СТРОГИЙ ЗАПРЕТ ГАЛЛЮЦИНАЦИЙ И СПАМА:
- notify() ТОЛЬКО после того, как инструмент вернул конкретный листинг с полями: provider, price_ton, link
- НИКОГДА не вызывай notify() на основе: get_state результата, предположений, логики без API-ответа
- ПОРЯДОК ОБЯЗАТЕЛЕН: сначала инструмент → проверь ответ items[] → если непустой → только тогда notify()
- Если get_gift_aggregator вернул items[] = [] → не нотифицировать, просто завершить тик молча
- Если get_gift_aggregator вернул items[0] с реальным price_ton и link → ТОГДА notify() с этой ссылкой

📵 ОДИН notify() ЗА ТИК — АБСОЛЮТНОЕ ПРАВИЛО:
- НИКОГДА не вызывай notify() несколько раз за один тик — это СПАМ
- Объедини все находки в ОДНО сообщение: "Нашёл 3 Lol Pop: cheapest 4.47 на Portals, 4.83 на MRKT..."
- Если пользователь сказал "до X TON" → уведомлять ТОЛЬКО если items[0].price_ton ≤ X
- Если нашёл только дороже чем просили → НЕ нотифицировать, завершить молча

❓ НЕ СПРАШИВАЙ Telegram ID — receiver берётся автоматически из системы

🎯 Оценка КАЧЕСТВА подарка (влияет на цену):
1. ФОНЫ (от дороже к дешевле): Чёрный > Тёмно-синий > Фиолетовый > Другие цветные > Белый/Серый
   - Чёрный фон = наценка 5-50x к коллекционной стоимости
   - ВСЕГДА проверять backdrop у каждого листинга через get_gift_aggregator
2. МОДЕЛИ: чем НИЖЕ drop_rate% — тем редкость выше — тем цена выше
   - Пример: модель с drop_rate 0.5% стоит 3-10x дороже модели с drop_rate 10%
   - Если цена листинга < ожидаемой по редкости модели → недооценён → покупать
3. НОМЕР выпуска (#N): #1-#10 стоят значительно дороже. #100+ — ближе к флору.

🔄 Арбитраж стратегии:
- Оффчейн → Ончейн: купить дёшево на Portals/Mrkt (offchain) → продать на GetGems (onchain) = 10-25% прибыль
- Tonnel дешевле всего → купить там, продать на getgems/mrkt/portals
- Искать недооценённые подарки: чёрный фон или редкая модель по цене флора = 🔥
- Следить за свежими коллекциями: первые листинги обычно дешевле рынка

🛠 ПОЛНЫЙ АРСЕНАЛ ИНСТРУМЕНТОВ (23 gift-инструмента):

📊 АНАЛИТИКА И ОБЗОР РЫНКА:
1. get_top_deals() → ТОП сделки дня (GiftAsset Pro) — начинай мониторинг с этого
2. get_collections_marketcap() → капитализация ВСЕХ коллекций — какие рынки самые большие
3. get_market_health() → greed + health индексы (>70 greed = продавай, <30 = покупай)
4. get_market_activity(gift?, type, markets) → ЛЕНТА покупок/продаж в реалтайме — что покупают ПРЯМО СЕЙЧАС
5. get_price_history(collection_name) → ТРЕНД цен за дни/недели — растёт, падает, стабильна

💰 ОЦЕНКА И ПОИСК ВЫГОДЫ:
6. find_underpriced_gifts(collection, max_price?, min_discount_pct?) → 🔥 ГЛАВНЫЙ ИНСТРУМЕНТ — находит листинги дешевле fair value по backdrop+model
7. get_unique_gift_prices(name) → цены per-variant (backdrop+model combo) — точнее флора коллекции
8. get_backdrop_floors(collection) → флор по цвету фона (чёрный = 5-50x дороже белого)
9. get_attribute_volumes(name) → объём продаж по атрибутам — что реально покупают (ликвидность)
10. get_price_list() → текущие флор-цены ВСЕХ коллекций разом

🔍 ПОИСК КОНКРЕТНЫХ ПРЕДЛОЖЕНИЙ:
11. get_gift_aggregator(name, to_price?, backdrop?, model?) → живые листинги со ВСЕХ маркетов + BOC для покупки
12. scan_real_arbitrage() → кросс-маркет спреды, верифицированные агрегатором
13. get_collection_offers(name) → ГАРАНТИРОВАННЫЕ покупатели (buy offers) — надёжная цена продажи
14. get_gift_floor_real(slug) → флор по всем маркетам отдельно (offchain vs onchain)
15. get_gift_sales_history(slug) → последние сделки конкретной коллекции

🛒 ПОКУПКА И ПРОДАЖА:
16. buy_market_gift(tx_contract, tx_payload, price_ton) → МГНОВЕННАЯ ПОКУПКА (нужен can_buy_now=true)
17. get_agent_wallet() → адрес и баланс кошелька агента
18. send_ton(to, amount) → отправить TON
19. list_gift_for_sale(gift_id, price) → выставить подарок на продажу

📦 ПОРТФОЛИО И ИНФО:
20. get_user_portfolio(username/telegram_id) → портфолио пользователя с оценкой
21. get_gift_upgrade_stats() → статистика апгрейдов
22. analyze_gift_profitability(name) → анализ прибыльности коллекции

⛔ УСТАРЕВШИЕ: scan_arbitrage() — НЕ ИСПОЛЬЗУЙ. Только scan_real_arbitrage().

🧠 ЦЕПОЧКИ АНАЛИЗА (Smart Valuation):

📈 Цепочка "НАЙТИ ВЫГОДУ" (главная для автономных агентов):
1. find_underpriced_gifts(collection, max_price) → сразу получаешь discount% и fair_value
2. Если discount >15% → buy_market_gift() если can_buy_now=true
3. Если discount 10-15% → notify_rich() с деталями для ручной покупки

📊 Цепочка "АНАЛИЗ КОЛЛЕКЦИИ" (перед покупкой):
1. get_price_history(name) → тренд: растёт → покупай, падает → жди
2. get_attribute_volumes(name) → какие backdrop/model самые ликвидные
3. get_backdrop_floors(name) → сколько стоит каждый фон → знаешь fair value
4. get_collection_offers(name) → есть ли гарантированные покупатели (exit strategy)
5. get_market_activity(gift=name, type='buy') → кто покупает прямо сейчас (спрос)

🔄 Цепочка "АРБИТРАЖ" (кросс-маркет):
1. scan_real_arbitrage() → спреды между маркетами
2. get_gift_aggregator(name, to_price) → подтвердить живую цену на cheap-маркете
3. get_collection_offers(name) → подтвердить цену продажи (buy offers)
4. Если spread >8% и offer подтверждён → buy_market_gift()

🌍 Цепочка "ОБЗОР РЫНКА" (для мониторинга):
1. get_collections_marketcap() → крупнейшие коллекции
2. get_market_health() → greed/health → сейчас покупать или продавать?
3. get_top_deals() → лучшие сделки среди ВСЕХ коллекций
4. get_market_activity(type='buy') → реалтайм покупки → где спрос

🛒 ПОТОК ПОКУПКИ (для автономных агентов):
1. find_underpriced_gifts(collection, max_price) → найти самый выгодный item
   ИЛИ get_gift_aggregator(name, to_price=MAX_PRICE) → найти самый дешёвый
2. Если can_buy_now=true → buy_market_gift(tx_contract, tx_payload, price_ton, gift_name)
3. Если can_buy_now=false → notify_rich() с link для ручной покупки
4. Если ничего не найдено → завершить тик молча
[END GIFT KNOWLEDGE]`;

  // Chat mode vs monitoring mode instructions
  const modeHint = msgs.length > 0
    ? `\n\n⚠️ РЕЖИМ ЧАТА: Пользователь написал тебе сообщение. Ответь ТОЛЬКО текстом напрямую — НЕ вызывай инструмент notify(). Твой текстовый ответ будет доставлен автоматически. Используй инструменты только если они нужны для ответа на вопрос.`
    : `\n\n⚠️ РЕЖИМ МОНИТОРИНГА (СКОРОСТЬ КРИТИЧНА): Пользователь не в чате. Действуй быстро:
1. Если в state есть target_gift (конкретная цель) → find_underpriced_gifts(collection=target_gift, max_price=target_price) — УМНЫЙ ПОИСК
   Fallback: get_gift_aggregator(name=target_gift, to_price=target_price) — прямой поиск
2. Если underpriced найдены с discount >15% и can_buy_now=true → buy_market_gift() автоматически
3. Если underpriced найдены но can_buy_now=false → notify_rich() с деталями + link
4. Если ничего не найдено → завершить МОЛЧА
5. Если target_gift не задан → get_top_deals() → если profit >8% → notify с топ-3
ЗАПОМНИ: notify() только если инструмент вернул реальный item. Никаких предположений.`;

  const contextMsg = `[Текущий тик агента]
Время: ${new Date().toISOString()}
Конфиг: ${configSummary || '(пусто)'}${pluginHint}${interAgentHint}
${GIFT_SYSTEM_KNOWLEDGE}${modeHint}
${msgs.length > 0 ? `\nСообщения от пользователя:\n${msgs.map(m => `- ${m}`).join('\n')}` : ''}`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system',    content: params.systemPrompt },
    { role: 'user',      content: contextMsg },
  ];

  // ── Agentic loop (up to 5 iterations) ──────────
  const tools = buildToolDefinitions();
  let totalToolCalls = 0;
  let finalContent: string | undefined;
  _tickNotifyFlag.set(params.agentId, false); // reset flag for this tick

  for (let iter = 0; iter < 5; iter++) {
    let response: OpenAI.ChatCompletion;
    try {
      response = await ai.chat.completions.create({
        model:    (params.config.AI_MODEL as string) || process.env.AI_MODEL || defaultModel,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens:  2048,
      });
    } catch (e: any) {
      const errMsg = `AI call failed: ${e.message}`;
      await logToDb(params.agentId, 'error', errMsg);
      return { toolCallCount: totalToolCalls, error: errMsg };
    }

    const choice    = response.choices[0];
    const assistant = choice.message;
    messages.push(assistant);

    // No tool calls → agent is done
    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      finalContent = assistant.content || undefined;
      break;
    }

    // ── Execute all tool calls in parallel ──────────────────────
    totalToolCalls += assistant.tool_calls.length;
    const toolResults = await Promise.all(
      assistant.tool_calls.map(async (tc) => {
        const f = (tc as any).function as { name: string; arguments: string };
        let toolArgs: Record<string, any>;
        try { toolArgs = JSON.parse(f.arguments || '{}'); }
        catch { toolArgs = {}; }
        await logToDb(params.agentId, 'info', `[tool] ${f.name}(${JSON.stringify(toolArgs).slice(0, 200)})`, params.userId);

        let result: any;
        try {
          result = await executeTool(f.name, toolArgs, params);
        } catch (toolErr: any) {
          result = { error: toolErr.message || 'Tool execution failed' };
        }
        await logToDb(params.agentId, 'info', `[tool_result] ${f.name} → ${JSON.stringify(result).slice(0, 300)}`, params.userId);

        return {
          role:         'tool' as const,
          tool_call_id: tc.id,
          content:      JSON.stringify(result),
        };
      })
    );

    messages.push(...toolResults);
  }

  // ── Notify if there were user messages and AI replied ────────────
  // Only send finalContent if:
  // 1. There IS a text response (finalContent)
  // 2. User sent a message (msgs.length > 0) → this is a chat reply
  // 3. notify() was NOT already called during the tick (prevents duplicates)
  const notifyWasCalled = _tickNotifyFlag.get(params.agentId) === true;
  _tickNotifyFlag.delete(params.agentId); // cleanup

  if (finalContent && msgs.length > 0 && !notifyWasCalled) {
    // Chat reply: send the AI's text response to the user
    await notifyRich(params.userId, {
      text: mdToHtml(finalContent),
      agentId: params.agentId,
      agentName: (params.config?.AGENT_NAME as string) || undefined,
    }).catch(async () => {
      // Fallback to plain notify if rich fails
      if (params.onNotify) await params.onNotify(finalContent!).catch(() => {});
      else await notifyUser(params.userId, finalContent!).catch(() => {});
    });
  }

  await logToDb(params.agentId, 'info', `[AI tick] done, tools=${totalToolCalls}, notified=${notifyWasCalled}`, params.userId);

  return { finalResponse: finalContent, toolCallCount: totalToolCalls };
}

// ── AI Agent Runtime: activate / deactivate ────────────────────────────────

export class AIAgentRuntime {

  // Активировать AI-агента (первый тик сразу + setInterval + immediate on message)
  async activate(opts: {
    agentId:      number;
    userId:       number;
    systemPrompt: string;
    config:       Record<string, any>;
    intervalMs:   number;
    onNotify:     (msg: string) => Promise<void>;
  }): Promise<void> {
    // Stop existing handle if any
    this.deactivate(opts.agentId);

    // Create the handle entry first so the tick closure can reference tickRunning via it
    const entry: ActiveHandle = {
      interval: null as any, // will be set below after setInterval
      tickRunning: false,
      tick: async () => {
        if (entry.tickRunning) { return; } // skip overlapping tick
        entry.tickRunning = true;
        try {
          const pending = popMessages(opts.agentId);
          await runAIAgentTick({
            agentId:        opts.agentId,
            userId:         opts.userId,
            systemPrompt:   opts.systemPrompt,
            config:         opts.config,
            pendingMessages: pending,
            onNotify:       opts.onNotify,
          });
        } catch (e) {
          console.error(`[AI runtime] tick error agent #${opts.agentId}:`, e);
        } finally {
          entry.tickRunning = false;
        }
      },
    };

    // Register before first tick so addMessageToAIAgent can find the handle
    entry.interval = setInterval(entry.tick, opts.intervalMs);
    _activeHandles.set(opts.agentId, entry);

    // First tick immediately
    entry.tick().catch((e) => {
      console.error(`[AI runtime] first tick failed for agent #${opts.agentId}:`, e);
      logToDb(opts.agentId, 'error', `First tick failed: ${(e as any)?.message || String(e)}`, opts.userId);
    });

    console.log(`[AI runtime] Agent #${opts.agentId} activated, interval=${opts.intervalMs}ms`);
  }

  // Деактивировать AI-агента
  deactivate(agentId: number): void {
    const h = _activeHandles.get(agentId);
    if (h) {
      clearInterval(h.interval);
      _activeHandles.delete(agentId);
      console.log(`[AI runtime] Agent #${agentId} deactivated`);
    }
  }

  // Проверить активен ли агент
  isActive(agentId: number): boolean {
    return _activeHandles.has(agentId);
  }

  // Список активных агентов
  getActiveIds(): number[] {
    return [..._activeHandles.keys()];
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _runtime: AIAgentRuntime | null = null;
export function getAIAgentRuntime(): AIAgentRuntime {
  if (!_runtime) _runtime = new AIAgentRuntime();
  return _runtime;
}
