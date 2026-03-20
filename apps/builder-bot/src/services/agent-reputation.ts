/**
 * agent-reputation.ts — Trust Score, Leaderboard, KYA (Know Your Agent), GDP Dashboard.
 *
 * Tables (builder_bot schema):
 *   agent_reviews        — user reviews for agents
 *   trust_scores         — cached trust score breakdown per agent
 *   agent_gdp_snapshots  — daily platform-wide GDP snapshots
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TrustTier = 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TrustMetrics {
  uptimeScore: number;      // 0-100
  successRate: number;       // 0-100
  userRating: number;        // 0-100
  financialSafety: number;   // 0-100
  communityTrust: number;    // 0-100
}

export interface TrustScore {
  agentId: number;
  score: number;             // 0-100 composite
  tier: TrustTier;
  metrics: TrustMetrics;
  updatedAt: Date;
}

export interface AgentReview {
  id: number;
  agentId: number;
  reviewerId: number;
  rating: number;            // 1-5
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LeaderboardMetric = 'rating' | 'executions' | 'uptime';
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';

export interface LeaderboardEntry {
  agentId: number;
  agentName: string;
  ownerId: number;
  value: number;
  rank: number;
  tier: TrustTier;
}

export interface KYACapabilities {
  canSendTon: boolean;
  canReadMessages: boolean;
  canModerateGroups: boolean;
  canAccessWallet: boolean;
  canCallExternalAPIs: boolean;
  canScheduleTasks: boolean;
  canManageState: boolean;
  canSendNotifications: boolean;
}

export interface KYAReport {
  agentId: number;
  agentName: string;
  creatorId: number;
  codeHash: string;
  codeLength: number;
  capabilities: KYACapabilities;
  warnings: string[];
  limits: {
    maxExecutionsPerHour: number;
    maxTonPerTransaction: number;
    requiresApproval: boolean;
  };
  trustScore: TrustScore | null;
  createdAt: Date;
}

export interface GDPSnapshot {
  id: number;
  date: string;              // YYYY-MM-DD
  totalAgents: number;
  activeAgents: number;
  totalCreators: number;
  executions24h: number;
  executions7d: number;
  executionsAll: number;
  tonVolume24h: number;
  tonVolume7d: number;
  tonVolumeAll: number;
  avgTrustScore: number;
  growthRateAgents: number;  // % vs previous snapshot
  growthRateExecs: number;   // % vs previous snapshot
  createdAt: Date;
}

export interface PlatformGDP {
  current: Omit<GDPSnapshot, 'id' | 'createdAt'>;
  history: Pick<GDPSnapshot, 'date' | 'totalAgents' | 'activeAgents' | 'executionsAll' | 'tonVolumeAll'>[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let _pool: Pool | null = null;

function pool(): Pool {
  if (!_pool) throw new Error('agent-reputation: not initialized. Call initReputation(pool) first.');
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT — DDL (idempotent)
// ═══════════════════════════════════════════════════════════════════════════════

export async function initReputation(p: Pool): Promise<void> {
  _pool = p;
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    await client.query(`CREATE SCHEMA IF NOT EXISTS builder_bot`);

    // agent_reviews
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_reviews (
        id          SERIAL PRIMARY KEY,
        agent_id    INTEGER NOT NULL,
        reviewer_id BIGINT NOT NULL,
        rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment     TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT agent_reviews_unique UNIQUE (agent_id, reviewer_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_reviews_agent ON builder_bot.agent_reviews (agent_id)
    `);

    // trust_scores
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.trust_scores (
        agent_id       INTEGER PRIMARY KEY,
        score          REAL NOT NULL DEFAULT 0,
        tier           TEXT NOT NULL DEFAULT 'unverified',
        uptime_score   REAL NOT NULL DEFAULT 0,
        success_rate   REAL NOT NULL DEFAULT 0,
        user_rating    REAL NOT NULL DEFAULT 0,
        financial_safety REAL NOT NULL DEFAULT 0,
        community_trust  REAL NOT NULL DEFAULT 0,
        updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // agent_gdp_snapshots
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_bot.agent_gdp_snapshots (
        id                SERIAL PRIMARY KEY,
        snapshot_date     DATE NOT NULL UNIQUE,
        total_agents      INTEGER NOT NULL DEFAULT 0,
        active_agents     INTEGER NOT NULL DEFAULT 0,
        total_creators    INTEGER NOT NULL DEFAULT 0,
        executions_24h    INTEGER NOT NULL DEFAULT 0,
        executions_7d     INTEGER NOT NULL DEFAULT 0,
        executions_all    INTEGER NOT NULL DEFAULT 0,
        ton_volume_24h    REAL NOT NULL DEFAULT 0,
        ton_volume_7d     REAL NOT NULL DEFAULT 0,
        ton_volume_all    REAL NOT NULL DEFAULT 0,
        avg_trust_score   REAL NOT NULL DEFAULT 0,
        growth_rate_agents REAL NOT NULL DEFAULT 0,
        growth_rate_execs  REAL NOT NULL DEFAULT 0,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TRUST SCORE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function tierFromScore(score: number): TrustTier {
  if (score >= 90) return 'platinum';
  if (score >= 75) return 'gold';
  if (score >= 55) return 'silver';
  if (score >= 30) return 'bronze';
  return 'unverified';
}

/**
 * Calculate (or recalculate) the trust score for an agent.
 * Queries agent_logs, execution_history, and agent_reviews to derive metrics,
 * then upserts into trust_scores.
 */
export async function calculateTrustScore(agentId: number): Promise<TrustScore> {
  const p = pool();

  // --- Uptime score ---
  // Based on execution_history: ratio of non-error executions in the last 30 days
  const uptimeRes = await p.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('success', 'running')) AS up,
      COUNT(*) AS total
    FROM builder_bot.execution_history
    WHERE agent_id = $1 AND started_at > NOW() - INTERVAL '30 days'
  `, [agentId]);
  const uptimeTotal = parseInt(uptimeRes.rows[0]?.total || '0', 10);
  const uptimeUp = parseInt(uptimeRes.rows[0]?.up || '0', 10);
  const uptimeScore = uptimeTotal > 0 ? Math.round((uptimeUp / uptimeTotal) * 100) : 0;

  // --- Success rate ---
  // Based on execution_history: ratio of 'success' to total (all time)
  const successRes = await p.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'success') AS ok,
      COUNT(*) AS total
    FROM builder_bot.execution_history
    WHERE agent_id = $1
  `, [agentId]);
  const successTotal = parseInt(successRes.rows[0]?.total || '0', 10);
  const successOk = parseInt(successRes.rows[0]?.ok || '0', 10);
  const successRate = successTotal > 0 ? Math.round((successOk / successTotal) * 100) : 0;

  // --- User rating ---
  // Average from agent_reviews, scaled to 0-100
  const ratingRes = await p.query(`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt
    FROM builder_bot.agent_reviews
    WHERE agent_id = $1
  `, [agentId]);
  const avgRating = parseFloat(ratingRes.rows[0]?.avg_rating || '0');
  const ratingCount = parseInt(ratingRes.rows[0]?.cnt || '0', 10);
  // Scale 1-5 to 0-100; if no reviews, 50 (neutral)
  const userRating = ratingCount > 0 ? Math.round(((avgRating - 1) / 4) * 100) : 50;

  // --- Financial safety ---
  // Check for error logs mentioning TON/wallet/transaction failures
  const finRes = await p.query(`
    SELECT
      COUNT(*) FILTER (WHERE level = 'error' AND (
        lower(message) LIKE '%ton%' OR lower(message) LIKE '%wallet%' OR
        lower(message) LIKE '%transaction%' OR lower(message) LIKE '%transfer%'
      )) AS fin_errors,
      COUNT(*) AS total_logs
    FROM builder_bot.agent_logs
    WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '30 days'
  `, [agentId]);
  const finErrors = parseInt(finRes.rows[0]?.fin_errors || '0', 10);
  const totalLogs = parseInt(finRes.rows[0]?.total_logs || '0', 10);
  // Fewer financial errors = higher safety. Max penalty if >10% of logs are financial errors.
  const finErrorRatio = totalLogs > 0 ? finErrors / totalLogs : 0;
  const financialSafety = Math.round(Math.max(0, (1 - finErrorRatio * 10)) * 100);

  // --- Community trust ---
  // Combination of: number of unique reviewers and total executions (popularity proxy)
  const communityRes = await p.query(`
    SELECT
      (SELECT COUNT(DISTINCT reviewer_id) FROM builder_bot.agent_reviews WHERE agent_id = $1) AS reviewers,
      (SELECT COUNT(*) FROM builder_bot.execution_history WHERE agent_id = $1) AS execs
  `, [agentId]);
  const reviewers = parseInt(communityRes.rows[0]?.reviewers || '0', 10);
  const execs = parseInt(communityRes.rows[0]?.execs || '0', 10);
  // Score: min(100, reviewers*10 + log2(execs+1)*5)
  const communityTrust = Math.min(100, Math.round(reviewers * 10 + Math.log2(execs + 1) * 5));

  // --- Weighted composite ---
  const metrics: TrustMetrics = { uptimeScore, successRate, userRating, financialSafety, communityTrust };
  const score = Math.round(
    uptimeScore * 0.25 +
    successRate * 0.25 +
    userRating * 0.20 +
    financialSafety * 0.20 +
    communityTrust * 0.10
  );
  const tier = tierFromScore(score);

  // Upsert
  await p.query(`
    INSERT INTO builder_bot.trust_scores
      (agent_id, score, tier, uptime_score, success_rate, user_rating, financial_safety, community_trust, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (agent_id) DO UPDATE SET
      score = EXCLUDED.score,
      tier = EXCLUDED.tier,
      uptime_score = EXCLUDED.uptime_score,
      success_rate = EXCLUDED.success_rate,
      user_rating = EXCLUDED.user_rating,
      financial_safety = EXCLUDED.financial_safety,
      community_trust = EXCLUDED.community_trust,
      updated_at = NOW()
  `, [agentId, score, tier, uptimeScore, successRate, userRating, financialSafety, communityTrust]);

  return { agentId, score, tier, metrics, updatedAt: new Date() };
}

/**
 * Get cached trust score (without recalculating).
 */
export async function getTrustScore(agentId: number): Promise<TrustScore | null> {
  const res = await pool().query(
    `SELECT * FROM builder_bot.trust_scores WHERE agent_id = $1`, [agentId]
  );
  if (!res.rows[0]) return null;
  const r = res.rows[0];
  return {
    agentId: r.agent_id,
    score: r.score,
    tier: r.tier as TrustTier,
    metrics: {
      uptimeScore: r.uptime_score,
      successRate: r.success_rate,
      userRating: r.user_rating,
      financialSafety: r.financial_safety,
      communityTrust: r.community_trust,
    },
    updatedAt: r.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add or update a review for an agent.
 * Upserts on (agent_id, reviewer_id), then recalculates trust score.
 */
export async function addReview(
  agentId: number,
  reviewerId: number,
  rating: number,
  comment?: string | null
): Promise<AgentReview> {
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

  const res = await pool().query(`
    INSERT INTO builder_bot.agent_reviews (agent_id, reviewer_id, rating, comment)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (agent_id, reviewer_id) DO UPDATE SET
      rating = EXCLUDED.rating,
      comment = EXCLUDED.comment,
      updated_at = NOW()
    RETURNING *
  `, [agentId, reviewerId, rating, comment || null]);

  const row = res.rows[0];

  // Recalculate trust score in background (fire-and-forget)
  calculateTrustScore(agentId).catch(() => {});

  return {
    id: row.id,
    agentId: row.agent_id,
    reviewerId: row.reviewer_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get reviews for an agent, ordered by most recent.
 */
export async function getReviews(agentId: number, limit: number = 20): Promise<AgentReview[]> {
  const res = await pool().query(
    `SELECT * FROM builder_bot.agent_reviews WHERE agent_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [agentId, limit]
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    agentId: r.agent_id,
    reviewerId: r.reviewer_id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a ranked leaderboard of agents by a specific metric and period.
 */
export async function getLeaderboard(
  metric: LeaderboardMetric = 'rating',
  period: LeaderboardPeriod = 'alltime',
  limit: number = 20
): Promise<LeaderboardEntry[]> {
  const p = pool();

  const periodClause = period === 'weekly'
    ? `AND eh.started_at > NOW() - INTERVAL '7 days'`
    : period === 'monthly'
      ? `AND eh.started_at > NOW() - INTERVAL '30 days'`
      : '';

  let query: string;

  switch (metric) {
    case 'rating':
      query = `
        SELECT
          a.id AS agent_id,
          a.name AS agent_name,
          a.user_id AS owner_id,
          COALESCE(AVG(r.rating), 0) AS value,
          COALESCE(ts.tier, 'unverified') AS tier
        FROM builder_bot.agents a
        LEFT JOIN builder_bot.agent_reviews r ON r.agent_id = a.id
        LEFT JOIN builder_bot.trust_scores ts ON ts.agent_id = a.id
        GROUP BY a.id, a.name, a.user_id, ts.tier
        HAVING COUNT(r.id) > 0
        ORDER BY value DESC, COUNT(r.id) DESC
        LIMIT $1
      `;
      break;

    case 'executions':
      query = `
        SELECT
          a.id AS agent_id,
          a.name AS agent_name,
          a.user_id AS owner_id,
          COUNT(eh.id) AS value,
          COALESCE(ts.tier, 'unverified') AS tier
        FROM builder_bot.agents a
        INNER JOIN builder_bot.execution_history eh ON eh.agent_id = a.id ${periodClause}
        LEFT JOIN builder_bot.trust_scores ts ON ts.agent_id = a.id
        GROUP BY a.id, a.name, a.user_id, ts.tier
        ORDER BY value DESC
        LIMIT $1
      `;
      break;

    case 'uptime':
      query = `
        SELECT
          a.id AS agent_id,
          a.name AS agent_name,
          a.user_id AS owner_id,
          COALESCE(ts.uptime_score, 0) AS value,
          COALESCE(ts.tier, 'unverified') AS tier
        FROM builder_bot.agents a
        LEFT JOIN builder_bot.trust_scores ts ON ts.agent_id = a.id
        WHERE ts.uptime_score IS NOT NULL
        ORDER BY value DESC
        LIMIT $1
      `;
      break;

    default:
      throw new Error(`Unknown leaderboard metric: ${metric}`);
  }

  const res = await p.query(query, [limit]);

  return res.rows.map((r: any, i: number) => ({
    agentId: r.agent_id,
    agentName: r.agent_name || `Agent #${r.agent_id}`,
    ownerId: Number(r.owner_id),
    value: parseFloat(r.value) || 0,
    rank: i + 1,
    tier: (r.tier || 'unverified') as TrustTier,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. KYA (Know Your Agent)
// ═══════════════════════════════════════════════════════════════════════════════

const CAPABILITY_PATTERNS: Record<keyof KYACapabilities, RegExp[]> = {
  canSendTon: [
    /send.*ton/i, /transfer/i, /wallet.*send/i, /sendTransaction/i, /internalMessage/i,
    /tonTransfer/i, /sendCoins/i,
  ],
  canReadMessages: [
    /on\(['"]message/i, /ctx\.message/i, /getMessage/i, /readMessage/i,
    /bot\.on/i, /onMessage/i,
  ],
  canModerateGroups: [
    /ban/i, /kick/i, /mute/i, /restrict/i, /deleteMessage/i,
    /promoteChatMember/i, /setChatPermissions/i,
  ],
  canAccessWallet: [
    /wallet/i, /mnemonic/i, /privateKey/i, /keyPair/i,
    /WalletContract/i, /getBalance/i,
  ],
  canCallExternalAPIs: [
    /fetch\(/i, /axios/i, /http\.get/i, /https\.get/i,
    /fetch_url/i, /web_search/i, /XMLHttpRequest/i,
  ],
  canScheduleTasks: [
    /setInterval/i, /setTimeout/i, /cron/i, /schedule/i,
    /scheduler/i, /recurring/i,
  ],
  canManageState: [
    /setState/i, /getState/i, /set_state/i, /get_state/i,
    /persistent/i, /storage/i,
  ],
  canSendNotifications: [
    /notify/i, /notification/i, /sendMessage/i, /telegram.*send/i,
    /notify_rich/i, /alert/i,
  ],
};

/**
 * Analyze an agent's code and metadata to produce a KYA report.
 */
export async function getKYA(agentId: number): Promise<KYAReport> {
  const p = pool();

  const agentRes = await p.query(
    `SELECT id, name, user_id, code, trigger_type, trigger_config, created_at
     FROM builder_bot.agents WHERE id = $1`,
    [agentId]
  );
  if (!agentRes.rows[0]) throw new Error(`Agent ${agentId} not found`);

  const agent = agentRes.rows[0];
  const code: string = agent.code || '';
  const triggerConfig = typeof agent.trigger_config === 'string'
    ? JSON.parse(agent.trigger_config)
    : agent.trigger_config || {};

  // Code hash
  const codeHash = createHash('sha256').update(code).digest('hex');

  // Detect capabilities
  const capabilities: KYACapabilities = {
    canSendTon: false,
    canReadMessages: false,
    canModerateGroups: false,
    canAccessWallet: false,
    canCallExternalAPIs: false,
    canScheduleTasks: false,
    canManageState: false,
    canSendNotifications: false,
  };

  for (const [cap, patterns] of Object.entries(CAPABILITY_PATTERNS)) {
    capabilities[cap as keyof KYACapabilities] = patterns.some(re => re.test(code));
  }

  // Warnings
  const warnings: string[] = [];

  if (capabilities.canSendTon && capabilities.canCallExternalAPIs) {
    warnings.push('Agent can both send TON and call external APIs -- risk of exfiltration');
  }
  if (capabilities.canAccessWallet && !capabilities.canSendNotifications) {
    warnings.push('Agent accesses wallet but does not send notifications -- silent operations');
  }
  if (code.length > 50_000) {
    warnings.push('Agent code is very large (>50KB) -- harder to audit');
  }
  if (/eval\(|Function\(|new Function/i.test(code)) {
    warnings.push('Agent uses dynamic code execution (eval/Function) -- potential security risk');
  }
  if (/mnemonic|private.?key|secret/i.test(code)) {
    warnings.push('Agent code references secrets/private keys directly');
  }
  if (capabilities.canModerateGroups && !capabilities.canReadMessages) {
    warnings.push('Agent has moderation capabilities without explicit message reading');
  }

  // Limits (based on trigger type and config)
  const isAiAgent = agent.trigger_type === 'ai_agent';
  const limits = {
    maxExecutionsPerHour: isAiAgent ? 60 : (triggerConfig.maxPerHour || 120),
    maxTonPerTransaction: triggerConfig.config?.maxTonPerTx || 10,
    requiresApproval: capabilities.canSendTon && !isAiAgent,
  };

  // Trust score (cached)
  const trustScore = await getTrustScore(agentId);

  return {
    agentId,
    agentName: agent.name || `Agent #${agentId}`,
    creatorId: Number(agent.user_id),
    codeHash,
    codeLength: code.length,
    capabilities,
    warnings,
    limits,
    trustScore,
    createdAt: agent.created_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GDP DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect and return platform-wide GDP stats.
 * Also saves a daily snapshot (upsert on date).
 */
export async function getPlatformGDP(): Promise<PlatformGDP> {
  const p = pool();

  // Total and active agents
  const agentsRes = await p.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_active = true) AS active,
      COUNT(DISTINCT user_id) AS creators
    FROM builder_bot.agents
  `);
  const totalAgents = parseInt(agentsRes.rows[0].total, 10);
  const activeAgents = parseInt(agentsRes.rows[0].active, 10);
  const totalCreators = parseInt(agentsRes.rows[0].creators, 10);

  // Executions by period
  const execsRes = await p.query(`
    SELECT
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS h24,
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') AS d7,
      COUNT(*) AS all_time
    FROM builder_bot.execution_history
  `);
  const executions24h = parseInt(execsRes.rows[0].h24, 10);
  const executions7d = parseInt(execsRes.rows[0].d7, 10);
  const executionsAll = parseInt(execsRes.rows[0].all_time, 10);

  // TON volume from execution results that contain ton_amount
  const tonRes = await p.query(`
    SELECT
      COALESCE(SUM(CASE WHEN started_at > NOW() - INTERVAL '24 hours'
        THEN CASE WHEN (result_summary->>'ton_amount') ~ '^[0-9]+(\\.[0-9]+)?$'
             THEN (result_summary->>'ton_amount')::real ELSE 0 END
        ELSE 0 END), 0) AS vol_24h,
      COALESCE(SUM(CASE WHEN started_at > NOW() - INTERVAL '7 days'
        THEN CASE WHEN (result_summary->>'ton_amount') ~ '^[0-9]+(\\.[0-9]+)?$'
             THEN (result_summary->>'ton_amount')::real ELSE 0 END
        ELSE 0 END), 0) AS vol_7d,
      COALESCE(SUM(CASE WHEN (result_summary->>'ton_amount') ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN (result_summary->>'ton_amount')::real ELSE 0 END), 0) AS vol_all
    FROM builder_bot.execution_history
    WHERE result_summary->>'ton_amount' IS NOT NULL
  `);
  const tonVolume24h = parseFloat(tonRes.rows[0].vol_24h) || 0;
  const tonVolume7d = parseFloat(tonRes.rows[0].vol_7d) || 0;
  const tonVolumeAll = parseFloat(tonRes.rows[0].vol_all) || 0;

  // Average trust score
  const trustRes = await p.query(`
    SELECT COALESCE(AVG(score), 0) AS avg_score FROM builder_bot.trust_scores
  `);
  const avgTrustScore = Math.round(parseFloat(trustRes.rows[0].avg_score) * 10) / 10;

  // Previous snapshot for growth rate calculation
  const prevRes = await p.query(`
    SELECT total_agents, executions_all
    FROM builder_bot.agent_gdp_snapshots
    ORDER BY snapshot_date DESC LIMIT 1
  `);
  const prevAgents = prevRes.rows[0] ? parseInt(prevRes.rows[0].total_agents, 10) : totalAgents;
  const prevExecs = prevRes.rows[0] ? parseInt(prevRes.rows[0].executions_all, 10) : executionsAll;

  const growthRateAgents = prevAgents > 0
    ? Math.round(((totalAgents - prevAgents) / prevAgents) * 1000) / 10
    : 0;
  const growthRateExecs = prevExecs > 0
    ? Math.round(((executionsAll - prevExecs) / prevExecs) * 1000) / 10
    : 0;

  const today = new Date().toISOString().slice(0, 10);

  // Upsert daily snapshot
  await p.query(`
    INSERT INTO builder_bot.agent_gdp_snapshots
      (snapshot_date, total_agents, active_agents, total_creators,
       executions_24h, executions_7d, executions_all,
       ton_volume_24h, ton_volume_7d, ton_volume_all,
       avg_trust_score, growth_rate_agents, growth_rate_execs)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (snapshot_date) DO UPDATE SET
      total_agents = EXCLUDED.total_agents,
      active_agents = EXCLUDED.active_agents,
      total_creators = EXCLUDED.total_creators,
      executions_24h = EXCLUDED.executions_24h,
      executions_7d = EXCLUDED.executions_7d,
      executions_all = EXCLUDED.executions_all,
      ton_volume_24h = EXCLUDED.ton_volume_24h,
      ton_volume_7d = EXCLUDED.ton_volume_7d,
      ton_volume_all = EXCLUDED.ton_volume_all,
      avg_trust_score = EXCLUDED.avg_trust_score,
      growth_rate_agents = EXCLUDED.growth_rate_agents,
      growth_rate_execs = EXCLUDED.growth_rate_execs
  `, [today, totalAgents, activeAgents, totalCreators,
      executions24h, executions7d, executionsAll,
      tonVolume24h, tonVolume7d, tonVolumeAll,
      avgTrustScore, growthRateAgents, growthRateExecs]);

  // Recent history (last 30 snapshots)
  const histRes = await p.query(`
    SELECT snapshot_date AS date, total_agents, active_agents, executions_all, ton_volume_all
    FROM builder_bot.agent_gdp_snapshots
    ORDER BY snapshot_date DESC
    LIMIT 30
  `);

  return {
    current: {
      date: today,
      totalAgents,
      activeAgents,
      totalCreators,
      executions24h,
      executions7d,
      executionsAll,
      tonVolume24h,
      tonVolume7d,
      tonVolumeAll,
      avgTrustScore,
      growthRateAgents,
      growthRateExecs,
    },
    history: histRes.rows.map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      totalAgents: parseInt(r.total_agents, 10),
      activeAgents: parseInt(r.active_agents, 10),
      executionsAll: parseInt(r.executions_all, 10),
      tonVolumeAll: parseFloat(r.ton_volume_all) || 0,
    })),
  };
}
