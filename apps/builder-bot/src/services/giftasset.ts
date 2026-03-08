/**
 * GiftAsset + SwiftGifts API Client
 *
 * GiftAsset (api.giftasset.dev):
 *   - Floor prices across 4 marketplaces (GetGems, MRKT, Portals, Fragment)
 *   - Sales history, volumes, upgrade stats, user portfolios
 *   - Auth: x-api-token header
 *
 * SwiftGifts (partners.swiftgifts.tg):
 *   - Aggregator across 7 marketplaces (+ Fragment, MarketApp, Onchain)
 *   - Per-marketplace actions, SSE real-time stream
 *   - Auth: x-api-key header
 *
 * Rate limiting: token bucket (5 RPS shared across both APIs)
 */

// ── Rate limiter (token bucket) ────────────────────────────────────

class RateLimiter {
  private tokens: number;
  private lastRefill: number = Date.now();
  constructor(private maxTokens = 5, private refillRate = 5) {
    this.tokens = maxTokens;
  }
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const wait = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise(r => setTimeout(r, wait));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

// ── Cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; expiresAt: number; }
const cache = new Map<string, CacheEntry<any>>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data as T);
  return fn().then(data => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

// ── Types ──────────────────────────────────────────────────────────

export interface GiftInfo {
  slug: string;
  title?: string;
  model?: string;
  backdrop?: string;
  symbol?: string;
  [key: string]: any;
}

export interface FloorPriceEntry {
  market: string;
  price: number;
}

export interface FloorPriceData {
  slug: string;
  floors: Record<string, number>;   // market → price in Stars
  minFloor: number;
  minFloorMarket: string;
}

export interface SaleRecord {
  price: number;
  market?: string;
  date?: string;
  [key: string]: any;
}

export interface PriceListEntry {
  collection: string;
  model?: string;
  floor?: number;
  avg?: number;
  [key: string]: any;
}

export interface AggregatorItem {
  provider: string;
  price: number;
  title?: string;
  number?: number;
  giftId?: string;
  slug?: string;
  link?: string;
  photo_url?: string;
  [key: string]: any;
}

export interface RealArbitrageOpportunity {
  slug: string;
  giftName: string;
  buyPriceStars: number;
  buyMarket: string;
  sellPriceStars: number;
  sellMarket: string;
  profitStars: number;
  profitPct: number;
  confidence: 'low' | 'medium' | 'high';
}

// ── GiftAsset Client (giftasset.pro) ──────────────────────────────

const GA_BASE = 'https://giftasset.pro';
const SW_BASE = 'https://partners.swiftgifts.tg';
const GA_KEY = process.env.GIFTASSET_API_KEY || '3303789ecb99a172206c599c24123ffd';
const SW_KEY = process.env.SWIFTGIFTS_API_KEY || '6HoZu0iA8TNpsQdxtNbgmpgCdMOkFMAFG1XviVLvxOE';

const limiter = new RateLimiter(5, 5);

// Separate circuit breakers per API — so SwiftGifts 403 doesn't kill GiftAsset
const AUTH_COOLDOWN = 10 * 60 * 1000; // 10 min cooldown after 401/403

let _gaFailedUntil = 0;
let _gaFailLogged = false;
let _swFailedUntil = 0;
let _swFailLogged = false;

async function gaFetch(path: string, opts: { method?: string; body?: any; query?: Record<string, string> } = {}): Promise<any> {
  if (Date.now() < _gaFailedUntil) throw new Error('GiftAsset API key invalid (cooldown active)');
  await limiter.acquire();
  const url = new URL(path, GA_BASE);
  if (opts.query) Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers: {
      'X-API-Key': GA_KEY,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      _gaFailedUntil = Date.now() + AUTH_COOLDOWN;
      if (!_gaFailLogged) { console.error(`[GiftAsset] API key rejected (${res.status}). Pausing for 10min.`); _gaFailLogged = true; }
    }
    throw new Error(`GiftAsset ${res.status}: ${await res.text().catch(() => 'no body')}`);
  }
  _gaFailLogged = false;
  const json = await res.json() as any;
  return json.result !== undefined ? json.result : json;
}

async function swFetch(path: string, opts: { method?: string; body?: any; query?: Record<string, string> } = {}): Promise<any> {
  if (Date.now() < _swFailedUntil) throw new Error('SwiftGifts API key invalid (cooldown active)');
  await limiter.acquire();
  const url = new URL(path, SW_BASE);
  if (opts.query) Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers: {
      'X-API-KEY': SW_KEY,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      _swFailedUntil = Date.now() + AUTH_COOLDOWN;
      if (!_swFailLogged) { console.error(`[SwiftGifts] API key rejected (${res.status}). Pausing for 10min.`); _swFailLogged = true; }
    }
    throw new Error(`SwiftGifts ${res.status}: ${await res.text().catch(() => 'no body')}`);
  }
  _swFailLogged = false;
  return res.json() as any;
}

// ── Public API ─────────────────────────────────────────────────────

export class GiftAssetClient {

  // ─ GiftAsset endpoints ─────────────────────────────────────────

  /** Get info about a specific gift by slug */
  async getGiftInfo(slug: string): Promise<GiftInfo> {
    return cached(`ga:info:${slug}`, 300_000, () =>
      gaFetch('/api/gifts', { method: 'POST', body: { slug } })
    );
  }

  /** Floor prices across all marketplaces (via price list) */
  async getPriceList(opts?: { models?: string; premarket?: boolean }): Promise<any> {
    const query: Record<string, string> = { models: opts?.models || 'all' };
    if (opts?.premarket) query.premarket = 'true';
    return cached(`ga:pricelist:${opts?.models || 'all'}:${opts?.premarket || ''}`, 30_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_price_list', { query })
    );
  }

  /** Price list history for a collection */
  async getPriceListHistory(collectionName: string): Promise<any> {
    return cached(`ga:plhist:${collectionName}`, 120_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_price_list_history', { query: { collection_name: collectionName } })
    );
  }

  /** Recent unique sales */
  async getUniqueSales(collectionName: string, limit = 20, modelName?: string): Promise<SaleRecord[]> {
    const query: Record<string, string> = { collection_name: collectionName, limit: String(limit) };
    if (modelName) query.model_name = modelName;
    return cached(`ga:sales:${collectionName}:${limit}:${modelName || ''}`, 120_000, () =>
      gaFetch('/api/v1/gifts/get_unique_last_sales', { query })
    );
  }

  /** Last sale across all collections */
  async getAllCollectionsLastSale(): Promise<any> {
    return cached('ga:allLastSale', 60_000, () =>
      gaFetch('/api/v1/gifts/get_all_collections_last_sale')
    );
  }

  /** Daily upgrade statistics */
  async getUpgradeStats(): Promise<any> {
    return cached('ga:upgradeStats', 300_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_update_stat')
    );
  }

  /** User's gift portfolio */
  async getUserGifts(params: { username?: string; telegramId?: string; limit?: number; offset?: number }): Promise<any> {
    const query: Record<string, string> = {};
    if (params.username) query.username = params.username;
    if (params.telegramId) query.telegram_id = params.telegramId;
    if (params.limit) query.limit = String(params.limit);
    if (params.offset) query.offset = String(params.offset);
    return gaFetch('/api/user_gifts', { query });
  }

  /** Market actions across marketplaces */
  async getMarketActions(params: {
    page?: number;
    mode?: string;
    gift?: string;
    type?: 'buy' | 'listing' | 'change_price';
    minPrice?: number;
    maxPrice?: number;
    markets?: string[];
  }): Promise<any> {
    const query: Record<string, string> = {};
    if (params.page !== undefined) query.page = String(params.page);
    if (params.mode) query.mode = params.mode;
    return gaFetch('/api/actions/markets', {
      method: 'POST',
      query,
      body: {
        gift: params.gift,
        type: params.type || 'listing',
        min_price: params.minPrice,
        max_price: params.maxPrice,
        market: params.markets,
      },
    });
  }

  /** Aggregator: find best offers across all marketplaces */
  async aggregate(params: {
    name: string;
    page?: number;
    model?: string;
    symbol?: string;
    backdrop?: string;
    fromPrice?: number;
    toPrice?: number;
    market?: string[];
  }): Promise<{ total: number; items: AggregatorItem[] }> {
    const query: Record<string, string> = { page: String(params.page ?? 0) };
    return gaFetch('/api/aggregator', {
      method: 'POST',
      query,
      body: {
        name: params.name,
        model: params.model || '',
        symbol: params.symbol || '',
        backdrop: params.backdrop || '',
        receiver: '',
        from_price: params.fromPrice,
        to_price: params.toPrice,
        market: params.market,
      },
    });
  }

  // ─ SwiftGifts endpoints ────────────────────────────────────────

  /** SwiftGifts gift metadata */
  async swGetGiftMeta(slug: string): Promise<any> {
    return cached(`sw:meta:${slug}`, 300_000, () =>
      swFetch('/api/gifts', { method: 'POST', body: { slug } })
    );
  }

  /** SwiftGifts price profile (portfolio valuation) */
  async swPriceProfile(username: string, offset = 0): Promise<any> {
    return swFetch('/api/price_profile', { query: { username, offset: String(offset) } });
  }

  /** SwiftGifts user gifts */
  async swUserGifts(params: { username?: string; telegramId?: string; limit?: number; offset?: number }): Promise<any> {
    const query: Record<string, string> = {};
    if (params.username) query.username = params.username;
    if (params.telegramId) query.telegram_id = params.telegramId;
    if (params.limit) query.limit = String(params.limit);
    if (params.offset) query.offset = String(params.offset);
    return swFetch('/api/user_gifts', { query });
  }

  /** SwiftGifts per-marketplace actions */
  async swMarketActions(marketplace: string, params: {
    page?: number;
    mode?: string;
    gift?: string;
    type?: 'buy' | 'listing' | 'change_price';
    minPrice?: number;
    maxPrice?: number;
  }): Promise<any> {
    const query: Record<string, string> = {};
    if (params.page !== undefined) query.page = String(params.page);
    if (params.mode) query.mode = params.mode;
    return swFetch(`/api/actions/services/${marketplace}`, {
      method: 'POST',
      query,
      body: {
        gift: params.gift,
        type: params.type || 'listing',
        min_price: params.minPrice,
        max_price: params.maxPrice,
      },
    });
  }

  /** SwiftGifts aggregator (best offers across 7 marketplaces) */
  async swAggregate(params: {
    name: string;
    page?: number;
    model?: string;
    symbol?: string;
    backdrop?: string;
    fromPrice?: number;
    toPrice?: number;
    market?: string[];
  }): Promise<{ total: number; items: AggregatorItem[] }> {
    const query: Record<string, string> = { page: String(params.page ?? 0) };
    if (params.market) query.market = params.market.join(',');
    return swFetch('/api/aggregator', {
      method: 'POST',
      query,
      body: {
        name: params.name,
        model: params.model || '',
        symbol: params.symbol || '',
        backdrop: params.backdrop || '',
        receiver: '',
        from_price: params.fromPrice,
        to_price: params.toPrice,
        market: params.market,
      },
    });
  }

  // ─ Compound methods ────────────────────────────────────────────

  /** Get floor prices for a gift across all known marketplaces */
  async getFloorPrices(slug: string): Promise<FloorPriceData> {
    const floors: Record<string, number> = {};

    // 1) Price list — has floors per marketplace (getgems, mrkt, portals, tonnel)
    try {
      const priceList = await this.getPriceList({ models: slug });
      // Response: { collection_floors: { "LoL Pop": { getgems: 5.5, mrkt: 5.2, ... } } }
      const cf = priceList?.collection_floors || priceList;
      if (cf && typeof cf === 'object') {
        // Find matching key (case-insensitive)
        const key = Object.keys(cf).find(k => k.toLowerCase() === slug.toLowerCase()) || Object.keys(cf).find(k => k.toLowerCase().includes(slug.toLowerCase()));
        if (key && cf[key]) {
          for (const [market, price] of Object.entries(cf[key])) {
            if (market === 'last_update') continue;
            if (typeof price === 'number' && price > 0) floors[market] = price;
          }
        }
      }
    } catch {}

    // 2) GiftAsset aggregator — real listings with prices
    try {
      const agg = await this.aggregate({ name: slug, page: 0 });
      for (const item of (agg.items || [])) {
        const market = (item.provider || '').toLowerCase();
        if (market && item.price > 0) {
          if (!floors[market] || item.price < floors[market]) {
            floors[market] = item.price;
          }
        }
      }
    } catch {}

    // 3) SwiftGifts aggregator (fallback, may be down)
    try {
      const agg = await this.swAggregate({ name: slug, page: 0 });
      for (const item of (agg.items || [])) {
        const market = (item.provider || '').toLowerCase();
        if (market && item.price > 0 && !floors[market]) {
          floors[market] = item.price;
        }
      }
    } catch {}

    let minFloor = Infinity;
    let minFloorMarket = '';
    for (const [market, price] of Object.entries(floors)) {
      if (price < minFloor) { minFloor = price; minFloorMarket = market; }
    }
    if (minFloor === Infinity) { minFloor = 0; minFloorMarket = 'unknown'; }

    return { slug, floors, minFloor, minFloorMarket };
  }

  /** Find real arbitrage opportunities using price list data (cross-marketplace spreads) */
  async findArbitrageOpportunities(params: {
    maxPriceStars?: number;
    minProfitPct?: number;
  }): Promise<RealArbitrageOpportunity[]> {
    const maxPrice  = params.maxPriceStars ?? 5000;
    const minProfit = params.minProfitPct  ?? 10;
    const opps: RealArbitrageOpportunity[] = [];

    try {
      // Price list gives floor per marketplace for every collection
      const priceList = await this.getPriceList();
      // Response: { collection_floors: { "LoL Pop": { getgems: 5.5, mrkt: 5.2, portals: 5.8, tonnel: 5.0 } } }
      const cf = priceList?.collection_floors || priceList;
      if (!cf || typeof cf !== 'object') return opps;

      for (const [name, markets] of Object.entries(cf)) {
        if (!markets || typeof markets !== 'object') continue;
        const entries = Object.entries(markets as Record<string, number>)
          .filter(([k, v]) => k !== 'last_update' && typeof v === 'number' && v > 0 && v <= maxPrice);
        if (entries.length < 2) continue;

        entries.sort((a, b) => a[1] - b[1]);
        const [buyMarket, buyPrice] = entries[0];
        const [sellMarket, sellPrice] = entries[entries.length - 1];

        if (sellPrice <= buyPrice) continue;
        const profitPct = ((sellPrice - buyPrice) / buyPrice) * 100;
        if (profitPct < minProfit) continue;

        opps.push({
          slug: name,
          giftName: name,
          buyPriceStars: buyPrice,
          buyMarket,
          sellPriceStars: sellPrice,
          sellMarket,
          profitStars: Math.round((sellPrice - buyPrice) * 100) / 100,
          profitPct: Math.round(profitPct * 10) / 10,
          confidence: entries.length >= 4 ? 'high' : entries.length >= 3 ? 'medium' : 'low',
        });
      }
    } catch (e: any) {
      if (!e.message?.includes('cooldown active')) {
        console.error('[GiftAsset] findArbitrage error:', e.message?.slice(0, 100));
      }
    }

    return opps.sort((a, b) => b.profitPct - a.profitPct).slice(0, 20);
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let _client: GiftAssetClient | null = null;
export function getGiftAssetClient(): GiftAssetClient {
  if (!_client) _client = new GiftAssetClient();
  return _client;
}
