/**
 * Tonstakers Integration — liquid staking TON → tsTON
 * Direct contract interaction (no TonConnect needed for server)
 */

import { TonClient } from '@ton/ton';
import { Address, toNano, fromNano, internal, beginCell } from '@ton/core';
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

const TONAPI_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';
const TONSTAKERS_POOL = Address.parse('EQCkWxfyhAkim3g2DjKQQg8T5P4g-Q1-K_jErGcDJZ4i-vqR'); // Tonstakers pool
const TSTON_MASTER = 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav'; // tsTON jetton master

interface StakingInfo {
  apy: number;
  tvl: string;
  exchangeRate: string;
  minStake: string;
}

interface StakeResult {
  ok: boolean;
  amount?: string;
  txHash?: string;
  error?: string;
}

/**
 * Get current staking info (APY, TVL, exchange rate)
 */
export async function getStakingInfo(): Promise<StakingInfo> {
  try {
    // Get from Tonstakers API
    const res = await fetch('https://api.tonstakers.com/v1/stats').then(r => r.json()) as any;
    return {
      apy: res.apy || 4.5,
      tvl: res.tvl || '70M+ TON',
      exchangeRate: res.exchangeRate || '1.05',
      minStake: '1',
    };
  } catch {
    return { apy: 4.5, tvl: '70M+ TON', exchangeRate: '1.05', minStake: '1' };
  }
}

/**
 * Get user's staked balance (tsTON)
 */
export async function getStakedBalance(walletAddress: string): Promise<{ tston: string; tonValue: string }> {
  try {
    const tonClient = new TonClient({ endpoint: TONAPI_ENDPOINT });
    const addr = Address.parse(walletAddress);

    // Check tsTON jetton balance via TonAPI
    const apiKey = process.env.TONAPI_KEY || '';
    const res = await fetch(
      `https://tonapi.io/v2/accounts/${addr.toRawString()}/jettons/${TSTON_MASTER}`,
      { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} }
    ).then(r => r.json()) as any;

    const balance = res.balance || '0';
    const tston = (parseInt(balance) / 1e9).toFixed(4);

    // Get exchange rate
    const info = await getStakingInfo();
    const tonValue = (parseFloat(tston) * parseFloat(info.exchangeRate)).toFixed(4);

    return { tston, tonValue };
  } catch (e: any) {
    return { tston: '0', tonValue: '0' };
  }
}

/**
 * Stake TON → receive tsTON
 */
export async function stakeTon(mnemonic: string, amountTon: string): Promise<StakeResult> {
  try {
    const amount = parseFloat(amountTon);
    if (amount < 1) return { ok: false, error: 'Minimum stake is 1 TON' };

    const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const tonClient = new TonClient({ endpoint: TONAPI_ENDPOINT });
    const walletContract = tonClient.open(wallet);
    const seqno = await walletContract.getSeqno();

    // Tonstakers deposit: send TON to pool contract with specific body
    // Op code for deposit: 0x47d54391
    const body = beginCell()
      .storeUint(0x47d54391, 32) // op: deposit
      .storeUint(0, 64) // query_id
      .endCell();

    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: TONSTAKERS_POOL,
        value: toNano(amountTon),
        body,
      })],
    });

    return { ok: true, amount: amountTon };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Unstake tsTON → receive TON (standard, waits for round)
 */
export async function unstakeTon(mnemonic: string, amountTsTon: string): Promise<StakeResult> {
  try {
    const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const tonClient = new TonClient({ endpoint: TONAPI_ENDPOINT });
    const walletContract = tonClient.open(wallet);
    const seqno = await walletContract.getSeqno();

    // Unstake: burn tsTON jetton via transfer to pool
    const tstonAmount = BigInt(Math.floor(parseFloat(amountTsTon) * 1e9));

    // Standard jetton burn via transfer to pool
    const body = beginCell()
      .storeUint(0xf8a7ea5, 32) // op: jetton transfer
      .storeUint(0, 64) // query_id
      .storeCoins(tstonAmount) // amount
      .storeAddress(TONSTAKERS_POOL) // destination
      .storeAddress(wallet.address) // response_destination
      .storeBit(false) // custom_payload
      .storeCoins(toNano('0.05')) // forward_amount
      .storeBit(false) // forward_payload
      .endCell();

    // Find tsTON jetton wallet address
    const apiKey = process.env.TONAPI_KEY || '';
    const jettonRes = await fetch(
      `https://tonapi.io/v2/accounts/${wallet.address.toRawString()}/jettons/${TSTON_MASTER}`,
      { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} }
    ).then(r => r.json()) as any;

    const jettonWallet = jettonRes.wallet_address?.address;
    if (!jettonWallet) return { ok: false, error: 'No tsTON balance found' };

    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: Address.parse(jettonWallet),
        value: toNano('0.15'), // gas
        body,
      })],
    });

    return { ok: true, amount: amountTsTon };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
