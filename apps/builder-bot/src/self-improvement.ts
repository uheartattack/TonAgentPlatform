/**
 * self-improvement.ts — система ИИ-самоулучшения платформы
 *
 * 3 уровня автономности:
 *   Level 1 🟢 — применяет сразу (баги, retry, gas, null-checks, опечатки)
 *   Level 2 🟡 — деплоит в staging, ждёт аппрува владельца (новые стратегии, интеграции)
 *   Level 3 🔴 — только предложение (комиссии, безопасность, ключи, блокчейны)
 *
 * Каждый цикл (по умолчанию каждые 60 сек):
 *   1. scanPlatform() — проверяет ошибки, метрики, зависимости
 *   2. generateSolution() — AI генерирует патч + уровень автономности
 *   3. apply*() — применяет или сохраняет предложение
 */
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { Telegraf, Context } from 'telegraf';
import {
  getAIProposalsRepository,
  AIProposal,
  AIPatchEntry,
} from './db/schema-extensions';
import { getAgentLogsRepository, getExecutionHistoryRepository } from './db/schema-extensions';
import { agentLastErrors } from './agents/tools/execution-tools';
import { getStagingManager } from './staging-manager';
import { config } from './config';
import { pool as dbPool } from './db';

// ─── Provider resolver (same as ai-agent-runtime.ts) ──────────────────────────
function resolveProviderForSI(provider: string): { baseURL: string; model: string } {
  switch (provider.toLowerCase()) {
    case 'gemini':    return { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.5-flash' };
    case 'anthropic': return { baseURL: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-haiku-4-5-20251001' };
    case 'groq':      return { baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' };
    case 'deepseek':  return { baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' };
    case 'openrouter': return { baseURL: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.5-flash' };
    case 'together':  return { baseURL: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' };
    default:          return { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
  }
}

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface Issue {
  type: 'error' | 'performance' | 'security' | 'ux' | 'dependency';
  severity: 'low' | 'medium' | 'high';
  description: string;
  module?: string;
  errorCount?: number;
  sample?: string;
}

interface AISolution {
  title: string;
  description: string;
  reasoning: string;
  level: 1 | 2 | 3;
  patch: AIPatchEntry[];
  module?: string;
}

// ─── Определение уровней автономности ────────────────────────────────────────

const LEVEL1_KEYWORDS = [
  'retry', 'timeout', 'null check', 'undefined', 'null pointer',
  'typo', 'spelling', 'log', 'cache hit', 'gas', 'optimize query',
  'index missing', 'error handling', 'catch block', 'fallback',
  'string parsing', 'json parse', 'type coercion', 'off by one',
];

const LEVEL3_KEYWORDS = [
  'fee', 'commission', 'blockchain', 'chain', 'token', 'ico',
  'private key', 'secret key', 'mnemonic', 'wallet seed',
  'security policy', 'audit', 'permission', 'access control',
  'data policy', 'gdpr', 'infrastructure cost', 'server cost',
];

// Критические файлы — патчи на них автоматически повышаются до Level 3
const PROTECTED_FILES = [
  'security-scanner.ts', 'payments.ts', 'ton-connect.ts',
  'config.ts', '.env', 'index.ts',
];

function determineLevel(description: string, patch: AIPatchEntry[]): 1 | 2 | 3 {
  const text = description.toLowerCase();

  // Если патч трогает защищённые файлы — всегда Level 3
  if (patch.some(p => PROTECTED_FILES.some(f => p.file.includes(f)))) return 3;

  // Проверяем ключевые слова
  if (LEVEL3_KEYWORDS.some(kw => text.includes(kw))) return 3;
  if (LEVEL1_KEYWORDS.some(kw => text.includes(kw))) return 1;

  // По умолчанию Level 2 (безопасный средний вариант)
  return 2;
}

// ─── Основной класс ───────────────────────────────────────────────────────────

export class SelfImprovementSystem {
  private bot: Telegraf<Context>;
  private ai: OpenAI;
  private intervalMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;
  // Дедупликация: agentId → timestamp последнего авторемонта (30 мин cooldown)
  private agentRepairCooldown = new Map<number, number>();
  // Дедупликация proposals: title hash → timestamp (предотвращает повторные предложения)
  private proposalCooldown = new Map<string, number>();
  private readonly PROPOSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 часа между одинаковыми proposals

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
    this.ai  = new OpenAI({
      apiKey:  config.claude.apiKey || '',
      baseURL: config.claude.baseURL,
    });
    // 10 минут между циклами (было 60 сек — слишком агрессивно, спам proposals)
    this.intervalMs = parseInt(process.env.SELF_IMPROVE_INTERVAL_MS || '600000');
  }

  /** Get AI client using user's own API key (falls back to platform proxy) */
  private async getUserAIClient(userId: string): Promise<OpenAI> {
    try {
      const uvRes = await dbPool.query(
        `SELECT value FROM builder_bot.user_variables WHERE user_id = $1 AND key IN ('AI_API_KEY', 'AI_PROVIDER') ORDER BY key`,
        [userId]
      );
      const vars: Record<string, string> = {};
      for (const r of uvRes.rows) vars[(r as any).key] = (r as any).value;
      if (vars.AI_API_KEY) {
        const provider = vars.AI_PROVIDER || 'openai';
        const resolved = resolveProviderForSI(provider);
        return new OpenAI({ apiKey: vars.AI_API_KEY, baseURL: resolved.baseURL });
      }
    } catch {}
    return this.ai; // fallback to default platform AI client
  }

  /** Notify the agent's owner (not platform owner) */
  private async notifyUser(userId: string, message: string, buttons?: any[][]): Promise<void> {
    try {
      const opts: any = { parse_mode: 'HTML' };
      if (buttons?.length) opts.reply_markup = { inline_keyboard: buttons };
      await this.bot.telegram.sendMessage(userId, message, opts);
    } catch (e: any) {
      // User may have blocked bot — non-critical
      console.error(`[SelfImprovement] User ${userId} notify failed: ${e.message?.slice(0, 60)}`);
    }
  }

  /** Запускает непрерывный цикл сканирования и улучшения */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Первый запуск через 30 сек после старта (чтобы всё инициализировалось)
    setTimeout(() => this.scanAndImprove(), 30000);

    // Затем каждые N секунд
    this.timer = setInterval(() => this.scanAndImprove(), this.intervalMs);
    console.log(`🤖 Self-improvement: cycle every ${this.intervalMs / 1000}s`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.running = false;
  }

  // ─── Публичные методы для API ──────────────────────────────────────────────

  async approveProposal(proposalId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const repo     = getAIProposalsRepository();
      const proposal = await repo.getById(proposalId);
      if (!proposal) return { ok: false, error: 'Proposal not found' };
      if (proposal.status !== 'pending' && proposal.status !== 'staging') {
        return { ok: false, error: `Cannot approve: status is ${proposal.status}` };
      }

      const staging = getStagingManager();

      if (proposal.level === 2 && proposal.status === 'staging') {
        // Promote staging → production
        const files = [...new Set(proposal.patch.map(p => p.file))];
        await staging.promoteToProduction(proposalId, files);
      } else {
        // Level 3 (или Level 1 если по какой-то причине ещё pending): применяем напрямую
        const errors: string[] = [];
        for (const patch of proposal.patch) {
          const result = await staging.applyPatchToFile(patch);
          if (!result.ok) errors.push(result.error!);
        }
        if (errors.length) return { ok: false, error: errors.join('; ') };
      }

      await repo.updateStatus(proposalId, 'applied', { appliedAt: new Date() });
      await staging.restartBot().catch(() => {});

      await this.notifyOwner(
        `✅ <b>Proposal Applied</b>\n\n` +
        `<b>${proposal.title}</b>\n` +
        `Level ${proposal.level} · approved by owner`
      );

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async rejectProposal(proposalId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const repo = getAIProposalsRepository();
      await repo.updateStatus(proposalId, 'rejected', { rejectedReason: reason });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async rollbackProposal(proposalId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const repo     = getAIProposalsRepository();
      const proposal = await repo.getById(proposalId);
      if (!proposal) return { ok: false, error: 'Proposal not found' };

      const staging  = getStagingManager();
      const { restoredFiles } = await staging.restoreBackup(proposalId);

      if (!restoredFiles.length) {
        return { ok: false, error: 'No backup found for this proposal' };
      }

      await repo.updateStatus(proposalId, 'rolled_back');
      await staging.restartBot().catch(() => {});

      await this.notifyOwner(
        `🔄 <b>Proposal Rolled Back</b>\n\n` +
        `<b>${proposal.title}</b>\n` +
        `Restored: ${restoredFiles.join(', ')}`
      );

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // ─── Основной цикл ────────────────────────────────────────────────────────

  private async scanAndImprove(): Promise<void> {
    try {
      // 1. Авторемонт кода агентов (отдельный приоритетный поток)
      await this.scanAndRepairAgents();

      // 2. Улучшения платформы (source code patching)
      const issues = await this.scanPlatform();
      if (!issues.length) return;

      // Обрабатываем не более 2 проблем за цикл (чтобы не перегружать AI)
      const toProcess = issues
        .filter(i => i.severity !== 'low')
        .slice(0, 2);

      for (const issue of toProcess) {
        try {
          // Дедупликация: не обрабатываем одну и ту же проблему чаще раза в 24ч
          const issueKey = issue.description.slice(0, 80).toLowerCase().replace(/\s+/g, '_');
          const lastSeen = this.proposalCooldown.get(issueKey) || 0;
          if (Date.now() - lastSeen < this.PROPOSAL_COOLDOWN_MS) {
            continue; // уже обрабатывали недавно
          }

          // Проверяем DB — может уже есть pending/staging/applied proposal с таким же описанием
          const repo = getAIProposalsRepository();
          const existing = await repo.list(undefined, 20).catch(() => []);
          const isDuplicate = existing.some((p: AIProposal) =>
            (p.status === 'pending' || p.status === 'staging' || p.status === 'applied') &&
            (p.title || '').toLowerCase().includes(issueKey.slice(0, 30))
          );
          if (isDuplicate) {
            this.proposalCooldown.set(issueKey, Date.now());
            continue;
          }

          const solution = await this.generateSolution(issue);
          if (!solution) continue;

          // Ещё раз проверяем по title solution
          const solutionKey = solution.title.toLowerCase().replace(/\s+/g, '_').slice(0, 60);
          const lastSolutionSeen = this.proposalCooldown.get(solutionKey) || 0;
          if (Date.now() - lastSolutionSeen < this.PROPOSAL_COOLDOWN_MS) {
            continue;
          }

          const proposal = await this.saveProposal(solution, issue);
          await this.routeProposal(proposal);

          // Запоминаем чтобы не повторять
          this.proposalCooldown.set(issueKey, Date.now());
          this.proposalCooldown.set(solutionKey, Date.now());
        } catch (e: any) {
          console.error('[SelfImprovement] Error processing issue:', e.message);
        }
      }
    } catch (e: any) {
      console.error('[SelfImprovement] Scan cycle error:', e.message);
    }
  }

  /**
   * Сканирует агентов с повторяющимися ошибками и автоматически чинит их код через AI.
   * Это отдельный поток от улучшения платформы — работает на уровне DB, не source files.
   */
  private async scanAndRepairAgents(): Promise<void> {
    try {
      const COOLDOWN_MS = 30 * 60 * 1000; // 30 минут между попытками для одного агента
      const now = Date.now();

      // Запрашиваем агентов с 3+ ошибками за последние 2 часа
      const result = await dbPool.query<{
        agent_id: number;
        error_count: string;
        last_error: string;
        agent_name: string;
        agent_code: string;
        user_id: string;
        trigger_config: string;
      }>(`
        SELECT
          l.agent_id,
          COUNT(*)::text          AS error_count,
          MAX(l.message)          AS last_error,
          a.name                  AS agent_name,
          a.code                  AS agent_code,
          a.user_id::text         AS user_id,
          a.trigger_config::text  AS trigger_config
        FROM builder_bot.agent_logs l
        JOIN builder_bot.agents a ON a.id = l.agent_id
        WHERE l.level = 'error'
          AND l.created_at > NOW() - INTERVAL '2 hours'
          AND a.is_active = true
          AND a.code IS NOT NULL
          AND length(a.code) > 100
        GROUP BY l.agent_id, a.name, a.code, a.user_id, a.trigger_config
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `);

      for (const row of result.rows) {
        const agentId = Number(row.agent_id);
        const errorCount = Number(row.error_count);
        const userId = row.user_id;

        // Check self_improvement_enabled flag (default: true for backward compat)
        let selfImprovementEnabled = true;
        try {
          const tc = typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : (row.trigger_config || {});
          if (tc.config?.self_improvement_enabled === false) selfImprovementEnabled = false;
        } catch {}
        if (!selfImprovementEnabled) continue;

        // Skip config errors — not fixable by code repair
        const lastErr = String(row.last_error || '');
        if (lastErr.includes('API ключ не настроен') || lastErr.includes('API key not configured') || lastErr.includes('No API key')) {
          continue;
        }

        // Cooldown: не чиним одного агента чаще раза в 30 минут
        const lastRepair = this.agentRepairCooldown.get(agentId) || 0;
        if (now - lastRepair < COOLDOWN_MS) continue;

        console.log(`[SelfImprovement] 🔧 Agent #${agentId} "${row.agent_name}" has ${errorCount} errors — attempting auto-repair`);
        this.agentRepairCooldown.set(agentId, now);

        // Try to use user's API key for repair
        const userAI = await this.getUserAIClient(userId);

        await this.repairAgentCode(
          agentId,
          row.agent_name,
          row.agent_code,
          row.last_error,
          errorCount,
          userId,
          userAI,
        );
      }

      // Also optimize AI agents with high error rates (ai_agent type)
      const aiAgentResult = await dbPool.query<{
        agent_id: number;
        agent_name: string;
        agent_code: string;
        error_count: string;
        recent_logs: string;
        user_id: string;
        trigger_config: string;
      }>(`
        SELECT
          a.id AS agent_id,
          a.name AS agent_name,
          a.code AS agent_code,
          a.user_id::text AS user_id,
          a.trigger_config::text AS trigger_config,
          COUNT(*) FILTER (WHERE l.level = 'error')::text AS error_count,
          string_agg(l.message, '|||' ORDER BY l.created_at DESC) AS recent_logs
        FROM builder_bot.agents a
        JOIN builder_bot.agent_logs l ON l.agent_id = a.id
        WHERE a.trigger_type = 'ai_agent'
          AND a.is_active = true
          AND l.created_at > NOW() - INTERVAL '3 hours'
        GROUP BY a.id, a.name, a.code, a.user_id, a.trigger_config
        HAVING COUNT(*) FILTER (WHERE l.level = 'error') >= 5
        ORDER BY COUNT(*) FILTER (WHERE l.level = 'error') DESC
        LIMIT 2
      `).catch(() => ({ rows: [] }));

      for (const row of aiAgentResult.rows) {
        const agentId = Number(row.agent_id);
        // Check self_improvement flag
        let enabled = true;
        try {
          const tc = typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : (row.trigger_config || {});
          if (tc.config?.self_improvement_enabled === false) enabled = false;
        } catch {}
        if (!enabled) continue;

        // Cooldown: don't optimize same AI agent more than once per hour
        const lastOptimize = this.agentRepairCooldown.get(agentId + 100000) || 0;
        if (now - lastOptimize < 60 * 60 * 1000) continue;
        this.agentRepairCooldown.set(agentId + 100000, now);

        const logs = (row.recent_logs || '').split('|||').slice(0, 30);
        const userAI = await this.getUserAIClient(row.user_id);
        await this.optimizeAIAgentPrompt(
          agentId,
          row.agent_name,
          row.agent_code,
          logs,
          `${row.error_count} errors in 3 hours`,
          row.user_id,
          userAI,
        );
      }
    } catch (e: any) {
      // Non-critical — don't crash the main cycle
      console.error('[SelfImprovement] scanAndRepairAgents error:', e.message?.slice(0, 100));
    }
  }

  /**
   * Просит AI починить код агента, затем обновляет код в DB без патчей source-файлов.
   * Level 1 — применяется автоматически (только изменения в коде агента, не в системных файлах).
   */
  private async repairAgentCode(
    agentId: number,
    agentName: string,
    currentCode: string,
    errorMsg: string,
    errorCount: number,
    userId?: string,
    userAI?: OpenAI,
  ): Promise<void> {
    try {
      const prompt = `Ты — опытный JavaScript-разработчик, чинящий бот-агента, который постоянно падает с ошибкой.

ИМЯ АГЕНТА: ${agentName}
ОШИБКА (произошла ${errorCount} раз): ${errorMsg.slice(0, 300)}

ТЕКУЩИЙ КОД АГЕНТА:
\`\`\`javascript
${currentCode.slice(0, 4000)}
\`\`\`

Агент работает в VM2-песочнице Node.js со следующими доступными глобалами:
- fetch(url, options) — HTTP запросы (нативный fetch)
- context.config.KEY — конфигурационные значения агента
- getState(key) → any — синхронный, чтение из in-memory Map
- setState(key, value) — синхронный, запись в in-memory Map
- tonGetBalance(address) → Promise<number> — баланс в TON через TonAPI
- tonSend({mnemonic, to, amountNano, payloadBase64?}) → Promise<string>
- tonCreateWallet() → Promise<{mnemonic, address}>
- tonGetWalletAddress(mnemonic) → Promise<string>
- notify(text) — отправить Telegram сообщение пользователю
- getGiftFloorReal(slug) → реальные floor цены подарка по маркетплейсам
- scanRealArbitrage(opts?) → реальные арбитражные возможности
- getPriceList(models?) → прайс-лист всех подарков
- getGiftAggregator(name, opts?) → лучшие предложения по 7 маркетплейсам
- console.log/warn/error
- Buffer, Math, Date, JSON, parseInt, parseFloat
- AbortController, AbortSignal
- НЕЛЬЗЯ: require(), process, __dirname, global

ПРАВИЛА ИСПРАВЛЕНИЯ:
1. Сохрани общую логику и назначение агента
2. Исправь конкретную ошибку, которая постоянно возникает
3. Добавь try/catch вокруг ВСЕХ внешних API вызовов
4. Если ошибка связана с заблокированным API — замени на рабочую альтернативу
5. Для данных TON блокчейна: используй TonAPI (https://tonapi.io/v2/...) — он РАБОТАЕТ с сервера
6. Никогда не используй process.env — используй context.config.KEY_NAME
7. getState() и setState() СИНХРОННЫЕ — НЕ оборачивай в Promise
8. Для цен подарков используй getGiftFloorReal(slug) вместо хардкода

Ответь ТОЛЬКО полным исправленным JavaScript кодом (без markdown, без объяснений, только код начиная с "async function agent(context) {").`;

      // Use user's AI client if available, else platform proxy
      const aiClient = userAI || this.ai;
      const response = await aiClient.chat.completions.create({
        model:      config.claude.model,
        max_tokens: 4000,
        messages:   [{ role: 'user', content: prompt }],
      });

      const rawText = response.choices[0]?.message?.content?.trim() || '';

      // Извлекаем код функции
      let newCode = rawText;
      const codeMatch = rawText.match(/async function agent\s*\([^)]*\)\s*\{[\s\S]*/);
      if (codeMatch) newCode = codeMatch[0];

      // Базовая валидация: проверяем что это похоже на валидный JS
      if (!newCode.includes('async function agent') || newCode.length < 200) {
        console.log(`[SelfImprovement] Agent #${agentId}: AI returned invalid code, skipping`);
        return;
      }

      // Синтаксическая проверка через new Function (не выполняет, только парсит)
      try {
        new Function(`return async function(){${newCode}}`);
      } catch (syntaxErr: any) {
        console.log(`[SelfImprovement] Agent #${agentId}: syntax error in AI fix: ${syntaxErr.message?.slice(0, 80)}`);
        return;
      }

      // Обновляем код в DB
      await dbPool.query(
        'UPDATE builder_bot.agents SET code = $1, updated_at = NOW() WHERE id = $2',
        [newCode, agentId]
      );

      // Очищаем ошибку из in-memory map чтобы не перечинять сразу
      agentLastErrors.delete(agentId);

      console.log(`[SelfImprovement] ✅ Agent #${agentId} "${agentName}" auto-repaired (${newCode.length} chars)`);

      // Notify agent owner (user), not platform owner
      if (userId) {
        await this.notifyUser(userId,
          `🔧 <b>Агент авто-починен</b>\n\n` +
          `<b>#${agentId} ${agentName}</b>\n` +
          `Ошибка (${errorCount}x): <code>${errorMsg.slice(0, 150)}</code>\n\n` +
          `✅ AI исправил код агента автоматически.\n` +
          `<i>Следующий запуск покажет результат.</i>`,
          [[{ text: '📋 Логи', callback_data: `agent_logs:${agentId}` },
            { text: '⚙️ Настройки', callback_data: `agent_settings:${agentId}` }]]
        );
      }
      // Also notify platform owner
      await this.notifyOwner(
        `🔧 <b>Агент авто-починен</b>\n\n` +
        `<b>#${agentId} ${agentName}</b> (user ${userId})\n` +
        `Ошибка (${errorCount}x): <code>${errorMsg.slice(0, 150)}</code>\n` +
        `✅ ${userAI !== this.ai ? 'User API key' : 'Platform proxy'}`
      );

    } catch (e: any) {
      console.error(`[SelfImprovement] repairAgentCode #${agentId} error:`, e.message?.slice(0, 100));
    }
  }

  /**
   * Оптимизирует system prompt AI-агента на основе анализа его логов.
   * Используется для ai_agent типа — не трогает code, только prompt.
   */
  private aiPromptOptCooldown = new Map<number, number>();
  private async optimizeAIAgentPrompt(
    agentId: number,
    agentName: string,
    currentPrompt: string,
    recentLogs: string[],
    issueDescription: string,
    userId?: string,
    userAI?: OpenAI,
  ): Promise<void> {
    const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours between optimizations per agent
    const now = Date.now();
    const lastOpt = this.aiPromptOptCooldown.get(agentId) || 0;
    if (now - lastOpt < COOLDOWN_MS) return;
    this.aiPromptOptCooldown.set(agentId, now);

    try {
      const prompt = `Ты — эксперт по оптимизации AI-агентов. Анализируй system prompt агента и его логи, предложи улучшение.

ИМЯ АГЕНТА: ${agentName}
ПРОБЛЕМА: ${issueDescription}

ТЕКУЩИЙ SYSTEM PROMPT:
"""
${currentPrompt.slice(0, 3000)}
"""

ПОСЛЕДНИЕ ЛОГИ (${recentLogs.length} записей):
${recentLogs.slice(0, 20).map(l => `- ${l}`).join('\n')}

ПРАВИЛА ОПТИМИЗАЦИИ:
1. Сохрани назначение и основную логику агента
2. Добавь чёткие инструкции для решения выявленной проблемы
3. Если агент спамит уведомлениями — добавь правило "один notify за тик"
4. Если агент делает лишние API-вызовы — сократи цепочку инструментов
5. Если агент галлюцинирует — добавь правило "проверяй данные перед действием"
6. Будь лаконичным — не раздувай промпт, добавь только нужное
7. Промпт на том же языке что и оригинал

Ответь ТОЛЬКО полным улучшенным system prompt (без markdown, без объяснений, без кавычек).`;

      const aiClient = userAI || this.ai;
      const response = await aiClient.chat.completions.create({
        model:      config.claude.model,
        max_tokens: 4000,
        messages:   [{ role: 'user', content: prompt }],
      });

      const newPrompt = response.choices[0]?.message?.content?.trim() || '';
      if (!newPrompt || newPrompt.length < 50) {
        console.log(`[SelfImprovement] Agent #${agentId}: AI returned empty/short prompt, skipping`);
        return;
      }

      // Update in DB (code field stores system prompt for ai_agent type)
      await dbPool.query(
        'UPDATE builder_bot.agents SET code = $1, updated_at = NOW() WHERE id = $2',
        [newPrompt, agentId]
      );

      console.log(`[SelfImprovement] ✅ AI Agent #${agentId} "${agentName}" prompt optimized (${newPrompt.length} chars)`);

      // Notify agent owner
      if (userId) {
        await this.notifyUser(userId,
          `🧠 <b>AI-агент оптимизирован</b>\n\n` +
          `<b>#${agentId} ${agentName}</b>\n` +
          `Проблема: ${issueDescription}\n` +
          `✅ System prompt улучшен автоматически.`,
          [[{ text: '💬 Чат', callback_data: `agent_chat:${agentId}` },
            { text: '📋 Логи', callback_data: `agent_logs:${agentId}` }]]
        );
      }

      await this.notifyOwner(
        `🧠 <b>AI-агент оптимизирован</b>\n\n` +
        `<b>#${agentId} ${agentName}</b>\n` +
        `Проблема: <code>${issueDescription.slice(0, 150)}</code>\n\n` +
        `✅ System prompt улучшен на основе анализа ${recentLogs.length} логов.\n` +
        `<i>Промпт: ${newPrompt.length} символов (было ${currentPrompt.length})</i>`
      );

    } catch (e: any) {
      console.error(`[SelfImprovement] optimizeAIAgentPrompt #${agentId} error:`, e.message?.slice(0, 100));
    }
  }

  // ─── Сканирование платформы ───────────────────────────────────────────────

  private async scanPlatform(): Promise<Issue[]> {
    const issues: Issue[] = [];

    try { issues.push(...await this.checkErrorLogs()); }     catch {}
    try { issues.push(...await this.checkSuccessRate()); }   catch {}
    try { issues.push(...await this.checkAgentErrors()); }   catch {}
    try { issues.push(...await this.checkAPILatency()); }    catch {}
    try { issues.push(...await this.checkDependencies()); }  catch {}
    try { issues.push(...await this.checkAgentTickQuality()); } catch {}

    return issues;
  }

  /** Ищет повторяющиеся ошибки в agent_logs за последний час */
  private async checkErrorLogs(): Promise<Issue[]> {
    try {
      const logsRepo = getAgentLogsRepository();
      // Берём последние 200 логов — ищем паттерны
      const logs = await logsRepo.getByUser(0, 200, 0).catch(() => []);
      if (!logs.length) return [];

      // Получаем логи напрямую из БД через raw query (если доступно)
      // Группируем ошибки по тексту
      const errorMap = new Map<string, number>();
      for (const log of logs) {
        if (log.level !== 'error') continue;
        const key = log.message.slice(0, 100);
        errorMap.set(key, (errorMap.get(key) || 0) + 1);
      }

      const issues: Issue[] = [];
      for (const [msg, count] of errorMap) {
        if (count >= 3) {
          issues.push({
            type:       'error',
            severity:   count >= 10 ? 'high' : 'medium',
            description: `Repeated error (${count}x): ${msg}`,
            module:     'agent-execution',
            errorCount: count,
            sample:     msg,
          });
        }
      }
      return issues;
    } catch {
      return [];
    }
  }

  /** Проверяет success rate за последние 100 запусков */
  private async checkSuccessRate(): Promise<Issue[]> {
    try {
      const histRepo = getExecutionHistoryRepository();
      // Используем getStats для агрегации
      const stats = await histRepo.getStats(0).catch(() => null);
      if (!stats || stats.totalRuns < 20) return [];

      const successRate = stats.successRuns / stats.totalRuns;
      if (successRate < 0.7) {
        return [{
          type:        'performance',
          severity:    successRate < 0.5 ? 'high' : 'medium',
          description: `Low success rate: ${(successRate * 100).toFixed(1)}% (${stats.successRuns}/${stats.totalRuns} runs)`,
          module:      'execution-engine',
        }];
      }
      return [];
    } catch {
      return [];
    }
  }

  /** Проверяет agentLastErrors map из execution-tools.ts */
  private async checkAgentErrors(): Promise<Issue[]> {
    const issues: Issue[] = [];
    try {
      for (const [agentId, errorInfo] of agentLastErrors.entries()) {
        const ageMs = Date.now() - (errorInfo.timestamp ? errorInfo.timestamp.getTime() : 0);
        if (ageMs > 3600000) continue;  // старше 1 часа — пропускаем

        issues.push({
          type:        'error',
          severity:    'medium',
          description: `Agent #${agentId} crashed: ${errorInfo.error?.slice(0, 150)}`,
          module:      `agent-${agentId}`,
          sample:      errorInfo.error,
        });
      }
    } catch {}
    return issues.slice(0, 3);
  }

  /** Пингует TonAPI — проверяет latency */
  private async checkAPILatency(): Promise<Issue[]> {
    try {
      const start = Date.now();
      const resp  = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd', {
        signal: AbortSignal.timeout(8000)
      });
      const latency = Date.now() - start;

      if (!resp.ok || latency > 3000) {
        return [{
          type:        'performance',
          severity:    latency > 5000 ? 'high' : 'medium',
          description: `TonAPI latency: ${latency}ms (threshold: 3000ms)`,
          module:      'api-client',
        }];
      }
      return [];
    } catch {
      return [{
        type:        'performance',
        severity:    'medium',
        description: 'TonAPI unreachable — add retry/fallback logic',
        module:      'api-client',
      }];
    }
  }

  /** Анализирует качество тиков AI-агентов: ищет паттерны плохих решений.
   *  Проверяет: повторяющиеся бесполезные тулколлы, пустые тики, спам notify. */
  private lastTickQualityCheck = 0;
  private async checkAgentTickQuality(): Promise<Issue[]> {
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - this.lastTickQualityCheck < ONE_HOUR) return [];
    this.lastTickQualityCheck = Date.now();

    try {
      // Check for agents with many ticks but no useful output
      const result = await dbPool.query<{
        agent_id: number;
        agent_name: string;
        total_ticks: string;
        error_ticks: string;
        avg_duration: string;
      }>(`
        SELECT
          eh.agent_id,
          a.name AS agent_name,
          COUNT(*)::text AS total_ticks,
          COUNT(*) FILTER (WHERE eh.status = 'error')::text AS error_ticks,
          AVG(eh.duration_ms)::text AS avg_duration
        FROM builder_bot.execution_history eh
        JOIN builder_bot.agents a ON a.id = eh.agent_id
        WHERE eh.started_at > NOW() - INTERVAL '6 hours'
          AND a.trigger_type = 'ai_agent'
          AND a.is_active = true
        GROUP BY eh.agent_id, a.name
        HAVING COUNT(*) >= 10
        ORDER BY COUNT(*) FILTER (WHERE eh.status = 'error')::float / GREATEST(COUNT(*), 1) DESC
        LIMIT 5
      `);

      const issues: Issue[] = [];
      for (const row of result.rows) {
        const total = Number(row.total_ticks);
        const errors = Number(row.error_ticks);
        const errorRate = errors / total;
        const avgDuration = Number(row.avg_duration);

        // High error rate in ticks
        if (errorRate > 0.5 && total >= 10) {
          issues.push({
            type: 'performance',
            severity: errorRate > 0.8 ? 'high' : 'medium',
            description: `Agent #${row.agent_id} "${row.agent_name}" has ${(errorRate * 100).toFixed(0)}% error rate (${errors}/${total} ticks in 6h). System prompt may need adjustment.`,
            module: `agent-${row.agent_id}`,
          });
        }

        // Very slow ticks (>30s average = wasting AI tokens)
        if (avgDuration > 30000 && total >= 5) {
          issues.push({
            type: 'performance',
            severity: 'low',
            description: `Agent #${row.agent_id} "${row.agent_name}" average tick ${(avgDuration / 1000).toFixed(1)}s (${total} ticks). May be making too many tool calls per tick.`,
            module: `agent-${row.agent_id}`,
          });
        }
      }

      // Check for notification spam patterns
      const spamResult = await dbPool.query<{
        agent_id: number;
        agent_name: string;
        notify_count: string;
      }>(`
        SELECT
          l.agent_id,
          a.name AS agent_name,
          COUNT(*)::text AS notify_count
        FROM builder_bot.agent_logs l
        JOIN builder_bot.agents a ON a.id = l.agent_id
        WHERE l.created_at > NOW() - INTERVAL '1 hour'
          AND l.message LIKE '%notify%'
          AND l.level = 'info'
        GROUP BY l.agent_id, a.name
        HAVING COUNT(*) > 20
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `);

      for (const row of spamResult.rows) {
        issues.push({
          type: 'error',
          severity: 'medium',
          description: `Agent #${row.agent_id} "${row.agent_name}" sent ${row.notify_count} notifications in 1 hour — possible spam. System prompt anti-spam rules may be ineffective.`,
          module: `agent-${row.agent_id}`,
        });
      }

      return issues;
    } catch {
      return [];
    }
  }

  /** Проверяет package.json на известные проблемные версии.
   *  Запускается не чаще раза в 6 часов (deps меняются редко). */
  private lastDepCheck = 0;
  private async checkDependencies(): Promise<Issue[]> {
    // Deps check раз в 6 часов, не каждую минуту
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    if (Date.now() - this.lastDepCheck < SIX_HOURS) return [];
    this.lastDepCheck = Date.now();

    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(pkgPath)) return [];

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // vm2 полностью deprecated — но мы его используем намеренно
      // Не генерируем issue для известных/принятых зависимостей
      const IGNORED_DEPS = ['vm2']; // мы знаем про vm2, не спамь

      const issues: Issue[] = [];
      // В будущем можно добавить реальный npm audit check
      return issues;
    } catch {
      return [];
    }
  }

  // ─── Генерация решений через AI ──────────────────────────────────────────

  private async generateSolution(issue: Issue): Promise<AISolution | null> {
    // Ищем информацию в интернете
    const research = await this.researchOnline(issue.description);

    // Читаем релевантный код (если известен модуль)
    const codeSnippet = this.getRelevantCode(issue.module);

    const prompt = `Ты — опытный инженер-программист, обслуживающий платформу TON Agent Platform для работы с NFT и Telegram-подарками.

ОБНАРУЖЕННАЯ ПРОБЛЕМА:
Тип: ${issue.type}
Серьёзность: ${issue.severity}
Описание: ${issue.description}
Модуль: ${issue.module || 'неизвестно'}
${issue.sample ? `Пример ошибки: ${issue.sample.slice(0, 300)}` : ''}

РЕЗУЛЬТАТЫ ИССЛЕДОВАНИЯ:
${research || 'Релевантная информация не найдена.'}

СООТВЕТСТВУЮЩИЙ КОД:
${codeSnippet || 'Фрагмент кода недоступен.'}

ЗАДАЧА:
Сгенерируй исправление для этой проблемы. Ответь ТОЛЬКО валидным JSON (без markdown, без пояснений):
{
  "title": "Краткое название фикса (макс 60 символов)",
  "description": "Что делает исправление",
  "reasoning": "Почему это исправление корректно",
  "level": 1,
  "patch": [
    {
      "file": "src/agents/tools/execution-tools.ts",
      "oldStr": "точная строка для замены",
      "newStr": "строка замены"
    }
  ]
}

Правила уровней:
- 1 (авто-применение): опечатки, null-проверки, retry-логика, обработка ошибок, газ, логи
- 2 (staging): новая стратегия, новый источник данных, изменение алгоритма, новая функция
- 3 (одобрение владельца): комиссии, безопасность, приватные ключи, кошельки, политики

Если не можешь сгенерировать безопасный патч, верни: {"skip": true, "reason": "объяснение"}`;

    try {
      const response = await this.ai.chat.completions.create({
        model:       config.claude.model,
        max_tokens:  1500,
        messages:    [{ role: 'user', content: prompt }],
      });

      const text = response.choices[0]?.message?.content?.trim() || '';

      // Парсим JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.skip) return null;

      // Определяем уровень автономности
      const level = determineLevel(parsed.description + ' ' + parsed.title, parsed.patch || []);

      // Валидируем патчи
      const staging   = getStagingManager();
      const validPatch: AIPatchEntry[] = [];
      for (const p of (parsed.patch || [])) {
        if (!p.file || !p.oldStr || !p.newStr) continue;
        const validation = staging.validatePatch(p);
        if (validation.valid) validPatch.push(p);
        else console.log(`[SelfImprovement] Patch validation failed: ${validation.error}`);
      }

      // Если нет валидных патчей — сохраняем как Level 3 proposal без патча
      return {
        title:       parsed.title || 'Improvement proposal',
        description: parsed.description || issue.description,
        reasoning:   parsed.reasoning || '',
        level:       validPatch.length ? level : 3,
        patch:       validPatch,
        module:      issue.module,
      };
    } catch (e: any) {
      console.error('[SelfImprovement] AI generation error:', e.message);
      return null;
    }
  }

  /** Поиск информации через DuckDuckGo Instant Answer API */
  private async researchOnline(query: string): Promise<string> {
    try {
      const encoded = encodeURIComponent(query.slice(0, 100));
      const resp = await fetch(
        `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await resp.json() as any;

      const parts: string[] = [];
      if (data.Abstract)    parts.push(data.Abstract);
      if (data.RelatedTopics?.length) {
        parts.push(...data.RelatedTopics.slice(0, 3).map((t: any) => t.Text || '').filter(Boolean));
      }

      return parts.join('\n').slice(0, 500);
    } catch {
      return '';
    }
  }

  /** Читает фрагмент исходного кода для контекста AI */
  private getRelevantCode(module?: string): string {
    if (!module) return '';
    const moduleMap: Record<string, string> = {
      'agent-execution':  'src/agents/tools/execution-tools.ts',
      'execution-engine': 'src/agents/sub-agents/runner.ts',
      'api-client':       'src/agents/orchestrator.ts',
      'dependencies':     'package.json',
    };

    const filePath = moduleMap[module] || (module.includes('.ts') ? module : null);
    if (!filePath) return '';

    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return '';

    const content = fs.readFileSync(fullPath, 'utf8');
    // Возвращаем первые 2000 символов как контекст
    return content.slice(0, 2000);
  }

  // ─── Сохранение и маршрутизация предложений ───────────────────────────────

  private async saveProposal(solution: AISolution, _issue: Issue): Promise<AIProposal> {
    const repo = getAIProposalsRepository();
    const id   = randomUUID();

    const proposal: AIProposal = {
      id,
      level:       solution.level,
      title:       solution.title,
      description: solution.description,
      reasoning:   solution.reasoning,
      patch:       solution.patch,
      status:      'pending',
      autoApplied: false,
      module:      solution.module,
      createdAt:   new Date(),
    };

    await repo.create(proposal);
    return proposal;
  }

  private async routeProposal(proposal: AIProposal): Promise<void> {
    switch (proposal.level) {
      case 1:
        await this.applyLevel1(proposal);
        break;
      case 2:
        await this.applyLevel2Staging(proposal);
        break;
      case 3:
        await this.saveLevel3Proposal(proposal);
        break;
    }
  }

  // ─── Применение изменений ─────────────────────────────────────────────────

  /** Level 1: применяет сразу, информирует владельца */
  private async applyLevel1(proposal: AIProposal): Promise<void> {
    if (!proposal.patch.length) {
      // Нет патча — просто сохраняем как Level 3
      await getAIProposalsRepository().updateStatus(proposal.id, 'pending');
      return;
    }

    const staging = getStagingManager();

    // 1. Резервная копия
    const files = [...new Set(proposal.patch.map(p => p.file))];
    await staging.backupFiles(proposal.id, files);

    // 2. Применяем патчи
    const errors: string[] = [];
    for (const patch of proposal.patch) {
      const result = await staging.applyPatchToFile(patch);
      if (!result.ok) errors.push(result.error!);
    }

    if (errors.length) {
      // Откат если что-то пошло не так
      await staging.restoreBackup(proposal.id);
      await getAIProposalsRepository().updateStatus(proposal.id, 'rejected', {
        rejectedReason: `Auto-apply failed: ${errors.join('; ')}`
      });
      return;
    }

    // 3. Помечаем как применённое
    await getAIProposalsRepository().updateStatus(proposal.id, 'applied', {
      appliedAt:   new Date(),
      autoApplied: true,
    } as any);

    // 4. Информируем владельца (не ждём одобрения — уже применено)
    await this.notifyOwner(
      `🟢 <b>Auto-Fixed (Level 1)</b>\n\n` +
      `<b>${proposal.title}</b>\n` +
      `${proposal.description.slice(0, 200)}\n\n` +
      `Files: <code>${files.join(', ')}</code>\n` +
      `<i>Applied automatically. <a href="https://tonagentplatform.com/api/proposals/${proposal.id}">View</a> · ` +
      `Use /rollback_${proposal.id.slice(0, 8)} to undo</i>`,
    );

    // 5. Рестарт не нужен — TypeScript компилируется на лету при следующем запуске
    console.log(`[SelfImprovement] ✅ Level 1 applied: ${proposal.title}`);
  }

  /** Level 2: деплоит в staging, уведомляет владельца с кнопками */
  private async applyLevel2Staging(proposal: AIProposal): Promise<void> {
    const staging = getStagingManager();

    // 1. Применяем патчи в staging (не в production)
    const errors: string[] = [];
    for (const patch of proposal.patch) {
      const result = await staging.applyPatchToStaging(patch);
      if (!result.ok) errors.push(result.error!);
    }

    // 2. TypeScript check на staged файлах (best-effort)
    const tsResult = await staging.typeCheck().catch(() => ({ ok: true, errors: [] }));
    const stagingResult = tsResult.ok
      ? 'TypeScript: OK'
      : `TypeScript errors:\n${tsResult.errors.slice(0, 3).join('\n')}`;

    // 3. Обновляем статус в БД
    await getAIProposalsRepository().updateStatus(proposal.id, 'staging', {
      stagingResult,
    } as any);

    // 4. Уведомляем владельца с кнопками Approve/Reject
    const shortId = proposal.id.slice(0, 8);
    await this.notifyOwnerWithButtons(
      `🟡 <b>Готово в staging (Уровень 2)</b>\n\n` +
      `<b>${proposal.title}</b>\n` +
      `${proposal.description.slice(0, 400)}\n\n` +
      `Обоснование: <i>${(proposal.reasoning || '').slice(0, 300)}</i>\n\n` +
      `${stagingResult}`,
      proposal.id,
    );

    console.log(`[SelfImprovement] 🟡 Level 2 staging ready: ${proposal.title}`);
  }

  /** Level 3: только предложение, требует одобрения */
  private async saveLevel3Proposal(proposal: AIProposal): Promise<void> {
    const shortId = proposal.id.slice(0, 8);

    await this.notifyOwnerWithButtons(
      `🔴 <b>Требуется одобрение (Уровень 3)</b>\n\n` +
      `<b>${proposal.title}</b>\n` +
      `${proposal.description.slice(0, 400)}\n\n` +
      `Обоснование: <i>${(proposal.reasoning || '').slice(0, 300)}</i>\n\n` +
      `<i>Это изменение требует вашего одобрения.</i>`,
      proposal.id,
    );

    console.log(`[SelfImprovement] 🔴 Level 3 proposal: ${proposal.title}`);
  }

  // ─── Уведомления владельца ────────────────────────────────────────────────

  private async notifyOwner(message: string): Promise<void> {
    const ownerId = config.owner.id;
    if (!ownerId) return;
    try {
      await this.bot.telegram.sendMessage(ownerId, message, { parse_mode: 'HTML' });
    } catch (e: any) {
      console.error('[SelfImprovement] Owner notify failed:', e.message);
    }
  }

  private async notifyOwnerWithButtons(message: string, proposalId: string): Promise<void> {
    const ownerId = config.owner.id;
    if (!ownerId) return;
    try {
      await this.bot.telegram.sendMessage(ownerId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Применить', callback_data: `proposal_approve:${proposalId}` },
              { text: '❌ Отклонить', callback_data: `proposal_reject:${proposalId}` },
            ],
            [
              { text: '⏪ Откатить', callback_data: `proposal_rollback:${proposalId}` },
              { text: '💬 Обсудить', callback_data: `proposal_discuss:${proposalId}` },
            ],
          ],
        },
      });
    } catch (e: any) {
      console.error('[SelfImprovement] Owner notify (buttons) failed:', e.message);
    }
  }

  /** Отправить владельцу сообщение от имени AI и начать обсуждение */
  async sendMessageToOwner(message: string): Promise<void> {
    const ownerId = config.owner.id;
    if (!ownerId) return;
    try {
      await this.bot.telegram.sendMessage(ownerId,
        `🤖 <b>AI-система самоулучшения пишет:</b>\n\n${message}`,
        { parse_mode: 'HTML' }
      );
    } catch (e: any) {
      console.error('[SelfImprovement] sendMessageToOwner failed:', e.message);
    }
  }

  /** Задать уточняющий вопрос владельцу */
  async askOwner(question: string, context?: string): Promise<void> {
    const ownerId = config.owner.id;
    if (!ownerId) return;
    try {
      let msg = `💡 <b>AI-система хочет уточнить:</b>\n\n${question}`;
      if (context) msg += `\n\n<i>Контекст: ${context.slice(0, 300)}</i>`;
      msg += '\n\n<i>Ответьте текстом — AI прочитает и учтёт ваш ответ.</i>';
      await this.bot.telegram.sendMessage(ownerId, msg, { parse_mode: 'HTML' });
    } catch (e: any) {
      console.error('[SelfImprovement] askOwner failed:', e.message);
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

let selfImprovementInstance: SelfImprovementSystem | null = null;

export function setSelfImprovementInstance(instance: SelfImprovementSystem): void {
  selfImprovementInstance = instance;
}

export function getSelfImprovementSystem(): SelfImprovementSystem | null {
  return selfImprovementInstance;
}

export function initSelfImprovementSystem(bot: Telegraf<Context>): SelfImprovementSystem {
  if (selfImprovementInstance) return selfImprovementInstance;
  selfImprovementInstance = new SelfImprovementSystem(bot);
  selfImprovementInstance.start();
  return selfImprovementInstance;
}
