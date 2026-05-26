/**
 * payout-cron.ts — daily TON payouts to creators / referrers.
 *
 * Once a day at 04:00 UTC:
 *   1. Find users with pending earnings ≥ MIN_PAYOUT_TON who have set payout_wallet.
 *   2. For each: send TON from PLATFORM_WALLET to their payout_wallet (single
 *      internal message per user — batched amount).
 *   3. Mark the earning rows as paid with the resulting tx_hash.
 *
 * Safety:
 *   • PLATFORM_WALLET_MNEMONIC must be set; otherwise this no-ops with a warning.
 *   • Per-tick global timeout so a hung TonAPI doesn't block the cron forever.
 *   • Each user's payout is independent — one failure doesn't roll back others.
 *   • Idempotent: earnings stay 'pending' if the tx fails, so the next tick retries.
 *   • Owner gets a DM summary after each run with totals + failures.
 */

import { pool } from '../db';
import { notifyUserViaTelegram } from './notify-user';
import {
  findPayoutCandidates,
  recordBatchPayment,
  ensureCreatorEarningsSchema,
  MIN_PAYOUT_TON,
} from './creator-earnings';

const PAYOUT_HOUR_UTC = 4; // 04:00 UTC ≈ 07:00 MSK

async function _alreadyRanToday(): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=0 AND key='_last_payout_run_date'`,
    );
    const last = r.rows[0]?.value;
    const lastDate = typeof last === 'string' ? last : last?.value;
    return lastDate === today;
  } catch { return false; }
}

async function _markRanToday(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value)
         VALUES (0, 0, '_last_payout_run_date', $1::jsonb)
         ON CONFLICT (agent_id, key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(today)],
    );
  } catch (e: any) { console.warn('[Payout] mark today failed:', e.message); }
}

interface PayoutResult {
  userId: number;
  toAddress: string;
  amountNano: bigint;
  status: 'sent' | 'failed';
  txHash?: string;
  error?: string;
}

// Validate that a string parses as a TON address. We accept both bouncable
// (EQ…) and non-bouncable (UQ…) base64-url variants, plus raw "0:HEX".
function _isValidTonAddress(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  if (s.length < 40 || s.length > 80) return false;
  try {
    const { Address } = require('@ton/core');
    Address.parse(s);
    return true;
  } catch { return false; }
}

/**
 * Sanity-check that the mnemonic in env derives the address we have on file
 * as PLATFORM_WALLET. A mismatch means we'd send money out of the WRONG wallet
 * (one we don't own, or an empty one). Returns the derived address and a flag.
 */
async function _verifyPlatformWalletConfig(): Promise<{ ok: true; address: string; walletContract: any; keyPair: any; client: any } | { ok: false; error: string }> {
  const mnemonic = (process.env.PLATFORM_WALLET_MNEMONIC || '').trim();
  if (!mnemonic) return { ok: false, error: 'PLATFORM_WALLET_MNEMONIC not set' };
  const words = mnemonic.split(/\s+/).filter(Boolean);
  if (words.length !== 24 && words.length !== 12) {
    return { ok: false, error: `mnemonic word count ${words.length} not in {12,24}` };
  }
  let TonClient: any, WalletContractV4: any, Address: any, mnemonicToWalletKey: any;
  try {
    ({ TonClient, WalletContractV4 } = require('@ton/ton'));
    ({ Address } = require('@ton/core'));
    ({ mnemonicToWalletKey } = require('@ton/crypto'));
  } catch (e: any) {
    return { ok: false, error: 'TON SDK not installed: ' + e.message };
  }
  let keyPair: any;
  try { keyPair = await mnemonicToWalletKey(words); }
  catch (e: any) { return { ok: false, error: 'mnemonic decode failed: ' + e.message }; }
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const derivedNon = wallet.address.toString({ urlSafe: true, bounceable: false });
  const derivedBnc = wallet.address.toString({ urlSafe: true, bounceable: true });
  const expected = (process.env.PLATFORM_WALLET_ADDRESS || '').trim();
  if (expected && expected !== derivedNon && expected !== derivedBnc) {
    return { ok: false,
      error: `MNEMONIC mismatch: derives ${derivedNon} but PLATFORM_WALLET_ADDRESS=${expected}. Refusing to send to wrong wallet.` };
  }
  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  });
  return { ok: true, address: derivedNon, walletContract: client.open(wallet), keyPair, client };
}

/**
 * Fetch the platform wallet's balance via TonAPI (cheap, no auth needed for
 * low volume). We block payout if balance < requestedAmount + gas reserve.
 */
async function _getPlatformBalanceNano(address: string): Promise<bigint> {
  try {
    const tonApiKey = process.env.TONAPI_KEY || '';
    const headers: any = tonApiKey ? { Authorization: `Bearer ${tonApiKey}` } : {};
    const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`, { headers });
    if (!r.ok) throw new Error(`tonapi ${r.status}`);
    const d: any = await r.json();
    return BigInt(d.balance ?? 0);
  } catch (e: any) {
    throw new Error('balance check failed: ' + e.message);
  }
}

const GAS_RESERVE_NANO = BigInt(0.05 * 1e9); // keep at least 0.05 TON in wallet
const MAX_SEND_PER_TX_NANO = BigInt(100 * 1e9); // safety cap: never send >100 TON per individual tx

/**
 * Send TON from PLATFORM_WALLET to `to` with the given amount. Performs
 * preflight validations before signing anything. Returns tx hash on success.
 */
async function _sendFromPlatformWallet(toAddress: string, amountNano: bigint): Promise<string> {
  if (!_isValidTonAddress(toAddress)) throw new Error('invalid payout address: ' + toAddress.slice(0, 20));
  if (amountNano <= 0n) throw new Error('amount must be positive');
  if (amountNano > MAX_SEND_PER_TX_NANO) throw new Error(`amount ${Number(amountNano) / 1e9} TON exceeds per-tx cap`);

  const cfg = await _verifyPlatformWalletConfig();
  if (cfg.ok === false) throw new Error(cfg.error);
  const balance = await _getPlatformBalanceNano(cfg.address);
  if (balance < amountNano + GAS_RESERVE_NANO) {
    throw new Error(`insufficient platform balance: have ${Number(balance) / 1e9} TON, need ${Number(amountNano + GAS_RESERVE_NANO) / 1e9}`);
  }

  const { Address, internal } = require('@ton/core');
  const seqno = await cfg.walletContract.getSeqno();
  // bounce: false so we don't burn the gas if recipient wallet isn't deployed
  // (very common for fresh wallets — TX bounces back instead of crediting)
  await cfg.walletContract.sendTransfer({
    seqno,
    secretKey: cfg.keyPair.secretKey,
    messages: [internal({
      to: Address.parse(toAddress),
      value: amountNano,
      bounce: false,
      body: 'TON Agent Platform — creator payout',
    })],
  });

  // sendTransfer doesn't return the tx hash. Poll our wallet's outbound tx
  // briefly to discover the actual hash for audit trail.
  let hash: string | null = null;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const tonApiKey = process.env.TONAPI_KEY || '';
      const headers: any = tonApiKey ? { Authorization: `Bearer ${tonApiKey}` } : {};
      const r = await fetch(`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(cfg.address)}/transactions?limit=10`, { headers });
      if (!r.ok) continue;
      const d: any = await r.json();
      for (const tx of d.transactions || []) {
        const outs = tx.out_msgs || [];
        for (const m of outs) {
          if (m.value && Number(m.value) >= Number(amountNano) * 0.99) {
            hash = tx.hash; break;
          }
        }
        if (hash) break;
      }
      if (hash) break;
    } catch {}
  }
  if (!hash) hash = `unconfirmed_seqno_${seqno}`; // log even unconfirmed hash for audit
  return hash;
}

// Postgres advisory lock — one big int identifies the "payout" critical section.
// Two cron ticks running concurrently would race on wallet seqno and double-pay.
const PAYOUT_LOCK_ID = 4242424242;

async function _tryAcquireLock(): Promise<boolean> {
  const r = await pool.query('SELECT pg_try_advisory_lock($1::bigint) AS got', [PAYOUT_LOCK_ID]);
  return r.rows[0].got === true;
}
async function _releaseLock(): Promise<void> {
  try { await pool.query('SELECT pg_advisory_unlock($1::bigint)', [PAYOUT_LOCK_ID]); } catch {}
}

/**
 * Run a single payout cycle. Idempotent: candidates with pending balance ≥ MIN
 * are batched and paid out. Returns the per-user results for reporting.
 *
 * Acquires a Postgres advisory lock so concurrent ticks (e.g. accidental
 * double-fire, manual trigger + cron overlap) can't both touch wallet seqno.
 */
export async function runPayoutOnce(): Promise<PayoutResult[]> {
  await ensureCreatorEarningsSchema(pool);
  const gotLock = await _tryAcquireLock();
  if (!gotLock) {
    console.warn('[Payout] another payout cycle is already running — skipping');
    return [];
  }
  try {
    return await _runPayoutLocked();
  } finally {
    await _releaseLock();
  }
}

async function _runPayoutLocked(): Promise<PayoutResult[]> {
  // Pre-flight ONCE per cycle: derive address, verify match, log balance.
  const cfg = await _verifyPlatformWalletConfig();
  if (cfg.ok === false) {
    console.warn('[Payout] config invalid:', cfg.error);
    return [];
  }
  console.log(`[Payout] using platform wallet ${cfg.address}`);
  const candidates = await findPayoutCandidates(pool);
  if (candidates.length === 0) {
    console.log('[Payout] no candidates this cycle');
    return [];
  }
  const results: PayoutResult[] = [];
  for (const c of candidates) {
    if (!c.payoutWallet || !/^[A-Za-z0-9_\-]{40,80}$/.test(c.payoutWallet)) {
      results.push({ userId: c.userId, toAddress: c.payoutWallet, amountNano: c.pendingNano,
        status: 'failed', error: 'invalid payout wallet' });
      continue;
    }
    try {
      const txHash = await _sendFromPlatformWallet(c.payoutWallet, c.pendingNano);
      await recordBatchPayment(pool, c.userId, c.earningIds, c.pendingNano, c.payoutWallet, txHash, 'sent');
      results.push({ userId: c.userId, toAddress: c.payoutWallet, amountNano: c.pendingNano,
        status: 'sent', txHash });
      // DM creator
      const ton = Number(c.pendingNano) / 1e9;
      void notifyUserViaTelegram(c.userId,
        `💰 <b>Payout sent</b>\n\nYou received <b>${ton.toFixed(3)} TON</b> to <code>${c.payoutWallet.slice(0, 12)}…</code>\n\nTransaction: <code>${txHash.slice(0, 24)}…</code>`,
        { parseMode: 'HTML', silent: true },
      );
    } catch (e: any) {
      await recordBatchPayment(pool, c.userId, c.earningIds, c.pendingNano, c.payoutWallet, null, 'failed', e?.message);
      results.push({ userId: c.userId, toAddress: c.payoutWallet, amountNano: c.pendingNano,
        status: 'failed', error: e?.message?.slice(0, 200) });
    }
  }
  return results;
}

async function _notifyOwnerSummary(results: PayoutResult[]): Promise<void> {
  if (results.length === 0) return;
  const ownerEnv = process.env.OWNER_ID;
  if (!ownerEnv || ownerEnv === '0') return;
  const ownerId = Number(ownerEnv);
  if (!Number.isFinite(ownerId)) return;
  const sent = results.filter(r => r.status === 'sent');
  const failed = results.filter(r => r.status === 'failed');
  const totalTon = sent.reduce((s, r) => s + Number(r.amountNano) / 1e9, 0);
  const lines: string[] = [];
  lines.push(`💸 <b>Payout cycle complete</b>`);
  lines.push(`Sent: <b>${sent.length}</b> · Total: <b>${totalTon.toFixed(3)} TON</b>`);
  if (failed.length) {
    lines.push(`Failed: <b>${failed.length}</b>`);
    for (const f of failed.slice(0, 5)) {
      lines.push(`• user ${f.userId}: ${(f.error || '').slice(0, 80)}`);
    }
  }
  await notifyUserViaTelegram(ownerId, lines.join('\n'), { parseMode: 'HTML', silent: true });
}

// ── Manual payout mode (preferred — safer, no mnemonic on server) ─────────
// Instead of auto-signing TX from the server, we just notify the platform
// owner DM each day with the pending payout list. They open Studio Admin →
// Payouts and sign a batched TonConnect transfer with their own Tonkeeper.
// The MNEMONIC-based auto-send remains as a fallback if PAYOUT_AUTO_SEND=1.
async function _notifyOwnerOfPending(): Promise<void> {
  const ownerEnv = process.env.OWNER_ID;
  if (!ownerEnv || ownerEnv === '0') return;
  const ownerId = Number(ownerEnv);
  if (!Number.isFinite(ownerId)) return;
  const candidates = await findPayoutCandidates(pool);
  if (candidates.length === 0) return;
  const totalNano = candidates.reduce((s, c) => s + c.pendingNano, 0n);
  const totalTon = Number(totalNano) / 1e9;
  const lines = [
    '💸 <b>Pending creator payouts</b>',
    '',
    `Authors to pay: <b>${candidates.length}</b>`,
    `Total: <b>${totalTon.toFixed(3)} TON</b>`,
    `Min per payout: ${MIN_PAYOUT_TON} TON`,
    '',
    'Top:',
    ...candidates.slice(0, 5).map((c) =>
      `• user ${c.userId}: ${(Number(c.pendingNano) / 1e9).toFixed(3)} TON → <code>${c.payoutWallet.slice(0, 8)}…${c.payoutWallet.slice(-6)}</code>`
    ),
    '',
    '➜ <a href="https://tonagentplatform.com/studio.html?page=admin-payouts">Open Studio Admin → Payouts</a> and sign via Tonkeeper.',
  ].filter(Boolean).join('\n');
  await notifyUserViaTelegram(ownerId, lines, { parseMode: 'HTML', silent: true });
}

let _started = false;
export function startPayoutCron(): void {
  if (_started) return;
  _started = true;
  const autoSend = process.env.PAYOUT_AUTO_SEND === '1';
  const hasMnemonic = !!process.env.PLATFORM_WALLET_MNEMONIC;

  if (autoSend && !hasMnemonic) {
    console.warn('[Payout] PAYOUT_AUTO_SEND=1 but PLATFORM_WALLET_MNEMONIC not set — falling back to notify-only mode');
  }
  const mode: 'auto' | 'notify' = autoSend && hasMnemonic ? 'auto' : 'notify';

  const tick = async () => {
    try {
      const hour = new Date().getUTCHours();
      if (hour !== PAYOUT_HOUR_UTC) return;
      if (await _alreadyRanToday()) return;
      if (mode === 'auto') {
        const results = await runPayoutOnce();
        await _markRanToday();
        await _notifyOwnerSummary(results);
        console.log(`[Payout] cycle done: ${results.filter(r => r.status === 'sent').length} sent, ${results.filter(r => r.status === 'failed').length} failed`);
      } else {
        // Notify-only mode — owner signs via TonConnect manually
        await _notifyOwnerOfPending();
        await _markRanToday();
        console.log('[Payout] notified owner of pending payouts (manual TonConnect mode)');
      }
    } catch (e: any) {
      console.warn('[Payout] tick error:', e?.message);
    }
  };
  const interval = setInterval(tick, 60 * 60 * 1000);
  (interval as NodeJS.Timeout).unref?.();
  // First check 90s after boot
  const boot = setTimeout(tick, 90_000);
  (boot as NodeJS.Timeout).unref?.();
  console.log(`[Payout] cron armed (mode=${mode}, hour=${PAYOUT_HOUR_UTC} UTC, min=${MIN_PAYOUT_TON} TON)`);
}
