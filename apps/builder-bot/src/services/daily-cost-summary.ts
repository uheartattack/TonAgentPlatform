/**
 * daily-cost-summary.ts — once a day, DM the platform owner a TON-cost &
 * AI-quota digest so they actually see what the platform is burning.
 *
 * Triggered from index.ts boot. Schedules a single setInterval that ticks
 * once an hour and fires the digest at 09:00 UTC. Idempotent via an
 * `_last_cost_digest_date` row in agent_state(0, ...).
 */

import { pool } from '../db';
import { notifyUserViaTelegram } from './notify-user';

const DIGEST_HOUR_UTC = 9; // 09:00 UTC ≈ 12:00 MSK

async function _alreadySentToday(): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=0 AND key='_last_cost_digest_date'`
    );
    const last = r.rows[0]?.value;
    const lastDate = typeof last === 'string' ? last : last?.value;
    return lastDate === today;
  } catch { return false; }
}

async function _markSentToday(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value)
       VALUES (0, 0, '_last_cost_digest_date', $1::jsonb)
       ON CONFLICT (agent_id, key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(today)]
    );
  } catch (e: any) { console.warn('[CostDigest] mark today failed:', e.message); }
}

async function _buildSummary(): Promise<string | null> {
  try {
    // Yesterday AI spend across all agents
    const yest = await pool.query(`
      SELECT
        COALESCE(SUM(total_tokens), 0) AS tokens,
        COALESCE(SUM(estimated_cost), 0)::numeric(12,4) AS cost,
        COALESCE(SUM(request_count), 0) AS reqs,
        COUNT(DISTINCT agent_id) AS agents
      FROM builder_bot.agent_token_usage
      WHERE date = CURRENT_DATE - 1
    `);
    // Top-5 agents by yesterday's spend
    const top = await pool.query(`
      SELECT a.id, a.name, u.total_tokens, u.estimated_cost::numeric(12,4) AS cost
      FROM builder_bot.agent_token_usage u
      JOIN builder_bot.agents a ON a.id = u.agent_id
      WHERE u.date = CURRENT_DATE - 1
      ORDER BY u.estimated_cost DESC NULLS LAST
      LIMIT 5
    `);
    // Active agent counts
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM builder_bot.agents WHERE is_active = true) AS active,
        (SELECT COUNT(*)::int FROM builder_bot.agents) AS total,
        (SELECT COUNT(*)::int FROM builder_bot.web_sessions WHERE expires_at > NOW()) AS sessions
    `);
    const y = yest.rows[0] || {};
    const c = counts.rows[0] || {};
    if (Number(y.reqs) === 0 && Number(c.active) === 0) return null; // nothing to report

    const lines: string[] = [];
    lines.push(`📊 <b>Daily digest — ${new Date().toISOString().slice(0, 10)}</b>`);
    lines.push('');
    lines.push(`<b>Yesterday's AI spend</b>`);
    lines.push(`• Tokens: <code>${Number(y.tokens).toLocaleString()}</code>`);
    lines.push(`• Est. cost: <b>$${Number(y.cost || 0).toFixed(2)}</b>`);
    lines.push(`• Requests: <code>${Number(y.reqs).toLocaleString()}</code> from ${y.agents} agents`);
    lines.push('');
    if (top.rows.length > 0) {
      lines.push(`<b>Top spenders</b>`);
      for (const r of top.rows) {
        lines.push(`• #${r.id} ${(r.name || '').slice(0, 24)} — $${Number(r.cost || 0).toFixed(3)} (${Number(r.total_tokens).toLocaleString()} tok)`);
      }
      lines.push('');
    }
    lines.push(`<b>Platform</b>`);
    lines.push(`• Active agents: ${c.active}/${c.total}`);
    lines.push(`• Live sessions: ${c.sessions}`);
    return lines.join('\n');
  } catch (e: any) {
    console.warn('[CostDigest] build failed:', e.message);
    return null;
  }
}

let _started = false;
export function startDailyCostSummary(): void {
  if (_started) return;
  _started = true;

  const ownerEnv = process.env.OWNER_ID;
  if (!ownerEnv || ownerEnv === '0') {
    console.warn('[CostDigest] OWNER_ID not set — daily summary disabled');
    return;
  }
  const ownerId = Number(ownerEnv);
  if (!Number.isFinite(ownerId)) {
    console.warn('[CostDigest] OWNER_ID is not numeric — disabled');
    return;
  }

  const tick = async () => {
    try {
      const hourUtc = new Date().getUTCHours();
      if (hourUtc !== DIGEST_HOUR_UTC) return;
      if (await _alreadySentToday()) return;
      const text = await _buildSummary();
      if (!text) { await _markSentToday(); return; }
      const sent = await notifyUserViaTelegram(ownerId, text, { parseMode: 'HTML', silent: true });
      if (sent) await _markSentToday();
    } catch (e: any) {
      console.warn('[CostDigest] tick error:', e.message);
    }
  };

  // Tick once per hour; only fires at DIGEST_HOUR_UTC, idempotent within the day.
  const t = setInterval(tick, 60 * 60 * 1000);
  (t as NodeJS.Timeout).unref?.();
  // Run once 1 minute after boot in case we're already past 09:00 UTC today
  const boot = setTimeout(tick, 60 * 1000);
  (boot as NodeJS.Timeout).unref?.();

  console.log(`[CostDigest] daily summary armed (owner=${ownerId}, hour=${DIGEST_HOUR_UTC} UTC)`);
}
