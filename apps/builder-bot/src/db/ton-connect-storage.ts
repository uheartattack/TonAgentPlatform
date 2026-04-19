// ============================================================
// PostgreSQL-backed Storage для TON Connect
// Сессии не теряются при рестарте бота (в отличие от InMemoryStorage)
// Паттерн из OpenClaw: персистентное хранение состояния каналов
// ============================================================

import { IStorage } from '@tonconnect/sdk';
import { Pool } from 'pg';

let _pool: Pool | null = null;

export function initTonConnectStorage(pool: Pool): void {
  _pool = pool;
}

export function getPool(): Pool {
  if (!_pool) throw new Error('TonConnectStorage: pool not initialized');
  return _pool;
}

// ── Автоматически создаём таблицу если не существует ──────────
export async function ensureTonConnectTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.ton_connect_sessions (
      user_id    BIGINT NOT NULL,
      key        VARCHAR(255) NOT NULL,
      value      TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    )
  `);
}

// Lazy-load encryption helpers to avoid circular imports
let _enc: { encrypt: (s: string) => string; decrypt: (s: string) => string } | null = null;
function _getEnc() {
  if (_enc) return _enc;
  try {
    const { encryptApiKey, decryptApiKey } = require('../crypto-utils');
    _enc = { encrypt: encryptApiKey, decrypt: decryptApiKey };
  } catch {
    // Fallback identity encryption — better to store plaintext than crash, but log
    console.warn('[TonConnectStorage] crypto-utils unavailable — sessions stored plaintext');
    _enc = { encrypt: (s) => s, decrypt: (s) => s };
  }
  return _enc;
}

// ── PostgreSQL IStorage implementation ────────────────────────
// TonConnect stores session secrets, connection bridge tokens, and wallet data.
// We encrypt `value` at rest so a DB dump doesn't expose session credentials.
export class PostgresTonConnectStorage implements IStorage {
  constructor(private readonly userId: number) {}

  async setItem(key: string, value: string): Promise<void> {
    try {
      const pool = getPool();
      const encrypted = _getEnc().encrypt(value);
      await pool.query(
        `INSERT INTO builder_bot.ton_connect_sessions (user_id, key, value, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW()`,
        [this.userId, key, encrypted]
      );
    } catch (e) {
      console.error(`[TonConnectStorage] setItem error (userId=${this.userId}, key=${key}):`, e);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT value FROM builder_bot.ton_connect_sessions
         WHERE user_id = $1 AND key = $2`,
        [this.userId, key]
      );
      const raw = res.rows[0]?.value;
      if (raw == null) return null;
      // decryptApiKey is idempotent for plaintext values — handles legacy rows
      return _getEnc().decrypt(raw);
    } catch (e) {
      console.error(`[TonConnectStorage] getItem error (userId=${this.userId}, key=${key}):`, e);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `DELETE FROM builder_bot.ton_connect_sessions WHERE user_id = $1 AND key = $2`,
        [this.userId, key]
      );
    } catch (e) {
      console.error(`[TonConnectStorage] removeItem error:`, e);
    }
  }

  // Удалить все данные сессии пользователя (при disconnect)
  async clearAll(): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `DELETE FROM builder_bot.ton_connect_sessions WHERE user_id = $1`,
        [this.userId]
      );
    } catch (e) {
      console.error(`[TonConnectStorage] clearAll error:`, e);
    }
  }

  // Получить всех пользователей у которых есть сохранённые сессии
  static async getAllUserIds(pool: Pool): Promise<number[]> {
    try {
      const res = await pool.query(
        `SELECT DISTINCT user_id FROM builder_bot.ton_connect_sessions`
      );
      return res.rows.map((r: any) => Number(r.user_id));
    } catch {
      return [];
    }
  }
}
