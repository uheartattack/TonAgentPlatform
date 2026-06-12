/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT TRACES — lightweight tracing for AI agent execution
 *
 * Records spans for each step of an agent run (tool calls, LLM requests,
 * memory access) with start/end timestamps, duration, and result metadata.
 *
 * Goal: user opens Studio → Agent → Traces tab → sees a timeline of the
 * last N runs. For each run: ordered bars showing what happened when.
 *
 *   Run  [────────────────────────────────────────] 3.2s total
 *        get_balance   [══]              120ms
 *        ai_call       [═════════════════]  1.8s  Gemini, 1248 tokens
 *        send_ton      [═══]              380ms  tx: abc...
 *        ai_call       [════]             920ms  Gemini, 340 tokens
 *
 * Why not OpenTelemetry: adds 400KB deps, requires collector infra. For
 * our scale (single-process) a simple DB-backed tracer is enough.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

let _pool: Pool | null = null;
function getPool(): Pool {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _pool = require('../db').pool as Pool;
  return _pool;
}

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type SpanType = 'tool' | 'ai' | 'memory' | 'plugin' | 'other';

export interface SpanMeta {
  args?: any;          // tool args / AI messages snippet
  result?: any;        // tool result / AI response snippet
  model?: string;      // AI model name
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  ok?: boolean;
  error?: string;
}

export interface Span {
  spanId: string;
  runId: string;
  agentId: number;
  type: SpanType;
  name: string;              // 'get_ton_balance' / 'gemini-2.5-flash' / 'short_term_log'
  startMs: number;           // unix millis
  endMs?: number;
  durationMs?: number;
  meta: SpanMeta;
}

// ─────────────────────────────────────────────────────────────────────────
// Table creation
// ─────────────────────────────────────────────────────────────────────────

let _tableReady = false;

async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  const pool = getPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_traces (
        span_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        agent_id BIGINT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        start_ms BIGINT NOT NULL,
        end_ms BIGINT,
        duration_ms INT,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_traces_agent_run ON builder_bot.agent_traces(agent_id, run_id, start_ms);
      CREATE INDEX IF NOT EXISTS idx_traces_created ON builder_bot.agent_traces(created_at DESC);
    `);
    _tableReady = true;

    // Auto-prune: keep only last 14 days of traces
    pool.query(
      `DELETE FROM builder_bot.agent_traces WHERE created_at < NOW() - INTERVAL '14 days'`,
    ).catch(() => {});
  } catch (e: any) {
    console.warn('[AgentTraces] ensureTable failed:', e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Run + span API
// ─────────────────────────────────────────────────────────────────────────

const _activeSpans = new Map<string, Span>();

/** Start a new run — returns runId that groups all spans for a single agent execution. */
export function startRun(agentId: number): string {
  const runId = `run_${agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return runId;
}

/** Start a span. Returns spanId. Must be paired with endSpan(). */
export function startSpan(
  agentId: number,
  runId: string,
  type: SpanType,
  name: string,
  meta: SpanMeta = {},
): string {
  const spanId = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const span: Span = {
    spanId,
    runId,
    agentId,
    type,
    name: String(name).slice(0, 100),
    startMs: Date.now(),
    meta,
  };
  _activeSpans.set(spanId, span);
  return spanId;
}

/** End a span. Flushes to DB async. */
export function endSpan(spanId: string, metaPatch: SpanMeta = {}): void {
  const span = _activeSpans.get(spanId);
  if (!span) return;
  span.endMs = Date.now();
  span.durationMs = span.endMs - span.startMs;
  span.meta = { ...span.meta, ...metaPatch };
  _activeSpans.delete(spanId);

  // Truncate large meta fields before persisting
  const safeMeta = sanitizeMeta(span.meta);

  // Fire-and-forget persist — we don't want to block the agent loop
  ensureTable()
    .then(() => {
      const pool = getPool();
      return pool.query(
        `INSERT INTO builder_bot.agent_traces
         (span_id, run_id, agent_id, type, name, start_ms, end_ms, duration_ms, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (span_id) DO NOTHING`,
        [
          span.spanId,
          span.runId,
          span.agentId,
          span.type,
          span.name,
          span.startMs,
          span.endMs,
          span.durationMs,
          JSON.stringify(safeMeta),
        ],
      );
    })
    .catch(e => console.warn('[AgentTraces] endSpan persist failed:', e?.message));
}

/** Convenience wrapper — runs fn inside a span. */
export async function withSpan<T>(
  agentId: number,
  runId: string,
  type: SpanType,
  name: string,
  fn: () => Promise<T>,
  argsForMeta?: any,
): Promise<T> {
  const spanId = startSpan(agentId, runId, type, name, argsForMeta ? { args: argsForMeta } : {});
  try {
    const result = await fn();
    endSpan(spanId, { ok: true, result });
    return result;
  } catch (e: any) {
    endSpan(spanId, { ok: false, error: e?.message || String(e) });
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sanitization — keep meta small (max 2KB per field)
// ─────────────────────────────────────────────────────────────────────────

function sanitizeMeta(meta: SpanMeta): SpanMeta {
  const out: SpanMeta = { ...meta };
  const truncateJson = (v: any, max = 2048) => {
    if (v == null) return v;
    try {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      if (s.length <= max) return typeof v === 'string' ? s : v;
      return s.slice(0, max) + '…[truncated]';
    } catch { return '[unstringifiable]'; }
  };
  if (out.args !== undefined) out.args = truncateJson(out.args, 512);
  if (out.result !== undefined) out.result = truncateJson(out.result, 1024);
  if (out.error) out.error = String(out.error).slice(0, 500);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Read API — powers the Studio Traces tab
// ─────────────────────────────────────────────────────────────────────────

export interface RunSummary {
  runId: string;
  agentId: number;
  startedAt: string;
  durationMs: number;
  spanCount: number;
  toolCount: number;
  aiCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  errors: number;
  firstSpanName?: string;
}

/** List recent runs for an agent with summary stats. */
export async function listRecentRuns(agentId: number, limit = 20): Promise<RunSummary[]> {
  await ensureTable();
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT
         run_id,
         MIN(start_ms) AS first_start,
         MAX(COALESCE(end_ms, start_ms)) AS last_end,
         COUNT(*) AS span_count,
         COUNT(*) FILTER (WHERE type = 'tool') AS tool_count,
         COUNT(*) FILTER (WHERE type = 'ai') AS ai_calls,
         COALESCE(SUM((meta->>'tokensIn')::INT), 0) AS tokens_in,
         COALESCE(SUM((meta->>'tokensOut')::INT), 0) AS tokens_out,
         COUNT(*) FILTER (WHERE (meta->>'ok')::BOOLEAN = false) AS errors,
         (SELECT name FROM builder_bot.agent_traces t2
          WHERE t2.run_id = t.run_id ORDER BY start_ms ASC LIMIT 1) AS first_span
       FROM builder_bot.agent_traces t
       WHERE agent_id = $1
       GROUP BY run_id
       ORDER BY first_start DESC
       LIMIT $2`,
      [agentId, limit],
    );
    return res.rows.map(r => ({
      runId: r.run_id,
      agentId,
      startedAt: new Date(Number(r.first_start)).toISOString(),
      durationMs: Number(r.last_end) - Number(r.first_start),
      spanCount: Number(r.span_count),
      toolCount: Number(r.tool_count),
      aiCalls: Number(r.ai_calls),
      totalTokensIn: Number(r.tokens_in),
      totalTokensOut: Number(r.tokens_out),
      errors: Number(r.errors),
      firstSpanName: r.first_span,
    }));
  } catch (e: any) {
    console.warn('[AgentTraces] listRecentRuns failed:', e?.message);
    return [];
  }
}

/** Get all spans for a specific run (ordered by start_ms). */
export async function getRunSpans(runId: string): Promise<Span[]> {
  await ensureTable();
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT span_id, run_id, agent_id, type, name, start_ms, end_ms, duration_ms, meta
       FROM builder_bot.agent_traces
       WHERE run_id = $1
       ORDER BY start_ms ASC`,
      [runId],
    );
    return res.rows.map(r => ({
      spanId: r.span_id,
      runId: r.run_id,
      agentId: Number(r.agent_id),
      type: r.type,
      name: r.name,
      startMs: Number(r.start_ms),
      endMs: r.end_ms ? Number(r.end_ms) : undefined,
      durationMs: r.duration_ms ? Number(r.duration_ms) : undefined,
      meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta || {},
    }));
  } catch (e: any) {
    console.warn('[AgentTraces] getRunSpans failed:', e?.message);
    return [];
  }
}
