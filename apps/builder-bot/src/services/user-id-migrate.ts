/**
 * user-id-migrate.ts — Migrate a user's data from one user_id to another.
 *
 * Triggered when a Studio (OIDC) account links its Telegram via the /link flow.
 * The OIDC sub gets stored as fromUserId; ctx.from.id from the bot becomes
 * toUserId. After this runs, all the user's rows live under their real Telegram
 * ID and notifications can DM them.
 *
 * Strategy: for every `builder_bot.*` table with a `user_id` column we UPDATE
 * fromUserId → toUserId. Where a unique constraint involves (user_id, key) we
 * skip rows whose target already exists — the toUserId already has authoritative
 * state; we don't overwrite it. (e.g. if a user logged into the bot first and
 * later linked Studio, the Studio data is the new arrival and shouldn't clobber
 * existing bot state.)
 */

import type { Pool } from 'pg';

export interface MigrationReport {
  table: string;
  moved: number;
  conflicts: number;
  error?: string;
}

// Tables where (user_id, key) is unique — merge with ON CONFLICT DO NOTHING then
// delete leftover from-side rows. The remaining 34-ish tables only need a flat UPDATE.
const KV_TABLES: Array<{ table: string; conflict: string[] }> = [
  { table: 'user_settings', conflict: ['user_id', 'key'] },
  { table: 'agent_state', conflict: ['agent_id', 'key'] },
];

const FLAT_TABLES = [
  'agent_approvals', 'agent_audit_log', 'agent_daily_spend', 'agent_domains',
  'agent_evaluations', 'agent_logs', 'agent_skill_tree', 'agentic_wallets',
  'agents', 'balance_transactions', 'beta_achievements', 'beta_internship_applications',
  'beta_quest_progress', 'beta_snapshots', 'beta_task_progress', 'beta_testers',
  'conversations', 'crew_executions', 'crews', 'execution_history', 'feedback',
  'mcp_servers', 'payments', 'plugin_installs', 'plugin_ratings', 'sessions',
  'subscriptions', 'ton_connect_sessions', 'user_balance', 'user_custom_plugins',
  'user_plugins', 'web_sessions',
];

export async function mergeUserData(
  pool: Pool,
  fromUserId: number | string,
  toUserId: number | string,
): Promise<{ totalMoved: number; totalConflicts: number; perTable: MigrationReport[] }> {
  const report: MigrationReport[] = [];
  let totalMoved = 0;
  let totalConflicts = 0;

  if (String(fromUserId) === String(toUserId)) {
    return { totalMoved: 0, totalConflicts: 0, perTable: [] };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // KV tables — merge by upsert
    for (const { table, conflict } of KV_TABLES) {
      try {
        // Get fromUser keys
        const fromRows = await client.query(
          `SELECT * FROM builder_bot.${table} WHERE user_id = $1`,
          [fromUserId]
        );
        let moved = 0;
        let conflicts = 0;
        for (const r of fromRows.rows) {
          const conflictWhere = conflict.map(c => `${c} = '${String(r[c]).replace(/'/g, "''")}'`).join(' AND ');
          // Replace user_id in conflict-where if applicable
          const conflictCheckWhere = conflict
            .map(c => c === 'user_id' ? `user_id = $1` : `${c} = $${conflict.indexOf(c) + 2}`)
            .join(' AND ');
          const params = [toUserId, ...conflict.filter(c => c !== 'user_id').map(c => r[c])];
          const existing = await client.query(
            `SELECT 1 FROM builder_bot.${table} WHERE ${conflictCheckWhere} LIMIT 1`,
            params
          );
          if (existing.rows.length > 0) {
            // Target already has this key — drop the from row, don't overwrite
            const delWhere = conflict.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
            const delParams = conflict.map(c => c === 'user_id' ? fromUserId : r[c]);
            await client.query(`DELETE FROM builder_bot.${table} WHERE ${delWhere}`, delParams);
            conflicts++;
          } else {
            // Safe to move — update user_id
            const upWhere = conflict.map((c, i) => `${c} = $${i + 2}`).join(' AND ');
            const upParams = [toUserId, ...conflict.map(c => c === 'user_id' ? fromUserId : r[c])];
            await client.query(
              `UPDATE builder_bot.${table} SET user_id = $1 WHERE ${upWhere}`,
              upParams
            );
            moved++;
          }
        }
        report.push({ table, moved, conflicts });
        totalMoved += moved;
        totalConflicts += conflicts;
      } catch (e: any) {
        report.push({ table, moved: 0, conflicts: 0, error: e.message });
      }
    }

    // Flat tables — single UPDATE
    for (const table of FLAT_TABLES) {
      try {
        const r = await client.query(
          `UPDATE builder_bot.${table} SET user_id = $1 WHERE user_id = $2`,
          [toUserId, fromUserId]
        );
        const moved = r.rowCount || 0;
        report.push({ table, moved, conflicts: 0 });
        totalMoved += moved;
      } catch (e: any) {
        report.push({ table, moved: 0, conflicts: 0, error: e.message });
      }
    }

    await client.query('COMMIT');
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return { totalMoved, totalConflicts, perTable: report };
}

// ────────────────────────────────────────────────────────────────────────────
// Link-token table: one-time tokens issued by Studio, consumed by the bot's
// /start link_<token> handler.
// ────────────────────────────────────────────────────────────────────────────

let _ensured = false;
export async function ensureLinkTokensTable(pool: Pool): Promise<void> {
  if (_ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.account_link_tokens (
      token       TEXT PRIMARY KEY,
      user_id     BIGINT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_link_tokens_uid ON builder_bot.account_link_tokens(user_id);
  `);
  _ensured = true;
}

export async function createLinkToken(pool: Pool, userId: number | string): Promise<string> {
  await ensureLinkTokensTable(pool);
  // 24 alphanum chars — fits in a Telegram /start param and is unguessable
  const token = (await import('crypto')).randomBytes(18).toString('base64url').slice(0, 24);
  await pool.query(
    `INSERT INTO builder_bot.account_link_tokens (token, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [token, userId]
  );
  return token;
}

export async function consumeLinkToken(
  pool: Pool,
  token: string,
): Promise<{ userId: string } | null> {
  await ensureLinkTokensTable(pool);
  const r = await pool.query(
    `SELECT user_id FROM builder_bot.account_link_tokens
     WHERE token = $1 AND consumed_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  if (!r.rows[0]) return null;
  // Use user_id::text so 19-digit OIDC subs don't lose precision via JS Number
  const userId = String(r.rows[0].user_id);
  await pool.query(
    `UPDATE builder_bot.account_link_tokens SET consumed_at = NOW() WHERE token = $1`,
    [token]
  );
  return { userId };
}
