-- Builder Bot schema (отдельно от основной платформы)
CREATE SCHEMA IF NOT EXISTS builder_bot;

-- Таблица агентов
CREATE TABLE IF NOT EXISTS builder_bot.agents (
  id           SERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  code         TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_config JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bb_agents_user_id   ON builder_bot.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_bb_agents_is_active ON builder_bot.agents(is_active);

-- Таблица сообщений (память оркестратора)
CREATE TABLE IF NOT EXISTS builder_bot.conversations (
  id         SERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bb_conv_user_session ON builder_bot.conversations(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_bb_conv_created      ON builder_bot.conversations(created_at);

-- Таблица сессий
CREATE TABLE IF NOT EXISTS builder_bot.sessions (
  id               SERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL UNIQUE,
  session_id       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active',
  context          JSONB DEFAULT '{}',
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bb_sessions_user ON builder_bot.sessions(user_id);

-- Таблица для хранения TON Connect сессий (персистентно, не теряется при рестарте бота)
CREATE TABLE IF NOT EXISTS builder_bot.ton_connect_sessions (
  user_id    BIGINT NOT NULL,
  key        VARCHAR(255) NOT NULL,
  value      TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_bb_tc_sessions_user ON builder_bot.ton_connect_sessions(user_id);

SELECT 'OK: builder_bot schema ready' as result;
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'builder_bot';
