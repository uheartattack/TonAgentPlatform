import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', error);
    return false;
  }
}

process.on('SIGTERM', async () => {
  await pool.end();
  logger.info('Database pool closed');
});
