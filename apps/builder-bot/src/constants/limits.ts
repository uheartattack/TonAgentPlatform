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
export const PROVIDER_TOOL_LIMITS: Record<string, number> = {
  gemini:     60,
  anthropic:  128,
  openai:     80,
  groq:       40,
  deepseek:   60,
  openrouter: 60,
  together:   40,
  default:    60,
};

// ── Provider Max Context Chars ──────────────────────────────────────────────
export const PROVIDER_MAX_CONTEXT_CHARS: Record<string, number> = {
  gemini:     20_000,
  anthropic:  40_000,
  openai:     30_000,
  groq:       15_000,
  deepseek:   25_000,
  openrouter: 25_000,
  together:   15_000,
  default:    20_000,
};

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
