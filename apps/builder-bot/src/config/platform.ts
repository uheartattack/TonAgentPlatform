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
  // Anthropic (Anthropic CLI OAuth token — direct api.anthropic.com)
  claude:         process.env.CLAUDE_MODEL          || 'claude-opus-4-6',
  claudeSmart:    process.env.CLAUDE_SMART_MODEL    || 'claude-opus-4-6',
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
  anthropic:  'https://api.anthropic.com/v1',
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
// April 2026 FREE-tier safe values. See docs/PROVIDER_LIMITS.md for full breakdown.
// Each provider's TPM determines safe tool count: tools ≈ 300 tokens each.
// Groq free = 12K TPM → 40 tools × 300 = 12K tokens consumed just by tools = 413.
// User upgrades (Groq Dev, Anthropic tier 2+, OpenAI tier 1+) can override via
// agent.trigger_config.config.MAX_TOOLS (respected in buildPromptForLoop).
export const PROVIDER_LIMITS: Record<string, { maxContextChars: number; maxTools: number }> = {
  gemini:     { maxContextChars: 40_000, maxTools: 60  },  // 250K TPM free, plenty
  anthropic:  { maxContextChars: 40_000, maxTools: 128 },  // paid only, 30K-800K ITPM
  openai:     { maxContextChars: 30_000, maxTools: 80  },  // tier-1 500K TPM
  groq:       { maxContextChars: 8_000,  maxTools: 15  },  // 12K TPM free (llama-3.3-70b)
  deepseek:   { maxContextChars: 25_000, maxTools: 60  },  // 1M TPM, 60 RPM bottleneck
  openrouter: { maxContextChars: 20_000, maxTools: 40  },  // 20 RPM free, 50-1000 RPD
  together:   { maxContextChars: 15_000, maxTools: 30  },  // dynamic 60 RPM baseline
};

// ── Platform AI (fallback when user has no key) ──
// Uses Anthropic CLI OAuth token (CLAUDE_CODE_OAUTH_TOKEN) → Anthropic API
// Override via PLATFORM_AI_URL / PLATFORM_AI_KEY / PLATFORM_AI_MODEL
export const PLATFORM_AI = {
  url:   process.env.PLATFORM_AI_URL   || 'https://api.anthropic.com/v1',
  key:   process.env.PLATFORM_AI_KEY   || process.env.CLAUDE_CODE_OAUTH_TOKEN || '',
  model: process.env.PLATFORM_AI_MODEL || 'claude-opus-4-6',
};

// ── Freshness detection patterns (for auto web_search) ──
export const FRESHNESS_PATTERNS = /последн|актуальн|новей|свеж|latest|newest|current|сколько стоит|цена|price|какой год|what year|фото|фотк|photo|picture|image|картинк/i;
export const PRODUCT_PATTERNS = /iphone|айфон|samsung|самсунг|pixel|macbook|tesla|тесла|bitcoin|биткоин|ton coin|ethereum|эфир|android|galaxy|nvidia|openai|chatgpt|claude|gemini/i;
export const PHOTO_PATTERNS = /фото|фотк|картинк|изображен|photo|picture|image|скинь.*фот|отправь.*фот|покажи.*фот/i;
