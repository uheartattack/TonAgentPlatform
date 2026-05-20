/**
 * crew-system.ts — Multi-agent crew orchestration v2.
 *
 * Capabilities:
 *   - Sequential / Parallel / Conditional / Manager flows
 *   - Nested crews: a "member" of a crew can be another crew (sub-network)
 *   - Roles drive behavior via ROLE_PROFILES system-prompt injection
 *   - Manager flow: a manager LLM agent reads the roster + jobDescriptions and
 *     decides on each round which subordinate gets which subtask
 *   - Shared memory (in-memory, per-crew, with namespaces)
 *   - DB persistence (crews + crew_executions)
 *   - Cycle/depth protection for nested crews
 */

import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { ROLE_PROFILES } from '../agents/role-profiles';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Roles supported in crews. Aligned with role-profiles.ts. */
export type CrewAgentRole =
  | 'manager' | 'director' | 'specialist' | 'worker'
  | 'monitor' | 'creative' | 'trader' | 'admin'
  // Legacy aliases — accepted for back-compat
  | 'researcher' | 'executor' | 'validator';

const ROLE_ALIASES: Record<string, string> = {
  researcher: 'specialist',
  executor: 'worker',
  validator: 'monitor',
};

export type FlowType = 'sequential' | 'parallel' | 'conditional' | 'manager';

export interface FlowCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists';
  value?: any;
  thenAgent: number;
  elseAgent: number;
}

export interface FlowConfig {
  type: FlowType;
  /** Conditional only */
  conditions?: FlowCondition[];
  /** Manager flow only — index in agents[] that plays the manager. Default 0. */
  managerIndex?: number;
  /** Manager flow only — max delegation rounds. Default 4. */
  maxRounds?: number;
}

export interface CrewMember {
  /** Reference to a platform agent. Either this OR nestedCrewId must be set. */
  agentId?: number;
  /** Reference to another crew used as a sub-network. */
  nestedCrewId?: string;
  role: CrewAgentRole;
  /** Human label shown in logs and to the manager during delegation */
  label?: string;
  /** What this member is good at — used by manager to choose. */
  jobDescription?: string;
}

/** Back-compat alias for the previous API */
export type CrewAgent = CrewMember;

export interface CrewDefinition {
  id: string;
  userId: number;
  name: string;
  description?: string;
  agents: CrewMember[];
  flow: FlowConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrewExecution {
  id: string;
  crewId: string;
  userId: number;
  input: any;
  output: any;
  status: 'running' | 'completed' | 'failed';
  stepResults: Record<string, any>;
  error?: string;
  startedAt: Date;
  finishedAt: Date | null;
}

/** Options the engine passes when invoking a single agent */
export interface RunAgentOptions {
  /** Crew-level role (drives prompt injection). */
  role: CrewAgentRole;
  /** Optional label, e.g. "lead researcher". */
  label?: string;
  /** What this agent is responsible for in the crew. */
  jobDescription?: string;
  /** Specific subtask from the manager (or step). */
  subtask?: string;
  /** Crew metadata (id, name, step index, etc.). */
  crewContext: Record<string, any>;
  /** Userspace context (e.g., user_id for state access). */
  userId: number;
}

/** Caller-provided agent invocation function */
export type RunAgentFn = (
  agentId: number,
  input: any,
  opts: RunAgentOptions,
) => Promise<any>;

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) throw new Error('[CrewSystem] Not initialised — call initCrewSystem(pool) first');
  return _pool;
}

// Shared memory (in-memory, per-crew, namespace support)
const MAX_KEYS_PER_NS = 100;
const MAX_CREWS = 500;
const MAX_NAMESPACES_PER_CREW = 50;
const MAX_VALUE_SIZE = 10 * 1024;
const sharedMem = new Map<string, Map<string, Map<string, any>>>();

function nsMap(crewId: string, namespace: string): Map<string, any> {
  if (!sharedMem.has(crewId)) {
    if (sharedMem.size >= MAX_CREWS) {
      const oldest = sharedMem.keys().next().value;
      if (oldest !== undefined) sharedMem.delete(oldest);
    }
    sharedMem.set(crewId, new Map());
  }
  const crew = sharedMem.get(crewId)!;
  if (!crew.has(namespace)) {
    if (crew.size >= MAX_NAMESPACES_PER_CREW) {
      const oldest = crew.keys().next().value;
      if (oldest !== undefined) crew.delete(oldest);
    }
    crew.set(namespace, new Map());
  }
  return crew.get(namespace)!;
}

export function getSharedMemory(crewId: string, namespace: string, key: string): any {
  return nsMap(crewId, namespace).get(key) ?? null;
}

export function setSharedMemory(crewId: string, namespace: string, key: string, value: any): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (serialized && serialized.length > MAX_VALUE_SIZE) {
    throw new Error(`Shared memory value too large (${serialized.length} bytes, max ${MAX_VALUE_SIZE})`);
  }
  const ns = nsMap(crewId, namespace);
  if (!ns.has(key) && ns.size >= MAX_KEYS_PER_NS) {
    const oldest = ns.keys().next().value;
    if (oldest !== undefined) ns.delete(oldest);
  }
  ns.set(key, value);
}

export function clearSharedMemory(crewId: string): void {
  sharedMem.delete(crewId);
}

// ═══════════════════════════════════════════════════════════════════════════
// DB INIT
// ═══════════════════════════════════════════════════════════════════════════

export async function initCrewSystem(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.crews (
      id          TEXT PRIMARY KEY,
      user_id     BIGINT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      agents      JSONB NOT NULL DEFAULT '[]',
      flow        JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.crew_executions (
      id            TEXT PRIMARY KEY,
      crew_id       TEXT NOT NULL REFERENCES builder_bot.crews(id) ON DELETE CASCADE,
      user_id       BIGINT NOT NULL,
      input         JSONB,
      output        JSONB,
      status        TEXT NOT NULL DEFAULT 'running',
      step_results  JSONB NOT NULL DEFAULT '{}',
      error         TEXT,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at   TIMESTAMPTZ
    );
  `);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_crews_user ON builder_bot.crews (user_id);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_crew_exec_crew ON builder_bot.crew_executions (crew_id);`);
  console.log('[CrewSystem] Tables ready');
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

function validateMembers(agents: CrewMember[]): void {
  if (!Array.isArray(agents) || agents.length < 1 || agents.length > 20) {
    throw new Error('Crew must have 1-20 members');
  }
  for (const a of agents) {
    const hasAgent = a.agentId !== undefined && a.agentId !== null;
    const hasNested = !!a.nestedCrewId;
    if (hasAgent === hasNested) {
      throw new Error('Each member must have exactly one of agentId or nestedCrewId');
    }
  }
}

export async function createCrew(def: {
  userId: number;
  name: string;
  description?: string;
  agents: CrewMember[];
  flow: FlowConfig;
}): Promise<string> {
  validateMembers(def.agents);
  const id = randomUUID();
  await pool().query(
    `INSERT INTO builder_bot.crews (id, user_id, name, description, agents, flow)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, def.userId, def.name, def.description ?? null, JSON.stringify(def.agents), JSON.stringify(def.flow)],
  );
  return id;
}

export async function getCrew(crewId: string, userId: number): Promise<CrewDefinition | null> {
  const res = await pool().query(
    `SELECT * FROM builder_bot.crews WHERE id = $1 AND user_id = $2`,
    [crewId, userId],
  );
  return res.rows[0] ? rowToCrew(res.rows[0]) : null;
}

/**
 * Get crew for nested traversal. SECURITY: still scopes by ownerUserId so a
 * crew can't reference another user's crew via nestedCrewId (cross-tenant
 * leak). The owner is the user who triggered the root execution.
 */
async function getCrewForNested(crewId: string, ownerUserId: number): Promise<CrewDefinition | null> {
  const res = await pool().query(
    `SELECT * FROM builder_bot.crews WHERE id = $1 AND user_id = $2`,
    [crewId, ownerUserId],
  );
  return res.rows[0] ? rowToCrew(res.rows[0]) : null;
}

export async function listCrews(userId: number): Promise<CrewDefinition[]> {
  const res = await pool().query(
    `SELECT * FROM builder_bot.crews WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows.map(rowToCrew);
}

export async function deleteCrew(crewId: string, userId: number): Promise<boolean> {
  const res = await pool().query(
    `DELETE FROM builder_bot.crews WHERE id = $1 AND user_id = $2`,
    [crewId, userId],
  );
  if (res.rowCount && res.rowCount > 0) {
    clearSharedMemory(crewId);
    return true;
  }
  return false;
}

export async function updateCrew(
  crewId: string,
  userId: number,
  patch: Partial<Pick<CrewDefinition, 'name' | 'description' | 'agents' | 'flow'>>,
): Promise<boolean> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (patch.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(patch.name); }
  if (patch.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(patch.description); }
  if (patch.agents !== undefined) {
    validateMembers(patch.agents);
    sets.push(`agents = $${idx++}`); vals.push(JSON.stringify(patch.agents));
  }
  if (patch.flow !== undefined) { sets.push(`flow = $${idx++}`); vals.push(JSON.stringify(patch.flow)); }
  if (sets.length === 0) return false;
  sets.push(`updated_at = NOW()`);
  vals.push(crewId, userId);
  const res = await pool().query(
    `UPDATE builder_bot.crews SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx}`,
    vals,
  );
  return !!(res.rowCount && res.rowCount > 0);
}

function rowToCrew(r: any): CrewDefinition {
  return {
    id: r.id,
    userId: Number(r.user_id),
    name: r.name,
    description: r.description,
    agents: typeof r.agents === 'string' ? JSON.parse(r.agents) : r.agents,
    flow: typeof r.flow === 'string' ? JSON.parse(r.flow) : r.flow,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

export async function getCrewExecutions(crewId: string, limit: number = 20): Promise<CrewExecution[]> {
  const res = await pool().query(
    `SELECT * FROM builder_bot.crew_executions WHERE crew_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [crewId, limit],
  );
  return res.rows.map(rowToExec);
}

function rowToExec(r: any): CrewExecution {
  return {
    id: r.id,
    crewId: r.crew_id,
    userId: Number(r.user_id),
    input: r.input,
    output: r.output,
    status: r.status,
    stepResults: typeof r.step_results === 'string' ? JSON.parse(r.step_results) : r.step_results,
    error: r.error,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  };
}

async function insertExecution(exec: {
  id: string; crewId: string; userId: number; input: any;
}): Promise<void> {
  await pool().query(
    `INSERT INTO builder_bot.crew_executions (id, crew_id, user_id, input, status)
     VALUES ($1, $2, $3, $4, 'running')`,
    [exec.id, exec.crewId, exec.userId, JSON.stringify(exec.input)],
  );
}

async function finishExecution(
  execId: string,
  status: 'completed' | 'failed',
  output: any,
  stepResults: Record<string, any>,
  error?: string,
): Promise<void> {
  await pool().query(
    `UPDATE builder_bot.crew_executions
     SET status = $2, output = $3, step_results = $4, error = $5, finished_at = NOW()
     WHERE id = $1`,
    [execId, status, JSON.stringify(output), JSON.stringify(stepResults), error ?? null],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

const MAX_NESTED_DEPTH = 4;

interface ExecEnv {
  runAgent: RunAgentFn;
  /** Stack of crew IDs we're currently in (for cycle detection). */
  ancestry: string[];
  /** Top-level user. Owner-scoped operations use this. */
  userId: number;
}

export async function executeCrew(
  crewId: string,
  userId: number,
  input: any,
  runAgent: RunAgentFn,
): Promise<CrewExecution> {
  const crew = await getCrew(crewId, userId);
  if (!crew) throw new Error(`Crew ${crewId} not found`);

  const execId = randomUUID();
  await insertExecution({ id: execId, crewId, userId, input });

  const stepResults: Record<string, any> = {};
  let finalOutput: any = null;
  let error: string | undefined;
  const env: ExecEnv = { runAgent, ancestry: [crewId], userId };

  try {
    finalOutput = await runCrewByDef(crew, input, stepResults, env);
    await finishExecution(execId, 'completed', finalOutput, stepResults);
  } catch (err: any) {
    error = err?.message || String(err);
    finalOutput = { error };
    await finishExecution(execId, 'failed', finalOutput, stepResults, error);
  }

  return {
    id: execId,
    crewId,
    userId,
    input,
    output: finalOutput,
    status: error ? 'failed' : 'completed',
    stepResults,
    error,
    startedAt: new Date(),
    finishedAt: new Date(),
  };
}

async function runCrewByDef(
  crew: CrewDefinition,
  input: any,
  stepResults: Record<string, any>,
  env: ExecEnv,
): Promise<any> {
  switch (crew.flow.type) {
    case 'sequential':  return executeSequential(crew, input, stepResults, env);
    case 'parallel':    return executeParallel(crew, input, stepResults, env);
    case 'conditional': return executeConditional(crew, input, stepResults, env);
    case 'manager':     return executeManager(crew, input, stepResults, env);
    default:            throw new Error(`Unknown flow type: ${(crew.flow as any).type}`);
  }
}

/** Invoke a crew member — dispatches to agent or nested crew. */
async function invokeMember(
  crew: CrewDefinition,
  member: CrewMember,
  stepIndex: number,
  input: any,
  subtask: string | undefined,
  env: ExecEnv,
): Promise<any> {
  const role = (ROLE_ALIASES[member.role] || member.role) as CrewAgentRole;
  const crewContext = {
    crewId: crew.id,
    crewName: crew.name,
    flowType: crew.flow.type,
    stepIndex,
    totalSteps: crew.agents.length,
    ancestry: env.ancestry.slice(),
  };

  if (member.nestedCrewId) {
    // Recursion guard
    if (env.ancestry.includes(member.nestedCrewId)) {
      throw new Error(`Cycle detected: nested crew ${member.nestedCrewId} is already in ancestry`);
    }
    if (env.ancestry.length >= MAX_NESTED_DEPTH) {
      throw new Error(`Max nested-crew depth ${MAX_NESTED_DEPTH} exceeded`);
    }
    const nested = await getCrewForNested(member.nestedCrewId, env.userId);
    if (!nested) throw new Error(`Nested crew ${member.nestedCrewId} not found or not owned by you`);
    const subStepResults: Record<string, any> = {};
    const subEnv: ExecEnv = {
      runAgent: env.runAgent,
      ancestry: env.ancestry.concat(member.nestedCrewId),
      userId: env.userId,
    };
    // Subtask becomes the input for the nested crew so manager-style delegation
    // propagates through sub-networks naturally.
    const nestedInput = subtask
      ? { task: subtask, parentInput: input }
      : input;
    const out = await runCrewByDef(nested, nestedInput, subStepResults, subEnv);
    // Surface nested step results into the parent log for transparency
    return { __nested: { crewId: member.nestedCrewId, name: nested.name, steps: subStepResults, result: out }, ...wrapResult(out) };
  }

  // Regular agent member
  if (member.agentId === undefined || member.agentId === null) {
    throw new Error('Member has neither agentId nor nestedCrewId');
  }
  return env.runAgent(member.agentId, input, {
    role,
    label: member.label,
    jobDescription: member.jobDescription,
    subtask,
    crewContext,
    userId: env.userId,
  });
}

function wrapResult(out: any): { result: any } {
  return { result: out };
}

// ── Sequential: A → B → C, each gets previous output ──
async function executeSequential(
  crew: CrewDefinition,
  input: any,
  stepResults: Record<string, any>,
  env: ExecEnv,
): Promise<any> {
  let current = input;
  for (let i = 0; i < crew.agents.length; i++) {
    const member = crew.agents[i];
    const result = await invokeMember(crew, member, i, current, undefined, env);
    stepResults[`step_${i}`] = stepRecord(member, result);
    setSharedMemory(crew.id, 'steps', `step_${i}`, result);
    current = result;
  }
  return current;
}

// ── Parallel: A + B + C simultaneously, results merged ──
async function executeParallel(
  crew: CrewDefinition,
  input: any,
  stepResults: Record<string, any>,
  env: ExecEnv,
): Promise<any> {
  const promises = crew.agents.map((member, i) =>
    invokeMember(crew, member, i, input, undefined, env)
      .then((result) => ({ i, member, result, error: null as string | null }))
      .catch((err) => ({ i, member, result: null as any, error: err?.message || String(err) })),
  );
  const settled = await Promise.all(promises);
  const merged: Record<string, any> = {};
  for (const s of settled) {
    const key = s.member.label || `agent_${s.i}`;
    stepResults[`step_${s.i}`] = stepRecord(s.member, s.result, s.error);
    setSharedMemory(crew.id, 'steps', `step_${s.i}`, s.result);
    merged[key] = s.error ? { error: s.error } : s.result;
  }
  return merged;
}

// ── Conditional: evaluate condition on step output, branch accordingly ──
async function executeConditional(
  crew: CrewDefinition,
  input: any,
  stepResults: Record<string, any>,
  env: ExecEnv,
): Promise<any> {
  if (!crew.flow.conditions || crew.flow.conditions.length === 0) {
    throw new Error('Conditional flow requires at least one condition');
  }
  const first = crew.agents[0];
  const firstResult = await invokeMember(crew, first, 0, input, undefined, env);
  stepResults['step_0'] = stepRecord(first, firstResult);
  setSharedMemory(crew.id, 'steps', 'step_0', firstResult);
  let current = firstResult;
  for (const cond of crew.flow.conditions) {
    const matches = evaluateCondition(current, cond);
    const nextIdx = matches ? cond.thenAgent : cond.elseAgent;
    if (nextIdx < 0 || nextIdx >= crew.agents.length) {
      throw new Error(`Condition references agent index ${nextIdx} but crew has ${crew.agents.length} members`);
    }
    const member = crew.agents[nextIdx];
    const result = await invokeMember(crew, member, nextIdx, current, undefined, env);
    stepResults[`step_${nextIdx}`] = stepRecord(member, result);
    setSharedMemory(crew.id, 'steps', `step_${nextIdx}`, result);
    current = result;
  }
  return current;
}

// ── Manager: LLM-driven dynamic task distribution ──
//
// On each round the manager sees:
//   • original input
//   • roster (each subordinate's index, role, label, jobDescription)
//   • previous results (compact)
//
// Manager must reply with one of:
//   {"action": "delegate", "assignments": [{"index": N, "subtask": "..."}], "reasoning": "..."}
//   {"action": "finish",   "answer": "..."}
//
// Engine executes all delegations in parallel, feeds results back, repeats
// until manager calls "finish" or maxRounds is hit (default 4).
async function executeManager(
  crew: CrewDefinition,
  input: any,
  stepResults: Record<string, any>,
  env: ExecEnv,
): Promise<any> {
  const managerIdx = crew.flow.managerIndex ?? 0;
  const maxRounds = crew.flow.maxRounds ?? 4;
  if (managerIdx < 0 || managerIdx >= crew.agents.length) {
    throw new Error(`Invalid managerIndex ${managerIdx}`);
  }
  const manager = crew.agents[managerIdx];
  const subordinates = crew.agents
    .map((m, i) => ({ m, i }))
    .filter(({ i }) => i !== managerIdx);

  if (subordinates.length === 0) {
    // Degenerate: only manager. Just run it solo.
    const r = await invokeMember(crew, manager, managerIdx, input, undefined, env);
    stepResults['manager_solo'] = stepRecord(manager, r);
    return r;
  }

  const rosterText = subordinates.map(({ m, i }) =>
    `  [${i}] role=${m.role}` +
    (m.label ? ` label="${m.label}"` : '') +
    (m.nestedCrewId ? ` type=sub-crew` : ' type=agent') +
    (m.jobDescription ? ` — ${m.jobDescription}` : ''),
  ).join('\n');

  const history: Array<{ round: number; decision: any; results: Record<string, any> }> = [];

  for (let round = 1; round <= maxRounds; round++) {
    const historyText = history.length
      ? history.map(h => `Round ${h.round} decision: ${JSON.stringify(h.decision).slice(0, 400)}\n` +
                         `Round ${h.round} results:\n${
                           Object.entries(h.results).map(([k, v]) =>
                             `  [${k}] ${JSON.stringify(v).slice(0, 300)}`
                           ).join('\n')
                         }`).join('\n\n')
      : '(none yet)';

    const managerInstruction =
      `You are the MANAGER of a crew that must solve the task below.\n\n` +
      `TASK:\n${typeof input === 'string' ? input : JSON.stringify(input)}\n\n` +
      `ROSTER (your subordinates):\n${rosterText}\n\n` +
      `HISTORY:\n${historyText}\n\n` +
      `ROUND ${round} / ${maxRounds}.\n\n` +
      `Reply STRICTLY with one JSON object, no prose, no markdown fences:\n` +
      `{"action":"delegate","assignments":[{"index":N,"subtask":"..."}],"reasoning":"..."}\n` +
      `OR\n` +
      `{"action":"finish","answer":"..."}\n\n` +
      `Rules:\n` +
      `- Delegate to multiple subordinates in one round when their work is independent (they run in parallel).\n` +
      `- Pick the subordinate whose role/job best matches the subtask.\n` +
      `- Use "finish" once you have enough info to answer the task. Don't burn rounds.\n` +
      `- "answer" must be the final result for the user.`;

    const decisionRaw = await invokeMember(crew, manager, managerIdx, managerInstruction, undefined, env);
    stepResults[`manager_r${round}`] = stepRecord(manager, decisionRaw);

    const decision = parseManagerDecision(decisionRaw);
    if (!decision) {
      // Manager went off-script — treat its raw text as a finish answer.
      const final = typeof decisionRaw === 'string' ? decisionRaw : JSON.stringify(decisionRaw);
      stepResults['manager_finish'] = { reason: 'unparseable_decision', raw: decisionRaw };
      return final;
    }

    if (decision.action === 'finish') {
      stepResults['manager_finish'] = { reason: 'manager_finish', round };
      return decision.answer ?? '';
    }

    // Delegate phase — execute assignments in parallel
    const assignments = decision.assignments || [];
    if (assignments.length === 0) {
      stepResults[`manager_r${round}_empty`] = decision;
      continue;
    }

    const roundResults: Record<string, any> = {};
    const tasks = assignments.map(async (a: { index: number; subtask: string }) => {
      const idx = Number(a.index);
      if (idx === managerIdx || idx < 0 || idx >= crew.agents.length) {
        roundResults[`bad_idx_${idx}`] = { error: 'invalid subordinate index' };
        return;
      }
      const sub = crew.agents[idx];
      try {
        const r = await invokeMember(crew, sub, idx, input, a.subtask, env);
        roundResults[`sub_${idx}`] = r;
        stepResults[`r${round}_sub_${idx}`] = stepRecord(sub, r);
        setSharedMemory(crew.id, 'manager', `r${round}_sub_${idx}`, r);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        roundResults[`sub_${idx}`] = { error: errMsg };
        stepResults[`r${round}_sub_${idx}`] = stepRecord(sub, null, errMsg);
      }
    });
    await Promise.all(tasks);

    history.push({ round, decision, results: roundResults });
  }

  // Out of rounds — ask manager to summarize what we have
  const summaryInstruction =
    `You ran out of rounds. Based on the work so far, give the FINAL ANSWER to the user.\n\n` +
    `TASK:\n${typeof input === 'string' ? input : JSON.stringify(input)}\n\n` +
    `WORK DONE:\n${
      history.map(h => Object.entries(h.results).map(([k, v]) =>
        `[r${h.round} ${k}] ${JSON.stringify(v).slice(0, 400)}`).join('\n')).join('\n')
    }\n\n` +
    `Reply with the final answer as plain text. No JSON, no markdown.`;
  const final = await invokeMember(crew, manager, managerIdx, summaryInstruction, undefined, env);
  stepResults['manager_force_finish'] = stepRecord(manager, final);
  return final;
}

function parseManagerDecision(raw: any): { action: 'delegate' | 'finish'; assignments?: any[]; answer?: string; reasoning?: string } | null {
  let text: string;
  if (typeof raw === 'string') text = raw;
  else if (raw && typeof raw === 'object' && typeof (raw as any).reply === 'string') text = (raw as any).reply;
  else { try { text = JSON.stringify(raw); } catch { return null; } }

  // Try direct parse first
  const direct = tryParseJson(text);
  if (direct && (direct.action === 'delegate' || direct.action === 'finish')) return direct;

  // Try to extract a JSON object from the text (manager may add prose)
  const match = text.match(/\{[\s\S]*?"action"\s*:\s*"(?:delegate|finish)"[\s\S]*\}/);
  if (match) {
    const found = tryParseJson(match[0]);
    if (found && (found.action === 'delegate' || found.action === 'finish')) return found;
  }
  return null;
}

function tryParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

// ── Helpers ──

function stepRecord(member: CrewMember, result: any, error?: string | null): any {
  return {
    agentId: member.agentId,
    nestedCrewId: member.nestedCrewId,
    role: member.role,
    label: member.label,
    jobDescription: member.jobDescription,
    result,
    error: error ?? undefined,
  };
}

function evaluateCondition(output: any, cond: FlowCondition): boolean {
  const val = extractField(output, cond.field);
  switch (cond.operator) {
    case 'eq':       return val === cond.value;
    case 'neq':      return val !== cond.value;
    case 'contains':
      if (typeof val === 'string') return val.includes(String(cond.value));
      if (Array.isArray(val)) return val.includes(cond.value);
      return false;
    case 'gt':       return typeof val === 'number' && val > Number(cond.value);
    case 'lt':       return typeof val === 'number' && val < Number(cond.value);
    case 'exists':   return val !== undefined && val !== null;
    default:         return false;
  }
}

function extractField(obj: any, path: string): any {
  if (obj == null || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT RUN-AGENT IMPLEMENTATION
//
// Wires crew execution to the real agent runtime: loads agent from DB, builds
// a role-aware system prompt (using ROLE_PROFILES), calls the agent's AI
// provider with the input+subtask, returns the reply.
// ═══════════════════════════════════════════════════════════════════════════

export function buildRolePrompt(role: CrewAgentRole, opts: {
  label?: string;
  jobDescription?: string;
  crewContext: Record<string, any>;
}): string {
  const normalized = (ROLE_ALIASES[role] || role) as string;
  const profile = ROLE_PROFILES[normalized];
  const roleBlock = profile
    ? profile.systemPromptModule
    : `[ROLE: ${role.toUpperCase()}] You are a member of a multi-agent crew.`;

  const crewBlock =
    `[CREW CONTEXT]\n` +
    `Crew: ${opts.crewContext.crewName || opts.crewContext.crewId}\n` +
    `Flow: ${opts.crewContext.flowType || 'unknown'}\n` +
    `Step: ${(opts.crewContext.stepIndex ?? 0) + 1}/${opts.crewContext.totalSteps ?? '?'}\n` +
    (opts.crewContext.ancestry?.length > 1
      ? `Nested depth: ${opts.crewContext.ancestry.length} (you are inside a sub-crew)\n`
      : '') +
    (opts.label ? `Your label: ${opts.label}\n` : '') +
    (opts.jobDescription ? `Your job in this crew: ${opts.jobDescription}\n` : '');

  return `${roleBlock}\n\n${crewBlock}`;
}

/**
 * Build the default RunAgentFn that:
 *   1. Loads agent (name/description/code/config) from DB via the provided fetcher
 *   2. Builds role-aware system prompt
 *   3. Calls universalAgentChat for the actual AI call
 *   4. Returns the reply text (plus newCode if AI produced one)
 *
 * Pass `loadAgent` to keep this file decoupled from the agents repo layer.
 */
export function buildDefaultRunAgent(loadAgent: (agentId: number, userId: number) => Promise<{
  name: string;
  description: string | null;
  code: string;
  agentType: string;
  config: Record<string, any>;
} | null>): RunAgentFn {
  return async (agentId, input, opts) => {
    const agent = await loadAgent(agentId, opts.userId);
    if (!agent) {
      throw new Error(`Agent #${agentId} not found or not accessible by user ${opts.userId}`);
    }

    const rolePrompt = buildRolePrompt(opts.role, {
      label: opts.label,
      jobDescription: opts.jobDescription,
      crewContext: opts.crewContext,
    });

    const taskBody = opts.subtask
      ? `SUBTASK FROM MANAGER:\n${opts.subtask}\n\nORIGINAL INPUT:\n${typeof input === 'string' ? input : JSON.stringify(input)}`
      : (typeof input === 'string' ? input : JSON.stringify(input));

    // Compose a richer "name+description" so the role prompt rides along
    const effectiveDescription =
      (agent.description ? agent.description + '\n\n' : '') + rolePrompt;

    // Lazy import to avoid circular deps at module load time
    const { universalAgentChat } = await import('../universal-agent-chat');
    const out = await universalAgentChat({
      agentName:        agent.name,
      agentDescription: effectiveDescription,
      agentCode:        agent.code || '',
      agentType:        agent.agentType || 'ai',
      config:           agent.config || {},
      userMessage:      taskBody,
    });

    return out.reply;
  };
}
