/**
 * agent-task-store.ts — Tasks with dependencies (DAG), priorities, scheduling.
 * Adapted from teleton-agent task_dependencies pattern, uses PostgreSQL.
 */

import { randomUUID } from 'crypto';

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled';

export interface AgentTask {
  id: string;
  agentId: number;
  description: string;
  status: TaskStatus;
  priority: number;           // 0 = normal, higher = more urgent
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  scheduledFor: string | null;
  result: string | null;
  error: string | null;
  payload: any | null;        // JSON metadata
  dependsOn: string[];        // task IDs this depends on
}

export interface CreateTaskInput {
  description: string;
  priority?: number;
  scheduledFor?: string;      // ISO datetime
  dependsOn?: string[];       // task IDs
  payload?: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENSURE TABLES
// ═══════════════════════════════════════════════════════════════════════════

let _tablesReady = false;
async function ensureTables(): Promise<void> {
  if (_tablesReady) return;
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.agent_tasks (
      id TEXT PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done','failed','cancelled')),
      priority INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      scheduled_for TIMESTAMPTZ,
      result TEXT,
      error TEXT,
      payload JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON builder_bot.agent_tasks(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON builder_bot.agent_tasks(priority DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_scheduled ON builder_bot.agent_tasks(scheduled_for) WHERE scheduled_for IS NOT NULL;

    CREATE TABLE IF NOT EXISTS builder_bot.agent_task_deps (
      task_id TEXT NOT NULL REFERENCES builder_bot.agent_tasks(id) ON DELETE CASCADE,
      depends_on TEXT NOT NULL REFERENCES builder_bot.agent_tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, depends_on)
    );
  `);
  _tablesReady = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function createTask(agentId: number, input: CreateTaskInput): Promise<AgentTask> {
  await ensureTables();
  const pool = await getPool();
  const id = randomUUID();
  const { description, priority = 0, scheduledFor, dependsOn = [], payload } = input;

  await pool.query(
    `INSERT INTO builder_bot.agent_tasks (id, agent_id, description, priority, scheduled_for, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, agentId, description, priority, scheduledFor || null, payload ? JSON.stringify(payload) : null]
  );

  // Add dependencies
  for (const depId of dependsOn) {
    await pool.query(
      `INSERT INTO builder_bot.agent_task_deps (task_id, depends_on) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, depId]
    );
  }

  return {
    id, agentId, description, status: 'pending', priority,
    createdAt: new Date().toISOString(),
    startedAt: null, completedAt: null,
    scheduledFor: scheduledFor || null,
    result: null, error: null, payload: payload || null,
    dependsOn,
  };
}

export async function listTasks(
  agentId: number,
  filters?: { status?: TaskStatus; limit?: number; offset?: number }
): Promise<AgentTask[]> {
  await ensureTables();
  const pool = await getPool();

  let query = `SELECT t.*, ARRAY(
    SELECT d.depends_on FROM builder_bot.agent_task_deps d WHERE d.task_id = t.id
  ) as depends_on
  FROM builder_bot.agent_tasks t WHERE t.agent_id = $1`;
  const params: any[] = [agentId];
  let paramIdx = 2;

  if (filters?.status) {
    query += ` AND t.status = $${paramIdx}`;
    params.push(filters.status);
    paramIdx++;
  }

  query += ` ORDER BY t.priority DESC, t.created_at ASC`;

  if (filters?.limit) {
    query += ` LIMIT $${paramIdx}`;
    params.push(filters.limit);
    paramIdx++;
  }
  if (filters?.offset) {
    query += ` OFFSET $${paramIdx}`;
    params.push(filters.offset);
  }

  const res = await pool.query(query, params);
  return res.rows.map(rowToTask);
}

export async function getTask(agentId: number, taskId: string): Promise<AgentTask | null> {
  await ensureTables();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT t.*, ARRAY(
      SELECT d.depends_on FROM builder_bot.agent_task_deps d WHERE d.task_id = t.id
    ) as depends_on
    FROM builder_bot.agent_tasks t WHERE t.id = $1 AND t.agent_id = $2`,
    [taskId, agentId]
  );
  return res.rows[0] ? rowToTask(res.rows[0]) : null;
}

export async function updateTask(
  agentId: number,
  taskId: string,
  updates: { status?: TaskStatus; result?: string; error?: string }
): Promise<AgentTask | null> {
  await ensureTables();
  const pool = await getPool();

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (updates.status) {
    sets.push(`status = $${idx}`);
    params.push(updates.status);
    idx++;

    if (updates.status === 'in_progress') {
      sets.push(`started_at = NOW()`);
    } else if (updates.status === 'done' || updates.status === 'failed' || updates.status === 'cancelled') {
      sets.push(`completed_at = NOW()`);
    }
  }
  if (updates.result !== undefined) {
    sets.push(`result = $${idx}`);
    params.push(updates.result);
    idx++;
  }
  if (updates.error !== undefined) {
    sets.push(`error = $${idx}`);
    params.push(updates.error);
    idx++;
  }

  if (sets.length === 0) return getTask(agentId, taskId);

  params.push(taskId, agentId);
  await pool.query(
    `UPDATE builder_bot.agent_tasks SET ${sets.join(', ')} WHERE id = $${idx} AND agent_id = $${idx + 1}`,
    params
  );
  return getTask(agentId, taskId);
}

export async function deleteTask(agentId: number, taskId: string): Promise<boolean> {
  await ensureTables();
  const pool = await getPool();
  const res = await pool.query(
    `DELETE FROM builder_bot.agent_tasks WHERE id = $1 AND agent_id = $2`,
    [taskId, agentId]
  );
  return (res.rowCount || 0) > 0;
}

/** Get tasks whose all dependencies are 'done' (ready to execute) */
export async function getReadyTasks(agentId: number): Promise<AgentTask[]> {
  await ensureTables();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT t.*, ARRAY(
      SELECT d.depends_on FROM builder_bot.agent_task_deps d WHERE d.task_id = t.id
    ) as depends_on
    FROM builder_bot.agent_tasks t
    WHERE t.agent_id = $1
      AND t.status = 'pending'
      AND (t.scheduled_for IS NULL OR t.scheduled_for <= NOW())
      AND NOT EXISTS (
        SELECT 1 FROM builder_bot.agent_task_deps d
        JOIN builder_bot.agent_tasks dep ON dep.id = d.depends_on
        WHERE d.task_id = t.id AND dep.status != 'done'
      )
    ORDER BY t.priority DESC, t.created_at ASC`,
    [agentId]
  );
  return res.rows.map(rowToTask);
}

/** Task stats for an agent */
export async function getTaskStats(agentId: number): Promise<{ total: number; pending: number; inProgress: number; done: number; failed: number }> {
  await ensureTables();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT status, COUNT(*) as cnt FROM builder_bot.agent_tasks WHERE agent_id = $1 GROUP BY status`,
    [agentId]
  );
  const counts: any = { total: 0, pending: 0, in_progress: 0, done: 0, failed: 0, cancelled: 0 };
  for (const r of res.rows) {
    counts[r.status] = Number(r.cnt);
    counts.total += Number(r.cnt);
  }
  return { total: counts.total, pending: counts.pending, inProgress: counts.in_progress, done: counts.done, failed: counts.failed };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function rowToTask(r: any): AgentTask {
  return {
    id: r.id,
    agentId: r.agent_id,
    description: r.description,
    status: r.status,
    priority: r.priority || 0,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    scheduledFor: r.scheduled_for ? new Date(r.scheduled_for).toISOString() : null,
    result: r.result || null,
    error: r.error || null,
    payload: r.payload || null,
    dependsOn: (r.depends_on || []).filter((d: any) => d != null),
  };
}
