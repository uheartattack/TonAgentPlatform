-- Composite indexes for hot query paths.
-- All CONCURRENTLY so we don't lock tables; IF NOT EXISTS so re-runnable.
-- Each one must be its own statement (CONCURRENTLY can't be in a transaction).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_logs_agent_created
  ON builder_bot.agent_logs(agent_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_balance_tx_user_created
  ON builder_bot.balance_transactions(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_status_created
  ON builder_bot.feedback(status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_history_agent_created
  ON builder_bot.execution_history(agent_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_traces_agent_started
  ON builder_bot.agent_traces(agent_id, started_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_created
  ON builder_bot.conversations(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_usage_agent_created
  ON builder_bot.agent_token_usage(agent_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_beta_snapshots_user_created
  ON builder_bot.beta_snapshots(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_agent_created
  ON builder_bot.agent_audit_log(agent_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_user_active
  ON builder_bot.agents(user_id, is_active);
