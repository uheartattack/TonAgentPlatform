import cron from 'node-cron';
import { logger } from './utils/logger.js';
import { config } from './config.js';
import { getActiveAgents, updateAgentLastRun, incrementAgentErrors } from './db/agents.js';
import { createExecution, updateExecutionSuccess, updateExecutionFailure } from './db/executions.js';
import { executeInSandbox } from './sandbox.js';
import type { Agent } from '@ton-agent/shared-types';

export class Scheduler {
  private isRunning = false;
  private activeExecutions = 0;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  async start(): Promise<void> {
    logger.info('Starting scheduler...');
    setInterval(() => this.pollAgents(), config.scheduler.pollInterval);
    await this.scheduleCronAgents();
    this.isRunning = true;
    logger.info('Scheduler started');
  }

  private async pollAgents(): Promise<void> {
    if (this.activeExecutions >= config.scheduler.maxConcurrentExecutions) {
      logger.debug('Max concurrent executions reached, skipping poll');
      return;
    }

    try {
      const agents = await getActiveAgents();
      
      for (const agent of agents) {
        if (this.activeExecutions >= config.scheduler.maxConcurrentExecutions) {
          break;
        }

        if (this.shouldExecuteAgent(agent)) {
          this.executeAgent(agent);
        }
      }
    } catch (error) {
      logger.error('Error polling agents', error);
    }
  }

  private shouldExecuteAgent(agent: Agent): boolean {
    if (agent.trigger_type === 'manual') {
      return false;
    }

    // For now, execute based on last_run_at
    const lastRun = agent.last_run_at ? new Date(agent.last_run_at).getTime() : 0;
    const now = Date.now();
    const minInterval = 60000; // 1 minute minimum
    
    return now - lastRun >= minInterval;
  }

  private async executeAgent(agent: Agent): Promise<void> {
    this.activeExecutions++;

    try {
      logger.info(`Executing agent: ${agent.id} (${agent.name})`);
      const executionId = await createExecution(agent.id, 'scheduler');
      await updateAgentLastRun(agent.id);

      const result = await executeInSandbox(
        agent,
        executionId,
        config.scheduler.executionTimeout
      );

      if (result.success) {
        await updateExecutionSuccess(executionId, result.data, result.gasUsed);
        logger.info(`Agent ${agent.id} executed successfully`);
      } else {
        await updateExecutionFailure(executionId, result.error || 'Unknown error');
        await incrementAgentErrors(agent.id, result.error || 'Unknown error');
        logger.error(`Agent ${agent.id} execution failed: ${result.error}`);
      }
    } catch (error) {
      logger.error(`Unexpected error executing agent ${agent.id}`, error);
    } finally {
      this.activeExecutions--;
    }
  }

  private async scheduleCronAgents(): Promise<void> {
    logger.info('Cron scheduling not yet implemented');
  }

  stop(): void {
    this.isRunning = false;
    for (const [agentId, job] of this.cronJobs) {
      job.stop();
      logger.info(`Stopped cron job for agent: ${agentId}`);
    }
    this.cronJobs.clear();
    logger.info('Scheduler stopped');
  }

  getStatus() {
    return {
      running: this.isRunning,
      activeExecutions: this.activeExecutions,
      maxConcurrentExecutions: config.scheduler.maxConcurrentExecutions,
      scheduledCronJobs: this.cronJobs.size,
    };
  }
}
