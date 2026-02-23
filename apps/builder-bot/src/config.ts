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

  // Claude API + CLIProxyAPIPlus
  // CLIProxyAPIPlus даёт бесплатный доступ через GitHub Copilot / AWS Kiro
  // https://github.com/router-for-me/CLIProxyAPIPlus
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || 'free-via-proxy',
    // Локальный прокси на 8317, либо реальный Anthropic API
    baseURL: process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317/v1',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000'),
  },

  // OpenRouter — для Qwen3-Coder-Next (опционально)
  // Если пустой — код генерируется через Claude (прокси)
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder-next',
    baseUrl: 'https://openrouter.ai/api/v1',
  },

  // Owner (владелец платформы)
  owner: {
    id: parseInt(process.env.OWNER_ID || '130806013'),
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

  // Если не прокси и не задан ключ — предупреждаем
  const isProxy = config.claude.baseURL.includes('127.0.0.1') ||
                  config.claude.baseURL.includes('localhost');
  const hasKey = config.claude.apiKey &&
                 config.claude.apiKey !== 'free-via-proxy' &&
                 config.claude.apiKey.length > 10;

  if (!isProxy && !hasKey) {
    errors.push(
      'Either set CLAUDE_BASE_URL to your CLIProxyAPIPlus instance ' +
      'or set ANTHROPIC_API_KEY to a real API key (Anthropic, Gemini, etc.)'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default config;
