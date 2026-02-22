import { Scenes, Markup } from 'telegraf';
import { getRunnerAgent } from '../agents/sub-agents/runner';
import { getDBTools } from '../agents/tools/db-tools';

// Сцена выполнения агента
export const executeScene = new Scenes.BaseScene<Scenes.SceneContext>('execute');

// Ленивая инициализация
const getRunner = () => getRunnerAgent();
const getDB = () => getDBTools();

// Вход в сцену
executeScene.enter(async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Ошибка: не удалось определить пользователя');
    return ctx.scene.leave();
  }

  // Получаем список агентов
  const result = await getDB().getUserAgents(userId);

  if (!result.success || !result.data || result.data.length === 0) {
    await ctx.reply('У вас пока нет агентов. Создайте первого: "Создай агента для ..."');
    return ctx.scene.leave();
  }

  // Показываем список с кнопками
  const buttons = result.data.map((agent) => [
    Markup.button.callback(
      `${agent.isActive ? '🟢' : '⏸'} ${agent.name}`,
      `select_agent:${agent.id}`
    ),
  ]);

  await ctx.reply(
    'Выберите агента для запуска:',
    Markup.inlineKeyboard(buttons)
  );
});

// Выбор агента
executeScene.action(/select_agent:(\d+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const agentId = parseInt(ctx.match[1]);

  // Показываем меню действий
  await ctx.editMessageText(
    `Агент #${agentId}\n\nВыберите действие:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🚀 Запустить', `run:${agentId}`),
        Markup.button.callback('⏸ Пауза', `pause:${agentId}`),
      ],
      [
        Markup.button.callback('📋 Логи', `logs:${agentId}`),
        Markup.button.callback('🔍 Аудит', `audit:${agentId}`),
      ],
      [Markup.button.callback('« Назад', 'back_to_list')],
    ])
  );

  await ctx.answerCbQuery();
});

// Запуск агента
executeScene.action(/run:(\d+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const agentId = parseInt(ctx.match[1]);

  await ctx.answerCbQuery('Запускаю...');

  const result = await getRunner().runAgent({ agentId, userId });

  if (result.success && result.data?.executionResult) {
    const exec = result.data.executionResult;
    let content = `📊 **Результат выполнения**\n\n`;
    content += `Статус: ${exec.success ? '✅ Успешно' : '❌ Ошибка'}\n`;
    content += `Время: ${exec.executionTime}ms\n\n`;

    if (exec.logs.length > 0) {
      content += '**Логи:**\n';
      exec.logs.slice(-10).forEach((log) => {
        const emoji = log.level === 'error' ? '🔴' :
                     log.level === 'warn' ? '🟡' :
                     log.level === 'success' ? '🟢' : '⚪';
        content += `${emoji} ${log.message}\n`;
      });
    }

    await ctx.reply(content, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`❌ Ошибка: ${result.error || result.data?.message}`);
  }
});

// Пауза агента
executeScene.action(/pause:(\d+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const agentId = parseInt(ctx.match[1]);

  const result = await getRunner().pauseAgent(agentId, userId);
  await ctx.answerCbQuery(result.message || 'Готово');

  if (result.success) {
    await ctx.reply('⏸ Агент приостановлен');
  } else {
    await ctx.reply(`❌ ${result.error}`);
  }
});

// Показать логи
executeScene.action(/logs:(\d+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const agentId = parseInt(ctx.match[1]);

  const logsResult = await getRunner().getLogs(agentId, userId, 15);

  if (logsResult.success && logsResult.data && logsResult.data.logs.length > 0) {
    let content = `📋 **Логи агента #${agentId}**\n\n`;
    logsResult.data.logs.forEach((log) => {
      const emoji = log.level === 'error' ? '🔴' :
                   log.level === 'warn' ? '🟡' :
                   log.level === 'success' ? '🟢' : '⚪';
      const time = new Date(log.timestamp).toLocaleTimeString();
      content += `[${time}] ${emoji} ${log.message}\n`;
    });
    await ctx.reply(content, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply('Логи не найдены');
  }

  await ctx.answerCbQuery();
});

// Аудит агента
executeScene.action(/audit:(\d+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const agentId = parseInt(ctx.match[1]);

  const { getAnalystAgent } = await import('../agents/sub-agents/analyst');
  const analyst = getAnalystAgent();

  const audit = await analyst.auditAgent(agentId, userId);

  if (audit.success && audit.data) {
    await ctx.reply(audit.data.content, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`❌ Ошибка аудита: ${audit.error}`);
  }

  await ctx.answerCbQuery();
});

// Назад к списку
executeScene.action('back_to_list', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('execute');
});

// Выход из сцены
executeScene.leave(async (ctx) => {
  await ctx.reply('Вышли из меню выполнения');
});

// Экспорт всех сцен
export const scenes = [executeScene];