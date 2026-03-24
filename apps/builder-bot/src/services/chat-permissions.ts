/**
 * chat-permissions.ts — Per-chat tool permissions (teleton-agent module-permissions pattern).
 * 3 levels per module per chat: open | admin | disabled
 * Protected modules (telegram, memory) cannot be disabled.
 * Cached in-memory, persisted to agent_state.
 */

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

export type PermissionLevel = 'open' | 'admin' | 'disabled';

interface ChatPermission {
  chatId: string;
  module: string;
  level: PermissionLevel;
  updatedBy?: number;
  updatedAt?: number;
}

// In-memory cache: agentId → chatId → module → level
const _cache = new Map<number, Map<string, Map<string, PermissionLevel>>>();

// Protected modules — cannot be disabled
const PROTECTED_MODULES = new Set(['telegram', 'state', 'notify']);

// Module → capability mapping
const MODULE_CAPS: Record<string, string[]> = {
  telegram:  ['telegram'],
  admin:     ['telegram_admin'],
  media:     ['telegram_media', 'image'],
  stories:   ['telegram_stories'],
  wallet:    ['wallet'],
  gifts:     ['gifts', 'gifts_market'],
  defi:      ['defi', 'blockchain'],
  web:       ['web'],
  workspace: ['workspace'],
  plugins:   ['plugins', 'mcp'],
  memory:    ['self_memory'],
  notify:    ['notify'],
  state:     ['state', 'events'],
  inter:     ['inter_agent'],
};

/** Get permission level for a module in a chat */
export function getPermission(agentId: number, chatId: string, module: string): PermissionLevel {
  const agentCache = _cache.get(agentId);
  if (!agentCache) return 'open';
  const chatCache = agentCache.get(chatId);
  if (!chatCache) return 'open';
  return chatCache.get(module) || 'open';
}

/** Set permission level */
export async function setPermission(
  agentId: number, chatId: string, module: string, level: PermissionLevel, updatedBy?: number
): Promise<{ ok: boolean; error?: string }> {
  if (PROTECTED_MODULES.has(module) && level === 'disabled') {
    return { ok: false, error: `Module "${module}" is protected and cannot be disabled.` };
  }

  // Update cache
  if (!_cache.has(agentId)) _cache.set(agentId, new Map());
  const agentCache = _cache.get(agentId)!;
  if (!agentCache.has(chatId)) agentCache.set(chatId, new Map());
  agentCache.get(chatId)!.set(module, level);

  // Persist
  try {
    const pool = await getPool();
    const key = `_chat_perms_${chatId}`;
    const perms: Record<string, PermissionLevel> = {};
    for (const [mod, lv] of agentCache.get(chatId)!) {
      if (lv !== 'open') perms[mod] = lv; // only store non-default
    }
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (agent_id, key) DO UPDATE SET value=$4, updated_at=NOW()`,
      [agentId, updatedBy || 0, key, JSON.stringify(perms)]
    );
  } catch (err: any) {
    console.warn(`[ChatPerms] DB persist failed: ${err.message?.slice(0, 100)}`);
  }

  return { ok: true };
}

/** Reset all permissions for a module across all chats */
export async function resetModule(agentId: number, module: string): Promise<void> {
  const agentCache = _cache.get(agentId);
  if (agentCache) {
    for (const [, chatCache] of agentCache) {
      chatCache.delete(module);
    }
  }
}

/** Reset all permissions for a chat */
export async function resetChat(agentId: number, chatId: string): Promise<void> {
  const agentCache = _cache.get(agentId);
  if (agentCache) agentCache.delete(chatId);
}

/** Load permissions from DB for an agent */
export async function loadPermissions(agentId: number): Promise<void> {
  try {
    const pool = await getPool();
    const res = await pool.query(
      `SELECT key, value FROM builder_bot.agent_state WHERE agent_id=$1 AND key LIKE '_chat_perms_%'`,
      [agentId]
    );
    if (!_cache.has(agentId)) _cache.set(agentId, new Map());
    const agentCache = _cache.get(agentId)!;
    for (const row of res.rows) {
      const chatId = row.key.replace('_chat_perms_', '');
      let perms: Record<string, PermissionLevel> = {};
      try {
        const raw = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        perms = JSON.parse(raw);
      } catch {}
      const chatCache = new Map<string, PermissionLevel>();
      for (const [mod, lv] of Object.entries(perms)) {
        chatCache.set(mod, lv as PermissionLevel);
      }
      agentCache.set(chatId, chatCache);
    }
  } catch {}
}

/** Get all permissions for an agent (for Studio UI) */
export async function getAllPermissions(agentId: number): Promise<ChatPermission[]> {
  await loadPermissions(agentId);
  const result: ChatPermission[] = [];
  const agentCache = _cache.get(agentId);
  if (!agentCache) return result;
  for (const [chatId, chatCache] of agentCache) {
    for (const [module, level] of chatCache) {
      result.push({ chatId, module, level });
    }
  }
  return result;
}

/** Filter capabilities based on chat permissions.
 * Returns the set of allowed capability IDs for this chat. */
export function filterCapsByPermissions(
  agentId: number, chatId: string, capabilities: string[], isAdmin: boolean
): string[] {
  const agentCache = _cache.get(agentId);
  if (!agentCache) return capabilities;
  const chatCache = agentCache.get(chatId);
  if (!chatCache) return capabilities;

  return capabilities.filter(cap => {
    // Find which module this cap belongs to
    for (const [module, caps] of Object.entries(MODULE_CAPS)) {
      if (caps.includes(cap)) {
        const level = chatCache.get(module);
        if (level === 'disabled') return false;
        if (level === 'admin' && !isAdmin) return false;
      }
    }
    return true;
  });
}

/** Get list of all module names */
export function getModuleList(): Array<{ id: string; label: string; protected: boolean; caps: string[] }> {
  return Object.entries(MODULE_CAPS).map(([id, caps]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    protected: PROTECTED_MODULES.has(id),
    caps,
  }));
}
