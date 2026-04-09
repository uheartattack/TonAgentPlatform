import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { Address } from '@ton/core';
import { encryptApiKey, decryptApiKey } from './crypto-utils';
import { pe, peb, escHtml, div } from './premium-emoji';
import { getOrchestrator, MODEL_LIST, getUserModel, setUserModel, type ModelId, type AgentSetupNeeds, setLastInteractedAgent } from './agents/orchestrator';
import {
  authSendPhone, authSubmitCode, authSubmitPassword,
  authStartQR, cancelQRLogin, type Complete2FAFn,
  isAuthorized, getAuthState, clearAuthState,
  getGiftFloorPrice, getAllGiftFloors,
} from './fragment-service';
import { universalAgentChat } from './universal-agent-chat';
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
import { getTelegramGiftsService } from './services/telegram-gifts';
import {
  initPluginMarketplace, searchPlugins, getPluginListing, installPlugin,
  uninstallPlugin, ratePlugin, getCreatorRevenue, getCreatorListings,
  getUserPlugins as getMarketplaceUserPlugins, CATEGORIES as PLUGIN_CATEGORIES,
  type PluginListing as MktPluginListing,
} from './services/plugin-marketplace';
import { getUserSettingsRepository, getMarketplaceRepository, getExecutionHistoryRepository, getAgentStateRepository, getBalanceTxRepository } from './db/schema-extensions';
import { pool as dbPool } from './db';
import { getWorkflowEngine } from './agent-cooperation';
import { allAgentTemplates, type AgentTemplate } from './agent-templates';
import { TOOLSET_PROFILES } from './agents/ai-agent-runtime';
// Полный список capabilities (копия из CAPABILITY_TOOL_MAP ключей, без circular dep проблем)
const ALL_CAPABILITIES_FULL = [
  'wallet', 'nft', 'gifts', 'gifts_market',
  'telegram', 'telegram_admin', 'telegram_stories', 'telegram_forums',
  'telegram_analytics', 'telegram_media', 'telegram_discovery', 'telegram_premium',
  'web', 'state', 'events', 'notify', 'plugins', 'inter_agent',
  'blockchain', 'defi', 'dns', 'payments',
  'image', 'ton_mcp', 'workspace', 'mcp', 'confirmation',
  'image_gen', 'email', 'self_memory', 'journal', 'deals',
];
import {
  generateAgentWallet,
  getWalletBalance,
  getWalletInfo,
  sendAgentTransaction,
  sendPlatformTransaction,
  verifyPlatformWalletConfig,
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
  verifyTopupTransaction,
  PLATFORM_WALLET,
  formatSubscription,
  isPlatformAdmin,
} from './payments';

// ── Shared state & helpers (extracted for architectural clarity) ──────────
// src/state.ts holds all pending-Maps and their interfaces.
// Future handler modules should import directly from './state'.
// bot.ts re-exports so external consumers can import from a single place.
import type {
  PendingAgentCreation as _PendingAgentCreation,
  PendingNameAsk as _PendingNameAsk,
  PendingAgentSetup as _PendingAgentSetup,
  PendingTemplateSetup as _PendingTemplateSetup,
  PendingPublish as _PendingPublish,
  PendingOnboarding as _PendingOnboarding,
} from './state';

const OWNER_ID_NUM = parseInt(process.env.OWNER_ID || '0');

// Shared API key detection patterns (used in both global key and agent-edit flows)
const API_KEY_PATTERNS: ReadonlyArray<{ pattern: RegExp; provider: string }> = [
  { pattern: /AIzaSy[A-Za-z0-9_\-]{33}/, provider: 'gemini' },
  { pattern: /sk-ant-[A-Za-z0-9_\-]{80,}/, provider: 'anthropic' },
  { pattern: /sk-proj-[A-Za-z0-9_\-]{40,}/, provider: 'openai' },
  { pattern: /sk-[A-Za-z0-9]{40,}/, provider: 'openai' },
  { pattern: /gsk_[A-Za-z0-9]{40,}/, provider: 'groq' },
  { pattern: /sk-or-[A-Za-z0-9_\-]{40,}/, provider: 'openrouter' },
];

// ============================================================
// Per-user rate limiter for expensive operations (create/edit/publish)
// ============================================================
const _rateLimits = new Map<number, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;       // max operations per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/** Returns true if rate limit exceeded. */
function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = _rateLimits.get(userId);
  if (!entry || now >= entry.resetAt) {
    _rateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Periodic cleanup of stale rate limit entries (every 5 min)
const _rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of _rateLimits) {
    if (now >= entry.resetAt) _rateLimits.delete(uid);
  }
}, 5 * 60 * 1000);
_rateLimitCleanupInterval.unref();

// ============================================================
// TON address validation (prefix + structural via @ton/core)
// ============================================================
function isValidTonAddress(addr: string): boolean {
  // Quick prefix check
  if (!addr.startsWith('EQ') && !addr.startsWith('UQ') && !addr.startsWith('kQ') && !addr.startsWith('0:')) return false;
  try {
    if (addr.startsWith('0:')) {
      Address.parseRaw(addr);
    } else {
      Address.parseFriendly(addr);
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// MarkdownV2 escaping — все 18 спецсимволов Telegram
// ============================================================
/** Безопасный парсинг списка установленных плагинов из DB.
 * Обрабатывает как JSON-массив `["id1","id2"]`, так и plain-строку `"id1"`. */
function safeParsePluginList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try { return JSON.parse(s); } catch { return []; }
  }
  // Старый формат: одна строка без JSON — вернуть как массив из одного элемента
  return s ? [s] : [];
}

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

// Безопасный reply — пробуем MarkdownV2 (или HTML если указан), при ошибке — plain text
async function safeReply(ctx: Context, text: string, extra?: object): Promise<void> {
  const extraObj: any = extra || {};
  // Если parse_mode уже задан в extra — используем его, иначе HTML
  const parseMode = extraObj.parse_mode || 'HTML';
  try {
    await ctx.reply(text, { parse_mode: parseMode, ...extraObj });
  } catch (err: any) {
    // При ошибке парсинга — убираем разметку и отправляем plain
    if (err?.response?.error_code === 400) {
      // Убираем HTML/Markdown теги для plain text
      const plain = parseMode === 'HTML'
        ? text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        : text.replace(/<[^>]*>/g, '').replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
      const plainExtra: any = { ...extraObj };
      delete plainExtra.parse_mode;
      try {
        await ctx.reply(plain, plainExtra);
      } catch {
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
  const pct = Math.round(((stepIdx + 1) / steps.length) * 100);
  const schedPrefix = lang === 'en' ? 'Schedule' : 'Расписание';
  return (
    `${step.icon} <b>${escHtml(step.label)}...</b>\n\n` +
    `<code>${bar}</code>  ${pct}%\n\n` +
    `<i>${schedPrefix}: ${escHtml(scheduleLabel)}</i>`
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

  const lang = getUserLang(chatId as number);
  const text = renderCreationStep(0, scheduleLabel, lang);

  if (sendNew) {
    const sent = await ctx.reply(text, { parse_mode: 'HTML' }).catch(() => null);
    msgId = sent?.message_id;
  } else {
    // Редактируем уже существующее сообщение колбэка
    await ctx.editMessageText(text, { parse_mode: 'HTML' }).catch(() => {});
    msgId = ctx.callbackQuery && 'message' in ctx.callbackQuery
      ? ctx.callbackQuery.message?.message_id
      : undefined;
  }
  const stepTimer = setInterval(async () => {
    stepIdx = Math.min(stepIdx + 1, CREATION_STEPS.length - 1);
    if (chatId && msgId) {
      await ctx.telegram.editMessageText(
        chatId, msgId, undefined,
        renderCreationStep(stepIdx, scheduleLabel, lang),
        { parse_mode: 'HTML' },
      ).catch(() => {});
    }
  }, 3000);

  const typingTimer = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);

  let stopped = false;
  const stopFn = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(stepTimer);
    clearInterval(typingTimer);
    clearTimeout(autoStopTimer);
  };

  // Auto-stop after 60 seconds to prevent timer leaks
  const autoStopTimer = setTimeout(() => {
    stopFn();
  }, 60_000);

  return {
    stop: stopFn,
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
  const extraObj: any = extra || {};
  const parseMode = extraObj.parse_mode || 'HTML';

  if (chatId && msgId) {
    // Callback — пробуем редактировать
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { parse_mode: parseMode, ...extraObj } as any);
      return;
    } catch (editErr: any) {
      // Если текст не изменился (400) — не страшно
      if (editErr?.response?.error_code === 400 && (editErr?.response?.description?.includes('message is not modified') || editErr?.description?.includes('message is not modified'))) return;
      // Иначе пробуем plain text редактирование (без parse_mode)
      try {
        const plain = parseMode === 'HTML'
          ? text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          : text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
        const plainExtra: any = { ...extraObj };
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

// Убрать XML теги от AI ответов (но НЕ трогать <tg-emoji> теги)
function sanitize(text: string): string {
  return text
    // Убираем только не-tg-emoji XML теги
    .replace(/<(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*>[\s\S]*?<\/(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*>/g, '')
    .replace(/<(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*\s*\/>/g, '')
    .replace(/<(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*(?!\s*emoji)[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// Бот и меню
// ============================================================
const bot: Telegraf = new Telegraf(process.env.BOT_TOKEN || '');

// Статичное меню (русский по умолчанию)
// ── Главное меню (reply keyboard — всегда внизу) ─────────────────────────
// Структура: главные функции сверху, дополнительные снизу
const MAIN_MENU = Markup.keyboard([
  ['🤖 Мои агенты',  '✏️ Создать агента'],
  ['🏪 Маркетплейс', '🔌 Плагины'],
  ['💰 Кошелёк',     '👤 Профиль'],
  ['⚡ Workflow',     '❓ Помощь'],
]).resize();

function getMainMenu(lang: 'ru' | 'en') {
  if (lang === 'en') {
    return Markup.keyboard([
      ['🤖 My Agents',    '✏️ Create Agent'],
      ['🏪 Marketplace',  '🔌 Plugins'],
      ['💰 Wallet',       '👤 Profile'],
      ['⚡ Workflow',      '❓ Help'],
    ]).resize();
  }
  return MAIN_MENU;
}

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
  createdAt?: number;       // timestamp для TTL cleanup
}
const pendingCreations = new Map<number, PendingAgentCreation>();

// Auto-cleanup stale pending states every 5 minutes (prevents stuck users)
const _pendingCleanup = setInterval(() => {
  const now = Date.now();
  const TTL = 10 * 60 * 1000; // 10 minutes
  for (const [userId, pending] of pendingCreations) {
    if (pending.createdAt && now - pending.createdAt > TTL) {
      pendingCreations.delete(userId);
      console.log(`[bot] Auto-cleaned stale pendingCreation for user ${userId}`);
    }
  }
}, 5 * 60 * 1000);
_pendingCleanup.unref();

// ============================================================
// State machine для запроса названия агента
// ============================================================
interface PendingNameAsk {
  description: string;
}
const pendingNameAsk = new Map<number, PendingNameAsk>(); // userId → state

// State machine для пользовательских плагинов
const pendingPluginCreation = new Map<number, { step: 'name' | 'description' | 'code'; name?: string; description?: string }>();

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
// Iterative refinement tracking: stores last created/edited agentId per user
// ============================================================
const pendingRefinements = new Map<number, number>(); // userId → last agentId

// ============================================================
// Chat with AI agent: userId → agentId (активный чат-сеанс)
// ============================================================
const pendingAgentChats = new Map<number, number>(); // userId → agentId
const pendingBlocklistAdd = new Map<number, number>(); // userId → agentId
const pendingTriggerAdd = new Map<number, { agentId: number; step: 'keyword' | 'context'; keyword?: string }>(); // userId → state

// ============================================================
// Proposal discussion: userId → proposalId
// ============================================================
const pendingProposalDiscuss = new Map<number, string>(); // userId → proposalId

// ============================================================
// Post-creation agent setup wizard
// ============================================================
interface PendingAgentSetup {
  agentId: number;
  steps: Array<'tg_auth' | 'wallet' | 'api_key'>;  // remaining steps
  currentStep: number;
  tgAuthed: boolean;
  hasApiKey: boolean;
  walletCreated: boolean;
}
const pendingAgentSetup = new Map<number, PendingAgentSetup>(); // userId → setup state

// ============================================================
// Agent ownership cache — avoids repeated DB lookups for hot paths
// ============================================================
const _ownerCache = new Map<number, { ownerId: number; ts: number }>();
function getCachedOwner(agentId: number): number | null {
  const c = _ownerCache.get(agentId);
  if (c && Date.now() - c.ts < 30000) return c.ownerId;
  return null;
}
function setCachedOwner(agentId: number, ownerId: number) {
  _ownerCache.set(agentId, { ownerId, ts: Date.now() });
  // Evict oldest half instead of clearing all (prevents cache stampede)
  if (_ownerCache.size > 5000) {
    const keys = Array.from(_ownerCache.keys());
    for (let i = 0; i < 2500; i++) _ownerCache.delete(keys[i]);
  }
}

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

/** Returns user profile from DB, never throws — falls back to a default on any error. */
async function getUserProfile(userId: number): Promise<UserProfile> {
  try {
    const saved = await getUserSettingsRepository().get(userId, 'profile');
    if (saved && typeof saved === 'object') return saved as UserProfile;
  } catch (e) {
    console.warn(`[bot] getUserProfile failed for userId=${userId}:`, (e as Error).message);
  }
  return { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
}

async function saveUserProfile(userId: number, profile: UserProfile): Promise<void> {
  try { await getUserSettingsRepository().set(userId, 'profile', profile); } catch {}
}

async function addUserBalance(
  userId: number,
  amount: number,
  opts?: { type?: string; description?: string; txHash?: string }
): Promise<UserProfile> {
  // Use a DB transaction with row-level locking to prevent race conditions
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    // Lock the profile row to prevent concurrent balance modifications
    const { rows } = await client.query(
      `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'profile' FOR UPDATE`,
      [userId]
    );
    const p: UserProfile = rows[0]?.value || { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
    p.balance_ton = Math.max(0, (p.balance_ton || 0) + amount);
    if (amount > 0) p.total_earned = (p.total_earned || 0) + amount;

    // Update profile within the transaction
    await client.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, 'profile', $2::jsonb, NOW())
       ON CONFLICT ON CONSTRAINT user_settings_unique DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify(p)]
    );

    // Record in ledger within the same transaction
    const txType = opts?.type || (amount > 0 ? 'topup' : 'spend');
    await client.query(
      `INSERT INTO builder_bot.balance_transactions (user_id, type, amount_ton, balance_after, description, tx_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
      [userId, txType, amount, p.balance_ton, opts?.description || null, opts?.txHash || null]
    );

    await client.query('COMMIT');
    return p;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('[addUserBalance] Transaction failed:', e);
    // Fallback: return current profile without modification
    const fallback = await getUserProfile(userId);
    return fallback;
  } finally {
    client.release();
  }
}

/**
 * Atomically check balance and deduct in a single DB transaction.
 * Returns the updated profile if successful, or null if insufficient balance.
 * Prevents TOCTOU race conditions between check and deduct.
 */
async function atomicBalanceDeduct(
  userId: number,
  amount: number,
  opts?: { type?: string; description?: string; txHash?: string }
): Promise<UserProfile | null> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'profile' FOR UPDATE`,
      [userId]
    );
    const p: UserProfile = rows[0]?.value || { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };
    if ((p.balance_ton || 0) < amount) {
      await client.query('ROLLBACK');
      return null; // insufficient balance
    }
    p.balance_ton = Math.max(0, (p.balance_ton || 0) - amount);
    await client.query(
      `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
       VALUES ($1, 'profile', $2::jsonb, NOW())
       ON CONFLICT ON CONSTRAINT user_settings_unique DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify(p)]
    );
    const txType = opts?.type || 'spend';
    await client.query(
      `INSERT INTO builder_bot.balance_transactions (user_id, type, amount_ton, balance_after, description, tx_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
      [userId, txType, -amount, p.balance_ton, opts?.description || null, opts?.txHash || null]
    );
    await client.query('COMMIT');
    return p;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('[atomicBalanceDeduct] Transaction failed:', e);
    return null;
  } finally {
    client.release();
  }
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
const _wizardLock = new Set<number>(); // prevents double-processing of template wizard input

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
const pendingTgAuth = new Map<number, 'phone' | 'code' | 'password' | 'qr_waiting' | 'qr_password'>();
// QR polling handles: userId → intervalId (legacy, kept for cleanup)
const qrPollingHandles = new Map<number, NodeJS.Timeout>();
// 2FA completion functions for QR login: userId → complete2FA(password)
const complete2FAFns = new Map<number, Complete2FAFn>();

// ============================================================
// State machine для онбординга новых пользователей
// ============================================================
interface PendingOnboarding {
  step: 'welcome' | 'provider' | 'apikey' | 'create_agent';
  provider?: string;
  apiKey?: string;
  createdAt: number;
}
const pendingOnboarding = new Map<number, PendingOnboarding>(); // userId → state
const pendingFeedback = new Map<number, { type: string; startTs: number }>(); // userId → feedback state

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
// Clear all pending states for a user (prevents race conditions)
// ============================================================
function clearAllPendingStates(userId: number): void {
  pendingCreations.delete(userId);
  pendingNameAsk.delete(userId);
  pendingRenames.delete(userId);
  pendingEdits.delete(userId);
  pendingAgentChats.delete(userId);
  pendingWithdrawal.delete(userId);
  pendingTemplateSetup.delete(userId);
  pendingPublish.delete(userId);
  pendingTgAuth.delete(userId);
  pendingApiKey.delete(userId);
  pendingLangSetup.delete(userId);
  pendingAgentSetup.delete(userId);
  pendingPluginCreation.delete(userId);
  pendingOnboarding.delete(userId);
  pendingTopup.delete(userId);
  pendingUserIdea.delete(userId);
  pendingProposalDiscuss.delete(userId);
  pendingWalletImport.delete(userId);
  pendingWalletLimit.delete(userId);
  pendingWalletRename.delete(userId);
  pendingRefinements.delete(userId);
}

// ============================================================
// Periodic cleanup of pending Maps to prevent memory leaks
// ============================================================
const _pendingTimestamps = new Map<string, number>(); // "mapName:key" → first-seen timestamp
const PENDING_TTL = 30 * 60 * 1000; // 30 minutes

// All pending Maps/Sets to auto-track (built lazily to avoid TDZ issues with later declarations)
function _getAllPendingMaps(): [string, Map<any, any> | Set<any>][] {
  return [
    ['creation', pendingCreations],
    ['nameAsk', pendingNameAsk],
    ['rename', pendingRenames],
    ['edit', pendingEdits],
    ['chat', pendingAgentChats],
    ['withdrawal', pendingWithdrawal],
    ['template', pendingTemplateSetup],
    ['publish', pendingPublish],
    ['tgAuth', pendingTgAuth],
    ['apiKey', pendingApiKey],
    ['langSetup', pendingLangSetup],
    ['setup', pendingAgentSetup],
    ['pluginCreate', pendingPluginCreation],
    ['onboarding', pendingOnboarding],
    ['topup', pendingTopup],
    ['2fa', complete2FAFns],
    ['repair', pendingRepairs], // keyed by string, not userId
    // NOTE: agentWallets, tonConnectLinks, userLanguages are caches — NOT included here
    // (they should not be pruned by TTL, only refreshed on access)
    ['userIdea', pendingUserIdea],
    ['proposalDiscuss', pendingProposalDiscuss],
    ['walletImport', pendingWalletImport],
    ['walletLimit', pendingWalletLimit],
    ['walletRename', pendingWalletRename],
    ['refinements', pendingRefinements],
  ];
}

const _mapsCleanup = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  const allMaps = _getAllPendingMaps();
  for (const [name, collection] of allMaps) {
    const keys = collection instanceof Set ? [...collection] : [...collection.keys()];
    for (const key of keys) {
      const tsKey = `${name}:${key}`;
      if (!_pendingTimestamps.has(tsKey)) {
        // First time seeing this entry — record timestamp
        _pendingTimestamps.set(tsKey, now);
      } else if (now - _pendingTimestamps.get(tsKey)! > PENDING_TTL) {
        // Expired — remove from collection and timestamp tracker
        if (collection instanceof Set) {
          collection.delete(key);
        } else {
          collection.delete(key);
        }
        _pendingTimestamps.delete(tsKey);
        cleaned++;
      }
    }
  }

  // Max-size enforcement: if any pending map exceeds 5000 entries, evict oldest (first keys)
  for (const [, collection] of allMaps) {
    if (collection.size > 5000) {
      const keys = collection instanceof Set ? [...collection] : [...collection.keys()];
      const excess = keys.slice(0, collection.size - 5000);
      for (const k of excess) { collection.delete(k); cleaned++; }
    }
  }

  // Clean stale timestamp entries whose Map entry was already removed normally
  for (const tsKey of [..._pendingTimestamps.keys()]) {
    const colonIdx = tsKey.indexOf(':');
    const name = tsKey.slice(0, colonIdx);
    const rawKey = tsKey.slice(colonIdx + 1);
    const entry = allMaps.find(([n]) => n === name);
    if (!entry) { _pendingTimestamps.delete(tsKey); continue; }
    const coll = entry[1];
    const lookupKey = /^\d+$/.test(rawKey) ? parseInt(rawKey, 10) : rawKey;
    if (coll instanceof Set ? !coll.has(lookupKey) : !(coll as Map<any, any>).has(lookupKey)) {
      _pendingTimestamps.delete(tsKey);
    }
  }

  // Clean QR polling handles for expired entries
  for (const [userId, handle] of [...qrPollingHandles]) {
    if (!pendingTgAuth.has(userId)) {
      clearInterval(handle);
      qrPollingHandles.delete(userId);
      cleaned++;
    }
  }

  // Clean complete2FAFns entries older than 10 minutes
  const TFA_TTL = 10 * 60 * 1000;
  for (const key of [...complete2FAFns.keys()]) {
    const tsKey = `2fa:${key}`;
    const ts = _pendingTimestamps.get(tsKey);
    if (ts && now - ts > TFA_TTL) {
      complete2FAFns.delete(key);
      _pendingTimestamps.delete(tsKey);
      cleaned++;
    }
  }

  // Cap processedTopupTx to prevent unbounded growth
  if (processedTopupTx.size > 5000) {
    const toRemove = [...processedTopupTx].slice(0, processedTopupTx.size - 2000);
    for (const tx of toRemove) processedTopupTx.delete(tx);
    cleaned += toRemove.length;
  }

  // Cap cache Maps to prevent unbounded growth (not TTL-based, just size-capped)
  if (userLanguages.size > 10000) { userLanguages.clear(); cleaned += 1; }
  if (agentWallets.size > 10000) { agentWallets.clear(); cleaned += 1; }
  if (tonConnectLinks.size > 10000) { tonConnectLinks.clear(); cleaned += 1; }
  if (_ownerCache.size > 5000) { _ownerCache.clear(); cleaned += 1; }

  // Clear stale wizard locks to prevent permanently stuck users
  _wizardLock.clear();

  // Cap _pendingTimestamps tracker itself
  if (_pendingTimestamps.size > 10000) { _pendingTimestamps.clear(); cleaned += 1; }

  if (cleaned > 0) {
    console.log(`[Cleanup] Cleared ${cleaned} stale pending entries`);
  }
}, 5 * 60 * 1000); // every 5 minutes
_mapsCleanup.unref();

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
// Onboarding Wizard — пошаговая настройка для новых пользователей
// ============================================================

const PROVIDER_INFO: Record<string, { emoji: string; name: string; price: string; speed: string; quality: string }> = {
  gemini:     { emoji: '🔴', name: 'Gemini',     price: '💰 бесплатный',    speed: '⚡⚡⚡ быстрый',         quality: '🧠🧠 хороший' },
  openai:     { emoji: '🟢', name: 'OpenAI',     price: '💰💰💰 дорогой',   speed: '⚡⚡ средний',           quality: '🧠🧠🧠 лучший' },
  anthropic:  { emoji: '🟣', name: 'Anthropic',  price: '💰💰 средний',     speed: '⚡⚡ средний',           quality: '🧠🧠🧠 лучший' },
  groq:       { emoji: '🔵', name: 'Groq',       price: '💰 дешёвый',       speed: '⚡⚡⚡ самый быстрый',   quality: '🧠🧠 хороший' },
  deepseek:   { emoji: '🟠', name: 'DeepSeek',   price: '💰 дешёвый',       speed: '⚡⚡ средний',           quality: '🧠🧠🧠 умный' },
  openrouter: { emoji: '🌐', name: 'OpenRouter', price: '💰💰 разный',      speed: '⚡⚡ зависит',           quality: '🧠🧠🧠 любая модель' },
  together:   { emoji: '🤝', name: 'Together',   price: '💰 дешёвый',       speed: '⚡⚡⚡ быстрый',         quality: '🧠🧠 хороший' },
};

async function validateApiKey(provider: string, apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const prov = provider.toLowerCase();
  let baseURL: string;
  let model: string;

  if (prov.includes('gemini') || prov.includes('google')) {
    baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    model = 'gemini-2.0-flash';
  } else if (prov.includes('anthropic')) {
    // Anthropic uses its own API format, test via messages endpoint
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
      });
      if (resp.ok || resp.status === 200) return { ok: true };
      const body = await resp.text().catch(() => '');
      if (resp.status === 401) return { ok: false, error: 'Неверный ключ (401 Unauthorized)' };
      if (resp.status === 403) return { ok: false, error: 'Ключ заблокирован (403 Forbidden)' };
      return { ok: false, error: `Ошибка ${resp.status}: ${body.slice(0, 100)}` };
    } catch (e: any) {
      return { ok: false, error: e.message || String(e) };
    }
  } else if (prov.includes('groq')) {
    baseURL = 'https://api.groq.com/openai/v1';
    model = 'llama-3.3-70b-versatile';
  } else if (prov.includes('deepseek')) {
    baseURL = 'https://api.deepseek.com/v1';
    model = 'deepseek-chat';
  } else if (prov.includes('openrouter')) {
    baseURL = 'https://openrouter.ai/api/v1';
    model = 'google/gemini-2.5-flash';
  } else if (prov.includes('together')) {
    baseURL = 'https://api.together.xyz/v1';
    model = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  } else {
    baseURL = 'https://api.openai.com/v1';
    model = 'gpt-4o-mini';
  }

  // OpenAI-compatible test
  try {
    const resp = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
    });
    if (resp.ok || resp.status === 200) return { ok: true };
    if (resp.status === 401) return { ok: false, error: 'Неверный ключ (401 Unauthorized)' };
    if (resp.status === 403) return { ok: false, error: 'Ключ заблокирован (403 Forbidden)' };
    const body = await resp.text().catch(() => '');
    return { ok: false, error: `Ошибка ${resp.status}: ${body.slice(0, 100)}` };
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function showOnboardingStep(ctx: Context, userId: number, lang: 'ru' | 'en') {
  const state = pendingOnboarding.get(userId);
  if (!state) return;

  const ru = lang === 'ru';

  if (state.step === 'welcome') {
    const name = ctx.from?.first_name || ctx.from?.username || (ru ? 'друг' : 'friend');
    const text = ru
      ? `${pe('sparkles')} <b>Добро пожаловать в TON Agent Platform!</b>\n\n` +
        `Привет, ${escHtml(name)}! Давай настроим платформу за пару минут.\n\n` +
        `${pe('brain')} <b>Что умеет платформа:</b>\n` +
        `• AI-агенты работают 24/7 автономно\n` +
        `• 20+ инструментов: TON, DeFi, подарки, парсинг\n` +
        `• 7 AI-провайдеров на выбор\n` +
        `• Маркетплейс готовых агентов\n\n` +
        `${pe('bolt')} Нажмите <b>Начать настройку</b>, чтобы выбрать AI-провайдера.`
      : `${pe('sparkles')} <b>Welcome to TON Agent Platform!</b>\n\n` +
        `Hey ${escHtml(name)}! Let's set up the platform in a couple of minutes.\n\n` +
        `${pe('brain')} <b>What the platform can do:</b>\n` +
        `• AI agents work 24/7 autonomously\n` +
        `• 20+ tools: TON, DeFi, gifts, parsing\n` +
        `• 7 AI providers to choose from\n` +
        `• Marketplace of ready-made agents\n\n` +
        `${pe('bolt')} Press <b>Start Setup</b> to choose your AI provider.`;

    await editOrReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: ru ? '🚀 Начать настройку' : '🚀 Start Setup', callback_data: 'ob_start_setup' }],
          [{ text: ru ? '⏩ Пропустить настройку' : '⏩ Skip Setup', callback_data: 'ob_skip_all' }],
        ],
      },
    });
  } else if (state.step === 'provider') {
    const text = ru
      ? `${pe('brain')} <b>Шаг 1/3 — Выберите AI-провайдера</b>\n\n` +
        `Провайдер определяет "мозг" ваших агентов.\n` +
        `Рекомендация для старта: <b>Gemini</b> (бесплатный) или <b>Groq</b> (очень быстрый).\n\n` +
        Object.entries(PROVIDER_INFO).map(([, info]) =>
          `${info.emoji} <b>${info.name}</b>\n   ${info.price} | ${info.speed} | ${info.quality}`
        ).join('\n\n')
      : `${pe('brain')} <b>Step 1/3 — Choose AI Provider</b>\n\n` +
        `The provider determines the "brain" of your agents.\n` +
        `Recommended to start: <b>Gemini</b> (free) or <b>Groq</b> (very fast).\n\n` +
        Object.entries(PROVIDER_INFO).map(([, info]) =>
          `${info.emoji} <b>${info.name}</b>\n   ${info.price} | ${info.speed} | ${info.quality}`
        ).join('\n\n');

    await editOrReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔴 Gemini (бесплатный)', callback_data: 'ob_provider:gemini' },
          ],
          [
            { text: '🟢 OpenAI', callback_data: 'ob_provider:openai' },
            { text: '🟣 Anthropic', callback_data: 'ob_provider:anthropic' },
          ],
          [
            { text: '🔵 Groq (быстрый)', callback_data: 'ob_provider:groq' },
            { text: '🟠 DeepSeek', callback_data: 'ob_provider:deepseek' },
          ],
          [
            { text: '🌐 OpenRouter', callback_data: 'ob_provider:openrouter' },
            { text: '🤝 Together', callback_data: 'ob_provider:together' },
          ],
          [{ text: ru ? '⏩ Пропустить' : '⏩ Skip', callback_data: 'ob_skip_all' }],
        ],
      },
    });
  } else if (state.step === 'apikey') {
    const info = PROVIDER_INFO[state.provider || ''] || { emoji: '🤖', name: state.provider || 'Unknown' };
    const text = ru
      ? `🔑 <b>Шаг 2/3 — API ключ для ${escHtml(info.name)}</b>\n\n` +
        `Отправьте API ключ для ${escHtml(info.name)}.\n` +
        `Ключ будет проверен автоматически.\n\n` +
        `${getApiKeyHint(state.provider || '', 'ru')}`
      : `🔑 <b>Step 2/3 — API Key for ${escHtml(info.name)}</b>\n\n` +
        `Send your API key for ${escHtml(info.name)}.\n` +
        `The key will be validated automatically.\n\n` +
        `${getApiKeyHint(state.provider || '', 'en')}`;

    await editOrReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: ru ? '⏩ Пропустить (без своего ключа)' : '⏩ Skip (use platform key)', callback_data: 'ob_skip_key' }],
          [{ text: ru ? '◀️ Назад к провайдерам' : '◀️ Back to providers', callback_data: 'ob_back_provider' }],
        ],
      },
    });
  } else if (state.step === 'create_agent') {
    const text = ru
      ? `✅ <b>Шаг 3/3 — Создайте первого агента!</b>\n\n` +
        `${pe('brain')} Опишите задачу для агента своими словами.\n\n` +
        `<b>Примеры:</b>\n` +
        `• <i>"Следи за ценой TON и уведомляй при изменении 5%"</i>\n` +
        `• <i>"Мониторь подарки — ищи арбитраж от 10% спреда"</i>\n` +
        `• <i>"Парси новости с CoinDesk каждый час"</i>\n\n` +
        `${pe('finger')} Напишите описание задачи прямо сейчас:`
      : `✅ <b>Step 3/3 — Create your first agent!</b>\n\n` +
        `${pe('brain')} Describe the task for your agent in plain words.\n\n` +
        `<b>Examples:</b>\n` +
        `• <i>"Track TON price and notify on 5% changes"</i>\n` +
        `• <i>"Monitor gifts — find arbitrage with 10% spread"</i>\n` +
        `• <i>"Parse CoinDesk news every hour"</i>\n\n` +
        `${pe('finger')} Type your task description now:`;

    await editOrReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: ru ? '🏪 Или выбрать из шаблонов' : '🏪 Or pick a template', callback_data: 'marketplace' }],
          [{ text: ru ? '⏩ Позже' : '⏩ Later', callback_data: 'ob_finish' }],
        ],
      },
    });
  }
}

function getApiKeyHint(provider: string, lang: 'ru' | 'en'): string {
  const ru = lang === 'ru';
  const hints: Record<string, { url: string; prefix: string }> = {
    gemini:     { url: 'aistudio.google.com/apikey', prefix: 'AIzaSy...' },
    openai:     { url: 'platform.openai.com/api-keys', prefix: 'sk-proj-...' },
    anthropic:  { url: 'console.anthropic.com/settings/keys', prefix: 'sk-ant-...' },
    groq:       { url: 'console.groq.com/keys', prefix: 'gsk_...' },
    deepseek:   { url: 'platform.deepseek.com/api_keys', prefix: 'sk-...' },
    openrouter: { url: 'openrouter.ai/settings/keys', prefix: 'sk-or-...' },
    together:   { url: 'api.together.ai/settings/api-keys', prefix: 'tok_...' },
  };
  const hint = hints[provider] || { url: '', prefix: '' };
  return ru
    ? `💡 ${hint.prefix ? `Формат ключа: <code>${escHtml(hint.prefix)}</code>\n` : ''}` +
      `${hint.url ? `🔗 Получить: ${escHtml(hint.url)}` : ''}`
    : `💡 ${hint.prefix ? `Key format: <code>${escHtml(hint.prefix)}</code>\n` : ''}` +
      `${hint.url ? `🔗 Get it: ${escHtml(hint.url)}` : ''}`;
}

async function showPostCreationTips(ctx: Context, userId: number) {
  const lang = getUserLang(userId);
  const ru = lang === 'ru';
  const text = ru
    ? `💡 <b>Советы для начала:</b>\n\n` +
      `• 🔐 Подключи Telegram аккаунт для userbot режима — /tglogin\n` +
      `• 💰 Создай кошелёк TON для крипто-функций — 💰 Кошелёк\n` +
      `• ⚡ Настрой активный режим для групп\n` +
      `• 🏪 Загляни на маркетплейс за готовыми шаблонами`
    : `💡 <b>Tips to get started:</b>\n\n` +
      `• 🔐 Connect Telegram account for userbot mode — /tglogin\n` +
      `• 💰 Create a TON wallet for crypto features — 💰 Wallet\n` +
      `• ⚡ Set up active mode for groups\n` +
      `• 🏪 Check marketplace for ready-made templates`;
  await safeReply(ctx, text, { parse_mode: 'HTML' });
}

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
        ? `\n${pe('globe')} <b>Платформа:</b> ${stats.totalAgents} агентов | ${stats.activeAgents} активны\n`
        : `\n${pe('globe')} <b>Platform:</b> ${stats.totalAgents} agents | ${stats.activeAgents} active\n`)
    : '\n';

  // Живая цена TON в приветствии — вау-момент
  let priceLine = '';
  if (price) {
    const arrow = price.change24h >= 0 ? pe('trending') : '📉';
    const sign = price.change24h >= 0 ? '+' : '';
    priceLine =
      `\n${pe('diamond')} <b>TON сейчас:</b> $${price.usd.toFixed(2)} ${arrow} ${sign}${price.change24h.toFixed(1)}% за 24ч\n`;
  }

  const examples = lang === 'ru'
    ? [
        `<i>"Найди недооценённые подарки Plush Pepe дешевле 5 TON"</i>`,
        `<i>"Следи за ценой TON и уведоми при изменении 5%+"</i>`,
        `<i>"Мониторь арбитраж подарков — ищи спред от 10%"</i>`,
        `<i>"Парси новости с CoinDesk каждые 30 минут"</i>`,
      ]
    : [
        `<i>"Find underpriced Plush Pepe gifts under 5 TON"</i>`,
        `<i>"Track TON price and alert on 5%+ changes"</i>`,
        `<i>"Monitor gift arbitrage — find 10%+ spreads"</i>`,
        `<i>"Parse CoinDesk news every 30 minutes"</i>`,
      ];

  const text = lang === 'ru'
    ? `${pe('sparkles')} <b>Добро пожаловать, ${escHtml(name)}!</b>\n\n` +
      `<b>TON Agent Platform</b> — пишешь задачу словами,\n` +
      `AI создаёт агента, который работает 24/7.` +
      statsLine + priceLine +
      `${div()}\n` +
      `${pe('brain')} <b>Просто напиши задачу. Примеры:</b>\n\n` +
      examples.map(e => `• ${e}`).join('\n') + '\n\n' +
      `${div()}\n` +
      `${pe('bolt')} 7 AI-провайдеров | 20+ инструментов | 12 плагинов`
    : `${pe('sparkles')} <b>Welcome, ${escHtml(name)}!</b>\n\n` +
      `<b>TON Agent Platform</b> — describe a task in plain text,\n` +
      `AI creates an agent that runs 24/7.` +
      statsLine + priceLine +
      `${div()}\n` +
      `${pe('brain')} <b>Just type your task. Examples:</b>\n\n` +
      examples.map(e => `• ${e}`).join('\n') + '\n\n' +
      `${div()}\n` +
      `${pe('bolt')} 7 AI providers | 20+ tools | 12 plugins`;

  await safeReply(ctx, text, { ...getMainMenu(lang), parse_mode: 'HTML' });
  // Быстрый старт — только ключевые действия
  await ctx.reply(
    lang === 'ru'
      ? `${pe('finger')} <b>Быстрый старт:</b>`
      : `${pe('finger')} <b>Quick start:</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `✏️ ${lang === 'ru' ? 'Написать задачу' : 'Describe task'}`, callback_data: 'create_agent_prompt' },
            { text: `${peb('store')} ${lang === 'ru' ? 'Шаблоны' : 'Templates'}`, callback_data: 'marketplace' },
          ],
          [
            { text: `${peb('plugin')} ${lang === 'ru' ? 'Плагины' : 'Plugins'}`, callback_data: 'plugins' },
            { text: `${peb('bolt')} Workflow`, callback_data: 'workflow' },
          ],
          [
            { text: `👤 ${lang === 'ru' ? 'Профиль & Баланс' : 'Profile & Balance'}`, callback_data: 'show_profile' },
            { text: `${peb('coin')} ${lang === 'ru' ? 'Пополнить' : 'Top Up'}`, callback_data: 'topup_start' },
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
      `${demo.emoji} <b>Demo Mode — ${escHtml(startPayload.replace('demo_','').replace('_',' ').toUpperCase())}</b>\n\n` +
      `I'll create this agent for you instantly:\n` +
      `<i>${escHtml(demo.desc)}</i>\n\n` +
      `Just tap <b>Create Agent</b> below or send me the description!`
    , {
      parse_mode: 'HTML',
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

  // Beta invite code deeplink: /start beta_XXXXXXXX
  if (startPayload.startsWith('beta_') && startPayload !== 'beta_open') {
    const code = startPayload.replace('beta_', '');
    const { redeemBetaCode } = require('./payments');
    const result = await redeemBetaCode(code, userId, ctx.from?.username);
    if (result.ok) {
      const ru = getUserLang(userId) === 'ru';
      await safeReply(ctx, ru ? '🧪 Добро пожаловать в бета-тест!\n\nВаш план: Beta Tester (10 агентов, 50 генераций/мес)\n\nИспользуйте /feedback чтобы сообщить о багах.' : '🧪 Welcome to beta test!\n\nYour plan: Beta Tester (10 agents, 50 gens/month)\n\nUse /feedback to report bugs.');
    } else {
      await safeReply(ctx, `❌ ${result.error}`);
    }
    return;
  }

  // Open beta deeplink: /start beta_open
  if (startPayload === 'beta_open') {
    const { isBetaTester, addBetaTester } = require('./payments');
    const ru = getUserLang(userId) === 'ru';
    if (isBetaTester(userId)) {
      await safeReply(ctx, ru ? '🧪 Вы уже бета-тестер!' : '🧪 You are already a beta tester!');
      return;
    }
    // Check slot limit
    const { pool } = require('./db');
    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM builder_bot.beta_testers WHERE status = 'active'`);
    const MAX_OPEN_BETA = 500;
    if (parseInt(countRes.rows[0].cnt) >= MAX_OPEN_BETA) {
      await safeReply(ctx, ru ? '😔 Бета-тест заполнен. Следите за обновлениями!' : '😔 Beta is full. Stay tuned for updates!');
      return;
    }
    await addBetaTester(userId, ctx.from?.username, 'open_beta');
    await safeReply(ctx, ru ? '🧪 Добро пожаловать в открытую бету!\n\nПлан: Beta Tester (10 агентов, 50 генераций/мес)\nИспользуйте /feedback для фидбека.' : '🧪 Welcome to open beta!\n\nPlan: Beta Tester\nUse /feedback for feedback.');
    return;
  }

  // ── Web studio auth via deeplink: /start webauth_TOKEN ──
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
        `✅ <b>Авторизация успешна!</b>\n\n` +
        `Привет, ${escHtml(name)}! Вернитесь в браузер — студия загружается автоматически.\n\n` +
        `🌐 ${escHtml(landingUrl)}/studio`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply('❌ Токен авторизации не найден или истёк. Обновите страницу дашборда.');
    }
    return;
  }

  // ── Share deeplink: /start share_ID ──
  if (startPayload.startsWith('share_')) {
    const listingId = parseInt(startPayload.replace('share_', ''), 10);
    if (!isNaN(listingId)) {
      const listing = await getMarketplaceRepository().getListing(listingId);
      if (!listing || !listing.isActive) {
        await safeReply(ctx, '❌ Агент не найден или снят с продажи.', {});
        return;
      }
      await showListingDetail(ctx, listingId, userId);
      return;
    }
  }

  await getMemoryManager().clearHistory(userId);
  const lang = existingLang || 'ru';
  await showWelcome(ctx, userId, name, lang);
});

// ============================================================
// Beta & Feedback
// ============================================================

bot.command('beta', async (ctx) => {
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!args) {
    const { isBetaTester } = require('./payments');
    if (isBetaTester(userId)) {
      await safeReply(ctx, ru ? '🧪 Вы бета-тестер! Используйте /feedback для обратной связи.' : '🧪 You are a beta tester! Use /feedback for feedback.');
    } else {
      await safeReply(ctx, ru ? '🧪 Введите инвайт-код: /beta XXXXXX\nИли откройте t.me/TonAgentPlatformBot?start=beta_open' : '🧪 Enter invite code: /beta XXXXXX\nOr open t.me/TonAgentPlatformBot?start=beta_open');
    }
    return;
  }
  const { redeemBetaCode } = require('./payments');
  const result = await redeemBetaCode(args, userId, ctx.from?.username);
  if (result.ok) {
    await safeReply(ctx, ru ? '🧪 Код активирован! Добро пожаловать в бета-тест!\nПлан: Beta Tester (10 агентов, 50 генераций/мес)' : '🧪 Code activated! Welcome to beta!\nPlan: Beta Tester (10 agents, 50 gens/month)');
  } else {
    await safeReply(ctx, `❌ ${result.error}`);
  }
});

bot.command('feedback', async (ctx) => {
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  await safeReply(ctx, ru ? '📝 Выберите тип обращения:' : '📝 Choose feedback type:', {
    reply_markup: { inline_keyboard: [
      [
        { text: '🐛 Баг', callback_data: 'fb_type:bug' },
        { text: '💡 Фича', callback_data: 'fb_type:feature' },
      ],
      [
        { text: '🆘 Саппорт', callback_data: 'fb_type:support' },
        { text: '💬 Общее', callback_data: 'fb_type:general' },
      ],
    ] },
  });
});

bot.action(/^fb_type:(.+)$/, async (ctx) => {
  const userId = ctx.from!.id;
  const type = ctx.match![1];
  const ru = getUserLang(userId) === 'ru';
  pendingFeedback.set(userId, { type, startTs: Date.now() });
  await ctx.answerCbQuery();
  const labels: Record<string, string> = { bug: '🐛 Баг-репорт', feature: '💡 Предложение', support: '🆘 Саппорт', general: '💬 Общее' };
  await safeReply(ctx, ru ? `${labels[type] || type}\n\nОпишите проблему или предложение. Можно приложить скриншот.` : `${labels[type] || type}\n\nDescribe the issue. You can attach a screenshot.`);
});

bot.command('my_feedback', async (ctx) => {
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const { pool } = require('./db');
    const res = await pool.query(
      `SELECT id, type, message, status, admin_reply, created_at FROM builder_bot.feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );
    if (!res.rows.length) {
      await safeReply(ctx, ru ? '📭 У вас нет тикетов.' : '📭 No tickets found.');
      return;
    }
    const statusIcons: Record<string, string> = { new: '🔵', in_progress: '🟡', resolved: '🟢', closed: '⚪' };
    const lines = res.rows.map((r: any) => {
      const icon = statusIcons[r.status] || '⚪';
      const date = new Date(r.created_at).toLocaleDateString('ru');
      let line = `${icon} #${r.id} [${r.type}] ${date}\n${r.message.slice(0, 80)}`;
      if (r.admin_reply) line += `\n↳ Ответ: ${r.admin_reply.slice(0, 60)}`;
      return line;
    });
    await safeReply(ctx, (ru ? '📋 Ваши тикеты:\n\n' : '📋 Your tickets:\n\n') + lines.join('\n\n'));
  } catch (e: any) { await safeReply(ctx, `❌ ${e.message}`); }
});

// ── Admin: generate beta codes ──
bot.command('beta_code', async (ctx) => {
  const userId = ctx.from!.id;
  const { isPlatformAdmin, generateBetaCodes } = require('./payments');
  if (!isPlatformAdmin(userId)) return;
  const args = ctx.message.text.split(' ').slice(1);
  const count = parseInt(args[0]) || 5;
  const note = args.slice(1).join(' ') || undefined;
  const codes = await generateBetaCodes(Math.min(count, 50), userId, note);
  const links = codes.map((c: string) => `• \`${c}\` → t.me/TonAgentPlatformBot?start=beta_${c}`).join('\n');
  await safeReply(ctx, `🧪 Сгенерировано ${codes.length} кодов:\n\n${links}`);
});

// ── Admin: add beta tester manually ──
bot.command('beta_add', async (ctx) => {
  const userId = ctx.from!.id;
  const { isPlatformAdmin, addBetaTester } = require('./payments');
  if (!isPlatformAdmin(userId)) return;
  const target = ctx.message.text.split(' ')[1]?.trim();
  if (!target) { await safeReply(ctx, 'Usage: /beta_add @username or /beta_add 123456789'); return; }
  const targetId = parseInt(target.replace('@', ''));
  if (isNaN(targetId)) { await safeReply(ctx, `Ищу @${target}...`); return; } // TODO: resolve username
  await addBetaTester(targetId, target);
  await safeReply(ctx, `✅ User ${target} added as beta tester`);
});

// ── Admin: list beta testers ──
bot.command('beta_list', async (ctx) => {
  const userId = ctx.from!.id;
  const { isPlatformAdmin } = require('./payments');
  if (!isPlatformAdmin(userId)) return;
  const { pool } = require('./db');
  const res = await pool.query(`SELECT user_id, username, status, invite_code, created_at FROM builder_bot.beta_testers ORDER BY created_at DESC LIMIT 30`);
  if (!res.rows.length) { await safeReply(ctx, '📭 Нет тестеров'); return; }
  const lines = res.rows.map((r: any) => `${r.status === 'active' ? '🟢' : '🔴'} ${r.username || r.user_id} (${r.invite_code || 'manual'}) ${new Date(r.created_at).toLocaleDateString('ru')}`);
  await safeReply(ctx, `🧪 Beta testers (${res.rows.length}):\n\n${lines.join('\n')}`);
});

// ── Admin: feedback list ──
bot.command('feedback_list', async (ctx) => {
  const userId = ctx.from!.id;
  const { isPlatformAdmin } = require('./payments');
  if (!isPlatformAdmin(userId)) return;
  const { pool } = require('./db');
  const res = await pool.query(`SELECT id, user_id, username, type, message, status, created_at FROM builder_bot.feedback ORDER BY created_at DESC LIMIT 15`);
  if (!res.rows.length) { await safeReply(ctx, '📭 Нет фидбека'); return; }
  const statusIcons: Record<string, string> = { new: '🔵', in_progress: '🟡', resolved: '🟢', closed: '⚪' };
  const lines = res.rows.map((r: any) => `${statusIcons[r.status] || '⚪'} #${r.id} [${r.type}] @${r.username || r.user_id}\n${r.message.slice(0, 100)}`);
  await safeReply(ctx, `📋 Feedback (${res.rows.length}):\n\n${lines.join('\n\n')}`);
});

// ── Leaderboard — top beta testers by points ──
bot.command('leaderboard', async (ctx) => {
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const { getBetaLeaderboard } = require('./payments');
    const lb = await getBetaLeaderboard(15);
    if (!lb.length) { await safeReply(ctx, ru ? '📊 Лидерборд пуст' : '📊 Leaderboard empty'); return; }
    const medals = ['🥇', '🥈', '🥉'];
    const lines = lb.map((r: any, i: number) => {
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      const planBadge = r.plan_override === 'unlimited' ? ' 💎' : r.plan_override === 'pro' ? ' ⭐' : '';
      return `${medal} @${r.username || r.user_id} — ${r.feedback_count} pts${planBadge}`;
    });
    const header = ru ? '🏆 *Лидерборд бета\\-тестеров*\n━━━━━━━━━━━━━━━━━━━━\n' : '🏆 *Beta Tester Leaderboard*\n━━━━━━━━━━━━━━━━━━━━\n';
    const thresholds = ru
      ? '\n\n📌 _50 pts \\= \\+20 генераций_\n📌 _100 pts \\= Pro план_\n📌 _200 pts \\= Unlimited_'
      : '\n\n📌 _50 pts \\= \\+20 gens_\n📌 _100 pts \\= Pro plan_\n📌 _200 pts \\= Unlimited_';
    await safeReply(ctx, header + lines.map((l: string) => esc(l)).join('\n') + thresholds);
  } catch (e: any) { await safeReply(ctx, `❌ ${e.message}`); }
});

// ============================================================
// Команды
// ============================================================
bot.command('help', (ctx) => showHelp(ctx));
bot.command('list', (ctx) => showAgentsList(ctx, ctx.from.id));
bot.command('marketplace', (ctx) => showMarketplace(ctx));
bot.command('connect', (ctx) => showTonConnect(ctx));

// ── /search — поиск агентов по имени/описанию ──
bot.command('search', async (ctx) => {
  const userId = ctx.from.id;
  const query = (ctx.message?.text || '').replace(/^\/search\s*/i, '').trim().toLowerCase();
  if (!query) {
    await safeReply(ctx, '🔍 Использование: /search <ключевое слово>\n\nПоиск среди ваших агентов по имени или описанию.');
    return;
  }
  try {
    const result = await getDBTools().getUserAgents(userId);
    if (!result.success || !result.data?.length) {
      await safeReply(ctx, '❌ У вас нет агентов.');
      return;
    }
    const matches = result.data.filter((a: any) =>
      (a.name || '').toLowerCase().includes(query) ||
      (a.description || '').toLowerCase().includes(query)
    );
    if (matches.length === 0) {
      await safeReply(ctx, `🔍 Ничего не найдено по запросу "${escHtml(query)}"`);
      return;
    }
    const lines = matches.slice(0, 20).map((a: any) =>
      `${a.isActive ? '🟢' : '⚪'} <b>${escHtml(a.name || 'Без имени')}</b> #${a.id}\n   ${escHtml((a.description || '').slice(0, 60))}`
    );
    const keyboard = matches.slice(0, 10).map((a: any) => [
      { text: `${a.isActive ? '🟢' : '⚪'} ${a.name || '#' + a.id}`, callback_data: `agent_menu:${a.id}` },
    ]);
    await ctx.reply(
      `🔍 Найдено ${matches.length} агент(ов) по "${escHtml(query)}":\n\n${lines.join('\n\n')}`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
    );
  } catch (e: any) {
    console.error('Search error:', e);
    await safeReply(ctx, '❌ Произошла ошибка при поиске. Попробуйте позже.');
  }
});

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
    const sign  = chg24 >= 0 ? '+' : '';
    const fmtB  = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : `$${(n/1e6).toFixed(0)}M`;
    const now   = new Date().toUTCString().slice(17, 22);

    const text =
      `${pe('diamond')} <b>TON / USD</b>\n` +
      `${div()}\n` +
      `${pe('coin')} <b>$${escHtml(usd.toFixed(4))}</b>\n` +
      `${arrow} ${sign}${escHtml(chg24.toFixed(2))}% ${lang === 'ru' ? 'за 24ч' : '24h change'}\n\n` +
      `${pe('chart')} ${lang === 'ru' ? 'Объём' : 'Volume'} 24h: <b>${escHtml(fmtB(vol))}</b>\n` +
      `🏦 ${lang === 'ru' ? 'Капитализация' : 'Market cap'}: <b>${escHtml(fmtB(mcap))}</b>\n` +
      `🏆 ATH: <b>$${escHtml(ath.toFixed(2))}</b>\n\n` +
      `⏰ ${now} UTC`;

    await safeReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: lang === 'ru' ? '🔄 Обновить' : '🔄 Refresh', callback_data: 'live_price' },
          { text: lang === 'ru' ? '🤖 Создать алерт' : '🤖 Create alert', callback_data: 'create_agent_prompt' },
        ]],
      },
    });
  } catch {
    await safeReply(ctx,
      lang === 'ru' ? '❌ Не удалось получить цену TON. Попробуйте ещё раз.' : '❌ Failed to fetch TON price. Try again.',
      { reply_markup: { inline_keyboard: [[{ text: '🔄 Retry', callback_data: 'live_price' }]] } }
    );
  }
}
bot.command('price', (ctx) => sendPriceCard(ctx));
bot.action('live_price', async (ctx) => { await ctx.answerCbQuery(); await sendPriceCard(ctx); });

// ── /portfolio <address> — снапшот кошелька ──────────────────
bot.command('portfolio', async (ctx) => {
  const lang = getUserLang(ctx.from.id);
  const parts = ctx.message.text.trim().split(/\s+/);
  const addr  = parts[1] || '';

  if (!addr || !isValidTonAddress(addr)) {
    await ctx.reply(
      lang === 'ru'
        ? '💼 Использование: <code>/portfolio EQD4...</code>\n<i>Введите адрес TON кошелька</i>'
        : '💼 Usage: <code>/portfolio EQD4...</code>\n<i>Enter a TON wallet address</i>',
      { parse_mode: 'HTML' }
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

    const usdVal = usdRate ? ` ≈ $${escHtml((balTON * usdRate).toFixed(2))}` : '';
    const short  = addr.slice(0, 6) + '…' + addr.slice(-4);

    const text =
      `${pe('wallet')} <b>${lang === 'ru' ? 'Кошелёк' : 'Wallet'} ${escHtml(short)}</b>\n` +
      `${div()}\n` +
      `${pe('coin')} <b>${escHtml(balTON.toFixed(4))} TON</b>${usdVal}\n` +
      `🕐 ${lang === 'ru' ? 'Последняя транзакция' : 'Last transaction'}: ${escHtml(lastTx)}\n` +
      `${pe('link')} <code>${escHtml(addr)}</code>`;

    await safeReply(ctx, text, {
      parse_mode: 'HTML',
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

// ── /ai — управление AI режимами (только для владельца) ──────────
const pendingUserIdea = new Map<number, boolean>(); // userId → waiting for idea text

bot.command('ai', async (ctx) => {
  if (!ctx.from || !isPlatformAdmin(ctx.from.id)) return;
  const { getSelfImprovementSystem } = await import('./self-improvement');
  const sis = getSelfImprovementSystem();
  if (!sis) { await ctx.reply('❌ Система не запущена'); return; }

  const modes = sis.getModesStatus();
  const ideasCount = sis.getPendingIdeasCount();
  const ideas = sis.getPendingIdeas();

  let text = '🤖 <b>AI Режимы</b>\n\n';
  text += `🔍 Улучшатель (авто 10мин): ${modes[0].enabled ? '✅' : '❌'}\n`;
  text += `💡 Придумыватель (авто 30мин): ${modes[1].enabled ? '✅' : '❌'}\n`;
  text += `🔨 Реализатор (по кнопке): всегда готов\n`;
  text += `\n📋 Идей в очереди: <b>${ideasCount}</b>`;
  if (ideas.length) {
    text += '\n';
    for (const i of ideas) text += `  ${i.index + 1}. ${escHtml(i.title)}\n`;
  }

  const kb: any[][] = [
    [
      { text: `${modes[0].enabled ? '✅' : '❌'} Улучшатель`, callback_data: 'ai_toggle:improver' },
      { text: '▶️ Запустить', callback_data: 'ai_run:improver' },
    ],
    [
      { text: `${modes[1].enabled ? '✅' : '❌'} Придумыватель`, callback_data: 'ai_toggle:ideator' },
      { text: '▶️ Запустить', callback_data: 'ai_run:ideator' },
    ],
    [
      { text: '✏️ Моя идея', callback_data: 'ai_my_idea' },
      { text: '🔨 Реализовать', callback_data: 'ai_run:implementor' },
    ],
  ];

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
});

// ── /plugin — пользовательские плагины ──────────────────────────
bot.command('plugin', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ').slice(1);
  const sub = args[0]?.toLowerCase();

  if (sub === 'list' || !sub) {
    const { getCustomPluginsRepository } = await import('./db/schema-extensions');
    const plugins = await getCustomPluginsRepository().getByUser(userId);
    if (!plugins.length) {
      await safeReply(ctx, '📦 У вас нет плагинов.\n\nИспользуйте /plugin create чтобы создать.', {});
      return;
    }
    let text = '📦 <b>Ваши плагины:</b>\n\n';
    for (const p of plugins) {
      text += `• <b>${escHtml(p.name)}</b> — ${escHtml(p.description || 'без описания')}\n  📊 Выполнений: ${p.exec_count}\n\n`;
    }
    text += '<i>Удалить: /plugin delete имя</i>';
    await safeReply(ctx, text, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'create') {
    const { getCustomPluginsRepository } = await import('./db/schema-extensions');
    const count = await getCustomPluginsRepository().countByUser(userId);
    if (count >= 10) {
      await safeReply(ctx, '❌ Максимум 10 плагинов на аккаунт.', {});
      return;
    }
    pendingPluginCreation.set(userId, { step: 'name' });
    await safeReply(ctx, '🔌 <b>Создание плагина</b>\n\nВведите имя плагина (2-30 символов, только буквы, цифры, _ и -):', { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'delete') {
    const name = args[1];
    if (!name) { await safeReply(ctx, '❌ Укажите имя: /plugin delete имя', {}); return; }
    const { getCustomPluginsRepository } = await import('./db/schema-extensions');
    const ok = await getCustomPluginsRepository().remove(userId, name);
    await safeReply(ctx, ok ? `✅ Плагин "${escHtml(name)}" удалён.` : '❌ Плагин не найден.', { parse_mode: 'HTML' });
    return;
  }

  await safeReply(ctx, '📦 <b>Плагины</b>\n\n/plugin list — список\n/plugin create — создать\n/plugin delete имя — удалить', { parse_mode: 'HTML' });
});

// ── /plugin_market — Plugin Marketplace with revenue sharing ──────
bot.command('plugin_market', async (ctx) => {
  const lang = getUserLang(ctx.from.id);
  const CATS = [
    { id: 'data-feed',      icon: '📡', name: lang === 'ru' ? 'Дата-фиды' : 'Data Feeds' },
    { id: 'dex-connector',  icon: '🔄', name: lang === 'ru' ? 'DEX коннекторы' : 'DEX Connectors' },
    { id: 'notification',   icon: '🔔', name: lang === 'ru' ? 'Уведомления' : 'Notifications' },
    { id: 'analytics',      icon: '📊', name: lang === 'ru' ? 'Аналитика' : 'Analytics' },
    { id: 'social',         icon: '💬', name: lang === 'ru' ? 'Социальные' : 'Social' },
    { id: 'utility',        icon: '🔧', name: lang === 'ru' ? 'Утилиты' : 'Utilities' },
    { id: 'telegram',       icon: '✈️', name: 'Telegram' },
    { id: 'defi',           icon: '💎', name: 'DeFi' },
    { id: 'nft',            icon: '🖼', name: 'NFT' },
  ];

  // Count plugins per category
  const allPlugins = await searchPlugins(undefined, undefined, 500);
  const totalCount = allPlugins.length;

  let text =
    `🔌 <b>${lang === 'ru' ? 'Маркетплейс плагинов' : 'Plugin Marketplace'}</b>\n` +
    `<i>${lang === 'ru' ? 'Расширения для ваших агентов — бесплатные и платные' : 'Extensions for your agents — free and paid'}</i>\n\n` +
    `📦 ${lang === 'ru' ? 'Всего плагинов' : 'Total plugins'}: <b>${totalCount}</b>\n\n`;

  for (const c of CATS) {
    const count = allPlugins.filter(p => p.category === c.id).length;
    if (count > 0) text += `${c.icon} <b>${escHtml(c.name)}</b> — ${count}\n`;
  }

  if (totalCount === 0) {
    text += `<i>${lang === 'ru' ? 'Пока нет плагинов. Будьте первым — опубликуйте свой!' : 'No plugins yet. Be the first — publish yours!'}</i>\n`;
  }

  // Top plugins by installs
  const top = allPlugins.slice(0, 3);
  if (top.length > 0) {
    text += `\n🔥 <b>${lang === 'ru' ? 'Популярные' : 'Popular'}:</b>\n`;
    for (const p of top) {
      const price = p.priceStars > 0 ? `${p.priceStars} ⭐` : (lang === 'ru' ? 'Бесплатно' : 'Free');
      const stars = p.avgRating > 0 ? ` ${'⭐'.repeat(Math.round(p.avgRating))}` : '';
      text += `• <b>${escHtml(p.name)}</b> — ${price}${stars} (${p.installs} ${lang === 'ru' ? 'уст.' : 'inst.'})\n`;
    }
  }

  const btns: Array<Array<{ text: string; callback_data: string }>> = [];
  // Category buttons (2 per row)
  for (let i = 0; i < CATS.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    row.push({ text: `${CATS[i].icon} ${CATS[i].name}`, callback_data: `pmkt_cat:${CATS[i].id}` });
    if (CATS[i + 1]) {
      row.push({ text: `${CATS[i + 1].icon} ${CATS[i + 1].name}`, callback_data: `pmkt_cat:${CATS[i + 1].id}` });
    }
    btns.push(row);
  }
  btns.push([{ text: `📋 ${lang === 'ru' ? 'Все плагины' : 'All plugins'}`, callback_data: 'pmkt_all' }]);
  btns.push([
    { text: `📦 ${lang === 'ru' ? 'Мои плагины' : 'My plugins'}`, callback_data: 'pmkt_my' },
    { text: `💰 ${lang === 'ru' ? 'Мой доход' : 'My revenue'}`, callback_data: 'pmkt_revenue' },
  ]);

  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
});

// ── /my_plugins — user's installed marketplace plugins ──────
bot.command('my_plugins', async (ctx) => {
  const userId = ctx.from.id;
  const lang = getUserLang(userId);
  const plugins = await getMarketplaceUserPlugins(userId);

  if (!plugins.length) {
    await safeReply(ctx,
      `📦 <b>${lang === 'ru' ? 'Мои плагины' : 'My Plugins'}</b>\n\n` +
      `${lang === 'ru' ? 'У вас нет установленных плагинов из маркетплейса.' : 'You have no installed marketplace plugins.'}\n\n` +
      `${lang === 'ru' ? 'Найдите плагины в' : 'Find plugins at'} /plugin_market`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  let text = `📦 <b>${lang === 'ru' ? 'Мои плагины' : 'My Plugins'} (${plugins.length}):</b>\n\n`;
  for (const p of plugins.slice(0, 15)) {
    const price = p.priceStars > 0 ? `${p.priceStars} ⭐` : '🆓';
    const stars = p.avgRating > 0 ? ` ${'⭐'.repeat(Math.round(p.avgRating))}` : '';
    text += `${price} <b>${escHtml(p.name)}</b> v${escHtml(p.version)}${stars}\n`;
    text += `   <i>${escHtml((p.description || '').slice(0, 60))}</i>\n\n`;
  }

  const btns = plugins.slice(0, 8).map(p => [
    { text: `🔍 ${p.name}`, callback_data: `pmkt_view:${p.id}` },
    { text: '❌', callback_data: `pmkt_uninstall:${p.id}` },
  ]);
  btns.push([{ text: `🔌 ${lang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'pmkt_home' }]);

  await safeReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
});

// ── /plugin_revenue — creator revenue stats ──────
bot.command('plugin_revenue', async (ctx) => {
  const userId = ctx.from.id;
  const lang = getUserLang(userId);
  const revenue = await getCreatorRevenue(userId);
  const listings = await getCreatorListings(userId);

  let text =
    `💰 <b>${lang === 'ru' ? 'Доход от плагинов' : 'Plugin Revenue'}</b>\n\n` +
    `${lang === 'ru' ? 'Заработано' : 'Total earned'}: <b>${revenue.totalEarned} ⭐</b>\n` +
    `${lang === 'ru' ? 'Установок' : 'Total installs'}: <b>${revenue.totalInstalls}</b>\n` +
    `${lang === 'ru' ? 'К выплате' : 'Pending payout'}: <b>${revenue.pendingPayout} ⭐</b>\n` +
    `${lang === 'ru' ? 'Комиссия платформы' : 'Platform fee'}: 15%\n\n`;

  if (listings.length > 0) {
    text += `📋 <b>${lang === 'ru' ? 'Ваши плагины' : 'Your plugins'} (${listings.length}):</b>\n\n`;
    for (const l of listings.slice(0, 10)) {
      const price = l.priceStars > 0 ? `${l.priceStars} ⭐` : (lang === 'ru' ? 'Бесплатно' : 'Free');
      const status = l.isActive ? '🟢' : '🔴';
      text += `${status} <b>${escHtml(l.name)}</b> — ${price} — ${l.installs} ${lang === 'ru' ? 'уст.' : 'inst.'}\n`;
    }
  } else {
    text += `<i>${lang === 'ru' ? 'Вы ещё не опубликовали ни одного плагина.' : 'You have not published any plugins yet.'}</i>\n`;
  }

  text += `\n${lang === 'ru' ? 'Опубликуйте плагин в' : 'Publish a plugin at'} /plugin_market`;

  await safeReply(ctx, text, { parse_mode: 'HTML' });
});

// ── /tglogin — авторизация Telegram для Fragment API ──────────────
bot.command('tglogin', async (ctx) => {
  const userId = ctx.from.id;
  const isAuth = await isAuthorized();

  if (isAuth) {
    await ctx.reply(
      '✅ <b>Telegram уже авторизован</b>\n\n' +
      'Fragment данные доступны. Используй:\n' +
      '• <code>/gifts</code> — топ подарков с floor ценами\n' +
      '• Спроси в чате: <i>"цена jelly bunny на Fragment"</i>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await ctx.reply(
    '📱 <b>Авторизация Telegram для Fragment</b>\n\n' +
    'Нужно для получения реальных floor цен подарков.\n\n' +
    '🔳 <b>QR-код</b> — рекомендуется. Сканируй из другого устройства (Telegram → Устройства → Подключить). Telegram не блокирует.\n\n' +
    '📞 <b>OTP по телефону</b> — Telegram может заблокировать если вводишь код с этого же аккаунта.\n\n' +
    'Выбери способ:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔳 QR-код (рекомендуется)', callback_data: 'tglogin_qr' }],
          [{ text: '📞 OTP по номеру телефона', callback_data: 'tglogin_phone' }],
          [{ text: '❌ Отмена', callback_data: 'tglogin_cancel' }],
        ],
      },
    }
  );
});

// ── /gifts — показать топ подарков Fragment ───────────────────────
bot.command('gifts', async (ctx) => {
  const userId = ctx.from.id;
  await ctx.sendChatAction('typing');

  const isAuth = await isAuthorized();
  if (!isAuth) {
    await ctx.reply(
      '🔑 Для получения данных Fragment нужна авторизация.\n\n' +
      'Введи /tglogin чтобы подключить Telegram аккаунт.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    const gifts = await getAllGiftFloors();

    if (gifts.length === 0) {
      await ctx.reply('📊 Нет данных о подарках на вторичном рынке.');
      return;
    }

    let msg = `🎁 <b>Fragment Gifts — Floor Prices</b>\n${div()}\n\n`;
    for (const g of gifts) {
      msg += `${g.emoji} ${escHtml(g.name)}\n`;
      msg += `  ${pe('coin')} Floor: <code>${g.floorStars} ⭐</code> ≈ <code>${g.floorTon.toFixed(3)} TON</code>\n`;
      msg += `  📋 Listed: ${g.listed}+\n\n`;
    }
    msg += `\n<i>Обновлено: ${escHtml(new Date().toLocaleTimeString('ru-RU'))} UTC</i>`;

    await safeReply(ctx, msg, { parse_mode: 'HTML' });
  } catch (e: any) {
    await safeReply(ctx, '❌ Ошибка получения данных: ' + (e.message || 'unknown'));
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
        `${pe('clipboard')} <b>Ваши переменные</b>\n` +
        `${div()}\n` +
        `<i>Пока ничего нет.</i>\n\n` +
        `Добавьте ключи API, адреса кошельков:\n` +
        `<code>/config set WALLET_ADDR EQ...</code>\n\n` +
        `<i>Переменные доступны в коде агента как <code>context.config.KEY</code></i>`,
        { parse_mode: 'HTML' }
      );
    }
    const varLines = keys.map(k => `<code>${escHtml(k)}</code> = <code>${escHtml(String(vars[k]).slice(0, 40))}${vars[k].length > 40 ? '...' : ''}</code>`).join('\n');
    return safeReply(ctx,
      `${pe('clipboard')} <b>Ваши переменные</b> (${escHtml(String(keys.length))})\n` +
      `${div()}\n` +
      `${varLines}\n\n` +
      `<i>Доступны в агентах как <code>context.config.KEY</code></i>`,
      { parse_mode: 'HTML' }
    );
  }

  if (sub === 'set') {
    const key = args[1]?.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const value = args.slice(2).join(' ').trim();
    if (!key || !value) {
      return safeReply(ctx, '❌ Использование: <code>/config set KEY значение</code>', { parse_mode: 'HTML' });
    }
    const vars = await getVars();
    vars[key] = value;
    await saveVars(vars);
    return safeReply(ctx, `✅ Переменная <code>${escHtml(key)}</code> сохранена`, { parse_mode: 'HTML' });
  }

  if (sub === 'get') {
    const key = args[1]?.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key) return safeReply(ctx, '❌ Укажите имя переменной', {});
    const vars = await getVars();
    if (!(key in vars)) return safeReply(ctx, `❌ Переменная <code>${escHtml(key)}</code> не найдена`, { parse_mode: 'HTML' });
    return safeReply(ctx, `<code>${escHtml(key)}</code> = <code>${escHtml(vars[key])}</code>`, { parse_mode: 'HTML' });
  }

  if (sub === 'del' || sub === 'delete' || sub === 'rm') {
    const key = args[1]?.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key) return safeReply(ctx, '❌ Укажите имя переменной', {});
    const vars = await getVars();
    if (!(key in vars)) return safeReply(ctx, `❌ Переменная <code>${escHtml(key)}</code> не найдена`, { parse_mode: 'HTML' });
    delete vars[key];
    await saveVars(vars);
    return safeReply(ctx, `🗑️ Переменная <code>${escHtml(key)}</code> удалена`, { parse_mode: 'HTML' });
  }

  return safeReply(ctx,
    `${pe('clipboard')} <b>Команды /config:</b>\n\n` +
    '<code>/config list</code> — список всех переменных\n' +
    '<code>/config set KEY значение</code> — сохранить переменную\n' +
    '<code>/config get KEY</code> — получить значение\n' +
    '<code>/config del KEY</code> — удалить переменную\n\n' +
    'Переменные автоматически доступны в агентах как <code>context.config.KEY</code>',
    { parse_mode: 'HTML' }
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
        `🛒 <b>Мои покупки</b>\n\nПокупок пока нет.\n\nНайдите агентов в /marketplace`,
        { parse_mode: 'HTML' }
      );
    }
    let text = `🛒 <b>Мои покупки (${purchases.length}):</b>\n\n`;
    purchases.slice(0, 10).forEach(p => {
      const type = p.type === 'free' ? '🆓' : p.type === 'rent' ? '📅' : '💰';
      text += `${type} Листинг #${p.listingId} → агент #${p.agentId}\n`;
    });
    const btns = purchases.slice(0, 8).map((p: any) => [
      { text: `#${p.agentId} → запустить`, callback_data: `run_agent:${p.agentId}` }
    ]);
    await safeReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: btns },
    });
  } catch (e: any) {
    console.error('Command error:', e);
    await safeReply(ctx, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

// /mylistings — мои листинги (что я продаю)
bot.command('mylistings', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const listings = await getMarketplaceRepository().getMyListings(userId);
    if (!listings.length) {
      return safeReply(ctx,
        `${pe('outbox')} <b>Мои листинги</b>\n\nВы ещё ничего не публиковали.\n\nНажмите кнопку ниже чтобы опубликовать агента:`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `${peb('outbox')} Опубликовать агента`, callback_data: 'mkt_publish_help' }]] } }
      );
    }
    let text = `${pe('outbox')} <b>Мои листинги (${listings.length}):</b>\n\n`;
    listings.forEach((l: any) => {
      const status = l.isActive ? peb('check') : '❌';
      const price = l.isFree ? 'Бесплатно' : (l.price / 1e9).toFixed(2) + ' TON';
      text += `${status} #${l.id} <b>${escHtml(l.name)}</b> — ${escHtml(price)} — ${l.totalSales} продаж\n`;
    });
    await safeReply(ctx, text, { parse_mode: 'HTML' });
  } catch (e: any) {
    console.error('Listings error:', e);
    await safeReply(ctx, '❌ Произошла ошибка. Попробуйте позже.');
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
    `💼 <b>Кошелёк агента</b>\n\n` +
    `Адрес: <code>${escHtml(wallet.address)}</code>\n` +
    `Баланс: <b>${escHtml(balance.toFixed(4))}</b> TON\n` +
    `Статус: ${escHtml(state)}\n\n` +
    `⚠️ Мнемоника сохранена на сервере. Используйте Studio для безопасного просмотра.\n\n` +
    'Пополните на 0.1 TON для активации. Используйте /send_agent для транзакций.';
  await safeReply(ctx, text, {
    parse_mode: 'HTML',
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
    await ctx.reply('Использование: <code>/send_agent АДРЕС СУММА [комментарий]</code>\nПример: <code>/send_agent EQD... 1.5 Зарплата</code>', { parse_mode: 'HTML' });
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
      `${pe('check')} <b>Транзакция отправлена!</b>\n\nСумма: <b>${escHtml(String(amount))}</b> TON\nКому: <code>${escHtml(to.slice(0, 20))}...</code>\nHash: <code>${escHtml(hashStr.slice(0, 40))}</code>`,
      { parse_mode: 'HTML' }
    );
  } catch (e: any) {
    await safeReply(ctx, `❌ Ошибка: ${e.message || 'unknown'}`);
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
      '💸 <b>Отправить TON через Tonkeeper</b>\n\nФормат:\n<code>/send АДРЕС СУММА [комментарий]</code>\n\nПример:\n<code>/send EQD...abc 5 Оплата услуг</code>\n\n<i>Транзакция подтверждается в Tonkeeper</i>',
      { parse_mode: 'HTML' }
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
  await ctx.reply(`⏳ Запрашиваю подтверждение в Tonkeeper...\n\n💸 Отправляю: ${amount} TON → <code>${escHtml(to.slice(0, 24))}...</code>\n\n<i>Откройте Tonkeeper и подтвердите</i>`, { parse_mode: 'HTML' });
  try {
    const result = await tonConn.sendTon(ctx.from.id, to, amount, comment || undefined);
    if (result.success) {
      await safeReply(ctx,
        `${pe('check')} <b>Транзакция отправлена!</b>\n\n` +
        `Сумма: <b>${escHtml(amount.toFixed(4))}</b> TON\n` +
        `Кому: <code>${escHtml(to.slice(0, 24))}...</code>\n` +
        (comment ? `Комментарий: <i>${escHtml(comment)}</i>\n` : '') +
        `\nBoC: <code>${escHtml((result.boc || 'pending').slice(0, 40))}...</code>`,
        { parse_mode: 'HTML' }
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
    await ctx.reply('Использование: <code>/run_1</code> (кликабельная команда)\nПример: <code>/run_1</code> или <code>/run_5</code>', { parse_mode: 'HTML' });
    return;
  }
  await runAgentDirect(ctx, parseInt(id), ctx.from.id);
});

// ── Web studio auth via text message (fallback when deeplink ?start= doesn't trigger /start) ──
bot.hears(/^\/start\s+webauth_([a-f0-9]+)$/i, async (ctx) => {
  const authToken = (ctx.match as RegExpMatchArray)[1];
  const userId = ctx.from.id;
  const pending = pendingBotAuth.get(authToken);
  if (pending && pending.pending) {
    pendingBotAuth.set(authToken, {
      pending: false,
      userId,
      username: ctx.from.username || '',
      firstName: ctx.from.first_name || '',
      createdAt: pending.createdAt,
    });
    const name = ctx.from.first_name || ctx.from.username || 'друг';
    const landingUrl = process.env.LANDING_URL || 'http://localhost:3001';
    await safeReply(ctx,
      `✅ <b>Авторизация успешна!</b>\n\nПривет, ${escHtml(name)}! Вернитесь в браузер — студия загружается автоматически.\n\n🌐 ${escHtml(landingUrl)}/studio`,
      { parse_mode: 'HTML' }
    );
  } else {
    await ctx.reply('❌ Токен авторизации не найден или истёк. Обновите страницу студии и попробуйте снова.');
  }
});

// Кликабельный формат /run_ID (задача 5: без пробела для удобства)
bot.hears(/^\/run_(\d+)$/, async (ctx) => {
  const agentId = parseInt((ctx.match as RegExpMatchArray)[1]);
  await runAgentDirect(ctx, agentId, ctx.from.id);
});

bot.command('create', async (ctx) => {
  const desc = ctx.message.text.replace('/create', '').trim();
  if (!desc) {
    await ctx.reply('Использование: <code>/create описание агента</code>', { parse_mode: 'HTML' });
    return;
  }
  await ctx.sendChatAction('typing');
  const result = await getOrchestrator().processMessage(ctx.from.id, `создай агента для ${desc}`);
  await sendResult(ctx, result);
});

// ============================================================
// Нижнее меню (кнопки)
// ============================================================
// ── Русские кнопки клавиатуры ──
// ── Обработчики клавиатуры (RU) ────────────────────────────────────────────
bot.hears('🤖 Мои агенты',    (ctx) => showAgentsList(ctx, ctx.from.id));
bot.hears('✏️ Создать агента', (ctx) => showCreatePrompt(ctx));
bot.hears('🏪 Маркетплейс',   (ctx) => showMarketplace(ctx));
bot.hears('💰 Кошелёк',       (ctx) => showWalletMenu(ctx));
bot.hears('👤 Профиль',       async (ctx) => showProfile(ctx, ctx.from.id));
bot.hears('🔌 Плагины',       (ctx) => showPlugins(ctx));
bot.hears('⚡ Workflow',      (ctx) => showWorkflows(ctx, ctx.from.id));
bot.hears('❓ Помощь',        (ctx) => showHelp(ctx));
// Совместимость со старыми клавиатурами
bot.hears('🎁 Гифты & NFT',   (ctx) => showGiftsMenu(ctx));
bot.hears('➕ Создать агента', (ctx) => showCreatePrompt(ctx));
bot.hears('💎 TON Connect',   (ctx) => showTonConnect(ctx));
bot.hears('💳 Подписка',      (ctx) => showSubscription(ctx));
bot.hears('📊 Статистика',    (ctx) => showStats(ctx, ctx.from.id));

// ── Обработчики клавиатуры (EN) ────────────────────────────────────────────
bot.hears('🤖 My Agents',    (ctx) => showAgentsList(ctx, ctx.from.id));
bot.hears('✏️ Create Agent', (ctx) => showCreatePrompt(ctx));
bot.hears('🏪 Marketplace',  (ctx) => showMarketplace(ctx));
bot.hears('💰 Wallet',       (ctx) => showWalletMenu(ctx));
bot.hears('👤 Profile',      async (ctx) => showProfile(ctx, ctx.from.id));
bot.hears('🔌 Plugins',      (ctx) => showPlugins(ctx));
bot.hears('⚡ Workflow',     (ctx) => showWorkflows(ctx, ctx.from.id));
bot.hears('❓ Help',         (ctx) => showHelp(ctx));
// EN compat
bot.hears('🎁 Gifts & NFT',  (ctx) => showGiftsMenu(ctx));
bot.hears('➕ Create Agent', (ctx) => showCreatePrompt(ctx));
bot.hears('💎 TON Connect',  (ctx) => showTonConnect(ctx));
bot.hears('💳 Subscription', (ctx) => showSubscription(ctx));
bot.hears('📊 Stats',        (ctx) => showStats(ctx, ctx.from.id));
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
      `✅ Язык: Русский 🇷🇺\n\nОтлично, ${name}! Настраиваем платформу...`
    ).catch(() => {});
  } else {
    await ctx.editMessageText(
      `✅ Language: English 🇬🇧\n\nGreat, ${name}! Setting up the platform...`
    ).catch(() => {});
  }

  // Проверяем: новый пользователь (нет агентов и нет API ключа) → онбординг
  try {
    const agents = await getAgentsRepository().getByUserId(userId);
    const vars = ((await getUserSettingsRepository().getAll(userId)).user_variables as Record<string, any>) || {};
    const hasApiKey = !!(vars.AI_API_KEY);
    if (agents.length === 0 && !hasApiKey) {
      // Новый пользователь — запускаем онбординг
      pendingOnboarding.set(userId, { step: 'welcome', createdAt: Date.now() });
      await showOnboardingStep(ctx, userId, lang);
      return;
    }
  } catch (e: any) { console.warn('[Onboarding] check error:', e.message); }

  // Старый пользователь — обычный welcome
  await showWelcome(ctx as any, userId, name, lang);
});

// ============================================================
// Onboarding wizard callback handlers
// ============================================================

// Step 1: Welcome → go to provider selection
bot.action('ob_start_setup', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const state = pendingOnboarding.get(userId);
  if (!state) {
    pendingOnboarding.set(userId, { step: 'provider', createdAt: Date.now() });
  } else {
    state.step = 'provider';
  }
  await showOnboardingStep(ctx, userId, getUserLang(userId));
});

// Step 2: Provider selected → go to API key input
bot.action(/^ob_provider:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const provider = ctx.match[1];
  const lang = getUserLang(userId);

  let state = pendingOnboarding.get(userId);
  if (!state) {
    state = { step: 'apikey', provider, createdAt: Date.now() };
    pendingOnboarding.set(userId, state);
  } else {
    state.step = 'apikey';
    state.provider = provider;
  }

  // Save provider to user_variables immediately
  try {
    const repo = getUserSettingsRepository();
    const vars = ((await repo.getAll(userId)).user_variables as Record<string, any>) || {};
    vars.AI_PROVIDER = provider;
    await repo.set(userId, 'user_variables', vars);
  } catch (e: any) { console.warn('[Settings] save provider error:', e.message); }

  await showOnboardingStep(ctx, userId, lang);
});

// Back to provider selection from API key step
bot.action('ob_back_provider', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const state = pendingOnboarding.get(userId);
  if (state) state.step = 'provider';
  else pendingOnboarding.set(userId, { step: 'provider', createdAt: Date.now() });
  await showOnboardingStep(ctx, userId, getUserLang(userId));
});

// Skip API key → go to agent creation step
bot.action('ob_skip_key', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const state = pendingOnboarding.get(userId);
  if (state) state.step = 'create_agent';
  else pendingOnboarding.set(userId, { step: 'create_agent', createdAt: Date.now() });
  await showOnboardingStep(ctx, userId, getUserLang(userId));
});

// Skip entire onboarding → show normal welcome
bot.action('ob_skip_all', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  pendingOnboarding.delete(userId);
  const lang = getUserLang(userId);
  const name = ctx.from!.first_name || ctx.from!.username || (lang === 'ru' ? 'друг' : 'friend');
  await showWelcome(ctx as any, userId, name, lang);
});

// Finish onboarding (from create_agent step "Later" button)
bot.action('ob_finish', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  pendingOnboarding.delete(userId);
  const lang = getUserLang(userId);
  const name = ctx.from!.first_name || ctx.from!.username || (lang === 'ru' ? 'друг' : 'friend');
  await showWelcome(ctx as any, userId, name, lang);
});

// ── showCreatePrompt — экран создания агента ────────────────────────────────
function showCreatePrompt(ctx: Context) {
  const lang = getUserLang(ctx.from!.id);
  const ru = lang === 'ru';
  return safeReply(ctx,
    `${pe('sparkles')} <b>${ru ? 'Создание AI-агента' : 'Create AI Agent'}</b>\n` +
    `${div()}\n` +
    `${pe('brain')} ${ru
      ? 'Опишите задачу своими словами — AI создаст автономного агента.\n20+ инструментов: TON, DeFi, веб, уведомления, аналитика.'
      : 'Describe your task — AI creates an autonomous agent.\n20+ tools: TON, DeFi, web, notifications, analytics.'
    }\n\n` +
    `${pe('bolt')} <b>${ru ? 'Примеры задач:' : 'Task examples:'}</b>\n` +
    `${pe('coin')} <i>"${ru ? 'Следи за кошельком UQ..., изменение > 100 TON — уведоми' : 'Watch wallet UQ..., change > 100 TON — notify me'}"</i>\n` +
    `${pe('chart')} <i>"${ru ? 'Мониторь цену TON каждый час, пришли сводку' : 'Monitor TON price hourly, send summary'}"</i>\n` +
    `${pe('globe')} <i>"${ru ? 'Парси coindesk, дайджест важных новостей каждые 30 мин' : 'Parse coindesk, digest of important news every 30 min'}"</i>\n` +
    `${pe('trending')} <i>"${ru ? 'Алерт если floor TON Punks упадёт ниже 80 TON' : 'Alert if TON Punks floor drops below 80 TON'}"</i>\n` +
    `${pe('bell')} <i>"${ru ? 'Каждое утро: курс TON, топ DeFi APY, сводка портфеля' : 'Every morning: TON rate, top DeFi APY, portfolio summary'}"</i>\n` +
    `🎤 <i>${ru ? '(принимаем голосовые сообщения!)' : '(voice messages supported!)'}</i>\n\n` +
    `${pe('finger')} <b>${ru ? 'Напишите или скажите задачу:' : 'Type or say your task:'}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `${peb('store')} ${ru ? 'Шаблоны' : 'Templates'}`, callback_data: 'marketplace' },
            { text: `${peb('plugin')} ${ru ? 'Плагины' : 'Plugins'}`, callback_data: 'plugins' },
          ],
        ],
      },
    }
  );
}

// ── showGiftsMenu — раздел гифтов ─────────────────────────────────────────
async function showGiftsMenu(ctx: Context) {
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  const text =
    `🎁 <b>${ru ? 'Гифты & NFT' : 'Gifts & NFT'}</b>\n\n` +
    `${ru
      ? 'Торговля уникальными подарками Telegram.\n\nЖизненный цикл:\n<b>Обычный подарок</b> → <b>Апгрейд за Stars ⭐</b> → <b>Уникальный NFT (с номером #)</b>\n\nЦена зависит от:\n• 🖤 Фон (чёрный = дороже всего)\n• 📦 Модель (редкость в %)\n• 🔢 Номер выпуска (#1 самый дорогой)'
      : 'Trade unique Telegram gifts.\n\nLifecycle:\n<b>Regular gift</b> → <b>Upgrade with Stars ⭐</b> → <b>Unique NFT (with edition #)</b>\n\nPrice depends on:\n• 🖤 Background (black = most valuable)\n• 📦 Model (rarity %)\n• 🔢 Edition number (#1 most expensive)'
    }`;

  const kb = [
    [
      { text: `📊 ${ru ? 'Арбитраж сейчас' : 'Arbitrage now'}`,       callback_data: 'gifts_arbitrage' },
      { text: `📋 ${ru ? 'Каталог подарков' : 'Gift catalog'}`,       callback_data: 'gifts_catalog' },
    ],
    [
      { text: `🔍 ${ru ? 'Анализ подарка' : 'Analyze gift'}`,         callback_data: 'gifts_analyze' },
      { text: `⭐ ${ru ? 'Баланс Stars' : 'Stars balance'}`,          callback_data: 'gifts_stars_balance' },
    ],
    [
      { text: `🤖 ${ru ? 'Создать арбитраж-агента' : 'Create arb agent'}`, callback_data: 'quick_gift_agent' },
      { text: `💎 ${ru ? 'Fragment листинги' : 'Fragment listings'}`, callback_data: 'gifts_fragment' },
    ],
    [
      { text: `📈 ${ru ? 'GiftAsset цены' : 'GiftAsset prices'}`,    callback_data: 'gifts_giftasset' },
      { text: `🔐 ${ru ? 'Telegram Userbot' : 'Userbot (market)'}`, callback_data: 'gifts_userbot' },
    ],
  ];

  await safeReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
}

// ── showWalletMenu — раздел кошелька ────────────────────────────────────────
async function showWalletMenu(ctx: Context) {
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  const profile = await getUserProfile(userId);
  const tonConn = getTonConnectManager();
  const hasWallet = tonConn.isConnected(userId);

  // TON Connect wallet line
  let tonConnectLine = '';
  if (hasWallet) {
    const w = tonConn.getWallet(userId);
    const addr = (w?.friendlyAddress || '').slice(0, 20);
    tonConnectLine = `\n${pe('diamond')} <b>TON Connect:</b> <code>${escHtml(addr)}…</code>`;
  }

  // Linked wallet line
  const linkedLine = profile.wallet_address
    ? `\n${pe('link')} <b>${ru ? 'Привязан:' : 'Linked:'}</b> <code>${escHtml(profile.wallet_address.slice(0, 20))}…</code>`
    : `\n${pe('link')} <i>${ru ? 'Внешний кошелёк не привязан' : 'No external wallet linked'}</i>`;

  const text =
    `${pe('coin')} <b>${ru ? 'Кошелёк' : 'Wallet'}</b>\n` +
    `${div()}\n` +
    `${pe('coin')} <b>${ru ? 'Баланс:' : 'Balance:'}</b> <b>${(profile.balance_ton || 0).toFixed(3)} TON</b>\n` +
    `${pe('trending')} <b>${ru ? 'Заработано:' : 'Earned:'}</b> ${(profile.total_earned || 0).toFixed(3)} TON` +
    `${tonConnectLine}${linkedLine}\n` +
    `${div()}\n` +
    `<i>${ru
      ? '📥 Пополни → подписка, агенты, маркетплейс\n📤 Вывод TON на любой кошелёк'
      : '📥 Top up → subscriptions, agents, marketplace\n📤 Withdraw TON to any wallet'
    }</i>`;

  const kb = [
    // Основные операции
    [
      { text: `💳 ${ru ? 'Пополнить' : 'Top Up'}`, callback_data: 'topup_start' },
      { text: `💸 ${ru ? 'Вывести' : 'Withdraw'}`, callback_data: 'withdraw_start' },
    ],
    [
      { text: `📊 ${ru ? 'История транзакций' : 'Tx History'}`, callback_data: 'wallet_history' },
    ],
    // Подключение кошельков
    [
      { text: `💎 TON Connect`, callback_data: 'show_tonconnect' },
      { text: `🔗 ${ru ? 'Привязать кошелёк' : 'Link wallet'}`, callback_data: 'profile_link_wallet' },
    ],
    // Agentic Wallets
    [
      { text: `🔐 ${ru ? 'Agentic Wallets' : 'Agentic Wallets'}`, callback_data: 'agentic_wallets_menu' },
    ],
    // Обратно в профиль
    [
      { text: `◀️ ${ru ? 'Профиль' : 'Profile'}`, callback_data: 'profile_menu' },
    ],
  ];

  await safeReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
}

// ── Профиль пользователя ──
bot.command('profile', async (ctx) => showProfile(ctx, ctx.from.id));

// ── Approve / Reject action commands ──
bot.command('approve_action', async (ctx) => {
  const text = ctx.message?.text || '';
  const match = text.match(/\/approve_action[_\s]?(\d+)/);
  if (!match) {
    await safeReply(ctx, 'Формат: /approve_action_123 (где 123 — ID действия)', {});
    return;
  }
  const approvalId = parseInt(match[1]);
  try {
    const { getAgentApprovalsRepository } = await import('./db/schema-extensions');
    const row = await getAgentApprovalsRepository().resolve(approvalId, 'approved');
    if (!row) {
      await safeReply(ctx, `Запрос #${approvalId} не найден или уже обработан.`, {});
      return;
    }
    await safeReply(ctx, `✅ Действие #${approvalId} одобрено (${row.action_type}).`, {});
  } catch (e: any) {
    console.error('Approve action error:', e);
    await safeReply(ctx, '❌ Произошла ошибка. Попробуйте позже.', {});
  }
});

bot.command('reject_action', async (ctx) => {
  const text = ctx.message?.text || '';
  const match = text.match(/\/reject_action[_\s]?(\d+)/);
  if (!match) {
    await safeReply(ctx, 'Формат: /reject_action_123 (где 123 — ID действия)', {});
    return;
  }
  const approvalId = parseInt(match[1]);
  try {
    const { getAgentApprovalsRepository } = await import('./db/schema-extensions');
    const row = await getAgentApprovalsRepository().resolve(approvalId, 'rejected');
    if (!row) {
      await safeReply(ctx, `Запрос #${approvalId} не найден или уже обработан.`, {});
      return;
    }
    await safeReply(ctx, `❌ Действие #${approvalId} отклонено (${row.action_type}).`, {});
  } catch (e: any) {
    console.error('Reject action error:', e);
    await safeReply(ctx, '❌ Произошла ошибка. Попробуйте позже.', {});
  }
});

// ── /crew — список команд агентов ──
bot.command('crew', async (ctx) => {
  try {
    const { listCrews } = require('./services/crew-system');
    const crews = await listCrews(ctx.from.id);
    if (!crews.length) {
      return safeReply(ctx, '🤝 У вас пока нет команд агентов.\n\nСоздайте команду через AI: опишите задачу для нескольких агентов.');
    }
    let text = '🤝 <b>Ваши команды агентов:</b>\n\n';
    for (const c of crews) {
      text += `🟢 <b>${escHtml(c.name)}</b> (ID: ${c.id})\n`;
      text += `   📋 ${escHtml(c.description?.slice(0, 60) || 'Без описания')}\n`;
      text += `   🔄 ${c.flow?.type || 'sequential'} | 👥 ${c.agents?.length || 0} агентов\n\n`;
    }
    await safeReply(ctx, text, { parse_mode: 'HTML' });
  } catch (e: any) {
    await safeReply(ctx, '❌ Ошибка: ' + e.message);
  }
});

// ── /leaderboard — таблица лидеров ──
bot.command('leaderboard', async (ctx) => {
  try {
    const { getLeaderboard } = require('./services/agent-reputation');
    const leaders = await getLeaderboard('rating', 'alltime', 10);
    if (!leaders.length) return safeReply(ctx, '🏆 Таблица лидеров пока пуста.');

    let text = '🏆 <b>Таблица лидеров</b>\n\n';
    const medals = ['🥇', '🥈', '🥉'];
    for (const entry of leaders) {
      const medal = medals[entry.rank - 1] || `${entry.rank}.`;
      text += `${medal} <b>${escHtml(entry.agentName || 'Agent #' + entry.agentId)}</b>\n`;
      text += `   ${entry.tier || ''} | Рейтинг: ${entry.value || 0}/100\n\n`;
    }
    await safeReply(ctx, text, { parse_mode: 'HTML' });
  } catch (e: any) {
    await safeReply(ctx, '❌ ' + e.message);
  }
});

// ── /kya — Know Your Agent ──
bot.command('kya', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const agentId = parseInt(args[1]);
    if (!agentId) return safeReply(ctx, '📋 Использование: /kya <agent_id>');

    const { getKYA } = require('./services/agent-reputation');
    const kya = await getKYA(agentId);
    if (!kya) return safeReply(ctx, '❌ Агент не найден');

    const tierEmoji: Record<string, string> = { unverified: '⬜', bronze: '🟫', silver: '⬛', gold: '🟨', platinum: '💎' };

    const tier = kya.trustScore?.tier || 'unverified';
    const score = kya.trustScore?.score || 0;
    let text = `📋 <b>Know Your Agent: ${escHtml(kya.agentName)}</b>\n\n`;
    text += `${tierEmoji[tier] || '⬜'} Доверие: <b>${score}/100</b> (${tier})\n`;
    text += `👤 Создатель: ID ${kya.creatorId}\n`;
    text += `🔐 Хеш кода: <code>${kya.codeHash}</code>\n\n`;

    const cap = kya.capabilities || {} as any;
    text += '<b>Возможности:</b>\n';
    if (cap.canSendTon) text += '💸 Отправка TON\n';
    if (cap.canAccessWallet) text += '👛 Доступ к кошельку\n';
    if (cap.canReadMessages) text += '📖 Чтение сообщений\n';
    if (cap.canSendNotifications) text += '✉️ Уведомления\n';
    if (cap.canModerateGroups) text += '🛡 Модерация групп\n';
    if (cap.canCallExternalAPIs) text += '🌐 Внешние API\n';

    if (kya.warnings.length) {
      text += '\n<b>Предупреждения:</b>\n';
      for (const w of kya.warnings) text += `${w}\n`;
    }

    await safeReply(ctx, text, { parse_mode: 'HTML' });
  } catch (e: any) {
    await safeReply(ctx, '❌ ' + e.message);
  }
});

// ── /gdp — Agent Economy Dashboard ──
bot.command('gdp', async (ctx) => {
  try {
    const { getPlatformGDP } = require('./services/agent-reputation');
    const gdp = await getPlatformGDP();
    if (!gdp) return safeReply(ctx, '📊 Данные пока недоступны');

    const c = gdp.current || gdp;
    let text = '📊 <b>Agent Economy Dashboard</b>\n\n';
    text += `🤖 Агентов: <b>${c.totalAgents || 0}</b> (активных: ${c.activeAgents || 0})\n`;
    text += `👥 Создателей: <b>${c.totalCreators || 0}</b>\n`;
    text += `⚡ Запусков за 24ч: <b>${c.executions24h || 0}</b>\n`;
    text += `📈 Запусков за 7д: <b>${c.executions7d || 0}</b>\n`;
    text += `📊 Всего запусков: <b>${c.executionsAll || 0}</b>\n`;
    text += `💎 Объём TON: <b>${(c.tonVolumeAll || 0).toFixed?.(2) || 0}</b>\n`;
    text += `📉 Рост: <b>${(c.growthRateExecs || 0) > 0 ? '+' : ''}${c.growthRateExecs || 0}%</b> запусков | <b>${(c.growthRateAgents || 0) > 0 ? '+' : ''}${c.growthRateAgents || 0}%</b> агентов\n`;

    await safeReply(ctx, text, { parse_mode: 'HTML' });
  } catch (e: any) {
    await safeReply(ctx, '❌ ' + e.message);
  }
});

bot.command('domain', async (ctx) => {
  try {
    const { getUserDomains, claimAgentDomain, resolveDomain } = require('./services/ton-dns');
    const userId = ctx.from!.id;
    const args = ctx.message.text.split(' ').slice(1);

    // /domain resolve <name.ton>
    if (args[0] === 'resolve' && args[1]) {
      const result = await resolveDomain(args[1]);
      if (result.ok) return safeReply(ctx, `🌐 <b>${escHtml(args[1])}</b>\n📍 ${escHtml(result.address)}`, { parse_mode: 'HTML' });
      return safeReply(ctx, `❌ ${result.error}`);
    }

    // /domain claim <agentId> <name>
    if (args[0] === 'claim' && args[1] && args[2]) {
      const agentId = parseInt(args[1]);
      if (isNaN(agentId)) return safeReply(ctx, '❌ /domain claim <agent_id> <name>');
      const result = await claimAgentDomain(agentId, userId, args[2]);
      if (result.ok) return safeReply(ctx, `✅ Домен <b>${escHtml(args[2])}.ton</b> закреплён за агентом #${agentId}`, { parse_mode: 'HTML' });
      return safeReply(ctx, `❌ ${result.error}`);
    }

    // /domain — list user's domains
    const domains = await getUserDomains(userId);
    if (!domains.length) {
      return safeReply(ctx, '🌐 <b>TON DNS</b>\n\nУ вас нет доменов.\n\n/domain claim &lt;agent_id&gt; &lt;name&gt; — закрепить домен\n/domain resolve &lt;name.ton&gt; — проверить домен', { parse_mode: 'HTML' });
    }
    let text = '🌐 <b>Ваши .ton домены:</b>\n\n';
    for (const d of domains) {
      text += `• <b>${escHtml(d.domain)}</b> → Агент #${d.agentId} (${d.status})\n`;
    }
    await safeReply(ctx, text, { parse_mode: 'HTML' });
  } catch (e: any) {
    await safeReply(ctx, '❌ ' + e.message);
  }
});

async function showProfile(ctx: Context, userId: number) {
  const lang = getUserLang(userId);
  const profile = await getUserProfile(userId);
  const agents = await getDBTools().getUserAgents(userId).catch(() => ({ data: [] }));
  const agentList = (agents as any).data || [];
  const activeCount = agentList.filter((a: any) => a.isActive).length;
  const totalCount = agentList.length;

  // Подписка
  let planName = 'Free';
  let planIcon = '🆓';
  let genUsed = 0;
  let genLimit: string = '0';
  try {
    const sub = await getUserSubscription(userId);
    const plan = PLANS[sub.planId] || PLANS.free;
    planName = plan.name;
    planIcon = plan.icon;
    genUsed = getGenerationsUsed(userId);
    genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
  } catch {}

  // Статистика запусков
  let totalRuns = 0;
  let successRuns = 0;
  try {
    const execStats = await getExecutionHistoryRepository().getStats(userId);
    if (execStats) {
      totalRuns = execStats.totalRuns || 0;
      successRuns = execStats.successRuns || totalRuns;
    }
  } catch {}

  // Уровень пользователя (на основе активности)
  const xp = totalCount * 10 + totalRuns * 2 + (profile.total_earned || 0) * 5;
  const level = Math.floor(Math.sqrt(xp / 10)) + 1;
  const levelLabel = level >= 20 ? '🏆 Легенда' : level >= 10 ? '💎 Эксперт' : level >= 5 ? '🚀 Продвинутый' : level >= 2 ? '⚡ Новичок+' : '🌱 Новичок';

  // Рейтинг (звёзды на основе активности)
  const ratingScore = Math.min(5, Math.max(1, Math.floor((totalCount + totalRuns / 10) / 2) + 1));
  const starsStr = '⭐'.repeat(ratingScore);

  // Достижения
  const achievements: string[] = [];
  if (totalCount >= 1) achievements.push('🤖 Первый агент');
  if (totalCount >= 5) achievements.push('🏭 Фабрика агентов');
  if (totalRuns >= 10) achievements.push('⚡ Активный пользователь');
  if (totalRuns >= 100) achievements.push('🔥 Ветеран');
  if ((profile.total_earned || 0) > 0) achievements.push('💰 Первый заработок');
  if (profile.wallet_address) achievements.push('🔗 Кошелёк привязан');

  const joined = profile.joined_at
    ? new Date(profile.joined_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const walletLine = profile.wallet_address
    ? `${pe('link')} <b>${lang === 'ru' ? 'Кошелёк:' : 'Wallet:'}</b> <code>${escHtml(profile.wallet_address.slice(0,10))}…</code>`
    : `${pe('link')} <i>${lang === 'ru' ? 'Кошелёк не привязан' : 'No wallet linked'}</i>`;

  let text =
    `${pe('person')} <b>${lang === 'ru' ? 'Профиль' : 'Profile'} — ${escHtml(ctx.from?.first_name || 'User')}</b>\n` +
    `${div()}\n` +
    `${levelLabel} · Уровень <b>${level}</b>\n` +
    `${starsStr}\n\n` +
    `${pe('coin')} <b>${lang === 'ru' ? 'Баланс:' : 'Balance:'}</b> ${(profile.balance_ton || 0).toFixed(2)} TON\n` +
    `${pe('trending')} <b>${lang === 'ru' ? 'Заработано:' : 'Earned:'}</b> ${(profile.total_earned || 0).toFixed(2)} TON\n` +
    `${pe('robot')} <b>${lang === 'ru' ? 'Агентов:' : 'Agents:'}</b> ${totalCount} (${activeCount} ${lang === 'ru' ? 'активных' : 'active'})\n` +
    `${pe('chart')} <b>${lang === 'ru' ? 'Запусков:' : 'Runs:'}</b> ${totalRuns}\n` +
    `${pe('card')} <b>${lang === 'ru' ? 'Подписка:' : 'Plan:'}</b> ${planIcon} ${planName} · ${genUsed}/${genLimit} ${lang === 'ru' ? 'генераций' : 'gens'}\n` +
    `${pe('calendar')} <b>${lang === 'ru' ? 'С нами с:' : 'Member since:'}</b> ${escHtml(joined)}\n` +
    `${walletLine}\n` +
    `${div()}`;

  if (achievements.length > 0) {
    text += `\n\n${pe('sparkles')} <b>${lang === 'ru' ? 'Достижения:' : 'Achievements:'}</b>\n`;
    achievements.forEach(a => { text += `${a}\n`; });
  }

  const ru3 = lang === 'ru';
  await safeReply(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        // Подписка и монетизация
        [
          { text: `${peb('card')} ${ru3 ? 'Подписка' : 'Subscription'}`, callback_data: 'show_sub' },
          { text: `🔑 ${ru3 ? 'API ключи' : 'API Keys'}`, callback_data: 'profile_api_keys' },
        ],
        // Настройки
        [
          { text: `${peb('globe')} ${ru3 ? 'Язык интерфейса' : 'Interface lang'}`, callback_data: 'profile_change_lang' },
        ],
        // Навигация
        [
          { text: `🤖 ${ru3 ? 'Мои агенты' : 'My agents'}`, callback_data: 'list_agents' },
          { text: `💰 ${ru3 ? 'Кошелёк' : 'Wallet'}`, callback_data: 'show_wallet_menu' },
        ],
      ],
    },
  });
}


// ── Gifts menu callbacks ──────────────────────────────────────────────────
bot.action('gifts_arbitrage', async (ctx) => {
  await ctx.answerCbQuery('🔄 Ищу арбитраж...');
  const ru = getUserLang(ctx.from!.id) === 'ru';
  const giftsService = getTelegramGiftsService();
  try {
    const opps = await giftsService.scanArbitrageOpportunities({ maxPriceStars: 10000, minProfitPct: 10 });
    if (!opps || opps.length === 0) {
      await ctx.reply(ru ? '📊 Арбитражных возможностей сейчас нет (проверить через 5 мин).' : '📊 No arbitrage opportunities right now (check in 5 min).', {
        reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'gifts_arbitrage' }, { text: '⬅️ Назад', callback_data: 'gifts_menu' }]] },
      });
    } else {
      const top = opps.slice(0, 5).map((o: any) => `🎁 <b>${escHtml(o.giftName || o.slug)}</b>: ${o.buyPrice}⭐ → ${o.sellTon || o.sellPrice} TON (${o.profitPercent}%)`).join('\n');
      await safeReply(ctx, `🔥 <b>${ru ? 'Арбитраж подарков' : 'Gift Arbitrage'}</b>\n\n${top}`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: `🤖 ${ru ? 'Создать агента' : 'Create agent'}`, callback_data: 'quick_gift_agent' }, { text: '🔄 Обновить', callback_data: 'gifts_arbitrage' }]] },
      });
    }
  } catch (e: any) {
    await safeReply(ctx, `❌ ${e.message || 'unknown error'}`);
  }
});

bot.action('gifts_catalog', async (ctx) => {
  await ctx.answerCbQuery();
  const giftsService = getTelegramGiftsService();
  const catalog = await giftsService.getAvailableGifts();
  const top10 = catalog.slice(0, 10).map((g: any) => `• ${escHtml(g.name || g.slug)}: ${g.starsPrice}⭐`).join('\n');
  await safeReply(ctx, `📋 <b>Каталог подарков (${catalog.length} шт.)</b>\n\n${top10}\n\n<i>Это pre-market подарки. Апгрейд за Stars → уникальный NFT.</i>`, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'gifts_menu' }]] },
  });
});

bot.action('gifts_stars_balance', async (ctx) => {
  await ctx.answerCbQuery();
  const isAuth = await isAuthorized().catch(() => false);
  if (!isAuth) {
    await ctx.reply('❌ Для просмотра баланса Stars нужна авторизация Telegram.\nИспользуйте /tglogin', {
      reply_markup: { inline_keyboard: [[{ text: '🔑 /tglogin', callback_data: 'tg_login_start' }]] },
    });
    return;
  }
  const bal = await getTelegramGiftsService().getStarsBalance();
  await ctx.reply(`⭐ <b>Баланс Stars:</b> ${JSON.stringify(bal)}`, { parse_mode: 'HTML' });
});

bot.action('gifts_analyze', async (ctx) => {
  await ctx.answerCbQuery();
  const ru = getUserLang(ctx.from!.id) === 'ru';
  await ctx.reply(ru
    ? '🔍 Введите slug подарка для анализа (например: <code>homemade-cake</code>, <code>jelly-bunny</code>).\n\nОтправьте название подарка:'
    : '🔍 Enter gift slug for analysis (e.g. <code>homemade-cake</code>, <code>jelly-bunny</code>).\n\nSend gift name:',
    { parse_mode: 'HTML' }
  );
  // Route next text message as gift analyze request
  // (handled by general orchestrator which understands gift analysis context)
});

bot.action('gifts_fragment', async (ctx) => {
  await ctx.answerCbQuery();
  const ru = getUserLang(ctx.from!.id) === 'ru';
  await ctx.reply(ru
    ? '💎 <b>Fragment листинги</b>\n\nВведите slug подарка (например: <code>homemade-cake</code>):'
    : '💎 <b>Fragment listings</b>\n\nEnter gift slug (e.g. <code>homemade-cake</code>):',
    { parse_mode: 'HTML' }
  );
});

bot.action('gifts_giftasset', async (ctx) => {
  await ctx.answerCbQuery('⏳ Loading...');
  const ru = getUserLang(ctx.from!.id) === 'ru';
  await ctx.reply(ru
    ? '📈 <b>GiftAsset цены</b>\n\nВведите slug подарка для получения реальных цен по всем маркетплейсам (например: <code>homemade-cake</code>):'
    : '📈 <b>GiftAsset prices</b>\n\nEnter gift slug to get real prices across all marketplaces (e.g. <code>homemade-cake</code>):',
    { parse_mode: 'HTML' }
  );
});

bot.action('gifts_userbot', async (ctx) => {
  await ctx.answerCbQuery();
  const ru = getUserLang(ctx.from!.id) === 'ru';
  const isAuth = await isAuthorized().catch(() => false);
  const text = isAuth
    ? (ru
        ? '✅ <b>Telegram Userbot активен</b>\n\nЮзербот авторизован и готов к работе.\nАгенты могут:\n• Покупать/продавать подарки за Stars\n• Управлять каналами\n• Читать и отправлять сообщения\n• Участвовать в обсуждениях'
        : '✅ <b>Telegram Userbot active</b>\n\nUserbot authorized and ready.\nAgents can:\n• Buy/sell gifts for Stars\n• Manage channels\n• Read and send messages\n• Join discussions')
    : (ru
        ? '🔐 <b>Авторизация Telegram</b>\n\nДля работы с Telegram-рынком подарков нужен userbot.\n\nНажмите /tglogin для авторизации.'
        : '🔐 <b>Telegram Authorization</b>\n\nTo trade on Telegram gift market, you need a userbot.\n\nUse /tglogin to authorize.');

  await safeReply(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [
      isAuth ? [] : [{ text: '🔑 Авторизоваться', callback_data: 'tg_login_start' }],
      [{ text: '⬅️ Назад', callback_data: 'gifts_menu' }],
    ].filter(r => r.length > 0) },
  });
});

bot.action('gifts_menu', async (ctx) => { await ctx.answerCbQuery(); await showGiftsMenu(ctx); });

bot.action('quick_gift_agent', async (ctx) => {
  await ctx.answerCbQuery();
  const ru = getUserLang(ctx.from!.id) === 'ru';
  // Auto-trigger creation with gift arbitrage description
  const desc = ru
    ? 'Сканируй арбитражные возможности в Telegram подарках каждые 5 минут. Используй GiftAsset API для получения реальных цен. Если находишь подарок где разница цен > 10%, отправь уведомление с деталями: название подарка, где купить, где продать, потенциальная прибыль. Следи за чёрными фонами — они самые ценные.'
    : 'Scan Telegram gift arbitrage opportunities every 5 minutes. Use GiftAsset API for real prices. If you find a gift with price difference > 10%, send notification with details: gift name, where to buy, where to sell, potential profit. Watch for black backgrounds — they are most valuable.';
  await ctx.reply(ru ? `🚀 Создаю арбитраж-агента...\n\n<i>${escHtml(desc.slice(0, 200))}...</i>` : `🚀 Creating arbitrage agent...\n\n<i>${escHtml(desc.slice(0, 200))}...</i>`, { parse_mode: 'HTML' });
  // Route to orchestrator
  const result = await getOrchestrator().processMessage(ctx.from!.id, desc);
  await sendResult(ctx, result);
});

// ── Wallet menu callbacks ──────────────────────────────────────────────────
bot.action('wallet_history', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const txResult = await getBalanceTxRepository().getHistory(userId, 10, 0);
    const txs = Array.isArray(txResult) ? txResult : (txResult as any).transactions || [];
    if (!txs || txs.length === 0) {
      await ctx.reply(ru ? '📊 История транзакций пуста.' : '📊 No transactions yet.');
      return;
    }
    const lines = txs.map((t: any) => {
      const sign = Number(t.amount_ton) >= 0 ? '+' : '';
      const icon = t.type === 'topup' ? '💳' : t.type === 'withdraw' ? '💸' : t.type === 'spend' ? '🔴' : t.type === 'earn' ? '🟢' : '⚪';
      const date = new Date(t.created_at).toLocaleDateString('ru-RU');
      return `${icon} ${sign}${Number(t.amount_ton).toFixed(3)} TON · ${escHtml(t.description || t.type)} · ${date}`;
    }).join('\n');
    const profile = await getUserProfile(userId);
    await safeReply(ctx,
      `📊 <b>${ru ? 'История транзакций' : 'Transaction History'}</b>\n\n${lines}\n\n💰 ${ru ? 'Баланс:' : 'Balance:'} <b>${(profile.balance_ton || 0).toFixed(3)} TON</b>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Кошелёк', callback_data: 'back_wallet' }]] } }
    );
  } catch (e: any) {
    await ctx.reply('❌ ' + e.message);
  }
});

bot.action('show_tonconnect',  async (ctx) => { await ctx.answerCbQuery(); await showTonConnect(ctx); });
bot.action('back_wallet',      async (ctx) => { await ctx.answerCbQuery(); await showWalletMenu(ctx); });
bot.action('show_wallet_menu', async (ctx) => { await ctx.answerCbQuery(); await showWalletMenu(ctx); });
bot.action('profile_menu',     async (ctx) => { await ctx.answerCbQuery(); await showProfile(ctx, ctx.from!.id); });

// ══════════════════════════════════════════════════════════════════════════
// ── AGENTIC WALLETS — полное управление кошельками агентов ──────────────
// ══════════════════════════════════════════════════════════════════════════

bot.action('agentic_wallets_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const svc = getAgenticWalletService();
    const wallets = await svc.getUserWallets(userId);
    const rootWallet = wallets.find(w => w.walletType === 'root');
    const subWallets = wallets.filter(w => w.walletType === 'sub');
    const stats = await svc.getStats(userId);

    let text =
      `🔐 <b>Agentic Wallets</b>\n` +
      `${div()}\n` +
      `<i>${ru ? 'Self-custody кошельки для ваших агентов.\nАгент тратит автономно — вы контролируете.' : 'Self-custody wallets for your agents.\nAgent spends autonomously — you stay in control.'}</i>\n\n`;

    if (rootWallet) {
      const addrShort = rootWallet.address.slice(0, 8) + '…' + rootWallet.address.slice(-6);
      text += `👑 <b>Root Wallet:</b> <code>${escHtml(addrShort)}</code>\n`;
      text += `💰 ${ru ? 'Баланс:' : 'Balance:'} <b>${rootWallet.balanceTon.toFixed(4)} TON</b>\n\n`;
    } else {
      text += `👑 <b>Root Wallet:</b> <i>${ru ? 'не настроен' : 'not set up'}</i>\n\n`;
    }

    text += `📊 <b>${ru ? 'Статистика' : 'Stats'}:</b>\n`;
    text += `   ${ru ? 'Всего кошельков' : 'Total wallets'}: <b>${stats.totalWallets}</b>\n`;
    text += `   ${ru ? 'Активных' : 'Active'}: <b>${stats.activeWallets}</b> | ${ru ? 'Заблокированных' : 'Blocked'}: <b>${stats.blockedWallets}</b>\n`;
    text += `   ${ru ? 'Общий баланс' : 'Total balance'}: <b>${stats.totalBalanceTon.toFixed(4)} TON</b>\n`;
    text += `   ${ru ? 'Потрачено сегодня' : 'Spent today'}: <b>${stats.totalSpentTodayTon.toFixed(4)} TON</b>\n`;

    if (subWallets.length > 0) {
      text += `\n📋 <b>${ru ? 'Кошельки агентов' : 'Agent Wallets'}:</b>\n`;
      for (const w of subWallets.slice(0, 10)) {
        const status = w.isBlocked ? '🔴' : '🟢';
        const agentLabel = w.agentId ? `#${w.agentId}` : (ru ? 'не привязан' : 'unlinked');
        const addr = w.address.slice(0, 6) + '…' + w.address.slice(-4);
        text += `${status} <b>${escHtml(w.label || addr)}</b> — ${w.balanceTon.toFixed(3)} TON [${agentLabel}]\n`;
      }
      if (subWallets.length > 10) {
        text += `<i>+${subWallets.length - 10} ${ru ? 'ещё' : 'more'}...</i>\n`;
      }
    }

    const kb: any[][] = [];

    if (!rootWallet) {
      kb.push([{ text: `👑 ${ru ? 'Создать Root Wallet' : 'Create Root Wallet'}`, callback_data: 'aw_setup_root' }]);
      kb.push([{ text: `📥 ${ru ? 'Импорт кошелька' : 'Import Wallet'}`, callback_data: 'aw_import' }]);
    } else {
      kb.push([
        { text: `➕ ${ru ? 'Новый Sub-Wallet' : 'New Sub-Wallet'}`, callback_data: 'aw_deploy_sub' },
        { text: `🔄 ${ru ? 'Обновить балансы' : 'Refresh'}`, callback_data: 'aw_refresh_all' },
      ]);
    }

    if (subWallets.length > 0) {
      kb.push([{ text: `📋 ${ru ? 'Управление кошельками' : 'Manage Wallets'}`, callback_data: 'aw_list_manage' }]);
    }

    kb.push([
      { text: `🌐 Dashboard`, url: 'https://agentic-wallets-dashboard.vercel.app' },
    ]);

    kb.push([{ text: `◀️ ${ru ? 'Кошелёк' : 'Wallet'}`, callback_data: 'show_wallet_menu' }]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Setup Root Wallet ──
bot.action('aw_setup_root', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const result = await getAgenticWalletService().setupRootWallet(userId);

    if (result.dashboardUrl) {
      await editOrReply(ctx,
        `👑 <b>${ru ? 'Настройка Root Wallet' : 'Root Wallet Setup'}</b>\n\n` +
        `${ru ? 'Перейдите в Dashboard для завершения настройки:' : 'Go to Dashboard to complete setup:'}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: '🌐 Open Dashboard', url: result.dashboardUrl }],
          [{ text: '◀️ Назад', callback_data: 'agentic_wallets_menu' }],
        ] } }
      );
      return;
    }

    if (result.wallet) {
      await editOrReply(ctx,
        `✅ <b>Root Wallet ${ru ? 'создан' : 'created'}!</b>\n\n` +
        `📍 <b>${ru ? 'Адрес' : 'Address'}:</b>\n<code>${escHtml(result.wallet.address)}</code>\n\n` +
        `${ru ? 'Этот кошелёк — ваш главный. Все Sub-Wallets агентов будут привязаны к нему.' : 'This is your master wallet. All agent Sub-Wallets will be linked to it.'}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `➕ ${ru ? 'Создать Sub-Wallet' : 'Create Sub-Wallet'}`, callback_data: 'aw_deploy_sub' }],
          [{ text: '◀️ Agentic Wallets', callback_data: 'agentic_wallets_menu' }],
        ] } }
      );
    } else {
      await ctx.reply(`❌ ${result.error || 'Setup failed'}`);
    }
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Import existing wallet ──
const pendingWalletImport = new Map<number, { type: 'address' | 'mnemonic'; startTs: number }>();

bot.action('aw_import', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  await editOrReply(ctx,
    `📥 <b>${ru ? 'Импорт кошелька' : 'Import Wallet'}</b>\n\n` +
    `${ru ? 'Выберите способ:' : 'Choose method:'}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `📍 ${ru ? 'Ввести адрес' : 'Enter Address'}`, callback_data: 'aw_import_addr' }],
      [{ text: `🔑 ${ru ? 'Ввести мнемонику (24 слова)' : 'Enter Mnemonic (24 words)'}`, callback_data: 'aw_import_mnemonic' }],
      [{ text: '◀️ Назад', callback_data: 'agentic_wallets_menu' }],
    ] } }
  );
});

bot.action('aw_import_addr', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  pendingWalletImport.set(userId, { type: 'address', startTs: Date.now() });
  await editOrReply(ctx,
    `📍 Отправьте TON адрес кошелька (EQ... или UQ...):`,
    { reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'agentic_wallets_menu' }]] } }
  );
});

bot.action('aw_import_mnemonic', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  pendingWalletImport.set(userId, { type: 'mnemonic', startTs: Date.now() });
  await editOrReply(ctx,
    `🔑 Отправьте 24 слова мнемоники через пробел:\n\n⚠️ <i>Сообщение будет удалено после обработки!</i>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'agentic_wallets_menu' }]] } }
  );
});

// ── Deploy Sub-Wallet ──
bot.action('aw_deploy_sub', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';

  // Get user's agents to choose from
  try {
    const agents = await getDBTools().getUserAgents(userId);
    if (!agents.data || agents.data.length === 0) {
      await ctx.reply(ru ? '❌ У вас нет агентов. Создайте агента сначала.' : '❌ No agents found. Create an agent first.');
      return;
    }

    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const svc = getAgenticWalletService();
    const existingWallets = await svc.getSubWallets(userId);
    const linkedAgentIds = new Set(existingWallets.map(w => w.agentId).filter(Boolean));

    const kb: any[][] = [];
    for (const a of agents.data.slice(0, 15)) {
      if (linkedAgentIds.has(a.id)) continue; // Skip agents that already have wallets
      const name = a.name || `Agent #${a.id}`;
      kb.push([{ text: `💼 ${name}`, callback_data: `aw_deploy_for:${a.id}` }]);
    }

    if (kb.length === 0) {
      await ctx.reply(ru ? '✅ Все агенты уже имеют кошельки!' : '✅ All agents already have wallets!');
      return;
    }

    kb.push([{ text: `🆕 ${ru ? 'Без агента (свободный)' : 'No agent (free)'}`, callback_data: 'aw_deploy_for:0' }]);
    kb.push([{ text: '◀️ Назад', callback_data: 'agentic_wallets_menu' }]);

    await editOrReply(ctx,
      `➕ <b>${ru ? 'Выберите агента для нового кошелька' : 'Choose agent for new wallet'}:</b>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }
    );
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

bot.action(/^aw_deploy_for:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Deploying...');
  const userId = ctx.from!.id;
  const agentId = parseInt(ctx.match![1]);
  const ru = getUserLang(userId) === 'ru';
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const result = await getAgenticWalletService().deploySubWallet(
      userId,
      agentId || 0, // 0 = unlinked
      agentId ? `Agent #${agentId}` : 'Free Wallet'
    );

    if (result.success && result.wallet) {
      const w = result.wallet;
      const deepLink = `ton://transfer/${w.address}`;
      await editOrReply(ctx,
        `✅ <b>${ru ? 'Кошелёк создан' : 'Wallet created'}!</b>\n\n` +
        `📍 <b>${ru ? 'Адрес' : 'Address'}:</b>\n<code>${escHtml(w.address)}</code>\n\n` +
        `🏷 <b>Label:</b> ${escHtml(w.label)}\n` +
        `💰 <b>${ru ? 'Лимит' : 'Limit'}:</b> ${w.spendLimitTon} TON/${ru ? 'день' : 'day'}\n\n` +
        `📥 ${ru ? 'Отправьте TON на этот адрес чтобы агент мог тратить.' : 'Send TON to this address so the agent can spend.'}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `💎 ${ru ? 'Открыть в кошельке' : 'Open in Wallet'}`, url: deepLink }],
          [{ text: '◀️ Agentic Wallets', callback_data: 'agentic_wallets_menu' }],
        ] } }
      );
    } else {
      await ctx.reply(`❌ ${result.error || 'Deploy failed'}`);
    }
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Refresh all balances ──
bot.action('aw_refresh_all', async (ctx) => {
  await ctx.answerCbQuery('🔄 Refreshing...');
  const userId = ctx.from!.id;
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    await getAgenticWalletService().refreshAllBalances(userId);
    // Re-show the menu with updated balances
    // Trigger the menu handler by calling the action directly
    await (ctx as any).match; // just to proceed
  } catch (e: any) { console.warn('[Wallet] refresh all error:', e.message); }
  // Re-render menu
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const svc = getAgenticWalletService();
    const wallets = await svc.getUserWallets(userId);
    const stats = await svc.getStats(userId);
    const ru = getUserLang(userId) === 'ru';
    const subWallets = wallets.filter(w => w.walletType === 'sub');
    const rootWallet = wallets.find(w => w.walletType === 'root');

    let text =
      `🔐 <b>Agentic Wallets</b> <i>(${ru ? 'обновлено' : 'refreshed'} ✅)</i>\n${div()}\n`;

    if (rootWallet) {
      const addrShort = rootWallet.address.slice(0, 8) + '…' + rootWallet.address.slice(-6);
      text += `👑 <b>Root:</b> <code>${escHtml(addrShort)}</code> — ${rootWallet.balanceTon.toFixed(4)} TON\n\n`;
    }

    text += `📊 ${ru ? 'Кошельков' : 'Wallets'}: <b>${stats.totalWallets}</b> | `;
    text += `${ru ? 'Баланс' : 'Balance'}: <b>${stats.totalBalanceTon.toFixed(4)} TON</b>\n`;

    if (subWallets.length > 0) {
      text += `\n📋 <b>${ru ? 'Кошельки' : 'Wallets'}:</b>\n`;
      for (const w of subWallets.slice(0, 10)) {
        const status = w.isBlocked ? '🔴' : '🟢';
        text += `${status} <b>${escHtml(w.label)}</b> — ${w.balanceTon.toFixed(3)} TON\n`;
      }
    }

    const kb: any[][] = [
      [
        { text: `➕ ${ru ? 'Новый' : 'New'}`, callback_data: 'aw_deploy_sub' },
        { text: `🔄 ${ru ? 'Обновить' : 'Refresh'}`, callback_data: 'aw_refresh_all' },
      ],
    ];
    if (subWallets.length > 0) {
      kb.push([{ text: `📋 ${ru ? 'Управление' : 'Manage'}`, callback_data: 'aw_list_manage' }]);
    }
    kb.push([{ text: '🌐 Dashboard', url: 'https://agentic-wallets-dashboard.vercel.app' }]);
    kb.push([{ text: `◀️ ${ru ? 'Кошелёк' : 'Wallet'}`, callback_data: 'show_wallet_menu' }]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Manage wallets list ──
bot.action('aw_list_manage', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const wallets = await getAgenticWalletService().getSubWallets(userId);

    if (wallets.length === 0) {
      await ctx.reply(ru ? 'Нет кошельков для управления.' : 'No wallets to manage.');
      return;
    }

    const kb: any[][] = [];
    for (const w of wallets.slice(0, 20)) {
      const status = w.isBlocked ? '🔴' : '🟢';
      const bal = w.balanceTon.toFixed(3);
      kb.push([{
        text: `${status} ${w.label || w.address.slice(0, 10)} — ${bal} TON`,
        callback_data: `aw_manage:${w.id}`,
      }]);
    }
    kb.push([{ text: '◀️ Назад', callback_data: 'agentic_wallets_menu' }]);

    await editOrReply(ctx,
      `📋 <b>${ru ? 'Управление кошельками' : 'Wallet Management'}</b>\n` +
      `<i>${ru ? 'Выберите кошелёк для настройки:' : 'Choose a wallet to manage:'}</i>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }
    );
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Single wallet management ──
bot.action(/^aw_manage:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const walletId = parseInt(ctx.match![1]);
  const ru = getUserLang(userId) === 'ru';
  try {
    const { rows } = await dbPool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE id = $1 AND user_id = $2`,
      [walletId, userId]
    );
    if (!rows[0]) { await ctx.reply('Wallet not found'); return; }
    const w = rows[0];
    const balanceTon = Number(w.balance_nano || 0) / 1e9;
    const deepLink = `ton://transfer/${w.address}`;

    let text =
      `💼 <b>${escHtml(w.label || 'Wallet')}</b>\n${div()}\n` +
      `📍 <b>${ru ? 'Адрес' : 'Address'}:</b>\n<code>${escHtml(w.address)}</code>\n\n` +
      `💰 <b>${ru ? 'Баланс' : 'Balance'}:</b> ${balanceTon.toFixed(4)} TON\n` +
      `📊 <b>${ru ? 'Лимит' : 'Limit'}:</b> ${Number(w.spend_limit_ton)} TON/${ru ? 'день' : 'day'}\n` +
      `🤖 <b>${ru ? 'Агент' : 'Agent'}:</b> ${w.agent_id ? `#${w.agent_id}` : (ru ? 'не привязан' : 'unlinked')}\n` +
      `📌 <b>${ru ? 'Статус' : 'Status'}:</b> ${w.is_blocked ? '🔴 Заблокирован' : '🟢 Активен'}\n`;

    const kb: any[][] = [
      [
        { text: `💎 ${ru ? 'Пополнить' : 'Deposit'}`, url: deepLink },
        { text: `🔄 ${ru ? 'Обновить' : 'Refresh'}`, callback_data: `aw_refresh:${walletId}` },
      ],
      [
        w.is_blocked
          ? { text: `🟢 ${ru ? 'Разблокировать' : 'Unblock'}`, callback_data: `aw_unblock:${walletId}` }
          : { text: `🔴 ${ru ? 'Заблокировать' : 'Block'}`, callback_data: `aw_block:${walletId}` },
        { text: `📊 ${ru ? 'Лимит' : 'Limit'}`, callback_data: `aw_set_limit:${walletId}` },
      ],
      [
        { text: `📜 ${ru ? 'Транзакции' : 'Transactions'}`, callback_data: `aw_txs:${walletId}` },
        { text: `🏷 ${ru ? 'Имя' : 'Label'}`, callback_data: `aw_rename:${walletId}` },
      ],
      [
        { text: `🔗 ${ru ? 'Привязать агента' : 'Link Agent'}`, callback_data: `aw_link_agent:${walletId}` },
        { text: `🗑 ${ru ? 'Удалить' : 'Delete'}`, callback_data: `aw_delete:${walletId}` },
      ],
      [{ text: '◀️ Назад', callback_data: 'aw_list_manage' }],
    ];

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Block / Unblock ──
bot.action(/^aw_block:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery('🔴 Blocking...');
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    await getAgenticWalletService().setBlocked(parseInt(ctx.match![1]), ctx.from!.id, true);
    await ctx.reply('🔴 Кошелёк заблокирован. Агент не сможет тратить.');
  } catch (e: any) { await safeReply(ctx, `❌ Ошибка: ${e.message}`); }
});

bot.action(/^aw_unblock:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery('🟢 Unblocking...');
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    await getAgenticWalletService().setBlocked(parseInt(ctx.match![1]), ctx.from!.id, false);
    await ctx.reply('🟢 Кошелёк разблокирован.');
  } catch (e: any) { await safeReply(ctx, `❌ Ошибка: ${e.message}`); }
});

// ── Refresh single wallet ──
bot.action(/^aw_refresh:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery('🔄 Refreshing...');
    const walletId = parseInt(ctx.match![1]);
    if (isNaN(walletId)) { await safeReply(ctx, '❌ Invalid wallet ID'); return; }
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    // Ownership check: verify wallet belongs to user
    const walletCheck = await getAgenticWalletService().getWallet(walletId, ctx.from!.id);
    if (!walletCheck) { await safeReply(ctx, '❌ Кошелёк не найден'); return; }
    const bal = await getAgenticWalletService().refreshBalance(walletId);
    await ctx.reply(`💰 Баланс: ${bal.toFixed(4)} TON`);
  } catch (e: any) { await safeReply(ctx, `❌ Ошибка обновления: ${e.message}`); }
});

// ── Set spend limit ──
const pendingWalletLimit = new Map<number, { walletId: number; startTs: number }>();

bot.action(/^aw_set_limit:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const walletId = parseInt(ctx.match![1]);
  if (isNaN(walletId)) return;
  // Ownership check
  try {
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const w = await getAgenticWalletService().getWallet(walletId, userId);
    if (!w) { await safeReply(ctx, '❌ Кошелёк не найден'); return; }
  } catch { return; }
  pendingWalletLimit.set(userId, { walletId, startTs: Date.now() });
  const ru = getUserLang(userId) === 'ru';
  await editOrReply(ctx,
    `📊 ${ru ? 'Введите новый дневной лимит в TON (например: 10):' : 'Enter new daily limit in TON (e.g. 10):'}`,
    { reply_markup: { inline_keyboard: [
      [
        { text: '5 TON', callback_data: 'aw_limit_quick:5' },
        { text: '10 TON', callback_data: 'aw_limit_quick:10' },
        { text: '50 TON', callback_data: 'aw_limit_quick:50' },
        { text: '100 TON', callback_data: 'aw_limit_quick:100' },
      ],
      [{ text: '❌ Отмена', callback_data: 'agentic_wallets_menu' }],
    ] } }
  );
});

bot.action(/^aw_limit_quick:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const pending = pendingWalletLimit.get(userId);
  if (!pending) return;
  const limitTon = parseInt(ctx.match![1]);
  const { getAgenticWalletService } = await import('./services/agentic-wallet');
  await getAgenticWalletService().setSpendLimit(pending.walletId, userId, limitTon);
  pendingWalletLimit.delete(userId);
  await ctx.reply(`✅ Лимит установлен: ${limitTon} TON/день`);
});

// ── Transaction history ──
bot.action(/^aw_txs:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const walletId = parseInt(ctx.match![1]);
  const ru = getUserLang(userId) === 'ru';
  try {
    const { rows } = await dbPool.query(
      `SELECT address, label FROM builder_bot.agentic_wallets WHERE id = $1 AND user_id = $2`,
      [walletId, userId]
    );
    if (!rows[0]) { await ctx.reply('Not found'); return; }

    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    const txs = await getAgenticWalletService().getTransactions(rows[0].address, 10);

    let text = `📜 <b>${ru ? 'Транзакции' : 'Transactions'}: ${escHtml(rows[0].label)}</b>\n${div()}\n`;

    if (txs.length === 0) {
      text += `<i>${ru ? 'Транзакций пока нет' : 'No transactions yet'}</i>`;
    } else {
      for (const tx of txs) {
        const dir = tx.to.toLowerCase().includes(rows[0].address.toLowerCase().slice(0, 20)) ? '📥' : '📤';
        const date = new Date(tx.timestamp * 1000).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
        text += `${dir} <b>${tx.amountTon.toFixed(4)} TON</b> — ${date}\n`;
        if (tx.comment) text += `   💬 <i>${escHtml(tx.comment.slice(0, 40))}</i>\n`;
      }
    }

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `🔗 Tonscan`, url: `https://tonscan.org/address/${rows[0].address}` }],
      [{ text: '◀️ Назад', callback_data: `aw_manage:${walletId}` }],
    ] } });
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

// ── Rename wallet ──
const pendingWalletRename = new Map<number, { walletId: number; startTs: number }>();

bot.action(/^aw_rename:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  pendingWalletRename.set(ctx.from!.id, { walletId: parseInt(ctx.match![1]), startTs: Date.now() });
  await editOrReply(ctx, '🏷 Введите новое имя для кошелька:',
    { reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'agentic_wallets_menu' }]] } }
  );
});

// ── Delete wallet ──
bot.action(/^aw_delete:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const walletId = parseInt(ctx.match![1]);
  const ru = getUserLang(ctx.from!.id) === 'ru';
  await editOrReply(ctx,
    `⚠️ <b>${ru ? 'Удалить кошелёк?' : 'Delete wallet?'}</b>\n` +
    `<i>${ru ? 'Убедитесь что вывели все средства!' : 'Make sure you withdrew all funds!'}</i>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [
        { text: `✅ ${ru ? 'Да, удалить' : 'Yes, delete'}`, callback_data: `aw_delete_confirm:${walletId}` },
        { text: '❌ Отмена', callback_data: `aw_manage:${walletId}` },
      ],
    ] } }
  );
});

bot.action(/^aw_delete_confirm:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery('🗑 Deleting...');
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    await getAgenticWalletService().deleteWallet(parseInt(ctx.match![1]), ctx.from!.id);
    await ctx.reply('✅ Кошелёк удалён.');
  } catch (e: any) { await safeReply(ctx, `❌ Ошибка удаления: ${e.message}`); }
});

// ── Link agent to wallet ──
bot.action(/^aw_link_agent:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const walletId = parseInt(ctx.match![1]);
  const ru = getUserLang(userId) === 'ru';
  try {
    const agents = await getDBTools().getUserAgents(userId);
    const kb: any[][] = [];
    kb.push([{ text: `🔓 ${ru ? 'Отвязать' : 'Unlink'}`, callback_data: `aw_assign:${walletId}:0` }]);
    for (const a of (agents.data || []).slice(0, 15)) {
      kb.push([{ text: `🤖 ${a.name || `Agent #${a.id}`}`, callback_data: `aw_assign:${walletId}:${a.id}` }]);
    }
    kb.push([{ text: '◀️ Назад', callback_data: `aw_manage:${walletId}` }]);

    await editOrReply(ctx,
      `🔗 <b>${ru ? 'Привязать агента к кошельку' : 'Link agent to wallet'}:</b>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }
    );
  } catch (e: any) {
    await ctx.reply('❌ ' + String(e));
  }
});

bot.action(/^aw_assign:(\d+):(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery('🔗 Linking...');
    const walletId = parseInt(ctx.match![1]);
    const agentId = parseInt(ctx.match![2]);
    const { getAgenticWalletService } = await import('./services/agentic-wallet');
    await getAgenticWalletService().assignToAgent(walletId, ctx.from!.id, agentId || null);
    await ctx.reply(agentId ? `✅ Кошелёк привязан к агенту #${agentId}` : '✅ Кошелёк отвязан от агента');
  } catch (e: any) { await safeReply(ctx, `❌ Ошибка: ${e.message}`); }
});

// ── Пополнение баланса ───────────────────────
const pendingTopup = new Map<number, { startTs: number; amountTon?: number }>();
const processedTopupTx = new Set<string>();
const TOPUP_DISPLAY_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';

bot.action('topup_start', async (ctx) => {
  await ctx.answerCbQuery();
  const ru = getUserLang(ctx.from!.id) === 'ru';
  const text =
    `${pe('card')} <b>${ru ? 'Пополнение баланса' : 'Top Up Balance'}</b>\n\n` +
    (ru ? 'Выберите сумму пополнения:' : 'Choose top-up amount:');
  const kb = { inline_keyboard: [
    [
      { text: '1 TON',  callback_data: 'topup_amount:1' },
      { text: '5 TON',  callback_data: 'topup_amount:5' },
      { text: '10 TON', callback_data: 'topup_amount:10' },
      { text: '25 TON', callback_data: 'topup_amount:25' },
    ],
    [{ text: ru ? '⬅️ Назад' : '⬅️ Back', callback_data: 'show_profile' }],
  ]};
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb })
    .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb }));
});

bot.action(/^topup_amount:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  const amountTon = parseInt(ctx.match[1]);
  pendingTopup.set(userId, { startTs: Math.floor(Date.now() / 1000) - 30, amountTon });

  const comment = `topup:${userId}`;
  const tonConn = getTonConnectManager();
  const isConnected = tonConn.isConnected(userId);

  const nanoTon = BigInt(Math.floor(amountTon * 1e9));
  const deepLink = `ton://transfer/${TOPUP_DISPLAY_ADDRESS}?amount=${nanoTon}&text=${encodeURIComponent(comment)}`;

  const text =
    `${pe('card')} <b>${ru ? 'Пополнение баланса' : 'Top Up Balance'}</b>\n` +
    `${div()}\n` +
    (ru
      ? `Отправьте <b>${amountTon} TON</b> на адрес платформы с комментарием:`
      : `Send <b>${amountTon} TON</b> to the platform address with this comment:`) + '\n\n' +
    `${pe('mailbox')} <b>${ru ? 'Адрес:' : 'Address:'}</b>\n` +
    `<code>${TOPUP_DISPLAY_ADDRESS}</code>\n` +
    `<b>agentplatform.ton</b>\n\n` +
    `${pe('bubble')} <b>${ru ? 'Комментарий (обязательно):' : 'Comment (required):'}</b>\n` +
    `<code>${comment}</code>\n\n` +
    `${pe('warning')} <i>${ru ? 'Без комментария зачисление невозможно!' : 'Without comment payment cannot be credited!'}</i>\n` +
    `${div()}\n` +
    (ru ? 'После отправки нажмите кнопку проверки.' : 'After sending press the check button.');

  const btns: any[][] = [];
  // Deep link — opens any TON wallet app
  btns.push([{ text: `💎 ${ru ? 'Открыть в TON-кошельке' : 'Open in TON Wallet'}`, url: deepLink }]);
  if (isConnected) {
    btns.push([{ text: `💸 ${ru ? 'Пополнить' : 'Pay'} ${amountTon} TON ${ru ? 'через Tonkeeper' : 'via Tonkeeper'}`, callback_data: `topup_tonconnect:${amountTon}` }]);
  }
  btns.push([{ text: ru ? '✅ Я отправил — проверить' : '✅ I sent — check', callback_data: 'check_topup' }]);
  btns.push([{ text: ru ? '⬅️ Назад' : '⬅️ Back', callback_data: 'topup_start' }]);

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } })
    .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }));
});

bot.action(/^topup_tonconnect:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  const amountTon = parseInt(ctx.match[1]);

  const tonConn = getTonConnectManager();
  if (!tonConn.isConnected(userId)) {
    await ctx.reply(ru ? '❌ Сначала подключите TON кошелёк через 💎 TON Connect' : '❌ Please connect your TON wallet via 💎 TON Connect first');
    return;
  }

  pendingTopup.set(userId, { startTs: Math.floor(Date.now() / 1000) - 30, amountTon });
  await ctx.reply(ru ? '📤 Запрашиваю подтверждение в Tonkeeper...' : '📤 Requesting confirmation in Tonkeeper...');

  const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
  const comment = `topup:${userId}`;
  const result = await tonConn.sendTon(userId, payAddress, amountTon, comment);

  if (result.success) {
    const txId = result.boc || comment;
    // DB dedup
    try { const existing = await getBalanceTxRepository().getByTxHash(txId); if (existing) { await ctx.reply(ru ? '⚠️ Уже зачислено.' : '⚠️ Already credited.'); return; } } catch (e: any) { console.error('[CRITICAL] Dedup check failed:', e.message); }
    const p = await addUserBalance(userId, amountTon, { type: 'topup', description: 'TON Connect topup', txHash: txId });
    processedTopupTx.add(txId);
    pendingTopup.delete(userId);
    await ctx.reply(
      `${pe('check')} <b>${ru ? 'Баланс пополнен!' : 'Balance topped up!'}</b>\n\n` +
      `${pe('tonCoin')} ${ru ? 'Зачислено:' : 'Credited:'} <b>${amountTon} TON</b>\n` +
      `${pe('coin')} ${ru ? 'Баланс:' : 'Balance:'} <b>${p.balance_ton.toFixed(2)} TON</b>`,
      { parse_mode: 'HTML' }
    );
    await showProfile(ctx, userId);
  } else {
    await ctx.reply(ru
      ? `❌ Ошибка транзакции: ${result.error || 'отменено'}\n\nМожете пополнить вручную.`
      : `❌ Transaction error: ${result.error || 'cancelled'}\n\nYou can top up manually.`
    );
  }
});

bot.action('check_topup', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const ru = getUserLang(userId) === 'ru';
  const pending = pendingTopup.get(userId);
  const result = await verifyTopupTransaction(userId, pending?.startTs);
  if (!result.found || !result.txHash) {
    await ctx.reply(
      ru
        ? `❌ Платёж не найден. Отправьте TON с комментарием <code>topup:${userId}</code> и подождите 30–60 сек.`
        : `❌ Payment not found. Send TON with comment <code>topup:${userId}</code> and wait 30–60 sec.`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: ru ? '🔄 Проверить снова' : '🔄 Check again', callback_data: 'check_topup' }],
          [{ text: ru ? '⬅️ Назад' : '⬅️ Back', callback_data: 'topup_start' }],
        ]},
      }
    );
    return;
  }
  // DB dedup (survives restart)
  try {
    const existing = await getBalanceTxRepository().getByTxHash(result.txHash);
    if (existing) {
      await ctx.reply(ru ? '⚠️ Транзакция уже зачислена.' : '⚠️ Already credited.');
      return;
    }
  } catch (e: any) { console.error('[CRITICAL] Star dedup check failed:', e.message); }
  if (processedTopupTx.has(result.txHash)) {
    await ctx.reply(ru ? '⚠️ Транзакция уже зачислена.' : '⚠️ Already credited.');
    return;
  }
  processedTopupTx.add(result.txHash);
  pendingTopup.delete(userId);
  const p = await addUserBalance(userId, result.amountTon, { type: 'topup', description: 'Manual topup check', txHash: result.txHash });
  await ctx.reply(
    `${pe('check')} <b>${ru ? 'Баланс пополнен!' : 'Balance topped up!'}</b>\n\n` +
    `${pe('tonCoin')} ${ru ? 'Зачислено:' : 'Credited:'} <b>${result.amountTon.toFixed(2)} TON</b>\n` +
    `${pe('coin')} ${ru ? 'Баланс:' : 'Balance:'} <b>${p.balance_ton.toFixed(2)} TON</b>`,
    { parse_mode: 'HTML' }
  );
});

// ── Withdraw flow ──
const WITHDRAW_MAX_PER_DAY = 10;
const WITHDRAW_COOLDOWN_MS = 15 * 1000; // 15 seconds
const WITHDRAW_MAX_PERCENT = 0.8; // max 80% of balance
const OWNER_IDS = new Set([101021777, 130806013, 133270291]); // platform owners — no rate limits

bot.action('withdraw_start', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  const ru = lang === 'ru';
  const profile = await getUserProfile(userId);

  if (profile.balance_ton < 0.1) {
    await safeReply(ctx,
      `${pe('warning')} <b>${ru ? 'Недостаточно средств' : 'Insufficient funds'}</b>\n\n` +
      `${ru ? 'Минимальная сумма вывода: <b>0.1 TON</b>' : 'Minimum withdrawal: <b>0.1 TON</b>'}\n` +
      `${ru ? 'Ваш баланс:' : 'Your balance:'} <b>${(profile.balance_ton || 0).toFixed(3)} TON</b>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: `💳 ${ru ? 'Пополнить' : 'Top Up'}`, callback_data: 'topup_start' }],
        [{ text: `◀️ ${ru ? 'Кошелёк' : 'Wallet'}`, callback_data: 'show_wallet_menu' }],
      ]}}
    );
    return;
  }

  // Rate limit (bypassed for platform owners)
  try {
    const isOwner = OWNER_IDS.has(userId) || isPlatformAdmin(userId);
    const recentCount = isOwner ? 0 : await getBalanceTxRepository().getRecentWithdraws(userId, 24);
    if (!isOwner && recentCount >= WITHDRAW_MAX_PER_DAY) {
      // Показываем когда сбросится (в полночь UTC)
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const hoursLeft = Math.ceil((tomorrow.getTime() - now.getTime()) / 3600000);
      await safeReply(ctx,
        `⏳ <b>${ru ? 'Лимит выводов исчерпан' : 'Withdrawal limit reached'}</b>\n\n` +
        `${ru ? `Использовано: <b>${recentCount}/${WITHDRAW_MAX_PER_DAY}</b> выводов за сутки` : `Used: <b>${recentCount}/${WITHDRAW_MAX_PER_DAY}</b> withdrawals today`}\n` +
        `${ru ? `Сброс через: ~${hoursLeft} ч.` : `Resets in: ~${hoursLeft} h.`}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `◀️ ${ru ? 'Кошелёк' : 'Wallet'}`, callback_data: 'show_wallet_menu' }],
        ]}}
      );
      return;
    }
    // Cooldown
    const lastTime = isOwner ? null : await getBalanceTxRepository().getLastWithdrawTime(userId);
    if (!isOwner && lastTime && (Date.now() - lastTime.getTime()) < WITHDRAW_COOLDOWN_MS) {
      const waitSec = Math.ceil((WITHDRAW_COOLDOWN_MS - (Date.now() - lastTime.getTime())) / 1000);
      await safeReply(ctx,
        `⏳ <b>${ru ? 'Подождите немного' : 'Please wait'}</b>\n\n` +
        `${ru ? `До следующего вывода: <b>${waitSec} сек.</b>` : `Next withdrawal in: <b>${waitSec} sec.</b>`}\n` +
        `<i>${ru ? 'Защита от случайных дублей' : 'Duplicate protection'}</i>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `◀️ ${ru ? 'Кошелёк' : 'Wallet'}`, callback_data: 'show_wallet_menu' }],
        ]}}
      );
      return;
    }
    // Сколько выводов ещё осталось — покажем в следующем шаге
  } catch (e: any) { console.error('[CRITICAL] Cooldown check failed:', e.message); }

  if (profile.wallet_address) {
    // Уже привязан — сразу спрашиваем сумму
    pendingWithdrawal.set(userId, { step: 'enter_amount', address: profile.wallet_address });
    await ctx.reply(
      lang === 'ru'
        ? `💸 <b>Вывод TON</b>\n\nКошелёк: <code>${escHtml(profile.wallet_address.slice(0,12))}…</code>\nДоступно: <b>${profile.balance_ton.toFixed(2)} TON</b>\n\nВведите сумму для вывода:`
        : `💸 <b>Withdraw TON</b>\n\nWallet: <code>${escHtml(profile.wallet_address.slice(0,12))}…</code>\nAvailable: <b>${profile.balance_ton.toFixed(2)} TON</b>\n\nEnter amount:`,
      { parse_mode: 'HTML' }
    );
  } else {
    pendingWithdrawal.set(userId, { step: 'enter_address' });
    await ctx.reply(
      lang === 'ru'
        ? `💸 <b>Вывод TON</b>\n\nДоступно: <b>${profile.balance_ton.toFixed(2)} TON</b>\n\nВведите адрес TON кошелька (EQ...):`
        : `💸 <b>Withdraw TON</b>\n\nAvailable: <b>${profile.balance_ton.toFixed(2)} TON</b>\n\nEnter your TON wallet address (EQ...):`,
      { parse_mode: 'HTML' }
    );
  }
});

bot.action('profile_link_wallet', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  await safeReply(ctx,
    lang === 'ru'
      ? '🔗 <b>Привязка кошелька</b>\n\nВыберите способ:'
      : '🔗 <b>Link Wallet</b>\n\nChoose method:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `💎 TON Connect`, callback_data: 'link_wallet_tc' }],
          [{ text: `✏️ ${lang === 'ru' ? 'Ввести адрес вручную' : 'Enter address manually'}`, callback_data: 'link_wallet_manual' }],
        ],
      },
    }
  );
});

bot.action('link_wallet_tc', async (ctx) => {
  await ctx.answerCbQuery();
  await showTonConnect(ctx);
});

bot.action('link_wallet_manual', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  pendingWithdrawal.set(userId, { step: 'enter_address', purpose: 'link' } as any);
  await ctx.reply(
    lang === 'ru'
      ? '🔗 Введите адрес вашего TON кошелька (EQ...) для привязки:'
      : '🔗 Enter your TON wallet address (EQ...) to link:'
  );
});

// ── Глобальные API ключи ──────────────────────────────────────────────
const pendingApiKey = new Map<number, { provider?: string }>();

bot.action('profile_api_keys', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  try {
    const repo = getUserSettingsRepository();
    const allSettings = await repo.getAll(userId);
    const vars = (allSettings.user_variables as Record<string, any>) || {};

    const provider = (vars.AI_PROVIDER as string) || '';
    const apiKey = (vars.AI_API_KEY as string) || '';
    const maskedKey = apiKey ? apiKey.slice(0, 6) + '...' + apiKey.slice(-4) : (lang === 'ru' ? 'не задан' : 'not set');

    let text = `🔑 <b>${lang === 'ru' ? 'Глобальные API ключи' : 'Global API Keys'}</b>\n${div()}\n\n`;
    text += lang === 'ru'
      ? 'Глобальный ключ используется всеми вашими AI агентами по умолчанию.\nКаждый агент может иметь свой ключ (через Настройки AI).\n\n'
      : 'Global key is used by all your AI agents by default.\nEach agent can override with its own key (via AI Settings).\n\n';
    text += `🤖 <b>${lang === 'ru' ? 'Провайдер:' : 'Provider:'}</b> ${escHtml(provider || (lang === 'ru' ? 'не задан' : 'not set'))}\n`;
    text += `🔑 <b>${lang === 'ru' ? 'Ключ:' : 'Key:'}</b> <code>${escHtml(maskedKey)}</code>\n`;

    const kb: any[][] = [
      [
        { text: '🔴 Gemini', callback_data: 'global_provider:gemini' },
        { text: '🟢 OpenAI', callback_data: 'global_provider:openai' },
      ],
      [
        { text: '🟣 Anthropic', callback_data: 'global_provider:anthropic' },
        { text: '🔵 Groq', callback_data: 'global_provider:groq' },
      ],
      [
        { text: '🟠 DeepSeek', callback_data: 'global_provider:deepseek' },
        { text: '🌐 OpenRouter', callback_data: 'global_provider:openrouter' },
      ],
    ];
    if (apiKey) {
      kb.push([{ text: `🗑 ${lang === 'ru' ? 'Удалить ключ' : 'Remove key'}`, callback_data: 'global_key_clear' }]);
    }
    kb.push([{ text: `${peb('back')} ${lang === 'ru' ? 'Профиль' : 'Profile'}`, callback_data: 'show_profile' }]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
  } catch (e: any) {
    await ctx.reply('❌ ' + (e.message || String(e)));
  }
});

bot.action(/^global_provider:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const provider = ctx.match[1];
  const lang = getUserLang(userId);
  try {
    const repo = getUserSettingsRepository();
    const vars = ((await repo.getAll(userId)).user_variables as Record<string, any>) || {};
    vars.AI_PROVIDER = provider;
    await repo.set(userId, 'user_variables', vars);

    // Если ключ ещё не задан — попросить ввести
    if (!vars.AI_API_KEY) {
      pendingApiKey.set(userId, { provider });
      await safeReply(ctx,
        `✅ ${lang === 'ru' ? 'Провайдер:' : 'Provider:'} <b>${escHtml(provider)}</b>\n\n` +
        `${lang === 'ru' ? '🔑 Теперь отправьте API ключ для этого провайдера:' : '🔑 Now send your API key for this provider:'}`,
        { parse_mode: 'HTML' }
      );
    } else {
      await safeReply(ctx, `✅ ${lang === 'ru' ? 'Провайдер изменён на' : 'Provider changed to'} <b>${escHtml(provider)}</b>`, { parse_mode: 'HTML' });
    }
  } catch (e: any) {
    await ctx.reply('❌ ' + (e.message || String(e)));
  }
});

bot.action('global_key_clear', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  try {
    const repo = getUserSettingsRepository();
    const vars = ((await repo.getAll(userId)).user_variables as Record<string, any>) || {};
    delete vars.AI_API_KEY;
    delete vars.AI_PROVIDER;
    await repo.set(userId, 'user_variables', vars);
    await safeReply(ctx, `✅ ${lang === 'ru' ? 'Глобальный API ключ удалён.' : 'Global API key removed.'}`, { parse_mode: 'HTML' });
  } catch (e: any) {
    await ctx.reply('❌ ' + (e.message || String(e)));
  }
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
  await ctx.editMessageText('<i>🤖 Разрабатываю агента...</i>', { parse_mode: 'HTML' }).catch(() => {});
  const anim = await startCreationAnimation(ctx, '', true);
  try {
    const result = await getOrchestrator().processMessage(userId, pna.description, ctx.from.username, undefined);
    anim.stop(); anim.deleteMsg();
    await sendResult(ctx, result);
  } catch (err) {
    anim.stop(); anim.deleteMsg();
    await ctx.reply('❌ Ошибка создания агента. Попробуйте ещё раз.').catch(() => {});
  }
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
// Chat with AI agent
// ============================================================
bot.action(/^agent_chat:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId  = ctx.from.id;
  const agentId = parseInt(ctx.match[1]);
  const lang    = getUserLang(userId);

  // Verify agent belongs to user
  const agentRes = await getDBTools().getAgent(agentId, userId);
  if (!agentRes.success || !agentRes.data) {
    await ctx.reply('❌ Агент не найден');
    return;
  }

  pendingAgentChats.set(userId, agentId);

  const a = agentRes.data;
  const name = a.name || `#${agentId}`;
  const isAI = a.triggerType === 'ai_agent';

  await ctx.reply(
    lang === 'ru'
      ? `💬 <b>Чат с агентом «${escHtml(name)}»</b>\n\n` +
        (isAI
          ? 'Пишите сообщения — агент отвечает мгновенно.'
          : 'AI отвечает от имени агента. Можешь спросить что он делает или попросить <b>улучшить себя</b>.') +
        '\n\nОтправьте /stop_chat чтобы выйти.'
      : `💬 <b>Chat with agent «${escHtml(name)}»</b>\n\n` +
        (isAI
          ? 'Send messages — agent replies instantly.'
          : 'AI responds on behalf of the agent. Ask what it does or request it to <b>improve itself</b>.') +
        '\n\nSend /stop_chat to exit.',
    { parse_mode: 'HTML' }
  );
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
    `⏰ <b>${escHtml(schedLabel)}</b> — принято!\n\n<i>Разрабатываю агента...</i>`,
    { parse_mode: 'HTML' }
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
// Analytics, Tasks, Token Usage, Contacts
// ============================================================

bot.action(/^agent_analytics:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const ownerCheck = await getDBTools().getAgent(agentId, userId);
    if (!ownerCheck.success || !ownerCheck.data) { await ctx.reply('❌'); return; }

    // Pull logs stats
    const logsRes = await dbPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE level = 'error') AS errors,
        COUNT(*) FILTER (WHERE level = 'info') AS info_count,
        COUNT(*) FILTER (WHERE level = 'tool_call') AS tool_calls,
        COUNT(*) AS total,
        MAX(created_at) AS last_active
      FROM builder_bot.agent_logs
      WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    `, [agentId]);
    const s = logsRes.rows[0] || {};

    // Recent errors
    const errRes = await dbPool.query(`
      SELECT message, created_at FROM builder_bot.agent_logs
      WHERE agent_id = $1 AND level = 'error'
      ORDER BY created_at DESC LIMIT 3
    `, [agentId]);

    // Execution history
    const execRes = await dbPool.query(`
      SELECT status, COUNT(*) as cnt FROM builder_bot.execution_history
      WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY status
    `, [agentId]).catch(() => ({ rows: [] }));

    const execMap: Record<string, number> = {};
    for (const row of execRes.rows) execMap[row.status] = parseInt(row.cnt);

    const lastActive = s.last_active ? new Date(s.last_active).toLocaleString('ru-RU', { timeZone: 'UTC' }) : (ru ? 'нет' : 'none');
    let text = ru
      ? `📊 <b>Аналитика агента #${agentId}</b> (7 дней)\n\n`
      : `📊 <b>Agent #${agentId} Analytics</b> (7 days)\n\n`;
    text += `📝 ${ru ? 'Логов' : 'Logs'}: <b>${s.total || 0}</b>\n`;
    text += `🔧 ${ru ? 'Вызовов инструментов' : 'Tool calls'}: <b>${s.tool_calls || 0}</b>\n`;
    text += `❌ ${ru ? 'Ошибок' : 'Errors'}: <b>${s.errors || 0}</b>\n`;
    if (Object.keys(execMap).length > 0) {
      text += `\n⚙️ ${ru ? 'Запуски' : 'Executions'}:\n`;
      for (const [st, cnt] of Object.entries(execMap)) {
        const icon = st === 'success' ? '✅' : st === 'error' ? '❌' : '⏳';
        text += `  ${icon} ${st}: ${cnt}\n`;
      }
    }
    text += `\n🕐 ${ru ? 'Последняя активность' : 'Last active'}: <i>${escHtml(lastActive)}</i>`;
    if (errRes.rows.length > 0) {
      text += `\n\n⚠️ ${ru ? 'Последние ошибки' : 'Recent errors'}:\n`;
      for (const e of errRes.rows) {
        text += `• <code>${escHtml((e.message || '').slice(0, 100))}</code>\n`;
      }
    }

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `◀️ ${ru ? 'Назад' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]
    ]}});
  } catch (e: any) {
    await ctx.reply('❌ ' + e.message);
  }
});

bot.action(/^agent_tasks:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const ownerCheck = await getDBTools().getAgent(agentId, userId);
    if (!ownerCheck.success || !ownerCheck.data) { await ctx.reply('❌'); return; }

    const tasksRes = await dbPool.query(`
      SELECT id, description, status, priority, created_at, scheduled_for
      FROM builder_bot.agent_tasks
      WHERE agent_id = $1
      ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
               priority DESC, created_at DESC
      LIMIT 10
    `, [agentId]).catch(() => ({ rows: [] }));

    const statusIcon: Record<string, string> = { pending: '⏳', in_progress: '🔄', done: '✅', failed: '❌' };

    let text = ru ? `📋 <b>Задачи агента #${agentId}</b>\n\n` : `📋 <b>Agent #${agentId} Tasks</b>\n\n`;
    if (tasksRes.rows.length === 0) {
      text += ru ? '<i>Нет задач</i>' : '<i>No tasks</i>';
    } else {
      for (const t of tasksRes.rows) {
        const icon = statusIcon[t.status] || '•';
        const sched = t.scheduled_for ? ` 🗓 ${new Date(t.scheduled_for).toLocaleDateString('ru-RU')}` : '';
        text += `${icon} ${escHtml((t.description || '').slice(0, 80))}${sched}\n`;
      }
    }

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `◀️ ${ru ? 'Назад' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]
    ]}});
  } catch (e: any) {
    await ctx.reply('❌ ' + e.message);
  }
});

bot.action(/^agent_tokens:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const ownerCheck = await getDBTools().getAgent(agentId, userId);
    if (!ownerCheck.success || !ownerCheck.data) { await ctx.reply('❌'); return; }

    // Try token_usage table, fall back to log count
    const tokenRes = await dbPool.query(`
      SELECT
        COALESCE(SUM(input_tokens), 0) AS total_input,
        COALESCE(SUM(output_tokens), 0) AS total_output,
        COALESCE(SUM(cost_usd), 0) AS total_cost
      FROM builder_bot.agent_token_usage
      WHERE agent_id = $1
    `, [agentId]).catch(() => ({ rows: [{}] }));

    const t = tokenRes.rows[0] || {};
    const totalIn = parseInt(t.total_input || '0');
    const totalOut = parseInt(t.total_output || '0');
    const totalCost = parseFloat(t.total_cost || '0');

    // Daily breakdown (last 7 days)
    const dailyRes = await dbPool.query(`
      SELECT DATE(created_at) AS day,
             COALESCE(SUM(input_tokens), 0) AS inp,
             COALESCE(SUM(output_tokens), 0) AS out,
             COALESCE(SUM(cost_usd), 0) AS cost
      FROM builder_bot.agent_token_usage
      WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1 DESC
    `, [agentId]).catch(() => ({ rows: [] }));

    let text = ru
      ? `🪙 <b>Использование токенов #${agentId}</b>\n\n`
      : `🪙 <b>Token Usage #${agentId}</b>\n\n`;
    text += `📥 ${ru ? 'Входящих' : 'Input'}: <b>${totalIn.toLocaleString()}</b>\n`;
    text += `📤 ${ru ? 'Исходящих' : 'Output'}: <b>${totalOut.toLocaleString()}</b>\n`;
    text += `💵 ${ru ? 'Стоимость' : 'Cost'}: <b>$${totalCost.toFixed(4)}</b>\n`;

    if (dailyRes.rows.length > 0) {
      text += `\n📅 ${ru ? 'По дням' : 'By day'}:\n`;
      for (const d of dailyRes.rows.slice(0, 7)) {
        const day = new Date(d.day).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
        const inp = parseInt(d.inp); const out = parseInt(d.out);
        text += `  ${day}: ${(inp + out).toLocaleString()} tok · $${parseFloat(d.cost).toFixed(4)}\n`;
      }
    } else {
      text += `\n<i>${ru ? 'Нет данных (таблица не создана или токены не отслеживались)' : 'No data yet'}</i>`;
    }

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `◀️ ${ru ? 'Назад' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]
    ]}});
  } catch (e: any) {
    await ctx.reply('❌ ' + e.message);
  }
});

bot.action(/^agent_contacts:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const ru = getUserLang(userId) === 'ru';
  try {
    const ownerCheck = await getDBTools().getAgent(agentId, userId);
    if (!ownerCheck.success || !ownerCheck.data) { await ctx.reply('❌'); return; }

    // Pull from tg_users or agent_state contacts
    const contactsRes = await dbPool.query(`
      SELECT tg_user_id, username, first_name, last_name, message_count, last_seen_at, is_allowed, is_admin
      FROM builder_bot.agent_contacts
      WHERE agent_id = $1
      ORDER BY message_count DESC NULLS LAST
      LIMIT 15
    `, [agentId]).catch(() => ({ rows: [] }));

    let text = ru ? `👥 <b>Контакты агента #${agentId}</b>\n\n` : `👥 <b>Agent #${agentId} Contacts</b>\n\n`;

    if (contactsRes.rows.length === 0) {
      // Fall back: try agent_logs to extract unique user IDs
      const logsRes = await dbPool.query(`
        SELECT DISTINCT context->>'from_user' AS uname, COUNT(*) AS cnt
        FROM builder_bot.agent_logs
        WHERE agent_id = $1 AND context->>'from_user' IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10
      `, [agentId]).catch(() => ({ rows: [] }));

      if (logsRes.rows.length === 0) {
        text += ru ? '<i>Нет данных о контактах</i>' : '<i>No contact data</i>';
      } else {
        for (const r of logsRes.rows) {
          text += `• ${escHtml(r.uname || 'unknown')} — ${r.cnt} ${ru ? 'сообщ' : 'msgs'}\n`;
        }
      }
    } else {
      for (const c of contactsRes.rows) {
        const nameStr = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || String(c.tg_user_id);
        const uname = c.username ? `@${c.username}` : '';
        const badges = [
          c.is_admin ? '🔑' : '',
          c.is_allowed === false ? '🚫' : '',
        ].filter(Boolean).join('');
        text += `${badges}${escHtml(nameStr)} ${escHtml(uname)}\n`;
        text += `  💬 ${c.message_count || 0} ${ru ? 'сообщ' : 'msgs'}`;
        if (c.last_seen_at) text += ` · ${new Date(c.last_seen_at).toLocaleDateString('ru-RU')}`;
        text += '\n';
      }
    }

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `◀️ ${ru ? 'Назад' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]
    ]}});
  } catch (e: any) {
    await ctx.reply('❌ ' + e.message);
  }
});

// ============================================================
// Memory Management UI
// ============================================================

bot.action(/^agent_memory:(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const agentId = parseInt(ctx.match[1]);

  try {
    // Ownership check
    const ownerCheck = await getDBTools().getAgent(agentId, userId);
    if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Агент не найден'); return; }
    await ctx.answerCbQuery();

    const { getMemoryStats, getMemorySettings } = await import('./services/agent-memory');
    const stats = await getMemoryStats(agentId);
    const settings = await getMemorySettings(agentId);

    const sizeKB = (stats.totalSizeBytes / 1024).toFixed(1);
    const cats = stats.categories;

    let text = `🧠 <b>Память агента #${agentId}</b>\n\n`;
    text += `📊 <b>Статистика:</b>\n`;
    text += `  Всего ключей: <b>${stats.totalKeys}</b> (${sizeKB} KB)\n`;
    text += `  💭 Воспоминания: ${cats.memories}\n`;
    text += `  📚 Уроки: ${cats.lessons}\n`;
    text += `  📖 База знаний: ${cats.knowledge}\n`;
    text += `  👤 Контакты: ${cats.contacts}\n`;
    text += `  💬 Досье чатов: ${cats.chatDossiers}\n`;
    text += `  🟢 Engagement: ${cats.engagement}\n`;
    text += `  🧬 Эволюций: ${stats.evolutionCount}\n`;
    text += `  📝 Сессий: ${stats.sessionsCount}\n`;
    text += `  📅 Дневников: ${stats.dailyLogsCount}\n`;
    text += `\n⚙️ <b>Настройки:</b>\n`;
    text += `  Воспоминания: ${settings.enableMemories ? '✅' : '❌'} (макс ${settings.maxMemories})\n`;
    text += `  Уроки: ${settings.enableLessons ? '✅' : '❌'} (макс ${settings.maxLessons})\n`;
    text += `  База знаний: ${settings.enableKnowledge ? '✅' : '❌'} (макс ${settings.maxKnowledge})\n`;
    text += `  Контакты: ${settings.enableContacts ? '✅' : '❌'} (макс ${settings.maxContacts})\n`;
    text += `  Эволюция: ${settings.enableEvolution ? '✅' : '❌'} (каждые ${settings.evolveInterval} взаимодействий)\n`;
    text += `  TTL памяти: ${settings.memoryTTLDays > 0 ? settings.memoryTTLDays + ' дней' : '∞'}\n`;
    text += `  Бюджет контекста: ${settings.maxContextTokens} токенов\n`;
    text += `  Приоритет: ${settings.priorityCategories.join(' → ')}\n`;

    const buttons = [
      [
        { text: '💭 Воспоминания', callback_data: `mem_browse:${agentId}:memories` },
        { text: '📚 Уроки', callback_data: `mem_browse:${agentId}:lessons` },
      ],
      [
        { text: '📖 Знания', callback_data: `mem_browse:${agentId}:knowledge` },
        { text: '👤 Контакты', callback_data: `mem_browse:${agentId}:contacts` },
      ],
      [
        { text: '⚙️ Настройки памяти', callback_data: `mem_settings:${agentId}` },
      ],
      [
        { text: '🗜️ Сжать память', callback_data: `mem_compress:${agentId}` },
        { text: '🧹 Обслуживание', callback_data: `mem_maintain:${agentId}` },
      ],
      [
        { text: '⬅️ Назад', callback_data: `agent_menu:${agentId}` },
      ],
    ];

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
  } catch (e: any) {
    console.error('[Memory UI]', e);
    await safeReply(ctx, 'Ошибка загрузки памяти');
  }
});

bot.action(/^mem_browse:(\d+):(\w+)(?::(\d+))?$/, async (ctx) => {
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const category = ctx.match[2];
  const offset = parseInt(ctx.match[3] || '0');

  const ownerCheck = await getDBTools().getAgent(agentId, ctx.from.id);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    await ctx.answerCbQuery();
    const { browseMemory } = await import('./services/agent-memory');
    const { entries, total } = await browseMemory(agentId, category, offset, 8);

    const catNames: Record<string, string> = {
      memories: '💭 Воспоминания', lessons: '📚 Уроки', knowledge: '📖 База знаний',
      contacts: '👤 Контакты', chatDossiers: '💬 Досье чатов', engagement: '🟢 Engagement',
    };

    let text = `${catNames[category] || category} агента #${agentId}\n`;
    text += `Записей: ${total} (показаны ${offset + 1}-${Math.min(offset + 8, total)})\n\n`;

    for (const entry of entries) {
      text += `🔑 <code>${escHtml(entry.key.slice(0, 40))}</code>\n`;
      text += `   ${escHtml(entry.preview)} (${entry.size}B)\n\n`;
    }

    if (entries.length === 0) text += '<i>Пусто</i>';

    const nav: any[] = [];
    if (offset > 0) nav.push({ text: '⬅️ Назад', callback_data: `mem_browse:${agentId}:${category}:${Math.max(0, offset - 8)}` });
    if (offset + 8 < total) nav.push({ text: '➡️ Далее', callback_data: `mem_browse:${agentId}:${category}:${offset + 8}` });

    const buttons: any[][] = [];
    if (nav.length > 0) buttons.push(nav);
    buttons.push([
      { text: '🗑️ Очистить категорию', callback_data: `mem_clear:${agentId}:${category}` },
    ]);
    buttons.push([{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
  } catch (e: any) {
    console.error('[Memory Browse]', e);
    await safeReply(ctx, 'Ошибка загрузки');
  }
});

bot.action(/^mem_clear:(\d+):(\w+)$/, async (ctx) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const agentId = parseInt(ctx.match[1]);
  const category = ctx.match[2] as any;

  try {
    const ownerCheck = await getDBTools().getAgent(agentId, userId);
    if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }
    const { clearMemoryCategory } = await import('./services/agent-memory');
    const deleted = await clearMemoryCategory(agentId, category);
    await ctx.answerCbQuery(`Удалено ${deleted} записей`);
    // Refresh browse view
    const { browseMemory } = await import('./services/agent-memory');
    const { total } = await browseMemory(agentId, category, 0, 8);
    await editOrReply(ctx, `✅ Категория очищена (${deleted} записей удалено)\n\nОсталось: ${total}`, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }]] },
    });
  } catch (e: any) {
    await safeReply(ctx, 'Ошибка очистки');
  }
});

bot.action(/^mem_compress:(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;

  const ownerCheck = await getDBTools().getAgent(agentId, userId);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    await ctx.answerCbQuery('Сжатие памяти...');
    await editOrReply(ctx, '🗜️ Сжимаю воспоминания...\nЭто может занять 10-20 секунд.');

    // We need an AI client — use the platform fallback
    const { compressMemories } = await import('./services/agent-memory');
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    });
    const result = await compressMemories(agentId, ctx.from.id, client, 'google/gemini-2.5-flash', 'memories');

    let text = '🗜️ Результат сжатия:\n';
    if (result.compressed > 0) {
      text += `✅ ${result.compressed} записей → ${result.consolidated} консолидированных`;
    } else {
      text += 'Недостаточно записей для сжатия (нужно >10)';
    }

    await editOrReply(ctx, text, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }]] },
    });
  } catch (e: any) {
    console.error('[Memory Compress]', e);
    await safeReply(ctx, 'Ошибка сжатия');
  }
});

bot.action(/^mem_maintain:(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;

  const ownerCheck = await getDBTools().getAgent(agentId, userId);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    await ctx.answerCbQuery('Обслуживание...');
    const { runMemoryMaintenance } = await import('./services/agent-memory');
    const result = await runMemoryMaintenance(agentId);

    let text = '🧹 Обслуживание памяти завершено:\n';
    text += `  Удалено по лимиту: ${result.pruned}\n`;
    text += `  Истекло по TTL: ${result.expired}\n`;
    text += `  Старых логов: ${result.logsDeleted}`;

    await editOrReply(ctx, text, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }]] },
    });
  } catch (e: any) {
    await safeReply(ctx, 'Ошибка обслуживания');
  }
});

bot.action(/^mem_settings:(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;

  const ownerCheck = await getDBTools().getAgent(agentId, userId);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    await ctx.answerCbQuery();
    const { getMemorySettings } = await import('./services/agent-memory');
    const s = await getMemorySettings(agentId);

    const toggleBtn = (label: string, key: string, value: boolean) => ({
      text: `${value ? '✅' : '❌'} ${label}`,
      callback_data: `mem_toggle:${agentId}:${key}`,
    });

    const buttons = [
      [toggleBtn('Воспоминания', 'enableMemories', s.enableMemories), toggleBtn('Уроки', 'enableLessons', s.enableLessons)],
      [toggleBtn('База знаний', 'enableKnowledge', s.enableKnowledge), toggleBtn('Контакты', 'enableContacts', s.enableContacts)],
      [toggleBtn('Эволюция', 'enableEvolution', s.enableEvolution), toggleBtn('Досье чатов', 'enableChatDossiers', s.enableChatDossiers)],
      [
        { text: `TTL: ${s.memoryTTLDays || '∞'}д`, callback_data: `mem_set_ttl:${agentId}` },
        { text: `Бюджет: ${s.maxContextTokens}т`, callback_data: `mem_set_budget:${agentId}` },
      ],
      [
        { text: `Макс памяти: ${s.maxMemories}`, callback_data: `mem_set_max:${agentId}:maxMemories` },
        { text: `Макс уроков: ${s.maxLessons}`, callback_data: `mem_set_max:${agentId}:maxLessons` },
      ],
      [{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }],
    ];

    await editOrReply(ctx, '⚙️ <b>Настройки памяти</b>\n\nНажмите на категорию чтобы включить/выключить:', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e: any) {
    await safeReply(ctx, 'Ошибка настроек');
  }
});

bot.action(/^mem_toggle:(\d+):(\w+)$/, async (ctx) => {
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const key = ctx.match[2];
  const userId = ctx.from.id;

  const ownerCheck = await getDBTools().getAgent(agentId, userId);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    const { getMemorySettings, setMemorySettings } = await import('./services/agent-memory');
    const current = await getMemorySettings(agentId);
    const newVal = !(current as any)[key];
    await setMemorySettings(agentId, ctx.from.id, { [key]: newVal } as any);
    await ctx.answerCbQuery(`${key}: ${newVal ? '✅ Вкл' : '❌ Выкл'}`);
    // Re-render settings
    const s = await getMemorySettings(agentId);
    const toggleBtn = (label: string, k: string, value: boolean) => ({
      text: `${value ? '✅' : '❌'} ${label}`,
      callback_data: `mem_toggle:${agentId}:${k}`,
    });
    const buttons = [
      [toggleBtn('Воспоминания', 'enableMemories', s.enableMemories), toggleBtn('Уроки', 'enableLessons', s.enableLessons)],
      [toggleBtn('База знаний', 'enableKnowledge', s.enableKnowledge), toggleBtn('Контакты', 'enableContacts', s.enableContacts)],
      [toggleBtn('Эволюция', 'enableEvolution', s.enableEvolution), toggleBtn('Досье чатов', 'enableChatDossiers', s.enableChatDossiers)],
      [
        { text: `TTL: ${s.memoryTTLDays || '∞'}д`, callback_data: `mem_set_ttl:${agentId}` },
        { text: `Бюджет: ${s.maxContextTokens}т`, callback_data: `mem_set_budget:${agentId}` },
      ],
      [
        { text: `Макс памяти: ${s.maxMemories}`, callback_data: `mem_set_max:${agentId}:maxMemories` },
        { text: `Макс уроков: ${s.maxLessons}`, callback_data: `mem_set_max:${agentId}:maxLessons` },
      ],
      [{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }],
    ];
    await editOrReply(ctx, '⚙️ <b>Настройки памяти</b>\n\nНажмите на категорию чтобы включить/выключить:', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e: any) {
    await safeReply(ctx, 'Ошибка переключения');
  }
});

bot.action(/^mem_set_ttl:(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const ownerCheck = await getDBTools().getAgent(parseInt(ctx.match[1]), ctx.from.id);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }
  await ctx.answerCbQuery();
  await editOrReply(ctx, '⏱️ Введите TTL памяти в днях (0 = бесконечный):', {
    reply_markup: { inline_keyboard: [
      [{ text: '0 (∞)', callback_data: `mem_set_val:${ctx.match[1]}:memoryTTLDays:0` }, { text: '30', callback_data: `mem_set_val:${ctx.match[1]}:memoryTTLDays:30` }],
      [{ text: '60', callback_data: `mem_set_val:${ctx.match[1]}:memoryTTLDays:60` }, { text: '90', callback_data: `mem_set_val:${ctx.match[1]}:memoryTTLDays:90` }],
      [{ text: '⬅️ Назад', callback_data: `mem_settings:${ctx.match[1]}` }],
    ]},
  });
});

bot.action(/^mem_set_budget:(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const ownerCheck = await getDBTools().getAgent(parseInt(ctx.match[1]), ctx.from.id);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }
  await ctx.answerCbQuery();
  await editOrReply(ctx, '📊 Выберите бюджет токенов для памяти в контексте:', {
    reply_markup: { inline_keyboard: [
      [
        { text: '1000', callback_data: `mem_set_val:${ctx.match[1]}:maxContextTokens:1000` },
        { text: '2000', callback_data: `mem_set_val:${ctx.match[1]}:maxContextTokens:2000` },
        { text: '3000', callback_data: `mem_set_val:${ctx.match[1]}:maxContextTokens:3000` },
      ],
      [
        { text: '4000', callback_data: `mem_set_val:${ctx.match[1]}:maxContextTokens:4000` },
        { text: '5000', callback_data: `mem_set_val:${ctx.match[1]}:maxContextTokens:5000` },
      ],
      [{ text: '⬅️ Назад', callback_data: `mem_settings:${ctx.match[1]}` }],
    ]},
  });
});

bot.action(/^mem_set_max:(\d+):(\w+)$/, async (ctx) => {
  if (!ctx.from) return;
  const ownerCheck = await getDBTools().getAgent(parseInt(ctx.match[1]), ctx.from.id);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }
  await ctx.answerCbQuery();
  const field = ctx.match[2];
  const label = field === 'maxMemories' ? 'воспоминаний' : 'уроков';
  await editOrReply(ctx, `📦 Макс. кол-во ${label}:`, {
    reply_markup: { inline_keyboard: [
      [
        { text: '50', callback_data: `mem_set_val:${ctx.match[1]}:${field}:50` },
        { text: '100', callback_data: `mem_set_val:${ctx.match[1]}:${field}:100` },
        { text: '200', callback_data: `mem_set_val:${ctx.match[1]}:${field}:200` },
      ],
      [
        { text: '500', callback_data: `mem_set_val:${ctx.match[1]}:${field}:500` },
        { text: '1000', callback_data: `mem_set_val:${ctx.match[1]}:${field}:1000` },
      ],
      [{ text: '⬅️ Назад', callback_data: `mem_settings:${ctx.match[1]}` }],
    ]},
  });
});

bot.action(/^mem_set_val:(\d+):(\w+):(\d+)$/, async (ctx) => {
  if (!ctx.from) return;
  const agentId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const field = ctx.match[2];
  const value = parseInt(ctx.match[3]);

  const ownerCheck = await getDBTools().getAgent(agentId, userId);
  if (!ownerCheck.success || !ownerCheck.data) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    const { setMemorySettings } = await import('./services/agent-memory');
    await setMemorySettings(agentId, userId, { [field]: value } as any);
    await ctx.answerCbQuery(`${field} = ${value}`);
    // Re-render settings
    const { getMemorySettings } = await import('./services/agent-memory');
    const s = await getMemorySettings(agentId);
    const toggleBtn = (label: string, k: string, v: boolean) => ({
      text: `${v ? '✅' : '❌'} ${label}`,
      callback_data: `mem_toggle:${agentId}:${k}`,
    });
    const buttons = [
      [toggleBtn('Воспоминания', 'enableMemories', s.enableMemories), toggleBtn('Уроки', 'enableLessons', s.enableLessons)],
      [toggleBtn('База знаний', 'enableKnowledge', s.enableKnowledge), toggleBtn('Контакты', 'enableContacts', s.enableContacts)],
      [toggleBtn('Эволюция', 'enableEvolution', s.enableEvolution), toggleBtn('Досье чатов', 'enableChatDossiers', s.enableChatDossiers)],
      [
        { text: `TTL: ${s.memoryTTLDays || '∞'}д`, callback_data: `mem_set_ttl:${agentId}` },
        { text: `Бюджет: ${s.maxContextTokens}т`, callback_data: `mem_set_budget:${agentId}` },
      ],
      [
        { text: `Макс памяти: ${s.maxMemories}`, callback_data: `mem_set_max:${agentId}:maxMemories` },
        { text: `Макс уроков: ${s.maxLessons}`, callback_data: `mem_set_max:${agentId}:maxLessons` },
      ],
      [{ text: '⬅️ К памяти', callback_data: `agent_memory:${agentId}` }],
    ];
    await editOrReply(ctx, '⚙️ <b>Настройки памяти</b>\n\n✅ Настройка сохранена!\nНажмите на категорию чтобы включить/выключить:', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e: any) {
    await safeReply(ctx, 'Ошибка сохранения');
  }
});

// ============================================================
// Callback-кнопки
// ============================================================
bot.on('callback_query', async (ctx) => {
  if (!ctx.from) return;
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

  // ── Plugin Marketplace (pmkt_*) ──
  if (data === 'pmkt_home') {
    await ctx.answerCbQuery();
    const pmLang = getUserLang(userId);
    const allP = await searchPlugins(undefined, undefined, 500);
    let pmText =
      `🔌 <b>${pmLang === 'ru' ? 'Маркетплейс плагинов' : 'Plugin Marketplace'}</b>\n` +
      `📦 ${pmLang === 'ru' ? 'Всего' : 'Total'}: <b>${allP.length}</b>\n\n`;
    const pmCats = [
      { id: 'data-feed', icon: '📡', name: pmLang === 'ru' ? 'Дата-фиды' : 'Data Feeds' },
      { id: 'dex-connector', icon: '🔄', name: 'DEX' },
      { id: 'notification', icon: '🔔', name: pmLang === 'ru' ? 'Уведомления' : 'Notifications' },
      { id: 'analytics', icon: '📊', name: pmLang === 'ru' ? 'Аналитика' : 'Analytics' },
      { id: 'social', icon: '💬', name: pmLang === 'ru' ? 'Социальные' : 'Social' },
      { id: 'utility', icon: '🔧', name: pmLang === 'ru' ? 'Утилиты' : 'Utilities' },
      { id: 'telegram', icon: '✈️', name: 'Telegram' },
      { id: 'defi', icon: '💎', name: 'DeFi' },
      { id: 'nft', icon: '🖼', name: 'NFT' },
    ];
    for (const c of pmCats) {
      const cnt = allP.filter(p => p.category === c.id).length;
      if (cnt > 0) pmText += `${c.icon} <b>${escHtml(c.name)}</b> — ${cnt}\n`;
    }
    const pmBtns: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < pmCats.length; i += 2) {
      const row: Array<{ text: string; callback_data: string }> = [];
      row.push({ text: `${pmCats[i].icon} ${pmCats[i].name}`, callback_data: `pmkt_cat:${pmCats[i].id}` });
      if (pmCats[i + 1]) row.push({ text: `${pmCats[i + 1].icon} ${pmCats[i + 1].name}`, callback_data: `pmkt_cat:${pmCats[i + 1].id}` });
      pmBtns.push(row);
    }
    pmBtns.push([{ text: `📋 ${pmLang === 'ru' ? 'Все плагины' : 'All'}`, callback_data: 'pmkt_all' }]);
    pmBtns.push([
      { text: `📦 ${pmLang === 'ru' ? 'Мои' : 'Mine'}`, callback_data: 'pmkt_my' },
      { text: `💰 ${pmLang === 'ru' ? 'Доход' : 'Revenue'}`, callback_data: 'pmkt_revenue' },
    ]);
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: pmBtns } });
    return;
  }

  if (data === 'pmkt_all') {
    await ctx.answerCbQuery();
    const pmLang = getUserLang(userId);
    const allP = await searchPlugins(undefined, undefined, 30);
    let pmText = `📋 <b>${pmLang === 'ru' ? 'Все плагины' : 'All Plugins'} (${allP.length}):</b>\n\n`;
    for (const p of allP.slice(0, 15)) {
      const pprice = p.priceStars > 0 ? `${p.priceStars} ⭐` : '🆓';
      const prating = p.avgRating > 0 ? ` ${p.avgRating.toFixed(1)}★` : '';
      pmText += `${pprice} <b>${escHtml(p.name)}</b>${prating} — ${p.installs} ${pmLang === 'ru' ? 'уст.' : 'inst.'}\n`;
    }
    if (allP.length === 0) pmText += `<i>${pmLang === 'ru' ? 'Пока нет плагинов.' : 'No plugins yet.'}</i>`;
    const pmBtns = allP.slice(0, 10).map(p => [
      { text: `🔍 ${p.name}`, callback_data: `pmkt_view:${p.id}` },
    ]);
    pmBtns.push([{ text: `◀️ ${pmLang === 'ru' ? 'Назад' : 'Back'}`, callback_data: 'pmkt_home' }]);
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: pmBtns } });
    return;
  }

  if (data.startsWith('pmkt_cat:')) {
    await ctx.answerCbQuery();
    const pmCat = data.split(':')[1];
    const pmLang = getUserLang(userId);
    const pmPlugins = await searchPlugins(undefined, pmCat, 20);
    const pmCatNames: Record<string, string> = {
      'data-feed': '📡 Data Feeds', 'dex-connector': '🔄 DEX', 'notification': '🔔 Notifications',
      'analytics': '📊 Analytics', 'social': '💬 Social', 'utility': '🔧 Utilities',
      'telegram': '✈️ Telegram', 'defi': '💎 DeFi', 'nft': '🖼 NFT',
    };
    const pmCatName = pmCatNames[pmCat] || pmCat;
    let pmText = `${pmCatName}\n<b>${pmLang === 'ru' ? 'Плагины' : 'Plugins'} (${pmPlugins.length}):</b>\n\n`;
    for (const p of pmPlugins.slice(0, 15)) {
      const pprice = p.priceStars > 0 ? `${p.priceStars} ⭐` : '🆓';
      const prating = p.avgRating > 0 ? ` ${p.avgRating.toFixed(1)}★` : '';
      pmText += `${pprice} <b>${escHtml(p.name)}</b>${prating} — ${p.installs} ${pmLang === 'ru' ? 'уст.' : 'inst.'}\n`;
    }
    if (pmPlugins.length === 0) pmText += `<i>${pmLang === 'ru' ? 'Нет плагинов в этой категории.' : 'No plugins in this category.'}</i>`;
    const pmBtns = pmPlugins.slice(0, 10).map(p => [
      { text: `🔍 ${p.name}`, callback_data: `pmkt_view:${p.id}` },
    ]);
    pmBtns.push([{ text: `◀️ ${pmLang === 'ru' ? 'Назад' : 'Back'}`, callback_data: 'pmkt_home' }]);
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: pmBtns } });
    return;
  }

  if (data.startsWith('pmkt_view:')) {
    await ctx.answerCbQuery();
    const pmLid = parseInt(data.split(':')[1]);
    const pmLang = getUserLang(userId);
    const pmP = await getPluginListing(pmLid);
    if (!pmP) { await editOrReply(ctx, '❌ Plugin not found'); return; }
    const pmPrice = pmP.priceStars > 0 ? `${pmP.priceStars} ⭐ (${(pmP.priceStars * 0.01).toFixed(2)} TON)` : (pmLang === 'ru' ? '🆓 Бесплатно' : '🆓 Free');
    const pmRating = pmP.totalRatings > 0 ? `${pmP.avgRating.toFixed(1)}★ (${pmP.totalRatings} ${pmLang === 'ru' ? 'отзывов' : 'reviews'})` : (pmLang === 'ru' ? 'Нет отзывов' : 'No reviews');
    const pmText =
      `🔌 <b>${escHtml(pmP.name)}</b> v${escHtml(pmP.version)}\n\n` +
      `📁 ${pmLang === 'ru' ? 'Категория' : 'Category'}: <b>${escHtml(pmP.category)}</b>\n` +
      `💰 ${pmLang === 'ru' ? 'Цена' : 'Price'}: <b>${pmPrice}</b>\n` +
      `⭐ ${pmLang === 'ru' ? 'Рейтинг' : 'Rating'}: ${pmRating}\n` +
      `📥 ${pmLang === 'ru' ? 'Установок' : 'Installs'}: <b>${pmP.installs}</b>\n\n` +
      `📝 ${escHtml(pmP.description || (pmLang === 'ru' ? 'Без описания' : 'No description'))}\n`;
    const viewBtns: Array<Array<{ text: string; callback_data: string }>> = [
      [{ text: `📥 ${pmLang === 'ru' ? 'Установить' : 'Install'}`, callback_data: `pmkt_install:${pmLid}` }],
      [
        { text: '⭐1', callback_data: `pmkt_rate:${pmLid}:1` },
        { text: '⭐2', callback_data: `pmkt_rate:${pmLid}:2` },
        { text: '⭐3', callback_data: `pmkt_rate:${pmLid}:3` },
        { text: '⭐4', callback_data: `pmkt_rate:${pmLid}:4` },
        { text: '⭐5', callback_data: `pmkt_rate:${pmLid}:5` },
      ],
      [{ text: `◀️ ${pmLang === 'ru' ? 'Назад' : 'Back'}`, callback_data: 'pmkt_home' }],
    ];
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: viewBtns } });
    return;
  }

  if (data.startsWith('pmkt_install:')) {
    const pmLid = parseInt(data.split(':')[1]);
    const pmLang = getUserLang(userId);
    const pmResult = await installPlugin(userId, pmLid);
    if (pmResult.ok) {
      await ctx.answerCbQuery(pmLang === 'ru' ? '✅ Плагин установлен!' : '✅ Plugin installed!');
      const pmP = await getPluginListing(pmLid);
      await editOrReply(ctx,
        `✅ <b>${pmLang === 'ru' ? 'Плагин установлен' : 'Plugin Installed'}</b>\n\n` +
        `🔌 <b>${escHtml(pmP?.name || '#' + pmLid)}</b>\n\n` +
        `${pmLang === 'ru' ? 'Плагин доступен вашим агентам.' : 'Plugin is now available to your agents.'}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `📦 ${pmLang === 'ru' ? 'Мои плагины' : 'My plugins'}`, callback_data: 'pmkt_my' }],
          [{ text: `◀️ ${pmLang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'pmkt_home' }],
        ] } }
      );
    } else {
      await ctx.answerCbQuery(`❌ ${pmResult.error || 'Error'}`, { show_alert: true });
    }
    return;
  }

  if (data.startsWith('pmkt_uninstall:')) {
    const pmLid = parseInt(data.split(':')[1]);
    const pmLang = getUserLang(userId);
    const pmOk = await uninstallPlugin(userId, pmLid);
    await ctx.answerCbQuery(pmOk ? (pmLang === 'ru' ? '✅ Удалено' : '✅ Uninstalled') : '❌ Error');
    const pmMyPlugins = await getMarketplaceUserPlugins(userId);
    let pmText = `📦 <b>${pmLang === 'ru' ? 'Мои плагины' : 'My Plugins'} (${pmMyPlugins.length}):</b>\n\n`;
    if (pmMyPlugins.length === 0) {
      pmText += `<i>${pmLang === 'ru' ? 'Список пуст.' : 'List is empty.'}</i>`;
    } else {
      for (const pp of pmMyPlugins.slice(0, 15)) {
        const pprice = pp.priceStars > 0 ? `${pp.priceStars} ⭐` : '🆓';
        pmText += `${pprice} <b>${escHtml(pp.name)}</b> v${escHtml(pp.version)}\n`;
      }
    }
    const uninstBtns = pmMyPlugins.slice(0, 8).map(pp => [
      { text: `🔍 ${pp.name}`, callback_data: `pmkt_view:${pp.id}` },
      { text: '❌', callback_data: `pmkt_uninstall:${pp.id}` },
    ]);
    uninstBtns.push([{ text: `◀️ ${pmLang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'pmkt_home' }]);
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: uninstBtns } });
    return;
  }

  if (data.startsWith('pmkt_rate:')) {
    const pmParts = data.split(':');
    const pmLid = parseInt(pmParts[1]);
    const pmRatingVal = parseInt(pmParts[2]);
    const pmLang = getUserLang(userId);
    const pmOk = await ratePlugin(userId, pmLid, pmRatingVal);
    if (pmOk) {
      await ctx.answerCbQuery(`${pmLang === 'ru' ? 'Оценка' : 'Rated'}: ${'⭐'.repeat(pmRatingVal)}`);
    } else {
      await ctx.answerCbQuery(pmLang === 'ru' ? '❌ Установите плагин, чтобы оценить' : '❌ Install plugin to rate', { show_alert: true });
    }
    return;
  }

  if (data === 'pmkt_my') {
    await ctx.answerCbQuery();
    const pmLang = getUserLang(userId);
    const pmMyPlugins = await getMarketplaceUserPlugins(userId);
    let pmText = `📦 <b>${pmLang === 'ru' ? 'Мои плагины' : 'My Plugins'} (${pmMyPlugins.length}):</b>\n\n`;
    if (pmMyPlugins.length === 0) {
      pmText += `<i>${pmLang === 'ru' ? 'Нет установленных плагинов.' : 'No installed plugins.'}</i>\n`;
      pmText += `\n${pmLang === 'ru' ? 'Найдите плагины в маркетплейсе!' : 'Find plugins in the marketplace!'}`;
    } else {
      for (const pp of pmMyPlugins.slice(0, 15)) {
        const pprice = pp.priceStars > 0 ? `${pp.priceStars} ⭐` : '🆓';
        pmText += `${pprice} <b>${escHtml(pp.name)}</b> v${escHtml(pp.version)}\n`;
        pmText += `   <i>${escHtml((pp.description || '').slice(0, 50))}</i>\n\n`;
      }
    }
    const myBtns = pmMyPlugins.slice(0, 8).map(pp => [
      { text: `🔍 ${pp.name}`, callback_data: `pmkt_view:${pp.id}` },
      { text: '❌', callback_data: `pmkt_uninstall:${pp.id}` },
    ]);
    myBtns.push([{ text: `◀️ ${pmLang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'pmkt_home' }]);
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: myBtns } });
    return;
  }

  if (data === 'pmkt_revenue') {
    await ctx.answerCbQuery();
    const pmLang = getUserLang(userId);
    const pmRevenue = await getCreatorRevenue(userId);
    const pmListings = await getCreatorListings(userId);
    let pmText =
      `💰 <b>${pmLang === 'ru' ? 'Доход от плагинов' : 'Plugin Revenue'}</b>\n\n` +
      `${pmLang === 'ru' ? 'Заработано' : 'Earned'}: <b>${pmRevenue.totalEarned} ⭐</b>\n` +
      `${pmLang === 'ru' ? 'Установок' : 'Installs'}: <b>${pmRevenue.totalInstalls}</b>\n` +
      `${pmLang === 'ru' ? 'Комиссия' : 'Fee'}: 15%\n\n`;
    if (pmListings.length > 0) {
      pmText += `📋 <b>${pmLang === 'ru' ? 'Ваши плагины' : 'Your plugins'}:</b>\n`;
      for (const l of pmListings.slice(0, 8)) {
        const lprice = l.priceStars > 0 ? `${l.priceStars} ⭐` : (pmLang === 'ru' ? 'Бесплатно' : 'Free');
        pmText += `• <b>${escHtml(l.name)}</b> — ${lprice} — ${l.installs} ${pmLang === 'ru' ? 'уст.' : 'inst.'}\n`;
      }
    }
    const revBtns = [
      [{ text: `◀️ ${pmLang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'pmkt_home' }],
    ];
    await editOrReply(ctx, pmText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: revBtns } });
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
    const aName = escHtml(agentResult.data.name || `Агент #${agentId}`);
    await editOrReply(ctx,
      `${pe('outbox')} <b>Публикация: ${aName}</b>\n\nВыберите цену:`,
      {
        parse_mode: 'HTML',
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
      `${pe('outbox')} <b>Подтверждение публикации</b>\n\n` +
      `${pe('robot')} Агент: <b>${escHtml(aName)}</b>\n` +
      `${pe('coin')} Цена: <b>${escHtml(priceStr)}</b>\n` +
      `${pe('clipboard')} Название листинга: <i>${escHtml(aName)}</i>\n\n` +
      `Покупатели смогут <b>запускать</b> агента, но не увидят ваш код.`,
      {
        parse_mode: 'HTML',
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
      `✏️ <b>Введите название листинга</b>\n\n` +
      `Напишите название агента для маркетплейса (до 60 символов):`,
      {
        parse_mode: 'HTML',
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
        `${pe('outbox')} <b>Мои листинги</b>\n\nВы ещё ничего не публиковали.`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `${peb('outbox')} Опубликовать`, callback_data: 'mkt_publish_help' }, { text: `${peb('back')} Маркетплейс`, callback_data: 'marketplace' }]] } }
      );
      return;
    }
    let text = `${pe('outbox')} <b>Мои листинги (${listings.length}):</b>\n\n`;
    listings.forEach((l: any) => {
      const status = l.isActive ? peb('check') : '❌';
      const price = l.isFree ? 'Бесплатно' : (l.price / 1e9).toFixed(2) + ' TON';
      text += `${status} #${l.id} <b>${escHtml(l.name)}</b> — ${escHtml(price)} — ${l.totalSales} продаж\n`;
    });
    await editOrReply(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [{ text: `${peb('outbox')} Опубликовать ещё`, callback_data: 'mkt_publish_help' }],
        [{ text: `${peb('back')} Маркетплейс`, callback_data: 'marketplace' }],
      ]},
    });
    return;
  }
  if (data === 'mkt_mypurchases') {
    await ctx.answerCbQuery();
    const purchases = await getMarketplaceRepository().getMyPurchases(userId).catch(() => []);
    if (!purchases.length) {
      await editOrReply(ctx,
        `🛒 <b>Мои покупки</b>\n\nПокупок пока нет.`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '👥 Сообщество', callback_data: 'mkt_community' }, { text: `${peb('back')} Маркетплейс`, callback_data: 'marketplace' }]] } }
      );
      return;
    }
    let text = `🛒 <b>Мои покупки (${purchases.length}):</b>\n\n`;
    purchases.slice(0, 10).forEach((p: any) => {
      const type = p.type === 'free' ? '🆓' : p.type === 'rent' ? '📅' : '💰';
      text += `${type} Листинг #${p.listingId} → агент #${p.agentId}\n`;
    });
    const btns = purchases.slice(0, 8).map((p: any) => [
      { text: `▶️ Агент #${p.agentId}`, callback_data: `run_agent:${p.agentId}` }
    ]);
    btns.push([{ text: `${peb('back')} Маркетплейс`, callback_data: 'marketplace' }]);
    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
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

  // ── Clarification callback (wizard) ──
  if (data.startsWith('clarify:')) {
    await ctx.answerCbQuery();
    const answer = decodeURIComponent(data);
    const result = await getOrchestrator().processMessage(userId, answer, ctx.from?.username);
    await sendResult(ctx, result);
    return;
  }

  // ── Role management ──
  if (data.startsWith('set_role:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const ru = getUserLang(userId) === 'ru';
    const roles = [
      { id: 'worker', name: ru ? 'Исполнитель' : 'Worker', desc: ru ? 'Быстрый исполнитель задач' : 'Fast task executor' },
      { id: 'specialist', name: ru ? 'Эксперт' : 'Specialist', desc: ru ? 'Глубокий анализ и экспертиза' : 'Deep analysis & expertise' },
      { id: 'manager', name: ru ? 'Менеджер' : 'Manager', desc: ru ? 'Координация команды агентов' : 'Agent team coordination' },
      { id: 'director', name: ru ? 'Директор' : 'Director', desc: ru ? 'Стратегия + управление людьми' : 'Strategy + human management' },
      { id: 'monitor', name: ru ? 'Наблюдатель' : 'Monitor', desc: ru ? 'Мониторинг и алерты' : 'Monitoring & alerts' },
      { id: 'creative', name: ru ? 'Креатив' : 'Creative', desc: ru ? 'Контент и SMM' : 'Content & social media' },
      { id: 'trader', name: ru ? 'Трейдер' : 'Trader', desc: ru ? 'Торговля и P&L' : 'Trading & P&L' },
      { id: 'admin', name: ru ? 'Админ чата' : 'Chat Admin', desc: ru ? 'Модерация, антиспам, правила' : 'Moderation, anti-spam, rules' },
    ];
    const descText = roles.map(r => `<b>${r.name}</b> — ${r.desc}`).join('\n');
    const roleButtons = [];
    for (let i = 0; i < roles.length; i += 3) {
      roleButtons.push(roles.slice(i, i + 3).map(r => ({ text: r.name, callback_data: `role_set:${agentId}:${r.id}` })));
    }
    roleButtons.push([{ text: `${peb('back')} ${ru ? 'Назад' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]);
    await editOrReply(ctx,
      `${ru ? 'Выберите роль для агента' : 'Choose role for agent'} #${agentId}\n\n${descText}`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: roleButtons },
      }
    );
    return;
  }
  if (data.startsWith('role_set:')) {
    await ctx.answerCbQuery();
    const parts = data.split(':');
    const agentId = parseInt(parts[1]);
    const role = parts[2];
    try {
      await dbPool.query('UPDATE builder_bot.agents SET role = $1 WHERE id = $2 AND user_id = $3', [role, agentId, userId]);
      const roleLabels: Record<string, string> = { worker: 'WRK', specialist: 'EXP', manager: 'MGR', director: 'DIR', monitor: 'MON', creative: 'CRT', trader: 'TRD', admin: 'ADM' };
      const rl = roleLabels[role] || role.toUpperCase();
      await editOrReply(ctx, `[${rl}] Роль агента #${agentId} обновлена на <b>${role}</b>`, { parse_mode: 'HTML' });
    } catch (e: any) {
      await editOrReply(ctx, `❌ Ошибка: ${escHtml(e.message)}`, { parse_mode: 'HTML' });
    }
    return;
  }

  // ── Task callbacks (Director → human) ──
  if (data.startsWith('task_accept:') || data.startsWith('task_reject:')) {
    await ctx.answerCbQuery();
    const taskId = parseInt(data.split(':')[1]);
    const status = data.startsWith('task_accept') ? 'accepted' : 'rejected';
    try {
      const { getAgentTasksRepository } = await import('./db/schema-extensions');
      await getAgentTasksRepository().updateStatus(taskId, status);
      await editOrReply(ctx, status === 'accepted' ? '✅ Задача принята!' : '❌ Задача отклонена.', {});
    } catch (e: any) {
      await editOrReply(ctx, `Ошибка: ${e.message}`, {});
    }
    return;
  }
  if (data.startsWith('task_discuss:')) {
    await ctx.answerCbQuery();
    await safeReply(ctx, '💬 Напишите ответ к задаче. Он будет передан агенту.', {});
    return;
  }

  // ── Approval action callbacks (approve_action:ID / reject_action:ID) ──
  if (data.startsWith('approve_action:') || data.startsWith('reject_action:')) {
    await ctx.answerCbQuery();
    const approvalId = parseInt(data.split(':')[1]);
    const isApprove = data.startsWith('approve_action');
    try {
      const { getAgentApprovalsRepository } = await import('./db/schema-extensions');
      const row = await getAgentApprovalsRepository().resolve(approvalId, isApprove ? 'approved' : 'rejected');
      if (!row) {
        await editOrReply(ctx, `Запрос #${approvalId} не найден или уже обработан.`, {});
      } else {
        const emoji = isApprove ? '✅' : '❌';
        const verb = isApprove ? 'одобрено' : 'отклонено';
        await editOrReply(ctx, `${emoji} Действие #${approvalId} ${verb} (${escHtml(row.action_type)}).`, { parse_mode: 'HTML' });
        // Wake up the waiting agent tool
        try {
          const { resolveApprovalWaiter } = await import('./agents/ai-agent-runtime');
          resolveApprovalWaiter(approvalId, isApprove ? 'approved' : 'rejected');
        } catch (e: any) { console.warn('[Approval] resolve error:', e.message); }
      }
    } catch (e: any) {
      await editOrReply(ctx, `Ошибка: ${escHtml(e.message)}`, { parse_mode: 'HTML' });
    }
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
      '💸 <b>Отправить TON</b>\n\nФормат:\n<code>/send АДРЕС СУММА [комментарий]</code>\n\nПример:\n<code>/send EQD...abc 10 Оплата услуг</code>\n\n<i>Транзакцию нужно подтвердить в Tonkeeper</i>',
      { parse_mode: 'HTML' }
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
    let txt = `${pe('clipboard')} <b>История транзакций</b>\n\n`;
    txs.forEach((tx: any, i: number) => {
      const date = new Date(tx.time * 1000).toLocaleDateString('ru-RU');
      const dir = tx.isOutgoing ? '⬆️' : '⬇️';
      const counterpart = tx.isOutgoing
        ? (tx.to ? tx.to.slice(0, 8) + '...' : '?')
        : (tx.from ? tx.from.slice(0, 8) + '...' : '?');
      txt += `${i + 1}. ${escHtml(date)} ${dir} <b>${escHtml(tx.amount)}</b> TON`;
      txt += ` <i>${escHtml(tx.isOutgoing ? 'to' : 'from')} ${escHtml(counterpart)}</i>`;
      if (tx.comment) txt += `\n   💬 <i>${escHtml(tx.comment.slice(0, 30))}</i>`;
      txt += '\n';
    });
    await safeReply(ctx, txt, { parse_mode: 'HTML' });
    return;
  }
  if (data === 'ton_disconnect') {
    await ctx.answerCbQuery('Отключаю...');
    await getTonConnectManager().disconnect(userId);
    // Clear wallet from profile (syncs with studio)
    try {
      const settingsRepo = getUserSettingsRepository();
      const profile = (await settingsRepo.get(userId, 'profile')) || {};
      if (profile.connected_via === 'tonconnect') {
        delete profile.wallet_address;
        delete profile.wallet_name;
        delete profile.connected_via;
        delete profile.wallet_connected_at;
        await settingsRepo.set(userId, 'profile', profile);
      }
    } catch (e: any) { console.warn('[TonConnect] disconnect cleanup:', e.message); }
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
      `⚠️ Мнемоника сохранена на сервере. Просмотр — в Studio.\n\n` +
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
      await ctx.reply(`${pe('wallet')} <b>Баланс агента: ${escHtml(bal.toFixed(4))} TON</b>\nАдрес: <code>${escHtml(w.address)}</code>`, { parse_mode: 'HTML' });
    }
    return;
  }
  if (data === 'wallet_send') {
    await ctx.answerCbQuery();
    await ctx.reply('Используйте: <code>/send_agent АДРЕС СУММА</code>\nПример: <code>/send_agent EQD... 1.5</code>', { parse_mode: 'HTML' });
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
    await ctx.answerCbQuery('⏳');
    try {
      const settingsRepo = getUserSettingsRepository();
      const current = await settingsRepo.get(userId, 'installed_plugins').catch(() => null);
      const list: string[] = safeParsePluginList(current as string);
      if (!list.includes(pid)) list.push(pid);
      await settingsRepo.set(userId, 'installed_plugins', JSON.stringify(list));
      getPluginManager().installPlugin(pid);
      const plugin = getPluginManager().getPlugin(pid);
      const ru = getUserLang(userId) === 'ru';
      await safeReply(ctx,
        `${pe('check')} <b>${escHtml(plugin?.name || pid)}</b> — ${ru ? 'активирован!' : 'activated!'}\n\n` +
        `${pe('brain')} ${ru ? '<b>Что даёт этот плагин агентам:</b>' : '<b>What this gives agents:</b>'}\n` +
        `• ${ru ? 'AI-агенты получают точный синтаксис API' : 'AI agents get exact API syntax'}\n` +
        `• ${ru ? 'Форматы ответов и примеры вызовов инжектируются в контекст' : 'Response formats and call examples injected into context'}\n` +
        `• ${ru ? 'Все агенты, созданные после этого, будут использовать плагин' : 'All agents created after this will use the plugin'}\n\n` +
        `${pe('rocket')} <i>${ru ? 'Создай агента — он автоматически получит эти возможности' : 'Create an agent — it will have these capabilities automatically'}</i>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `✏️ ${ru ? 'Создать агента' : 'Create agent'}`, callback_data: 'create_agent_prompt' }],
          [{ text: `◀️ ${ru ? 'К плагинам' : 'Plugins'}`, callback_data: 'plugins' }],
        ]}}
      );
    } catch (e: any) { await safeReply(ctx, `❌ ${e.message || 'error'}`); }
    return;
  }
  if (data.startsWith('plugin_uninstall:')) {
    const pid = data.split(':')[1];
    await ctx.answerCbQuery();
    try {
      const settingsRepo = getUserSettingsRepository();
      const current = await settingsRepo.get(userId, 'installed_plugins').catch(() => null);
      const list: string[] = safeParsePluginList(current as string);
      const updated = list.filter(id => id !== pid);
      await settingsRepo.set(userId, 'installed_plugins', JSON.stringify(updated));
      getPluginManager().uninstallPlugin(pid);
      const ru = getUserLang(userId) === 'ru';
      await ctx.reply(ru ? `✅ Плагин удалён` : `✅ Plugin removed`, {
        reply_markup: { inline_keyboard: [[{ text: `◀️ ${ru ? 'К плагинам' : 'Plugins'}`, callback_data: 'plugins' }]] }
      });
    } catch (e: any) { await safeReply(ctx, `❌ ${e.message || 'error'}`); }
    return;
  }

  // ── Workflow ──
  if (data === 'workflow' || data === 'workflows_menu') { await ctx.answerCbQuery(); await showWorkflows(ctx, userId); return; }
  if (data.startsWith('workflow_template:')) {
    await ctx.answerCbQuery();
    const tplKey = data.slice('workflow_template:'.length);
    const tplIdx = _resolveWorkflowTemplateIndex(tplKey);
    if (tplIdx < 0) { await safeReply(ctx, '❌ Шаблон не найден'); return; }
    await showWorkflowTemplate(ctx, tplIdx);
    return;
  }
  if (data.startsWith('workflow_create_from:')) {
    await ctx.answerCbQuery('Создаю workflow...');
    const tplKey = data.slice('workflow_create_from:'.length);
    const tplIdx = _resolveWorkflowTemplateIndex(tplKey);
    if (tplIdx < 0) { await safeReply(ctx, '❌ Шаблон не найден'); return; }
    await createWorkflowFromTemplate(ctx, userId, tplIdx);
    return;
  }
  if (data === 'workflow_create') {
    await ctx.answerCbQuery();
    const engine = getWorkflowEngine();
    const templates = engine.getWorkflowTemplates();
    const btns = templates.map((t, i) => [{ text: `📋 ${t.name}`, callback_data: `workflow_template:${_workflowTemplateKey(t, i)}` }]);
    btns.push([{ text: '◀️ Назад', callback_data: 'workflow' }]);
    await ctx.reply(`${pe('bolt')} <b>Создание Workflow</b>\n\nВыберите шаблон:`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: btns },
    });
    return;
  }
  if (data === 'workflow_describe') {
    await ctx.answerCbQuery();
    await safeReply(ctx,
      `${pe('robot')} <b>AI Workflow Builder</b>\n\n` +
      `Опишите что должен делать ваш workflow — AI сам соединит ваших агентов.\n\n` +
      `<b>Примеры:</b>\n` +
      `<i>"Каждый час проверяй баланс, если &lt; 5 TON — отправь уведомление"</i>\n` +
      `<i>"Получай цену TON, сравни с вчерашней, если выросла — твитни"</i>\n` +
      `<i>"Мониторь несколько кошельков параллельно и собери сводку"</i>\n\n` +
      `${pe('finger')} Напишите описание вашего workflow:`,
      { ...MAIN_MENU, parse_mode: 'HTML' }
    );
    // Ставим режим ожидания workflow_describe
    await getMemoryManager().setWaitingForInput(userId, 'workflow_describe', {});
    return;
  }

  // ── Skip name: пропустить ввод названия и создать с авто-именем ──
  if (data === 'skip_name') {
    await ctx.answerCbQuery();
    const pna = pendingNameAsk.get(userId);
    if (pna) {
      pendingNameAsk.delete(userId);
      await ctx.reply('🤖 <i>Разрабатываю агента...</i>', { parse_mode: 'HTML' }).catch(() => {});
      const anim = await startCreationAnimation(ctx, '', true);
      try {
        const result = await getOrchestrator().processMessage(userId, pna.description, ctx.from?.username);
        anim.stop(); anim.deleteMsg();
        await sendResult(ctx, result);
      } catch (err) {
        anim.stop(); anim.deleteMsg();
        await ctx.reply('❌ Ошибка создания агента. Попробуйте ещё раз.').catch(() => {});
      }
    }
    return;
  }

  // ── Агент: быстрые действия ──
  if (data === 'create_agent_prompt' || data === 'create_agent') {
    await ctx.answerCbQuery();
    await safeReply(ctx,
      `${pe('sparkles')} <b>Создание AI-агента</b>\n` +
      `${div()}\n` +
      `${pe('robot')} <i>Автономный AI с 20+ инструментами: TON, NFT, подарки, веб</i>\n\n` +
      `<b>💡 Примеры:</b>\n` +
      `🎁 <i>"арбитраж подарков — сканируй каждые 5 мин, уведоми если прибыль 15%+"</i>\n` +
      `📊 <i>"мониторь floor NFT: Punks, Diamonds — сводка каждый час"</i>\n` +
      `🐋 <i>"whale alert: следи за кошельком UQ..., уведоми если движение 500+ TON"</i>\n` +
      `🌐 <i>"парси крипто-новости с coindesk каждые 30 мин"</i>\n` +
      `🔍 <i>"отслеживай цену TON, уведоми при пробитии $5"</i>\n` +
      `${div()}\n` +
      `🎤 <i>Можно голосовым!</i>\n\n` +
      `${pe('finger')} <b>Опишите задачу:</b>`,
      { ...MAIN_MENU, parse_mode: 'HTML' }
    );
    return;
  }
  if (data === 'list_agents') { await ctx.answerCbQuery(); await showAgentsList(ctx, userId); return; }
  if (data === 'help') { await ctx.answerCbQuery(); await showHelp(ctx); return; }
  if (data === 'examples') {
    await ctx.answerCbQuery();
    await ctx.reply(`${pe('clipboard')} <b>Примеры агентов:</b>`, {
      parse_mode: 'HTML',
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

  // ── 🎯 Goals display ──
  if (data.startsWith('show_goals:')) {
    await ctx.answerCbQuery('🎯');
    const agentId = parseInt(data.split(':')[1]);
    try {
      const stateRepo = getAgentStateRepository();
      const goalsRaw = await stateRepo.get(agentId, '_goals').catch(() => null);
      let goals: Array<{ goal: string; priority: string; status: string; addedAt?: string }> = [];
      try {
        const gv = goalsRaw !== null ? (typeof goalsRaw === 'string' ? JSON.parse(goalsRaw) : goalsRaw) : [];
        if (Array.isArray(gv)) goals = gv;
      } catch { goals = []; }

      const active = goals.filter(g => g.status === 'active');
      const completed = goals.filter(g => g.status === 'completed');

      let text = `🎯 <b>Цели агента #${agentId}</b>\n\n`;
      if (active.length > 0) {
        text += `<b>Активные (${active.length}):</b>\n`;
        for (const g of active) {
          const pIcon = g.priority === 'high' ? '🔴' : g.priority === 'low' ? '⚪' : '🟡';
          text += `${pIcon} ${escHtml(g.goal)}\n`;
        }
      }
      if (completed.length > 0) {
        text += `\n<b>Выполненные (${completed.length}):</b>\n`;
        for (const g of completed.slice(-5)) {
          text += `✅ ${escHtml(g.goal)}\n`;
        }
      }
      if (goals.length === 0) text += '<i>Агент ещё не сформировал цели. Они появятся после нескольких тиков.</i>';

      // Lessons too
      const allKeys = await stateRepo.listKeys(agentId);
      const lessonKeys = allKeys.filter((k: string) => k.startsWith('lesson:')).sort().slice(-10);
      if (lessonKeys.length > 0) {
        text += `\n\n📚 <b>Уроки (${lessonKeys.length}):</b>\n`;
        for (const key of lessonKeys.slice(-5)) {
          const raw = await stateRepo.get(agentId, key).catch(() => null);
          if (!raw?.text) continue;
          const icon = raw.category === 'error' ? '❌' : raw.category === 'success' ? '✅' : '💡';
          text += `${icon} ${escHtml((raw.text || '').slice(0, 120))}\n`;
        }
      }

      await editOrReply(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }]] },
      });
    } catch (e: any) { await ctx.reply('❌ Ошибка: ' + (e.message || '').slice(0, 100)); }
    return;
  }

  // ── 🧠 Memory display ──
  if (data.startsWith('show_memory:')) {
    await ctx.answerCbQuery('🧠');
    const agentId = parseInt(data.split(':')[1]);
    try {
      const stateRepo = getAgentStateRepository();
      const allKeys = await stateRepo.listKeys(agentId);
      const memKeys = allKeys.filter((k: string) => k.startsWith('mem:'));

      const categoryIcons: Record<string, string> = { contact: '👤', fact: '📌', preference: '⚙️', task: '📋', insight: '💡' };
      const categories: Record<string, string[]> = {};

      for (const key of memKeys.slice(-30)) {
        const raw = await stateRepo.get(agentId, key).catch(() => null);
        if (!raw) continue;
        const cleanKey = key.replace('mem:', '');
        const cat = (raw as any).category || 'fact';
        const val = (raw as any).value || (typeof raw === 'string' ? raw : JSON.stringify(raw));
        const imp = (raw as any).importance === 'high' ? ' ❗' : '';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(`${escHtml(cleanKey)}: ${escHtml((val + '').slice(0, 100))}${imp}`);
      }

      let text = `🧠 <b>Память агента #${agentId}</b>\n\n`;
      if (Object.keys(categories).length > 0) {
        for (const [cat, entries] of Object.entries(categories)) {
          const icon = categoryIcons[cat] || '📝';
          text += `${icon} <b>${cat.toUpperCase()}</b>:\n`;
          for (const e of entries) text += `  • ${e}\n`;
          text += '\n';
        }
      } else {
        text += '<i>Память пуста. Агент начнёт запоминать после общения.</i>';
      }

      // Prompt additions
      const addRaw = await stateRepo.get(agentId, '_prompt_additions').catch(() => null);
      if (addRaw !== null && addRaw !== undefined) {
        try {
          const adds: string[] = Array.isArray(addRaw) ? addRaw : (typeof addRaw === 'string' ? JSON.parse(addRaw) : []);
          if (adds.length > 0) {
            text += `\n🔧 <b>Доп. инструкции (${adds.length}):</b>\n`;
            for (const a of adds.slice(-5)) text += `  → ${escHtml(a.slice(0, 100))}\n`;
          }
        } catch {}
      }

      text += `\n<i>Всего записей: ${memKeys.length}</i>`;

      await editOrReply(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }]] },
      });
    } catch (e: any) { await ctx.reply('❌ Ошибка: ' + (e.message || '').slice(0, 100)); }
    return;
  }

  // ── 📡 Events display ──
  if (data.startsWith('show_events:')) {
    await ctx.answerCbQuery('📡');
    const agentId = parseInt(data.split(':')[1]);
    try {
      const { getEventBus } = require('./agents/event-bus');
      const bus = getEventBus();
      const subs = bus.getSubscriptions(agentId);
      const wake = bus.getWakeInfo(agentId);

      let text = `📡 <b>События агента #${agentId}</b>\n\n`;

      if (wake) {
        const wakeDate = new Date(wake.wakeAt);
        const remaining = Math.max(0, Math.round((wake.wakeAt - Date.now()) / 1000));
        text += `⏰ <b>Следующее пробуждение:</b>\n`;
        text += `  ${escHtml(wakeDate.toISOString().slice(0, 19).replace('T', ' '))} UTC\n`;
        text += `  Через: ${remaining}с\n`;
        text += `  Причина: <i>${escHtml(wake.reason)}</i>\n\n`;
      }

      if (subs.length > 0) {
        text += `📡 <b>Подписки (${subs.length}):</b>\n`;
        for (const s of subs) {
          text += `  • ${escHtml(s.eventType)}`;
          if (s.filter) text += ` <code>${escHtml(JSON.stringify(s.filter).slice(0, 80))}</code>`;
          text += '\n';
        }
      }

      if (!wake && subs.length === 0) {
        text += '<i>Нет активных подписок и таймеров.\nАгент может подписаться на события через subscribe_event и запланировать пробуждение через set_next_wake.</i>';
      }

      const stats = bus.getStats();
      text += `\n📊 <i>Всего: ${stats.totalSubscriptions} подписок, ${stats.activeWakeTimers} таймеров</i>`;

      await editOrReply(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }]] },
      });
    } catch (e: any) { await ctx.reply('❌ Ошибка: ' + (e.message || '').slice(0, 100)); }
    return;
  }

  // ── Запустить / остановить агента (прямой запуск без оркестратора) ──
  if (data.startsWith('run_agent:')) {
    await ctx.answerCbQuery('Запускаю...');
    const agentId = parseInt(data.split(':')[1]);
    await runAgentDirect(ctx, agentId, userId);
    return;
  }

  // ── Остановить агента (из нотификации) ──
  if (data.startsWith('stop_agent:')) {
    await ctx.answerCbQuery('Останавливаю...');
    const agentId = parseInt(data.split(':')[1]);
    try {
      const agentResult = await getDBTools().getAgent(agentId, userId);
      if (!agentResult.success || !agentResult.data) {
        await ctx.reply(`❌ Агент #${agentId} не найден`);
        return;
      }
      const pauseResult = await getRunnerAgent().pauseAgent(agentId, userId);
      if (pauseResult.success) {
        await editOrReply(ctx,
          `⏸ <b>Агент остановлен</b>\n${div()}\n<b>${escHtml(agentResult.data.name)}</b>  #${agentId}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 Запустить снова', callback_data: `run_agent:${agentId}` }],
                [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
              ],
            },
          }
        );
      } else {
        await editOrReply(ctx, `❌ Ошибка остановки: ${escHtml(pauseResult.error || '')}`, { parse_mode: 'HTML' });
      }
    } catch (e: any) {
      await ctx.reply(`❌ Ошибка: ${(e.message || '').slice(0, 100)}`);
    }
    return;
  }

  // ── Проверка оплаты маркетплейса ──
  if (data.startsWith('mkt_check_pay:')) {
    await ctx.answerCbQuery('Проверяю оплату...');
    const listingId = parseInt(data.split(':')[1]);
    try {
      const listing = await getMarketplaceRepository().getListing(listingId);
      if (!listing) { await ctx.reply('❌ Листинг не найден'); return; }
      const priceTon = listing.price / 1e9;

      await ctx.reply('🔍 Проверяю транзакцию...');
      const verify = await verifyTonTransaction(userId, priceTon);

      if (verify.found && verify.txHash) {
        // Payment confirmed — create agent copy for buyer
        const agentResult = await getDBTools().getAgent(listing.agentId, listing.sellerId);
        if (!agentResult.success || !agentResult.data) { await ctx.reply('❌ Агент продавца не найден'); return; }
        const src = agentResult.data;
        const newAgent = await getDBTools().createAgent({
          userId,
          name: listing.name,
          description: `[Маркетплейс #${listingId}] ${src.description || ''}`,
          code: src.code,
          triggerType: src.triggerType as any,
          triggerConfig: (src.triggerConfig as any) || {},
          isActive: false,
        });
        if (newAgent.success && newAgent.data) {
          await getMarketplaceRepository().createPurchase({
            listingId, buyerId: userId, sellerId: listing.sellerId,
            agentId: newAgent.data.id, type: 'buy', pricePaid: listing.price, txHash: verify.txHash,
          });
          await editOrReply(ctx,
            `${pe('check')} <b>Оплата подтверждена!</b>\n${div()}\n` +
            `${pe('robot')} <b>${escHtml(listing.name)}</b>  #${newAgent.data.id}\n\n` +
            `<i>Агент добавлен — можете запустить</i>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: `${peb('rocket')} Запустить`, callback_data: `run_agent:${newAgent.data.id}` }, { text: `👁 Просмотр`, callback_data: `agent_menu:${newAgent.data.id}` }],
                  [{ text: `${peb('robot')} Мои агенты`, callback_data: 'list_agents' }],
                ],
              },
            }
          );
        } else {
          await ctx.reply(`❌ Ошибка создания агента: ${escHtml(newAgent.error || '')}`);
        }
      } else {
        await safeReply(ctx,
          `⏳ Транзакция ещё не найдена.\n\n` +
          `Убедитесь что отправили <b>${escHtml(priceTon.toFixed(2))} TON</b>\n\n` +
          `Попробуйте снова через 1-2 минуты.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Проверить снова', callback_data: `mkt_check_pay:${listingId}` }],
                [{ text: '◀️ К листингу', callback_data: `mkt_view:${listingId}` }],
              ],
            },
          }
        );
      }
    } catch (e: any) {
      await ctx.reply(`❌ Ошибка проверки: ${(e.message || '').slice(0, 100)}`);
    }
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
      `${pe('wrench')} <b>AI Автопочинка</b>\n\n🔍 Анализирую ошибку...\n<code>▓▓░░░</code> 40%`,
      { parse_mode: 'HTML' }
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
        `${pe('wrench')} <b>AI нашёл исправление!</b>\n` +
        `${div()}\n` +
        `❌ <i>${escHtml(lastErr.error.slice(0, 80))}</i>\n\n` +
        `${pe('check')} <b>${escHtml(changes.slice(0, 180))}</b>\n\n` +
        `🚀 Применить исправление?`,
        {
          parse_mode: 'HTML',
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

    await savePromptVersion(agentId, userId);
    const updateResult = await getDBTools().updateAgentCode(agentId, userId, fixedCode);
    if (!updateResult.success) { await ctx.reply(`❌ Не удалось обновить код: ${updateResult.error}`); return; }

    pendingRepairs.delete(`${userId}:${agentId}`);
    agentLastErrors.delete(agentId); // Сбрасываем ошибку

    await safeReply(ctx,
      `${pe('check')} <b>Автопочинка завершена!</b>\n` +
      `${div()}\n` +
      `🔧 Ошибка исправлена AI\n` +
      `${pe('bolt')} <i>Запустите агента чтобы проверить</i>`,
      {
        parse_mode: 'HTML',
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
      await ctx.reply(`📄 Код агента #${agentId}${lbl}:\n<pre><code class="language-javascript">${escHtml(chunks[i])}</code></pre>`, { parse_mode: 'HTML' });
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
      `🔍 <b>Аудит — Агент #${escHtml(String(agentId))}</b>\n` +
      `${div()}\n` +
      `${scoreIcon} <b>Безопасность: ${escHtml(String(score))}/100</b>\n` +
      `📄 ${escHtml(String(lines))} строк · ${hasAsync ? '✅ async' : '▶️ sync'} · ${hasTryCatch ? '✅ try/catch' : '⚠️ без try/catch'}\n`;

    if (features.length > 0) {
      text += `\n<b>Использует:</b>\n`;
      features.forEach(f => { text += `  ${f}\n`; });
    }
    if (issues.length > 0) {
      text += `\n⚠️ <b>Обнаружено:</b>\n`;
      issues.forEach(i => { text += `  ⚠️ ${escHtml(i)}\n`; });
    } else {
      text += `\n${pe('check')} <i>Опасных паттернов не обнаружено</i>\n`;
    }
    text += `\n<i>Статический анализ — мгновенно, без AI</i>`;

    await safeReply(ctx, text, { parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👁 Код', callback_data: `show_code:${agentId}` }, { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
        ],
      },
    });
    return;
  }

  // ── Кошелёк агента (авто-созданный) ──
  if (data.startsWith('agent_wallet:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const ru = getUserLang(userId) === 'ru';
    try {
      const stateRows = await getAgentStateRepository().getAll(agentId);
      const stateMap = Object.fromEntries(stateRows.map(r => [r.key, r.value]));
      const address  = stateMap['wallet_address'] as string | undefined;
      const mnemonic = stateMap['wallet_mnemonic'] as string | undefined;

      // Check if agent has an agentic sub-wallet
      let agenticWallet: any = null;
      try {
        const { getAgenticWalletService } = await import('./services/agentic-wallet');
        agenticWallet = await getAgenticWalletService().getAgentWallet(agentId);
      } catch {}

      // ── Кошелька НЕТ — показать выбор ──
      if (!address && !agenticWallet) {
        const agentData = await getDBTools().getAgent(agentId, userId);
        const agentName = escHtml(agentData.data?.name || `#${agentId}`);

        // Check if user has a root agentic wallet
        let hasRoot = false;
        try {
          const { getAgenticWalletService } = await import('./services/agentic-wallet');
          const root = await getAgenticWalletService().getRootWallet(userId);
          hasRoot = !!root;
        } catch {}

        const text =
          `💼 <b>${ru ? 'Кошелёк агента' : 'Agent Wallet'} "${agentName}"</b>\n` +
          `${div()}\n\n` +
          (ru
            ? `У этого агента нет кошелька. Выберите вариант:\n\n` +
              `<b>🔐 Agentic Wallet (рекомендуется)</b>\n` +
              `Привязка к общему Root Wallet. Один кошелёк для всех агентов.\n` +
              `• Дневной лимит трат (по умолчанию 10 TON)\n` +
              `• Блокировка одной кнопкой\n` +
              `• Общий баланс — пополнять один раз\n` +
              `• Видимость всех транзакций в Dashboard\n\n` +
              `<b>💎 Отдельный кошелёк</b>\n` +
              `Создаёт новый V4R2 кошелёк только для этого агента.\n` +
              `• Свой адрес + seed-фраза\n` +
              `• Полностью изолированный баланс\n` +
              `• Пополнять отдельно\n` +
              `• Подходит если хотите разделить средства`
            : `This agent has no wallet. Choose an option:\n\n` +
              `<b>🔐 Agentic Wallet (recommended)</b>\n` +
              `Link to shared Root Wallet. One wallet for all agents.\n` +
              `• Daily spend limit (default 10 TON)\n` +
              `• Block with one tap\n` +
              `• Shared balance — top up once\n` +
              `• All transactions visible in Dashboard\n\n` +
              `<b>💎 Separate Wallet</b>\n` +
              `Creates a new V4R2 wallet just for this agent.\n` +
              `• Own address + seed phrase\n` +
              `• Fully isolated balance\n` +
              `• Top up separately\n` +
              `• Best for separating funds`);

        const kb: any[][] = [];
        if (hasRoot) {
          kb.push([{ text: `🔐 ${ru ? 'Agentic Wallet (общий)' : 'Agentic Wallet (shared)'}`, callback_data: `aw_deploy_for:${agentId}` }]);
        } else {
          kb.push([{ text: `🔐 ${ru ? 'Создать Root + привязать' : 'Create Root + link'}`, callback_data: `aw_setup_root_then:${agentId}` }]);
        }
        kb.push([{ text: `💎 ${ru ? 'Отдельный кошелёк' : 'Separate Wallet'}`, callback_data: `aw_create_solo:${agentId}` }]);
        kb.push([{ text: `◀️ ${ru ? 'К агенту' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]);

        await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        return;
      }

      // ── Кошелёк ЕСТЬ — показать детали ──
      let displayAddress = address || '';
      let walletType = ru ? 'Отдельный' : 'Separate';
      let agenticLine = '';
      let spendLimit = '';

      if (agenticWallet) {
        displayAddress = agenticWallet.address || displayAddress;
        walletType = 'Agentic Sub-Wallet';
        agenticLine = `\n🔐 <b>Agentic:</b> ${agenticWallet.isBlocked ? '🔴 ' + (ru ? 'Заблокирован' : 'Blocked') : '🟢 ' + (ru ? 'Активен' : 'Active')}`;
        spendLimit = `\n📊 ${ru ? 'Лимит' : 'Limit'}: <b>${agenticWallet.spendLimitTon || 10} TON</b>/${ru ? 'день' : 'day'}`;
      }

      if (!displayAddress && address) displayAddress = address;

      // Баланс через TONAPI
      let balanceTon = 0;
      if (displayAddress) {
        try {
          const apiKey = process.env.TONAPI_KEY || '';
          const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(displayAddress)}`,
            { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} });
          const j = await r.json() as any;
          if (j.balance !== undefined) balanceTon = Number(j.balance) / 1e9;
        } catch (_) {}
      }

      const agentData = await getDBTools().getAgent(agentId, userId);
      const agentName = escHtml(agentData.data?.name || `#${agentId}`);
      const balStr = balanceTon > 0 ? `${balanceTon.toFixed(4)} TON` : (ru ? '0 TON (пусто)' : '0 TON (empty)');
      const deepLink = `ton://transfer/${displayAddress}?text=${encodeURIComponent('agent:' + agentId)}`;

      const text =
        `💼 <b>${ru ? 'Кошелёк агента' : 'Agent Wallet'} "${agentName}"</b>\n` +
        `${div()}\n` +
        `📦 ${ru ? 'Тип' : 'Type'}: <b>${walletType}</b>${agenticLine}${spendLimit}\n\n` +
        `${ru ? 'Адрес' : 'Address'}:\n<code>${escHtml(displayAddress)}</code>\n\n` +
        `💰 ${ru ? 'Баланс' : 'Balance'}: <b>${escHtml(balStr)}</b>\n` +
        `${div()}\n` +
        `📥 ${ru ? 'Пополнение:' : 'Deposit:'}\n` +
        `${ru ? 'Отправьте TON на адрес выше. Агент сможет самостоятельно совершать транзакции.' : 'Send TON to the address above. The agent can execute transactions autonomously.'}\n\n` +
        (mnemonic
          ? `🔐 <b>${ru ? 'Seed-фраза:' : 'Seed phrase:'}</b>\n<tg-spoiler>${escHtml(mnemonic)}</tg-spoiler>\n⚠️ ${ru ? 'Никому не передавай!' : 'Never share!'}\n`
          : '');

      const kb: any[][] = [];
      kb.push([{ text: `💎 ${ru ? 'Открыть в TON-кошельке' : 'Open in TON Wallet'}`, url: deepLink }]);
      kb.push([{ text: `🔄 ${ru ? 'Обновить' : 'Refresh'}`, callback_data: `agent_wallet:${agentId}` }]);
      if (agenticWallet) {
        kb.push([{
          text: agenticWallet.isBlocked
            ? `🟢 ${ru ? 'Разблокировать' : 'Unblock'}`
            : `🔴 ${ru ? 'Заблокировать' : 'Block'}`,
          callback_data: `aw_toggle_block:${agenticWallet.id}:${agentId}`,
        }]);
      }
      kb.push([{ text: `◀️ ${ru ? 'К агенту' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]);

      await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    } catch (e) {
      await ctx.reply('❌ ' + String(e));
    }
    return;
  }

  // ── Create solo wallet for agent ──
  if (data.startsWith('aw_create_solo:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const ru = getUserLang(userId) === 'ru';
    try {
      const { generateAgentWallet } = await import('./services/TonConnect');
      const wallet = await generateAgentWallet();
      const agentStateRepo = getAgentStateRepository();
      await agentStateRepo.set(agentId, userId, 'wallet_address', wallet.address);
      await agentStateRepo.set(agentId, userId, 'wallet_mnemonic', wallet.mnemonic);
      // Also inject into agent's trigger_config for AI tools
      const tcRow = await dbPool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1 AND user_id=$2', [agentId, userId]);
      if (tcRow.rows[0]) {
        const tc = tcRow.rows[0].trigger_config || {};
        tc.config = tc.config || {};
        tc.config.WALLET_ADDRESS = wallet.address;
        tc.config.WALLET_MNEMONIC = wallet.mnemonic;
        await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), agentId]);
      }
      await safeReply(ctx, `✅ ${ru ? 'Кошелёк создан!' : 'Wallet created!'}\n\n<code>${escHtml(wallet.address)}</code>`, { parse_mode: 'HTML' });
      // Show wallet details
      await showAgentMenu(ctx, agentId, userId);
    } catch (e) {
      await ctx.reply('❌ ' + String(e));
    }
    return;
  }

  // ── Deploy agentic sub-wallet for agent ──
  if (data.startsWith('aw_deploy_for:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const ru = getUserLang(userId) === 'ru';
    try {
      const { getAgenticWalletService } = await import('./services/agentic-wallet');
      const agentData = await getDBTools().getAgent(agentId, userId);
      const label = agentData.data?.name || `Agent #${agentId}`;
      const result = await getAgenticWalletService().deploySubWallet(userId, agentId, label);
      if (result.success && result.wallet) {
        // Also inject wallet address into agent config
        const tcRow = await dbPool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1 AND user_id=$2', [agentId, userId]);
        if (tcRow.rows[0]) {
          const tc = tcRow.rows[0].trigger_config || {};
          tc.config = tc.config || {};
          tc.config.WALLET_ADDRESS = result.wallet.address;
          await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), agentId]);
        }
        await safeReply(ctx, `✅ ${ru ? 'Agentic Wallet привязан!' : 'Agentic Wallet linked!'}\n\n<code>${escHtml(result.wallet.address)}</code>\n📊 ${ru ? 'Лимит' : 'Limit'}: ${result.wallet.spendLimitTon} TON/${ru ? 'день' : 'day'}`, { parse_mode: 'HTML' });
        await showAgentMenu(ctx, agentId, userId);
      } else {
        await ctx.reply('❌ ' + (result.error || 'Deploy failed'));
      }
    } catch (e) {
      await ctx.reply('❌ ' + String(e));
    }
    return;
  }

  // ── Setup root wallet then deploy for agent ──
  if (data.startsWith('aw_setup_root_then:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const ru = getUserLang(userId) === 'ru';
    try {
      const { getAgenticWalletService } = await import('./services/agentic-wallet');
      // Create root wallet first
      const rootResult = await getAgenticWalletService().setupRootWallet(userId);
      if (!rootResult.success) {
        await ctx.reply(`❌ ${ru ? 'Ошибка создания Root Wallet' : 'Root Wallet creation failed'}: ${rootResult.error || 'unknown'}`);
        return;
      }
      // Then deploy sub-wallet for agent
      const agentData = await getDBTools().getAgent(agentId, userId);
      const label = agentData.data?.name || `Agent #${agentId}`;
      const subResult = await getAgenticWalletService().deploySubWallet(userId, agentId, label);
      if (subResult.success && subResult.wallet) {
        // Inject wallet address into agent config
        const tcRow = await dbPool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1 AND user_id=$2', [agentId, userId]);
        if (tcRow.rows[0]) {
          const tc = tcRow.rows[0].trigger_config || {};
          tc.config = tc.config || {};
          tc.config.WALLET_ADDRESS = subResult.wallet.address;
          await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), agentId]);
        }
        await safeReply(ctx,
          `✅ ${ru ? 'Root Wallet + Sub-Wallet созданы!' : 'Root Wallet + Sub-Wallet created!'}\n\n` +
          `🔐 Root: <code>${escHtml(rootResult.wallet?.address || '?')}</code>\n` +
          `💼 Agent: <code>${escHtml(subResult.wallet.address)}</code>\n` +
          `📊 ${ru ? 'Лимит' : 'Limit'}: ${subResult.wallet.spendLimitTon} TON/${ru ? 'день' : 'day'}`,
          { parse_mode: 'HTML' });
        await showAgentMenu(ctx, agentId, userId);
      } else {
        await ctx.reply('❌ Sub-wallet: ' + (subResult.error || 'Deploy failed'));
      }
    } catch (e) {
      await ctx.reply('❌ ' + String(e));
    }
    return;
  }

  // ── Toggle block agentic wallet ──
  if (data.startsWith('aw_toggle_block:')) {
    await ctx.answerCbQuery();
    const parts = data.split(':');
    const walletId = parseInt(parts[1]);
    const agentId = parseInt(parts[2]);
    const ru = getUserLang(userId) === 'ru';
    try {
      const { getAgenticWalletService } = await import('./services/agentic-wallet');
      const wallet = await getAgenticWalletService().getWalletById(walletId);
      if (!wallet) { await ctx.reply('❌ Wallet not found'); return; }
      const newBlocked = !wallet.isBlocked;
      await getAgenticWalletService().setBlocked(walletId, userId, newBlocked);
      await safeReply(ctx, newBlocked
        ? `🔴 ${ru ? 'Кошелёк заблокирован' : 'Wallet blocked'}`
        : `🟢 ${ru ? 'Кошелёк разблокирован' : 'Wallet unblocked'}`);
    } catch (e) {
      await ctx.reply('❌ ' + String(e));
    }
    return;
  }

  // ── Редактировать агента ──
  if (data.startsWith('edit_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    clearAllPendingStates(userId);
    pendingEdits.set(userId, agentId); // Запоминаем агента для модификации
    const agentData = await getDBTools().getAgent(agentId, userId);
    const agentName = agentData.data?.name || `#${agentId}`;
    await editOrReply(ctx,
      `✏️ <b>Изменить агента</b>\n` +
      `${div()}\n` +
      `<b>${escHtml(agentName)}</b>  #${escHtml(String(agentId))}\n\n` +
      `Опишите что нужно изменить:\n` +
      `<i>"Измени интервал на каждые 30 минут"</i>\n` +
      `<i>"Добавь отправку уведомления при ошибке"</i>\n` +
      `<i>"Смени адрес кошелька на EQ..."</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: `agent_menu:${agentId}` }]] },
      }
    );
    return;
  }

  // ── Переименовать агента ──
  if (data.startsWith('rename_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    clearAllPendingStates(userId);
    pendingRenames.set(userId, agentId);
    await editOrReply(ctx,
      `🏷 <b>Переименование агента #${agentId}</b>\n\nВведите новое название (до 60 символов):`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: `agent_menu:${agentId}` }]] },
      }
    );
    return;
  }

  // ── tglogin: menu (re-show auth method picker) ─────────────────
  if (data === 'tglogin_menu' || data === 'tg_login_start') {
    await ctx.answerCbQuery();
    const lang = getUserLang(userId);
    const ru = lang === 'ru';
    await editOrReply(ctx,
      `🔐 <b>${ru ? 'Авторизация Telegram' : 'Telegram Authorization'}</b>\n\n` +
      (ru ? 'Выберите способ авторизации:' : 'Choose authorization method:'),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🔳 QR-код (рекомендуется)', callback_data: 'tglogin_qr' }],
        [{ text: '📞 OTP по номеру телефона', callback_data: 'tglogin_phone' }],
        [{ text: '❌ Отмена', callback_data: 'tglogin_cancel' }],
      ] } }
    );
    return;
  }

  // ── tglogin: cancel ──────────────────────────────────────────────
  if (data === 'tglogin_cancel') {
    await ctx.answerCbQuery('Отменено');
    pendingTgAuth.delete(userId);
    clearAuthState(userId);
    cancelQRLogin();
    complete2FAFns.delete(userId);
    // cleanup legacy polling handle if any
    const h = qrPollingHandles.get(userId);
    if (h) { clearInterval(h); qrPollingHandles.delete(userId); }
    await editOrReply(ctx, '❌ Авторизация отменена.', { parse_mode: 'HTML' });
    return;
  }

  // ── tglogin: choose OTP phone method ─────────────────────────────
  if (data === 'tglogin_phone') {
    await ctx.answerCbQuery();
    pendingTgAuth.set(userId, 'phone');
    await editOrReply(ctx,
      '📞 <b>Авторизация через номер телефона</b>\n\n' +
      'Введи номер в формате: <code>+79991234567</code>\n\n' +
      '⚠️ Telegram может заблокировать если вводишь код с этого же аккаунта.\n\n' +
      '<i>Для отмены:</i> <code>/cancel</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // ── tglogin: start QR code login (event-based, no polling) ──────
  if (data === 'tglogin_qr') {
    await ctx.answerCbQuery();
    await editOrReply(ctx, '🔳 Генерирую QR-код...', { parse_mode: 'HTML' });

    pendingTgAuth.set(userId, 'qr_waiting');

    // Callback fires each time a new QR is ready (first call + every ~25s refresh)
    authStartQR(
      async (qrUrl: string, expiresIn: number) => {
        if (!['qr_waiting'].includes(pendingTgAuth.get(userId) ?? '')) return; // user cancelled or moved to password step
        const qrImageUrl =
          'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=' +
          encodeURIComponent(qrUrl);
        const caption =
          '🔳 <b>Сканируй QR-код</b>\n\n' +
          '📱 Открой <b>Telegram</b> на другом устройстве (телефон/планшет)\n' +
          '⚙️ Настройки → <b>Устройства</b> → <b>Подключить устройство</b>\n' +
          '📷 Наведи камеру на QR-код\n\n' +
          `⏱ Действителен ~${expiresIn} сек\n\n` +
          '<i>Ожидаю подтверждения... /cancel для отмены</i>';
        try {
          await bot.telegram.sendPhoto(userId, qrImageUrl, { caption, parse_mode: 'HTML' });
        } catch {
          await bot.telegram.sendMessage(userId,
            '🔳 <b>Ссылка для входа:</b>\n\n' +
            `<code>${escHtml(qrUrl)}</code>\n\n` +
            'Или: Telegram → Настройки → Устройства → Подключить → используй код выше',
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
      },
      // ── on2FARequired: user scanned QR but has cloud password ──
      (complete2FA: Complete2FAFn) => {
        pendingTgAuth.set(userId, 'qr_password');
        complete2FAFns.set(userId, complete2FA);
        bot.telegram.sendMessage(userId,
          '🔐 <b>Требуется пароль облачного хранилища</b>\n\n' +
          'Ты отсканировал QR, но на аккаунте стоит 2FA.\n\n' +
          'Введи пароль двухфакторной авторизации Telegram:\n\n' +
          '<i>/cancel для отмены</i>',
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    ).then((result: { ok: boolean; error?: string }) => {
      // Called when auth is complete (success, cancel, or timeout)
      // Note: if 2FA was triggered, this resolves AFTER CheckPassword completes
      complete2FAFns.delete(userId);
      if (['qr_waiting', 'qr_password'].includes(pendingTgAuth.get(userId) ?? '')) {
        pendingTgAuth.delete(userId);
      }
      if (result.ok) {
        bot.telegram.sendMessage(userId,
          '🎉 <b>Авторизован успешно!</b>\n\n' +
          '✅ Теперь доступны реальные данные Fragment:\n' +
          '• <code>/gifts</code> — топ подарков с floor ценами\n' +
          '• AI-агенты могут покупать/продавать подарки',
          { parse_mode: 'HTML' }
        ).catch(() => {});
        // Continue setup wizard if active
        const setupQR = pendingAgentSetup.get(userId);
        if (setupQR) {
          setupQR.tgAuthed = true;
          setupQR.currentStep++;
          setTimeout(() => {
            const fakeCtx = { reply: (t: string, o?: any) => bot.telegram.sendMessage(userId, t, o), from: { id: userId }, chat: { id: userId }, sendChatAction: () => Promise.resolve() } as any;
            showSetupStep(fakeCtx, userId).catch(() => {});
          }, 1500);
        }
      } else if (result.error === 'timeout') {
        bot.telegram.sendMessage(userId,
          '⏰ Время ожидания истекло. Введи /tglogin для новой попытки.',
          { parse_mode: 'HTML' }
        ).catch(() => {});
      } else if (result.error && result.error !== 'cancelled') {
        bot.telegram.sendMessage(userId,
          `❌ Ошибка авторизации: ${escHtml(result.error)}\n\nПопробуй /tglogin заново.`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }).catch(e => console.warn('[Bot] QR auth error:', e?.message || e));

    return;
  }

  // ── Template variable wizard: skip optional var ──
  if (data.startsWith('tmpl_skip_var:')) {
    await ctx.answerCbQuery();
    const templateId = data.split(':').slice(1).join(':');
    const state = pendingTemplateSetup.get(userId);
    if (!state) { await editOrReply(ctx, '❌ Сессия настройки истекла. Начните заново.', { parse_mode: 'HTML' }); return; }
    // Advance to next variable
    state.remaining.shift();
    await promptNextTemplateVar(ctx, userId, state);
    return;
  }

  // ── Template variable wizard: option selected (for placeholders with options[]) ──
  if (data.startsWith('tmpl_option:')) {
    await ctx.answerCbQuery();
    const value = decodeURIComponent(data.slice('tmpl_option:'.length));
    const state = pendingTemplateSetup.get(userId);
    if (!state) { await editOrReply(ctx, '❌ Сессия настройки истекла. Начните заново.', { parse_mode: 'HTML' }); return; }
    state.collected[state.remaining[0]] = value;
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
      `${pe('sparkles')} <b>Создание AI-агента</b>\n\nОпишите что должен делать агент — AI сам разберётся.\n\n<i>Примеры:</i>\n🎁 <i>"сканируй арбитраж подарков, уведоми при прибыли 15%+"</i>\n📊 <i>"мониторь floor NFT коллекций раз в час"</i>\n🐋 <i>"whale alert: следи за крупными переводами на UQ..."</i>\n🌐 <i>"парси крипто-новости, дайджест каждые 30 мин"</i>\n\n🎤 <i>Или отправь голосовое!</i>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // ── Клонировать агента ──
  if (data.startsWith('clone_agent:')) {
    await ctx.answerCbQuery('Клонирую...');
    const agentId = parseInt(data.split(':')[1]);
    try {
      const src = await getDBTools().getAgent(agentId, userId);
      if (!src.data) { await safeReply(ctx, '❌ Агент не найден'); return; }
      const a = src.data;
      const cloneName = `${a.name || 'Agent'} (clone)`.slice(0, 100);
      const result = await getDBTools().createAgent({
        userId,
        name: cloneName,
        description: (a as any).description || '',
        triggerType: ((a as any).triggerType || 'ai_agent') as 'manual' | 'scheduled' | 'webhook' | 'event' | 'ai_agent',
        code: (a as any).code || '',
        triggerConfig: (a as any).triggerConfig || {},
      });
      const newAgentId = (result.data as any)?.agentId || (result.data as any)?.id;
      if (newAgentId) {
        // Copy state (memories, lessons, goals) from source agent
        try {
          const states = await getAgentStateRepository().getAll(agentId);
          for (const s of states) {
            if (s.key === 'wallet_address' || s.key === 'wallet_mnemonic') continue; // don't copy wallet
            if (s.key === '_conversation_history') continue; // fresh history
            await getAgentStateRepository().set(newAgentId, userId, s.key, s.value);
          }
        } catch (e: any) { console.warn('[Clone] state copy error:', e.message); }
        await safeReply(ctx, `✅ Агент клонирован!\n\n📋 ${escHtml(cloneName)} #${newAgentId}\n\nВсе настройки, память и уроки скопированы.\nКошелёк создастся новый при первом запуске.`);
      } else {
        await safeReply(ctx, '❌ Ошибка клонирования');
      }
    } catch (e: any) {
      await safeReply(ctx, `❌ Ошибка: ${e.message}`);
    }
    return;
  }

  // ── История промптов (версии кода) ──
  if (data.startsWith('prompt_history:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    try {
      const stateRepo = getAgentStateRepository();
      const versionsRaw = await stateRepo.get(agentId, '_code_versions').catch(() => null);
      let versions: Array<{ code: string; savedAt: string }> = [];
      try { const vv = versionsRaw !== null ? (typeof versionsRaw === 'string' ? JSON.parse(versionsRaw) : versionsRaw) : []; if (Array.isArray(vv)) versions = vv; } catch { versions = []; }
      if (!versions.length) {
        await editOrReply(ctx,
          `📜 <b>История промптов</b> #${agentId}\n\nИстория пуста. Версии сохраняются при каждом изменении кода/промпта.`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }]] } }
        );
        return;
      }
      const lang = getUserLang(userId);
      const ru = lang === 'ru';
      const lines = versions.slice(-5).reverse().map((v, i) => {
        const d = new Date(v.savedAt);
        const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const preview = (v.code || '').replace(/\n/g, ' ').slice(0, 80);
        return `<b>${i + 1}.</b> ${dateStr}\n<code>${escHtml(preview)}...</code>`;
      });
      const keyboard: any[][] = versions.slice(-5).reverse().map((_, i) => [
        { text: `🔄 ${ru ? 'Восстановить' : 'Restore'} #${i + 1}`, callback_data: `restore_version:${agentId}:${versions.length - 1 - i}` },
      ]);
      keyboard.push([{ text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }]);
      await editOrReply(ctx,
        `📜 <b>${ru ? 'История промптов' : 'Prompt History'}</b> #${agentId}\n\n${lines.join('\n\n')}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
      );
    } catch (e: any) {
      await safeReply(ctx, `❌ Ошибка: ${e.message}`);
    }
    return;
  }

  // ── Восстановить версию промпта ──
  if (data.startsWith('restore_version:')) {
    const parts = data.split(':');
    const agentId = parseInt(parts[1]);
    const versionIdx = parseInt(parts[2]);
    try {
      const stateRepo = getAgentStateRepository();
      const versionsRaw = await stateRepo.get(agentId, '_code_versions').catch(() => null);
      let versions: Array<{ code: string; savedAt: string }> = [];
      try { const vv = versionsRaw !== null ? (typeof versionsRaw === 'string' ? JSON.parse(versionsRaw) : versionsRaw) : []; if (Array.isArray(vv)) versions = vv; } catch { versions = []; }
      if (versionIdx < 0 || versionIdx >= versions.length) {
        await ctx.answerCbQuery('Версия не найдена');
        return;
      }
      const version = versions[versionIdx];
      // Save current code as a new version before restoring
      await savePromptVersion(agentId, userId);
      const updateResult = await getDBTools().updateAgentCode(agentId, userId, version.code);
      if (updateResult.success) {
        await ctx.answerCbQuery('✅ Восстановлено!');
        const d = new Date(version.savedAt);
        await safeReply(ctx,
          `✅ Промпт восстановлен из версии от ${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}\n\nЗапустите агента чтобы проверить.`,
          { reply_markup: { inline_keyboard: [[
            { text: '🚀 Запустить', callback_data: `run_agent:${agentId}` },
            { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` },
          ]] } }
        );
      } else {
        await ctx.answerCbQuery('❌ Ошибка');
        await safeReply(ctx, `❌ Не удалось восстановить: ${updateResult.error}`);
      }
    } catch (e: any) {
      await ctx.answerCbQuery('❌ Ошибка');
      await safeReply(ctx, `❌ Ошибка: ${e.message}`);
    }
    return;
  }

  // ── Удалить агента: шаг 1 — диалог подтверждения ──
  if (data.startsWith('delete_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    const agentName = escHtml(agentResult.data?.name || `#${agentId}`);
    const isActive = agentResult.data?.isActive;
    await ctx.reply(
      `🗑 <b>Удалить агента?</b>\n\n` +
      `<b>${agentName}</b> #${agentId}\n` +
      (isActive ? `⚠️ Агент сейчас <i>активен</i> — он будет остановлен.\n` : '') +
      `\nЭто действие нельзя отменить.`,
      {
        parse_mode: 'HTML',
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
    await getRunnerAgent().pauseAgent(agentId, userId).catch(e => console.warn('[Bot] pauseAgent on delete:', e?.message || e));
    const result = await getDBTools().deleteAgent(agentId, userId);
    await ctx.reply(result.success ? `🗑 Агент #${agentId} удалён` : `❌ Ошибка: ${result.error}`);
    if (result.success) {
      // Clean up bot-level Maps that reference deleted agentId
      pendingRepairs.delete(`${userId}:${agentId}`);
      if (pendingAgentChats.get(userId) === agentId) pendingAgentChats.delete(userId);
      // TODO: also clean _pendingMessages, _webRequestCounts in ai-agent-runtime.ts
      // (they have their own periodic cleanup, but explicit removal on delete would be cleaner)
      await showAgentsList(ctx, userId);
    }
    return;
  }
  if (data === 'cancel_delete') { await ctx.answerCbQuery('Отменено ✓'); return; }

  // ── Настройки платформы ──
  if (data === 'platform_settings') {
    await ctx.answerCbQuery();
    const isOwner = isPlatformAdmin(userId);
    if (!isOwner) { await ctx.reply('⛔ Только для владельца'); return; }
    await ctx.reply(
      `⚙️ <b>Настройки платформы</b>\n\n` +
      `• Модель: <code>${escHtml(process.env.CLAUDE_MODEL || 'gemini-2.5-flash')}</code>\n` +
      `• AI URL: <code>${escHtml(process.env.OPENAI_BASE_URL || 'Gemini API')}</code>\n` +
      `• Безопасность: ${process.env.ENABLE_SECURITY_SCAN === 'false' ? '❌' : '✅'}\n` +
      `• TON API Key: ${process.env.TONAPI_KEY ? '✅ настроен' : '⚠️ не настроен'}`,
      { parse_mode: 'HTML' }
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
  if (data === 'sub_menu' || data === 'subscription' || data === 'show_sub') {
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
  // ── Оплата с баланса платформы ──
  if (data.startsWith('pay_balance:')) {
    await ctx.answerCbQuery();
    const parts = data.split(':'); // pay_balance:sub:planId:period OR pay_balance:gen:encodedDesc OR pay_balance:mkt:listingId
    const payType = parts[1];

    if (payType === 'sub') {
      // Subscription from balance — atomic check+deduct
      const planId = parts[2];
      const period = parts[3] as 'month' | 'year';
      const plan = PLANS[planId];
      if (!plan) { await ctx.reply('❌ План не найден'); return; }
      const amount = period === 'year' ? plan.priceYearTon : plan.priceMonthTon;
      const deducted = await atomicBalanceDeduct(userId, amount, { type: 'spend', description: `Подписка ${plan.name} (${period})` });
      if (!deducted) {
        const profile = await getUserProfile(userId);
        await ctx.reply(`❌ Недостаточно средств. Баланс: ${(profile.balance_ton || 0).toFixed(2)} TON, нужно: ${amount} TON`);
        return;
      }
      // Activate plan
      const payment = createPayment(userId, planId, period);
      if (!('error' in payment)) {
        const confirmed = await confirmPayment(userId, `balance:${Date.now()}`);
        if (confirmed.success && confirmed.plan) {
          const expStr = confirmed.expiresAt ? confirmed.expiresAt.toLocaleDateString('ru-RU') : '∞';
          await ctx.reply(`🎉 Оплачено с баланса! ${confirmed.plan.icon} ${confirmed.plan.name} активирован до ${expStr}`);
          await showSubscription(ctx);
        }
      }
      return;
    }

    if (payType === 'gen') {
      // AI generation from balance — atomic check+deduct
      const encodedDesc = parts.slice(2).join(':');
      const description = decodeURIComponent(encodedDesc);
      const plan = await getUserPlan(userId);
      const priceGen = plan.pricePerGeneration;
      const deducted = await atomicBalanceDeduct(userId, priceGen, { type: 'spend', description: 'Генерация AI агента' });
      if (!deducted) {
        const profile = await getUserProfile(userId);
        await ctx.reply(`❌ Недостаточно средств. Баланс: ${(profile.balance_ton || 0).toFixed(2)} TON, нужно: ${priceGen} TON`);
        return;
      }
      trackGeneration(userId);
      await ctx.reply('✅ Оплачено с баланса! Генерирую агента...');
      await ctx.sendChatAction('typing');
      const agentResult = await getOrchestrator().processMessage(userId, description);
      await sendResult(ctx, agentResult);
      return;
    }

    if (payType === 'mkt') {
      // Marketplace purchase from balance — atomic check+deduct
      const listingId = parseInt(parts[2]);
      const listing = await getMarketplaceRepository().getListing(listingId);
      if (!listing) { await ctx.reply('❌ Листинг не найден'); return; }
      const priceTon = listing.isFree ? 0 : listing.price / 1e9;
      if (priceTon > 0) {
        const deducted = await atomicBalanceDeduct(userId, priceTon, { type: 'spend', description: `Покупка агента: ${listing.name}` });
        if (!deducted) {
          const profile = await getUserProfile(userId);
          await ctx.reply(`❌ Недостаточно средств. Баланс: ${(profile.balance_ton || 0).toFixed(2)} TON, нужно: ${priceTon.toFixed(2)} TON`);
          return;
        }
      }
      // Create agent copy for buyer (same logic as free purchase)
      const agentResult = await getDBTools().getAgent(listing.agentId, listing.sellerId);
      if (!agentResult.success || !agentResult.data) { await ctx.reply('❌ Агент не найден'); return; }
      const src = agentResult.data;
      const newAgent = await getDBTools().createAgent({
        userId, name: src.name, description: src.description || '',
        code: src.code, triggerType: src.triggerType as "manual" | "scheduled" | "webhook" | "event" | "ai_agent",
        triggerConfig: src.triggerConfig || {},
      });
      if (newAgent.success) {
        await getMarketplaceRepository().createPurchase({ listingId, buyerId: userId, sellerId: listing.sellerId, agentId: listing.agentId, type: listing.isFree ? "free" : "buy", pricePaid: priceTon * 1e9, txHash: `balance:${Date.now()}` });
        await ctx.reply(`✅ Агент "${escHtml(listing.name)}" куплен с баланса и добавлен в ваш список!`, { parse_mode: 'HTML' });
      }
      return;
    }

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
    const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
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
        `❌ Подключите TON кошелёк для оплаты.\n\n` +
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
    const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
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

  // ── Agent AI Settings ──────────────────────────────────────────────────
  if (data.startsWith('agent_settings:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const lang = getUserLang(userId);
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const a = agentData.data;
      const cfg = (typeof a.triggerConfig === 'object' ? a.triggerConfig : {}) as Record<string, any>;
      const nestedCfg = (cfg.config || {}) as Record<string, any>;

      // Merge: global user vars + agent config
      const repo = getUserSettingsRepository();
      const allSettings = await repo.getAll(userId);
      const userVars = (allSettings.user_variables as Record<string, any>) || {};
      const mergedCfg = { ...userVars, ...nestedCfg };

      const provider = (mergedCfg.AI_PROVIDER as string) || 'не задан';
      const apiKeyRaw = (mergedCfg.AI_API_KEY as string) || '';
      const apiKey = decryptApiKey(apiKeyRaw);
      const model = (mergedCfg.AI_MODEL as string) || '';
      const maskedKey = apiKey ? apiKey.slice(0, 6) + '…' + apiKey.slice(-4) : (lang === 'ru' ? 'не задан' : 'not set');
      const keySource = nestedCfg.AI_API_KEY ? (lang === 'ru' ? 'агент' : 'agent') : userVars.AI_API_KEY ? (lang === 'ru' ? 'глобальный' : 'global') : '';

      let text = `⚙️ <b>${lang === 'ru' ? 'Настройки AI' : 'AI Settings'}</b>\n${div()}\n\n`;
      text += `🤖 <b>${lang === 'ru' ? 'Провайдер:' : 'Provider:'}</b> ${escHtml(provider)}\n`;
      text += `🔑 <b>${lang === 'ru' ? 'API ключ:' : 'API Key:'}</b> <code>${escHtml(maskedKey)}</code>`;
      if (keySource) text += ` <i>(${keySource})</i>`;
      text += '\n';
      if (model) text += `🧠 <b>${lang === 'ru' ? 'Модель:' : 'Model:'}</b> ${escHtml(model)}\n`;
      text += `\n<i>${lang === 'ru' ? 'Отправьте API ключ текстом чтобы обновить.\nФормат: Gemini=AIzaSy...' : 'Send API key as text to update.\nFormat: Gemini=AIzaSy...'}</i>`;

      const kb: any[][] = [
        [
          { text: '🔴 Gemini', callback_data: `set_provider:${agentId}:gemini` },
          { text: '🟢 OpenAI', callback_data: `set_provider:${agentId}:openai` },
        ],
        [
          { text: '🟣 Anthropic', callback_data: `set_provider:${agentId}:anthropic` },
          { text: '🔵 Groq', callback_data: `set_provider:${agentId}:groq` },
        ],
        [
          { text: '🟠 DeepSeek', callback_data: `set_provider:${agentId}:deepseek` },
          { text: '🌐 OpenRouter', callback_data: `set_provider:${agentId}:openrouter` },
        ],
      ];
      if (nestedCfg.AI_API_KEY) {
        kb.push([{ text: `🗑 ${lang === 'ru' ? 'Убрать ключ агента (использовать глобальный)' : 'Remove agent key (use global)'}`, callback_data: `clear_agent_key:${agentId}` }]);
      }
      // Self-improvement toggle
      const selfImproveOn = nestedCfg.self_improvement_enabled !== false;
      const siLabel = selfImproveOn
        ? (lang === 'ru' ? '🧠 Самоулучшение: ВКЛ' : '🧠 Self-improve: ON')
        : (lang === 'ru' ? '🧠 Самоулучшение: ВЫКЛ' : '🧠 Self-improve: OFF');
      kb.push([{ text: siLabel, callback_data: `toggle_self_improve:${agentId}` }]);
      text += `\n🧠 <b>${lang === 'ru' ? 'Самоулучшение:' : 'Self-improvement:'}</b> ${selfImproveOn ? '✅' : '❌'}\n`;
      text += `<i>${lang === 'ru' ? 'AI анализирует ошибки и автоматически исправляет агента' : 'AI analyzes errors and auto-fixes agent'}</i>\n`;
      if (selfImproveOn && !apiKey) {
        text += `⚠️ <i>${lang === 'ru' ? 'API ключ не настроен! Добавьте в Профиль → API ключи' : 'No API key! Add in Profile → API keys'}</i>\n`;
      }
      kb.push([{ text: `${peb('back')} ${lang === 'ru' ? 'Назад' : 'Back'}`, callback_data: `agent_menu:${agentId}` }]);

      await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  // ── Toggle self-improvement for agent ──
  if (data.startsWith('toggle_self_improve:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const tc = (typeof agentData.data.triggerConfig === 'object' ? agentData.data.triggerConfig : {}) as Record<string, any>;
      if (!tc.config) tc.config = {};
      const current = tc.config.self_improvement_enabled !== false;
      tc.config.self_improvement_enabled = !current;
      await dbPool.query(
        'UPDATE builder_bot.agents SET trigger_config = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [JSON.stringify(tc), agentId, userId]
      );
      const lang = getUserLang(userId);
      const newState = !current;
      await ctx.reply(
        newState
          ? (lang === 'ru' ? '🧠 Самоулучшение включено. AI будет автоматически исправлять ошибки агента.' : '🧠 Self-improvement enabled. AI will auto-fix agent errors.')
          : (lang === 'ru' ? '🧠 Самоулучшение выключено.' : '🧠 Self-improvement disabled.')
      );
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || ''));
    }
    return;
  }

  // ── Set AI provider for agent ──
  if (data.startsWith('set_provider:')) {
    const parts = data.split(':');
    const agentId = parseInt(parts[1], 10);
    const provider = parts[2];
    await ctx.answerCbQuery();
    try {
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const cfg = (typeof agentData.data.triggerConfig === 'object' ? agentData.data.triggerConfig : {}) as Record<string, any>;
      const nestedCfg = cfg.config || {};
      const newConfig = { ...cfg, config: { ...nestedCfg, AI_PROVIDER: provider } };
      await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2 AND user_id=$3', [JSON.stringify(newConfig), agentId, userId]);
      const lang = getUserLang(userId);
      await safeReply(ctx, `✅ ${lang === 'ru' ? 'Провайдер изменён на' : 'Provider changed to'} <b>${escHtml(provider)}</b>`, { parse_mode: 'HTML' });
      // Перерисовать настройки
      await showAgentMenu(ctx, agentId, userId);
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  // ── Clear agent-level API key (fallback to global) ──
  if (data.startsWith('clear_agent_key:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const cfg = (typeof agentData.data.triggerConfig === 'object' ? agentData.data.triggerConfig : {}) as Record<string, any>;
      const nestedCfg = { ...(cfg.config || {}) };
      delete nestedCfg.AI_API_KEY;
      const newConfig = { ...cfg, config: nestedCfg };
      await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2 AND user_id=$3', [JSON.stringify(newConfig), agentId, userId]);
      const lang = getUserLang(userId);
      await safeReply(ctx, `✅ ${lang === 'ru' ? 'Ключ агента удалён. Теперь используется глобальный ключ.' : 'Agent key removed. Using global key now.'}`, { parse_mode: 'HTML' });
      await showAgentMenu(ctx, agentId, userId);
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  // ── Agent capabilities toggle ──────────────────────────────────────────
  if (data.startsWith('agent_cap:')) {
    const parts = data.split(':');
    const agentId = parseInt(parts[1], 10);
    const capId = parts[2];
    await ctx.answerCbQuery();
    try {
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const tc = (typeof agentData.data.triggerConfig === 'object' ? agentData.data.triggerConfig : {}) as Record<string, any>;
      if (!tc.config) tc.config = {};
      const caps: string[] = tc.config.enabledCapabilities || [];
      const idx = caps.indexOf(capId);
      if (idx >= 0) caps.splice(idx, 1); else caps.push(capId);
      tc.config.enabledCapabilities = caps;
      await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2 AND user_id=$3', [JSON.stringify(tc), agentId, userId]);
      await showCapabilitiesMenu(ctx, agentId, caps);
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  if (data.startsWith('agent_cap_done:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery('✅ Сохранено');
    await showAgentMenu(ctx, agentId, userId);
    return;
  }

  if (data.startsWith('agent_cap_all:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const tc = (typeof agentData.data.triggerConfig === 'object' ? agentData.data.triggerConfig : {}) as Record<string, any>;
      if (!tc.config) tc.config = {};
      tc.config.enabledCapabilities = [];
      await dbPool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2 AND user_id=$3', [JSON.stringify(tc), agentId, userId]);
      await showCapabilitiesMenu(ctx, agentId, []);
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  if (data.startsWith('agent_caps_menu:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const agentData = await getDBTools().getAgent(agentId, userId);
      if (!agentData.success || !agentData.data) { await ctx.reply('❌'); return; }
      const tc = (typeof agentData.data.triggerConfig === 'object' ? agentData.data.triggerConfig : {}) as Record<string, any>;
      const caps: string[] = tc.config?.enabledCapabilities || [];
      await showCapabilitiesMenu(ctx, agentId, caps);
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOOKS: Blocklist, Triggers, Session Policy
  // ══════════════════════════════════════════════════════════════════════════

  if (data.startsWith('hooks_blocklist:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { loadBlocklist } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const bl = await loadBlocklist(stateRepo, agentId);
      const ru = getUserLang(userId) === 'ru';
      let text = `🚫 <b>${ru ? 'Блоклист' : 'Blocklist'}</b> #${agentId}\n`;
      text += `${ru ? 'Статус' : 'Status'}: ${bl.enabled ? '✅ Вкл' : '⬜ Выкл'}\n\n`;
      if (bl.keywords.length > 0) {
        text += `${ru ? 'Слова' : 'Keywords'}: <code>${escHtml(bl.keywords.join(', '))}</code>\n`;
      } else {
        text += `${ru ? 'Список пуст. Отправьте слова через запятую.' : 'Empty. Send keywords separated by commas.'}\n`;
      }
      if (bl.reply) text += `\n${ru ? 'Авто-ответ' : 'Auto-reply'}: <i>${escHtml(bl.reply)}</i>`;
      const btns: any[][] = [
        [{ text: bl.enabled ? '⬜ Выключить' : '✅ Включить', callback_data: `bl_toggle:${agentId}` }],
        [{ text: '➕ Добавить слова', callback_data: `bl_add:${agentId}` }],
        [{ text: '🗑 Очистить', callback_data: `bl_clear:${agentId}` }],
        [{ text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }],
      ];
      await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  if (data.startsWith('bl_toggle:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { loadBlocklist, saveBlocklist } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const bl = await loadBlocklist(stateRepo, agentId);
      bl.enabled = !bl.enabled;
      await saveBlocklist(stateRepo, agentId, userId, bl);
      // Re-show menu
      const cbData = `hooks_blocklist:${agentId}`;
      (ctx as any).callbackQuery.data = cbData;
      // Inline re-invoke by falling through to next tick
      await ctx.reply(bl.enabled ? '✅ Блоклист включён' : '⬜ Блоклист выключен');
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  if (data.startsWith('bl_add:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    pendingBlocklistAdd.set(userId, agentId);
    await ctx.reply('✏️ Отправьте слова для блоклиста через запятую:\n<i>Пример: спам, реклама, казино</i>', { parse_mode: 'HTML' });
    return;
  }

  if (data.startsWith('bl_clear:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { loadBlocklist, saveBlocklist } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const bl = await loadBlocklist(stateRepo, agentId);
      bl.keywords = [];
      await saveBlocklist(stateRepo, agentId, userId, bl);
      await ctx.reply('🗑 Блоклист очищен');
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  if (data.startsWith('hooks_triggers:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { loadTriggers } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const triggers = await loadTriggers(stateRepo, agentId);
      const ru = getUserLang(userId) === 'ru';
      let text = `🎯 <b>${ru ? 'Контекстные триггеры' : 'Context Triggers'}</b> #${agentId}\n\n`;
      if (triggers.length === 0) {
        text += ru
          ? '<i>Нет триггеров. Триггеры инжектят дополнительный контекст когда в сообщении встречается ключевое слово.</i>'
          : '<i>No triggers. Triggers inject additional context when a keyword is found in a message.</i>';
      } else {
        triggers.forEach((t: any, i: number) => {
          text += `${t.enabled ? '✅' : '⬜'} <b>${escHtml(t.keyword)}</b>\n`;
          text += `   → <i>${escHtml(t.context.slice(0, 80))}</i>\n\n`;
        });
      }
      const btns: any[][] = [
        [{ text: '➕ Добавить триггер', callback_data: `trig_add:${agentId}` }],
      ];
      if (triggers.length > 0) {
        btns.push([{ text: '🗑 Удалить все', callback_data: `trig_clear:${agentId}` }]);
      }
      btns.push([{ text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }]);
      await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  if (data.startsWith('trig_add:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    pendingTriggerAdd.set(userId, { agentId, step: 'keyword' });
    await ctx.reply('🎯 Отправьте ключевое слово для триггера:', { parse_mode: 'HTML' });
    return;
  }

  if (data.startsWith('trig_clear:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { saveTriggers } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      await saveTriggers(stateRepo, agentId, userId, []);
      await ctx.reply('🗑 Все триггеры удалены');
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  if (data.startsWith('hooks_session:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { loadSessionConfig } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const cfg = await loadSessionConfig(stateRepo, agentId);
      const ru = getUserLang(userId) === 'ru';
      let text = `🔄 <b>${ru ? 'Политика сессии' : 'Session Policy'}</b> #${agentId}\n\n`;
      const policyLabels: Record<string, string> = { none: '♾ Без сброса', daily: '📅 Ежедневный сброс', idle: `⏰ Сброс через ${cfg.idleMinutes} мин` };
      text += `${ru ? 'Текущая' : 'Current'}: <b>${policyLabels[cfg.resetPolicy] || cfg.resetPolicy}</b>\n\n`;
      text += ru
        ? '<i>Выберите когда очищать историю диалога:</i>'
        : '<i>Choose when to clear conversation history:</i>';
      const btns: any[][] = [
        [{ text: `${cfg.resetPolicy === 'none' ? '✅' : '⬜'} Без сброса`, callback_data: `sess_set:${agentId}:none` }],
        [{ text: `${cfg.resetPolicy === 'daily' ? '✅' : '⬜'} Ежедневно`, callback_data: `sess_set:${agentId}:daily` }],
        [{ text: `${cfg.resetPolicy === 'idle' ? '✅' : '⬜'} По бездействию (60мин)`, callback_data: `sess_set:${agentId}:idle` }],
        [{ text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }],
      ];
      await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  if (data.startsWith('sess_set:')) {
    const parts = data.split(':');
    const agentId = parseInt(parts[1], 10);
    const policy = parts[2] as 'none' | 'daily' | 'idle';
    await ctx.answerCbQuery();
    try {
      const { loadSessionConfig, saveSessionConfig } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const cfg = await loadSessionConfig(stateRepo, agentId);
      cfg.resetPolicy = policy;
      if (policy === 'idle' && !cfg.idleMinutes) cfg.idleMinutes = 60;
      await saveSessionConfig(stateRepo, agentId, userId, cfg);
      const labels: Record<string, string> = { none: '♾ Без сброса', daily: '📅 Ежедневно', idle: '⏰ По бездействию' };
      await ctx.reply(`✅ Политика сессии: ${labels[policy]}`);
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  // ── Post-creation setup wizard callbacks ──────────────────────────────────
  if (data.startsWith('agent_setup:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    const setup = pendingAgentSetup.get(userId);
    if (setup) {
      await showSetupStep(ctx, userId);
    } else {
      await showAgentMenu(ctx, agentId, userId);
    }
    return;
  }

  if (data.startsWith('setup_tg_qr:')) {
    await ctx.answerCbQuery();
    // Reuse the same QR login flow from /tglogin command
    const h = qrPollingHandles.get(userId);
    if (h) { clearInterval(h); qrPollingHandles.delete(userId); }
    pendingTgAuth.set(userId, 'qr_waiting');

    authStartQR(
      async (qrUrl: string, expiresIn: number) => {
        if (!['qr_waiting'].includes(pendingTgAuth.get(userId) ?? '')) return;
        const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=' + encodeURIComponent(qrUrl);
        try {
          await bot.telegram.sendPhoto(userId, qrImageUrl, {
            caption: '🔳 <b>Сканируй QR-код</b>\n\n📱 Telegram → Настройки → Устройства → Подключить устройство\n\n⏱ ' + expiresIn + ' сек\n<i>/cancel для отмены</i>',
            parse_mode: 'HTML'
          });
        } catch {}
      },
      (complete2FA: Complete2FAFn) => {
        pendingTgAuth.set(userId, 'qr_password');
        complete2FAFns.set(userId, complete2FA);
        bot.telegram.sendMessage(userId, '🔐 Введите пароль 2FA:', { parse_mode: 'HTML' }).catch(() => {});
      }
    ).then((result: { ok: boolean; error?: string }) => {
      complete2FAFns.delete(userId);
      if (['qr_waiting', 'qr_password'].includes(pendingTgAuth.get(userId) ?? '')) pendingTgAuth.delete(userId);
      if (result.ok) {
        bot.telegram.sendMessage(userId, '🎉 <b>Telegram авторизован!</b>', { parse_mode: 'HTML' }).catch(() => {});
        const setupQR2 = pendingAgentSetup.get(userId);
        if (setupQR2) {
          setupQR2.tgAuthed = true;
          setupQR2.currentStep++;
          setTimeout(() => {
            const fakeCtx = { reply: (t: string, o?: any) => bot.telegram.sendMessage(userId, t, o), from: { id: userId }, chat: { id: userId }, sendChatAction: () => Promise.resolve() } as any;
            showSetupStep(fakeCtx, userId).catch(() => {});
          }, 1500);
        }
      }
    }).catch((e: any) => { console.error(`[bot] QR auth setup error:`, e?.message || e); });
    return;
  }

  if (data.startsWith('setup_tg_phone:')) {
    await ctx.answerCbQuery();
    pendingTgAuth.set(userId, 'phone');
    const ru = getUserLang(userId) === 'ru';
    await ctx.reply(ru ? '📞 Введите номер телефона (с кодом страны, например +79001234567):' : '📞 Enter your phone number (with country code, e.g. +1234567890):');
    return;
  }

  if (data.startsWith('setup_wallet_create:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    const ru = getUserLang(userId) === 'ru';
    try {
      const wallet = await generateAgentWallet();
      const setup = pendingAgentSetup.get(userId);
      if (setup) setup.walletCreated = true;
      // Persist wallet to agent state
      const { getAgentStateRepository } = require('./db/schema-extensions');
      const stateRepo = getAgentStateRepository();
      await stateRepo.set(agentId, userId, 'wallet_address', wallet.address);
      await stateRepo.set(agentId, userId, 'wallet_mnemonic', wallet.mnemonic);
      await ctx.reply(
        `✅ <b>${ru ? 'Кошелёк создан!' : 'Wallet created!'}</b>\n\n` +
        `📋 <code>${wallet.address}</code>\n\n` +
        `${ru ? 'Пополните его TON для работы агента. Мнемоника сохранена в зашифрованном виде.' : 'Fund it with TON for agent operations. Mnemonic stored securely.'}`,
        { parse_mode: 'HTML' }
      );
      // Move to next step
      if (setup) {
        setup.currentStep++;
        setTimeout(async () => { try { await showSetupStep(ctx, userId); } catch {} }, 1000);
      }
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  if (data.startsWith('setup_apikey:')) {
    const parts = data.split(':');
    const agentId = parseInt(parts[1], 10);
    const provider = parts[2];
    await ctx.answerCbQuery();
    const ru = getUserLang(userId) === 'ru';
    // Save provider choice and ask for key
    pendingApiKey.set(userId, { provider });
    // Store that this is from setup wizard
    const setup = pendingAgentSetup.get(userId);
    if (setup) (setup as any)._apiKeyStep = true;

    const providerNames: Record<string, string> = {
      openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini',
      groq: 'Groq', openrouter: 'OpenRouter', deepseek: 'DeepSeek',
    };
    await ctx.reply(
      `🔑 <b>${providerNames[provider] || provider}</b>\n\n` +
      `${ru ? 'Отправьте ваш API ключ:' : 'Send your API key:'}`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (data.startsWith('setup_skip:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    const setup = pendingAgentSetup.get(userId);
    if (setup) {
      setup.currentStep++;
      if (setup.currentStep >= setup.steps.length) {
        pendingAgentSetup.delete(userId);
        await finishSetupAndStart(ctx, agentId, userId);
      } else {
        await showSetupStep(ctx, userId);
      }
    }
    return;
  }

  // ── Deploy as Telegram Userbot ──────────────────────────────────────────
  // ── Toggle inter-agent communication ──
  if (data.startsWith('toggle_inter_agent:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const stateRepo = getAgentStateRepository();
      const current = await stateRepo.get(agentId, 'inter_agent_enabled');
      const newVal = (String(current) !== 'true') ? 'true' : 'false';
      await stateRepo.set(agentId, userId, 'inter_agent_enabled', newVal);
      const lang = getUserLang(userId);
      const on = newVal === 'true';
      await safeReply(ctx,
        on
          ? (lang === 'ru' ? '🔗 Межагентная коммуникация <b>включена</b>. Агент сможет обращаться к другим вашим агентам.' : '🔗 Inter-agent communication <b>enabled</b>. Agent can now interact with your other agents.')
          : (lang === 'ru' ? '🔗 Межагентная коммуникация <b>выключена</b>.' : '🔗 Inter-agent communication <b>disabled</b>.'),
        { parse_mode: 'HTML' }
      );
      await showAgentMenu(ctx, agentId, userId);
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  if (data.startsWith('deploy_userbot:')) {
    const agentId = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    try {
      const { isAuthorized } = await import('./fragment-service');
      const authed = await isAuthorized();
      if (!authed) {
        await editOrReply(ctx,
          `🧑‍💻 <b>Telegram Userbot</b>\n\n` +
          `⚠️ Telegram не авторизован!\n\n` +
          `Чтобы агент мог работать как реальный Telegram пользователь ` +
          `(читать каналы, отправлять сообщения, вступать в группы), ` +
          `нужна MTProto авторизация.\n\n` +
          `Отправьте /tglogin для авторизации.`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
            [{ text: '🔐 Авторизоваться', callback_data: 'tglogin_menu' }],
            [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
          ] } }
        );
        return;
      }
      // Авторизован — показываем инфо
      const agentRes = await getDBTools().getAgent(agentId, userId);
      const a = agentRes.data;
      if (!a) { await ctx.reply('❌ Агент не найден'); return; }
      const isActive = a.isActive;
      await editOrReply(ctx,
        `🧑‍💻 <b>Telegram Userbot Mode</b>\n\n` +
        `✅ Telegram авторизован — MTProto подключён!\n\n` +
        `Агент <b>${escHtml(a.name)}</b> имеет доступ к:\n` +
        `• 💬 Отправка/чтение сообщений\n` +
        `• 📢 Каналы и группы (вступить, читать, искать)\n` +
        `• 👥 Информация о пользователях\n` +
        `• 🎁 Fragment (подарки, покупка/продажа)\n` +
        `• 🌐 HTTP API запросы\n\n` +
        (isActive
          ? `🟢 Агент <b>активен</b> — Telegram инструменты уже доступны!`
          : `⚪ Агент <b>не запущен</b> — запустите чтобы активировать Telegram.`),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          isActive
            ? [{ text: '⏸ Остановить', callback_data: `run_agent:${agentId}` }]
            : [{ text: '🚀 Запустить с Telegram', callback_data: `run_agent:${agentId}` }],
          [{ text: '💬 Чат с агентом', callback_data: `agent_chat:${agentId}` }],
          [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
        ] } }
      );
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  // ── AI Mode toggle/trigger callbacks ──
  if (data.startsWith('ai_toggle:') || data.startsWith('ai_run:')) {
    if (!isPlatformAdmin(userId)) { await ctx.answerCbQuery('⛔ Только админ'); return; }
    const { getSelfImprovementSystem } = await import('./self-improvement');
    const sis = getSelfImprovementSystem();
    if (!sis) { await ctx.answerCbQuery('❌ Система не запущена'); return; }

    const mode = data.split(':')[1];
    const labels: Record<string, string> = { improver: '🔍 Улучшатель', ideator: '💡 Придумыватель', implementor: '🔨 Реализатор' };
    const label = labels[mode] || mode;

    if (data.startsWith('ai_toggle:')) {
      const nowEnabled = sis.toggleMode(mode);
      await ctx.answerCbQuery(`${label}: ${nowEnabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}`);

      // Update message with new state
      const modes = sis.getModesStatus();
      const ideasCount = sis.getPendingIdeasCount();
      let text = '🤖 <b>AI Режимы</b>\n\n';
      text += `🔍 Улучшатель (авто 10мин): ${modes[0].enabled ? '✅' : '❌'}\n`;
      text += `💡 Придумыватель (авто 30мин): ${modes[1].enabled ? '✅' : '❌'}\n`;
      text += `🔨 Реализатор (по кнопке): всегда готов\n`;
      text += `\n📋 Идей в очереди: <b>${ideasCount}</b>`;

      const kb: any[][] = [
        [
          { text: `${modes[0].enabled ? '✅' : '❌'} Улучшатель`, callback_data: 'ai_toggle:improver' },
          { text: '▶️ Запустить', callback_data: 'ai_run:improver' },
        ],
        [
          { text: `${modes[1].enabled ? '✅' : '❌'} Придумыватель`, callback_data: 'ai_toggle:ideator' },
          { text: '▶️ Запустить', callback_data: 'ai_run:ideator' },
        ],
        [
          { text: '✏️ Моя идея', callback_data: 'ai_my_idea' },
          { text: '🔨 Реализовать', callback_data: 'ai_run:implementor' },
        ],
      ];
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(() => {});
    } else if (mode === 'implementor') {
      // Show idea list for selection
      const ideas = sis.getPendingIdeas();
      if (!ideas.length) {
        await ctx.answerCbQuery('Нет идей');
        await ctx.reply('📋 Очередь идей пуста. Сначала запусти Придумыватель.');
        return;
      }
      await ctx.answerCbQuery('📋 Выбери идею');
      let text = '🔨 <b>Реализатор — выбери идею:</b>\n\n';
      const ideaKb: any[][] = [];
      for (const idea of ideas) {
        text += `${idea.index + 1}. <b>${escHtml(idea.title)}</b>\n   🏷 ${escHtml(idea.domain)}\n\n`;
        ideaKb.push([{ text: `${idea.index + 1}. ${idea.title.slice(0, 35)}`, callback_data: `ai_impl:${idea.index}` }]);
      }
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: ideaKb } });
    } else {
      // ai_run — manual trigger (improver / ideator) — background
      await ctx.answerCbQuery(`⏳ Запускаю ${label}...`);
      await ctx.reply(`⏳ Запускаю <b>${label}</b>... Это займёт 1-2 минуты.`, { parse_mode: 'HTML' });

      // Don't await — run in background to avoid Telegraf 90s timeout
      sis.triggerMode(mode).then(async (result) => {
        if (result === 'ok') {
          // notification already sent inside the mode
        } else if (result === 'already_running') {
          await ctx.reply(`⚠️ Уже запущен, подождите.`).catch(() => {});
        } else if (result === 'claude_unavailable') {
          await ctx.reply(`❌ Claude Code недоступен.`).catch(() => {});
        } else {
          await ctx.reply(`❌ ${result}`).catch(() => {});
        }
      }).catch(e => console.warn('[Bot] triggerMode error:', e?.message || e));
    }
    return;
  }

  // ── ai_impl — реализовать выбранную идею ──
  if (data.startsWith('ai_impl:')) {
    if (!isPlatformAdmin(userId)) { await ctx.answerCbQuery('⛔ Только админ'); return; }
    const { getSelfImprovementSystem } = await import('./self-improvement');
    const sis = getSelfImprovementSystem();
    if (!sis) { await ctx.answerCbQuery('❌'); return; }

    const index = parseInt(data.split(':')[1]);
    const ideas = sis.getPendingIdeas();
    const ideaTitle = ideas[index]?.title || '?';

    await ctx.answerCbQuery('⏳ Запускаю...');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.reply(`⏳ Реализую: <b>${escHtml(ideaTitle)}</b>\nЭто займёт 1-2 минуты...`, { parse_mode: 'HTML' });

    // Run in background — don't block callback (Telegraf 90s timeout)
    sis.implementIdea(index).then(async (result) => {
      if (result === 'ok') {
        // notification already sent by executeProactivePrompt
      } else if (result === 'already_running') {
        await ctx.reply(`⚠️ Уже запущен, подождите.`).catch(() => {});
      } else if (result === 'bad_index') {
        await ctx.reply(`❌ Идея уже была реализована или удалена.`).catch(() => {});
      } else {
        await ctx.reply(`❌ ${result}`).catch(() => {});
      }
    }).catch(e => console.warn('[Bot] implementIdea error:', e?.message || e));
    return;
  }

  // ── ai_my_idea — владелец хочет описать свою идею ──
  if (data === 'ai_my_idea') {
    if (!isPlatformAdmin(userId)) { await ctx.answerCbQuery('⛔ Только админ'); return; }
    await ctx.answerCbQuery('✏️');
    pendingUserIdea.set(userId, true);
    await ctx.reply(
      '✏️ <b>Опиши свою идею</b>\n\n' +
      'Напиши что хочешь добавить/изменить в платформе.\n' +
      'Придумыватель допилит твою идею в полную спецификацию с промптом для Реализатора.\n\n' +
      '<i>"стоп" — отмена</i>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // ── ai_drop — удалить идею из очереди ──
  if (data.startsWith('ai_drop:')) {
    if (!isPlatformAdmin(userId)) { await ctx.answerCbQuery('⛔ Только админ'); return; }
    const { getSelfImprovementSystem } = await import('./self-improvement');
    const sis = getSelfImprovementSystem();
    if (!sis) { await ctx.answerCbQuery('❌'); return; }
    const index = parseInt(data.split(':')[1]);
    sis.dropIdea(index);
    await ctx.answerCbQuery('🗑 Идея удалена');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    return;
  }

  // ── AI Proposal callbacks (self-improvement) — handle before orchestrator ──
  if (data.startsWith('proposal_approve:') || data.startsWith('proposal_reject:') || data.startsWith('proposal_rollback:') || data.startsWith('proposal_discuss:')) {
    const [action, proposalId] = [data.split(':')[0], data.split(':').slice(1).join(':')];
    if (!isPlatformAdmin(userId)) { await ctx.answerCbQuery('⛔ Только админ'); return; }
    try {
      const { getSelfImprovementSystem } = await import('./self-improvement');
      const sis = getSelfImprovementSystem();
      if (!sis) { await ctx.answerCbQuery('❌ Система не запущена'); return; }
      if (action === 'proposal_approve') {
        await ctx.answerCbQuery('⏳ Применяю...');
        await sis.approveProposal(proposalId);
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        await ctx.reply(`✅ Proposal <code>${proposalId.slice(0, 8)}</code> применён.`, { parse_mode: 'HTML' });
      } else if (action === 'proposal_reject') {
        await ctx.answerCbQuery('🚫 Отклоняю...');
        await sis.rejectProposal(proposalId, 'Rejected by owner via bot');
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        await ctx.reply(`🚫 Proposal <code>${proposalId.slice(0, 8)}</code> отклонён.`, { parse_mode: 'HTML' });
      } else if (action === 'proposal_rollback') {
        await ctx.answerCbQuery('⏪ Откатываю...');
        await sis.rollbackProposal(proposalId);
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        await ctx.reply(`⏪ Proposal <code>${proposalId.slice(0, 8)}</code> откатан.`, { parse_mode: 'HTML' });
      } else if (action === 'proposal_discuss') {
        await ctx.answerCbQuery('💬 Обсуждение');
        pendingProposalDiscuss.set(userId, proposalId);
        await ctx.reply(
          `💬 <b>Обсуждение фичи</b>\n\n` +
          `Напишите что думаете — вопрос, замечание, пожелание.\n` +
          `AI прочитает и ответит с учётом контекста фичи.\n\n` +
          `<i>Напишите "стоп" чтобы выйти из обсуждения.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (e: any) {
      await ctx.reply('❌ Ошибка: ' + escHtml(e.message || String(e)), { parse_mode: 'HTML' });
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
  '🤖 Мои агенты', '➕ Создать агента', '✏️ Создать агента', '🏪 Маркетплейс',
  '🔌 Плагины', '⚡ Workflow', '💎 TON Connect', '💳 Подписка', '📊 Статистика', '❓ Помощь', '👤 Профиль',
  // EN keyboard texts
  '💰 Кошелёк', '🎁 Гифты & NFT',
  // EN keyboard texts
  '🤖 My Agents', '✏️ Create Agent', '➕ Create Agent', '🏪 Marketplace',
  '🔌 Plugins', '⚡ Workflow', '💎 TON Connect', '💳 Subscription', '📊 Statistics', '📊 Stats', '❓ Help', '👤 Profile',
  '💰 Wallet', '🎁 Gifts & NFT',
]);

// ════════════════════════════════════════════════════════════
// ГОЛОСОВЫЕ СООБЩЕНИЯ → транскрипция → создание агента / чат
// ════════════════════════════════════════════════════════════
bot.on(message('voice'), async (ctx) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const lang = getUserLang(userId);

  try {
    await ctx.sendChatAction('typing');

    // 1) Скачиваем OGG из Telegram
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const resp = await fetch(fileLink.href);
    if (!resp.ok) throw new Error('Failed to download voice');
    const audioBuffer = Buffer.from(await resp.arrayBuffer());

    // 2) Транскрипция: сначала Gemini (multimodal audio), fallback OpenAI Whisper
    const base64Audio = audioBuffer.toString('base64');
    const whisperBaseUrl = process.env.OPENAI_BASE_URL?.replace('/v1', '') || 'https://api.openai.com';
    const whisperApiKey = process.env.OPENAI_API_KEY || '';

    // Подтягиваем Gemini ключ пользователя из глобальных настроек
    let userGeminiKey = process.env.GEMINI_API_KEY || '';
    try {
      const repo = getUserSettingsRepository();
      const allSettings = await repo.getAll(userId);
      const uv = (allSettings.user_variables as Record<string, any>) || {};
      // Если у юзера есть ключ и провайдер Gemini
      // Decrypt API key before use (stored encrypted via encryptApiKey)
      const _rawUserKey = uv.AI_API_KEY ? (() => { try { const { decryptApiKey } = require('./crypto-utils'); return decryptApiKey(uv.AI_API_KEY); } catch { return uv.AI_API_KEY; } })() : '';
      if (_rawUserKey && /AIzaSy/i.test(_rawUserKey)) {
        userGeminiKey = _rawUserKey;
      } else if (_rawUserKey && (uv.AI_PROVIDER || '').toLowerCase().includes('gemini')) {
        userGeminiKey = _rawUserKey;
      }
    } catch {}

    let transcribedText = '';

    // Попытка 1: Gemini multimodal (поддерживает audio напрямую)
    try {
      const geminiKey = userGeminiKey;
      if (geminiKey) {
        const geminiResp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + geminiKey,
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Транскрибируй это голосовое сообщение. Верни ТОЛЬКО текст, без пояснений и кавычек.' },
                { type: 'input_audio', input_audio: { data: base64Audio, format: 'ogg' } },
              ],
            }],
            max_tokens: 500,
          }),
        });
        if (geminiResp.ok) {
          const gj = await geminiResp.json() as any;
          transcribedText = gj.choices?.[0]?.message?.content?.trim() || '';
        }
      }
    } catch {}

    // Попытка 2: OpenAI Whisper API (если есть OpenAI ключ)
    if (!transcribedText && whisperApiKey) {
      try {
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
        formData.append('model', 'whisper-1');
        formData.append('language', lang === 'ru' ? 'ru' : 'en');

        const whisperResp = await fetch(whisperBaseUrl + '/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + whisperApiKey },
          body: formData as any,
        });
        if (whisperResp.ok) {
          const wj = await whisperResp.json() as any;
          transcribedText = wj.text || '';
        }
      } catch {}
    }

    if (!transcribedText || transcribedText.length < 3) {
      await ctx.reply(lang === 'ru'
        ? '🎤 Не удалось распознать голосовое сообщение. Попробуйте ещё раз или напишите текстом.'
        : '🎤 Could not transcribe voice message. Try again or type your request.'
      );
      return;
    }

    // 4) Показываем что распознали
    await safeReply(ctx,
      `🎤 <i>${lang === 'ru' ? 'Распознано:' : 'Transcribed:'}</i> "${escHtml(transcribedText.slice(0, 200))}"`,
      { parse_mode: 'HTML' }
    );

    // 5) Обрабатываем как обычный текст — пропускаем через все pending states и orchestrator
    // Если юзер в чате с агентом — отправить в чат
    if (pendingAgentChats.has(userId)) {
      const agentId = pendingAgentChats.get(userId)!;
      const agentRes = await getDBTools().getAgent(agentId, userId);
      if (agentRes.success && agentRes.data) {
        if (agentRes.data.triggerType === 'ai_agent') {
          await getRunnerAgent().sendMessageToAgent(agentId, transcribedText, {
            senderId: userId, isOwner: true,
            username: ctx.from?.username || undefined,
            firstName: ctx.from?.first_name || undefined,
          });
          await ctx.reply(lang === 'ru' ? '📨 Голосовое отправлено агенту.' : '📨 Voice sent to agent.');
        }
      }
      return;
    }

    // Если ожидаем текстовый ввод в любом pending-состоянии — не подходит голосовое
    const pendingAction = pendingApiKey.has(userId) ? (lang === 'ru' ? 'ввод API ключа' : 'API key input')
      : pendingEdits.has(userId) ? (lang === 'ru' ? 'редактирование агента' : 'agent editing')
      : pendingWithdrawal.has(userId) ? (lang === 'ru' ? 'вывод средств' : 'withdrawal')
      : pendingTgAuth.has(userId) ? (lang === 'ru' ? 'авторизация Telegram' : 'Telegram auth')
      : pendingRenames.has(userId) ? (lang === 'ru' ? 'переименование агента' : 'agent renaming')
      : pendingPublish.has(userId) ? (lang === 'ru' ? 'публикация агента' : 'agent publishing')
      : pendingTemplateSetup.has(userId) ? (lang === 'ru' ? 'настройка шаблона' : 'template setup')
      : pendingCreations.has(userId) ? (lang === 'ru' ? 'создание агента' : 'agent creation')
      : pendingNameAsk.has(userId) ? (lang === 'ru' ? 'ввод названия' : 'name input')
      : [...pendingRepairs.keys()].some(k => k.startsWith(`${userId}:`)) ? (lang === 'ru' ? 'ремонт агента' : 'agent repair')
      : null;
    if (pendingAction) {
      await ctx.reply(lang === 'ru'
        ? `⌨️ Сейчас идёт <b>${pendingAction}</b> — отправьте текстовое сообщение.`
        : `⌨️ Currently in <b>${pendingAction}</b> — please send a text message.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Иначе — отправляем в оркестратор как запрос на создание/действие
    await ctx.sendChatAction('typing');
    const orchestrator = getOrchestrator();
    const result = await orchestrator.processMessage(userId, transcribedText);
    await sendResult(ctx, result);

  } catch (e: any) {
    console.error('[Voice] Error:', e.message);
    await ctx.reply(lang === 'ru'
      ? '❌ Ошибка обработки голоса. Попробуйте ещё раз или отправьте текстом.'
      : '❌ Voice processing error. Try again or send as text.'
    );
  }
});

// ── Photo handler (feedback screenshots) ──
bot.on(message('photo'), async (ctx) => {
  const userId = ctx.from!.id;
  const _fb = pendingFeedback.get(userId);
  if (_fb && Date.now() - _fb.startTs < 10 * 60_000) {
    pendingFeedback.delete(userId);
    const caption = ctx.message.caption || '';
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    try {
      const { pool } = require('./db');
      await pool.query(
        `INSERT INTO builder_bot.feedback (user_id, username, type, message, screenshot_file_id) VALUES ($1, $2, $3, $4, $5)`,
        [userId, ctx.from?.username || '', _fb.type, caption || 'Screenshot attached', photoId]
      );
      const ru = getUserLang(userId) === 'ru';
      let rewardMsg = '';
      try {
        const { isBetaTester, awardFeedbackPoints } = require('./payments');
        if (isBetaTester(userId)) {
          const reward = await awardFeedbackPoints(userId, _fb.type);
          rewardMsg = `\n🏆 +${reward.points} pts (total: ${reward.total})`;
          if (reward.reward) rewardMsg += reward.reward === 'bonus_gens' ? '\n🎁 +20 gens!' : reward.reward === 'pro' ? '\n🎉 Pro!' : reward.reward === 'unlimited' ? '\n💎 Unlimited!' : '';
        }
      } catch {}
      await safeReply(ctx, (ru ? '✅ Фидбек со скриншотом отправлен!' : '✅ Feedback with screenshot sent!') + rewardMsg);
    } catch (e: any) { await safeReply(ctx, `❌ ${e.message}`); }
    return;
  }
});

bot.on(message('text'), async (ctx) => {
  if (!ctx.from) return;
  const text = ctx.message.text;
  if ((text.startsWith('/') && text !== '/stop_chat' && text !== '/stopchat') || MENU_TEXTS.has(text)) return;

  const userId = ctx.from.id;
  const trimmed = text.trim();

  // Check if this is a confirmation reply for HitL
  const { handleUserConfirmation } = require('./agents/ai-agent-runtime');
  if (handleUserConfirmation(ctx.from.id, ctx.message.text)) return; // consumed by pending confirmation

  // ── Сохраняем язык пользователя (авто-определение) ───────
  if (!userLanguages.has(userId)) {
    userLanguages.set(userId, detectLang(trimmed));
  }

  // ── User idea → Придумыватель допиливает ──
  if (pendingUserIdea.has(userId)) {
    if (trimmed.toLowerCase() === 'стоп' || trimmed.toLowerCase() === 'stop') {
      pendingUserIdea.delete(userId);
      await ctx.reply('✅ Отменено.');
      return;
    }
    pendingUserIdea.delete(userId);
    await ctx.reply('⏳ Придумыватель прорабатывает твою идею... 1-2 минуты.', { parse_mode: 'HTML' });
    await ctx.sendChatAction('typing');

    const { getSelfImprovementSystem } = await import('./self-improvement');
    const sis = getSelfImprovementSystem();
    if (!sis) { await ctx.reply('❌ Система не запущена'); return; }

    // Run in background
    sis.submitUserIdea(trimmed).then(async (result) => {
      if (result === 'ok') {
        // notification already sent
      } else if (result === 'already_running') {
        await ctx.reply('⚠️ Уже запущен, подождите.').catch(() => {});
      } else {
        await ctx.reply(`❌ ${result}`).catch(() => {});
      }
    }).catch(e => console.warn('[Bot] submitUserIdea error:', e?.message || e));
    return;
  }

  // ── Proposal discussion (Product Engineer) ───────────────────
  if (pendingProposalDiscuss.has(userId)) {
    const proposalId = pendingProposalDiscuss.get(userId)!;

    if (trimmed.toLowerCase() === 'стоп' || trimmed.toLowerCase() === 'stop') {
      pendingProposalDiscuss.delete(userId);
      await ctx.reply('✅ Вышли из обсуждения.');
      return;
    }

    await ctx.sendChatAction('typing');
    try {
      // Load proposal from DB
      const { getAIProposalsRepository } = await import('./db/schema-extensions');
      const proposal = await getAIProposalsRepository().getById(proposalId);
      if (!proposal) {
        pendingProposalDiscuss.delete(userId);
        await ctx.reply('❌ Proposal не найден.');
        return;
      }

      // Ask Claude Code about the proposal with user's question
      const { claudeCodeChat } = await import('./ai-code-bridge');
      const result = await claudeCodeChat([
        { role: 'user', content:
          `Ты — AI Product Engineer платформы TON Agent Platform.\n\n` +
          `Владелец обсуждает с тобой фичу:\n` +
          `Название: ${proposal.title}\n` +
          `Описание: ${proposal.description}\n` +
          `Обоснование: ${proposal.reasoning || ''}\n\n` +
          `Вопрос/замечание владельца: "${trimmed}"\n\n` +
          `Ответь кратко и по делу на РУССКОМ языке. Если владелец хочет изменить фичу — предложи как.`
        }
      ], { maxTokens: 1000, timeout: 120_000 });

      await ctx.reply(result.text || 'Не удалось получить ответ.');
    } catch (e: any) {
      await ctx.reply('❌ Ошибка: ' + (e.message || String(e)).slice(0, 200));
    }
    return;
  }

  // ── Blocklist: add keywords ──────────────────────────────────
  if (pendingBlocklistAdd.has(userId)) {
    const agentId = pendingBlocklistAdd.get(userId)!;
    pendingBlocklistAdd.delete(userId);
    try {
      const { loadBlocklist, saveBlocklist } = require('./services/agent-hooks');
      const stateRepo = getAgentStateRepository();
      const bl = await loadBlocklist(stateRepo, agentId);
      const newKws = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      bl.keywords = [...new Set([...bl.keywords, ...newKws])];
      await saveBlocklist(stateRepo, agentId, userId, bl);
      await ctx.reply(`✅ Добавлено ${newKws.length} слов(а). Всего: ${bl.keywords.length}\n<code>${escHtml(bl.keywords.join(', '))}</code>`, { parse_mode: 'HTML' });
    } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
    return;
  }

  // ── Trigger: add keyword + context (2-step) ──────────────────
  if (pendingTriggerAdd.has(userId)) {
    const state = pendingTriggerAdd.get(userId)!;
    if (state.step === 'keyword') {
      state.keyword = trimmed;
      state.step = 'context';
      await ctx.reply(`🎯 Ключевое слово: <b>${escHtml(trimmed)}</b>\n\nТеперь отправьте контекст который нужно инжектить когда это слово встречается:`, { parse_mode: 'HTML' });
      return;
    }
    if (state.step === 'context') {
      pendingTriggerAdd.delete(userId);
      try {
        const { loadTriggers, saveTriggers } = require('./services/agent-hooks');
        const stateRepo = getAgentStateRepository();
        const triggers = await loadTriggers(stateRepo, state.agentId);
        triggers.push({
          id: String(Date.now()),
          keyword: state.keyword!,
          context: trimmed,
          enabled: true,
        });
        await saveTriggers(stateRepo, state.agentId, userId, triggers);
        await ctx.reply(`✅ Триггер добавлен!\n\n🔑 <b>${escHtml(state.keyword!)}</b>\n→ <i>${escHtml(trimmed.slice(0, 100))}</i>`, { parse_mode: 'HTML' });
      } catch (e: any) { await ctx.reply('❌ ' + (e.message || '').slice(0, 100)); }
      return;
    }
  }

  // ── Chat with AI agent ────────────────────────────────────────
  if (pendingAgentChats.has(userId)) {
    const agentId = pendingAgentChats.get(userId)!;
    const lang = getUserLang(userId);

    if (trimmed === '/stop_chat' || trimmed.toLowerCase() === 'стоп' || trimmed.toLowerCase() === '/stopchat') {
      pendingAgentChats.delete(userId);
      await ctx.reply(lang === 'ru' ? '✅ Вышли из чата с агентом.' : '✅ Exited agent chat.');
      return;
    }

    // Fetch agent data
    const agentRes = await getDBTools().getAgent(agentId, userId);
    if (!agentRes.success || !agentRes.data) {
      pendingAgentChats.delete(userId);
      await ctx.reply('❌ Агент не найден. Чат закрыт.');
      return;
    }
    const a = agentRes.data;

    if (a.triggerType === 'ai_agent') {
      // AI agent — route to agentic loop (mark as owner since they chat via bot)
      getRunnerAgent().sendMessageToAgent(agentId, trimmed, {
        senderId: userId,
        isOwner: true,
        username: ctx.from?.username || undefined,
        firstName: ctx.from?.first_name || undefined,
        lastName: ctx.from?.last_name || undefined,
      });
      await ctx.reply(lang === 'ru'
        ? '📨 Сообщение получено — агент ответит в ближайшее время.'
        : '📨 Message received — agent will reply shortly.'
      );
    } else {
      // Any other agent type — use universal AI chat (immediate response)
      await ctx.sendChatAction('typing');
      try {
        const tc = (a.triggerConfig as any) || {};
        const config: Record<string, any> = tc.config || {};
        const agentCode: string = tc.code || (a as any).code || '';

        const result = await universalAgentChat({
          agentName:        a.name || `Agent #${agentId}`,
          agentDescription: a.description || '',
          agentCode,
          agentType:        a.triggerType,
          config,
          userMessage:      trimmed,
        });

        // If AI returned new code — save it
        if (result.newCode) {
          await savePromptVersion(agentId, userId);
          const updateResult = await getDBTools().updateAgentCode(agentId, userId, result.newCode);
          if (updateResult.success) {
            await ctx.reply(result.reply + '\n\n✅ <i>Код агента обновлён платформой.</i>', { parse_mode: 'HTML' });
          } else {
            await ctx.reply(result.reply + '\n\n⚠️ <i>Не удалось сохранить код: ' + escHtml(updateResult.error || 'ошибка') + '</i>', { parse_mode: 'HTML' });
          }
        } else {
          await ctx.reply(result.reply, { parse_mode: 'HTML' }).catch(async () => {
            // Fallback: plain text if HTML parse fails
            await ctx.reply(result.reply);
          });
        }
      } catch (e: any) {
        const errMsg = e.message || String(e);
        const isKeyErr = /401|403|404|invalid.*key|unauthorized/i.test(errMsg);
        await safeReply(ctx,
          `❌ <b>Ошибка AI:</b> ${escHtml(errMsg.slice(0, 200))}\n\n` +
          (isKeyErr
            ? (lang === 'ru' ? '💡 <i>Проверьте API ключ в Профиль → 🔑 API ключи</i>' : '💡 <i>Check your API key in Profile → 🔑 API Keys</i>')
            : ''),
          { parse_mode: 'HTML' }
        );
      }
    }
    return;
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
      if (!isValidTonAddress(addr)) {
        await ctx.reply(lang === 'ru'
          ? '❌ Неверный формат адреса. Введите TON адрес (EQ... или UQ...):'
          : '❌ Invalid address format. Enter TON address (EQ... or UQ...):'
        );
        return;
      }
      // Save as wallet
      const profile = await getUserProfile(userId);
      await saveUserProfile(userId, { ...profile, wallet_address: addr });
      // If purpose is just linking, stop here
      if ((wState as any).purpose === 'link') {
        pendingWithdrawal.delete(userId);
        await ctx.reply(
          lang === 'ru'
            ? `✅ Кошелёк <code>${addr}</code> привязан к профилю.`
            : `✅ Wallet <code>${addr}</code> linked to your profile.`,
          { parse_mode: 'HTML' }
        );
        return;
      }
      pendingWithdrawal.set(userId, { step: 'enter_amount', address: addr });
      await ctx.reply(
        lang === 'ru'
          ? `✅ Кошелёк сохранён\n💰 Доступно: <b>${profile.balance_ton.toFixed(2)} TON</b>\n\nВведите сумму для вывода:`
          : `✅ Wallet saved\n💰 Available: <b>${profile.balance_ton.toFixed(2)} TON</b>\n\nEnter amount to withdraw:`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (wState.step === 'enter_amount') {
      const amount = parseFloat(trimmed.replace(',', '.'));
      const networkFee = 0.05;
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(lang === 'ru' ? '❌ Введите корректную сумму (например: 1.5)' : '❌ Enter a valid amount (e.g. 1.5)');
        return;
      }

      // Atomic balance check + deduct in a single DB transaction to prevent double-withdraw
      const toAddr = wState.address || (await getUserProfile(userId)).wallet_address || '';
      const walletShort = toAddr.slice(0, 12) + '…';
      const wdClient = await dbPool.connect();
      let deductedProfile: UserProfile | null = null;
      try {
        await wdClient.query('BEGIN');
        const { rows } = await wdClient.query(
          `SELECT value FROM builder_bot.user_settings WHERE user_id = $1 AND key = 'profile' FOR UPDATE`,
          [userId]
        );
        const profile: UserProfile = rows[0]?.value || { balance_ton: 0, total_earned: 0, wallet_address: null, joined_at: new Date().toISOString() };

        if (amount + networkFee > (profile.balance_ton || 0)) {
          await wdClient.query('ROLLBACK');
          await ctx.reply(lang === 'ru'
            ? `❌ Недостаточно средств. Доступно: ${(profile.balance_ton || 0).toFixed(2)} TON (комиссия сети ~${networkFee} TON)`
            : `❌ Insufficient funds. Available: ${(profile.balance_ton || 0).toFixed(2)} TON (network fee ~${networkFee} TON)`
          );
          return;
        }
        const maxWithdraw = (profile.balance_ton || 0) * WITHDRAW_MAX_PERCENT;
        if (amount > maxWithdraw) {
          await wdClient.query('ROLLBACK');
          await ctx.reply(lang === 'ru'
            ? `❌ Максимум ${(maxWithdraw).toFixed(2)} TON за один вывод (80% баланса). Остаток резервируется на комиссии.`
            : `❌ Max ${(maxWithdraw).toFixed(2)} TON per withdrawal (80% of balance). Remainder reserved for fees.`
          );
          return;
        }

        // Deduct balance atomically
        profile.balance_ton = Math.max(0, (profile.balance_ton || 0) - amount - networkFee);
        await wdClient.query(
          `INSERT INTO builder_bot.user_settings (user_id, key, value, updated_at)
           VALUES ($1, 'profile', $2::jsonb, NOW())
           ON CONFLICT ON CONSTRAINT user_settings_unique DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
          [userId, JSON.stringify(profile)]
        );
        await wdClient.query(
          `INSERT INTO builder_bot.balance_transactions (user_id, type, amount_ton, balance_after, description, status)
           VALUES ($1, 'withdraw', $2, $3, $4, 'completed')`,
          [userId, -(amount + networkFee), profile.balance_ton, `Withdraw to ${toAddr.slice(0,12)}...`]
        );
        await wdClient.query('COMMIT');
        deductedProfile = profile;
      } catch (txErr) {
        await wdClient.query('ROLLBACK').catch(() => {});
        await ctx.reply(lang === 'ru' ? '❌ Ошибка обработки. Попробуйте снова.' : '❌ Processing error. Please try again.');
        return;
      } finally {
        wdClient.release();
      }
      pendingWithdrawal.delete(userId);

      await safeReply(ctx,
        lang === 'ru'
          ? `${pe('hourglass')} <b>Отправка ${escHtml(amount.toFixed(2))} TON...</b>\nКошелёк: <code>${escHtml(walletShort)}</code>`
          : `${pe('hourglass')} <b>Sending ${escHtml(amount.toFixed(2))} TON...</b>\nWallet: <code>${escHtml(walletShort)}</code>`,
        { parse_mode: 'HTML' }
      );

      try {
        const result = await sendPlatformTransaction(toAddr, amount, `withdraw:${userId}`);
        if (result.ok) {
          // Record txHash in ledger
          try { await getBalanceTxRepository().record(userId, 'withdraw_confirmed', 0, 0, `txHash: ${result.txHash}`, result.txHash); } catch (e: any) { console.error('[CRITICAL] Withdrawal record failed:', e.message); }
          await safeReply(ctx,
            lang === 'ru'
              ? `${pe('check')} <b>Вывод выполнен!</b>\n\n` +
                `💸 Сумма: <b>${escHtml(amount.toFixed(2))} TON</b>\n` +
                `${pe('link')} Кошелёк: <code>${escHtml(walletShort)}</code>\n` +
                `🧾 Tx: <code>${escHtml(result.txHash || '')}</code>`
              : `${pe('check')} <b>Withdrawal complete!</b>\n\n` +
                `💸 Amount: <b>${escHtml(amount.toFixed(2))} TON</b>\n` +
                `${pe('link')} Wallet: <code>${escHtml(walletShort)}</code>\n` +
                `🧾 Tx: <code>${escHtml(result.txHash || '')}</code>`,
            { parse_mode: 'HTML' }
          );
        } else {
          // Rollback balance on failure
          await addUserBalance(userId, amount + networkFee, { type: 'refund', description: 'Withdraw failed, balance restored' });
          await safeReply(ctx,
            lang === 'ru'
              ? `❌ <b>Ошибка отправки</b>\n${escHtml(result.error || 'Unknown')}\n\nБаланс восстановлен.`
              : `❌ <b>Send failed</b>\n${escHtml(result.error || 'Unknown')}\n\nBalance restored.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (e: any) {
        // Rollback on exception
        await addUserBalance(userId, amount + networkFee, { type: 'refund', description: 'Withdraw exception, balance restored' });
        await safeReply(ctx,
          lang === 'ru'
            ? `❌ <b>Ошибка вывода</b>\n${escHtml(e.message || String(e))}\n\nБаланс восстановлен.`
            : `❌ <b>Withdrawal error</b>\n${escHtml(e.message || String(e))}\n\nBalance restored.`,
          { parse_mode: 'HTML' }
        );
      }
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
      cancelQRLogin(); // stop QR event listener if active
      complete2FAFns.delete(userId);
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
            `${pe('inbox')} <b>Код отправлен!</b>\n\n` +
            'Telegram отправил тебе код подтверждения.\n' +
            'Введи его здесь (5-6 цифр):\n\n' +
            '<i>Для отмены:</i> <code>/cancel</code>',
            { parse_mode: 'HTML' }
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
            `🎉 <b>Авторизован успешно!</b>\n\n` +
            `${pe('check')} Теперь доступны реальные данные Fragment:\n` +
            '• <code>/gifts</code> — топ подарков с floor ценами\n' +
            '• Спроси: <i>"floor цена jelly bunny"</i>\n' +
            '• Спроси: <i>"топ подарки Fragment сегодня"</i>',
            { parse_mode: 'HTML' }
          );
          // Continue setup wizard if active
          const setupW = pendingAgentSetup.get(userId);
          if (setupW) { setupW.tgAuthed = true; setupW.currentStep++; setTimeout(() => showSetupStep(ctx, userId).catch(() => {}), 1000); }
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
          `🎉 <b>Авторизован успешно!</b>\n\n` +
          `${pe('check')} Fragment данные доступны. Используй <code>/gifts</code>`,
          { parse_mode: 'HTML' }
        );
        // Continue setup wizard if active
        const setupPw = pendingAgentSetup.get(userId);
        if (setupPw) { setupPw.tgAuthed = true; setupPw.currentStep++; setTimeout(() => showSetupStep(ctx, userId).catch(() => {}), 1000); }
      } catch (e: any) {
        await ctx.reply('❌ Неверный пароль 2FA: ' + e.message + '\n\nПопробуй снова или /cancel');
      }
      return;
    }

    if (authStep === 'qr_waiting') {
      await ctx.reply(
        '🔳 Ожидаю сканирования QR-кода...\n\n' +
        '📱 Открой Telegram на другом устройстве → Настройки → Устройства → Подключить устройство\n\n' +
        'Для отмены: /cancel'
      );
      return;
    }

    if (authStep === 'qr_password') {
      const complete2FA = complete2FAFns.get(userId);
      if (!complete2FA) {
        pendingTgAuth.delete(userId);
        await ctx.reply('❌ Сессия истекла. Начни заново: /tglogin');
        return;
      }
      await ctx.sendChatAction('typing');
      const result = await complete2FA(trimmed);
      if (result.ok) {
        // Success message sent by .then() handler above
        pendingTgAuth.delete(userId);
        complete2FAFns.delete(userId);
      } else if (result.error?.includes('Неверный пароль')) {
        // Wrong password — restore fn so user can retry
        complete2FAFns.set(userId, complete2FA);
        await ctx.reply('❌ Неверный пароль. Попробуй ещё раз:\n\n<i>/cancel для отмены</i>', { parse_mode: 'HTML' });
      } else {
        pendingTgAuth.delete(userId);
        complete2FAFns.delete(userId);
        await ctx.reply(`❌ Ошибка: ${escHtml(result.error || 'unknown')}\n\nПопробуй /tglogin заново.`, { parse_mode: 'HTML' });
      }
      return;
    }
  }

  // ── Ожидаем переименование агента ─────────────────────────
  if (pendingRenames.has(userId)) {
    const agentId = pendingRenames.get(userId)!;
    if (trimmed.length < 1 || trimmed.length > 60) {
      await ctx.reply('❌ Название должно быть от 1 до 60 символов. Попробуйте снова.');
      return;
    }
    pendingRenames.delete(userId);
    try {
      const result = await getDBTools().updateAgent(agentId, userId, { name: trimmed });
      if (result.success) {
        await safeReply(ctx, `✅ <b>${escHtml(trimmed)}</b>  #${agentId}\n<i>Название обновлено</i>`, { parse_mode: 'HTML' });
        await showAgentMenu(ctx, agentId, userId);
      } else {
        await ctx.reply(`❌ Ошибка переименования: ${result.error || 'Неизвестная ошибка'}`);
      }
    } catch (e: any) {
      await safeReply(ctx, `❌ Ошибка: ${e.message || 'unknown'}`);
    }
    return;
  }

  // ── Ожидаем ввод данных плагина ──────────────────────────
  if (pendingPluginCreation.has(userId)) {
    const state = pendingPluginCreation.get(userId)!;
    if (state.step === 'name') {
      const name = trimmed.replace(/[^a-zA-Z0-9_\-]/g, '');
      if (name.length < 2 || name.length > 30) {
        await safeReply(ctx, '❌ Имя должно быть 2-30 символов (буквы, цифры, _, -).', {});
        return;
      }
      state.name = name;
      state.step = 'description';
      await safeReply(ctx, `✅ Имя: <b>${escHtml(name)}</b>\n\nТеперь введите краткое описание плагина:`, { parse_mode: 'HTML' });
      return;
    }
    if (state.step === 'description') {
      state.description = trimmed.slice(0, 200);
      state.step = 'code';
      await safeReply(ctx,
        `✅ Описание сохранено.\n\n` +
        `Теперь отправьте JavaScript код плагина (до 5KB).\n\n` +
        `<i>Доступные объекты: params (входные данные), state (хранилище), fetch, console.log</i>\n` +
        `<i>Функция должна вернуть результат через return.</i>`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    if (state.step === 'code') {
      pendingPluginCreation.delete(userId);
      const code = trimmed;
      if (code.length > 5120) {
        await safeReply(ctx, '❌ Код слишком большой (макс 5KB).', {});
        return;
      }
      // Basic security check
      const dangerous = ['process.', 'require(', 'child_process', '__dirname', '__filename', 'global.', 'eval(', 'globalThis', 'Function(', 'import(', 'global[', 'Proxy', 'Reflect', 'constructor'];
      const found = dangerous.find(d => code.includes(d));
      if (found) {
        await safeReply(ctx, `❌ Код содержит запрещённую конструкцию: <code>${escHtml(found)}</code>`, { parse_mode: 'HTML' });
        return;
      }
      try {
        const { getCustomPluginsRepository } = await import('./db/schema-extensions');
        await getCustomPluginsRepository().create(userId, state.name!, state.description!, code);
        await safeReply(ctx,
          `✅ <b>Плагин "${escHtml(state.name!)}" создан!</b>\n\n` +
          `Ваши AI-агенты теперь могут использовать его через инструмент <code>run_custom_plugin</code>.`,
          { parse_mode: 'HTML' }
        );
      } catch (e: any) {
        console.error('Plugin creation error:', e);
        await safeReply(ctx, '❌ Произошла ошибка при создании плагина. Попробуйте позже.');
      }
      return;
    }
  }

  // ── Онбординг: ожидаем API ключ (шаг apikey) или описание агента (шаг create_agent) ──
  if (pendingOnboarding.has(userId)) {
    const obState = pendingOnboarding.get(userId)!;
    const lang = getUserLang(userId);
    const ru = lang === 'ru';

    if (obState.step === 'apikey') {
      // Пользователь ввёл API ключ — валидируем
      await ctx.sendChatAction('typing');
      const provider = obState.provider || 'openai';
      const result = await validateApiKey(provider, trimmed);

      if (result.ok) {
        // Сохраняем ключ
        try {
          const repo = getUserSettingsRepository();
          const vars = ((await repo.getAll(userId)).user_variables as Record<string, any>) || {};
          vars.AI_API_KEY = encryptApiKey(trimmed);
          vars.AI_PROVIDER = provider;
          await repo.set(userId, 'user_variables', vars);
        } catch (e: any) { console.warn('[Settings] API key save error:', e.message); }

        await safeReply(ctx,
          `✅ <b>${ru ? 'Ключ проверен и сохранён!' : 'Key validated and saved!'}</b>\n` +
          `🤖 ${ru ? 'Провайдер:' : 'Provider:'} <b>${escHtml(PROVIDER_INFO[provider]?.name || provider)}</b>`,
          { parse_mode: 'HTML' }
        );

        // Переходим к шагу создания агента
        obState.step = 'create_agent';
        obState.apiKey = trimmed;
        setTimeout(() => showOnboardingStep(ctx, userId, lang).catch(() => {}), 800);
      } else {
        await safeReply(ctx,
          `❌ <b>${ru ? 'Ключ не прошёл проверку' : 'Key validation failed'}</b>\n` +
          `${escHtml(result.error || (ru ? 'Неизвестная ошибка' : 'Unknown error'))}\n\n` +
          `${ru ? 'Попробуйте ещё раз или нажмите ⏩ Пропустить.' : 'Try again or press ⏩ Skip.'}`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    if (obState.step === 'create_agent') {
      // Пользователь описал агента — создаём через оркестратор
      pendingOnboarding.delete(userId);

      // Route to orchestrator as normal agent creation
      const orch = getOrchestrator();
      await ctx.sendChatAction('typing');
      try {
        const result = await orch.processMessage(userId, trimmed, ctx.from?.username);
        if (result && result.content) {
          // Convert orchestrator buttons to inline keyboard format
          const inlineButtons = result.buttons?.map(b => [{ text: b.text, callback_data: b.callbackData }]);
          await safeReply(ctx, result.content, {
            parse_mode: 'HTML',
            ...(inlineButtons ? { reply_markup: { inline_keyboard: inlineButtons } } : {}),
            ...getMainMenu(lang),
          });
        }
        // Показываем пост-создание советы
        setTimeout(() => showPostCreationTips(ctx, userId).catch(() => {}), 3000);
      } catch (e: any) {
        await safeReply(ctx,
          `❌ ${ru ? 'Ошибка создания:' : 'Creation error:'} ${escHtml(e.message || String(e))}`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }
  }

  // ── Ожидаем глобальный API ключ ──────────────────────────
  // ── Agentic Wallet pending text handlers ──
  if (pendingWalletImport.has(userId)) {
    const pending = pendingWalletImport.get(userId)!;
    pendingWalletImport.delete(userId);
    try {
      const { getAgenticWalletService } = await import('./services/agentic-wallet');
      if (pending.type === 'address') {
        if (!isValidTonAddress(trimmed)) {
          await safeReply(ctx, '❌ Неверный формат адреса. Ожидается EQ... или UQ...', {});
          return;
        }
        const result = await getAgenticWalletService().setupRootWallet(userId, { address: trimmed });
        if (result.success) {
          await safeReply(ctx, `✅ Root wallet импортирован!\n📍 <code>${escHtml(trimmed)}</code>`, { parse_mode: 'HTML' });
        } else {
          await safeReply(ctx, `❌ ${result.error}`, {});
        }
      } else {
        // Mnemonic — delete user message for security
        try { await ctx.deleteMessage(); } catch {
          await safeReply(ctx, '⚠️ Не удалось удалить сообщение с мнемоникой. Удалите его вручную для безопасности!', {});
        }
        const words = trimmed.split(/\s+/);
        if (words.length !== 24) {
          await safeReply(ctx, '❌ Мнемоника должна содержать 24 слова.', {});
          return;
        }
        const result = await getAgenticWalletService().setupRootWallet(userId, { mnemonic: trimmed });
        if (result.success && result.wallet) {
          await safeReply(ctx, `✅ Root wallet импортирован!\n📍 <code>${escHtml(result.wallet.address)}</code>\n\n⚠️ Ваше сообщение с мнемоникой удалено из безопасности.`, { parse_mode: 'HTML' });
        } else {
          await safeReply(ctx, `❌ ${result.error}`, {});
        }
      }
    } catch (e: any) {
      await safeReply(ctx, '❌ ' + String(e), {});
    }
    return;
  }

  if (pendingWalletRename.has(userId)) {
    const pending = pendingWalletRename.get(userId)!;
    pendingWalletRename.delete(userId);
    try {
      const { getAgenticWalletService } = await import('./services/agentic-wallet');
      await getAgenticWalletService().setLabel(pending.walletId, userId, trimmed.slice(0, 50));
      await safeReply(ctx, `✅ Имя кошелька изменено на: ${trimmed.slice(0, 50)}`, {});
    } catch (e: any) {
      await safeReply(ctx, '❌ ' + String(e), {});
    }
    return;
  }

  if (pendingWalletLimit.has(userId)) {
    const pending = pendingWalletLimit.get(userId)!;
    const limitNum = parseFloat(trimmed);
    if (isNaN(limitNum) || limitNum <= 0) {
      await safeReply(ctx, '❌ Введите число больше 0.', {});
      return;
    }
    pendingWalletLimit.delete(userId);
    try {
      const { getAgenticWalletService } = await import('./services/agentic-wallet');
      await getAgenticWalletService().setSpendLimit(pending.walletId, userId, limitNum);
      await safeReply(ctx, `✅ Лимит установлен: ${limitNum} TON/день`, {});
    } catch (e: any) {
      await safeReply(ctx, '❌ ' + String(e), {});
    }
    return;
  }

  if (pendingApiKey.has(userId)) {
    const pending = pendingApiKey.get(userId)!;
    pendingApiKey.delete(userId);
    const lang = getUserLang(userId);
    try {
      // Detect provider from key pattern
      let detectedProvider = pending.provider || '';
      for (const { pattern, provider: p } of API_KEY_PATTERNS) {
        if (pattern.test(trimmed)) { detectedProvider = p; break; }
      }
      // Also support "provider=key" format
      const eqMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (eqMatch) {
        detectedProvider = eqMatch[1].toLowerCase();
        // trimmed becomes just the key
        const keyOnly = eqMatch[2].trim();
        const repo = getUserSettingsRepository();
        const vars = ((await repo.getAll(userId)).user_variables as Record<string, any>) || {};
        vars.AI_API_KEY = encryptApiKey(keyOnly);
        if (detectedProvider) vars.AI_PROVIDER = detectedProvider;
        await repo.set(userId, 'user_variables', vars);
      } else {
        const repo = getUserSettingsRepository();
        const vars = ((await repo.getAll(userId)).user_variables as Record<string, any>) || {};
        vars.AI_API_KEY = encryptApiKey(trimmed);
        if (detectedProvider) vars.AI_PROVIDER = detectedProvider;
        await repo.set(userId, 'user_variables', vars);
      }
      await safeReply(ctx,
        `✅ ${lang === 'ru' ? 'Глобальный API ключ сохранён!' : 'Global API key saved!'}\n` +
        (detectedProvider ? `🤖 ${lang === 'ru' ? 'Провайдер:' : 'Provider:'} <b>${escHtml(detectedProvider)}</b>` : ''),
        { parse_mode: 'HTML' }
      );
      // Continue setup wizard if active
      const setupApiW = pendingAgentSetup.get(userId);
      if (setupApiW) { setupApiW.hasApiKey = true; setupApiW.currentStep++; setTimeout(() => showSetupStep(ctx, userId).catch(() => {}), 1000); }
    } catch (e: any) {
      await ctx.reply('❌ ' + (e.message || String(e)));
    }
    return;
  }

  // ── Pending feedback ──
  const _fb = pendingFeedback.get(userId);
  if (_fb && Date.now() - _fb.startTs < 10 * 60_000) {
    pendingFeedback.delete(userId);
    const ru = getUserLang(userId) === 'ru';
    try {
      const { pool } = require('./db');
      await pool.query(
        `INSERT INTO builder_bot.feedback (user_id, username, type, message) VALUES ($1, $2, $3, $4)`,
        [userId, ctx.from?.username || '', _fb.type, text]
      );
      // Notify admins
      const admins = await pool.query(`SELECT telegram_id FROM builder_bot.platform_admins`);
      for (const a of admins.rows) {
        try { await bot.telegram.sendMessage(a.telegram_id, `📝 Новый ${_fb.type}: ${text.slice(0, 200)}\nОт: @${ctx.from?.username || userId}`); } catch {}
      }
      // Award beta points
      let rewardMsg = '';
      try {
        const { isBetaTester, awardFeedbackPoints } = require('./payments');
        if (isBetaTester(userId)) {
          const reward = await awardFeedbackPoints(userId, _fb.type);
          rewardMsg = `\n🏆 +${reward.points} ${ru ? 'очков' : 'pts'} (${ru ? 'всего' : 'total'}: ${reward.total})`;
          if (reward.reward === 'bonus_gens') rewardMsg += `\n🎁 ${ru ? 'Бонус: +20 генераций!' : 'Bonus: +20 generations!'}`;
          if (reward.reward === 'pro') rewardMsg += `\n🎉 ${ru ? 'Апгрейд до Pro!' : 'Upgraded to Pro!'}`;
          if (reward.reward === 'unlimited') rewardMsg += `\n💎 ${ru ? 'Апгрейд до Unlimited!' : 'Upgraded to Unlimited!'}`;
        }
      } catch {}
      await safeReply(ctx, (ru ? '✅ Фидбек отправлен! Мы свяжемся с вами.' : '✅ Feedback sent! We will get back to you.') + rewardMsg);
    } catch (e: any) { await safeReply(ctx, `❌ ${e.message}`); }
    return;
  }
  if (_fb) pendingFeedback.delete(userId); // expired

  // ── Ожидаем запрос на редактирование агента ───────────────
  if (pendingEdits.has(userId)) {
    const agentId = pendingEdits.get(userId)!;
    pendingEdits.delete(userId);
    if (checkRateLimit(userId)) {
      await ctx.reply('⚠️ Слишком много операций. Подождите минуту.').catch(() => {});
      return;
    }
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) {
      await ctx.reply('❌ Агент не найден'); return;
    }

    // ── Smart config-change detection (no code regeneration needed) ───
    const tonAddrMatch = trimmed.match(/[EUk][Qq][0-9A-Za-z_\-]{46}/);
    const configUpdateMap: Record<string, string> = {};

    // ── API Key auto-detection ─────────────────────────────────────
    // Распознаём ключи по паттерну и сохраняем в config агента
    let detectedKey = '';
    let detectedProvider = '';
    for (const { pattern, provider } of API_KEY_PATTERNS) {
      const km = trimmed.match(pattern);
      if (km) { detectedKey = km[0]; detectedProvider = provider; break; }
    }

    // Также ищем формат "provider=KEY" или "provider KEY" или "ключ=KEY"
    if (!detectedKey) {
      const eqMatch = trimmed.match(/(?:api|апи|ключ|key|gemini|openai|groq|anthropic|deepseek)\s*[=:]\s*([A-Za-z0-9_\-]{20,})/i);
      if (eqMatch) {
        detectedKey = eqMatch[1];
        // Определяем провайдер по контексту
        if (/gemini|google|гемини/i.test(trimmed)) detectedProvider = 'Gemini';
        else if (/openai|gpt|опенай/i.test(trimmed)) detectedProvider = 'OpenAI';
        else if (/groq|грок/i.test(trimmed)) detectedProvider = 'Groq';
        else if (/anthropic|claude|клод/i.test(trimmed)) detectedProvider = 'Anthropic';
        else if (/deepseek|дипсик/i.test(trimmed)) detectedProvider = 'DeepSeek';
        else if (/openrouter/i.test(trimmed)) detectedProvider = 'OpenRouter';
        else if (detectedKey.startsWith('AIzaSy')) detectedProvider = 'Gemini';
        else detectedProvider = 'OpenAI'; // default
      }
    }

    if (detectedKey && detectedProvider) {
      configUpdateMap['AI_API_KEY'] = detectedKey;
      configUpdateMap['AI_PROVIDER'] = detectedProvider;
    }

    if (tonAddrMatch && /коллекц|collection|адрес|nft|нфт/i.test(trimmed)) {
      configUpdateMap['TARGET_COLLECTIONS'] = tonAddrMatch[0];
    }
    const maxPriceMatch = trimmed.match(/(?:макс(?:имал)?(?:ьн(?:ая|ую|ой)?)?[^\d]*)?(\d+(?:[.,]\d+)?)\s*(?:тон|ton)\b.*(?:цен|price|покупк|buy)/i)
      || trimmed.match(/(?:цен|price|покупк|buy)[^\d]*(\d+(?:[.,]\d+)?)/i)
      || trimmed.match(/max[^\d]*(\d+(?:[.,]\d+)?)/i);
    if (maxPriceMatch && /(?:макс|max|максимал|покупк)/i.test(trimmed)) {
      configUpdateMap['MAX_BUY_PRICE_TON'] = maxPriceMatch[1].replace(',', '.');
    }
    const limitMatch = trimmed.match(/(?:лимит|limit|дневн|daily)[^\d]*(\d+(?:[.,]\d+)?)/i);
    if (limitMatch) configUpdateMap['DAILY_LIMIT_TON'] = limitMatch[1].replace(',', '.');
    const profitMatch = trimmed.match(/(?:профит|profit|прибыл|markup)[^\d]*(\d+(?:[.,]\d+)?)/i);
    if (profitMatch) configUpdateMap['MIN_PROFIT_PCT'] = profitMatch[1].replace(',', '.');
    const sellMarkupMatch = trimmed.match(/(?:продаж|sell|наценк)[^\d]*(\d+(?:[.,]\d+)?)/i);
    if (sellMarkupMatch) configUpdateMap['SELL_MARKUP_PCT'] = sellMarkupMatch[1].replace(',', '.');

    if (Object.keys(configUpdateMap).length > 0) {
      // Apply all config updates via jsonb_set without touching the code
      try {
        let updateQuery = 'SELECT trigger_config FROM builder_bot.agents WHERE id = $1 AND user_id = $2';
        const res = await dbPool.query(updateQuery, [agentId, userId]);
        const currentTriggerConfig = res.rows[0]?.trigger_config || {};
        const currentConfig: Record<string, any> = (typeof currentTriggerConfig === 'object' && currentTriggerConfig?.config)
          ? { ...currentTriggerConfig.config }
          : {};

        for (const [k, v] of Object.entries(configUpdateMap)) {
          currentConfig[k] = v;
        }

        const newTriggerConfig = { ...currentTriggerConfig, config: currentConfig };
        await dbPool.query(
          'UPDATE builder_bot.agents SET trigger_config = $1::jsonb WHERE id = $2 AND user_id = $3',
          [JSON.stringify(newTriggerConfig), agentId, userId]
        );

        const changesDesc = Object.entries(configUpdateMap)
          .map(([k, v]) => `<b>${escHtml(k)}</b> → <code>${escHtml(v)}</code>`)
          .join('\n');
        await safeReply(ctx,
          `${pe('check')} <b>Конфигурация обновлена!</b>\n${div()}\n${changesDesc}\n\n<i>Код агента не изменён. Перезапустите агента для применения.</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Запустить', callback_data: `run_agent:${agentId}` },
                { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` },
              ]],
            },
          }
        );
      } catch (e: any) {
        console.error('Config update error:', e);
        await safeReply(ctx, '❌ Произошла ошибка при обновлении конфигурации. Попробуйте позже.');
      }
      return;
    }
    // ── End smart config detection ────────────────────────────────────

    const anim = await startCreationAnimation(ctx, 'редактирование', true);
    try {
      const fixResult = await getCodeTools().modifyCode({
        currentCode: agentResult.data.code,
        modificationRequest: trimmed,
        preserveLogic: true,
      });
      anim.stop();
      if (!fixResult.success || !fixResult.data) {
        await safeReply(ctx, `❌ AI не смог изменить код: ${escHtml(fixResult.error || 'Unknown')}`, { parse_mode: 'HTML' });
        return;
      }
      await savePromptVersion(agentId, userId);
      const saveResult = await getDBTools().updateAgentCode(agentId, userId, fixResult.data.code);
      if (saveResult.success) {
        await safeReply(ctx,
          `${pe('check')} <b>Агент обновлён!</b>\n` +
          `${div()}\n` +
          `<b>${escHtml(agentResult.data.name)}</b>  #${escHtml(String(agentId))}\n` +
          `${pe('wrench')} ${escHtml(fixResult.data.changes.slice(0, 180))}\n\n` +
          `<i>Запустите агента чтобы проверить изменения</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Запустить', callback_data: `run_agent:${agentId}` },
                { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` },
              ]],
            },
          }
        );
      } else {
        await safeReply(ctx, `❌ Не удалось сохранить: ${escHtml(saveResult.error || 'Unknown')}`);
      }
    } catch (err: any) {
      anim.stop();
      console.error('Agent edit error:', err);
      await safeReply(ctx, '❌ Произошла ошибка при редактировании. Попробуйте позже.');
    }
    return;
  }

  // ── Template variable wizard: collect user input ─────────
  if (pendingTemplateSetup.has(userId)) {
    if (_wizardLock.has(userId)) return; // prevent double-processing
    _wizardLock.add(userId);
    try {
      const state = pendingTemplateSetup.get(userId)!;
      const t = allAgentTemplates.find(x => x.id === state.templateId);
      if (t && state.remaining.length > 0) {
        const currentKey = state.remaining[0];
        const placeholder = t.placeholders.find(p => p.name === currentKey);
        const lang = getUserLang(userId);
        // If placeholder uses option buttons — ignore text input
        if (placeholder?.options && placeholder.options.length > 0) {
          await ctx.reply(lang === 'ru' ? '👆 Нажмите одну из кнопок выше' : '👆 Please tap one of the buttons above');
          return;
        }
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
    } finally {
      _wizardLock.delete(userId);
    }
  }

  // ── Ожидаем название листинга от пользователя ─────────────
  if (pendingPublish.has(userId)) {
    const pp = pendingPublish.get(userId)!;
    if (pp.step === 'name') {
      try {
        pendingPublish.delete(userId);
        await doPublishAgent(ctx, userId, pp.agentId, pp.price, trimmed.slice(0, 60));
      } catch (e: any) {
        console.error(`[bot] doPublishAgent failed:`, e.message);
        await ctx.reply('❌ Ошибка публикации. Попробуйте ещё раз.').catch(() => {});
      }
      return;
    }
    // Unexpected step value — log and clean up
    console.warn(`[bot] pendingPublish unexpected step '${pp.step}' for user ${userId}, clearing state`);
    pendingPublish.delete(userId);
  }

  // ── Ожидаем название агента от пользователя ────────────────
  if (pendingNameAsk.has(userId)) {
    const pna = pendingNameAsk.get(userId)!;
    pendingNameAsk.delete(userId);
    const lang = getUserLang(userId);
    if (trimmed.length < 2 || trimmed.length > 60) {
      pendingNameAsk.set(userId, pna); // restore state
      const hint = lang === 'ru'
        ? `❌ Название должно быть от 2 до 60 символов (сейчас ${trimmed.length}).\nВведите другое или нажмите <b>Пропустить</b>.`
        : `❌ Name must be 2-60 characters (got ${trimmed.length}).\nTry another or tap <b>Skip</b>.`;
      await ctx.reply(hint, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '⏩ Пропустить', callback_data: 'skip_name' }],
      ] } }).catch(() => {});
      return;
    }
    const customName: string | undefined = trimmed;
    if (checkRateLimit(userId)) {
      await ctx.reply('⚠️ Слишком много операций. Подождите минуту.').catch(() => {});
      return;
    }
    // Сразу создаём агента — без выбора расписания
    const nameLabel = `📛 <b>${escHtml(customName)}</b> — отлично!`;
    await ctx.reply(nameLabel, { parse_mode: 'HTML' }).catch(() => {});
    const anim = await startCreationAnimation(ctx, '', true);
    const descWithName = customName ? `${pna.description}\n\nНазвание: ${customName}` : pna.description;
    try {
      const result = await getOrchestrator().processMessage(userId, descWithName, ctx.from.username, customName);
      anim.stop(); anim.deleteMsg();
      await sendResult(ctx, result);
    } catch (err) {
      anim.stop(); anim.deleteMsg();
      await ctx.reply('❌ Ошибка создания агента. Попробуйте ещё раз.').catch(() => {});
    }
    return;
  }

  // ── Если есть pending создания — сбрасываем ────────────────
  if (pendingCreations.has(userId)) {
    pendingCreations.delete(userId);
  }

  // ── Валидация: мусорный ввод ───────────────────────────────
  if (isGarbageInput(trimmed)) {
    await ctx.reply(
      `${pe('question')} Не понимаю запрос.\n\n` +
      `Опишите задачу словами, например:\n` +
      `<i>"Следи за ценой TON и уведоми если выше $6"</i>\n` +
      `<i>"Создай агента который проверяет баланс кошелька каждый час"</i>\n` +
      `<i>"Запусти агента #3"</i>`,
      { parse_mode: 'HTML' }
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
    const previewTask = text.replace(/[_*`[\]]/g, '').slice(0, 120) + (text.length > 120 ? '…' : '');
    await ctx.reply(
      `📛 <b>Как назвать агента?</b>\n\n` +
      `📝 <i>"${escHtml(previewTask)}"</i>\n\n` +
      `Введите короткое название или нажмите <b>Пропустить</b> — придумаю сам:`,
      {
        parse_mode: 'HTML',
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
    anim?.stop();
    anim?.deleteMsg();
    await sendResult(ctx, result);
  } catch (err) {
    anim?.stop();
    anim?.deleteMsg();
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
  setupNeeds?: AgentSetupNeeds;
  wizardTemplateId?: string;
  wizardPrefilled?: Record<string, string>;
}) {
  // ── wizard_required: запускаем wizard шаблона с pre-filled значениями ──
  if (result.type === 'wizard_required' && result.wizardTemplateId) {
    const userId = (ctx.from as any)?.id;
    if (!userId) return;
    const t = allAgentTemplates.find(x => x.id === result.wizardTemplateId);
    if (!t) {
      await safeReply(ctx, '❌ Шаблон не найден', { parse_mode: 'HTML' });
      return;
    }
    const prefilled = result.wizardPrefilled || {};
    // Remaining = all placeholders except pre-filled ones
    const remaining = t.placeholders
      .filter(p => !prefilled[p.name])
      .map(p => p.name);

    if (remaining.length === 0) {
      // All vars pre-filled — create immediately
      await doCreateAgentFromTemplate(ctx, t.id, userId, prefilled);
      return;
    }

    // Start wizard with pre-filled data
    pendingTemplateSetup.set(userId, {
      templateId: t.id,
      collected: { ...prefilled },
      remaining,
    });
    await promptNextTemplateVar(ctx, userId, pendingTemplateSetup.get(userId)!);
    return;
  }

  const content = sanitize(result.content);
  if (!content) return;

  const inlineKeyboard = result.buttons?.map((b) => [
    { text: b.text, callback_data: b.callbackData },
  ]);
  const extra: any = inlineKeyboard?.length ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {};

  const MAX = 4000;
  if (content.length > MAX) {
    // Первую часть редактируем (или отправляем), остаток — всегда новое сообщение
    await editOrReply(ctx, content.slice(0, MAX), { parse_mode: 'HTML', ...extra });
    if (content.slice(MAX).trim()) await ctx.reply(content.slice(MAX)).catch(() => {});
  } else {
    await editOrReply(ctx, content, { parse_mode: 'HTML', ...extra });
  }

  // After agent creation — track for iterative refinement + start smart setup wizard
  if (result.type === 'agent_created' && result.agentId) {
    const uid = (ctx.from as any)?.id;
    if (uid) {
      pendingRefinements.set(uid, result.agentId);
      setLastInteractedAgent(uid, result.agentId);
    }
  }
  if (result.type === 'agent_created' && result.agentId && result.setupNeeds) {
    const uid = (ctx.from as any)?.id;
    if (uid) {
      const needs = result.setupNeeds;
      const hasSetupNeeds = (needs.tgAuth && !needs.tgAuthed) || needs.wallet || needs.apiKey;
      if (hasSetupNeeds) {
        // Build setup steps list
        const steps: Array<'tg_auth' | 'wallet' | 'api_key'> = [];
        if (needs.tgAuth && !needs.tgAuthed) steps.push('tg_auth');
        if (needs.wallet) steps.push('wallet');
        if (needs.apiKey) steps.push('api_key');
        pendingAgentSetup.set(uid, {
          agentId: result.agentId,
          steps,
          currentStep: 0,
          tgAuthed: needs.tgAuthed,
          hasApiKey: needs.hasApiKey,
          walletCreated: false,
        });
        // Auto-trigger setup after short delay
        setTimeout(async () => {
          try { await showSetupStep(ctx, uid); } catch {}
        }, 1500);
      } else {
        // No setup needed — just offer capabilities config
        const lang = getUserLang(uid);
        const ru = lang === 'ru';
        setTimeout(async () => {
          try {
            await ctx.reply(
              ru ? '🧩 Хотите настроить возможности агента? По умолчанию включены все.' : '🧩 Want to configure agent capabilities? All enabled by default.',
              { reply_markup: { inline_keyboard: [
                [{ text: `🧩 ${ru ? 'Настроить возможности' : 'Configure capabilities'}`, callback_data: `agent_caps_menu:${result.agentId}` }],
                [{ text: `✅ ${ru ? 'Оставить все' : 'Keep all'}`, callback_data: `agent_cap_done:${result.agentId}` }],
              ] } }
            );
          } catch {}
        }, 1500);
      }
    }
  }
}

// ============================================================
// Post-creation setup wizard — guides user through TG auth, wallet, API keys
// ============================================================
async function showSetupStep(ctx: Context, userId: number) {
  const setup = pendingAgentSetup.get(userId);
  if (!setup || setup.currentStep >= setup.steps.length) {
    // All done — start agent
    if (setup) {
      pendingAgentSetup.delete(userId);
      await finishSetupAndStart(ctx, setup.agentId, userId);
    }
    return;
  }

  const step = setup.steps[setup.currentStep];
  const agentId = setup.agentId;
  const ru = getUserLang(userId) === 'ru';
  const total = setup.steps.length;
  const current = setup.currentStep + 1;
  const progress = `[${current}/${total}]`;

  if (step === 'tg_auth') {
    await ctx.reply(
      `${progress} 🔐 <b>${ru ? 'Авторизация Telegram' : 'Telegram Authorization'}</b>\n\n` +
      `${ru
        ? 'Ваш агент использует Telegram-инструменты (сообщения, каналы, торговля подарками).\n\nДля работы нужна авторизация через MTProto — это безопасный вход в ваш Telegram-аккаунт.'
        : 'Your agent uses Telegram tools (messages, channels, gift trading).\n\nMTProto authorization is needed — a secure login to your Telegram account.'
      }\n\n` +
      `${ru ? '<i>Рекомендуется QR-код (быстро и безопасно)</i>' : '<i>QR code is recommended (fast & secure)</i>'}`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: `📱 ${ru ? 'QR-код (рекомендуется)' : 'QR Code (recommended)'}`, callback_data: `setup_tg_qr:${agentId}` }],
        [{ text: `📞 ${ru ? 'По номеру телефона' : 'By phone number'}`, callback_data: `setup_tg_phone:${agentId}` }],
        [{ text: `⏩ ${ru ? 'Пропустить' : 'Skip'}`, callback_data: `setup_skip:${agentId}` }],
      ] } }
    );
  } else if (step === 'wallet') {
    await ctx.reply(
      `${progress} 💰 <b>${ru ? 'Кошелёк TON' : 'TON Wallet'}</b>\n\n` +
      `${ru
        ? 'Агент может отправлять TON/жетоны и совершать покупки.\n\nСоздадим для него отдельный кошелёк? Вы сможете пополнить его позже.'
        : 'Your agent can send TON/jettons and make purchases.\n\nCreate a dedicated wallet? You can fund it later.'
      }`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: `💰 ${ru ? 'Создать кошелёк' : 'Create wallet'}`, callback_data: `setup_wallet_create:${agentId}` }],
        [{ text: `⏩ ${ru ? 'Пропустить' : 'Skip'}`, callback_data: `setup_skip:${agentId}` }],
      ] } }
    );
  } else if (step === 'api_key') {
    await ctx.reply(
      `${progress} 🔑 <b>${ru ? 'API ключ AI' : 'AI API Key'}</b>\n\n` +
      `${ru
        ? 'Для работы агента нужен API ключ AI-провайдера.\n\nВыберите провайдера и введите ключ:'
        : 'An AI provider API key is required for the agent to work.\n\nChoose a provider and enter your key:'
      }`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🟢 OpenAI', callback_data: `setup_apikey:${agentId}:openai` },
         { text: '🔵 Anthropic', callback_data: `setup_apikey:${agentId}:anthropic` }],
        [{ text: '🟡 Gemini', callback_data: `setup_apikey:${agentId}:gemini` },
         { text: '⚡ Groq', callback_data: `setup_apikey:${agentId}:groq` }],
        [{ text: '🌐 OpenRouter', callback_data: `setup_apikey:${agentId}:openrouter` },
         { text: '🐋 DeepSeek', callback_data: `setup_apikey:${agentId}:deepseek` }],
        [{ text: `⏩ ${ru ? 'Позже' : 'Later'}`, callback_data: `setup_skip:${agentId}` }],
      ] } }
    );
  }
}

async function finishSetupAndStart(ctx: Context, agentId: number, userId: number) {
  const ru = getUserLang(userId) === 'ru';
  await ctx.reply(
    `✅ <b>${ru ? 'Настройка завершена!' : 'Setup complete!'}</b>\n\n` +
    `${ru ? 'Запускаю агента...' : 'Starting agent...'}`,
    { parse_mode: 'HTML' }
  );
  // Auto-start the agent
  await runAgentDirect(ctx, agentId, userId);
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
        `⏸ <b>Агент остановлен</b>\n` +
        `${div()}\n` +
        `<b>${escHtml(agent.name)}</b>  #${agentId}\n` +
        `<i>Scheduler деактивирован</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Запустить снова', callback_data: `run_agent:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }
      );
    } else {
      await editOrReply(ctx, `❌ Ошибка остановки: ${escHtml(pauseResult.error || '')}`, { parse_mode: 'HTML' });
    }
    return;
  }

  // Запускаем агента — используем editOrReply для статус-сообщения (редактируем кнопку вместо нового)
  const cbMsgId = (ctx.callbackQuery as any)?.message?.message_id;
  const chatId = ctx.chat!.id;

  await editOrReply(ctx,
    `${pe('rocket')} <b>Запускаю агента...</b>\n\n` +
    `<b>${escHtml(agent.name)}</b> #${agentId}\n` +
    `${pe('hourglass')} Выполняется... подождите`,
    { parse_mode: 'HTML' }
  );

  // Вспомогательная функция редактирования статус-сообщения
  const editStatus = async (text: string, extra?: object) => {
    if (cbMsgId) {
      await ctx.telegram.editMessageText(chatId, cbMsgId, undefined, text, { parse_mode: 'HTML', ...extra }).catch(() => {});
    } else {
      await safeReply(ctx, text, { parse_mode: 'HTML', ...extra });
    }
  };

  // legacy statusMsg совместимость (нужен для дальнейшего кода)
  const statusMsg: any = cbMsgId ? { message_id: cbMsgId } : null;

  await ctx.sendChatAction('typing');

  try {
    const runResult = await getRunnerAgent().runAgent({ agentId, userId });

    if (!runResult.success) {
      // Редактируем сообщение вместо нового (умное редактирование - задача 1)
      const errText = `❌ <b>Ошибка запуска</b>\n\n${escHtml(runResult.error || 'Неизвестная ошибка')}`;
      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, errText, { parse_mode: 'HTML' }).catch(() => ctx.reply(errText.replace(/<[^>]+>/g, '')));
      }
      return;
    }

    const data = runResult.data!;

    if (data.isScheduled) {
      const successText =
        `${pe('check')} <b>Агент запущен!</b>\n` +
        `${div()}\n` +
        `<b>${escHtml(agent.name)}</b>  #${agentId}\n` +
        `🟢 Работает 24/7 · сервер\n` +
        `${pe('bolt')} <i>Первое уведомление придёт в ближайшее время</i>`;

      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, successText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Логи', callback_data: `show_logs:${agentId}` }, { text: '⏸ Остановить', callback_data: `run_agent:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }).catch(() => ctx.reply(successText.replace(/<[^>]+>/g, '')));
      }
    } else {
      // Однократный запуск — показываем результат
      const exec = data.executionResult;
      let resultText = `${pe('check')} <b>Агент выполнен!</b>\n${div()}\n<b>${escHtml(agent.name)}</b>  #${agentId}\n`;

      if (exec) {
        resultText += `⏱ Время: ${exec.executionTime}ms\n`;
        if (exec.success) {
          const rawResult = exec.result;
          if (rawResult !== undefined && rawResult !== null) {
            resultText += `\n${pe('chart')} <b>Результат:</b>\n${div()}\n`;
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
                  resultText += `<code>${escHtml(k)}</code> → ${escHtml(v.slice(0, 100))}\n`;
                });
              } else {
                resultText += `<i>(пустой объект)</i>\n`;
              }
            } else if (Array.isArray(rawResult)) {
              resultText += `<i>Массив: ${escHtml(String((rawResult as any[]).length))} элементов</i>\n`;
              (rawResult as any[]).slice(0, 5).forEach((item, i) => {
                resultText += `  ${i + 1}. ${escHtml(String(item).slice(0, 80))}\n`;
              });
            } else {
              resultText += `${escHtml(String(rawResult).slice(0, 400))}\n`;
            }
          } else {
            resultText += `\n<i>✅ Агент выполнен успешно</i>\n`;
          }
        } else {
          resultText += `\n❌ <b>Ошибка:</b> ${escHtml(exec.error || 'Unknown')}`;
        }
        if (exec.logs?.length > 0) {
          resultText += `\n📝 <b>Логи (${exec.logs.length}):</b>\n`;
          exec.logs.slice(-5).forEach(log => {
            const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : '✅';
            resultText += `${icon} ${escHtml(String(log.message).slice(0, 100))}\n`;
          });
        }
      }

      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, resultText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Запустить снова', callback_data: `run_agent:${agentId}` }, { text: '📋 Все логи', callback_data: `show_logs:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }).catch(() => ctx.reply(resultText.replace(/<[^>]+>/g, '')));
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
    let logs: any[] = [];

    // Try DB logs first (works for AI agents)
    try {
      const { getAgentLogsRepository } = await import('./db/schema-extensions');
      const dbLogs = await getAgentLogsRepository().getByAgent(agentId, 20);
      logs = dbLogs.map(r => ({
        level: r.level,
        message: r.message,
        timestamp: r.createdAt,
      }));
    } catch {}

    // Fallback to in-memory runner logs
    if (!logs.length) {
      const logsResult = await getRunnerAgent().getLogs(agentId, userId, 20);
      if (logsResult.success && logsResult.data?.logs?.length) {
        logs = logsResult.data.logs;
      }
    }

    if (!logs.length) {
      await ctx.reply(
        `📋 <b>Логи агента #${agentId}</b>\n\nЛоги пусты — агент ещё не запускался или логи удалены`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }, { text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }]] },
        }
      );
      return;
    }

    let text = `📋 <b>Логи агента #${agentId}</b> (последние ${logs.length}):\n\n`;
    logs.slice(-15).forEach(log => {
      const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️';
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      text += `${icon} <code>${escHtml(time)}</code> ${escHtml(String(log.message).slice(0, 120))}\n`;
    });

    await safeReply(ctx, text, {
      parse_mode: 'HTML',
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
    console.log(`[showAgentsList] userId=${userId}`);
    const r = await getDBTools().getUserAgents(userId);
    console.log(`[showAgentsList] result: success=${r.success} count=${r.data?.length || 0} error=${r.error || ''}`);
    if (!r.success || !r.data?.length) {
      await editOrReply(ctx,
        `${pe('robot')} <b>Ваши агенты</b>\n\n` +
        `У вас пока нет агентов.\n\n` +
        `<b>Чтобы создать агента:</b>\n` +
        `• Напишите задачу своими словами\n` +
        `• Выберите готовый шаблон в Маркетплейсе\n\n` +
        `<i>Примеры: "проверяй баланс кошелька каждый час", "следи за ценой TON"</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `${peb('store')} Маркетплейс шаблонов`, callback_data: 'marketplace' }],
              [{ text: `${peb('plus')} Создать с описанием`, callback_data: 'create_agent_prompt' }],
            ],
          },
        }
      );
      return;
    }
    const agents = r.data;
    const active = agents.filter(a => a.isActive).length;

    let text = `${pe('robot')} <b>Ваши агенты</b>\n`;
    text += `${div()}\n`;
    text += `Всего: <b>${agents.length}</b>  ${pe('green')} Активных: <b>${active}</b>\n`;
    text += `${div()}\n\n`;

    agents.forEach((a) => {
      const st = a.isActive ? pe('green') : '⏸';
      const trIcon = a.triggerType === 'scheduled' ? pe('calendar') : a.triggerType === 'webhook' ? pe('link') : pe('bolt');
      const name = escHtml((a.name || '').slice(0, 28));
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
      text += `${st} <b>#${a.id}</b> ${name}\n`;
      text += `   ${trIcon}${escHtml(schedLabel)}  <i>${ageLabel}</i>\n\n`;
    });

    const btns = agents.slice(0, 8).map((a) => [{
      text: `${a.isActive ? peb('green') : '⏸'} #${a.id} ${(a.name || '').slice(0, 24)}`,
      callback_data: `agent_menu:${a.id}`,
    }]);
    btns.push([
      { text: `${peb('plus')} Создать нового`, callback_data: 'create_agent_prompt' },
      { text: `${peb('store')} Маркетплейс`, callback_data: 'marketplace' },
    ]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
  } catch (err) {
    console.error('showAgentsList error:', err);
    await ctx.reply('❌ Ошибка загрузки агентов. Попробуйте /start');
  }
}

// ============================================================
// Меню возможностей агента (capabilities toggle)
// ============================================================
const CAPABILITY_LABELS: Record<string, { icon: string; ru: string; en: string }> = {
  // ── Блокчейн / финансы ─────────────────────────────────────────────────
  wallet:            { icon: '💰', ru: 'Кошелёк TON', en: 'TON Wallet' },
  blockchain:        { icon: '⛓', ru: 'Блокчейн TON', en: 'TON Blockchain' },
  defi:              { icon: '🔄', ru: 'DeFi / DEX', en: 'DeFi / DEX' },
  nft:               { icon: '🖼', ru: 'NFT анализ', en: 'NFT Analysis' },
  dns:               { icon: '🔑', ru: 'TON DNS', en: 'TON DNS' },
  payments:          { icon: '💳', ru: 'Платежи', en: 'Payments' },
  // ── Подарки / маркет ───────────────────────────────────────────────────
  gifts:             { icon: '🎁', ru: 'Подарки (базовые)', en: 'Gifts (basic)' },
  gifts_market:      { icon: '📊', ru: 'Рынок подарков', en: 'Gift Market' },
  // ── Telegram ───────────────────────────────────────────────────────────
  telegram:          { icon: '📱', ru: 'Telegram', en: 'Telegram' },
  telegram_admin:    { icon: '🛡', ru: 'TG Администрирование', en: 'TG Admin' },
  telegram_stories:  { icon: '📸', ru: 'TG Истории', en: 'TG Stories' },
  telegram_forums:   { icon: '💬', ru: 'TG Форумы', en: 'TG Forums' },
  telegram_analytics:{ icon: '📈', ru: 'TG Аналитика', en: 'TG Analytics' },
  telegram_media:    { icon: '🎬', ru: 'TG Медиа', en: 'TG Media' },
  telegram_discovery:{ icon: '🔍', ru: 'TG Поиск', en: 'TG Discovery' },
  telegram_premium:  { icon: '⭐', ru: 'TG Premium', en: 'TG Premium' },
  ton_mcp:           { icon: '🔗', ru: 'TON MCP', en: 'TON MCP' },
  // ── Веб / данные ───────────────────────────────────────────────────────
  web:               { icon: '🌐', ru: 'Веб поиск', en: 'Web Search' },
  image:             { icon: '🖼', ru: 'Работа с картинками', en: 'Images' },
  image_gen:         { icon: '🎨', ru: 'Генерация картинок', en: 'Image Gen' },
  email:             { icon: '📧', ru: 'Email', en: 'Email' },
  workspace:         { icon: '📂', ru: 'Файлы', en: 'Files' },
  mcp:               { icon: '🔌', ru: 'MCP серверы', en: 'MCP Servers' },
  // ── Платформа ──────────────────────────────────────────────────────────
  state:             { icon: '💾', ru: 'Состояние', en: 'State' },
  events:            { icon: '📡', ru: 'События / таймеры', en: 'Events / Timers' },
  notify:            { icon: '🔔', ru: 'Уведомления', en: 'Notifications' },
  plugins:           { icon: '🔌', ru: 'Плагины', en: 'Plugins' },
  inter_agent:       { icon: '🤝', ru: 'Межагентность', en: 'Inter-agent' },
  self_memory:       { icon: '🧠', ru: 'Память агента', en: 'Agent Memory' },
  journal:           { icon: '📓', ru: 'Журнал', en: 'Journal' },
  deals:             { icon: '🤝', ru: 'Сделки', en: 'Deals' },
  confirmation:      { icon: '✅', ru: 'Подтверждения', en: 'Confirmations' },
};

async function showCapabilitiesMenu(ctx: Context, agentId: number, enabledCaps: string[]) {
  const userId = (ctx.from as any)?.id || 0;
  const lang = getUserLang(userId);
  const ru = lang === 'ru';
  const totalCaps = Object.keys(CAPABILITY_LABELS).length;
  // «Все включены» = пустой массив ИЛИ все caps явно перечислены
  const allCaps = enabledCaps.length === 0 || enabledCaps.length >= totalCaps;

  let text = `🧩 <b>${ru ? 'Возможности агента' : 'Agent Capabilities'}</b> #${agentId}\n`;
  text += `${div()}\n`;
  if (allCaps) {
    text += ru ? '<i>✅ Все возможности включены</i>\n' : '<i>✅ All capabilities enabled</i>\n';
  } else {
    text += ru
      ? `<i>Включено: ${enabledCaps.length} из ${totalCaps}</i>\n`
      : `<i>Enabled: ${enabledCaps.length} of ${totalCaps}</i>\n`;
  }
  text += '\n';
  text += ru ? '👆 Нажмите чтобы включить/выключить:' : '👆 Tap to toggle:';

  const keyboard: any[][] = [];
  const capIds = Object.keys(CAPABILITY_LABELS);
  for (let i = 0; i < capIds.length; i += 2) {
    const row: any[] = [];
    for (let j = i; j < Math.min(i + 2, capIds.length); j++) {
      const cap = capIds[j];
      const label = CAPABILITY_LABELS[cap];
      const isOn = allCaps || enabledCaps.includes(cap);
      row.push({
        text: `${isOn ? '✅' : '⬜'} ${label.icon} ${ru ? label.ru : label.en}`,
        callback_data: `agent_cap:${agentId}:${cap}`,
      });
    }
    keyboard.push(row);
  }
  keyboard.push([
    { text: allCaps ? `🔒 ${ru ? 'Ограничить' : 'Restrict'}` : `🔓 ${ru ? 'Включить все' : 'Enable all'}`, callback_data: `agent_cap_all:${agentId}` },
  ]);
  keyboard.push([
    { text: `✅ ${ru ? 'Готово' : 'Done'}`, callback_data: `agent_cap_done:${agentId}` },
  ]);

  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
}

// ============================================================
// Меню конкретного агента
// ============================================================
// ── Save prompt version before code update ──
async function savePromptVersion(agentId: number, userId: number) {
  try {
    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data?.code) return;
    const oldCode = agentResult.data.code;
    const stateRepo = getAgentStateRepository();
    const versionsRaw = await stateRepo.get(agentId, '_code_versions').catch(() => null);
    let versions: Array<{ code: string; savedAt: string }> = [];
    try { versions = Array.isArray(versionsRaw) ? versionsRaw : (typeof versionsRaw === 'string' ? JSON.parse(versionsRaw) : []); } catch { versions = []; }
    // Don't save duplicate if last version is same code
    if (versions.length > 0 && versions[versions.length - 1].code === oldCode) return;
    versions.push({ code: oldCode, savedAt: new Date().toISOString() });
    if (versions.length > 10) versions = versions.slice(-10); // keep last 10
    await stateRepo.set(agentId, userId, '_code_versions', versions);
  } catch (e: any) { console.warn('[AutoRepair] version save:', e.message); }
}

async function showAgentMenu(ctx: Context, agentId: number, userId: number) {
  try {
    const lang = getUserLang(userId);
    const r = await getDBTools().getAgent(agentId, userId);
    if (!r.success || !r.data) { await ctx.reply('❌ ' + (lang === 'ru' ? 'Агент не найден' : 'Agent not found')); return; }
    const a = r.data;
    setCachedOwner(agentId, userId);
    const name = escHtml((a.name || '').slice(0, 60));
    const desc = escHtml((a.description || '').slice(0, 250));
    const statusIcon = a.isActive ? pe('green') : '⏸';
    const statusText = a.isActive
      ? (lang === 'ru' ? 'Активен' : 'Active')
      : (lang === 'ru' ? 'На паузе' : 'Paused');
    const triggerIcon = a.triggerType === 'ai_agent' ? pe('brain') : a.triggerType === 'scheduled' ? pe('calendar') : a.triggerType === 'webhook' ? pe('link') : pe('bolt');
    const triggerText = a.triggerType === 'ai_agent'
      ? (lang === 'ru' ? 'AI-агент (всегда активен)' : 'AI Agent (always-on)')
      : a.triggerType === 'scheduled'
      ? (lang === 'ru' ? 'По расписанию' : 'Scheduled')
      : a.triggerType === 'webhook' ? 'Webhook'
      : (lang === 'ru' ? 'Вручную' : 'Manual');

    const lastErr = agentLastErrors.get(agentId);
    const hasError = !!lastErr;

    // Для scheduled (не ai_agent) показываем интервал
    const triggerCfg = typeof a.triggerConfig === 'object' ? a.triggerConfig as Record<string, any> : {};
    const intervalMs = triggerCfg?.intervalMs ? Number(triggerCfg.intervalMs) : 0;
    let intervalLabel = '';
    if (a.triggerType === 'scheduled' && intervalMs > 0) {
      if (intervalMs < 60000) intervalLabel = lang === 'ru' ? ' · каждую минуту' : ' · every minute';
      else if (intervalMs < 3600000) intervalLabel = lang === 'ru' ? ` · каждые ${Math.round(intervalMs / 60000)} мин` : ` · every ${Math.round(intervalMs / 60000)} min`;
      else if (intervalMs < 86400000) intervalLabel = lang === 'ru' ? ' · каждый час' : ' · every hour';
      else intervalLabel = lang === 'ru' ? ` · раз в ${Math.round(intervalMs / 86400000)} д` : ` · every ${Math.round(intervalMs / 86400000)} d`;
    }
    // ai_agent никогда не показывает интервал — просто "всегда активен"

    // Дата создания
    const createdAt = a.createdAt ? new Date(a.createdAt) : null;
    const daysAgo = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : -1;
    const dateLabel = daysAgo < 0 ? '' : daysAgo === 0
      ? (lang === 'ru' ? 'сегодня' : 'today')
      : daysAgo === 1
      ? (lang === 'ru' ? 'вчера' : 'yesterday')
      : lang === 'ru' ? `${daysAgo}д назад` : `${daysAgo}d ago`;

    // Role + XP
    let agentRole = 'worker';
    let agentXp = 0;
    let agentLevel = 1;
    try {
      const roleRes = await dbPool.query('SELECT role, xp, level FROM builder_bot.agents WHERE id = $1 AND user_id = $2', [agentId, userId]);
      if (roleRes.rows[0]) {
        agentRole = roleRes.rows[0].role || 'worker';
        agentXp = roleRes.rows[0].xp || 0;
        agentLevel = roleRes.rows[0].level || 1;
      }
    } catch {}
    const roleLabelsMap: Record<string, string> = { worker: 'WRK', specialist: 'EXP', manager: 'MGR', director: 'DIR', monitor: 'MON', creative: 'CRT', trader: 'TRD', admin: 'ADM' };
    const roleNamesMap: Record<string, string> = { worker: 'Worker', specialist: 'Specialist', manager: 'Manager', director: 'Director', monitor: 'Monitor', creative: 'Creative', trader: 'Trader', admin: 'Chat Admin' };
    const roleEmoji = `[${roleLabelsMap[agentRole] || 'WRK'}]`;
    const roleName = roleNamesMap[agentRole] || 'Worker';
    const levelBar = '█'.repeat(Math.min(agentLevel, 10)) + '░'.repeat(Math.max(0, 10 - agentLevel));

    // ── Onboarding checklist: detect what's missing ──
    const cfg = typeof a.triggerConfig === 'object' ? a.triggerConfig as Record<string, any> : {};
    const agentCfg = cfg?.config || {};
    const hasApiKey = !!(agentCfg.AI_API_KEY || agentCfg.apiKey);
    let hasGlobalKey = false;
    try {
      const uvRes = await dbPool.query('SELECT value FROM builder_bot.user_variables WHERE user_id=$1 AND key=$2', [userId, 'AI_API_KEY']);
      hasGlobalKey = !!(uvRes.rows[0]?.value);
    } catch {}
    const aiKeyOk = hasApiKey || hasGlobalKey || !!(process.env.PLATFORM_AI_KEY);

    let hasTgAuth = false;
    try {
      const { userbotManager } = await import('./services/userbot-manager');
      hasTgAuth = !!(await userbotManager.getClient(agentId));
    } catch {}

    let hasWallet = false;
    try {
      const walletState = await getAgentStateRepository().get(agentId, 'wallet_address');
      hasWallet = !!(walletState?.value || walletState);
    } catch {}

    const ru = lang === 'ru';
    let checklist = '';
    const checklistIssues: string[] = [];
    if (a.triggerType === 'ai_agent') {
      const c1 = aiKeyOk ? '✅' : '❌';
      const c2 = hasTgAuth ? '✅' : '⚠️';
      const c3 = hasWallet ? '✅' : '⚠️';
      if (!aiKeyOk) checklistIssues.push(ru ? '❌ API ключ — агент не работает!' : '❌ API key — agent won\'t work!');
      if (!hasTgAuth) checklistIssues.push(ru ? '⚠️ Telegram не подключён' : '⚠️ Telegram not connected');
      if (!hasWallet) checklistIssues.push(ru ? '⚠️ Кошелёк не создан' : '⚠️ Wallet not created');

      if (checklistIssues.length > 0) {
        checklist = '\n\n' + (ru ? '📋 <b>Настройка:</b>' : '📋 <b>Setup:</b>') + '\n' +
          `${c1} ${ru ? 'AI ключ' : 'AI Key'}  ${c2} Telegram  ${c3} ${ru ? 'Кошелёк' : 'Wallet'}\n` +
          checklistIssues.join('\n');
      }
    }

    // ── Краткий список capabilities для ai_agent ─────────────────────────
    let capsLine = '';
    if (a.triggerType === 'ai_agent') {
      const enabledCaps = (agentCfg.enabledCapabilities as string[] | undefined);
      const totalCaps = Object.keys(CAPABILITY_LABELS).length;
      if (!enabledCaps || enabledCaps.length === 0 || enabledCaps.length >= totalCaps) {
        capsLine = `\n🧩 ${ru ? 'Все возможности' : 'All capabilities'} (${totalCaps})`;
      } else {
        // Показываем иконки активных capabilities
        const icons = enabledCaps
          .map(c => CAPABILITY_LABELS[c]?.icon)
          .filter(Boolean)
          .slice(0, 10)
          .join('');
        capsLine = `\n🧩 ${icons} <i>${enabledCaps.length}/${totalCaps}</i>`;
      }
    }

    const text =
      `${statusIcon} <b>${name}</b>  #${a.id}\n` +
      `${div()}\n` +
      `${lang === 'ru' ? 'Статус' : 'Status'}: <b>${statusText}</b>\n` +
      `${triggerIcon} ${escHtml(triggerText + intervalLabel)}\n` +
      `${roleEmoji} ${roleName} · Lv.${agentLevel} · ${agentXp} XP\n` +
      `[${levelBar}]\n` +
      capsLine +
      (dateLabel ? `\n${pe('calendar')} ${lang === 'ru' ? 'Создан' : 'Created'}: <i>${dateLabel}</i>` : '') +
      checklist +
      (hasError ? `\n⚠️ <b>${lang === 'ru' ? 'Последняя ошибка:' : 'Last error:'}</b>\n<code>${escHtml(lastErr!.error.slice(0, 120))}</code>` : '') +
      (desc ? `\n<i>${desc}</i>` : '');

    // ── Keyboard: logical sections ───────────────────────────────────────────
    const ru2 = lang === 'ru';
    const keyboard: any[][] = [];

    // Section 1 — Primary actions
    keyboard.push([
      { text: a.isActive ? `⏸ ${ru2 ? 'Остановить' : 'Stop'}` : `▶️ ${ru2 ? 'Запустить' : 'Start'}`, callback_data: `run_agent:${agentId}` },
      { text: `💬 ${ru2 ? 'Чат' : 'Chat'}`, callback_data: `agent_chat:${agentId}` },
    ]);

    // Section 2 — Monitoring: Logs + Code
    keyboard.push([
      { text: `📋 ${ru2 ? 'Логи' : 'Logs'}`, callback_data: `show_logs:${agentId}` },
      { text: `👁 ${ru2 ? 'Код/Промпт' : 'Code/Prompt'}`, callback_data: `show_code:${agentId}` },
    ]);

    // Section 2.5 — Self-awareness: Goals, Memory, Events (only for ai_agent)
    if (a.triggerType === 'ai_agent') {
      keyboard.push([
        { text: `🎯 ${ru2 ? 'Цели' : 'Goals'}`, callback_data: `show_goals:${agentId}` },
        { text: `🧠 ${ru2 ? 'Память' : 'Memory'}`, callback_data: `agent_memory:${agentId}` },
        { text: `📡 ${ru2 ? 'События' : 'Events'}`, callback_data: `show_events:${agentId}` },
      ]);
    }

    // Section 3 — Edit: Edit prompt + Rename + History
    keyboard.push([
      { text: `✏️ ${ru2 ? 'Изменить' : 'Edit'}`, callback_data: `edit_agent:${agentId}` },
      { text: `🏷 ${ru2 ? 'Переименовать' : 'Rename'}`, callback_data: `rename_agent:${agentId}` },
      { text: `📜 ${ru2 ? 'История' : 'History'}`, callback_data: `prompt_history:${agentId}` },
    ]);

    // Section 4 — AI settings (only for ai_agent): provider, key, model
    if (a.triggerType === 'ai_agent') {
      keyboard.push([
        { text: `⚙️ ${ru2 ? 'Настройки AI' : 'AI Settings'}`, callback_data: `agent_settings:${agentId}` },
        { text: `🧩 ${ru2 ? 'Возможности' : 'Capabilities'}`, callback_data: `agent_caps_menu:${agentId}` },
      ]);
      keyboard.push([
        { text: `🔍 ${ru2 ? 'Аудит' : 'Audit'}`, callback_data: `audit_agent:${agentId}` },
      ]);
    } else {
      keyboard.push([
        { text: `🔍 ${ru2 ? 'Аудит' : 'Audit'}`, callback_data: `audit_agent:${agentId}` },
      ]);
    }

    // Section 5 — Wallet (only for ai_agent)
    if (a.triggerType === 'ai_agent') {
      try {
        const stateRows = await getAgentStateRepository().getAll(agentId);
        const walletRow = stateRows.find(r => r.key === 'wallet_address');
        keyboard.push([{
          text: walletRow
            ? `💼 ${ru2 ? 'Кошелёк агента' : 'Agent Wallet'}`
            : `💼 ${ru2 ? '+ Создать кошелёк' : '+ Create Wallet'}`,
          callback_data: `agent_wallet:${agentId}`,
        }]);
      } catch (_) {
        keyboard.push([{ text: `💼 ${ru2 ? 'Кошелёк агента' : 'Agent Wallet'}`, callback_data: `agent_wallet:${agentId}` }]);
      }
    }

    // Section 6 — Advanced: Inter-agent + Userbot (one row)
    try {
      const iaState = await getAgentStateRepository().get(agentId, 'inter_agent_enabled');
      const iaEnabled = String(iaState) === 'true';
      keyboard.push([
        {
          text: iaEnabled
            ? `🔗 ${ru2 ? 'Межагент ✅' : 'Inter-agent ✅'}`
            : `🔗 ${ru2 ? 'Межагент' : 'Inter-agent'}`,
          callback_data: `toggle_inter_agent:${agentId}`,
        },
        { text: `🧑‍💻 Userbot`, callback_data: `deploy_userbot:${agentId}` },
      ]);
    } catch (_) {
      keyboard.push([{ text: `🧑‍💻 Userbot`, callback_data: `deploy_userbot:${agentId}` }]);
    }

    // Section 7 — Hooks & Session (blocklist, triggers, session policy)
    if (a.triggerType === 'ai_agent') {
      keyboard.push([
        { text: `🚫 ${ru2 ? 'Блоклист' : 'Blocklist'}`, callback_data: `hooks_blocklist:${agentId}` },
        { text: `🎯 ${ru2 ? 'Триггеры' : 'Triggers'}`, callback_data: `hooks_triggers:${agentId}` },
        { text: `🔄 ${ru2 ? 'Сессия' : 'Session'}`, callback_data: `hooks_session:${agentId}` },
      ]);
    }

    // Section 8 — Role management
    keyboard.push([
      { text: `${roleEmoji} ${ru2 ? 'Роль' : 'Role'}: ${roleName}`, callback_data: `set_role:${agentId}` },
    ]);

    // Section 8 — Auto-repair (only when error detected)
    if (hasError) {
      keyboard.push([{ text: `🔧 ${ru2 ? 'AI Автопочинка' : 'AI Auto-repair'}`, callback_data: `auto_repair:${agentId}` }]);
    }

    // Section 8b — Analytics, Tasks, Tokens, Contacts (for ai_agent)
    if (a.triggerType === 'ai_agent') {
      keyboard.push([
        { text: `📊 ${ru2 ? 'Аналитика' : 'Analytics'}`, callback_data: `agent_analytics:${agentId}` },
        { text: `📋 ${ru2 ? 'Задачи' : 'Tasks'}`, callback_data: `agent_tasks:${agentId}` },
      ]);
      keyboard.push([
        { text: `🪙 ${ru2 ? 'Токены' : 'Tokens'}`, callback_data: `agent_tokens:${agentId}` },
        { text: `👥 ${ru2 ? 'Контакты' : 'Contacts'}`, callback_data: `agent_contacts:${agentId}` },
      ]);
    }

    // Section 9 — Clone + Delete + Back
    keyboard.push([
      { text: `📋 ${ru2 ? 'Клон' : 'Clone'}`, callback_data: `clone_agent:${agentId}` },
      { text: `🗑 ${ru2 ? 'Удалить' : 'Delete'}`, callback_data: `delete_agent:${agentId}` },
      { text: `◀️ ${ru2 ? 'Все агенты' : 'All agents'}`, callback_data: 'list_agents' },
    ]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  } catch (err) {
    await ctx.reply('❌ ' + 'Error loading agent');
  }
}

// ============================================================
// TON Connect
// ============================================================
async function showTonConnect(ctx: Context) {
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  const tonConn = getTonConnectManager();

  if (tonConn.isConnected(userId)) {
    // ── Кошелёк уже подключён ──
    const wallet = tonConn.getWallet(userId)!;
    const bal = await tonConn.getBalance(userId);
    await safeReply(ctx,
      `${pe('diamond')} <b>TON Connect</b>\n\n` +
      `${pe('check')} ${lang === 'ru' ? 'Кошелёк подключён' : 'Wallet connected'}\n` +
      `${pe('wallet')} ${escHtml(wallet.walletName)}\n` +
      `${pe('link')} ${lang === 'ru' ? 'Адрес' : 'Address'}: <code>${escHtml(wallet.friendlyAddress)}</code>\n` +
      `${pe('coin')} ${lang === 'ru' ? 'Баланс' : 'Balance'}: <b>${escHtml(bal.ton)}</b> TON\n\n` +
      `${lang === 'ru' ? 'Что хотите сделать?' : 'What would you like to do?'}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${peb('refresh')} ${lang === 'ru' ? 'Обновить баланс' : 'Refresh balance'}`, callback_data: 'ton_refresh' }],
            [{ text: `${peb('money')} ${lang === 'ru' ? 'Отправить TON' : 'Send TON'}`, callback_data: 'ton_send' }],
            [{ text: `${peb('clipboard')} ${lang === 'ru' ? 'История транзакций' : 'Transaction history'}`, callback_data: 'ton_history' }],
            [{ text: `${peb('plugin')} ${lang === 'ru' ? 'Отключить кошелёк' : 'Disconnect wallet'}`, callback_data: 'ton_disconnect' }],
          ],
        },
      }
    );
  } else {
    // ── Генерируем ссылку для подключения ──
    const result = await tonConn.generateConnectLink(userId);

    if (result.error || !result.universalLink) {
      await safeReply(ctx,
        `💎 <b>TON Connect</b>\n\n` +
        `⚠️ Не удалось получить ссылку для подключения.\n` +
        `${escHtml(result.error || '')}\n\n` +
        `Используйте /wallet для агентского кошелька (без мобильного приложения).`,
        {
          parse_mode: 'HTML',
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
          // Save wallet to profile (syncs with studio)
          const settingsRepo = getUserSettingsRepository();
          const profile = (await settingsRepo.get(userId, 'profile')) || { balance_ton: 0, total_earned: 0, wallet_address: null };
          profile.wallet_address = w.friendlyAddress;
          profile.wallet_name = w.walletName;
          profile.connected_via = 'tonconnect';
          profile.wallet_connected_at = new Date().toISOString();
          await settingsRepo.set(userId, 'profile', profile);
          await ctx.telegram.sendMessage(
            userId,
            `✅ Кошелёк подключён!\n\n👛 ${w.walletName}\n📋 ${w.friendlyAddress}`,
          );
        } catch (e: any) { console.warn('[TonConnect] profile save:', e.message); }
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
  const lang = getUserLang(ctx.from?.id || 0);
  const CATS = [
    { id: 'ton',        icon: peb('diamond'),   name: lang === 'ru' ? 'TON блокчейн' : 'TON Blockchain', hint: lang === 'ru' ? 'кошельки, переводы, DeFi' : 'wallets, transfers, DeFi' },
    { id: 'finance',    icon: peb('coin'),       name: lang === 'ru' ? 'Финансы' : 'Finance',             hint: lang === 'ru' ? 'цены, DEX, алерты' : 'prices, DEX, alerts' },
    { id: 'monitoring', icon: peb('chart'),      name: lang === 'ru' ? 'Мониторинг' : 'Monitoring',       hint: lang === 'ru' ? 'uptime, API, уведомления' : 'uptime, API, notifications' },
    { id: 'utility',    icon: peb('wrench'),     name: lang === 'ru' ? 'Утилиты' : 'Utilities',           hint: lang === 'ru' ? 'парсинг, расписания, задачи' : 'parsing, schedules, tasks' },
    { id: 'social',     icon: peb('megaphone'),  name: lang === 'ru' ? 'Социальные' : 'Social',           hint: lang === 'ru' ? 'новости, посты, каналы' : 'news, posts, channels' },
  ] as const;

  // Загружаем пользовательские листинги из БД
  let userListingsCount = 0;
  try {
    const listings = await getMarketplaceRepository().getListings();
    userListingsCount = listings.length;
  } catch { /* репозиторий может ещё не быть готов */ }

  const totalTemplates = allAgentTemplates.length;

  // Считаем топ-3 шаблона по популярности (по количеству тегов как прокси)
  const topTemplates = [...allAgentTemplates]
    .sort((a, b) => b.tags.length - a.tags.length)
    .slice(0, 3);

  let text =
    `${pe('store')} <b>${lang === 'ru' ? 'Маркетплейс агентов' : 'Agent Marketplace'}</b>\n` +
    `<i>${lang === 'ru' ? 'Готовые агенты — установка в 1 клик' : 'Ready agents — install in 1 click'}</i>\n\n` +
    `${div()}\n` +
    `${pe('clipboard')} ${lang === 'ru' ? 'Шаблонов' : 'Templates'}: <b>${totalTemplates}</b>`;
  if (userListingsCount > 0) text += `  ${pe('group')} ${lang === 'ru' ? 'Сообщество' : 'Community'}: <b>${userListingsCount}</b>`;
  text += `\n${div()}\n\n`;

  CATS.forEach(c => {
    const count = allAgentTemplates.filter(t => t.category === c.id).length;
    if (count > 0) text += `${c.icon} <b>${escHtml(c.name)}</b> — ${count} · <i>${escHtml(c.hint)}</i>\n`;
  });

  if (topTemplates.length > 0) {
    text += `\n${pe('trending')} <b>${lang === 'ru' ? 'Популярные' : 'Popular'}:</b>\n`;
    topTemplates.forEach(t => { text += `• ${t.icon} ${escHtml(t.name)}\n`; });
  }

  const btns = CATS.filter(c => allAgentTemplates.filter(t => t.category === c.id).length > 0)
    .map(c => {
      const count = allAgentTemplates.filter(t => t.category === c.id).length;
      return [{ text: `${c.icon} ${c.name} (${count})`, callback_data: `marketplace_cat:${c.id}` }];
    });
  btns.push([{ text: `${peb('clipboard')} ${lang === 'ru' ? 'Все шаблоны' : 'All templates'}`, callback_data: 'marketplace_all' }]);
  if (userListingsCount > 0) {
    btns.push([{ text: `👥 ${lang === 'ru' ? 'От сообщества' : 'Community'}`, callback_data: 'mkt_community' }]);
  }
  btns.push([{ text: `${peb('outbox')} ${lang === 'ru' ? 'Опубликовать своего агента' : 'Publish your agent'}`, callback_data: 'mkt_publish_help' }]);

  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

async function showMarketplaceAll(ctx: Context) {
  const lang = getUserLang(ctx.from?.id || 0);
  const templates = allAgentTemplates.slice(0, 20);
  let text = `${pe('clipboard')} <b>${lang === 'ru' ? 'Все агенты' : 'All agents'} (${allAgentTemplates.length}):</b>\n\n`;
  templates.forEach(t => { text += `${t.icon} <b>${escHtml(t.name)}</b> — ${escHtml(t.description.slice(0, 120))}\n`; });

  const btns = templates.map(t => [{ text: `${t.icon} ${t.name}`, callback_data: `template:${t.id}` }]);
  btns.push([{ text: `${peb('back')} ${lang === 'ru' ? 'Назад' : 'Back'}`, callback_data: 'marketplace' }]);
  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

async function showMarketplaceCategory(ctx: Context, category: AgentTemplate['category']) {
  const lang = getUserLang(ctx.from?.id || 0);
  const templates = allAgentTemplates.filter(t => t.category === category);
  if (!templates.length) { await ctx.reply('❌ ' + (lang === 'ru' ? 'Агенты не найдены' : 'Agents not found'), { reply_markup: { inline_keyboard: [[{ text: `${peb('back')} ${lang === 'ru' ? 'Назад' : 'Back'}`, callback_data: 'marketplace' }]] } }); return; }

  const catMeta: Record<string, { icon: string; name: string }> = {
    ton:        { icon: peb('diamond'),  name: lang === 'ru' ? 'TON блокчейн' : 'TON Blockchain' },
    finance:    { icon: peb('coin'),     name: lang === 'ru' ? 'Финансы' : 'Finance' },
    monitoring: { icon: peb('chart'),    name: 'Мониторинг' },
    utility:    { icon: peb('wrench'),   name: lang === 'ru' ? 'Утилиты' : 'Utilities' },
    social:     { icon: peb('megaphone'),name: lang === 'ru' ? 'Социальные' : 'Social' },
  };
  const meta = catMeta[category] || { icon: '📦', name: category };
  let text = `${meta.icon} <b>${escHtml(meta.name)}</b> — <b>${templates.length} ${lang === 'ru' ? 'агентов' : 'agents'}</b>\n\n${lang === 'ru' ? 'Выберите агента' : 'Choose an agent'}:\n\n`;
  templates.forEach(t => {
    text += `${t.icon} <b>${escHtml(t.name)}</b>\n<i>${escHtml(t.description.slice(0, 200))}</i>\n\n`;
  });

  const btns = templates.map(t => [{ text: `${t.icon} ${t.name}`, callback_data: `template:${t.id}` }]);
  btns.push([{ text: `${peb('back')} ${lang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'marketplace' }]);
  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

async function showTemplateDetails(ctx: Context, templateId: string) {
  const lang = getUserLang(ctx.from?.id || 0);
  const t = allAgentTemplates.find(x => x.id === templateId);
  if (!t) { await ctx.reply('❌ ' + (lang === 'ru' ? 'Шаблон не найден' : 'Template not found')); return; }

  const triggerIcon = t.triggerType === 'scheduled' ? peb('calendar') : t.triggerType === 'webhook' ? peb('link') : peb('bolt');
  const triggerLabel = t.triggerType === 'scheduled'
    ? (lang === 'ru' ? 'По расписанию' : 'Scheduled')
    : t.triggerType === 'webhook' ? 'Webhook'
    : (lang === 'ru' ? 'Вручную' : 'Manual');
  let intervalLine = '';
  if (t.triggerType === 'scheduled' && t.triggerConfig.intervalMs) {
    const ms = t.triggerConfig.intervalMs;
    const label = ms >= 86400000
      ? `${ms / 86400000} ${lang === 'ru' ? 'дн' : 'd'}`
      : ms >= 3600000 ? `${ms / 3600000} ${lang === 'ru' ? 'ч' : 'h'}`
      : `${ms / 60000} ${lang === 'ru' ? 'мин' : 'min'}`;
    intervalLine = ` · ${lang === 'ru' ? 'каждые' : 'every'} ${label}`;
  }

  // Рейтинг шаблона (на основе тегов как прокси популярности)
  const stars = Math.min(5, Math.max(3, t.tags.length));
  const starsStr = '⭐'.repeat(stars);

  let text =
    `${t.icon} <b>${escHtml(t.name)}</b>\n` +
    `${div()}\n` +
    `<i>${escHtml(t.description)}</i>\n\n` +
    `${triggerIcon} ${escHtml(triggerLabel)}${escHtml(intervalLine)}\n` +
    `${starsStr} · 🏷 ${t.tags.slice(0, 5).map(x => `<code>${escHtml(x)}</code>`).join(' ')}\n`;

  if (t.placeholders.length) {
    text += `\n${pe('wrench')} <b>${lang === 'ru' ? 'Настраиваемые параметры' : 'Configurable parameters'}:</b>\n`;
    t.placeholders.forEach(p => { text += `• <code>${escHtml(p.name)}</code>${p.required ? ' ✳️' : ''} — ${escHtml(p.description)}\n`; });
  } else {
    text += `\n${pe('check')} <i>${lang === 'ru' ? 'Готов к запуску — параметры не нужны' : 'Ready to run — no parameters needed'}</i>\n`;
  }

  await editOrReply(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: `${peb('rocket')} ${lang === 'ru' ? 'Создать и запустить' : 'Create & run'}`, callback_data: `create_from_template:${t.id}` }],
        [{ text: `${peb('back')} ${lang === 'ru' ? 'Назад' : 'Back'}`, callback_data: `marketplace_cat:${t.category}` }, { text: `${peb('store')} ${lang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'marketplace' }],
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
      `${t.icon} <b>${escHtml(t.name)}</b>\n\n` +
      `⚙️ ${lang === 'ru' ? 'Настройка переменных' : 'Configure variables'} (1/${t.placeholders.length})\n\n` +
      `📝 <b>${escHtml(first.name)}</b>\n${escHtml(first.description)}\n` +
      (first.example ? `\n<i>${lang === 'ru' ? 'Пример' : 'Example'}: <code>${escHtml(first.example)}</code></i>` : '') +
      (first.required ? `\n\n${lang === 'ru' ? '❗ Обязательно' : '❗ Required'}` : `\n\n<i>${lang === 'ru' ? '(необязательно — отправьте пропустить)' : '(optional — send skip)'}</i>`),
      {
        parse_mode: 'HTML',
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
  // Для ai_agent шаблонов — явно прописываем все capabilities, как у описательных агентов
  const templateConfig = { ...(t.triggerConfig.config || {}), ...vars };
  if (t.triggerType === 'ai_agent' && !templateConfig.enabledCapabilities) {
    templateConfig.enabledCapabilities = ALL_CAPABILITIES_FULL;
  }
  const triggerConfig = { ...t.triggerConfig, config: templateConfig };

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
    `${pe('sparkles')} <b>${lang === 'ru' ? 'Агент создан!' : 'Agent created!'}</b>\n` +
    `${div()}\n` +
    `${t.icon} <b>${escHtml(t.name)}</b>  #${agent.id}\n` +
    `${pe('cloud')} <i>На сервере · работает 24/7</i>\n`;

  if (Object.keys(vars).length > 0) {
    text += `\n${pe('check')} <b>${lang === 'ru' ? 'Переменные:' : 'Variables:'}</b>\n`;
    Object.entries(vars).forEach(([k, v]) => { text += `<code>${escHtml(k)}</code> = <code>${escHtml(v.slice(0, 40))}</code>\n`; });
  }

  const unset = t.placeholders.filter(p => !vars[p.name] && p.required);
  if (unset.length) {
    text += `\n⚠️ <b>${lang === 'ru' ? 'Нужно настроить:' : 'Setup required:'}</b>\n`;
    unset.forEach(p => { text += `• <code>${escHtml(p.name)}</code> — ${escHtml(p.description)}\n`; });
  }

  const readyToRun = !unset.length;

  if (readyToRun) {
    text += `\n${pe('green')} <i>${lang === 'ru' ? 'Автозапуск — первый результат через несколько секунд!' : 'Auto-starting — first result in seconds!'}</i> ${pe('bolt')}`;
  }

  await safeReply(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        readyToRun
          ? [{ text: `⏸ Остановить`, callback_data: `stop_agent:${agent.id}` }, { text: `👁 Код`, callback_data: `show_code:${agent.id}` }]
          : [{ text: `${peb('rocket')} Запустить`, callback_data: `run_agent:${agent.id}` }, { text: `👁 Код`, callback_data: `show_code:${agent.id}` }],
        [{ text: `${peb('clipboard')} Мои агенты`, callback_data: 'list_agents' }],
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

  const cancelRow = [{ text: lang === 'ru' ? '❌ Отмена' : '❌ Cancel', callback_data: 'tmpl_cancel' }];
  const msgText =
    `${t.icon} <b>${escHtml(t.name)}</b>\n\n` +
    `⚙️ ${lang === 'ru' ? 'Настройка' : 'Configure'} (${stepNum}/${t.placeholders.length})\n\n` +
    `📝 <b>${escHtml(placeholder.question || nextName)}</b>\n${escHtml(placeholder.description)}\n` +
    (placeholder.example && !placeholder.options ? `\n<i>${lang === 'ru' ? 'Пример' : 'Example'}: <code>${escHtml(placeholder.example)}</code></i>` : '') +
    (placeholder.required || placeholder.options ? '' : `\n\n<i>${lang === 'ru' ? '(необязательно)' : '(optional)'}</i>`);

  if (placeholder.options && placeholder.options.length > 0) {
    // Render option buttons (2 per row)
    const optRows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < placeholder.options.length; i += 2) {
      optRows.push(
        placeholder.options.slice(i, i + 2).map(opt => ({
          text: opt,
          callback_data: `tmpl_option:${encodeURIComponent(opt)}`,
        }))
      );
    }
    await editOrReply(ctx, msgText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [...optRows, cancelRow] },
    });
  } else {
    await editOrReply(ctx, msgText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        ...(placeholder.required ? [] : [[{ text: lang === 'ru' ? '⏭ Пропустить' : '⏭ Skip', callback_data: `tmpl_skip_var:${t.id}` }]]),
        cancelRow,
      ] },
    });
  }
}

// ============================================================
// Пользовательский маркетплейс (покупка/продажа между юзерами)
// ============================================================
async function showCommunityListings(ctx: Context) {
  try {
    const listings = await getMarketplaceRepository().getListings();
    if (!listings.length) {
      return editOrReply(ctx,
        `${pe('store')} <b>Маркетплейс сообщества</b>\n\nПока пусто. Будьте первым!`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: `${peb('outbox')} Опубликовать агента`, callback_data: 'mkt_publish_help' }],
          [{ text: `${peb('back')} Маркетплейс`, callback_data: 'marketplace' }],
        ] } }
      );
    }

    let text = `${pe('store')} <b>Маркетплейс сообщества</b>\n${div()}\n<i>${listings.length} агентов от пользователей</i>\n\n`;
    listings.slice(0, 10).forEach((l: any) => {
      const priceIcon = l.isFree ? '🆓' : `${peb('diamond')}`;
      const priceStr = l.isFree ? 'Бесплатно' : `${(l.price / 1e9).toFixed(1)} TON`;
      const sales = l.totalSales > 0 ? ` · ${pe('trending')} ${l.totalSales} уст.` : '';
      const stars = Math.min(5, Math.max(3, Math.floor(l.totalSales / 2) + 3));
      const starsStr = '⭐'.repeat(stars);
      text += `${priceIcon} <b>${escHtml(l.name.slice(0, 35))}</b>${sales}\n`;
      text += `${starsStr} · ${priceStr}\n\n`;
    });

    const btns = listings.slice(0, 8).map((l: any) => [
      { text: `${l.isFree ? '🆓' : peb('diamond')} ${l.name.slice(0, 30)}`, callback_data: `mkt_view:${l.id}` }
    ]);
    btns.push([{ text: `${peb('back')} Маркетплейс`, callback_data: 'marketplace' }]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
  } catch (e: any) {
    await editOrReply(ctx, `❌ Ошибка: ${escHtml(e.message)}`, { parse_mode: 'HTML' });
  }
}

async function showListingDetail(ctx: Context, listingId: number, userId: number) {
  try {
    const listing = await getMarketplaceRepository().getListing(listingId);
    if (!listing) return editOrReply(ctx, '❌ Листинг не найден', {});

    const alreadyBought = await getMarketplaceRepository().hasPurchased(listingId, userId);
    const isOwner = listing.sellerId === userId;

    const priceStr = listing.isFree ? '🆓 Бесплатно' : `${peb('diamond')} ${(listing.price / 1e9).toFixed(2)} TON`;
    const stars = Math.min(5, Math.max(3, Math.floor(listing.totalSales / 2) + 3));
    const starsStr = '⭐'.repeat(stars);

    let text =
      `${pe('robot')} <b>${escHtml(listing.name)}</b>\n` +
      `${div()}\n` +
      `<i>${escHtml(listing.description || 'Описание отсутствует')}</i>\n\n` +
      `${priceStr}  ·  ${pe('chart')} ${listing.totalSales} продаж\n` +
      `${starsStr}\n`;
    if (isOwner) text += `\n<i>✏️ Вы — автор этого листинга</i>`;
    if (alreadyBought) text += `\n${pe('check')} <i>Уже приобретено</i>`;

    const btns: any[] = [];
    if (!isOwner && !alreadyBought) {
      btns.push([{ text: listing.isFree ? `🆓 Получить бесплатно` : `${peb('coin')} Купить ${(listing.price / 1e9).toFixed(2)} TON`, callback_data: `mkt_buy:${listingId}` }]);
    }
    if (alreadyBought) {
      btns.push([{ text: `${peb('rocket')} Запустить`, callback_data: `run_agent:${listing.agentId}` }]);
    }
    // Share button
    const botUsername = process.env.BOT_USERNAME || 'TonAgentPlatformBot';
    const shareUrl = `https://t.me/${botUsername}?start=share_${listingId}`;
    btns.push([{ text: '🔗 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${listing.name} — AI Agent on TON`)}` }]);

    btns.push([{ text: `${peb('back')} Назад`, callback_data: 'mkt_community' }, { text: `${peb('store')} Маркетплейс`, callback_data: 'marketplace' }]);

    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
  } catch (e: any) {
    await editOrReply(ctx, `❌ Ошибка: ${escHtml(e.message)}`, { parse_mode: 'HTML' });
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
      // Mark listing as unavailable so others don't hit the same error
      try { await getMarketplaceRepository().deactivateListing(listingId, listing.sellerId); } catch (e: any) { console.warn('[Marketplace] deactivate listing:', e.message); }
      return editOrReply(ctx, '❌ Агент продавца не найден или удалён. Листинг деактивирован.', {});
    }
    const sourceAgent = agentResult.data;

    if (!listing.isFree && listing.price > 0) {
      // Платный агент — генерируем TON Connect ссылку и ждём транзакцию
      const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
      const payloadStr = Buffer.from(`buy:${listingId}:${userId}`).toString('base64');
      const tonLink = `https://ton.org/transfer/${platformWallet}?amount=${listing.price}&text=${payloadStr}`;

      const priceTon = listing.price / 1e9;
      const profile = await getUserProfile(userId);
      const hasBalance = profile.balance_ton >= priceTon;
      const btns: any[][] = [];
      if (hasBalance) {
        btns.push([{ text: `💰 С баланса (${priceTon.toFixed(2)} TON)`, callback_data: `pay_balance:mkt:${listingId}` }]);
      }
      btns.push([{ text: '💎 Открыть в Tonkeeper', url: tonLink }]);
      btns.push([{ text: '✅ Я оплатил — проверить', callback_data: `mkt_check_pay:${listingId}` }]);
      btns.push([{ text: '◀️ Отмена', callback_data: `mkt_view:${listingId}` }]);

      await editOrReply(ctx,
        `💰 <b>Оплата покупки</b>\n\n` +
        `<b>${escHtml(listing.name)}</b>\n` +
        `Цена: ${escHtml(priceTon.toFixed(2))} TON\n\n` +
        (hasBalance ? `💰 <b>Баланс: ${profile.balance_ton.toFixed(2)} TON</b> — можно оплатить сразу!\n\n` : '') +
        `Переведите сумму и нажмите <b>Проверить оплату</b> через 30–60 секунд\n\n` +
        `<i>Адрес: <code>${escHtml(platformWallet)}</code></i>\n` +
        `<i>Сумма: <code>${escHtml(priceTon.toFixed(9))} TON</code></i>`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: btns },
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
      return editOrReply(ctx, `❌ Ошибка создания агента: ${escHtml(newAgentResult.error || '')}`, { parse_mode: 'HTML' });
    }
    const newAgent = newAgentResult.data;

    // Записываем покупку
    await getMarketplaceRepository().createPurchase({
      listingId, buyerId: userId, sellerId: listing.sellerId,
      agentId: newAgent.id, type: 'free', pricePaid: 0,
    });

    await editOrReply(ctx,
      `${pe('check')} <b>Агент получен!</b>\n` +
      `${div()}\n` +
      `${pe('robot')} <b>${escHtml(listing.name)}</b>  #${newAgent.id}\n` +
      `🆓 Бесплатно из маркетплейса\n\n` +
      `<i>Запустите агента — всё готово к работе</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${peb('rocket')} Запустить`, callback_data: `run_agent:${newAgent.id}` }, { text: `👁 Просмотр`, callback_data: `agent_menu:${newAgent.id}` }],
            [{ text: `${peb('robot')} Мои агенты`, callback_data: 'list_agents' }],
          ],
        },
      }
    );
  } catch (e: any) {
    await editOrReply(ctx, `❌ Ошибка: ${escHtml(e.message || 'Неизвестная ошибка')}`, { parse_mode: 'HTML' });
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
        `📤 <b>Публикация в маркетплейс</b>\n\nУ вас ещё нет агентов.\n\nСначала создайте агента, а затем опубликуйте его!`,
        {
          parse_mode: 'HTML',
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
      `📤 <b>Публикация агента в маркетплейс</b>\n\nВыберите агента для публикации:\n\n<i>Покупатели смогут запускать агента, но не увидят ваш код</i>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
    );
  } catch (e: any) {
    await safeReply(ctx, `❌ Ошибка: ${e.message || 'unknown'}`);
  }
}

async function doPublishAgent(ctx: Context, userId: number, agentId: number, priceNano: number, name: string) {
  if (checkRateLimit(userId)) {
    await ctx.reply('⚠️ Слишком много операций. Подождите минуту.').catch(() => {});
    return;
  }
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
      `${pe('check')} <b>Агент опубликован!</b>\n\n` +
      `${pe('clipboard')} Листинг #${listing.id}\n` +
      `${pe('robot')} <b>${escHtml(name)}</b>\n` +
      `${pe('coin')} Цена: ${escHtml(priceStr)}\n\n` +
      `Другие пользователи найдут его в маркетплейсе.\nОни смогут <b>запускать</b> агента, но <b>не видеть код</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${peb('store')} Маркетплейс`, callback_data: 'marketplace' }],
            [{ text: `${peb('outbox')} Мои листинги`, callback_data: 'mkt_mylistings' }],
          ],
        },
      }
    );
  } catch (e: any) {
    await safeReply(ctx, `❌ Ошибка публикации: ${escHtml(e.message || 'Неизвестная ошибка')}`, { parse_mode: 'HTML' });
  }
}

// ============================================================
// Плагины
// ============================================================
async function showPlugins(ctx: Context) {
  const userId = ctx.from?.id || 0;
  const ru = getUserLang(userId) === 'ru';
  const mgr = getPluginManager();
  const plugins = mgr.getAllPlugins();

  // Загружаем установленные плагины из DB
  let installedIds: string[] = [];
  try {
    const raw = await getUserSettingsRepository().get(userId, 'installed_plugins').catch(() => null);
    installedIds = safeParsePluginList(raw as string);
  } catch (_) {}

  const installedCount = installedIds.length;

  let text =
    `${pe('plugin')} <b>${ru ? 'Плагины' : 'Plugins'}</b>\n` +
    `${div()}\n` +
    `${pe('brain')} <b>${ru ? 'Что такое плагины?' : 'What are plugins?'}</b>\n` +
    `${ru
      ? 'Плагины расширяют возможности AI-агентов.\nПосле установки — все новые агенты автоматически получают доступ к API плагина: точный синтаксис вызовов, форматы ответов, примеры.'
      : 'Plugins extend AI agent capabilities.\nAfter install — all new agents automatically get plugin API access: exact call syntax, response formats, examples.'
    }\n\n` +
    `${pe('check')} ${ru ? 'Установлено:' : 'Installed:'} <b>${installedCount}</b>/${plugins.length}`;

  if (installedCount > 0) {
    const names = installedIds.map(id => mgr.getPlugin(id)?.name || id).join(', ');
    text += `\n${pe('bolt')} ${ru ? 'Активные:' : 'Active:'} <i>${escHtml(names)}</i>`;
  }

  // Категории с иконками
  const byType: Record<string, { icon: string; label: string }> = {
    defi:          { icon: `${pe('coin')}`,     label: 'DeFi' },
    analytics:     { icon: `${pe('chart')}`,    label: ru ? 'Аналитика' : 'Analytics' },
    notification:  { icon: `${pe('bell')}`,     label: ru ? 'Уведомления' : 'Notifications' },
    'data-source': { icon: `${pe('globe')}`,    label: ru ? 'Данные' : 'Data' },
    security:      { icon: `${pe('wrench')}`,   label: ru ? 'Безопасность' : 'Security' },
  };

  text += `\n\n<b>${ru ? 'Все плагины:' : 'All plugins:'}</b>`;

  const btns = plugins.map(p => {
    const isInst = installedIds.includes(p.id);
    const catInfo = byType[p.type] || { icon: '🔌', label: p.type };
    return [{
      text: `${isInst ? peb('check') : peb('square')} ${catInfo.icon.replace(/<[^>]+>/g, '').trim()} ${p.name}${isInst ? (ru ? ' ✓' : ' ✓') : ''}`,
      callback_data: `plugin:${p.id}`,
    }];
  });

  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

// NOTE: p.isInstalled below comes from the plugin registry's static data, NOT from the
// per-user DB setting (installed_plugins). This can diverge from reality if a user
// installs/uninstalls at runtime. showPluginDetails() reads DB correctly.
// To fix properly, pass userId and query DB here as well.
async function showAllPlugins(ctx: Context) {
  const plugins = getPluginManager().getAllPlugins();
  let text = `🔌 <b>Все плагины (${escHtml(plugins.length)}):</b>\n\n`;
  plugins.forEach((p, i) => {
    text += `${i + 1}. ${p.isInstalled ? '✅' : '⬜'} <b>${escHtml(p.name)}</b> ${p.price > 0 ? `(${escHtml(p.price)} TON)` : '(free)'}\n`;
    text += `   ${escHtml(p.description.slice(0, 150))}...\n`;
  });
  const btns = plugins.map(p => [{ text: p.name, callback_data: `plugin:${p.id}` }]);
  btns.push([{ text: '◀️ Назад', callback_data: 'plugins' }]);
  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns.slice(0, 10) } });
}

async function showPluginDetails(ctx: Context, pluginId: string) {
  const userId = ctx.from?.id || 0;
  const ru = getUserLang(userId) === 'ru';
  const plugin = getPluginManager().getPlugin(pluginId);
  if (!plugin) { await ctx.reply('❌ Плагин не найден'); return; }

  // Проверяем установку из DB
  let isInstalled = false;
  try {
    const raw = await getUserSettingsRepository().get(userId, 'installed_plugins').catch(() => null);
    const list: string[] = safeParsePluginList(raw as string);
    isInstalled = list.includes(pluginId);
  } catch (_) {}

  // Парсим из skillDoc первые несколько строк как "что умеет"
  const skillLines = (plugin.skillDoc || '').split('\n')
    .filter(l => l.startsWith('GET ') || l.startsWith('POST ') || l.startsWith('  Response:') || l.includes('CORRECT usage'))
    .slice(0, 3)
    .map(l => `<code>${escHtml(l.trim().slice(0, 80))}</code>`)
    .join('\n');

  let text =
    `${pe('plugin')} <b>${escHtml(plugin.name)}</b>  <i>v${escHtml(plugin.version)}</i>\n` +
    `${div()}\n` +
    `${escHtml(plugin.description)}\n\n` +
    `${pe('star')} ${plugin.rating}/5  ${pe('trending')} ${plugin.downloads.toLocaleString()} ${ru ? 'устан.' : 'installs'}\n` +
    `${pe('coin')} ${ru ? 'Цена:' : 'Price:'} ${plugin.price > 0 ? `${plugin.price} TON` : (ru ? 'Бесплатно' : 'Free')}\n` +
    `${pe('wrench')} ${ru ? 'Теги:' : 'Tags:'} ${escHtml(plugin.tags.join(', '))}\n\n`;

  if (isInstalled) {
    text += `${pe('check')} <b>${ru ? 'Установлен' : 'Installed'}</b> — ${ru ? 'агенты используют этот API' : 'agents use this API'}\n\n`;
  } else {
    text += `${pe('brain')} <b>${ru ? 'После установки AI-агенты получат:' : 'After install agents get:'}</b>\n`;
    text += `${ru ? '• Точный синтаксис всех API-вызовов' : '• Exact API call syntax'}\n`;
    text += `${ru ? '• Форматы ответов и готовые примеры' : '• Response formats and ready examples'}\n`;
    text += `${ru ? '• Автоматическое использование в новых агентах' : '• Auto-use in new agents'}\n`;
    if (skillLines) text += `\n<b>API:</b>\n${skillLines}\n`;
  }

  await editOrReply(ctx, text, { parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: isInstalled ? `🗑 ${ru ? 'Удалить' : 'Remove'}` : `${peb('check')} ${ru ? 'Установить' : 'Install'}${plugin.price > 0 ? ` (${plugin.price} TON)` : ''}`, callback_data: `plugin_${isInstalled ? 'uninstall' : 'install'}:${pluginId}` }],
        [{ text: `◀️ ${ru ? 'Назад' : 'Back'}`, callback_data: 'plugins' }],
      ],
    },
  });
}

// ============================================================
// Workflow
// ============================================================
/** Generate a stable callback key for a workflow template (slug from name, fallback to index). */
function _workflowTemplateKey(t: { name: string }, idx: number): string {
  const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
  return slug || String(idx);
}

/** Resolve a workflow template key (slug or numeric index) back to an array index. */
function _resolveWorkflowTemplateIndex(key: string): number {
  const templates = getWorkflowEngine().getWorkflowTemplates();
  // Try matching by slug first
  const idx = templates.findIndex((t, i) => _workflowTemplateKey(t, i) === key);
  if (idx >= 0) return idx;
  // Fallback: try parsing as numeric index (backwards compat)
  const num = parseInt(key, 10);
  if (!isNaN(num) && num >= 0 && num < templates.length) return num;
  return -1;
}

async function showWorkflows(ctx: Context, userId: number) {
  const lang = getUserLang(userId);
  const engine = getWorkflowEngine();
  const workflows = engine.getUserWorkflows(userId);
  const templates = engine.getWorkflowTemplates();

  let text = `${pe('bolt')} <b>Workflow — ${lang === 'ru' ? 'цепочки агентов' : 'agent chains'}</b>\n\n`;
  text += `${lang === 'ru' ? 'Соединяйте агентов в автоматические цепочки.' : 'Connect agents into automatic chains.'}\n`;
  text += `<i>${lang === 'ru' ? 'Например: проверь баланс → если мало → уведоми' : 'Example: check balance → if low → notify'}</i>\n\n`;

  if (workflows.length) {
    text += `<b>${lang === 'ru' ? `Ваши workflow (${workflows.length}):` : `Your workflows (${workflows.length}):`}</b>\n`;
    workflows.forEach(wf => {
      text += `${pe('bolt')} ${escHtml(wf.name)} — ${wf.nodes.length} ${lang === 'ru' ? 'шагов' : 'steps'}\n`;
    });
    text += '\n';
  }

  text += `<b>${lang === 'ru' ? 'Готовые шаблоны:' : 'Ready templates:'}</b>\n`;
  templates.forEach((t, i) => { text += `${i + 1}. ${escHtml(t.name)}\n`; });

  const btns = templates.map((t, i) => [{ text: `${peb('clipboard')} ${t.name}`, callback_data: `workflow_template:${_workflowTemplateKey(t, i)}` }]);
  btns.push([{ text: `${peb('robot')} ${lang === 'ru' ? 'Описать workflow (AI создаст)' : 'Describe workflow (AI creates)'}`, callback_data: 'workflow_describe' }]);
  btns.push([{ text: `${peb('plus')} ${lang === 'ru' ? 'Выбрать шаблон' : 'Choose template'}`, callback_data: 'workflow_create' }]);
  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

async function showWorkflowTemplate(ctx: Context, idx: number) {
  const templates = getWorkflowEngine().getWorkflowTemplates();
  const t = templates[idx];
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  const text =
    `⚡ <b>${escHtml(t.name)}</b>\n\n${escHtml(t.description)}\n\n` +
    `Узлов: <b>${escHtml(t.nodes.length)}</b>\n\nНажмите "Создать" чтобы запустить этот workflow:`;

  await editOrReply(ctx, text, { parse_mode: 'HTML',
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
      `✅ <b>Workflow создан!</b>\n\nНазвание: ${escHtml(t.name)}\nID: ${escHtml(result.workflowId)}\n\nАгенты кооперируются автоматически!`,
      { parse_mode: 'HTML' }
    );
  } else {
    await ctx.reply(`❌ Ошибка: ${result.error}`);
  }
}

// ============================================================
// Статистика
// ============================================================
async function showStats(ctx: Context, userId: number) {
  const lang = getUserLang(userId);
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
  const isOwner = isPlatformAdmin(userId);
  const currentModel = getUserModel(userId);
  const modelInfo = MODEL_LIST.find(m => m.id === currentModel);

  let text =
    `${pe('chart')} <b>${lang === 'ru' ? 'Ваша панель управления' : 'Your Dashboard'}</b>\n${div()}\n` +
    `${pe('robot')} <b>${lang === 'ru' ? 'Агенты' : 'Agents'}</b>\n` +
    `${lang === 'ru' ? 'Всего' : 'Total'}: <b>${agents.length}</b> · ${lang === 'ru' ? 'Активных' : 'Active'}: <b>${active}</b> · ${lang === 'ru' ? 'По расписанию' : 'Scheduled'}: <b>${scheduled}</b>\n\n` +
    `${pe('diamond')} <b>TON</b>\n`;

  if (isConnected && wallet) {
    text += `TON Connect: ${pe('check')} ${escHtml(wallet.walletName)}\n`;
    text += `${lang === 'ru' ? 'Адрес' : 'Address'}: <code>${escHtml(wallet.friendlyAddress)}</code>\n`;
  } else {
    text += `TON Connect: ❌ ${lang === 'ru' ? 'не подключён' : 'not connected'}\n`;
  }

  if (agentBalance !== null) {
    text += `${lang === 'ru' ? 'Агентский кошелёк' : 'Agent wallet'}: <b>${agentBalance.toFixed(4)}</b> TON\n`;
  }

  // Execution stats
  let execStats = '';
  try {
    const { getExecutionHistoryRepository } = await import('./db/schema-extensions');
    const stats = await getExecutionHistoryRepository().getStats(userId);
    execStats = `\n📊 <b>${lang === 'ru' ? 'Активность' : 'Activity'}</b>\n` +
      `${lang === 'ru' ? 'Запусков за 24ч' : 'Runs 24h'}: <b>${stats.last24hRuns}</b> · ` +
      `${lang === 'ru' ? 'Всего' : 'Total'}: <b>${stats.totalRuns}</b>\n` +
      `✅ ${stats.successRuns} · ❌ ${stats.errorRuns}\n`;
  } catch {}

  text +=
    `\n${pe('brain')} <b>AI</b>\n` +
    `${lang === 'ru' ? 'Модель' : 'Model'}: ${escHtml(modelInfo?.icon || '')} <b>${escHtml(modelInfo?.label || currentModel)}</b>\n` +
    `${lang === 'ru' ? 'Авто-fallback' : 'Auto-fallback'}: ${pe('check')} ${lang === 'ru' ? 'включён' : 'enabled'}\n` +
    execStats + `\n` +
    `${pe('plugin')} <b>${lang === 'ru' ? 'Плагины' : 'Plugins'}</b>\n` +
    `${lang === 'ru' ? 'Доступно' : 'Available'}: <b>${pluginStats.total}</b> · ${lang === 'ru' ? 'Установлено' : 'Installed'}: <b>${pluginStats.installed}</b>`;

  const keyboard: any[][] = [
    [
      { text: `${peb('robot')} ${lang === 'ru' ? 'Мои агенты' : 'My agents'}`, callback_data: 'list_agents' },
      { text: `${peb('brain')} ${lang === 'ru' ? 'Сменить модель' : 'Change model'}`, callback_data: 'model_selector' },
    ],
  ];
  if (isConnected) {
    keyboard.push([{ text: `${peb('diamond')} ${lang === 'ru' ? 'TON кошелёк' : 'TON wallet'}`, callback_data: 'ton_connect' }]);
  } else {
    keyboard.push([{ text: `${peb('diamond')} ${lang === 'ru' ? 'Подключить TON' : 'Connect TON'}`, callback_data: 'ton_connect' }]);
  }
  keyboard.push([{ text: `${peb('globe')} ${lang === 'ru' ? 'Открыть студию' : 'Open Studio'}`, url: 'https://tonagentplatform.com/studio' }]);
  if (isOwner) {
    keyboard.push([{ text: `⚙️ ${lang === 'ru' ? 'Настройки платформы' : 'Platform settings'}`, callback_data: 'platform_settings' }]);
  }

  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
}

// ============================================================
// Выбор модели AI
// ============================================================
async function showModelSelector(ctx: Context) {
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  const current = getUserModel(userId);
  const currentInfo = MODEL_LIST.find(m => m.id === current);

  let text =
    `${pe('brain')} <b>${lang === 'ru' ? 'Выбор AI модели' : 'Choose AI Model'}</b>\n\n` +
    `${lang === 'ru' ? 'Активная' : 'Active'}: ${escHtml(currentInfo?.icon || '')} <b>${escHtml(currentInfo?.label || current)}</b>\n\n` +
    `${lang === 'ru' ? 'При недоступности — бот автоматически пробует следующую модель в цепочке.' : 'If unavailable — bot automatically tries the next model in the chain.'}\n\n` +
    `<b>${lang === 'ru' ? 'Доступные модели:' : 'Available models:'}</b>\n`;

  MODEL_LIST.forEach(m => {
    const isCurrent = m.id === current;
    const tags: string[] = [];
    if ((m as any).recommended) tags.push(lang === 'ru' ? '⭐ рекомендована' : '⭐ recommended');
    if ((m as any).fast) tags.push(lang === 'ru' ? '⚡ быстрая' : '⚡ fast');
    const tagStr = tags.length ? ` — <i>${escHtml(tags.join(', '))}</i>` : '';
    text += `${isCurrent ? '▶️' : '  '} ${escHtml(m.icon)} ${escHtml(m.label)}${isCurrent ? ' ✅' : ''}${tagStr}\n`;
  });

  const btns = MODEL_LIST.map(m => [{
    text: `${m.id === current ? '✅ ' : ''}${m.icon} ${m.label}`,
    callback_data: `set_model:${m.id}`,
  }]);

  await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

// ============================================================
// Подписки и оплата
// ============================================================

async function showSubscription(ctx: Context) {
  const userId = ctx.from!.id;
  const lang = getUserLang(userId);
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.planId] || PLANS.free;
  const isOwner = isPlatformAdmin(userId);

  let text =
    `${pe('card')} <b>${lang === 'ru' ? 'Подписка' : 'Subscription'}</b>\n\n` +
    `${lang === 'ru' ? 'Текущий план' : 'Current plan'}: ${escHtml(formatSubscription(sub))}\n\n` +
    `${div()}\n${escHtml(plan.icon)} <b>${escHtml(plan.name)}</b>\n`;

  plan.features.forEach(f => { text += `${pe('check')} ${escHtml(f)}\n`; });

  // Показываем использование генераций
  const genUsed = getGenerationsUsed(userId);
  const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
  text += `\n${pe('bolt')} ${lang === 'ru' ? 'Генерации AI' : 'AI generations'}: <b>${genUsed}/${genLimit}</b> ${lang === 'ru' ? 'в этом месяце' : 'this month'}\n`;
  if (plan.pricePerGeneration > 0) {
    text += `${pe('money')} ${lang === 'ru' ? 'Цена за генерацию' : 'Price per generation'}: <b>${plan.pricePerGeneration} TON</b>\n`;
  }

  if (!isOwner && plan.id === 'free') {
    text +=
      `\n${pe('sparkles')} <b>${lang === 'ru' ? 'Upgrade для большего:' : 'Upgrade for more:'}</b>\n` +
      `• ${lang === 'ru' ? 'До 100 агентов одновременно' : 'Up to 100 agents'}\n` +
      `• ${lang === 'ru' ? 'Включённые генерации AI/мес' : 'Included AI generations/month'}\n` +
      `• ${lang === 'ru' ? 'Расписание + Webhook + Workflow' : 'Schedule + Webhook + Workflow'}\n` +
      `• ${lang === 'ru' ? 'API доступ' : 'API access'}`;
  } else if (!isOwner && sub.expiresAt) {
    const days = Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86400000);
    text += `\n${pe('hourglass')} ${lang === 'ru' ? 'Истекает через' : 'Expires in'} <b>${days}</b> ${lang === 'ru' ? 'дн.' : 'days'}`;
  }

  const btns: any[][] = [];
  if (!isOwner) {
    btns.push([{ text: `${peb('rocket')} ${lang === 'ru' ? 'Улучшить план' : 'Upgrade plan'}`, callback_data: 'plans_menu' }]);
  }
  btns.push([
    { text: `${peb('robot')} ${lang === 'ru' ? 'Мои агенты' : 'My agents'}`, callback_data: 'list_agents' },
    { text: `${peb('diamond')} TON Connect`, callback_data: 'ton_connect' },
  ]);

  await safeReply(ctx, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } });
}

async function showPlans(ctx: Context) {
  const userId = ctx.from!.id;
  const currentSub = await getUserSubscription(userId);

  let text =
    `${pe('diamond')} <b>Планы TON Agent Platform</b>\n` +
    `${div()}\n` +
    `<i>Оплата в TON · напрямую · без посредников</i>\n\n`;

  const planOrder = ['free', 'starter', 'pro', 'unlimited'];
  for (const pid of planOrder) {
    const p = PLANS[pid];
    const isCurrent = currentSub.planId === pid;
    const isPopular = pid === 'pro';
    const marker = isCurrent ? '✅ ' : isPopular ? '🔥 ' : '   ';
    text += `${marker}${p.icon} <b>${escHtml(p.name)}</b>`;
    if (p.priceMonthTon === 0) {
      text += ' — <i>бесплатно</i>\n';
    } else {
      text += ` — <b>${escHtml(String(p.priceMonthTon))} TON</b>/мес\n`;
    }
    text += `    ${escHtml(p.features.slice(0, 3).join(' · '))}\n\n`;
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
    `💳 <b>Оплата подписки</b>\n\n` +
    `${plan.icon} <b>${escHtml(plan.name)}</b> на ${escHtml(periodLabel)}\n` +
    `Сумма: <b>${escHtml(payment.amountTon)} TON</b>\n\n` +
    `💳 <b>Способы оплаты</b>\n\n`;

  if (isConnected) {
    text +=
      `<b>1. Через подключённый кошелёк</b> (рекомендуется)\n` +
      `Нажмите кнопку — подтвердите в Tonkeeper\n\n`;
  }

  text +=
    `<b>${isConnected ? '2' : '1'}. Вручную</b>\n` +
    `Отправьте <b>${escHtml(payment.amountTon)} TON</b> на адрес:\n` +
    `<code>${escHtml(payment.address)}</code>\n\n` +
    `Комментарий (обязательно):\n` +
    `<code>${escHtml(payment.comment)}</code>\n\n` +
    `⏱ Счёт действителен <b>${escHtml(expiresMin)} мин</b>.`;

  // Check user balance for "pay from balance" option
  const profile = await getUserProfile(userId);
  const hasBalance = profile.balance_ton >= payment.amountTon;

  const btns: any[][] = [];
  if (hasBalance) {
    btns.push([{ text: `💰 Оплатить с баланса (${profile.balance_ton.toFixed(2)} TON)`, callback_data: `pay_balance:sub:${planId}:${period}` }]);
  }
  if (isConnected) {
    btns.push([{ text: `💸 Оплатить ${payment.amountTon} TON через Tonkeeper`, callback_data: `pay_tonconnect:${planId}:${period}` }]);
  }
  btns.push([{ text: '✅ Я оплатил — проверить', callback_data: 'check_payment' }]);
  btns.push([{ text: '◀️ Отмена', callback_data: 'cancel_payment' }]);

  if (hasBalance) {
    text += `\n\n💰 <b>Ваш баланс: ${profile.balance_ton.toFixed(2)} TON</b> — можно оплатить сразу!`;
  }

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
        `🎉 <b>Оплата подтверждена!</b>\n\n` +
        `${result.plan.icon} <b>${escHtml(result.plan.name)}</b> активирован\n` +
        `Действует до: <b>${escHtml(expStr)}</b>\n\n` +
        `Спасибо за поддержку платформы! 🙏`,
        { parse_mode: 'HTML' }
      );
      await showSubscription(ctx);
    }
  } else {
    const minLeft = Math.ceil((pending.expiresAt.getTime() - Date.now()) / 60000);
    await ctx.reply(
      `⏳ Транзакция ещё не найдена.\n\n` +
      `Убедитесь что отправили <b>${escHtml(String(pending.amountTon))} TON</b>\n` +
      `с комментарием: <code>sub:${escHtml(String(pending.planId))}:${escHtml(String(pending.period))}:${userId}</code>\n\n` +
      `Осталось времени: <b>${minLeft} мин</b>\nПопробуйте снова через 1-2 минуты.`,
      { parse_mode: 'HTML',
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
  const lang = getUserLang(ctx.from?.id || 0);
  const text = lang === 'ru'
    ? `${pe('question')} <b>TON Agent Platform — Справка</b>\n\n` +
      `${pe('rocket')} <b>Как создать агента</b>\n\n` +
      `Просто напишите задачу своими словами:\n` +
      `<i>"проверяй баланс кошелька UQ... каждый час"</i>\n` +
      `<i>"следи за ценой TON, уведоми если выше $5"</i>\n` +
      `<i>"каждое 10-е число отправляй 50 TON на UQ..."</i>\n\n` +
      `Агент создаётся автоматически и запускается на нашем сервере — <b>ничего устанавливать не нужно</b>.\n\n` +
      `${pe('clipboard')} <b>Команды</b>\n\n` +
      `/start — главное меню\n` +
      `/list — мои агенты\n` +
      `/run ID — запустить агента (пример: /run 3)\n` +
      `/config — мои переменные (ключи, адреса)\n` +
      `/model — выбрать AI модель\n` +
      `/sub — моя подписка\n` +
      `/plans — тарифы и оплата\n` +
      `/connect — подключить TON кошелёк (Tonkeeper)\n` +
      `/wallet — агентский кошелёк (без мобильного приложения)\n` +
      `/marketplace — готовые шаблоны агентов\n\n` +
      `${pe('sparkles')} <b>Что умеют агенты</b>\n\n` +
      `• Работать с <b>любыми</b> публичными API\n` +
      `• Мониторить TON-кошельки и цены\n` +
      `• Отправлять TON по расписанию\n` +
      `• Делать запросы к DEX (DeDust, STON.fi)\n` +
      `• Уведомлять вас в Telegram`
    : `${pe('question')} <b>TON Agent Platform — Help</b>\n\n` +
      `${pe('rocket')} <b>How to create an agent</b>\n\n` +
      `Just describe your task in plain words:\n` +
      `<i>"check wallet balance UQ... every hour"</i>\n` +
      `<i>"monitor TON price, alert if above $5"</i>\n` +
      `<i>"send 50 TON to UQ... on the 10th of each month"</i>\n\n` +
      `Agent is created automatically and runs on our server — <b>nothing to install</b>.\n\n` +
      `${pe('clipboard')} <b>Commands</b>\n\n` +
      `/start — main menu\n` +
      `/list — my agents\n` +
      `/run ID — run agent (example: /run 3)\n` +
      `/config — my variables (keys, addresses)\n` +
      `/model — choose AI model\n` +
      `/sub — my subscription\n` +
      `/plans — pricing\n` +
      `/connect — connect TON wallet (Tonkeeper)\n` +
      `/wallet — agent wallet (no mobile app needed)\n` +
      `/marketplace — ready-made agent templates\n\n` +
      `${pe('sparkles')} <b>What agents can do</b>\n\n` +
      `• Work with <b>any</b> public API\n` +
      `• Monitor TON wallets and prices\n` +
      `• Send TON on schedule\n` +
      `• Query DEX (DeDust, STON.fi)\n` +
      `• Notify you in Telegram`;

  await safeReply(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `${peb('store')} ${lang === 'ru' ? 'Маркетплейс' : 'Marketplace'}`, callback_data: 'marketplace' },
          { text: `${peb('robot')} ${lang === 'ru' ? 'Мои агенты' : 'My agents'}`, callback_data: 'list_agents' },
        ],
        [
          { text: `${peb('brain')} ${lang === 'ru' ? 'AI модель' : 'AI model'}`, callback_data: 'model_selector' },
          { text: `${peb('diamond')} TON ${lang === 'ru' ? 'кошелёк' : 'wallet'}`, callback_data: 'ton_connect' },
        ],
        [{ text: `${peb('globe')} ${lang === 'ru' ? 'Открыть студию' : 'Open Studio'}`, url: 'https://tonagentplatform.com/studio' }],
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
export function getBotInstance(): Telegraf | null {
  return bot;
}

export async function startBot() {
  initNotifier(bot);
  try { const { initCrewSystem } = require('./services/crew-system'); initCrewSystem(dbPool); } catch (e: any) { console.warn('CrewSystem init failed:', e.message); }
  try { const { initReputation } = require('./services/agent-reputation'); initReputation(dbPool); } catch (e: any) { console.warn('Reputation init failed:', e.message); }
  try { const { initTonDNS } = require('./services/ton-dns'); await initTonDNS(dbPool); } catch (e: any) { console.warn('TonDNS init failed:', e.message); }
  try { const { initPluginMarketplace } = require('./services/plugin-marketplace'); initPluginMarketplace(dbPool); } catch (e: any) { console.warn('PluginMarketplace init failed:', e.message); }

  console.log('🤖 Starting TON Agent Platform Bot...');
  console.log(`🏪 Loaded ${allAgentTemplates.length} agent templates`);
  console.log(`🔌 Loaded ${getPluginManager().getAllPlugins().length} plugins`);

  // Verify bot can connect to Telegram before proceeding
  await bot.telegram.getMe();

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
  // Verify platform wallet config at startup
  verifyPlatformWalletConfig().catch(e => console.warn('[Bot] verifyPlatformWalletConfig:', e?.message || e));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };
