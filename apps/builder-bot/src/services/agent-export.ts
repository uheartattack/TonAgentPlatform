/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT EXPORT / IMPORT / SHARE
 *
 * Three operations:
 *   1. exportAgent(agentId, format) → self-contained JSON or human-readable
 *      Markdown file containing prompt, config, capabilities, triggers.
 *   2. importAgent(userId, payload) → creates a new agent owned by userId
 *      from a previously exported JSON. Skips server-only fields (id,
 *      user_id, created_at) and secrets (unless explicitly shared).
 *   3. createShareLink(agentId, userId) → public share URL. Creates
 *      row in agent_shares with short ULID; public page renders the
 *      agent preview + 'Import to my TAP' CTA.
 *
 * Secrets handling: API keys / mnemonics / tokens are NEVER included in
 * exports. Only the placeholder names are exported (e.g. AI_API_KEY), so
 * when imported, new owner must provide their own.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

let _pool: Pool | null = null;
function getPool(): Pool {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _pool = require('../db').pool as Pool;
  return _pool;
}

// ─────────────────────────────────────────────────────────────────────────
// Shares table
// ─────────────────────────────────────────────────────────────────────────

let _tableReady = false;

async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  const pool = getPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_shares (
        share_id TEXT PRIMARY KEY,
        agent_id BIGINT NOT NULL,
        shared_by_user_id BIGINT NOT NULL,
        shared_name TEXT,
        shared_description TEXT,
        payload JSONB NOT NULL,
        view_count INT DEFAULT 0,
        import_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        is_public BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_shares_agent ON builder_bot.agent_shares(agent_id);
      CREATE INDEX IF NOT EXISTS idx_shares_user ON builder_bot.agent_shares(shared_by_user_id);
    `);
    _tableReady = true;
  } catch (e: any) {
    console.warn('[AgentExport] ensureTable failed:', e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Safe fields to export — whitelist, not blacklist, to avoid leaks
// ─────────────────────────────────────────────────────────────────────────

const SAFE_AGENT_FIELDS = [
  'name',
  'description',
  'trigger_type',
  'trigger_config',
  'code',
  'system_prompt',
  'created_at',
];

const SECRET_KEY_NAMES = new Set([
  'AI_API_KEY', 'API_KEY', 'WALLET_MNEMONIC', 'MNEMONIC', 'PRIVATE_KEY',
  'BOT_TOKEN', 'TONAPI_KEY', 'GIFTASSET_API_KEY', 'GETGEMS_API_KEY',
  'TG_SESSION', 'SESSION_STRING', 'ACCESS_TOKEN', 'REFRESH_TOKEN',
  'WEBHOOK_SECRET', 'HMAC_SECRET',
]);

/** Strip secret values from trigger_config but keep the key names visible,
 * so the importer knows which keys to provide. */
function sanitizeConfig(config: any): any {
  if (!config || typeof config !== 'object') return config;
  const out: any = Array.isArray(config) ? [] : {};
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEY_NAMES.has(k) || /key|secret|token|mnemonic|password/i.test(k)) {
      out[k] = '<REQUIRED: set on import>';
      continue;
    }
    if (v && typeof v === 'object') {
      out[k] = sanitizeConfig(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────

export interface ExportPayload {
  format: 'json' | 'md';
  version: string;
  exportedAt: string;
  agent: {
    name: string;
    description?: string;
    trigger_type?: string;
    trigger_config?: any;
    code?: string;
    system_prompt?: string;
  };
  requiredKeys: string[];   // names of keys user must provide on import
  capabilities?: string[];  // inferred from config
}

export async function exportAgent(
  agentId: number,
  ownerUserId: number,
  format: 'json' | 'md' = 'json',
): Promise<{ ok: true; payload: ExportPayload; content: string } | { ok: false; error: string }> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT id, user_id, name, description, trigger_type, trigger_config, code,
              system_prompt, created_at
       FROM builder_bot.agents WHERE id = $1`,
      [agentId],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, error: 'Agent not found' };
    if (Number(row.user_id) !== ownerUserId) return { ok: false, error: 'Not your agent' };

    const rawConfig = typeof row.trigger_config === 'string'
      ? (() => { try { return JSON.parse(row.trigger_config); } catch { return {}; } })()
      : row.trigger_config || {};
    const safeConfig = sanitizeConfig(rawConfig);

    // Detect required keys that need to be filled by importer
    const requiredKeys: string[] = [];
    const scan = (obj: any, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        if (v === '<REQUIRED: set on import>') requiredKeys.push(path ? `${path}.${k}` : k);
        else if (v && typeof v === 'object') scan(v, path ? `${path}.${k}` : k);
      }
    };
    scan(safeConfig);

    // Detect capabilities from config
    const capabilities: string[] = [];
    if (safeConfig?.capabilities && Array.isArray(safeConfig.capabilities)) {
      capabilities.push(...safeConfig.capabilities);
    }

    const payload: ExportPayload = {
      format,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      agent: {
        name: String(row.name || 'Unnamed Agent'),
        description: row.description || undefined,
        trigger_type: row.trigger_type || 'ai_agent',
        trigger_config: safeConfig,
        code: row.code || undefined,
        system_prompt: row.system_prompt || undefined,
      },
      requiredKeys,
      capabilities,
    };

    const content = format === 'md' ? renderMarkdown(payload) : JSON.stringify(payload, null, 2);
    return { ok: true, payload, content };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Export failed' };
  }
}

function renderMarkdown(p: ExportPayload): string {
  const a = p.agent;
  const lines: string[] = [];
  lines.push(`# ${a.name}`);
  lines.push('');
  lines.push(`> Exported from TON Agent Platform · ${p.exportedAt}`);
  lines.push(`> Version: ${p.version} · Format: Markdown`);
  lines.push('');
  if (a.description) {
    lines.push('## Description');
    lines.push(a.description);
    lines.push('');
  }
  lines.push('## Trigger');
  lines.push(`- Type: \`${a.trigger_type}\``);
  lines.push('');
  if (a.system_prompt) {
    lines.push('## System Prompt');
    lines.push('```');
    lines.push(a.system_prompt);
    lines.push('```');
    lines.push('');
  }
  if (p.capabilities && p.capabilities.length > 0) {
    lines.push('## Capabilities');
    for (const c of p.capabilities) lines.push(`- ${c}`);
    lines.push('');
  }
  if (p.requiredKeys.length > 0) {
    lines.push('## Required Secrets (to provide on import)');
    for (const k of p.requiredKeys) lines.push(`- \`${k}\``);
    lines.push('');
  }
  lines.push('## Config (sanitized)');
  lines.push('```json');
  lines.push(JSON.stringify(a.trigger_config, null, 2));
  lines.push('```');
  if (a.code) {
    lines.push('');
    lines.push('## Code / Template');
    lines.push('```');
    lines.push(String(a.code).slice(0, 4000));
    lines.push('```');
  }
  lines.push('');
  lines.push('---');
  lines.push('Import this agent: https://tonagentplatform.com/studio.html');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────

export async function importAgent(
  targetUserId: number,
  payload: ExportPayload,
  overrideConfig?: Record<string, any>,
): Promise<{ ok: true; agentId: number } | { ok: false; error: string }> {
  if (!payload || !payload.agent) return { ok: false, error: 'Invalid payload' };
  if (payload.version && payload.version !== '1.0') {
    return { ok: false, error: `Unsupported export version: ${payload.version}` };
  }
  const pool = getPool();
  try {
    const a = payload.agent;
    // Merge override into config — fills required keys provided by importer
    const mergedConfig = { ...(a.trigger_config || {}), ...(overrideConfig || {}) };
    // Validate no leftover placeholders
    const stillPlaceholder: string[] = [];
    const scan = (obj: any, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        if (v === '<REQUIRED: set on import>') stillPlaceholder.push(path ? `${path}.${k}` : k);
        else if (v && typeof v === 'object') scan(v, path ? `${path}.${k}` : k);
      }
    };
    scan(mergedConfig);
    if (stillPlaceholder.length > 0) {
      return { ok: false, error: `Missing required keys on import: ${stillPlaceholder.join(', ')}` };
    }

    const safeName = String(a.name || 'Imported Agent').slice(0, 120);
    const safeDesc = a.description ? String(a.description).slice(0, 500) : null;
    const triggerType = String(a.trigger_type || 'ai_agent').slice(0, 30);

    const res = await pool.query(
      `INSERT INTO builder_bot.agents
         (user_id, name, description, trigger_type, trigger_config, code, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, false, NOW())
       RETURNING id`,
      [
        targetUserId,
        safeName,
        safeDesc,
        triggerType,
        JSON.stringify(mergedConfig),
        a.code || null,
      ],
    );
    return { ok: true, agentId: Number(res.rows[0].id) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Import failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SHARE
// ─────────────────────────────────────────────────────────────────────────

function generateShareId(): string {
  // ULID-ish — time-sortable + random suffix
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`.slice(0, 24);
}

export async function createShareLink(
  agentId: number,
  userId: number,
  options: { expiresIn?: 'day' | 'week' | 'month' | 'never'; isPublic?: boolean } = {},
): Promise<{ ok: true; shareId: string; url: string } | { ok: false; error: string }> {
  await ensureTable();
  const exp = await exportAgent(agentId, userId, 'json');
  if (!exp.ok) return { ok: false, error: exp.error };
  const pool = getPool();
  try {
    const shareId = generateShareId();
    let expiresAt: Date | null = null;
    if (options.expiresIn === 'day') expiresAt = new Date(Date.now() + 86400_000);
    else if (options.expiresIn === 'week') expiresAt = new Date(Date.now() + 7 * 86400_000);
    else if (options.expiresIn === 'month') expiresAt = new Date(Date.now() + 30 * 86400_000);

    await pool.query(
      `INSERT INTO builder_bot.agent_shares
         (share_id, agent_id, shared_by_user_id, shared_name, shared_description, payload,
          expires_at, is_public)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        shareId,
        agentId,
        userId,
        exp.payload.agent.name,
        exp.payload.agent.description,
        JSON.stringify(exp.payload),
        expiresAt,
        options.isPublic !== false,
      ],
    );
    const base = process.env.LANDING_URL || 'https://tonagentplatform.com';
    return { ok: true, shareId, url: `${base}/share/${shareId}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Share failed' };
  }
}

export async function getShare(
  shareId: string,
): Promise<{ ok: true; payload: ExportPayload; sharedBy: number; agentId: number; viewCount: number } | { ok: false; error: string }> {
  await ensureTable();
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT agent_id, shared_by_user_id, payload, view_count, expires_at, is_public
       FROM builder_bot.agent_shares WHERE share_id = $1`,
      [shareId],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, error: 'Share not found' };
    if (!row.is_public) return { ok: false, error: 'Private share' };
    if (row.expires_at && new Date(row.expires_at) < new Date()) return { ok: false, error: 'Share expired' };

    // Increment view
    pool.query(`UPDATE builder_bot.agent_shares SET view_count = view_count + 1 WHERE share_id = $1`, [shareId]).catch(() => {});

    const payload: ExportPayload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    return {
      ok: true,
      payload,
      sharedBy: Number(row.shared_by_user_id),
      agentId: Number(row.agent_id),
      viewCount: Number(row.view_count) + 1,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Get share failed' };
  }
}

export async function importFromShare(
  shareId: string,
  targetUserId: number,
  overrideConfig?: Record<string, any>,
): Promise<{ ok: true; agentId: number } | { ok: false; error: string }> {
  const share = await getShare(shareId);
  if (!share.ok) return share;
  const result = await importAgent(targetUserId, share.payload, overrideConfig);
  if (result.ok) {
    const pool = getPool();
    pool.query(`UPDATE builder_bot.agent_shares SET import_count = import_count + 1 WHERE share_id = $1`, [shareId]).catch(() => {});
  }
  return result;
}
