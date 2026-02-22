// ============================================================
// Notifier — отправка уведомлений пользователю от агентов
// ============================================================
import { Telegraf, Context } from 'telegraf';

let _bot: Telegraf | null = null;

export function initNotifier(bot: Telegraf) {
  _bot = bot;
}

// Отправить уведомление пользователю (plain text, без MarkdownV2)
export async function notifyUser(userId: number, text: string): Promise<void> {
  if (!_bot) { console.warn('[Notifier] bot not initialized'); return; }
  try {
    await _bot.telegram.sendMessage(userId, text);
  } catch (err: any) {
    console.error(`[Notifier] sendMessage to ${userId} failed:`, err?.message || err);
  }
}

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
