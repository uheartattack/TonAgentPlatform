/**
 * agent-memory-store.ts — Enhanced memory with persistent/daily storage,
 * FTS search, group chat poisoning protection, size warnings.
 * Adapted from teleton-agent memory patterns, uses PostgreSQL.
 */

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MEMORY_SOFT_LIMIT_CHARS = 20000;
const MEMORY_ENTRY_MAX_CHARS = 2000;
const DAILY_LOG_MAX_LINES = 500;

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENT MEMORY (long-term facts, preferences, contacts, rules)
// ═══════════════════════════════════════════════════════════════════════════

export async function readPersistentMemory(agentId: number): Promise<string> {
  const pool = await getPool();
  const res = await pool.query(
    `SELECT value FROM builder_bot.agent_state WHERE agent_id=$1 AND key='_persistent_memory'`,
    [agentId]
  );
  const raw = res.rows[0]?.value;
  if (!raw) return '';
  // JSONB stores as object — unwrap if it's a string wrapped in JSON
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw.text) return raw.text;
  return String(raw);
}

export async function writePersistentMemory(
  agentId: number,
  content: string,
  section?: string,
  opts?: { isGroupChat?: boolean; senderId?: number; ownerId?: number }
): Promise<{ success: boolean; error?: string; warning?: string; lineCount?: number }> {
  // Security: block memory writes in group chats from non-owners
  if (opts?.isGroupChat && opts?.senderId && opts?.ownerId && opts.senderId !== opts.ownerId) {
    return { success: false, error: 'Memory writes are disabled in group chats for security (memory poisoning protection).' };
  }

  if (content.length > MEMORY_ENTRY_MAX_CHARS) {
    return { success: false, error: `Memory entry too long. Maximum ${MEMORY_ENTRY_MAX_CHARS} characters.` };
  }

  const pool = await getPool();

  // Build entry
  let entry = '\n';
  if (section) entry += `### ${section}\n\n`;
  entry += `${content}\n`;
  entry += `\n_Added: ${new Date().toISOString()}_\n`;

  // Get existing memory
  const existing = await readPersistentMemory(agentId);
  const updated = existing + entry;

  await pool.query(
    `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
     VALUES ($1, 0, '_persistent_memory', $2::jsonb, NOW())
     ON CONFLICT (agent_id, key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
    [agentId, JSON.stringify({ text: updated })]
  );

  const lineCount = updated.split('\n').length;
  const warning = updated.length > MEMORY_SOFT_LIMIT_CHARS
    ? `Memory is ${Math.round(updated.length / 1024)}KB (recommended max: ~${Math.round(MEMORY_SOFT_LIMIT_CHARS / 1024)}KB). Consider consolidating old entries.`
    : undefined;

  return { success: true, lineCount, warning };
}

/** Replace entire persistent memory (for Studio editor) */
export async function replacePersistentMemory(agentId: number, content: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
     VALUES ($1, 0, '_persistent_memory', $2::jsonb, NOW())
     ON CONFLICT (agent_id, key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
    [agentId, JSON.stringify({ text: content })]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY LOGS
// ═══════════════════════════════════════════════════════════════════════════

export async function listDailyLogs(agentId: number, limit: number = 30): Promise<Array<{ date: string; size: number }>> {
  const pool = await getPool();
  const res = await pool.query(
    `SELECT log_date, LENGTH(content) as size FROM builder_bot.agent_daily_logs
     WHERE agent_id=$1 ORDER BY log_date DESC LIMIT $2`,
    [agentId, limit]
  );
  return res.rows.map((r: any) => ({
    date: typeof r.log_date === 'string' ? r.log_date : new Date(r.log_date).toISOString().slice(0, 10),
    size: Number(r.size) || 0,
  }));
}

export async function readDailyLog(agentId: number, date: string): Promise<string> {
  const pool = await getPool();
  const res = await pool.query(
    `SELECT content FROM builder_bot.agent_daily_logs WHERE agent_id=$1 AND log_date=$2`,
    [agentId, date]
  );
  return res.rows[0]?.content || '';
}

export async function writeDailyLog(
  agentId: number,
  content: string,
  section?: string
): Promise<{ success: boolean }> {
  const pool = await getPool();
  const timestamp = new Date().toISOString().slice(11, 19);
  let entry = `## ${timestamp}`;
  if (section) entry += ` - ${section}`;
  entry += `\n\n${content}\n\n---\n\n`;

  await pool.query(
    `INSERT INTO builder_bot.agent_daily_logs (agent_id, log_date, content)
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (agent_id, log_date)
     DO UPDATE SET content = builder_bot.agent_daily_logs.content || $2`,
    [agentId, entry]
  ).catch(() => {
    // Fallback if table constraint differs
    pool.query(
      `INSERT INTO builder_bot.agent_daily_logs (agent_id, content) VALUES ($1, $2)`,
      [agentId, entry]
    ).catch(() => {});
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// FTS SEARCH (Full-Text Search across memory + daily logs)
// ═══════════════════════════════════════════════════════════════════════════

export interface MemorySearchResult {
  text: string;
  source: 'persistent' | 'daily_log' | 'session';
  score: number;
  date?: string;
}

export async function searchMemory(
  agentId: number,
  query: string,
  limit: number = 10
): Promise<MemorySearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const pool = await getPool();
  const results: MemorySearchResult[] = [];
  const terms = query.trim().split(/\s+/).filter(t => t.length >= 2);
  if (terms.length === 0) return [];

  // Build ILIKE patterns for PostgreSQL (no FTS5, this is PG not SQLite)
  const patterns = terms.map(t => `%${t.toLowerCase()}%`);

  // 1. Search persistent memory
  const persistent = await readPersistentMemory(agentId);
  if (persistent) {
    const lines = persistent.split('\n');
    const chunks: string[] = [];
    // Split into ~200-char chunks for search
    let chunk = '';
    for (const line of lines) {
      chunk += line + '\n';
      if (chunk.length > 200) {
        chunks.push(chunk.trim());
        chunk = '';
      }
    }
    if (chunk.trim()) chunks.push(chunk.trim());

    for (const c of chunks) {
      const lower = c.toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (lower.includes(t.toLowerCase())) matchCount++;
      }
      if (matchCount > 0) {
        results.push({
          text: c.slice(0, 500),
          source: 'persistent',
          score: matchCount / terms.length,
        });
      }
    }
  }

  // 2. Search daily logs
  try {
    const logsRes = await pool.query(
      `SELECT log_date, content FROM builder_bot.agent_daily_logs
       WHERE agent_id=$1 ORDER BY log_date DESC LIMIT 30`,
      [agentId]
    );
    for (const row of logsRes.rows) {
      const lower = (row.content || '').toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (lower.includes(t.toLowerCase())) matchCount++;
      }
      if (matchCount > 0) {
        // Extract matching section
        const lines = (row.content || '').split('\n');
        const matchLine = lines.find((l: string) => terms.some(t => l.toLowerCase().includes(t.toLowerCase())));
        results.push({
          text: (matchLine || row.content || '').slice(0, 500),
          source: 'daily_log',
          score: matchCount / terms.length,
          date: typeof row.log_date === 'string' ? row.log_date : new Date(row.log_date).toISOString().slice(0, 10),
        });
      }
    }
  } catch {}

  // 3. Search session summaries
  try {
    const sessRes = await pool.query(
      `SELECT summary, ended_at FROM builder_bot.agent_sessions
       WHERE agent_id=$1 AND summary IS NOT NULL
       ORDER BY ended_at DESC LIMIT 20`,
      [agentId]
    );
    for (const row of sessRes.rows) {
      const lower = (row.summary || '').toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (lower.includes(t.toLowerCase())) matchCount++;
      }
      if (matchCount > 0) {
        results.push({
          text: (row.summary || '').slice(0, 500),
          source: 'session',
          score: matchCount / terms.length * 0.8, // slightly lower weight for sessions
          date: row.ended_at ? new Date(row.ended_at).toISOString().slice(0, 10) : undefined,
        });
      }
    }
  } catch {}

  // Sort by score desc, limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════

export interface MemoryStats {
  persistentSize: number;       // chars
  persistentLineCount: number;
  dailyLogCount: number;
  sessionCount: number;
  totalTokensUsed: number;
  lastUpdated: string | null;
}

export async function getMemoryStats(agentId: number): Promise<MemoryStats> {
  const pool = await getPool();

  const persistent = await readPersistentMemory(agentId);

  let dailyLogCount = 0;
  try {
    const r1 = await pool.query(
      `SELECT COUNT(*) as cnt FROM builder_bot.agent_daily_logs WHERE agent_id=$1`,
      [agentId]
    );
    dailyLogCount = Number(r1.rows[0]?.cnt) || 0;
  } catch {}

  let sessionCount = 0;
  let totalTokens = 0;
  try {
    const r2 = await pool.query(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(tokens_used), 0) as tokens FROM builder_bot.agent_sessions WHERE agent_id=$1`,
      [agentId]
    );
    sessionCount = Number(r2.rows[0]?.cnt) || 0;
    totalTokens = Number(r2.rows[0]?.tokens) || 0;
  } catch {}

  return {
    persistentSize: persistent.length,
    persistentLineCount: persistent ? persistent.split('\n').length : 0,
    dailyLogCount,
    sessionCount,
    totalTokensUsed: totalTokens,
    lastUpdated: persistent ? new Date().toISOString() : null,
  };
}

/** Clear all memory for an agent */
export async function clearMemory(agentId: number, target: 'persistent' | 'daily' | 'all'): Promise<void> {
  const pool = await getPool();
  if (target === 'persistent' || target === 'all') {
    await pool.query(
      `DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key='_persistent_memory'`,
      [agentId]
    );
  }
  if (target === 'daily' || target === 'all') {
    await pool.query(
      `DELETE FROM builder_bot.agent_daily_logs WHERE agent_id=$1`,
      [agentId]
    );
  }
}
