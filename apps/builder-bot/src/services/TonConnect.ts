import { TonConnect } from '@tonconnect/sdk';
import { mnemonicNew, mnemonicToWalletKey, sign } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
// eslint-disable-next-line @typescript-eslint/no-var-requires
let WalletContractV5R1: any;
try { WalletContractV5R1 = require('@ton/ton').WalletContractV5R1; } catch {}
// Fallback: if V5R1 not available, use V4
if (!WalletContractV5R1) {
  console.warn('[TonConnect] WalletContractV5R1 not available, falling back to V4');
  WalletContractV5R1 = WalletContractV4;
}
import { internal, beginCell, Address, SendMode, external, storeMessage } from '@ton/core';
import QRCode from 'qrcode';
import fetch from 'node-fetch';

// ── API endpoints ────────────────────────────────────────────────────────────
const TONAPI_BASE = 'https://tonapi.io/v2';
const TONAPI_KEY  = process.env.TONAPI_KEY || '';
const TONCENTER_API = 'https://toncenter.com/api/v2';
const TONCENTER_KEY = process.env.TONCENTER_API_KEY || '';

// Platform wallet — V5R1 (agentplatform.ton)
export const PLATFORM_WALLET_ADDRESS =
  process.env.PLATFORM_WALLET_ADDRESS ||
  'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';

const sessions = new Map<string, { value: any; createdAt: number }>();

// Periodic cleanup: remove session entries older than 1 hour, every 30 minutes
const _sessionCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, v] of sessions) {
    if (v.createdAt < cutoff) sessions.delete(k);
  }
}, 30 * 60 * 1000);
if (_sessionCleanupTimer.unref) _sessionCleanupTimer.unref();

export interface AgentWallet {
  address: string;
  mnemonic: string;
  publicKey: Buffer;
  secretKey: Buffer;
  version?: 'v4r2' | 'v5r1';
}

// ── Wallet creation ──────────────────────────────────────────────────────────

/** Generate a new V4R2 wallet for an agent */
export async function generateAgentWallet(): Promise<AgentWallet> {
  const mnemonic = await mnemonicNew(24);
  const keyPair = await mnemonicToWalletKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  // Address.toString() may throw on frozen objects in newer @ton/core — use Address helper
  let addr: string;
  try {
    addr = wallet.address.toString({ urlSafe: true, bounceable: false });
  } catch {
    // Fallback: reconstruct Address from raw
    const { Address } = require('@ton/core');
    addr = Address.parse(wallet.address.toRawString()).toString({ urlSafe: true, bounceable: false });
  }
  return {
    address: addr,
    mnemonic: mnemonic.join(' '),
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    version: 'v4r2',
  };
}

/** Reconstruct wallet from mnemonic (tries V5R1 first, falls back to V4R2) */
export async function walletFromMnemonic(
  mnemonicStr: string,
  preferVersion?: 'v4r2' | 'v5r1'
): Promise<AgentWallet> {
  // Validate input — `mnemonicToWalletKey([''])` returns a deterministic but
  // meaningless key, which would produce a "valid" but useless wallet.
  if (!mnemonicStr || typeof mnemonicStr !== 'string') {
    throw new Error('Invalid mnemonic: empty or not a string');
  }
  const words = mnemonicStr.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 12 || words.length > 24 || words.length % 3 !== 0) {
    throw new Error(`Invalid mnemonic: expected 12/15/18/21/24 words, got ${words.length}`);
  }
  const keyPair = await mnemonicToWalletKey(words);
  const version = preferVersion || 'v4r2';
  const wallet =
    version === 'v5r1'
      ? WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey })
      : WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  let addr: string;
  try {
    addr = wallet.address.toString({ urlSafe: true, bounceable: false });
  } catch {
    const { Address } = require('@ton/core');
    addr = Address.parse(wallet.address.toRawString()).toString({ urlSafe: true, bounceable: false });
  }
  return {
    address: addr,
    mnemonic: mnemonicStr,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    version,
  };
}

// ── Balance queries (TONAPI with key, fallback TonCenter) ────────────────────

export async function getWalletBalance(address: string): Promise<number> {
  try {
    if (TONAPI_KEY) {
      const res = await fetch(`${TONAPI_BASE}/accounts/${encodeURIComponent(address)}`, {
        headers: { Authorization: `Bearer ${TONAPI_KEY}` },
      });
      if (!res.ok) throw new Error(`TONAPI ${res.status}: ${res.statusText}`);
      const data = await res.json() as any;
      if (data.balance != null) return Number(data.balance) / 1e9;
    }
    // fallback TonCenter
    const res = await fetch(
      `${TONCENTER_API}/getAddressBalance?address=${encodeURIComponent(address)}`,
      { headers: TONCENTER_KEY ? { 'X-API-Key': TONCENTER_KEY } : {} }
    );
    if (!res.ok) return 0;
    const data = await res.json() as any;
    if (data.ok && data.result) return parseInt(data.result) / 1e9;
    return 0;
  } catch (e) {
    console.error('[TON] getWalletBalance error:', e);
    return 0;
  }
}

/**
 * In-memory seqno cache per wallet address.
 * Prevents race condition where two txs issued within a few seconds
 * both read the same "last confirmed" seqno from TonAPI and overwrite each other.
 * Entry lives for SEQNO_CACHE_TTL, then we refresh from network.
 */
interface SeqnoCacheEntry { seqno: number; expiresAt: number; }
const _seqnoCache = new Map<string, SeqnoCacheEntry>();
const SEQNO_CACHE_TTL = 90_000; // 90s — covers a typical TX confirmation window

async function fetchSeqnoFromNetwork(address: string): Promise<number> {
  try {
    if (TONAPI_KEY) {
      const res = await fetch(`${TONAPI_BASE}/wallet/${encodeURIComponent(address)}/seqno`, {
        headers: { Authorization: `Bearer ${TONAPI_KEY}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data.seqno != null) return Number(data.seqno);
      }
    }
    const res = await fetch(
      `${TONCENTER_API}/getWalletInformation?address=${encodeURIComponent(address)}`,
      { headers: TONCENTER_KEY ? { 'X-API-Key': TONCENTER_KEY } : {} }
    );
    if (!res.ok) return 0;
    const data = await res.json() as any;
    return data?.result?.seqno || 0;
  } catch {
    return 0;
  }
}

/**
 * Get seqno for a wallet. Returns max(network_seqno, cached_optimistic_seqno).
 * Caller is expected to increment the cached value after a successful send via
 * `advanceSeqnoCache(address, usedSeqno)`.
 */
async function getSeqno(address: string): Promise<number> {
  const now = Date.now();
  const cached = _seqnoCache.get(address);
  const net = await fetchSeqnoFromNetwork(address);
  if (cached && cached.expiresAt > now) {
    return Math.max(net, cached.seqno);
  }
  return net;
}

/** Mark a seqno as consumed so the next tx within TTL uses seqno+1 even if network hasn't updated yet. */
function advanceSeqnoCache(address: string, usedSeqno: number): void {
  _seqnoCache.set(address, { seqno: usedSeqno + 1, expiresAt: Date.now() + SEQNO_CACHE_TTL });
}

/** Send BOC via TONAPI or TonCenter fallback */
async function sendBoc(boc: string): Promise<{ ok: boolean; hash?: string; error?: string }> {
  try {
    if (TONAPI_KEY) {
      const res = await fetch(`${TONAPI_BASE}/blockchain/message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TONAPI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ boc }),
      });
      if (res.status === 200 || res.status === 201) {
        // TONAPI /blockchain/message returns 200 with empty body on success
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};
        return { ok: true, hash: data?.message_hash || 'sent' };
      }
      const err = await res.text();
      console.warn('[TON] TONAPI sendBoc failed:', res.status, err.slice(0, 200));
    }
    // fallback TonCenter
    const res = await fetch(`${TONCENTER_API}/sendBoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(TONCENTER_KEY ? { 'X-API-Key': TONCENTER_KEY } : {}) },
      body: JSON.stringify({ boc }),
    });
    if (!res.ok) {
      // Toncenter returned a non-2xx status — don't trust the body shape
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch {}
      return { ok: false, error: `Toncenter HTTP ${res.status}: ${detail}` };
    }
    const data = await res.json() as any;
    if (data.ok) return { ok: true, hash: data.result?.hash || 'sent' };
    return { ok: false, error: data.error || 'Unknown error' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ── Send from PLATFORM wallet (V5R1 — agentplatform.ton) ────────────────────

/** Cached: derived address from mnemonic. Verified on first call. */
let _platformDerivedAddress: string | null = null;

/** Verify that MNEMONIC matches PLATFORM_WALLET_ADDRESS. Logs warning if mismatch. */
export async function verifyPlatformWalletConfig(): Promise<{ ok: boolean; derived: string; configured: string }> {
  const mnemonic = process.env.PLATFORM_WALLET_MNEMONIC || '';
  const configured = process.env.PLATFORM_WALLET_ADDRESS || PLATFORM_WALLET_ADDRESS;
  if (!mnemonic) {
    console.warn('[PlatformWallet] ⚠️  PLATFORM_WALLET_MNEMONIC not set');
    return { ok: false, derived: '', configured };
  }
  try {
    const words = mnemonic.trim().split(/\s+/);
    const keyPair = await mnemonicToWalletKey(words);
    const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
    const derived = wallet.address.toString({ urlSafe: true, bounceable: false });
    _platformDerivedAddress = derived;
    const ok = derived === configured;
    if (!ok) {
      console.warn(`[PlatformWallet] ⚠️  MNEMONIC mismatch!\n  configured: ${configured}\n  from mnemonic: ${derived}\n  → Withdrawals will FAIL. Fix PLATFORM_WALLET_MNEMONIC in .env`);
    } else {
      console.log(`[PlatformWallet] ✅ Wallet verified: ${derived}`);
    }
    return { ok, derived, configured };
  } catch (e: any) {
    console.error('[PlatformWallet] Error verifying mnemonic:', e.message);
    return { ok: false, derived: '', configured };
  }
}

export async function sendPlatformTransaction(
  toAddress: string,
  amountTon: number,
  comment?: string
): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  const mnemonic = process.env.PLATFORM_WALLET_MNEMONIC;
  if (!mnemonic) return { ok: false, error: 'PLATFORM_WALLET_MNEMONIC not configured' };

  try {
    const words = mnemonic.trim().split(/\s+/);
    const keyPair = await mnemonicToWalletKey(words);
    const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
    const address = wallet.address.toString({ urlSafe: true, bounceable: false });

    // Warn if signing from wrong wallet (mnemonic ≠ configured address)
    const configured = process.env.PLATFORM_WALLET_ADDRESS || PLATFORM_WALLET_ADDRESS;
    if (address !== configured) {
      console.error(`[PlatformTx] ❌ MNEMONIC derives ${address} but PLATFORM_WALLET_ADDRESS=${configured}. Fix .env!`);
      return { ok: false, error: `Config error: mnemonic → ${address.slice(0,12)}… but wallet is ${configured.slice(0,12)}…` };
    }

    const seqno = await getSeqno(address);
    const timeout = Math.floor(Date.now() / 1000) + 600; // 10 min window
    console.log(`[PlatformTx] Sending ${amountTon} TON → ${toAddress.slice(0,16)}… seqno=${seqno} timeout=${timeout}`);

    // createTransfer returns signed message BODY (not full external message)
    const transferBody = (wallet as any).createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout,
      messages: [
        internal({
          to: toAddress,
          value: BigInt(Math.floor(amountTon * 1e9)),
          body: comment || '',
          bounce: false,
        }),
      ],
    });

    // Wrap body in external message cell — required for broadcasting
    const walletAddr = Address.parse(address);
    const extCell = beginCell()
      .store(storeMessage(external({ to: walletAddr, body: transferBody })))
      .endCell();
    const boc = extCell.toBoc().toString('base64');
    const result = await sendBoc(boc);
    if (result.ok) {
      console.log(`[PlatformTx] ✅ Sent! hash=${result.hash}`);
      return { ok: true, txHash: result.hash };
    }
    console.error(`[PlatformTx] sendBoc failed: ${result.error}`);
    return { ok: false, error: result.error };
  } catch (e: any) {
    console.error('[PlatformTx] Send error:', e);
    return { ok: false, error: e.message || String(e) };
  }
}

// ── Send from AGENT wallet (V4R2) ───────────────────────────────────────────

export async function sendAgentTransaction(
  agentWallet: AgentWallet,
  toAddress: string,
  amountTon: number,
  message?: string
): Promise<any> {
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: agentWallet.publicKey });
  const seqno = await getSeqno(agentWallet.address);

  const transferBody = wallet.createTransfer({
    seqno,
    secretKey: agentWallet.secretKey,
    messages: [
      internal({
        to: toAddress,
        value: BigInt(Math.floor(amountTon * 1e9)),
        body: message || '',
        bounce: false,
      }),
    ],
  });

  // Wrap body in external message cell — required for broadcasting
  const walletAddr = Address.parse(agentWallet.address);
  const extCell = beginCell()
    .store(storeMessage(external({ to: walletAddr, body: transferBody })))
    .endCell();
  const boc = extCell.toBoc().toString('base64');
  const result = await sendBoc(boc);
  if ((result as any)?.ok) advanceSeqnoCache(agentWallet.address, seqno);
  return result;
}

/**
 * Known-safe destination contracts. Transactions to these addresses skip the
 * "unknown destination" warning log.
 * Keep lowercase for case-insensitive comparison.
 */
const KNOWN_SAFE_CONTRACTS = new Set<string>([
  // STON.fi routers
  'eqb3ncyboxg4trbdzsbqfnjcqskbfa-aneee3sgkaetyy_yxk',  // router v1
  'eqbimctyhqfdjs8kgkl-ruvevwbavobmc_xnqfarlt_1scvx',   // router v2.1
  // DeDust factory & native vault
  'eqbfbvpnsa9jxkmkhwsbc-hj3y__7vvlvrzlrv8h_3stjypdm',
  // pTON masters (wrapped TON for DEXes)
  'eqcm3b9ni2e_zdxcrvrepysxbrhcjqrzapjqpvorwopwjn9r',
  // Tonstakers (tsTON pool)
  'eqcbjmkc-acxhp7uxnczzxsvogdkxvsv7-2npoprwmgsp4z0',
  // Fragment / Telegram Gifts contracts
  'eqdw2akiv40iyglh_dcmqw-d3_wnv7ie_niadh_xeo9ekhcp',
]);

/** Scam / sanctioned contracts — block outright, do not sign. */
const BLACKLIST_CONTRACTS = new Set<string>([
  // populate from incidents — keep empty until an address is verified malicious
]);

function normalizeForCompare(addr: string): string {
  try {
    const { Address } = require('@ton/core');
    return Address.parse(addr).toString({ urlSafe: true, bounceable: false }).toLowerCase();
  } catch {
    return addr.toLowerCase();
  }
}

/** Send a transfer with a pre-built Cell payload (e.g. SwiftGifts tx_payload) */
export async function sendAgentTransactionWithCell(
  agentWallet: AgentWallet,
  toAddress: string,
  amountTon: number,
  payloadBase64: string
): Promise<any> {
  const { Cell } = await import('@ton/core');

  // ── Destination guard ──
  let normalized: string;
  try {
    const { Address } = await import('@ton/core');
    normalized = Address.parse(toAddress).toString({ urlSafe: true, bounceable: false });
  } catch {
    return { ok: false, error: `Invalid destination address "${String(toAddress).slice(0, 20)}..."` };
  }
  const cmp = normalized.toLowerCase();
  if (BLACKLIST_CONTRACTS.has(cmp)) {
    console.error(`[TX-GUARD] BLOCKED blacklisted destination ${normalized} amount=${amountTon}`);
    return { ok: false, error: 'Destination is on the scam blacklist — transaction blocked.' };
  }
  if (!KNOWN_SAFE_CONTRACTS.has(cmp)) {
    // Not malicious, just not on our safe list. Log for review; daily spend cap upstream limits exposure.
    console.warn(`[TX-GUARD] Unknown destination ${normalized} amount=${amountTon} payload=${payloadBase64.slice(0, 40)}...`);
  }

  // Sanity on amount
  if (!Number.isFinite(amountTon) || amountTon <= 0) {
    return { ok: false, error: `Invalid amount ${amountTon}` };
  }
  if (amountTon > 100) {
    console.error(`[TX-GUARD] Large tx amount=${amountTon} to=${normalized} — requires manual verification`);
    return { ok: false, error: `Amount ${amountTon} TON exceeds per-transaction hard cap (100 TON). Split into multiple transactions or raise cap explicitly.` };
  }

  let bodyCell;
  try {
    bodyCell = Cell.fromBase64(payloadBase64);
  } catch {
    return { ok: false, error: 'Invalid tx_payload: not a valid base64 Cell BOC' };
  }
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: agentWallet.publicKey });
  const seqno = await getSeqno(agentWallet.address);

  const transferBody = wallet.createTransfer({
    seqno,
    secretKey: agentWallet.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: toAddress,
        value: BigInt(Math.floor(amountTon * 1e9)),
        body: bodyCell,
        bounce: true,
      }),
    ],
  });

  // Wrap body in external message cell — required for broadcasting
  const walletAddr = Address.parse(agentWallet.address);
  const extCell = beginCell()
    .store(storeMessage(external({ to: walletAddr, body: transferBody })))
    .endCell();
  const boc = extCell.toBoc().toString('base64');
  const result = await sendBoc(boc);
  if ((result as any)?.ok) advanceSeqnoCache(agentWallet.address, seqno);
  return result;
}

// ── Legacy helper (used in some places) ──────────────────────────────────────

export async function getWalletInfo(address: string): Promise<any> {
  try {
    const seqno = await getSeqno(address);
    const balance = await getWalletBalance(address);
    return { result: { seqno, balance } };
  } catch {
    return null;
  }
}

// ── TonConnect UI session management ─────────────────────────────────────────

export function createUserSession(userId: string, manifestUrl: string): TonConnect {
  const storage = {
    setItem:    async (key: string, value: string) => { sessions.set(`${userId}:${key}`, { value, createdAt: Date.now() }); },
    getItem:    async (key: string) => sessions.get(`${userId}:${key}`)?.value || null,
    removeItem: async (key: string) => { sessions.delete(`${userId}:${key}`); },
  };
  return new TonConnect({ manifestUrl, storage });
}

export async function generateConnectionQR(connector: TonConnect): Promise<string> {
  const wallets = await connector.getWallets();
  const tonkeeper = wallets.find((w: any) => w.name.toLowerCase().includes('tonkeeper'));
  if (!tonkeeper) throw new Error('Tonkeeper not found');
  return connector.connect({
    universalLink: (tonkeeper as any).universalLink,
    bridgeUrl:     (tonkeeper as any).bridgeUrl,
  });
}

export function onWalletConnect(
  connector: TonConnect,
  callback: (wallet: { address: string; provider: string } | null) => void
) {
  connector.onStatusChange((wallet: any) => {
    if (wallet) callback({ address: wallet.account.address, provider: wallet.device.appName });
    else callback(null);
  });
}
