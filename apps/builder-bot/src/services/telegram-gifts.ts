/**
 * Telegram Gifts Service
 * Handles buying, selling and monitoring Telegram Gifts via:
 *   - Bot API (sendGift, getAvailableGifts) — no userbot needed
 *   - MTProto/GramJS — resale marketplace, listing, Stars balance
 *
 * MTProto patterns for GramJS gift operations
 */

import { Api } from 'telegram/tl';
import { getFragmentClient, isAuthorized, getGiftFloorPrice } from '../fragment-service';

const BOT_TOKEN = () => process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const TG_API   = (method: string) => `https://api.telegram.org/bot${BOT_TOKEN()}/${method}`;

// ── Types ──────────────────────────────────────────────────────────

export interface TgCatalogGift {
  id: string;
  star_count: number;
  total_count: number | null;
  remaining_count: number | null;
  upgrade_star_count: number | null;
  soldOut: boolean;
}

export interface FragmentListing {
  slug: string;
  price_stars: number;
  price_ton: number | null;
  seller_id?: string;
  title?: string;
}

export interface ArbitrageOpportunity {
  gift_id?: string;
  slug?: string;
  type: 'catalog' | 'resale';
  buy_price_ton?: number;   // price in TON
  sell_price_ton?: number;  // price in TON
  // legacy (kept for compat, deprecated)
  buy_price_stars?: number;
  sell_price_stars?: number;
  profit_pct: number;
  description: string;
}

// ── Gift catalog cache (5 min TTL) ────────────────────────────────

let _catalogCache: { gifts: TgCatalogGift[]; expiresAt: number } | null = null;

// ── Main Service ──────────────────────────────────────────────────

export class TelegramGiftsService {

  // ── Bot API: Get available gifts catalog ──────────────────────────
  async getAvailableGifts(): Promise<TgCatalogGift[]> {
    // Use cache
    if (_catalogCache && Date.now() < _catalogCache.expiresAt) {
      return _catalogCache.gifts;
    }
    try {
      const res  = await fetch(TG_API('getAvailableGifts'));
      const data = await res.json() as any;
      if (!data.ok) return [];

      const gifts: TgCatalogGift[] = (data.result?.gifts || []).map((g: any) => ({
        id:                 String(g.id),
        star_count:         g.star_count,
        total_count:        g.total_count        ?? null,
        remaining_count:    g.remaining_count    ?? null,
        upgrade_star_count: g.upgrade_star_count ?? null,
        soldOut:            (g.remaining_count ?? 1) === 0,
      }));

      _catalogCache = { gifts, expiresAt: Date.now() + 5 * 60 * 1000 };
      return gifts;
    } catch { return []; }
  }

  // ── Bot API: Buy catalog gift (needs Stars on bot balance) ────────
  async buyGiftBot(
    giftId: string,
    recipientUserId: number,
    text?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const body: any = { gift_id: giftId, user_id: recipientUserId };
      if (text) body.text = String(text).slice(0, 255);

      const res  = await fetch(TG_API('sendGift'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (data.ok) return { ok: true };
      return { ok: false, error: data.description || 'Bot API error' };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // ── MTProto: Buy catalog gift via userbot ─────────────────────────
  // Uses: payments.GetPaymentForm + payments.SendStarsForm (MTProto)
  async buyGiftUserbot(
    giftId: string,
    recipientUserId: number,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!await isAuthorized()) {
      return { ok: false, error: 'Userbot не авторизован. Выполните /tglogin для подключения.' };
    }
    try {
      const client = await getFragmentClient();

      const peer    = new Api.InputPeerUser({ userId: BigInt(recipientUserId) as any, accessHash: BigInt(0) as any });
      const invoice = new Api.InputInvoiceStarGift({
        peer,
        giftId: BigInt(giftId) as any,
        hideName: false,
      });

      const form = await client.invoke(new Api.payments.GetPaymentForm({ invoice })) as any;
      await client.invoke(new Api.payments.SendStarsForm({
        formId: form.formId,
        invoice,
      }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: this.parseGramJsError(e) };
    }
  }

  // ── MTProto: Buy resale gift from Fragment marketplace ────────────
  // Uses: InputInvoiceStarGiftResale (MTProto)
  async buyResaleGift(slug: string): Promise<{ ok: boolean; error?: string }> {
    if (!await isAuthorized()) {
      return { ok: false, error: 'Userbot не авторизован. Выполните /tglogin для подключения.' };
    }
    try {
      const client = await getFragmentClient();

      // InputInvoiceStarGiftResale — newer API, cast to bypass outdated typings
      const AnyApi = Api as any;
      const invoice = new AnyApi.InputInvoiceStarGiftResale({
        slug,
        toId: new Api.InputPeerSelf(),
      });

      const anyClient = client as any;
      const form = await anyClient.invoke(new Api.payments.GetPaymentForm({ invoice })) as any;
      await anyClient.invoke(new Api.payments.SendStarsForm({
        formId: form.formId,
        invoice,
      }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: this.parseGramJsError(e) };
    }
  }

  // ── MTProto: Get resale listings from Fragment ────────────────────
  // Uses: payments.GetResaleStarGifts (MTProto)
  async getFragmentListings(giftSlug: string, limit = 20): Promise<FragmentListing[]> {
    // First try fragment-service cache (getGiftFloorPrice already calls GetResaleStarGifts)
    try {
      const data = await getGiftFloorPrice(giftSlug);
      if (data?.topListings && data.topListings.length > 0) {
        return data.topListings.slice(0, limit).map((l: any) => ({
          slug:        giftSlug,
          price_stars: l.priceStars,
          price_ton:   l.priceTon ?? null,
          seller_id:   l.seller   ?? undefined,
        }));
      }
    } catch {}

    // Fallback: direct MTProto call
    if (!await isAuthorized()) return [];
    try {
      const client = await getFragmentClient();
      // We need the numeric giftId from slug — extract from catalog
      const gifts  = await this.getAvailableGifts();
      const gift   = gifts.find(g => g.id.toLowerCase().includes(giftSlug.toLowerCase()));
      if (!gift) return [];

      // GetResaleStarGifts — newer API, cast to bypass outdated typings
      const AnyPayments = Api.payments as any;
      const result = await (client as any).invoke(new AnyPayments.GetResaleStarGifts({
        giftId:      BigInt(gift.id) as any,
        offset:      '',
        limit,
        sortByPrice: true,
      })) as any;

      return (result.gifts || []).map((g: any) => ({
        slug:        g.slug || giftSlug,
        price_stars: Number(g.resellAmount?.amount || 0),
        price_ton:   null,
        title:       g.title || undefined,
      }));
    } catch { return []; }
  }

  // ── MTProto: Appraise unique gift ─────────────────────────────────
  // Uses: payments.GetUniqueStarGiftValueInfo (MTProto)
  async appraiseGift(slug: string): Promise<any> {
    if (!await isAuthorized()) {
      return { error: 'Userbot не авторизован. Выполните /tglogin.' };
    }
    try {
      const client = await getFragmentClient();
      // GetUniqueStarGiftValueInfo — newer API, cast to bypass outdated typings
      const result = await (client as any).invoke(new (Api.payments as any).GetUniqueStarGiftValueInfo({ slug })) as any;
      return {
        slug,
        floor_price_stars: Number(result.floorPrice?.amount   || 0),
        avg_price_stars:   Number(result.averagePrice?.amount  || 0),
        last_sale_stars:   Number(result.lastSalePrice?.amount || 0),
        listed_count:      result.listedCount ?? null,
        fragment_url:      result.fragmentListedUrl ?? null,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // ── MTProto: List gift for resale ─────────────────────────────────
  // Uses: payments.UpdateStarGiftPrice (MTProto)
  async listGiftForSale(msgId: number, priceStars: number): Promise<{ ok: boolean; error?: string }> {
    if (!await isAuthorized()) {
      return { ok: false, error: 'Userbot не авторизован. Выполните /tglogin.' };
    }
    try {
      const client = await getFragmentClient();
      // UpdateStarGiftPrice + StarsAmount — newer API, cast to bypass outdated typings
      const anyP = Api.payments as any;
      const AnyApi2 = Api as any;
      await (client as any).invoke(new anyP.UpdateStarGiftPrice({
        stargift:     new AnyApi2.InputSavedStarGiftUser({ msgId }),
        resellAmount: new AnyApi2.StarsAmount({ amount: BigInt(priceStars) as any, nanos: 0 }),
      }));
      return { ok: true };
    } catch (e: any) {
      // STARGIFT_RESELL_TOO_EARLY_<seconds> (MTProto)
      const early = e.message?.match(/STARGIFT_RESELL_TOO_EARLY_(\d+)/);
      if (early) {
        const secs = parseInt(early[1]);
        const h    = Math.floor(secs / 3600);
        const m    = Math.floor((secs % 3600) / 60);
        return { ok: false, error: `Слишком рано для перепродажи. Подождите ещё ${h}ч ${m}м` };
      }
      return { ok: false, error: this.parseGramJsError(e) };
    }
  }

  // ── MTProto: Get Stars balance ────────────────────────────────────
  async getStarsBalance(): Promise<{ stars?: number; error?: string }> {
    if (!await isAuthorized()) {
      return { error: 'Userbot не авторизован. Выполните /tglogin.' };
    }
    try {
      const client = await getFragmentClient();
      const result = await (client as any).invoke(new (Api.payments as any).GetStarsStatus({
        peer: new Api.InputPeerSelf(),
      })) as any;
      return { stars: Number(result.balance?.amount || 0) };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // ── Arbitrage scan: real prices via GiftAsset/SwiftGifts, fallback to heuristic ──
  async scanArbitrageOpportunities(params: {
    maxPriceStars?: number;
    minProfitPct?: number;
    tonApiKey?: string;
  }): Promise<ArbitrageOpportunity[]> {
    const maxStars  = params.maxPriceStars ?? 5000;
    const minProfit = params.minProfitPct  ?? 10;

    // Try real market data first (GiftAsset + SwiftGifts aggregator)
    try {
      const { getGiftAssetClient } = await import('./giftasset');
      const realOpps = await getGiftAssetClient().findArbitrageOpportunities({
        maxPriceStars: maxStars,
        minProfitPct: minProfit,
      });
      if (realOpps.length > 0) {
        return realOpps.map(opp => ({
          slug: opp.slug,
          type: 'resale' as const,
          buy_price_ton: opp.buyPriceTon,
          sell_price_ton: opp.sellPriceTon,
          profit_pct: Math.round(opp.profitPct),
          description: `${opp.giftName}: buy on ${opp.buyMarket} for ${opp.buyPriceTon} TON → sell on ${opp.sellMarket} for ${opp.sellPriceTon} TON (+${opp.profitPct.toFixed(1)}%, ${opp.confidence} confidence)`,
        }));
      }
    } catch (e: any) {
      console.log('[TelegramGifts] GiftAsset API fallback:', e.message?.slice(0, 80));
    }

    // Fallback: heuristic based on upgrade cost (legacy)
    const opps: ArbitrageOpportunity[] = [];
    try {
      const catalog = await this.getAvailableGifts();
      const limited = catalog.filter(g =>
        !g.soldOut &&
        g.star_count <= maxStars &&
        g.upgrade_star_count !== null
      );
      for (const gift of limited.slice(0, 20)) {
        const upgradeCost = gift.upgrade_star_count ?? 0;
        if (upgradeCost === 0) continue;
        const estimatedFloor = upgradeCost * 2;
        const totalCost      = gift.star_count + upgradeCost;
        const profitPct      = ((estimatedFloor - totalCost) / totalCost) * 100;
        if (profitPct >= minProfit) {
          opps.push({
            gift_id:          gift.id,
            type:             'catalog',
            buy_price_stars:  totalCost,    // legacy field (Stars)
            sell_price_stars: estimatedFloor,
            profit_pct:       Math.round(profitPct),
            description:      `[heuristic] Gift ${gift.id}: buy ${gift.star_count}⭐ + upgrade ${upgradeCost}⭐ — low confidence, prefer real API data`,
          });
        }
      }
    } catch {}

    return opps.sort((a, b) => b.profit_pct - a.profit_pct).slice(0, 10);
  }

  // ── Error message parser (MTProto) ───────────────────────
  private parseGramJsError(e: any): string {
    const msg = e.message || String(e);
    if (msg.includes('FLOOD_WAIT')) {
      const secs = parseInt(msg.match(/FLOOD_WAIT_(\d+)/)?.[1] || '60');
      return `FloodWait: подождите ${secs} секунд`;
    }
    if (msg.includes('STARGIFT_NOT_FOUND')) return 'Подарок не найден';
    if (msg.includes('BALANCE_TOO_LOW'))    return 'Недостаточно Stars';
    if (msg.includes('AUTH_KEY_UNREGISTERED')) return 'Сессия истекла — требуется повторный /tglogin';
    return msg.slice(0, 200);
  }
}

// ── Singleton ─────────────────────────────────────────────────────

let _service: TelegramGiftsService | null = null;
export function getTelegramGiftsService(): TelegramGiftsService {
  if (!_service) _service = new TelegramGiftsService();
  return _service;
}
