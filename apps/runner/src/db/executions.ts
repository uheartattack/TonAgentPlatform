import { pool } from './index.js';

export async function createExecution(
  agentId: string,
  triggeredBy: string
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO executions (agent_id, status, started_at)
     VALUES ($1, 'running', NOW())
     RETURNING id`,
    [agentId]
  );
  return result.rows[0].id;
}

export async function updateExecutionSuccess(
  executionId: string,
  result: any,
  gasUsed?: number
): Promise<void> {
  await pool.query(
    `UPDATE executions 
     SET status = 'success',
         completed_at = NOW(),
         result = $2,
         gas_used = $3
     WHERE id = $1`,
    [executionId, JSON.stringify(result), gasUsed || 0]
  );
}

export async function updateExecutionFailure(
  executionId: string,
  errorMessage: string
): Promise<void> {
  await pool.query(
    `UPDATE executions 
     SET status = 'failed',
         completed_at = NOW(),
         error_message = $2
     WHERE id = $1`,
    [executionId, errorMessage]
  );
}

export async function getExecutionById(executionId: string): Promise<any> {
  const result = await pool.query(
    'SELECT * FROM executions WHERE id = $1',
    [executionId]
  );
  return result.rows[0] || null;
}
