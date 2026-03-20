/**
 * crew-system.ts — Multi-agent crew orchestration.
 *
 * Allows 2-5 agents to collaborate via sequential, parallel or conditional flows.
 * Shared memory (in-memory + DB persistence), execution history, CRUD for crews.
 */

import { randomUUID } from 'crypto';
import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type CrewAgentRole = 'manager' | 'researcher' | 'executor' | 'validator' | 'monitor';

export type FlowType = 'sequential' | 'parallel' | 'conditional';

export interface FlowCondition {
  /** Field path in previous agent output to evaluate (e.g. "status") */
  field: string;
  /** Operator for comparison */
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists';
  /** Value to compare against (not needed for 'exists') */
  value?: any;
  /** Agent index to run when condition is TRUE */
  thenAgent: number;
  /** Agent index to run when condition is FALSE */
  elseAgent: number;
}

export interface FlowConfig {
  type: FlowType;
  /** For conditional flow: condition to evaluate on the output of the previous step */
  conditions?: FlowCondition[];
}

export interface CrewAgent {
  /** Reference to an existing agent ID on the platform */
  agentId: number;
  role: CrewAgentRole;
  /** Optional label shown in logs */
  label?: string;
}

export interface CrewDefinition {
  id: string;
  userId: number;
  name: string;
  description?: string;
  agents: CrewAgent[];
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
  /** Per-agent results keyed by step index */
  stepResults: Record<string, any>;
  error?: string;
  startedAt: Date;
  finishedAt: Date | null;
}

/** Callback that the execution engine invokes to run a single agent */
export type RunAgentFn = (
  agentId: number,
  input: any,
  context?: Record<string, any>,
) => Promise<any>;

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════

let _pool: Pool | null = null;

function pool(): Pool {
  if (!_pool) throw new Error('[CrewSystem] Not initialised — call initCrewSystem(pool) first');
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED MEMORY  (in-memory, per-crew, namespace support, 100 key cap)
// ═══════════════════════════════════════════════════════════════════════════

const MAX_KEYS_PER_NS = 100;
const MAX_CREWS = 500;
const MAX_NAMESPACES_PER_CREW = 50;
const MAX_VALUE_SIZE = 10 * 1024; // 10 KB

/** crewId → namespace → key → value */
const sharedMem = new Map<string, Map<string, Map<string, any>>>();

function nsMap(crewId: string, namespace: string): Map<string, any> {
  if (!sharedMem.has(crewId)) {
    // Evict oldest crew if at limit
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
  // Enforce value size limit
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (serialized && serialized.length > MAX_VALUE_SIZE) {
    throw new Error(`Shared memory value too large (${serialized.length} bytes, max ${MAX_VALUE_SIZE})`);
  }
  const ns = nsMap(crewId, namespace);
  if (!ns.has(key) && ns.size >= MAX_KEYS_PER_NS) {
    // Evict oldest entry (first inserted)
    const oldest = ns.keys().next().value;
    if (oldest !== undefined) ns.delete(oldest);
  }
  ns.set(key, value);
}

/** Wipe all shared memory for a crew (call after deletion) */
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

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_crews_user ON builder_bot.crews (user_id);
  `);
  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_crew_exec_crew ON builder_bot.crew_executions (crew_id);
  `);

  console.log('[CrewSystem] Tables ready');
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function createCrew(def: {
  userId: number;
  name: string;
  description?: string;
  agents: CrewAgent[];
  flow: FlowConfig;
}): Promise<string> {
  if (def.agents.length < 2 || def.agents.length > 5) {
    throw new Error('Crew must have 2-5 agents');
  }
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
    if (patch.agents.length < 2 || patch.agents.length > 5) throw new Error('Crew must have 2-5 agents');
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
    userId: r.user_id,
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
    userId: r.user_id,
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
  id: string;
  crewId: string;
  userId: number;
  input: any;
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

  try {
    switch (crew.flow.type) {
      case 'sequential':
        finalOutput = await executeSequential(crew, input, runAgent, stepResults);
        break;
      case 'parallel':
        finalOutput = await executeParallel(crew, input, runAgent, stepResults);
        break;
      case 'conditional':
        finalOutput = await executeConditional(crew, input, runAgent, stepResults);
        break;
      default:
        throw new Error(`Unknown flow type: ${(crew.flow as any).type}`);
    }
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

// ── Sequential: A → B → C, each gets previous output ──

async function executeSequential(
  crew: CrewDefinition,
  input: any,
  runAgent: RunAgentFn,
  stepResults: Record<string, any>,
): Promise<any> {
  let current = input;

  for (let i = 0; i < crew.agents.length; i++) {
    const agent = crew.agents[i];
    const ctx = buildContext(crew, i, current);
    const result = await runAgent(agent.agentId, current, ctx);
    stepResults[`step_${i}`] = { agentId: agent.agentId, role: agent.role, label: agent.label, result };
    // Store in shared memory so other agents can access
    setSharedMemory(crew.id, 'steps', `step_${i}`, result);
    current = result;
  }

  return current;
}

// ── Parallel: A + B + C simultaneously, results merged ──

async function executeParallel(
  crew: CrewDefinition,
  input: any,
  runAgent: RunAgentFn,
  stepResults: Record<string, any>,
): Promise<any> {
  const promises = crew.agents.map((agent, i) => {
    const ctx = buildContext(crew, i, input);
    return runAgent(agent.agentId, input, ctx)
      .then((result) => ({ i, agent, result, error: null as string | null }))
      .catch((err) => ({ i, agent, result: null, error: err?.message || String(err) }));
  });

  const settled = await Promise.all(promises);
  const merged: Record<string, any> = {};

  for (const s of settled) {
    const key = s.agent.label || `agent_${s.i}`;
    stepResults[`step_${s.i}`] = {
      agentId: s.agent.agentId,
      role: s.agent.role,
      label: s.agent.label,
      result: s.result,
      error: s.error,
    };
    setSharedMemory(crew.id, 'steps', `step_${s.i}`, s.result);
    merged[key] = s.error ? { error: s.error } : s.result;
  }

  return merged;
}

// ── Conditional: evaluate condition on step output, branch accordingly ──

async function executeConditional(
  crew: CrewDefinition,
  input: any,
  runAgent: RunAgentFn,
  stepResults: Record<string, any>,
): Promise<any> {
  if (!crew.flow.conditions || crew.flow.conditions.length === 0) {
    throw new Error('Conditional flow requires at least one condition');
  }

  // First agent always runs (the "evaluator")
  const first = crew.agents[0];
  const ctx0 = buildContext(crew, 0, input);
  const firstResult = await runAgent(first.agentId, input, ctx0);
  stepResults['step_0'] = { agentId: first.agentId, role: first.role, label: first.label, result: firstResult };
  setSharedMemory(crew.id, 'steps', 'step_0', firstResult);

  let current = firstResult;

  // Evaluate each condition in order
  for (const cond of crew.flow.conditions) {
    const matches = evaluateCondition(current, cond);
    const nextIdx = matches ? cond.thenAgent : cond.elseAgent;

    if (nextIdx < 0 || nextIdx >= crew.agents.length) {
      throw new Error(`Condition references agent index ${nextIdx} but crew has ${crew.agents.length} agents`);
    }

    const agent = crew.agents[nextIdx];
    const ctx = buildContext(crew, nextIdx, current);
    const result = await runAgent(agent.agentId, current, ctx);
    stepResults[`step_${nextIdx}`] = { agentId: agent.agentId, role: agent.role, label: agent.label, result };
    setSharedMemory(crew.id, 'steps', `step_${nextIdx}`, result);
    current = result;
  }

  return current;
}

// ── Helpers ──

function buildContext(crew: CrewDefinition, stepIndex: number, currentInput: any): Record<string, any> {
  return {
    crewId: crew.id,
    crewName: crew.name,
    flowType: crew.flow.type,
    stepIndex,
    totalSteps: crew.agents.length,
    input: currentInput,
  };
}

function evaluateCondition(output: any, cond: FlowCondition): boolean {
  const val = extractField(output, cond.field);

  switch (cond.operator) {
    case 'eq':
      return val === cond.value;
    case 'neq':
      return val !== cond.value;
    case 'contains':
      if (typeof val === 'string') return val.includes(String(cond.value));
      if (Array.isArray(val)) return val.includes(cond.value);
      return false;
    case 'gt':
      return typeof val === 'number' && val > Number(cond.value);
    case 'lt':
      return typeof val === 'number' && val < Number(cond.value);
    case 'exists':
      return val !== undefined && val !== null;
    default:
      return false;
  }
}

/** Dot-path field extractor: "a.b.c" → obj.a.b.c */
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
