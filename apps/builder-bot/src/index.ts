#!/usr/bin/env node

// ── Фильтрация шумных логов из TON Connect SDK (analytics 400 ошибки — безвредны) ──
const _origLog = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);
// Полный фильтр TON Connect analytics шума (включая stack trace строки)
const TC_NOISE = /\[TON_CONNECT_SDK\]|Analytics API error|AnalyticsManager/;
let _suppressTcStack = false;
const _filterTc = (s: string): boolean => {
  if (TC_NOISE.test(s)) { _suppressTcStack = true; return true; }
  if (_suppressTcStack && /^\s+at /.test(s)) return true; // строки стека трейса
  _suppressTcStack = false;
  return false;
};

// ── Global secret redaction: safety net for logs that bypass sanitizeForLog() ──
// Patterns cover API keys (OpenAI/Anthropic/Gemini/Groq/Bearer), URL-query keys,
// mnemonics, private keys, DB strings, Telegram tokens.
const _redact = (s: string): string => {
  if (!s || s.length > 100_000) return s; // cheap guard against ReDoS
  return s
    .replace(/\b(AIzaSy[\w-]{6})[\w-]{20,}/g, '$1***')
    .replace(/\b(sk-ant-[\w-]{6})[\w-]{14,}/g, '$1***')
    .replace(/\b(sk-proj-[\w-]{6})[\w-]{14,}/g, '$1***')
    .replace(/\b(gsk_[\w]{6})[\w]{14,}/g, '$1***')
    .replace(/\b(sk-or-[\w-]{6})[\w-]{14,}/g, '$1***')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._\-+/=]{16,}/g, '$1***[REDACTED]')
    .replace(/([?&](api_key|apikey|access_token|token)=)[^&\s"']+/gi, '$1***')
    .replace(/\b([a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/gi, '[MNEMONIC_REDACTED]')
    .replace(/\b\d{10,13}:[A-Za-z0-9_-]{35}\b/g, '***[BOT_TOKEN]')
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, 'postgres://***[DB]');
};
const _safeArgs = (args: any[]) => args.map(a => typeof a === 'string' ? _redact(a) : a);

console.log   = (...args: any[]) => { if (!_filterTc(String(args[0]))) _origLog(..._safeArgs(args)); };
console.warn  = (...args: any[]) => { if (!_filterTc(String(args[0]))) _origWarn(..._safeArgs(args)); };
console.error = (...args: any[]) => { if (!_filterTc(String(args[0]))) _origError(..._safeArgs(args)); };

import { initDatabase, pool } from './db';
import { startBot, getBotInstance } from './bot';
import { validateConfig, config } from './config';
import { initTonConnect } from './ton-connect';
import { startApiServer } from './api-server';
import { restoreActiveAgents } from './agents/sub-agents/runner';
import { initSelfImprovementSystem } from './self-improvement';
import {
  initAIProposalsRepository,
  initAgentDailySpendRepository,
  initCustomPluginsRepository,
  initAgentTasksRepository,
  initAgentApprovalsRepository,
  runAIProposalsMigrations,
  runLogRetention,
} from './db/schema-extensions';
import { initPayments } from './payments';
import { startPendingStateTTLCleanup } from './state';

// Главная функция запуска
async function main() {
  console.log('🚀 Starting Builder Bot Platform...\n');

  // Валидация конфигурации
  const validation = validateConfig();
  if (!validation.valid) {
    console.error('❌ Configuration errors:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  const codeModel = config.openrouter.apiKey
    ? `Qwen3-Coder-Next (OpenRouter)`
    : config.claude.model;

  console.log('✅ Configuration validated');
  console.log(`   Owner ID: ${config.owner.id}`);
  console.log(`   AI Backend: ${config.claude.baseURL}`);
  console.log(`   Chat Model: ${config.claude.model}`);
  console.log(`   Code Model: ${codeModel}`);
  console.log(`   Security Scan: ${config.security.enableSecurityScan ? 'enabled' : 'disabled'}`);
  console.log();

  // Инициализация базы данных
  const dbResult = await initDatabase();
  if (!dbResult.success) {
    console.error('❌ Failed to initialize database:', dbResult.error);
    process.exit(1);
  }

  // Инициализируем платёжную систему
  await initPayments(pool);

  // Start TTL cleanup for in-memory pending-Maps (prevents memory leaks)
  startPendingStateTTLCleanup();

  // Инициализируем TON Connect (PostgreSQL storage + restore sessions)
  await initTonConnect(pool);

  console.log();

  // Запуск бота (retry on network errors — Telegram API may be temporarily unreachable)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await startBot();
      break;
    } catch (botErr: any) {
      const isNetwork = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/.test(botErr.code || botErr.message || '');
      if (isNetwork && attempt < 5) {
        const delay = attempt * 5;
        console.warn(`⚠️ Bot start failed (attempt ${attempt}/5): ${botErr.message}. Retrying in ${delay}s...`);
        await new Promise(r => setTimeout(r, delay * 1000));
        continue;
      }
      throw botErr;
    }
  }

  // Запуск REST API сервера (лендинг + Telegram auth)
  startApiServer();

  // Инициализация AI-репозиториев (proposals + daily spend)
  initAIProposalsRepository(pool);
  initAgentDailySpendRepository(pool);
  initCustomPluginsRepository(pool);
  initAgentTasksRepository(pool);
  initAgentApprovalsRepository(pool);
  await runAIProposalsMigrations(pool);

  // Schedule daily log retention cleanup (delete agent_logs > 30d, execution_history > 90d)
  // First run after 5 min so startup isn't blocked, then every 24h.
  const _retentionFirst = setTimeout(() => {
    runLogRetention(pool).catch((e) => console.warn('[Retention] first run failed:', e?.message));
  }, 5 * 60_000);
  (_retentionFirst as any).unref?.();
  const _retentionInterval = setInterval(() => {
    runLogRetention(pool).catch((e) => console.warn('[Retention] periodic run failed:', e?.message));
  }, 24 * 60 * 60_000);
  (_retentionInterval as any).unref?.();

  // Инициализация Agentic Wallets
  try {
    const { getAgenticWalletService } = require('./services/agentic-wallet');
    await getAgenticWalletService().runMigration();
    console.log('🔐 Agentic Wallets ready');
  } catch (e: any) {
    console.error('[AgenticWallet] Init error:', e.message, e.stack?.slice(0, 300));
  }

  // Запуск TokenTracker auto-flush (каждые 5 мин → DB)
  try {
    const { startAutoFlush, loadBudgetsFromDB } = require('./services/token-tracker');
    await loadBudgetsFromDB();
    startAutoFlush(5 * 60 * 1000);
    console.log('🪙 TokenTracker auto-flush started');
  } catch (e: any) {
    console.warn('[TokenTracker] Init error:', e.message);
  }

  // Восстановить schedulers для агентов которые были активны до перезапуска
  await restoreActiveAgents();

  // Запуск системы самоулучшения
  const bot = getBotInstance();
  if (bot) {
    initSelfImprovementSystem(bot);
    console.log('🤖 Self-improvement system active');
  }

  // Eager-create agent observability tables so every new agent gets them ready
  try {
    const { getSystemFacts } = await import('./services/structured-memory');
    await getSystemFacts(0, 1);  // touch → ensureSystemFactsTable
    const { listRecentRuns } = await import('./services/agent-traces');
    await listRecentRuns(0, 1);  // touch → ensureTable (traces)
    const { getEvaluations } = await import('./services/agent-evaluator');
    await getEvaluations(0, 1);  // touch → ensureTable (evaluations)
    console.log('📊 Observability tables ready (traces + evaluations + system_facts)');
  } catch (e: any) {
    console.warn('[Observability] eager init failed:', e?.message);
  }

  // Boot v2.3-wip background services. Each is opt-in per agent — these
  // imports just start the poll loops; no work happens until an agent has
  // configured autonomous=true / bg jobs / etc.
  try {
    await import('./services/background-tasks');     // s08 daemon
    await import('./services/autonomous-claim');     // s11 task_graph poller
    const { startCronTicker } = await import('./services/cron-ticker');
    startCronTicker();
    console.log('🔁 Background services up (bg-tasks + autonomous-claim + cron-ticker)');
  } catch (e: any) {
    console.warn('[BgServices] startup failed:', e?.message);
  }

  // Reconnect previously-known MCP servers so agents that depend on them
  // don't see a cold start. Fire-and-forget; failures are logged inside.
  try {
    const { pool } = await import('./db');
    const { rehydrateMCPServers } = await import('./services/mcp-registry');
    rehydrateMCPServers(pool).catch(e => console.warn('[MCP] rehydrate error:', e?.message));
  } catch (e: any) {
    console.warn('[MCP] rehydrate skipped:', e?.message);
  }

  // Pre-warm local embedding model if EMBEDDING_BACKEND=local — saves the
  // ~3-10s model-load latency on first recall_hybrid call. Fire-and-forget.
  if (process.env.EMBEDDING_BACKEND === 'local') {
    try {
      const { prewarmEmbedding } = await import('./services/embedding-backends');
      prewarmEmbedding().catch(e => console.warn('[Embed/Local] prewarm error:', e?.message));
    } catch (e: any) {
      console.warn('[Embed/Local] prewarm skipped:', e?.message);
    }
  }

  console.log();
  console.log('🎯 Platform ready!');
  console.log();
}

// ── Global error interceptor: pipe console.error → platform_bugs ──
const _origConsoleError = console.error.bind(console);
let _bugTrackerReady = false;
const _errorDedup = new Map<string, number>(); // prevent spam: hash → lastTs

// Mark bug tracker as ready after DB init
setTimeout(() => { _bugTrackerReady = true; }, 10000);

console.error = function(...args: any[]) {
  _origConsoleError(...args);
  if (!_bugTrackerReady) return;
  try {
    let msg = args.map(a => typeof a === 'object' ? (a?.message || JSON.stringify(a)?.slice(0, 300)) : String(a)).join(' ').slice(0, 1000);
    // Sanitize secrets from error messages before storing in DB
    msg = msg.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIza***').replace(/sk-[A-Za-z0-9]{20,}/g, 'sk-***').replace(/sk-ant-[A-Za-z0-9-]+/g, 'sk-ant-***').replace(/gsk_[A-Za-z0-9]+/g, 'gsk_***').replace(/[A-Za-z0-9]{24,}:[A-Za-z0-9_-]{35,}/g, '***TOKEN***');
    // Skip noisy/expected errors
    if (/MNEMONIC mismatch|WalletContractV5R1|_cachedDialogs|setupListener.*authorized=false/i.test(msg)) return;
    // Dedup: same error within 60s → skip
    const key = msg.slice(0, 100);
    const now = Date.now();
    if (_errorDedup.get(key) && now - (_errorDedup.get(key) || 0) < 60000) return;
    _errorDedup.set(key, now);
    if (_errorDedup.size > 500) { const keys = Array.from(_errorDedup.keys()); for (let i = 0; i < 250; i++) _errorDedup.delete(keys[i]); }
    // Determine source from stack or message
    let source = 'console.error';
    const stackMatch = new Error().stack?.match(/at\s+.*?\(?(src\/[^:)]+)/);
    if (stackMatch) source = stackMatch[1];
    else if (/\[UserbotMgr\]/.test(msg)) source = 'userbot-manager';
    else if (/\[AI runtime\]|\[AI run\]/.test(msg)) source = 'ai-agent-runtime';
    else if (/\[Orchestrator\]/.test(msg)) source = 'orchestrator';
    else if (/CRASH:/.test(msg)) source = 'crash';
    const { getBugTracker } = require('./db/schema-extensions');
    getBugTracker().recordBug(source, msg, new Error().stack?.slice(0, 500)).catch(() => {});
  } catch {}
};

// Rate-limit identical bug reports so an error loop doesn't flood the DB.
const _bugSeen = new Map<string, number>();
const BUG_DEDUP_WINDOW_MS = 60_000; // suppress identical error within 60s
function _shouldReportBug(fingerprint: string): boolean {
  const now = Date.now();
  const last = _bugSeen.get(fingerprint) || 0;
  if (now - last < BUG_DEDUP_WINDOW_MS) return false;
  _bugSeen.set(fingerprint, now);
  // Keep map bounded
  if (_bugSeen.size > 500) {
    const cutoff = now - BUG_DEDUP_WINDOW_MS * 4;
    for (const [k, v] of _bugSeen) if (v < cutoff) _bugSeen.delete(k);
  }
  return true;
}

// Обработка ошибок + автоматический трекинг в БД
process.on('unhandledRejection', (error: any) => {
  _origConsoleError('Unhandled rejection:', error);
  try {
    const msg = (error?.message || String(error || '')).slice(0, 500);
    const stack = (error?.stack || '').slice(0, 800);
    const file = stack.match(/at\s+.*?\(?(src\/[^:)]+)/)?.[1] || undefined;
    const fingerprint = `rej:${msg.slice(0, 80)}:${file || ''}`;
    if (_shouldReportBug(fingerprint)) {
      const { getBugTracker } = require('./db/schema-extensions');
      getBugTracker().recordBug('unhandledRejection', _redact(msg), _redact(stack), file).catch(() => {});
    }
  } catch {}
});

process.on('uncaughtException', (error: any) => {
  console.error('❌ Uncaught exception:', error);
  try {
    const msg = (error?.message || String(error || '')).slice(0, 500);
    const stack = (error?.stack || '').slice(0, 800);
    const file = stack.match(/at\s+.*?\(?(src\/[^:)]+)/)?.[1] || undefined;
    const fingerprint = `exc:${msg.slice(0, 80)}:${file || ''}`;
    if (_shouldReportBug(fingerprint)) {
      const { getBugTracker } = require('./db/schema-extensions');
      getBugTracker().recordBug('uncaughtException', _redact(msg), _redact(stack), file).catch(() => {});
    }
  } catch {}
  // Give the async recordBug a moment to flush, then exit.
  setTimeout(() => process.exit(1), 300).unref?.();
});

// Graceful shutdown with full cleanup
let _shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.log(`\n👋 ${signal} — shutting down gracefully...`);

  // Force exit after 30s (was 10s — too aggressive for agents finishing a TX)
  const forceTimer = setTimeout(() => { console.error('⚠️ Forced exit — shutdown took >30s'); process.exit(1); }, 30_000);
  (forceTimer as any).unref?.();

  // 1. Stop all AI agents (kills MCP subprocesses, clears intervals)
  try {
    const { getAIAgentRuntime } = await import('./agents/ai-agent-runtime');
    getAIAgentRuntime().deactivateAll();
    console.log('   ✅ AI agents deactivated');
  } catch (e: any) { console.error('   ⚠️ AI agents:', e?.message); }

  // 2. Stop Telegram bot
  try {
    const bot = getBotInstance();
    if (bot) bot.stop(signal);
    console.log('   ✅ Bot stopped');
  } catch {}

  // 3. Close database pool
  try {
    const { closeDatabase } = await import('./db');
    await closeDatabase();
    console.log('   ✅ Database closed');
  } catch {}

  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Запуск
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
