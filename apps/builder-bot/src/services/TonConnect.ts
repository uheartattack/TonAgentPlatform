import { TonConnect } from '@tonconnect/sdk';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { internal } from '@ton/core';
import QRCode from 'qrcode';
import fetch from 'node-fetch';

const TON_CENTER_API = 'https://toncenter.com/api/v2';
const TON_CENTER_KEY = process.env.TONCENTER_API_KEY || '';

const sessions = new Map<string, any>();

export interface AgentWallet {
  address: string;
  mnemonic: string;
  publicKey: Buffer;
  secretKey: Buffer;
}

export async function generateAgentWallet(): Promise<AgentWallet> {
  const mnemonic = await mnemonicNew(24);
  const keyPair = await mnemonicToWalletKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  return {
    address: wallet.address.toString(),
    mnemonic: mnemonic.join(' '),
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

export async function getWalletBalance(address: string): Promise<number> {
  try {
    const url = `${TON_CENTER_API}/getAddressBalance?address=${encodeURIComponent(address)}&api_key=${TON_CENTER_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.ok && data.result) return parseInt(data.result) / 1e9;
    return 0;
  } catch (e) {
    console.error('TonCenter error:', e);
    return 0;
  }
}

export async function getWalletInfo(address: string) {
  try {
    const url = `${TON_CENTER_API}/getWalletInformation?address=${encodeURIComponent(address)}&api_key=${TON_CENTER_KEY}`;
    const res = await fetch(url);
    return await res.json() as any;
  } catch (e) {
    return null;
  }
}

export function createUserSession(userId: string, manifestUrl: string): TonConnect {
  const storage = {
    setItem: async (key: string, value: string) => { sessions.set(`${userId}:${key}`, value); },
    getItem: async (key: string) => sessions.get(`${userId}:${key}`) || null,
    removeItem: async (key: string) => { sessions.delete(`${userId}:${key}`); }
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
  
  const universalLink = connector.connect({
    universalLink: (tonkeeper as any).universalLink,
    bridgeUrl: (tonkeeper as any).bridgeUrl
  });
  
  return universalLink;
}

export async function sendAgentTransaction(agentWallet: AgentWallet, toAddress: string, amountTon: number, message?: string) {
  try {
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: agentWallet.publicKey });
    const walletInfo = await getWalletInfo(agentWallet.address);
    const seqno = walletInfo?.result?.seqno || 0;
    
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: agentWallet.secretKey,
      messages: [internal({ to: toAddress, value: BigInt(Math.floor(amountTon * 1e9)), body: message || '' })]
    });
    
    const boc = transfer.toBoc().toString('base64');
    const url = `${TON_CENTER_API}/sendBoc?api_key=${TON_CENTER_KEY}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boc }) });
    return await res.json() as any;
  } catch (e) {
    console.error('Send error:', e);
    throw e;
  }
}

export function onWalletConnect(connector: TonConnect, callback: (wallet: { address: string; provider: string } | null) => void) {
  connector.onStatusChange((wallet: any) => {
    if (wallet) callback({ address: wallet.account.address, provider: wallet.device.appName });
    else callback(null);
  });
}