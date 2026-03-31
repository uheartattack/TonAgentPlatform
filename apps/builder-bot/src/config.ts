import dotenv from 'dotenv';

dotenv.config();

// Конфигурация бота
export const config = {
  // Telegram Bot
  bot: {
    token: process.env.BOT_TOKEN || '',
    webhookDomain: process.env.WEBHOOK_DOMAIN,
    webhookPort: parseInt(process.env.WEBHOOK_PORT || '3000'),
  },

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    name: process.env.DB_NAME || 'builder_bot',
    ssl: process.env.DB_SSL === 'true',
  },

  // Platform AI (for system prompt generation, orchestrator, etc.)
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: process.env.AI_MODEL || process.env.CLAUDE_MODEL || 'gemini-2.5-flash',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000'),
  },

  // OpenRouter — optional
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder-next',
    baseUrl: 'https://openrouter.ai/api/v1',
  },

  // Owner (владелец платформы)
  owner: {
    id: parseInt(process.env.OWNER_ID || '0'),
  },

  // Security
  security: {
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30'),
    maxExecutionTimeMs: parseInt(process.env.MAX_EXECUTION_TIME_MS || '30000'),
    enableSecurityScan: process.env.ENABLE_SECURITY_SCAN !== 'false',
  },

  // Features
  features: {
    enableMarketplace: process.env.ENABLE_MARKETPLACE === 'true',
    enableScheduler: process.env.ENABLE_SCHEDULER === 'true',
    enableWebhooks: process.env.ENABLE_WEBHOOKS === 'true',
  },
};

// Валидация конфигурации
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.bot.token) {
    errors.push('BOT_TOKEN is required');
  }

  if (!config.claude.apiKey) {
    errors.push(
      'Set OPENAI_API_KEY or ANTHROPIC_API_KEY for platform AI functionality'
    );
  }

  // Wallet encryption key is required in production (NODE_ENV=production or explicit flag)
  if (process.env.NODE_ENV === 'production' && !process.env.WALLET_ENCRYPTION_KEY) {
    errors.push('WALLET_ENCRYPTION_KEY is required in production to encrypt wallet mnemonics');
  }

  if (!process.env.OWNER_ID) {
    errors.push('OWNER_ID is required — set your Telegram user ID');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default config;
