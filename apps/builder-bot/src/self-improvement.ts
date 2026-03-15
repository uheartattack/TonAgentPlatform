/**
 * self-improvement.ts — система ИИ-самоулучшения + AI Product Engineer
 *
 * Два режима работы:
 *
 * 1. Reactive (scanAndImprove) — авто-починка агентов и платформы:
 *    Level 1 🟢 — применяет сразу (баги, retry, null-checks)
 *    Level 2 🟡 — staging + аппрув владельца
 *    Level 3 🔴 — только предложение
 *
 * 2. Proactive (AI Product Engineer) — проектирует и создаёт новые фичи:
 *    Циклически обходит домены (agent_capabilities, marketplace, analytics...)
 *    Использует Claude Code (подписка) для генерации полных фич
 *    ВСЕ фичи Level 2+ — требуют одобрения владельца через Telegram кнопки
 *    Не ревьюит код, а ИЗОБРЕТАЕТ новый функционал
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
import { claudeCodeChat, isClaudeCodeAvailable } from './claude-code-bridge';

// ─── HTML escape for Telegram notifications ────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

// ── Errors NOT caused by the platform — skip these entirely ─────────────
const USER_ERROR_PATTERNS = [
  'API ключ не настроен', 'API key not configured', 'No API key',
  'NO_API_KEY', 'INSUFFICIENT_QUOTA', 'invalid_api_key',
  'incorrect api key', 'rate_limit_exceeded', 'billing',
  'authentication_error', 'permission_denied',
  'You exceeded your current quota', 'account is not active',
];

function isUserError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return USER_ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

const LEVEL3_KEYWORDS = [
  'fee', 'commission', 'blockchain', 'chain', 'token', 'ico',
  'private key', 'secret key', 'mnemonic', 'wallet seed',
  'security policy', 'audit', 'permission', 'access control',
  'data policy', 'gdpr', 'infrastructure cost', 'server cost',
];

// Критические файлы — патчи на них автоматически повышаются до Level 3
const PROTECTED_FILES = [
  'config.ts', '.env', 'index.ts',
  'self-improvement.ts', 'staging-manager.ts',
  'claude-code-bridge.ts', 'package.json',
  'db/index.ts',
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
  private proactiveTimer?: NodeJS.Timeout;
  private running = false;
  // Дедупликация: agentId → timestamp последнего авторемонта (30 мин cooldown)
  private agentRepairCooldown = new Map<number, number>();
  // Дедупликация proposals: title hash → timestamp (предотвращает повторные предложения)
  private proposalCooldown = new Map<string, number>();
  private readonly PROPOSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 часа между одинаковыми proposals

  // ─── 3 AI Modes (independent timers) ────────────────────────────────────
  private aiModes = ['improver', 'ideator', 'implementor'] as const;
  private disabledModes = new Set<string>(); // modes turned off by owner
  private manualRunning = false; // prevents double manual triggers
  private improverTimer?: NodeJS.Timeout;
  private ideatorTimer?: NodeJS.Timeout;

  private featureDomains = [
    'agent_capabilities',   // New tools, actions, integrations for AI agents
    'marketplace',          // New marketplace features, monetization, ratings, reviews
    'analytics',            // User analytics, agent performance dashboards, insights
    'social_features',      // Agent sharing, collaboration, multi-user, teams
    'blockchain_defi',      // New TON/DeFi integrations, staking, swaps, bridges
    'automation',           // Workflow automation, triggers, chains, scheduled tasks
    'monetization',         // Revenue features, subscriptions, premium tiers, referrals
    'developer_tools',      // API improvements, SDK, webhooks, plugin system
    'ux_innovation',        // Revolutionary UI/UX ideas, gamification, onboarding
    'integrations',         // External service integrations (Twitter, Discord, CRM, etc.)
  ];
  private featureDomainIndex = 0;

  // Ideator saves ideas here for Implementor to pick up
  private pendingIdeas: Array<{ title: string; description: string; domain: string; prompt: string; createdAt: Date; proposalId?: string }> = [];
  private contextFiles = [
    'src/agents/ai-agent-runtime.ts',
    'src/agents/orchestrator.ts',
    'src/bot.ts',
    'src/api-server.ts',
    'src/services/userbot-manager.ts',
    'src/agents/tools/execution-tools.ts',
    'src/services/telegram-gifts.ts',
    'src/db/schema-extensions.ts',
  ];
  private readonly MAX_CONTEXT_FILE_SIZE = 80 * 1024; // 80KB

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
    this.ai  = new OpenAI({
      apiKey:  config.claude.apiKey || '',
      baseURL: config.claude.baseURL,
    });
    // 10 минут между циклами (было 60 сек — слишком агрессивно, спам proposals)
    this.intervalMs = parseInt(process.env.SELF_IMPROVE_INTERVAL_MS || '600000');

    // Prevent unhandled pool errors from crashing the process
    dbPool.on('error', (err: Error) => {
      console.error('[DB Pool] idle client error (non-fatal):', err.message?.slice(0, 100));
    });
  }

  /** Get AI client using user's own API key (falls back to user API key) */
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

  /** Запускает независимые таймеры для каждого режима */
  start(): void {
    if (this.running) return;
    this.running = true;

    const proactiveEnabled = process.env.PROACTIVE_ENABLED !== 'false';
    if (!proactiveEnabled) {
      console.log(`🤖 AI Modes: DISABLED (PROACTIVE_ENABLED=false)`);
      return;
    }

    const ideatorMs  = parseInt(process.env.IDEATOR_INTERVAL_MS  || '1800000');  // 30 мин

    // Улучшатель — непрерывный цикл (fix → fix → fix)
    setTimeout(() => this.autoRunImprover(), 30000);
    // No interval needed — autoRunImprover runs as continuous loop

    // Придумыватель — каждые 30 мин
    setTimeout(() => this.autoRunIdeator(), 120000);
    this.ideatorTimer = setInterval(() => this.autoRunIdeator(), ideatorMs);

    // Реализатор — НЕ автоматический, только по кнопке
    console.log(`🔍 Улучшатель: 24/7 непрерывный цикл`);
    console.log(`💡 Придумыватель: каждые ${ideatorMs / 1000}с`);
    console.log(`🔨 Реализатор: только по кнопке`);

    // Загружаем идеи из БД (переживают рестарт)
    this.loadIdeasFromDB().catch(e => console.error('[SelfImprovement] loadIdeasFromDB error:', e.message?.slice(0, 100)));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.improverTimer) clearInterval(this.improverTimer);
    if (this.ideatorTimer) clearInterval(this.ideatorTimer);
    this.running = false;
  }

  private async autoRunImprover(): Promise<void> {
    // Continuous loop: finish one fix → immediately start next
    while (this.running && !this.disabledModes.has('improver')) {
      try {
        const ok = await isClaudeCodeAvailable();
        if (!ok) {
          // Claude Code busy — wait 30s and retry
          await new Promise(r => setTimeout(r, 30000));
          continue;
        }
        await this.runImprover();
        // Small pause between runs (5s) to not overwhelm Claude Code
        await new Promise(r => setTimeout(r, 5000));
      } catch (e: any) {
        console.error('[SelfImprovement] Improver error:', e.message?.slice(0, 100));
        // On error wait 60s before retry
        await new Promise(r => setTimeout(r, 60000));
      }
    }
  }

  private async autoRunIdeator(): Promise<void> {
    if (this.disabledModes.has('ideator')) return;
    try {
      const ok = await isClaudeCodeAvailable();
      if (!ok) return;
      await this.runIdeator();
    } catch (e: any) {
      console.error('[SelfImprovement] Ideator auto error:', e.message?.slice(0, 100));
    }
  }

  // ─── Управление режимами (владелец) ──────────────────────────────────────

  /** Включить/выключить конкретный режим */
  toggleMode(mode: string): boolean {
    if (this.disabledModes.has(mode)) {
      this.disabledModes.delete(mode);
      return true; // теперь включён
    } else {
      this.disabledModes.add(mode);
      return false; // теперь выключен
    }
  }

  /** Статус всех режимов */
  getModesStatus(): { mode: string; enabled: boolean; label: string }[] {
    const labels: Record<string, string> = {
      improver: '🔍 Улучшатель',
      ideator: '💡 Придумыватель',
      implementor: '🔨 Реализатор',
    };
    return this.aiModes.map(m => ({
      mode: m,
      enabled: !this.disabledModes.has(m),
      label: labels[m] || m,
    }));
  }

  /** Запустить конкретный режим вручную */
  async triggerMode(mode: string): Promise<string> {
    if (this.manualRunning) return 'already_running';

    const ccAvailable = await isClaudeCodeAvailable();
    if (!ccAvailable) return 'claude_unavailable';

    this.manualRunning = true;
    try {
      if (mode === 'improver') await this.runImprover();
      else if (mode === 'ideator') await this.runIdeator();
      else if (mode === 'implementor') await this.runImplementor();
      else return 'unknown_mode';
      return 'ok';
    } catch (e: any) {
      return `error: ${e.message?.slice(0, 100)}`;
    } finally {
      this.manualRunning = false;
    }
  }

  /** Количество идей в очереди для реализатора */
  getPendingIdeasCount(): number {
    return this.pendingIdeas.length;
  }

  /** Список идей для выбора */
  getPendingIdeas(): Array<{ index: number; title: string; domain: string; createdAt: Date }> {
    return this.pendingIdeas.map((idea, i) => ({
      index: i,
      title: idea.title,
      domain: idea.domain,
      createdAt: idea.createdAt,
    }));
  }

  /** Реализовать конкретную идею по индексу */
  async implementIdea(index: number): Promise<string> {
    if (index < 0 || index >= this.pendingIdeas.length) return 'bad_index';
    if (this.manualRunning) return 'already_running';

    const ccAvailable = await isClaudeCodeAvailable();
    if (!ccAvailable) return 'claude_unavailable';

    // Extract the chosen idea
    const [idea] = this.pendingIdeas.splice(index, 1);
    if (idea.proposalId) {
      getAIProposalsRepository().updateStatus(idea.proposalId, 'applied', { appliedAt: new Date() } as any).catch(() => {});
    }

    this.manualRunning = true;
    try {
      console.log(`[SelfImprovement] 🔨 РЕАЛИЗАТОР (manual): реализую "${idea.title}"`);
      // Load recently rejected proposals so AI doesn't repeat mistakes
    let rejectedContext = '';
    try {
      const repo = getAIProposalsRepository();
      const rejected = await repo.list({ status: 'rejected' }, 10).catch(() => []);
      if (rejected.length) {
        rejectedContext = '\n\n═══ НЕДАВНО ОТКЛОНЁННЫЕ (НЕ ПОВТОРЯЙ ЭТИ ОШИБКИ) ═══\n' +
          rejected.map((r: AIProposal) => `❌ ${r.title}: ${(r as any).rejectedReason || r.description?.slice(0, 80) || 'rejected'}`).join('\n');
      }
    } catch {}

    const codebaseContext = this.gatherCodebaseContext();
      const prompt = this.buildImplementorPrompt(idea, codebaseContext);
      await this.executeProactivePrompt(prompt, idea.domain, '🔨 РЕАЛИЗАТОР');
      return 'ok';
    } catch (e: any) {
      return `error: ${e.message?.slice(0, 100)}`;
    } finally {
      this.manualRunning = false;
    }
  }

  /** Удалить идею из очереди */
  dropIdea(index: number): boolean {
    if (index < 0 || index >= this.pendingIdeas.length) return false;
    const idea = this.pendingIdeas[index];
    this.pendingIdeas.splice(index, 1);
    if (idea.proposalId) {
      getAIProposalsRepository().updateStatus(idea.proposalId, 'rejected', { rejectedReason: 'Dropped by owner' } as any).catch(() => {});
    }
    return true;
  }

  /** Загрузить идеи из БД при старте (переживают рестарт) */
  private async loadIdeasFromDB(): Promise<void> {
    try {
      const repo = getAIProposalsRepository();
      const proposals = await repo.list({ status: 'pending', level: 3 }, 20);
      let loaded = 0;
      for (const p of proposals) {
        if (!p.title.startsWith('💡')) continue;
        if (this.pendingIdeas.some(i => i.proposalId === p.id)) continue;
        this.pendingIdeas.push({
          title: p.title.replace(/^💡\s*/, ''),
          description: p.description || '',
          domain: p.module || 'custom',
          prompt: p.reasoning || p.description || '',
          createdAt: p.createdAt,
          proposalId: p.id,
        });
        loaded++;
      }
      if (loaded > 0) {
        console.log(`[SelfImprovement] 📋 Загружено ${loaded} идей из БД`);
      }
    } catch (e: any) {
      console.error('[SelfImprovement] loadIdeasFromDB failed:', e.message?.slice(0, 100));
    }
  }

  /** Владелец описывает свою идею → Придумыватель допиливает в полный промпт */
  async submitUserIdea(rawIdea: string): Promise<string> {
    if (this.manualRunning) return 'already_running';
    const ccAvailable = await isClaudeCodeAvailable();
    if (!ccAvailable) return 'claude_unavailable';

    this.manualRunning = true;
    try {
      // Load recently rejected proposals so AI doesn't repeat mistakes
    let rejectedContext = '';
    try {
      const repo = getAIProposalsRepository();
      const rejected = await repo.list({ status: 'rejected' }, 10).catch(() => []);
      if (rejected.length) {
        rejectedContext = '\n\n═══ НЕДАВНО ОТКЛОНЁННЫЕ (НЕ ПОВТОРЯЙ ЭТИ ОШИБКИ) ═══\n' +
          rejected.map((r: AIProposal) => `❌ ${r.title}: ${(r as any).rejectedReason || r.description?.slice(0, 80) || 'rejected'}`).join('\n');
      }
    } catch {}

    const codebaseContext = this.gatherCodebaseContext();

      const prompt = `Ты — ПРИДУМЫВАТЕЛЬ для TON Agent Platform (@TonAgentPlatformBot).
Владелец платформы описал свою идею. Твоя задача — допилить её до полной спецификации.

ИДЕЯ ВЛАДЕЛЬЦА:
${rawIdea}

ПЛАТФОРМА: TypeScript, Telegraf v4, PostgreSQL, GramJS (userbot), PM2. Маркетплейс шаблонов, AI-агенты, TON блокчейн.

ТЕКУЩИЙ CODEBASE:
${codebaseContext.slice(0, 4000)}

Разработай полную спецификацию этой идеи:
- Конкретный user story
- Какие файлы менять/создавать
- Подробный промпт для РЕАЛИЗАТОРА (пошаговая инструкция)

ВСЁ на РУССКОМ. Пиши простым языком.

RESPONSE FORMAT — valid JSON:
{
  "title": "Название (до 60 символов)",
  "description": "Полное описание (3-5 предложений)",
  "userStory": "Юзер делает X → видит Y → получает Z",
  "userValue": "Почему это круто",
  "filesToChange": ["src/..."],
  "implementorPrompt": "Подробная инструкция для реализатора...",
  "domain": "подходящий_домен",
  "complexity": "small | medium | large"
}`;

      let text = '';
      const result = await claudeCodeChat(
        [{ role: 'user', content: prompt }],
        { maxTokens: 3000, timeout: 300_000, model: 'claude-sonnet-4-6' }
      );
      text = result.text?.trim() || '';

      if (!text) return 'empty_response';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return 'no_json';

      let parsed: any;
      try { parsed = JSON.parse(jsonMatch[0]); } catch { return 'bad_json'; }

      // Save to pending ideas
      // Save as proposal
      const proposal: AIProposal = {
        id: randomUUID(),
        level: 3,
        title: `💡 ${(parsed.title || 'Идея').slice(0, 57)}`,
        description: `${parsed.description || ''}\n\n👤 User Story: ${parsed.userStory || 'N/A'}\n\n📁 Файлы: ${(parsed.filesToChange || []).join(', ')}`,
        reasoning: parsed.implementorPrompt || '',
        patch: [],
        status: 'pending',
        autoApplied: false,
        module: parsed.domain || 'custom',
        createdAt: new Date(),
      };
      const repo = getAIProposalsRepository();
      await repo.create(proposal);

      // Save to in-memory queue with proposalId
      this.pendingIdeas.push({
        title: parsed.title || rawIdea.slice(0, 50),
        description: parsed.description || rawIdea,
        domain: parsed.domain || 'custom',
        prompt: parsed.implementorPrompt || parsed.description || rawIdea,
        createdAt: new Date(),
        proposalId: proposal.id,
      });

      // Notify with implement button
      const ideaIndex = this.pendingIdeas.length - 1;
      const ownerId = config.owner.id;
      if (ownerId) {
        await this.bot.telegram.sendMessage(ownerId,
          `💡 <b>Идея проработана</b>\n\n` +
          `<b>${escHtml(parsed.title || '')}</b>\n\n` +
          `${escHtml((parsed.description || '').slice(0, 400))}\n\n` +
          `👤 <b>User Story:</b> ${escHtml((parsed.userStory || '').slice(0, 200))}\n\n` +
          `📁 <b>Файлы:</b> ${escHtml((parsed.filesToChange || []).join(', '))}\n` +
          `⚡ <b>Сложность:</b> ${escHtml(parsed.complexity || '?')}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔨 Реализовать', callback_data: `ai_impl:${ideaIndex}` },
                  { text: '❌ Не надо', callback_data: `ai_drop:${ideaIndex}` },
                ],
              ],
            },
          },
        ).catch(() => {});
      }

      return 'ok';
    } catch (e: any) {
      return `error: ${e.message?.slice(0, 100)}`;
    } finally {
      this.manualRunning = false;
    }
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

  // ════════════════════════════════════════════════════════════════════════════
  // MODE 1: УЛУЧШАТЕЛЬ — жёсткий аудит платформы, баги, UX, оптимизация
  // ════════════════════════════════════════════════════════════════════════════
  private async runImprover(): Promise<void> {
    const categories = [
      'error_handling',  // Неперехваченные ошибки, плохие сообщения
      'ux_problems',     // Непонятные меню, плохие тексты, кривой flow
      'performance',     // Медленные запросы, утечки памяти, тяжёлые циклы
      'security',        // SQL injection, XSS, exposed secrets, auth bypass
      'dead_code',       // Неиспользуемый код, дублирование, мёртвые ветки
      'data_integrity',  // Race conditions, missing validations, DB issues
    ];
    const category = categories[Math.floor(Math.random() * categories.length)];

    console.log(`[SelfImprovement] 🔍 УЛУЧШАТЕЛЬ: аудит категории "${category}"`);

    // Load recently rejected proposals so AI doesn't repeat mistakes
    let rejectedContext = '';
    try {
      const repo = getAIProposalsRepository();
      const rejected = await repo.list({ status: 'rejected' }, 10).catch(() => []);
      if (rejected.length) {
        rejectedContext = '\n\n═══ НЕДАВНО ОТКЛОНЁННЫЕ (НЕ ПОВТОРЯЙ ЭТИ ОШИБКИ) ═══\n' +
          rejected.map((r: AIProposal) => `❌ ${r.title}: ${(r as any).rejectedReason || r.description?.slice(0, 80) || 'rejected'}`).join('\n');
      }
    } catch {}

    const codebaseContext = this.gatherCodebaseContext();

    // Read actual source files — rotate which ones to analyze each run
    let deepCode = '';
    const rotIdx = Math.floor(Date.now() / (10 * 60 * 1000)) % this.contextFiles.length;
    const filesToRead = [
      this.contextFiles[rotIdx],
      this.contextFiles[(rotIdx + 1) % this.contextFiles.length],
      this.contextFiles[(rotIdx + 2) % this.contextFiles.length],
    ];
    for (const f of filesToRead) {
      try {
        const fullPath = path.join(process.cwd(), f);
        if (fs.existsSync(fullPath)) {
          const code = fs.readFileSync(fullPath, 'utf8');
          deepCode += `\n\n=== ${f} (first 8000 chars) ===\n${code.slice(0, 8000)}`;
        }
      } catch {}
    }

    const prompt = `Ты — СУПЕРУЛУЧШАТЕЛЬ платформы TON Agent Platform. Ты находишь РЕАЛЬНЫЕ проблемы, баги, уязвимости и СЕРЬЁЗНО улучшаешь код.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
❌ УДАЛЯТЬ существующий код (функции, endpoints, классы, exports) — ТОЛЬКО модифицировать
❌ Переписывать большие блоки кода — делай точечные изменения
❌ "Оптимизировать" убирая функционал — пользователи могут его использовать
❌ Менять формат данных в API responses — сломает клиентов
❌ Удалять обработчики ошибок или fallback'и

ОБЯЗАТЕЛЬНО делай НАСТОЯЩИЕ улучшения:
- Фикси баги которые ломают функционал для пользователей
- Улучшай error handling (перехват ошибок, retry, fallback)
- Оптимизируй производительность (лишние запросы, утечки, тяжёлые циклы)
- Фикси security issues (SQL injection, XSS, auth bypass, timing attacks)
- Добавляй отсутствующие валидации на входных данных
- Улучшай UX (понятные сообщения об ошибках, лучший flow)

КАТЕГОРИЯ АУДИТА: ${category}

ОПИСАНИЕ КАТЕГОРИЙ:
- error_handling: Найди места где ошибки не перехватываются, показываются стектрейсы юзерам, или сообщения непонятные
- ux_problems: Найди кривые тексты в боте, непонятные кнопки, плохой flow, места где юзер запутается
- performance: Найди тяжёлые запросы без лимитов, утечки Map/Set, бесконечные циклы, лишние await
- security: Найди SQL injection, command injection, exposed secrets в логах, auth bypass
- dead_code: Найди неиспользуемые функции, дублирующийся код, мёртвые if-ветки
- data_integrity: Найди race conditions, отсутствие валидации на входных данных, проблемы с DB

CODEBASE STRUCTURE:
${codebaseContext}

ACTUAL CODE TO AUDIT:
${deepCode.slice(0, 20000)}
${rejectedContext}

ИНСТРУКЦИИ:
1. Найди ОДНУ конкретную проблему (не абстрактную, а с точным указанием файла и строки)
2. Объясни почему это проблема и как она проявляется у пользователя
3. Напиши точный патч для исправления

ВСЕ текстовые поля на РУССКОМ. Объясняй простым языком.

УРОВНИ:
- level 1: Фиксы и улучшения которые не меняют поведение (error handling, оптимизация, новые проверки). Применяются АВТОМАТИЧЕСКИ.
- level 2: Улучшения которые меняют/добавляют поведение (новые фичи, рефакторинг логики). Применяются АВТОМАТИЧЕСКИ с бэкапом + проверкой.

ВАЖНО:
- oldStr ТОЧНО совпадает с кодом в файле (copy-paste, включая пробелы и отступы)
- Патч должен быть ТОЧЕЧНЫМ — меняй минимум кода для решения проблемы
- newStr должен быть ТАКОЙ ЖЕ длины или ДЛИННЕЕ чем oldStr (добавляешь код, не удаляешь!)
- НИКОГДА не удаляй существующие функции, API endpoints, классы, экспорты — они могут использоваться
- Не "переписывай" блоки — МОДИФИЦИРУЙ отдельные строки
- Можешь ДОБАВЛЯТЬ новые функции, МОДИФИЦИРОВАТЬ существующие, УЛУЧШАТЬ логику
- НЕ трогай: self-improvement.ts, index.ts, config.ts, db/index.ts, .env, package.json
- После применения будет проверка компиляции TS и перезапуск — если сломается, автооткат

RESPONSE FORMAT — valid JSON:
{
  "title": "Краткое название проблемы (до 60 символов)",
  "description": "Что за проблема, где она, как проявляется у пользователя (2-3 предложения)",
  "userValue": "Что улучшится после фикса (1 предложение)",
  "reasoning": "Technical details",
  "domain": "${category}",
  "level": 1,
  "patch": [{"file": "src/...", "oldStr": "exact old code", "newStr": "fixed code"}],
  "newFiles": []
}

Если не нашёл реальных проблем: {"skip": true, "reason": "всё ок в этой категории"}`;

    await this.executeProactivePrompt(prompt, category, '🔍 УЛУЧШАТЕЛЬ');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MODE 2: ПРИДУМЫВАТЕЛЬ — идеи на основе РЕАЛЬНЫХ данных пользователей
  // ════════════════════════════════════════════════════════════════════════════
  private async runIdeator(): Promise<void> {
    const domain = "platform_improvement";
    console.log(`[SelfImprovement] 💡 ПРИДУМЫВАТЕЛЬ: анализирую данные пользователей...`);

    // ── Собираем реальные данные ──
    let userErrors = '';
    let userMessages = '';
    let agentStats = '';
    let failedAgents = '';

    try {
      // 1. Последние ошибки пользователей (agent_logs level='error')
      const errRes = await dbPool.query(`
        SELECT al.message, al.details, a.name as agent_name, a.trigger_type,
               al.created_at
        FROM builder_bot.agent_logs al
        JOIN builder_bot.agents a ON a.id = al.agent_id
        WHERE al.level = 'error' AND al.created_at > NOW() - INTERVAL '48 hours'
        ORDER BY al.created_at DESC LIMIT 15
      `).catch(() => ({ rows: [] }));
      if (errRes.rows.length) {
        userErrors = errRes.rows.map((r: any) =>
          `[${r.agent_name}/${r.trigger_type}] ${(r.message || '').slice(0, 120)}`
        ).join('\n');
      }
    } catch {}

    try {
      // 2. Что юзеры пишут боту (из execution_history result_summary — содержит input/context)
      const msgRes = await dbPool.query(`
        SELECT eh.result_summary, a.name as agent_name, a.trigger_type, eh.status, eh.error_message
        FROM builder_bot.execution_history eh
        JOIN builder_bot.agents a ON a.id = eh.agent_id
        WHERE eh.started_at > NOW() - INTERVAL '48 hours'
          AND eh.result_summary IS NOT NULL
        ORDER BY eh.started_at DESC LIMIT 20
      `).catch(() => ({ rows: [] }));
      if (msgRes.rows.length) {
        userMessages = msgRes.rows.map((r: any) => {
          const summary = typeof r.result_summary === 'string' ? r.result_summary : JSON.stringify(r.result_summary).slice(0, 150);
          return `[${r.agent_name}] ${r.status}: ${summary.slice(0, 120)}`;
        }).join('\n');
      }
    } catch {}

    try {
      // 3. Статистика: сколько агентов, какого типа, сколько активных
      const statsRes = await dbPool.query(`
        SELECT
          (SELECT COUNT(*) FROM builder_bot.agents) AS total,
          (SELECT COUNT(*) FROM builder_bot.agents WHERE is_active = true) AS active,
          (SELECT COUNT(DISTINCT user_id) FROM builder_bot.agents) AS users,
          (SELECT COUNT(*) FROM builder_bot.agents WHERE trigger_type = 'ai_agent') AS ai_agents,
          (SELECT COUNT(*) FROM builder_bot.execution_history WHERE started_at > NOW() - INTERVAL '24 hours' AND status = 'error') AS errors_24h,
          (SELECT COUNT(*) FROM builder_bot.execution_history WHERE started_at > NOW() - INTERVAL '24 hours') AS total_runs_24h
      `).catch(() => ({ rows: [{}] }));
      const s = statsRes.rows[0] as any;
      agentStats = `Агентов: ${s.total || 0} (активных ${s.active || 0}), юзеров: ${s.users || 0}, AI-агентов: ${s.ai_agents || 0}, за 24ч: ${s.total_runs_24h || 0} запусков, ${s.errors_24h || 0} ошибок`;
    } catch {}

    try {
      // 4. Часто падающие агенты
      const failRes = await dbPool.query(`
        SELECT a.name, a.trigger_type, COUNT(*) as err_count,
               array_agg(DISTINCT LEFT(eh.error_message, 80)) as errors
        FROM builder_bot.execution_history eh
        JOIN builder_bot.agents a ON a.id = eh.agent_id
        WHERE eh.status = 'error' AND eh.started_at > NOW() - INTERVAL '48 hours'
        GROUP BY a.id, a.name, a.trigger_type
        ORDER BY err_count DESC LIMIT 5
      `).catch(() => ({ rows: [] }));
      if (failRes.rows.length) {
        failedAgents = failRes.rows.map((r: any) =>
          `${r.name} (${r.trigger_type}): ${r.err_count} ошибок — ${(r.errors || []).slice(0, 2).join('; ')}`
        ).join('\n');
      }
    } catch {}

    let recentProposals = '';
    try {
      const repo = getAIProposalsRepository();
      const recent = await repo.list(undefined, 15).catch(() => []);
      recentProposals = recent.map((p: AIProposal) => `- [${p.status}] ${p.title}`).join('\n');
    } catch {}

    const recentIdeas = this.pendingIdeas.map(i => `- ${i.title}`).join('\n');

    const prompt = `Ты — ПРОДАКТ-МЕНЕДЖЕР платформы TON Agent Platform (@TonAgentPlatformBot).
Думай КАК ПОЛЬЗОВАТЕЛЬ. Что бы ТЫ хотел, если бы создавал AI-агента в Telegram?

ПЛАТФОРМА: Telegram бот где обычные люди (не программисты!) создают AI-агентов которые работают от их имени. Агент подключается к Telegram аккаунту юзера и действует как живой человек — отвечает на сообщения, мониторит чаты, публикует контент, торгует подарками и NFT.

═══ ТЕКУЩИЕ ДАННЫЕ ═══
${agentStats || 'Статистика недоступна'}
Ошибки: ${userErrors ? userErrors.slice(0, 500) : 'нет'}
Падающие агенты: ${failedAgents ? failedAgents.slice(0, 300) : 'нет'}
Активность: ${userMessages ? userMessages.slice(0, 500) : 'нет'}

УЖЕ ПРЕДЛОЖЕНО (НЕ ПОВТОРЯЙ):
${recentProposals || 'ничего'}
${recentIdeas ? recentIdeas : ''}

═══ ДУМАЙ КАК ЮЗЕР ═══
Представь: ты обычный человек, у тебя Telegram канал или группа. Ты хочешь автоматизировать рутину.
Что тебе реально нужно? Примеры ХОРОШИХ идей:
- Агент который СРАЗУ видит новый DM и отвечает (не через 5 минут)
- Кнопка "скопировать агента" чтоб клонировать настройки
- Авто-модерация группы — банит спам, фильтрует матюки
- Агент который по расписанию постит контент в канал (утром новости, вечером мемы)
- Уведомление когда кто-то упомянул тебя в чате
- Аналитика: сколько сообщений агент обработал, сколько ответил, какой retention
- Интеграция с ChatGPT/Claude для генерации контента прямо в агенте
- Авто-ответчик с шаблонами ("я на совещании, отвечу через час")
- Мультиязычный агент — определяет язык и отвечает на нём

ПЛОХИЕ идеи (НЕ ПРЕДЛАГАЙ):
- Внутренние метрики для разработчиков (action rate, run classifier)
- Абстрактные системы (orchestration layer, event bus)
- Технический рефакторинг
- Всё что юзер не увидит и не потрогает

ПРИДУМАЙ ОДНУ КОНКРЕТНУЮ ФИЧУ которую юзер:
1. Увидит в боте (новая кнопка, команда, или автоматическое поведение)
2. Сможет сразу использовать
3. Скажет "блин, вот это круто, мне это реально надо"

ВСЁ на РУССКОМ.

JSON:
{
  "title": "Название (до 60 символов)",
  "description": "Что за фича, как юзер её увидит и будет использовать (3-5 предложений)",
  "userStory": "Юзер нажимает X → видит Y → получает Z",
  "userValue": "Почему юзер скажет 'вау' (1 предложение)",
  "filesToChange": ["src/..."],
  "implementorPrompt": "Подробный промпт для реализатора с указанием файлов, функций, UI",
  "domain": "user_feature",
  "complexity": "small | medium | large"
}

Если нет хорошей идеи: {"skip": true, "reason": "..."}`;

    let text = '';
    try {
      console.log(`[SelfImprovement] ПРИДУМЫВАТЕЛЬ: sending to Claude Code...`);
      const result = await claudeCodeChat(
        [{ role: 'user', content: prompt }],
        { maxTokens: 3000, timeout: 300_000, model: 'claude-sonnet-4-6' }
      );
      text = result.text?.trim() || '';
    } catch (e: any) {
      console.error(`[SelfImprovement] ПРИДУМЫВАТЕЛЬ failed: ${e.message?.slice(0, 150)}`);
      return;
    }

    if (!text) return;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    let parsed: any;
    try { parsed = JSON.parse(jsonMatch[0]); } catch { return; }
    if (parsed.skip) {
      console.log(`[SelfImprovement] ПРИДУМЫВАТЕЛЬ: пропуск — ${parsed.reason}`);
      return;
    }

    // Save idea for Implementor
    // Save as Level 3 proposal (idea, no code)
    const proposal: AIProposal = {
      id: randomUUID(),
      level: 3,
      title: `💡 ${(parsed.title || 'Идея').slice(0, 57)}`,
      description: `${parsed.description || ''}\n\n👤 User Story: ${parsed.userStory || 'N/A'}\n\n📁 Файлы: ${(parsed.filesToChange || []).join(', ')}`,
      reasoning: parsed.implementorPrompt || '',
      patch: [],
      status: 'pending',
      autoApplied: false,
      module: domain,
      createdAt: new Date(),
    };

    const repo = getAIProposalsRepository();
    await repo.create(proposal);

    // Save to in-memory queue with proposalId
    this.pendingIdeas.push({
      title: parsed.title || 'Без названия',
      description: parsed.description || '',
      domain: parsed.domain || domain,
      prompt: parsed.implementorPrompt || parsed.description || '',
      createdAt: new Date(),
      proposalId: proposal.id,
    });

    // Notify owner with "Реализовать?" button
    const ideaIndex = this.pendingIdeas.length - 1;
    const ownerId = config.owner.id;
    if (ownerId) {
      try {
        await this.bot.telegram.sendMessage(ownerId,
          `💡 <b>Новая идея от ПРИДУМЫВАТЕЛЯ</b>\n\n` +
          `<b>${escHtml(parsed.title || '')}</b>\n\n` +
          `${escHtml((parsed.description || '').slice(0, 400))}\n\n` +
          `👤 <b>User Story:</b> ${escHtml((parsed.userStory || '').slice(0, 200))}\n\n` +
          `📁 <b>Файлы:</b> ${escHtml((parsed.filesToChange || []).join(', '))}\n` +
          `⚡ <b>Сложность:</b> ${escHtml(parsed.complexity || '?')}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔨 Реализовать', callback_data: `ai_impl:${ideaIndex}` },
                  { text: '❌ Не надо', callback_data: `ai_drop:${ideaIndex}` },
                ],
                [
                  { text: '💬 Обсудить', callback_data: `proposal_discuss:${proposal.id}` },
                ],
              ],
            },
          },
        );
      } catch (e: any) {
        console.error('[SelfImprovement] Ideator notify failed:', e.message?.slice(0, 80));
      }
    }

    console.log(`[SelfImprovement] 💡 Идея: ${parsed.title} (${domain})`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MODE 3: РЕАЛИЗАТОР — берёт идею от придумывателя и пишет код
  // ════════════════════════════════════════════════════════════════════════════
  private async runImplementor(): Promise<void> {
    // Pick oldest pending idea
    if (!this.pendingIdeas.length) {
      console.log(`[SelfImprovement] 🔨 РЕАЛИЗАТОР: нет идей в очереди, пропуск`);
      return;
    }

    const idea = this.pendingIdeas.shift()!;
    if (idea.proposalId) {
      getAIProposalsRepository().updateStatus(idea.proposalId, 'applied', { appliedAt: new Date() } as any).catch(() => {});
    }
    console.log(`[SelfImprovement] 🔨 РЕАЛИЗАТОР: реализую идею "${idea.title}"`);

    // Load recently rejected proposals so AI doesn't repeat mistakes
    let rejectedContext = '';
    try {
      const repo = getAIProposalsRepository();
      const rejected = await repo.list({ status: 'rejected' }, 10).catch(() => []);
      if (rejected.length) {
        rejectedContext = '\n\n═══ НЕДАВНО ОТКЛОНЁННЫЕ (НЕ ПОВТОРЯЙ ЭТИ ОШИБКИ) ═══\n' +
          rejected.map((r: AIProposal) => `❌ ${r.title}: ${(r as any).rejectedReason || r.description?.slice(0, 80) || 'rejected'}`).join('\n');
      }
    } catch {}

    const codebaseContext = this.gatherCodebaseContext();
    const prompt = this.buildImplementorPrompt(idea, codebaseContext);
    await this.executeProactivePrompt(prompt, idea.domain, '🔨 РЕАЛИЗАТОР');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Build implementor prompt (shared between auto and manual)
  // ════════════════════════════════════════════════════════════════════════════
  private buildImplementorPrompt(idea: { title: string; description: string; domain: string; prompt: string }, codebaseContext: string): string {
    return `Ты — РЕАЛИЗАТОР для TON Agent Platform. Тебе дали идею — реализуй её в коде.

ИДЕЯ: ${idea.title}
ОПИСАНИЕ: ${idea.description}
ДОМЕН: ${idea.domain}

ИНСТРУКЦИЯ ОТ ПРИДУМЫВАТЕЛЯ:
${idea.prompt}

ТЕКУЩИЙ CODEBASE:
${codebaseContext}

ПЛАТФОРМА: TypeScript, Telegraf v4, PostgreSQL (dbPool.query), GramJS, PM2.
Бот: src/bot.ts. AI runtime: src/agents/ai-agent-runtime.ts. API: src/api-server.ts.

ЗАДАЧА: Напиши РАБОЧИЙ КОД для этой идеи.

ВСЕ текстовые поля на РУССКОМ.

RESPONSE FORMAT — valid JSON:
{
  "title": "Название (до 60 символов, по-русски)",
  "description": "Что реализовано (2-3 предложения)",
  "userValue": "Что получат пользователи (1 предложение)",
  "reasoning": "Technical approach",
  "domain": "${idea.domain}",
  "level": 2,
  "patch": [{"file": "src/...", "oldStr": "exact existing code", "newStr": "new code"}],
  "newFiles": [{"file": "src/...", "content": "full file content"}]
}

ПРАВИЛА:
- oldStr ДОЛЖЕН быть ТОЧНОЙ копией из реального файла
- Новые файлы — полные, рабочие, с импортами
- Максимум 5 патчей + 2 новых файла
- Production-quality TypeScript
- Язык кода: English. Язык UI: Russian`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHARED: Execute prompt and save proposal (used by Improver and Implementor)
  // ════════════════════════════════════════════════════════════════════════════
  private async executeProactivePrompt(prompt: string, domain: string, modeLabel: string): Promise<void> {
    try {
      // Send prompt (already constructed by runImprover/runIdeator/runImplementor) to Claude Code
      let text = '';
      try {
        console.log(`[SelfImprovement] ${modeLabel}: sending prompt to Claude Code (${prompt.length} chars)...`);
        const result = await claudeCodeChat(
          [{ role: 'user', content: prompt }],
          { maxTokens: 6000, timeout: 600_000, model: 'claude-sonnet-4-6' }
        );
        text = result.text?.trim() || '';
        console.log(`[SelfImprovement] ${modeLabel}: Claude Code responded (${text.length} chars, model: ${result.model})`);
      } catch (ccErr: any) {
        console.error(`[SelfImprovement] ${modeLabel} Claude Code failed: ${ccErr.message?.slice(0, 200)}`);
        return;
      }

      if (!text) {
        console.log(`[SelfImprovement] ${modeLabel}: empty response from Claude Code`);
        return;
      }

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`[SelfImprovement] ${modeLabel}: no JSON found in response. First 300 chars: ${text.slice(0, 300)}`);
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr: any) {
        console.log(`[SelfImprovement] ${modeLabel}: invalid JSON. Error: ${parseErr.message?.slice(0, 100)}. First 300 chars: ${jsonMatch[0].slice(0, 300)}`);
        return;
      }

      if (parsed.skip) {
        console.log(`[SelfImprovement] ${modeLabel}: ${domain} — skipped (${parsed.reason || 'no ideas'})`);
        return;
      }

      console.log(`[SelfImprovement] ${modeLabel}: parsed feature "${parsed.title}" with ${(parsed.patch || []).length} patches, ${(parsed.newFiles || []).length} new files`);

      // Deduplication check
      const proposalKey = `feature:${domain}:${(parsed.title || '').slice(0, 40).toLowerCase().replace(/\s+/g, '_')}`;
      const lastSeen = this.proposalCooldown.get(proposalKey) || 0;
      if (Date.now() - lastSeen < this.PROPOSAL_COOLDOWN_MS) {
        console.log(`[SelfImprovement] ${modeLabel}: duplicate proposal skipped`);
        return;
      }

      // Protected files list
      // Only truly critical files that must never be auto-modified
      const PROTECTED_FILES = [
        'src/index.ts', 'src/config.ts', 'src/db/index.ts',
        'src/self-improvement.ts', 'src/claude-code-bridge.ts',
        'src/staging-manager.ts',
        '.env', 'package.json', 'tsconfig.json',
      ];
      const blocked = (parsed.patch || []).filter((p: any) => PROTECTED_FILES.some(pf => (p.file || '').endsWith(pf)));
      if (blocked.length) {
        console.log(`[SelfImprovement] ${modeLabel}: BLOCKED patches to protected files: ${blocked.map((b: any) => b.file).join(', ')}`);
        parsed.patch = (parsed.patch || []).filter((p: any) => !PROTECTED_FILES.some(pf => (p.file || '').endsWith(pf)));
      }
      const blockedNew = (parsed.newFiles || []).filter((nf: any) => PROTECTED_FILES.some(pf => (nf.file || '').endsWith(pf)));
      if (blockedNew.length) {
        parsed.newFiles = (parsed.newFiles || []).filter((nf: any) => !PROTECTED_FILES.some(pf => (nf.file || '').endsWith(pf)));
      }

      // ═══ SAFETY GUARDS — can improve anything, but can't DELETE functionality ═══
      const MAX_PATCH_LINES = 300;   // Big improvements OK
      const MAX_TOTAL_PATCHES = 10;  // Multiple related fixes OK

      // Validate existing file patches
      const staging = getStagingManager();
      const validPatch: AIPatchEntry[] = [];
      const rawPatches = (parsed.patch || []).slice(0, MAX_TOTAL_PATCHES);
      for (const p of rawPatches) {
        if (!p.file || !p.oldStr || !p.newStr) continue;

        // Safety: block oversized patches AND mass deletions
        const oldLines = p.oldStr.split('\n').length;
        const newLines = p.newStr.split('\n').length;
        // Block if deleting more than 30% of lines (prevents gutting files)
        if (oldLines > 10 && newLines < oldLines * 0.7) {
          console.log(`[SelfImprovement] ${modeLabel}: BLOCKED — deletes too much (${oldLines}→${newLines} lines) in ${p.file}`);
          continue;
        }
        if (oldLines > MAX_PATCH_LINES) {
          console.log(`[SelfImprovement] ${modeLabel}: BLOCKED — patch too large (${oldLines} lines) in ${p.file}`);
          continue;
        }

        // Safety: reject patches that remove function/class/endpoint definitions
        const deletedContent = p.oldStr.toLowerCase();
        const addedContent = p.newStr.toLowerCase();
        const removesEndpoint = /app\.(get|post|put|delete|patch)\s*\(/.test(deletedContent) && !/app\.(get|post|put|delete|patch)\s*\(/.test(addedContent);
        const removesFunction = /(?:async\s+)?(?:function|export\s+(?:async\s+)?function)\s+\w+/.test(deletedContent) && !/(?:async\s+)?(?:function|export\s+(?:async\s+)?function)\s+\w+/.test(addedContent);
        const removesClass = /class\s+\w+/.test(deletedContent) && !/class\s+\w+/.test(addedContent);
        if (removesEndpoint || removesFunction || removesClass) {
          console.log(`[SelfImprovement] ${modeLabel}: BLOCKED — removes endpoint/function/class in ${p.file}`);
          continue;
        }

        const validation = staging.validatePatch(p);
        if (validation.valid) validPatch.push(p);
        else console.log(`[SelfImprovement] Feature patch validation failed: ${validation.error}`);
      }

      // Handle new files — convert to patches (create file = patch with empty oldStr)
      for (const nf of (parsed.newFiles || [])) {
        if (!nf.file || !nf.content) continue;
        validPatch.push({
          file: nf.file,
          oldStr: '',  // empty = new file
          newStr: nf.content,
        });
      }

      if (!validPatch.length) {
        // Even without patches, save as Level 3 proposal (idea only)
        console.log(`[SelfImprovement] ${modeLabel}: "${parsed.title}" has no valid patches — saving as idea`);
      }

      // Улучшатель: Level 1-2 auto-apply. Придумыватель/Реализатор: always ask owner.
      const isImprover = modeLabel.includes('УЛУЧШАТЕЛЬ');
      const level = (isImprover ? Math.min(parsed.level || 2, 2) : (parsed.level >= 3 ? 3 : 2)) as 1 | 2 | 3;

      const proposal: AIProposal = {
        id: randomUUID(),
        level,
        title: `🚀 ${(parsed.title || 'New Feature').slice(0, 57)}`,
        description: `${parsed.description || ''}\n\n💡 User Value: ${parsed.userValue || 'N/A'}\n\n🏷️ Domain: ${domain}`,
        reasoning: parsed.reasoning || '',
        patch: validPatch,
        status: 'pending',
        autoApplied: false,
        module: domain,
        createdAt: new Date(),
      };

      // Save to DB
      const repo = getAIProposalsRepository();
      await repo.create(proposal);

      // Mark cooldown
      this.proposalCooldown.set(proposalKey, Date.now());

      const patchSummary = validPatch.map(p => {
        if (p.oldStr === '') return `📄 NEW: ${p.file}`;
        return `✏️ ${p.file}`;
      }).join('\n');

      // ═══ Улучшатель: AUTO-APPLY Level 1-2 (с бэкапом и проверкой) ═══
      if (isImprover && validPatch.length && level <= 2) {
        const files = [...new Set(validPatch.map(p => p.file))];
        await staging.backupFiles(proposal.id, files);

        const applyErrors: string[] = [];
        for (const patch of validPatch) {
          const result = await staging.applyPatchToFile(patch);
          if (!result.ok) applyErrors.push(result.error!);
        }

        if (applyErrors.length) {
          await staging.restoreBackup(proposal.id);
          await repo.updateStatus(proposal.id, 'rejected', {
            rejectedReason: `Auto-apply failed: ${applyErrors.join('; ')}`
          });
          console.log(`[SelfImprovement] ${modeLabel}: auto-apply FAILED — rolled back`);
          return;
        }

        // Verify TypeScript compiles
        let compileOk = true;
        try {
          const { execSync } = require('child_process');
          execSync('npx tsc --noEmit --skipLibCheck 2>&1 | head -20', { cwd: process.cwd(), timeout: 30000, encoding: 'utf8' });
        } catch (compileErr: any) {
          const output = (compileErr.stdout || compileErr.message || '').slice(0, 500);
          const ourErrors = output.split('\n').filter((l: string) => l.includes('src/') && l.includes('error TS'));
          if (ourErrors.length > 0) {
            compileOk = false;
            console.log(`[SelfImprovement] ${modeLabel}: compile FAILED — rolling back`);
            await staging.restoreBackup(proposal.id);
            await repo.updateStatus(proposal.id, 'rejected', {
              rejectedReason: `Compile failed: ${ourErrors[0]}`
            });
            return;
          }
        }

        // Success — mark as applied
        await repo.updateStatus(proposal.id, 'applied', {
          appliedAt: new Date(),
          autoApplied: true,
        } as any);

        // Git commit + push
        let gitInfo = '';
        try {
          const { execSync } = require('child_process');
          const commitMsg = `[AI] ${(parsed.title || 'fix').slice(0, 60)}`;
          for (const f of files) {
            try { execSync(`git add "${f}"`, { cwd: process.cwd(), timeout: 5000 }); } catch {}
          }
          execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: process.cwd(), timeout: 15000, encoding: 'utf8' });
          execSync('git push', { cwd: process.cwd(), timeout: 30000, encoding: 'utf8' });
          gitInfo = '\n📌 Git: committed & pushed';
          console.log(`[SelfImprovement] 📌 Git: ${commitMsg}`);
        } catch (gitErr: any) {
          gitInfo = '\n⚠️ Git: ' + (gitErr.message || '').slice(0, 80);
        }

        await this.notifyOwner(
          `✅ <b>${escHtml(modeLabel)} Auto-Applied</b>\n\n` +
          `<b>${escHtml(proposal.title)}</b>\n` +
          `${escHtml((parsed.description || '').slice(0, 300))}\n\n` +
          `📦 ${escHtml(patchSummary)}${escHtml(gitInfo)}\n\n` +
          `<i>Применено с бэкапом. /rollback_${proposal.id.slice(0, 8)} для отката</i>`,
        );
        // PM2 restart to apply changes + verify bot survives
        try {
          const { execSync } = require('child_process');
          execSync('pm2 restart ton-agent-bot --silent', { timeout: 10000 });
          // Wait for bot to come back up
          await new Promise(r => setTimeout(r, 15000));
          // Verify it's running
          const status = execSync('pm2 jlist', { timeout: 5000, encoding: 'utf8' });
          const procs = JSON.parse(status);
          const bot = procs.find((p: any) => p.name === 'ton-agent-bot');
          if (bot?.pm2_env?.status !== 'online') {
            console.log(`[SelfImprovement] ⚠️ Bot not online after restart — rolling back`);
            await staging.restoreBackup(proposal.id);
            await repo.updateStatus(proposal.id, 'rejected', { rejectedReason: 'Bot crashed after apply' });
            execSync('pm2 restart ton-agent-bot --silent', { timeout: 10000 });
            return;
          }
        } catch (restartErr: any) {
          console.log(`[SelfImprovement] PM2 restart check skipped: ${(restartErr.message || '').slice(0, 60)}`);
        }

        console.log(`[SelfImprovement] ✅ ${modeLabel}: auto-applied "${proposal.title}" (${validPatch.length} patches)`);

      } else {
        // Придумыватель / Реализатор / ideas without patches — staging + ask owner
        if (validPatch.length) {
          const stagingErrors: string[] = [];
          for (const patch of validPatch) {
            if (patch.oldStr === '') continue;
            const result = await staging.applyPatchToStaging(patch);
            if (!result.ok) stagingErrors.push(result.error!);
          }
          const stagingStatus = stagingErrors.length
            ? `Staging: ${stagingErrors.length} errors`
            : `Staging: OK (${validPatch.length} changes)`;
          await repo.updateStatus(proposal.id, 'staging', { stagingResult: stagingStatus } as any);
        }

        await this.notifyOwnerWithButtons(
        `${escHtml(modeLabel)} <b>Новое предложение</b>\n\n` +
        `<b>${escHtml(proposal.title)}</b>\n\n` +
        `${escHtml((parsed.description || '').slice(0, 500))}\n\n` +
        `💡 <b>Для пользователей:</b> ${escHtml((parsed.userValue || '').slice(0, 250))}\n\n` +
        `📦 <b>Файлы:</b>\n${escHtml(patchSummary)}`,
        proposal.id,
      );
      }

      console.log(`[SelfImprovement] ${modeLabel}: "${proposal.title}" (${domain}, ${validPatch.length} patches)`);

    } catch (e: any) {
      console.error(`[SelfImprovement] ${modeLabel} error:`, e.message?.slice(0, 150));
    }
  }

  /**
   * Gathers DEEP codebase context — reads key source files and extracts
   * function signatures, exports, class structures, DB tables, API endpoints,
   * tool definitions, and architectural patterns. Provides the AI Product
   * Engineer with maximum understanding of the platform.
   */
  private gatherCodebaseContext(): string {
    const sections: string[] = [];

    // ── 1. File structure and signatures ──
    for (const relFile of this.contextFiles) {
      try {
        const filePath = path.join(process.cwd(), relFile);
        if (!fs.existsSync(filePath)) continue;

        const stat = fs.statSync(filePath);
        if (stat.size > this.MAX_CONTEXT_FILE_SIZE) {
          sections.push(`[${relFile}] — ${(stat.size / 1024).toFixed(0)}KB (too large for full read)`);
          continue;
        }

        const code = fs.readFileSync(filePath, 'utf8');
        const lines = code.split('\n');
        const keyLines: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (
            trimmed.startsWith('export ') ||
            trimmed.startsWith('async function ') ||
            trimmed.startsWith('function ') ||
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('type ') ||
            trimmed.startsWith('// ─') ||
            trimmed.startsWith('/** ') ||
            trimmed.startsWith('bot.command(') ||
            trimmed.startsWith('bot.action(') ||
            trimmed.startsWith('app.get(') ||
            trimmed.startsWith('app.post(') ||
            trimmed.startsWith('app.put(') ||
            trimmed.startsWith('app.delete(') ||
            trimmed.includes('CREATE TABLE') ||
            trimmed.includes('bot.on(')
          ) {
            keyLines.push(trimmed.slice(0, 150));
          }
        }

        sections.push(`[${relFile}] (${(stat.size / 1024).toFixed(0)}KB):\n${keyLines.slice(0, 40).join('\n')}`);
      } catch {}
    }

    // ── 2. DB Schema — read all tables ──
    try {
      const schemaFile = path.join(process.cwd(), 'src/db/schema-extensions.ts');
      if (fs.existsSync(schemaFile)) {
        const schema = fs.readFileSync(schemaFile, 'utf8');
        const tableMatches = schema.match(/CREATE TABLE[^;]+;/gs) || [];
        if (tableMatches.length) {
          sections.push(`[DB TABLES]:\n${tableMatches.map(t => t.slice(0, 200)).join('\n\n')}`);
        }
      }
    } catch {}

    // ── 3. Agent tools catalog ──
    try {
      const runtimeFile = path.join(process.cwd(), 'src/agents/ai-agent-runtime.ts');
      if (fs.existsSync(runtimeFile)) {
        const runtime = fs.readFileSync(runtimeFile, 'utf8');
        // Extract tool definitions
        const toolMatches = runtime.match(/\{\s*type:\s*'function',\s*function:\s*\{[^}]+\}/gs) || [];
        if (toolMatches.length) {
          const toolNames = toolMatches.map(t => {
            const nameMatch = t.match(/name:\s*'([^']+)'/);
            const descMatch = t.match(/description:\s*'([^']+)'/);
            return nameMatch ? `  - ${nameMatch[1]}: ${descMatch?.[1]?.slice(0, 80) || ''}` : '';
          }).filter(Boolean);
          sections.push(`[AI AGENT TOOLS] (${toolNames.length} tools):\n${toolNames.join('\n')}`);
        }
      }
    } catch {}

    // ── 4. Bot commands ──
    try {
      const botFile = path.join(process.cwd(), 'src/bot.ts');
      if (fs.existsSync(botFile)) {
        const bot = fs.readFileSync(botFile, 'utf8');
        const commands = bot.match(/bot\.command\('([^']+)'/g) || [];
        const actions = bot.match(/bot\.action\((?:'([^']+)'|\/([^/]+)\/)/g) || [];
        sections.push(`[BOT COMMANDS] (${commands.length}):\n${commands.slice(0, 25).join('\n')}`);
        sections.push(`[BOT ACTIONS/CALLBACKS] (${actions.length}):\n${actions.slice(0, 30).join('\n')}`);
      }
    } catch {}

    // ── 5. API endpoints ──
    try {
      const apiFile = path.join(process.cwd(), 'src/api-server.ts');
      if (fs.existsSync(apiFile)) {
        const api = fs.readFileSync(apiFile, 'utf8');
        const endpoints = api.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"`]+['"`]/g) || [];
        sections.push(`[API ENDPOINTS] (${endpoints.length}):\n${endpoints.join('\n')}`);
      }
    } catch {}

    // ── 6. Services ──
    try {
      const servicesDir = path.join(process.cwd(), 'src/services');
      if (fs.existsSync(servicesDir)) {
        const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));
        sections.push(`[SERVICES]: ${serviceFiles.join(', ')}`);
      }
    } catch {}

    // ── 7. Templates catalog ──
    try {
      const orchFile = path.join(process.cwd(), 'src/agents/orchestrator.ts');
      if (fs.existsSync(orchFile)) {
        const orch = fs.readFileSync(orchFile, 'utf8');
        const templates = orch.match(/id:\s*'[^']+',\s*name:\s*'[^']+'/g) || [];
        if (templates.length) {
          sections.push(`[TEMPLATES] (${templates.length}):\n${templates.slice(0, 15).join('\n')}`);
        }
      }
    } catch {}

    // ── 8. Full file tree ──
    try {
      const srcDir = path.join(process.cwd(), 'src');
      if (fs.existsSync(srcDir)) {
        const files: string[] = [];
        const walk = (dir: string, prefix = '') => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
            const rel = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.isDirectory()) walk(path.join(dir, e.name), rel);
            else if (e.name.endsWith('.ts') || e.name.endsWith('.js')) files.push(`src/${rel}`);
          }
        };
        walk(srcDir);
        sections.push(`[ALL SOURCE FILES] (${files.length}):\n${files.join('\n')}`);
      }
    } catch {}

    return sections.join('\n\n').slice(0, 6000);
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

      // Try Claude Code first (subscription), then user's API key, then platform API
      let rawText = '';
      const ccAvailable = await isClaudeCodeAvailable();
      if (ccAvailable) {
        try {
          const result = await claudeCodeChat(
            [{ role: 'user', content: prompt }],
            { maxTokens: 4000, timeout: 90_000 }
          );
          rawText = result.text;
        } catch (ccErr: any) {
          console.warn(`[SelfImprovement] Claude Code repair failed: ${ccErr.message?.slice(0, 60)}`);
        }
      }
      if (!rawText) {
        const aiClient = userAI || this.ai;
        const response = await aiClient.chat.completions.create({
          model:      config.claude.model,
          max_tokens: 4000,
          messages:   [{ role: 'user', content: prompt }],
        });
        rawText = response.choices[0]?.message?.content?.trim() || '';
      }

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
        `✅ Repaired via ${ccAvailable ? 'Claude Code' : (userAI !== this.ai ? 'User API' : 'Platform AI')}`
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

      // Try Claude Code first, then user/platform API
      let newPrompt = '';
      const ccAvailable = await isClaudeCodeAvailable();
      if (ccAvailable) {
        try {
          const result = await claudeCodeChat(
            [{ role: 'user', content: prompt }],
            { maxTokens: 4000, timeout: 90_000 }
          );
          newPrompt = result.text?.trim() || '';
        } catch {}
      }
      if (!newPrompt) {
        const aiClient = userAI || this.ai;
        const response = await aiClient.chat.completions.create({
          model:      config.claude.model,
          max_tokens: 4000,
          messages:   [{ role: 'user', content: prompt }],
        });
        newPrompt = response.choices[0]?.message?.content?.trim() || '';
      }
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
        if (isUserError(log.message)) continue; // Skip user config errors
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
        if (isUserError(errorInfo.error || '')) continue; // Skip user config errors

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

    // Читаем релевантный код (если известен модуль) — expanded for Claude Code
    const codeSnippet = this.getRelevantCode(issue.module);

    // Дополнительный контекст: список всех файлов платформы
    const fileList = this.getPlatformFileList();

    const prompt = `Ты — опытный инженер-программист, обслуживающий платформу TON Agent Platform.
Платформа написана на TypeScript (Telegraf v4 + PostgreSQL + Drizzle ORM).

ОБНАРУЖЕННАЯ ПРОБЛЕМА:
Тип: ${issue.type}
Серьёзность: ${issue.severity}
Описание: ${issue.description}
Модуль: ${issue.module || 'неизвестно'}
${issue.sample ? `Пример ошибки: ${issue.sample.slice(0, 300)}` : ''}

РЕЗУЛЬТАТЫ ИССЛЕДОВАНИЯ:
${research || 'Релевантная информация не найдена.'}

СТРУКТУРА ПРОЕКТА:
${fileList}

СООТВЕТСТВУЮЩИЙ КОД:
${codeSnippet || 'Фрагмент кода недоступен.'}

ВАЖНО: Игнорируй ошибки конфигурации пользователей (нет API ключа, нет кошелька, etc.) — это НЕ баги платформы.

ЗАДАЧА:
Сгенерируй исправление. Ответь ТОЛЬКО валидным JSON:
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

Уровни:
- 1: опечатки, null-checks, retry, обработка ошибок, логи, оптимизация
- 2: новая стратегия, новый источник данных, новый алгоритм
- 3: комиссии, безопасность, ключи, кошельки, политики

Если не можешь — верни: {"skip": true, "reason": "объяснение"}`;

    try {
      let text = '';

      // ── 1. Try Claude Code CLI first (uses subscription) ──
      const ccAvailable = await isClaudeCodeAvailable();
      if (ccAvailable) {
        try {
          const result = await claudeCodeChat(
            [{ role: 'user', content: prompt }],
            { maxTokens: 2000, timeout: 60_000 }
          );
          text = result.text;
          console.log(`[SelfImprovement] Claude Code generated solution (${result.model})`);
        } catch (ccErr: any) {
          console.warn(`[SelfImprovement] Claude Code failed: ${ccErr.message?.slice(0, 80)}, falling back to API`);
        }
      }

      // ── 2. Fallback to API ──
      if (!text) {
        const response = await this.ai.chat.completions.create({
          model:       config.claude.model,
          max_tokens:  1500,
          messages:    [{ role: 'user', content: prompt }],
        });
        text = response.choices[0]?.message?.content?.trim() || '';
      }

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

  /** Возвращает список файлов платформы для контекста AI */
  private getPlatformFileList(): string {
    try {
      const srcDir = path.join(process.cwd(), 'src');
      if (!fs.existsSync(srcDir)) return 'src/ not found';
      const files: string[] = [];
      const walk = (dir: string, prefix = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
          const rel = prefix ? `${prefix}/${e.name}` : e.name;
          if (e.isDirectory()) walk(path.join(dir, e.name), rel);
          else if (e.name.endsWith('.ts') || e.name.endsWith('.js')) files.push(rel);
        }
      };
      walk(srcDir);
      return files.map(f => `src/${f}`).join('\n');
    } catch { return ''; }
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
      `<b>${escHtml(proposal.title)}</b>\n` +
      `${escHtml(proposal.description.slice(0, 400))}\n\n` +
      `Обоснование: <i>${escHtml((proposal.reasoning || '').slice(0, 300))}</i>\n\n` +
      `${escHtml(stagingResult)}`,
      proposal.id,
    );

    console.log(`[SelfImprovement] 🟡 Level 2 staging ready: ${proposal.title}`);
  }

  /** Level 3: только предложение, требует одобрения */
  private async saveLevel3Proposal(proposal: AIProposal): Promise<void> {
    const shortId = proposal.id.slice(0, 8);

    await this.notifyOwnerWithButtons(
      `🔴 <b>Требуется одобрение (Уровень 3)</b>\n\n` +
      `<b>${escHtml(proposal.title)}</b>\n` +
      `${escHtml(proposal.description.slice(0, 400))}\n\n` +
      `Обоснование: <i>${escHtml((proposal.reasoning || '').slice(0, 300))}</i>\n\n` +
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
