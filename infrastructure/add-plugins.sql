-- Добавляем плагины с кодом
INSERT INTO plugins (name, version, author, description, code, permissions, is_builtin, is_active)
VALUES 
(
  'GiftIndex',
  '1.0.0',
  'TON Agent Platform',
  'Telegram gift arbitrage tracker and sniper',
  'async function execute(agent, context) { 
    try {
      context.logger.info("GiftIndex plugin executed");
      return { success: true, data: "Gift tracking active" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }',
  ARRAY['network:external', 'wallet:spend:limited', 'storage:persistent', 'notification'],
  true,
  true
),
(
  'StrategyBuilder',
  '1.0.0',
  'TON Agent Platform',
  'No-code trading strategy builder with backtesting',
  'async function execute(agent, context) {
    try {
      context.logger.info("StrategyBuilder plugin executed");
      return { success: true, data: "Strategy running" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }',
  ARRAY['network:ton', 'wallet:spend:limited', 'storage:persistent'],
  true,
  true
),
(
  'SocialSignals',
  '1.0.0',
  'TON Agent Platform',
  'Social sentiment analysis and whale tracking',
  'async function execute(agent, context) {
    try {
      context.logger.info("SocialSignals plugin executed");
      return { success: true, data: "Monitoring social signals" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }',
  ARRAY['network:external', 'storage:persistent'],
  true,
  true
),
(
  'OnChainAnalytics',
  '1.0.0',
  'TON Agent Platform',
  'Wallet and token analytics on TON blockchain',
  'async function execute(agent, context) {
    try {
      context.logger.info("OnChainAnalytics plugin executed");
      return { success: true, data: "Analytics ready" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }',
  ARRAY['network:ton', 'storage:persistent'],
  true,
  true
),
(
  'Oracle',
  '1.0.0',
  'TON Agent Platform',
  'Price feeds and external data aggregator',
  'async function execute(agent, context) {
    try {
      context.logger.info("Oracle plugin executed");
      return { success: true, data: "Oracle active" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }',
  ARRAY['network:external', 'network:ton', 'storage:persistent'],
  true,
  true
),
(
  'NFTTools',
  '1.0.0',
  'TON Agent Platform',
  'NFT sniping and trading tools',
  'async function execute(agent, context) {
    try {
      context.logger.info("NFTTools plugin executed");
      return { success: true, data: "NFT tools ready" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }',
  ARRAY['network:ton', 'wallet:spend:limited', 'storage:persistent', 'notification'],
  true,
  true
)
ON CONFLICT (name) DO UPDATE SET
  code = EXCLUDED.code,
  version = EXCLUDED.version,
  description = EXCLUDED.description,
  updated_at = NOW();
