import { pool } from './index.js';
import type { Agent } from '@ton-agent/shared-types';

export async function getActiveAgents(): Promise<Agent[]> {
  const result = await pool.query<Agent>(
    `SELECT * FROM agents 
     WHERE status = 'active' 
     ORDER BY user_priority ASC, last_run_at ASC NULLS FIRST
     LIMIT 100`
  );
  return result.rows;
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const result = await pool.query<Agent>(
    'SELECT * FROM agents WHERE id = $1',
    [agentId]
  );
  return result.rows[0] || null;
}

export async function updateAgentStatus(
  agentId: string,
  status: 'active' | 'paused' | 'error'
): Promise<void> {
  await pool.query(
    'UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, agentId]
  );
}

export async function updateAgentLastRun(agentId: string): Promise<void> {
  await pool.query(
    'UPDATE agents SET last_run_at = NOW(), total_executions = total_executions + 1 WHERE id = $1',
    [agentId]
  );
}

export async function incrementAgentErrors(
  agentId: string,
  errorMessage: string
): Promise<void> {
  await pool.query(
    `UPDATE agents 
     SET error_count = error_count + 1,
         last_error_at = NOW(),
         last_error_message = $2,
         status = CASE WHEN error_count + 1 >= 5 THEN 'error' ELSE status END
     WHERE id = $1`,
    [agentId, errorMessage]
  );
}
