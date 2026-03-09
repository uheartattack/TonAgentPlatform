// ============================================================
// Notifier — отправка уведомлений пользователю от агентов
// ============================================================
import { Telegraf, Context } from 'telegraf';

let _bot: Telegraf | null = null;

// Blocked users cache — перестаём спамить юзерам, которые заблокировали бота
const _blockedUsers = new Set<number>();
const _blockExpiry = new Map<number, number>(); // userId → unblock timestamp (retry after 1h)
const BLOCK_TTL = 60 * 60 * 1000; // 1 hour

function isBlocked(userId: number): boolean {
  if (!_blockedUsers.has(userId)) return false;
  const exp = _blockExpiry.get(userId) || 0;
  if (Date.now() > exp) {
    _blockedUsers.delete(userId);
    _blockExpiry.delete(userId);
    return false;
  }
  return true;
}

function markBlocked(userId: number): void {
  _blockedUsers.add(userId);
  _blockExpiry.set(userId, Date.now() + BLOCK_TTL);
}

function isBotBlocked(err: any): boolean {
  const msg = err?.message || String(err);
  return msg.includes('403') || msg.includes('bot was blocked')
    || msg.includes('chat not found') || msg.includes('user is deactivated')
    || msg.includes('PEER_ID_INVALID');
}

function handleSendError(userId: number, err: any): void {
  if (isBotBlocked(err)) {
    markBlocked(userId);
    console.warn(`[Notifier] User ${userId} blocked bot, muting for 1h`);
    return;
  }
  console.error(`[Notifier] sendMessage to ${userId} failed:`, err?.message || String(err));
}

export function initNotifier(bot: Telegraf) {
  _bot = bot;
}

// ── HTML helpers ──────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function div(): string { return '━━━━━━━━━━━━━━━━━━━━'; }

// Telegram supports only: b, i, s, u, code, pre, a, tg-spoiler
const ALLOWED_HTML_TAGS = /^(b|i|s|u|code|pre|a|tg-spoiler)$/i;

/** Strip unsupported HTML tags, keep Telegram-supported ones */
function sanitizeHtml(text: string): string {
  return text.replace(/<\/?([a-z][a-z0-9-]*)[^>]*>/gi, (match, tag) => {
    return ALLOWED_HTML_TAGS.test(tag) ? match : '';
  });
}

/** Safely truncate HTML — close open tags before cutting */
function safeTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  let truncated = text.slice(0, maxLen - 50);
  // Close any open tags
  const openTags: string[] = [];
  truncated.replace(/<(b|i|s|u|code|pre|a|tg-spoiler)[^>]*>/gi, (_, tag) => { openTags.push(tag); return ''; });
  truncated.replace(/<\/(b|i|s|u|code|pre|a|tg-spoiler)>/gi, (_, tag) => {
    const idx = openTags.lastIndexOf(tag.toLowerCase());
    if (idx !== -1) openTags.splice(idx, 1);
    return '';
  });
  // Close remaining open tags in reverse
  for (let i = openTags.length - 1; i >= 0; i--) {
    truncated += `</${openTags[i]}>`;
  }
  truncated += '\n<i>... (сообщение обрезано)</i>';
  return truncated;
}

// ── Core send functions ──────────────────────────────────────

/** Отправить plain text уведомление */
export async function notifyUser(userId: number, text: string): Promise<void> {
  if (!_bot) { console.warn('[Notifier] bot not initialized'); return; }
  if (isBlocked(userId)) return;
  try {
    await _bot.telegram.sendMessage(userId, text);
  } catch (err: any) {
    handleSendError(userId, err);
  }
}

/** Отправить rich-уведомление с HTML и кнопками */
export async function notifyRich(userId: number, opts: {
  text: string;
  agentId?: number;
  agentName?: string;
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
  silent?: boolean;
}): Promise<void> {
  if (!_bot) return;
  if (isBlocked(userId)) return;
  try {
    const extra: any = {};

    // Build message with agent header
    let sendText = opts.text;
    if (opts.agentName) {
      sendText = `🤖 <b>${escapeHtml(opts.agentName)}</b>\n${div()}\n${sanitizeHtml(opts.text)}`;
    } else {
      sendText = sanitizeHtml(opts.text);
    }

    // Safe truncation respecting HTML tags
    sendText = safeTruncate(sendText, 4000);
    extra.parse_mode = 'HTML';
    if (opts.silent) extra.disable_notification = true;

    // Inline keyboard — max 8 buttons per row, max 3 rows
    if (opts.buttons && opts.buttons.length > 0) {
      const btns = opts.buttons.slice(0, 12); // Telegram max ~100 but be reasonable
      const rows: any[][] = [];
      for (let i = 0; i < btns.length; i += 4) {
        rows.push(btns.slice(i, i + 4).map(b => {
          if (b.url) return { text: b.text, url: b.url };
          if (b.callbackData) return { text: b.text, callback_data: b.callbackData };
          return { text: b.text, callback_data: 'noop' };
        }));
      }
      extra.reply_markup = { inline_keyboard: rows.slice(0, 4) };
    } else if (opts.agentId) {
      extra.reply_markup = {
        inline_keyboard: [[
          { text: '💬 Чат', callback_data: 'agent_chat:' + opts.agentId },
          { text: '📋 Логи', callback_data: 'show_logs:' + opts.agentId },
          { text: '⏸ Стоп', callback_data: 'run_agent:' + opts.agentId },
        ]]
      };
    }

    try {
      await _bot.telegram.sendMessage(userId, sendText, extra);
    } catch (e1: any) {
      if (isBotBlocked(e1)) { markBlocked(userId); return; }
      // Fallback: plain text without HTML
      delete extra.parse_mode;
      const plainText = sendText.replace(/<[^>]+>/g, '').slice(0, 4000);
      await _bot.telegram.sendMessage(userId, plainText, extra);
    }
  } catch (err: any) {
    handleSendError(userId, err);
  }
}

// ── Agent result notification ────────────────────────────────

export async function notifyAgentResult(params: {
  userId: number;
  agentId: number;
  agentName: string;
  success: boolean;
  result?: any;
  error?: string;
  logs?: Array<{ level: string; message: string }>;
  scheduled?: boolean;
}): Promise<void> {
  const { userId, agentId, agentName, success, result, error, logs, scheduled } = params;

  const prefix = scheduled
    ? `⏰ <b>${escapeHtml(agentName)}</b> (плановый запуск)`
    : `🤖 <b>${escapeHtml(agentName)}</b>`;

  let text = '';

  if (success) {
    text = `${prefix} — ✅ Выполнен\n\n`;

    if (result !== undefined && result !== null) {
      const resultStr = typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);

      text += `📊 <b>Результат:</b>\n<code>${escapeHtml(resultStr.slice(0, 800))}</code>`;
      if (resultStr.length > 800) text += '\n<i>... (обрезано)</i>';
    }

    // Deduplicate + show info/success logs
    if (logs && logs.length > 0) {
      const infoLogs = logs.filter(l => l.level === 'info' || l.level === 'success');
      if (infoLogs.length > 0) {
        const unique = [...new Map(infoLogs.map(l => [l.message, l])).values()];
        text += '\n\n📝 <b>Логи:</b>\n';
        unique.slice(-5).forEach(l => {
          const emoji = l.level === 'success' ? '✅' : '📌';
          text += `${emoji} ${escapeHtml(l.message)}\n`;
        });
      }
    }
  } else {
    text = `${prefix} — ❌ Ошибка\n\n${escapeHtml(error || 'Неизвестная ошибка')}`;

    if (logs && logs.length > 0) {
      const errLogs = logs.filter(l => l.level === 'error');
      if (errLogs.length > 0) {
        const unique = [...new Map(errLogs.map(l => [l.message, l])).values()];
        text += '\n\n🔴 <b>Детали:</b>\n';
        unique.slice(-3).forEach(l => { text += `• ${escapeHtml(l.message)}\n`; });
      }
    }
  }

  // Action buttons
  const buttons = success
    ? [
        { text: '📋 Логи', callbackData: `show_logs:${agentId}` },
        { text: '💬 Чат', callbackData: `agent_chat:${agentId}` },
      ]
    : [
        { text: '🔧 Починить', callbackData: `repair_agent:${agentId}` },
        { text: '📋 Логи', callbackData: `show_logs:${agentId}` },
        { text: '▶️ Перезапуск', callbackData: `run_agent:${agentId}` },
      ];

  await notifyRich(userId, {
    text, agentId, buttons, silent: scheduled,
  });
}
