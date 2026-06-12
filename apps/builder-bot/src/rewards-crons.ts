/**
 * Scheduled jobs for tester rewards:
 *  - Hall of Week: Friday 20:00 MSK auto-post to the beta group
 *  - Monthly Snapshot: 1st of each month at 00:00 MSK
 *  - Inactive decay: daily — set multiplier_override=1 for users silent 6+ months
 */

import { Pool } from 'pg';
import { Telegraf } from 'telegraf';
import { computeRewardTable, FIRST_SNAPSHOT_DATE, INACTIVE_MONTHS_DECAY } from './rewards';

const CE_EMOJI = {
  trophy:  '<tg-emoji emoji-id="5409008750893734809">🏆</tg-emoji>',
  medal:   '<tg-emoji emoji-id="5334644364280866007">🥇</tg-emoji>',
  fire:    '<tg-emoji emoji-id="5420315771991497307">🔥</tg-emoji>',
  rocket:  '<tg-emoji emoji-id="5445284980978621387">🚀</tg-emoji>',
  bulb:    '<tg-emoji emoji-id="5472146462362048818">💡</tg-emoji>',
  bug:     '<tg-emoji emoji-id="5397991236361527676">🐛</tg-emoji>',
  coin:    '<tg-emoji emoji-id="5375296873982604963">💰</tg-emoji>',
  star:    '<tg-emoji emoji-id="5469741319330996757">⭐</tg-emoji>',
  crown:   '<tg-emoji emoji-id="5467406098367521267">👑</tg-emoji>',
  camera:  '<tg-emoji emoji-id="5280735858926822987">📸</tg-emoji>',
};

function isoWeekKey(d = new Date()): string {
  // ISO 8601 week number (yyyy-Www)
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function mskNow(): Date {
  // Convert UTC → Moscow time (UTC+3, no DST)
  const now = new Date();
  return new Date(now.getTime() + 3 * 60 * 60 * 1000);
}

/** Generate Hall of Week text. */
async function buildHallOfWeek(pool: Pool): Promise<{ text: string; topUsers: any[] } | null> {
  // Last 7 days XP gain — use agent_logs / beta_achievements as proxy.
  // Simpler: compare current xp to snapshot from a week ago.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // One CTE pass over snapshots, then a single LEFT JOIN — replaces the per-row
  // correlated subquery that did N+1 SELECTs (one per tester).
  const top = await pool.query(`
    WITH last_snap AS (
      SELECT DISTINCT ON (user_id) user_id, xp
      FROM builder_bot.beta_snapshots
      WHERE created_at <= $1
      ORDER BY user_id, created_at DESC
    )
    SELECT bt.user_id, bt.username, COALESCE(bt.xp, 0) AS xp,
           COALESCE(bt.xp, 0) - COALESCE(s.xp, 0) AS xp_delta
    FROM builder_bot.beta_testers bt
    LEFT JOIN last_snap s ON s.user_id = bt.user_id
    WHERE bt.status = 'active' OR bt.status IS NULL
    ORDER BY xp_delta DESC
    LIMIT 5
  `, [weekAgo]);
  const rows = top.rows.filter((r: any) => Number(r.xp_delta) > 0);
  if (rows.length === 0) return null;

  // Tests / bugs / features counts from last 7d (from beta_achievements or agent_logs)
  let totalBugs = 0, totalFeatures = 0;
  try {
    const fbRes = await pool.query(`
      SELECT type, COUNT(*)::int AS n FROM builder_bot.feedback
      WHERE created_at > $1 GROUP BY type
    `, [weekAgo]).catch(() => null);
    if (fbRes) {
      for (const r of fbRes.rows) {
        if (r.type === 'bug') totalBugs = Number(r.n);
        if (r.type === 'feature') totalFeatures = Number(r.n);
      }
    }
  } catch {}

  // Stats: total active tests this week
  const statsR = await pool.query(`
    SELECT (SELECT COUNT(*) FROM builder_bot.beta_testers) AS total,
           (SELECT COUNT(*) FROM builder_bot.beta_testers WHERE last_active_at > $1) AS active_week,
           (SELECT COALESCE(SUM(xp), 0) FROM builder_bot.beta_testers) AS total_xp,
           (SELECT COUNT(*) FROM builder_bot.agents WHERE is_active = true) AS active_agents
  `, [weekAgo]);
  const stats = statsR.rows[0] || {};

  const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  let text = `${CE_EMOJI.trophy} <b>HALL OF WEEK — ${dateStr}</b>\n\n`;

  const placeEmojis = [CE_EMOJI.medal, '🥈', '🥉'];
  rows.slice(0, 3).forEach((r: any, i: number) => {
    const name = r.username ? `@${r.username}` : `#${r.user_id}`;
    text += `${placeEmojis[i] || '·'} ${name} — <b>+${r.xp_delta} XP</b>\n`;
  });

  text += `\n${CE_EMOJI.fire} <b>За неделю:</b>\n`;
  if (totalBugs > 0) text += `${CE_EMOJI.bug} Багов найдено: ${totalBugs}\n`;
  if (totalFeatures > 0) text += `${CE_EMOJI.bulb} Фич предложено: ${totalFeatures}\n`;
  text += `${CE_EMOJI.rocket} Активных агентов: ${stats.active_agents || 0}\n`;
  text += `${CE_EMOJI.coin} Тестеров активных: ${stats.active_week || 0}/${stats.total || 0}\n`;
  text += `${CE_EMOJI.star} Total XP в snapshot: ${stats.total_xp || 0}\n`;

  // Days until next snapshot (1st of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysUntilSnapshot = Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000);
  text += `\n${CE_EMOJI.camera} До snapshot: <b>${daysUntilSnapshot} дней</b>`;

  return { text, topUsers: rows.slice(0, 3) };
}

/** Start the Friday 20:00 MSK auto-post.
 *  Runs every 10 minutes, posts once per ISO week. */
export function startHallOfWeekCron(bot: Telegraf, pool: Pool, groupId: number, topicId?: number): void {
  const tick = async () => {
    try {
      const now = mskNow();
      // Friday = 5, hour 20-22 (allow delayed firing if server was down)
      if (now.getUTCDay() !== 5) return;
      if (now.getUTCHours() < 20 || now.getUTCHours() > 22) return;

      const wk = isoWeekKey();
      const seen = await pool.query('SELECT iso_week FROM builder_bot.beta_weekly_digest WHERE iso_week = $1', [wk]);
      if (seen.rows.length > 0) return; // already posted this week

      const payload = await buildHallOfWeek(pool);
      if (!payload) return;

      const extra: any = { parse_mode: 'HTML', disable_web_page_preview: true };
      if (topicId) extra.message_thread_id = topicId;
      await bot.telegram.sendMessage(groupId, payload.text, extra).catch((e: any) => console.warn('[HallOfWeek] send:', e.message));

      await pool.query(
        'INSERT INTO builder_bot.beta_weekly_digest (iso_week, top_users) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [wk, JSON.stringify(payload.topUsers)]
      );
      console.log(`[HallOfWeek] Posted for ${wk}`);
    } catch (e: any) { console.warn('[HallOfWeek] tick error:', e.message); }
  };
  // First tick in 2 min, then every 10 min
  setTimeout(tick, 2 * 60_000).unref?.();
  const i = setInterval(tick, 10 * 60_000);
  (i as NodeJS.Timeout).unref?.();
  (i as any).unref?.();
}

/** Take a monthly snapshot on the 1st at 00:00-00:30 MSK. Idempotent. */
export function startMonthlySnapshotCron(pool: Pool, bot?: Telegraf, groupId?: number): void {
  const tick = async () => {
    try {
      const now = mskNow();
      if (now.getUTCDate() !== 1) return;
      if (now.getUTCHours() !== 0) return; // 00:00-00:59 MSK window
      const todayDate = now.toISOString().slice(0, 10);

      // Check if already taken
      const existing = await pool.query(
        'SELECT COUNT(*)::int AS n FROM builder_bot.beta_snapshots WHERE snapshot_date = $1',
        [todayDate]
      );
      if (existing.rows[0]?.n > 0) return;

      // Take snapshot of ALL active testers
      const table = await computeRewardTable(pool);
      for (const row of table.rows) {
        await pool.query(
          `INSERT INTO builder_bot.beta_snapshots
             (snapshot_date, user_id, username, xp, level, multiplier, effective_xp, total_referrals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (snapshot_date, user_id) DO NOTHING`,
          [todayDate, row.userId, row.username || null, row.xp, row.level, row.effectiveMultiplier, row.effectiveXp, row.referralCount]
        );
      }
      console.log(`[Snapshot] Captured ${table.rows.length} testers for ${todayDate}`);

      if (bot && groupId) {
        const msg = `${CE_EMOJI.camera} <b>Snapshot зафиксирован — ${todayDate}</b>\n\n` +
          `Тестеров в snapshot: <b>${table.rows.length}</b>\n` +
          `Total effective XP: <b>${table.totalEffectiveXp.toFixed(1)}</b>\n\n` +
          `Все кто в snapshot — получат долю пула (10% gross revenue × 2 года).\n` +
          `Новые тестеры после этой даты начинают с Newbie ×1.\n\n` +
          `Проверить свою позицию: /rewards`;
        await bot.telegram.sendMessage(groupId, msg, { parse_mode: 'HTML' }).catch((e: any) => console.warn('[Snapshot] post:', e.message));
      }
    } catch (e: any) { console.warn('[Snapshot] tick error:', e.message); }
  };
  // Check every 15 min (covers the 00:00-00:59 MSK window)
  const i = setInterval(tick, 15 * 60_000);
  (i as NodeJS.Timeout).unref?.();
  (i as any).unref?.();
  // Also fire once on startup so deploy in the window still captures
  setTimeout(tick, 30_000).unref?.();
}

/** Daily: flag testers inactive for INACTIVE_MONTHS_DECAY months → multiplier_override = 1.0 */
export function startInactiveDecayCron(pool: Pool, bot?: Telegraf): void {
  const tick = async () => {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - INACTIVE_MONTHS_DECAY);
      const res = await pool.query(`
        UPDATE builder_bot.beta_testers
           SET multiplier_override = 1.0
         WHERE (last_active_at IS NOT NULL AND last_active_at < $1)
           AND (multiplier_override IS NULL OR multiplier_override > 1.0)
         RETURNING user_id, username
      `, [cutoff]);
      if (res.rows.length > 0) {
        console.log(`[InactiveDecay] Decayed ${res.rows.length} inactive testers`);
        if (bot) {
          for (const r of res.rows) {
            try {
              await bot.telegram.sendMessage(Number(r.user_id),
                `${CE_EMOJI.camera} Ты не заходил 6+ месяцев — твой snapshot-множитель декейнулся до ×1.\n\n` +
                `XP остался! Сделай /checkin или заверши /quest — через неделю вернём базовый множитель.`,
                { parse_mode: 'HTML' }
              ).catch(() => {});
            } catch {}
          }
        }
      }
    } catch (e: any) { console.warn('[InactiveDecay] tick error:', e.message); }
  };
  // Every 12 hours
  const i = setInterval(tick, 12 * 60 * 60_000);
  (i as NodeJS.Timeout).unref?.();
  (i as any).unref?.();
}

/** Daily: hard auto-kick testers who had ZERO activity (no xp gain, no checkin, no agents)
 *  for 30+ days. Sets status='inactive' + bans from beta group + DM explanation. */
export function startAutoKickCron(bot: Telegraf, pool: Pool, groupId: number): void {
  const AUTO_KICK_DAYS = 30;
  const tick = async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - AUTO_KICK_DAYS);
      // Candidates: active testers with zero meaningful activity
      const res = await pool.query(`
        SELECT bt.user_id, bt.username
        FROM builder_bot.beta_testers bt
        WHERE bt.status = 'active'
          AND (bt.last_active_at IS NULL OR bt.last_active_at < $1)
          AND COALESCE(bt.xp, 0) = 0
          AND NOT EXISTS (SELECT 1 FROM builder_bot.agents a WHERE a.user_id = bt.user_id)
      `, [cutoff]);
      for (const r of res.rows) {
        const uid = Number(r.user_id);
        try {
          // Ban from beta group (removes the user; they can be unbanned manually later)
          if (groupId) {
            await bot.telegram.banChatMember(groupId, uid).catch(() => {});
          }
          // DM with explanation
          await bot.telegram.sendMessage(uid,
            `<b>Автокик из беты</b>\n\n` +
            `Ты не сделал ни одного действия за ${AUTO_KICK_DAYS} дней: 0 XP, 0 агентов, 0 /checkin.\n\n` +
            `Твой snapshot сохранён в истории — если вернёшься и сделаешь /start, восстановим доступ. ` +
            `Пока освобождаю место для активных.`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
          // Flag as inactive in DB
          await pool.query(
            `UPDATE builder_bot.beta_testers SET status = 'inactive' WHERE user_id = $1`,
            [uid]
          );
          console.log(`[AutoKick] Removed inactive tester ${uid} (@${r.username || 'unknown'})`);
        } catch (e: any) { console.warn(`[AutoKick] failed for ${uid}:`, e.message); }
      }
      if (res.rows.length > 0) {
        console.log(`[AutoKick] Processed ${res.rows.length} zero-activity testers`);
      }
    } catch (e: any) { console.warn('[AutoKick] tick error:', e.message); }
  };
  // Every 24 hours — first run 30 min after startup so fresh state loads
  setTimeout(tick, 30 * 60_000).unref?.();
  const i = setInterval(tick, 24 * 60 * 60_000);
  (i as NodeJS.Timeout).unref?.();
  (i as any).unref?.();
}

/** Called from index.ts on startup to wire all rewards crons. */
export function startRewardsCrons(bot: Telegraf, pool: Pool, groupId: number, weeklyTopicId?: number): void {
  startHallOfWeekCron(bot, pool, groupId, weeklyTopicId);
  startMonthlySnapshotCron(pool, bot, groupId);
  startInactiveDecayCron(pool, bot);
  if (groupId) startAutoKickCron(bot, pool, groupId);
  console.log('[Rewards] Crons armed: Hall of Week / Monthly Snapshot / Inactive Decay / Auto-Kick');
}
