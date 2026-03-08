/**
 * getgems-trader.ts — торговля NFT через официальный GetGems Public API
 *
 * API: https://api.getgems.io/public-api/docs
 *
 * Архитектура:
 * - Данные:   GET  /v1/collection/stats/{addr}         → floorPrice
 * - Листинги: GET  /v1/nfts/on-sale/{addr}             → items + sale.version
 * - Покупка:  POST /v1/nfts/buy-fix-price/{nftAddr}    → готовая транзакция
 * - Продажа:  POST /v1/nfts/put-on-sale-fix-price/{nftAddr}
 *
 * Транзакции подписываются через WalletContractV4 и отправляются напрямую.
 */

import { TonClient, WalletContractV4, toNano, Address, Cell } from '@ton/ton';
import { internal } from '@ton/core';
import { KeyPair } from '@ton/crypto';

const GETGEMS_API  = 'https://api.getgems.io/public-api';
const GETGEMS_KEY  = process.env.GETGEMS_API_KEY || '';

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface NFTListing {
  nftAddress:      string;
  saleVersion:     string;   // нужно для buy-fix-price API
  priceNano:       bigint;
  priceTon:        number;
  name:            string;
  imageUrl?:       string;
  collectionAddress?: string;
  ownerAddress:    string;
  currency:        string;   // 'TON' | 'USDT' | ...
}

export interface CollectionStats {
  collectionAddress: string;
  floorPrice:        number;     // TON (float, уже посчитан GetGems'ом)
  floorPriceNano:    string;
  itemsCount:        number;
  holders:           number;
  totalVolumeTon:    number;
}

export interface NFTInfo {
  address:            string;
  name:               string;
  imageUrl?:          string;
  collectionAddress?: string;
  ownerAddress:       string;
  forSale:            boolean;
  saleVersion?:       string;
  priceNano?:         bigint;
  priceTon?:          number;
  currency?:          string;
}

/** Готовая транзакция от GetGems API */
export interface GGTransaction {
  to:        string;
  amount:    string;          // nano TON
  payload?:  string | null;   // base64 BOC
  stateInit?: string | null;
}

export interface TradeResult {
  success:  boolean;
  txHash?:  string;
  error?:   string;
  transactions?: GGTransaction[];
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function ggHeaders() {
  const h: Record<string, string> = { 'Accept': 'application/json' };
  if (GETGEMS_KEY) h['Authorization'] = `Bearer ${GETGEMS_KEY}`;
  return h;
}

async function ggGet(path: string): Promise<any> {
  const r = await fetch(GETGEMS_API + path, { headers: ggHeaders() });
  if (!r.ok) throw new Error(`GetGems GET ${path} → ${r.status}`);
  const json = await r.json() as any;
  if (!json.success) throw new Error(`GetGems error: ${JSON.stringify(json)}`);
  return json.response;
}

async function ggPost(path: string, body: object): Promise<any> {
  const r = await fetch(GETGEMS_API + path, {
    method: 'POST',
    headers: { ...ggHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GetGems POST ${path} → ${r.status}`);
  const json = await r.json() as any;
  if (!json.success) throw new Error(`GetGems error: ${JSON.stringify(json)}`);
  return json.response;
}

/** Отправка готовой GG-транзакции через WalletContractV4 */
async function sendGGTransaction(
  client:  TonClient,
  wallet:  WalletContractV4,
  keyPair: KeyPair,
  tx:      GGTransaction
): Promise<string> {
  const opened = client.open(wallet);
  const seqno  = await opened.getSeqno();

  const msg = internal({
    to:    Address.parse(tx.to),
    value: BigInt(tx.amount),
    body:  tx.payload ? Cell.fromBase64(tx.payload) : undefined,
    init:  tx.stateInit ? {
      code: Cell.fromBase64(tx.stateInit),
      data: Cell.fromBase64(''),
    } : undefined,
  });

  await opened.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages:  [msg],
  });

  return `gg_${Date.now()}_${tx.to.slice(0, 8)}`;
}

// ─── GetGemsTrader ────────────────────────────────────────────────────────────

export class GetGemsTrader {
  constructor(private readonly apiKey: string = GETGEMS_KEY) {}

  // ── Данные ──────────────────────────────────────────────────────────────────

  /**
   * Статистика коллекции: floor price, holders, volume
   * Самый быстрый способ получить floor — один запрос, GetGems считает сам.
   */
  async getCollectionStats(collectionAddress: string): Promise<CollectionStats | null> {
    try {
      const resp = await ggGet(`/v1/collection/stats/${encodeURIComponent(collectionAddress)}`);
      return {
        collectionAddress,
        floorPrice:     resp.floorPrice     ?? 0,
        floorPriceNano: resp.floorPriceNano ?? '0',
        itemsCount:     resp.itemsCount     ?? 0,
        holders:        resp.holders        ?? 0,
        totalVolumeTon: parseFloat(resp.totalVolumeSold ?? '0'),
      };
    } catch (e: any) {
      console.warn('[GetGemsTrader] getCollectionStats error:', e.message);
      return null;
    }
  }

  /**
   * Все NFT на продаже в коллекции (пагинация через cursor).
   * Возвращает только FixPriceSale в TON.
   */
  async getOnSale(
    collectionAddress: string,
    limit = 50,
    cursor?: string
  ): Promise<{ items: NFTListing[]; cursor: string | null }> {
    try {
      const path = `/v1/nfts/on-sale/${encodeURIComponent(collectionAddress)}?limit=${limit}` +
                   (cursor ? `&after=${cursor}` : '');
      const resp = await ggGet(path);

      const items: NFTListing[] = (resp.items || [])
        .filter((item: any) => item.sale?.type === 'FixPriceSale' && item.sale?.currency === 'TON')
        .map((item: any) => ({
          nftAddress:       item.address,
          saleVersion:      item.sale.version,
          priceNano:        BigInt(item.sale.fullPrice ?? '0'),
          priceTon:         Number(BigInt(item.sale.fullPrice ?? '0')) / 1e9,
          name:             item.name || item.address.slice(0, 16),
          imageUrl:         item.imageSizes?.['352'] || item.image,
          collectionAddress: item.collectionAddress,
          ownerAddress:     item.ownerAddress,
          currency:         item.sale.currency,
        }));

      return { items, cursor: resp.cursor ?? null };
    } catch (e: any) {
      console.warn('[GetGemsTrader] getOnSale error:', e.message);
      return { items: [], cursor: null };
    }
  }

  /**
   * Сканирует все листинги ниже maxPriceTon с пагинацией.
   * Возвращает отсортированные по цене (дешёвые первыми).
   */
  async scanBelowPrice(
    collectionAddress: string,
    maxPriceTon: number,
    maxItems = 100
  ): Promise<NFTListing[]> {
    const results: NFTListing[] = [];
    let cursor: string | undefined;

    while (results.length < maxItems) {
      const { items, cursor: next } = await this.getOnSale(collectionAddress, 50, cursor);
      if (items.length === 0) break;

      for (const item of items) {
        if (item.priceTon <= maxPriceTon) results.push(item);
      }

      if (!next) break;

      // Если самый дешёвый в следующей странице уже выше порога — стопаем
      const cheapest = items.sort((a, b) => a.priceTon - b.priceTon)[0];
      if (cheapest && cheapest.priceTon > maxPriceTon) break;

      cursor = next;
      await new Promise(r => setTimeout(r, 300)); // rate-limit
    }

    return results.sort((a, b) => a.priceTon - b.priceTon);
  }

  /** Информация об одном NFT */
  async getNFTInfo(nftAddress: string): Promise<NFTInfo | null> {
    try {
      const item = await ggGet(`/v1/nft/${encodeURIComponent(nftAddress)}`);
      return {
        address:           item.address,
        name:              item.name || nftAddress.slice(0, 16),
        imageUrl:          item.imageSizes?.['352'] || item.image,
        collectionAddress: item.collectionAddress,
        ownerAddress:      item.ownerAddress,
        forSale:           !!item.sale,
        saleVersion:       item.sale?.version,
        priceNano:         item.sale?.fullPrice ? BigInt(item.sale.fullPrice) : undefined,
        priceTon:          item.sale?.fullPrice ? Number(BigInt(item.sale.fullPrice)) / 1e9 : undefined,
        currency:          item.sale?.currency,
      };
    } catch {
      return null;
    }
  }

  /** NFT в кошельке пользователя */
  async getOwnedNFTs(ownerAddress: string, limit = 50): Promise<NFTInfo[]> {
    try {
      const resp = await ggGet(`/v1/nfts/owner/${encodeURIComponent(ownerAddress)}?limit=${limit}`);
      return (resp.items || []).map((item: any) => ({
        address:           item.address,
        name:              item.name || item.address.slice(0, 16),
        imageUrl:          item.imageSizes?.['352'] || item.image,
        collectionAddress: item.collectionAddress,
        ownerAddress:      item.ownerAddress,
        forSale:           !!item.sale,
        saleVersion:       item.sale?.version,
        priceNano:         item.sale?.fullPrice ? BigInt(item.sale.fullPrice) : undefined,
        priceTon:          item.sale?.fullPrice ? Number(BigInt(item.sale.fullPrice)) / 1e9 : undefined,
      }));
    } catch {
      return [];
    }
  }

  // ── Торговые операции ──────────────────────────────────────────────────────

  /**
   * Покупает NFT через GetGems API.
   *
   * GetGems возвращает готовую транзакцию — нам нужно только её подписать и отправить.
   * Это гарантирует правильный формат op-кода и суммы.
   */
  async buyNFT(
    client:  TonClient,
    wallet:  WalletContractV4,
    keyPair: KeyPair,
    listing: NFTListing
  ): Promise<TradeResult> {
    try {
      // Проверяем актуальность
      const fresh = await this.getNFTInfo(listing.nftAddress);
      if (!fresh?.forSale) {
        return { success: false, error: 'NFT уже не продаётся' };
      }
      if (fresh.saleVersion !== listing.saleVersion) {
        return { success: false, error: 'Версия sale изменилась — устаревшие данные' };
      }

      // Получаем готовую транзакцию от GetGems
      const txData = await ggPost(`/v1/nfts/buy-fix-price/${encodeURIComponent(listing.nftAddress)}`, {
        version: listing.saleVersion,
      });

      if (!txData.list || txData.list.length === 0) {
        return { success: false, error: 'GetGems не вернул транзакцию' };
      }

      // Отправляем первую (основную) транзакцию
      const tx = txData.list[0] as GGTransaction;
      const txHash = await sendGGTransaction(client, wallet, keyPair, tx);

      return {
        success:      true,
        txHash,
        transactions: txData.list,
      };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  /**
   * Выставляет NFT на продажу через GetGems API.
   *
   * GetGems возвращает транзакции для деплоя sale-контракта и трансфера NFT.
   */
  async createSale(
    client:      TonClient,
    wallet:      WalletContractV4,
    keyPair:     KeyPair,
    nftAddress:  string,
    priceTon:    number,
    ownerAddress?: string
  ): Promise<TradeResult> {
    try {
      const fullPrice = toNano(priceTon.toString()).toString();
      const owner     = ownerAddress || wallet.address.toString();

      const txData = await ggPost(
        `/v1/nfts/put-on-sale-fix-price/${encodeURIComponent(nftAddress)}`,
        { ownerAddress: owner, fullPrice, currency: 'TON' }
      );

      if (!txData.list || txData.list.length === 0) {
        return { success: false, error: 'GetGems не вернул транзакции для продажи' };
      }

      // Последовательно отправляем все транзакции (деплой контракта + трансфер NFT)
      const opened = client.open(wallet);
      let lastHash = '';

      for (const tx of txData.list as GGTransaction[]) {
        const seqno = await opened.getSeqno();
        await opened.sendTransfer({
          seqno,
          secretKey: keyPair.secretKey,
          messages: [internal({
            to:    Address.parse(tx.to),
            value: BigInt(tx.amount),
            body:  tx.payload ? Cell.fromBase64(tx.payload) : undefined,
          })],
        });
        lastHash = `sale_${Date.now()}_${tx.to.slice(0, 8)}`;
        await new Promise(r => setTimeout(r, 5000)); // ждём деплоя
      }

      return { success: true, txHash: lastHash, transactions: txData.list };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  /**
   * Вычисляет чистую прибыль от арбитражной сделки.
   * Учитывает GetGems fee ~5% + royalty ~5% + gas.
   */
  static calculateProfit(
    buyPriceTon:  number,
    floorPriceTon: number,
    feePercent = 10  // 5% GetGems + ~5% royalty
  ): { profitPct: number; netProfitTon: number; breakEvenTon: number } {
    const gasTon      = 0.15;  // ~0.15 TON на tx газ
    const feeOnSell   = floorPriceTon * (feePercent / 100);
    const netProfitTon = floorPriceTon - buyPriceTon - feeOnSell - gasTon;
    const profitPct   = ((netProfitTon) / buyPriceTon) * 100;
    const breakEvenTon = buyPriceTon + gasTon;

    return { profitPct, netProfitTon, breakEvenTon };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let traderInstance: GetGemsTrader | null = null;

export function getGetGemsTrader(): GetGemsTrader {
  if (!traderInstance) traderInstance = new GetGemsTrader();
  return traderInstance;
}
