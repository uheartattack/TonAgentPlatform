import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'builder_bot',
    ssl: process.env.DB_SSL === 'true',
  },
} satisfies Config;
