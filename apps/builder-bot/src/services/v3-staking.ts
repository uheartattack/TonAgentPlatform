/**
 * v3-staking.ts — стейк/делегирование на агента (v3.0 Фаза 2).
 *
 * Бэкер ставит GRAM на агента (вера в «работягу») → получает ПРОПОРЦИОНАЛЬНУЮ долю
 *   его дохода: при релизе escrow часть чистого заработка (STAKER_POOL_BPS, по умолч. 20%)
 *   делится между активными бэкерами по их доле стейка и копится в ledger v3_stake_accruals.
 *   Бэкинг агента (сумма стейка, число бэкеров) = сигнал доверия на витрине.
 *
 * ⚠️ Деньги: бот НЕ двигает средства. Стейк — учётная запись доверия (+ опц. фандинг
 *   казны агента ссылкой). Начисления — учётный ledger (entitlement); ВЫПЛАТА бэкерам —
 *   будущий слой (реальные деньги, как escrow → отдельное решение/аудит).
 */
import { Pool } from 'pg';
import { toNano } from '@ton/core';

const POOL_BPS = Math.max(0, Math.min(10000, Number(process.env.V3_STAKER_POOL_BPS) || 2000)); // 20% дохода бэкерам

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Staking] not initialized'); return _pool; };

export async function initV3Staking(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_stakes (
      id            BIGSERIAL PRIMARY KEY,
      tap_agent_id  INTEGER NOT NULL,
      staker_user   BIGINT,
      staker_wallet TEXT,
      amount_nano   NUMERIC NOT NULL,
      status        SMALLINT NOT NULL DEFAULT 0,  -- 0 active · 1 withdrawn
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tap_agent_id, staker_user)
    );
    CREATE INDEX IF NOT EXISTS idx_v3_stakes_agent ON builder_bot.v3_stakes (tap_agent_id, status);
    CREATE TABLE IF NOT EXISTS builder_bot.v3_stake_accruals (
      id            BIGSERIAL PRIMARY KEY,
      tap_agent_id  INTEGER NOT NULL,
      staker_user   BIGINT,
      amount_nano   NUMERIC NOT NULL,
      ref           TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_accr_staker ON builder_bot.v3_stake_accruals (staker_user, created_at DESC);
  `);
  console.log('[V3Staking] tables ready (pool_bps=' + POOL_BPS + ')');
}

export async function stakeAgent(args: { tapAgentId: number; stakerUser: number | string; stakerWallet?: string; amountGram: number }): Promise<{ ok: boolean; stakeId: string }> {
  if (!(args.amountGram > 0)) throw new Error('stake amount must be > 0');
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_stakes (tap_agent_id, staker_user, staker_wallet, amount_nano, status)
     VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (tap_agent_id, staker_user) DO UPDATE SET amount_nano=builder_bot.v3_stakes.amount_nano+EXCLUDED.amount_nano,
       staker_wallet=COALESCE(EXCLUDED.staker_wallet, builder_bot.v3_stakes.staker_wallet), status=0 RETURNING id`,
    [args.tapAgentId, args.stakerUser ?? null, args.stakerWallet ?? null, toNano(String(args.amountGram)).toString()],
  );
  return { ok: true, stakeId: String(r.rows[0].id) };
}

export async function unstakeAgent(tapAgentId: number, stakerUser: number | string): Promise<{ ok: boolean }> {
  await pool().query(`UPDATE builder_bot.v3_stakes SET status=1 WHERE tap_agent_id=$1 AND staker_user=$2`, [tapAgentId, stakerUser]);
  return { ok: true };
}

export async function agentBacking(tapAgentId: number): Promise<{ total_gram: number; backers: number; pool_bps: number }> {
  const r = await pool().query(
    `SELECT COALESCE(SUM(amount_nano),0)::numeric AS total, COUNT(*)::int AS n
       FROM builder_bot.v3_stakes WHERE tap_agent_id=$1 AND status=0`,
    [tapAgentId],
  );
  return { total_gram: Number(BigInt(r.rows[0].total || '0')) / 1e9, backers: r.rows[0].n || 0, pool_bps: POOL_BPS };
}

export async function listStakes(filter: { tapAgentId?: number; stakerUser?: number | string }, limit = 100): Promise<any[]> {
  const conds: string[] = ['status=0']; const params: any[] = [];
  if (filter.tapAgentId != null) { params.push(filter.tapAgentId); conds.push(`tap_agent_id=$${params.length}`); }
  if (filter.stakerUser != null) { params.push(filter.stakerUser); conds.push(`staker_user=$${params.length}`); }
  params.push(Math.min(Math.max(1, limit), 300));
  const r = await pool().query(
    `SELECT id, tap_agent_id, staker_user, amount_nano, created_at FROM builder_bot.v3_stakes
       WHERE ${conds.join(' AND ')} ORDER BY amount_nano DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((x: any) => ({ ...x, amount_gram: Number(BigInt(x.amount_nano)) / 1e9 }));
}

export async function myAccruals(stakerUser: number | string, limit = 50): Promise<{ total_gram: number; items: any[] }> {
  const r = await pool().query(
    `SELECT tap_agent_id, amount_nano, ref, created_at FROM builder_bot.v3_stake_accruals
       WHERE staker_user=$1 ORDER BY created_at DESC LIMIT $2`,
    [stakerUser, Math.min(Math.max(1, limit), 200)],
  );
  const tot = await pool().query(`SELECT COALESCE(SUM(amount_nano),0)::numeric AS t FROM builder_bot.v3_stake_accruals WHERE staker_user=$1`, [stakerUser]);
  return {
    total_gram: Number(BigInt(tot.rows[0].t || '0')) / 1e9,
    items: r.rows.map((x: any) => ({ ...x, amount_gram: Number(BigInt(x.amount_nano)) / 1e9 })),
  };
}

/** Начислить долю дохода агента активным бэкерам пропорционально стейку. netEarningNano — чистый заработок. */
export async function accrueIncome(tapAgentId: number, netEarningNano: bigint, ref?: string): Promise<{ accrued: number }> {
  if (POOL_BPS <= 0 || netEarningNano <= 0n) return { accrued: 0 };
  const stakes = (await pool().query(
    `SELECT staker_user, amount_nano FROM builder_bot.v3_stakes WHERE tap_agent_id=$1 AND status=0 AND staker_user IS NOT NULL`,
    [tapAgentId],
  )).rows;
  if (!stakes.length) return { accrued: 0 };
  const totalStake = stakes.reduce((s: bigint, x: any) => s + BigInt(x.amount_nano), 0n);
  if (totalStake <= 0n) return { accrued: 0 };
  const poolNano = (netEarningNano * BigInt(POOL_BPS)) / 10000n;
  let n = 0;
  for (const st of stakes) {
    const share = (poolNano * BigInt(st.amount_nano)) / totalStake;
    if (share <= 0n) continue;
    await pool().query(
      `INSERT INTO builder_bot.v3_stake_accruals (tap_agent_id, staker_user, amount_nano, ref) VALUES ($1,$2,$3,$4)`,
      [tapAgentId, st.staker_user, share.toString(), ref ?? null],
    );
    n++;
  }
  return { accrued: n };
}
