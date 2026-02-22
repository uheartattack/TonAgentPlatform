-- TON Agent Platform Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tg_id BIGINT UNIQUE NOT NULL,
    tg_username VARCHAR(255),
    wallet_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_tg_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    current_version VARCHAR(50) DEFAULT '1.0.0',
    template_type VARCHAR(50) DEFAULT 'custom',

    -- Wallet
    wallet_address VARCHAR(255) NOT NULL,
    wallet_mnemonic_encrypted TEXT NOT NULL,
    wallet_max_spend_per_tx DECIMAL(20, 9) DEFAULT 1.0,
    wallet_max_spend_per_day DECIMAL(20, 9) DEFAULT 10.0,
    wallet_balance DECIMAL(20, 9) DEFAULT 0.0,

    -- Triggers
    trigger_type VARCHAR(50) DEFAULT 'manual',
    trigger_config JSONB DEFAULT '{}',
    user_priority INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'paused',
    error_count INTEGER DEFAULT 0,
    last_run_at TIMESTAMP,
    last_error_at TIMESTAMP,
    last_error_message TEXT,

    -- Marketplace
    is_public BOOLEAN DEFAULT FALSE,
    is_purchasable BOOLEAN DEFAULT FALSE,
    purchase_price_ton DECIMAL(20, 9),
    rent_price_ton_per_day DECIMAL(20, 9),
    author_id UUID,

    -- Stats
    total_executions INTEGER DEFAULT 0,
    total_spent_ton DECIMAL(20, 9) DEFAULT 0.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent versions table
CREATE TABLE IF NOT EXISTS agent_versions (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    result JSONB,
    gas_used DECIMAL(20, 9),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50) NOT NULL,
    author VARCHAR(255),
    description TEXT,
    code TEXT NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    is_builtin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    price_ton DECIMAL(20, 9) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent-Plugin associations
CREATE TABLE IF NOT EXISTS agent_plugins (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, plugin_id)
);

-- Plugin execution logs
CREATE TABLE IF NOT EXISTS plugin_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    input JSONB,
    output JSONB,
    error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI logs table
CREATE TABLE IF NOT EXISTS ai_logs (
    id SERIAL PRIMARY KEY,
    user_tg_id BIGINT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    tokens_used INTEGER,
    duration_ms INTEGER,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_agents_owner ON agents(owner_tg_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_public ON agents(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_executions_agent ON executions(agent_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_plugin_logs_agent ON plugin_execution_logs(agent_id);
CREATE INDEX idx_ai_logs_user ON ai_logs(user_tg_id);

-- Insert built-in plugins
-- INSERT INTO plugins (name, version, author, description, permissions, is_builtin, is_active) VALUES
('GiftIndex', '1.0.0', 'TON Agent Platform', 'Telegram gift arbitrage tracker and sniper',
 ARRAY['network:external', 'wallet:spend:limited', 'storage:persistent', 'notification'],
 TRUE, TRUE),

('StrategyBuilder', '1.0.0', 'TON Agent Platform', 'Visual trading strategy builder with templates',
 ARRAY['wallet:spend:limited', 'storage:persistent', 'notification'],
 TRUE, TRUE),

('SocialSignals', '1.0.0', 'TON Agent Platform', 'Social media sentiment analysis and signals',
 ARRAY['network:external', 'storage:persistent', 'notification'],
 TRUE, TRUE),

('OnChainAnalytics', '1.0.0', 'TON Agent Platform', 'TON blockchain analytics and wallet tracking',
 ARRAY['network:ton', 'storage:persistent', 'notification'],
 TRUE, TRUE),

('Oracle', '1.0.0', 'TON Agent Platform', 'Price feeds and external data aggregator',
 ARRAY['network:external', 'network:ton', 'storage:persistent'],
 TRUE, TRUE),

('NFTTools', '1.0.0', 'TON Agent Platform', 'NFT sniping and trading tools',
 ARRAY['network:ton', 'wallet:spend:limited', 'storage:persistent', 'notification'],
 TRUE, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugins_updated_at BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
