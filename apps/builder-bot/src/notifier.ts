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

function handleSendError(userId: number, err: any): void {
  const msg = err?.message || String(err);
  // 403 = bot blocked by user, 400 = chat not found
  if (msg.includes('403') || msg.includes('bot was blocked') || msg.includes('chat not found')) {
    markBlocked(userId);
    // Log only once, not every 5 minutes
    console.warn(`[Notifier] User ${userId} blocked bot, muting for 1h`);
    return;
  }
  console.error(`[Notifier] sendMessage to ${userId} failed:`, msg);
}

export function initNotifier(bot: Telegraf) {
  _bot = bot;
}

// Отправить уведомление пользователю (plain text, без MarkdownV2)
export async function notifyUser(userId: number, text: string): Promise<void> {
  if (!_bot) { console.warn('[Notifier] bot not initialized'); return; }
  if (isBlocked(userId)) return; // silently skip blocked users
  try {
    await _bot.telegram.sendMessage(userId, text);
  } catch (err: any) {
    handleSendError(userId, err);
  }
}

// Отправить rich-уведомление с HTML и кнопками
export async function notifyRich(userId: number, opts: {
  text: string;
  agentId?: number;
  agentName?: string;
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
  silent?: boolean;
}): Promise<void> {
  if (!_bot) return;
  if (isBlocked(userId)) return; // silently skip blocked users
  try {
    const extra: any = {};

    // Попробуем HTML, fallback на plain text
    let sendText = opts.text;
    if (opts.agentName) {
      sendText = `🤖 <b>${escapeHtml(opts.agentName)}</b>\n${div()}\n${opts.text}`;
    }

    extra.parse_mode = 'HTML';
    if (opts.silent) extra.disable_notification = true;

    // Inline keyboard
    if (opts.buttons && opts.buttons.length > 0) {
      const rows = opts.buttons.map(b => {
        if (b.url) return { text: b.text, url: b.url };
        if (b.callbackData) return { text: b.text, callback_data: b.callbackData };
        return { text: b.text, callback_data: 'noop' };
      });
      extra.reply_markup = { inline_keyboard: [rows] };
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
      // Check if blocked before fallback
      const m1 = e1?.message || '';
      if (m1.includes('403') || m1.includes('bot was blocked') || m1.includes('chat not found')) {
        markBlocked(userId);
        console.warn(`[Notifier] User ${userId} blocked bot, muting for 1h`);
        return;
      }
      // Fallback без HTML
      delete extra.parse_mode;
      const plainText = sendText.replace(/<[^>]+>/g, '');
      await _bot.telegram.sendMessage(userId, plainText, extra);
    }
  } catch (err: any) {
    handleSendError(userId, err);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function div(): string { return '━━━━━━━━━━━━━━━━━━━━'; }

// Отправить результат выполнения агента
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

  const prefix = scheduled ? `⏰ Агент "${agentName}" (плановый)` : `🤖 Агент "${agentName}"`;

  let text = '';

  if (success) {
    text = `${prefix} — ✅ Выполнен\n\n`;

    // Показываем результат если есть
    if (result !== undefined && result !== null) {
      const resultStr = typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);

      // Обрезаем до 800 символов
      text += `📊 Результат:\n${resultStr.slice(0, 800)}`;
      if (resultStr.length > 800) text += '\n... (обрезано)';
    }

    // Показываем info/success логи агента (console.log внутри кода)
    if (logs && logs.length > 0) {
      const infoLogs = logs.filter(l => l.level === 'info' || l.level === 'success');
      if (infoLogs.length > 0) {
        text += '\n\n📝 Логи:\n';
        infoLogs.slice(-5).forEach(l => {
          const emoji = l.level === 'success' ? '✅' : '📌';
          text += `${emoji} ${l.message}\n`;
        });
      }
    }
  } else {
    text = `${prefix} — ❌ Ошибка\n\n${error || 'Неизвестная ошибка'}`;

    // Показываем ошибки из логов
    if (logs && logs.length > 0) {
      const errLogs = logs.filter(l => l.level === 'error');
      if (errLogs.length > 0) {
        text += '\n\n🔴 Детали:\n';
        errLogs.slice(-3).forEach(l => { text += `• ${l.message}\n`; });
      }
    }
  }

  text += `\n\n/run ${agentId} — запустить снова`;

  await notifyUser(userId, text);
}
