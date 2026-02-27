/**
 * Fragment Service — MTProto-based Fragment gift price fetcher
 * Uses GramJS (telegram) to call payments.getResaleStarGifts
 * Auth flow: user provides phone → OTP → session saved
 */

import { TelegramClient, sessions } from 'telegram';
import { Api } from 'telegram/tl';
import fs from 'fs';
import path from 'path';
import { StringSession } from 'telegram/sessions';

// ── Telegram App credentials (official Telegram apps) ──────────────
// These are publicly known credentials from GramJS defaults
const API_ID   = parseInt(process.env.TG_API_ID   || '2040');
const API_HASH =          process.env.TG_API_HASH  || 'b18441a1ff607e10a989891a5462e627';

const SESSION_FILE = path.join(process.cwd(), 'tg-session.txt');

// ── Session management ─────────────────────────────────────────────
function loadSession(): string {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return fs.readFileSync(SESSION_FILE, 'utf-8').trim();
    }
  } catch {}
  return '';
}

function saveSession(session: string) {
  try {
    fs.writeFileSync(SESSION_FILE, session, 'utf-8');
  } catch (e: any) {
    console.error('[Fragment] Failed to save session:', e.message);
  }
}

// ── Client singleton ───────────────────────────────────────────────
let _client: TelegramClient | null = null;
let _connected = false;

async function getClient(): Promise<TelegramClient> {
  if (_client && _connected) return _client;

  const savedSession = loadSession();
  const session = new StringSession(savedSession);

  console.log('[Fragment] Creating TelegramClient, API_ID:', API_ID, ', session:', savedSession ? 'LOADED' : 'NEW');

  _client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    requestRetries: 5,
    autoReconnect: true,
    useWSS: false,
  });

  await _client.connect();
  _connected = true;

  // Save updated session (may include DC info)
  const sessionStr = _client.session.save() as unknown as string;
  if (sessionStr) saveSession(sessionStr);
  console.log('[Fragment] Connected. Session after connect:', sessionStr ? sessionStr.slice(0, 40) + '...' : 'empty');

  return _client;
}

/** Force reconnect client (e.g. after DC migration) */
async function reconnectClient(): Promise<void> {
  if (_client) {
    const sessionStr = _client.session.save() as unknown as string;
    if (sessionStr) saveSession(sessionStr);
    console.log('[Fragment] Force reconnect, session:', sessionStr ? sessionStr.slice(0, 40) + '...' : 'empty');
    _client = null;
    _connected = false;
  }
}

// ── Auth State Machine ─────────────────────────────────────────────
interface AuthState {
  step: 'phone' | 'code' | 'password' | 'done';
  phone?: string;
  phoneCodeHash?: string;
}

const authStates = new Map<number, AuthState>();
export function getAuthState(userId: number): AuthState | null {
  return authStates.get(userId) || null;
}
export function clearAuthState(userId: number) {
  authStates.delete(userId);
}

/**
 * Step 1: Start auth — send phone number
 * Returns: true if code sent, throws on error
 */
export async function authSendPhone(userId: number, phone: string): Promise<{ type: 'code_sent' | 'already_authorized'; info?: string }> {
  if (await isAuthorized()) {
    return { type: 'already_authorized', info: 'Уже авторизован' };
  }

  const client = await getClient();

  try {
    // Use client.sendCode() — it auto-handles DC migration (PHONE_MIGRATE_X)
    const { phoneCodeHash } = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phone
    );

    // Save session AFTER sendCode — client may have changed DC internally
    const sessionAfterCode = client.session.save() as unknown as string;
    if (sessionAfterCode) saveSession(sessionAfterCode);
    console.log('[Fragment] sendCode done, phoneCodeHash:', phoneCodeHash?.slice(0, 10) + '...');
    console.log('[Fragment] Session after sendCode:', sessionAfterCode ? sessionAfterCode.slice(0, 60) + '...' : 'empty');
    // NOTE: Do NOT reconnect here — phoneCodeHash is tied to the current session.
    // Reconnecting would invalidate the hash and cause PHONE_CODE_EXPIRED on SignIn.

    authStates.set(userId, {
      step: 'code',
      phone,
      phoneCodeHash,
    });

    return { type: 'code_sent', info: `Код отправлен на ${phone}` };
  } catch (e: any) {
    throw new Error('Ошибка отправки кода: ' + (e.message || String(e)));
  }
}

/**
 * Step 2: Submit OTP code
 */
export async function authSubmitCode(userId: number, code: string): Promise<{ type: 'authorized' | 'need_password'; info?: string }> {
  const state = authStates.get(userId);
  if (!state || !state.phone || !state.phoneCodeHash) {
    throw new Error('Сначала введите номер телефона');
  }

  const client = await getClient();
  console.log('[Fragment] SignIn attempt, phone:', state.phone, 'hash:', state.phoneCodeHash?.slice(0, 10) + '...');
  console.log('[Fragment] Current session before SignIn:', (client.session.save() as unknown as string)?.slice(0, 50) + '...');

  try {
    await client.invoke(new Api.auth.SignIn({
      phoneNumber: state.phone,
      phoneCodeHash: state.phoneCodeHash,
      phoneCode: code.replace(/\s/g, ''),
    }));

    // Save session
    const sessionStr = client.session.save() as unknown as string;
    saveSession(sessionStr);
    authStates.set(userId, { step: 'done', phone: state.phone });

    console.log('[Fragment] ✅ Authorized successfully');
    return { type: 'authorized', info: 'Авторизован успешно!' };
  } catch (e: any) {
    const msg: string = e.message || String(e);
    if (msg.includes('SESSION_PASSWORD_NEEDED')) {
      authStates.set(userId, { ...state, step: 'password' });
      return { type: 'need_password', info: 'Требуется пароль 2FA' };
    }
    if (msg.includes('PHONE_CODE_EXPIRED')) {
      authStates.delete(userId);
      throw new Error('EXPIRED');
    }
    if (msg.includes('PHONE_CODE_INVALID')) {
      throw new Error('INVALID');
    }
    throw new Error(msg);
  }
}

/**
 * Step 3 (optional): Submit 2FA password
 */
export async function authSubmitPassword(userId: number, password: string): Promise<void> {
  const client = await getClient();

  try {
    const pwdInfo = await client.invoke(new Api.account.GetPassword());
    const { computeCheck } = await import('telegram/Password');
    const inputCheck = await computeCheck(pwdInfo as any, password);
    await client.invoke(new Api.auth.CheckPassword({ password: inputCheck }));

    const sessionStr = client.session.save() as unknown as string;
    saveSession(sessionStr);
    authStates.set(userId, { step: 'done' });

    console.log('[Fragment] ✅ 2FA password accepted');
  } catch (e: any) {
    throw new Error('Неверный пароль: ' + (e.message || String(e)));
  }
}

/**
 * Check if we have a valid authorized session
 */
export async function isAuthorized(): Promise<boolean> {
  try {
    const client = await getClient();
    const me = await client.getMe();
    return !!me;
  } catch {
    return false;
  }
}

// ── Fragment Gift Data ─────────────────────────────────────────────

export interface GiftResaleData {
  giftSlug: string;
  giftId: string;
  floorPriceTon: number;
  floorPriceStars: number;
  listedCount: number;
  avgPriceStars: number;
  topListings: Array<{ priceStars: number; priceTon: number; seller?: string }>;
  updatedAt: string;
}

// Cache for gift data (30 min TTL)
const giftCache = new Map<string, { data: GiftResaleData; expires: number }>();

/** Stars → TON conversion (approx: 1 Star ≈ 0.013 TON at current rates) */
async function starsToTon(stars: number): Promise<number> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    const d: any = await r.json();
    const tonUsd = d?.['the-open-network']?.usd || 4;
    // 1 Star = $0.013 (Telegram's current rate: 50 Stars = $0.67)
    const starUsd = 0.013;
    return (stars * starUsd) / tonUsd;
  } catch {
    // Fallback: 1 Star ≈ 0.013 / 4 ≈ 0.00325 TON
    return stars * 0.00325;
  }
}

/**
 * Get resale floor price for a Telegram Gift collection
 * Uses MTProto payments.getResaleStarGifts
 */
export async function getGiftFloorPrice(giftSlug: string, giftId?: string): Promise<GiftResaleData | null> {
  // Check cache
  const cacheKey = giftSlug;
  const cached = giftCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  if (!(await isAuthorized())) {
    return null; // Need auth
  }

  const client = await getClient();

  try {
    // First get the gift catalog to find the gift ID by slug
    let resolvedGiftId = giftId;

    if (!resolvedGiftId) {
      // Get all available gifts and find by slug/name
      const catalogResult = await client.invoke(new Api.payments.GetStarGifts({ hash: 0 }));
      const catalog = (catalogResult as any).gifts || [];
      // Match by sticker emoji or known slug mapping
      const SLUG_TO_EMOJI: Record<string, string> = {
        'jelly-bunny': '🐰', 'homemade-cake': '🎂', 'plush-pepe': '🐸',
        'lol-pop': '🍭', 'cookie-heart': '❤️', 'berrybox': '🎁',
        'bdaycandle': '🕯️', 'candy-cane': '🍬',
        'love-potion': '🧪', 'witch-hat': '🎃', 'crystal-ball': '🔮',
        'star-notepad': '📓', 'astro': '🔭', 'signet-ring': '💍',
        'evil-eye': '🧿', 'loot-bag': '💰', 'eternal-rose': '🌹',
        'jack-o-lantern': '🎃', 'haunted-candy': '🍬', 'skeleton': '💀',
      };
      const targetEmoji = SLUG_TO_EMOJI[giftSlug];
      if (targetEmoji) {
        const found = catalog.find((g: any) => g.sticker?.emoji === targetEmoji);
        if (found) resolvedGiftId = String(found.id);
      }
      // Если по emoji не нашли — ищем по имени подарка (slug → name)
      if (!resolvedGiftId) {
        const slugWords = giftSlug.replace(/-/g, ' ').toLowerCase();
        const found = catalog.find((g: any) => {
          const gName = (g.title || g.name || g.sticker?.emoticon || '').toLowerCase();
          return gName.includes(slugWords) || slugWords.includes(gName);
        });
        if (found) {
          resolvedGiftId = String(found.id);
          console.log(`[Fragment] Gift resolved by name: "${giftSlug}" → id ${found.id}`);
        }
      }
      // Крайний фолбэк — НЕ используем первый попавшийся (это было неправильно)
      if (!resolvedGiftId) {
        console.warn('[Fragment] Gift not found in catalog:', giftSlug);
        return null;
      }
    }

    if (!resolvedGiftId) {
      console.warn('[Fragment] Gift not found:', giftSlug);
      return null;
    }

    // Get resale listings — sorted by price ascending (floor first)
    // @ts-ignore — GetResaleStarGifts is a newer TL method not yet in gramjs types
    const resaleResult = await client.invoke(new (Api.payments as any).GetResaleStarGifts({
      giftId: BigInt(resolvedGiftId),
      sortByPrice: true,
      offset: '',
      limit: 20,
    }));

    const listings = (resaleResult as any).gifts || [];
    if (listings.length === 0) {
      return null;
    }

    // Extract prices
    const prices: number[] = listings.map((l: any) => l.price || 0).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);
    const floorStars = prices[0] || 0;
    const avgStars = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

    const floorTon = await starsToTon(floorStars);

    const topListings = await Promise.all(prices.slice(0, 5).map(async (p: number) => ({
      priceStars: p,
      priceTon: await starsToTon(p),
    })));

    const data: GiftResaleData = {
      giftSlug,
      giftId: resolvedGiftId,
      floorPriceTon: floorTon,
      floorPriceStars: floorStars,
      listedCount: listings.length,
      avgPriceStars: Math.round(avgStars),
      topListings,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 30 min
    giftCache.set(cacheKey, { data, expires: Date.now() + 30 * 60 * 1000 });

    return data;
  } catch (e: any) {
    console.error('[Fragment] getGiftFloorPrice error:', e.message);
    return null;
  }
}

/**
 * Get all Fragment gift collections with floor prices
 */
export async function getAllGiftFloors(): Promise<Array<{
  name: string; emoji: string; floorStars: number; floorTon: number; listed: number;
}>> {
  if (!(await isAuthorized())) return [];

  const client = await getClient();

  try {
    const catalogResult = await client.invoke(new Api.payments.GetStarGifts({ hash: 0 }));
    const catalog = (catalogResult as any).gifts || [];

    // Only process limited gifts (unlimited ones have no resale market)
    const results: Array<{ name: string; emoji: string; floorStars: number; floorTon: number; listed: number }> = [];

    for (const gift of catalog.slice(0, 10)) {
      try {
        // @ts-ignore — GetResaleStarGifts is a newer TL method not yet in gramjs types
        const resale = await client.invoke(new (Api.payments as any).GetResaleStarGifts({
          giftId: gift.id,
          sortByPrice: true,
          offset: '',
          limit: 5,
        }));

        const listings = (resale as any).gifts || [];
        if (listings.length === 0) continue;

        const prices = listings.map((l: any) => l.price || 0).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);
        if (prices.length === 0) continue;

        const floorStars = prices[0];
        const floorTon = await starsToTon(floorStars);

        results.push({
          name: gift.sticker?.emoji || `Gift #${gift.id}`,
          emoji: gift.sticker?.emoji || '🎁',
          floorStars,
          floorTon,
          listed: listings.length,
        });
      } catch {
        // Skip gifts we can't get resale data for
      }
    }

    return results;
  } catch (e: any) {
    console.error('[Fragment] getAllGiftFloors error:', e.message);
    return [];
  }
}

// Export singleton for app-level use
export { getClient as getFragmentClient };
