/**
 * subscription-cron.ts — daily check for expired paid subscriptions.
 *
 * Once a day at 03:00 UTC:
 *   1. Find subscriptions with expires_at < NOW() AND plan_id != 'free'.
 *   2. Downgrade them to 'free' (UPDATE subscriptions SET plan_id='free').
 *   3. Invalidate the in-memory cache via updateSubscriptionCache(userId, 'free').
 *   4. DM the user that their plan expired + show /subscribe link.
 *
 * Also DMs warning 3 days BEFORE expiration so user can renew.
 *
 * Idempotent: marks _last_subscription_check_date in agent_state so a restart
 * doesn't re-DM the same users.
 */

import { pool } from '../db';
import { notifyUserViaTelegram } from './notify-user';
import { updateSubscriptionCache } from '../payments';

const CHECK_HOUR_UTC = 3;
const WARN_DAYS_BEFORE = 3;

async function _alreadyRanToday(key: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=0 AND key=$1`,
      [key],
    );
    const last = r.rows[0]?.value;
    const lastDate = typeof last === 'string' ? last : last?.value;
    return lastDate === today;
  } catch { return false; }
}

async function _markRanToday(key: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value)
         VALUES (0, 0, $1, $2::jsonb)
         ON CONFLICT (agent_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(today)],
    );
  } catch (e: any) { console.warn('[SubCron] mark today failed:', e.message); }
}

async function _runExpiryCheck(): Promise<void> {
  const r = await pool.query(
    `SELECT user_id, plan_id, expires_at FROM builder_bot.subscriptions
       WHERE plan_id <> 'free' AND expires_at IS NOT NULL AND expires_at < NOW()`,
  );
  if (!r.rows.length) {
    console.log('[SubCron] no expired subscriptions');
    return;
  }
  console.log(`[SubCron] downgrading ${r.rows.length} expired subscriptions`);
  for (const row of r.rows) {
    const userId = Number(row.user_id);
    const oldPlan = row.plan_id;
    try {
      await pool.query(
        `UPDATE builder_bot.subscriptions SET plan_id='free', updated_at=NOW() WHERE user_id=$1::NUMERIC`,
        [String(userId)],
      );
      try { updateSubscriptionCache(userId, 'free', null); } catch {}
      await notifyUserViaTelegram(
        userId,
        `⏰ Подписка ${oldPlan} истекла\n\nТы переведён на Free. Чтобы вернуть лимиты и фичи — открой Студию → Подписка или используй /subscribe.`,
      ).catch(() => {});
    } catch (e: any) {
      console.error(`[SubCron] downgrade user=${userId} failed:`, e.message);
    }
  }
}

async function _runWarnings(): Promise<void> {
  // Warn users whose subscription expires within WARN_DAYS_BEFORE days
  const r = await pool.query(
    `SELECT user_id, plan_id, expires_at FROM builder_bot.subscriptions
       WHERE plan_id <> 'free' AND expires_at IS NOT NULL
         AND expires_at > NOW()
         AND expires_at < NOW() + INTERVAL '${WARN_DAYS_BEFORE} days'`,
  );
  for (const row of r.rows) {
    const userId = Number(row.user_id);
    const warnKey = `_sub_warned_${userId}_${new Date(row.expires_at).toISOString().slice(0, 10)}`;
    // Skip if we already warned this user for this expiry
    try {
      const check = await pool.query(
        `SELECT 1 FROM builder_bot.agent_state WHERE agent_id=0 AND key=$1`,
        [warnKey],
      );
      if (check.rows.length) continue;
    } catch {}
    const daysLeft = Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 86400_000));
    try {
      await notifyUserViaTelegram(
        userId,
        `🔔 Подписка ${row.plan_id} истекает через ${daysLeft} дн.\n\nОбнови в Студии → Подписка чтобы не потерять лимиты.`,
      ).catch(() => {});
      await pool.query(
        `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value)
           VALUES (0, $1, $2, $3::jsonb)
           ON CONFLICT (agent_id, key) DO NOTHING`,
        [userId, warnKey, JSON.stringify(new Date().toISOString())],
      ).catch(() => {});
    } catch (e: any) {
      console.warn(`[SubCron] warn user=${userId} failed:`, e.message);
    }
  }
}

export async function runSubscriptionCheck(): Promise<void> {
  try { await _runExpiryCheck(); } catch (e: any) { console.error('[SubCron] expiry check failed:', e.message); }
  try { await _runWarnings(); } catch (e: any) { console.error('[SubCron] warnings failed:', e.message); }
}

export function startSubscriptionCron(): void {
  const tick = async () => {
    const now = new Date();
    if (now.getUTCHours() !== CHECK_HOUR_UTC) return;
    if (await _alreadyRanToday('_last_sub_check_date')) return;
    console.log('[SubCron] running daily subscription check...');
    await runSubscriptionCheck();
    await _markRanToday('_last_sub_check_date');
  };
  // Run on boot if missed today
  setTimeout(() => {
    const now = new Date();
    if (now.getUTCHours() >= CHECK_HOUR_UTC) {
      tick().catch(e => console.error('[SubCron] boot tick failed:', e?.message));
    }
  }, 30_000);
  const iv = setInterval(() => {
    tick().catch(e => console.error('[SubCron] tick failed:', e?.message));
  }, 30 * 60_000); // every 30 min
  iv.unref();
}
