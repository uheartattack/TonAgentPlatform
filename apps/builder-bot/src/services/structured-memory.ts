/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STRUCTURED MEMORY — 3 слоя памяти для агента
 *
 * Решает проблему: "агент помнит что только что сделали, но не путается".
 *
 *   SHORT-TERM  — последняя минута-час текущей сессии (что делали ТОЛЬКО ЧТО).
 *                 Живёт пока идёт активная сессия. Автоматически "выцветает"
 *                 когда сессия закрывается (через 30 мин бездействия).
 *
 *   USER FACTS  — стабильные факты про конкретного юзера (имя, предпочтения,
 *                 кошельки, риск-толерантность). Живут долго, не смешиваются
 *                 с другими юзерами.
 *
 *   SYSTEM FACTS — выученные факты про систему/мир ("USDT swap на STON.fi
 *                  работает", "Hex Pot floor ~3-5 TON"). Общее знание агента.
 *                  Живут forever с флагом last_verified.
 *
 * Каждый слой возвращается AI отдельным блоком в system prompt, чтобы модель
 * не путалась "это из этой сессии или из прошлой".
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
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface ShortTermEntry {
  timestamp: string;       // ISO or relative ("10s ago")
  action: string;          // что было ("получил баланс", "вызвал get_ton_price")
  result?: string;         // краткий результат
}

export interface UserFact {
  key: string;             // "name" / "preferred_wallet" / "risk_tolerance"
  value: string;
  importance?: 'high' | 'medium' | 'low';
  updatedAt?: string;
}

export interface SystemFact {
  key: string;             // "stonfi_usdt" / "dedust_not_listed"
  value: string;
  confidence?: number;     // 0-1
  lastVerified?: string;
}

export interface StructuredMemory {
  shortTerm: ShortTermEntry[];
  userFacts: UserFact[];
  systemFacts: SystemFact[];
  sessionId?: string;
  sessionAgeMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// SHORT-TERM: recent actions in current session (sliding window)
// ─────────────────────────────────────────────────────────────────────────

const SHORT_TERM_WINDOW_MS = 30 * 60 * 1000; // 30 min
const SHORT_TERM_MAX_ENTRIES = 15;

/** Log an action into short-term. Older than 30 min entries auto-evicted. */
export async function logShortTerm(
  agentId: number,
  entry: ShortTermEntry,
): Promise<void> {
  const pool = getPool();
  try {
    // Use agent_state with a ring-buffer key
    const key = `st_mem:ring`;
    const res = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id = $1 AND key = $2`,
      [agentId, key],
    );
    const raw = res.rows[0]?.value;
    let ring: ShortTermEntry[] = [];
    if (raw) {
      try { ring = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { ring = []; }
      if (!Array.isArray(ring)) ring = [];
    }
    const now = Date.now();
    // Evict entries older than window
    ring = ring.filter(e => {
      const ts = Date.parse(e.timestamp);
      return !isNaN(ts) && (now - ts) < SHORT_TERM_WINDOW_MS;
    });
    ring.push({
      timestamp: new Date().toISOString(),
      action: String(entry.action).slice(0, 200),
      result: entry.result ? String(entry.result).slice(0, 200) : undefined,
    });
    // Keep only last N
    if (ring.length > SHORT_TERM_MAX_ENTRIES) {
      ring = ring.slice(-SHORT_TERM_MAX_ENTRIES);
    }
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (agent_id, key) DO UPDATE SET value = $3::jsonb, updated_at = NOW()`,
      [agentId, key, JSON.stringify(ring)],
    );
  } catch (e: any) {
    console.warn(`[StructuredMemory] logShortTerm failed for #${agentId}:`, e?.message);
  }
}

/** Get current short-term ring (auto-filters expired). */
export async function getShortTerm(agentId: number): Promise<ShortTermEntry[]> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT value FROM builder_bot.agent_state WHERE agent_id = $1 AND key = $2`,
      [agentId, 'st_mem:ring'],
    );
    const raw = res.rows[0]?.value;
    if (!raw) return [];
    let ring: ShortTermEntry[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(ring)) return [];
    const now = Date.now();
    return ring.filter(e => {
      const ts = Date.parse(e.timestamp);
      return !isNaN(ts) && (now - ts) < SHORT_TERM_WINDOW_MS;
    });
  } catch { return []; }
}

/** Clear short-term memory (called when session ends or context switches). */
export async function clearShortTerm(agentId: number): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `DELETE FROM builder_bot.agent_state WHERE agent_id = $1 AND key = $2`,
      [agentId, 'st_mem:ring'],
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// USER FACTS: per-user, per-agent long-term knowledge
// Reuses existing `mem:*` keys with category=preference/contact/fact
// ─────────────────────────────────────────────────────────────────────────

/** Get structured user facts (from legacy `mem:*` + user_dossier). */
export async function getUserFacts(agentId: number, userId: number): Promise<UserFact[]> {
  const pool = getPool();
  const facts: UserFact[] = [];
  try {
    // From mem:* keys scoped to this user (category: preference / contact / fact)
    const res = await pool.query(
      `SELECT key, value FROM builder_bot.agent_state
       WHERE agent_id = $1 AND user_id = $2 AND key LIKE 'mem:%'
       ORDER BY updated_at DESC LIMIT 50`,
      [agentId, userId],
    );
    for (const row of res.rows) {
      try {
        const mem = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        const cat = mem?.category;
        // Only preference/contact are true "user facts" — keep them out of system facts
        if (cat === 'preference' || cat === 'contact') {
          facts.push({
            key: row.key.replace('mem:', ''),
            value: mem.value || '',
            importance: mem.importance,
            updatedAt: mem.savedAt,
          });
        }
      } catch {}
    }
  } catch (e: any) {
    console.warn(`[StructuredMemory] getUserFacts failed for #${agentId} user ${userId}:`, e?.message);
  }
  return facts;
}

/** Store a user fact. Writes to agent_state as `mem:<key>` with category=preference. */
export async function setUserFact(
  agentId: number,
  userId: number,
  key: string,
  value: string,
  importance: 'high' | 'medium' | 'low' = 'medium',
): Promise<void> {
  const pool = getPool();
  const memKey = `mem:${key.slice(0, 60)}`;
  const payload = {
    value: String(value).slice(0, 500),
    category: 'preference' as const,
    importance,
    savedAt: new Date().toISOString(),
  };
  try {
    await pool.query(
      `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (agent_id, user_id, key) DO UPDATE SET value = $4::jsonb, updated_at = NOW()`,
      [agentId, userId, memKey, JSON.stringify(payload)],
    );
  } catch (e: any) {
    console.warn(`[StructuredMemory] setUserFact failed:`, e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM FACTS: global knowledge learned by agent (not per-user)
// Stored in separate agent_system_facts table
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_FACTS_TABLE_EXISTS_CACHE = new Set<number>();

/** Ensure agent_system_facts table exists (idempotent, runs once per boot). */
async function ensureSystemFactsTable(): Promise<void> {
  const pool = getPool();
  if (SYSTEM_FACTS_TABLE_EXISTS_CACHE.has(0)) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_system_facts (
        agent_id BIGINT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 0.8,
        last_verified TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (agent_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_sys_facts_agent ON builder_bot.agent_system_facts(agent_id, last_verified DESC);
    `);
    SYSTEM_FACTS_TABLE_EXISTS_CACHE.add(0);
  } catch (e: any) {
    console.warn(`[StructuredMemory] ensureSystemFactsTable failed:`, e?.message);
  }
}

export async function getSystemFacts(agentId: number, limit = 30): Promise<SystemFact[]> {
  await ensureSystemFactsTable();
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT key, value, confidence, last_verified FROM builder_bot.agent_system_facts
       WHERE agent_id = $1 ORDER BY last_verified DESC LIMIT $2`,
      [agentId, limit],
    );
    return res.rows.map(r => ({
      key: r.key,
      value: r.value,
      confidence: parseFloat(r.confidence) || 0.8,
      lastVerified: r.last_verified?.toISOString ? r.last_verified.toISOString() : String(r.last_verified),
    }));
  } catch (e: any) {
    console.warn(`[StructuredMemory] getSystemFacts failed:`, e?.message);
    return [];
  }
}

export async function setSystemFact(
  agentId: number,
  key: string,
  value: string,
  confidence = 0.8,
): Promise<void> {
  await ensureSystemFactsTable();
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO builder_bot.agent_system_facts (agent_id, key, value, confidence, last_verified)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (agent_id, key) DO UPDATE
         SET value = $3, confidence = $4, last_verified = NOW()`,
      [agentId, key.slice(0, 100), value.slice(0, 500), Math.max(0, Math.min(1, confidence))],
    );
  } catch (e: any) {
    console.warn(`[StructuredMemory] setSystemFact failed:`, e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// COMPOSED: build 3-layer structured memory for AI prompt
// ─────────────────────────────────────────────────────────────────────────

export async function buildStructuredMemory(
  agentId: number,
  userId?: number,
): Promise<StructuredMemory> {
  const [shortTerm, userFacts, systemFacts] = await Promise.all([
    getShortTerm(agentId),
    userId ? getUserFacts(agentId, userId) : Promise.resolve([]),
    getSystemFacts(agentId),
  ]);
  return { shortTerm, userFacts, systemFacts };
}

/** Format structured memory as a clean markdown block for the system prompt. */
export function formatStructuredMemoryForPrompt(sm: StructuredMemory): string {
  const parts: string[] = [];

  if (sm.shortTerm.length > 0) {
    const now = Date.now();
    const formatted = sm.shortTerm.map(e => {
      const ts = Date.parse(e.timestamp);
      const ageSec = Math.floor((now - ts) / 1000);
      const age = ageSec < 60 ? `${ageSec}s ago`
        : ageSec < 3600 ? `${Math.floor(ageSec/60)}m ago`
        : `${Math.floor(ageSec/3600)}h ago`;
      return `  • [${age}] ${e.action}${e.result ? ' → ' + e.result : ''}`;
    }).join('\n');
    parts.push(`🕐 SHORT-TERM (current session):\n${formatted}`);
  }

  if (sm.userFacts.length > 0) {
    const formatted = sm.userFacts
      .sort((a, b) => (b.importance === 'high' ? 1 : 0) - (a.importance === 'high' ? 1 : 0))
      .map(f => `  • ${f.key}: ${f.value}${f.importance === 'high' ? ' ⭐' : ''}`)
      .join('\n');
    parts.push(`👤 USER FACTS (stable about this user):\n${formatted}`);
  }

  if (sm.systemFacts.length > 0) {
    const formatted = sm.systemFacts
      .filter(f => (f.confidence ?? 0.8) >= 0.5)  // drop low-confidence
      .map(f => `  • ${f.key}: ${f.value}`)
      .join('\n');
    if (formatted) parts.push(`🧠 SYSTEM FACTS (learned about the world):\n${formatted}`);
  }

  if (parts.length === 0) return '';

  return `\n━━━━━━━━━━ MEMORY ━━━━━━━━━━\n${parts.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Use SHORT-TERM to avoid repeating what was just done. Use USER FACTS to personalize. ` +
    `Use SYSTEM FACTS to avoid known pitfalls. Never confuse a fact from one user with another.\n`;
}

// ─────────────────────────────────────────────────────────────────────────
// Auto-log helpers — called from ai-agent-runtime tool dispatch
// ─────────────────────────────────────────────────────────────────────────

/** Called after each successful tool call to append to short-term. */
export async function logToolCall(
  agentId: number,
  toolName: string,
  args?: any,
  result?: any,
): Promise<void> {
  try {
    const argStr = args ? JSON.stringify(args).slice(0, 100) : '';
    const resStr = result ? JSON.stringify(result).slice(0, 100) : '';
    await logShortTerm(agentId, {
      timestamp: new Date().toISOString(),
      action: `${toolName}(${argStr})`,
      result: resStr || undefined,
    });
  } catch {}
}
