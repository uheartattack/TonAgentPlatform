/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CRON TICKER
 *
 * Background ticker that fires agent ticks on a cron schedule. Stored in
 * builder_bot.agent_cron_subscriptions so schedules survive restart.
 *
 * Runs once a minute. For each row where next_fire_at <= now AND is_active,
 * emits a 'schedule' event via the existing event-bus (agent's tick is
 * triggered with the event context) and recomputes next_fire_at.
 *
 * Cron parser: 5-field syntax (minute hour day-of-month month day-of-week)
 * with `*`, comma lists, ranges (`a-b`), and steps (`*\/n`). Day-of-week
 * uses 0-6 (Sunday=0), case-insensitive `SUN`/`MON`/…/`SAT` also accepted.
 * NO macros (@daily, @hourly) — keep parser tight.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

let _pool: Pool | null = null;
function getPool(): Pool {
  if (_pool) return _pool;
  _pool = require('../db').pool as Pool;
  return _pool;
}

const DOW_NAMES: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

interface Field { values: Set<number>; min: number; max: number; }

function parseField(spec: string, min: number, max: number, isDow = false): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    let p = part.trim();
    if (!p) continue;
    let step = 1;
    if (p.includes('/')) {
      const [base, s] = p.split('/');
      step = parseInt(s, 10);
      if (isNaN(step) || step <= 0) throw new Error(`Invalid step in "${part}"`);
      p = base;
    }
    let lo = min, hi = max;
    if (p === '*') {
      // keep full range
    } else if (p.includes('-')) {
      const [a, b] = p.split('-');
      lo = _val(a, isDow);
      hi = _val(b, isDow);
    } else {
      lo = hi = _val(p, isDow);
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`Field out of range: "${part}"`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

function _val(token: string, isDow: boolean): number {
  const up = token.toUpperCase();
  if (isDow && DOW_NAMES[up] !== undefined) return DOW_NAMES[up];
  const n = parseInt(token, 10);
  if (isNaN(n)) throw new Error(`Bad number "${token}"`);
  return n;
}

interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  doms: Set<number>;
  months: Set<number>;
  dows: Set<number>;
  domStar: boolean; // "*" in DOM
  dowStar: boolean; // "*" in DOW
}

function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('Cron must have 5 fields');
  return {
    minutes: parseField(parts[0], 0, 59),
    hours:   parseField(parts[1], 0, 23),
    doms:    parseField(parts[2], 1, 31),
    months:  parseField(parts[3], 1, 12),
    dows:    parseField(parts[4], 0, 6, true),
    domStar: parts[2] === '*',
    dowStar: parts[4] === '*',
  };
}

/** Compute the next datetime after `from` (UTC) when this cron expression matches.
 *  Walks minute-by-minute up to 4 years out to handle edge cases like "Feb 29".
 *  Returns the date in UTC. Caller stores as TIMESTAMP. */
export function computeNextFireUTC(expr: string, from: Date): Date {
  const cron = parseCron(expr);
  // Start at the next minute boundary
  const next = new Date(from.getTime() + 60_000);
  next.setUTCSeconds(0, 0);
  const maxIterations = 60 * 24 * 366 * 4; // 4 years
  for (let i = 0; i < maxIterations; i++) {
    const min = next.getUTCMinutes();
    const hr = next.getUTCHours();
    const dom = next.getUTCDate();
    const mon = next.getUTCMonth() + 1;
    const dow = next.getUTCDay();
    if (cron.months.has(mon) && cron.hours.has(hr) && cron.minutes.has(min)) {
      // DOM and DOW: if BOTH are restricted (no star), match if EITHER matches (cron tradition).
      // If one is restricted and the other is *, only the restricted one matters.
      const domMatch = cron.doms.has(dom);
      const dowMatch = cron.dows.has(dow);
      let dayOk: boolean;
      if (cron.domStar && cron.dowStar) dayOk = true;
      else if (cron.domStar) dayOk = dowMatch;
      else if (cron.dowStar) dayOk = domMatch;
      else dayOk = domMatch || dowMatch;
      if (dayOk) return next;
    }
    next.setTime(next.getTime() + 60_000);
  }
  throw new Error('No fire time found within 4 years (impossible cron expression?)');
}

let _started = false;

/** Start the once-a-minute polling loop. Idempotent. */
export function startCronTicker(): void {
  if (_started) return;
  _started = true;
  console.log('[CronTicker] started — polling every 60s');
  // Run immediately on next event-loop turn, then every minute
  setTimeout(_tick, 1000);
  setInterval(_tick, 60_000);
}

async function _tick(): Promise<void> {
  try {
    const pool = getPool();
    const now = new Date();
    const due = await pool.query<{
      id: number; agent_id: number; user_id: number; cron_expr: string; reason: string;
    }>(
      `SELECT id, agent_id, user_id, cron_expr, reason
         FROM builder_bot.agent_cron_subscriptions
        WHERE is_active = true AND next_fire_at <= $1
        ORDER BY next_fire_at ASC
        LIMIT 50`,
      [now],
    );
    if (due.rows.length === 0) return;

    const { getEventBus } = await import('../agents/event-bus');
    const bus = getEventBus();
    for (const row of due.rows) {
      try {
        // Fire the event — the EventBus will trigger the agent's tick if subscribed
        bus.emit({
          type: 'schedule',
          source: `cron:${row.id}`,
          data: { reason: row.reason, cron_expr: row.cron_expr, subscription_id: row.id },
          timestamp: Date.now(),
        });
        // For agents without explicit subscribe() calls, also poke them directly via addMessageToAIAgent
        try {
          const { addMessageToAIAgent } = await import('../agents/ai-agent-runtime');
          addMessageToAIAgent(row.agent_id, `[SCHEDULED] ${row.reason} (cron ${row.cron_expr})`);
        } catch {}
        // Recompute next fire
        const nextFire = computeNextFireUTC(row.cron_expr, now);
        await pool.query(
          `UPDATE builder_bot.agent_cron_subscriptions
              SET last_fired_at = $1, next_fire_at = $2
            WHERE id = $3`,
          [now, nextFire, row.id],
        );
      } catch (e: any) {
        console.warn(`[CronTicker] firing subscription #${row.id} failed:`, e?.message);
        // Disable misbehaving rows so we don't loop on a bad cron forever
        if (e?.message?.includes('cron') || e?.message?.includes('field')) {
          await pool.query(`UPDATE builder_bot.agent_cron_subscriptions SET is_active = false WHERE id = $1`, [row.id]).catch(() => {});
        }
      }
    }
  } catch (e: any) {
    console.warn(`[CronTicker] tick failed (non-fatal):`, e?.message);
  }
}
