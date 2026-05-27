/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MEMORY CLEANUP — nightly maintenance across all per-agent memory tables.
 *
 * Targets:
 *   • agent_memory_vec  — hybrid RAG store (FTS + JSONB embeddings)
 *   • agent_lessons     — durable lesson retention
 *   • agent_strategies  — playbooks (only drops orphans)
 *   • agent_contacts    — peers / users an agent has interacted with
 *   • agent_mailbox     — inter-agent messages
 *   • agent_transcripts — auto-summarized run transcripts
 *
 * Per-agent caps + rules:
 *   – agent_memory_vec: cap 5000 rows per agent, drop bottom by
 *     (importance × recency). Plus cosine-dedup pass on top 200 by
 *     created_at — entries with sim > 0.95 to a newer row are merged
 *     (sum importance, keep the newer one).
 *   – agent_lessons:   cap 200 per agent (already done in LessonsStore.prune).
 *     This pass also drops lessons with 0 usage_count older than 60 days.
 *   – agent_contacts:  drop contacts with no activity in 180 days.
 *   – agent_mailbox:   drop read messages older than 30 days.
 *   – agent_transcripts: drop transcripts older than 90 days.
 *
 * Cron: runs nightly at 03:30 UTC via startMemoryCleanupCron().
 * Manual trigger: POST /api/admin/memory-cleanup/run (owner-only).
 *
 * COST: zero — no LLM calls, just SQL.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

export interface CleanupStats {
  agent_memory_vec: { pruned: number; deduped: number };
  agent_lessons:    { pruned: number };
  agent_contacts:   { pruned: number };
  agent_mailbox:    { pruned: number };
  agent_transcripts:{ pruned: number };
  duration_ms:      number;
}

const VEC_PER_AGENT_CAP = 5000;
const LESSONS_PER_AGENT_CAP = 200;
const LESSONS_UNUSED_MAX_AGE_DAYS = 60;
const CONTACT_IDLE_MAX_DAYS = 180;
const MAILBOX_READ_MAX_AGE_DAYS = 30;
const TRANSCRIPT_MAX_AGE_DAYS = 90;
const DEDUP_SIM_THRESHOLD = 0.95;

export class MemoryCleanup {
  constructor(private pool: Pool) {}

  /** Single full pass across all tables. Idempotent — safe to run multiple times. */
  async runFullPass(): Promise<CleanupStats> {
    const t0 = Date.now();
    const stats: CleanupStats = {
      agent_memory_vec: { pruned: 0, deduped: 0 },
      agent_lessons:    { pruned: 0 },
      agent_contacts:   { pruned: 0 },
      agent_mailbox:    { pruned: 0 },
      agent_transcripts:{ pruned: 0 },
      duration_ms:      0,
    };

    // ── 1. agent_memory_vec — cap + dedup ─────────────────────────────────
    try {
      const cap = await this.pool.query(
        `WITH ranked AS (
           SELECT id, agent_id,
                  ROW_NUMBER() OVER (
                    PARTITION BY agent_id
                    ORDER BY (importance + (1.0 - LEAST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0 / 30.0, 1.0)) * 0.5) DESC,
                             created_at DESC
                  ) AS rk
           FROM builder_bot.agent_memory_vec
         )
         DELETE FROM builder_bot.agent_memory_vec
         WHERE id IN (SELECT id FROM ranked WHERE rk > $1)`,
        [VEC_PER_AGENT_CAP],
      );
      stats.agent_memory_vec.pruned = cap.rowCount || 0;

      // Cosine-dedup pass — JS-side because embeddings are JSONB
      stats.agent_memory_vec.deduped = await this._dedupMemoryVec();
    } catch (e: any) { console.warn('[Cleanup] vec:', e?.message); }

    // ── 2. agent_lessons — cap + drop unused-old ──────────────────────────
    try {
      const rCap = await this.pool.query(
        `WITH ranked AS (
           SELECT id, ROW_NUMBER() OVER (
             PARTITION BY agent_id
             ORDER BY (importance + usage_count * 0.05) DESC, created_at DESC
           ) AS rk
           FROM builder_bot.agent_lessons
         )
         DELETE FROM builder_bot.agent_lessons
         WHERE id IN (SELECT id FROM ranked WHERE rk > $1)`,
        [LESSONS_PER_AGENT_CAP],
      );
      stats.agent_lessons.pruned += rCap.rowCount || 0;

      const rUnused = await this.pool.query(
        `DELETE FROM builder_bot.agent_lessons
         WHERE usage_count = 0
           AND created_at < NOW() - ($1 || ' days')::interval
           AND importance < 0.6`,
        [LESSONS_UNUSED_MAX_AGE_DAYS],
      );
      stats.agent_lessons.pruned += rUnused.rowCount || 0;
    } catch (e: any) { console.warn('[Cleanup] lessons:', e?.message); }

    // ── 3. agent_contacts — drop idle ─────────────────────────────────────
    try {
      const r = await this.pool.query(
        `DELETE FROM builder_bot.agent_contacts
         WHERE last_seen_at < NOW() - ($1 || ' days')::interval
            OR (last_seen_at IS NULL AND created_at < NOW() - ($1 || ' days')::interval)`,
        [CONTACT_IDLE_MAX_DAYS],
      );
      stats.agent_contacts.pruned = r.rowCount || 0;
    } catch (e: any) { /* table may not have last_seen_at — ignore */ }

    // ── 4. agent_mailbox — drop read+old ──────────────────────────────────
    try {
      const r = await this.pool.query(
        `DELETE FROM builder_bot.agent_mailbox
         WHERE read_at IS NOT NULL
           AND read_at < NOW() - ($1 || ' days')::interval`,
        [MAILBOX_READ_MAX_AGE_DAYS],
      );
      stats.agent_mailbox.pruned = r.rowCount || 0;
    } catch (e: any) { console.warn('[Cleanup] mailbox:', e?.message); }

    // ── 5. agent_transcripts — drop old ───────────────────────────────────
    try {
      const r = await this.pool.query(
        `DELETE FROM builder_bot.agent_transcripts
         WHERE created_at < NOW() - ($1 || ' days')::interval`,
        [TRANSCRIPT_MAX_AGE_DAYS],
      );
      stats.agent_transcripts.pruned = r.rowCount || 0;
    } catch (e: any) { console.warn('[Cleanup] transcripts:', e?.message); }

    stats.duration_ms = Date.now() - t0;

    // Persist audit row
    try {
      await this.pool.query(
        `INSERT INTO builder_bot.memory_cleanup_log (kind, stats) VALUES ('full-pass', $1)`,
        [stats],
      );
    } catch {}

    return stats;
  }

  /**
   * Cosine-dedup the most-recent slice of agent_memory_vec per agent.
   * We only check the top 200 by recency per agent to keep this cheap.
   * Threshold: sim > 0.95 → merge (sum importance into newer row, drop older).
   */
  private async _dedupMemoryVec(): Promise<number> {
    let merged = 0;
    try {
      // Get distinct agents
      const agentsRes = await this.pool.query<{ agent_id: number }>(
        `SELECT DISTINCT agent_id FROM builder_bot.agent_memory_vec
         WHERE embedding IS NOT NULL`,
      );
      for (const { agent_id } of agentsRes.rows) {
        const r = await this.pool.query<{ id: number; embedding: any; importance: number }>(
          `SELECT id, embedding, importance
           FROM builder_bot.agent_memory_vec
           WHERE agent_id = $1 AND embedding IS NOT NULL
           ORDER BY created_at DESC LIMIT 200`,
          [agent_id],
        );
        const rows = r.rows;
        const dropIds: number[] = [];
        const importanceBumps = new Map<number, number>();
        for (let i = 0; i < rows.length; i++) {
          if (dropIds.includes(rows[i].id)) continue;
          const eA = rows[i].embedding;
          if (!Array.isArray(eA)) continue;
          for (let j = i + 1; j < rows.length; j++) {
            if (dropIds.includes(rows[j].id)) continue;
            const eB = rows[j].embedding;
            if (!Array.isArray(eB) || eA.length !== eB.length) continue;
            if (cosine(eA, eB) > DEDUP_SIM_THRESHOLD) {
              // Drop the OLDER one (j is older because we ordered DESC)
              dropIds.push(rows[j].id);
              importanceBumps.set(rows[i].id, (importanceBumps.get(rows[i].id) || rows[i].importance || 0.5) + 0.05);
            }
          }
        }
        if (dropIds.length > 0) {
          await this.pool.query(
            `DELETE FROM builder_bot.agent_memory_vec WHERE id = ANY($1::int[])`,
            [dropIds],
          );
          merged += dropIds.length;
        }
        for (const [id, newImp] of importanceBumps) {
          await this.pool.query(
            `UPDATE builder_bot.agent_memory_vec SET importance = LEAST($2, 1.0) WHERE id = $1`,
            [id, newImp],
          );
        }
      }
    } catch (e: any) { console.warn('[Cleanup] dedup:', e?.message); }
    return merged;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ── SkillOpt auto-replay — re-run rejected drafts after 14 days ────────────
// Models drift, skills evolve, providers update — an edit that lost the gate
// today might win in 2 weeks. Picks the OLDEST rejected version per skill
// older than 14 days that hasn't been replayed, fires its parent skill into
// the optimize endpoint via internal HTTP (so it goes through the normal
// flow including auto-gen-queries).
async function _autoReplayRejected(pool: Pool): Promise<{ replayed: number; skipped: number }> {
  let replayed = 0, skipped = 0;
  try {
    const r = await pool.query<{ skill_name: string; id: number }>(
      `SELECT DISTINCT ON (skill_name) skill_name, id
       FROM builder_bot.skill_versions
       WHERE accepted = FALSE
         AND created_at < NOW() - INTERVAL '14 days'
         AND (run_metadata->>'replayed_at') IS NULL
       ORDER BY skill_name, created_at ASC
       LIMIT 3`,
    );
    for (const row of r.rows) {
      try {
        // Mark as replayed BEFORE the call to prevent thundering retries on failure
        await pool.query(
          `UPDATE builder_bot.skill_versions
           SET run_metadata = run_metadata || jsonb_build_object('replayed_at', NOW()::text)
           WHERE id = $1`,
          [row.id],
        );
        // Don't actually call the optimize endpoint here — too costly without
        // user awareness. Just enqueue: cron logs the candidate, owner sees in
        // memory_cleanup_log and can hit "Optimize" manually.
        await pool.query(
          `INSERT INTO builder_bot.memory_cleanup_log (kind, stats) VALUES ('skillopt-replay-candidate', $1)`,
          [{ skill_name: row.skill_name, version_id: row.id }],
        );
        replayed++;
      } catch (e: any) { skipped++; console.warn('[SkillOpt replay]', e?.message); }
    }
  } catch (e: any) { console.warn('[SkillOpt replay scan]', e?.message); }
  return { replayed, skipped };
}

// ── Cron hook ──────────────────────────────────────────────────────────────
let _cleanupTimer: NodeJS.Timeout | null = null;
export function startMemoryCleanupCron(pool: Pool): void {
  if (_cleanupTimer) return;
  const DAILY_MS = 24 * 60 * 60 * 1000;
  const passFn = async () => {
    const cleanup = await new MemoryCleanup(pool).runFullPass();
    const replay = await _autoReplayRejected(pool);
    console.log('[MemoryCleanup] pass:', JSON.stringify({ cleanup, replay }));
  };
  setTimeout(() => { passFn().catch(e => console.warn('[MemoryCleanup] startup:', e?.message)); }, 5 * 60 * 1000);
  _cleanupTimer = setInterval(() => { passFn().catch(e => console.warn('[MemoryCleanup] daily:', e?.message)); }, DAILY_MS);
}
