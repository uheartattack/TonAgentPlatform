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
console.log   = (...args: any[]) => { if (!_filterTc(String(args[0]))) _origLog(...args); };
console.warn  = (...args: any[]) => { if (!_filterTc(String(args[0]))) _origWarn(...args); };
console.error = (...args: any[]) => { if (!_filterTc(String(args[0]))) _origError(...args); };

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
  runAIProposalsMigrations,
} from './db/schema-extensions';

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

  // Инициализируем TON Connect (PostgreSQL storage + restore sessions)
  await initTonConnect(pool);

  console.log();

  // Запуск бота
  startBot();

  // Запуск REST API сервера (лендинг + Telegram auth)
  startApiServer();

  // Инициализация AI-репозиториев (proposals + daily spend)
  initAIProposalsRepository(pool);
  initAgentDailySpendRepository(pool);
  initCustomPluginsRepository(pool);
  initAgentTasksRepository(pool);
  await runAIProposalsMigrations(pool);

  // Восстановить schedulers для агентов которые были активны до перезапуска
  await restoreActiveAgents();

  // Запуск системы самоулучшения
  const bot = getBotInstance();
  if (bot) {
    initSelfImprovementSystem(bot);
    console.log('🤖 Self-improvement system active');
  }

  console.log();
  console.log('🎯 Platform ready!');
  console.log();
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown with full cleanup
let _shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.log(`\n👋 ${signal} — shutting down gracefully...`);

  // Force exit after 10s
  const forceTimer = setTimeout(() => { console.error('⚠️ Forced exit'); process.exit(1); }, 10000);
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
