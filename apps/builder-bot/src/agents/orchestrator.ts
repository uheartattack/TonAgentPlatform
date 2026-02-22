import OpenAI from 'openai';
import { getCreatorAgent } from './sub-agents/creator';
import { getWorkflowEngine } from '../agent-cooperation';
import { getEditorAgent } from './sub-agents/editor';
import { getRunnerAgent } from './sub-agents/runner';
import { getAnalystAgent } from './sub-agents/analyst';
import { getDBTools } from './tools/db-tools';
import { getMemoryManager } from '../db/memory';
import { canCreateAgent, canGenerateForFree, trackGeneration, getUserSubscription, PLANS, getGenerationsUsed } from '../payments';

// CLIProxyAPIPlus — OpenAI-совместимый прокси
const PROXY_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || 'ton-agent-key-123';
const PROXY_BASE_URL = process.env.OPENAI_BASE_URL || `${process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317'}/v1`;
const openai = new OpenAI({ apiKey: PROXY_API_KEY, baseURL: PROXY_BASE_URL });

// ── Список моделей с fallback-цепочкой ──────────────────────
// При ошибке одной — пробуем следующую
export const MODEL_LIST = [
  { id: 'claude-opus-4-6',              label: 'Claude Opus 4.6',         icon: '🟣', recommended: true },
  { id: 'kiro-claude-opus-4-6-agentic', label: 'Claude Opus 4.6 Agentic', icon: '⚡' },
  { id: 'gemini-3.1-pro-high',          label: 'Gemini 3.1 Pro High',     icon: '🔷' },
  { id: 'claude-sonnet-4-5',            label: 'Claude Sonnet 4.5',       icon: '🔵' },
  { id: 'kiro-claude-sonnet-4-5',       label: 'Claude Sonnet 4.5 Kiro',  icon: '🔵' },
  { id: 'claude-haiku-4-5',             label: 'Claude Haiku 4.5',        icon: '🟢', fast: true },
] as const;
export type ModelId = typeof MODEL_LIST[number]['id'];

const DEFAULT_MODEL: ModelId = (process.env.CLAUDE_MODEL as ModelId) || 'claude-opus-4-6';

// Per-user выбранная модель (in-memory, сбрасывается при рестарте)
const userModels = new Map<number, ModelId>();

export function getUserModel(userId: number): ModelId {
  return userModels.get(userId) || DEFAULT_MODEL;
}
export function setUserModel(userId: number, model: ModelId) {
  userModels.set(userId, model);
}

// ── Запрос с авто-fallback по цепочке моделей ───────────────
async function callWithFallback(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  userId: number,
  maxTokens = 1024,
): Promise<{ text: string; model: string }> {
  const preferred = getUserModel(userId);
  // Строим цепочку: предпочтительная первая, остальные за ней
  const chain = [preferred, ...MODEL_LIST.map(m => m.id).filter(id => id !== preferred)];

  for (const model of chain) {
    try {
      const response = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages,
        temperature: 0.7,
      });
      const text = response.choices[0]?.message?.content || '';
      if (!text) throw new Error('Empty response');
      return { text, model };
    } catch (err: any) {
      const msg: string = err?.message || err?.error?.message || String(err);
      const isRetryable =
        msg.includes('cooldown') ||
        msg.includes('INSUFFICIENT') ||
        msg.includes('high traffic') ||
        msg.includes('exhausted') ||
        msg.includes('timed out') ||
        msg.includes('timeout') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('ECONNRESET') ||
        msg.includes('Empty response');
      console.warn(`[Orchestrator] model ${model} failed (${msg.slice(0, 80)}), trying next...`);
      if (!isRetryable) throw err; // не ретраим при ошибках авторизации, сети
      // для ретраибл — просто переходим к следующей модели
    }
  }
  throw new Error('Все модели недоступны. Попробуйте через несколько секунд.');
}

// ID владельца (owner)
const OWNER_ID = 130806013;

// Типы намерений (intents)
type UserIntent =
  | 'create_agent'
  | 'edit_agent'
  | 'run_agent'
  | 'delete_agent'
  | 'list_agents'
  | 'explain_agent'
  | 'debug_agent'
  | 'general_chat'
  | 'platform_settings'
  | 'user_management'
  | 'unknown';

// Контекст разговора
interface ConversationContext {
  userId: number;
  isOwner: boolean;
  lastIntent?: UserIntent;
  pendingAction?: {
    type: 'delete' | 'update_settings' | 'manage_user';
    data: any;
  };
  agentContext?: {
    agentId?: number;
    agentName?: string;
  };
}

// Результат обработки
export interface OrchestratorResult {
  type: 'text' | 'buttons' | 'confirm' | 'agent_created';
  content: string;
  buttons?: Array<{
    text: string;
    callbackData: string;
  }>;
  confirmData?: {
    action: string;
    data: any;
  };
  agentId?: number;
}

// ===== Orchestrator - Главный мозг =====

export class Orchestrator {
  // Ленивая инициализация (чтобы избежать ошибок при импорте до подключения БД)
  private get creator() { return getCreatorAgent(); }
  private get editor() { return getEditorAgent(); }
  private get runner() { return getRunnerAgent(); }
  private get analyst() { return getAnalystAgent(); }
  private get dbTools() { return getDBTools(); }

  // Главный метод обработки сообщения
  async processMessage(
    userId: number,
    message: string,
    username?: string
  ): Promise<OrchestratorResult> {
    // Проверяем, является ли пользователь owner
    const isOwner = userId === OWNER_ID;

    // Получаем или создаем сессию
    const session = await getMemoryManager().getOrCreateSession(userId);

    // Проверяем, ждем ли ввод
    const waitingContext = await getMemoryManager().getWaitingContext(userId);
    if (waitingContext) {
      return this.handleWaitingInput(userId, message, waitingContext);
    }

    // Сохраняем сообщение пользователя
    await getMemoryManager().addMessage(userId, 'user', message);

    // Определяем intent
    const intent = await this.detectIntent(message);

    // Обрабатываем по intent
    switch (intent) {
      case 'create_agent':
        return this.handleCreateAgent(userId, message);

      case 'edit_agent':
        return this.handleEditAgent(userId, message);

      case 'run_agent':
        return this.handleRunAgent(userId, message);

      case 'delete_agent':
        return this.handleDeleteAgent(userId, message);

      case 'list_agents':
        return this.handleListAgents(userId);

      case 'explain_agent':
        return this.handleExplainAgent(userId, message);

      case 'debug_agent':
        return this.handleDebugAgent(userId, message);

      case 'platform_settings':
        if (!isOwner) {
          return this.handleUnauthorized(userId);
        }
        return this.handlePlatformSettings(userId, message);

      case 'user_management':
        if (!isOwner) {
          return this.handleUnauthorized(userId);
        }
        return this.handleUserManagement(userId, message);

      case 'general_chat':
      default:
        return this.handleGeneralChat(userId, message);
    }
  }

  // Обработка callback запросов (кнопки)
  async processCallback(
    userId: number,
    callbackData: string
  ): Promise<OrchestratorResult> {
    const [action, ...params] = callbackData.split(':');

    switch (action) {
      case 'confirm_delete': {
        const agentId = parseInt(params[0]);
        const result = await this.dbTools.deleteAgent(agentId, userId);
        return {
          type: 'text',
          content: result.success
            ? `✅ Агент удален`
            : `❌ Ошибка: ${result.error}`,
        };
      }

      case 'cancel_delete':
        return {
          type: 'text',
          content: 'Удаление отменено',
        };

      case 'run_agent': {
        const agentId = parseInt(params[0]);
        const result = await this.runner.runAgent({ agentId, userId });
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

          if (exec.result) {
            content += `\n**Результат:**\n\`\`\`json\n${JSON.stringify(exec.result, null, 2).slice(0, 500)}\n\`\`\``;
          }

          return { type: 'text', content };
        }
        return {
          type: 'text',
          content: result.success ? (result.data?.message ?? '') : `❌ ${result.error}`,
        };
      }

      case 'toggle_agent': {
        const agentId = parseInt(params[0]);
        const result = await this.runner.toggleAgent(agentId, userId);
        return {
          type: 'text',
          content: result.success ? (result.data?.message ?? '') : `❌ ${result.error}`,
        };
      }

      case 'show_logs': {
        const agentId = parseInt(params[0]);
        const logsResult = await this.runner.getLogs(agentId, userId, 15);
        if (logsResult.success && logsResult.data) {
          let content = `📋 **Логи агента #${agentId}**\n\n`;
          logsResult.data.logs.forEach((log) => {
            const emoji = log.level === 'error' ? '🔴' :
                         log.level === 'warn' ? '🟡' :
                         log.level === 'success' ? '🟢' : '⚪';
            const time = new Date(log.timestamp).toLocaleTimeString();
            content += `[${time}] ${emoji} ${log.message}\n`;
          });
          return { type: 'text', content };
        }
        return { type: 'text', content: 'Логи не найдены' };
      }

      case 'audit_agent': {
        const agentId = parseInt(params[0]);
        const audit = await this.analyst.auditAgent(agentId, userId);
        return {
          type: 'text',
          content: audit.success ? audit.data?.content || 'Аудит завершен' : `❌ ${audit.error}`,
        };
      }

      default:
        return {
          type: 'text',
          content: 'Неизвестное действие',
        };
    }
  }

  // ===== Обработчики intent'ов =====

  private async handleCreateAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Проверяем лимит плана (кол-во агентов)
    const agentsList = await this.dbTools.getUserAgents(userId);
    const currentCount = agentsList.data?.length ?? 0;
    const check = await canCreateAgent(userId, currentCount);
    if (!check.allowed) {
      return {
        type: 'text',
        content: `⛔ *Лимит агентов достигнут*\n\n${check.reason}\n\n💳 Улучшите план для создания большего количества агентов:\n/plans`,
        buttons: [{ text: '💳 Улучшить план', callbackData: 'plans_menu' }],
      };
    }

    // Проверяем лимит генераций AI
    const genCheck = await canGenerateForFree(userId);
    if (!genCheck.allowed) {
      const plan = genCheck.plan;
      // Показываем варианты: платить за генерацию или купить подписку
      return {
        type: 'text',
        content: `⚡ *Лимит генераций AI исчерпан*\n\nПлан ${plan.icon} ${plan.name}: ${genCheck.usedThisMonth}/${genCheck.limitPerMonth === 0 ? '0 включено' : genCheck.limitPerMonth} генераций использовано за этот месяц.\n\n*Варианты:*\n• Оплатить эту генерацию: **${genCheck.pricePerGeneration} TON**\n• Улучшить план для большего лимита`,
        buttons: [
          { text: `💸 Оплатить ${genCheck.pricePerGeneration} TON (1 генерация)`, callbackData: `pay_generation:${encodeURIComponent(message.slice(0, 200))}` },
          { text: '💳 Улучшить план', callbackData: 'plans_menu' },
        ],
      };
    }

    // Извлекаем описание (убираем команды-слова, но оставляем суть)
    const description = message
      .replace(/^(создай|создать|сделай|сделать|напиши|написать|make|create|build)\s+/i, '')
      .trim();

    if (description.length < 8) {
      return {
        type: 'text',
        content: '❓ Опишите задачу подробнее.\n\nНапример: _"проверяй баланс кошелька UQ... каждый час и уведоми если меньше 5 TON"_',
      };
    }

    // Создаем агента
    const result = await this.creator.createAgent({
      userId,
      description,
    });

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    // Засчитываем генерацию (даже если агент не прошёл безопасность — AI-вызов состоялся)
    trackGeneration(userId);

    const data = result.data!;

    if (data.needsClarification) {
      // Ждем уточнения
      await getMemoryManager().setWaitingForInput(userId, 'agent_clarification', {
        description,
      });

      return {
        type: 'text',
        content: `🤔 ${data.clarificationQuestion}`,
      };
    }

    if (!data.success) {
      return {
        type: 'text',
        content: `⚠️ ${data.message}`,
      };
    }

    // Формируем ответ — БЕЗ кода, только краткое описание
    let content = `✅ *Агент создан!*\n\n`;
    content += `📛 Имя: ${data.name}\n`;
    content += `🆔 ID: #${data.agentId}\n`;
    content += `🔐 Безопасность: ${data.securityScore}/100\n\n`;

    // Краткое объяснение (не код!) — только первые 2 предложения
    const shortExplanation = data.explanation
      ? data.explanation.split('. ').slice(0, 2).join('. ').slice(0, 200)
      : '';
    if (shortExplanation) {
      content += `📝 ${shortExplanation}\n\n`;
    }

    if (data.placeholders && data.placeholders.length > 0) {
      content += `⚙️ *Настройте параметры перед запуском:*\n`;
      data.placeholders.forEach((p) => {
        content += `• \`${p.name}\` — ${p.description}\n`;
      });
      content += `\nНапишите: _"Измени агента #${data.agentId}, укажи ${data.placeholders[0].name}=значение"_\n\n`;
    }

    content += `Агент запускается на нашем сервере — никакой установки не нужно. Нажмите *Запустить* или посмотрите список агентов 👇`;

    await getMemoryManager().addMessage(userId, 'assistant', content, {
      type: 'agent_created',
      agentId: data.agentId,
    });

    return {
      type: 'agent_created',
      content,
      agentId: data.agentId,
      buttons: [
        { text: '🚀 Запустить сейчас', callbackData: `run_agent:${data.agentId}` },
        { text: '📋 Мои агенты', callbackData: 'list_agents' },
        { text: '👁 Показать код', callbackData: `show_code:${data.agentId}` },
        { text: '🔍 Аудит', callbackData: `audit_agent:${data.agentId}` },
      ],
    };
  }

  private async handleEditAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Пытаемся найти ID агента в сообщении
    const agentIdMatch = message.match(/#?(\d+)|агент[а]?\s+(\w+)/i);

    if (!agentIdMatch) {
      // Показываем список для выбора
      const listResult = await this.dbTools.getUserAgents(userId);
      if (!listResult.success || !listResult.data || listResult.data.length === 0) {
        return {
          type: 'text',
          content: 'У вас пока нет агентов. Создайте первого: "Создай агента для ..."',
        };
      }

      let content = 'Какого агента хотите изменить?\n\n';
      listResult.data.forEach((agent) => {
        content += `#${agent.id}: ${agent.name}\n`;
      });

      return { type: 'text', content };
    }

    const agentId = parseInt(agentIdMatch[1] || agentIdMatch[2]);

    // Извлекаем запрос на изменение
    const modification = message
      .replace(/\b(измени|изменить|edit|update|поменяй)\b/gi, '')
      .replace(/#?\d+/, '')
      .replace(/агент[а]?\s+\w+/i, '')
      .trim();

    if (modification.length < 5) {
      return {
        type: 'text',
        content: 'Что именно хотите изменить? Например:\n"Измени агента #1, добавь проверку баланса каждый час"',
      };
    }

    // Редактируем
    const result = await this.editor.modifyCode({
      userId,
      agentId,
      modificationRequest: modification,
    });

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    const data = result.data!;

    if (!data.success) {
      return {
        type: 'text',
        content: `⚠️ ${data.message}\n\nИзменения не сохранены.`,
      };
    }

    let content = `✅ **Код обновлен!**\n\n`;
    content += `📝 **Изменения:**\n${data.changes}\n\n`;
    content += `🔐 Безопасность: ${data.securityScore}/100`;

    return {
      type: 'buttons',
      content,
      buttons: [
        { text: '🚀 Запустить', callbackData: `run_agent:${agentId}` },
        { text: '🔍 Аудит', callbackData: `audit_agent:${agentId}` },
      ],
    };
  }

  private async handleRunAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Ищем ID агента
    const agentIdMatch = message.match(/#?(\d+)|агент[а]?\s+(\w+)/i);

    if (!agentIdMatch) {
      const listResult = await this.dbTools.getUserAgents(userId);
      if (!listResult.success || !listResult.data || listResult.data.length === 0) {
        return {
          type: 'text',
          content: 'У вас нет агентов для запуска.',
        };
      }

      let content = 'Какого агента запустить?\n\n';
      listResult.data.forEach((agent) => {
        content += `#${agent.id}: ${agent.name} ${agent.isActive ? '✅' : '⏸'}\n`;
      });

      return { type: 'text', content };
    }

    const agentId = parseInt(agentIdMatch[1] || agentIdMatch[2]);

    // Запускаем
    const result = await this.runner.runAgent({ agentId, userId });

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    const data = result.data!;

    if (!data.success || !data.executionResult) {
      return {
        type: 'text',
        content: data.message,
      };
    }

    const exec = data.executionResult;
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

    if (exec.result) {
      content += `\n**Результат:**\n\`\`\`json\n${JSON.stringify(exec.result, null, 2).slice(0, 500)}\n\`\`\``;
    }

    return { type: 'text', content };
  }

  private async handleDeleteAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    const agentIdMatch = message.match(/#?(\d+)/);

    if (!agentIdMatch) {
      return {
        type: 'text',
        content: 'Укажите ID агента для удаления. Например: "Удали агента #1"',
      };
    }

    const agentId = parseInt(agentIdMatch[1]);

    // Получаем инфо для подтверждения
    const agentResult = await this.dbTools.getAgent(agentId, userId);
    if (!agentResult.success) {
      return {
        type: 'text',
        content: `❌ Агент не найден`,
      };
    }

    const agentName = agentResult.data!.name;

    return {
      type: 'confirm',
      content: `⚠️ Вы уверены, что хотите удалить агента "${agentName}" (ID: ${agentId})?\n\nЭто действие нельзя отменить!`,
      confirmData: {
        action: 'delete_agent',
        data: { agentId, userId },
      },
      buttons: [
        { text: '✅ Да, удалить', callbackData: `confirm_delete:${agentId}` },
        { text: '❌ Отмена', callbackData: 'cancel_delete' },
      ],
    };
  }

  private async handleListAgents(userId: number): Promise<OrchestratorResult> {
    const result = await this.dbTools.getUserAgents(userId);

    if (!result.success) {
      return {
        type: 'text',
        content: `❌ Ошибка: ${result.error}`,
      };
    }

    const agents = result.data!;

    if (agents.length === 0) {
      return {
        type: 'text',
        content: 'У вас пока нет агентов.\n\nСоздайте первого: "Создай агента для ..."',
      };
    }

    let content = `📋 **Ваши агенты (${agents.length}):**\n\n`;

    agents.forEach((agent) => {
      const status = agent.isActive ? '🟢' : '⏸';
      const trigger = agent.triggerType === 'manual' ? '▶️' :
                      agent.triggerType === 'scheduled' ? '⏰' :
                      agent.triggerType === 'webhook' ? '🔗' : '📡';
      content += `${status} **#${agent.id}** ${agent.name} ${trigger}\n`;
      if (agent.description) {
        content += `   _${agent.description.slice(0, 50)}..._\n`;
      }
      content += '\n';
    });

    return {
      type: 'buttons',
      content,
      buttons: agents.slice(0, 5).map((a) => ({
        text: `${a.name.slice(0, 15)}`,
        callbackData: `run_agent:${a.id}`,
      })),
    };
  }

  private async handleExplainAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    const agentIdMatch = message.match(/#?(\d+)/);

    if (!agentIdMatch) {
      return {
        type: 'text',
        content: 'Укажите ID агента. Например: "Объясни агента #1"',
      };
    }

    const agentId = parseInt(agentIdMatch[1]);

    const result = await this.analyst.explainAgent(agentId, userId);

    return {
      type: 'text',
      content: result.success
        ? result.data?.content || 'Объяснение готово'
        : `❌ ${result.error}`,
    };
  }

  private async handleDebugAgent(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    const agentIdMatch = message.match(/#?(\d+)/);

    if (!agentIdMatch) {
      return {
        type: 'text',
        content: 'Укажите ID агента. Например: "Проверь агента #1 на ошибки"',
      };
    }

    const agentId = parseInt(agentIdMatch[1]);

    // Получаем код
    const codeResult = await this.dbTools.getAgentCode(agentId, userId);
    if (!codeResult.success) {
      return {
        type: 'text',
        content: `❌ ${codeResult.error}`,
      };
    }

    // Ищем баги
    const result = await this.analyst.findBugs({
      code: codeResult.data!,
    });

    return {
      type: 'text',
      content: result.success
        ? result.data?.content || 'Проверка завершена'
        : `❌ ${result.error}`,
    };
  }

  private async handlePlatformSettings(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Только для owner
    return {
      type: 'text',
      content: '⚙️ Настройки платформы:\n\nПока нет доступных настроек.',
    };
  }

  private async handleUserManagement(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    // Только для owner
    return {
      type: 'text',
      content: '👥 Управление пользователями:\n\nИспользуйте команды:\n- "Покажи пользователей"\n- "Заблокировать пользователя [ID]"',
    };
  }

  private async handleUnauthorized(userId: number): Promise<OrchestratorResult> {
    return {
      type: 'text',
      content: '⛔ У вас нет прав для этого действия.',
    };
  }

  private async handleGeneralChat(
    userId: number,
    message: string
  ): Promise<OrchestratorResult> {
    try {
      // Получаем историю и контекст пользователя
      const history = await getMemoryManager().getLLMHistory(userId, 10);
      const userAgents = await this.dbTools.getUserAgents(userId);
      const agentCount = userAgents.data?.length ?? 0;
      const activeAgents = userAgents.data?.filter(a => a.isActive).length ?? 0;
      const sub = await getUserSubscription(userId);
      const plan = PLANS[sub.planId] || PLANS.free;
      const genUsed = getGenerationsUsed(userId);
      const genLimit = plan.generationsPerMonth === -1 ? '∞' : String(plan.generationsPerMonth);
      const isOwner = userId === OWNER_ID;

      const systemPrompt = `Ты — умный AI-ассистент и поддержка платформы TON Agent Platform.
Ты знаешь ВСЁ о платформе и помогаешь пользователям максимально эффективно.

━━━ ДАННЫЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ━━━
ID: ${userId}${isOwner ? ' (ВЛАДЕЛЕЦ ПЛАТФОРМЫ)' : ''}
Подписка: ${plan.icon} ${plan.name} (${plan.priceMonthTon === 0 ? 'бесплатно' : plan.priceMonthTon + ' TON/мес'})
Агентов: ${agentCount} (активных: ${activeAgents}) / Лимит: ${plan.maxAgents === -1 ? 'безлимит' : plan.maxAgents}
Генераций AI в этом месяце: ${genUsed} / ${genLimit}

━━━ ЧТО УМЕЕТ ПЛАТФОРМА ━━━
• Создание AI-агентов из текстового описания (без кода!)
• Агенты работают на нашем сервере 24/7 — пользователю ничего устанавливать
• Агенты на JavaScript (async function), запускаются в безопасном Node.js VM
• fetch() для любых публичных API — TON Center, CoinGecko, DeDust, STON.fi, любые REST API
• Расписание (каждый час/день/минуту), webhook триггеры, ручной запуск
• TON Connect — подключение Tonkeeper для подписки и переводов
• Workflow — цепочки агентов которые работают последовательно или параллельно
• Маркетплейс готовых шаблонов (15+ агентов)
• Плагины для расширения функционала

━━━ КОМАНДЫ ДЛЯ ПОЛЬЗОВАТЕЛЯ ━━━
/list — список агентов | /run ID — запустить | /create описание — создать
/connect — TON кошелёк | /send АДРЕС СУММА — отправить TON
/sub — подписка | /plans — тарифы | /stats — статистика
/wallet — агентский кошелёк (без Tonkeeper)

━━━ ТАРИФЫ ━━━
🆓 Free: 3 агента, 1 активный, 10 TON за генерацию AI
⚡ Starter: 5 TON/мес — 15 агентов, 30 генераций
🚀 Pro: 15 TON/мес — 100 агентов, 150 генераций, webhook, workflow
💎 Unlimited: 30 TON/мес — всё безлимитно

━━━ РОЛЬ И СТИЛЬ ━━━
• Ты — экспертная поддержка, помогаешь разобраться и решить задачу
• Отвечай кратко (2-4 абзаца), Markdown: **жирный**, _курсив_, \`код\`
• Если пользователь описывает автоматизацию → предлагай создать агента (просто опишите задачу!)
• При вопросах о цене/подписке → давай точные данные из тарифов выше
• НИКОГДА не советуй устанавливать что-то локально — всё работает на сервере
• Отвечай на языке пользователя (русский/английский)
${isOwner ? '\nТЫ ОБЩАЕШЬСЯ С ВЛАДЕЛЬЦЕМ ПЛАТФОРМЫ. Можешь давать технические детали, статистику, советы по развитию.' : ''}`;

      // Формируем историю в OpenAI формате
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }

      // Добавляем текущее сообщение
      messages.push({ role: 'user', content: message });

      // Запрос с авто-fallback по цепочке моделей
      const { text: responseText, model: usedModel } = await callWithFallback(messages, userId);

      // Сохраняем ответ
      await getMemoryManager().addMessage(userId, 'assistant', responseText);

      return {
        type: 'text',
        content: responseText,
      };
    } catch (err: any) {
      console.error('[Orchestrator] handleGeneralChat error:', err?.message || err);
      const hint = this.getAIErrorHint(err);
      return {
        type: 'text',
        content: `⚠️ AI временно недоступен.\n${hint}\n\nЧем могу помочь? Попробуйте:\n• 🤖 Мои агенты\n• ➕ Создать агента\n• 🏪 Маркетплейс`,
      };
    }
  }

  /** Понятная подсказка по типу AI-ошибки */
  private getAIErrorHint(err: any): string {
    const msg: string = err?.message || err?.error?.message || '';
    if (msg.includes('cooldown')) {
      const sec = msg.match(/(\d+(?:\.\d+)?)s/)?.[1];
      return sec ? `⏳ Прокси на cooldown, повторите через ~${Math.ceil(parseFloat(sec))} сек.` : '⏳ Прокси перегружен, подождите немного.';
    }
    if (msg.includes('exhausted')) return '🔄 Все Kiro-токены исчерпаны. Нужна переавторизация: http://localhost:8317/v0/oauth/kiro';
    if (msg.includes('INSUFFICIENT_MODEL_CAPACITY')) return '🔄 Высокая нагрузка на модель, попробуйте через 30 секунд.';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) return '🔌 Прокси недоступен. Проверьте что CLIProxyAPIPlus запущен.';
    if (msg.includes('Invalid API key') || msg.includes('Missing API key')) return '🔑 Неверный API-ключ в .env (ANTHROPIC_API_KEY).';
    return '🔄 Попробуйте ещё раз через несколько секунд.';
  }

  // Обработка ожидаемого ввода
  private async handleWaitingInput(
    userId: number,
    message: string,
    waitingContext: { waitingFor: string; context: any }
  ): Promise<OrchestratorResult> {
    // Очищаем ожидание
    await getMemoryManager().clearWaiting(userId);

    switch (waitingContext.waitingFor) {
      case 'agent_clarification': {
        // Повторно пытаемся создать с уточнением
        const result = await this.creator.createAgent({
          userId,
          description: waitingContext.context.description,
          knownParams: { clarification: message },
        });

        if (result.success && result.data?.success) {
          const data = result.data;
          let content = `✅ **Агент создан с уточнениями!**\n\n`;
          content += `📛 Имя: ${data.name}\n`;
          content += `🆔 ID: ${data.agentId}\n`;
          content += `🔐 Безопасность: ${data.securityScore}/100\n\n`;
          content += `📝 ${data.explanation}`;

          return {
            type: 'buttons',
            content,
            buttons: [
              { text: '🚀 Запустить', callbackData: `run_agent:${data.agentId}` },
              { text: '🔍 Аудит', callbackData: `audit_agent:${data.agentId}` },
            ],
          };
        }

        return {
          type: 'text',
          content: result.success ? (result.data?.message ?? '') : `❌ ${result.error}`,
        };
      }

      case 'workflow_describe': {
        // AI создаёт workflow из описания пользователя
        const agentsResult = await this.dbTools.getUserAgents(userId);
        const agents = (agentsResult.data || []).map(a => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
        }));

        const workflowResult = await getWorkflowEngine().createFromDescription(userId, message, agents);

        if (!workflowResult.success && !workflowResult.plan) {
          return { type: 'text', content: `❌ Не удалось создать workflow: ${workflowResult.error}` };
        }

        let content = `⚡ *AI Workflow Plan*\n\n${workflowResult.plan}\n`;

        if (workflowResult.workflowId) {
          content += `\n✅ Workflow создан\\! ID: \`${workflowResult.workflowId}\``;
        }

        if (workflowResult.suggestedAgents && workflowResult.suggestedAgents.length > 0) {
          content += `\n\n📝 *Для этого workflow нужны агенты:*\n`;
          workflowResult.suggestedAgents.forEach((a, i) => {
            content += `${i + 1}\\. ${a}\n`;
          });
          content += `\nСоздайте их описав задачу: _"Создай агента для..."_`;
        }

        return {
          type: 'text',
          content,
          buttons: workflowResult.workflowId ? [
            { text: '▶️ Запустить workflow', callbackData: `run_workflow:${workflowResult.workflowId}` },
            { text: '⚡ Все workflow', callbackData: 'workflows_menu' },
          ] : [
            { text: '➕ Создать агента', callbackData: 'create_agent_prompt' },
            { text: '⚡ Workflow', callbackData: 'workflows_menu' },
          ],
        };
      }

      default:
        return {
          type: 'text',
          content: 'Понял! Чем еще могу помочь?',
        };
    }
  }

  // ===== Определение intent'а =====

  private async detectIntent(message: string): Promise<UserIntent> {
    const lowerMessage = message.toLowerCase();

    // ── Точные ключевые слова ──────────────────────────────────
    const intentPatterns: Record<UserIntent, string[]> = {
      create_agent: [
        // явное создание
        'создай', 'создать', 'сделай', 'make', 'create', 'build',
        'новый агент', 'new agent', 'добавь агента', 'напиши агента',
        'хочу агента', 'нужен агент', 'нужно сделать агента',
        'агент который', 'агента который', 'агент для', 'агента для',
        'напиши бота', 'сделай бота который', 'хочу бота который',
        // команды в повелительном наклонении (пользователь говорит что делать)
        'проверяй', 'проверять', 'мониторь', 'мониторинг', 'мониторить',
        'отслеживай', 'отслеживать', 'следи за', 'уведомляй', 'уведомлять',
        'отправляй', 'отправлять', 'пересылай', 'сообщай', 'сообщать',
        'считай', 'считать', 'вычисляй', 'парси', 'парсить', 'собирай',
        'ищи', 'искать', 'загружай', 'скачивай',
        // расписание
        'каждый час', 'каждую минуту', 'каждые', 'каждый день', 'каждую неделю',
        'по расписанию', 'автоматически', 'scheduler', 'cron', 'периодически',
        'раз в час', 'раз в день', 'раз в неделю', 'раз в минуту',
        // уведомления
        'уведоми когда', 'напиши мне когда', 'сообщи когда', 'alert', 'notify',
        // блокчейн задачи
        'баланс кошелька', 'следи за кошельком', 'мониторинг кошелька',
        'цена ton', 'курс ton', 'стоимость ton',
      ],
      edit_agent: [
        'измени', 'изменить', 'edit', 'update', 'поменяй', 'обнови', 'отредактируй',
        'добавь в агент', 'убери из агента', 'исправь агента',
      ],
      run_agent: [
        'запусти', 'запустить', 'run', 'execute', 'выполни', 'старт', 'start',
        'активируй', 'активировать',
      ],
      delete_agent: ['удали', 'удалить', 'delete', 'remove', 'убери агента'],
      list_agents: [
        'список', 'мои агенты', 'list', 'show agents',
        'покажи агентов', 'все агенты', 'сколько агентов',
      ],
      explain_agent: [
        'объясни', 'объяснить', 'explain', 'расскажи', 'как работает', 'что делает',
      ],
      debug_agent: ['debug', 'найди ошибки', 'почини агента', 'bug'],
      platform_settings: ['настройки платформы', 'platform settings', 'конфигурация сервера'],
      user_management: ['управление пользователями', 'список пользователей'],
      general_chat: [],
      unknown: [],
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          return intent as UserIntent;
        }
      }
    }

    // ── AI-классификация для неоднозначных сообщений ──────────
    // Если сообщение длинное (> 20 символов) и похоже на задачу — пробуем AI
    if (message.length > 20) {
      try {
        const aiIntent = await this.classifyIntentWithAI(message);
        if (aiIntent !== 'general_chat') return aiIntent;
      } catch {
        // fallback — general_chat
      }
    }

    return 'general_chat';
  }

  /** AI-классификация intent для сложных случаев */
  private async classifyIntentWithAI(message: string): Promise<UserIntent> {
    const { text } = await callWithFallback([
      {
        role: 'system',
        content: `Classify the user message into ONE intent category. Reply with ONLY the category name.

Categories:
- create_agent: user wants to automate a task, build/create a bot/agent/script, monitor something, send notifications, schedule a job, track prices/balances, make periodic requests
- run_agent: user wants to start/execute an existing agent
- list_agents: user wants to see their agents
- edit_agent: user wants to modify an existing agent
- general_chat: everything else (questions, chit-chat, help requests)

Important: if the message describes ANY automation task, monitoring, scheduling, or data fetching goal → classify as create_agent`,
      },
      { role: 'user', content: `Message: "${message}"` },
    ], 0, 20);

    const result = text.trim().toLowerCase().replace(/[^a-z_]/g, '');
    const valid: UserIntent[] = ['create_agent', 'edit_agent', 'run_agent', 'delete_agent', 'list_agents', 'general_chat'];
    return valid.includes(result as UserIntent) ? (result as UserIntent) : 'general_chat';
  }

  // ===== Публичные методы =====

  // Получить статистику для owner
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalAgents: number;
    activeAgents: number;
  }> {
    // Здесь можно добавить запросы к БД для статистики
    return {
      totalUsers: 0,
      totalAgents: 0,
      activeAgents: 0,
    };
  }
}

// Singleton instance
let orchestrator: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator();
  }
  return orchestrator;
}
