/**
 * ton-proof.ts — TonConnect tonProof (proof-of-ownership) verification.
 *
 * Flow:
 *   1. Client POST /api/tonconnect/payload  → server returns { payload: <hex nonce + ts> }
 *      (signed by server HMAC so we can verify it hasn't been tampered with).
 *   2. Client calls wallet.tonConnect with connectItems: [{ name: 'ton_proof', payload }].
 *   3. Wallet returns a ton_proof object: { timestamp, domain, payload, signature, state_init }.
 *   4. Client POST /api/wallet/link with { address, proof } → server verifies signature
 *      against the wallet's public key (extracted from state_init or fetched from chain).
 *
 * Spec reference (TonConnect ton_proof v2):
 *   message = 0xffff || "ton-connect" || sha256(
 *     "ton-proof-item-v2/" || workchain_LE(4) || addr_hash(32) ||
 *     domain_len_LE(4) || domain_bytes || timestamp_LE(8) || payload_bytes
 *   )
 *   hash = sha256(message)
 *   signature = ed25519(hash, wallet_private_key)
 */

import crypto from 'crypto';
import { Address, Cell, contractAddress } from '@ton/core';

const PROOF_SECRET = (
  process.env.TON_PROOF_SECRET ||
  process.env.ENCRYPTION_KEY ||
  process.env.BOT_TOKEN ||
  'fallback-not-secure-change-me'
).slice(0, 64);

const PAYLOAD_TTL_SEC = 15 * 60;      // payload valid for 15 minutes
const PROOF_TTL_SEC = 15 * 60;        // ton_proof signature valid for 15 minutes

export function issuePayload(): { payload: string; expiresAt: number } {
  const ts = Math.floor(Date.now() / 1000);
  const expiresAt = ts + PAYLOAD_TTL_SEC;
  const nonce = crypto.randomBytes(8).toString('hex');
  const body = `${nonce}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', PROOF_SECRET).update(body).digest('hex').slice(0, 16);
  return { payload: `${body}.${sig}`, expiresAt };
}

function verifyPayloadSignature(payload: string): boolean {
  const parts = payload.split('.');
  if (parts.length !== 3) return false;
  const [nonce, expiresAtStr, sig] = parts;
  const body = `${nonce}.${expiresAtStr}`;
  const expected = crypto.createHmac('sha256', PROOF_SECRET).update(body).digest('hex').slice(0, 16);
  if (sig !== expected) return false;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!expiresAt || expiresAt < Math.floor(Date.now() / 1000)) return false;
  return true;
}

export interface TonProofPayload {
  timestamp: number;
  domain: { lengthBytes: number; value: string };
  signature: string;     // base64
  payload: string;       // the server-issued payload
  stateInit?: string;    // base64 wallet state init (contains pubkey)
  publicKey?: string;    // hex (sometimes provided directly)
}

function extractPubkeyFromStateInit(stateInitB64: string): { pubkeyHex: string; address?: string } | null {
  try {
    const cell = Cell.fromBase64(stateInitB64);
    // StateInit: maybe split_depth, maybe special, maybe code, maybe data, maybe library
    const slice = cell.beginParse();
    // skip split_depth (Maybe Uint5)
    if (slice.loadBit()) slice.loadUint(5);
    // skip special (Maybe TickTock)
    if (slice.loadBit()) slice.loadUint(2);
    // code (Maybe ^Cell)
    const _code = slice.loadBit() ? slice.loadRef() : null;
    // data (Maybe ^Cell) — for wallet contracts data = [seqno, walletId/subWalletId, publicKey, ...]
    const data = slice.loadBit() ? slice.loadRef() : null;
    if (!data) return null;
    const ds = data.beginParse();
    // Wallet v3/v4/v5: seqno(32) + walletId(32) + publicKey(256) ...
    ds.loadUint(32); // seqno
    ds.loadUint(32); // walletId / subWalletId
    const pubkey = ds.loadBuffer(32);
    return { pubkeyHex: pubkey.toString('hex') };
  } catch (e: any) {
    console.warn('[TonProof] state_init parse failed:', e?.message);
    return null;
  }
}

function buildProofMessage(workchain: number, addrHashHex: string, domain: string, timestamp: number, payload: string): Buffer {
  const wcBuf = Buffer.alloc(4);
  wcBuf.writeInt32LE(workchain, 0);
  const addrBuf = Buffer.from(addrHashHex, 'hex');
  const domainBuf = Buffer.from(domain, 'utf8');
  const dlBuf = Buffer.alloc(4);
  dlBuf.writeUInt32LE(domainBuf.length, 0);
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigInt64LE(BigInt(timestamp), 0);
  const payloadBuf = Buffer.from(payload, 'utf8');
  const inner = Buffer.concat([
    Buffer.from('ton-proof-item-v2/', 'utf8'),
    wcBuf,
    addrBuf,
    dlBuf,
    domainBuf,
    tsBuf,
    payloadBuf,
  ]);
  const innerHash = crypto.createHash('sha256').update(inner).digest();
  const outer = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from('ton-connect', 'utf8'),
    innerHash,
  ]);
  return crypto.createHash('sha256').update(outer).digest();
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  address?: string;
}

export async function verifyTonProof(addressStr: string, proof: TonProofPayload): Promise<VerifyResult> {
  if (!proof || !proof.payload || !proof.signature || !proof.timestamp || !proof.domain) {
    return { ok: false, error: 'malformed proof' };
  }
  if (!verifyPayloadSignature(proof.payload)) {
    return { ok: false, error: 'invalid or expired payload' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(proof.timestamp)) > PROOF_TTL_SEC) {
    return { ok: false, error: 'proof timestamp out of window' };
  }
  let parsedAddr: Address;
  try { parsedAddr = Address.parse(addressStr); } catch { return { ok: false, error: 'invalid address' }; }

  // Derive wallet pubkey from state_init or proof.publicKey
  let pubkeyHex: string | null = null;
  if (proof.stateInit) {
    const got = extractPubkeyFromStateInit(proof.stateInit);
    if (got?.pubkeyHex) pubkeyHex = got.pubkeyHex;
  }
  if (!pubkeyHex && proof.publicKey) {
    pubkeyHex = proof.publicKey.replace(/^0x/, '').toLowerCase();
  }
  if (!pubkeyHex || pubkeyHex.length !== 64) {
    return { ok: false, error: 'cannot derive wallet pubkey (need state_init or publicKey in proof)' };
  }

  // Build message and verify ed25519
  const addrHashHex = parsedAddr.hash.toString('hex');
  const msgHash = buildProofMessage(parsedAddr.workChain, addrHashHex, proof.domain.value, Number(proof.timestamp), proof.payload);
  const sigBuf = Buffer.from(proof.signature, 'base64');
  if (sigBuf.length !== 64) return { ok: false, error: 'invalid signature length' };

  // Use Node's crypto.verify for ed25519
  try {
    // Build SPKI DER for ed25519 from raw 32-byte pubkey
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex'); // SEQUENCE { SEQUENCE { OID 1.3.101.112 } BITSTRING ... }
    const pubBuf = Buffer.from(pubkeyHex, 'hex');
    const der = Buffer.concat([spkiPrefix, pubBuf]);
    const keyObj = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    const ok = crypto.verify(null, msgHash, keyObj, sigBuf);
    if (!ok) return { ok: false, error: 'signature mismatch' };
  } catch (e: any) {
    return { ok: false, error: `verify failed: ${e?.message}` };
  }

  // Optionally cross-check that stateInit hashes to the claimed address (prevents pubkey swap)
  if (proof.stateInit) {
    try {
      const initCell = Cell.fromBase64(proof.stateInit);
      // Parse code+data from stateInit to compute address
      const sl = initCell.beginParse();
      if (sl.loadBit()) sl.loadUint(5);
      if (sl.loadBit()) sl.loadUint(2);
      const code = sl.loadBit() ? sl.loadRef() : null;
      const data = sl.loadBit() ? sl.loadRef() : null;
      if (code && data) {
        const derived = contractAddress(parsedAddr.workChain, { code, data });
        if (!derived.equals(parsedAddr)) {
          return { ok: false, error: 'stateInit does not match address' };
        }
      }
    } catch (e: any) {
      console.warn('[TonProof] stateInit address check skipped:', e?.message);
    }
  }

  return { ok: true, address: parsedAddr.toString({ urlSafe: true, bounceable: false }) };
}
