/**
 * Gift Metadata Service — api.changes.tg
 * Provides gift names, backdrops, models, patterns, rarity info.
 * No auth required, public API.
 */

const BASE_URL = 'https://api.changes.tg';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

interface CacheEntry<T> { data: T; ts: number; }
const _cache = new Map<string, CacheEntry<any>>();

async function cachedFetch<T>(path: string): Promise<T> {
  const cached = _cache.get(path);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`changes.tg ${res.status}: ${path}`);
  const data = await res.json() as T;
  _cache.set(path, { data, ts: Date.now() });
  return data;
}

/** All upgradable gift names */
export async function getAllGiftNames(): Promise<string[]> {
  return cachedFetch<string[]>('/gifts');
}

/** Detailed info about a gift */
export async function getGiftInfo(gift: string): Promise<any> {
  return cachedFetch<any>(`/gift/${encodeURIComponent(gift)}`);
}

/** All backdrops for a gift (with rarity) */
export async function getBackdrops(gift: string): Promise<Array<{ name: string; rarityPermille: number; hex: any }>> {
  return cachedFetch<any[]>(`/backdrops/${encodeURIComponent(gift)}`);
}

/** All backdrops sorted by rarity */
export async function getBackdropsSorted(gift: string): Promise<Array<{ name: string; rarityPermille: number; hex: any }>> {
  return cachedFetch<any[]>(`/backdrops/${encodeURIComponent(gift)}?sorted`);
}

/** All models for a gift */
export async function getModels(gift: string): Promise<string[]> {
  return cachedFetch<string[]>(`/models/${encodeURIComponent(gift)}`);
}

/** All models sorted by rarity */
export async function getModelsSorted(gift: string): Promise<string[]> {
  return cachedFetch<string[]>(`/models/${encodeURIComponent(gift)}?sorted`);
}

/** Model info */
export async function getModelInfo(gift: string, model: string): Promise<any> {
  return cachedFetch<any>(`/model/${encodeURIComponent(gift)}/${encodeURIComponent(model)}/info`);
}

/** All symbols/patterns for a gift */
export async function getSymbols(gift: string): Promise<string[]> {
  return cachedFetch<string[]>(`/symbols/${encodeURIComponent(gift)}`);
}

/** Symbol/pattern info */
export async function getSymbolInfo(gift: string, symbol: string): Promise<any> {
  return cachedFetch<any>(`/symbol/${encodeURIComponent(gift)}/${encodeURIComponent(symbol)}/info`);
}

/** Total counts */
export async function getTotals(): Promise<{ gifts: number; models: number; backdrops: number; patterns: number }> {
  return cachedFetch<any>('/total');
}

/** Gift ID ↔ name mapping */
export async function getIdMapping(): Promise<Record<string, string>> {
  return cachedFetch<Record<string, string>>('/ids');
}

/** Custom emoji mapping for gift */
export async function getEmoji(gift: string): Promise<any> {
  return cachedFetch<any>(`/emoji/${encodeURIComponent(gift)}`);
}

/** Get model PNG URL */
export function getModelPngUrl(gift: string, model: string, size: number = 256): string {
  return `${BASE_URL}/model/${encodeURIComponent(gift)}/${encodeURIComponent(model)}.png?size=${size}`;
}

/** Get original gift PNG URL */
export function getOriginalPngUrl(gift: string, size: number = 256): string {
  return `${BASE_URL}/original/${encodeURIComponent(gift)}.png?size=${size}`;
}

/** Find backdrop by name (fuzzy) */
export async function findBackdrop(gift: string, backdropName: string): Promise<{ name: string; rarityPermille: number; hex: any } | null> {
  const backdrops = await getBackdrops(gift);
  const lower = backdropName.toLowerCase();
  return backdrops.find(b => b.name.toLowerCase() === lower)
    || backdrops.find(b => b.name.toLowerCase().includes(lower))
    || null;
}

/** Find gift name (fuzzy match) */
export async function findGiftName(query: string): Promise<string | null> {
  const names = await getAllGiftNames();
  const lower = query.toLowerCase().replace(/[-_]/g, ' ');
  return names.find(n => n.toLowerCase() === lower)
    || names.find(n => n.toLowerCase().replace(/[-_]/g, ' ') === lower)
    || names.find(n => n.toLowerCase().includes(lower))
    || null;
}
