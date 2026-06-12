/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STRATEGY ENGINE — high-level playbooks Atlas (or the user) writes for an
 * agent. A strategy is a NAMED, ORDERED set of steps for a class of tasks.
 * Lessons feed strategies: when 3+ lessons cluster around a topic, Atlas
 * is asked to draft a strategy.
 *
 * Lifecycle:
 *   draft → active → (success_count++ / fail_count++) → maybe deactivated
 *
 * Injection: active strategies are summarized (title + first 2 steps) and
 * dropped into the agent system prompt under "Your playbooks:".
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';
import { AgentLesson } from './lessons-store';

export interface AgentStrategy {
  id?: number;
  agent_id: number;
  title: string;
  scenario?: string | null;
  playbook: string;
  active?: boolean;
  source?: string;
  success_count?: number;
  fail_count?: number;
  metadata?: Record<string, any>;
  created_at?: Date;
}

const MAX_PER_AGENT = 30;

export class StrategyEngine {
  constructor(private pool: Pool) {}

  async save(s: AgentStrategy): Promise<number> {
    const res = await this.pool.query<{ id: number }>(
      `INSERT INTO builder_bot.agent_strategies
       (agent_id, title, scenario, playbook, active, source, metadata)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), COALESCE($6, 'atlas'), $7)
       RETURNING id`,
      [s.agent_id, s.title.slice(0, 180), s.scenario || null, s.playbook, s.active ?? true, s.source || 'atlas', s.metadata || {}],
    );
    return res.rows[0].id;
  }

  async listActive(agentId: number): Promise<AgentStrategy[]> {
    const r = await this.pool.query<AgentStrategy>(
      `SELECT id, agent_id, title, scenario, playbook, active, source,
              success_count, fail_count, metadata, created_at
       FROM builder_bot.agent_strategies
       WHERE agent_id = $1 AND active = TRUE
       ORDER BY (success_count - fail_count) DESC, updated_at DESC
       LIMIT 10`,
      [agentId],
    );
    return r.rows;
  }

  async listAll(agentId: number, limit = 30): Promise<AgentStrategy[]> {
    const r = await this.pool.query<AgentStrategy>(
      `SELECT id, agent_id, title, scenario, playbook, active, source,
              success_count, fail_count, metadata, created_at
       FROM builder_bot.agent_strategies
       WHERE agent_id = $1
       ORDER BY active DESC, updated_at DESC
       LIMIT $2`,
      [agentId, limit],
    );
    return r.rows;
  }

  async toggleActive(agentId: number, strategyId: number, active: boolean): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE builder_bot.agent_strategies
       SET active = $3, updated_at = NOW()
       WHERE id = $1 AND agent_id = $2`,
      [strategyId, agentId, active],
    );
    return (r.rowCount || 0) > 0;
  }

  async recordOutcome(strategyId: number, success: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE builder_bot.agent_strategies
       SET ${success ? 'success_count' : 'fail_count'} = ${success ? 'success_count' : 'fail_count'} + 1,
           last_used_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [strategyId],
    );
  }

  async delete(agentId: number, strategyId: number): Promise<boolean> {
    const r = await this.pool.query(
      `DELETE FROM builder_bot.agent_strategies WHERE id = $1 AND agent_id = $2`,
      [strategyId, agentId],
    );
    return (r.rowCount || 0) > 0;
  }

  /**
   * Atlas generates a strategy by analyzing recent lessons clustered around
   * a topic. Caller supplies the lessons + an LLM callback.
   */
  static async generateFromLessons(params: {
    agentId: number;
    lessons: AgentLesson[];
    agentName?: string;
    agentDescription?: string;
    llmCall: (prompt: string) => Promise<string>;
  }): Promise<AgentStrategy | null> {
    if (params.lessons.length < 3) return null;

    const lessonBlock = params.lessons
      .map((l, i) => `${i + 1}. [${l.topic || 'general'} · ${l.outcome}] ${l.lesson}`)
      .join('\n');

    const prompt =
      'You are Atlas, a strategy designer for the agent "' + (params.agentName || `Agent #${params.agentId}`) + '".\n' +
      (params.agentDescription ? 'Agent role: ' + params.agentDescription + '\n' : '') +
      'Based on these recent lessons, draft ONE concrete playbook for the agent to follow next time a similar situation comes up.\n\n' +
      'LESSONS:\n' + lessonBlock + '\n\n' +
      'OUTPUT — strict JSON, no prose:\n' +
      '{\n' +
      '  "title": "<short imperative, max 80 chars>",\n' +
      '  "scenario": "<when this strategy applies, max 200 chars>",\n' +
      '  "playbook": "<5-7 ordered steps, markdown bullet list>"\n' +
      '}\n\n' +
      'If no coherent strategy emerges from these lessons: return {"skip": true}';

    let raw: string;
    try { raw = await params.llmCall(prompt); } catch { return null; }
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[0]);
      if (parsed.skip) return null;
      if (!parsed.title || !parsed.playbook) return null;
      return {
        agent_id: params.agentId,
        title: String(parsed.title).slice(0, 180),
        scenario: parsed.scenario ? String(parsed.scenario).slice(0, 500) : null,
        playbook: String(parsed.playbook).slice(0, 2000),
        source: 'atlas',
        active: true,
      };
    } catch { return null; }
  }

  /**
   * Build the prompt block injected into agent system prompt at run time.
   * Compact form: title + 1-line scenario per active strategy.
   */
  async buildPromptBlock(agentId: number): Promise<string> {
    const strategies = await this.listActive(agentId);
    if (strategies.length === 0) return '';
    const lines = strategies.slice(0, 6).map(s => {
      var head = '• **' + s.title + '**';
      if (s.scenario) head += ' — _' + s.scenario.split('\n')[0].slice(0, 120) + '_';
      return head;
    });
    return '## Your playbooks (apply when scenario matches):\n' + lines.join('\n');
  }
}
