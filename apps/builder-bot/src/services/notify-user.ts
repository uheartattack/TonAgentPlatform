/**
 * notify-user.ts — Send notifications to the user's Telegram, with fallback.
 *
 * Studio users log in via Telegram. Whenever the platform has something to tell
 * them (auto-pause, agent failure, etc.) we'd rather DM the bot than leave the
 * message stranded in Studio UI. Lookup chain:
 *
 *   1. web_sessions.telegram_id — set when the bot creates the session, or when
 *      the user runs the /link flow.
 *   2. user_id itself if it looks like a real Telegram ID (10-13 digits). Bot
 *      sessions store user_id = telegram_id, so this is a common fast path.
 *   3. Fail — log a warning so we can chase the missing link.
 *
 * Returns true if a message was queued via Telegram, false otherwise.
 */

import { pool } from '../db';

/** Telegram IDs are integers up to ~2^41. Anything 14+ digits is almost certainly
 *  an OIDC sub or junk — skip those rather than spamming an invalid chat_id. */
function looksLikeTelegramId(n: number | bigint | string): boolean {
  const s = String(n);
  return /^\d+$/.test(s) && s.length >= 5 && s.length <= 13;
}

let _telegramIdCache: Map<number, number | null> | null = null;
function _getCache(): Map<number, number | null> {
  if (!_telegramIdCache) _telegramIdCache = new Map();
  return _telegramIdCache;
}

/** Resolve a userId (platform internal) to a Telegram chat_id, or null. */
export async function resolveTelegramId(userId: number): Promise<number | null> {
  const cache = _getCache();
  if (cache.has(userId)) return cache.get(userId) ?? null;

  // Fast path: if userId itself is shaped like a Telegram ID, use it
  if (looksLikeTelegramId(userId)) {
    cache.set(userId, userId);
    return userId;
  }
  // Slow path: most recent web_session with telegram_id linked
  try {
    const r = await pool.query(
      `SELECT telegram_id FROM builder_bot.web_sessions
       WHERE user_id = $1 AND telegram_id IS NOT NULL
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    );
    const tg = r.rows[0]?.telegram_id;
    if (tg) {
      const n = Number(tg);
      if (looksLikeTelegramId(n)) {
        cache.set(userId, n);
        return n;
      }
    }
  } catch (e: any) {
    console.warn(`[notifyUser] resolve telegram_id for ${userId} failed: ${e.message}`);
  }
  cache.set(userId, null);
  return null;
}

/** Drop a cached lookup — call after a link operation so the next notify hits the new id. */
export function invalidateTelegramIdCache(userId?: number): void {
  if (!_telegramIdCache) return;
  if (typeof userId === 'number') _telegramIdCache.delete(userId);
  else _telegramIdCache.clear();
}

export interface NotifyOptions {
  /** Inline-keyboard buttons. Same shape Telegram expects. */
  buttons?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  /** HTML by default. Set to 'MarkdownV2' or '' to override. */
  parseMode?: 'HTML' | 'MarkdownV2' | '';
  /** Suppress link preview — usually what platform messages want. */
  disablePreview?: boolean;
  /** Set true to silence the noise log when there's no telegram link. The caller
   *  knows it might fail (e.g. broadcast-style notifies). */
  silent?: boolean;
}

/** Send a Telegram DM to the agent/user owner. Returns true on success. */
export async function notifyUserViaTelegram(
  userId: number,
  text: string,
  opts: NotifyOptions = {},
): Promise<boolean> {
  const tgId = await resolveTelegramId(userId);
  if (!tgId) {
    if (!opts.silent) {
      console.warn(`[notifyUser] no telegram_id for user ${userId} — message dropped (run /link in bot to enable notifications)`);
    }
    return false;
  }
  try {
    const { bot } = await import('../bot');
    await bot.telegram.sendMessage(tgId, text, {
      parse_mode: (opts.parseMode === undefined ? 'HTML' : opts.parseMode) as any,
      link_preview_options: { is_disabled: opts.disablePreview !== false },
      ...(opts.buttons ? { reply_markup: { inline_keyboard: opts.buttons } } : {}),
    } as any);
    return true;
  } catch (e: any) {
    // Common: user blocked the bot, chat not found, invalid token — degrade gracefully
    console.warn(`[notifyUser] send to ${tgId} (user ${userId}) failed: ${e.message?.slice(0, 100)}`);
    return false;
  }
}
