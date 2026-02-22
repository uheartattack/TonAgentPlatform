import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { testConnection } from './db/index.js';
import { pluginsRouter } from './routes/plugins.js';

const app = express();

// Middleware
app.use(cors({ origin: config.cors.origins }));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/plugins', pluginsRouter);

// Start server
async function start() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  app.listen(config.port, () => {
    logger.info(`Plugin Registry API running on port ${config.port}`);
    logger.info(`Environment: ${config.environment}`);
  });
}

start().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
