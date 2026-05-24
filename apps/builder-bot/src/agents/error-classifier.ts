/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ERROR CLASSIFIER
 *
 * Central translator from raw provider errors (OpenAI SDK / Anthropic SDK /
 * native HTTP) into a structured form the runtime can act on:
 *
 *   • transient: error will likely resolve by itself (rate limit, 5xx, timeout)
 *     → retry / wait / try alternate provider
 *   • permanent: error needs human intervention (bad key, no credits)
 *     → auto-pause + DM owner
 *
 * Before this module, the runtime had three near-duplicate if-else blocks
 * (ai-agent-runtime.ts:9909-9921, 9933-9945) doing this classification with
 * subtle differences. Centralising avoids drift and makes auto-pause threshold
 * tuning (transient=10 errors, permanent=3) trivial.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { PauseReason } from '../services/agent-auto-pause';

export interface ErrorClass {
  /** True if the error has any chance of resolving on retry (rate limit, 5xx, network blip). */
  transient: boolean;
  /** True if we should attempt to retry the SAME request immediately or after retryDelayMs. */
  retryable: boolean;
  /** True if we should try the SAME request on a different provider (e.g. OpenRouter fallback). */
  crossProviderRetryable: boolean;
  /** Auto-pause reason if this error type should count toward the pause counter, else undefined. */
  pauseReason?: PauseReason;
  /** Suggested delay before retry (ms). Undefined → caller decides. */
  retryDelayMs?: number;
  /** HTTP-ish status if extractable, else undefined. */
  status?: number;
  /** One-line description for logs / DM. */
  description: string;
}

/** Classify any provider error. Never throws — falls back to "unknown permanent". */
export function classifyError(err: any): ErrorClass {
  const status: number | undefined = err?.status ?? err?.statusCode ?? err?.response?.status;
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || err?.error?.code || '').toLowerCase();
  const body = err?.error?.message || err?.body?.message || '';

  // ── PERMANENT — needs user action ─────────────────────────────────────
  if (status === 401 || /invalid_api_key|invalid api key|expired_api_key|unauthorized/.test(msg)) {
    return {
      transient: false, retryable: false, crossProviderRetryable: false,
      pauseReason: 'INVALID_API_KEY', status,
      description: 'Invalid or expired API key',
    };
  }
  if (status === 402 || /insufficient_credits|insufficient credit|out of credits|no balance|payment required/.test(msg + ' ' + body.toLowerCase())) {
    return {
      transient: false, retryable: false, crossProviderRetryable: true,
      pauseReason: 'INSUFFICIENT_CREDITS', status,
      description: 'Provider account out of credits',
    };
  }

  // ── TRANSIENT — wait or try alternate ─────────────────────────────────
  if (status === 429 || /rate_limit|too many requests|429|tokens per minute|tpm/.test(msg)) {
    // 429 from upstream — try alternate provider sooner than waiting full reset
    return {
      transient: true, retryable: true, crossProviderRetryable: true,
      pauseReason: 'TPM_EXCEEDED', status: status || 429,
      retryDelayMs: 30_000, // 30s before same-provider retry
      description: 'Rate limit / TPM exceeded',
    };
  }
  if (status === 413 || /context.*overflow|context_length|maximum context length/.test(msg)) {
    return {
      transient: false, retryable: false, crossProviderRetryable: false,
      pauseReason: 'CONTEXT_OVERFLOW', status,
      description: 'Request too large for model context',
    };
  }
  if (status === 408 || /timeout|etimedout|esockettimedout/.test(msg)) {
    return {
      transient: true, retryable: true, crossProviderRetryable: true,
      status: status || 408, retryDelayMs: 5_000,
      description: 'Request timed out',
    };
  }
  if (status === 503 || status === 502 || status === 504 || /unavailable|bad gateway|gateway timeout|overloaded/.test(msg)) {
    return {
      transient: true, retryable: true, crossProviderRetryable: true,
      status, retryDelayMs: 10_000,
      description: 'Provider temporarily unavailable',
    };
  }
  if (status === 500 || /internal server error|server_error/.test(msg)) {
    return {
      transient: true, retryable: true, crossProviderRetryable: true,
      status: 500, retryDelayMs: 5_000,
      description: 'Provider internal server error',
    };
  }
  if (/econnreset|enotfound|econnrefused|network error|fetch failed/.test(msg)) {
    return {
      transient: true, retryable: true, crossProviderRetryable: true,
      retryDelayMs: 5_000,
      description: 'Network / DNS error',
    };
  }
  if (status === 404 || /model_not_found|model.*not found/.test(msg)) {
    // 404 on a model is permanent for THAT model but the runtime has model fallback chains
    return {
      transient: false, retryable: false, crossProviderRetryable: false,
      status: 404,
      description: 'Model not found (use model fallback chain)',
    };
  }

  // ── DEFAULT ───────────────────────────────────────────────────────────
  // Unknown 4xx → permanent; unknown 5xx → transient; no status → transient (network-ish)
  if (status && status >= 400 && status < 500) {
    return {
      transient: false, retryable: false, crossProviderRetryable: false,
      status, description: `Client error ${status}`,
    };
  }
  if (status && status >= 500) {
    return {
      transient: true, retryable: true, crossProviderRetryable: true,
      status, retryDelayMs: 10_000,
      description: `Server error ${status}`,
    };
  }
  return {
    transient: true, retryable: true, crossProviderRetryable: false,
    description: `Unknown error: ${msg.slice(0, 100) || code || 'no details'}`,
  };
}

/** Convenience predicate used by the auto-pause integration. */
export function shouldPauseOn(err: any): { reason: PauseReason; details: string } | null {
  const c = classifyError(err);
  if (!c.pauseReason) return null;
  return { reason: c.pauseReason, details: c.description };
}
