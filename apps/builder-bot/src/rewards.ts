/**
 * Tester Rewards Math — single source of truth for revenue share calculations.
 * Terms: 10% of gross platform revenue pooled for testers for 2 years from
 * monetization start. Distribution proportional to XP × multiplier.
 * Inactive >6 months → multiplier decays to ×1 via multiplier_override.
 *
 * See docs/TESTER_REWARDS.md for the canonical spec.
 */

import { Pool } from 'pg';
import { TESTER_LEVELS, getTesterLevel } from './payments';

// ── Constants (canonical) ──────────────────────────────────────────────
export const POOL_PERCENT = 0.10;           // 10% of gross platform revenue
export const POOL_YEARS = 2;                // how long the 10% lasts
export const POOL_FLOOR_PERCENT = 0.05;     // minimum guaranteed during the 2y window
export const INACTIVE_MONTHS_DECAY = 6;     // months without XP gain → multiplier → 1
export const REF_BONUS_L1 = 20;             // XP awarded when your referral does /start
export const REF_BONUS_L2 = 5;              // XP awarded for a 2-level referral
export const REF_SPEND_PERCENT = 0.10;      // 10% of referee's future spend credited
export const FIRST_SNAPSHOT_DATE = '2026-05-01'; // first monthly snapshot

export interface TesterRewardRow {
  userId: number;
  username?: string | null;
  xp: number;
  level: number;
  baseMultiplier: number;
  effectiveMultiplier: number; // after inactive decay
  effectiveXp: number;         // xp × effectiveMultiplier
  referralCount: number;
  poolShareBps: number;        // share of pool in basis points (0-10000)
}

export interface PoolSummary {
  totalEffectiveXp: number;
  testerCount: number;
  snapshotDate?: string;
  rows: TesterRewardRow[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Returns the base multiplier for a given XP total (no decay applied). */
export function baseMultiplierForXp(xp: number): number {
  const lvl = getTesterLevel(xp);
  return (lvl as any).snapshotMultiplier ?? 1;
}

/** Apply inactivity decay: if lastActiveAt older than INACTIVE_MONTHS_DECAY months,
 *  multiplier drops to 1.0 (unless explicitly overridden by admin via multiplier_override). */
export function effectiveMultiplier(
  xp: number,
  lastActiveAt: Date | null | undefined,
  override: number | null | undefined,
): number {
  if (override != null && Number.isFinite(override) && override > 0) return Number(override);
  const base = baseMultiplierForXp(xp);
  if (!lastActiveAt) return base;
  const now = Date.now();
  const lastMs = new Date(lastActiveAt).getTime();
  const monthsInactive = (now - lastMs) / (30 * 24 * 60 * 60 * 1000);
  if (monthsInactive >= INACTIVE_MONTHS_DECAY) return 1.0;
  return base;
}

/** Build a full reward table from all active testers.
 *  Used by /rewards, /leaderboard estimation, /founders API. */
export async function computeRewardTable(pool: Pool): Promise<PoolSummary> {
  const res = await pool.query(`
    SELECT bt.user_id, bt.username, COALESCE(bt.xp, 0) AS xp,
           bt.last_active_at, bt.multiplier_override,
           (SELECT COUNT(*) FROM builder_bot.beta_referrals r WHERE r.referrer_id = bt.user_id) AS ref_count
    FROM builder_bot.beta_testers bt
    WHERE bt.status = 'active' OR bt.status IS NULL
  `);

  const rows: TesterRewardRow[] = [];
  let totalEffective = 0;

  for (const r of res.rows) {
    const xp = Number(r.xp || 0);
    const lvl = getTesterLevel(xp);
    const base = (lvl as any).snapshotMultiplier ?? 1;
    const eff = effectiveMultiplier(xp, r.last_active_at, r.multiplier_override ? Number(r.multiplier_override) : null);
    const effXp = xp * eff;
    totalEffective += effXp;
    rows.push({
      userId: Number(r.user_id),
      username: r.username,
      xp,
      level: lvl.level,
      baseMultiplier: base,
      effectiveMultiplier: eff,
      effectiveXp: effXp,
      referralCount: Number(r.ref_count || 0),
      poolShareBps: 0, // filled below
    });
  }

  // Fill share bps (requires total)
  if (totalEffective > 0) {
    for (const row of rows) {
      row.poolShareBps = Math.round((row.effectiveXp / totalEffective) * 10000);
    }
  }

  rows.sort((a, b) => b.effectiveXp - a.effectiveXp);
  return { totalEffectiveXp: totalEffective, testerCount: rows.length, rows };
}

/** Compute estimated annual payout for a given tester assuming gross revenue ton. */
export function estimateAnnualPayoutTon(row: TesterRewardRow, totalEffectiveXp: number, projectedGrossRevenueTon: number): number {
  if (totalEffectiveXp <= 0) return 0;
  const pool = projectedGrossRevenueTon * POOL_PERCENT;
  return pool * (row.effectiveXp / totalEffectiveXp);
}

/** Format a user-friendly summary for /rewards command. */
export function formatRewardsSummary(
  row: TesterRewardRow | null,
  total: number,
  testerCount: number,
  ru: boolean,
): string {
  const L = (ru ? `🎯 Revenue share` : `🎯 Revenue share`);
  let out = `<b>${L}</b>\n`;
  out += ru
    ? `10% от gross revenue платформы, 2 года с момента монетизации.\n\n`
    : `10% of platform gross revenue, 2 years from monetization start.\n\n`;

  if (!row) {
    out += ru ? `<i>Ты пока не в бета-программе. /start чтобы присоединиться.</i>` : `<i>You are not a beta tester yet. /start to join.</i>`;
    return out;
  }

  const lvl = TESTER_LEVELS.find(l => l.level === row.level);
  const lvlName = lvl ? (ru ? lvl.nameRu : lvl.name) : String(row.level);
  const shareBps = row.poolShareBps;
  const sharePct = (shareBps / 100).toFixed(2);

  out += ru
    ? `Твой статус:\n` +
      `• Уровень: <b>${lvlName}</b> (Lv.${row.level})\n` +
      `• XP: <b>${row.xp}</b>\n` +
      `• Множитель: <b>×${row.effectiveMultiplier}</b>` +
      (row.effectiveMultiplier !== row.baseMultiplier ? ` (декей с ×${row.baseMultiplier})` : '') + `\n` +
      `• Эффективный XP: <b>${row.effectiveXp.toFixed(1)}</b>\n` +
      `• Твоя доля пула: <b>${sharePct}%</b> (всего тестеров: ${testerCount})\n`
    : `Your status:\n` +
      `• Level: <b>${lvlName}</b> (Lv.${row.level})\n` +
      `• XP: <b>${row.xp}</b>\n` +
      `• Multiplier: <b>×${row.effectiveMultiplier}</b>` +
      (row.effectiveMultiplier !== row.baseMultiplier ? ` (decayed from ×${row.baseMultiplier})` : '') + `\n` +
      `• Effective XP: <b>${row.effectiveXp.toFixed(1)}</b>\n` +
      `• Your pool share: <b>${sharePct}%</b> (total testers: ${testerCount})\n`;

  // Scenarios
  out += ru ? `\n<b>💰 Прогноз годовой выплаты</b>\n` : `\n<b>💰 Projected annual payout</b>\n`;
  const scenarios = [1000, 10000, 100000];
  for (const gross of scenarios) {
    const pool = gross * POOL_PERCENT;
    const share = total > 0 ? (row.effectiveXp / total) * pool : 0;
    out += ru
      ? `• Gross ${gross.toLocaleString('ru-RU')} TON/год → пул ${pool.toLocaleString('ru-RU')} → тебе ≈ <b>${share.toFixed(1)} TON/год</b>\n`
      : `• Gross ${gross.toLocaleString('en-US')} TON/yr → pool ${pool.toLocaleString('en-US')} → you get ≈ <b>${share.toFixed(1)} TON/yr</b>\n`;
  }

  out += ru
    ? `\n<i>Выплата — квартальная на TON-кошелёк из /wallet.\nНеактивен 6 мес → множитель → ×1 (XP остаётся).</i>`
    : `\n<i>Payout — quarterly to TON wallet from /wallet.\nInactive 6 months → multiplier → ×1 (XP stays).</i>`;

  return out;
}

// ── Referral utilities ─────────────────────────────────────────────────

/** Generate deterministic ref code for a user (user_id → short b36 hash). */
export function refCodeForUser(userId: number): string {
  // ref_<base36 of userId XOR salt> — short but unique
  const SALT = 0x5f3759df;
  // eslint-disable-next-line no-bitwise
  const n = Math.abs((userId ^ SALT) >>> 0);
  return `ref_${n.toString(36)}`;
}

/** Reverse: given a ref code, find the referrer user_id. */
export function userIdFromRefCode(code: string): number | null {
  const m = /^ref_([a-z0-9]+)$/.exec(code || '');
  if (!m) return null;
  const n = parseInt(m[1], 36);
  if (!Number.isFinite(n)) return null;
  const SALT = 0x5f3759df;
  // eslint-disable-next-line no-bitwise
  return (n ^ SALT) >>> 0;
}

/** Record a new referral relationship. Returns true if newly recorded. */
export async function recordReferral(pool: Pool, referrerId: number, refereeId: number): Promise<boolean> {
  if (!referrerId || !refereeId || referrerId === refereeId) return false;
  const existing = await pool.query(
    'SELECT id FROM builder_bot.beta_referrals WHERE referee_id = $1',
    [refereeId]
  );
  if (existing.rows.length > 0) return false;
  await pool.query(
    `INSERT INTO builder_bot.beta_referrals (referrer_id, referee_id, depth) VALUES ($1, $2, 1)
     ON CONFLICT (referee_id) DO NOTHING`,
    [referrerId, refereeId]
  );
  // Check if referrerId itself has a referrer → grandparent chain
  const gp = await pool.query(
    'SELECT referrer_id FROM builder_bot.beta_referrals WHERE referee_id = $1',
    [referrerId]
  );
  if (gp.rows[0]?.referrer_id) {
    await pool.query(
      `INSERT INTO builder_bot.beta_referrals (referrer_id, referee_id, depth) VALUES ($1, $2, 2)
       ON CONFLICT DO NOTHING`,
      [gp.rows[0].referrer_id, refereeId]
    );
  }
  return true;
}

/** Award XP bonuses for a newly-recorded referral. Safe to call repeatedly
 *  — checks xp_bonus_awarded flag. */
export async function awardReferralBonuses(pool: Pool, refereeId: number): Promise<{ l1: number; l2: number }> {
  let l1Id = 0;
  let l2Id = 0;
  const rows = await pool.query(
    `SELECT id, referrer_id, depth, xp_bonus_awarded FROM builder_bot.beta_referrals WHERE referee_id = $1`,
    [refereeId]
  );
  for (const r of rows.rows) {
    if (r.xp_bonus_awarded) continue;
    const bonus = r.depth === 1 ? REF_BONUS_L1 : r.depth === 2 ? REF_BONUS_L2 : 0;
    if (bonus <= 0) continue;
    await pool.query(
      `UPDATE builder_bot.beta_testers SET xp = COALESCE(xp, 0) + $1, last_active_at = NOW()
       WHERE user_id = $2`,
      [bonus, r.referrer_id]
    );
    await pool.query(
      `UPDATE builder_bot.beta_referrals SET xp_bonus_awarded = $1 WHERE id = $2`,
      [bonus, r.id]
    );
    if (r.depth === 1) l1Id = Number(r.referrer_id);
    if (r.depth === 2) l2Id = Number(r.referrer_id);
  }
  return { l1: l1Id, l2: l2Id };
}

/** Record referee's spend — credits 10% to their referrer's ref_spend ledger. */
export async function recordRefereeSpend(pool: Pool, refereeId: number, amountTon: number, source: string): Promise<void> {
  if (!Number.isFinite(amountTon) || amountTon <= 0) return;
  const r = await pool.query(
    'SELECT referrer_id FROM builder_bot.beta_referrals WHERE referee_id = $1 AND depth = 1',
    [refereeId]
  );
  if (!r.rows[0]?.referrer_id) return;
  const credit = amountTon * REF_SPEND_PERCENT;
  await pool.query(
    `INSERT INTO builder_bot.beta_ref_spend (referrer_id, referee_id, amount_ton, source) VALUES ($1, $2, $3, $4)`,
    [r.rows[0].referrer_id, refereeId, credit, source || 'unknown']
  );
}

/** Sum of a user's ref-credit earnings. */
export async function getRefearnings(pool: Pool, userId: number): Promise<{ totalTon: number; refCount: number }> {
  const totR = await pool.query(
    'SELECT COALESCE(SUM(amount_ton), 0) AS total FROM builder_bot.beta_ref_spend WHERE referrer_id = $1',
    [userId]
  );
  const cntR = await pool.query(
    'SELECT COUNT(*) AS n FROM builder_bot.beta_referrals WHERE referrer_id = $1 AND depth = 1',
    [userId]
  );
  return { totalTon: Number(totR.rows[0]?.total || 0), refCount: Number(cntR.rows[0]?.n || 0) };
}

/** Update last_active_at for a user — call on any XP-earning action. */
export async function markActive(pool: Pool, userId: number): Promise<void> {
  await pool.query('UPDATE builder_bot.beta_testers SET last_active_at = NOW() WHERE user_id = $1', [userId]).catch(() => {});
}
