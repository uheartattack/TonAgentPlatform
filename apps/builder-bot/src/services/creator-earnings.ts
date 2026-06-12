/**
 * creator-earnings.ts — Author payout pipeline for the skill / agent marketplace.
 *
 *   buyer pays X TON
 *        │
 *        ▼
 *   PLATFORM_WALLET (one address, controlled by platform mnemonic)
 *        │
 *        ▼ creator_earnings rows recorded
 *        │   80% → seller (creator)
 *        │   5%  → buyer's referrer (if any)
 *        │   15% → platform (residual)
 *        │
 *        ▼ daily payout cron
 *   batched outbound TX from PLATFORM_WALLET → creator's payout_wallet
 *        │
 *        ▼
 *   payout_batches row marked status='confirmed', creator_earnings.paid_at set
 *
 * Idempotent: each earning row references its source (skill purchase id) so
 * double-credits are impossible. Payouts use MIN_PAYOUT_TON threshold so gas
 * is amortised.
 */

import type { Pool } from 'pg';

// Splits — sum to 100.
export const SELLER_SHARE = 0.80;   // creator
export const REFERRER_SHARE = 0.05; // buyer's L1 referrer if active
// Platform keeps the rest (15% if both apply, 20% if no referrer).
export const MIN_PAYOUT_TON = 0.5;  // hold earnings below this until aggregated
export const MIN_PAYOUT_NANO = BigInt(Math.floor(MIN_PAYOUT_TON * 1e9));

let _schemaReady = false;
export async function ensureCreatorEarningsSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.creator_earnings (
      id              SERIAL PRIMARY KEY,
      user_id         BIGINT NOT NULL,
      source_type     TEXT NOT NULL,             -- 'skill_purchase' | 'agent_fork' | 'referral' | 'manual'
      source_id       INTEGER,                   -- e.g. skill_purchases.id
      amount_nano     BIGINT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded
      payout_batch_id INTEGER,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at         TIMESTAMPTZ,
      note            TEXT,
      CONSTRAINT creator_earnings_status_chk
        CHECK (status IN ('pending','paid','failed','refunded'))
    );
    CREATE INDEX IF NOT EXISTS idx_creator_earn_user_status
      ON builder_bot.creator_earnings(user_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_creator_earn_pending
      ON builder_bot.creator_earnings(status) WHERE status = 'pending';
    -- Stop double-credit: one earning per (source_type, source_id, user_id)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_earn_source
      ON builder_bot.creator_earnings(source_type, source_id, user_id)
      WHERE source_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS builder_bot.payout_batches (
      id           SERIAL PRIMARY KEY,
      user_id      BIGINT NOT NULL,
      amount_nano  BIGINT NOT NULL,
      to_address   TEXT NOT NULL,
      tx_hash      TEXT,
      status       TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | confirmed | failed
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at      TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      CONSTRAINT payout_batches_status_chk
        CHECK (status IN ('pending','sent','confirmed','failed'))
    );
    CREATE INDEX IF NOT EXISTS idx_payout_batches_user
      ON builder_bot.payout_batches(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payout_batches_pending
      ON builder_bot.payout_batches(status) WHERE status IN ('pending','sent');
  `);
  _schemaReady = true;
}

export interface CreditOpts {
  sellerUserId: number;
  buyerUserId: number;
  amountNano: bigint;         // total purchase amount in nanoTON
  sourceType: 'skill_purchase' | 'agent_fork';
  sourceId: number;           // primary key from skill_purchases / agent_shares
  skillName?: string;
}

/**
 * Record earnings for a confirmed sale. Idempotent — the UNIQUE INDEX
 * (source_type, source_id, user_id) ensures rerunning the hook doesn't
 * double-credit. Splits the amount per SELLER_SHARE / REFERRER_SHARE.
 */
export async function creditSale(pool: Pool, opts: CreditOpts): Promise<{
  sellerNano: bigint;
  referrerNano: bigint;
  platformNano: bigint;
  referrerId: number | null;
}> {
  await ensureCreatorEarningsSchema(pool);
  const total = opts.amountNano;
  const sellerNano = (total * BigInt(Math.round(SELLER_SHARE * 1000))) / 1000n;

  // L1 referrer lookup. We only pay out if both sides have been active recently
  // (anti-Sybil — see rewards.ts L1 logic).
  let referrerId: number | null = null;
  let referrerNano = 0n;
  try {
    const r = await pool.query(
      `SELECT referrer_user_id FROM builder_bot.beta_referrals
        WHERE user_id = $1 LIMIT 1`,
      [opts.buyerUserId],
    );
    if (r.rows[0]?.referrer_user_id) {
      referrerId = Number(r.rows[0].referrer_user_id);
      referrerNano = (total * BigInt(Math.round(REFERRER_SHARE * 1000))) / 1000n;
    }
  } catch {}

  const platformNano = total - sellerNano - referrerNano;
  const note = opts.skillName ? `Skill: ${opts.skillName.slice(0, 60)}` : opts.sourceType;

  // INSERT … ON CONFLICT DO NOTHING for idempotency. We log both seller and referrer.
  await pool.query(
    `INSERT INTO builder_bot.creator_earnings
       (user_id, source_type, source_id, amount_nano, status, note)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       ON CONFLICT (source_type, source_id, user_id) WHERE source_id IS NOT NULL DO NOTHING`,
    [opts.sellerUserId, opts.sourceType, opts.sourceId, sellerNano.toString(), note],
  );
  if (referrerId && referrerNano > 0n) {
    await pool.query(
      `INSERT INTO builder_bot.creator_earnings
         (user_id, source_type, source_id, amount_nano, status, note)
         VALUES ($1, 'referral', $2, $3, 'pending', $4)
         ON CONFLICT (source_type, source_id, user_id) WHERE source_id IS NOT NULL DO NOTHING`,
      [referrerId, opts.sourceId, referrerNano.toString(), `Referral from purchase #${opts.sourceId}`],
    );
  }
  // Real-time notify: if this sale just pushed someone over MIN_PAYOUT — DM the
  // platform owner right away (not at daily cron tick). Fire-and-forget so a
  // notification hiccup doesn't roll back the earnings record.
  void _maybeNotifyOwnerThresholdCrossed(pool, [opts.sellerUserId, referrerId].filter((x): x is number => !!x))
    .catch(() => {});
  return { sellerNano, referrerNano, platformNano, referrerId };
}

async function _maybeNotifyOwnerThresholdCrossed(pool: Pool, candidateUserIds: number[]): Promise<void> {
  if (candidateUserIds.length === 0) return;
  const ownerEnv = process.env.OWNER_ID;
  if (!ownerEnv || ownerEnv === '0') return;
  const ownerId = Number(ownerEnv);
  if (!Number.isFinite(ownerId)) return;
  // For each candidate, check if their pending balance just crossed the threshold
  // AND they have a payout_wallet set (else no actionable payout).
  for (const uid of candidateUserIds) {
    try {
      const r = await pool.query(
        `SELECT
           (SELECT COALESCE(SUM(amount_nano),0)::text FROM builder_bot.creator_earnings WHERE user_id=$1 AND status='pending') AS pending_nano,
           (SELECT value FROM builder_bot.user_settings WHERE user_id=$1 AND key='payout_wallet' LIMIT 1) AS payout_wallet`,
        [uid],
      );
      const pendingNano = BigInt(r.rows[0]?.pending_nano || '0');
      const walletRaw = r.rows[0]?.payout_wallet;
      const payoutWallet = typeof walletRaw === 'string'
        ? walletRaw.replace(/^"|"$/g, '')
        : (walletRaw?.value || walletRaw?.address || '');
      if (!payoutWallet) continue;
      if (pendingNano < MIN_PAYOUT_NANO) continue;

      // Throttle: don't re-DM if we already notified about this user in the
      // last 6h (a flurry of small sales shouldn't = a flurry of DMs).
      const cacheKey = `_payout_notify_${uid}`;
      const last = await pool.query(
        `SELECT value FROM builder_bot.agent_state WHERE agent_id=0 AND key=$1`,
        [cacheKey],
      );
      const lastTs = last.rows[0]?.value
        ? Number(typeof last.rows[0].value === 'string' ? last.rows[0].value : last.rows[0].value?.value || 0)
        : 0;
      const now = Date.now();
      if (now - lastTs < 6 * 60 * 60 * 1000) continue;

      const ton = Number(pendingNano) / 1e9;
      try {
        const { notifyUserViaTelegram } = await import('./notify-user');
        await notifyUserViaTelegram(ownerId,
          `💸 <b>New payout request</b>\n\n` +
          `User <code>${uid}</code> has <b>${ton.toFixed(3)} TON</b> ready (≥ ${MIN_PAYOUT_TON} TON threshold).\n` +
          `Wallet: <code>${payoutWallet.slice(0, 8)}…${payoutWallet.slice(-6)}</code>\n\n` +
          `➜ Open Studio Admin → Payouts to sign via Tonkeeper.`,
          { parseMode: 'HTML', silent: true });
      } catch {}
      // Mark notified
      await pool.query(
        `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value)
           VALUES (0, 0, $1, $2::jsonb)
           ON CONFLICT (agent_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [cacheKey, JSON.stringify(String(now))],
      );
    } catch {}
  }
}

export interface EarningsSummary {
  pendingTon: number;
  paidTon: number;
  totalEarnedTon: number;
  recent: Array<{
    id: number;
    amountTon: number;
    sourceType: string;
    sourceId: number | null;
    status: string;
    note: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
}

export async function getEarningsForUser(pool: Pool, userId: number): Promise<EarningsSummary> {
  await ensureCreatorEarningsSchema(pool);
  const sums = await pool.query(
    `SELECT
       COALESCE(SUM(amount_nano) FILTER (WHERE status='pending'), 0)::text AS pending,
       COALESCE(SUM(amount_nano) FILTER (WHERE status='paid'), 0)::text    AS paid
     FROM builder_bot.creator_earnings WHERE user_id = $1`,
    [userId],
  );
  const recent = await pool.query(
    `SELECT id, amount_nano, source_type, source_id, status, note, created_at, paid_at
       FROM builder_bot.creator_earnings
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
    [userId],
  );
  const pendingNano = BigInt(sums.rows[0].pending);
  const paidNano = BigInt(sums.rows[0].paid);
  const nanoToTon = (n: bigint) => Number(n) / 1e9;
  return {
    pendingTon: nanoToTon(pendingNano),
    paidTon: nanoToTon(paidNano),
    totalEarnedTon: nanoToTon(pendingNano + paidNano),
    recent: recent.rows.map((r: any) => ({
      id: r.id,
      amountTon: Number(r.amount_nano) / 1e9,
      sourceType: r.source_type,
      sourceId: r.source_id,
      status: r.status,
      note: r.note,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    })),
  };
}

/**
 * Find all users who have pending earnings ≥ MIN_PAYOUT_TON AND have set a
 * payout_wallet. Used by the daily payout cron.
 */
export async function findPayoutCandidates(pool: Pool): Promise<Array<{
  userId: number;
  pendingNano: bigint;
  payoutWallet: string;
  earningIds: number[];
}>> {
  await ensureCreatorEarningsSchema(pool);
  const r = await pool.query(
    `WITH pend AS (
       SELECT ce.user_id,
              SUM(ce.amount_nano) AS total_nano,
              ARRAY_AGG(ce.id) AS ids
         FROM builder_bot.creator_earnings ce
         WHERE ce.status = 'pending'
         GROUP BY ce.user_id
         HAVING SUM(ce.amount_nano) >= $1
     )
     SELECT pend.user_id, pend.total_nano::text, pend.ids,
            us.value AS payout_wallet
       FROM pend
       JOIN builder_bot.user_settings us
         ON us.user_id = pend.user_id AND us.key = 'payout_wallet'
       WHERE us.value IS NOT NULL AND us.value::text <> 'null'`,
    [MIN_PAYOUT_NANO.toString()],
  );
  return r.rows.map((row: any) => ({
    userId: Number(row.user_id),
    pendingNano: BigInt(row.total_nano),
    payoutWallet: typeof row.payout_wallet === 'string'
      ? row.payout_wallet.replace(/^"|"$/g, '')
      : (row.payout_wallet?.value || row.payout_wallet?.address || ''),
    earningIds: row.ids,
  }));
}

/**
 * Atomically mark a set of earnings as paid within a batch transaction.
 * Returns the created payout_batches.id.
 */
export async function recordBatchPayment(
  pool: Pool,
  userId: number,
  earningIds: number[],
  amountNano: bigint,
  toAddress: string,
  txHash: string | null,
  status: 'sent' | 'failed',
  error?: string,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO builder_bot.payout_batches
         (user_id, amount_nano, to_address, tx_hash, status, error, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, amountNano.toString(), toAddress, txHash, status, error || null,
       status === 'sent' ? new Date() : null],
    );
    const batchId = ins.rows[0].id;
    if (status === 'sent') {
      await client.query(
        `UPDATE builder_bot.creator_earnings
            SET status = 'paid', paid_at = NOW(), payout_batch_id = $1
          WHERE id = ANY($2::int[])`,
        [batchId, earningIds],
      );
    }
    await client.query('COMMIT');
    return batchId;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
