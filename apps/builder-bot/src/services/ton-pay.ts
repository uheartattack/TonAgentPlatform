/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TON PAY — marketplace payouts (agents.ton.org → TON Pay SDK)
 *
 * Skill / agent marketplace flow:
 *   1. Buyer hits POST /api/skills/:name/buy
 *   2. We create a TON Pay invoice (memo = unique invoiceId, target = seller's
 *      TON wallet from user_settings).
 *   3. Frontend opens the TON Pay checkout URL (or uses TON Connect to sign).
 *   4. Once paid: status polling OR webhook flips skill_purchases.status = 'paid',
 *      grants buyer access to the skill (insert into builder_bot.skills with
 *      source='purchased' or unlock via agent_skills).
 *
 * MVP scope:
 *   • Direct-to-wallet flow (buyer sends TON with memo to seller's address)
 *   • Verification via TonAPI: scan recent transactions on seller's address,
 *     match memo + amount within ±5min window
 *   • No custody, no escrow — minimal compliance surface
 *
 * Future:
 *   • @ton-pay/api SDK integration (when stable, currently @beta)
 *   • Webhooks instead of polling
 *   • Refunds, partial payments, subscriptions
 * ═══════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';

const INVOICE_TTL_MS = 15 * 60_000;          // 15 minutes
const VERIFY_AMOUNT_TOLERANCE = 0.99;         // accept ≥99% of asking price (gas absorb)
const TONAPI_BASE = 'https://tonapi.io/v2';

export interface CreateInvoiceParams {
  skillId: number;
  skillName: string;
  buyerUserId: number;
  sellerUserId: number;
  sellerAddress: string;          // bouncable EQ format
  priceTon: number;
}

export interface Invoice {
  id: number;
  invoiceId: string;
  payUrl: string;
  recipient: string;
  amountTon: number;
  memo: string;
  expiresAt: string;
  status: 'pending' | 'paid' | 'expired' | 'refunded' | 'failed';
}

function genInvoiceId(): string {
  return 'tap_' + crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

export async function createInvoice(p: CreateInvoiceParams): Promise<Invoice> {
  const { pool } = await import('../db');
  const { PLATFORM_WALLET } = await import('../payments');
  const invoiceId = genInvoiceId();
  const memo = invoiceId;
  const expiresAt = new Date(Date.now() + INVOICE_TTL_MS).toISOString();

  // Insert pending invoice
  const res = await pool.query(
    `INSERT INTO builder_bot.skill_purchases
       (skill_id, skill_name, buyer_user_id, seller_user_id, price_ton, invoice_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id`,
    [p.skillId, p.skillName, p.buyerUserId, p.sellerUserId, p.priceTon, invoiceId],
  );

  // Funds flow through the PLATFORM wallet — the 80/15/5 split (creator / platform
  // / referrer) is then settled on the daily payout cron. This replaces the older
  // direct-to-seller flow so we can take the platform fee and credit referrers.
  const recipient = PLATFORM_WALLET;
  const payUrl = `ton://transfer/${encodeURIComponent(recipient)}?amount=${Math.floor(p.priceTon * 1e9)}&text=${encodeURIComponent(memo)}`;

  return {
    id: res.rows[0].id,
    invoiceId,
    payUrl,
    recipient,
    amountTon: p.priceTon,
    memo,
    expiresAt,
    status: 'pending',
  };
}

/**
 * Poll TonAPI for transactions on the seller's address. If we find one with
 * matching memo + sufficient amount within the invoice TTL, mark as paid.
 *
 * Returns the (possibly updated) invoice status.
 */
export async function verifyInvoice(invoiceId: string): Promise<{
  status: 'pending' | 'paid' | 'expired' | 'failed';
  txHash?: string;
  error?: string;
}> {
  const { pool } = await import('../db');
  const r = await pool.query(
    `SELECT id, skill_id, skill_name, buyer_user_id, seller_user_id, price_ton, status, created_at
       FROM builder_bot.skill_purchases WHERE invoice_id = $1`,
    [invoiceId],
  );
  if (!r.rows[0]) return { status: 'failed', error: 'invoice not found' };
  const inv = r.rows[0];
  if (inv.status === 'paid') return { status: 'paid' };
  if (inv.status === 'failed' || inv.status === 'refunded') return { status: inv.status };

  // Expired?
  const ageMs = Date.now() - new Date(inv.created_at).getTime();
  if (ageMs > INVOICE_TTL_MS) {
    await pool.query(`UPDATE builder_bot.skill_purchases SET status = 'expired' WHERE id = $1`, [inv.id]);
    return { status: 'expired' };
  }

  // Funds land on the PLATFORM wallet now. We poll its inbound transactions and
  // match by memo (invoiceId). Once matched we credit creator_earnings (80% seller,
  // 5% referrer, rest platform) and the daily cron settles outbound payouts.
  const { PLATFORM_WALLET } = await import('../payments');
  const platformAddr = PLATFORM_WALLET;
  if (!platformAddr) return { status: 'pending', error: 'PLATFORM_WALLET not configured' };

  try {
    const tonApiKey = process.env.TONAPI_KEY || '';
    const headers: any = tonApiKey ? { Authorization: `Bearer ${tonApiKey}` } : {};
    const txRes = await fetch(`${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(platformAddr)}/transactions?limit=50`, { headers });
    if (!txRes.ok) return { status: 'pending', error: `tonapi ${txRes.status}` };
    const data: any = await txRes.json();
    const txs = data.transactions || [];
    const minAmountNano = Math.floor(Number(inv.price_ton) * 1e9 * VERIFY_AMOUNT_TOLERANCE);
    for (const tx of txs) {
      const inMsg = tx.in_msg;
      if (!inMsg || inMsg.msg_type !== 'int_msg') continue;
      const amt = Number(inMsg.value || 0);
      if (amt < minAmountNano) continue;
      const comment = inMsg.decoded_body?.text || '';
      if (comment !== invoiceId) continue;
      const utime = Number(tx.utime || 0);
      if (utime * 1000 < new Date(inv.created_at).getTime() - 5_000) continue;
      // Match — mark purchase paid and credit earnings (idempotent via UNIQUE INDEX).
      await pool.query(
        `UPDATE builder_bot.skill_purchases
            SET status = 'paid', tx_hash = $1, paid_at = NOW()
          WHERE id = $2`,
        [tx.hash, inv.id],
      );
      try {
        const { creditSale } = await import('./creator-earnings');
        await creditSale(pool, {
          sellerUserId: Number(inv.seller_user_id),
          buyerUserId: Number(inv.buyer_user_id),
          amountNano: BigInt(amt),
          sourceType: 'skill_purchase',
          sourceId: Number(inv.id),
          skillName: inv.skill_name,
        });
      } catch (e: any) {
        console.warn('[ton-pay] creditSale failed:', e?.message);
      }
      return { status: 'paid', txHash: tx.hash };
    }
    return { status: 'pending' };
  } catch (e: any) {
    return { status: 'pending', error: e?.message?.slice(0, 100) };
  }
}

/**
 * List all purchases for a buyer (used in profile "my purchases" tab).
 */
export async function listPurchases(buyerUserId: number): Promise<Array<{
  id: number;
  skillName: string;
  priceTon: number;
  status: string;
  txHash: string | null;
  createdAt: string;
  paidAt: string | null;
}>> {
  const { pool } = await import('../db');
  const r = await pool.query(
    `SELECT id, skill_name, price_ton, status, tx_hash, created_at, paid_at
       FROM builder_bot.skill_purchases
      WHERE buyer_user_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [buyerUserId],
  );
  return r.rows.map((row: any) => ({
    id: row.id,
    skillName: row.skill_name,
    priceTon: Number(row.price_ton),
    status: row.status,
    txHash: row.tx_hash,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  }));
}
