/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MCP REGISTRY — DB-backed Model Context Protocol server management.
 *
 * `mcp-client.ts` already implements the protocol (connect/list-tools/call).
 * It keeps an in-memory map of `serverConnections` keyed by string ID.
 *
 * This module adds:
 *   1. PERSISTENCE — `builder_bot.mcp_servers` rows (one per user-owned MCP
 *      endpoint) and `builder_bot.agent_mcp_servers` (per-agent enable flag).
 *   2. ENCRYPTION — bearer tokens stored in `api_key_enc` via AES-256-GCM
 *      using the same key resolver as wallet mnemonics.
 *   3. BOOT REHYDRATION — on startup, every `status='connected'` row gets
 *      re-connected so the in-memory map matches the DB.
 *   4. PER-AGENT FILTER — `getEnabledMCPToolsForAgent(agentId)` returns
 *      only tools from servers the agent has explicitly enabled.
 *
 * Studio UI lives in `apps/landing/studio.js`; REST in `api-server.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';
import { encryptApiKey, decryptApiKey } from '../crypto-utils';
import { connectMCPServer, disconnectMCPServer, getMCPTools, type MCPTool } from './mcp-client';

export interface MCPServerRow {
  id: number;
  user_id: number;
  name: string;
  url: string;
  apiKey?: string;          // decrypted; never returned to API responses
  transport: string;
  status: 'pending' | 'connected' | 'error' | 'disabled';
  last_error: string | null;
  tools_count: number;
  last_tested_at: Date | null;
  created_at: Date;
}

/** Build the in-memory connection ID we hand to mcp-client. Combines DB id +
 *  user_id so two users can use the same name without collision. */
function memId(serverId: number, userId: number): string {
  return `u${userId}_srv${serverId}`;
}

export async function listUserMCPServers(pool: Pool, userId: number): Promise<MCPServerRow[]> {
  const res = await pool.query(
    `SELECT id, user_id, name, url, api_key_enc, transport, status, last_error, tools_count, last_tested_at, created_at
       FROM builder_bot.mcp_servers
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    user_id: Number(r.user_id),
    name: r.name,
    url: r.url,
    transport: r.transport,
    status: r.status,
    last_error: r.last_error,
    tools_count: r.tools_count,
    last_tested_at: r.last_tested_at,
    created_at: r.created_at,
    // intentionally do NOT decrypt or expose api key in list responses
  }));
}

export async function createMCPServer(
  pool: Pool,
  userId: number,
  input: { name: string; url: string; apiKey?: string; transport?: string },
): Promise<MCPServerRow> {
  const apiKeyEnc = input.apiKey ? encryptApiKey(input.apiKey) : null;
  const res = await pool.query(
    `INSERT INTO builder_bot.mcp_servers (user_id, name, url, api_key_enc, transport, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, user_id, name, url, transport, status, last_error, tools_count, last_tested_at, created_at`,
    [userId, input.name, input.url, apiKeyEnc, input.transport || 'sse'],
  );
  return res.rows[0];
}

export async function deleteMCPServer(pool: Pool, userId: number, serverId: number): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM builder_bot.mcp_servers WHERE id = $1 AND user_id = $2 RETURNING id`,
    [serverId, userId],
  );
  if (res.rowCount === 0) return false;
  // Also drop the in-memory connection if it was active
  try { disconnectMCPServer(memId(serverId, userId)); } catch {}
  return true;
}

async function fetchOwnedServer(pool: Pool, userId: number, serverId: number): Promise<{
  id: number; user_id: number; name: string; url: string; api_key_enc: string | null;
} | null> {
  const r = await pool.query(
    `SELECT id, user_id, name, url, api_key_enc FROM builder_bot.mcp_servers WHERE id = $1 AND user_id = $2`,
    [serverId, userId],
  );
  return r.rows[0] || null;
}

/** Test connection. Updates `status`, `tools_count`, `last_error`,
 *  `last_tested_at`. Returns the new status + tool count. */
export async function testMCPServer(pool: Pool, userId: number, serverId: number): Promise<{
  status: string; tools: number; error?: string;
}> {
  const row = await fetchOwnedServer(pool, userId, serverId);
  if (!row) return { status: 'error', tools: 0, error: 'Server not found' };

  const apiKey = row.api_key_enc ? decryptApiKey(row.api_key_enc) : undefined;
  let status = 'connected', tools = 0, error: string | undefined;
  try {
    const result = await connectMCPServer({
      id: memId(row.id, Number(row.user_id)),
      name: row.name,
      url: row.url,
      apiKey,
    });
    tools = result.tools;
    if (tools === 0) {
      // Connection succeeded but returned no tools — likely auth or routing issue
      status = 'error';
      error = 'Connected but no tools exposed (check authentication / endpoint path)';
    }
  } catch (e: any) {
    status = 'error';
    error = String(e?.message || e).slice(0, 400);
  }
  await pool.query(
    `UPDATE builder_bot.mcp_servers
        SET status = $1, tools_count = $2, last_error = $3, last_tested_at = NOW()
      WHERE id = $4`,
    [status, tools, error || null, serverId],
  );
  return { status, tools, error };
}

export async function getServerTools(pool: Pool, userId: number, serverId: number): Promise<MCPTool[]> {
  const row = await fetchOwnedServer(pool, userId, serverId);
  if (!row) return [];
  // Make sure it's connected (cheap if already cached)
  await testMCPServer(pool, userId, serverId).catch(() => {});
  return getMCPTools(memId(row.id, Number(row.user_id)));
}

// ── Per-agent enable/disable ─────────────────────────────────────────────

export async function listAgentMCPServers(pool: Pool, agentId: number): Promise<Array<{
  id: number; name: string; url: string; status: string; tools_count: number;
}>> {
  const res = await pool.query(
    `SELECT s.id, s.name, s.url, s.status, s.tools_count
       FROM builder_bot.agent_mcp_servers a
       JOIN builder_bot.mcp_servers s ON s.id = a.mcp_server_id
      WHERE a.agent_id = $1
      ORDER BY s.created_at DESC`,
    [agentId],
  );
  return res.rows;
}

export async function setAgentMCPServer(
  pool: Pool,
  userId: number,
  agentId: number,
  serverId: number,
  enabled: boolean,
): Promise<boolean> {
  // Validate that the server belongs to this user
  const owned = await fetchOwnedServer(pool, userId, serverId);
  if (!owned) return false;
  if (enabled) {
    await pool.query(
      `INSERT INTO builder_bot.agent_mcp_servers (agent_id, mcp_server_id)
       VALUES ($1, $2)
       ON CONFLICT (agent_id, mcp_server_id) DO NOTHING`,
      [agentId, serverId],
    );
  } else {
    await pool.query(
      `DELETE FROM builder_bot.agent_mcp_servers WHERE agent_id = $1 AND mcp_server_id = $2`,
      [agentId, serverId],
    );
  }
  return true;
}

/** Returns tools for all MCP servers an agent has enabled. Used by the
 *  agent runtime when building its tool schema. */
export async function getEnabledMCPToolsForAgent(pool: Pool, agentId: number): Promise<MCPTool[]> {
  const res = await pool.query(
    `SELECT s.id, s.user_id FROM builder_bot.agent_mcp_servers a
       JOIN builder_bot.mcp_servers s ON s.id = a.mcp_server_id
      WHERE a.agent_id = $1 AND s.status = 'connected'`,
    [agentId],
  );
  const all: MCPTool[] = [];
  for (const row of res.rows) {
    const tools = getMCPTools(memId(row.id, Number(row.user_id)));
    all.push(...tools);
  }
  return all;
}

// ── Boot rehydration ─────────────────────────────────────────────────────

let _booted = false;

/** Re-connect every MCP server that was previously `connected`. Failures
 *  flip its status to `error` so the user knows in the UI. Idempotent. */
export async function rehydrateMCPServers(pool: Pool): Promise<void> {
  if (_booted) return;
  _booted = true;
  try {
    const res = await pool.query(
      `SELECT id, user_id, name, url, api_key_enc FROM builder_bot.mcp_servers
        WHERE status IN ('connected', 'pending')`,
    );
    let ok = 0, fail = 0;
    for (const row of res.rows) {
      const apiKey = row.api_key_enc ? (() => { try { return decryptApiKey(row.api_key_enc); } catch { return undefined; } })() : undefined;
      try {
        const result = await connectMCPServer({
          id: memId(row.id, Number(row.user_id)),
          name: row.name,
          url: row.url,
          apiKey,
        });
        if (result.tools > 0) {
          await pool.query(
            `UPDATE builder_bot.mcp_servers SET status='connected', tools_count=$1, last_error=NULL WHERE id=$2`,
            [result.tools, row.id],
          );
          ok++;
        } else {
          await pool.query(
            `UPDATE builder_bot.mcp_servers SET status='error', last_error='No tools exposed on reconnect' WHERE id=$1`,
            [row.id],
          );
          fail++;
        }
      } catch (e: any) {
        await pool.query(
          `UPDATE builder_bot.mcp_servers SET status='error', last_error=$1 WHERE id=$2`,
          [String(e?.message || e).slice(0, 400), row.id],
        );
        fail++;
      }
    }
    if (ok + fail > 0) console.log(`[MCP-Registry] rehydrated ${ok} OK, ${fail} failed`);
  } catch (e: any) {
    console.warn(`[MCP-Registry] rehydrate skipped: ${e?.message}`);
  }
}
