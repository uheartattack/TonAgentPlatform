import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
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

// Get all plugins
export async function getAllPlugins() {
  const result = await pool.query(
    'SELECT * FROM plugins ORDER BY created_at DESC'
  );
  return result.rows;
}

// Get plugin by ID
export async function getPluginById(id: string) {
  const result = await pool.query(
    'SELECT * FROM plugins WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Search plugins
export async function searchPlugins(query: string) {
  const result = await pool.query(
    `SELECT * FROM plugins 
     WHERE name ILIKE $1 OR description ILIKE $1
     ORDER BY created_at DESC`,
    [`%${query}%`]
  );
  return result.rows;
}

// Increment plugin downloads (no-op for now)
export async function incrementDownloads(pluginId: string) {
  logger.info(`Download tracked for plugin: ${pluginId}`);
}
