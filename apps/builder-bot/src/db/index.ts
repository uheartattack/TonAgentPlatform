import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { initMemoryManager } from './memory';
import { initAgentsRepository, getAgentsRepository } from './agents';
export { getAgentsRepository };
import { initDBTools } from '../agents/tools/db-tools';
import { initPayments } from '../payments';
import { initTonConnectStorage } from './ton-connect-storage';
import {
  runMigrations,
  runMarketplaceMigrations,
  initAgentStateRepository,
  initAgentLogsRepository,
  initExecutionHistoryRepository,
  initUserPluginsRepository,
  initUserSettingsRepository,
  initMarketplaceRepository,
  initBalanceTxRepository,
} from './schema-extensions';

// Конфигурация PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'builder_bot',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Инициализация Drizzle
export const db = drizzle(pool);

// Инициализация всех репозиториев
export async function initDatabase() {
  console.log('🔌 Connecting to PostgreSQL...');

  try {
    // Проверяем подключение
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');

    // Запускаем миграции (CREATE TABLE IF NOT EXISTS — идемпотентно)
    await runMigrations(pool);
    await runMarketplaceMigrations(pool); // marketplace tables

    // Инициализируем менеджеры
    initMemoryManager(pool);
    initAgentsRepository(pool);
    initDBTools(pool);
    initPayments(pool);
    initTonConnectStorage(pool); // PostgreSQL storage для TON Connect сессий

    // Новые репозитории для production-ready MVP
    initAgentStateRepository(pool);
    initAgentLogsRepository(pool);
    initExecutionHistoryRepository(pool);
    initUserPluginsRepository(pool);
    initUserSettingsRepository(pool);
    initMarketplaceRepository(pool); // маркетплейс
    initBalanceTxRepository(pool);   // баланс леджер

    console.log('✅ Database repositories initialized');

    return { success: true };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown
export async function closeDatabase() {
  console.log('🔌 Closing database connection...');
  await pool.end();
  console.log('✅ Database connection closed');
}

export { pool };
