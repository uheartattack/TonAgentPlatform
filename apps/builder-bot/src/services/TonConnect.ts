import { TonConnect } from '@tonconnect/sdk';
import { mnemonicNew, mnemonicToWalletKey, sign } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WalletContractV5R1 } = require('@ton/ton') as { WalletContractV5R1: any };
import { internal, beginCell, Address, SendMode } from '@ton/core';
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

const sessions = new Map<string, any>();

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
  return {
    address: wallet.address.toString({ urlSafe: true, bounceable: false }),
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
  const words = mnemonicStr.trim().split(/\s+/);
  const keyPair = await mnemonicToWalletKey(words);
  const version = preferVersion || 'v4r2';
  const wallet =
    version === 'v5r1'
      ? WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey })
      : WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  return {
    address: wallet.address.toString({ urlSafe: true, bounceable: false }),
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
      const data = await res.json() as any;
      if (data.balance != null) return Number(data.balance) / 1e9;
    }
    // fallback TonCenter
    const res = await fetch(
      `${TONCENTER_API}/getAddressBalance?address=${encodeURIComponent(address)}&api_key=${TONCENTER_KEY}`
    );
    const data = await res.json() as any;
    if (data.ok && data.result) return parseInt(data.result) / 1e9;
    return 0;
  } catch (e) {
    console.error('[TON] getWalletBalance error:', e);
    return 0;
  }
}

/** Get seqno via TONAPI (supports V5R1) */
async function getSeqno(address: string): Promise<number> {
  try {
    if (TONAPI_KEY) {
      const res = await fetch(`${TONAPI_BASE}/wallet/${encodeURIComponent(address)}/seqno`, {
        headers: { Authorization: `Bearer ${TONAPI_KEY}` },
      });
      const data = await res.json() as any;
      if (data.seqno != null) return Number(data.seqno);
    }
    // fallback TonCenter v2
    const res = await fetch(
      `${TONCENTER_API}/getWalletInformation?address=${encodeURIComponent(address)}&api_key=${TONCENTER_KEY}`
    );
    const data = await res.json() as any;
    return data?.result?.seqno || 0;
  } catch {
    return 0;
  }
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
        const data = await res.json() as any;
        return { ok: true, hash: data?.message_hash || 'sent' };
      }
      const err = await res.text();
      console.warn('[TON] TONAPI sendBoc failed, trying TonCenter:', err);
    }
    // fallback TonCenter
    const res = await fetch(`${TONCENTER_API}/sendBoc?api_key=${TONCENTER_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boc }),
    });
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
    console.log(`[PlatformTx] Sending ${amountTon} TON → ${toAddress.slice(0,16)}… seqno=${seqno}`);

    const transfer = (wallet as any).createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: toAddress,
          value: BigInt(Math.floor(amountTon * 1e9)),
          body: comment || '',
          bounce: false,
        }),
      ],
    });

    const boc = transfer.toBoc().toString('base64');
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

  const transfer = wallet.createTransfer({
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

  const boc = transfer.toBoc().toString('base64');
  return sendBoc(boc);
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
    setItem:    async (key: string, value: string) => { sessions.set(`${userId}:${key}`, value); },
    getItem:    async (key: string) => sessions.get(`${userId}:${key}`) || null,
    removeItem: async (key: string) => { sessions.delete(`${userId}:${key}`); },
  };
  return new TonConnect({ manifestUrl, storage });
}

export function getUserSession(userId: string): any {
  return sessions.get(`connector:${userId}`) || null;
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
