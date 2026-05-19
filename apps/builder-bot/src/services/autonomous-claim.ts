/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTONOMOUS CLAIM (learn-claude-code s11 pattern)
 *
 * Periodically scans `builder_bot.agent_task_graph` for actionable tasks
 * (status='pending' AND blocked_by=[] AND owner is null OR matches an
 * agent that is currently online). When a task is up for grabs:
 *   1. Claim it: set status='in_progress' + owner=agent_id (atomic UPDATE
 *      with WHERE status='pending' to prevent double-claim).
 *   2. Wake the owning agent by injecting a synthetic user message:
 *      "Take task #<id>: <subject>".
 *   3. The agent then runs through the normal tick + completes the task
 *      via `task_update(id, status='completed', result=...)`.
 *
 * Opt-in per agent via `trigger_config.config.autonomous = true`. Default OFF
 * (most agents are reactive, not autonomous).
 *
 * Frequency: every 60 seconds. Cheap (1 SELECT per minute).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { addMessageToAIAgent } from '../agents/ai-agent-runtime';

const POLL_INTERVAL_MS = 60_000;
let _timer: NodeJS.Timeout | null = null;
const _activeClaimsByAgent = new Map<number, number>();   // agentId → tasksCurrentlyClaimed
const MAX_PARALLEL_PER_AGENT = 3;

export function startAutonomousClaim(): void {
  if (_timer) return;
  _timer = setInterval(tick, POLL_INTERVAL_MS);
  // First tick after 30s so we don't hit DB right at boot
  setTimeout(tick, 30_000);
  console.log('[AutonomousClaim] started, poll every 60s');
}

export function stopAutonomousClaim(): void {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function tick(): Promise<void> {
  try {
    const { pool } = await import('../db');

    // Find agents that opted in to autonomous mode and are active
    const agentsRes = await pool.query(
      `SELECT id, user_id, name, trigger_config
         FROM builder_bot.agents
        WHERE is_active = TRUE
          AND (trigger_config::jsonb->'config'->>'autonomous') = 'true'
        LIMIT 100`,
    );
    if (agentsRes.rows.length === 0) return;

    for (const agent of agentsRes.rows) {
      const inflight = _activeClaimsByAgent.get(agent.id) || 0;
      if (inflight >= MAX_PARALLEL_PER_AGENT) continue;
      const budget = MAX_PARALLEL_PER_AGENT - inflight;

      // Find actionable tasks (pending + no blockers) for this agent's task graph
      const tasksRes = await pool.query(
        `SELECT id, subject, priority
           FROM builder_bot.agent_task_graph
          WHERE agent_id = $1
            AND status = 'pending'
            AND cardinality(blocked_by) = 0
          ORDER BY priority DESC, created_at ASC
          LIMIT $2`,
        [agent.id, budget],
      );
      if (tasksRes.rows.length === 0) continue;

      for (const t of tasksRes.rows) {
        // Atomic claim: only succeeds if still pending (prevents double-claim
        // if multiple bot instances ever run concurrently)
        const claim = await pool.query(
          `UPDATE builder_bot.agent_task_graph
              SET status = 'in_progress', owner = $2, updated_at = NOW()
            WHERE id = $1 AND status = 'pending'
            RETURNING id`,
          [t.id, `agent#${agent.id}`],
        );
        if (claim.rowCount === 0) continue; // someone else got it

        _activeClaimsByAgent.set(agent.id, (_activeClaimsByAgent.get(agent.id) || 0) + 1);

        // Wake the agent with a synthetic message
        addMessageToAIAgent(
          agent.id,
          `[Autonomous task #${t.id} claimed] ${t.subject}\n\nWork on this. When done, call task_update(${t.id}, status='completed', result='...').`,
          { _autonomous_task_id: t.id, _autonomous_priority: t.priority },
        );
        console.log(`[AutonomousClaim] Agent #${agent.id} claimed task #${t.id} "${t.subject.slice(0, 60)}"`);
      }
    }
  } catch (e: any) {
    console.warn(`[AutonomousClaim] tick failed: ${e?.message}`);
  }
}

/** Called by runtime when a task moves out of in_progress (completed/failed/cancelled). */
export function releaseClaim(agentId: number): void {
  const cur = _activeClaimsByAgent.get(agentId) || 0;
  if (cur > 0) _activeClaimsByAgent.set(agentId, cur - 1);
}

// Eagerly start. The poll interval is generous; cost is negligible.
startAutonomousClaim();
