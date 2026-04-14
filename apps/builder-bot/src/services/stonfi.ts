/**
 * STON.fi DEX Integration — swap TON ↔ jettons
 * Uses @ston-fi/sdk + @ston-fi/api
 */

import { StonApiClient } from '@ston-fi/api';
import { dexFactory, Client as StonClient } from '@ston-fi/sdk';
import { TonClient } from '@ton/ton';
import { Address, internal, beginCell, toNano } from '@ton/core';
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

function getToncenterEndpoint(): string {
  const apiKey = process.env.TONCENTER_API_KEY || '';
  const base = 'https://toncenter.com/api/v2/jsonRPC';
  return apiKey ? `${base}?api_key=${apiKey}` : base;
}
const TON_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'; // native TON
const USDC_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // USDC on TON
const USDT_ADDRESS = 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA'; // USDT on TON

const stonApi = new StonApiClient();

interface SwapQuote {
  offerAmount: string;
  minAskAmount: string;
  expectedAmount: string;
  priceImpact: string;
  routerAddress: string;
  ptonMasterAddress: string;
  fromSymbol?: string;
  toSymbol?: string;
  fromDecimals?: number;
  toDecimals?: number;
}

interface SwapResult {
  ok: boolean;
  txHash?: string;
  error?: string;
  quote?: SwapQuote;
}

/**
 * Get popular assets on STON.fi
 */
export async function getAssets(): Promise<any[]> {
  try {
    const assets = await stonApi.getAssets();
    // Return top assets by TVL/popularity
    return assets
      .filter((a: any) => a.dexPriceUsd && parseFloat(a.dexPriceUsd) > 0)
      .slice(0, 30)
      .map((a: any) => ({
        address: a.contractAddress,
        symbol: a.symbol,
        name: a.displayName || a.symbol,
        decimals: a.decimals,
        price: parseFloat(a.dexPriceUsd || '0'),
        kind: a.kind,
      }));
  } catch (e: any) {
    console.error('[STON.fi] getAssets error:', e.message);
    return [];
  }
}

/**
 * Simulate a swap — get quote without executing
 */
export async function simulateSwap(
  fromAddress: string,
  toAddress: string,
  amount: string, // in human-readable units (e.g. "1.5" TON)
  slippage = '0.01',
): Promise<SwapQuote> {
  // Resolve addresses
  const from = fromAddress === 'TON' ? TON_ADDRESS : fromAddress;
  const to = toAddress === 'TON' ? TON_ADDRESS :
    toAddress === 'USDC' ? USDC_ADDRESS :
    toAddress === 'USDT' ? USDT_ADDRESS : toAddress;

  // Get asset info for decimals
  const assets = await stonApi.getAssets();
  const fromAsset = assets.find((a: any) => a.contractAddress === from) || { decimals: 9, symbol: 'TON' };
  const toAsset = assets.find((a: any) => a.contractAddress === to) || { decimals: 6, symbol: '?' };

  const fromDecimals = Math.pow(10, fromAsset.decimals || 9);
  const offerUnits = Math.floor(parseFloat(amount) * fromDecimals).toString();

  const result = await stonApi.simulateSwap({
    offerAddress: from,
    askAddress: to,
    slippageTolerance: slippage,
    offerUnits,
  });

  const toDecimals = Math.pow(10, toAsset.decimals || 6);
  const expectedAmount = (parseInt(result.minAskUnits) / toDecimals).toFixed(toAsset.decimals || 6);

  return {
    offerAmount: amount,
    minAskAmount: result.minAskUnits,
    expectedAmount,
    priceImpact: (result as any).priceImpact || '0',
    routerAddress: (result as any).router?.address || '',
    ptonMasterAddress: (result as any).router?.ptonMasterAddress || '',
    fromSymbol: (fromAsset as any).symbol,
    toSymbol: (toAsset as any).symbol,
    fromDecimals: fromAsset.decimals,
    toDecimals: toAsset.decimals,
  };
}

/**
 * Execute a swap using agent's wallet (mnemonic)
 */
export async function executeSwap(
  mnemonic: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  slippage = '0.01',
): Promise<SwapResult> {
  try {
    // 1. Get quote
    const quote = await simulateSwap(fromAddress, toAddress, amount, slippage);

    // 2. Prepare wallet
    const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const tonClient = new TonClient({ endpoint: getToncenterEndpoint() });
    const walletContract = tonClient.open(wallet);
    const seqno = await walletContract.getSeqno();

    // 3. Build swap transaction via STON.fi SDK
    const stonClient = new StonClient({ endpoint: getToncenterEndpoint() });
    const simulationResult = await stonApi.simulateSwap({
      offerAddress: fromAddress === 'TON' ? TON_ADDRESS : fromAddress,
      askAddress: toAddress === 'TON' ? TON_ADDRESS :
        toAddress === 'USDC' ? USDC_ADDRESS :
        toAddress === 'USDT' ? USDT_ADDRESS : toAddress,
      slippageTolerance: slippage,
      offerUnits: Math.floor(parseFloat(amount) * Math.pow(10, quote.fromDecimals || 9)).toString(),
    });

    const routerInfo = (simulationResult as any).router;
    if (!routerInfo) throw new Error('No router found for this swap pair');

    const dex = dexFactory(routerInfo);
    const router = stonClient.open(dex.Router.create(routerInfo.address));
    const proxyTon = dex.pTON.create(routerInfo.ptonMasterAddress);

    const from = fromAddress === 'TON' ? TON_ADDRESS : fromAddress;
    const to = toAddress === 'TON' ? TON_ADDRESS :
      toAddress === 'USDC' ? USDC_ADDRESS :
      toAddress === 'USDT' ? USDT_ADDRESS : toAddress;

    let swapParams: any;
    const userWalletAddress = wallet.address.toString();

    if (from === TON_ADDRESS) {
      // TON → Jetton
      swapParams = await router.getSwapTonToJettonTxParams({
        userWalletAddress,
        offerAmount: simulationResult.offerUnits,
        minAskAmount: simulationResult.minAskUnits,
        proxyTon,
        askJettonAddress: (simulationResult as any).askAddress || to,
      });
    } else if (to === TON_ADDRESS) {
      // Jetton → TON
      swapParams = await router.getSwapJettonToTonTxParams({
        userWalletAddress,
        offerAmount: simulationResult.offerUnits,
        minAskAmount: simulationResult.minAskUnits,
        proxyTon,
        offerJettonAddress: (simulationResult as any).offerAddress || from,
      });
    } else {
      // Jetton → Jetton
      swapParams = await router.getSwapJettonToJettonTxParams({
        userWalletAddress,
        offerAmount: simulationResult.offerUnits,
        minAskAmount: simulationResult.minAskUnits,
        offerJettonAddress: (simulationResult as any).offerAddress || from,
        askJettonAddress: (simulationResult as any).askAddress || to,
      });
    }

    // 4. Check balance before sending
    const balance = await tonClient.getBalance(wallet.address);
    const requiredNano = BigInt(swapParams.value.toString());
    const gasReserve = BigInt('100000000'); // 0.1 TON for gas
    if (balance < requiredNano + gasReserve) {
      return {
        ok: false,
        error: `Недостаточно TON. Нужно: ${Number(requiredNano + gasReserve) / 1e9} TON, есть: ${Number(balance) / 1e9} TON. Пополни кошелёк: ${wallet.address.toString()}`,
      };
    }

    // 5. Send transaction
    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: swapParams.to,
        value: swapParams.value,
        body: swapParams.body,
      })],
    });

    return {
      ok: true,
      quote,
      txHash: `seqno:${seqno} from ${wallet.address.toString().slice(0, 8)}...`,
    };
  } catch (e: any) {
    const msg = e.message || String(e);
    // Better error messages
    if (msg.includes('seqno')) return { ok: false, error: 'Ошибка seqno кошелька. Попробуй через минуту.' };
    if (msg.includes('router')) return { ok: false, error: 'STON.fi не нашёл пул для этой пары токенов.' };
    if (msg.includes('slippage')) return { ok: false, error: 'Slippage слишком низкий. Попробуй 0.02 или 0.05.' };
    return { ok: false, error: msg };
  }
}

/**
 * Get swap price (simple price check without executing)
 */
export async function getSwapPrice(from: string, to: string, amount = '1'): Promise<string> {
  try {
    const quote = await simulateSwap(from, to, amount);
    return `${amount} ${quote.fromSymbol} ≈ ${quote.expectedAmount} ${quote.toSymbol}`;
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}
