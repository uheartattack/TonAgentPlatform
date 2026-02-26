import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { getOrchestrator, MODEL_LIST, getUserModel, setUserModel, type ModelId } from './agents/orchestrator';
import {
  authSendPhone, authSubmitCode, authSubmitPassword,
  isAuthorized, getAuthState, clearAuthState,
  getGiftFloorPrice, getAllGiftFloors,
} from './fragment-service';
import { initNotifier } from './notifier';
import { getMemoryManager } from './db/memory';
import { getDBTools } from './agents/tools/db-tools';
import { getAgentsRepository } from './db/index';
import { getRunnerAgent } from './agents/sub-agents/runner';
import { agentLastErrors } from './agents/tools/execution-tools';
import { getCodeTools } from './agents/tools/code-tools';
import { pendingBotAuth } from './api-server';
import { getTonConnectManager } from './ton-connect';
import { getPluginManager } from './plugins-system';
import { getUserSettingsRepository, getMarketplaceRepository, getExecutionHistoryRepository } from './db/schema-extensions';
import { getWorkflowEngine } from './agent-cooperation';
import { allAgentTemplates, type AgentTemplate } from './agent-templates';
import {
  generateAgentWallet,
  getWalletBalance,
  getWalletInfo,
  sendAgentTransaction,
  type AgentWallet,
} from './services/TonConnect';
import {
  PLANS,
  getUserSubscription,
  getUserPlan,
  canCreateAgent,
  canGenerateForFree,
  trackGeneration,
  getGenerationsUsed,
  createPayment,
  confirmPayment,
  getPendingPayment,
  verifyTonTransaction,
  formatSubscription,
} from './payments';

const OWNER_ID_NUM = parseInt(process.env.OWNER_ID || '0');

// ============================================================
// MarkdownV2 escaping — все 18 спецсимволов Telegram
// ============================================================
function esc(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

// Безопасный reply — пробуем MarkdownV2, при ошибке — plain text
async function safeReply(ctx: Context, text: string, extra?: object): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'MarkdownV2', ...(extra || {}) });
  } catch (err: any) {
    // При ошибке парсинга — убираем разметку и отправляем plain
    if (err?.response?.error_code === 400) {
      const plain = text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
      // Убираем parse_mode из extra чтобы plain text не парсился
      const plainExtra: any = { ...(extra || {}) };
      delete plainExtra.parse_mode;
      try {
        await ctx.reply(plain, plainExtra);
      } catch {
        // Последний шанс — без extra совсем
        await ctx.reply(plain).catch(() => {});
      }
    } else {
      throw err;
    }
  }
}

// ============================================================
// Анимированный прогресс создания агента
// Обновляет сообщение каждые 7 секунд с новым этапом
// ============================================================
const CREATION_STEPS_RU = [
  { icon: '🔍', label: 'Анализирую задачу' },
  { icon: '🧠', label: 'Разрабатываю алгоритм' },
  { icon: '⚙️', label: 'Пишу код агента' },
  { icon: '🔒', label: 'Проверяю безопасность' },
  { icon: '📡', label: 'Финальная настройка' },
];
const CREATION_STEPS_EN = [
  { icon: '🔍', label: 'Analyzing task' },
  { icon: '🧠', label: 'Designing algorithm' },
  { icon: '⚙️', label: 'Writing agent code' },
  { icon: '🔒', label: 'Security check' },
  { icon: '📡', label: 'Final setup' },
];
// Keep alias for legacy code
const CREATION_STEPS = CREATION_STEPS_RU;

function renderCreationStep(stepIdx: number, scheduleLabel: string, lang: 'ru' | 'en' = 'ru'): string {
  const steps = lang === 'en' ? CREATION_STEPS_EN : CREATION_STEPS_RU;
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const bar = ['▓', '▓', '▓', '▓', '▓'].map((_, i) => i <= stepIdx ? '▓' : '░').join('');
  const pct = Math.round((Math.min(stepIdx, steps.length - 1) / (steps.length - 1)) * 90);
  const schedPrefix = lang === 'en' ? 'Schedule' : 'Расписание';
  return (
    `${step.icon} *${esc(step.label)}\\.\\.\\.*\n\n` +
    `\`${bar}\`  ${pct}%\n\n` +
    `_${schedPrefix}: ${esc(scheduleLabel)}_`
  );
}

async function startCreationAnimation(
  ctx: Context,
  scheduleLabel: string,
  sendNew = false,
): Promise<{ stop: () => void; deleteMsg: () => void }> {
  let stepIdx = 0;
  let msgId: number | undefined;
  const chatId = ctx.chat?.id;

  const text = renderCreationStep(0, scheduleLabel);

  if (sendNew) {
    const sent = await ctx.reply(text, { parse_mode: 'MarkdownV2' }).catch(() => null);
    msgId = sent?.message_id;
  } else {
    // Редактируем уже существующее сообщение колбэка
    await ctx.editMessageText(text, { parse_mode: 'MarkdownV2' }).catch(() => {});
    msgId = ctx.callbackQuery && 'message' in ctx.callbackQuery
      ? ctx.callbackQuery.message?.message_id
      : undefined;
  }

  const lang = getUserLang(chatId as number);
  const stepTimer = setInterval(async () => {
    stepIdx = Math.min(stepIdx + 1, CREATION_STEPS.length - 1);
    if (chatId && msgId) {
      await ctx.telegram.editMessageText(
        chatId, msgId, undefined,
        renderCreationStep(stepIdx, scheduleLabel, lang),
        { parse_mode: 'MarkdownV2' },
      ).catch(() => {});
    }
  }, 3000);

  const typingTimer = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);

  return {
    stop: () => { clearInterval(stepTimer); clearInterval(typingTimer); },
    deleteMsg: () => {
      if (chatId && msgId && sendNew) ctx.telegram.deleteMessage(chatId, msgId).catch(() => {});
    },
  };
}

// Редактировать текущее сообщение (если callback) или отправить новое (если команда)
// Решает проблему спама — callback-кнопки теперь РЕДАКТИРУЮТ сообщение, а не шлют новое
async function editOrReply(ctx: Context, text: string, extra?: object): Promise<void> {
  const chatId = ctx.chat?.id;
  const msgId = ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : undefined;

  if (chatId && msgId) {
    // Callback — пробуем редактировать
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { parse_mode: 'MarkdownV2', ...(extra || {}) } as any);
      return;
    } catch (editErr: any) {
      // Если текст не изменился (400) — не страшно
      if (editErr?.response?.error_code === 400 && editErr?.description?.includes('message is not modified')) return;
      // Иначе пробуем plain text редактирование (без parse_mode)
      try {
        const plain = text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
        const plainExtra: any = { ...(extra || {}) };
        delete plainExtra.parse_mode;
        await ctx.telegram.editMessageText(chatId, msgId, undefined, plain, plainExtra as any);
        return;
      } catch {
        // Fallback — отправляем новым сообщением
      }
    }
  }

  // Не callback (команда/текст) или редактирование не вышло — safeReply
  await safeReply(ctx, text, extra);
}

// Убрать XML теги от Kiro/Claude прокси
function sanitize(text: string): string {
  return text
    .replace(/<[a-zA-Z_][a-zA-Z0-9_]*>[\s\S]*?<\/[a-zA-Z_][a-zA-Z0-9_]*>/g, '')
    .replace(/<[a-zA-Z_][a-zA-Z0-9_]*\s*\/>/g, '')
    .replace(/<[a-zA-Z_][a-zA-Z0-9_]*[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// Бот и меню
// ============================================================
const bot = new Telegraf(process.env.BOT_TOKEN || '');

const MAIN_MENU = Markup.keyboard([
  ['🤖 Мои агенты', '➕ Создать агента'],
  ['🏪 Маркетплейс', '🔌 Плагины', '⚡ Workflow'],
  ['💎 TON Connect', '💳 Подписка', '📊 Статистика'],
  ['👤 Профиль', '❓ Помощь'],
]).resize();

// ============================================================
// Хранилище агентских кошельков (in-memory, будет в БД позже)
// ============================================================
const agentWallets = new Map<number, AgentWallet>();
// Временное хранение ссылок TON Connect (по userId → link)
const tonConnectLinks = new Map<number, string>();

// ============================================================
// Временное хранилище AI-фиксов (userId:agentId → fixedCode)
// ============================================================
const pendingRepairs = new Map<string, string>();

// ============================================================
// State machine для уточняющих вопросов перед созданием агента
// ============================================================
interface PendingAgentCreation {
  description: string;      // исходное описание пользователя
  step: 'schedule';         // текущий шаг диалога
  name?: string;            // пользовательское имя агента (если дал)
}
const pendingCreations = new Map<number, PendingAgentCreation>();

// ============================================================
// State machine для запроса названия агента
// ============================================================
interface PendingNameAsk {
  description: string;
}
const pendingNameAsk = new Map<number, PendingNameAsk>(); // userId → state

const SCHEDULE_LABELS: Record<string, string> = {
  manual:   'вручную',
  '1min':   'каждую минуту',
  '5min':   'каждые 5 минут',
  '15min':  'каждые 15 минут',
  '1hour':  'каждый час',
  '24hours':'каждые 24 часа',
};

// ============================================================
// State machine для переименования агента
// ============================================================
const pendingRenames = new Map<number, number>(); // userId → agentId

// ============================================================
// State machine для редактирования агента (userId → agentId)
// ============================================================
const pendingEdits = new Map<number, number>();

// ============================================================
// Язык пользователя (EN/RU, по умолчанию auto по первому сообщению)
// ============================================================
const userLanguages = new Map<number, 'ru' | 'en'>(); // userId → lang

function detectLang(text: string): 'ru' | 'en' {
  const ruChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  return ruChars >= enChars ? 'ru' : 'en';
}

function getUserLang(userId: number, text?: string): 'ru' | 'en' {
  if (userLanguages.has(userId)) return userLanguages.get(userId)!;
  if (text) {
    const detected = detectLang(text);
    userLanguages.set(userId, detected);
    return detected;
  }
  return 'ru';
}

async function saveUserLang(userId: number, lang: 'ru' | 'en'): Promise<void> {
  userLanguages.set(userId, lang);
  try { await getUserSettingsRepository().set(userId, 'lang', lang); } catch {}
}

async function loadUserLang(userId: number): Promise<'ru' | 'en' | null> {
  if (userLanguages.has(userId)) return userLanguages.get(userId)!;
  try {
    const saved = await getUserSettingsRepository().get(userId, 'lang');
    if (saved === 'ru' || saved === 'en') {
      userLanguages.set(userId, saved);
      return saved;
    }
  } catch {}
  return null;
}

// ============================================================
// State machine для выбора языка при первом /start
// ============================================================
const pendingLangSetup = new Set<number>(); // userId → ждёт выбора языка

// ============================================================
// Профиль пользователя: баланс и вывод
// ============================================================
interface UserProfile {
  balance_ton: number;
  total_earned: number;
  wallet_address: string | null;
  joined_at: string;
}

async function getUserProfile(userId: number): Promise<UserProfile> {
  try {
    const saved = await getUserSettingsRepository().get(userId, 'profile');
    if (saved && typeof saved === 'object') return saved as UserProfile;
  } catch {}
  return { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
}

async function saveUserProfile(userId: number, profile: UserProfile): Promise<void> {
  try { await getUserSettingsRepository().set(userId, 'profile', profile); } catch {}
}

async function addUserBalance(userId: number, amount: number): Promise<UserProfile> {
  const p = await getUserProfile(userId);
  p.balance_ton = Math.max(0, p.balance_ton + amount);
  if (amount > 0) p.total_earned += amount;
  await saveUserProfile(userId, p);
  return p;
}

// pendingWithdrawal: userId → 'enter_address' | 'enter_amount'
const pendingWithdrawal = new Map<number, { step: 'enter_address' | 'enter_amount'; address?: string }>();

// ============================================================
// State machine для настройки переменных шаблона (wizard)
// ============================================================
interface PendingTemplateSetup {
  templateId: string;
  collected: Record<string, string>;   // key → value, already filled
  remaining: string[];                  // placeholder names still to fill
}
const pendingTemplateSetup = new Map<number, PendingTemplateSetup>(); // userId → state

// ============================================================
// State machine для публикации агента в маркетплейс
// ============================================================
interface PendingPublish {
  step: 'name';
  agentId: number;
  price: number; // nanotokens
}
const pendingPublish = new Map<number, PendingPublish>();

// Telegram auth flow state
const pendingTgAuth = new Map<number, 'phone' | 'code' | 'password'>();

// ============================================================
// Определение «мусорного» ввода (ываыва, aaaa, qwerty и т.п.)
// ============================================================
function isGarbageInput(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return true;

  // Нет ни одной буквы — только цифры/символы
  if (!/[a-zA-Zа-яёА-ЯЁ]/.test(t)) return true;

  // Длинные фразы с несколькими словами никогда не мусор
  // (защита от false-positive на технические термины типа "floor price")
  const wordCount = t.trim().split(/\s+/).length;
  if (wordCount >= 4) return false;

  const lower = t.toLowerCase().replace(/\s+/g, '');
  if (lower.length === 0) return true;

  // Одна буква занимает >65% текста (аааа, zzzz)
  if (lower.length >= 4) {
    const counts: Record<string, number> = {};
    for (const c of lower) counts[c] = (counts[c] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / lower.length > 0.65) return true;
  }

  // Ряды клавиатуры: 7+ подряд символов из одного ряда
  // (порог увеличен с 5 до 7 чтобы не ложно срабатывать на английские слова)
  const kbRows = [
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
    'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю',
  ];
  for (const row of kbRows) {
    let run = 0;
    for (const c of lower) {
      if (row.includes(c)) { run++; if (run >= 7) return true; }
      else run = 0;
    }
  }

  // Повторяющийся паттерн из 1–3 символов: ываыва, xoxoxo, абаб
  if (lower.length >= 6 && /^(.{1,3})\1{2,}/.test(lower)) return true;

  // Одно слово без пробелов (>8 символов) с долей гласных < 5%
  if (!t.includes(' ') && t.length > 8) {
    const vowels = (lower.match(/[aeiouаеёиоуыэюя]/g) || []).length;
    if (vowels / lower.length < 0.05) return true;
  }

  return false;
}

// ============================================================
// Middleware — логирование
// ============================================================
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '[callback]';
  if (userId) console.log(`[${new Date().toISOString()}] ${ctx.from?.username || userId}: ${String(text).slice(0, 80)}`);
  return next();
});

// ============================================================
// showWelcome — единый экран приветствия (вызывается из /start и setlang_*)
// ============================================================
async function fetchLiveTonPrice(): Promise<{ usd: number; change24h: number; vol24h: number } | null> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true',
      { signal: AbortSignal.timeout(4000) }
    ) as any;
    const d = await r.json() as any;
    const ton = d['the-open-network'];
    return { usd: ton.usd, change24h: ton.usd_24h_change ?? 0, vol24h: ton.usd_24h_vol ?? 0 };
  } catch { return null; }
}

async function showWelcome(ctx: Context, userId: number, name: string, lang: 'ru' | 'en') {
  // Параллельно: статистика + цена TON
  const [statsResult, priceResult] = await Promise.allSettled([
    getAgentsRepository().getGlobalStats(),
    fetchLiveTonPrice(),
  ]);

  const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
  const price = priceResult.status === 'fulfilled' ? priceResult.value : null;

  const statsLine = stats
    ? (lang === 'ru'
        ? `\n🌍 *Платформа:* ${esc(String(stats.totalAgents))} агентов \\| ${esc(String(stats.activeAgents))} активны\n`
        : `\n🌍 *Platform:* ${esc(String(stats.totalAgents))} agents \\| ${esc(String(stats.activeAgents))} active\n`)
    : '\n';

  // Живая цена TON в приветствии — вау-момент
  let priceLine = '';
  if (price) {
    const arrow = price.change24h >= 0 ? '📈' : '📉';
    const sign = price.change24h >= 0 ? '\\+' : '';
    priceLine =
      `\n💎 *TON сейчас:* $${esc(price.usd.toFixed(2))} ${arrow} ${sign}${esc(price.change24h.toFixed(1))}% за 24ч\n`;
  }

  const examples = lang === 'ru'
    ? [
        '_"Следи за floor price TON Punks и пришли AI\\-прогноз"_',
        '_"Уведоми когда мой кошелёк опустится ниже 5 TON"_',
        '_"Алерт когда цена TON упадёт ниже \\$4"_',
      ]
    : [
        '_"Track TON Punks floor price and send AI forecast"_',
        '_"Alert me when my wallet drops below 5 TON"_',
        '_"Notify me when TON price falls below \\$4"_',
      ];

  const text = lang === 'ru'
    ? `✨ *Добро пожаловать, ${esc(name)}\\!*\n\n` +
      `*TON Agent Platform* \\— пишешь задачу словами,\n` +
      `AI создаёт агента, который работает 24/7\\.` +
      statsLine + priceLine +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💬 *Просто напиши задачу\\. Примеры:*\n\n` +
      examples.map(e => `• ${e}`).join('\n') + '\n\n' +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Агент запустится автоматически через 30 сек`
    : `✨ *Welcome, ${esc(name)}\\!*\n\n` +
      `*TON Agent Platform* \\— describe a task in plain text,\n` +
      `AI creates an agent that runs 24/7\\.` +
      statsLine + priceLine +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💬 *Just type your task\\. Examples:*\n\n` +
      examples.map(e => `• ${e}`).join('\n') + '\n\n' +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Agent auto\\-starts within 30 seconds`;

  await safeReply(ctx, text, MAIN_MENU);
  await ctx.reply(
    lang === 'ru' ? '👇 Или выберите действие:' : '👇 Or choose an action:',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: lang === 'ru' ? '✍️ Написать задачу' : '✍️ Describe task', callback_data: 'create_agent_prompt' },
            { text: '💎 /price', callback_data: 'live_price' },
          ],
          [
            { text: '🏪 Marketplace', callback_data: 'marketplace' },
            { text: lang === 'ru' ? '👤 Профиль' : '👤 Profile', callback_data: 'show_profile' },
          ],
        ],
      },
    }
  );
}

// ============================================================
// /start
// ============================================================
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || ctx.from.username || 'друг';

  // ── Parse deeplink payload ──
  const startPayload = ctx.message.text.split(' ')[1] || '';

  // ── Первый старт: выбор языка ──
  const existingLang = await loadUserLang(userId);
  if (!existingLang && !startPayload) {
    pendingLangSetup.add(userId);
    await ctx.reply(
      `👋 Welcome, ${name}! / Добро пожаловать, ${name}!\n\n` +
      `🌍 Choose your language / Выберите язык:`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🇷🇺 Русский', callback_data: 'setlang_ru' },
            { text: '🇬🇧 English', callback_data: 'setlang_en' },
          ]]
        }
      }
    );
    return;
  }

  // ── Demo deeplink: /start demo_price / demo_nft / demo_wallet ──
  const demoMap: Record<string, { id: string; desc: string; emoji: string }> = {
    demo_price:  { id: 'ton-price-monitor',  emoji: '📊', desc: 'Notify me when TON price reaches $8 — check every 5 minutes' },
    demo_nft:    { id: 'nft-floor-monitor',  emoji: '🎨', desc: 'Monitor NFT collection floor price every hour, alert on 20% drop' },
    demo_wallet: { id: 'low-balance-alert',  emoji: '💎', desc: 'Alert me when TON wallet balance drops below 5 TON, check every 15 min' },
  };
  if (startPayload && demoMap[startPayload]) {
    const demo = demoMap[startPayload];
    await safeReply(ctx,
      `${demo.emoji} *Demo Mode — ${esc(startPayload.replace('demo_','').replace('_',' ').toUpperCase())}*\n\n` +
      `I\'ll create this agent for you instantly\:\n` +
      `_${esc(demo.desc)}_\n\n` +
      `Just tap *Create Agent* below or send me the description\!`
    , {
      reply_markup: {
        inline_keyboard: [[
          { text: `${demo.emoji} Create Agent Now`, callback_data: `create_from_template:${demo.id}` },
          { text: '✏️ Customize', callback_data: 'create_custom' },
        ]]
      }
    });
    return;
  }

  // Реферал с лендинга: /start ref_XXXX
  if (startPayload.startsWith('ref_')) {
    const refSource = startPayload.replace('ref_', '');
    await getMemoryManager().addMessage(userId, 'system', `Пришёл с лендинга: ${refSource}`, {
      type: 'referral', source: refSource,
    }).catch(() => {});
    // Не return — показываем обычное приветствие
  }

  // ── Web dashboard auth via deeplink: /start webauth_TOKEN ──
  if (startPayload.startsWith('webauth_')) {
    const authToken = startPayload.replace('webauth_', '');
    const pending = pendingBotAuth.get(authToken);
    if (pending && pending.pending) {
      // Помечаем как авторизованный
      pendingBotAuth.set(authToken, {
        pending: false,
        userId,
        username: ctx.from.username || '',
        firstName: ctx.from.first_name || '',
        createdAt: pending.createdAt,
      });
      const landingUrl = process.env.LANDING_URL || 'http://localhost:3001';
      await safeReply(ctx,
        `✅ *Авторизация успешна\\!*\n\n` +
        `Привет, ${esc(name)}\\! Вернитесь в браузер — дашборд загружается автоматически\.\n\n` +
        `🌐 ${esc(landingUrl)}/dashboard\.html`
      );
    } else {
      await ctx.reply('❌ Токен авторизации не найден или истёк. Обновите страницу дашборда.');
    }
    return;
  }

  await getMemoryManager().clearHistory(userId);
  const lang = existingLang || 'ru';
  await showWelcome(ctx, userId, name, lang);
});

// ============================================================
// Команды
// ============================================================
bot.command('help', (ctx) => showHelp(ctx));
bot.command('list', (ctx) => showAgentsList(ctx, ctx.from.id));
bot.command('marketplace', (ctx) => showMarketplace(ctx));
bot.command('connect', (ctx) => showTonConnect(ctx));

// ── /price — живая цена TON ──────────────────────────────────
async function sendPriceCard(ctx: Context) {
  const lang = getUserLang(ctx.from?.id || 0);
  await ctx.sendChatAction('typing');
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/the-open-network?localization=false&tickers=false&community_data=false&developer_data=false',
      { signal: AbortSignal.timeout(5000) }
    ) as any;
    const d = await r.json() as any;
    const usd   = d.market_data.current_price.usd as number;
    const chg24 = d.market_data.price_change_percentage_24h as number;
    const vol   = d.market_data.total_volume.usd as number;
    const mcap  = d.market_data.market_cap.usd as number;
    const ath   = d.market_data.ath.usd as number;
    const arrow = chg24 >= 0 ? '📈' : '📉';
    const sign  = chg24 >= 0 ? '\\+' : '';
    const fmtB  = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : `$${(n/1e6).toFixed(0)}M`;
    const now   = new Date().toUTCString().slice(17, 22);

    const text =
      `💎 *TON / USD*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *$${esc(usd.toFixed(4))}*\n` +
      `${arrow} ${sign}${esc(chg24.toFixed(2))}% ${lang === 'ru' ? 'за 24ч' : '24h change'}\n\n` +
      `📊 ${lang === 'ru' ? 'Объём' : 'Volume'} 24h: *${esc(fmtB(vol))}*\n` +
      `🏦 ${lang === 'ru' ? 'Капитализация' : 'Market cap'}: *${esc(fmtB(mcap))}*\n` +
      `🏆 ATH: *$${esc(ath.toFixed(2))}*\n\n` +
      `⏰ ${now} UTC`;

    await safeReply(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          { text: lang === 'ru' ? '🔄 Обновить' : '🔄 Refresh', callback_data: 'live_price' },
          { text: lang === 'ru' ? '🤖 Создать алерт' : '🤖 Create alert', callback_data: 'create_agent_prompt' },
        ]],
      },
    });
  } catch {
    await ctx.reply(lang === 'ru' ? '❌ Не удалось получить цену TON' : '❌ Failed to fetch TON price');
  }
}
bot.command('price', (ctx) => sendPriceCard(ctx));
bot.action('live_price', async (ctx) => { await ctx.answerCbQuery(); await sendPriceCard(ctx); });

// ── /portfolio <address> — снапшот кошелька ──────────────────
bot.command('portfolio', async (ctx) => {
  const lang = getUserLang(ctx.from.id);
  const parts = ctx.message.text.trim().split(/\s+/);
  const addr  = parts[1] || '';

  if (!addr || (!addr.startsWith('EQ') && !addr.startsWith('UQ') && !addr.startsWith('0:'))) {
    await ctx.reply(
      lang === 'ru'
        ? '💼 Использование: `/portfolio EQD4...`\n_Введите адрес TON кошелька_'
        : '💼 Usage: `/portfolio EQD4...`\n_Enter a TON wallet address_',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.sendChatAction('typing');
  try {
    const [infoRes, txRes] = await Promise.allSettled([
      fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${addr}`, { signal: AbortSignal.timeout(5000) }),
      fetch(`https://toncenter.com/api/v2/getTransactions?address=${addr}&limit=1`, { signal: AbortSignal.timeout(5000) }),
    ]);

    let balTON = 0, txCount = '?', lastTx = '—';
    if (infoRes.status === 'fulfilled') {
      const info = await (infoRes.value as any).json() as any;
      if (info.ok) balTON = parseInt(info.result.balance || '0') / 1e9;
    }
    if (txRes.status === 'fulfilled') {
      const txData = await (txRes.value as any).json() as any;
      if (txData.ok && txData.result?.length) {
        const lt = txData.result[0];
        const tsMs = parseInt(lt.utime || '0') * 1000;
        if (tsMs) {
          const diffMin = Math.round((Date.now() - tsMs) / 60000);
          lastTx = diffMin < 60
            ? (lang === 'ru' ? `${diffMin} мин назад` : `${diffMin} min ago`)
            : diffMin < 1440
            ? (lang === 'ru' ? `${Math.round(diffMin/60)} ч назад` : `${Math.round(diffMin/60)}h ago`)
            : (lang === 'ru' ? `${Math.round(diffMin/1440)} дн назад` : `${Math.round(diffMin/1440)}d ago`);
        }
      }
    }

    // Цена TON для USD конвертации
    let usdRate = 0;
    try {
      const pr = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', { signal: AbortSignal.timeout(3000) }) as any;
      usdRate = ((await pr.json()) as any)['the-open-network']?.usd ?? 0;
    } catch {}

    const usdVal = usdRate ? ` ≈ $${esc((balTON * usdRate).toFixed(2))}` : '';
    const short  = addr.slice(0, 6) + '…' + addr.slice(-4);

    const text =
      `👛 *${lang === 'ru' ? 'Кошелёк' : 'Wallet'} ${esc(short)}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *${esc(balTON.toFixed(4))} TON*${usdVal}\n` +
      `🕐 ${lang === 'ru' ? 'Последняя транзакция' : 'Last transaction'}: ${esc(lastTx)}\n` +
      `🔗 \`${esc(addr)}\``;

    await safeReply(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          { text: lang === 'ru' ? '🤖 Следить за балансом' : '🤖 Monitor balance', callback_data: 'create_agent_prompt' },
        ]],
      },
    });
  } catch {
    await ctx.reply(lang === 'ru' ? '❌ Ошибка запроса к TonCenter' : '❌ TonCenter request failed');
  }
});

// ── show_profile callback ─────────────────────────────────────
bot.action('show_profile', async (ctx) => {
  await ctx.answerCbQuery();
  await showProfile(ctx, ctx.from!.id);
});
bot.command('plugins', (ctx) => showPlugins(ctx));
bot.command('workflow', (ctx) => showWorkflows(ctx, ctx.from.id));
bot.command('stats', (ctx) => showStats(ctx, ctx.from.id));
bot.command('sub', (ctx) => showSubscription(ctx));
bot.command('plans', (ctx) => showPlans(ctx));
bot.command('model', (ctx) => showModelSelector(ctx));

// ── /tglogin — авторизация Telegram для Fragment API ──────────────
bot.command('tglogin', async (ctx) => {
  const userId = ctx.from.id;
  const isAuth = await isAuthorized();

  if (isAuth) {
    await ctx.reply(
      '✅ *Telegram уже авторизован*\n\n' +
      'Fragment данные доступны\\. Используй:\n' +
      '• `/gifts` — топ подарков с floor ценами\n' +
      '• Спроси в чате: _"цена jelly bunny на Fragment"_',
      { parse_mode: 'MarkdownV2' }
    );
    return;
  }

  pendingTgAuth.set(userId, 'phone');
  await ctx.reply(
    '📱 *Авторизация Telegram для Fragment*\n\n' +
    'Это нужно для получения реальных floor цен подарков на Fragment\\.\n\n' +
    '⚠️ *Внимание:* бот получит временный доступ к твоему аккаунту для чтения данных подарков\\.\n\n' +
    '📞 Введи номер телефона в формате: `+79991234567`\n\n' +
    '_Для отмены напиши_ `/cancel`',
    { parse_mode: 'MarkdownV2' }
  );
});

// ── /gifts — показать топ подарков Fragment ───────────────────────
bot.command('gifts', async (ctx) => {
  const userId = ctx.from.id;
  await ctx.sendChatAction('typing');

  const isAuth = await isAuthorized();
  if (!isAuth) {
    await ctx.reply(
      '🔑 Для получения данных Fragment нужна авторизация\\.\n\n' +
      'Введи /tglogin чтобы подключить Telegram аккаунт\\.',
      { parse_mode: 'MarkdownV2' }
    );
    return;
  }

  try {
    const gifts = await getAllGiftFloors();

    if (gifts.length === 0) {
      await ctx.reply('📊 Нет данных о подарках на вторичном рынке.');
      return;
    }

    let msg = '🎁 *Fragment Gifts — Floor Prices*\n━━━━━━━━━━━━━━━━━━━━\n\n';
    for (const g of gifts) {
      msg += `${g.emoji} ${esc(g.name)}\n`;
      msg += `  💰 Floor: \`${g.floorStars} ⭐\` ≈ \`${g.floorTon.toFixed(3)} TON\`\n`;
      msg += `  📋 Listed: ${g.listed}+\n\n`;
    }
    msg += `\n_Обновлено: ${esc(new Date().toLocaleTimeString('ru-RU'))} UTC_`;

    await safeReply(ctx, msg, { parse_mode: 'MarkdownV2' });
  } catch (e: any) {
    await ctx.reply('❌ Ошибка получения данных: ' + e.message);
  }
});

// /config — управление пользовательскими переменными
// /config set KEY value
// /config get KEY
// /config list
// /config del KEY
bot.command('config', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(/\s+/).slice(1); // убираем /config
  const sub = args[0]?.toLowerCase();

  const repo = getUserSettingsRepository();

  const getVars = async (): Promise<Record<string, string>> => {
    try {
      const all = await repo.getAll(userId);
      return (all.user_variables as Record<string, string>) || {};
    } catch { return {}; }
  };

  const saveVars = async (vars: Record<string, string>) => {
    await repo.set(userId, 'user_variables', vars);
  };

  if (!sub || sub === 'list') {
    const vars = await getVars();
    const keys = Object.keys(vars);
    if (!keys.length) {
      return safeReply(ctx,
        `📋 *Ваши переменные*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Пока ничего нет\\._\n\n` +
        `Добавьте ключи API, адреса кошельков:\n` +
        `\`/config set WALLET\\_ADDR EQ\\.\\.\\.\`\n\n` +
        `_Переменные доступны в коде агента как \`context\\.config\\.KEY\`_`,
        { parse_mode: 'MarkdownV2' }
      );
    }
    const lines = keys.map(k => `\`${esc(k)}\` \\= \`${esc(String(vars[k]).slice(0, 40))}${vars[k].length > 40 ? '\\.\\.\\.' : ''}\``).join('\n');
    return safeReply(ctx,
      `📋 *Ваши переменные* \\(${esc(String(keys.length))}\\)\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines}\n\n` +
      `_Доступны в агентах как \`context\\.config\\.KEY\`_`,
      { parse_mode: 'MarkdownV2' }
    );
  }

  if (sub === 'set') {
    const key = args[1]?.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const value = args.slice(2).join(' ').trim();
    if (!key || !value) {
      return safeReply(ctx, '❌ Использование: `/config set KEY значение`', { parse_mode: 'MarkdownV2' });
    }
    const vars = await getVars();
    vars[key] = value;
    await saveVars(vars);
    return safeReply(ctx, `✅ Переменная \`${esc(key)}\` сохранена`, { parse_mode: 'MarkdownV2' });
  }

  if (sub === 'get') {
    const key = args[1]?.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key) return safeReply(ctx, '❌ Укажите имя переменной', {});
    const vars = await getVars();
    if (!(key in vars)) return safeReply(ctx, `❌ Переменная \`${esc(key)}\` не найдена`, { parse_mode: 'MarkdownV2' });
    return safeReply(ctx, `\`${esc(key)}\` \\= \`${esc(vars[key])}\``, { parse_mode: 'MarkdownV2' });
  }

  if (sub === 'del' || sub === 'delete' || sub === 'rm') {
    const key = args[1]?.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key) return safeReply(ctx, '❌ Укажите имя переменной', {});
    const vars = await getVars();
    if (!(key in vars)) return safeReply(ctx, `❌ Переменная \`${esc(key)}\` не найдена`, { parse_mode: 'MarkdownV2' });
    delete vars[key];
    await saveVars(vars);
    return safeReply(ctx, `🗑️ Переменная \`${esc(key)}\` удалена`, { parse_mode: 'MarkdownV2' });
  }

  return safeReply(ctx,
    '📋 *Команды /config:*\n\n' +
    '`/config list` — список всех переменных\n' +
    '`/config set KEY значение` — сохранить переменную\n' +
    '`/config get KEY` — получить значение\n' +
    '`/config del KEY` — удалить переменную\n\n' +
    'Переменные автоматически доступны в агентах как `context\\.config\\.KEY`',
    { parse_mode: 'MarkdownV2' }
  );
});

// /publish — запустить кнопочный флоу публикации
bot.command('publish', async (ctx) => {
  const userId = ctx.from.id;
  await startPublishFlow(ctx, userId);
});

// /mypurchases — мои покупки
bot.command('mypurchases', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const purchases = await getMarketplaceRepository().getMyPurchases(userId);
    if (!purchases.length) {
      return safeReply(ctx,
        '🛒 *Мои покупки*\n\nПокупок пока нет\\.\n\nНайдите агентов в /marketplace',
        { parse_mode: 'MarkdownV2' }
      );
    }
    let text = `🛒 *Мои покупки \\(${esc(purchases.length)}\\):*\n\n`;
    purchases.slice(0, 10).forEach(p => {
      const type = p.type === 'free' ? '🆓' : p.type === 'rent' ? '📅' : '💰';
      text += `${type} Листинг #${esc(p.listingId)} → агент #${esc(p.agentId)}\n`;
    });
    const btns = purchases.slice(0, 8).map((p: any) => [
      { text: `#${p.agentId} → запустить`, callback_data: `run_agent:${p.agentId}` }
    ]);
    await safeReply(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: btns },
    });
  } catch (e: any) {
    await safeReply(ctx, `❌ Ошибка: ${esc(e.message)}`, { parse_mode: 'MarkdownV2' });
  }
});

// /mylistings — мои листинги (что я продаю)
bot.command('mylistings', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const listings = await getMarketplaceRepository().getMyListings(userId);
    if (!listings.length) {
      return safeReply(ctx,
        '📤 *Мои листинги*\n\nВы ещё ничего не публиковали\\.\n\nНажмите кнопку ниже чтобы опубликовать агента:',
        { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '📤 Опубликовать агента', callback_data: 'mkt_publish_help' }]] } }
      );
    }
    let text = `📤 *Мои листинги \\(${esc(listings.length)}\\):*\n\n`;
    listings.forEach((l: any) => {
      const status = l.isActive ? '✅' : '❌';
      const price = l.isFree ? 'Бесплатно' : (l.price / 1e9).toFixed(2) + ' TON';
      text += `${status} #${esc(l.id)} *${esc(l.name)}* — ${esc(price)} — ${esc(l.totalSales)} продаж\n`;
    });
    await safeReply(ctx, text, { parse_mode: 'MarkdownV2' });
  } catch (e: any) {
    await safeReply(ctx, `❌ Ошибка: ${esc(e.message)}`, { parse_mode: 'MarkdownV2' });
  }
});

bot.command('wallet', async (ctx) => {
  const userId = ctx.from.id;
  let wallet = agentWallets.get(userId);
  if (!wallet) {
    await ctx.reply('⏳ Генерирую кошелёк агента...');
    wallet = await generateAgentWallet();
    agentWallets.set(userId, wallet);
  }
  const balance = await getWalletBalance(wallet.address);
  const info = await getWalletInfo(wallet.address);
  const state = (info?.result?.account_state as string) || 'uninitialized';
  const text =
    `💼 *Кошелёк агента*\n\n` +
    `Адрес: \`${esc(wallet.address)}\`\n` +
    `Баланс: *${esc(balance.toFixed(4))}* TON\n` +
    `Статус: ${esc(state)}\n\n` +
    `⚠️ *Сохраните мнемонику\\:*\n\`${esc(wallet.mnemonic.slice(0, 60))}\\.\\.\\.\`\n\n` +
    'Пополните на 0\\.1 TON для активации\\. Используйте /send\\_agent для транзакций\\.';
  await safeReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Обновить баланс', callback_data: 'wallet_refresh' }],
        [{ text: '💸 Отправить TON', callback_data: 'wallet_send' }],
      ],
    },
  });
});

bot.command('send_agent', async (ctx) => {
  const args = ctx.message.text.replace('/send_agent', '').trim().split(' ');
  const to = args[0];
  const amount = parseFloat(args[1]);
  const comment = args.slice(2).join(' ') || '';
  if (!to || isNaN(amount) || amount <= 0) {
    await ctx.reply('Использование: `/send_agent АДРЕС СУММА [комментарий]`\nПример: `/send_agent EQD... 1.5 Зарплата`', { parse_mode: 'Markdown' });
    return;
  }
  const wallet = agentWallets.get(ctx.from.id);
  if (!wallet) {
    await ctx.reply('❌ Нет кошелька агента. Создайте через /wallet');
    return;
  }
  const balance = await getWalletBalance(wallet.address);
  if (balance < amount + 0.01) {
    await ctx.reply(`❌ Недостаточно TON. Баланс: ${balance.toFixed(4)} TON, нужно: ${(amount + 0.01).toFixed(4)} TON`);
    return;
  }
  await ctx.reply(`⏳ Отправляю ${amount} TON...`);
  try {
    const result = await sendAgentTransaction(wallet, to, amount, comment);
    const hash = result?.result?.hash || result?.result || 'pending';
    const hashStr = typeof hash === 'string' ? hash : JSON.stringify(hash);
    await safeReply(ctx,
      `✅ *Транзакция отправлена\\!*\n\nСумма: *${esc(amount)}* TON\nКому: \`${esc(to.slice(0, 20))}\\.\\.\\.\`\nHash: \`${esc(hashStr.slice(0, 40))}\``,
    );
  } catch (e: any) {
    await ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

// /send — отправить TON через подключённый Tonkeeper (TON Connect)
bot.command('send', async (ctx) => {
  const args = ctx.message.text.replace('/send', '').trim().split(/\s+/);
  const to = args[0];
  const amount = parseFloat(args[1] || '');
  const comment = args.slice(2).join(' ') || '';
  if (!to || isNaN(amount) || amount <= 0) {
    await ctx.reply(
      '💸 *Отправить TON через Tonkeeper*\n\nФормат:\n`/send АДРЕС СУММА [комментарий]`\n\nПример:\n`/send EQD...abc 5 Оплата услуг`\n\n_Транзакция подтверждается в Tonkeeper_',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  const tonConn = getTonConnectManager();
  if (!tonConn.isConnected(ctx.from.id)) {
    await ctx.reply('❌ TON кошелёк не подключён.\n\nПодключите через 💎 TON Connect → /connect');
    return;
  }
  const bal = await tonConn.getBalance(ctx.from.id);
  if (parseFloat(bal.ton) < amount + 0.05) {
    await ctx.reply(`❌ Недостаточно TON.\nБаланс: ${bal.ton} TON\nНужно: ~${(amount + 0.05).toFixed(2)} TON (включая ~0.05 комиссию)`);
    return;
  }
  await ctx.reply(`⏳ Запрашиваю подтверждение в Tonkeeper...\n\n💸 Отправляю: ${amount} TON → \`${to.slice(0, 24)}...\`\n\n_Откройте Tonkeeper и подтвердите_`, { parse_mode: 'Markdown' });
  try {
    const result = await tonConn.sendTon(ctx.from.id, to, amount, comment || undefined);
    if (result.success) {
      await safeReply(ctx,
        `✅ *Транзакция отправлена\\!*\n\n` +
        `Сумма: *${esc(amount.toFixed(4))}* TON\n` +
        `Кому: \`${esc(to.slice(0, 24))}\\.\\.\\.\`\n` +
        (comment ? `Комментарий: _${esc(comment)}_\n` : '') +
        `\nBoC: \`${esc((result.boc || 'pending').slice(0, 40))}\\.\\.\\.\``,
      );
    } else if (result.needsReconnect) {
      await ctx.reply(`❌ ${result.error}\n\nНажмите 💎 TON Connect чтобы переподключиться.`);
    } else {
      await ctx.reply(`❌ ${result.error || 'Транзакция отменена'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ Ошибка отправки: ${e.message || 'Неизвестная ошибка'}`);
  }
});

bot.command('run', async (ctx) => {
  const id = ctx.message.text.replace('/run', '').trim();
  if (!id || isNaN(parseInt(id))) {
    await ctx.reply('Использование: `/run_1` (кликабельная команда)\nПример: `/run_1` или `/run_5`', { parse_mode: 'Markdown' });
    return;
  }
  await runAgentDirect(ctx, parseInt(id), ctx.from.id);
});

// Кликабельный формат /run_ID (задача 5: без пробела для удобства)
bot.hears(/^\/run_(\d+)$/, async (ctx) => {
  const agentId = parseInt((ctx.match as RegExpMatchArray)[1]);
  await runAgentDirect(ctx, agentId, ctx.from.id);
});

bot.command('create', async (ctx) => {
  const desc = ctx.message.text.replace('/create', '').trim();
  if (!desc) {
    await ctx.reply('Использование: `/create описание агента`', { parse_mode: 'Markdown' });
    return;
  }
  await ctx.sendChatAction('typing');
  const result = await getOrchestrator().processMessage(ctx.from.id, `создай агента для ${desc}`);
  await sendResult(ctx, result);
});

// ============================================================
// Нижнее меню (кнопки)
// ============================================================
bot.hears('🤖 Мои агенты', (ctx) => showAgentsList(ctx, ctx.from.id));
bot.hears('➕ Создать агента', (ctx) =>
  safeReply(ctx,
    `✨ *Создание агента*\n\n` +
    `Опишите задачу своими словами — AI сам напишет код\n` +
    `и запустит агента на нашем сервере\\.\n\n` +
    `*Примеры задач:*\n` +
    `💎 _"Проверяй баланс UQB5\\.\\.\\. каждый час"_\n` +
    `📈 _"Следи за ценой TON, уведоми если выше 5\\$"_\n` +
    `💸 _"Каждое 10\\-е число отправляй 100 TON на UQ\\.\\.\\."_\n` +
    `🌐 _"Проверяй доступность сайта каждые 5 минут"_\n` +
    `📊 _"Получай курс BTC каждое утро в 9:00"_\n\n` +
    `👇 *Напишите вашу задачу:*`,
    MAIN_MENU
  )
);
bot.hears('🏪 Маркетплейс', (ctx) => showMarketplace(ctx));
bot.hears('🔌 Плагины', (ctx) => showPlugins(ctx));
bot.hears('⚡ Workflow', (ctx) => showWorkflows(ctx, ctx.from.id));
bot.hears('💎 TON Connect', (ctx) => showTonConnect(ctx));
bot.hears('💳 Подписка', (ctx) => showSubscription(ctx));
bot.hears('📊 Статистика', (ctx) => showStats(ctx, ctx.from.id));
bot.hears('❓ Помощь', (ctx) => showHelp(ctx));
// ── Выбор языка (callback при первом /start) ──
bot.action(/^setlang_(ru|en)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const lang = (ctx.match[1] as 'ru' | 'en');
  const userId = ctx.from!.id;
  await saveUserLang(userId, lang);
  pendingLangSetup.delete(userId);

  // Показываем профиль при создании
  const profile = await getUserProfile(userId);
  if (!profile.joined_at || profile.joined_at === new Date().toISOString().slice(0, 10)) {
    await saveUserProfile(userId, { ...profile, joined_at: new Date().toISOString() });
  }

  const name = ctx.from!.first_name || ctx.from!.username || (lang === 'ru' ? 'друг' : 'friend');
  if (lang === 'ru') {
    await ctx.editMessageText(
      `✅ Язык: Русский 🇷🇺\n\nОтлично, ${name}! Пишу /start...`
    ).catch(() => {});
  } else {
    await ctx.editMessageText(
      `✅ Language: English 🇬🇧\n\nGreat, ${name}! Sending /start...`
    ).catch(() => {});
  }
  // Эмулируем /start в выбранном языке
  await showWelcome(ctx as any, userId, name, lang);
});

// ── Профиль пользователя ──
bot.hears('👤 Профиль', async (ctx) => showProfile(ctx, ctx.from.id));
bot.command('profile', async (ctx) => showProfile(ctx, ctx.from.id));

async function showProfile(ctx: Context, userId: number) {
  const lang = getUserLang(userId);
  const profile = await getUserProfile(userId);
  const agents = await getDBTools().getUserAgents(userId).catch(() => ({ data: [] }));
  const agentList = (agents as any).data || [];
  const activeCount = agentList.filter((a: any) => a.isActive).length;
  const totalCount = agentList.length;

  let statsLine = '';
  try {
    const execStats = await getExecutionHistoryRepository().getStats(userId);
    if (execStats) statsLine = `\n✅ *${esc(String(execStats.totalRuns))}* ${lang === 'ru' ? 'запусков всего' : 'total runs'}`;
  } catch {}

  const joined = profile.joined_at ? new Date(profile.joined_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const walletLine = profile.wallet_address
    ? `\n🔗 ${lang === 'ru' ? 'Кошелёк:' : 'Wallet:'} \`${esc(profile.wallet_address.slice(0,10))}…\``
    : `\n🔗 ${lang === 'ru' ? 'Кошелёк не привязан' : 'No wallet linked'}`;

  const text =
    `👤 *${lang === 'ru' ? 'Профиль' : 'Profile'} — ${esc(ctx.from?.first_name || 'User')}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *${lang === 'ru' ? 'Баланс' : 'Balance'}:* ${esc(profile.balance_ton.toFixed(2))} TON\n` +
    `📈 *${lang === 'ru' ? 'Заработано' : 'Earned'}:* ${esc(profile.total_earned.toFixed(2))} TON\n` +
    `🤖 *${lang === 'ru' ? 'Агентов' : 'Agents'}:* ${esc(String(totalCount))} \\(${esc(String(activeCount))} ${lang === 'ru' ? 'активных' : 'active'}\\)` +
    statsLine +
    walletLine +
    `\n📅 *${lang === 'ru' ? 'С нами с' : 'Member since'}:* ${esc(joined)}\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  await safeReply(ctx, text, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'ru' ? '💸 Вывести' : '💸 Withdraw', callback_data: 'withdraw_start' },
          { text: lang === 'ru' ? '🔗 Привязать кошелёк' : '🔗 Link wallet', callback_data: 'profile_link_wallet' },
        ],
        [
          { text: lang === 'ru' ? '🌐 Сменить язык' : '🌐 Change language', callback_data: 'profile_change_lang' },
        ],
      ],
    },
  });
}

// ── Withdraw flow ──
bot.action('withdraw_start', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  const profile = await getUserProfile(userId);

  if (profile.balance_ton < 0.1) {
    await ctx.reply(lang === 'ru'
      ? '❌ Недостаточно TON для вывода (минимум 0.1 TON)'
      : '❌ Insufficient balance (minimum 0.1 TON)'
    );
    return;
  }

  if (profile.wallet_address) {
    // Уже привязан — сразу спрашиваем сумму
    pendingWithdrawal.set(userId, { step: 'enter_amount', address: profile.wallet_address });
    await ctx.reply(
      lang === 'ru'
        ? `💸 *Вывод TON*\n\nКошелёк: \`${profile.wallet_address.slice(0,12)}…\`\nДоступно: *${profile.balance_ton.toFixed(2)} TON*\n\nВведите сумму для вывода:`
        : `💸 *Withdraw TON*\n\nWallet: \`${profile.wallet_address.slice(0,12)}…\`\nAvailable: *${profile.balance_ton.toFixed(2)} TON*\n\nEnter amount:`,
      { parse_mode: 'Markdown' }
    );
  } else {
    pendingWithdrawal.set(userId, { step: 'enter_address' });
    await ctx.reply(
      lang === 'ru'
        ? `💸 *Вывод TON*\n\nДоступно: *${profile.balance_ton.toFixed(2)} TON*\n\nВведите адрес TON кошелька (EQ...):`
        : `💸 *Withdraw TON*\n\nAvailable: *${profile.balance_ton.toFixed(2)} TON*\n\nEnter your TON wallet address (EQ...):`,
      { parse_mode: 'Markdown' }
    );
  }
});

bot.action('profile_link_wallet', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  pendingWithdrawal.set(userId, { step: 'enter_address' });
  await ctx.reply(
    lang === 'ru'
      ? '🔗 Введите адрес вашего TON кошелька (EQ...) для привязки:'
      : '🔗 Enter your TON wallet address (EQ...) to link:'
  );
});

bot.action('profile_change_lang', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '🌍 Choose language / Выберите язык:',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🇷🇺 Русский', callback_data: 'setlang_ru' },
          { text: '🇬🇧 English', callback_data: 'setlang_en' },
        ]]
      }
    }
  );
});

// ============================================================
// Колбэки для диалога "как назвать агента?"
// ============================================================
bot.action('skip_agent_name', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const pna = pendingNameAsk.get(userId);
  if (!pna) {
    await ctx.editMessageText('❌ Сессия устарела. Напишите задачу снова.').catch(() => {});
    return;
  }
  pendingNameAsk.delete(userId);
  // Переходим к шагу расписания (имя не задано → придумает AI/шаблон)
  const previewTask = pna.description.replace(/[_*`[\]]/g, '').slice(0, 55) + (pna.description.length > 55 ? '…' : '');
  pendingCreations.set(userId, { description: pna.description, step: 'schedule' });
  await ctx.editMessageText(
    `⏰ *Как часто запускать агента?*\n\n📝 _"${previewTask}"_\n\n👇 Выберите расписание:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ Вручную (по кнопке)', callback_data: 'agent_schedule:manual' }],
          [{ text: '🔁 Каждую минуту', callback_data: 'agent_schedule:1min' }, { text: '⚡ Каждые 5 мин', callback_data: 'agent_schedule:5min' }],
          [{ text: '⏱ Каждые 15 мин', callback_data: 'agent_schedule:15min' }, { text: '🕐 Каждый час', callback_data: 'agent_schedule:1hour' }],
          [{ text: '📅 Раз в сутки', callback_data: 'agent_schedule:24hours' }, { text: '❌ Отмена', callback_data: 'agent_schedule:cancel' }],
        ],
      },
    }
  ).catch(() => {});
});

bot.action('cancel_name_ask', async (ctx) => {
  await ctx.answerCbQuery();
  pendingNameAsk.delete(ctx.from.id);
  await ctx.editMessageText('❌ Создание агента отменено. Напишите задачу снова когда будете готовы.').catch(() => {});
});

// ============================================================
// Меню агента (regex)
// ============================================================
bot.action(/^agent_menu:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await showAgentMenu(ctx, parseInt(ctx.match[1]), ctx.from.id);
});

// ============================================================
// Уточняющий диалог: выбор расписания перед созданием агента
// ============================================================
bot.action(/^agent_schedule:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const choice = ctx.match[1];

  if (choice === 'cancel') {
    pendingCreations.delete(userId);
    await ctx.editMessageText('❌ Создание агента отменено. Напишите задачу снова когда будете готовы.').catch(() => {});
    return;
  }

  const pending = pendingCreations.get(userId);
  if (!pending) {
    await ctx.editMessageText('❌ Сессия создания устарела. Напишите задачу снова.').catch(() => {});
    return;
  }

  // Обогащаем описание информацией о расписании
  let desc = pending.description;
  if (choice !== 'manual') {
    desc += `\n\nЗапускать ${SCHEDULE_LABELS[choice] || choice}.`;
  }
  const userAgentName = pending.name; // может быть undefined
  pendingCreations.delete(userId);
  const schedLabel = SCHEDULE_LABELS[choice] || choice;

  // Убираем клавиатуру с кнопками расписания — заменяем на статус
  await ctx.editMessageText(
    `⏰ *${esc(schedLabel)}* — принято\\!\n\n_Разрабатываю агента\\.\\.\\._`,
    { parse_mode: 'MarkdownV2' }
  ).catch(() => {});

  // Показываем анимацию НОВЫМ сообщением (sendNew=true) → потом удалим перед квитанцией
  const anim = await startCreationAnimation(ctx, schedLabel, true);

  try {
    const result = await getOrchestrator().processMessage(userId, desc, ctx.from.username, userAgentName);
    anim.stop();
    anim.deleteMsg(); // Убираем анимацию — квитанция появляется чисто
    await sendResult(ctx, result);
  } catch (err) {
    anim.stop();
    anim.deleteMsg();
    console.error('[bot] agent_schedule create error:', err);
    await ctx.reply('❌ Ошибка создания агента. Попробуйте ещё раз.').catch(() => {});
  }
});

// ============================================================
// Callback-кнопки
// ============================================================
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const cbq = ctx.callbackQuery;
  if (!('data' in cbq) || !cbq.data) {
    await ctx.answerCbQuery('Нет данных');
    return;
  }
  const data = cbq.data;

  // ── Маркетплейс ──
  if (data === 'marketplace') { await ctx.answerCbQuery(); await showMarketplace(ctx); return; }
  if (data === 'marketplace_all') { await ctx.answerCbQuery(); await showMarketplaceAll(ctx); return; }
  if (data.startsWith('marketplace_cat:')) {
    await ctx.answerCbQuery();
    const cat = data.split(':')[1] as AgentTemplate['category'];
    await showMarketplaceCategory(ctx, cat);
    return;
  }
  if (data.startsWith('template:')) {
    await ctx.answerCbQuery('Загружаю шаблон...');
    await showTemplateDetails(ctx, data.split(':')[1]);
    return;
  }
  if (data.startsWith('create_from_template:')) {
    await ctx.answerCbQuery('Создаю агента...');
    await createAgentFromTemplate(ctx, data.split(':')[1], userId);
    return;
  }

  // ── Пользовательский маркетплейс ──
  if (data === 'mkt_community') {
    await ctx.answerCbQuery('Загружаю...');
    await showCommunityListings(ctx);
    return;
  }
  if (data === 'mkt_publish_help') {
    await ctx.answerCbQuery('Загружаю агентов...');
    await startPublishFlow(ctx, userId);
    return;
  }

  // ── Кнопочный флоу публикации ──
  if (data === 'publish_cancel') {
    await ctx.answerCbQuery('Отменено');
    pendingPublish.delete(userId);
    await showMarketplace(ctx);
    return;
  }
  if (data.startsWith('publish_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      await ctx.reply('❌ Агент не найден или не принадлежит вам');
      return;
    }
    const aName = esc(agentResult.data.name || `Агент #${agentId}`);
    await editOrReply(ctx,
      `📤 *Публикация: ${aName}*\n\nВыберите цену:`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🆓 Бесплатно', callback_data: `publish_price:${agentId}:0` },
              { text: '0.5 TON', callback_data: `publish_price:${agentId}:500000000` },
            ],
            [
              { text: '1 TON', callback_data: `publish_price:${agentId}:1000000000` },
              { text: '2 TON', callback_data: `publish_price:${agentId}:2000000000` },
            ],
            [
              { text: '5 TON', callback_data: `publish_price:${agentId}:5000000000` },
              { text: '10 TON', callback_data: `publish_price:${agentId}:10000000000` },
            ],
            [
              { text: '◀️ Назад', callback_data: 'mkt_publish_help' },
              { text: '❌ Отмена', callback_data: 'publish_cancel' },
            ],
          ],
        },
      }
    );
    return;
  }
  if (data.startsWith('publish_price:')) {
    await ctx.answerCbQuery();
    const parts = data.split(':');
    const agentId = parseInt(parts[1]);
    const priceNano = parseInt(parts[2]);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      await ctx.reply('❌ Агент не найден или не принадлежит вам');
      return;
    }
    const aName = agentResult.data.name || `Агент #${agentId}`;
    const priceStr = priceNano === 0 ? 'Бесплатно' : (priceNano / 1e9).toFixed(2) + ' TON';
    await editOrReply(ctx,
      `📤 *Подтверждение публикации*\n\n` +
      `🤖 Агент: *${esc(aName)}*\n` +
      `💰 Цена: *${esc(priceStr)}*\n` +
      `📋 Название листинга: _${esc(aName)}_\n\n` +
      `Покупатели смогут *запускать* агента, но не увидят ваш код\\.`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: `✅ Опубликовать`, callback_data: `publish_confirm:${agentId}:${priceNano}` }],
            [{ text: `✏️ Изменить название`, callback_data: `publish_setname:${agentId}:${priceNano}` }],
            [
              { text: '◀️ Назад', callback_data: `publish_agent:${agentId}` },
              { text: '❌ Отмена', callback_data: 'publish_cancel' },
            ],
          ],
        },
      }
    );
    return;
  }
  if (data.startsWith('publish_confirm:')) {
    await ctx.answerCbQuery('Публикую...');
    const parts = data.split(':');
    const agentId = parseInt(parts[1]);
    const priceNano = parseInt(parts[2]);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      await ctx.reply('❌ Агент не найден');
      return;
    }
    const name = agentResult.data.name || `Агент #${agentId}`;
    await doPublishAgent(ctx, userId, agentId, priceNano, name);
    return;
  }
  if (data.startsWith('publish_setname:')) {
    await ctx.answerCbQuery();
    const parts = data.split(':');
    const agentId = parseInt(parts[1]);
    const priceNano = parseInt(parts[2]);
    pendingPublish.set(userId, { step: 'name', agentId, price: priceNano });
    await editOrReply(ctx,
      `✏️ *Введите название листинга*\n\n` +
      `Напишите название агента для маркетплейса \\(до 60 символов\\):`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'publish_cancel' }]] },
      }
    );
    return;
  }

  // ── Мои листинги / мои покупки (callback-версии) ──
  if (data === 'mkt_mylistings') {
    await ctx.answerCbQuery();
    const listings = await getMarketplaceRepository().getMyListings(userId).catch(() => []);
    if (!listings.length) {
      await editOrReply(ctx,
        '📤 *Мои листинги*\n\nВы ещё ничего не публиковали\\.',
        { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '📤 Опубликовать', callback_data: 'mkt_publish_help' }, { text: '◀️ Маркетплейс', callback_data: 'marketplace' }]] } }
      );
      return;
    }
    let text = `📤 *Мои листинги \\(${esc(listings.length)}\\):*\n\n`;
    listings.forEach((l: any) => {
      const status = l.isActive ? '✅' : '❌';
      const price = l.isFree ? 'Бесплатно' : (l.price / 1e9).toFixed(2) + ' TON';
      text += `${status} \\#${esc(l.id)} *${esc(l.name)}* — ${esc(price)} — ${esc(l.totalSales)} продаж\n`;
    });
    await editOrReply(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: [
        [{ text: '📤 Опубликовать ещё', callback_data: 'mkt_publish_help' }],
        [{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }],
      ]},
    });
    return;
  }
  if (data === 'mkt_mypurchases') {
    await ctx.answerCbQuery();
    const purchases = await getMarketplaceRepository().getMyPurchases(userId).catch(() => []);
    if (!purchases.length) {
      await editOrReply(ctx,
        '🛒 *Мои покупки*\n\nПокупок пока нет\\.',
        { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '👥 Сообщество', callback_data: 'mkt_community' }, { text: '◀️ Маркетплейс', callback_data: 'marketplace' }]] } }
      );
      return;
    }
    let text = `🛒 *Мои покупки \\(${esc(purchases.length)}\\):*\n\n`;
    purchases.slice(0, 10).forEach((p: any) => {
      const type = p.type === 'free' ? '🆓' : p.type === 'rent' ? '📅' : '💰';
      text += `${type} Листинг \\#${esc(p.listingId)} → агент \\#${esc(p.agentId)}\n`;
    });
    const btns = purchases.slice(0, 8).map((p: any) => [
      { text: `▶️ Агент #${p.agentId}`, callback_data: `run_agent:${p.agentId}` }
    ]);
    btns.push([{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }]);
    await editOrReply(ctx, text, { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: btns } });
    return;
  }

  if (data.startsWith('mkt_buy:')) {
    await ctx.answerCbQuery('Оформляю покупку...');
    const listingId = parseInt(data.split(':')[1]);
    await buyMarketplaceListing(ctx, listingId, userId);
    return;
  }
  if (data.startsWith('mkt_view:')) {
    await ctx.answerCbQuery();
    const listingId = parseInt(data.split(':')[1]);
    await showListingDetail(ctx, listingId, userId);
    return;
  }

  // ── TON Connect ──
  if (data === 'ton_connect' || data === 'ton_connect_menu') { await ctx.answerCbQuery(); await showTonConnect(ctx); return; }
  if (data === 'ton_refresh') {
    await ctx.answerCbQuery('Обновляю...');
    await showTonConnect(ctx);
    return;
  }
  if (data === 'ton_send') {
    await ctx.answerCbQuery();
    await ctx.reply(
      '💸 *Отправить TON*\n\nФормат:\n`/send АДРЕС СУММА [комментарий]`\n\nПример:\n`/send EQD...abc 10 Оплата услуг`\n\n_Транзакцию нужно подтвердить в Tonkeeper_',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  if (data === 'ton_history') {
    await ctx.answerCbQuery('Загружаю...');
    const tonConn = getTonConnectManager();
    const hist = await tonConn.getTransactions(userId, 10);
    if (!hist.ok) { await ctx.reply(`❌ ${hist.error}`); return; }
    const txs = hist.txs || [];
    if (!txs.length) { await ctx.reply('📭 История транзакций пуста'); return; }
    let txt = `📋 *История транзакций*\n\n`;
    txs.forEach((tx: any, i: number) => {
      const date = new Date(tx.time * 1000).toLocaleDateString('ru-RU');
      const dir = tx.isOutgoing ? '⬆️' : '⬇️';
      const counterpart = tx.isOutgoing
        ? (tx.to ? tx.to.slice(0, 8) + '...' : '?')
        : (tx.from ? tx.from.slice(0, 8) + '...' : '?');
      txt += `${esc(i + 1)}\\. ${esc(date)} ${dir} *${esc(tx.amount)}* TON`;
      txt += ` _${esc(tx.isOutgoing ? 'to' : 'from')} ${esc(counterpart)}_`;
      if (tx.comment) txt += `\n   💬 _${esc(tx.comment.slice(0, 30))}_`;
      txt += '\n';
    });
    await safeReply(ctx, txt);
    return;
  }
  if (data === 'ton_disconnect') {
    await ctx.answerCbQuery('Отключаю...');
    await getTonConnectManager().disconnect(userId);
    await ctx.reply('🔌 TON Connect отключён');
    return;
  }
  if (data === 'ton_get_link') {
    await ctx.answerCbQuery();
    const link = tonConnectLinks.get(userId) || '';
    if (!link) { await ctx.reply('❌ Ссылка устарела, нажмите 💎 TON Connect снова'); return; }
    await ctx.reply(`🔗 Ссылка для подключения (откройте в браузере или скопируйте):\n\n${link}`, { link_preview_options: { is_disabled: true } });
    return;
  }

  // ── Кошелёк агента (offline, без TC) ──
  if (data === 'create_agent_wallet') {
    await ctx.answerCbQuery();
    let wallet = agentWallets.get(userId);
    if (!wallet) {
      await ctx.reply('⏳ Генерирую агентский кошелёк...');
      wallet = await generateAgentWallet();
      agentWallets.set(userId, wallet);
    }
    const balance = await getWalletBalance(wallet.address);
    await ctx.reply(
      `💼 Агентский кошелёк создан!\n\n` +
      `Адрес: ${wallet.address}\n` +
      `Баланс: ${balance.toFixed(4)} TON\n\n` +
      `⚠️ Сохраните мнемонику:\n${wallet.mnemonic.slice(0, 60)}...\n\n` +
      `Пополните на 0.1 TON для активации.\n` +
      `Команда: /send_agent АДРЕС СУММА`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Обновить баланс', callback_data: 'wallet_refresh' }],
            [{ text: '💸 Отправить TON', callback_data: 'wallet_send' }],
          ],
        },
      }
    );
    return;
  }

  // ── Обновить баланс кошелёка ──
  if (data === 'wallet_refresh') {
    await ctx.answerCbQuery('Обновляю...');
    const w = agentWallets.get(userId);
    if (w) {
      const bal = await getWalletBalance(w.address);
      await ctx.reply(`💼 Баланс агента: *${bal.toFixed(4)} TON*\nАдрес: \`${w.address}\``, { parse_mode: 'Markdown' });
    }
    return;
  }
  if (data === 'wallet_send') {
    await ctx.answerCbQuery();
    await ctx.reply('Используйте: `/send_agent АДРЕС СУММА`\nПример: `/send_agent EQD... 1.5`', { parse_mode: 'Markdown' });
    return;
  }

  // ── Плагины ──
  if (data === 'plugins' || data === 'plugins_menu') { await ctx.answerCbQuery(); await showPlugins(ctx); return; }
  if (data === 'plugins_all') { await ctx.answerCbQuery(); await showAllPlugins(ctx); return; }
  if (data.startsWith('plugin:')) {
    await ctx.answerCbQuery();
    await showPluginDetails(ctx, data.split(':')[1]);
    return;
  }
  if (data.startsWith('plugin_install:')) {
    const pid = data.split(':')[1];
    const ok = await getPluginManager().installPlugin(pid);
    await ctx.answerCbQuery(ok ? '✅ Установлен' : '❌ Ошибка');
    await ctx.reply(ok ? `✅ Плагин установлен!` : `❌ Ошибка установки`);
    return;
  }
  if (data.startsWith('plugin_uninstall:')) {
    const pid = data.split(':')[1];
    const ok = await getPluginManager().uninstallPlugin(pid);
    await ctx.answerCbQuery(ok ? '✅ Удалён' : '❌ Ошибка');
    await ctx.reply(ok ? `✅ Плагин удалён` : `❌ Ошибка удаления`);
    return;
  }

  // ── Workflow ──
  if (data === 'workflow' || data === 'workflows_menu') { await ctx.answerCbQuery(); await showWorkflows(ctx, userId); return; }
  if (data.startsWith('workflow_template:')) {
    await ctx.answerCbQuery();
    await showWorkflowTemplate(ctx, parseInt(data.split(':')[1]));
    return;
  }
  if (data.startsWith('workflow_create_from:')) {
    await ctx.answerCbQuery('Создаю workflow...');
    await createWorkflowFromTemplate(ctx, userId, parseInt(data.split(':')[1]));
    return;
  }
  if (data === 'workflow_create') {
    await ctx.answerCbQuery();
    const engine = getWorkflowEngine();
    const templates = engine.getWorkflowTemplates();
    const btns = templates.map((t, i) => [{ text: `📋 ${t.name}`, callback_data: `workflow_template:${i}` }]);
    btns.push([{ text: '◀️ Назад', callback_data: 'workflow' }]);
    await ctx.reply('⚡ *Создание Workflow*\n\nВыберите шаблон:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: btns },
    });
    return;
  }
  if (data === 'workflow_describe') {
    await ctx.answerCbQuery();
    await safeReply(ctx,
      `🤖 *AI Workflow Builder*\n\n` +
      `Опишите что должен делать ваш workflow — AI сам соединит ваших агентов\\.\n\n` +
      `*Примеры:*\n` +
      `_"Каждый час проверяй баланс, если < 5 TON — отправь уведомление"_\n` +
      `_"Получай цену TON, сравни с вчерашней, если выросла — твитни"_\n` +
      `_"Мониторь несколько кошельков параллельно и собери сводку"_\n\n` +
      `👇 Напишите описание вашего workflow:`,
      MAIN_MENU
    );
    // Ставим режим ожидания workflow_describe
    await getMemoryManager().setWaitingForInput(userId, 'workflow_describe', {});
    return;
  }

  // ── Агент: быстрые действия ──
  if (data === 'create_agent_prompt' || data === 'create_agent') {
    await ctx.answerCbQuery();
    await safeReply(ctx,
      `✨ *Создание агента*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 _AI напишет код и запустит агента на сервере_\n\n` +
      `*Примеры задач:*\n` +
      `💎 _"проверяй баланс UQB5\\.\\.\\. каждый час"_\n` +
      `📈 _"следи за ценой TON, уведоми если выше 5\\$"_\n` +
      `💸 _"каждый день присылай сводку по крипторынку"_\n` +
      `🌐 _"пинг сайта каждые 10 мин, уведоми при ошибке"_\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👇 *Опишите задачу своими словами:*`,
      MAIN_MENU
    );
    return;
  }
  if (data === 'list_agents') { await ctx.answerCbQuery(); await showAgentsList(ctx, userId); return; }
  if (data === 'help') { await ctx.answerCbQuery(); await showHelp(ctx); return; }
  if (data === 'examples') {
    await ctx.answerCbQuery();
    await ctx.reply('📖 *Примеры агентов:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💎 Баланс TON кошелька', callback_data: 'ex_ton_balance' }],
          [{ text: '📈 Цена TON/USD', callback_data: 'ex_ton_price' }],
          [{ text: '🔔 Мониторинг баланса', callback_data: 'ex_balance_monitor' }],
          [{ text: '💸 Ежемесячная зарплата', callback_data: 'ex_payroll' }],
          [{ text: '🌐 Проверка сайта', callback_data: 'ex_site_check' }],
        ],
      },
    });
    return;
  }

  // Примеры → создание
  const exMap: Record<string, string> = {
    ex_ton_balance: 'Создай агента для проверки баланса TON кошелька',
    ex_ton_price: 'Создай агента для мониторинга цены TON через CoinGecko API',
    ex_balance_monitor: 'Создай агента который каждый час проверяет баланс кошелька и уведомляет если меньше 10 TON',
    ex_payroll: 'Создай агента для отправки зарплаты сотрудникам каждое 10-е число',
    ex_site_check: 'Создай агента для проверки доступности сайта каждые 5 минут',
  };
  if (exMap[data]) {
    await ctx.answerCbQuery('Создаю...');
    await ctx.sendChatAction('typing');
    const result = await getOrchestrator().processMessage(userId, exMap[data]);
    await sendResult(ctx, result);
    return;
  }

  // ── Показать логи ──
  if (data.startsWith('show_logs:')) {
    await ctx.answerCbQuery('Загружаю логи...');
    const agentId = parseInt(data.split(':')[1]);
    await showAgentLogs(ctx, agentId, userId);
    return;
  }

  // ── Запустить / остановить агента (прямой запуск без оркестратора) ──
  if (data.startsWith('run_agent:')) {
    await ctx.answerCbQuery('Запускаю...');
    const agentId = parseInt(data.split(':')[1]);
    await runAgentDirect(ctx, agentId, userId);
    return;
  }

  // ── 🔧 AI Автопочинка ──
  if (data.startsWith('auto_repair:')) {
    await ctx.answerCbQuery('🔧 Анализирую ошибку...');
    const agentId = parseInt(data.split(':')[1]);
    const lastErr = agentLastErrors.get(agentId);
    if (!lastErr) { await ctx.reply('✅ Последних ошибок нет — агент работает нормально.'); return; }

    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) { await ctx.reply('❌ Агент не найден'); return; }

    const statusMsg = await ctx.reply(
      '🔧 *AI Автопочинка*\n\n🔍 Анализирую ошибку\\.\\.\\.\n`▓▓░░░` 40%',
      { parse_mode: 'MarkdownV2' }
    );

    try {
      const fixResult = await getCodeTools().modifyCode({
        currentCode: agentResult.data.code,
        modificationRequest: `Fix this runtime error: "${lastErr.error}"\n\nRemember: use notify() to send messages, getTonBalance() for TON balance, getState()/setState() for state. Do NOT use require(), import, or Telegram Bot API directly.`,
        preserveLogic: true,
      });

      if (!fixResult.success || !fixResult.data) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined,
          `❌ AI не смог исправить код: ${fixResult.error || 'Unknown error'}`
        ).catch(() => {});
        return;
      }

      const { code: fixedCode, changes } = fixResult.data;

      // Показываем предложенный фикс
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined,
        `🔧 *AI нашёл исправление\\!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `❌ _${esc(lastErr.error.slice(0, 80))}_\n\n` +
        `✅ *${esc(changes.slice(0, 180))}*\n\n` +
        `🚀 Применить исправление?`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Применить фикс', callback_data: `apply_fix:${agentId}` },
                { text: '❌ Отмена', callback_data: `agent_menu:${agentId}` },
              ],
            ],
          },
        }
      ).catch(() => ctx.reply(`🔧 AI исправил ошибку. Применить?`, {
        reply_markup: { inline_keyboard: [[{ text: '✅ Применить', callback_data: `apply_fix:${agentId}` }]] },
      }));

      // Сохраняем предложенный код во временное хранилище
      pendingRepairs.set(`${userId}:${agentId}`, fixedCode);

    } catch (err: any) {
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined,
        `❌ Ошибка AI: ${err?.message || 'Unknown'}`
      ).catch(() => {});
    }
    return;
  }

  // ── Применить AI-фикс ──
  if (data.startsWith('apply_fix:')) {
    await ctx.answerCbQuery('Применяю...');
    const agentId = parseInt(data.split(':')[1]);
    const fixedCode = pendingRepairs.get(`${userId}:${agentId}`);
    if (!fixedCode) { await ctx.reply('❌ Фикс устарел, запустите автопочинку снова.'); return; }

    const updateResult = await getDBTools().updateAgentCode(agentId, userId, fixedCode);
    if (!updateResult.success) { await ctx.reply(`❌ Не удалось обновить код: ${updateResult.error}`); return; }

    pendingRepairs.delete(`${userId}:${agentId}`);
    agentLastErrors.delete(agentId); // Сбрасываем ошибку

    await safeReply(ctx,
      `✅ *Автопочинка завершена\\!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔧 Ошибка исправлена AI\n` +
      `⚡ _Запустите агента чтобы проверить_`,
      {
        reply_markup: { inline_keyboard: [[{ text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }, { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }]] },
      }
    );
    return;
  }

  // ── Показать код ──
  if (data.startsWith('show_code:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const codeResult = await getDBTools().getAgentCode(agentId, userId);
    if (!codeResult.success || !codeResult.data) {
      await ctx.reply('❌ Код не найден');
      return;
    }
    const code = codeResult.data;
    const chunks: string[] = [];
    for (let i = 0; i < code.length; i += 3800) chunks.push(code.slice(i, i + 3800));
    for (let i = 0; i < chunks.length; i++) {
      const lbl = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      await ctx.reply(`📄 Код агента #${agentId}${lbl}:\n\`\`\`javascript\n${chunks[i]}\n\`\`\``, { parse_mode: 'Markdown' });
    }
    return;
  }

  // ── 🔍 Аудит безопасности ──
  if (data.startsWith('audit_agent:')) {
    await ctx.answerCbQuery('🔍 Аудит...');
    const agentId = parseInt(data.split(':')[1]);
    const codeResult = await getDBTools().getAgentCode(agentId, userId);
    if (!codeResult.success || !codeResult.data) {
      await ctx.reply('❌ Код агента не найден'); return;
    }
    const code = codeResult.data;

    // Статический анализ безопасности
    const issues: string[] = [];
    const features: string[] = [];

    if (/\beval\s*\(/.test(code))             issues.push('eval\\(\\) — произвольный код');
    if (/\brequire\s*\(/.test(code))          issues.push('require\\(\\) — Node модули');
    if (/process\.(env|exit|kill)/.test(code)) issues.push('process — среда выполнения');
    if (/__dirname|__filename/.test(code))    issues.push('__dirname — файловая система');
    if (/new\s+Function\s*\(/.test(code))     issues.push('new Function\\(\\) — динамический код');

    if (/\bfetch\s*\(/.test(code))           features.push('🌐 HTTP\\-запросы');
    if (/\bnotify\s*\(/.test(code))          features.push('📲 Telegram уведомления');
    if (/getTonBalance|tonBalance/.test(code)) features.push('💎 TON блокчейн');
    if (/getState\s*\(|setState\s*\(/.test(code)) features.push('💾 Постоянное хранилище');
    if (/getSecret\s*\(/.test(code))         features.push('🔑 Секреты');

    const lines = code.split('\n').length;
    const hasTryCatch = /try\s*\{/.test(code);
    const hasAsync = /async\s+function/.test(code);
    const score = Math.max(10, 100 - issues.length * 15);
    const scoreIcon = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';

    let text =
      `🔍 *Аудит — Агент \\#${esc(String(agentId))}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${scoreIcon} *Безопасность: ${esc(String(score))}/100*\n` +
      `📄 ${esc(String(lines))} строк · ${hasAsync ? '✅ async' : '▶️ sync'} · ${hasTryCatch ? '✅ try/catch' : '⚠️ без try/catch'}\n`;

    if (features.length > 0) {
      text += `\n*Использует:*\n`;
      features.forEach(f => { text += `  ${f}\n`; });
    }
    if (issues.length > 0) {
      text += `\n⚠️ *Обнаружено:*\n`;
      issues.forEach(i => { text += `  ⚠️ ${esc(i)}\n`; });
    } else {
      text += `\n✅ _Опасных паттернов не обнаружено_\n`;
    }
    text += `\n_Статический анализ — мгновенно, без AI_`;

    await safeReply(ctx, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👁 Код', callback_data: `show_code:${agentId}` }, { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
        ],
      },
    });
    return;
  }

  // ── Редактировать агента ──
  if (data.startsWith('edit_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    pendingEdits.set(userId, agentId); // Запоминаем агента для модификации
    const agentData = await getDBTools().getAgent(agentId, userId);
    const agentName = agentData.data?.name || `#${agentId}`;
    await editOrReply(ctx,
      `✏️ *Изменить агента*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*${esc(agentName)}*  \\#${esc(String(agentId))}\n\n` +
      `Опишите что нужно изменить:\n` +
      `_"Измени интервал на каждые 30 минут"_\n` +
      `_"Добавь отправку уведомления при ошибке"_\n` +
      `_"Смени адрес кошелька на EQ\\.\\.\\."_`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: `agent_menu:${agentId}` }]] },
      }
    );
    return;
  }

  // ── Переименовать агента ──
  if (data.startsWith('rename_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    pendingRenames.set(userId, agentId);
    await editOrReply(ctx,
      `🏷 *Переименование агента \\#${esc(agentId)}*\n\nВведите новое название \\(до 60 символов\\):`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: `agent_menu:${agentId}` }]] },
      }
    );
    return;
  }

  // ── Template variable wizard: skip optional var ──
  if (data.startsWith('tmpl_skip_var:')) {
    await ctx.answerCbQuery();
    const templateId = data.split(':').slice(1).join(':');
    const state = pendingTemplateSetup.get(userId);
    if (!state) { await editOrReply(ctx, '❌ Сессия настройки истекла\\. Начните заново\\.', { parse_mode: 'MarkdownV2' }); return; }
    // Advance to next variable
    state.remaining.shift();
    await promptNextTemplateVar(ctx, userId, state);
    return;
  }

  // ── Template variable wizard: cancel ──
  if (data === 'tmpl_cancel') {
    await ctx.answerCbQuery('Отменено');
    pendingTemplateSetup.delete(userId);
    await showMarketplace(ctx);
    return;
  }

  // ── Кастомное создание агента (из демо) ──
  if (data === 'create_custom') {
    await ctx.answerCbQuery();
    await editOrReply(ctx,
      `✏️ *Создание агента*\n\nОпишите своими словами что должен делать агент\\.\n\n_Например:_\n_"Следи за ценой TON и уведоми меня если выше \\$6"_\n_"Проверяй баланс кошелька UQ\\.\\.\\. каждый час"_`,
      { parse_mode: 'MarkdownV2' }
    );
    return;
  }

  // ── Удалить агента: шаг 1 — диалог подтверждения ──
  if (data.startsWith('delete_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    const agentName = esc(agentResult.data?.name || `#${agentId}`);
    const isActive = agentResult.data?.isActive;
    await ctx.reply(
      `🗑 *Удалить агента?*\n\n` +
      `*${agentName}* \\#${agentId}\n` +
      (isActive ? `⚠️ Агент сейчас _активен_ — он будет остановлен\\.\n` : '') +
      `\nЭто действие нельзя отменить\\.`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Да, удалить', callback_data: `confirm_delete:${agentId}` },
              { text: '❌ Отмена', callback_data: 'cancel_delete' },
            ],
          ],
        },
      }
    );
    return;
  }
  // ── Удалить агента: шаг 2 — реальное удаление ──
  if (data.startsWith('confirm_delete:')) {
    await ctx.answerCbQuery('Удаляю...');
    const agentId = parseInt(data.split(':')[1]);
    // Останавливаем агента если он запущен
    await getRunnerAgent().pauseAgent(agentId, userId).catch(() => {});
    const result = await getDBTools().deleteAgent(agentId, userId);
    await ctx.reply(result.success ? `🗑 Агент #${agentId} удалён` : `❌ Ошибка: ${result.error}`);
    if (result.success) await showAgentsList(ctx, userId);
    return;
  }
  if (data === 'cancel_delete') { await ctx.answerCbQuery('Отменено ✓'); return; }

  // ── Настройки платформы ──
  if (data === 'platform_settings') {
    await ctx.answerCbQuery();
    const isOwner = userId === parseInt(process.env.OWNER_ID || '0');
    if (!isOwner) { await ctx.reply('⛔ Только для владельца'); return; }
    await ctx.reply(
      `⚙️ *Настройки платформы*\n\n` +
      `• Модель: \`${process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'}\`\n` +
      `• Прокси: \`${process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317'}\`\n` +
      `• Безопасность: ${process.env.ENABLE_SECURITY_SCAN === 'false' ? '❌' : '✅'}\n` +
      `• TON API Key: ${process.env.TONCENTER_API_KEY ? '✅ настроен' : '⚠️ не настроен'}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ── Выбор модели ──
  if (data.startsWith('set_model:')) {
    const modelId = data.split('set_model:')[1] as ModelId;
    const found = MODEL_LIST.find(m => m.id === modelId);
    if (found) {
      setUserModel(userId, modelId);
      await ctx.answerCbQuery(`✅ Модель: ${found.label}`);
      await showModelSelector(ctx);
    } else {
      await ctx.answerCbQuery('❌ Неизвестная модель');
    }
    return;
  }
  if (data === 'model_selector') { await ctx.answerCbQuery(); await showModelSelector(ctx); return; }

  // ── Подписки ──
  if (data === 'sub_menu' || data === 'subscription') {
    await ctx.answerCbQuery();
    await showSubscription(ctx);
    return;
  }
  if (data === 'plans_menu') {
    await ctx.answerCbQuery();
    await showPlans(ctx);
    return;
  }
  if (data.startsWith('buy_plan:')) {
    await ctx.answerCbQuery();
    const [, planId, period] = data.split(':');
    await showPaymentInvoice(ctx, planId, period as 'month' | 'year');
    return;
  }
  if (data === 'check_payment') {
    await ctx.answerCbQuery('Проверяю...', { show_alert: false });
    await checkPaymentStatus(ctx);
    return;
  }
  if (data === 'cancel_payment') {
    await ctx.answerCbQuery('Отменено');
    await showSubscription(ctx);
    return;
  }
  // Оплата через TON Connect (Tonkeeper подтверждает транзакцию)
  if (data.startsWith('pay_tonconnect:')) {
    await ctx.answerCbQuery();
    const [, planId, period] = data.split(':');
    const pending = getPendingPayment(userId);
    if (!pending) {
      // Создаём новый платёж
      const payment = createPayment(userId, planId, period as 'month' | 'year');
      if ('error' in payment) { await ctx.reply(`❌ ${payment.error}`); return; }
    }
    const p = getPendingPayment(userId)!;
    const tonConn = getTonConnectManager();
    if (!tonConn.isConnected(userId)) {
      await ctx.reply('❌ Сначала подключите TON кошелёк через 💎 TON Connect');
      return;
    }
    await ctx.reply('📤 Запрашиваю подтверждение в Tonkeeper...');
    const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQB5Ltvn5_q9axVSBXd4GGUVZaAh-hNgPT5emHjNsyYUDgzf';
    const payComment = `sub:${p.planId}:${p.period}:${userId}`;
    const result = await tonConn.sendTon(userId, payAddress, p.amountTon, payComment);
    if (result.success && result.boc) {
      const confirmed = await confirmPayment(userId, result.boc);
      if (confirmed.success && confirmed.plan) {
        const expStr = confirmed.expiresAt ? confirmed.expiresAt.toLocaleDateString('ru-RU') : '∞';
        await ctx.reply(`🎉 Оплата прошла! ${confirmed.plan.icon} ${confirmed.plan.name} активирован до ${expStr}`);
        await showSubscription(ctx);
      }
    } else {
      await ctx.reply(`❌ Ошибка транзакции: ${result.error || 'пользователь отменил'}\n\nМожете оплатить вручную.`);
    }
    return;
  }

  // ── Оплата генерации AI (для Free пользователей) ──
  if (data.startsWith('pay_generation:')) {
    await ctx.answerCbQuery();
    const encodedDesc = data.slice('pay_generation:'.length);
    const description = decodeURIComponent(encodedDesc);
    const plan = await getUserPlan(userId);
    const priceGen = plan.pricePerGeneration;

    const tonConn = getTonConnectManager();
    if (!tonConn.isConnected(userId)) {
      await safeReply(ctx,
        `❌ Подключите TON кошелёк для оплаты\\.\n\n` +
        `Нажмите 💎 TON Connect в меню или /connect`,
      );
      return;
    }

    const bal = await tonConn.getBalance(userId);
    if (parseFloat(bal.ton) < priceGen + 0.05) {
      await ctx.reply(`❌ Недостаточно TON.\nБаланс: ${bal.ton} TON\nНужно: ${priceGen + 0.05} TON`);
      return;
    }

    await ctx.reply(`📤 Оплата ${priceGen} TON за генерацию AI...\nПодтвердите в Tonkeeper`);
    const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQB5Ltvn5_q9axVSBXd4GGUVZaAh-hNgPT5emHjNsyYUDgzf';
    const payComment = `gen:${userId}:${Date.now()}`;
    const result = await tonConn.sendTon(userId, payAddress, priceGen, payComment);

    if (result.success) {
      trackGeneration(userId);
      await ctx.reply(`✅ Оплачено! Генерирую агента...`);
      await ctx.sendChatAction('typing');
      const agentResult = await getOrchestrator().processMessage(userId, description);
      await sendResult(ctx, agentResult);
    } else {
      await ctx.reply(`❌ Оплата не прошла: ${result.error || 'отменено'}`);
    }
    return;
  }

  // ── Всё остальное через оркестратор ──
  await ctx.answerCbQuery();
  await ctx.sendChatAction('typing');
  try {
    const result = await getOrchestrator().processCallback(userId, data);
    await sendResult(ctx, result);
  } catch (err) {
    console.error('Callback orchestrator error:', err);
    await ctx.reply('❌ Ошибка. Попробуйте ещё раз.');
  }
});

// ============================================================
// Текстовые сообщения → оркестратор
// ============================================================
const MENU_TEXTS = new Set([
  '🤖 Мои агенты', '➕ Создать агента', '🏪 Маркетплейс',
  '🔌 Плагины', '⚡ Workflow', '💎 TON Connect', '💳 Подписка', '📊 Статистика', '❓ Помощь', '👤 Профиль',
]);

bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/') || MENU_TEXTS.has(text)) return;

  const userId = ctx.from.id;
  const trimmed = text.trim();

  // ── Сохраняем язык пользователя (авто-определение) ───────
  if (!userLanguages.has(userId)) {
    userLanguages.set(userId, detectLang(trimmed));
  }

  // ── Withdrawal flow ──────────────────────────────────────────
  if (pendingWithdrawal.has(userId)) {
    const wState = pendingWithdrawal.get(userId)!;
    const lang = getUserLang(userId);

    if (trimmed.toLowerCase() === '/cancel' || trimmed.toLowerCase() === 'отмена') {
      pendingWithdrawal.delete(userId);
      await ctx.reply(lang === 'ru' ? '❌ Вывод отменён.' : '❌ Withdrawal cancelled.');
      return;
    }

    if (wState.step === 'enter_address') {
      const addr = trimmed;
      if (!addr.startsWith('EQ') && !addr.startsWith('UQ') && !addr.startsWith('0:')) {
        await ctx.reply(lang === 'ru'
          ? '❌ Неверный формат адреса. Введите TON адрес (EQ... или UQ...):'
          : '❌ Invalid address format. Enter TON address (EQ... or UQ...):'
        );
        return;
      }
      // Save as wallet and ask amount
      const profile = await getUserProfile(userId);
      await saveUserProfile(userId, { ...profile, wallet_address: addr });
      pendingWithdrawal.set(userId, { step: 'enter_amount', address: addr });
      await ctx.reply(
        lang === 'ru'
          ? `✅ Кошелёк сохранён\n💰 Доступно: *${profile.balance_ton.toFixed(2)} TON*\n\nВведите сумму для вывода:`
          : `✅ Wallet saved\n💰 Available: *${profile.balance_ton.toFixed(2)} TON*\n\nEnter amount to withdraw:`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (wState.step === 'enter_amount') {
      const amount = parseFloat(trimmed.replace(',', '.'));
      const profile = await getUserProfile(userId);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(lang === 'ru' ? '❌ Введите корректную сумму (например: 1.5)' : '❌ Enter a valid amount (e.g. 1.5)');
        return;
      }
      if (amount > profile.balance_ton) {
        await ctx.reply(lang === 'ru'
          ? `❌ Недостаточно средств. Доступно: ${profile.balance_ton.toFixed(2)} TON`
          : `❌ Insufficient funds. Available: ${profile.balance_ton.toFixed(2)} TON`
        );
        return;
      }
      pendingWithdrawal.delete(userId);
      // STUB: don't actually deduct — this is a demo stub
      const walletShort = (wState.address || profile.wallet_address || '').slice(0, 12) + '…';
      await safeReply(ctx,
        lang === 'ru'
          ? `✅ *Заявка на вывод создана\\!*\n\n` +
            `💸 Сумма: *${esc(amount.toFixed(2))} TON*\n` +
            `🔗 Кошелёк: \`${esc(walletShort)}\`\n\n` +
            `⏳ _Обработка займёт до 24 часов_\n` +
            `📧 Уведомление придёт в бот`
          : `✅ *Withdrawal request created\\!*\n\n` +
            `💸 Amount: *${esc(amount.toFixed(2))} TON*\n` +
            `🔗 Wallet: \`${esc(walletShort)}\`\n\n` +
            `⏳ _Processing up to 24 hours_\n` +
            `📧 Notification will come to bot`,
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }
  }

  // ── Telegram Auth flow для Fragment ────────────────────────
  if (pendingTgAuth.has(userId)) {
    const authStep = pendingTgAuth.get(userId)!;

    // Allow /cancel to abort
    if (trimmed === '/cancel' || trimmed.toLowerCase() === 'отмена') {
      pendingTgAuth.delete(userId);
      clearAuthState(userId);
      await ctx.reply('❌ Авторизация отменена.');
      return;
    }

    if (authStep === 'phone') {
      await ctx.sendChatAction('typing');
      try {
        const result = await authSendPhone(userId, trimmed);
        if (result.type === 'already_authorized') {
          pendingTgAuth.delete(userId);
          await ctx.reply('✅ Уже авторизован! Используй /gifts для данных Fragment.');
        } else {
          pendingTgAuth.set(userId, 'code');
          await safeReply(ctx,
            '📨 *Код отправлен\\!*\n\n' +
            'Telegram отправил тебе код подтверждения\\.\n' +
            'Введи его здесь \\(5\\-6 цифр\\):\\n\n' +
            '_Для отмены:_ `/cancel`',
            { parse_mode: 'MarkdownV2' }
          );
        }
      } catch (e: any) {
        pendingTgAuth.delete(userId);
        await ctx.reply('❌ Ошибка: ' + e.message + '\n\nПопробуй снова: /tglogin');
      }
      return;
    }

    if (authStep === 'code') {
      await ctx.sendChatAction('typing');
      try {
        const result = await authSubmitCode(userId, trimmed);
        if (result.type === 'authorized') {
          pendingTgAuth.delete(userId);
          await safeReply(ctx,
            '🎉 *Авторизован успешно\\!*\n\n' +
            '✅ Теперь доступны реальные данные Fragment\\:\n' +
            '• `/gifts` — топ подарков с floor ценами\n' +
            '• Спроси: _"floor цена jelly bunny"_\n' +
            '• Спроси: _"топ подарки Fragment сегодня"_',
            { parse_mode: 'MarkdownV2' }
          );
        } else if (result.type === 'need_password') {
          pendingTgAuth.set(userId, 'password');
          await ctx.reply('🔐 Введи пароль двухфакторной аутентификации (2FA):');
        }
      } catch (e: any) {
        const errMsg: string = e.message || '';
        if (errMsg === 'EXPIRED') {
          // Code expired — must restart auth flow
          pendingTgAuth.delete(userId);
          await ctx.reply(
            '⏰ Код истёк!\n\n' +
            'Код действует ~2 минуты. Введи /tglogin ещё раз чтобы получить новый код.'
          );
        } else if (errMsg === 'INVALID') {
          // Wrong code — let them retry
          await ctx.reply('❌ Неверный код. Проверь и введи ещё раз (или /cancel для отмены):');
        } else {
          await ctx.reply('❌ Ошибка: ' + errMsg + '\n\nПопробуй /tglogin заново.');
          pendingTgAuth.delete(userId);
        }
      }
      return;
    }

    if (authStep === 'password') {
      await ctx.sendChatAction('typing');
      try {
        await authSubmitPassword(userId, trimmed);
        pendingTgAuth.delete(userId);
        await safeReply(ctx,
          '🎉 *Авторизован успешно\\!*\n\n' +
          '✅ Fragment данные доступны\\. Используй `/gifts`',
          { parse_mode: 'MarkdownV2' }
        );
      } catch (e: any) {
        await ctx.reply('❌ Неверный пароль 2FA: ' + e.message + '\n\nПопробуй снова или /cancel');
      }
      return;
    }
  }

  // ── Ожидаем переименование агента ─────────────────────────
  if (pendingRenames.has(userId)) {
    const agentId = pendingRenames.get(userId)!;
    pendingRenames.delete(userId);
    if (trimmed.length < 1 || trimmed.length > 60) {
      await ctx.reply('❌ Название должно быть от 1 до 60 символов. Попробуйте снова.');
      pendingRenames.set(userId, agentId);
      return;
    }
    try {
      const result = await getDBTools().updateAgent(agentId, userId, { name: trimmed });
      if (result.success) {
        await safeReply(ctx, `✅ *${esc(trimmed)}*  \\#${esc(String(agentId))}\n_Название обновлено_`);
        await showAgentMenu(ctx, agentId, userId);
      } else {
        await ctx.reply(`❌ Ошибка переименования: ${result.error || 'Неизвестная ошибка'}`);
      }
    } catch (e: any) {
      await ctx.reply(`❌ Ошибка: ${e.message}`);
    }
    return;
  }

  // ── Ожидаем запрос на редактирование агента ───────────────
  if (pendingEdits.has(userId)) {
    const agentId = pendingEdits.get(userId)!;
    pendingEdits.delete(userId);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      await ctx.reply('❌ Агент не найден'); return;
    }
    const anim = await startCreationAnimation(ctx, 'редактирование', true);
    try {
      const fixResult = await getCodeTools().modifyCode({
        currentCode: agentResult.data.code,
        modificationRequest: trimmed,
        preserveLogic: true,
      });
      anim.stop();
      if (!fixResult.success || !fixResult.data) {
        await safeReply(ctx, `❌ AI не смог изменить код: ${esc(fixResult.error || 'Unknown')}`);
        return;
      }
      const saveResult = await getDBTools().updateAgentCode(agentId, userId, fixResult.data.code);
      if (saveResult.success) {
        await safeReply(ctx,
          `✅ *Агент обновлён\\!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `*${esc(agentResult.data.name)}*  \\#${esc(String(agentId))}\n` +
          `🔧 ${esc(fixResult.data.changes.slice(0, 180))}\n\n` +
          `_Запустите агента чтобы проверить изменения_`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Запустить', callback_data: `run_agent:${agentId}` },
                { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` },
              ]],
            },
          }
        );
      } else {
        await safeReply(ctx, `❌ Не удалось сохранить: ${esc(saveResult.error || 'Unknown')}`);
      }
    } catch (err: any) {
      anim.stop();
      await safeReply(ctx, `❌ Ошибка: ${esc(err?.message || 'Unknown')}`);
    }
    return;
  }

  // ── Template variable wizard: collect user input ─────────
  if (pendingTemplateSetup.has(userId)) {
    const state = pendingTemplateSetup.get(userId)!;
    const t = allAgentTemplates.find(x => x.id === state.templateId);
    if (t && state.remaining.length > 0) {
      const currentKey = state.remaining[0];
      const placeholder = t.placeholders.find(p => p.name === currentKey);
      const lang = getUserLang(userId);
      // Allow "skip"/"пропустить" to skip optional vars
      const isSkip = /^(skip|пропустить|пропуск)$/i.test(trimmed);
      if (isSkip && !placeholder?.required) {
        state.remaining.shift();
      } else if (trimmed.length > 0) {
        state.collected[currentKey] = trimmed;
        state.remaining.shift();
      } else {
        await ctx.reply(lang === 'ru' ? '❌ Введите значение или нажмите «Пропустить»' : '❌ Enter a value or tap Skip');
        return;
      }
      await promptNextTemplateVar(ctx, userId, state);
      return;
    }
    pendingTemplateSetup.delete(userId);
  }

  // ── Ожидаем название листинга от пользователя ─────────────
  if (pendingPublish.has(userId)) {
    const pp = pendingPublish.get(userId)!;
    if (pp.step === 'name') {
      pendingPublish.delete(userId);
      await doPublishAgent(ctx, userId, pp.agentId, pp.price, trimmed.slice(0, 60));
      return;
    }
    pendingPublish.delete(userId);
  }

  // ── Ожидаем название агента от пользователя ────────────────
  if (pendingNameAsk.has(userId)) {
    const pna = pendingNameAsk.get(userId)!;
    pendingNameAsk.delete(userId);
    const customName = trimmed.length >= 2 && trimmed.length <= 60 ? trimmed : undefined;
    // Переходим к выбору расписания
    pendingCreations.set(userId, { description: pna.description, step: 'schedule', name: customName });
    const previewTask = pna.description.replace(/[_*`[\]]/g, '').slice(0, 55) + (pna.description.length > 55 ? '…' : '');
    const nameLabel = customName ? `📛 *${customName}* — отлично\\!` : '📛 *Название придумаю сам*';
    await safeReply(ctx,
      `${nameLabel}\n\n` +
      `⏰ *Как часто запускать агента?*\n\n` +
      `📝 _"${previewTask}"_\n\n` +
      `👇 Выберите расписание:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Вручную (по кнопке)', callback_data: 'agent_schedule:manual' }],
            [{ text: '🔁 Каждую минуту', callback_data: 'agent_schedule:1min' }, { text: '⚡ Каждые 5 мин', callback_data: 'agent_schedule:5min' }],
            [{ text: '⏱ Каждые 15 мин', callback_data: 'agent_schedule:15min' }, { text: '🕐 Каждый час', callback_data: 'agent_schedule:1hour' }],
            [{ text: '📅 Раз в сутки', callback_data: 'agent_schedule:24hours' }, { text: '❌ Отмена', callback_data: 'agent_schedule:cancel' }],
          ],
        },
      }
    );
    return;
  }

  // ── Если есть pending создания — сбрасываем ────────────────
  if (pendingCreations.has(userId)) {
    pendingCreations.delete(userId);
  }

  // ── Валидация: мусорный ввод ───────────────────────────────
  if (isGarbageInput(trimmed)) {
    await ctx.reply(
      `❓ Не понимаю запрос.\n\n` +
      `Опишите задачу словами, например:\n` +
      `_"Следи за ценой TON и уведоми если выше $6"_\n` +
      `_"Создай агента который проверяет баланс кошелька каждый час"_\n` +
      `_"Запусти агента #3"_`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ── Уточняющие вопросы перед созданием агента ───────────────
  // Если похоже на создание агента (явный запрос + достаточная длина)
  // И в тексте нет уже указанного расписания — сперва спрашиваем название
  const isCreateIntent =
    /создай|создать|сделай|сделать|напиши|написать|сгенерируй|make\b|create\b|build\b/i.test(text) ||
    /следи|проверяй|мониторь|отслеживай|мониторинг|monitor|watch\b|track\b/i.test(text);

  const hasScheduleInText =
    /каждую\s+минуту|каждые?\s+\d+\s+минут|каждый\s+час|каждые?\s+\d+\s+час|every\s+minute|every\s+hour|every\s+day|раз\s+в\s+(минуту|час|день)/i.test(text);

  if (isCreateIntent && !hasScheduleInText && trimmed.length > 15) {
    // Шаг 1: Спрашиваем название агента
    pendingNameAsk.set(userId, { description: text });
    const previewTask = text.replace(/[_*`[\]]/g, '').slice(0, 60) + (text.length > 60 ? '…' : '');
    await ctx.reply(
      `📛 *Как назвать агента?*\n\n` +
      `📝 _"${previewTask}"_\n\n` +
      `Введите короткое название или нажмите *Пропустить* — придумаю сам:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭ Пропустить — придумать название', callback_data: 'skip_agent_name' }],
            [{ text: '❌ Отмена', callback_data: 'cancel_name_ask' }],
          ],
        },
      }
    );
    return;
  }

  await ctx.sendChatAction('typing');

  // Если создаём агента — показываем анимированный прогресс, иначе просто typing
  let anim: Awaited<ReturnType<typeof startCreationAnimation>> | null = null;
  if (isCreateIntent && text.length > 10) {
    anim = await startCreationAnimation(ctx, 'вручную', true);
  } else {
    // Держим "typing..." живым каждые 4с
    const typingTimer = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);
    try {
      const result = await getOrchestrator().processMessage(userId, text, ctx.from.username);
      clearInterval(typingTimer);
      await sendResult(ctx, result);
    } catch (err) {
      clearInterval(typingTimer);
      console.error('Text handler error:', err);
      await ctx.reply('❌ Ошибка. Попробуйте ещё раз или /start');
    }
    return;
  }

  try {
    const result = await getOrchestrator().processMessage(userId, text, ctx.from.username);
    anim!.stop();
    anim!.deleteMsg();
    await sendResult(ctx, result);
  } catch (err) {
    anim!.stop();
    anim!.deleteMsg();
    console.error('Text handler error:', err);
    await ctx.reply('❌ Ошибка. Попробуйте ещё раз или /start');
  }
});

// ============================================================
// Отправить результат оркестратора
// ============================================================
async function sendResult(ctx: Context, result: {
  type: string;
  content: string;
  buttons?: Array<{ text: string; callbackData: string }>;
  agentId?: number;
}) {
  const content = sanitize(result.content);
  if (!content) return;

  const inlineKeyboard = result.buttons?.map((b) => [
    { text: b.text, callback_data: b.callbackData },
  ]);
  const extra: any = inlineKeyboard?.length ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {};

  const MAX = 4000;
  if (content.length > MAX) {
    // Первую часть редактируем (или отправляем), остаток — всегда новое сообщение
    await editOrReply(ctx, content.slice(0, MAX), { parse_mode: 'Markdown', ...extra });
    if (content.slice(MAX).trim()) await ctx.reply(content.slice(MAX)).catch(() => {});
  } else {
    await editOrReply(ctx, content, { parse_mode: 'Markdown', ...extra });
  }

  // После создания агента — показываем список только если нет auto-start
  // (если auto-start произошёл в orchestrator — кнопки уже содержат "Логи" и "Остановить")
  if (result.type === 'agent_created' && result.agentId) {
    const uid = (ctx.from as any)?.id;
    // Показываем список только если в кнопках нет кнопки логов (значит авто-старта не было)
    const hasLogs = result.buttons?.some(b => b.callbackData?.startsWith('show_logs:'));
    if (uid && !hasLogs) {
      // небольшая задержка чтобы пользователь успел прочитать сообщение
      setTimeout(() => showAgentsList(ctx, uid).catch(() => {}), 1500);
    }
  }
}

// ============================================================
// Прямой запуск/остановка агента (без оркестратора, быстрый фидбек)
// Задача 6: реальный запуск агента с реальным фидбеком
// ============================================================
async function runAgentDirect(ctx: Context, agentId: number, userId: number) {
  // Получаем агента из БД
  const agentResult = await getDBTools().getAgent(agentId, userId);
  if (!agentResult.success || !agentResult.data) {
    await ctx.reply(`❌ Агент #${agentId} не найден или принадлежит другому пользователю`);
    return;
  }
  const agent = agentResult.data;

  // Если агент активен — останавливаем (toggle)
  if (agent.isActive) {
    await ctx.sendChatAction('typing');
    const pauseResult = await getRunnerAgent().pauseAgent(agentId, userId);
    if (pauseResult.success) {
      await editOrReply(ctx,
        `⏸ *Агент остановлен*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*${esc(agent.name)}*  \\#${agentId}\n` +
        `_Scheduler деактивирован_`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Запустить снова', callback_data: `run_agent:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }
      );
    } else {
      await editOrReply(ctx, `❌ Ошибка остановки: ${esc(pauseResult.error || '')}`, { parse_mode: 'MarkdownV2' });
    }
    return;
  }

  // Запускаем агента — используем editOrReply для статус-сообщения (редактируем кнопку вместо нового)
  const cbMsgId = (ctx.callbackQuery as any)?.message?.message_id;
  const chatId = ctx.chat!.id;

  await editOrReply(ctx,
    `🚀 *Запускаю агента\\.\\.\\.*\n\n` +
    `*${esc(agent.name)}* #${agentId}\n` +
    `⏳ Выполняется\\.\\.\\. подождите`,
    { parse_mode: 'MarkdownV2' }
  );

  // Вспомогательная функция редактирования статус-сообщения
  const editStatus = async (text: string, extra?: object) => {
    if (cbMsgId) {
      await ctx.telegram.editMessageText(chatId, cbMsgId, undefined, text, { parse_mode: 'MarkdownV2', ...extra }).catch(() => {});
    } else {
      await safeReply(ctx, text, { parse_mode: 'MarkdownV2', ...extra });
    }
  };

  // legacy statusMsg совместимость (нужен для дальнейшего кода)
  const statusMsg: any = cbMsgId ? { message_id: cbMsgId } : null;

  await ctx.sendChatAction('typing');

  try {
    const runResult = await getRunnerAgent().runAgent({ agentId, userId });

    if (!runResult.success) {
      // Редактируем сообщение вместо нового (умное редактирование - задача 1)
      const errText = `❌ *Ошибка запуска*\n\n${esc(runResult.error || 'Неизвестная ошибка')}`;
      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, errText, { parse_mode: 'MarkdownV2' }).catch(() => ctx.reply(errText.replace(/\\/g, '')));
      }
      return;
    }

    const data = runResult.data!;

    if (data.isScheduled) {
      // Агент активирован как scheduler
      const intervalMs = data.intervalMs || 0;
      const intervalLabel = intervalMs >= 3_600_000 ? `${intervalMs / 3_600_000} ч`
        : intervalMs >= 60_000 ? `${intervalMs / 60_000} мин`
        : `${intervalMs / 1000} сек`;

      const successText =
        `✅ *Агент запущен\\!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*${esc(agent.name)}*  \\#${agentId}\n` +
        `⏰ Каждые *${esc(intervalLabel)}* · 🖥 сервер 24\\/7\n` +
        `⚡ _Первое уведомление придёт через несколько секунд_`;

      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, successText, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Логи', callback_data: `show_logs:${agentId}` }, { text: '⏸ Остановить', callback_data: `run_agent:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }).catch(() => ctx.reply(successText.replace(/\\/g, '')));
      }
    } else {
      // Однократный запуск — показываем результат
      const exec = data.executionResult;
      let resultText = `✅ *Агент выполнен\\!*\n━━━━━━━━━━━━━━━━━━━━\n*${esc(agent.name)}*  \\#${agentId}\n`;

      if (exec) {
        resultText += `⏱ Время: ${exec.executionTime}ms\n`;
        if (exec.success) {
          const rawResult = exec.result;
          if (rawResult !== undefined && rawResult !== null) {
            resultText += `\n📊 *Результат:*\n━━━━━━━━━━━━━━━━━━━━\n`;
            if (typeof rawResult === 'object' && !Array.isArray(rawResult)) {
              // Flatten: if value is an object, expand its entries too
              const flat: Array<[string, string]> = [];
              Object.entries(rawResult as Record<string, any>).forEach(([k, v]) => {
                if (k === 'success' && v === true) return; // skip success:true noise
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                  Object.entries(v).forEach(([k2, v2]) => {
                    flat.push([k2, typeof v2 === 'object' ? JSON.stringify(v2) : String(v2)]);
                  });
                } else {
                  flat.push([k, String(v)]);
                }
              });
              if (flat.length > 0) {
                flat.slice(0, 12).forEach(([k, v]) => {
                  resultText += `\`${esc(k)}\` → ${esc(v.slice(0, 100))}\n`;
                });
              } else {
                resultText += `_\\(пустой объект\\)_\n`;
              }
            } else if (Array.isArray(rawResult)) {
              resultText += `_Массив: ${esc(String((rawResult as any[]).length))} элементов_\n`;
              (rawResult as any[]).slice(0, 5).forEach((item, i) => {
                resultText += `  ${i + 1}\\. ${esc(String(item).slice(0, 80))}\n`;
              });
            } else {
              resultText += `${esc(String(rawResult).slice(0, 400))}\n`;
            }
          } else {
            resultText += `\n_✅ Агент выполнен успешно_\n`;
          }
        } else {
          resultText += `\n❌ *Ошибка:* ${esc(exec.error || 'Unknown')}`;
        }
        if (exec.logs?.length > 0) {
          resultText += `\n📝 *Логи \\(${exec.logs.length}\\):*\n`;
          exec.logs.slice(-5).forEach(log => {
            const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : '✅';
            resultText += `${icon} ${esc(String(log.message).slice(0, 100))}\n`;
          });
        }
      }

      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, resultText, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Запустить снова', callback_data: `run_agent:${agentId}` }, { text: '📋 Все логи', callback_data: `show_logs:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }).catch(() => ctx.reply(resultText.replace(/[\\*_`]/g, '')));
      }
    }
  } catch (err: any) {
    const errMsg = err?.message || 'Неизвестная ошибка';
    if (statusMsg) {
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, `❌ Ошибка: ${errMsg}`).catch(() => {});
    } else {
      await ctx.reply(`❌ Ошибка запуска: ${errMsg}`);
    }
  }
}

// ============================================================
// Логи агента
// ============================================================
async function showAgentLogs(ctx: Context, agentId: number, userId: number) {
  try {
    const logsResult = await getRunnerAgent().getLogs(agentId, userId, 20);
    if (!logsResult.success) {
      await ctx.reply(`❌ Не удалось загрузить логи: ${logsResult.error}`);
      return;
    }
    const logs = logsResult.data?.logs || [];
    if (!logs.length) {
      await ctx.reply(
        `📋 *Логи агента #${agentId}*\n\nЛоги пусты — агент ещё не запускался или логи удалены\\.`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [[{ text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }, { text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }]] },
        }
      );
      return;
    }

    let text = `📋 *Логи агента #${agentId}* \\(последние ${logs.length}\\):\n\n`;
    logs.slice(-15).forEach(log => {
      const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️';
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      text += `${icon} \`${esc(time)}\` ${esc(String(log.message).slice(0, 120))}\n`;
    });

    await safeReply(ctx, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Обновить', callback_data: `show_logs:${agentId}` }, { text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }],
          [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
        ],
      },
    });
  } catch (err) {
    await ctx.reply('❌ Ошибка загрузки логов');
  }
}

// ============================================================
// Список агентов
// ============================================================
async function showAgentsList(ctx: Context, userId: number) {
  try {
    const r = await getDBTools().getUserAgents(userId);
    if (!r.success || !r.data?.length) {
      await editOrReply(ctx,
        `🤖 *Ваши агенты*\n\n` +
        `У вас пока нет агентов\\.\n\n` +
        `*Чтобы создать агента:*\n` +
        `• Напишите задачу своими словами\n` +
        `• Выберите готовый шаблон в Маркетплейсе\n\n` +
        `_Примеры: "проверяй баланс кошелька каждый час", "следи за ценой TON"_`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏪 Маркетплейс шаблонов', callback_data: 'marketplace' }],
              [{ text: '✏️ Создать с описанием', callback_data: 'create_agent_prompt' }],
            ],
          },
        }
      );
      return;
    }
    const agents = r.data;
    const active = agents.filter(a => a.isActive).length;

    let text = `🤖 *Ваши агенты*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Всего: *${esc(String(agents.length))}*  🟢 Активных: *${esc(String(active))}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    agents.forEach((a) => {
      const st = a.isActive ? '🟢' : '⏸';
      const trIcon = a.triggerType === 'scheduled' ? '⏰' : a.triggerType === 'webhook' ? '🔗' : '▶️';
      const name = (a.name || '').replace(/[*_`[\]]/g, '').slice(0, 28);
      // Интервал для scheduled
      let schedLabel = '';
      if (a.triggerType === 'scheduled') {
        const ms = (a.triggerConfig as any)?.intervalMs || 0;
        schedLabel = ms >= 3_600_000 ? ` · ${ms / 3_600_000}ч` : ms >= 60_000 ? ` · ${ms / 60_000}мин` : '';
      }
      // Дата создания (давность)
      const ageMs = Date.now() - new Date(a.createdAt).getTime();
      const ageDays = Math.floor(ageMs / 86_400_000);
      const ageLabel = ageDays === 0 ? 'сегодня' : ageDays === 1 ? 'вчера' : `${ageDays}д назад`;
      text += `${st} *#${esc(String(a.id))}* ${esc(name)}\n`;
      text += `   ${trIcon}${esc(schedLabel)}  _${esc(ageLabel)}_\n\n`;
    });

    const btns = agents.slice(0, 8).map((a) => [{
      text: `${a.isActive ? '🟢' : '⏸'} #${a.id} ${(a.name || '').slice(0, 24)}`,
      callback_data: `agent_menu:${a.id}`,
    }]);
    btns.push([
      { text: '➕ Создать нового', callback_data: 'create_agent_prompt' },
      { text: '🏪 Маркетплейс', callback_data: 'marketplace' },
    ]);

    await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
  } catch (err) {
    console.error('showAgentsList error:', err);
    await ctx.reply('❌ Ошибка загрузки агентов. Попробуйте /start');
  }
}

// ============================================================
// Меню конкретного агента
// ============================================================
async function showAgentMenu(ctx: Context, agentId: number, userId: number) {
  try {
    const r = await getDBTools().getAgent(agentId, userId);
    if (!r.success || !r.data) { await ctx.reply('❌ Агент не найден'); return; }
    const a = r.data;
    const name = (a.name || '').replace(/[*_`[\]]/g, '').slice(0, 40);
    const desc = (a.description || '').replace(/[*_`[\]]/g, '').slice(0, 120);
    const statusIcon = a.isActive ? '🟢' : '⏸';
    const statusText = a.isActive ? 'Активен' : 'На паузе';
    const triggerIcon = a.triggerType === 'scheduled' ? '⏰' : a.triggerType === 'webhook' ? '🔗' : '▶️';
    const triggerText = a.triggerType === 'scheduled' ? 'По расписанию' :
                        a.triggerType === 'webhook' ? 'Webhook' : 'Вручную';

    const lastErr = agentLastErrors.get(agentId);
    const hasError = !!lastErr;

    // Интервал запуска
    const triggerCfg = typeof a.triggerConfig === 'object' ? a.triggerConfig as Record<string, any> : {};
    const intervalMs = triggerCfg?.intervalMs ? Number(triggerCfg.intervalMs) : 0;
    let intervalLabel = '';
    if (a.triggerType === 'scheduled' && intervalMs > 0) {
      if (intervalMs < 60000) intervalLabel = ' · каждую минуту';
      else if (intervalMs < 3600000) intervalLabel = ` · каждые ${Math.round(intervalMs / 60000)} мин`;
      else if (intervalMs < 86400000) intervalLabel = ' · каждый час';
      else intervalLabel = ` · раз в ${Math.round(intervalMs / 86400000)} д`;
    }

    // Дата создания
    const createdAt = a.createdAt ? new Date(a.createdAt) : null;
    const daysAgo = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : -1;
    const dateLabel = daysAgo < 0 ? '' : daysAgo === 0 ? 'сегодня' : daysAgo === 1 ? 'вчера' : `${daysAgo}д назад`;

    const text =
      `${statusIcon} *${esc(name)}*  \\#${esc(String(a.id))}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Статус: *${esc(statusText)}*\n` +
      `${triggerIcon} ${esc(triggerText + intervalLabel)}\n` +
      (dateLabel ? `📅 Создан: _${esc(dateLabel)}_\n` : '') +
      (hasError ? `\n⚠️ *Последняя ошибка:*\n\`${esc(lastErr!.error.slice(0, 120))}\`` : '') +
      (desc ? `\n_${esc(desc)}_` : '');

    const keyboard: any[][] = [
      [
        { text: a.isActive ? '⏸ Остановить' : '🚀 Запустить', callback_data: `run_agent:${agentId}` },
        { text: '📋 Логи', callback_data: `show_logs:${agentId}` },
      ],
    ];

    if (hasError) {
      keyboard.push([{ text: '🔧 AI Автопочинка', callback_data: `auto_repair:${agentId}` }]);
    }

    keyboard.push([
      { text: '👁 Код', callback_data: `show_code:${agentId}` },
      { text: '🔍 Аудит', callback_data: `audit_agent:${agentId}` },
    ]);
    keyboard.push([
      { text: '✏️ Изменить', callback_data: `edit_agent:${agentId}` },
      { text: '🏷 Переименовать', callback_data: `rename_agent:${agentId}` },
    ]);
    keyboard.push([
      { text: '🗑 Удалить', callback_data: `delete_agent:${agentId}` },
      { text: '◀️ Все агенты', callback_data: 'list_agents' },
    ]);

    await editOrReply(ctx, text, { reply_markup: { inline_keyboard: keyboard } });
  } catch (err) {
    await ctx.reply('❌ Ошибка загрузки агента');
  }
}

// ============================================================
// TON Connect
// ============================================================
async function showTonConnect(ctx: Context) {
  const userId = ctx.from!.id;
  const tonConn = getTonConnectManager();

  if (tonConn.isConnected(userId)) {
    // ── Кошелёк уже подключён ──
    const wallet = tonConn.getWallet(userId)!;
    const bal = await tonConn.getBalance(userId);
    await safeReply(ctx,
      `💎 *TON Connect*\n\n` +
      `✅ Кошелёк подключён\n` +
      `👛 ${esc(wallet.walletName)}\n` +
      `📋 Адрес: \`${esc(wallet.friendlyAddress)}\`\n` +
      `💰 Баланс: *${esc(bal.ton)}* TON\n\n` +
      `Что хотите сделать?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Обновить баланс', callback_data: 'ton_refresh' }],
            [{ text: '💸 Отправить TON', callback_data: 'ton_send' }],
            [{ text: '📋 История транзакций', callback_data: 'ton_history' }],
            [{ text: '🔌 Отключить кошелёк', callback_data: 'ton_disconnect' }],
          ],
        },
      }
    );
  } else {
    // ── Генерируем ссылку для подключения ──
    const result = await tonConn.generateConnectLink(userId);

    if (result.error || !result.universalLink) {
      await safeReply(ctx,
        `💎 *TON Connect*\n\n` +
        `⚠️ Не удалось получить ссылку для подключения\\.\n` +
        `${esc(result.error || '')}\n\n` +
        `Используйте /wallet для агентского кошелька \\(без мобильного приложения\\)\\.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Попробовать снова', callback_data: 'ton_connect_menu' }],
              [{ text: '💼 Кошелёк агента', callback_data: 'create_agent_wallet' }],
            ],
          },
        }
      );
      return;
    }

    // Сохраняем ссылку в памяти (для кнопки "скопировать")
    tonConnectLinks.set(userId, result.universalLink);

    // Устанавливаем callback — когда юзер подключится, отправим уведомление
    tonConn.onConnect(userId, async (w) => {
      if (w) {
        try {
          await ctx.telegram.sendMessage(
            userId,
            `✅ Кошелёк подключён!\n\n👛 ${w.walletName}\n📋 ${w.friendlyAddress}`,
          );
        } catch {}
      }
    });

    // Генерируем wallet-specific ссылки из universalLink (TON Connect 2.0)
    // Формат: https://app.tonkeeper.com/ton-connect?v=2&id=...&r=...
    const baseLink = result.universalLink;
    const linkParams = baseLink.includes('?') ? baseLink.slice(baseLink.indexOf('?')) : '';

    // Популярные кошельки — поддерживают TON Connect 2.0
    const walletButtons = [
      [{ text: '📱 Tonkeeper', url: baseLink }],
      [
        { text: '🔷 MyTonWallet', url: `https://mytonwallet.io/ton-connect${linkParams}` },
        { text: '🟡 TonHub', url: `https://tonhub.com/ton-connect${linkParams}` },
      ],
      [
        { text: '🟣 DeWallet', url: `https://t.me/DeWalletBot?startapp=tonconnect-${encodeURIComponent(baseLink)}` },
        { text: '⚡ OpenMask', url: `https://app.openmask.app/ton-connect${linkParams}` },
      ],
      [{ text: '🔗 Ссылка для любого кошелька', callback_data: 'ton_get_link' }],
      [{ text: '💼 Кошелёк агента (offline)', callback_data: 'create_agent_wallet' }],
    ];

    // Отправляем plain text — MarkdownV2 ломается на URL
    await ctx.reply(
      `💎 Подключение TON кошелька\n\n` +
      `Выберите ваш кошелёк и подтвердите подключение:\n\n` +
      `1. Нажмите кнопку вашего кошелька\n` +
      `2. Подтвердите в приложении\n` +
      `3. Бот уведомит об успехе ✅\n\n` +
      `Поддерживаются: Tonkeeper, MyTonWallet, TonHub, DeWallet и другие TON Connect v2 кошельки`,
      { reply_markup: { inline_keyboard: walletButtons } }
    );
  }
}

// ============================================================
// Маркетплейс
// ============================================================
async function showMarketplace(ctx: Context) {
  const CATS = [
    { id: 'ton',        icon: '💎', name: 'TON блокчейн', hint: 'кошельки, переводы, DeFi' },
    { id: 'finance',    icon: '💰', name: 'Финансы',      hint: 'цены, DEX, алерты' },
    { id: 'monitoring', icon: '📊', name: 'Мониторинг',   hint: 'uptime, API, уведомления' },
    { id: 'utility',    icon: '🔧', name: 'Утилиты',      hint: 'парсинг, расписания, задачи' },
    { id: 'social',     icon: '📣', name: 'Социальные',   hint: 'новости, посты, каналы' },
  ] as const;

  // Загружаем пользовательские листинги из БД
  let userListingsCount = 0;
  try {
    const listings = await getMarketplaceRepository().getListings();
    userListingsCount = listings.length;
  } catch { /* репозиторий может ещё не быть готов */ }

  let text = `🏪 *Маркетплейс агентов*\n`;
  text += `_Готовые агенты — установка в 1 клик_\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 Шаблонов: *${esc(String(allAgentTemplates.length))}*`;
  if (userListingsCount > 0) text += `  👥 Сообщество: *${esc(String(userListingsCount))}*`;
  text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  CATS.forEach(c => {
    const count = allAgentTemplates.filter(t => t.category === c.id).length;
    if (count > 0) text += `${c.icon} *${esc(c.name)}* — ${esc(String(count))} · _${esc(c.hint)}_\n`;
  });

  const btns = CATS.filter(c => allAgentTemplates.filter(t => t.category === c.id).length > 0)
    .map(c => {
      const count = allAgentTemplates.filter(t => t.category === c.id).length;
      return [{ text: `${c.icon} ${c.name} (${count})`, callback_data: `marketplace_cat:${c.id}` }];
    });
  btns.push([{ text: '📋 Все шаблоны', callback_data: 'marketplace_all' }]);
  if (userListingsCount > 0) {
    btns.push([{ text: '👥 От сообщества', callback_data: 'mkt_community' }]);
  }
  btns.push([{ text: '📤 Опубликовать своего агента', callback_data: 'mkt_publish_help' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showMarketplaceAll(ctx: Context) {
  const templates = allAgentTemplates.slice(0, 20);
  let text = `📋 *Все агенты (${allAgentTemplates.length}):*\n\n`;
  templates.forEach(t => { text += `${t.icon} *${esc(t.name)}* — ${esc(t.description.slice(0, 50))}\n`; });

  const btns = templates.map(t => [{ text: `${t.icon} ${t.name}`, callback_data: `template:${t.id}` }]);
  btns.push([{ text: '◀️ Назад', callback_data: 'marketplace' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showMarketplaceCategory(ctx: Context, category: AgentTemplate['category']) {
  const templates = allAgentTemplates.filter(t => t.category === category);
  if (!templates.length) { await ctx.reply('❌ Агенты не найдены', { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'marketplace' }]] } }); return; }

  const catNames: Record<string, string> = {
    ton: '💎 TON блокчейн', finance: '💰 Финансы', monitoring: '📊 Мониторинг',
    utility: '🔧 Утилиты', social: '📣 Социальные',
  };
  let text = `${catNames[category] || category} \\— *${esc(templates.length)} агентов*\n\nВыберите агента:\n\n`;
  templates.forEach(t => { text += `${t.icon} *${esc(t.name)}*\n${esc(t.description.slice(0, 60))}\n\n`; });

  const btns = templates.map(t => [{ text: `${t.icon} ${t.name}`, callback_data: `template:${t.id}` }]);
  btns.push([{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showTemplateDetails(ctx: Context, templateId: string) {
  const t = allAgentTemplates.find(x => x.id === templateId);
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  const triggerLine = t.triggerType === 'scheduled' ? '⏰ По расписанию' : t.triggerType === 'webhook' ? '🔗 Webhook' : '▶️ Вручную';
  let intervalLine = '';
  if (t.triggerType === 'scheduled' && t.triggerConfig.intervalMs) {
    const ms = t.triggerConfig.intervalMs;
    const label = ms >= 86400000 ? `${ms / 86400000} дн` : ms >= 3600000 ? `${ms / 3600000} ч` : `${ms / 60000} мин`;
    intervalLine = ` · каждые ${label}`;
  }

  let text =
    `${t.icon} *${esc(t.name)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_${esc(t.description)}_\n\n` +
    `${triggerLine}${esc(intervalLine)}\n` +
    `🏷 ${t.tags.slice(0, 5).map(x => `\`${esc(x)}\``).join(' ')}\n`;

  if (t.placeholders.length) {
    text += `\n⚙️ *Настраиваемые параметры:*\n`;
    t.placeholders.forEach(p => { text += `• \`${esc(p.name)}\`${p.required ? ' ✳️' : ''} — ${esc(p.description)}\n`; });
  } else {
    text += `\n✅ _Готов к запуску — параметры не нужны_\n`;
  }

  await editOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🚀 Создать и запустить`, callback_data: `create_from_template:${t.id}` }],
        [{ text: '◀️ Назад', callback_data: `marketplace_cat:${t.category}` }, { text: '🏪 Маркетплейс', callback_data: 'marketplace' }],
      ],
    },
  });
}

async function createAgentFromTemplate(ctx: Context, templateId: string, userId: number) {
  const t = allAgentTemplates.find(x => x.id === templateId);
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  // If template has configurable placeholders → run variable wizard first
  if (t.placeholders.length > 0) {
    const remaining = t.placeholders.map(p => p.name);
    pendingTemplateSetup.set(userId, { templateId, collected: {}, remaining });
    const first = t.placeholders[0];
    const lang = getUserLang(userId);
    await editOrReply(ctx,
      `${t.icon} *${esc(t.name)}*\n\n` +
      `⚙️ ${lang === 'ru' ? 'Настройка переменных' : 'Configure variables'} \\(${esc('1/' + t.placeholders.length)}\\)\n\n` +
      `📝 *${esc(first.name)}*\n${esc(first.description)}\n` +
      (first.example ? `\n_${lang === 'ru' ? 'Пример' : 'Example'}: \`${esc(first.example)}\`_` : '') +
      (first.required ? `\n\n${lang === 'ru' ? '❗ Обязательно' : '❗ Required'}` : `\n\n${lang === 'ru' ? '_(необязательно — отправьте пропустить)_' : '_(optional — send skip)_'}`),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [
          first.required ? [] : [{ text: lang === 'ru' ? '⏭ Пропустить' : '⏭ Skip', callback_data: `tmpl_skip_var:${templateId}` }],
          [{ text: lang === 'ru' ? '❌ Отмена' : '❌ Cancel', callback_data: 'tmpl_cancel' }],
        ].filter(row => row.length > 0) }
      }
    );
    return;
  }

  // No placeholders → create immediately
  await doCreateAgentFromTemplate(ctx, templateId, userId, {});
}

async function doCreateAgentFromTemplate(ctx: Context, templateId: string, userId: number, vars: Record<string, string>) {
  const t = allAgentTemplates.find(x => x.id === templateId);
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  await ctx.sendChatAction('typing');
  const name = t.id + '_' + Date.now().toString(36).slice(-4);

  // Merge collected vars into triggerConfig.config
  const triggerConfig = { ...t.triggerConfig, config: { ...(t.triggerConfig.config || {}), ...vars } };

  const result = await getDBTools().createAgent({
    userId,
    name,
    description: t.description,
    code: t.code,
    triggerType: t.triggerType,
    triggerConfig,
    isActive: false,
  });

  if (!result.success) { await ctx.reply(`❌ Ошибка: ${result.error}`); return; }
  const agent = result.data!;

  const lang = getUserLang(userId);
  let text =
    `🎉 *${lang === 'ru' ? 'Агент создан\\!' : 'Agent created\\!'}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${t.icon} *${esc(t.name)}*  \\#${esc(String(agent.id))}\n` +
    `🖥 _На сервере · работает 24/7_\n`;

  if (Object.keys(vars).length > 0) {
    text += `\n✅ *${lang === 'ru' ? 'Переменные:' : 'Variables:'}*\n`;
    Object.entries(vars).forEach(([k, v]) => { text += `\`${esc(k)}\` \\= \`${esc(v.slice(0, 40))}\`\n`; });
  }

  const unset = t.placeholders.filter(p => !vars[p.name] && p.required);
  if (unset.length) {
    text += `\n⚠️ *${lang === 'ru' ? 'Нужно настроить:' : 'Setup required:'}*\n`;
    unset.forEach(p => { text += `• \`${esc(p.name)}\` — ${esc(p.description)}\n`; });
  }

  const readyToRun = !unset.length;

  if (readyToRun) {
    text += `\n🟢 _${lang === 'ru' ? 'Автозапуск — первый результат через несколько секунд\\!' : 'Auto\\-starting — first result in seconds\\!'}_ ⚡`;
  }

  await safeReply(ctx, text, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        readyToRun
          ? [{ text: '⏸ Остановить', callback_data: `stop_agent:${agent.id}` }, { text: '👁 Код', callback_data: `show_code:${agent.id}` }]
          : [{ text: '🚀 Запустить', callback_data: `run_agent:${agent.id}` }, { text: '👁 Код', callback_data: `show_code:${agent.id}` }],
        [{ text: '📋 Мои агенты', callback_data: 'list_agents' }],
      ],
    },
  });

  // ── Авто-запуск если все переменные заполнены ──
  if (readyToRun) {
    setTimeout(async () => {
      try {
        await getRunnerAgent().runAgent({ agentId: agent.id, userId });
      } catch (e) {
        // Тихий сбой — пользователь может запустить вручную
      }
    }, 1500);
  }
}

// Helper: show next placeholder prompt or finalize template wizard
async function promptNextTemplateVar(ctx: Context, userId: number, state: PendingTemplateSetup) {
  const t = allAgentTemplates.find(x => x.id === state.templateId);
  if (!t) { pendingTemplateSetup.delete(userId); return; }

  if (state.remaining.length === 0) {
    // All vars collected — create the agent
    pendingTemplateSetup.delete(userId);
    await doCreateAgentFromTemplate(ctx, state.templateId, userId, state.collected);
    return;
  }

  const lang = getUserLang(userId);
  const nextName = state.remaining[0];
  const placeholder = t.placeholders.find(p => p.name === nextName)!;
  const stepNum = t.placeholders.findIndex(p => p.name === nextName) + 1;

  await editOrReply(ctx,
    `${t.icon} *${esc(t.name)}*\n\n` +
    `⚙️ ${lang === 'ru' ? 'Настройка переменных' : 'Configure variables'} \\(${esc(stepNum + '/' + t.placeholders.length)}\\)\n\n` +
    `📝 *${esc(nextName)}*\n${esc(placeholder.description)}\n` +
    (placeholder.example ? `\n_${lang === 'ru' ? 'Пример' : 'Example'}: \`${esc(placeholder.example)}\`_` : '') +
    (placeholder.required ? `\n\n${lang === 'ru' ? '❗ Обязательно' : '❗ Required'}` : `\n\n${lang === 'ru' ? '_(необязательно — отправьте «пропустить»)_' : '_(optional — send «skip»)_'}`),
    {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: [
        ...(placeholder.required ? [] : [[{ text: lang === 'ru' ? '⏭ Пропустить' : '⏭ Skip', callback_data: `tmpl_skip_var:${t.id}` }]]),
        [{ text: lang === 'ru' ? '❌ Отмена' : '❌ Cancel', callback_data: 'tmpl_cancel' }],
      ] }
    }
  );
}

// ============================================================
// Пользовательский маркетплейс (покупка/продажа между юзерами)
// ============================================================
async function showCommunityListings(ctx: Context) {
  try {
    const listings = await getMarketplaceRepository().getListings();
    if (!listings.length) {
      return editOrReply(ctx,
        '👥 *Листинги от сообщества*\n\nПока пусто\\. Будьте первым\\!',
        { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '📤 Опубликовать агента', callback_data: 'mkt_publish_help' }], [{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }]] } }
      );
    }

    let text = `👥 *Маркетплейс сообщества*\n━━━━━━━━━━━━━━━━━━━━\n_${esc(String(listings.length))} агентов от пользователей_\n\n`;
    listings.slice(0, 10).forEach((l: any) => {
      const price = l.isFree ? '🆓' : `💎 ${(l.price / 1e9).toFixed(1)}`;
      const sales = l.totalSales > 0 ? ` · ⬇️${esc(String(l.totalSales))}` : '';
      text += `${price} *${esc(l.name.slice(0, 35))}*${sales}\n`;
    });

    const btns = listings.slice(0, 8).map((l: any) => [
      { text: `${l.isFree ? '🆓' : '💰'} ${l.name.slice(0, 30)}`, callback_data: `mkt_view:${l.id}` }
    ]);
    btns.push([{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }]);

    await editOrReply(ctx, text, { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: btns } });
  } catch (e: any) {
    await editOrReply(ctx, `❌ Ошибка: ${esc(e.message)}`, { parse_mode: 'MarkdownV2' });
  }
}

async function showListingDetail(ctx: Context, listingId: number, userId: number) {
  try {
    const listing = await getMarketplaceRepository().getListing(listingId);
    if (!listing) return editOrReply(ctx, '❌ Листинг не найден', {});

    const alreadyBought = await getMarketplaceRepository().hasPurchased(listingId, userId);
    const isOwner = listing.sellerId === userId;

    const price = listing.isFree ? '🆓 Бесплатно' : `💎 ${(listing.price / 1e9).toFixed(2)} TON`;
    let text =
      `🤖 *${esc(listing.name)}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_${esc(listing.description || 'Описание отсутствует')}_\n\n` +
      `${price}  ·  📊 ${esc(String(listing.totalSales))} продаж\n`;
    if (isOwner) text += `\n_✏️ Вы — автор этого листинга_`;
    if (alreadyBought) text += `\n_✅ Уже приобретено_`;

    const btns: any[] = [];
    if (!isOwner && !alreadyBought) {
      btns.push([{ text: listing.isFree ? '🆓 Получить бесплатно' : `💰 Купить ${(listing.price / 1e9).toFixed(2)} TON`, callback_data: `mkt_buy:${listingId}` }]);
    }
    if (alreadyBought) {
      btns.push([{ text: '▶️ Запустить', callback_data: `run_agent:${listing.agentId}` }]);
    }
    btns.push([{ text: '◀️ Назад', callback_data: 'mkt_community' }, { text: '🏪 Маркетплейс', callback_data: 'marketplace' }]);

    await editOrReply(ctx, text, { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: btns } });
  } catch (e: any) {
    await editOrReply(ctx, `❌ Ошибка: ${esc(e.message)}`, { parse_mode: 'MarkdownV2' });
  }
}

async function buyMarketplaceListing(ctx: Context, listingId: number, userId: number) {
  try {
    const listing = await getMarketplaceRepository().getListing(listingId);
    if (!listing) return editOrReply(ctx, '❌ Листинг не найден', {});

    if (listing.sellerId === userId) {
      return editOrReply(ctx, '❌ Нельзя купить собственный листинг', {});
    }

    const already = await getMarketplaceRepository().hasPurchased(listingId, userId);
    if (already) {
      return editOrReply(ctx, '✅ Вы уже приобрели этого агента', {});
    }

    // Получаем исходный код агента
    const agentResult = await getDBTools().getAgent(listing.agentId, listing.sellerId);
    if (!agentResult.success || !agentResult.data) {
      return editOrReply(ctx, '❌ Агент продавца не найден', {});
    }
    const sourceAgent = agentResult.data;

    if (!listing.isFree && listing.price > 0) {
      // Платный агент — генерируем TON Connect ссылку и ждём транзакцию
      const platformWallet = process.env.PLATFORM_WALLET || 'EQD5LrKFnzKCYzaKk1-kQeVj3BxaOTsXPFNEoJF-zF5SNTQ';
      const payloadStr = Buffer.from(`buy:${listingId}:${userId}`).toString('base64');
      const tonLink = `https://ton.org/transfer/${platformWallet}?amount=${listing.price}&text=${payloadStr}`;

      await editOrReply(ctx,
        `💰 *Оплата покупки*\n\n` +
        `*${esc(listing.name)}*\n` +
        `Цена: ${esc((listing.price / 1e9).toFixed(2))} TON\n\n` +
        `Переведите сумму и нажмите *Проверить оплату* через 30–60 секунд\n\n` +
        `_Адрес: \`${esc(platformWallet)}\`_\n` +
        `_Сумма: \`${esc((listing.price / 1e9).toFixed(9))} TON\`_`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 Открыть в Tonkeeper', url: tonLink }],
              [{ text: '✅ Я оплатил — проверить', callback_data: `mkt_check_pay:${listingId}` }],
              [{ text: '◀️ Отмена', callback_data: `mkt_view:${listingId}` }],
            ],
          },
        }
      );
      return;
    }

    // Бесплатный агент — создаём копию для покупателя
    const newAgentResult = await getDBTools().createAgent({
      userId,
      name: listing.name,
      description: `[Маркетплейс #${listingId}] ${sourceAgent.description || ''}`,
      code: sourceAgent.code,
      triggerType: sourceAgent.triggerType as any,
      triggerConfig: (sourceAgent.triggerConfig as any) || {},
      isActive: false,
    });

    if (!newAgentResult.success || !newAgentResult.data) {
      return editOrReply(ctx, `❌ Ошибка создания агента: ${esc(newAgentResult.error || '')}`, { parse_mode: 'MarkdownV2' });
    }
    const newAgent = newAgentResult.data;

    // Записываем покупку
    await getMarketplaceRepository().createPurchase({
      listingId, buyerId: userId, sellerId: listing.sellerId,
      agentId: newAgent.id, type: 'free', pricePaid: 0,
    });

    await editOrReply(ctx,
      `✅ *Агент получен\\!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 *${esc(listing.name)}*  \\#${esc(String(newAgent.id))}\n` +
      `🆓 Бесплатно из маркетплейса\n\n` +
      `_Запустите агента — всё готово к работе_`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Запустить', callback_data: `run_agent:${newAgent.id}` }, { text: '👁 Просмотр', callback_data: `agent_menu:${newAgent.id}` }],
            [{ text: '🤖 Мои агенты', callback_data: 'list_agents' }],
          ],
        },
      }
    );
  } catch (e: any) {
    await editOrReply(ctx, `❌ Ошибка: ${esc(e.message || 'Неизвестная ошибка')}`, { parse_mode: 'MarkdownV2' });
  }
}

// ============================================================
// Публикация агента: вспомогательные функции
// ============================================================
async function startPublishFlow(ctx: Context, userId: number) {
  try {
    const agents = await getDBTools().getUserAgents(userId);
    const agentList = (agents.data || []) as any[];

    if (!agentList.length) {
      await editOrReply(ctx,
        `📤 *Публикация в маркетплейс*\n\nУ вас ещё нет агентов\\.\n\nСначала создайте агента, а затем опубликуйте его\\!`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [[{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }]] },
        }
      );
      return;
    }

    const rows = agentList.slice(0, 8).map((a: any) => [
      { text: `🤖 ${(a.name || `Агент #${a.id}`).slice(0, 32)}`, callback_data: `publish_agent:${a.id}` },
    ]);
    rows.push([{ text: '❌ Отмена', callback_data: 'publish_cancel' }]);

    await editOrReply(ctx,
      `📤 *Публикация агента в маркетплейс*\n\nВыберите агента для публикации:\n\n_Покупатели смогут запускать агента, но не увидят ваш код_`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }
    );
  } catch (e: any) {
    await ctx.reply(`❌ Ошибка: ${e.message}`);
  }
}

async function doPublishAgent(ctx: Context, userId: number, agentId: number, priceNano: number, name: string) {
  try {
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      await ctx.reply('❌ Агент не найден или не принадлежит вам');
      return;
    }
    const agent = agentResult.data;
    const listing = await getMarketplaceRepository().createListing({
      agentId,
      sellerId: userId,
      name: name.slice(0, 60),
      description: (agent as any).description || '',
      category: 'other',
      price: priceNano,
      isFree: priceNano === 0,
    });

    const priceStr = priceNano === 0 ? 'Бесплатно' : (priceNano / 1e9).toFixed(2) + ' TON';
    await safeReply(ctx,
      `✅ *Агент опубликован\\!*\n\n` +
      `📋 Листинг \\#${esc(String(listing.id))}\n` +
      `🤖 *${esc(name)}*\n` +
      `💰 Цена: ${esc(priceStr)}\n\n` +
      `Другие пользователи найдут его в маркетплейсе\\.\nОни смогут *запускать* агента, но *не видеть код*`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏪 Маркетплейс', callback_data: 'marketplace' }],
            [{ text: '📦 Мои листинги', callback_data: 'mkt_mylistings' }],
          ],
        },
      }
    );
  } catch (e: any) {
    await safeReply(ctx, `❌ Ошибка публикации: ${esc(e.message || 'Неизвестная ошибка')}`, { parse_mode: 'MarkdownV2' });
  }
}

// ============================================================
// Плагины
// ============================================================
async function showPlugins(ctx: Context) {
  const mgr = getPluginManager();
  const plugins = mgr.getAllPlugins();
  const stats = mgr.getStats();

  let text = `🔌 *Маркетплейс плагинов*\n\n`;
  text += `Всего: *${esc(stats.total)}* | Установлено: *${esc(stats.installed)}*\n`;
  text += `Рейтинг: *${esc(stats.averageRating.toFixed(1))}* ⭐\n\n`;
  text += `*Категории:*\n`;
  text += `💰 DeFi: ${esc(stats.byType.defi || 0)}\n`;
  text += `📊 Аналитика: ${esc(stats.byType.analytics || 0)}\n`;
  text += `🔔 Уведомления: ${esc(stats.byType.notification || 0)}\n`;
  text += `🌐 Данные: ${esc(stats.byType['data-source'] || 0)}\n`;
  text += `🔒 Безопасность: ${esc(stats.byType.security || 0)}\n\n`;
  text += `Выберите плагин:`;

  const btns = plugins.slice(0, 6).map(p => [{
    text: `${p.isInstalled ? '✅' : '⬜'} ${p.name} ${p.price > 0 ? `(${p.price} TON)` : '(бесплатно)'}`,
    callback_data: `plugin:${p.id}`,
  }]);
  btns.push([{ text: '📋 Все плагины', callback_data: 'plugins_all' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showAllPlugins(ctx: Context) {
  const plugins = getPluginManager().getAllPlugins();
  let text = `🔌 *Все плагины (${esc(plugins.length)}):*\n\n`;
  plugins.forEach((p, i) => {
    text += `${esc(i + 1)}\\. ${p.isInstalled ? '✅' : '⬜'} *${esc(p.name)}* ${p.price > 0 ? `\\(${esc(p.price)} TON\\)` : '\\(free\\)'}\n`;
    text += `   ${esc(p.description.slice(0, 50))}\\.\\.\\.\n`;
  });
  const btns = plugins.map(p => [{ text: p.name, callback_data: `plugin:${p.id}` }]);
  btns.push([{ text: '◀️ Назад', callback_data: 'plugins' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns.slice(0, 10) } });
}

async function showPluginDetails(ctx: Context, pluginId: string) {
  const plugin = getPluginManager().getPlugin(pluginId);
  if (!plugin) { await ctx.reply('❌ Плагин не найден'); return; }

  let text =
    `🔌 *${esc(plugin.name)}*\n\n` +
    `${esc(plugin.description)}\n\n` +
    `👤 Автор: ${esc(plugin.author)}\n` +
    `⭐ Рейтинг: ${esc(plugin.rating)}/5\n` +
    `📥 Скачиваний: ${esc(plugin.downloads)}\n` +
    `💰 Цена: ${plugin.price > 0 ? `${esc(plugin.price)} TON` : 'Бесплатно'}\n` +
    `🏷 Теги: ${esc(plugin.tags.join(', '))}`;

  await editOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: plugin.isInstalled ? '🗑 Удалить' : '📥 Установить', callback_data: `plugin_${plugin.isInstalled ? 'uninstall' : 'install'}:${pluginId}` }],
        [{ text: '◀️ Назад', callback_data: 'plugins' }],
      ],
    },
  });
}

// ============================================================
// Workflow
// ============================================================
async function showWorkflows(ctx: Context, userId: number) {
  const engine = getWorkflowEngine();
  const workflows = engine.getUserWorkflows(userId);
  const templates = engine.getWorkflowTemplates();

  let text = `⚡ *Workflow — цепочки агентов*\n\n`;
  text += `Соединяйте агентов в автоматические цепочки\\.\n`;
  text += `Например: _проверь баланс → если мало → уведоми_\n\n`;

  if (workflows.length) {
    text += `*Ваши workflow \\(${esc(workflows.length)}\\):*\n`;
    workflows.forEach(wf => {
      text += `⚡ ${esc(wf.name)} — ${esc(wf.nodes.length)} шагов\n`;
    });
    text += '\n';
  }

  text += `*Готовые шаблоны:*\n`;
  templates.forEach((t, i) => { text += `${esc(i + 1)}\\. ${esc(t.name)}\n`; });

  const btns = templates.map((t, i) => [{ text: `📋 ${t.name}`, callback_data: `workflow_template:${i}` }]);
  btns.push([{ text: '🤖 Описать workflow (AI создаст)', callback_data: 'workflow_describe' }]);
  btns.push([{ text: '➕ Выбрать шаблон', callback_data: 'workflow_create' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showWorkflowTemplate(ctx: Context, idx: number) {
  const templates = getWorkflowEngine().getWorkflowTemplates();
  const t = templates[idx];
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  const text =
    `⚡ *${esc(t.name)}*\n\n${esc(t.description)}\n\n` +
    `Узлов: *${esc(t.nodes.length)}*\n\nНажмите "Создать" чтобы запустить этот workflow:`;

  await editOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Создать workflow', callback_data: `workflow_create_from:${idx}` }],
        [{ text: '◀️ Назад', callback_data: 'workflow' }],
      ],
    },
  });
}

async function createWorkflowFromTemplate(ctx: Context, userId: number, idx: number) {
  const engine = getWorkflowEngine();
  const templates = engine.getWorkflowTemplates();
  const t = templates[idx];
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  const nodes = t.nodes.map((n, i) => ({ ...n, agentId: i + 1 }));
  const result = await engine.createWorkflow(userId, t.name, t.description, nodes);

  if (result.success) {
    await safeReply(ctx,
      `✅ *Workflow создан\\!*\n\nНазвание: ${esc(t.name)}\nID: ${esc(result.workflowId)}\n\nАгенты кооперируются автоматически \\!`
    );
  } else {
    await ctx.reply(`❌ Ошибка: ${result.error}`);
  }
}

// ============================================================
// Статистика
// ============================================================
async function showStats(ctx: Context, userId: number) {
  const r = await getDBTools().getUserAgents(userId);
  const agents = r.data || [];
  const active = agents.filter(a => a.isActive).length;
  const scheduled = agents.filter(a => a.triggerType === 'scheduled').length;
  const pluginStats = getPluginManager().getStats();
  const tonConn = getTonConnectManager();
  const isConnected = tonConn.isConnected(userId);
  const wallet = isConnected ? tonConn.getWallet(userId) : null;
  const agentWallet = agentWallets.get(userId);
  const agentBalance = agentWallet ? await getWalletBalance(agentWallet.address) : null;
  const isOwner = userId === parseInt(process.env.OWNER_ID || '0');
  const currentModel = getUserModel(userId);
  const modelInfo = MODEL_LIST.find(m => m.id === currentModel);

  let text =
    `📊 *Ваша панель управления*\n\n` +
    `━━━ 🤖 Агенты ━━━\n` +
    `Всего: *${esc(agents.length)}* · Активных: *${esc(active)}* · По расписанию: *${esc(scheduled)}*\n\n` +
    `━━━ 💎 TON ━━━\n`;

  if (isConnected && wallet) {
    text += `TON Connect: ✅ ${esc(wallet.walletName)}\n`;
    text += `Адрес: \`${esc(wallet.friendlyAddress)}\`\n`;
  } else {
    text += `TON Connect: ❌ не подключён\n`;
  }

  if (agentBalance !== null) {
    text += `Агентский кошелёк: *${esc(agentBalance.toFixed(4))}* TON\n`;
  }

  text +=
    `\n━━━ 🧠 AI ━━━\n` +
    `Модель: ${esc(modelInfo?.icon || '')} *${esc(modelInfo?.label || currentModel)}*\n` +
    `Авто\\-fallback: ✅ включён\n\n` +
    `━━━ 🔌 Плагины ━━━\n` +
    `Доступно: *${esc(pluginStats.total)}* · Установлено: *${esc(pluginStats.installed)}*`;

  const keyboard: any[][] = [
    [
      { text: '🤖 Мои агенты', callback_data: 'list_agents' },
      { text: '🧠 Сменить модель', callback_data: 'model_selector' },
    ],
  ];
  if (isConnected) {
    keyboard.push([{ text: '💎 TON кошелёк', callback_data: 'ton_connect' }]);
  } else {
    keyboard.push([{ text: '💎 Подключить TON', callback_data: 'ton_connect' }]);
  }
  keyboard.push([{ text: '🌐 Открыть дашборд', url: 'https://tonagentplatform.ru/dashboard.html' }]);
  if (isOwner) {
    keyboard.push([{ text: '⚙️ Настройки платформы', callback_data: 'platform_settings' }]);
  }

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ============================================================
// Выбор модели AI
// ============================================================
async function showModelSelector(ctx: Context) {
  const userId = ctx.from!.id;
  const current = getUserModel(userId);
  const currentInfo = MODEL_LIST.find(m => m.id === current);

  let text =
    `🧠 *Выбор AI модели*\n\n` +
    `Активная: ${esc(currentInfo?.icon || '')} *${esc(currentInfo?.label || current)}*\n\n` +
    `При недоступности — бот автоматически пробует следующую модель в цепочке\\.\n\n` +
    `*Доступные модели:*\n`;

  MODEL_LIST.forEach(m => {
    const isCurrent = m.id === current;
    const tags: string[] = [];
    if ((m as any).recommended) tags.push('⭐ рекомендована');
    if ((m as any).fast) tags.push('⚡ быстрая');
    const tagStr = tags.length ? ` — _${esc(tags.join(', '))}_` : '';
    text += `${isCurrent ? '▶️' : '  '} ${m.icon} ${esc(m.label)}${esc(isCurrent ? ' ✅' : '')}${tagStr}\n`;
  });

  const btns = MODEL_LIST.map(m => [{
    text: `${m.id === current ? '✅ ' : ''}${m.icon} ${m.label}`,
    callback_data: `set_model:${m.id}`,
  }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

// ============================================================
// Подписки и оплата
// ============================================================

async function showSubscription(ctx: Context) {
  const userId = ctx.from!.id;
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.planId] || PLANS.free;
  const isOwner = userId === OWNER_ID_NUM;

  let text =
    `💳 *Подписка*\n\n` +
    `Текущий план: ${formatSubscription(sub)}\n\n` +
    `━━━ ${plan.icon} ${esc(plan.name)} ━━━\n`;

  plan.features.forEach(f => { text += `✅ ${esc(f)}\n`; });

  // Показываем использование генераций
  const genUsed = getGenerationsUsed(userId);
  const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
  text += `\n⚡ Генерации AI: *${esc(genUsed)}/${esc(genLimit)}* в этом месяце\n`;
  if (plan.pricePerGeneration > 0) {
    text += `💸 Цена за генерацию: *${esc(plan.pricePerGeneration)} TON*\n`;
  }

  if (!isOwner && plan.id === 'free') {
    text +=
      `\n💡 *Upgrade для большего:*\n` +
      `• До 100 агентов одновременно\n` +
      `• Включённые генерации AI/мес\n` +
      `• Расписание + Webhook + Workflow\n` +
      `• API доступ`;
  } else if (!isOwner && sub.expiresAt) {
    const days = Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86400000);
    text += `\n⏳ Истекает через *${esc(days)}* дн\\.`;
  }

  const btns: any[][] = [];
  if (!isOwner) {
    btns.push([{ text: '🚀 Улучшить план', callback_data: 'plans_menu' }]);
  }
  btns.push([
    { text: '🤖 Мои агенты', callback_data: 'list_agents' },
    { text: '💎 TON Connect', callback_data: 'ton_connect' },
  ]);

  await safeReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showPlans(ctx: Context) {
  const userId = ctx.from!.id;
  const currentSub = await getUserSubscription(userId);

  let text =
    `💎 *Планы TON Agent Platform*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Оплата в TON · напрямую · без посредников_\n\n`;

  const planOrder = ['free', 'starter', 'pro', 'unlimited'];
  for (const pid of planOrder) {
    const p = PLANS[pid];
    const isCurrent = currentSub.planId === pid;
    const isPopular = pid === 'pro';
    const marker = isCurrent ? '✅ ' : isPopular ? '🔥 ' : '   ';
    text += `${marker}${p.icon} *${esc(p.name)}*`;
    if (p.priceMonthTon === 0) {
      text += ' — _бесплатно_\n';
    } else {
      text += ` — *${esc(p.priceMonthTon)} TON*/мес\n`;
    }
    text += `    ${esc(p.features.slice(0, 3).join(' · '))}\n\n`;
  }

  const btns: any[][] = [];
  for (const pid of ['starter', 'pro', 'unlimited']) {
    const p = PLANS[pid];
    if (currentSub.planId === pid) continue;
    btns.push([
      { text: `${p.icon} ${p.name} — ${p.priceMonthTon} TON/мес`, callback_data: `buy_plan:${pid}:month` },
    ]);
    btns.push([
      { text: `${p.icon} ${p.name} — ${p.priceYearTon} TON/год (−20%)`, callback_data: `buy_plan:${pid}:year` },
    ]);
  }
  btns.push([{ text: '◀️ Назад', callback_data: 'subscription' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showPaymentInvoice(ctx: Context, planId: string, period: 'month' | 'year') {
  const userId = ctx.from!.id;
  const payment = createPayment(userId, planId, period);

  if ('error' in payment) {
    await ctx.reply(`❌ ${payment.error}`);
    return;
  }

  const plan = PLANS[planId];
  const periodLabel = period === 'year' ? 'год' : 'месяц';
  const expiresMin = Math.ceil((payment.expiresAt.getTime() - Date.now()) / 60000);
  const tonConn = getTonConnectManager();
  const isConnected = tonConn.isConnected(userId);

  let text =
    `💳 *Оплата подписки*\n\n` +
    `${plan.icon} *${esc(plan.name)}* на ${esc(periodLabel)}\n` +
    `Сумма: *${esc(payment.amountTon)} TON*\n\n` +
    `━━━ Способы оплаты ━━━\n\n`;

  if (isConnected) {
    text +=
      `*1\\. Через подключённый кошелёк* \\(рекомендуется\\)\n` +
      `Нажмите кнопку — подтвердите в Tonkeeper\n\n`;
  }

  text +=
    `*${isConnected ? '2' : '1'}\\. Вручную*\n` +
    `Отправьте *${esc(payment.amountTon)} TON* на адрес:\n` +
    `\`${esc(payment.address)}\`\n\n` +
    `Комментарий \\(обязательно\\):\n` +
    `\`${esc(payment.comment)}\`\n\n` +
    `⏱ Счёт действителен *${esc(expiresMin)} мин*\\.`;

  const btns: any[][] = [];
  if (isConnected) {
    btns.push([{ text: `💸 Оплатить ${payment.amountTon} TON через Tonkeeper`, callback_data: `pay_tonconnect:${planId}:${period}` }]);
  }
  btns.push([{ text: '✅ Я оплатил — проверить', callback_data: 'check_payment' }]);
  btns.push([{ text: '◀️ Отмена', callback_data: 'cancel_payment' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function checkPaymentStatus(ctx: Context) {
  const userId = ctx.from!.id;
  const pending = getPendingPayment(userId);

  if (!pending) {
    await ctx.reply('❌ Нет ожидающего платежа. Создайте новый через /plans');
    return;
  }

  await ctx.reply('🔍 Проверяю транзакцию...');

  const verify = await verifyTonTransaction(userId, pending.amountTon);

  if (verify.found && verify.txHash) {
    const result = await confirmPayment(userId, verify.txHash);
    if (result.success && result.plan) {
      const expStr = result.expiresAt
        ? result.expiresAt.toLocaleDateString('ru-RU')
        : 'бессрочно';
      await safeReply(ctx,
        `🎉 *Оплата подтверждена\\!*\n\n` +
        `${result.plan.icon} *${esc(result.plan.name)}* активирован\n` +
        `Действует до: *${esc(expStr)}*\n\n` +
        `Спасибо за поддержку платформы\\! 🙏`
      );
      await showSubscription(ctx);
    }
  } else {
    const minLeft = Math.ceil((pending.expiresAt.getTime() - Date.now()) / 60000);
    await ctx.reply(
      `⏳ Транзакция ещё не найдена\\.\n\n` +
      `Убедитесь что отправили *${pending.amountTon} TON*\n` +
      `с комментарием: \`sub:${pending.planId}:${pending.period}:${userId}\`\n\n` +
      `Осталось времени: *${minLeft} мин*\nПопробуйте снова через 1-2 минуты\\.`,
      { parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [
          [{ text: '🔄 Проверить снова', callback_data: 'check_payment' }],
          [{ text: '◀️ Отмена', callback_data: 'cancel_payment' }],
        ]}
      }
    );
  }
}

// ============================================================
// Помощь
// ============================================================
async function showHelp(ctx: Context) {
  const text =
    `❓ *TON Agent Platform — Справка*\n\n` +
    `━━━ 🚀 Как создать агента ━━━\n\n` +
    `Просто напишите задачу своими словами:\n` +
    `_"проверяй баланс кошелька UQ\\.\\.\\. каждый час"_\n` +
    `_"следи за ценой TON, уведоми если выше 5\\$"_\n` +
    `_"каждое 10\\-е число отправляй 50 TON на UQ\\.\\.\\."_\n\n` +
    `Агент создаётся автоматически и запускается на нашем сервере — *ничего устанавливать не нужно*\\.\n\n` +
    `━━━ 📋 Команды ━━━\n\n` +
    `/start — главное меню\n` +
    `/list — мои агенты\n` +
    `/run ID — запустить агента \\(пример: /run 3\\)\n` +
    `/config — мои переменные \\(ключи, адреса\\)\n` +
    `/model — выбрать AI модель\n` +
    `/sub — моя подписка\n` +
    `/plans — тарифы и оплата\n` +
    `/connect — подключить TON кошелёк \\(Tonkeeper\\)\n` +
    `/wallet — агентский кошелёк \\(без мобильного приложения\\)\n` +
    `/marketplace — готовые шаблоны агентов\n\n` +
    `━━━ 💡 Что умеют агенты ━━━\n\n` +
    `• Работать с *любыми* публичными API\n` +
    `• Мониторить TON\\-кошельки и цены\n` +
    `• Отправлять TON по расписанию\n` +
    `• Делать запросы к DEX \\(DeDust, STON\\.fi\\)\n` +
    `• Уведомлять вас в Telegram`;

  await safeReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏪 Маркетплейс', callback_data: 'marketplace' },
          { text: '🤖 Мои агенты', callback_data: 'list_agents' },
        ],
        [
          { text: '🧠 AI модель', callback_data: 'model_selector' },
          { text: '💎 TON кошелёк', callback_data: 'ton_connect' },
        ],
        [{ text: '🌐 Открыть дашборд', url: 'https://tonagentplatform.ru/dashboard.html' }],
      ],
    },
  });
}

// ============================================================
// Обработка ошибок
// ============================================================
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте /start').catch(() => {});
});

// ============================================================
// Запуск
// ============================================================
export function startBot() {
  initNotifier(bot);

  console.log('🤖 Starting TON Agent Platform Bot...');
  console.log(`🏪 Loaded ${allAgentTemplates.length} agent templates`);
  console.log(`🔌 Loaded ${getPluginManager().getAllPlugins().length} plugins`);

  // Retry logic: if Telegram returns 409 (previous polling still active) — wait and retry
  const launch = (attempt = 1) => {
    bot.launch({ dropPendingUpdates: true }).catch((err: any) => {
      const is409 = err?.response?.error_code === 409 || String(err?.message).includes('409');
      if (is409 && attempt < 6) {
        const delay = attempt * 5000;
        console.warn(`[Bot] 409 Conflict — waiting ${delay / 1000}s before retry (attempt ${attempt}/5)...`);
        setTimeout(() => launch(attempt + 1), delay);
      } else {
        console.error('[Bot] Fatal launch error:', err?.message || err);
        process.exit(1);
      }
    });
  };

  launch();
  console.log('✅ Bot is running!');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };
