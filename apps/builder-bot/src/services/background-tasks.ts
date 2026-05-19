/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKGROUND TASKS DAEMON (session 08 pattern)
 *
 * In-memory queue of "fire at time T" jobs per agent. When the daemon ticks
 * (every 30s) it scans for due jobs and either:
 *   - Wakes the agent (if runtime supports it) by enqueueing a synthetic
 *     user message that says "process this background task"
 *   - OR runs the queued action directly via executeTool if the job has a
 *     concrete tool+args payload
 *
 * Persists to `agent_state` under `_bg_jobs` so jobs survive a bot restart.
 * Cleared on agent deletion.
 *
 * Design choice: in-memory map + periodic flush, NOT a separate worker
 * process. Acceptable because:
 *   • All jobs run inside the same Node process anyway
 *   • Pool size ≲ 100 active agents × maybe 5 jobs each = trivial
 *   • Simpler than coordinating across worker pool
 *
 * If we ever want cross-process scheduling, swap this for a Bull queue
 * backed by Redis.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { addMessageToAIAgent } from '../agents/ai-agent-runtime';

export interface BgJob {
  id: string;
  agentId: number;
  userId: number;
  description: string;
  runAt: Date;
  /** Optional: if set, the daemon invokes executeTool(tool, args) instead of
   * waking the agent. Used for "in 10 minutes, also call get_gift_floor_real". */
  tool?: string;
  toolArgs?: Record<string, any>;
  /** Result of last execution (if completed). */
  result?: { ok: boolean; ranAt: string; outcome?: string };
}

const _jobs = new Map<string, BgJob>();
let _daemonTimer: NodeJS.Timeout | null = null;
let _hydrated = false;

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Public: schedule a job. */
export function scheduleBackgroundTask(opts: {
  agentId: number;
  userId: number;
  description: string;
  runAt: Date;
  tool?: string;
  toolArgs?: Record<string, any>;
}): BgJob {
  const job: BgJob = {
    id: uid(),
    agentId: opts.agentId,
    userId: opts.userId,
    description: opts.description.slice(0, 500),
    runAt: opts.runAt,
    tool: opts.tool,
    toolArgs: opts.toolArgs,
  };
  _jobs.set(job.id, job);
  void persist(job);
  startDaemon();
  return job;
}

/** Public: list pending jobs for an agent. */
export function listBackgroundTasks(agentId: number): BgJob[] {
  const out: BgJob[] = [];
  for (const j of _jobs.values()) {
    if (j.agentId === agentId) out.push(j);
  }
  return out.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
}

/** Public: cancel by id. */
export function cancelBackgroundTask(id: string): boolean {
  const ok = _jobs.delete(id);
  if (ok) void unpersist(id);
  return ok;
}

/** Public: clear all jobs for an agent (e.g. on deletion). */
export function clearAgentBackgroundTasks(agentId: number): void {
  for (const [id, j] of _jobs.entries()) {
    if (j.agentId === agentId) {
      _jobs.delete(id);
      void unpersist(id);
    }
  }
}

// ─── Persistence to agent_state under `_bg_jobs` ────────────────────────────

async function persist(job: BgJob): Promise<void> {
  try {
    const { pool } = await import('../db');
    // Look up owner
    const owner = await pool.query(`SELECT user_id FROM builder_bot.agents WHERE id = $1`, [job.agentId]);
    if (!owner.rows[0]) return;
    const ownerId = owner.rows[0].user_id;
    // Append to JSON array in agent_state._bg_jobs
    const cur = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id = $1 AND key = '_bg_jobs'`,
      [job.agentId],
    );
    let arr: any[] = [];
    if (cur.rows[0]) {
      try {
        arr = typeof cur.rows[0].value === 'string' ? JSON.parse(cur.rows[0].value) : (cur.rows[0].value || []);
      } catch { arr = []; }
    }
    arr.push({ ...job, runAt: job.runAt.toISOString() });
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
       VALUES ($1, $2, '_bg_jobs', $3::jsonb, NOW())
       ON CONFLICT (agent_id, key) DO UPDATE SET value = $3::jsonb, updated_at = NOW()`,
      [job.agentId, ownerId, JSON.stringify(arr)],
    );
  } catch (e: any) {
    console.warn(`[BgTasks] persist failed: ${e?.message}`);
  }
}

async function unpersist(id: string): Promise<void> {
  try {
    const { pool } = await import('../db');
    const r = await pool.query(
      `SELECT agent_id, value FROM builder_bot.agent_state WHERE key = '_bg_jobs'`,
    );
    for (const row of r.rows) {
      let arr: any[] = [];
      try { arr = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value || []); } catch {}
      const filtered = arr.filter((j: any) => j.id !== id);
      if (filtered.length !== arr.length) {
        await pool.query(
          `UPDATE builder_bot.agent_state SET value = $1::jsonb, updated_at = NOW()
            WHERE agent_id = $2 AND key = '_bg_jobs'`,
          [JSON.stringify(filtered), row.agent_id],
        );
      }
    }
  } catch {}
}

/** Hydrate jobs from DB at boot. Called lazily on first schedule. */
async function hydrate(): Promise<void> {
  if (_hydrated) return;
  _hydrated = true;
  try {
    const { pool } = await import('../db');
    const r = await pool.query(`SELECT agent_id, value FROM builder_bot.agent_state WHERE key = '_bg_jobs'`);
    for (const row of r.rows) {
      let arr: any[] = [];
      try { arr = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value || []); } catch {}
      for (const j of arr) {
        _jobs.set(j.id, {
          ...j,
          agentId: row.agent_id,
          runAt: new Date(j.runAt),
        });
      }
    }
    if (_jobs.size > 0) {
      console.log(`[BgTasks] Hydrated ${_jobs.size} job(s) from DB`);
    }
  } catch (e: any) {
    console.warn(`[BgTasks] hydrate failed: ${e?.message}`);
  }
}

// ─── Daemon loop ────────────────────────────────────────────────────────────

function startDaemon(): void {
  if (_daemonTimer) return;
  void hydrate();
  _daemonTimer = setInterval(tick, 30_000);
  // Run first tick after 5s so newly scheduled <=5s jobs fire promptly
  setTimeout(tick, 5_000);
}

async function tick(): Promise<void> {
  const now = Date.now();
  const due: BgJob[] = [];
  for (const j of _jobs.values()) {
    if (j.runAt.getTime() <= now) due.push(j);
  }
  if (due.length === 0) return;

  console.log(`[BgTasks] ${due.length} due job(s)`);
  for (const job of due) {
    try {
      if (job.tool) {
        // Direct tool execution path
        await runDirect(job);
      } else {
        // Wake-agent path: inject a synthetic user message
        addMessageToAIAgent(
          job.agentId,
          `[Background task fired] ${job.description}`,
          { _bg_job_id: job.id, _bg_task: true },
        );
      }
      _jobs.delete(job.id);
      await unpersist(job.id);
    } catch (e: any) {
      console.warn(`[BgTasks] job ${job.id} failed: ${e?.message}`);
      // Soft-fail: leave the job for next tick if it was transient; otherwise drop
      job.result = { ok: false, ranAt: new Date().toISOString(), outcome: e?.message?.slice(0, 200) };
    }
  }
}

async function runDirect(job: BgJob): Promise<void> {
  const { executeTool } = await import('../agents/ai-agent-runtime');
  // Build minimal params shape — runtime tolerates this for tool dispatch
  const params: any = {
    agentId: job.agentId,
    userId: job.userId,
    config: {},
    context: { _bg_job_id: job.id },
  };
  const result = await executeTool(job.tool!, job.toolArgs || {}, params);
  job.result = { ok: !result?.error, ranAt: new Date().toISOString(), outcome: JSON.stringify(result).slice(0, 200) };
}

// Eagerly start the daemon on module load — first hydrate happens lazily.
startDaemon();
