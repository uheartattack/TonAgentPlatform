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
  price: number;       // price in TON
  title?: string;
  number?: number;
  giftId?: string;
  slug?: string;
  link?: string;
  photo_url?: string;
  model?: string;
  backdrop?: string;
  symbol?: string;
  drop_rate?: number;  // model drop rate % — lower = rarer
  [key: string]: any;
}

// Backdrop rarity tiers (for arbitrage valuation)
export const BACKDROP_RARITY: Record<string, number> = {
  'black': 5,      // ultra rare — max multiplier
  'dark':  4,
  'space': 4,
  'midnight': 4,
  'night': 3,
  'navy': 3,
  'purple': 2,
  'gradient': 2,
  'colored': 1,
  'white': 0,
  'light': 0,
  'grey': 0,
  'gray': 0,
};

/** Returns backdrop rarity score 0-5 (5 = rarest/most valuable) */
export function backdropScore(backdrop: string | undefined): number {
  if (!backdrop) return 0;
  const low = backdrop.toLowerCase();
  for (const [key, score] of Object.entries(BACKDROP_RARITY)) {
    if (low.includes(key)) return score;
  }
  return 1; // unknown = some value
}

export interface RealArbitrageOpportunity {
  slug: string;
  giftName: string;
  buyPriceTon: number;   // price in TON (not Stars)
  buyMarket: string;
  sellPriceTon: number;  // price in TON (not Stars)
  sellMarket: string;
  profitTon: number;     // profit amount in TON
  profitPct: number;
  confidence: 'low' | 'medium' | 'high';
  verified?: boolean;  // true = prices from live aggregator (not stale price list)
  // legacy aliases for backward compat
  buyPriceStars?: number;
  sellPriceStars?: number;
}

// ── GiftAsset Client (giftasset.pro) ──────────────────────────────

const GA_BASE     = 'https://giftasset.pro';       // GiftAsset Pro
const GA_DEV_BASE = 'https://api.giftasset.dev';   // GiftAsset Dev (separate API)
const SW_BASE     = 'https://partners.swiftgifts.tg'; // SwiftGifts

// GiftAsset Pro (giftasset.pro) — header: X-API-Key (per /openapi.json docs)
const GA_KEY     = process.env.GIFTASSET_API_KEY     || '3303789ecb99a172206c599c24123ffd';
// GiftAsset Dev (api.giftasset.dev) — header: x-api-token
const GA_DEV_KEY = process.env.GIFTASSET_DEV_KEY     || '6HoZu0iA8TNpsQdxtNbgmpgCdMOkFMAFG1XviVLvxOE';
// SwiftGifts (partners.swiftgifts.tg) — header: x-api-key
const SW_KEY     = process.env.SWIFTGIFTS_API_KEY    || '93d3ba6d08f439cd9a086b2247d150ed';

const limiter = new RateLimiter(5, 5);

// Separate circuit breakers per API — so SwiftGifts 403 doesn't kill GiftAsset
const AUTH_COOLDOWN = 10 * 60 * 1000; // 10 min cooldown after 401/403

let _gaFailedUntil = 0;
let _gaFailLogged = false;
let _gaDevFailedUntil = 0;
let _swFailedUntil = 0;
let _swFailLogged = false;

async function gaDevFetch(path: string, opts: { method?: string; body?: any; query?: Record<string, string> } = {}): Promise<any> {
  if (Date.now() < _gaDevFailedUntil) throw new Error('GiftAsset Dev API key invalid (cooldown active)');
  await limiter.acquire();
  const url = new URL(path, GA_DEV_BASE);
  if (opts.query) Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers: { 'x-api-token': GA_DEV_KEY, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      _gaDevFailedUntil = Date.now() + AUTH_COOLDOWN;
    }
    throw new Error(`GiftAssetDev ${res.status}: ${await res.text().catch(() => 'no body')}`);
  }
  const json = await res.json() as any;
  return json.result !== undefined ? json.result : json;
}

async function gaFetch(path: string, opts: { method?: string; body?: any; query?: Record<string, string> } = {}): Promise<any> {
  // Try Pro first, fallback to Dev if Pro key expired/invalid
  if (Date.now() >= _gaFailedUntil) {
    await limiter.acquire();
    const url = new URL(path, GA_BASE);
    if (opts.query) Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      method: opts.method || 'GET',
      headers: {
        'X-API-Key': GA_KEY,     // GiftAsset Pro uses X-API-Key (per /openapi.json)
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 || res.status === 403) {
      _gaFailedUntil = Date.now() + AUTH_COOLDOWN;
      if (!_gaFailLogged) { console.warn(`[GiftAsset Pro] Key rejected (${res.status}), falling back to Dev API`); _gaFailLogged = true; }
    } else if (res.ok) {
      _gaFailLogged = false;
      const json = await res.json() as any;
      return json.result !== undefined ? json.result : json;
    } else {
      throw new Error(`GiftAsset ${res.status}: ${await res.text().catch(() => 'no body')}`);
    }
  }
  // Fallback to Dev API
  return gaDevFetch(path, opts);
}

async function swFetch(path: string, opts: { method?: string; body?: any; query?: Record<string, string> } = {}): Promise<any> {
  if (Date.now() < _swFailedUntil) throw new Error('SwiftGifts API key invalid (cooldown active)');
  await limiter.acquire();
  const url = new URL(path, SW_BASE);
  if (opts.query) Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers: {
      'x-api-key': SW_KEY,     // SwiftGifts uses x-api-key
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

  /** SwiftGifts aggregator (best offers across 7 marketplaces).
   *
   * IMPORTANT (per SwiftGifts dev):
   * - receiver: Telegram user ID (number) — REQUIRED for payload generation and gift delivery
   * - model/symbol/backdrop: use "All" to get all variants (NOT empty string!)
   * - market: ["tonnel","portals","Mrkt"] for offchain; add "fragment"/"getgems" for onchain
   * - Response items include options.payload (TON BOC ready to sign) — can buy immediately
   */
  async swAggregate(params: {
    name: string;
    receiver?: number;       // Telegram user ID for payload generation (required by API, default 0)
    page?: number;
    model?: string;          // "All" = all models
    symbol?: string;         // "All" = all symbols
    backdrop?: string;       // "All" = all backdrops
    number?: number | null;
    fromPrice?: number | null;
    toPrice?: number | null;
    market?: string[];       // default: offchain (tonnel, portals, Mrkt)
  }): Promise<{ total: number; items: AggregatorItem[] }> {
    const query: Record<string, string> = { page: String(params.page ?? 0) };
    return swFetch('/api/aggregator', {
      method: 'POST',
      query,
      body: {
        name:       params.name,
        model:      params.model    ?? 'All',
        symbol:     params.symbol   ?? 'All',
        backdrop:   params.backdrop ?? 'All',
        number:     params.number   ?? null,
        from_price: params.fromPrice ?? null,
        to_price:   params.toPrice   ?? null,
        market:     params.market ?? ['tonnel', 'portals', 'Mrkt'],
        receiver:   params.receiver ?? 0,  // Telegram user ID (number, not string!)
      },
    });
  }

  /** Top deals of the day — best arbitrage spots ranked by profit (Pro API exclusive) */
  async getTopDeals(): Promise<any> {
    return cached('ga:topDeals', 60_000, () =>
      gaFetch('/api/v1/gifts/get_top_best_deals')
    );
  }

  /** Backdrop-specific floor prices — essential for valuing rare-backdrop gifts (Pro API exclusive) */
  async getBackdropFloors(collectionName?: string): Promise<any> {
    const query: Record<string, string> = {};
    if (collectionName) query.collection_name = collectionName;
    return cached(`ga:backdropFloors:${collectionName || 'all'}`, 60_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_backdrops_floor', { query })
    );
  }

  /** Collection health index — overall market health per collection (Pro API exclusive) */
  async getCollectionHealth(): Promise<any> {
    return cached('ga:health', 300_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_collections_health_index')
    );
  }

  /** Greed index per collection — shows market overheating / undervaluation */
  async getGreedIndex(): Promise<any> {
    return cached('ga:greed', 120_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_collections_greed_index')
    );
  }

  /** Active buy offers for a collection — guaranteed buyers at specific prices */
  async getCollectionOffers(collectionName: string, params?: { minPrice?: number; maxPrice?: number }): Promise<any> {
    return cached(`ga:offers:${collectionName}:${params?.minPrice || ''}:${params?.maxPrice || ''}`, 20_000, () =>
      gaFetch('/api/v1/gifts/get_collection_offers', {
        method: 'POST',
        body: {
          collection_name: collectionName,
          min_price: params?.minPrice ?? null,
          max_price: params?.maxPrice ?? null,
        },
      })
    );
  }

  /** Unique gifts price list — per-variant (backdrop/model) pricing for a collection */
  async getUniqueGiftsPriceList(collectionName?: string): Promise<any> {
    const query: Record<string, string> = {};
    if (collectionName) query.collection_name = collectionName;
    return cached(`ga:uniquePrices:${collectionName || 'all'}`, 30_000, () =>
      gaFetch('/api/v1/gifts/get_unique_gifts_price_list', { query })
    );
  }

  /** Attribute sales volumes — which backdrops/models sell most per day */
  async getAttributeVolumes(collectionName?: string): Promise<any> {
    const query: Record<string, string> = {};
    if (collectionName) query.collection_name = collectionName;
    return cached(`ga:attrVol:${collectionName || 'all'}`, 120_000, () =>
      gaFetch('/api/v1/gifts/get_attribute_volumes', { query })
    );
  }

  /** Collections marketcap */
  async getCollectionsMarketcap(): Promise<any> {
    return cached('ga:marketcap', 300_000, () =>
      gaFetch('/api/v1/gifts/get_gifts_collections_marketcap')
    );
  }

  /** Last sale on providers — fresh cross-market prices from actual transactions */
  async getAllCollectionsLastSale(): Promise<any> {
    return cached('ga:allLastSale', 20_000, () =>  // 20s cache — fresh data for arbitrage
      gaFetch('/api/v1/gifts/get_all_collections_last_sale')
    );
  }

  // ─ Compound methods ────────────────────────────────────────────

  /** Get floor prices for a gift across all known marketplaces (onchain + offchain) */
  async getFloorPrices(slug: string): Promise<FloorPriceData> {
    const floors: Record<string, number> = {};

    // Always take minimum: live listing beats stale price-list data
    // Prices > 5000 TON are likely Stars values or API garbage — skip
    const MAX_SANE_PRICE = 5000;
    const setMin = (market: string, price: number) => {
      if (price > 0 && price <= MAX_SANE_PRICE && (!floors[market] || price < floors[market])) floors[market] = price;
    };

    // 1) Price list — listing floor per marketplace (getgems, mrkt, portals, tonnel)
    try {
      const priceList = await this.getPriceList({ models: slug });
      const cf = priceList?.collection_floors || priceList;
      if (cf && typeof cf === 'object') {
        const key = Object.keys(cf).find(k => k.toLowerCase() === slug.toLowerCase())
                 || Object.keys(cf).find(k => k.toLowerCase().includes(slug.toLowerCase()));
        if (key && cf[key]) {
          for (const [market, price] of Object.entries(cf[key])) {
            if (market === 'last_update') continue;
            if (typeof price === 'number') setMin(market, price);
          }
        }
      }
    } catch {}

    // 2) GiftAsset aggregator — live listings, all markets
    try {
      const agg = await this.aggregate({ name: slug, page: 0 });
      for (const item of (agg.items || [])) {
        const market = (item.provider || '').toLowerCase();
        if (market) setMin(market, item.price);
      }
    } catch {}

    // 3) SwiftGifts — offchain markets (tonnel, portals, Mrkt) — often cheaper than onchain
    try {
      const agg = await this.swAggregate({ name: slug, page: 0, market: ['tonnel', 'portals', 'Mrkt'] });
      for (const item of (agg.items || [])) {
        const market = (item.provider || '').toLowerCase();
        if (market) setMin(market, item.price);  // always update if cheaper
      }
    } catch {}

    // 4) SwiftGifts — onchain markets (getgems, fragment) for cross-verification
    try {
      const agg = await this.swAggregate({ name: slug, page: 0, market: ['getgems', 'fragment'] });
      for (const item of (agg.items || [])) {
        const market = (item.provider || '').toLowerCase();
        if (market) setMin(market, item.price);
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

  /** Find real arbitrage opportunities using price list data (cross-marketplace spreads).
   * Rules:
   * - Tonnel = BUY only (bad sell liquidity, never use as sell market)
   * - All prices are in TON (not Stars)
   * - Upgrades are irrelevant, ignored
   */
  async findArbitrageOpportunities(params: {
    maxPriceStars?: number;
    minProfitPct?: number;
  }): Promise<RealArbitrageOpportunity[]> {
    const maxPrice  = params.maxPriceStars ?? 5000;
    // 8% minimum — offchain (portals/mrkt) vs onchain (getgems/fragment) spread is legitimate
    const minProfit = params.minProfitPct  ?? 8;
    const opps: RealArbitrageOpportunity[] = [];

    // Markets where we NEVER sell (bad sell liquidity — prefer getgems/fragment as sell market)
    const BUY_ONLY_MARKETS = new Set(['tonnel']);

    try {
      // Step 1: Current floor prices (active listings) — NOT last sale prices
      // getAllCollectionsLastSale returns transaction history (what sold) not current listings
      const rawData = await this.getPriceList().catch(() => null);
      const cf = rawData?.collection_floors || rawData?.last_sales || rawData;
      if (!cf || typeof cf !== 'object') return opps;

      const candidates: Array<{ name: string; buyMarket: string; buyPrice: number; sellMarket: string; sellPrice: number; spread: number }> = [];

      for (const [name, markets] of Object.entries(cf)) {
        if (!markets || typeof markets !== 'object') continue;
        const entries = Object.entries(markets as Record<string, number>)
          .filter(([k, v]) => k !== 'last_update' && typeof v === 'number' && v > 0 && v <= maxPrice);
        if (entries.length < 2) continue;
        entries.sort((a, b) => a[1] - b[1]);
        const [buyMarket, buyPrice] = entries[0];
        const sellCandidates = entries.filter(([k]) => !BUY_ONLY_MARKETS.has(k));
        if (!sellCandidates.length) continue;
        const [sellMarket, sellPrice] = sellCandidates[sellCandidates.length - 1];
        if (buyMarket === sellMarket || sellPrice <= buyPrice) continue;
        const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
        if (spread >= minProfit) candidates.push({ name, buyMarket, buyPrice, sellMarket, sellPrice, spread });
      }

      // Sort by spread, take top 8 to verify with live aggregator
      candidates.sort((a, b) => b.spread - a.spread);
      const top = candidates.slice(0, 8);

      // Step 2: Verify each candidate with live floor prices (actual listings)
      const verified = await Promise.allSettled(
        top.map(c => this.getFloorPrices(c.name).then(f => ({ candidate: c, floors: f.floors })))
      );

      for (const r of verified) {
        if (r.status !== 'fulfilled') continue;
        const { candidate, floors } = r.value;
        if (!floors || Object.keys(floors).length < 2) continue;

        // Filter garbage/Stars values (>1500 TON almost certainly means Stars not TON)
        const liveEntries = Object.entries(floors)
          .filter(([k, v]) => typeof v === 'number' && v > 0 && v <= 1500)
          .sort((a, b) => a[1] - b[1]);
        if (liveEntries.length < 2) continue;

        const [liveBuyMarket, liveBuyPrice] = liveEntries[0];
        const liveSellCandidates = liveEntries.filter(([k]) => !BUY_ONLY_MARKETS.has(k));
        if (!liveSellCandidates.length) continue;
        const [liveSellMarket, liveSellPrice] = liveSellCandidates[liveSellCandidates.length - 1];
        if (liveBuyMarket === liveSellMarket || liveSellPrice <= liveBuyPrice) continue;

        const profitPct = ((liveSellPrice - liveBuyPrice) / liveBuyPrice) * 100;
        if (profitPct < minProfit) continue;

        // Spreads >40% are almost always stale/wrong data — skip unless high confidence
        if (profitPct > 40 && liveEntries.length < 4) continue;

        // Sanity: offchain markets (portals/mrkt/tonnel) should be CHEAPER than onchain (getgems/fragment)
        // If offchain is the sell market AND price > onchain buy price by >20% — suspicious
        const OFFCHAIN = new Set(['tonnel', 'portals', 'mrkt']);
        const ONCHAIN  = new Set(['getgems', 'fragment']);
        if (OFFCHAIN.has(liveSellMarket) && ONCHAIN.has(liveBuyMarket) && profitPct > 15) continue;

        opps.push({
          slug: candidate.name,
          giftName: candidate.name,
          buyPriceTon: liveBuyPrice,
          buyMarket: liveBuyMarket,
          sellPriceTon: liveSellPrice,
          sellMarket: liveSellMarket,
          profitTon: Math.round((liveSellPrice - liveBuyPrice) * 100) / 100,
          profitPct: Math.round(profitPct * 10) / 10,
          confidence: liveEntries.length >= 4 ? 'high' : liveEntries.length >= 3 ? 'medium' : 'low',
          verified: true, // prices from live aggregator
          buyPriceStars: liveBuyPrice,
          sellPriceStars: liveSellPrice,
        });
      }
    } catch (e: any) {
      if (!e.message?.includes('cooldown active')) {
        console.error('[GiftAsset] findArbitrage error:', e.message?.slice(0, 100));
      }
    }

    return opps.sort((a, b) => b.profitPct - a.profitPct).slice(0, 10);
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let _client: GiftAssetClient | null = null;
export function getGiftAssetClient(): GiftAssetClient {
  if (!_client) _client = new GiftAssetClient();
  return _client;
}
