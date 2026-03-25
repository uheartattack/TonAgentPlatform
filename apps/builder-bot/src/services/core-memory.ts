/**
 * core-memory.ts — Structured persistent memory with 5 named blocks.
 * Each block has a char limit. Blocks: identity, preferences, lessons, goals, contacts.
 * Adapted from teleton-agent core-blocks.ts pattern, uses PostgreSQL.
 */

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const BLOCK_NAMES = ['identity', 'preferences', 'lessons', 'goals', 'contacts'] as const;
export type BlockName = typeof BLOCK_NAMES[number];

const BLOCK_LIMITS: Record<BlockName, number> = {
  identity: 600,     // who the agent is, style, personality traits
  preferences: 500,  // owner's preferences, timezone, language, communication style
  lessons: 800,      // lessons from mistakes, patterns to avoid/repeat
  goals: 400,        // current active goals and milestones
  contacts: 600,     // important people, relationships, notes
};

const BLOCK_DESCRIPTIONS: Record<BlockName, string> = {
  identity: 'Who I am — personality traits, style, quirks',
  preferences: 'Owner preferences — timezone, language, communication style',
  lessons: 'Lessons from past — mistakes to avoid, patterns that work',
  goals: 'Current goals and milestones',
  contacts: 'Important people — who they are, relationship, notes',
};

const STATE_KEY = '_core_memory';

// ═══════════════════════════════════════════════════════════════════════════
// LOAD / SAVE
// ═══════════════════════════════════════════════════════════════════════════

function emptyBlocks(): Record<BlockName, string> {
  return Object.fromEntries(BLOCK_NAMES.map(n => [n, ''])) as Record<BlockName, string>;
}

// In-memory cache per agent
const _cache = new Map<number, Record<BlockName, string>>();

export async function loadCoreMemory(agentId: number): Promise<Record<BlockName, string>> {
  const cached = _cache.get(agentId);
  if (cached) return cached;

  const pool = await getPool();
  try {
    const res = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2`,
      [agentId, STATE_KEY]
    );
    const raw = res.rows[0]?.value;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const blocks = emptyBlocks();
      for (const name of BLOCK_NAMES) {
        if (parsed.blocks?.[name]) blocks[name] = parsed.blocks[name];
        else if (parsed[name]) blocks[name] = parsed[name]; // flat format
      }
      _cache.set(agentId, blocks);
      return blocks;
    }
  } catch {}

  const blocks = emptyBlocks();
  _cache.set(agentId, blocks);
  return blocks;
}

async function saveCoreMemory(agentId: number, blocks: Record<BlockName, string>): Promise<void> {
  const pool = await getPool();
  const data = JSON.stringify({ blocks });
  await pool.query(
    `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
     VALUES ($1, 0, $2, $3::jsonb, NOW())
     ON CONFLICT (agent_id, key) DO UPDATE SET value=$3::jsonb, updated_at=NOW()`,
    [agentId, STATE_KEY, data]
  );
  _cache.set(agentId, { ...blocks });
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK OPERATIONS (used by AI agent tools)
// ═══════════════════════════════════════════════════════════════════════════

export async function getBlock(agentId: number, blockName: string): Promise<{ content: string; limit: number }> {
  if (!BLOCK_NAMES.includes(blockName as BlockName)) {
    throw new Error(`Unknown block: ${blockName}. Valid: ${BLOCK_NAMES.join(', ')}`);
  }
  const name = blockName as BlockName;
  const blocks = await loadCoreMemory(agentId);
  return { content: blocks[name], limit: BLOCK_LIMITS[name] };
}

export async function updateBlock(agentId: number, blockName: string, content: string): Promise<void> {
  if (!BLOCK_NAMES.includes(blockName as BlockName)) {
    throw new Error(`Unknown block: ${blockName}. Valid: ${BLOCK_NAMES.join(', ')}`);
  }
  const name = blockName as BlockName;
  const limit = BLOCK_LIMITS[name];
  if (content.length > limit) {
    throw new Error(`Content exceeds block limit (${content.length}/${limit} chars)`);
  }
  const blocks = await loadCoreMemory(agentId);
  blocks[name] = content;
  await saveCoreMemory(agentId, blocks);
}

export async function appendToBlock(agentId: number, blockName: string, content: string): Promise<void> {
  if (!BLOCK_NAMES.includes(blockName as BlockName)) {
    throw new Error(`Unknown block: ${blockName}. Valid: ${BLOCK_NAMES.join(', ')}`);
  }
  const name = blockName as BlockName;
  const blocks = await loadCoreMemory(agentId);
  const sep = blocks[name].length > 0 ? '\n' : '';
  const newContent = blocks[name] + sep + content;
  const limit = BLOCK_LIMITS[name];
  if (newContent.length > limit) {
    throw new Error(`Appending would exceed limit (${newContent.length}/${limit}). Use updateBlock to replace.`);
  }
  blocks[name] = newContent;
  await saveCoreMemory(agentId, blocks);
}

export async function deleteFromBlock(agentId: number, blockName: string, keyword: string): Promise<boolean> {
  if (!BLOCK_NAMES.includes(blockName as BlockName)) {
    throw new Error(`Unknown block: ${blockName}. Valid: ${BLOCK_NAMES.join(', ')}`);
  }
  const name = blockName as BlockName;
  const blocks = await loadCoreMemory(agentId);
  const lines = blocks[name].split('\n');
  const idx = lines.findIndex(l => l.toLowerCase().includes(keyword.toLowerCase()));
  if (idx === -1) return false;
  lines.splice(idx, 1);
  blocks[name] = lines.join('\n').trim();
  await saveCoreMemory(agentId, blocks);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// FOR PROMPT INJECTION (used by prompt-builder)
// ═══════════════════════════════════════════════════════════════════════════

export async function getCoreMemoryForPrompt(agentId: number): Promise<string> {
  const blocks = await loadCoreMemory(agentId);
  const sections: string[] = [];
  for (const name of BLOCK_NAMES) {
    if (!blocks[name]) continue;
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    sections.push(`### ${label}\n${blocks[name]}`);
  }
  if (sections.length === 0) return '';
  return sections.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// FOR STUDIO API
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllBlocks(agentId: number): Promise<Array<{
  name: BlockName;
  content: string;
  limit: number;
  used: number;
  description: string;
}>> {
  const blocks = await loadCoreMemory(agentId);
  return BLOCK_NAMES.map(name => ({
    name,
    content: blocks[name],
    limit: BLOCK_LIMITS[name],
    used: blocks[name].length,
    description: BLOCK_DESCRIPTIONS[name],
  }));
}

export function clearCache(agentId: number): void {
  _cache.delete(agentId);
}
