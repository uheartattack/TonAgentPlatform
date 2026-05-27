/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LESSONS STORE — durable "what I learned" retention for agents.
 *
 * Two write paths:
 *   • Post-run extractor (extractLessonFromRun) — cheap LLM looks at the
 *     last N messages + tool calls and emits 0-3 lessons. Fires when an
 *     agent tick completes OR a user chat turns over.
 *   • Agent self-write — agent can call the `learn(topic, lesson, outcome)`
 *     tool to record what it found out.
 *
 * Retrieval (getRelevantLessons):
 *   Hybrid lexical (Postgres FTS) + recency + importance. Cheap, no
 *   embedding round-trip on hot path. If embeddings are present, we layer
 *   them on top via the existing hybrid-memory machinery.
 *
 * Pruning (pruneLessons):
 *   Drops the bottom-ranked rows when count > MAX_PER_AGENT.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

export type LessonOutcome = 'success' | 'failure' | 'mixed' | 'caution';

export interface AgentLesson {
  id?: number;
  agent_id: number;
  topic?: string | null;
  lesson: string;
  context?: string | null;
  outcome?: LessonOutcome;
  importance?: number;
  metadata?: Record<string, any>;
  created_at?: Date;
}

const MAX_PER_AGENT = 200;
const RETRIEVE_DEFAULT_LIMIT = 6;

export class LessonsStore {
  constructor(private pool: Pool) {}

  /** Insert a lesson. Returns the inserted id. */
  async save(l: AgentLesson): Promise<number> {
    const importance = Math.max(0, Math.min(1, l.importance ?? 0.5));
    const outcome: LessonOutcome = l.outcome ?? 'mixed';
    const res = await this.pool.query<{ id: number }>(
      `INSERT INTO builder_bot.agent_lessons
       (agent_id, topic, lesson, context, outcome, importance, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [l.agent_id, l.topic || null, l.lesson, l.context || null, outcome, importance, l.metadata || {}],
    );
    // Lazy-prune when we cross the cap
    this.prune(l.agent_id).catch(() => {});
    return res.rows[0].id;
  }

  /** Retrieve up to `limit` lessons relevant to a query string. */
  async getRelevant(agentId: number, query?: string, limit = RETRIEVE_DEFAULT_LIMIT): Promise<AgentLesson[]> {
    if (!query || !query.trim()) {
      const r = await this.pool.query<AgentLesson>(
        `SELECT id, agent_id, topic, lesson, context, outcome, importance, metadata, created_at
         FROM builder_bot.agent_lessons
         WHERE agent_id = $1
         ORDER BY importance DESC, created_at DESC
         LIMIT $2`,
        [agentId, limit],
      );
      return r.rows;
    }
    // Postgres FTS with importance + recency boost
    const r = await this.pool.query<AgentLesson>(
      `SELECT id, agent_id, topic, lesson, context, outcome, importance, metadata, created_at,
              ts_rank(content_tsv, plainto_tsquery('simple', $2)) AS rank
       FROM builder_bot.agent_lessons
       WHERE agent_id = $1
         AND content_tsv @@ plainto_tsquery('simple', $2)
       ORDER BY (
         ts_rank(content_tsv, plainto_tsquery('simple', $2)) * 1.5 +
         importance * 0.8 +
         EXP(-EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0 / 14.0) * 0.4
       ) DESC
       LIMIT $3`,
      [agentId, query, limit],
    );
    if (r.rows.length > 0) {
      // Bump usage_count async; don't block retrieval
      const ids = r.rows.map(x => x.id).filter(Boolean);
      if (ids.length) {
        this.pool.query(
          `UPDATE builder_bot.agent_lessons
           SET usage_count = usage_count + 1, last_used_at = NOW()
           WHERE id = ANY($1::int[])`,
          [ids],
        ).catch(() => {});
      }
    }
    return r.rows;
  }

  async listByAgent(agentId: number, limit = 50, offset = 0): Promise<AgentLesson[]> {
    const r = await this.pool.query<AgentLesson>(
      `SELECT id, agent_id, topic, lesson, context, outcome, importance, metadata, created_at
       FROM builder_bot.agent_lessons
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset],
    );
    return r.rows;
  }

  async delete(agentId: number, lessonId: number): Promise<boolean> {
    const r = await this.pool.query(
      `DELETE FROM builder_bot.agent_lessons WHERE id = $1 AND agent_id = $2`,
      [lessonId, agentId],
    );
    return (r.rowCount || 0) > 0;
  }

  async prune(agentId: number): Promise<number> {
    const r = await this.pool.query(
      `DELETE FROM builder_bot.agent_lessons
       WHERE id IN (
         SELECT id FROM builder_bot.agent_lessons
         WHERE agent_id = $1
         ORDER BY (importance + (usage_count * 0.05)) DESC, created_at DESC
         OFFSET $2
       )`,
      [agentId, MAX_PER_AGENT],
    );
    return r.rowCount || 0;
  }

  /**
   * Post-run lesson extractor — calls a cheap LLM to derive lessons from
   * the recent run trace. Caller passes:
   *   - last N user/agent messages
   *   - tool call outcomes (which succeeded, which errored)
   *   - any user-facing reply
   *
   * Returns array of lessons (may be empty if nothing notable happened).
   */
  static async extractFromRun(params: {
    trace: string;                       // pre-stringified short trace
    topic?: string;                      // optional hint (e.g. "swap", "jetton-deploy")
    llmCall: (prompt: string) => Promise<string>;  // injected — caller controls model/cost
  }): Promise<Array<{ topic: string; lesson: string; outcome: LessonOutcome; importance: number }>> {
    const prompt =
      'You are a lesson extractor for an AI agent. From the run trace below, ' +
      'output 0-3 concrete, durable lessons the agent should remember next time. ' +
      'Skip the obvious. Skip the verbose. Keep each lesson <=180 chars.\n\n' +
      'OUTPUT FORMAT — strict JSON array, no prose:\n' +
      '[{"topic": "<2-3 word slug>", "lesson": "...", "outcome": "success|failure|mixed|caution", "importance": 0..1}]\n\n' +
      'If nothing notable: return []\n\n' +
      'TRACE:\n' + params.trace.slice(0, 4000) +
      (params.topic ? '\n\nTOPIC HINT: ' + params.topic : '');

    let raw: string;
    try { raw = await params.llmCall(prompt); } catch { return []; }
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x: any) => x && typeof x.lesson === 'string' && x.lesson.trim().length > 0)
        .slice(0, 3)
        .map((x: any) => ({
          topic: String(x.topic || '').slice(0, 80),
          lesson: String(x.lesson).slice(0, 500),
          outcome: ['success','failure','mixed','caution'].includes(x.outcome) ? x.outcome : 'mixed',
          importance: Math.max(0, Math.min(1, Number(x.importance) || 0.5)),
        }));
    } catch { return []; }
  }
}
