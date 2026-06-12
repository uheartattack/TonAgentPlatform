/**
 * journal.ts — Trading/operation journal with P&L tracking.
 * Adapted from teleton-agent deals/journal pattern.
 * Logs trades, verifies payments, tracks profit/loss.
 */

import { randomUUID } from 'crypto';

let _pool: any = null;
async function getPool() {
  if (!_pool) { const { pool } = await import('../db'); _pool = pool; }
  return _pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface JournalEntry {
  id: string;
  agentId: number;
  type: 'trade' | 'gift_buy' | 'gift_sell' | 'send' | 'receive' | 'swap' | 'deal' | 'other';
  asset: string;         // e.g. "TON", "ChillGuy #123", "USDT"
  direction: 'buy' | 'sell' | 'send' | 'receive';
  amount: number;
  price?: number;        // unit price at time of operation
  totalValue?: number;   // amount * price
  fee?: number;
  pnl?: number;          // profit/loss (filled on close/update)
  reasoning: string;     // AI's reasoning for the trade
  status: 'open' | 'closed' | 'cancelled';
  counterparty?: string; // who we traded with
  txHash?: string;       // blockchain tx hash
  metadata?: any;
  createdAt: string;
  closedAt?: string;
}

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENSURE TABLE
// ═══════════════════════════════════════════════════════════════════════════

let _tableReady = false;
async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.agent_journal (
      id TEXT PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      asset TEXT NOT NULL DEFAULT '',
      direction TEXT NOT NULL DEFAULT 'buy',
      amount NUMERIC(20,8) DEFAULT 0,
      price NUMERIC(20,8),
      total_value NUMERIC(20,8),
      fee NUMERIC(20,8) DEFAULT 0,
      pnl NUMERIC(20,8),
      reasoning TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      counterparty TEXT,
      tx_hash TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_journal_agent ON builder_bot.agent_journal(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_journal_status ON builder_bot.agent_journal(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_journal_asset ON builder_bot.agent_journal(agent_id, asset);
  `);
  _tableReady = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function logTrade(agentId: number, entry: Partial<JournalEntry>): Promise<JournalEntry> {
  await ensureTable();
  const pool = await getPool();
  const id = randomUUID();
  const totalValue = (entry.amount || 0) * (entry.price || 0);

  await pool.query(
    `INSERT INTO builder_bot.agent_journal (id, agent_id, type, asset, direction, amount, price, total_value, fee, reasoning, status, counterparty, tx_hash, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [id, agentId, entry.type || 'other', entry.asset || '', entry.direction || 'buy',
     entry.amount || 0, entry.price || null, totalValue || null, entry.fee || 0,
     entry.reasoning || '', 'open', entry.counterparty || null, entry.txHash || null,
     entry.metadata ? JSON.stringify(entry.metadata) : null]
  );

  return {
    id, agentId, type: entry.type || 'other', asset: entry.asset || '',
    direction: entry.direction || 'buy', amount: entry.amount || 0,
    price: entry.price, totalValue, fee: entry.fee,
    reasoning: entry.reasoning || '', status: 'open',
    counterparty: entry.counterparty, txHash: entry.txHash,
    metadata: entry.metadata, createdAt: new Date().toISOString(),
  };
}

export async function updateTrade(
  agentId: number, tradeId: string,
  updates: { pnl?: number; status?: string; txHash?: string; reasoning?: string }
): Promise<JournalEntry | null> {
  await ensureTable();
  const pool = await getPool();
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (updates.pnl !== undefined) { sets.push(`pnl = $${idx}`); params.push(updates.pnl); idx++; }
  if (updates.status) {
    sets.push(`status = $${idx}`); params.push(updates.status); idx++;
    if (updates.status === 'closed' || updates.status === 'cancelled') sets.push(`closed_at = NOW()`);
  }
  if (updates.txHash) { sets.push(`tx_hash = $${idx}`); params.push(updates.txHash); idx++; }
  if (updates.reasoning) { sets.push(`reasoning = reasoning || E'\\n' || $${idx}`); params.push(updates.reasoning); idx++; }

  if (sets.length === 0) return null;
  params.push(tradeId, agentId);
  await pool.query(
    `UPDATE builder_bot.agent_journal SET ${sets.join(', ')} WHERE id = $${idx} AND agent_id = $${idx + 1}`,
    params
  );

  return queryTrade(agentId, tradeId);
}

export async function queryTrade(agentId: number, tradeId: string): Promise<JournalEntry | null> {
  await ensureTable();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT * FROM builder_bot.agent_journal WHERE id = $1 AND agent_id = $2`,
    [tradeId, agentId]
  );
  return res.rows[0] ? rowToEntry(res.rows[0]) : null;
}

export async function queryJournal(
  agentId: number,
  filters?: { type?: string; asset?: string; status?: string; limit?: number; days?: number }
): Promise<JournalEntry[]> {
  await ensureTable();
  const pool = await getPool();
  let query = `SELECT * FROM builder_bot.agent_journal WHERE agent_id = $1`;
  const params: any[] = [agentId];
  let idx = 2;

  if (filters?.type) { query += ` AND type = $${idx}`; params.push(filters.type); idx++; }
  if (filters?.asset) { query += ` AND asset ILIKE $${idx}`; params.push(`%${filters.asset}%`); idx++; }
  if (filters?.status) { query += ` AND status = $${idx}`; params.push(filters.status); idx++; }
  if (filters?.days) { query += ` AND created_at >= NOW() - INTERVAL '${Math.min(filters.days, 365)} days'`; }
  query += ` ORDER BY created_at DESC LIMIT $${idx}`;
  params.push(filters?.limit || 50);

  const res = await pool.query(query, params);
  return res.rows.map(rowToEntry);
}

export async function getJournalStats(agentId: number, days: number = 30): Promise<JournalStats> {
  await ensureTable();
  const pool = await getPool();
  const res = await pool.query(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as open_count,
      COALESCE(SUM(pnl), 0) as total_pnl,
      COUNT(*) FILTER (WHERE pnl > 0) as wins,
      COUNT(*) FILTER (WHERE pnl IS NOT NULL AND pnl != 0) as settled,
      COALESCE(AVG(pnl) FILTER (WHERE pnl IS NOT NULL AND pnl != 0), 0) as avg_pnl,
      COALESCE(MAX(pnl), 0) as best,
      COALESCE(MIN(pnl), 0) as worst
    FROM builder_bot.agent_journal
    WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '${Math.min(days, 365)} days'`,
    [agentId]
  );
  const r = res.rows[0];
  const settled = Number(r.settled) || 0;
  return {
    totalTrades: Number(r.total) || 0,
    openTrades: Number(r.open_count) || 0,
    totalPnl: Number(r.total_pnl) || 0,
    winRate: settled > 0 ? Number(r.wins) / settled : 0,
    avgPnl: Number(r.avg_pnl) || 0,
    bestTrade: Number(r.best) || 0,
    worstTrade: Number(r.worst) || 0,
  };
}

function rowToEntry(r: any): JournalEntry {
  return {
    id: r.id, agentId: r.agent_id,
    type: r.type, asset: r.asset, direction: r.direction,
    amount: Number(r.amount), price: r.price ? Number(r.price) : undefined,
    totalValue: r.total_value ? Number(r.total_value) : undefined,
    fee: r.fee ? Number(r.fee) : undefined, pnl: r.pnl ? Number(r.pnl) : undefined,
    reasoning: r.reasoning || '', status: r.status,
    counterparty: r.counterparty, txHash: r.tx_hash,
    metadata: r.metadata, createdAt: new Date(r.created_at).toISOString(),
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : undefined,
  };
}
