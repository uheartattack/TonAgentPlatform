/**
 * token-tracker.ts — Per-agent token usage accumulator.
 * In-memory buffer with periodic flush to DB.
 * Adapted from teleton-agent token-usage.ts pattern.
 */

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TokenBucket {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;  // USD
  requestCount: number;
  lastUpdated: number;
}

export interface TokenUsageRecord {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
}

export interface TokenBudget {
  withinBudget: boolean;
  used: number;        // tokens today
  limit: number;       // daily limit (0 = unlimited)
  costToday: number;   // estimated USD
}

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY ACCUMULATOR
// ═══════════════════════════════════════════════════════════════════════════

const _buckets = new Map<number, TokenBucket>();
const _dailyBudgets = new Map<number, number>(); // agentId → daily token limit

/** Cost estimation per 1M tokens by provider */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini': { input: 0.075, output: 0.30 },
  'anthropic': { input: 0.80, output: 4.00 },
  'openai': { input: 0.15, output: 0.60 },
  'groq': { input: 0.05, output: 0.08 },
  'deepseek': { input: 0.14, output: 0.28 },
  'openrouter': { input: 0.10, output: 0.30 },
  'together': { input: 0.20, output: 0.20 },
  'default': { input: 0.15, output: 0.60 },
};

function estimateCost(input: number, output: number, provider?: string): number {
  const p = provider?.toLowerCase() || 'default';
  const rates = COST_PER_1M[p] || COST_PER_1M['default'];
  return (input * rates.input + output * rates.output) / 1_000_000;
}

/** Track token usage for an agent (call after each AI request) */
export function trackTokenUsage(
  agentId: number,
  usage: { inputTokens?: number; outputTokens?: number; provider?: string }
): void {
  const input = usage.inputTokens || 0;
  const output = usage.outputTokens || 0;
  const cost = estimateCost(input, output, usage.provider);

  let bucket = _buckets.get(agentId);
  if (!bucket) {
    bucket = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, requestCount: 0, lastUpdated: Date.now() };
    _buckets.set(agentId, bucket);
  }

  bucket.inputTokens += input;
  bucket.outputTokens += output;
  bucket.totalTokens += input + output;
  bucket.estimatedCost += cost;
  bucket.requestCount++;
  bucket.lastUpdated = Date.now();
}

/** Get current in-memory usage for an agent */
export function getCurrentUsage(agentId: number): TokenBucket {
  return _buckets.get(agentId) || {
    inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, requestCount: 0, lastUpdated: 0,
  };
}

/** Set daily token budget for an agent (0 = unlimited) */
export function setDailyBudget(agentId: number, limit: number): void {
  _dailyBudgets.set(agentId, limit);
}

/** Check if agent is within daily budget */
export async function checkBudget(agentId: number): Promise<TokenBudget> {
  const limit = _dailyBudgets.get(agentId) || 0;
  const todayUsage = await getDailyUsage(agentId);
  const inMemory = getCurrentUsage(agentId);

  const totalToday = (todayUsage?.totalTokens || 0) + inMemory.totalTokens;
  const costToday = (todayUsage?.estimatedCost || 0) + inMemory.estimatedCost;

  return {
    withinBudget: limit === 0 || totalToday < limit,
    used: totalToday,
    limit,
    costToday: Math.round(costToday * 10000) / 10000,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DB FLUSH (call periodically, e.g. every 5 min)
// ═══════════════════════════════════════════════════════════════════════════

let _tableReady = false;
async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.agent_token_usage (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      input_tokens BIGINT DEFAULT 0,
      output_tokens BIGINT DEFAULT 0,
      total_tokens BIGINT DEFAULT 0,
      estimated_cost NUMERIC(12,6) DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      UNIQUE(agent_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON builder_bot.agent_token_usage(agent_id, date DESC);
  `);
  _tableReady = true;
}

/** Flush all in-memory buckets to DB (call from setInterval) */
export async function flushTokenUsage(): Promise<number> {
  if (_buckets.size === 0) return 0;

  await ensureTable();
  const pool = await getPool();
  let flushed = 0;

  for (const [agentId, bucket] of _buckets) {
    if (bucket.totalTokens === 0) continue;

    try {
      await pool.query(
        `INSERT INTO builder_bot.agent_token_usage (agent_id, date, input_tokens, output_tokens, total_tokens, estimated_cost, request_count)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
         ON CONFLICT (agent_id, date)
         DO UPDATE SET
           input_tokens = builder_bot.agent_token_usage.input_tokens + $2,
           output_tokens = builder_bot.agent_token_usage.output_tokens + $3,
           total_tokens = builder_bot.agent_token_usage.total_tokens + $4,
           estimated_cost = builder_bot.agent_token_usage.estimated_cost + $5,
           request_count = builder_bot.agent_token_usage.request_count + $6`,
        [agentId, bucket.inputTokens, bucket.outputTokens, bucket.totalTokens, bucket.estimatedCost, bucket.requestCount]
      );
      // Reset only successfully flushed buckets (don't lose data on partial failure)
      bucket.inputTokens = 0;
      bucket.outputTokens = 0;
      bucket.totalTokens = 0;
      bucket.estimatedCost = 0;
      bucket.requestCount = 0;
      bucket.lastUpdated = Date.now();
      flushed++;
    } catch (err: any) {
      console.error(`[TokenTracker] Flush failed for agent #${agentId}:`, err.message);
      // Don't reset this bucket — data preserved for next flush attempt
    }
  }

  // Remove only zeroed-out buckets (successfully flushed)
  for (const [agentId, bucket] of _buckets) {
    if (bucket.totalTokens === 0 && bucket.requestCount === 0) _buckets.delete(agentId);
  }
  return flushed;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY (from DB)
// ═══════════════════════════════════════════════════════════════════════════

async function getDailyUsage(agentId: number): Promise<TokenUsageRecord | null> {
  await ensureTable();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT * FROM builder_bot.agent_token_usage WHERE agent_id = $1 AND date = CURRENT_DATE`,
    [agentId]
  );
  return res.rows[0] ? rowToRecord(res.rows[0]) : null;
}

/** Get usage history for agent (last N days) */
export async function getUsageHistory(agentId: number, days: number = 30): Promise<TokenUsageRecord[]> {
  await ensureTable();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT * FROM builder_bot.agent_token_usage
     WHERE agent_id = $1 AND date >= CURRENT_DATE - $2
     ORDER BY date DESC`,
    [agentId, days]
  );
  return res.rows.map(rowToRecord);
}

/** Get total usage across all time */
export async function getTotalUsage(agentId: number): Promise<{ totalTokens: number; totalCost: number; totalRequests: number }> {
  await ensureTable();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT COALESCE(SUM(total_tokens),0) as tokens, COALESCE(SUM(estimated_cost),0) as cost, COALESCE(SUM(request_count),0) as reqs
     FROM builder_bot.agent_token_usage WHERE agent_id = $1`,
    [agentId]
  );
  const r = res.rows[0];
  return {
    totalTokens: Number(r?.tokens) || 0,
    totalCost: Math.round((Number(r?.cost) || 0) * 10000) / 10000,
    totalRequests: Number(r?.reqs) || 0,
  };
}

/** Get usage for ALL agents (for overview dashboard) */
export async function getAllAgentsUsage(days: number = 7): Promise<Array<{ agentId: number; totalTokens: number; totalCost: number }>> {
  await ensureTable();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT agent_id, SUM(total_tokens) as tokens, SUM(estimated_cost) as cost
     FROM builder_bot.agent_token_usage
     WHERE date >= CURRENT_DATE - $1
     GROUP BY agent_id ORDER BY tokens DESC`,
    [days]
  );
  return res.rows.map((r: any) => ({
    agentId: r.agent_id,
    totalTokens: Number(r.tokens) || 0,
    totalCost: Math.round((Number(r.cost) || 0) * 10000) / 10000,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-FLUSH INTERVAL
// ═══════════════════════════════════════════════════════════════════════════

let _flushInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoFlush(intervalMs: number = 5 * 60 * 1000): void {
  if (_flushInterval) return;
  _flushInterval = setInterval(async () => {
    try {
      const n = await flushTokenUsage();
      if (n > 0) console.log(`[TokenTracker] Flushed ${n} agent buckets to DB`);
    } catch (err: any) {
      console.error('[TokenTracker] Auto-flush error:', err.message);
    }
  }, intervalMs);
  console.log(`[TokenTracker] Auto-flush started (every ${Math.round(intervalMs / 1000)}s)`);
}

export function stopAutoFlush(): void {
  if (_flushInterval) {
    clearInterval(_flushInterval);
    _flushInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function rowToRecord(r: any): TokenUsageRecord {
  return {
    date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
    totalTokens: Number(r.total_tokens) || 0,
    estimatedCost: Math.round((Number(r.estimated_cost) || 0) * 10000) / 10000,
    requestCount: Number(r.request_count) || 0,
  };
}
