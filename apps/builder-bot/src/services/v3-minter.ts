/**
 * v3-minter.ts — серверный минтер v3.0 (деплой коллекции + минт агент-NFT).
 *
 * ⚠️ Сид ТОЛЬКО из env `V3_MINTER_MNEMONIC` (кладёт владелец, я его не вижу).
 *    Без сида сервис ИНЕРТЕН. Деплой/минт — только по явному owner-gated вызову,
 *    НЕ автоматически. Первый прогон — на testnet (V3_TON_ENDPOINT=testnet).
 *
 * Деньги: роялти 2.5% → TAP_TREASURY (agentplatform.ton). Владелец/минтер коллекции
 *    = кошелёк, выведенный из сида (hot-минтер).
 * Код контрактов: JSON-артефакты из V3_CONTRACTS_DIR (scp из contracts/build).
 */
import fs from 'fs';
import path from 'path';
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Cell, beginCell, contractAddress, Address, toNano } from '@ton/core';

const TREASURY = Address.parse(process.env.TAP_TREASURY || 'EQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y6qk');
const ENDPOINT = process.env.V3_TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
const CONTRACTS_DIR = process.env.V3_CONTRACTS_DIR || path.join(__dirname, '..', '..', 'v3-contracts');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// ретрай на 429 (анонимный mainnet-toncenter режет burst); экспон. бэкофф
async function withRetry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      last = e; const msg = String(e?.message || '');
      if (msg.includes('429') || /rate ?limit/i.test(msg)) { await sleep(1500 * (i + 1)); continue; }
      throw e;
    }
  }
  throw last;
}

let _ready = false;
let _client: TonClient | null = null;
let _wallet: WalletContractV4 | null = null;
let _key: { publicKey: Buffer; secretKey: Buffer } | null = null;
let _collectionAddr: Address | null = null;

export function isMinterConfigured(): boolean {
  return !!process.env.V3_MINTER_MNEMONIC;
}

function loadCode(name: string): Cell {
  const j = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, name + '.compiled.json'), 'utf8'));
  return Cell.fromBoc(Buffer.from(j.hex, 'hex'))[0];
}

const offchain = (s: string) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();

function collectionInit(minter: Address): { code: Cell; data: Cell } {
  const content = beginCell()
    .storeRef(offchain('https://tonagentplatform.com/agents/collection.json'))
    .storeRef(offchain('https://tonagentplatform.com/agents/'))
    .endCell();
  const royalty = beginCell().storeUint(250, 16).storeUint(10000, 16).storeAddress(TREASURY).endCell();
  const data = beginCell()
    .storeAddress(minter).storeUint(0, 64)
    .storeRef(content).storeRef(loadCode('AgentItem')).storeRef(royalty)
    .endCell();
  return { code: loadCode('AgentCollection'), data };
}

/** Инициализация из env-сида. Без сида — no-op (инертно). */
export async function initMinter(): Promise<{ ready: boolean; minter?: string; collection?: string }> {
  if (!isMinterConfigured()) return { ready: false };
  const key = await mnemonicToWalletKey(process.env.V3_MINTER_MNEMONIC!.trim().split(/\s+/));
  _key = key;
  _wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  // V3_TONCENTER_API_KEY (опц.) приоритетнее; иначе на testnet берём общий TONCENTER_API_KEY,
  // на mainnet идём анонимно (общий ключ testnet-only → 403 на mainnet).
  const apiKey = process.env.V3_TONCENTER_API_KEY || (ENDPOINT.includes('testnet') ? process.env.TONCENTER_API_KEY : undefined);
  _client = new TonClient({ endpoint: ENDPOINT, apiKey });
  _collectionAddr = contractAddress(0, collectionInit(_wallet.address));
  _ready = true;
  return { ready: true, minter: _wallet.address.toString({ bounceable: false }), collection: _collectionAddr.toString({ bounceable: false }) };
}

export function getCollectionAddress(): Address | null { return _collectionAddr; }

export async function getMinterInfo() {
  if (!_ready || !_client || !_wallet || !_collectionAddr) return { ready: false };
  let deployed = false; let nextIndex: string | null = null;
  try {
    const cd = await withRetry(() => _client!.runMethod(_collectionAddr!, 'get_collection_data'));
    nextIndex = cd.stack.readBigNumber().toString();
    deployed = true;
  } catch { /* not deployed yet */ }
  await sleep(1300);
  const bal = await withRetry(() => _client!.getBalance(_wallet!.address));
  return {
    ready: true,
    minter: _wallet.address.toString({ bounceable: false }),
    collection: _collectionAddr.toString({ bounceable: false }),
    minterBalanceGram: (Number(bal) / 1e9).toFixed(4),
    collectionDeployed: deployed,
    nextIndex,
    network: ENDPOINT.includes('testnet') ? 'testnet' : 'mainnet',
  };
}

/** Деплой коллекции (идемпотентно: если уже задеплоена — пропускаем). */
export async function deployCollection(): Promise<{ ok: boolean; collection: string; skipped?: boolean }> {
  if (!_ready || !_client || !_wallet || !_key || !_collectionAddr) throw new Error('minter not configured');
  const info = await getMinterInfo();
  if ((info as any).collectionDeployed) return { ok: true, collection: _collectionAddr.toString({ bounceable: false }), skipped: true };
  const w = _client.open(_wallet);
  await sleep(1300);
  const seqno = await withRetry(() => w.getSeqno());
  const init = collectionInit(_wallet.address);
  await sleep(1300);
  await withRetry(() => w.sendTransfer({
    seqno, secretKey: _key!.secretKey,
    messages: [internal({ to: _collectionAddr!, value: toNano('0.1'), init, body: beginCell().endCell(), bounce: false })],
  }));
  return { ok: true, collection: _collectionAddr.toString({ bounceable: false }) };
}

/** Минт агент-NFT владельцу ownerWallet. */
export async function mintAgent(ownerWallet: string, tapAgentId: number, capsHashHex?: string): Promise<{ ok: boolean; seqno: number }> {
  if (!_ready || !_client || !_wallet || !_key || !_collectionAddr) throw new Error('minter not configured');
  const owner = Address.parse(ownerWallet);
  const caps = BigInt(capsHashHex || '0x0');
  const agentData = beginCell().storeUint(caps, 256).storeRef(beginCell().endCell()).storeUint(tapAgentId, 64).endCell();
  const itemPayload = beginCell().storeAddress(owner)
    .storeRef(offchain('https://tonagentplatform.com/agents/' + tapAgentId + '.json'))
    .storeRef(agentData).endCell();
  const mintBody = beginCell().storeUint(1, 32).storeUint(0, 64).storeUint(0, 64).storeCoins(toNano('0.05')).storeRef(itemPayload).endCell();
  const w = _client.open(_wallet);
  await sleep(1300);
  const seqno = await withRetry(() => w.getSeqno());
  await sleep(1300);
  await withRetry(() => w.sendTransfer({ seqno, secretKey: _key!.secretKey, messages: [internal({ to: _collectionAddr!, value: toNano('0.1'), body: mintBody, bounce: true })] }));
  return { ok: true, seqno };
}
