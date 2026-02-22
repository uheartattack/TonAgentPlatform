import dotenv from 'dotenv';

dotenv.config();

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://ton_agent:ton_password@localhost:5432/ton_agent_platform',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  scheduler: {
    pollInterval: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
    maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '10'),
    executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT_MS || '300000'),
  },
  environment: process.env.NODE_ENV || 'development',
};
