/**
 * Agent Hooks — keyword blocklist + context triggers.
 * Adapted pattern: per-agent configurable message filtering and context injection.
 *
 * Blocklist: if incoming message matches a blocked keyword → agent skips it.
 * Triggers: if message matches a trigger keyword → extra context is injected into system prompt.
 *
 * Stored in agent_state as JSON under keys:
 *   _hooks_blocklist  → { enabled: boolean, keywords: string[], reply?: string }
 *   _hooks_triggers   → Array<{ keyword: string, context: string, enabled: boolean }>
 *   _hooks_tool_scope → Record<toolName, { enabled: boolean, scope: ToolScope }>
 *   _hooks_session    → { resetPolicy: 'none'|'daily'|'idle', idleMinutes?: number }
 */

// ── Tool Scope ──────────────────────────────────────────────────────────────
export type ToolScope = 'always' | 'dm-only' | 'group-only' | 'admin-only';

export interface ToolScopeConfig {
  enabled: boolean;
  scope: ToolScope;
}

// Default scopes for financial/dangerous tools (dm-only by default)
const DEFAULT_DM_ONLY_TOOLS = new Set([
  'send_ton', 'send_jetton', 'buy_catalog_gift', 'buy_resale_gift',
  'list_gift_for_sale', 'get_agent_wallet', 'create_agent_wallet',
  'update_my_prompt', 'update_my_interval', 'update_my_description',
]);

const DEFAULT_ADMIN_ONLY_TOOLS = new Set([
  'tg_ban_user2', 'tg_kick_user2', 'tg_mute_user2', 'tg_delete_user_messages',
  'tg_edit_admin2', 'tg_delete_channel', 'tg_toggle_antispam',
]);

export function getDefaultToolScope(toolName: string): ToolScope {
  if (DEFAULT_DM_ONLY_TOOLS.has(toolName)) return 'dm-only';
  if (DEFAULT_ADMIN_ONLY_TOOLS.has(toolName)) return 'admin-only';
  return 'always';
}

/**
 * Check if a tool is allowed in the current context.
 * Returns null if allowed, or error string if blocked.
 */
export function checkToolScope(
  toolName: string,
  scope: ToolScope,
  isGroup: boolean,
  isOwner: boolean,
): string | null {
  switch (scope) {
    case 'always':
      return null;
    case 'dm-only':
      if (isGroup) return `Tool "${toolName}" is restricted to direct messages only (dm-only). Cannot use in group chats.`;
      return null;
    case 'group-only':
      if (!isGroup) return `Tool "${toolName}" is restricted to group chats only.`;
      return null;
    case 'admin-only':
      if (!isOwner) return `Tool "${toolName}" requires admin/owner privileges.`;
      return null;
    default:
      return null;
  }
}

// ── Keyword Blocklist ───────────────────────────────────────────────────────
export interface BlocklistConfig {
  enabled: boolean;
  keywords: string[];
  reply?: string; // optional auto-reply when blocked
}

const DEFAULT_BLOCKLIST: BlocklistConfig = {
  enabled: false,
  keywords: [],
  reply: undefined,
};

/**
 * Check if a message should be blocked by the keyword blocklist.
 * Uses normalized text matching with word boundaries.
 */
export function checkBlocklist(text: string, config: BlocklistConfig): boolean {
  if (!config.enabled || config.keywords.length === 0) return false;
  const normalized = text.toLowerCase().normalize('NFKC');
  // Split into words for word-boundary matching (prevents "ass" matching "password")
  // Include Unicode punctuation: em-dash, ellipsis, guillemets, CJK symbols
  const words = normalized.split(/[\s,.!?;:'"()\[\]{}\-_\/\\|«»—–…\u2000-\u200A\u3000\uFF01-\uFF0F]+/u).filter(w => w.length > 0);
  for (const kw of config.keywords) {
    const kwLower = kw.toLowerCase().normalize('NFKC');
    // Multi-word keywords: match as substring (phrase matching)
    if (kwLower.includes(' ')) {
      if (normalized.includes(kwLower)) return true;
    } else {
      // Single-word keywords: match whole words only
      if (words.includes(kwLower)) return true;
    }
  }
  return false;
}

// ── Context Triggers ────────────────────────────────────────────────────────
export interface ContextTrigger {
  id: string;
  keyword: string;
  context: string; // context to inject into system prompt
  enabled: boolean;
}

/**
 * Find all matching triggers for a message.
 * Returns array of context strings to inject.
 */
const MAX_TRIGGER_CONTEXT_CHARS = 5000; // prevent prompt ballooning

export function matchTriggers(text: string, triggers: ContextTrigger[]): string[] {
  if (!triggers || triggers.length === 0) return [];
  const normalized = text.toLowerCase().normalize('NFKC');
  const matched: string[] = [];
  let totalChars = 0;
  for (const trigger of triggers) {
    if (!trigger.enabled) continue;
    const kwLower = trigger.keyword.toLowerCase().normalize('NFKC');
    if (normalized.includes(kwLower)) {
      // Cap total injected context size
      if (totalChars + trigger.context.length > MAX_TRIGGER_CONTEXT_CHARS) {
        console.warn(`[Hooks] Trigger context cap reached (${totalChars}/${MAX_TRIGGER_CONTEXT_CHARS}), skipping "${trigger.keyword}"`);
        break;
      }
      matched.push(trigger.context);
      totalChars += trigger.context.length;
    }
  }
  return matched;
}

// ── Session Reset Policy ────────────────────────────────────────────────────
export type SessionResetPolicy = 'none' | 'daily' | 'idle';

export interface SessionConfig {
  resetPolicy: SessionResetPolicy;
  idleMinutes: number; // for 'idle' policy, minutes of inactivity before reset
}

const DEFAULT_SESSION: SessionConfig = {
  resetPolicy: 'none',
  idleMinutes: 60,
};

/**
 * Check if session should be reset based on policy.
 * Returns true if history should be cleared.
 */
export function shouldResetSession(
  config: SessionConfig,
  lastActivityTs: number | null,
): boolean {
  if (config.resetPolicy === 'none') return false;

  if (config.resetPolicy === 'daily') {
    if (!lastActivityTs) return false;
    const lastDate = new Date(lastActivityTs).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return lastDate !== today;
  }

  if (config.resetPolicy === 'idle') {
    if (!lastActivityTs) return false;
    const idleMs = Date.now() - lastActivityTs;
    return idleMs > config.idleMinutes * 60_000;
  }

  return false;
}

// ── State persistence helpers ───────────────────────────────────────────────
function parseJsonbValue(raw: any): any {
  if (raw === null || raw === undefined) return null;
  // JSONB column: Drizzle auto-parses, so raw may already be an object. Handle both cases.
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

export async function loadBlocklist(stateRepo: any, agentId: number): Promise<BlocklistConfig> {
  try {
    const raw = await stateRepo.get(agentId, '_hooks_blocklist');
    const val = parseJsonbValue(raw);
    if (val) return { ...DEFAULT_BLOCKLIST, ...val };
  } catch {}
  return { ...DEFAULT_BLOCKLIST };
}

export async function saveBlocklist(stateRepo: any, agentId: number, userId: number, config: BlocklistConfig): Promise<void> {
  await stateRepo.set(agentId, userId, '_hooks_blocklist', config);
}

export async function loadTriggers(stateRepo: any, agentId: number): Promise<ContextTrigger[]> {
  try {
    const raw = await stateRepo.get(agentId, '_hooks_triggers');
    const val = parseJsonbValue(raw);
    if (Array.isArray(val)) return val;
  } catch {}
  return [];
}

export async function saveTriggers(stateRepo: any, agentId: number, userId: number, triggers: ContextTrigger[]): Promise<void> {
  await stateRepo.set(agentId, userId, '_hooks_triggers', triggers);
}

export async function loadToolScopes(stateRepo: any, agentId: number): Promise<Record<string, ToolScopeConfig>> {
  try {
    const raw = await stateRepo.get(agentId, '_hooks_tool_scope');
    const val = parseJsonbValue(raw);
    if (val && typeof val === 'object') return val;
  } catch {}
  return {};
}

export async function saveToolScopes(stateRepo: any, agentId: number, userId: number, scopes: Record<string, ToolScopeConfig>): Promise<void> {
  await stateRepo.set(agentId, userId, '_hooks_tool_scope', scopes);
}

export async function loadSessionConfig(stateRepo: any, agentId: number): Promise<SessionConfig> {
  try {
    const raw = await stateRepo.get(agentId, '_hooks_session');
    const val = parseJsonbValue(raw);
    if (val) return { ...DEFAULT_SESSION, ...val };
  } catch {}
  return { ...DEFAULT_SESSION };
}

export async function saveSessionConfig(stateRepo: any, agentId: number, userId: number, config: SessionConfig): Promise<void> {
  await stateRepo.set(agentId, userId, '_hooks_session', config);
}
