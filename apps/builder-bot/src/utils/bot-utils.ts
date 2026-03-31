/**
 * bot-utils.ts — shared helper functions used across bot handlers.
 *
 * Extracted from bot.ts to eliminate duplication and reduce file size.
 */

import { Context } from 'telegraf';

// ============================================================
// MarkdownV2 escaping — all 18 Telegram special characters
// ============================================================

export function esc(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

// ============================================================
// safeReply — tries HTML (or given parse_mode), falls back to plain text
// ============================================================

export async function safeReply(ctx: Context, text: string, extra?: object): Promise<void> {
  const extraObj: any = extra || {};
  const parseMode = extraObj.parse_mode || 'HTML';
  try {
    await ctx.reply(text, { parse_mode: parseMode, ...extraObj });
  } catch (err: any) {
    if (err?.response?.error_code === 400) {
      const plain = parseMode === 'HTML'
        ? text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        : text.replace(/<[^>]*>/g, '').replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
      const plainExtra: any = { ...extraObj };
      delete plainExtra.parse_mode;
      try {
        await ctx.reply(plain, plainExtra);
      } catch {
        await ctx.reply(plain).catch(() => {});
      }
    } else {
      throw err;
    }
  }
}

// ============================================================
// editOrReply — edits the current callback message or sends new
// ============================================================

export async function editOrReply(ctx: Context, text: string, extra?: object): Promise<void> {
  const chatId = ctx.chat?.id;
  const msgId = ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : undefined;
  const extraObj: any = extra || {};
  const parseMode = extraObj.parse_mode || 'HTML';

  if (chatId && msgId) {
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { parse_mode: parseMode, ...extraObj } as any);
      return;
    } catch (editErr: any) {
      if (editErr?.response?.error_code === 400 && (editErr?.response?.description?.includes('message is not modified') || editErr?.description?.includes('message is not modified'))) return;
      try {
        const plain = parseMode === 'HTML'
          ? text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          : text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
        const plainExtra: any = { ...extraObj };
        delete plainExtra.parse_mode;
        await ctx.telegram.editMessageText(chatId, msgId, undefined, plain, plainExtra as any);
        return;
      } catch {
        // Fallback to new message
      }
    }
  }

  await safeReply(ctx, text, extra);
}

// ============================================================
// sanitize — strip non-tg-emoji XML tags from AI responses
// ============================================================

export function sanitize(text: string): string {
  return text
    .replace(/<(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*>[\s\S]*?<\/(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*>/g, '')
    .replace(/<(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*\s*\/>/g, '')
    .replace(/<(?!tg-emoji)[a-zA-Z_][a-zA-Z0-9_]*(?!\s*emoji)[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// safeParsePluginList — parse installed plugins from DB value
// ============================================================

export function safeParsePluginList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try { return JSON.parse(s); } catch { return []; }
  }
  return s ? [s] : [];
}

// ============================================================
// isValidTonAddress — validates TON addresses
// ============================================================

import { Address } from '@ton/core';

export function isValidTonAddress(addr: string): boolean {
  if (!addr.startsWith('EQ') && !addr.startsWith('UQ') && !addr.startsWith('kQ') && !addr.startsWith('0:')) return false;
  try {
    if (addr.startsWith('0:')) {
      Address.parseRaw(addr);
    } else {
      Address.parseFriendly(addr);
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// isGarbageInput — detect keyboard mash / random input
// ============================================================

export function isGarbageInput(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return true;
  if (!/[a-zA-Zа-яёА-ЯЁ]/.test(t)) return true;
  const wordCount = t.trim().split(/\s+/).length;
  if (wordCount >= 4) return false;
  const lower = t.toLowerCase().replace(/\s+/g, '');
  if (lower.length === 0) return true;
  if (lower.length >= 4) {
    const counts: Record<string, number> = {};
    for (const c of lower) counts[c] = (counts[c] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / lower.length > 0.65) return true;
  }
  const kbRows = [
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
    'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю',
  ];
  for (const row of kbRows) {
    let run = 0;
    for (const c of lower) {
      if (row.includes(c)) { run++; if (run >= 7) return true; }
      else run = 0;
    }
  }
  return false;
}

// ============================================================
// checkRateLimit — per-user rate limiting
// ============================================================

import { _rateLimits, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from '../state';

export function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = _rateLimits.get(userId);
  if (!entry || now >= entry.resetAt) {
    _rateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}
