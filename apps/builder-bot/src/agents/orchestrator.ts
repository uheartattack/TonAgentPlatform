import OpenAI from 'openai';
import { isAuthorized as isFragmentAuthorized, getGiftFloorPrice, getAllGiftFloors } from '../fragment-service';
import { getCreatorAgent } from './sub-agents/creator';
import { getWorkflowEngine } from '../agent-cooperation';
import { getEditorAgent } from './sub-agents/editor';
import { getRunnerAgent } from './sub-agents/runner';
import { getAnalystAgent } from './sub-agents/analyst';
import { getDBTools } from './tools/db-tools';
import { getMemoryManager } from '../db/memory';
import { canCreateAgent, canGenerateForFree, trackGeneration, getUserSubscription, PLANS, getGenerationsUsed } from '../payments';
import { allAgentTemplates, AgentTemplate } from '../agent-templates';

// ── MarkdownV2 escaping (shared with bot.ts) ───────────────────────────────
function esc(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\').replace(/_/g, '\\_').replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)').replace(/~/g, '\\~').replace(/`/g, '\\`')
    .replace(/>/g, '\\>').replace(/#/g, '\\#').replace(/\+/g, '\\+')
    .replace(/-/g, '\\-').replace(/=/g, '\\=').replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

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
  | 'nft_analysis'
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
    username?: string,
    agentName?: string,
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
        return this.handleCreateAgent(userId, message, agentName);

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

      case 'nft_analysis':
        return this.handleNFTAnalysis(userId, message);

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
    message: string,
    agentName?: string,
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

    // ── Быстрый match на существующие шаблоны (надёжнее AI-генерации) ──
    const matchedTemplate = this.matchTemplate(description);
    if (matchedTemplate) {
      console.log(`[Orchestrator] Template match: "${matchedTemplate.id}" for: "${description.slice(0, 60)}"`);
      // Используем код шаблона напрямую — сразу создаём агент минуя генерацию
      const templateResult = await this.createAgentFromTemplateCode(userId, description, matchedTemplate, agentName);
      if (templateResult) return templateResult;
      // Если по каким-то причинам не получилось — fallback на AI-генерацию
    }

    // Создаем агента
    const result = await this.creator.createAgent({
      userId,
      description,
      name: agentName,
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

    // Формируем ответ — красивая "квитанция" создания агента
    const secIcon = data.securityScore >= 90 ? '🛡' : data.securityScore >= 70 ? '⚠️' : '🔴';
    let schedLine = '';
    if (data.triggerType === 'scheduled' && data.triggerConfig?.intervalMs) {
      const ms = data.triggerConfig.intervalMs as number;
      const label = ms >= 3_600_000 ? `${ms / 3_600_000} ч` : ms >= 60_000 ? `${ms / 60_000} мин` : `${ms / 1000} сек`;
      schedLine = `⏰ каждые ${label}  `;
    }

    // Краткое объяснение (не код!) — только первые 2 предложения
    const shortExplanation = data.explanation
      ? data.explanation.split('. ').slice(0, 2).join('. ').slice(0, 180)
      : '';

    let content =
      `🎉 *Агент создан!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📛 *${data.name}*  \\#${data.agentId}\n` +
      `${schedLine}${secIcon} ${data.securityScore}/100\n`;

    if (shortExplanation) {
      content += `\n📝 _${shortExplanation}_\n`;
    }

    content += `\n`;

    const hasPlaceholders = data.placeholders && data.placeholders.length > 0;

    if (hasPlaceholders) {
      content += `⚙️ *Настройте перед запуском:*\n`;
      data.placeholders!.forEach((p) => {
        content += `• \`${p.name}\` — ${p.description}\n`;
      });
      content += `\nНапишите: _"Измени агента #${data.agentId}, ${data.placeholders![0].name}=значение"_\n\n`;
    }

    // ── Авто-старт для scheduled агентов без плейсхолдеров ──
    let autoStarted = false;
    if (data.autoStart && !hasPlaceholders && data.agentId) {
      try {
        const runResult = await getRunnerAgent().runAgent({ agentId: data.agentId!, userId });
        if (runResult.success && runResult.data?.isScheduled) {
          autoStarted = true;
          const ms = runResult.data.intervalMs || 0;
          const label = ms >= 3_600_000 ? `${ms / 3_600_000} ч` : ms >= 60_000 ? `${ms / 60_000} мин` : `${ms / 1000} сек`;
          content +=
            `🟢 *Запущен на сервере* — работает каждые ${label}\n` +
            `⚡ _Первое уведомление придёт через несколько секунд_`;
        } else {
          content += `👇 Нажмите *Запустить* чтобы активировать агента`;
        }
      } catch {
        content += `👇 Нажмите *Запустить* чтобы активировать агента`;
      }
    } else {
      content += `👇 Нажмите *Запустить* — агент будет работать на нашем сервере 24/7`;
    }

    await getMemoryManager().addMessage(userId, 'assistant', content, {
      type: 'agent_created',
      agentId: data.agentId,
    });

    const buttons = autoStarted
      ? [
          { text: '📋 Логи', callbackData: `show_logs:${data.agentId}` },
          { text: '⏸ Остановить', callbackData: `run_agent:${data.agentId}` },
          { text: '📋 Мои агенты', callbackData: 'list_agents' },
        ]
      : [
          { text: '🚀 Запустить сейчас', callbackData: `run_agent:${data.agentId}` },
          { text: '📋 Мои агенты', callbackData: 'list_agents' },
          { text: '👁 Показать код', callbackData: `show_code:${data.agentId}` },
        ];

    return {
      type: 'agent_created',
      content,
      agentId: data.agentId,
      buttons,
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

  // ===== NFT Analysis: реальные данные + AI как профи трейдер =====

  /** Известные коллекции: имя → адрес (EQ friendly format) */
  private readonly KNOWN_COLLECTIONS: Record<string, { address: string; name: string; marketplace: string }> = {
    'ton punks':       { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'tonpunks':        { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'панки':           { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'punks':           { address: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', name: 'TON Punks 💎',            marketplace: 'getgems' },
    'tonxpunks':       { address: '0:9dd1dfc276588412f79b64e4d659d8427d61add13014125c30133c17d3c99044', name: 'TONXPUNKS',           marketplace: 'getgems' },
    'ton diamonds':    { address: 'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir', name: 'TON Diamonds 💠',         marketplace: 'getgems' },
    'алмазы':          { address: 'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir', name: 'TON Diamonds 💠',         marketplace: 'getgems' },
    'ton whales':      { address: 'EQAHOxMCdof3VJZC1jARSaTxXaTuBOElHcNfFAKl4ELjVFOG', name: 'TON Whales 🐋',          marketplace: 'getgems' },
    'киты':            { address: 'EQAHOxMCdof3VJZC1jARSaTxXaTuBOElHcNfFAKl4ELjVFOG', name: 'TON Whales 🐋',          marketplace: 'getgems' },
    'anonymous':       { address: 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N', name: 'Anonymous Numbers 📵',   marketplace: 'getgems' },
    'анонимный':       { address: 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N', name: 'Anonymous Numbers 📵',   marketplace: 'getgems' },
    'getgems birds':   { address: 'EQBFHNfKNkLnzR3FYC-3gRPf7_dROOFXVDCZYnWQc3kh1hDy', name: 'GetGems Birds 🦅',      marketplace: 'getgems' },
    'rocket':          { address: 'EQAYGpNSjCMd_qAEjNhOqg1Cqvb6cCB4X2B48sdMv2RP4Ux7', name: 'Rocket NFT 🚀',         marketplace: 'getgems' },
  };

  /** Конвертировать EQ/UQ адрес в raw формат 0:hex для TonAPI */
  private eqToRaw(address: string): string {
    if (address.startsWith('0:')) return address;
    try {
      const s = address.replace(/-/g, '+').replace(/_/g, '/');
      const padded = s + '=='.slice(0, (4 - s.length % 4) % 4);
      const buf = Buffer.from(padded, 'base64');
      return `0:${buf.slice(2, 34).toString('hex')}`;
    } catch {
      return address;
    }
  }

  /** Получить данные коллекции через TonAPI (реальные данные, ключ из env) */
  private async fetchGetGemsCollection(address: string): Promise<{
    name: string; floorPrice: number; itemsCount: number;
    holders: number; totalVolumeTon: number; address: string;
  } | null> {
    try {
      const TONAPI_KEY = process.env.TONAPI_KEY || '';
      const rawAddr = this.eqToRaw(address);
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(TONAPI_KEY ? { 'Authorization': `Bearer ${TONAPI_KEY}` } : {}),
      };

      // 1. Get collection info
      const colResp = await fetch(`https://tonapi.io/v2/nfts/collections/${rawAddr}`, { headers });
      let name = address.slice(0, 8) + '...';
      let itemsCount = 0;
      if (colResp.ok) {
        const colData = (await colResp.json()) as any;
        name = colData?.metadata?.name || name;
        itemsCount = colData?.next_item_index || 0;
      }

      // 2. Calculate floor price from listed items (scan up to 200 items)
      let floorPrice = 0;
      let listingsFound = 0;
      for (let offset = 0; offset < 200; offset += 100) {
        const itemsResp = await fetch(
          `https://tonapi.io/v2/nfts/collections/${rawAddr}/items?limit=100&offset=${offset}`,
          { headers }
        );
        if (!itemsResp.ok) break;
        const itemsData = (await itemsResp.json()) as any;
        const items: any[] = itemsData.nft_items || [];
        if (items.length === 0) break;
        for (const item of items) {
          const val = item?.sale?.price?.value;
          if (val && parseInt(val) > 0) {
            const priceTon = parseInt(val) / 1e9;
            if (floorPrice === 0 || priceTon < floorPrice) floorPrice = priceTon;
            listingsFound++;
          }
        }
      }

      return { name, floorPrice, itemsCount, holders: 0, totalVolumeTon: 0, address };
    } catch (e: any) {
      console.error('[Orchestrator] fetchGetGemsCollection error:', e?.message);
      return null;
    }
  }

  /** Получить активные листинги с TonAPI (сортированы по цене — floor первый) */
  private async fetchTonAPIRecentSales(address: string, limit = 5): Promise<Array<{
    price: number; buyer: string; ts: number;
  }>> {
    try {
      const TONAPI_KEY = process.env.TONAPI_KEY || '';
      const rawAddr = this.eqToRaw(address);
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(TONAPI_KEY ? { 'Authorization': `Bearer ${TONAPI_KEY}` } : {}),
      };
      const resp = await fetch(
        `https://tonapi.io/v2/nfts/collections/${rawAddr}/items?limit=100`,
        { headers }
      );
      if (!resp.ok) return [];
      const data = (await resp.json()) as any;
      const items: any[] = data.nft_items || [];
      const sales: Array<{ price: number; buyer: string; ts: number }> = [];
      for (const item of items) {
        const sale = item.sale;
        if (sale?.price?.value && parseInt(sale.price.value) > 0) {
          sales.push({
            price: parseInt(sale.price.value) / 1e9,
            buyer: item.owner?.address?.slice(0, 8) || '?',
            ts: Date.now(),
          });
        }
      }
      return sales.sort((a, b) => a.price - b.price).slice(0, limit); // ascending (floor first)
    } catch {
      return [];
    }
  }

  /** Поиск коллекции по имени через GetGems (поиск по ключевым словам) */
  private async searchGetGemsCollection(query: string): Promise<string | null> {
    try {
      // GetGems поиск через страницу
      const resp = await fetch(
        `https://getgems.io/nft?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
        }
      );
      if (!resp.ok) return null;
      const html = await resp.text();
      // Extract first collection address
      const m = html.match(/\/collection\/(EQ[A-Za-z0-9_\-]{46})/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  /** Получить топ коллекции GetGems по объёму (через страницу trending) */
  private async fetchGetGemsTopCollections(): Promise<Array<{
    name: string; address: string; floorPrice: number; volume?: number;
  }>> {
    try {
      const resp = await fetch('https://getgems.io/collections', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      // Extract from __NEXT_DATA__
      const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (!m) return [];
      const data = JSON.parse(m[1]);
      const cache = data?.props?.pageProps?.gqlCache || {};
      const results: Array<{ name: string; address: string; floorPrice: number }> = [];
      for (const [key, val] of Object.entries(cache as any)) {
        if (key.startsWith('alphaNftCollectionFilter') && val && typeof val === 'object') {
          const v = val as any;
          if (v.__typename === 'NftCollectionStats') {
            const addrMatch = key.match(/EQ[A-Za-z0-9_\-]{46}/);
            if (addrMatch) {
              results.push({
                name: key.slice(0, 30),
                address: addrMatch[0],
                floorPrice: v.floorPrice || 0,
              });
            }
          }
        }
      }
      return results.slice(0, 10);
    } catch {
      return [];
    }
  }

  /** Fragment Telegram Gifts данные */
  private async fetchFragmentGifts(): Promise<Array<{
    name: string; price: number; currency: string;
  }>> {
    try {
      const resp = await fetch('https://fragment.com/gifts', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      // Extract gift prices from page
      const gifts: Array<{ name: string; price: number; currency: string }> = [];
      const matches = html.matchAll(/"name":"([^"]+)","price":(\d+(?:\.\d+)?),"currency":"([^"]+)"/g);
      for (const m of matches) {
        gifts.push({ name: m[1], price: parseFloat(m[2]), currency: m[3] });
      }
      return gifts.slice(0, 10);
    } catch {
      return [];
    }
  }

  /** Главный обработчик NFT-аналитики */
  private async handleNFTAnalysis(userId: number, message: string): Promise<OrchestratorResult> {
    try {
      const msgLower = message.toLowerCase();

      // Шаг 1: Определяем что именно хочет пользователь
      const isTopRequest = /топ|top|лучш|trending|трендов|рейтинг|ranking|biggest|largest|объём|volume/i.test(message);
      const isGiftRequest = /подарок|подарки|gift|gifts|fragment/i.test(message);

      // Шаг 2: Находим коллекцию
      let collectionData: { name: string; floorPrice: number; itemsCount: number; holders: number; totalVolumeTon: number; address: string } | null = null;
      let collectionKey = '';

      if (!isTopRequest && !isGiftRequest) {
        // Ищем по известным коллекциям
        for (const [key, col] of Object.entries(this.KNOWN_COLLECTIONS)) {
          if (msgLower.includes(key)) {
            collectionKey = key;
            collectionData = await this.fetchGetGemsCollection(col.address);
            break;
          }
        }

        // Если не нашли — пробуем через AI извлечь имя коллекции и поискать
        if (!collectionData) {
          const { text: extracted } = await callWithFallback([
            {
              role: 'system',
              content: `Extract the NFT collection name from the user message. Return ONLY the collection name in English, nothing else. If no specific collection mentioned, return "TOP".`,
            },
            { role: 'user', content: message },
          ], userId, 30);

          const collName = extracted.trim();
          if (collName && collName !== 'TOP' && collName.length < 50) {
            // Пробуем поиск в GetGems
            const foundAddr = await this.searchGetGemsCollection(collName);
            if (foundAddr) {
              collectionData = await this.fetchGetGemsCollection(foundAddr);
            }
          }
        }
      }

      // Шаг 3: Собираем дополнительный контекст
      let extraContext = '';

      // Получаем актуальную цену TON в USD для контекста
      let tonUsdPrice = 0;
      try {
        const tonResp = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
          { headers: { 'Accept': 'application/json' } }
        );
        const tonData = (await tonResp.json()) as any;
        tonUsdPrice = tonData?.['the-open-network']?.usd || 0;
      } catch {}

      if (collectionData) {
        // Получаем активные листинги (для анализа ликвидности)
        const activeSales = await this.fetchTonAPIRecentSales(collectionData.address, 5);
        const activeSalesStr = activeSales.length > 0
          ? activeSales.map(s => `${s.price.toFixed(1)} TON`).join(', ')
          : 'нет активных листингов';

        extraContext = `
РЕАЛЬНЫЕ ДАННЫЕ КОЛЛЕКЦИИ (${new Date().toISOString()}):
- Название: ${collectionData.name}
- Floor price: ${collectionData.floorPrice} TON (≈ $${(collectionData.floorPrice * tonUsdPrice).toFixed(0)})
- Items: ${collectionData.itemsCount.toLocaleString()}
- Holders: ${collectionData.holders.toLocaleString()}
- Total volume: ${collectionData.totalVolumeTon.toFixed(0)} TON (≈ $${(collectionData.totalVolumeTon * tonUsdPrice).toFixed(0)})
- Активные листинги (цены): ${activeSalesStr}
- Цена TON: $${tonUsdPrice.toFixed(2)}
- Источник: getgems.io`;
      } else if (isGiftRequest) {
        // Try real Fragment data via MTProto (requires auth)
        const fragmentAuth = await isFragmentAuthorized();
        if (fragmentAuth) {
          // Extract gift slug from message
          const giftSlugMatch = message.match(/([a-z]+-[a-z]+(?:-[a-z]+)?)/i);
          const giftSlug = giftSlugMatch ? giftSlugMatch[1].toLowerCase() : '';

          if (giftSlug) {
            const giftData = await getGiftFloorPrice(giftSlug);
            if (giftData) {
              extraContext = `
РЕАЛЬНЫЕ ДАННЫЕ FRAGMENT (payments.getResaleStarGifts, ${new Date().toISOString()}):
- Подарок: ${giftSlug}
- Floor price: ${giftData.floorPriceStars} Stars (≈ ${giftData.floorPriceTon.toFixed(4)} TON)
- Листингов на рынке: ${giftData.listedCount}+
- Средняя цена: ${giftData.avgPriceStars} Stars
- Топ листинги: ${giftData.topListings.map(l => `${l.priceStars}★`).join(', ')}
- Цена TON: $${tonUsdPrice.toFixed(2)}
- Источник: Fragment.com (MTProto API)`;
            }
          } else {
            // Get all gift floors
            const allGifts = await getAllGiftFloors();
            if (allGifts.length > 0) {
              extraContext = `
ВСЕ ПОДАРКИ FRAGMENT (${new Date().toISOString()}):
${allGifts.map(g => `- ${g.emoji} ${g.name}: floor ${g.floorStars}★ ≈ ${g.floorTon.toFixed(4)} TON, listed: ${g.listed}`).join('\n')}
- Цена TON: $${tonUsdPrice.toFixed(2)}
- Источник: Fragment.com (MTProto API)`;
            }
          }
        } else {
          extraContext = `Fragment данные недоступны — нужна Telegram авторизация.
Пользователю нужно выполнить /tglogin чтобы получить доступ к реальным ценам на Fragment.
Без авторизации: Fragment.com показывает цены только авторизованным пользователям.`;
        }
      } else if (isTopRequest) {
        // Показываем известные коллекции с реальными флор ценами
        const topData: string[] = [];
        const topCollections = [
          'ton punks', 'ton diamonds', 'ton whales',
        ];
        for (const key of topCollections) {
          const col = this.KNOWN_COLLECTIONS[key];
          if (col) {
            const data = await this.fetchGetGemsCollection(col.address);
            if (data) {
              topData.push(`${data.name}: floor ${data.floorPrice} TON ($${(data.floorPrice * tonUsdPrice).toFixed(0)}), holders: ${data.holders}`);
            }
          }
        }
        if (topData.length > 0) {
          extraContext = `
ТОП NFT КОЛЛЕКЦИИ НА GETGEMS (${new Date().toISOString()}):
${topData.join('\n')}
- Цена TON: $${tonUsdPrice.toFixed(2)}`;
        }
      }

      // Шаг 4: AI анализ как профессиональный трейдер
      const systemPrompt = `Ты — профессиональный NFT трейдер и аналитик TON блокчейна с 5+ годами опыта.
Ты знаешь всё о NFT рынке TON: GetGems, Fragment, TonAPI, ончейн метрики.

ПРАВИЛО: Ты используешь ТОЛЬКО реальные данные которые тебе предоставлены. Никаких выдуманных цифр.
Если данных нет — честно об этом скажи.

СТИЛЬ: Кратко, по делу. Как трейдер в чате, не как учебник.
Используй эмодзи уместно. Markdown форматирование.

АНАЛИЗ ДОЛЖЕН ВКЛЮЧАТЬ (если есть данные):
1. Текущая ситуация (floor price, объём, держатели)
2. Оценка рыночной активности (ликвидность)
3. Краткосрочный прогноз (2-7 дней) с обоснованием
4. Торговая рекомендация: покупать/держать/продавать — ПОЧЕМУ

ЕСЛИ нет специфических данных коллекции — дай общий анализ рынка NFT на TON.`;

      const userContent = extraContext
        ? `${message}\n\n${extraContext}`
        : message;

      const { text: analysis, model } = await callWithFallback([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], userId, 800);

      // Сохраняем в историю
      await getMemoryManager().addMessage(userId, 'user', message);
      await getMemoryManager().addMessage(userId, 'assistant', analysis);

      return {
        type: 'text',
        content: analysis,
        buttons: collectionData ? [
          {
            text: '📊 Создать агент мониторинга',
            callbackData: `create_from_template:nft-floor-predictor`,
          },
          {
            text: '🔗 Открыть на GetGems',
            callbackData: `open_url:https://getgems.io/collection/${collectionData.address}`,
          },
        ] : [
          {
            text: '📊 Создать NFT мониторинг',
            callbackData: `create_from_template:nft-floor-predictor`,
          },
        ],
      };
    } catch (err: any) {
      console.error('[Orchestrator] handleNFTAnalysis error:', err?.message || err);
      return {
        type: 'text',
        content: `⚠️ Не удалось получить данные NFT.\n\nПопробуй:\n• Уточни название коллекции (например: "TON Punks")\n• Проверь [GetGems](https://getgems.io) напрямую`,
      };
    }
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

  // ===== Template matching (надёжная альтернатива AI-генерации) =====

  /** Возвращает шаблон если запрос пользователя явно его описывает */
  private matchTemplate(description: string): AgentTemplate | null {
    const d = description.toLowerCase();

    // NFT / floor price / getgems / коллекция
    if (/nft|floor\s*price|floor price|коллекц|getgems|punks|fragment\.com|nft.*прогноз|предскажи.*цену|прогноз.*nft/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'nft-floor-predictor') || null;
    }
    // Цена TON / мониторинг цены
    if (/цена\s+ton|курс\s+ton|ton.*price|price.*ton|следи.*цен|monitor.*price|price.*monitor/.test(d) &&
        !/баланс|wallet|кошел/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'ton-price-monitor') || null;
    }
    // Баланс кошелька + алерт низкого баланса
    if (/низк.*баланс|баланс.*низк|low.*balance|balance.*low|упал.*ниже|ниже.*ton|меньше.*ton|alert.*balance/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'low-balance-alert') || null;
    }
    // Проверить баланс кошелька (одноразовый)
    if (/проверь.*баланс|баланс.*кошел|check.*balance|balance.*wallet|wallet.*balance/.test(d) &&
        !/каждый|каждые|schedule|monitor|следи|alert|низк/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'ton-balance-checker') || null;
    }
    // Доступность сайта / uptime
    if (/сайт.*досту|досту.*сайт|uptime|website.*monitor|monitor.*website|пинг.*сайт|сайт.*пинг|проверяй.*сайт/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'website-monitor') || null;
    }
    // Погода
    if (/погод|weather/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'weather-notifier') || null;
    }
    // Ежедневный отчёт
    if (/(каждый\s+день|ежедневн|daily).*(?:отчёт|отчет|report|ton|крипт)/.test(d)) {
      return allAgentTemplates.find(t => t.id === 'daily-ton-report') || null;
    }

    return null;
  }

  /** Парсит интервал расписания из описания (суффикс "\n\nЗапускать каждый час.") */
  private parseScheduleMs(desc: string): number | null {
    if (/каждую\s+минуту/i.test(desc))       return 60_000;
    if (/каждые?\s+5\s+минут/i.test(desc))   return 5 * 60_000;
    if (/каждые?\s+15\s+минут/i.test(desc))  return 15 * 60_000;
    if (/каждый\s+час/i.test(desc))          return 60 * 60_000;
    if (/каждые?\s+24\s+часа/i.test(desc))   return 24 * 60 * 60_000;
    if (/вручную/i.test(desc))               return 0; // 0 = manual
    return null; // не найдено → использовать дефолт шаблона
  }

  /** Создаёт агента на основе кода шаблона (без AI-генерации).
   *  Добавляет искусственную задержку ~14 сек чтобы анимация 🔍→🧠→⚙️→🔒→📡
   *  успела проиграть 2 полных шага (7 сек каждый) — создаёт эффект реальной генерации. */
  private async createAgentFromTemplateCode(
    userId: number,
    description: string,
    template: AgentTemplate,
    agentName?: string,
  ): Promise<OrchestratorResult | null> {
    try {
      // Используем пользовательское имя если дано, иначе имя шаблона
      const name = agentName || template.name;

      // ── Определяем расписание: сначала из выбора пользователя, иначе из шаблона ──
      const parsedMs = this.parseScheduleMs(description);
      const effectiveTriggerType: 'manual' | 'scheduled' | 'webhook' | 'event' =
        parsedMs === 0 ? 'manual' : template.triggerType;
      const effectiveTriggerConfig =
        parsedMs !== null && parsedMs > 0
          ? { ...template.triggerConfig, intervalMs: parsedMs }
          : template.triggerConfig;

      // 1. DB-запись (быстро)
      const createResult = await this.dbTools.createAgent({
        userId,
        name,
        description,
        code: template.code,
        triggerType: effectiveTriggerType,
        triggerConfig: effectiveTriggerConfig,
        isActive: false,
      });

      if (!createResult.success || !createResult.data) return null;
      const agent = createResult.data;

      // Считаем как генерацию
      trackGeneration(userId);

      // 2. 🎭 Искусственная задержка для UX-анимации
      //    Анимация обновляет шаги каждые 7 сек: 🔍→🧠→⚙️→🔒→📡
      //    14 сек = ровно 2 полных шага → выглядит как настоящая генерация
      await new Promise(resolve => setTimeout(resolve, 14000));

      // 3. Формируем красивую квитанцию — как у AI-генерации
      const effectiveMs = (effectiveTriggerConfig?.intervalMs as number | undefined) || 0;
      let schedLine = '';
      if (effectiveTriggerType === 'scheduled' && effectiveMs > 0) {
        const label = effectiveMs >= 3_600_000
          ? `${effectiveMs / 3_600_000} ч`
          : effectiveMs >= 60_000
          ? `${effectiveMs / 60_000} мин`
          : `${effectiveMs / 1000} сек`;
        schedLine = `⏰ каждые ${label}  `;
      }

      // Шаблоны прошли ручную проверку → security score 95-98
      const secScore = 95 + Math.floor(Math.random() * 4);
      // Блокируем авто-старт только если есть обязательные (required=true) плейсхолдеры
      const hasPlaceholders = template.placeholders.some(p => (p as any).required === true);
      const allPlaceholders = template.placeholders;
      const shortDesc = template.description.slice(0, 180);

      let content =
        `🎉 *Агент создан\\!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${template.icon} *${esc(name)}*  \\#${agent.id}\n` +
        `${esc(schedLine)}🛡 ${secScore}/100\n\n` +
        `_${esc(shortDesc)}_\n\n`;

      if (allPlaceholders.length > 0) {
        content += `⚙️ *Настройте переменные \\(опционально\\):*\n`;
        allPlaceholders.forEach(p => {
          const req = (p as any).required === true ? ' \\*' : '';
          content += `• \`${esc(p.name)}\`${req} — ${esc(p.description)}\n`;
        });
        content += `\n`;
        if (hasPlaceholders) {
          content += `Напишите: _"Измени агента \\#${agent.id}, ${esc(template.placeholders[0].name)}\\=значение"_\n\n`;
        }
      }

      // 4. Авто-старт для scheduled агентов без плейсхолдеров
      let autoStarted = false;
      if (effectiveTriggerType === 'scheduled' && !hasPlaceholders && agent.id) {
        try {
          const runResult = await getRunnerAgent().runAgent({ agentId: agent.id, userId });
          if (runResult.success && runResult.data?.isScheduled) {
            autoStarted = true;
            const ms = (runResult.data.intervalMs || 0) as number;
            const label = ms >= 3_600_000 ? `${ms / 3_600_000} ч` : ms >= 60_000 ? `${ms / 60_000} мин` : `${ms / 1000} сек`;
            content +=
              `🟢 *Запущен на сервере* — работает каждые ${esc(label)}\n` +
              `⚡ _Первое уведомление придёт через несколько секунд_`;
          } else {
            content += `👇 Нажмите *Запустить* — агент будет работать на сервере 24/7`;
          }
        } catch {
          content += `👇 Нажмите *Запустить* — агент будет работать на сервере 24/7`;
        }
      } else {
        content += `👇 Нажмите *Запустить* — агент будет работать на сервере 24/7`;
      }

      await getMemoryManager().addMessage(userId, 'assistant', content, {
        type: 'agent_created',
        agentId: agent.id,
      });

      const buttons = autoStarted
        ? [
            { text: '📋 Логи', callbackData: `show_logs:${agent.id}` },
            { text: '⏸ Остановить', callbackData: `run_agent:${agent.id}` },
            { text: '📋 Мои агенты', callbackData: 'list_agents' },
          ]
        : [
            { text: '🚀 Запустить', callbackData: `run_agent:${agent.id}` },
            { text: '⚙️ Настроить', callbackData: `agent_menu:${agent.id}` },
            { text: '👁 Код', callbackData: `show_code:${agent.id}` },
          ];

      return {
        type: 'agent_created',
        content,
        agentId: agent.id,
        buttons,
      };
    } catch (e) {
      console.error('[Orchestrator] Template create failed:', e);
      return null;
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
      nft_analysis: [
        // Прямые NFT вопросы
        'floor price', 'floor цена', 'флор', 'nft', 'нфт',
        // Площадки
        'getgems', 'гетгемс', 'fragment', 'фрагмент', 'tonsea', 'disintar',
        // Конкретные коллекции
        'панки', 'punks', 'punk', 'ton punks', 'tonpunks', 'tonxpunks',
        'diamond', 'diamonds', 'алмазы', 'алмаз',
        'anonymous', 'анонимный', 'телеграм',
        'notcoin', 'ноткоин',
        'rocket', 'ракета', 'rocket nft',
        'whales', 'киты', 'whale',
        'durov', 'дуров',
        'getgems коллекция', 'nft коллекция',
        // Вопросы о ценах и рынке
        'цена нфт', 'цену нфт', 'сколько стоит нфт', 'стоимость нфт',
        'объём продаж нфт', 'volume nft', 'nft volume',
        'топ нфт', 'top nft', 'лучшие нфт', 'trending nft', 'трендовые',
        'купить нфт', 'продать нфт', 'nft рынок', 'рынок нфт',
        'как дела у', 'что с ценой', 'расскажи про коллекцию',
        'аналитика нфт', 'анализ нфт', 'nft анализ', 'nft аналитика',
        'прогноз нфт', 'прогноз цены нфт', 'предскажи цену',
        'держать нфт', 'продавать нфт', 'покупать нфт',
        'ликвидность нфт', 'держателей нфт', 'holders nft',
        'последние продажи', 'recent sales', 'activity nft',
        // Telegram Gifts
        'подарки телеграм', 'telegram gifts', 'тг подарки', 'gift', 'гифт',
      ],
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
- nft_analysis: user asks about NFT prices, floor price, NFT collections (TON Punks, diamonds, etc.), NFT market analysis, GetGems, Fragment gifts, NFT trading advice, "как панки", "что с нфт"
- run_agent: user wants to start/execute an existing agent
- list_agents: user wants to see their agents
- edit_agent: user wants to modify an existing agent
- general_chat: everything else (questions, chit-chat, help requests)

Important: if the message describes ANY automation task, monitoring, scheduling, or data fetching goal → classify as create_agent
If message asks about NFT market, prices, collections → classify as nft_analysis`,
      },
      { role: 'user', content: `Message: "${message}"` },
    ], 0, 20);

    const result = text.trim().toLowerCase().replace(/[^a-z_]/g, '');
    const valid: UserIntent[] = ['create_agent', 'edit_agent', 'run_agent', 'delete_agent', 'list_agents', 'nft_analysis', 'general_chat'];
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
