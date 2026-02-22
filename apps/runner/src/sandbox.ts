import { logger } from './utils/logger.js';
import { ExecutionError, TimeoutError } from './utils/errors.js';
import type { Agent } from '@ton-agent/shared-types';
import { pluginLoader } from './plugins/loader.js';

export interface SandboxResult {
  success: boolean;
  data?: any;
  error?: string;
  gasUsed?: number;
}

interface ExecutionContext {
  agentId: string;
  executionId: string;
  logger: any;
  storage: any;
  plugins: any;
}

export async function executeInSandbox(
  agent: Agent,
  executionId: string,
  timeoutMs: number = 300000
): Promise<SandboxResult> {
  const startTime = Date.now();

  try {
    const context: ExecutionContext = {
      agentId: agent.id,
      executionId,
      logger: {
        info: (msg: string) => logger.info(`[Agent:${agent.id}] ${msg}`),
        error: (msg: string) => logger.error(`[Agent:${agent.id}] ${msg}`),
        warn: (msg: string) => logger.warn(`[Agent:${agent.id}] ${msg}`),
      },
      storage: {
        get: async (key: string) => null,
        set: async (key: string, value: any) => {},
        delete: async (key: string) => {},
      },
      plugins: pluginLoader,
    };

    const executePromise = executeAgentCode(agent, context);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new TimeoutError('Execution timeout')), timeoutMs);
    });

    const result = await Promise.race([executePromise, timeoutPromise]);
    const executionTime = Date.now() - startTime;
    const gasUsed = Math.floor(executionTime / 100);

    return { success: true, data: result, gasUsed };
  } catch (error) {
    logger.error(`Sandbox execution failed for agent ${agent.id}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeAgentCode(agent: Agent, context: ExecutionContext): Promise<any> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  
  try {
    const execute = new AsyncFunction('agent', 'context', agent.code);
    const result = await execute(agent, context);
    
    if (!result || typeof result !== 'object') {
      throw new ExecutionError('Agent must return an object', 'INVALID_RETURN');
    }
    
    if (!('success' in result)) {
      throw new ExecutionError('Agent must return {success: boolean}', 'INVALID_RETURN');
    }
    
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ExecutionError(`Syntax error: ${error.message}`, 'SYNTAX_ERROR');
    }
    throw error;
  }
}
