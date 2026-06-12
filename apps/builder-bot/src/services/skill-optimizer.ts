/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SKILL OPTIMIZER — Microsoft SkillOpt-style auto-tuning for SKILL.md.
 *
 * Four-step loop per pass:
 *   1. ROLLOUT  — run the current skill on N synthetic queries via the platform
 *                 Atlas key (so we don't burn user money). Score each output.
 *   2. REFLECT  — cheap LLM reads the failures and proposes 1-5 bounded edits
 *                 (add/delete/replace operations capped at "edit budget").
 *   3. EDIT     — apply edits to a candidate body, save as a draft version row.
 *   4. GATE     — re-run rollout on the candidate. Accept ONLY if eval_score
 *                 > baseline_score by margin (default 5%). Otherwise mark
 *                 the version row accepted=false (negative training signal
 *                 for the next pass).
 *
 * The on-disk apps/builder-bot/src/skills/<name>/SKILL.md is v1 (baseline).
 * Optimizer never overwrites the file — it writes new rows to skill_versions,
 * and skill-registry reads the highest accepted version_num.
 *
 * COST: Platform Atlas key. ~$0.05-0.20 per pass depending on N rollouts and
 * model. Triggered manually by owner via /api/admin/skills/:name/optimize.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Pool } from 'pg';

export type EditOp =
  | { op: 'replace'; find: string; with: string }
  | { op: 'append'; text: string }
  | { op: 'delete'; find: string };

export interface RolloutResult {
  query: string;
  expected?: string;
  output: string;
  score: number;          // 0..1
  notes?: string;
}

export interface SkillVersion {
  id?: number;
  skill_name: string;
  version_num: number;
  body: string;
  parent_id?: number | null;
  eval_score?: number | null;
  baseline_score?: number | null;
  accepted?: boolean;
  diff_summary?: string;
  edit_ops?: EditOp[];
  rationale?: string;
  run_metadata?: Record<string, any>;
  created_at?: Date;
}

const MAX_EDITS_PER_PASS = 5;
const ACCEPT_MARGIN = 0.05;     // candidate must beat baseline by ≥5%

export class SkillOptimizer {
  constructor(private pool: Pool) {}

  /** Get the currently-active skill body (highest accepted version, or baseline). */
  async getActiveBody(skillName: string, baselineBody: string): Promise<{ body: string; version_num: number; id: number | null }> {
    const r = await this.pool.query<{ id: number; body: string; version_num: number }>(
      `SELECT id, body, version_num FROM builder_bot.skill_versions
       WHERE skill_name = $1 AND accepted = TRUE
       ORDER BY version_num DESC LIMIT 1`,
      [skillName],
    );
    if (r.rows[0]) return { body: r.rows[0].body, version_num: r.rows[0].version_num, id: r.rows[0].id };
    return { body: baselineBody, version_num: 0, id: null };
  }

  async saveDraft(v: SkillVersion): Promise<number> {
    const r = await this.pool.query<{ id: number }>(
      `INSERT INTO builder_bot.skill_versions
       (skill_name, version_num, body, parent_id, eval_score, baseline_score,
        accepted, diff_summary, edit_ops, rationale, run_metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        v.skill_name, v.version_num, v.body, v.parent_id || null,
        v.eval_score ?? null, v.baseline_score ?? null,
        !!v.accepted, v.diff_summary || null,
        JSON.stringify(v.edit_ops || []),
        v.rationale || null, v.run_metadata || {},
      ],
    );
    return r.rows[0].id;
  }

  async listVersions(skillName: string, limit = 20): Promise<SkillVersion[]> {
    const r = await this.pool.query<SkillVersion>(
      `SELECT id, skill_name, version_num, body, parent_id, eval_score, baseline_score,
              accepted, diff_summary, rationale, run_metadata, created_at
       FROM builder_bot.skill_versions
       WHERE skill_name = $1
       ORDER BY version_num DESC LIMIT $2`,
      [skillName, limit],
    );
    return r.rows;
  }

  /** Apply edit ops to a body string. Bounded — out-of-budget ops are skipped. */
  static applyEdits(body: string, ops: EditOp[]): { body: string; appliedCount: number; skipped: string[] } {
    let result = body;
    let applied = 0;
    const skipped: string[] = [];
    for (const op of ops.slice(0, MAX_EDITS_PER_PASS)) {
      try {
        if (op.op === 'replace') {
          if (!op.find || !result.includes(op.find)) { skipped.push('replace: find not found'); continue; }
          result = result.replace(op.find, op.with);
          applied++;
        } else if (op.op === 'append') {
          result = result.trimEnd() + '\n\n' + op.text.trim() + '\n';
          applied++;
        } else if (op.op === 'delete') {
          if (!op.find || !result.includes(op.find)) { skipped.push('delete: find not found'); continue; }
          result = result.replace(op.find, '');
          applied++;
        }
      } catch (e: any) { skipped.push((op.op || 'unknown') + ': ' + (e?.message || 'error')); }
    }
    return { body: result, appliedCount: applied, skipped };
  }

  /**
   * Rollout step — runs N synthetic queries through a tiny scoring LLM.
   * Returns array of RolloutResult + average score.
   * `runQueryAgainstSkill` is injected by the caller so the optimizer
   * doesn't need to know about LLM clients.
   */
  static async rollout(params: {
    skillName: string;
    skillBody: string;
    queries: Array<{ query: string; expected?: string }>;
    runQueryAgainstSkill: (skillBody: string, query: string) => Promise<string>;
    scoreOutput: (query: string, expected: string | undefined, output: string) => Promise<{ score: number; notes?: string }>;
  }): Promise<{ avgScore: number; results: RolloutResult[] }> {
    const results: RolloutResult[] = [];
    for (const q of params.queries) {
      try {
        const output = await params.runQueryAgainstSkill(params.skillBody, q.query);
        const { score, notes } = await params.scoreOutput(q.query, q.expected, output);
        results.push({ query: q.query, expected: q.expected, output, score: Math.max(0, Math.min(1, score)), notes });
      } catch (e: any) {
        results.push({ query: q.query, expected: q.expected, output: '', score: 0, notes: 'rollout error: ' + (e?.message || 'unknown') });
      }
    }
    const avg = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
    return { avgScore: avg, results };
  }

  /**
   * Reflect step — cheap LLM looks at failures and proposes edit ops.
   * Returns ops + rationale. Caller supplies the LLM via llmCall.
   */
  static async reflect(params: {
    skillName: string;
    skillBody: string;
    rollouts: RolloutResult[];
    llmCall: (prompt: string) => Promise<string>;
  }): Promise<{ ops: EditOp[]; rationale: string }> {
    const failures = params.rollouts.filter(r => r.score < 0.7);
    if (failures.length === 0) return { ops: [], rationale: 'No failures to learn from.' };

    const failBlock = failures.slice(0, 6).map((r, i) =>
      `${i + 1}. Query: ${r.query}\n   Expected: ${r.expected || '(not specified)'}\n   Got: ${(r.output || '').slice(0, 300)}\n   Score: ${r.score.toFixed(2)}${r.notes ? '\n   Notes: ' + r.notes : ''}`
    ).join('\n\n');

    const prompt =
      'You are SkillOpt — an optimizer for AI-agent SKILL.md documents.\n' +
      'Below is the current skill body, then a list of failures from rolling it out.\n' +
      'Propose 1-5 BOUNDED edit operations to fix the failures without breaking what already works.\n' +
      'Each op is one of:\n' +
      '  - replace: change an EXACT substring (provide the substring and the replacement)\n' +
      '  - append:  add a new section at the end\n' +
      '  - delete:  remove an EXACT substring\n\n' +
      'Rules:\n' +
      '• Stay focused on the failures. Do not refactor working sections.\n' +
      '• "find" strings must match the body EXACTLY (whitespace + capitalization).\n' +
      '• Total proposed edits must not exceed 5.\n' +
      '• Output strict JSON, no prose: {"ops": [...], "rationale": "<2-3 sentences>"}\n\n' +
      '=== CURRENT SKILL BODY ===\n' + params.skillBody.slice(0, 6000) + '\n\n' +
      '=== FAILURES ===\n' + failBlock;

    let raw = '';
    try { raw = await params.llmCall(prompt); } catch { return { ops: [], rationale: 'reflect LLM error' }; }
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { ops: [], rationale: 'no JSON in reflect output' };
    try {
      const parsed = JSON.parse(m[0]);
      const ops: EditOp[] = Array.isArray(parsed.ops) ? parsed.ops.slice(0, MAX_EDITS_PER_PASS).filter((o: any) => o && o.op) : [];
      return { ops, rationale: String(parsed.rationale || '').slice(0, 500) };
    } catch { return { ops: [], rationale: 'JSON parse failed' }; }
  }

  /** Gate decision — accept candidate iff beats baseline by ACCEPT_MARGIN. */
  static shouldAccept(baselineScore: number, candidateScore: number): boolean {
    return candidateScore > baselineScore + ACCEPT_MARGIN;
  }

  /** Build a short diff summary for the version row. */
  static diffSummary(ops: EditOp[]): string {
    return ops.map(o => {
      if (o.op === 'replace') return `~ replace "${(o.find || '').slice(0, 30)}…" → "${(o.with || '').slice(0, 30)}…"`;
      if (o.op === 'append')  return `+ append (${(o.text || '').slice(0, 40)}…)`;
      if (o.op === 'delete')  return `- delete "${(o.find || '').slice(0, 40)}…"`;
      return '?';
    }).join('\n');
  }
}
