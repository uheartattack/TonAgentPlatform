/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HYBRID MEMORY — vector + FTS + RRF fusion (teleton-agent / deer-flow pattern)
 *
 * Stores compressed semantic memory chunks per agent.
 *   • Vector retrieval: pluggable backend (see embedding-backends.ts).
 *     Default Gemini `text-embedding-004` (768d). Alternative ONNX
 *     `Xenova/all-MiniLM-L6-v2` (384d) for zero-API-cost / offline.
 *     Stored as JSONB array. Cosine similarity computed in JS (sufficient
 *     for ≲5K memories per agent — switch to pgvector later if needed).
 *   • Keyword retrieval: Postgres `tsvector` generated column + GIN index.
 *     Language='simple' so it works for Russian + English without dictionaries.
 *   • Hybrid: Reciprocal Rank Fusion (RRF) merges the two rankings.
 *
 * Agents use this via the `remember_hybrid` and `recall_hybrid` tools
 * (always-on in CORE_TOOLS). The runtime also auto-saves tick summaries
 * here when the auto-compression layer fires.
 *
 * If the configured backend has no key / model fails to load, falls back
 * gracefully to FTS-only retrieval (keyword match still works).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { embed } from './embedding-backends';

const RRF_K = 60;                       // standard RRF constant
const DEFAULT_TOP_K = 8;

/**
 * Cheap cosine similarity (JS).
 * Returns 0 on dim mismatch so memories embedded with a prior backend
 * don't pollute the new backend's results — they just degrade to FTS-only.
 */
function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export interface SavedMemory {
  id: number;
  importance: number;
  source: string | null;
}

export interface RetrievedMemory {
  id: number;
  content: string;
  source: string | null;
  importance: number;
  metadata: Record<string, any>;
  created_at: string;
  /** Hybrid fused score (0..1). */
  score: number;
  /** Where the score came from. */
  matched: 'vector' | 'keyword' | 'both';
}

/**
 * Save one memory chunk. Embedding generated automatically.
 */
export async function saveMemory(params: {
  agentId: number;
  content: string;
  source?: string;
  importance?: number;
  metadata?: Record<string, any>;
}): Promise<SavedMemory | null> {
  const content = String(params.content || '').trim();
  if (!content) return null;
  const importance = Math.max(0, Math.min(1, params.importance ?? 0.5));
  const source = params.source ? String(params.source).slice(0, 50) : null;
  const meta = params.metadata || {};

  const emb = await embed(content);
  try {
    const { pool } = await import('../db');
    const res = await pool.query(
      `INSERT INTO builder_bot.agent_memory_vec
         (agent_id, content, embedding, metadata, source, importance)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
       RETURNING id, importance, source`,
      [params.agentId, content, emb ? JSON.stringify(emb) : null, JSON.stringify(meta), source, importance],
    );
    const row = res.rows[0];
    return { id: row.id, importance: row.importance, source: row.source };
  } catch (e: any) {
    console.warn(`[HybridMemory] saveMemory db err: ${e?.message}`);
    return null;
  }
}

/**
 * Hybrid retrieval. Returns top-K memories ranked by RRF over vector + FTS.
 *
 * Vector branch (if embedding-API available):
 *   - Embed query, scan all memories for the agent, compute cosine sim,
 *     sort desc, take top 50.
 *   Keyword branch (always):
 *   - tsvector ts_rank against `plainto_tsquery(query)`, take top 50.
 *   RRF fusion:
 *   - For each memory, score = sum over branches of (1 / (k + rank)).
 *   - k = 60 (standard). Higher k flattens; lower k weights top hits more.
 */
export async function recallMemory(params: {
  agentId: number;
  query: string;
  topK?: number;
  minImportance?: number;
  /**
   * Optional chat scope. When provided, only memories whose
   * `metadata.chat_id` equals chatId — OR memories with no chat_id at all
   * (legacy / cross-chat globals) — are considered. Prevents cross-chat
   * context bleed when one agent serves multiple chats/users.
   */
  chatId?: number | string | null;
}): Promise<RetrievedMemory[]> {
  const q = String(params.query || '').trim();
  if (!q) return [];
  const topK = Math.min(50, Math.max(1, params.topK ?? DEFAULT_TOP_K));
  const minImp = params.minImportance ?? 0;

  // Normalize chatId → string (matches how JSON stores numeric chat ids
  // when read back via metadata->>'chat_id'). null/undefined disables the
  // filter so callers without chat context get global recall behavior.
  const chatScope: string | null = (() => {
    if (params.chatId == null) return null;
    try {
      const s = String(params.chatId).trim();
      return s ? s : null;
    } catch { return null; }
  })();

  const { pool } = await import('../db');

  // Keyword branch (always available — no API call)
  let ftsRows: any[] = [];
  try {
    const ftsRes = await pool.query(
      `SELECT id, content, source, importance, metadata, created_at,
              ts_rank(content_tsv, plainto_tsquery('simple', $2)) AS rank
         FROM builder_bot.agent_memory_vec
        WHERE agent_id = $1
          AND content_tsv @@ plainto_tsquery('simple', $2)
          AND importance >= $3
          AND ($4::text IS NULL
               OR metadata->>'chat_id' IS NULL
               OR metadata->>'chat_id' = $4)
        ORDER BY rank DESC
        LIMIT 50`,
      [params.agentId, q, minImp, chatScope],
    );
    ftsRows = ftsRes.rows;
  } catch (e: any) {
    console.warn(`[HybridMemory] FTS query failed: ${e?.message}`);
  }

  // Vector branch (if API key available)
  let vecRows: any[] = [];
  const qEmb = await embed(q);
  if (qEmb) {
    try {
      // Pull ALL memories with non-null embedding for this agent.
      // Cost: O(N) but N ~ hundreds, fine.
      const all = await pool.query(
        `SELECT id, content, source, importance, metadata, created_at, embedding
           FROM builder_bot.agent_memory_vec
          WHERE agent_id = $1 AND embedding IS NOT NULL AND importance >= $2
            AND ($3::text IS NULL
                 OR metadata->>'chat_id' IS NULL
                 OR metadata->>'chat_id' = $3)`,
        [params.agentId, minImp, chatScope],
      );
      const scored = all.rows.map((r: any) => {
        let emb: number[] = [];
        try { emb = typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding; } catch {}
        return { ...r, _sim: cosineSim(qEmb, emb) };
      });
      scored.sort((a: any, b: any) => b._sim - a._sim);
      vecRows = scored.slice(0, 50);
    } catch (e: any) {
      console.warn(`[HybridMemory] vector branch failed: ${e?.message}`);
    }
  }

  // RRF fusion
  const scores = new Map<number, { row: any; score: number; in_fts: boolean; in_vec: boolean }>();
  ftsRows.forEach((row, i) => {
    const s = 1 / (RRF_K + i + 1);
    scores.set(row.id, { row, score: s, in_fts: true, in_vec: false });
  });
  vecRows.forEach((row, i) => {
    const s = 1 / (RRF_K + i + 1);
    const existing = scores.get(row.id);
    if (existing) {
      existing.score += s;
      existing.in_vec = true;
    } else {
      scores.set(row.id, { row, score: s, in_fts: false, in_vec: true });
    }
  });

  const merged = Array.from(scores.values());
  merged.sort((a, b) => b.score - a.score);

  return merged.slice(0, topK).map(m => {
    const matched: 'vector' | 'keyword' | 'both' =
      m.in_fts && m.in_vec ? 'both' : m.in_vec ? 'vector' : 'keyword';
    return {
      id: m.row.id,
      content: m.row.content,
      source: m.row.source,
      importance: m.row.importance,
      metadata: m.row.metadata || {},
      created_at: m.row.created_at,
      score: Math.min(1, m.score * 60),  // approx normalize
      matched,
    };
  });
}

/**
 * Delete one memory by id (only if it belongs to the agent).
 */
export async function deleteMemory(agentId: number, id: number): Promise<boolean> {
  try {
    const { pool } = await import('../db');
    const r = await pool.query(
      `DELETE FROM builder_bot.agent_memory_vec WHERE id = $1 AND agent_id = $2`,
      [id, agentId],
    );
    return (r.rowCount || 0) > 0;
  } catch { return false; }
}

/**
 * Count memories per agent (cheap stat for the agent state block).
 */
export async function countMemories(agentId: number): Promise<number> {
  try {
    const { pool } = await import('../db');
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM builder_bot.agent_memory_vec WHERE agent_id = $1`,
      [agentId],
    );
    return r.rows[0]?.n || 0;
  } catch { return 0; }
}

/**
 * Bulk save during tick auto-compression.
 * Returns count of successfully saved chunks.
 */
export async function bulkSaveSummaries(agentId: number, chunks: Array<{ content: string; source?: string; importance?: number }>): Promise<number> {
  let ok = 0;
  for (const c of chunks) {
    const r = await saveMemory({
      agentId,
      content: c.content,
      source: c.source || 'auto-compact',
      importance: c.importance ?? 0.4,
    });
    if (r) ok++;
  }
  return ok;
}
