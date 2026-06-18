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

  // v3.0 Autonomous Network indexer — ОПЦИОНАЛЬНО (флаг V3_NETWORK_ENABLED=1).
  // Аддитивно: читает testnet-провенанс в новые v3-таблицы. Существующие флоу не трогает,
  // require внутри try → даже сломанный модуль не уронит бот.
  if (process.env.V3_NETWORK_ENABLED === '1') {
    try {
      // Минтер (hot-кошелёк из env-сида V3_MINTER_MNEMONIC). Без сида — инертно (indexer-only).
      // Деплой/минт — только по owner-gated вызову, не автоматически.
      let v3Collection = process.env.V3_COLLECTION || '0QD8QO307oBYFUxtmCRkDz9OfjhuS1bU6bWgZxuJqcgDEYt9';
      try {
        const { initMinter } = require('./services/v3-minter');
        const m = await initMinter();
        if (m.ready) { v3Collection = m.collection; console.log('🪙 V3 Minter ready:', m.minter, '| collection', m.collection); }
        else { console.log('🪙 V3 Minter not configured (set V3_MINTER_MNEMONIC for minting)'); }
      } catch (e: any) { console.error('[V3Minter] init error:', e?.message); }

      const { initV3Network, pollChainOnce } = require('./services/v3-network');
      await initV3Network(
        pool,
        {
          // Кошелёк → tap user_id. Источник: agentic_wallets (есть address→user_id).
          // Матчим адрес во всех friendly/raw формах (bounceable/testnet варианты).
          resolveUserByWallet: async (walletAddress: string): Promise<number | null> => {
            try {
              const { Address } = require('@ton/core');
              let forms: string[] = [walletAddress];
              try {
                const a = Address.parse(walletAddress);
                forms = [
                  a.toString({ bounceable: false, testOnly: false }),
                  a.toString({ bounceable: true, testOnly: false }),
                  a.toString({ bounceable: false, testOnly: true }),
                  a.toString({ bounceable: true, testOnly: true }),
                  a.toRawString(),
                  walletAddress,
                ];
              } catch { /* не парсится — ищем как есть */ }
              const uniq = Array.from(new Set(forms));
              const r = await pool.query(
                `SELECT user_id FROM builder_bot.agentic_wallets
                   WHERE address = ANY($1::text[]) AND is_blocked = false
                   ORDER BY (wallet_type='root') DESC LIMIT 1`,
                [uniq],
              );
              // ВАЖНО: возвращаем user_id СТРОКОЙ (pg отдаёт BIGINT строкой). НЕ Number() —
              // 19-значные Telegram OIDC sub id теряют точность в JS Number. Строка → BIGINT-параметр хранится точно.
              return r.rows.length ? r.rows[0].user_id : null;
            } catch (e: any) {
              console.warn('[V3Network] resolveUserByWallet error:', e?.message);
              return null;
            }
          },
          // Привязка проданного/сминченного агента к новому владельцу в реестре.
          // Деструктивный скраб личных секретов — ТОЛЬКО при V3_AUTO_SCRUB=1 (по умолчанию выкл),
          // и только ключи с явно секретными именами; навыки/память/репутацию не трогаем.
          provisionAgentToOwner: async (nft: string, tapId: number | null, uid: number): Promise<void> => {
            try {
              await pool.query(
                `UPDATE builder_bot.v3_agents SET bound_user_id=$2, updated_at=NOW() WHERE agent_nft=$1`,
                [nft, uid],
              );
              console.log(`[V3Network] provision: NFT ${nft} → user ${uid} (tapAgentId=${tapId ?? '—'})`);
              if (process.env.V3_AUTO_SCRUB === '1' && tapId != null) {
                const del = await pool.query(
                  `DELETE FROM builder_bot.agent_state
                     WHERE agent_id=$1 AND (key ILIKE '%secret%' OR key ILIKE '%api_key%' OR key ILIKE '%apikey%'
                        OR key ILIKE '%mnemonic%' OR key ILIKE '%private%' OR key ILIKE '%token%' OR key ILIKE '%password%')`,
                  [tapId],
                );
                console.log(`[V3Network] provision scrub: removed ${del.rowCount} secret state keys for agent ${tapId}`);
              }
            } catch (e: any) {
              console.warn('[V3Network] provisionAgentToOwner error:', e?.message);
            }
          },
          slashReputation: async () => {},
        },
        {
          endpoint: process.env.V3_TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC',
          collectionAddress: v3Collection,
        },
      );
      const _v3 = setInterval(() => {
        pollChainOnce()
          .then((r: any) => { if (r && (r.mints || r.sales)) console.log('[V3Network] poll', r); })
          .catch((e: any) => console.warn('[V3Network] poll error:', e?.message));
      }, 60_000);
      (_v3 as any).unref?.();
      console.log('🌐 V3 Network indexer started');

      // v3.0 Фаза 1 — durable mailbox (cross-owner агент↔агент сообщения).
      try {
        const { initV3Mailbox } = require('./services/v3-mailbox');
        await initV3Mailbox(pool);
        console.log('📬 V3 Mailbox ready');
      } catch (e: any) { console.error('[V3Mailbox] init error:', e?.message); }

      // v3.0 Фаза 1 — аренда агентов
      try {
        const { initV3Rental } = require('./services/v3-rental');
        await initV3Rental(pool);
        console.log('🔑 V3 Rental ready');
      } catch (e: any) { console.error('[V3Rental] init error:', e?.message); }

      // v3.0 Фаза 0 — доска задач (cross-owner job board) + синк escrow-статусов.
      // Флаг V3_JOBS_ENABLED (по умолчанию выкл). Бот деньги не двигает — фандинг подписывает заказчик.
      if (process.env.V3_JOBS_ENABLED === '1') {
        try {
          const { initV3Jobs, pollJobEscrows } = require('./services/v3-jobs');
          await initV3Jobs(pool);
          const _jobs = setInterval(() => {
            pollJobEscrows()
              .then((r: any) => { if (r && r.settled) console.log('[V3Jobs] settled', r); })
              .catch((e: any) => console.warn('[V3Jobs] poll error:', e?.message));
          }, 90_000);
          (_jobs as any).unref?.();
          console.log('💼 V3 Jobs board started');
        } catch (e: any) { console.error('[V3Jobs] init error:', e?.message); }
      }
    } catch (e: any) {
      console.error('[V3Network] init error:', e?.message);
    }
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
