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
// Now derived from src/config/provider-registry.ts (single source of truth).
// This object kept for backwards compatibility with existing callers.
import { PROVIDER_REGISTRY as _PR } from './provider-registry';
export const PROVIDER_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(_PR).map(([id, p]) => [id, p.baseURL])
);

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
// Derived from provider-registry (toolLimit null → 128 for safety in legacy callers)
export const PROVIDER_LIMITS: Record<string, { maxContextChars: number; maxTools: number }> = Object.fromEntries(
  Object.entries(_PR).map(([id, p]) => [id, {
    maxContextChars: p.maxContextChars,
    maxTools: p.toolLimit ?? 128,
  }])
);

// v2.3.5: PLATFORM_AI was a fallback so any agent without a personal API
// key could still run on the platform's own Gemini/Anthropic quota. Removed
// because it created an open-ended cost subsidy. Each user runs strictly on
// their own AI_API_KEY now. Atlas (the platform assistant) still uses the
// platform's keys directly via process.env.OPENAI_API_KEY / OPENROUTER_API_KEY
// — that's a platform service, not a user-agent runtime.

// ── Freshness detection patterns (for auto web_search) ──
export const FRESHNESS_PATTERNS = /последн|актуальн|новей|свеж|latest|newest|current|сколько стоит|цена|price|какой год|what year|фото|фотк|photo|picture|image|картинк/i;
export const PRODUCT_PATTERNS = /iphone|айфон|samsung|самсунг|pixel|macbook|tesla|тесла|bitcoin|биткоин|ton coin|ethereum|эфир|android|galaxy|nvidia|openai|chatgpt|claude|gemini/i;
export const PHOTO_PATTERNS = /фото|фотк|картинк|изображен|photo|picture|image|скинь.*фот|отправь.*фот|покажи.*фот/i;
