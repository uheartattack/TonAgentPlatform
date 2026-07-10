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

/** A2A типы намерений (протокол-конверт): агент помечает КАКОГО рода это сообщение,
 *  чтобы получатель ветвился по смыслу, а не парсил свободный текст. */
export const INTENTS = ['message', 'query', 'request', 'inform', 'offer', 'counter', 'accept', 'decline', 'delegate', 'introduce', 'cancel'];
export function normalizeIntent(x?: string | null): string {
  const v = (x || 'message').toString().toLowerCase().trim();
  return INTENTS.indexOf(v) >= 0 ? v : 'message';
}

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
  // A2A протокол-конверт (аддитивно, обратно совместимо со старыми строками):
  //  thread_id — цепочка переписки; reply_to — на какое сообщение отвечаем;
  //  intent — тип намерения; scan — вердикт инъекшн-файрвола (0 clean·1 flagged·2 quarantined);
  //  delivered_at/woke_at/attempt_count — для Wake Engine (живая доставка, Волна 2).
  await pgPool.query(`
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS thread_id     TEXT;
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS reply_to      BIGINT;
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS intent        TEXT NOT NULL DEFAULT 'message';
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS scan          SMALLINT NOT NULL DEFAULT 0;
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS scan_reason   TEXT;
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS woke_at       TIMESTAMPTZ;
    ALTER TABLE builder_bot.v3_mailbox ADD COLUMN IF NOT EXISTS attempt_count SMALLINT NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_v3_mbx_thread ON builder_bot.v3_mailbox (thread_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_v3_mbx_undelivered ON builder_bot.v3_mailbox (to_agent) WHERE delivered_at IS NULL;
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
  threadId?: string | null; replyTo?: string | number | null; intent?: string | null;
  scan?: number; scanReason?: string | null;
}): Promise<{ ok: boolean; id: string; thread_id: string }> {
  const kind = KINDS.indexOf(args.kind || '') >= 0 ? args.kind : 'message';
  const intent = normalizeIntent(args.intent);
  const replyTo = args.replyTo != null && Number.isFinite(Number(args.replyTo)) ? Number(args.replyTo) : null;
  // thread_id: если явно передан — берём; иначе, если это ответ — наследуем тред родителя;
  // иначе рождаем новый тред (равный id этого сообщения — проставим после INSERT).
  let threadId: string | null = args.threadId ? String(args.threadId) : null;
  if (!threadId && replyTo != null) {
    try {
      const pr = await pool().query(`SELECT thread_id FROM builder_bot.v3_mailbox WHERE id=$1`, [replyTo]);
      if (pr.rows[0]?.thread_id) threadId = String(pr.rows[0].thread_id);
    } catch { /* нет родителя — родим новый тред */ }
  }
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_mailbox (from_agent, to_agent, kind, subject, body, ref, thread_id, reply_to, intent, scan, scan_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [args.fromAgent ?? null, args.toAgent, kind, args.subject ?? null, JSON.stringify(args.body ?? {}),
     args.ref ?? null, threadId, replyTo, intent, args.scan ?? 0, args.scanReason ?? null],
  );
  const id = String(r.rows[0].id);
  if (!threadId) {
    threadId = id;
    await pool().query(`UPDATE builder_bot.v3_mailbox SET thread_id=$1 WHERE id=$2`, [threadId, id]);
  }
  return { ok: true, id, thread_id: threadId };
}

const MBX_COLS = 'id, from_agent, to_agent, kind, subject, body, ref, status, thread_id, reply_to, intent, scan, created_at, read_at';

export async function inbox(agentId: number, opts?: { status?: number; limit?: number }): Promise<any[]> {
  const limit = Math.min(Math.max(1, opts?.limit || 50), 200);
  const params: any[] = [agentId];
  let where = 'to_agent=$1';
  if (opts && Number.isFinite(opts.status as number)) { params.push(opts.status); where += ` AND status=$${params.length}`; }
  params.push(limit);
  const r = await pool().query(
    `SELECT ${MBX_COLS} FROM builder_bot.v3_mailbox WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows;
}

export async function outbox(agentId: number, limit = 50): Promise<any[]> {
  const r = await pool().query(
    `SELECT ${MBX_COLS} FROM builder_bot.v3_mailbox WHERE from_agent=$1 ORDER BY created_at DESC LIMIT $2`,
    [agentId, Math.min(Math.max(1, limit), 200)],
  );
  return r.rows;
}

/** Полный транскрипт треда (обе стороны, в хронологии) — чтобы агент восстановил
 *  контекст переписки перед ответом. Ограничено участием agentId (приватность). */
export async function thread(threadId: string, agentId: number, limit = 100): Promise<any[]> {
  const r = await pool().query(
    `SELECT ${MBX_COLS} FROM builder_bot.v3_mailbox
      WHERE thread_id=$1 AND (from_agent=$2 OR to_agent=$2)
      ORDER BY created_at ASC LIMIT $3`,
    [String(threadId), agentId, Math.min(Math.max(1, limit), 300)],
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

// ── Транспорт для Wake Engine (Волна 2) — недоставленные сообщения к пробуждению ──
/** Недоставленные (delivered_at IS NULL) чистые (scan=0) сообщения — для живой доставки.
 *  Возвращает пачку старейших, чтобы поллер разбудил получателей по одному разу. */
export async function pendingDeliveries(limit = 50): Promise<any[]> {
  const r = await pool().query(
    `SELECT ${MBX_COLS} FROM builder_bot.v3_mailbox
      WHERE delivered_at IS NULL AND scan = 0
      ORDER BY created_at ASC LIMIT $1`,
    [Math.min(Math.max(1, limit), 200)],
  );
  return r.rows;
}

/** Неразбуженный бэклог КОНКРЕТНОГО агента — для activation-drain (Волна 4):
 *  агент проснулся → добираем непрочитанное, на что его ещё не будили (woke_at IS NULL),
 *  даже если поллер уже пометил delivered пока агент был оффлайн. */
export async function pendingWakeFor(agentId: number, limit = 20): Promise<any[]> {
  const r = await pool().query(
    `SELECT ${MBX_COLS} FROM builder_bot.v3_mailbox
      WHERE to_agent = $1 AND woke_at IS NULL AND status = 0 AND scan = 0
      ORDER BY created_at ASC LIMIT $2`,
    [agentId, Math.min(Math.max(1, limit), 100)],
  );
  return r.rows;
}

/** Сколько раз агента будили за последние 24ч (по woke_at) — для дневного бюджета пробуждений. */
export async function wakeCountToday(agentId: number): Promise<number> {
  const r = await pool().query(
    `SELECT COUNT(*)::int AS n FROM builder_bot.v3_mailbox
      WHERE to_agent = $1 AND woke_at > NOW() - INTERVAL '24 hours'`,
    [agentId],
  );
  return r.rows[0]?.n || 0;
}

/** Атомарный клейм ДОСТАВКИ: помечает delivered_at, если ещё не помечено. true = мы застолбили.
 *  Поллер клеймит КАЖДУЮ обработанную строку → она уходит из окна недоставленных (нет starvation). */
export async function claimDelivered(msgId: string): Promise<boolean> {
  const r = await pool().query(
    `UPDATE builder_bot.v3_mailbox SET delivered_at = NOW()
      WHERE id = $1 AND delivered_at IS NULL RETURNING id`,
    [msgId],
  );
  return r.rows.length > 0;
}

/** Атомарный клейм ПРОБУЖДЕНИЯ: помечает woke_at, если ещё не будили. true = мы застолбили wake.
 *  Гарантирует, что поллер И drain не разбудят один месседж дважды (нет double-spend). */
export async function claimWake(msgId: string): Promise<boolean> {
  const r = await pool().query(
    `UPDATE builder_bot.v3_mailbox SET woke_at = NOW(), attempt_count = attempt_count + 1
      WHERE id = $1 AND woke_at IS NULL RETURNING id`,
    [msgId],
  );
  return r.rows.length > 0;
}

/** Квитанции по ОТПРАВЛЕННЫМ сообщениям: доставлено/разбужен/прочитано + число ответов
 *  (reply_to на это сообщение). Чтобы отправитель знал «увидел, не ответил → напомнить». */
export async function listReceipts(agentId: number, limit = 30): Promise<any[]> {
  const r = await pool().query(
    `SELECT m.id, m.to_agent, m.thread_id, m.intent, m.subject, m.status,
            m.created_at, m.delivered_at, m.woke_at, m.read_at,
            (SELECT COUNT(*)::int FROM builder_bot.v3_mailbox rr WHERE rr.reply_to = m.id) AS reply_count
       FROM builder_bot.v3_mailbox m
      WHERE m.from_agent = $1
      ORDER BY m.created_at DESC LIMIT $2`,
    [agentId, Math.min(Math.max(1, limit), 100)],
  );
  return r.rows.map((x: any) => ({
    id: String(x.id), to_agent: x.to_agent, thread_id: x.thread_id, intent: x.intent, subject: x.subject,
    delivered: !!x.delivered_at, woke: !!x.woke_at, seen: !!x.read_at, replies: x.reply_count,
    created_at: x.created_at,
  }));
}
