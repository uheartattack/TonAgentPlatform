import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { getOrchestrator, MODEL_LIST, getUserModel, setUserModel, type ModelId } from './agents/orchestrator';
import { initNotifier } from './notifier';
import { getMemoryManager } from './db/memory';
import { getDBTools } from './agents/tools/db-tools';
import { getRunnerAgent } from './agents/sub-agents/runner';
import { agentLastErrors } from './agents/tools/execution-tools';
import { getCodeTools } from './agents/tools/code-tools';
import { pendingBotAuth } from './api-server';
import { getTonConnectManager } from './ton-connect';
import { getPluginManager } from './plugins-system';
import { getWorkflowEngine } from './agent-cooperation';
import { allAgentTemplates, type AgentTemplate } from './agent-templates';
import {
  generateAgentWallet,
  getWalletBalance,
  getWalletInfo,
  sendAgentTransaction,
  type AgentWallet,
} from './services/TonConnect';
import {
  PLANS,
  getUserSubscription,
  getUserPlan,
  canCreateAgent,
  canGenerateForFree,
  trackGeneration,
  getGenerationsUsed,
  createPayment,
  confirmPayment,
  getPendingPayment,
  verifyTonTransaction,
  formatSubscription,
} from './payments';

const OWNER_ID_NUM = parseInt(process.env.OWNER_ID || '0');

// ============================================================
// MarkdownV2 escaping — все 18 спецсимволов Telegram
// ============================================================
function esc(text: string | number | null | undefined): string {
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

// Безопасный reply — пробуем MarkdownV2, при ошибке — plain text
async function safeReply(ctx: Context, text: string, extra?: object): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'MarkdownV2', ...(extra || {}) });
  } catch (err: any) {
    // При ошибке парсинга — убираем разметку и отправляем plain
    if (err?.response?.error_code === 400) {
      const plain = text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
      try {
        await ctx.reply(plain, extra || {});
      } catch {
        await ctx.reply('❌ Ошибка отображения сообщения').catch(() => {});
      }
    } else {
      throw err;
    }
  }
}

// Редактировать текущее сообщение (если callback) или отправить новое (если команда)
// Решает проблему спама — callback-кнопки теперь РЕДАКТИРУЮТ сообщение, а не шлют новое
async function editOrReply(ctx: Context, text: string, extra?: object): Promise<void> {
  const chatId = ctx.chat?.id;
  const msgId = ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : undefined;

  if (chatId && msgId) {
    // Callback — пробуем редактировать
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { parse_mode: 'MarkdownV2', ...(extra || {}) } as any);
      return;
    } catch (editErr: any) {
      // Если текст не изменился (400) — не страшно
      if (editErr?.response?.error_code === 400 && editErr?.description?.includes('message is not modified')) return;
      // Иначе пробуем plain text редактирование
      try {
        const plain = text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1').replace(/[*_`]/g, '');
        await ctx.telegram.editMessageText(chatId, msgId, undefined, plain, extra as any);
        return;
      } catch {
        // Fallback — отправляем новым сообщением
      }
    }
  }

  // Не callback (команда/текст) или редактирование не вышло — safeReply
  await safeReply(ctx, text, extra);
}

// Убрать XML теги от Kiro/Claude прокси
function sanitize(text: string): string {
  return text
    .replace(/<[a-zA-Z_][a-zA-Z0-9_]*>[\s\S]*?<\/[a-zA-Z_][a-zA-Z0-9_]*>/g, '')
    .replace(/<[a-zA-Z_][a-zA-Z0-9_]*\s*\/>/g, '')
    .replace(/<[a-zA-Z_][a-zA-Z0-9_]*[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// Бот и меню
// ============================================================
const bot = new Telegraf(process.env.BOT_TOKEN || '');

const MAIN_MENU = Markup.keyboard([
  ['🤖 Мои агенты', '➕ Создать агента'],
  ['🏪 Маркетплейс', '🔌 Плагины', '⚡ Workflow'],
  ['💎 TON Connect', '💳 Подписка', '📊 Статистика'],
  ['❓ Помощь'],
]).resize();

// ============================================================
// Хранилище агентских кошельков (in-memory, будет в БД позже)
// ============================================================
const agentWallets = new Map<number, AgentWallet>();
// Временное хранение ссылок TON Connect (по userId → link)
const tonConnectLinks = new Map<number, string>();

// ============================================================
// Временное хранилище AI-фиксов (userId:agentId → fixedCode)
// ============================================================
const pendingRepairs = new Map<string, string>();

// ============================================================
// State machine для уточняющих вопросов перед созданием агента
// ============================================================
interface PendingAgentCreation {
  description: string;      // исходное описание пользователя
  step: 'schedule';         // текущий шаг диалога
}
const pendingCreations = new Map<number, PendingAgentCreation>();

const SCHEDULE_LABELS: Record<string, string> = {
  manual:   'вручную',
  '1min':   'каждую минуту',
  '5min':   'каждые 5 минут',
  '15min':  'каждые 15 минут',
  '1hour':  'каждый час',
  '24hours':'каждые 24 часа',
};

// ============================================================
// Middleware — логирование
// ============================================================
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '[callback]';
  if (userId) console.log(`[${new Date().toISOString()}] ${ctx.from?.username || userId}: ${String(text).slice(0, 80)}`);
  return next();
});

// ============================================================
// /start
// ============================================================
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || ctx.from.username || 'друг';

  // ── Web dashboard auth via deeplink: /start webauth_TOKEN ──
  const startPayload = ctx.message.text.split(' ')[1] || '';
  if (startPayload.startsWith('webauth_')) {
    const authToken = startPayload.replace('webauth_', '');
    const pending = pendingBotAuth.get(authToken);
    if (pending && pending.pending) {
      // Помечаем как авторизованный
      pendingBotAuth.set(authToken, {
        pending: false,
        userId,
        username: ctx.from.username || '',
        firstName: ctx.from.first_name || '',
        createdAt: pending.createdAt,
      });
      await ctx.reply(
        `✅ *Авторизация успешна!*\n\n` +
        `Привет, ${esc(name)}! Вернитесь в браузер — дашборд загружается автоматически.\n\n` +
        `🌐 http://localhost:3001/dashboard.html`,
        { parse_mode: 'MarkdownV2' }
      );
    } else {
      await ctx.reply('❌ Токен авторизации не найден или истёк. Обновите страницу дашборда.');
    }
    return;
  }

  await getMemoryManager().clearHistory(userId);

  const text =
    `✨ *Добро пожаловать, ${esc(name)}\\!*\n\n` +
    `Я — *TON Agent Platform* \\— платформа для создания\n` +
    `AI\\-агентов, которые работают на нашем сервере 24/7\\.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🧠 *Что умеют агенты:*\n\n` +
    `💎 Мониторить TON кошельки и уведомлять\n` +
    `📈 Следить за ценами на DEX и биржах\n` +
    `💸 Автоматически отправлять TON по расписанию\n` +
    `🌐 Работать с любыми API \\(REST, webhook\\)\n` +
    `🤖 Выполнять любую автоматизацию\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💬 *Просто напишите задачу* — агент создаётся\n` +
    `автоматически без установки чего\\-либо\\.`;

  await safeReply(ctx, text, MAIN_MENU);
  await ctx.reply(
    '⚡ Быстрый старт:',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏪 Маркетплейс', callback_data: 'marketplace' },
            { text: '➕ Создать агента', callback_data: 'create_agent_prompt' },
          ],
          [{ text: '💎 Подключить TON кошелёк', callback_data: 'ton_connect' }],
          [{ text: '❓ Как это работает?', callback_data: 'help' }],
        ],
      },
    }
  );
});

// ============================================================
// Команды
// ============================================================
bot.command('help', (ctx) => showHelp(ctx));
bot.command('list', (ctx) => showAgentsList(ctx, ctx.from.id));
bot.command('marketplace', (ctx) => showMarketplace(ctx));
bot.command('connect', (ctx) => showTonConnect(ctx));
bot.command('plugins', (ctx) => showPlugins(ctx));
bot.command('workflow', (ctx) => showWorkflows(ctx, ctx.from.id));
bot.command('stats', (ctx) => showStats(ctx, ctx.from.id));
bot.command('sub', (ctx) => showSubscription(ctx));
bot.command('plans', (ctx) => showPlans(ctx));
bot.command('model', (ctx) => showModelSelector(ctx));

bot.command('wallet', async (ctx) => {
  const userId = ctx.from.id;
  let wallet = agentWallets.get(userId);
  if (!wallet) {
    await ctx.reply('⏳ Генерирую кошелёк агента...');
    wallet = await generateAgentWallet();
    agentWallets.set(userId, wallet);
  }
  const balance = await getWalletBalance(wallet.address);
  const info = await getWalletInfo(wallet.address);
  const state = (info?.result?.account_state as string) || 'uninitialized';
  const text =
    `💼 *Кошелёк агента*\n\n` +
    `Адрес: \`${esc(wallet.address)}\`\n` +
    `Баланс: *${esc(balance.toFixed(4))}* TON\n` +
    `Статус: ${esc(state)}\n\n` +
    `⚠️ *Сохраните мнемонику\\:*\n\`${esc(wallet.mnemonic.slice(0, 60))}\\.\\.\\.\`\n\n` +
    'Пополните на 0\\.1 TON для активации\\. Используйте /send\\_agent для транзакций\\.';
  await safeReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Обновить баланс', callback_data: 'wallet_refresh' }],
        [{ text: '💸 Отправить TON', callback_data: 'wallet_send' }],
      ],
    },
  });
});

bot.command('send_agent', async (ctx) => {
  const args = ctx.message.text.replace('/send_agent', '').trim().split(' ');
  const to = args[0];
  const amount = parseFloat(args[1]);
  const comment = args.slice(2).join(' ') || '';
  if (!to || isNaN(amount) || amount <= 0) {
    await ctx.reply('Использование: `/send_agent АДРЕС СУММА [комментарий]`\nПример: `/send_agent EQD... 1.5 Зарплата`', { parse_mode: 'Markdown' });
    return;
  }
  const wallet = agentWallets.get(ctx.from.id);
  if (!wallet) {
    await ctx.reply('❌ Нет кошелька агента. Создайте через /wallet');
    return;
  }
  const balance = await getWalletBalance(wallet.address);
  if (balance < amount + 0.01) {
    await ctx.reply(`❌ Недостаточно TON. Баланс: ${balance.toFixed(4)} TON, нужно: ${(amount + 0.01).toFixed(4)} TON`);
    return;
  }
  await ctx.reply(`⏳ Отправляю ${amount} TON...`);
  try {
    const result = await sendAgentTransaction(wallet, to, amount, comment);
    const hash = result?.result?.hash || result?.result || 'pending';
    const hashStr = typeof hash === 'string' ? hash : JSON.stringify(hash);
    await safeReply(ctx,
      `✅ *Транзакция отправлена\\!*\n\nСумма: *${esc(amount)}* TON\nКому: \`${esc(to.slice(0, 20))}\\.\\.\\.\`\nHash: \`${esc(hashStr.slice(0, 40))}\``,
    );
  } catch (e: any) {
    await ctx.reply(`❌ Ошибка: ${e.message}`);
  }
});

// /send — отправить TON через подключённый Tonkeeper (TON Connect)
bot.command('send', async (ctx) => {
  const args = ctx.message.text.replace('/send', '').trim().split(/\s+/);
  const to = args[0];
  const amount = parseFloat(args[1] || '');
  const comment = args.slice(2).join(' ') || '';
  if (!to || isNaN(amount) || amount <= 0) {
    await ctx.reply(
      '💸 *Отправить TON через Tonkeeper*\n\nФормат:\n`/send АДРЕС СУММА [комментарий]`\n\nПример:\n`/send EQD...abc 5 Оплата услуг`\n\n_Транзакция подтверждается в Tonkeeper_',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  const tonConn = getTonConnectManager();
  if (!tonConn.isConnected(ctx.from.id)) {
    await ctx.reply('❌ TON кошелёк не подключён.\n\nПодключите через 💎 TON Connect → /connect');
    return;
  }
  const bal = await tonConn.getBalance(ctx.from.id);
  if (parseFloat(bal.ton) < amount + 0.05) {
    await ctx.reply(`❌ Недостаточно TON.\nБаланс: ${bal.ton} TON\nНужно: ~${(amount + 0.05).toFixed(2)} TON (включая ~0.05 комиссию)`);
    return;
  }
  await ctx.reply(`⏳ Запрашиваю подтверждение в Tonkeeper...\n\n💸 Отправляю: ${amount} TON → \`${to.slice(0, 24)}...\`\n\n_Откройте Tonkeeper и подтвердите_`, { parse_mode: 'Markdown' });
  try {
    const result = await tonConn.sendTon(ctx.from.id, to, amount, comment || undefined);
    if (result.success) {
      await safeReply(ctx,
        `✅ *Транзакция отправлена\\!*\n\n` +
        `Сумма: *${esc(amount.toFixed(4))}* TON\n` +
        `Кому: \`${esc(to.slice(0, 24))}\\.\\.\\.\`\n` +
        (comment ? `Комментарий: _${esc(comment)}_\n` : '') +
        `\nBoC: \`${esc((result.boc || 'pending').slice(0, 40))}\\.\\.\\.\``,
      );
    } else if (result.needsReconnect) {
      await ctx.reply(`❌ ${result.error}\n\nНажмите 💎 TON Connect чтобы переподключиться.`);
    } else {
      await ctx.reply(`❌ ${result.error || 'Транзакция отменена'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ Ошибка отправки: ${e.message || 'Неизвестная ошибка'}`);
  }
});

bot.command('run', async (ctx) => {
  const id = ctx.message.text.replace('/run', '').trim();
  if (!id || isNaN(parseInt(id))) {
    await ctx.reply('Использование: `/run_1` (кликабельная команда)\nПример: `/run_1` или `/run_5`', { parse_mode: 'Markdown' });
    return;
  }
  await runAgentDirect(ctx, parseInt(id), ctx.from.id);
});

// Кликабельный формат /run_ID (задача 5: без пробела для удобства)
bot.hears(/^\/run_(\d+)$/, async (ctx) => {
  const agentId = parseInt((ctx.match as RegExpMatchArray)[1]);
  await runAgentDirect(ctx, agentId, ctx.from.id);
});

bot.command('create', async (ctx) => {
  const desc = ctx.message.text.replace('/create', '').trim();
  if (!desc) {
    await ctx.reply('Использование: `/create описание агента`', { parse_mode: 'Markdown' });
    return;
  }
  await ctx.sendChatAction('typing');
  const result = await getOrchestrator().processMessage(ctx.from.id, `создай агента для ${desc}`);
  await sendResult(ctx, result);
});

// ============================================================
// Нижнее меню (кнопки)
// ============================================================
bot.hears('🤖 Мои агенты', (ctx) => showAgentsList(ctx, ctx.from.id));
bot.hears('➕ Создать агента', (ctx) =>
  safeReply(ctx,
    `✨ *Создание агента*\n\n` +
    `Опишите задачу своими словами — AI сам напишет код\n` +
    `и запустит агента на нашем сервере\\.\n\n` +
    `*Примеры задач:*\n` +
    `💎 _"Проверяй баланс UQB5\\.\\.\\. каждый час"_\n` +
    `📈 _"Следи за ценой TON, уведоми если выше 5\\$"_\n` +
    `💸 _"Каждое 10\\-е число отправляй 100 TON на UQ\\.\\.\\."_\n` +
    `🌐 _"Проверяй доступность сайта каждые 5 минут"_\n` +
    `📊 _"Получай курс BTC каждое утро в 9:00"_\n\n` +
    `👇 *Напишите вашу задачу:*`,
    MAIN_MENU
  )
);
bot.hears('🏪 Маркетплейс', (ctx) => showMarketplace(ctx));
bot.hears('🔌 Плагины', (ctx) => showPlugins(ctx));
bot.hears('⚡ Workflow', (ctx) => showWorkflows(ctx, ctx.from.id));
bot.hears('💎 TON Connect', (ctx) => showTonConnect(ctx));
bot.hears('💳 Подписка', (ctx) => showSubscription(ctx));
bot.hears('📊 Статистика', (ctx) => showStats(ctx, ctx.from.id));
bot.hears('❓ Помощь', (ctx) => showHelp(ctx));

// ============================================================
// Меню агента (regex)
// ============================================================
bot.action(/^agent_menu:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await showAgentMenu(ctx, parseInt(ctx.match[1]), ctx.from.id);
});

// ============================================================
// Уточняющий диалог: выбор расписания перед созданием агента
// ============================================================
bot.action(/^agent_schedule:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const choice = ctx.match[1];

  if (choice === 'cancel') {
    pendingCreations.delete(userId);
    await ctx.editMessageText('❌ Создание агента отменено. Напишите задачу снова когда будете готовы.').catch(() => {});
    return;
  }

  const pending = pendingCreations.get(userId);
  if (!pending) {
    await ctx.editMessageText('❌ Сессия создания устарела. Напишите задачу снова.').catch(() => {});
    return;
  }

  // Обогащаем описание информацией о расписании
  let desc = pending.description;
  if (choice !== 'manual') {
    desc += `\n\nЗапускать ${SCHEDULE_LABELS[choice] || choice}.`;
  }
  pendingCreations.delete(userId);

  // Показываем статус и запускаем генерацию
  await ctx.editMessageText(`⏳ Генерирую агента (${SCHEDULE_LABELS[choice] || choice})...\n\n_Это займёт 10–30 секунд_`, { parse_mode: 'Markdown' }).catch(() => {});

  const typingTimer = setInterval(() => {
    ctx.sendChatAction('typing').catch(() => {});
  }, 4000);

  try {
    const result = await getOrchestrator().processMessage(userId, desc, ctx.from.username);
    clearInterval(typingTimer);
    await sendResult(ctx, result);
  } catch (err) {
    clearInterval(typingTimer);
    console.error('[bot] agent_schedule create error:', err);
    await ctx.reply('❌ Ошибка создания агента. Попробуйте ещё раз.').catch(() => {});
  }
});

// ============================================================
// Callback-кнопки
// ============================================================
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const cbq = ctx.callbackQuery;
  if (!('data' in cbq) || !cbq.data) {
    await ctx.answerCbQuery('Нет данных');
    return;
  }
  const data = cbq.data;

  // ── Маркетплейс ──
  if (data === 'marketplace') { await ctx.answerCbQuery(); await showMarketplace(ctx); return; }
  if (data === 'marketplace_all') { await ctx.answerCbQuery(); await showMarketplaceAll(ctx); return; }
  if (data.startsWith('marketplace_cat:')) {
    await ctx.answerCbQuery();
    const cat = data.split(':')[1] as AgentTemplate['category'];
    await showMarketplaceCategory(ctx, cat);
    return;
  }
  if (data.startsWith('template:')) {
    await ctx.answerCbQuery('Загружаю шаблон...');
    await showTemplateDetails(ctx, data.split(':')[1]);
    return;
  }
  if (data.startsWith('create_from_template:')) {
    await ctx.answerCbQuery('Создаю агента...');
    await createAgentFromTemplate(ctx, data.split(':')[1], userId);
    return;
  }

  // ── TON Connect ──
  if (data === 'ton_connect' || data === 'ton_connect_menu') { await ctx.answerCbQuery(); await showTonConnect(ctx); return; }
  if (data === 'ton_refresh') {
    await ctx.answerCbQuery('Обновляю...');
    await showTonConnect(ctx);
    return;
  }
  if (data === 'ton_send') {
    await ctx.answerCbQuery();
    await ctx.reply(
      '💸 *Отправить TON*\n\nФормат:\n`/send АДРЕС СУММА [комментарий]`\n\nПример:\n`/send EQD...abc 10 Оплата услуг`\n\n_Транзакцию нужно подтвердить в Tonkeeper_',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  if (data === 'ton_history') {
    await ctx.answerCbQuery('Загружаю...');
    const tonConn = getTonConnectManager();
    const hist = await tonConn.getTransactions(userId, 10);
    if (!hist.ok) { await ctx.reply(`❌ ${hist.error}`); return; }
    const txs = hist.txs || [];
    if (!txs.length) { await ctx.reply('📭 История транзакций пуста'); return; }
    let txt = `📋 *История транзакций*\n\n`;
    txs.forEach((tx: any, i: number) => {
      const date = new Date(tx.time * 1000).toLocaleDateString('ru-RU');
      const dir = tx.isOutgoing ? '⬆️' : '⬇️';
      const counterpart = tx.isOutgoing
        ? (tx.to ? tx.to.slice(0, 8) + '...' : '?')
        : (tx.from ? tx.from.slice(0, 8) + '...' : '?');
      txt += `${esc(i + 1)}\\. ${esc(date)} ${dir} *${esc(tx.amount)}* TON`;
      txt += ` _${esc(tx.isOutgoing ? 'to' : 'from')} ${esc(counterpart)}_`;
      if (tx.comment) txt += `\n   💬 _${esc(tx.comment.slice(0, 30))}_`;
      txt += '\n';
    });
    await safeReply(ctx, txt);
    return;
  }
  if (data === 'ton_disconnect') {
    await ctx.answerCbQuery('Отключаю...');
    await getTonConnectManager().disconnect(userId);
    await ctx.reply('🔌 TON Connect отключён');
    return;
  }
  if (data === 'ton_get_link') {
    await ctx.answerCbQuery();
    const link = tonConnectLinks.get(userId) || '';
    if (!link) { await ctx.reply('❌ Ссылка устарела, нажмите 💎 TON Connect снова'); return; }
    await ctx.reply(`🔗 Ссылка для подключения (откройте в браузере или скопируйте):\n\n${link}`, { link_preview_options: { is_disabled: true } });
    return;
  }

  // ── Кошелёк агента (offline, без TC) ──
  if (data === 'create_agent_wallet') {
    await ctx.answerCbQuery();
    let wallet = agentWallets.get(userId);
    if (!wallet) {
      await ctx.reply('⏳ Генерирую агентский кошелёк...');
      wallet = await generateAgentWallet();
      agentWallets.set(userId, wallet);
    }
    const balance = await getWalletBalance(wallet.address);
    await ctx.reply(
      `💼 Агентский кошелёк создан!\n\n` +
      `Адрес: ${wallet.address}\n` +
      `Баланс: ${balance.toFixed(4)} TON\n\n` +
      `⚠️ Сохраните мнемонику:\n${wallet.mnemonic.slice(0, 60)}...\n\n` +
      `Пополните на 0.1 TON для активации.\n` +
      `Команда: /send_agent АДРЕС СУММА`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Обновить баланс', callback_data: 'wallet_refresh' }],
            [{ text: '💸 Отправить TON', callback_data: 'wallet_send' }],
          ],
        },
      }
    );
    return;
  }

  // ── Обновить баланс кошелёка ──
  if (data === 'wallet_refresh') {
    await ctx.answerCbQuery('Обновляю...');
    const w = agentWallets.get(userId);
    if (w) {
      const bal = await getWalletBalance(w.address);
      await ctx.reply(`💼 Баланс агента: *${bal.toFixed(4)} TON*\nАдрес: \`${w.address}\``, { parse_mode: 'Markdown' });
    }
    return;
  }
  if (data === 'wallet_send') {
    await ctx.answerCbQuery();
    await ctx.reply('Используйте: `/send_agent АДРЕС СУММА`\nПример: `/send_agent EQD... 1.5`', { parse_mode: 'Markdown' });
    return;
  }

  // ── Плагины ──
  if (data === 'plugins' || data === 'plugins_menu') { await ctx.answerCbQuery(); await showPlugins(ctx); return; }
  if (data === 'plugins_all') { await ctx.answerCbQuery(); await showAllPlugins(ctx); return; }
  if (data.startsWith('plugin:')) {
    await ctx.answerCbQuery();
    await showPluginDetails(ctx, data.split(':')[1]);
    return;
  }
  if (data.startsWith('plugin_install:')) {
    const pid = data.split(':')[1];
    const ok = await getPluginManager().installPlugin(pid);
    await ctx.answerCbQuery(ok ? '✅ Установлен' : '❌ Ошибка');
    await ctx.reply(ok ? `✅ Плагин установлен!` : `❌ Ошибка установки`);
    return;
  }
  if (data.startsWith('plugin_uninstall:')) {
    const pid = data.split(':')[1];
    const ok = await getPluginManager().uninstallPlugin(pid);
    await ctx.answerCbQuery(ok ? '✅ Удалён' : '❌ Ошибка');
    await ctx.reply(ok ? `✅ Плагин удалён` : `❌ Ошибка удаления`);
    return;
  }

  // ── Workflow ──
  if (data === 'workflow' || data === 'workflows_menu') { await ctx.answerCbQuery(); await showWorkflows(ctx, userId); return; }
  if (data.startsWith('workflow_template:')) {
    await ctx.answerCbQuery();
    await showWorkflowTemplate(ctx, parseInt(data.split(':')[1]));
    return;
  }
  if (data.startsWith('workflow_create_from:')) {
    await ctx.answerCbQuery('Создаю workflow...');
    await createWorkflowFromTemplate(ctx, userId, parseInt(data.split(':')[1]));
    return;
  }
  if (data === 'workflow_create') {
    await ctx.answerCbQuery();
    const engine = getWorkflowEngine();
    const templates = engine.getWorkflowTemplates();
    const btns = templates.map((t, i) => [{ text: `📋 ${t.name}`, callback_data: `workflow_template:${i}` }]);
    btns.push([{ text: '◀️ Назад', callback_data: 'workflow' }]);
    await ctx.reply('⚡ *Создание Workflow*\n\nВыберите шаблон:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: btns },
    });
    return;
  }
  if (data === 'workflow_describe') {
    await ctx.answerCbQuery();
    await safeReply(ctx,
      `🤖 *AI Workflow Builder*\n\n` +
      `Опишите что должен делать ваш workflow — AI сам соединит ваших агентов\\.\n\n` +
      `*Примеры:*\n` +
      `_"Каждый час проверяй баланс, если < 5 TON — отправь уведомление"_\n` +
      `_"Получай цену TON, сравни с вчерашней, если выросла — твитни"_\n` +
      `_"Мониторь несколько кошельков параллельно и собери сводку"_\n\n` +
      `👇 Напишите описание вашего workflow:`,
      MAIN_MENU
    );
    // Ставим режим ожидания workflow_describe
    await getMemoryManager().setWaitingForInput(userId, 'workflow_describe', {});
    return;
  }

  // ── Агент: быстрые действия ──
  if (data === 'create_agent_prompt' || data === 'create_agent') {
    await ctx.answerCbQuery();
    await safeReply(ctx,
      `✨ *Создание агента*\n\n` +
      `Опишите задачу — AI напишет код и запустит агента на нашем сервере\\.\n\n` +
      `*Примеры:*\n` +
      `💎 _"проверяй баланс UQB5\\.\\.\\. каждый час"_\n` +
      `📈 _"следи за ценой TON, уведоми если выше 5\\$"_\n` +
      `💸 _"каждый день отправляй мне сводку по крипторынку"_\n` +
      `🌐 _"пинг моего сайта каждые 10 минут, уведоми при ошибке"_\n\n` +
      `👇 *Напишите задачу:*`,
      MAIN_MENU
    );
    return;
  }
  if (data === 'list_agents') { await ctx.answerCbQuery(); await showAgentsList(ctx, userId); return; }
  if (data === 'help') { await ctx.answerCbQuery(); await showHelp(ctx); return; }
  if (data === 'examples') {
    await ctx.answerCbQuery();
    await ctx.reply('📖 *Примеры агентов:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💎 Баланс TON кошелька', callback_data: 'ex_ton_balance' }],
          [{ text: '📈 Цена TON/USD', callback_data: 'ex_ton_price' }],
          [{ text: '🔔 Мониторинг баланса', callback_data: 'ex_balance_monitor' }],
          [{ text: '💸 Ежемесячная зарплата', callback_data: 'ex_payroll' }],
          [{ text: '🌐 Проверка сайта', callback_data: 'ex_site_check' }],
        ],
      },
    });
    return;
  }

  // Примеры → создание
  const exMap: Record<string, string> = {
    ex_ton_balance: 'Создай агента для проверки баланса TON кошелька',
    ex_ton_price: 'Создай агента для мониторинга цены TON через CoinGecko API',
    ex_balance_monitor: 'Создай агента который каждый час проверяет баланс кошелька и уведомляет если меньше 10 TON',
    ex_payroll: 'Создай агента для отправки зарплаты сотрудникам каждое 10-е число',
    ex_site_check: 'Создай агента для проверки доступности сайта каждые 5 минут',
  };
  if (exMap[data]) {
    await ctx.answerCbQuery('Создаю...');
    await ctx.sendChatAction('typing');
    const result = await getOrchestrator().processMessage(userId, exMap[data]);
    await sendResult(ctx, result);
    return;
  }

  // ── Показать логи ──
  if (data.startsWith('show_logs:')) {
    await ctx.answerCbQuery('Загружаю логи...');
    const agentId = parseInt(data.split(':')[1]);
    await showAgentLogs(ctx, agentId, userId);
    return;
  }

  // ── Запустить / остановить агента (прямой запуск без оркестратора) ──
  if (data.startsWith('run_agent:')) {
    await ctx.answerCbQuery('Запускаю...');
    const agentId = parseInt(data.split(':')[1]);
    await runAgentDirect(ctx, agentId, userId);
    return;
  }

  // ── 🔧 AI Автопочинка ──
  if (data.startsWith('auto_repair:')) {
    await ctx.answerCbQuery('🔧 Анализирую ошибку...');
    const agentId = parseInt(data.split(':')[1]);
    const lastErr = agentLastErrors.get(agentId);
    if (!lastErr) { await ctx.reply('✅ Последних ошибок нет — агент работает нормально.'); return; }

    const agentResult = await getDBTools().getAgent(agentId, userId);
    if (!agentResult.success || !agentResult.data) { await ctx.reply('❌ Агент не найден'); return; }

    const statusMsg = await ctx.reply('🤖 AI анализирует ошибку и исправляет код...\n\n_Это займёт 10-30 секунд_', { parse_mode: 'Markdown' });

    try {
      const fixResult = await getCodeTools().modifyCode({
        currentCode: agentResult.data.code,
        modificationRequest: `Fix this runtime error: "${lastErr.error}"\n\nRemember: use notify() to send messages, getTonBalance() for TON balance, getState()/setState() for state. Do NOT use require(), import, or Telegram Bot API directly.`,
        preserveLogic: true,
      });

      if (!fixResult.success || !fixResult.data) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined,
          `❌ AI не смог исправить код: ${fixResult.error || 'Unknown error'}`
        ).catch(() => {});
        return;
      }

      const { code: fixedCode, changes } = fixResult.data;

      // Показываем предложенный фикс
      const preview = fixedCode.slice(0, 600);
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined,
        `🔧 *AI нашёл исправление*\n\n*Ошибка:* \`${esc(lastErr.error.slice(0, 80))}\`\n\n` +
        `*Изменения:* ${esc(changes.slice(0, 200))}\n\n` +
        `*Новый код (preview):*\n\`\`\`\n${esc(preview)}\n\`\`\``,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Применить фикс', callback_data: `apply_fix:${agentId}` },
                { text: '❌ Отмена', callback_data: `agent_menu:${agentId}` },
              ],
            ],
          },
        }
      ).catch(() => ctx.reply(`🔧 AI исправил ошибку. Применить?`, {
        reply_markup: { inline_keyboard: [[{ text: '✅ Применить', callback_data: `apply_fix:${agentId}` }]] },
      }));

      // Сохраняем предложенный код во временное хранилище
      pendingRepairs.set(`${userId}:${agentId}`, fixedCode);

    } catch (err: any) {
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined,
        `❌ Ошибка AI: ${err?.message || 'Unknown'}`
      ).catch(() => {});
    }
    return;
  }

  // ── Применить AI-фикс ──
  if (data.startsWith('apply_fix:')) {
    await ctx.answerCbQuery('Применяю...');
    const agentId = parseInt(data.split(':')[1]);
    const fixedCode = pendingRepairs.get(`${userId}:${agentId}`);
    if (!fixedCode) { await ctx.reply('❌ Фикс устарел, запустите автопочинку снова.'); return; }

    const updateResult = await getDBTools().updateAgentCode(agentId, userId, fixedCode);
    if (!updateResult.success) { await ctx.reply(`❌ Не удалось обновить код: ${updateResult.error}`); return; }

    pendingRepairs.delete(`${userId}:${agentId}`);
    agentLastErrors.delete(agentId); // Сбрасываем ошибку

    await ctx.reply(
      `✅ *Код исправлен\\!*\n\n🚀 Нажмите Запустить чтобы проверить работу\\.`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [[{ text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }, { text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }]] },
      }
    );
    return;
  }

  // ── Показать код ──
  if (data.startsWith('show_code:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const codeResult = await getDBTools().getAgentCode(agentId, userId);
    if (!codeResult.success || !codeResult.data) {
      await ctx.reply('❌ Код не найден');
      return;
    }
    const code = codeResult.data;
    const chunks: string[] = [];
    for (let i = 0; i < code.length; i += 3800) chunks.push(code.slice(i, i + 3800));
    for (let i = 0; i < chunks.length; i++) {
      const lbl = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      await ctx.reply(`📄 Код агента #${agentId}${lbl}:\n\`\`\`javascript\n${chunks[i]}\n\`\`\``, { parse_mode: 'Markdown' });
    }
    return;
  }

  // ── Редактировать агента ──
  if (data.startsWith('edit_agent:')) {
    await ctx.answerCbQuery();
    const agentId = data.split(':')[1];
    await ctx.reply(
      `✏️ Что изменить в агенте #${agentId}?\n\nПример:\n_"Добавь проверку каждые 30 минут"_\n_"Измени адрес кошелька на EQ..."_`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ── Удалить агента: шаг 1 — диалог подтверждения ──
  if (data.startsWith('delete_agent:')) {
    await ctx.answerCbQuery();
    const agentId = parseInt(data.split(':')[1]);
    const agentResult = await getDBTools().getAgent(agentId, userId);
    const agentName = esc(agentResult.data?.name || `#${agentId}`);
    const isActive = agentResult.data?.isActive;
    await ctx.reply(
      `🗑 *Удалить агента?*\n\n` +
      `*${agentName}* \\#${agentId}\n` +
      (isActive ? `⚠️ Агент сейчас _активен_ — он будет остановлен\\.\n` : '') +
      `\nЭто действие нельзя отменить\\.`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Да, удалить', callback_data: `confirm_delete:${agentId}` },
              { text: '❌ Отмена', callback_data: 'cancel_delete' },
            ],
          ],
        },
      }
    );
    return;
  }
  // ── Удалить агента: шаг 2 — реальное удаление ──
  if (data.startsWith('confirm_delete:')) {
    await ctx.answerCbQuery('Удаляю...');
    const agentId = parseInt(data.split(':')[1]);
    // Останавливаем агента если он запущен
    await getRunnerAgent().pauseAgent(agentId, userId).catch(() => {});
    const result = await getDBTools().deleteAgent(agentId, userId);
    await ctx.reply(result.success ? `✅ Агент #${agentId} удалён` : `❌ Ошибка: ${result.error}`);
    if (result.success) await showAgentsList(ctx, userId);
    return;
  }
  if (data === 'cancel_delete') { await ctx.answerCbQuery('Отменено ✓'); return; }

  // ── Настройки платформы ──
  if (data === 'platform_settings') {
    await ctx.answerCbQuery();
    const isOwner = userId === parseInt(process.env.OWNER_ID || '0');
    if (!isOwner) { await ctx.reply('⛔ Только для владельца'); return; }
    await ctx.reply(
      `⚙️ *Настройки платформы*\n\n` +
      `• Модель: \`${process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'}\`\n` +
      `• Прокси: \`${process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317'}\`\n` +
      `• Безопасность: ${process.env.ENABLE_SECURITY_SCAN === 'false' ? '❌' : '✅'}\n` +
      `• TON API Key: ${process.env.TONCENTER_API_KEY ? '✅ настроен' : '⚠️ не настроен'}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ── Выбор модели ──
  if (data.startsWith('set_model:')) {
    const modelId = data.split('set_model:')[1] as ModelId;
    const found = MODEL_LIST.find(m => m.id === modelId);
    if (found) {
      setUserModel(userId, modelId);
      await ctx.answerCbQuery(`✅ Модель: ${found.label}`);
      await showModelSelector(ctx);
    } else {
      await ctx.answerCbQuery('❌ Неизвестная модель');
    }
    return;
  }
  if (data === 'model_selector') { await ctx.answerCbQuery(); await showModelSelector(ctx); return; }

  // ── Подписки ──
  if (data === 'sub_menu' || data === 'subscription') {
    await ctx.answerCbQuery();
    await showSubscription(ctx);
    return;
  }
  if (data === 'plans_menu') {
    await ctx.answerCbQuery();
    await showPlans(ctx);
    return;
  }
  if (data.startsWith('buy_plan:')) {
    await ctx.answerCbQuery();
    const [, planId, period] = data.split(':');
    await showPaymentInvoice(ctx, planId, period as 'month' | 'year');
    return;
  }
  if (data === 'check_payment') {
    await ctx.answerCbQuery('Проверяю...', { show_alert: false });
    await checkPaymentStatus(ctx);
    return;
  }
  if (data === 'cancel_payment') {
    await ctx.answerCbQuery('Отменено');
    await showSubscription(ctx);
    return;
  }
  // Оплата через TON Connect (Tonkeeper подтверждает транзакцию)
  if (data.startsWith('pay_tonconnect:')) {
    await ctx.answerCbQuery();
    const [, planId, period] = data.split(':');
    const pending = getPendingPayment(userId);
    if (!pending) {
      // Создаём новый платёж
      const payment = createPayment(userId, planId, period as 'month' | 'year');
      if ('error' in payment) { await ctx.reply(`❌ ${payment.error}`); return; }
    }
    const p = getPendingPayment(userId)!;
    const tonConn = getTonConnectManager();
    if (!tonConn.isConnected(userId)) {
      await ctx.reply('❌ Сначала подключите TON кошелёк через 💎 TON Connect');
      return;
    }
    await ctx.reply('📤 Запрашиваю подтверждение в Tonkeeper...');
    const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQB5Ltvn5_q9axVSBXd4GGUVZaAh-hNgPT5emHjNsyYUDgzf';
    const payComment = `sub:${p.planId}:${p.period}:${userId}`;
    const result = await tonConn.sendTon(userId, payAddress, p.amountTon, payComment);
    if (result.success && result.boc) {
      const confirmed = await confirmPayment(userId, result.boc);
      if (confirmed.success && confirmed.plan) {
        const expStr = confirmed.expiresAt ? confirmed.expiresAt.toLocaleDateString('ru-RU') : '∞';
        await ctx.reply(`🎉 Оплата прошла! ${confirmed.plan.icon} ${confirmed.plan.name} активирован до ${expStr}`);
        await showSubscription(ctx);
      }
    } else {
      await ctx.reply(`❌ Ошибка транзакции: ${result.error || 'пользователь отменил'}\n\nМожете оплатить вручную.`);
    }
    return;
  }

  // ── Оплата генерации AI (для Free пользователей) ──
  if (data.startsWith('pay_generation:')) {
    await ctx.answerCbQuery();
    const encodedDesc = data.slice('pay_generation:'.length);
    const description = decodeURIComponent(encodedDesc);
    const plan = await getUserPlan(userId);
    const priceGen = plan.pricePerGeneration;

    const tonConn = getTonConnectManager();
    if (!tonConn.isConnected(userId)) {
      await safeReply(ctx,
        `❌ Подключите TON кошелёк для оплаты\\.\n\n` +
        `Нажмите 💎 TON Connect в меню или /connect`,
      );
      return;
    }

    const bal = await tonConn.getBalance(userId);
    if (parseFloat(bal.ton) < priceGen + 0.05) {
      await ctx.reply(`❌ Недостаточно TON.\nБаланс: ${bal.ton} TON\nНужно: ${priceGen + 0.05} TON`);
      return;
    }

    await ctx.reply(`📤 Оплата ${priceGen} TON за генерацию AI...\nПодтвердите в Tonkeeper`);
    const payAddress = process.env.PLATFORM_WALLET_ADDRESS || 'UQB5Ltvn5_q9axVSBXd4GGUVZaAh-hNgPT5emHjNsyYUDgzf';
    const payComment = `gen:${userId}:${Date.now()}`;
    const result = await tonConn.sendTon(userId, payAddress, priceGen, payComment);

    if (result.success) {
      trackGeneration(userId);
      await ctx.reply(`✅ Оплачено! Генерирую агента...`);
      await ctx.sendChatAction('typing');
      const agentResult = await getOrchestrator().processMessage(userId, description);
      await sendResult(ctx, agentResult);
    } else {
      await ctx.reply(`❌ Оплата не прошла: ${result.error || 'отменено'}`);
    }
    return;
  }

  // ── Всё остальное через оркестратор ──
  await ctx.answerCbQuery();
  await ctx.sendChatAction('typing');
  try {
    const result = await getOrchestrator().processCallback(userId, data);
    await sendResult(ctx, result);
  } catch (err) {
    console.error('Callback orchestrator error:', err);
    await ctx.reply('❌ Ошибка. Попробуйте ещё раз.');
  }
});

// ============================================================
// Текстовые сообщения → оркестратор
// ============================================================
const MENU_TEXTS = new Set([
  '🤖 Мои агенты', '➕ Создать агента', '🏪 Маркетплейс',
  '🔌 Плагины', '⚡ Workflow', '💎 TON Connect', '💳 Подписка', '📊 Статистика', '❓ Помощь',
]);

bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/') || MENU_TEXTS.has(text)) return;

  const userId = ctx.from.id;

  // ── Если есть pending — пользователь не нажал кнопки ──────
  if (pendingCreations.has(userId)) {
    // Новое сообщение отменяет предыдущий pending
    pendingCreations.delete(userId);
    // Продолжаем обрабатывать новый текст как обычно
  }

  // ── Валидация ввода ─────────────────────────────────────────
  const trimmed = text.trim();
  if (trimmed.length < 3) {
    await ctx.reply(
      `❓ Слишком короткое сообщение.\n\n` +
      `Напишите задачу подробнее, например:\n` +
      `_"Проверяй баланс кошелька UQB5... каждый час и уведоми меня"_\n` +
      `_"Следи за ценой TON и напиши если выше $6"_`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Только цифры/символы без слов
  if (/^[\d\s!@#$%^&*()+=\[\]{}<>?.,;:'"\\|\/`~\-_]+$/.test(trimmed)) {
    await ctx.reply(
      `❓ Не понимаю запрос.\n\n` +
      `Пожалуйста, опишите задачу словами:\n` +
      `_"Создай агента который проверяет..."_\n` +
      `_"Запусти агента #3"_\n` +
      `_"Покажи мои агенты"_`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ── Уточняющие вопросы перед созданием агента ───────────────
  // Если похоже на создание агента (явный запрос + достаточная длина)
  // И в тексте нет уже указанного расписания — спрашиваем
  const isCreateIntent =
    /создай|создать|сделай|сделать|напиши|написать|сгенерируй|make\b|create\b|build\b/i.test(text) ||
    /следи|проверяй|мониторь|отслеживай|мониторинг|monitor|watch\b|track\b/i.test(text);

  const hasScheduleInText =
    /каждую\s+минуту|каждые?\s+\d+\s+минут|каждый\s+час|каждые?\s+\d+\s+час|every\s+minute|every\s+hour|every\s+day|раз\s+в\s+(минуту|час|день)/i.test(text);

  if (isCreateIntent && !hasScheduleInText && trimmed.length > 15) {
    // Сохраняем описание и показываем выбор расписания
    pendingCreations.set(userId, { description: text, step: 'schedule' });
    await ctx.reply(
      '⏰ *Как запускать агента?*\n\nВыберите расписание:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Вручную', callback_data: 'agent_schedule:manual' },
              { text: '⏰ Каждую минуту', callback_data: 'agent_schedule:1min' },
            ],
            [
              { text: '⏰ Каждые 5 мин', callback_data: 'agent_schedule:5min' },
              { text: '⏰ Каждые 15 мин', callback_data: 'agent_schedule:15min' },
            ],
            [
              { text: '⏰ Каждый час', callback_data: 'agent_schedule:1hour' },
              { text: '⏰ Каждые 24 ч', callback_data: 'agent_schedule:24hours' },
            ],
            [
              { text: '❌ Отмена', callback_data: 'agent_schedule:cancel' },
            ],
          ],
        },
      }
    );
    return;
  }

  await ctx.sendChatAction('typing');

  // Держим "typing..." живым каждые 4с (генерация кода может занять до 60с при cooldown)
  const typingTimer = setInterval(() => {
    ctx.sendChatAction('typing').catch(() => {});
  }, 4000);

  // Если создаём агента — показываем прогресс
  let progressMsg: any = null;
  if (isCreateIntent && text.length > 10) {
    progressMsg = await ctx.reply('⏳ Генерирую агента, подождите...\n\n_Если AI перегружен — автоматически жду и повторяю_', { parse_mode: 'Markdown' }).catch(() => null);
  }

  try {
    const result = await getOrchestrator().processMessage(userId, text, ctx.from.username);
    clearInterval(typingTimer);
    if (progressMsg) ctx.deleteMessage(progressMsg.message_id).catch(() => {});
    await sendResult(ctx, result);
  } catch (err) {
    clearInterval(typingTimer);
    if (progressMsg) ctx.deleteMessage(progressMsg.message_id).catch(() => {});
    console.error('Text handler error:', err);
    await ctx.reply('❌ Ошибка. Попробуйте ещё раз или /start');
  }
});

// ============================================================
// Отправить результат оркестратора
// ============================================================
async function sendResult(ctx: Context, result: {
  type: string;
  content: string;
  buttons?: Array<{ text: string; callbackData: string }>;
  agentId?: number;
}) {
  const content = sanitize(result.content);
  if (!content) return;

  const inlineKeyboard = result.buttons?.map((b) => [
    { text: b.text, callback_data: b.callbackData },
  ]);
  const extra: any = inlineKeyboard?.length ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {};

  const MAX = 4000;
  if (content.length > MAX) {
    await ctx.reply(content.slice(0, MAX), { parse_mode: 'Markdown', ...extra }).catch(() =>
      ctx.reply(content.slice(0, MAX).replace(/[*_`]/g, ''), extra)
    );
    if (content.slice(MAX).trim()) await ctx.reply(content.slice(MAX)).catch(() => {});
  } else {
    await ctx.reply(content, { parse_mode: 'Markdown', ...extra }).catch(() =>
      ctx.reply(content.replace(/[*_`]/g, ''), extra).catch(() => {})
    );
  }

  // После создания агента — показываем список только если нет auto-start
  // (если auto-start произошёл в orchestrator — кнопки уже содержат "Логи" и "Остановить")
  if (result.type === 'agent_created' && result.agentId) {
    const uid = (ctx.from as any)?.id;
    // Показываем список только если в кнопках нет кнопки логов (значит авто-старта не было)
    const hasLogs = result.buttons?.some(b => b.callbackData?.startsWith('show_logs:'));
    if (uid && !hasLogs) {
      // небольшая задержка чтобы пользователь успел прочитать сообщение
      setTimeout(() => showAgentsList(ctx, uid).catch(() => {}), 1500);
    }
  }
}

// ============================================================
// Прямой запуск/остановка агента (без оркестратора, быстрый фидбек)
// Задача 6: реальный запуск агента с реальным фидбеком
// ============================================================
async function runAgentDirect(ctx: Context, agentId: number, userId: number) {
  // Получаем агента из БД
  const agentResult = await getDBTools().getAgent(agentId, userId);
  if (!agentResult.success || !agentResult.data) {
    await ctx.reply(`❌ Агент #${agentId} не найден или принадлежит другому пользователю`);
    return;
  }
  const agent = agentResult.data;

  // Если агент активен — останавливаем (toggle)
  if (agent.isActive) {
    await ctx.sendChatAction('typing');
    const pauseResult = await getRunnerAgent().pauseAgent(agentId, userId);
    if (pauseResult.success) {
      await ctx.reply(
        `⏸ *Агент остановлен*\n\n` +
        `*${agent.name}* #${agentId}\n` +
        `Scheduler деактивирован\\.`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Запустить снова', callback_data: `run_agent:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }
      );
    } else {
      await ctx.reply(`❌ Ошибка остановки: ${pauseResult.error}`);
    }
    return;
  }

  // Запускаем агента
  const statusMsg = await ctx.reply(
    `🚀 *Запускаю агента...*\n\n` +
    `*${esc(agent.name)}* #${agentId}\n` +
    `⏳ Выполняется\\.\\.\\. подождите`,
    { parse_mode: 'MarkdownV2' }
  ).catch(() => null);

  await ctx.sendChatAction('typing');

  try {
    const runResult = await getRunnerAgent().runAgent({ agentId, userId });

    if (!runResult.success) {
      // Редактируем сообщение вместо нового (умное редактирование - задача 1)
      const errText = `❌ *Ошибка запуска*\n\n${esc(runResult.error || 'Неизвестная ошибка')}`;
      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, errText, { parse_mode: 'MarkdownV2' }).catch(() => ctx.reply(errText.replace(/\\/g, '')));
      }
      return;
    }

    const data = runResult.data!;

    if (data.isScheduled) {
      // Агент активирован как scheduler
      const intervalMs = data.intervalMs || 0;
      const intervalLabel = intervalMs >= 3_600_000 ? `${intervalMs / 3_600_000} ч`
        : intervalMs >= 60_000 ? `${intervalMs / 60_000} мин`
        : `${intervalMs / 1000} сек`;

      const successText =
        `✅ *Агент активирован\\!*\n\n` +
        `*${esc(agent.name)}* #${agentId}\n` +
        `⏰ Запускается каждые *${esc(intervalLabel)}*\n` +
        `🟢 Первый запуск выполнен — проверьте логи`;

      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, successText, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Логи', callback_data: `show_logs:${agentId}` }, { text: '⏸ Остановить', callback_data: `run_agent:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }).catch(() => ctx.reply(successText.replace(/\\/g, '')));
      }
    } else {
      // Однократный запуск — показываем результат
      const exec = data.executionResult;
      let resultText = `✅ *Агент выполнен\\!*\n\n*${esc(agent.name)}* #${agentId}\n`;

      if (exec) {
        resultText += `⏱ Время: ${exec.executionTime}ms\n`;
        if (exec.success) {
          resultText += `\n📊 *Результат:*\n`;
          const rawResult = exec.result !== undefined ? JSON.stringify(exec.result, null, 2) : '(нет данных)';
          const resultStr = rawResult || '(нет данных)';
          resultText += `\`\`\`\n${esc(resultStr.slice(0, 600))}${resultStr.length > 600 ? '...' : ''}\n\`\`\``;
        } else {
          resultText += `\n❌ *Ошибка:* ${esc(exec.error || 'Unknown')}`;
        }
        if (exec.logs?.length > 0) {
          resultText += `\n\n📝 *Логи (${exec.logs.length}):*\n`;
          exec.logs.slice(-5).forEach(log => {
            const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : '✅';
            resultText += `${icon} ${esc(String(log.message).slice(0, 100))}\n`;
          });
        }
      }

      if (statusMsg) {
        await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, resultText, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Запустить снова', callback_data: `run_agent:${agentId}` }, { text: '📋 Все логи', callback_data: `show_logs:${agentId}` }],
              [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
            ],
          },
        }).catch(() => ctx.reply(resultText.replace(/[\\*_`]/g, '')));
      }
    }
  } catch (err: any) {
    const errMsg = err?.message || 'Неизвестная ошибка';
    if (statusMsg) {
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, `❌ Ошибка: ${errMsg}`).catch(() => {});
    } else {
      await ctx.reply(`❌ Ошибка запуска: ${errMsg}`);
    }
  }
}

// ============================================================
// Логи агента
// ============================================================
async function showAgentLogs(ctx: Context, agentId: number, userId: number) {
  try {
    const logsResult = await getRunnerAgent().getLogs(agentId, userId, 20);
    if (!logsResult.success) {
      await ctx.reply(`❌ Не удалось загрузить логи: ${logsResult.error}`);
      return;
    }
    const logs = logsResult.data?.logs || [];
    if (!logs.length) {
      await ctx.reply(
        `📋 *Логи агента #${agentId}*\n\nЛоги пусты — агент ещё не запускался или логи удалены\\.`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [[{ text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }, { text: '◀️ Назад', callback_data: `agent_menu:${agentId}` }]] },
        }
      );
      return;
    }

    let text = `📋 *Логи агента #${agentId}* \\(последние ${logs.length}\\):\n\n`;
    logs.slice(-15).forEach(log => {
      const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️';
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      text += `${icon} \`${esc(time)}\` ${esc(String(log.message).slice(0, 120))}\n`;
    });

    await safeReply(ctx, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Обновить', callback_data: `show_logs:${agentId}` }, { text: '🚀 Запустить', callback_data: `run_agent:${agentId}` }],
          [{ text: '◀️ К агенту', callback_data: `agent_menu:${agentId}` }],
        ],
      },
    });
  } catch (err) {
    await ctx.reply('❌ Ошибка загрузки логов');
  }
}

// ============================================================
// Список агентов
// ============================================================
async function showAgentsList(ctx: Context, userId: number) {
  try {
    const r = await getDBTools().getUserAgents(userId);
    if (!r.success || !r.data?.length) {
      await editOrReply(ctx,
        `🤖 *Ваши агенты*\n\n` +
        `У вас пока нет агентов\\.\n\n` +
        `*Чтобы создать агента:*\n` +
        `• Напишите задачу своими словами\n` +
        `• Выберите готовый шаблон в Маркетплейсе\n\n` +
        `_Примеры: "проверяй баланс кошелька каждый час", "следи за ценой TON"_`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏪 Маркетплейс шаблонов', callback_data: 'marketplace' }],
              [{ text: '✏️ Создать с описанием', callback_data: 'create_agent_prompt' }],
            ],
          },
        }
      );
      return;
    }
    const agents = r.data;
    const active = agents.filter(a => a.isActive).length;

    let text = `🤖 *Ваши агенты*\n`;
    text += `Всего: *${esc(agents.length)}* · Активных: *${esc(active)}*\n\n`;

    agents.forEach((a) => {
      const st = a.isActive ? '🟢' : '⏸';
      const tr = a.triggerType === 'scheduled' ? ' ⏰' : a.triggerType === 'webhook' ? ' 🔗' : '';
      const name = (a.name || '').replace(/[*_`[\]]/g, '').slice(0, 30);
      text += `${st} *#${esc(a.id)}* ${esc(name)}${esc(tr)}\n`;
    });

    const btns = agents.slice(0, 8).map((a) => [{
      text: `${a.isActive ? '🟢' : '⏸'} #${a.id} ${(a.name || '').slice(0, 24)}`,
      callback_data: `agent_menu:${a.id}`,
    }]);
    btns.push([
      { text: '➕ Создать нового', callback_data: 'create_agent_prompt' },
      { text: '🏪 Маркетплейс', callback_data: 'marketplace' },
    ]);

    await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
  } catch (err) {
    console.error('showAgentsList error:', err);
    await ctx.reply('❌ Ошибка загрузки агентов. Попробуйте /start');
  }
}

// ============================================================
// Меню конкретного агента
// ============================================================
async function showAgentMenu(ctx: Context, agentId: number, userId: number) {
  try {
    const r = await getDBTools().getAgent(agentId, userId);
    if (!r.success || !r.data) { await ctx.reply('❌ Агент не найден'); return; }
    const a = r.data;
    const name = (a.name || '').replace(/[*_`[\]]/g, '').slice(0, 40);
    const desc = (a.description || '').replace(/[*_`[\]]/g, '').slice(0, 120);
    const statusIcon = a.isActive ? '🟢' : '⏸';
    const statusText = a.isActive ? 'Активен' : 'На паузе';
    const triggerIcon = a.triggerType === 'scheduled' ? '⏰' : a.triggerType === 'webhook' ? '🔗' : '▶️';
    const triggerText = a.triggerType === 'scheduled' ? 'По расписанию' :
                        a.triggerType === 'webhook' ? 'Webhook' : 'Вручную';

    const lastErr = agentLastErrors.get(agentId);
    const hasError = !!lastErr;

    const text =
      `${statusIcon} *Агент #${esc(a.id)} — ${esc(name)}*\n\n` +
      `Статус: *${esc(statusText)}*\n` +
      `Тип запуска: ${esc(triggerIcon)} ${esc(triggerText)}\n` +
      (hasError ? `\n⚠️ *Последняя ошибка:*\n\`${esc(lastErr!.error.slice(0, 120))}\`` : '') +
      (desc ? `\n_${esc(desc)}_` : '');

    const keyboard: any[][] = [
      [
        { text: a.isActive ? '⏸ Остановить' : '🚀 Запустить', callback_data: `run_agent:${agentId}` },
        { text: '📋 Логи', callback_data: `show_logs:${agentId}` },
      ],
    ];

    if (hasError) {
      keyboard.push([{ text: '🔧 AI Автопочинка', callback_data: `auto_repair:${agentId}` }]);
    }

    keyboard.push([
      { text: '👁 Код', callback_data: `show_code:${agentId}` },
      { text: '🔍 Аудит', callback_data: `audit_agent:${agentId}` },
    ]);
    keyboard.push([
      { text: '✏️ Изменить', callback_data: `edit_agent:${agentId}` },
      { text: '🗑 Удалить', callback_data: `delete_agent:${agentId}` },
    ]);
    keyboard.push([{ text: '◀️ Все агенты', callback_data: 'list_agents' }]);

    await editOrReply(ctx, text, { reply_markup: { inline_keyboard: keyboard } });
  } catch (err) {
    await ctx.reply('❌ Ошибка загрузки агента');
  }
}

// ============================================================
// TON Connect
// ============================================================
async function showTonConnect(ctx: Context) {
  const userId = ctx.from!.id;
  const tonConn = getTonConnectManager();

  if (tonConn.isConnected(userId)) {
    // ── Кошелёк уже подключён ──
    const wallet = tonConn.getWallet(userId)!;
    const bal = await tonConn.getBalance(userId);
    await safeReply(ctx,
      `💎 *TON Connect*\n\n` +
      `✅ Кошелёк подключён\n` +
      `👛 ${esc(wallet.walletName)}\n` +
      `📋 Адрес: \`${esc(wallet.friendlyAddress)}\`\n` +
      `💰 Баланс: *${esc(bal.ton)}* TON\n\n` +
      `Что хотите сделать?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Обновить баланс', callback_data: 'ton_refresh' }],
            [{ text: '💸 Отправить TON', callback_data: 'ton_send' }],
            [{ text: '📋 История транзакций', callback_data: 'ton_history' }],
            [{ text: '🔌 Отключить кошелёк', callback_data: 'ton_disconnect' }],
          ],
        },
      }
    );
  } else {
    // ── Генерируем ссылку для подключения ──
    const result = await tonConn.generateConnectLink(userId);

    if (result.error || !result.universalLink) {
      await safeReply(ctx,
        `💎 *TON Connect*\n\n` +
        `⚠️ Не удалось получить ссылку для подключения\\.\n` +
        `${esc(result.error || '')}\n\n` +
        `Используйте /wallet для агентского кошелька \\(без мобильного приложения\\)\\.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Попробовать снова', callback_data: 'ton_connect_menu' }],
              [{ text: '💼 Кошелёк агента', callback_data: 'create_agent_wallet' }],
            ],
          },
        }
      );
      return;
    }

    // Сохраняем ссылку в памяти (для кнопки "скопировать")
    tonConnectLinks.set(userId, result.universalLink);

    // Устанавливаем callback — когда юзер подключится, отправим уведомление
    tonConn.onConnect(userId, async (w) => {
      if (w) {
        try {
          await ctx.telegram.sendMessage(
            userId,
            `✅ Кошелёк подключён!\n\n👛 ${w.walletName}\n📋 ${w.friendlyAddress}`,
          );
        } catch {}
      }
    });

    // Генерируем wallet-specific ссылки из universalLink (TON Connect 2.0)
    // Формат: https://app.tonkeeper.com/ton-connect?v=2&id=...&r=...
    const baseLink = result.universalLink;
    const linkParams = baseLink.includes('?') ? baseLink.slice(baseLink.indexOf('?')) : '';

    // Популярные кошельки — поддерживают TON Connect 2.0
    const walletButtons = [
      [{ text: '📱 Tonkeeper', url: baseLink }],
      [
        { text: '🔷 MyTonWallet', url: `https://mytonwallet.io/ton-connect${linkParams}` },
        { text: '🟡 TonHub', url: `https://tonhub.com/ton-connect${linkParams}` },
      ],
      [
        { text: '🟣 DeWallet', url: `https://t.me/DeWalletBot?startapp=tonconnect-${encodeURIComponent(baseLink)}` },
        { text: '⚡ OpenMask', url: `https://app.openmask.app/ton-connect${linkParams}` },
      ],
      [{ text: '🔗 Ссылка для любого кошелька', callback_data: 'ton_get_link' }],
      [{ text: '💼 Кошелёк агента (offline)', callback_data: 'create_agent_wallet' }],
    ];

    // Отправляем plain text — MarkdownV2 ломается на URL
    await ctx.reply(
      `💎 Подключение TON кошелька\n\n` +
      `Выберите ваш кошелёк и подтвердите подключение:\n\n` +
      `1. Нажмите кнопку вашего кошелька\n` +
      `2. Подтвердите в приложении\n` +
      `3. Бот уведомит об успехе ✅\n\n` +
      `Поддерживаются: Tonkeeper, MyTonWallet, TonHub, DeWallet и другие TON Connect v2 кошельки`,
      { reply_markup: { inline_keyboard: walletButtons } }
    );
  }
}

// ============================================================
// Маркетплейс
// ============================================================
async function showMarketplace(ctx: Context) {
  const CATS = [
    { id: 'ton', icon: '💎', name: 'TON блокчейн' },
    { id: 'finance', icon: '💰', name: 'Финансы' },
    { id: 'monitoring', icon: '📊', name: 'Мониторинг' },
    { id: 'utility', icon: '🔧', name: 'Утилиты' },
    { id: 'social', icon: '📣', name: 'Социальные' },
  ] as const;

  let text = `🏪 *Маркетплейс агентов*\n\n${esc(allAgentTemplates.length)}+ готовых агентов\\. Выберите категорию:\n\n`;
  CATS.forEach(c => {
    const count = allAgentTemplates.filter(t => t.category === c.id).length;
    if (count > 0) text += `${c.icon} *${esc(c.name)}* — ${esc(count)} агентов\n`;
  });

  const btns = CATS.filter(c => allAgentTemplates.filter(t => t.category === c.id).length > 0)
    .map(c => [{ text: `${c.icon} ${c.name}`, callback_data: `marketplace_cat:${c.id}` }]);
  btns.push([{ text: '📋 Все агенты', callback_data: 'marketplace_all' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showMarketplaceAll(ctx: Context) {
  const templates = allAgentTemplates.slice(0, 20);
  let text = `📋 *Все агенты (${allAgentTemplates.length}):*\n\n`;
  templates.forEach(t => { text += `${t.icon} *${esc(t.name)}* — ${esc(t.description.slice(0, 50))}\n`; });

  const btns = templates.map(t => [{ text: `${t.icon} ${t.name}`, callback_data: `template:${t.id}` }]);
  btns.push([{ text: '◀️ Назад', callback_data: 'marketplace' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showMarketplaceCategory(ctx: Context, category: AgentTemplate['category']) {
  const templates = allAgentTemplates.filter(t => t.category === category);
  if (!templates.length) { await ctx.reply('❌ Агенты не найдены', { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'marketplace' }]] } }); return; }

  const catNames: Record<string, string> = {
    ton: '💎 TON блокчейн', finance: '💰 Финансы', monitoring: '📊 Мониторинг',
    utility: '🔧 Утилиты', social: '📣 Социальные',
  };
  let text = `${catNames[category] || category} \\— *${esc(templates.length)} агентов*\n\nВыберите агента:\n\n`;
  templates.forEach(t => { text += `${t.icon} *${esc(t.name)}*\n${esc(t.description.slice(0, 60))}\n\n`; });

  const btns = templates.map(t => [{ text: `${t.icon} ${t.name}`, callback_data: `template:${t.id}` }]);
  btns.push([{ text: '◀️ Маркетплейс', callback_data: 'marketplace' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showTemplateDetails(ctx: Context, templateId: string) {
  const t = allAgentTemplates.find(x => x.id === templateId);
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  let text = `${t.icon} *${esc(t.name)}*\n\n${esc(t.description)}\n\n`;
  text += `🏷 Теги: ${t.tags.map(x => `\`${esc(x)}\``).join(', ')}\n`;
  text += `⚡ Триггер: ${t.triggerType === 'scheduled' ? '⏰ По расписанию' : t.triggerType === 'webhook' ? '🔗 Webhook' : '▶️ Вручную'}\n`;

  if (t.triggerType === 'scheduled' && t.triggerConfig.intervalMs) {
    const ms = t.triggerConfig.intervalMs;
    const label = ms >= 86400000 ? `${ms / 86400000} дн` : ms >= 3600000 ? `${ms / 3600000} ч` : `${ms / 60000} мин`;
    text += `⏱ Интервал: каждые ${esc(label)}\n`;
  }

  if (t.placeholders.length) {
    text += `\n⚙️ *Параметры:*\n`;
    t.placeholders.forEach(p => { text += `• \`${esc(p.name)}\` — ${esc(p.description)}${p.required ? ' *(обяз.)*' : ''}\n`; });
  }

  await editOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `✅ Создать этого агента`, callback_data: `create_from_template:${t.id}` }],
        [{ text: '◀️ Назад', callback_data: `marketplace_cat:${t.category}` }, { text: '🏪 Маркетплейс', callback_data: 'marketplace' }],
      ],
    },
  });
}

async function createAgentFromTemplate(ctx: Context, templateId: string, userId: number) {
  const t = allAgentTemplates.find(x => x.id === templateId);
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  await ctx.sendChatAction('typing');
  const name = t.id + '_' + Date.now().toString(36).slice(-4);
  const result = await getDBTools().createAgent({
    userId,
    name,
    description: t.description,
    code: t.code,
    triggerType: t.triggerType,
    triggerConfig: t.triggerConfig,
    isActive: false,
  });

  if (!result.success) { await ctx.reply(`❌ Ошибка: ${result.error}`); return; }
  const agent = result.data!;

  let text = `✅ *Агент создан из шаблона!*\n\n${t.icon} *${esc(t.name)}*\nID: #${esc(agent.id)}\n`;
  if (t.placeholders.length) {
    text += `\n⚙️ *Настройте параметры:*\n`;
    t.placeholders.forEach(p => { text += `• \`${esc(p.name)}\` — ${esc(p.description)}${p.required ? ' *(обяз.)*' : ''}\n`; });
    text += `\nНапишите: _"Измени агента #${agent.id}, укажи ${t.placeholders[0].name}=значение"_\n`;
  }
  text += `\nАгент запускается на нашем сервере — установка не нужна ✅`;

  await safeReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Запустить', callback_data: `run_agent:${agent.id}` }, { text: '👁 Код', callback_data: `show_code:${agent.id}` }],
        [{ text: '📋 Мои агенты', callback_data: 'list_agents' }],
      ],
    },
  });
  await showAgentsList(ctx, userId);
}

// ============================================================
// Плагины
// ============================================================
async function showPlugins(ctx: Context) {
  const mgr = getPluginManager();
  const plugins = mgr.getAllPlugins();
  const stats = mgr.getStats();

  let text = `🔌 *Маркетплейс плагинов*\n\n`;
  text += `Всего: *${esc(stats.total)}* | Установлено: *${esc(stats.installed)}*\n`;
  text += `Рейтинг: *${esc(stats.averageRating.toFixed(1))}* ⭐\n\n`;
  text += `*Категории:*\n`;
  text += `💰 DeFi: ${esc(stats.byType.defi || 0)}\n`;
  text += `📊 Аналитика: ${esc(stats.byType.analytics || 0)}\n`;
  text += `🔔 Уведомления: ${esc(stats.byType.notification || 0)}\n`;
  text += `🌐 Данные: ${esc(stats.byType['data-source'] || 0)}\n`;
  text += `🔒 Безопасность: ${esc(stats.byType.security || 0)}\n\n`;
  text += `Выберите плагин:`;

  const btns = plugins.slice(0, 6).map(p => [{
    text: `${p.isInstalled ? '✅' : '⬜'} ${p.name} ${p.price > 0 ? `(${p.price} TON)` : '(бесплатно)'}`,
    callback_data: `plugin:${p.id}`,
  }]);
  btns.push([{ text: '📋 Все плагины', callback_data: 'plugins_all' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showAllPlugins(ctx: Context) {
  const plugins = getPluginManager().getAllPlugins();
  let text = `🔌 *Все плагины (${esc(plugins.length)}):*\n\n`;
  plugins.forEach((p, i) => {
    text += `${esc(i + 1)}\\. ${p.isInstalled ? '✅' : '⬜'} *${esc(p.name)}* ${p.price > 0 ? `\\(${esc(p.price)} TON\\)` : '\\(free\\)'}\n`;
    text += `   ${esc(p.description.slice(0, 50))}\\.\\.\\.\n`;
  });
  const btns = plugins.map(p => [{ text: p.name, callback_data: `plugin:${p.id}` }]);
  btns.push([{ text: '◀️ Назад', callback_data: 'plugins' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns.slice(0, 10) } });
}

async function showPluginDetails(ctx: Context, pluginId: string) {
  const plugin = getPluginManager().getPlugin(pluginId);
  if (!plugin) { await ctx.reply('❌ Плагин не найден'); return; }

  let text =
    `🔌 *${esc(plugin.name)}*\n\n` +
    `${esc(plugin.description)}\n\n` +
    `👤 Автор: ${esc(plugin.author)}\n` +
    `⭐ Рейтинг: ${esc(plugin.rating)}/5\n` +
    `📥 Скачиваний: ${esc(plugin.downloads)}\n` +
    `💰 Цена: ${plugin.price > 0 ? `${esc(plugin.price)} TON` : 'Бесплатно'}\n` +
    `🏷 Теги: ${esc(plugin.tags.join(', '))}`;

  await editOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: plugin.isInstalled ? '🗑 Удалить' : '📥 Установить', callback_data: `plugin_${plugin.isInstalled ? 'uninstall' : 'install'}:${pluginId}` }],
        [{ text: '◀️ Назад', callback_data: 'plugins' }],
      ],
    },
  });
}

// ============================================================
// Workflow
// ============================================================
async function showWorkflows(ctx: Context, userId: number) {
  const engine = getWorkflowEngine();
  const workflows = engine.getUserWorkflows(userId);
  const templates = engine.getWorkflowTemplates();

  let text = `⚡ *Workflow — цепочки агентов*\n\n`;
  text += `Соединяйте агентов в автоматические цепочки\\.\n`;
  text += `Например: _проверь баланс → если мало → уведоми_\n\n`;

  if (workflows.length) {
    text += `*Ваши workflow \\(${esc(workflows.length)}\\):*\n`;
    workflows.forEach(wf => {
      text += `⚡ ${esc(wf.name)} — ${esc(wf.nodes.length)} шагов\n`;
    });
    text += '\n';
  }

  text += `*Готовые шаблоны:*\n`;
  templates.forEach((t, i) => { text += `${esc(i + 1)}\\. ${esc(t.name)}\n`; });

  const btns = templates.map((t, i) => [{ text: `📋 ${t.name}`, callback_data: `workflow_template:${i}` }]);
  btns.push([{ text: '🤖 Описать workflow (AI создаст)', callback_data: 'workflow_describe' }]);
  btns.push([{ text: '➕ Выбрать шаблон', callback_data: 'workflow_create' }]);
  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showWorkflowTemplate(ctx: Context, idx: number) {
  const templates = getWorkflowEngine().getWorkflowTemplates();
  const t = templates[idx];
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  const text =
    `⚡ *${esc(t.name)}*\n\n${esc(t.description)}\n\n` +
    `Узлов: *${esc(t.nodes.length)}*\n\nНажмите "Создать" чтобы запустить этот workflow:`;

  await editOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Создать workflow', callback_data: `workflow_create_from:${idx}` }],
        [{ text: '◀️ Назад', callback_data: 'workflow' }],
      ],
    },
  });
}

async function createWorkflowFromTemplate(ctx: Context, userId: number, idx: number) {
  const engine = getWorkflowEngine();
  const templates = engine.getWorkflowTemplates();
  const t = templates[idx];
  if (!t) { await ctx.reply('❌ Шаблон не найден'); return; }

  const nodes = t.nodes.map((n, i) => ({ ...n, agentId: i + 1 }));
  const result = await engine.createWorkflow(userId, t.name, t.description, nodes);

  if (result.success) {
    await safeReply(ctx,
      `✅ *Workflow создан\\!*\n\nНазвание: ${esc(t.name)}\nID: ${esc(result.workflowId)}\n\nАгенты кооперируются автоматически \\!`
    );
  } else {
    await ctx.reply(`❌ Ошибка: ${result.error}`);
  }
}

// ============================================================
// Статистика
// ============================================================
async function showStats(ctx: Context, userId: number) {
  const r = await getDBTools().getUserAgents(userId);
  const agents = r.data || [];
  const active = agents.filter(a => a.isActive).length;
  const scheduled = agents.filter(a => a.triggerType === 'scheduled').length;
  const pluginStats = getPluginManager().getStats();
  const tonConn = getTonConnectManager();
  const isConnected = tonConn.isConnected(userId);
  const wallet = isConnected ? tonConn.getWallet(userId) : null;
  const agentWallet = agentWallets.get(userId);
  const agentBalance = agentWallet ? await getWalletBalance(agentWallet.address) : null;
  const isOwner = userId === parseInt(process.env.OWNER_ID || '0');
  const currentModel = getUserModel(userId);
  const modelInfo = MODEL_LIST.find(m => m.id === currentModel);

  let text =
    `📊 *Ваша панель управления*\n\n` +
    `━━━ 🤖 Агенты ━━━\n` +
    `Всего: *${esc(agents.length)}* · Активных: *${esc(active)}* · По расписанию: *${esc(scheduled)}*\n\n` +
    `━━━ 💎 TON ━━━\n`;

  if (isConnected && wallet) {
    text += `TON Connect: ✅ ${esc(wallet.walletName)}\n`;
    text += `Адрес: \`${esc(wallet.friendlyAddress)}\`\n`;
  } else {
    text += `TON Connect: ❌ не подключён\n`;
  }

  if (agentBalance !== null) {
    text += `Агентский кошелёк: *${esc(agentBalance.toFixed(4))}* TON\n`;
  }

  text +=
    `\n━━━ 🧠 AI ━━━\n` +
    `Модель: ${esc(modelInfo?.icon || '')} *${esc(modelInfo?.label || currentModel)}*\n` +
    `Авто\\-fallback: ✅ включён\n\n` +
    `━━━ 🔌 Плагины ━━━\n` +
    `Доступно: *${esc(pluginStats.total)}* · Установлено: *${esc(pluginStats.installed)}*`;

  const keyboard: any[][] = [
    [
      { text: '🤖 Мои агенты', callback_data: 'list_agents' },
      { text: '🧠 Сменить модель', callback_data: 'model_selector' },
    ],
  ];
  if (isConnected) {
    keyboard.push([{ text: '💎 TON кошелёк', callback_data: 'ton_connect' }]);
  } else {
    keyboard.push([{ text: '💎 Подключить TON', callback_data: 'ton_connect' }]);
  }
  if (isOwner) {
    keyboard.push([{ text: '⚙️ Настройки платформы', callback_data: 'platform_settings' }]);
  }

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ============================================================
// Выбор модели AI
// ============================================================
async function showModelSelector(ctx: Context) {
  const userId = ctx.from!.id;
  const current = getUserModel(userId);
  const currentInfo = MODEL_LIST.find(m => m.id === current);

  let text =
    `🧠 *Выбор AI модели*\n\n` +
    `Активная: ${esc(currentInfo?.icon || '')} *${esc(currentInfo?.label || current)}*\n\n` +
    `При недоступности — бот автоматически пробует следующую модель в цепочке\\.\n\n` +
    `*Доступные модели:*\n`;

  MODEL_LIST.forEach(m => {
    const isCurrent = m.id === current;
    const tags: string[] = [];
    if ((m as any).recommended) tags.push('⭐ рекомендована');
    if ((m as any).fast) tags.push('⚡ быстрая');
    const tagStr = tags.length ? ` — _${esc(tags.join(', '))}_` : '';
    text += `${isCurrent ? '▶️' : '  '} ${m.icon} ${esc(m.label)}${esc(isCurrent ? ' ✅' : '')}${tagStr}\n`;
  });

  const btns = MODEL_LIST.map(m => [{
    text: `${m.id === current ? '✅ ' : ''}${m.icon} ${m.label}`,
    callback_data: `set_model:${m.id}`,
  }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

// ============================================================
// Подписки и оплата
// ============================================================

async function showSubscription(ctx: Context) {
  const userId = ctx.from!.id;
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.planId] || PLANS.free;
  const isOwner = userId === OWNER_ID_NUM;

  let text =
    `💳 *Подписка*\n\n` +
    `Текущий план: ${formatSubscription(sub)}\n\n` +
    `━━━ ${plan.icon} ${esc(plan.name)} ━━━\n`;

  plan.features.forEach(f => { text += `✅ ${esc(f)}\n`; });

  // Показываем использование генераций
  const genUsed = getGenerationsUsed(userId);
  const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
  text += `\n⚡ Генерации AI: *${esc(genUsed)}/${esc(genLimit)}* в этом месяце\n`;
  if (plan.pricePerGeneration > 0) {
    text += `💸 Цена за генерацию: *${esc(plan.pricePerGeneration)} TON*\n`;
  }

  if (!isOwner && plan.id === 'free') {
    text +=
      `\n💡 *Upgrade для большего:*\n` +
      `• До 100 агентов одновременно\n` +
      `• Включённые генерации AI/мес\n` +
      `• Расписание + Webhook + Workflow\n` +
      `• API доступ`;
  } else if (!isOwner && sub.expiresAt) {
    const days = Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86400000);
    text += `\n⏳ Истекает через *${esc(days)}* дн\\.`;
  }

  const btns: any[][] = [];
  if (!isOwner) {
    btns.push([{ text: '🚀 Улучшить план', callback_data: 'plans_menu' }]);
  }
  btns.push([
    { text: '🤖 Мои агенты', callback_data: 'list_agents' },
    { text: '💎 TON Connect', callback_data: 'ton_connect' },
  ]);

  await safeReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showPlans(ctx: Context) {
  const userId = ctx.from!.id;
  const currentSub = await getUserSubscription(userId);

  let text =
    `🚀 *Планы TON Agent Platform*\n\n` +
    `Оплата в TON прямо из Telegram через Tonkeeper\\.\n` +
    `Владелец получает мгновенно \\— без посредников\\.\n\n`;

  const planOrder = ['free', 'starter', 'pro', 'unlimited'];
  for (const pid of planOrder) {
    const p = PLANS[pid];
    const isCurrent = currentSub.planId === pid;
    text += `${isCurrent ? '▶️' : '  '} ${p.icon} *${esc(p.name)}*`;
    if (p.priceMonthTon === 0) {
      text += ' — _бесплатно_\n';
    } else {
      text += ` — ${esc(p.priceMonthTon)} TON/мес _или_ ${esc(p.priceYearTon)} TON/год\n`;
    }
    text += `   ${esc(p.features.slice(0, 2).join(' · '))}\n\n`;
  }

  const btns: any[][] = [];
  for (const pid of ['starter', 'pro', 'unlimited']) {
    const p = PLANS[pid];
    if (currentSub.planId === pid) continue;
    btns.push([
      { text: `${p.icon} ${p.name} — ${p.priceMonthTon} TON/мес`, callback_data: `buy_plan:${pid}:month` },
    ]);
    btns.push([
      { text: `${p.icon} ${p.name} — ${p.priceYearTon} TON/год (−20%)`, callback_data: `buy_plan:${pid}:year` },
    ]);
  }
  btns.push([{ text: '◀️ Назад', callback_data: 'subscription' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function showPaymentInvoice(ctx: Context, planId: string, period: 'month' | 'year') {
  const userId = ctx.from!.id;
  const payment = createPayment(userId, planId, period);

  if ('error' in payment) {
    await ctx.reply(`❌ ${payment.error}`);
    return;
  }

  const plan = PLANS[planId];
  const periodLabel = period === 'year' ? 'год' : 'месяц';
  const expiresMin = Math.ceil((payment.expiresAt.getTime() - Date.now()) / 60000);
  const tonConn = getTonConnectManager();
  const isConnected = tonConn.isConnected(userId);

  let text =
    `💳 *Оплата подписки*\n\n` +
    `${plan.icon} *${esc(plan.name)}* на ${esc(periodLabel)}\n` +
    `Сумма: *${esc(payment.amountTon)} TON*\n\n` +
    `━━━ Способы оплаты ━━━\n\n`;

  if (isConnected) {
    text +=
      `*1\\. Через подключённый кошелёк* \\(рекомендуется\\)\n` +
      `Нажмите кнопку — подтвердите в Tonkeeper\n\n`;
  }

  text +=
    `*${isConnected ? '2' : '1'}\\. Вручную*\n` +
    `Отправьте *${esc(payment.amountTon)} TON* на адрес:\n` +
    `\`${esc(payment.address)}\`\n\n` +
    `Комментарий \\(обязательно\\):\n` +
    `\`${esc(payment.comment)}\`\n\n` +
    `⏱ Счёт действителен *${esc(expiresMin)} мин*\\.`;

  const btns: any[][] = [];
  if (isConnected) {
    btns.push([{ text: `💸 Оплатить ${payment.amountTon} TON через Tonkeeper`, callback_data: `pay_tonconnect:${planId}:${period}` }]);
  }
  btns.push([{ text: '✅ Я оплатил — проверить', callback_data: 'check_payment' }]);
  btns.push([{ text: '◀️ Отмена', callback_data: 'cancel_payment' }]);

  await editOrReply(ctx, text, { reply_markup: { inline_keyboard: btns } });
}

async function checkPaymentStatus(ctx: Context) {
  const userId = ctx.from!.id;
  const pending = getPendingPayment(userId);

  if (!pending) {
    await ctx.reply('❌ Нет ожидающего платежа. Создайте новый через /plans');
    return;
  }

  await ctx.reply('🔍 Проверяю транзакцию...');

  const verify = await verifyTonTransaction(userId, pending.amountTon);

  if (verify.found && verify.txHash) {
    const result = await confirmPayment(userId, verify.txHash);
    if (result.success && result.plan) {
      const expStr = result.expiresAt
        ? result.expiresAt.toLocaleDateString('ru-RU')
        : 'бессрочно';
      await safeReply(ctx,
        `🎉 *Оплата подтверждена\\!*\n\n` +
        `${result.plan.icon} *${esc(result.plan.name)}* активирован\n` +
        `Действует до: *${esc(expStr)}*\n\n` +
        `Спасибо за поддержку платформы\\! 🙏`
      );
      await showSubscription(ctx);
    }
  } else {
    const minLeft = Math.ceil((pending.expiresAt.getTime() - Date.now()) / 60000);
    await ctx.reply(
      `⏳ Транзакция ещё не найдена\\.\n\n` +
      `Убедитесь что отправили *${pending.amountTon} TON*\n` +
      `с комментарием: \`sub:${pending.planId}:${pending.period}:${userId}\`\n\n` +
      `Осталось времени: *${minLeft} мин*\nПопробуйте снова через 1-2 минуты\\.`,
      { parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [
          [{ text: '🔄 Проверить снова', callback_data: 'check_payment' }],
          [{ text: '◀️ Отмена', callback_data: 'cancel_payment' }],
        ]}
      }
    );
  }
}

// ============================================================
// Помощь
// ============================================================
async function showHelp(ctx: Context) {
  const text =
    `❓ *TON Agent Platform — Справка*\n\n` +
    `━━━ 🚀 Как создать агента ━━━\n\n` +
    `Просто напишите задачу своими словами:\n` +
    `_"проверяй баланс кошелька UQ\\.\\.\\. каждый час"_\n` +
    `_"следи за ценой TON, уведоми если выше 5\\$"_\n` +
    `_"каждое 10\\-е число отправляй 50 TON на UQ\\.\\.\\."_\n\n` +
    `Агент создаётся автоматически и запускается на нашем сервере — *ничего устанавливать не нужно*\\.\n\n` +
    `━━━ 📋 Команды ━━━\n\n` +
    `/start — главное меню\n` +
    `/list — мои агенты\n` +
    `/run ID — запустить агента \\(пример: /run 3\\)\n` +
    `/model — выбрать AI модель\n` +
    `/sub — моя подписка\n` +
    `/plans — тарифы и оплата\n` +
    `/connect — подключить TON кошелёк \\(Tonkeeper\\)\n` +
    `/wallet — агентский кошелёк \\(без мобильного приложения\\)\n` +
    `/marketplace — готовые шаблоны агентов\n\n` +
    `━━━ 💡 Что умеют агенты ━━━\n\n` +
    `• Работать с *любыми* публичными API\n` +
    `• Мониторить TON\\-кошельки и цены\n` +
    `• Отправлять TON по расписанию\n` +
    `• Делать запросы к DEX \\(DeDust, STON\\.fi\\)\n` +
    `• Уведомлять вас в Telegram`;

  await safeReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏪 Маркетплейс', callback_data: 'marketplace' },
          { text: '🤖 Мои агенты', callback_data: 'list_agents' },
        ],
        [
          { text: '🧠 AI модель', callback_data: 'model_selector' },
          { text: '💎 TON кошелёк', callback_data: 'ton_connect' },
        ],
      ],
    },
  });
}

// ============================================================
// Обработка ошибок
// ============================================================
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте /start').catch(() => {});
});

// ============================================================
// Запуск
// ============================================================
export function startBot() {
  initNotifier(bot);

  console.log('🤖 Starting TON Agent Platform Bot...');
  console.log(`🏪 Loaded ${allAgentTemplates.length} agent templates`);
  console.log(`🔌 Loaded ${getPluginManager().getAllPlugins().length} plugins`);

  // Retry logic: if Telegram returns 409 (previous polling still active) — wait and retry
  const launch = (attempt = 1) => {
    bot.launch({ dropPendingUpdates: true }).catch((err: any) => {
      const is409 = err?.response?.error_code === 409 || String(err?.message).includes('409');
      if (is409 && attempt < 6) {
        const delay = attempt * 5000;
        console.warn(`[Bot] 409 Conflict — waiting ${delay / 1000}s before retry (attempt ${attempt}/5)...`);
        setTimeout(() => launch(attempt + 1), delay);
      } else {
        console.error('[Bot] Fatal launch error:', err?.message || err);
        process.exit(1);
      }
    });
  };

  launch();
  console.log('✅ Bot is running!');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };
