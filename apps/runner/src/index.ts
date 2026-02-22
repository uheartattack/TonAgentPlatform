import { logger } from './utils/logger.js';
import { config } from './config.js';
import { testConnection } from './db/index.js';
import { Scheduler } from './scheduler.js';
import { pluginLoader } from './plugins/loader.js';

async function main() {
  logger.info('Starting TON Agent Runner...');
  logger.info(`Environment: ${config.environment}`);

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Load all plugins
  logger.info('Loading plugins...');
  await pluginLoader.loadAll();

  // Start scheduler
  const scheduler = new Scheduler();
  await scheduler.start();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    scheduler.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('TON Agent Runner is running');
  
  // Log status every 30 seconds
  setInterval(() => {
    const status = scheduler.getStatus();
    logger.info('Scheduler status', status);
  }, 30000);
}

main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
