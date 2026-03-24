/**
 * Platform-wide configuration constants.
 * ALL hardcoded values centralized here.
 * Override via environment variables.
 */

// ── Platform identity ──
export const DOMAIN = process.env.DOMAIN_NAME || 'tonagentplatform.ru';
export const BOT_USERNAME = process.env.BOT_USERNAME || '@TonAgentPlatformBot';
export const DASHBOARD_URL = process.env.DASHBOARD_URL || `https://${DOMAIN}/studio.html`;
export const PLATFORM_NAME = 'TON Agent Platform';

// ── AI Model defaults (update when providers deprecate models) ──
export const MODELS = {
  // Gemini
  gemini:         process.env.GEMINI_MODEL         || 'gemini-2.5-flash',
  geminiPro:      process.env.GEMINI_PRO_MODEL      || 'gemini-2.5-pro',
  geminiLite:     process.env.GEMINI_LITE_MODEL     || 'gemini-2.5-flash-lite',
  // Anthropic
  claude:         process.env.CLAUDE_MODEL          || 'claude-haiku-4-5-20251001',
  claudeSmart:    process.env.CLAUDE_SMART_MODEL    || 'anthropic/claude-sonnet-4-20250514',
  // OpenAI
  openai:         process.env.OPENAI_MODEL          || 'gpt-4o-mini',
  openaiSmart:    process.env.OPENAI_SMART_MODEL    || 'gpt-4o',
  // Groq
  groq:           process.env.GROQ_MODEL            || 'llama-3.3-70b-versatile',
  // DeepSeek
  deepseek:       process.env.DEEPSEEK_MODEL        || 'deepseek-chat',
  // OpenRouter
  openrouter:     process.env.OPENROUTER_MODEL      || 'google/gemini-2.5-flash',
  // Together
  together:       process.env.TOGETHER_MODEL        || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
};

// ── AI Provider base URLs ──
export const PROVIDER_URLS = {
  gemini:     'https://generativelanguage.googleapis.com/v1beta/openai/',
  anthropic:  'https://openrouter.ai/api/v1',
  openai:     'https://api.openai.com/v1',
  groq:       'https://api.groq.com/openai/v1',
  deepseek:   'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together:   'https://api.together.xyz/v1',
};

// ── API versions ──
export const API_VERSIONS = {
  anthropic: process.env.ANTHROPIC_API_VERSION || '2023-06-01',
};

// ── Financial limits ──
export const LIMITS = {
  highValueTxTon:  parseInt(process.env.HIGH_VALUE_TX_LIMIT_TON || '100'),
  dailySpendTon:   parseInt(process.env.DAILY_SPEND_LIMIT_TON || '500'),
  maxMessageLen:   2000,
  maxToolsPerTick: 80,
  maxContextChars: 30_000,
  channelPostCooldownMs: 30 * 60 * 1000,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 10 * 60_000,
  toolCircuitBreakerResetMs: 5 * 60_000,
  maxConversationHistoryChars: 50_000,
};

// ── Context limits per provider ──
export const PROVIDER_LIMITS: Record<string, { maxContextChars: number; maxTools: number }> = {
  gemini:     { maxContextChars: 25_000, maxTools: 30 },
  anthropic:  { maxContextChars: 40_000, maxTools: 80 },
  openai:     { maxContextChars: 30_000, maxTools: 80 },
  groq:       { maxContextChars: 15_000, maxTools: 40 },
  deepseek:   { maxContextChars: 25_000, maxTools: 60 },
  openrouter: { maxContextChars: 25_000, maxTools: 60 },
  together:   { maxContextChars: 15_000, maxTools: 40 },
};

// ── Platform AI (fallback when user has no key) ──
export const PLATFORM_AI = {
  url:   process.env.PLATFORM_AI_URL   || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  key:   process.env.PLATFORM_AI_KEY   || '',
  model: process.env.PLATFORM_AI_MODEL || 'gemini-2.5-flash',
};

// ── Freshness detection patterns (for auto web_search) ──
export const FRESHNESS_PATTERNS = /последн|актуальн|новей|свеж|latest|newest|current|сколько стоит|цена|price|какой год|what year|фото|фотк|photo|picture|image|картинк/i;
export const PRODUCT_PATTERNS = /iphone|айфон|samsung|самсунг|pixel|macbook|tesla|тесла|bitcoin|биткоин|ton coin|ethereum|эфир|android|galaxy|nvidia|openai|chatgpt|claude|gemini/i;
export const PHOTO_PATTERNS = /фото|фотк|картинк|изображен|photo|picture|image|скинь.*фот|отправь.*фот|покажи.*фот/i;
