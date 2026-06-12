/**
 * ═══════════════════════════════════════════════════════════════════════════
 * JETTON MINTER SERVICE
 *
 * Lets agents deploy + mint TEP-74 compliant jettons on TON (mainnet/testnet).
 * Each agent owns its own jetton: the agent's wallet becomes the jetton admin,
 * so only the agent can mint more or change supply.
 *
 * Built on @ton-community/assets-sdk — canonical audited TEP-74 contracts
 * (jetton-minter + jetton-wallet) maintained by TON Community. We use the
 * high-level AssetsSDK.create() API + onchain content so no IPFS hosting
 * is needed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Address, toNano } from '@ton/core';
import { mnemonicToWalletKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';

export type Network = 'mainnet' | 'testnet';

// Toncenter fallback — used when orbs ton-access has no healthy v4 nodes
// (observed 2026-05-26: testnet-v4 80h stale across the entire pool).
// TonClient (v2) talks to toncenter REST and implements the same TonClientApi
// surface (.open + .provider) the assets-sdk expects, so it's a drop-in.
const TONCENTER_ENDPOINT: Record<Network, string> = {
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
};
function createToncenterApi(network: Network, apiKey?: string): TonClient {
  return new TonClient({
    endpoint: TONCENTER_ENDPOINT[network],
    apiKey: apiKey || process.env.TONCENTER_API_KEY,
  });
}

export interface JettonMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  decimals?: number;
}

export interface DeployJettonParams {
  mnemonic: string;
  metadata: JettonMetadata;
  network: Network;
  premintAmount?: bigint;       // optional initial mint to admin on deploy
  tonapiKey?: string;
}

export interface DeployJettonResult {
  ok: true;
  jettonMaster: string;
  network: Network;
}

async function buildSdk(mnemonic: string, network: Network) {
  // Lazy import — keeps cold start fast for agents that never mint
  const sdk = await import('@ton-community/assets-sdk');
  const { AssetsSDK, createApi, NoopStorage } = sdk;

  const keys = await mnemonicToWalletKey(mnemonic.split(' '));

  // Pick transport: orbs (v4, default) first, toncenter (v2) on failure.
  // The assets-sdk's TonClientApi interface only requires .open() and
  // .provider() — both TonClient4 (orbs) and TonClient (toncenter) implement
  // them identically.
  let api: any;
  let usingFallback = false;
  try {
    api = await createApi(network);
  } catch (e: any) {
    if (/no healthy nodes/i.test(e?.message || '')) {
      api = createToncenterApi(network);
      usingFallback = true;
    } else {
      throw e;
    }
  }

  // SDK's createSender() hardcodes 'highload-v2' as the only wallet type.
  // Our agentic wallets are V4r2 (TEP-43). Build the Sender manually:
  //   1. construct WalletContractV4 from the keypair
  //   2. open it on our chosen client
  //   3. call .sender(secretKey) — same Sender interface SDK expects
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const sender = api.open(wallet).sender(keys.secretKey);

  const instance = AssetsSDK.create({
    api,
    sender,
    storage: new NoopStorage(),    // onchain content only — no external hosting
  });
  return { sdk, instance, keys, sender, api, wallet, usingFallback };
}

/** Deploy a fresh jetton-minter contract owned by the agent's wallet. */
export async function deployJetton(p: DeployJettonParams): Promise<DeployJettonResult | { ok: false; error: string }> {
  try {
    const { instance, wallet } = await buildSdk(p.mnemonic, p.network);
    const minter = await instance.deployJetton(
      {
        name: p.metadata.name,
        symbol: p.metadata.symbol,
        decimals: p.metadata.decimals ?? 9,
        description: p.metadata.description,
        image: p.metadata.image,
      },
      {
        adminAddress: wallet.address,      // V4 sender doesn't expose .address — pass explicitly
        onchainContent: true,
        premintAmount: p.premintAmount,    // mint N tokens to admin on first tx if set
        value: toNano('0.15'),
      },
    );

    return {
      ok: true,
      jettonMaster: minter.address.toString({
        urlSafe: true,
        bounceable: true,
        testOnly: p.network === 'testnet',
      }),
      network: p.network,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export interface MintJettonParams {
  mnemonic: string;
  jettonMaster: string;
  to: string;
  amount: string;
  network: Network;
  tonapiKey?: string;
}

export async function mintJetton(p: MintJettonParams): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!/^\d+$/.test(p.amount) || p.amount === '0') {
      return { ok: false, error: `Invalid amount "${p.amount}" — must be positive integer in jetton nano-units` };
    }
    const amountBig = BigInt(p.amount);
    if (amountBig > BigInt('9223372036854775807')) {
      return { ok: false, error: 'Amount exceeds jetton Coins limit (2^63-1)' };
    }

    const { instance, sender } = await buildSdk(p.mnemonic, p.network);
    const minter = instance.openJetton(Address.parse(p.jettonMaster));
    await minter.sendMint(sender, Address.parse(p.to), amountBig);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export interface ChangeAdminParams {
  mnemonic: string;
  jettonMaster: string;
  newAdmin: string;
  network: Network;
  tonapiKey?: string;
}

export async function changeJettonAdmin(p: ChangeAdminParams): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { instance, sender } = await buildSdk(p.mnemonic, p.network);
    const minter = instance.openJetton(Address.parse(p.jettonMaster));
    await minter.sendChangeAdmin(sender, Address.parse(p.newAdmin));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
