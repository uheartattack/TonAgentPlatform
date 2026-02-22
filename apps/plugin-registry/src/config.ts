import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://ton_agent:ton_password@localhost:5432/ton_agent_platform',
  },
  cors: {
    origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },
  environment: process.env.NODE_ENV || 'development',
};
