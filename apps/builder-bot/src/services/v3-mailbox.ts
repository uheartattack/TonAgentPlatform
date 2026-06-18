/**
 * v3-mailbox.ts — durable cross-owner agent-to-agent почтовый ящик (v3.0 Фаза 1).
 *
 * Обобщает in-mem event-bus в ПЕРСИСТЕНТНЫЙ mailbox: агенты разных владельцев шлют
 *   друг другу сообщения — координация по задаче, найм, оффер аренды, уведомления.
 * Приватность: читать инбокс агента может ТОЛЬКО владелец этого агента (agents.user_id);
 *   проверка в эндпоинте через agentOwnedBy().
 */
import { Pool } from 'pg';

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Mailbox] not initialized'); return _pool; };

const KINDS = ['message', 'hire_offer', 'job_invite', 'rental_offer', 'notice'];

export async function initV3Mailbox(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_mailbox (
      id          BIGSERIAL PRIMARY KEY,
      from_agent  INTEGER,
      to_agent    INTEGER NOT NULL,
      kind        TEXT NOT NULL DEFAULT 'message',
      subject     TEXT,
      body        JSONB NOT NULL DEFAULT '{}',
      ref         TEXT,                          -- напр. job id / rental id
      status      SMALLINT NOT NULL DEFAULT 0,   -- 0 unread · 1 read · 2 archived
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at     TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_v3_mbx_to ON builder_bot.v3_mailbox (to_agent, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_v3_mbx_from ON builder_bot.v3_mailbox (from_agent, created_at DESC);
  `);
  console.log('[V3Mailbox] table ready');
}

/** Владеет ли userId агентом agentId (для приватности инбокса). */
export async function agentOwnedBy(agentId: number, userId: number | string): Promise<boolean> {
  try {
    const r = await pool().query(`SELECT 1 FROM builder_bot.agents WHERE id=$1 AND user_id=$2`, [agentId, userId]);
    return r.rows.length > 0;
  } catch { return false; }
}

export async function sendMessage(args: {
  fromAgent?: number | null; toAgent: number; kind?: string; subject?: string; body?: any; ref?: string;
}): Promise<{ ok: boolean; id: string }> {
  const kind = KINDS.indexOf(args.kind || '') >= 0 ? args.kind : 'message';
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_mailbox (from_agent, to_agent, kind, subject, body, ref)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [args.fromAgent ?? null, args.toAgent, kind, args.subject ?? null, JSON.stringify(args.body ?? {}), args.ref ?? null],
  );
  return { ok: true, id: String(r.rows[0].id) };
}

export async function inbox(agentId: number, opts?: { status?: number; limit?: number }): Promise<any[]> {
  const limit = Math.min(Math.max(1, opts?.limit || 50), 200);
  const params: any[] = [agentId];
  let where = 'to_agent=$1';
  if (opts && Number.isFinite(opts.status as number)) { params.push(opts.status); where += ` AND status=$${params.length}`; }
  params.push(limit);
  const r = await pool().query(
    `SELECT id, from_agent, to_agent, kind, subject, body, ref, status, created_at, read_at
       FROM builder_bot.v3_mailbox WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows;
}

export async function outbox(agentId: number, limit = 50): Promise<any[]> {
  const r = await pool().query(
    `SELECT id, from_agent, to_agent, kind, subject, body, ref, status, created_at
       FROM builder_bot.v3_mailbox WHERE from_agent=$1 ORDER BY created_at DESC LIMIT $2`,
    [agentId, Math.min(Math.max(1, limit), 200)],
  );
  return r.rows;
}

export async function markRead(agentId: number, msgId: string): Promise<{ ok: boolean }> {
  await pool().query(
    `UPDATE builder_bot.v3_mailbox SET status=1, read_at=NOW() WHERE id=$1 AND to_agent=$2 AND status=0`,
    [msgId, agentId],
  );
  return { ok: true };
}

export async function unreadCount(agentId: number): Promise<number> {
  const r = await pool().query(`SELECT COUNT(*)::int AS n FROM builder_bot.v3_mailbox WHERE to_agent=$1 AND status=0`, [agentId]);
  return r.rows[0]?.n || 0;
}
