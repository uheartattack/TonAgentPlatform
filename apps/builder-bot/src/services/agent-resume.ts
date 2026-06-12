/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT AUTO-RESUME
 *
 * When the user updates their API key (or per-agent key) in Studio, any agents
 * previously auto-paused for credential / quota reasons should come back to life
 * automatically. Otherwise the user has to manually click Start on every paused
 * agent — bad UX.
 *
 * Triggered from:
 *   • POST /api/settings (user_variables changed)
 *   • PUT  /api/agents/:id/provider (per-agent config changed)
 *
 * For each candidate agent we:
 *   1. Wipe `_err_counter_*` rows (clean slate for next failure threshold)
 *   2. Delete `_cb_state` (circuit breaker stale state)
 *   3. Delete `_paused_reason` marker
 *   4. SET is_active = true
 *   5. Call runner.runAgent() to actually re-activate the runtime handle
 *   6. Send Telegram DM to owner confirming
 *
 * Idempotent: if the agent wasn't paused for a resumable reason, nothing happens.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';
import type { PauseReason } from './agent-auto-pause';

// Reasons we can auto-resume from (where a fresh key likely fixes the problem)
const RESUMABLE_REASONS: PauseReason[] = ['NO_API_KEY', 'INVALID_API_KEY', 'INSUFFICIENT_CREDITS'];

let _pool: Pool | null = null;
function getPool(): Pool {
  if (_pool) return _pool;
  _pool = require('../db').pool as Pool;
  return _pool;
}

interface ResumeResult {
  resumedAgentIds: number[];
  errors: Array<{ agentId: number; error: string }>;
}

/** Resume all paused agents of `userId` whose pause reason is in RESUMABLE_REASONS.
 *  Optionally constrain to a single agentId (for per-agent provider updates). */
export async function resumeAfterKeyUpdate(
  userId: number,
  options?: { agentId?: number; reasons?: PauseReason[] },
): Promise<ResumeResult> {
  const pool = getPool();
  const result: ResumeResult = { resumedAgentIds: [], errors: [] };
  const allowedReasons = options?.reasons || RESUMABLE_REASONS;

  try {
    // 1. Find candidate paused agents
    const params: any[] = [userId];
    let agentFilter = '';
    if (options?.agentId) {
      params.push(options.agentId);
      agentFilter = ` AND a.id = $${params.length}`;
    }
    const candidates = await pool.query(
      `SELECT a.id, a.name, s.value AS pause_value
         FROM builder_bot.agents a
         JOIN builder_bot.agent_state s ON s.agent_id = a.id AND s.key = '_paused_reason'
        WHERE a.user_id = $1
          AND a.is_active = false${agentFilter}`,
      params,
    );

    for (const row of candidates.rows) {
      const agentId = Number(row.id);
      let reason: PauseReason | null = null;
      try {
        const v = typeof row.pause_value === 'string' ? JSON.parse(row.pause_value) : row.pause_value;
        reason = v?.reason || null;
      } catch {}
      if (!reason || !allowedReasons.includes(reason)) continue;

      try {
        // 2. Wipe error counters, CB state, paused marker
        await pool.query(
          `DELETE FROM builder_bot.agent_state
            WHERE agent_id = $1
              AND (key LIKE '_err_counter_%' OR key IN ('_cb_state', '_paused_reason'))`,
          [agentId],
        );
        // 3. Reactivate in DB
        await pool.query(`UPDATE builder_bot.agents SET is_active = true WHERE id = $1`, [agentId]);
        // 4. Actually start the runtime handle — without this is_active=true is just a DB flag
        try {
          const { getRunnerAgent } = await import('../agents/sub-agents/runner');
          await getRunnerAgent().runAgent({ agentId, userId });
        } catch (re: any) {
          // Runner may be unavailable during very early startup — DB flag is set, will pick up on next restore
          console.warn(`[AutoResume] runAgent failed for #${agentId} (non-fatal):`, re?.message);
        }
        result.resumedAgentIds.push(agentId);
        console.log(`[AutoResume] Agent #${agentId} "${row.name}" resumed (was paused: ${reason})`);

        // 5. Notify owner via bot DM
        try {
          const botToken = process.env.BOT_TOKEN;
          if (botToken) {
            const text = `▶️ <b>Agent #${agentId} «${escHtml(row.name)}» resumed</b>\n\nProvider settings updated, agent is back online.`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: userId, text, parse_mode: 'HTML' }),
            }).catch(() => {});
          }
        } catch {}

        // 6. Log the resume event so it shows up in Studio agent log
        await pool.query(
          `INSERT INTO builder_bot.agent_logs (agent_id, level, message, created_at)
           VALUES ($1, 'info', $2, NOW())`,
          [agentId, `[AutoResume] Resumed after key/provider update (was: ${reason})`],
        ).catch(() => {});
      } catch (e: any) {
        result.errors.push({ agentId, error: e?.message || String(e) });
        console.warn(`[AutoResume] failed for #${agentId}:`, e?.message);
      }
    }
  } catch (e: any) {
    console.warn(`[AutoResume] resumeAfterKeyUpdate failed for user ${userId}:`, e?.message);
  }
  return result;
}

function escHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
