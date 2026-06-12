/**
 * limits.ts — centralized limits & constants for the AI agent runtime.
 * Single source of truth for all tuning knobs.
 */

// ── Token & Context ─────────────────────────────────────────────────────────
export const CHARS_PER_TOKEN_ESTIMATE = 4;
export const TOKEN_ESTIMATE_SAFETY_MARGIN = 1.2;

/** Per-provider context windows (tokens) */
export const PROVIDER_CONTEXT_WINDOWS: Record<string, number> = {
  gemini:     96_000,
  anthropic:  96_000,
  openai:     96_000,
  groq:       32_000,
  deepseek:   64_000,
  openrouter: 96_000,
  together:   32_000,
  default:    64_000,
};

/** Max tokens to use (soft limit before compaction triggers) */
export const DEFAULT_MAX_TOKENS = 96_000;
export const DEFAULT_SOFT_THRESHOLD_TOKENS = 64_000;
export const FALLBACK_SOFT_THRESHOLD_TOKENS = 6_000;

/** Compaction ratios */
export const COMPACTION_MAX_TOKENS_RATIO = 0.75;
export const COMPACTION_SOFT_THRESHOLD_RATIO = 0.5;

// ── Messages ────────────────────────────────────────────────────────────────
export const COMPACTION_MAX_MESSAGES = 200;
export const COMPACTION_KEEP_RECENT = 20;
export const CONTEXT_MAX_RECENT_MESSAGES = 10;
export const MIN_KEEP_MESSAGES = 6;
export const MEMORY_FLUSH_RECENT_MESSAGES = 5;
export const CONTEXT_OVERFLOW_SUMMARY_MESSAGES = 15;

// ── Tool Results ────────────────────────────────────────────────────────────
export const MAX_TOOL_RESULT_SIZE = 50_000;
export const RESULT_TRUNCATION_THRESHOLD = 4_000;
export const RESULT_TRUNCATION_KEEP_CHARS = 500;
export const MAX_JSON_FIELD_CHARS = 8_000;

// ── Tool RAG ────────────────────────────────────────────────────────────────
export const TOOL_RAG_DEFAULT_TOP_K = 35;
export const TOOL_RAG_MIN_SCORE = 0.1;
export const TOOL_RAG_VECTOR_WEIGHT = 0.6;
export const TOOL_RAG_KEYWORD_WEIGHT = 0.4;

// ── Observation Masking ─────────────────────────────────────────────────────
export const MASKING_KEEP_RECENT_COUNT = 10;
export const OVERSIZED_MESSAGE_RATIO = 0.5;

// ── Agentic Loop ────────────────────────────────────────────────────────────
export const DEFAULT_MAX_ITERATIONS = 5;
export const TOOL_CONCURRENCY_LIMIT = 3;
export const STALL_DETECTION_WINDOW = 3;

// ── Heartbeat & Silent Tokens ───────────────────────────────────────────────
/** Agent returns this to signal "nothing to do" — no outbound message */
export const HEARTBEAT_OK_TOKEN = 'NO_ACTION';
/** Agent returns this to suppress outgoing message */
export const SILENT_REPLY_TOKEN = '__SILENT__';

/** Check if AI response is a heartbeat "nothing to do" */
export function isHeartbeatOk(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t === HEARTBEAT_OK_TOKEN) return true;
  if (t.startsWith(HEARTBEAT_OK_TOKEN)) return true;
  if (t.endsWith(HEARTBEAT_OK_TOKEN)) return true;
  const lines = t.split('\n');
  return lines[lines.length - 1].trim() === HEARTBEAT_OK_TOKEN;
}

/** Check if AI response should suppress outgoing message */
export function isSilentReply(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return t === SILENT_REPLY_TOKEN || t.endsWith(SILENT_REPLY_TOKEN);
}

// ── Telegram ────────────────────────────────────────────────────────────────
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4_096;
export const FEED_MESSAGE_MAX_CHARS = 2_000;

// ── TON / TX economics ──────────────────────────────────────────────────────
/** Estimated network gas reserve added on top of every TX amount. */
export const GAS_TON = 0.1;
/** Smaller gas reserve used for buy_market_gift to match SwiftGifts expected amount. */
export const GAS_TON_MARKET_BUY = 0.01;
/** Default max TON a single TX can move. */
export const HIGH_VALUE_TX_LIMIT_TON = 10;
/** Daily spend cap default (TON). Can be overridden per agent via agent_state.daily_spend_limit_ton. */
export const DAILY_SPEND_LIMIT_TON_DEFAULT = 10;

// ── Marketplaces (canonical names) ──────────────────────────────────────────
/** Canonical marketplace identifiers expected by SwiftGifts / GiftAsset APIs. */
export const MARKETPLACE_CANONICAL: Record<string, string> = {
  tonnel:   'tonnel',
  portals:  'portals',
  mrkt:     'Mrkt',    // SwiftGifts is case-sensitive here
  getgems:  'getgems',
  fragment: 'fragment',
};
/** Normalize any casing to the canonical API value. Returns null if unknown. */
export function normalizeMarketplace(input: string | null | undefined): string | null {
  if (!input) return null;
  const k = String(input).toLowerCase().trim();
  return MARKETPLACE_CANONICAL[k] ?? null;
}
/** Default marketplace fees when API doesn't return them (percent). */
export const MARKETPLACE_FEE_DEFAULT: Record<string, number> = {
  portals:  3,
  tonnel:   3,
  mrkt:     3,
  getgems:  5,
  fragment: 5,
};

// ── Web ─────────────────────────────────────────────────────────────────────
export const WEB_SEARCH_MAX_RESULTS = 10;
export const WEB_FETCH_MAX_TEXT_LENGTH = 20_000;

// ── Rate Limiting & Retries ─────────────────────────────────────────────────
export const RATE_LIMIT_MAX_RETRIES = 3;
export const SERVER_ERROR_MAX_RETRIES = 3;

// ── Timeouts ────────────────────────────────────────────────────────────────
export const TOOL_EXECUTION_TIMEOUT_MS = 90_000;
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
export const TYPING_REFRESH_MS = 4_000;

// ── Pending History ─────────────────────────────────────────────────────────
export const PENDING_HISTORY_MAX_PER_CHAT = 50;
export const PENDING_HISTORY_MAX_AGE_MS = 86_400_000; // 24 hours

// ── Summarization ───────────────────────────────────────────────────────────
export const DEFAULT_MAX_SUMMARY_TOKENS = 2_000;
export const DEFAULT_SUMMARY_FALLBACK_TOKENS = 1_000;
export const ADAPTIVE_CHUNK_RATIO_BASE = 0.4;
export const ADAPTIVE_CHUNK_RATIO_MIN = 0.15;
export const ADAPTIVE_CHUNK_RATIO_TRIGGER = 0.1;

// ── Embedding & Search ──────────────────────────────────────────────────────
export const KNOWLEDGE_CHUNK_SIZE = 500;
export const HYBRID_SEARCH_MIN_SCORE = 0.15;
export const EMBEDDING_QUERY_MAX_CHARS = 1_000;
export const CONTEXT_MAX_RELEVANT_CHUNKS = 5;
export const RECENCY_DECAY_FACTOR = 0.05;
export const RECENCY_WEIGHT = 0.15;

// ── Provider Tool Limits ────────────────────────────────────────────────────
// Calibrated against each provider's FREE-tier TPM (tokens per minute).
// Tools bloat prompt: ~300 tokens each. Groq free = 12K TPM for llama-3.3-70b,
// so 40 tools × 300 = 12K just for tools → immediate 413 on first call.
// Halving to ~15 leaves room for system prompt + history + response.
// Providers with generous TPM (Gemini 250K, Anthropic paid) keep larger counts.
export const PROVIDER_TOOL_LIMITS: Record<string, number> = {
  gemini:     60,   // 250K TPM free — plenty of room
  anthropic:  128,  // paid only, 30K ITPM tier-1, 800K tier-3
  openai:     80,   // 500K TPM at tier-1
  groq:       15,   // 12K TPM free — tight, reduced from 40
  deepseek:   60,   // 1M TPM announced
  openrouter: 40,   // free models 20 RPM, varies by provider routing
  together:   30,   // dynamic 60 RPM baseline
  default:    40,
};

// ── Provider Max Context Chars ──────────────────────────────────────────────
export const PROVIDER_MAX_CONTEXT_CHARS: Record<string, number> = {
  gemini:     40_000,  // 1M tokens context, 250K TPM free
  anthropic:  40_000,  // 200K context
  openai:     30_000,  // 128K context
  groq:       8_000,   // 128K context but 12K TPM — conservative
  deepseek:   25_000,
  openrouter: 20_000,
  together:   15_000,
  default:    20_000,
};

// ── Provider Rate Limits (April 2026, FREE tier baseline) ──────────────────
// Used for: agent creation warnings, adaptive retry, tick interval suggestions.
// RPM = requests per minute, TPM = tokens per minute, RPD = requests per day.
// Keep values on the conservative side — real quotas vary by model and region.
export interface ProviderLimits {
  tier: 'free' | 'paid' | 'dynamic';
  rpm: number;
  tpm: number;
  rpd?: number;
  tpd?: number;
  ctx: number; // context window in tokens
  note?: string;
}
export const PROVIDER_FREE_LIMITS: Record<string, ProviderLimits> = {
  // Groq — llama-3.3-70b-versatile is tightest on free (12K TPM)
  groq:       { tier: 'free', rpm: 30,  tpm: 12_000,  rpd: 1_000, tpd: 100_000, ctx: 128_000, note: 'llama-3.3-70b: 12K TPM is a tight budget — keep prompts slim or use llama-3.1-8b (same RPM, lower per-token cost).' },
  gemini:     { tier: 'free', rpm: 10,  tpm: 250_000, rpd: 250,   ctx: 1_000_000, note: 'gemini-2.5-flash: 250K TPM is generous, but 10 RPM means <1 tick/6s. gemini-2.0-flash-lite is faster (30 RPM).' },
  openai:     { tier: 'free', rpm: 3,   tpm: 40_000,  rpd: 200,   ctx: 128_000, note: 'Very tight free tier — upgrade to tier-1 ($5) for any serious use.' },
  anthropic:  { tier: 'paid', rpm: 50,  tpm: 30_000,  ctx: 200_000, note: 'No free tier. Tier-1 requires $5 deposit → 50 RPM, 30K ITPM (Sonnet) / 50K ITPM (Haiku).' },
  deepseek:   { tier: 'paid', rpm: 60,  tpm: 1_000_000, ctx: 128_000, note: 'Flat pricing, no tier. 60 RPM is the main bottleneck. Free signup credit $5.' },
  openrouter: { tier: 'free', rpm: 20,  tpm: 100_000, rpd: 50,    ctx: 128_000, note: 'Free :free models = 20 RPM, 50 RPD. Purchase ≥$10 credits for 1000 RPD. Routing latency varies.' },
  together:   { tier: 'dynamic', rpm: 60, tpm: 200_000, ctx: 128_000, note: 'Dynamic limits, base 60 RPM. $5 signup credit. No traditional free tier.' },
};

/** Recommended MIN interval for agent ticks to stay inside free-tier RPM.
 *  If user sets interval below this, platform should warn. */
export function minSafeIntervalMs(provider: string): number {
  const p = (provider || 'default').toLowerCase();
  const limits = PROVIDER_FREE_LIMITS[p];
  if (!limits) return 60_000; // conservative default
  // Keep at least 3 requests/min headroom for user messages + tick
  const rpm = Math.max(1, limits.rpm - 3);
  return Math.max(15_000, Math.ceil(60_000 / rpm));
}

/** Human-readable warning for agent creation if settings risk hitting limits. */
export function getProviderWarnings(provider: string, intervalMs: number, toolCount: number): string[] {
  const warnings: string[] = [];
  const p = (provider || 'default').toLowerCase();
  const L = PROVIDER_FREE_LIMITS[p];
  if (!L) return warnings;
  const minMs = minSafeIntervalMs(p);
  if (intervalMs > 0 && intervalMs < minMs) {
    warnings.push(`⚠️ Interval ${Math.round(intervalMs / 1000)}s is tighter than ${p.toUpperCase()} free-tier RPM can handle (${L.rpm} RPM → min ${Math.round(minMs / 1000)}s between ticks). Agent will hit 429 errors.`);
  }
  const toolTokenEstimate = toolCount * 300;
  if (toolTokenEstimate > L.tpm * 0.5) {
    warnings.push(`⚠️ ${toolCount} tools ≈ ${toolTokenEstimate} tokens/tick, while ${p.toUpperCase()} free TPM = ${L.tpm}. Request may fail with 413. Reduce capabilities or upgrade tier.`);
  }
  if (L.note) warnings.push(`ℹ️ ${L.note}`);
  return warnings;
}

// ── Telegram Send Tools (detect when agent already sent output) ─────────────
export const TELEGRAM_SEND_TOOLS = new Set([
  'tg_send_message', 'tg_reply', 'tg_send_formatted',
  'tg_send_voice', 'tg_send_sticker', 'tg_send_gif',
  'tg_send_file', 'tg_send_album', 'tg_send_silent',
  'tg_forward', 'tg_send_with_buttons',
]);

// ── Context overflow detection patterns ─────────────────────────────────────
const OVERFLOW_PATTERNS = [
  'prompt is too long',
  'context length exceeded',
  'request_too_large',
  'maximum context length',
  'token limit',
  'tokens exceeds',
  'content too large',
  'prompt tokens limit exceeded',
  'tokens limit exceeded',
  'input too long',
];
export function isContextOverflowError(msg: string): boolean {
  const lower = (msg || '').toLowerCase();
  return OVERFLOW_PATTERNS.some(p => lower.includes(p))
    || (lower.includes('exceeds') && lower.includes('maximum'))
    || (lower.includes('context') && lower.includes('limit'));
}

// ── Gemini schema sanitizer ─────────────────────────────────────────────────
// Removes unsupported JSON Schema keywords that cause Gemini to reject tools
const GEMINI_UNSUPPORTED_KEYS = [
  '$schema', '$id', '$ref', '$defs', '$anchor',
  'title', 'default', 'examples', 'format',
  'additionalProperties', 'minItems', 'maxItems',
  'minLength', 'maxLength', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'pattern',
  'patternProperties', 'if', 'then', 'else',
];

function sanitizeSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(schema)) {
    if (GEMINI_UNSUPPORTED_KEYS.includes(key)) continue;

    if (key === 'anyOf' && Array.isArray(val)) {
      const constVals = (val as any[]).filter(v => v && v.const !== undefined);
      if (constVals.length > 0) {
        cleaned.type = typeof constVals[0].const === 'number' ? 'number' : 'string';
        cleaned.enum = constVals.map(v => v.const);
        continue;
      }
      const nonNull = (val as any[]).find(v => v && v.type !== 'null');
      if (nonNull) { Object.assign(cleaned, sanitizeSchemaForGemini(nonNull)); continue; }
    }

    if (key === 'oneOf' && Array.isArray(val)) {
      const nonNull = (val as any[]).find(v => v && v.type !== 'null');
      if (nonNull) { Object.assign(cleaned, sanitizeSchemaForGemini(nonNull)); continue; }
    }

    if (key === 'const') {
      cleaned.type = typeof val === 'number' ? 'number' : 'string';
      cleaned.enum = [val];
      continue;
    }

    cleaned[key] = sanitizeSchemaForGemini(val);
  }

  // Gemini requires type on every schema object with properties
  if (cleaned.properties && !cleaned.type) cleaned.type = 'object';
  // Gemini rejects empty properties {}
  if (cleaned.properties && typeof cleaned.properties === 'object' && Object.keys(cleaned.properties).length === 0) {
    delete cleaned.properties;
    if (cleaned.type === 'object') cleaned.type = 'string';
  }

  return cleaned;
}

/** Sanitize ALL tool parameter schemas for Gemini compatibility */
export function sanitizeToolsForGemini(tools: any[]): any[] {
  return tools.map(t => {
    if (!t?.function?.parameters) return t;
    return {
      ...t,
      function: {
        ...t.function,
        parameters: sanitizeSchemaForGemini(t.function.parameters),
      },
    };
  });
}

// ── Trivial message detection ───────────────────────────────────────────────
const TRIVIAL_PATTERNS = /^(ok|okay|ок|да|нет|yes|no|lol|haha|хаха|спасибо|thanks|thx|пон|ну|ага|угу|ясно|чел|бро|го|ладно|кек|xd|gg|\+|-)$/i;

export function isTrivialMessage(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (t.length === 0) return true;
  if (t.length <= 3 && !/\w/.test(t)) return true; // pure emoji/symbols
  return TRIVIAL_PATTERNS.test(t);
}
