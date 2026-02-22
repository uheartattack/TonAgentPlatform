import { logger } from './utils/logger.js';
import { getAgentById } from './db/agents.js';
import { createExecution, updateExecutionSuccess, updateExecutionFailure } from './db/executions.js';
import { executeInSandbox } from './sandbox.js';
import { config } from './config.js';

export class Executor {
  async executeAgentById(agentId: string, triggeredBy: string = 'manual'): Promise<{
    success: boolean;
    executionId: string;
    result?: any;
    error?: string;
  }> {
    try {
      // Get agent from database
      const agent = await getAgentById(agentId);
      
      if (!agent) {
        return {
          success: false,
          executionId: '',
          error: 'Agent not found',
        };
      }

      if (agent.status !== 'active') {
        return {
          success: false,
          executionId: '',
          error: `Agent status is ${agent.status}, must be active`,
        };
      }

      // Create execution record
      const executionId = await createExecution(agentId, triggeredBy);

      logger.info(`Manually executing agent: ${agentId} (${agent.name})`);

      // Execute in sandbox
      const result = await executeInSandbox(
        agent,
        executionId,
        config.scheduler.executionTimeout
      );

      if (result.success) {
        await updateExecutionSuccess(executionId, result.data, result.gasUsed);
        logger.info(`Manual execution ${executionId} succeeded`);
        
        return {
          success: true,
          executionId,
          result: result.data,
        };
      } else {
        await updateExecutionFailure(executionId, result.error || 'Unknown error');
        logger.error(`Manual execution ${executionId} failed: ${result.error}`);
        
        return {
          success: false,
          executionId,
          error: result.error,
        };
      }
    } catch (error) {
      logger.error(`Error executing agent ${agentId}`, error);
      return {
        success: false,
        executionId: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const executor = new Executor();
