/**
 * v3-a2a-coop.ts — слой КООПЕРАЦИИ agent-to-agent сети (v3.0, Волна 3).
 *
 * Поверх протокола (v3-mailbox) + защиты (v3-a2a) строим «живое общество»:
 *   1. PRESENCE     — кто в сети сейчас (live-хендл) + само-статус (available/busy/dnd).
 *   2. CAPABILITY   — агент публикует навыки/услуги (теги), discovery ищет по ним.
 *   3. HANDSHAKE    — типизированная негоциация offer→counter→accept/decline (БЕЗ денег;
 *                     терминальный accept = зафиксированная договорённость, оплату отдаёт
 *                     СУЩЕСТВУЮЩЕМУ owner-signed escrow, здесь GRAM не двигается).
 *   4. DELEGATION   — агент делегирует подзадачу пиру (дерево, кап глубины + анти-цикл).
 *   5. PEER-REP     — эндорсы за реальную кооперацию (anti-sybil), лёгкий сигнал доверия.
 *
 * Деньги НЕ трогает. LLM НЕ вызывает. Таблицы builder_bot, IF NOT EXISTS.
 */
import { Pool } from 'pg';

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3A2ACoop] not initialized'); return _pool; };

const MAX_DELEGATION_DEPTH = parseInt(process.env.A2A_MAX_DELEGATION_DEPTH || '4', 10);

const TIER_ORDER = ['unverified', 'bronze', 'silver', 'gold', 'platinum'];
function tierAtLeast(tier?: string | null, min?: string | null): boolean {
  if (!min) return true;
  return TIER_ORDER.indexOf(tier || 'unverified') >= TIER_ORDER.indexOf(min);
}
function tierRank(t?: string | null): number { return Math.max(0, TIER_ORDER.indexOf(t || 'unverified')); }
async function agentTier(agentId: number): Promise<string> {
  try {
    const r = await pool().query(`SELECT tier FROM builder_bot.trust_scores WHERE agent_id=$1`, [agentId]);
    return r.rows[0]?.tier || 'unverified';
  } catch { return 'unverified'; }
}

export async function initV3A2ACoop(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_agent_capabilities (
      agent_id   INTEGER NOT NULL,
      tag        TEXT NOT NULL,
      weight     REAL NOT NULL DEFAULT 1.0,
      source     TEXT NOT NULL DEFAULT 'declared',   -- declared · inferred
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (agent_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_v3_caps_tag ON builder_bot.v3_agent_capabilities (tag);

    CREATE TABLE IF NOT EXISTS builder_bot.v3_handshakes (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     TEXT,
      initiator     INTEGER NOT NULL,
      counterparty  INTEGER NOT NULL,
      state         TEXT NOT NULL DEFAULT 'proposed', -- proposed · countered · accepted · declined · expired · cancelled
      terms         JSONB NOT NULL DEFAULT '{}',
      last_actor    INTEGER,
      job_ref       TEXT,
      expires_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_hs_parties ON builder_bot.v3_handshakes (counterparty, state, updated_at DESC);

    CREATE TABLE IF NOT EXISTS builder_bot.v3_delegations (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     TEXT,
      parent        BIGINT,
      delegator     INTEGER NOT NULL,
      delegatee     INTEGER NOT NULL,
      task          JSONB NOT NULL DEFAULT '{}',
      status        TEXT NOT NULL DEFAULT 'open',      -- open · accepted · done · declined · cancelled
      depth         INTEGER NOT NULL DEFAULT 0,
      result        TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_deleg_ee ON builder_bot.v3_delegations (delegatee, status);
    CREATE INDEX IF NOT EXISTS idx_v3_deleg_thread ON builder_bot.v3_delegations (thread_id);

    CREATE TABLE IF NOT EXISTS builder_bot.v3_peer_signals (
      id          BIGSERIAL PRIMARY KEY,
      from_agent  INTEGER NOT NULL,
      to_agent    INTEGER NOT NULL,
      signal      TEXT NOT NULL DEFAULT 'endorse',    -- endorse · helpful · completed
      weight      REAL NOT NULL DEFAULT 1.0,
      ref         TEXT,                               -- дедуп-ключ (job/thread/delegation)
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (from_agent, to_agent, ref)
    );
    CREATE INDEX IF NOT EXISTS idx_v3_psig_to ON builder_bot.v3_peer_signals (to_agent);

    -- N-агентные комнаты (командная работа): пост фан-аутится в mailbox каждому члену
    -- (firewall/governor/wake переиспользуются), а канонический транскрипт — в v3_room_posts.
    CREATE TABLE IF NOT EXISTS builder_bot.v3_rooms (
      id           BIGSERIAL PRIMARY KEY,
      opener_agent INTEGER NOT NULL,
      goal         TEXT,
      status       TEXT NOT NULL DEFAULT 'open',       -- open · closed
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS builder_bot.v3_room_members (
      room_id     BIGINT NOT NULL,
      agent_id    INTEGER NOT NULL,
      member_role TEXT NOT NULL DEFAULT 'member',      -- opener · member
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, agent_id)
    );
    CREATE TABLE IF NOT EXISTS builder_bot.v3_room_posts (
      id         BIGSERIAL PRIMARY KEY,
      room_id    BIGINT NOT NULL,
      from_agent INTEGER,
      text       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_roompost ON builder_bot.v3_room_posts (room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_v3_roommem ON builder_bot.v3_room_members (agent_id);
  `);
  console.log('[V3A2ACoop] tables ready');
}

// ═══ 1. PRESENCE ═════════════════════════════════════════════════════════════
/** Само-статус в policy JSON; «онлайн» = живой рантайм-хендл (runtime.isAgentLive). */
export async function setPresence(agentId: number, status: 'available' | 'busy' | 'dnd'): Promise<{ status: string }> {
  const a2a = require('./v3-a2a');
  const s = ['available', 'busy', 'dnd'].indexOf(status) >= 0 ? status : 'available';
  await a2a.setPolicy(agentId, {}); // ensure a2a node exists
  const r = await pool().query(`SELECT trigger_config FROM builder_bot.agents WHERE id=$1`, [agentId]);
  const tc = r.rows[0]?.trigger_config;
  const cfg = (typeof tc === 'string' ? JSON.parse(tc) : (tc || {})) || {};
  if (!cfg.config) cfg.config = {}; if (!cfg.config.a2a) cfg.config.a2a = {};
  cfg.config.a2a.presence = s;
  await pool().query(`UPDATE builder_bot.agents SET trigger_config=$1::jsonb WHERE id=$2`, [JSON.stringify(cfg), agentId]);
  return { status: s };
}
/** Онлайн ли агент СЕЙЧАС: live-хендл рантайма И само-статус != dnd. */
export function isReachable(agentId: number, selfStatus?: string): boolean {
  let live = false;
  try { const rt = require('../agents/ai-agent-runtime'); live = !!(rt.isAgentLive && rt.isAgentLive(agentId)); } catch { /* */ }
  return live && selfStatus !== 'dnd';
}

// ═══ 2. CAPABILITY CARDS ═════════════════════════════════════════════════════
export async function advertise(agentId: number, tags: string[], opts?: { service?: string; priceHintGram?: number; slaSec?: number }): Promise<{ ok: boolean; tags: string[] }> {
  const clean = Array.from(new Set((tags || []).map(t => String(t).toLowerCase().trim().slice(0, 40)).filter(Boolean))).slice(0, 20);
  for (const t of clean) {
    await pool().query(
      `INSERT INTO builder_bot.v3_agent_capabilities (agent_id, tag, source, updated_at)
       VALUES ($1,$2,'declared',NOW())
       ON CONFLICT (agent_id, tag) DO UPDATE SET updated_at=NOW()`,
      [agentId, t],
    );
  }
  if (opts?.service !== undefined || opts?.priceHintGram !== undefined || opts?.slaSec !== undefined) {
    const a2a = require('./v3-a2a');
    const r = await pool().query(`SELECT trigger_config FROM builder_bot.agents WHERE id=$1`, [agentId]);
    const tc = r.rows[0]?.trigger_config; const cfg = (typeof tc === 'string' ? JSON.parse(tc) : (tc || {})) || {};
    if (!cfg.config) cfg.config = {}; if (!cfg.config.a2a) cfg.config.a2a = {};
    cfg.config.a2a.service = {
      desc: opts.service != null ? String(opts.service).slice(0, 300) : (cfg.config.a2a.service?.desc || null),
      price_hint_gram: opts.priceHintGram != null ? Number(opts.priceHintGram) : (cfg.config.a2a.service?.price_hint_gram ?? null),
      sla_sec: opts.slaSec != null ? Number(opts.slaSec) : (cfg.config.a2a.service?.sla_sec ?? null),
    };
    await pool().query(`UPDATE builder_bot.agents SET trigger_config=$1::jsonb WHERE id=$2`, [JSON.stringify(cfg), agentId]);
  }
  return { ok: true, tags: clean };
}

/** Найти агентов по capability-тегу (+ опц. мин.тир), ранг: точность тега × тир. */
export async function findByCapability(tag: string, opts?: { minTier?: string; limit?: number }): Promise<any[]> {
  const t = String(tag || '').toLowerCase().trim();
  if (!t) return [];
  const limit = Math.min(Math.max(1, opts?.limit || 20), 100);
  // мин.тир 1-based (array_position: unverified=1..platinum=5); 0 = без фильтра.
  const minRank = opts?.minTier ? (TIER_ORDER.indexOf(opts.minTier) + 1) : 0;
  // DISTINCT ON (agent_id) — один агент один раз (даже если совпало несколько тегов);
  // тир-фильтр В SQL до LIMIT (иначе LIMIT срезал бы квалифицированных); ранг: exact→trust.
  const r = await pool().query(
    `SELECT * FROM (
       SELECT DISTINCT ON (c.agent_id) c.agent_id, c.tag, c.weight, a.name, a.role,
              a.trigger_config->'telegram_session'->>'username' AS tg_username,
              COALESCE(ts.tier,'unverified') AS tier, COALESCE(ts.score,0) AS trust,
              (c.tag = $1) AS exact
         FROM builder_bot.v3_agent_capabilities c
         JOIN builder_bot.agents a ON a.id = c.agent_id
         LEFT JOIN builder_bot.trust_scores ts ON ts.agent_id = c.agent_id
        WHERE (c.tag = $1 OR c.tag LIKE $2)
          AND ($4::int = 0 OR array_position(ARRAY['unverified','bronze','silver','gold','platinum'], COALESCE(ts.tier,'unverified')) >= $4)
        ORDER BY c.agent_id, (c.tag = $1) DESC, ts.score DESC NULLS LAST
     ) s
     ORDER BY s.exact DESC, s.trust DESC NULLS LAST
     LIMIT $3`,
    [t, '%' + t + '%', limit, minRank],
  );
  return r.rows.map((x: any) => ({
    agent_id: Number(x.agent_id), name: x.name, role: x.role || 'worker', tag: x.tag,
    tg_username: x.tg_username || null, tier: x.tier || 'unverified', trust: Number(x.trust) || 0,
    exact: !!x.exact,
  }));
}

// ═══ 3. HANDSHAKE NEGOTIATION (offer→counter→accept/decline) ═════════════════
export async function openOffer(initiator: number, counterparty: number, terms: any, opts?: { threadId?: string; expiresInHours?: number; jobRef?: string }): Promise<{ ok: boolean; id: string; state: string }> {
  if (initiator === counterparty) return { ok: false as any, id: '', state: 'self' };
  const _h = Number(opts?.expiresInHours);
  const exp = Number.isFinite(_h) ? `NOW() + (${Math.max(1, Math.min(720, _h))} || ' hours')::interval` : `NOW() + INTERVAL '48 hours'`;
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_handshakes (thread_id, initiator, counterparty, state, terms, last_actor, job_ref, expires_at)
     VALUES ($1,$2,$3,'proposed',$4,$2,$5, ${exp}) RETURNING id, state`,
    [opts?.threadId || null, initiator, counterparty, JSON.stringify(terms || {}), opts?.jobRef || null],
  );
  const hsId = String(r.rows[0].id);
  try { const a2a = require('./v3-a2a'); await a2a.notifyPeer(initiator, counterparty, `Новый оффер сделки #${hsId}. Посмотри network_deal(action:list) → accept/counter/decline.`, 'offer', 'deal:' + hsId); await a2a.notifyOwnerOf(counterparty, `Новый оффер сделки #${hsId} от агента #${initiator}.`); } catch { /* */ }
  return { ok: true, id: hsId, state: r.rows[0].state };
}

/** Ответная реплика по сделке: counter (новые условия) / accept / decline. Только сторона,
 *  которая СЕЙЧАС «ходит» (не last_actor), может отвечать; терминальные — accept/decline. */
export async function respondHandshake(hsId: string, actor: number, action: 'counter' | 'accept' | 'decline' | 'cancel', terms?: any): Promise<{ ok: boolean; state?: string; error?: string }> {
  const h = (await pool().query(`SELECT * FROM builder_bot.v3_handshakes WHERE id=$1`, [hsId])).rows[0];
  if (!h) return { ok: false, error: 'handshake not found' };
  if (['accepted', 'declined', 'expired', 'cancelled'].indexOf(h.state) >= 0) return { ok: false, error: `already ${h.state}` };
  if (h.expires_at && new Date(h.expires_at).getTime() < Date.now()) {
    await pool().query(`UPDATE builder_bot.v3_handshakes SET state='expired', updated_at=NOW() WHERE id=$1`, [hsId]);
    return { ok: false, error: 'expired' };
  }
  const isParty = actor === Number(h.initiator) || actor === Number(h.counterparty);
  if (!isParty) return { ok: false, error: 'not a party' };
  if (action === 'cancel') {
    if (actor !== Number(h.initiator)) return { ok: false, error: 'only initiator can cancel' };
    await pool().query(`UPDATE builder_bot.v3_handshakes SET state='cancelled', last_actor=$2, updated_at=NOW() WHERE id=$1`, [hsId, actor]);
    return { ok: true, state: 'cancelled' };
  }
  // отвечать может только тот, кто НЕ ходил последним
  if (Number(h.last_actor) === actor) return { ok: false, error: 'waiting for the other party' };
  const other = actor === Number(h.initiator) ? Number(h.counterparty) : Number(h.initiator);
  const notify = async (verb: string) => { try { const a2a = require('./v3-a2a'); await a2a.notifyPeer(actor, other, `Сделка #${hsId}: контрагент ${verb}.`, 'inform', 'deal:' + hsId); } catch { /* */ } };
  if (action === 'counter') {
    await pool().query(`UPDATE builder_bot.v3_handshakes SET state='countered', terms=$3::jsonb, last_actor=$2, updated_at=NOW() WHERE id=$1`,
      [hsId, actor, JSON.stringify(terms || h.terms)]);
    await notify('прислал встречные условия (counter) — твой ход');
    return { ok: true, state: 'countered' };
  }
  if (action === 'accept') {
    await pool().query(`UPDATE builder_bot.v3_handshakes SET state='accepted', last_actor=$2, updated_at=NOW() WHERE id=$1`, [hsId, actor]);
    await notify('ПРИНЯЛ сделку ✅');
    try { const a2a = require('./v3-a2a'); await a2a.notifyOwnerOf(other, `Твою сделку #${hsId} ПРИНЯЛИ ✅ (агент #${actor}).`); } catch { /* */ }
    return { ok: true, state: 'accepted' };
  }
  await pool().query(`UPDATE builder_bot.v3_handshakes SET state='declined', last_actor=$2, updated_at=NOW() WHERE id=$1`, [hsId, actor]);
  await notify('отклонил сделку');
  return { ok: true, state: 'declined' };
}

export async function listHandshakes(agentId: number, limit = 30): Promise<any[]> {
  const r = await pool().query(
    `SELECT id, thread_id, initiator, counterparty, state, terms, last_actor, job_ref, expires_at, updated_at
       FROM builder_bot.v3_handshakes
      WHERE initiator=$1 OR counterparty=$1
      ORDER BY updated_at DESC LIMIT $2`,
    [agentId, Math.min(Math.max(1, limit), 100)],
  );
  return r.rows.map((h: any) => ({ ...h, id: String(h.id),
    role: Number(h.initiator) === agentId ? 'initiator' : 'counterparty',
    your_move: Number(h.last_actor) !== agentId && ['proposed', 'countered'].indexOf(h.state) >= 0 }));
}

// ═══ 4. DELEGATION CHAINS ════════════════════════════════════════════════════
/** Делегировать подзадачу пиру. Кап глубины + анти-цикл (пир уже в цепочке-предках). */
export async function delegate(delegator: number, delegatee: number, task: any, opts?: { threadId?: string; parent?: string }): Promise<{ ok: boolean; id?: string; depth?: number; error?: string }> {
  if (delegator === delegatee) return { ok: false, error: 'cannot delegate to self' };
  let depth = 0;
  const ancestors = new Set<number>([delegator]);
  if (opts?.parent) {
    // поднимаемся по цепочке, считаем глубину и собираем предков (анти-цикл)
    let cur: string | null = String(opts.parent);
    let guard = 0;
    while (cur && guard++ < 20) {
      const p = (await pool().query(`SELECT parent, delegator, delegatee, depth FROM builder_bot.v3_delegations WHERE id=$1`, [cur])).rows[0];
      if (!p) break;
      depth = Math.max(depth, Number(p.depth) + 1);
      ancestors.add(Number(p.delegator)); ancestors.add(Number(p.delegatee));
      cur = p.parent ? String(p.parent) : null;
    }
  }
  if (depth >= MAX_DELEGATION_DEPTH) return { ok: false, error: `delegation too deep (max ${MAX_DELEGATION_DEPTH})` };
  if (ancestors.has(delegatee)) return { ok: false, error: 'cycle: delegatee already in the delegation chain' };
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_delegations (thread_id, parent, delegator, delegatee, task, depth)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [opts?.threadId || null, opts?.parent || null, delegator, delegatee, JSON.stringify(task || {}), depth],
  );
  const dId = String(r.rows[0].id);
  const taskText = (task && (task.text || task.title)) ? String(task.text || task.title).slice(0, 200) : '';
  try { const a2a = require('./v3-a2a'); await a2a.notifyPeer(delegator, delegatee, `Тебе делегировали подзадачу #${dId}: ${taskText}. Ответь network_delegate(action:update, status:accepted/done).`, 'delegate', 'deleg:' + dId); await a2a.notifyOwnerOf(delegatee, `Твоему агенту делегировали задачу #${dId}: ${taskText}`); } catch { /* */ }
  return { ok: true, id: dId, depth };
}

export async function updateDelegation(id: string, actor: number, status: 'accepted' | 'done' | 'declined' | 'cancelled', result?: string): Promise<{ ok: boolean; error?: string }> {
  const d = (await pool().query(`SELECT delegator, delegatee, status FROM builder_bot.v3_delegations WHERE id=$1`, [id])).rows[0];
  if (!d) return { ok: false, error: 'delegation not found' };
  // терминальное состояние нельзя перезаписать (симметрия с respondHandshake)
  if (['done', 'declined', 'cancelled'].indexOf(d.status) >= 0) return { ok: false, error: `already ${d.status}` };
  const isDelegatee = actor === Number(d.delegatee), isDelegator = actor === Number(d.delegator);
  if (status === 'cancelled' && !isDelegator) return { ok: false, error: 'only delegator can cancel' };
  if (['accepted', 'done', 'declined'].indexOf(status) >= 0 && !isDelegatee) return { ok: false, error: 'only delegatee can update progress' };
  await pool().query(`UPDATE builder_bot.v3_delegations SET status=$2, result=COALESCE($3,result), updated_at=NOW() WHERE id=$1`,
    [id, status, result != null ? String(result).slice(0, 2000) : null]);
  // state-change wake: контрагент узнаёт сразу (через mailbox+поллер/drain)
  try {
    const other = isDelegatee ? Number(d.delegator) : Number(d.delegatee);
    const verb: any = { accepted: 'принял в работу', done: 'выполнил', declined: 'отклонил', cancelled: 'отменил' };
    const a2a = require('./v3-a2a');
    await a2a.notifyPeer(actor, other, `Делегация #${id}: ${verb[status] || status}.${result ? ' Результат: ' + String(result).slice(0, 300) : ''}`, 'inform', 'deleg:' + id);
  } catch { /* уведомление best-effort */ }
  return { ok: true };
}

export async function delegationStatus(agentId: number, opts?: { threadId?: string; limit?: number }): Promise<any[]> {
  const limit = Math.min(Math.max(1, opts?.limit || 30), 100);
  const params: any[] = [agentId];
  let where = '(delegator=$1 OR delegatee=$1)';
  if (opts?.threadId) { params.push(opts.threadId); where += ` AND thread_id=$${params.length}`; }
  params.push(limit);
  const r = await pool().query(
    `SELECT id, thread_id, parent, delegator, delegatee, task, status, depth, result, updated_at
       FROM builder_bot.v3_delegations WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((d: any) => ({ ...d, id: String(d.id), parent: d.parent ? String(d.parent) : null,
    role: Number(d.delegator) === agentId ? 'delegator' : 'delegatee' }));
}

// ═══ 5. PEER REPUTATION (эндорсы, anti-sybil) ═══════════════════════════════
/** Эндорс пира за РЕАЛЬНУЮ кооперацию. Anti-sybil: не себе; дедуп по ref (UNIQUE);
 *  вес = f(тир эндорсера) — голос unverified почти не весит; требуется общий контекст (ref). */
export async function endorse(fromAgent: number, toAgent: number, ref: string, opts?: { signal?: string; note?: string }): Promise<{ ok: boolean; weight?: number; error?: string }> {
  if (fromAgent === toAgent) return { ok: false, error: 'cannot endorse self' };
  if (!ref) return { ok: false, error: 'ref required (shared job/thread/delegation) — эндорс только за реальное взаимодействие' };
  // подтверждение общего контекста: была ли переписка/делегация/сделка между ними
  const shared = await hasSharedContext(fromAgent, toAgent, ref);
  if (!shared) return { ok: false, error: 'no shared interaction found for this ref — нельзя эндорсить без совместной работы' };
  const tier = await agentTier(fromAgent);
  const weight = [0.15, 0.4, 0.7, 1.0, 1.3][tierRank(tier)] || 0.15; // unverified почти не весит
  try {
    await pool().query(
      `INSERT INTO builder_bot.v3_peer_signals (from_agent, to_agent, signal, weight, ref, note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [fromAgent, toAgent, (opts?.signal || 'endorse'), weight, String(ref).slice(0, 120), opts?.note ? String(opts.note).slice(0, 200) : null],
    );
  } catch (e: any) {
    if (/duplicate|unique/i.test(e?.message || '')) return { ok: false, error: 'already endorsed for this ref' };
    throw e;
  }
  return { ok: true, weight };
}

// ref ДОЛЖЕН указывать на КОНКРЕТНЫЙ общий контекст, где обе стороны участники —
// это и есть дедуп (UNIQUE(from,to,ref) → один эндорс на реальное взаимодействие).
// ref = thread_id (mailbox) | id делегации | id/job_ref сделки.
async function hasSharedContext(a: number, b: number, ref: string): Promise<boolean> {
  const r = String(ref);
  // общий тред в почте (thread_id)
  try {
    const m = await pool().query(
      `SELECT 1 FROM builder_bot.v3_mailbox
        WHERE thread_id=$3 AND ((from_agent=$1 AND to_agent=$2) OR (from_agent=$2 AND to_agent=$1)) LIMIT 1`, [a, b, r]);
    if (m.rows.length > 0) return true;
  } catch { /* */ }
  // конкретная делегация / сделка по числовому id
  if (/^\d+$/.test(r)) {
    try {
      const d = await pool().query(
        `SELECT 1 FROM builder_bot.v3_delegations
          WHERE id=$3 AND ((delegator=$1 AND delegatee=$2) OR (delegator=$2 AND delegatee=$1)) LIMIT 1`, [a, b, r]);
      if (d.rows.length > 0) return true;
    } catch { /* */ }
    try {
      const h = await pool().query(
        `SELECT 1 FROM builder_bot.v3_handshakes
          WHERE id=$3 AND ((initiator=$1 AND counterparty=$2) OR (initiator=$2 AND counterparty=$1)) LIMIT 1`, [a, b, r]);
      if (h.rows.length > 0) return true;
    } catch { /* */ }
  }
  // сделка по job_ref
  try {
    const h2 = await pool().query(
      `SELECT 1 FROM builder_bot.v3_handshakes
        WHERE job_ref=$3 AND ((initiator=$1 AND counterparty=$2) OR (initiator=$2 AND counterparty=$1)) LIMIT 1`, [a, b, r]);
    if (h2.rows.length > 0) return true;
  } catch { /* */ }
  return false;
}

/** Сводка peer-репутации агента: сумма взвешенных эндорсов + число уникальных эндорсеров. */
export async function peerReputation(agentId: number): Promise<{ score: number; endorsers: number; signals: number }> {
  const r = await pool().query(
    `SELECT COALESCE(SUM(weight),0)::float AS score, COUNT(DISTINCT from_agent)::int AS endorsers, COUNT(*)::int AS signals
       FROM builder_bot.v3_peer_signals WHERE to_agent=$1`,
    [agentId],
  );
  const row = r.rows[0] || {};
  return { score: Math.round((Number(row.score) || 0) * 100) / 100, endorsers: Number(row.endorsers) || 0, signals: Number(row.signals) || 0 };
}

// ═══ 6. WARM INTRODUCTIONS (network_introduce) ══════════════════════════════
/** Познакомить двух агентов: каждому уходит intro-нотис с личностью другого + как написать.
 *  Зажигает первые треды сети. Introducer как бы ручается (вход в их переписку). */
export async function introduce(introducer: number, aId: number, bId: number, reason?: string): Promise<{ ok: boolean; error?: string; introduced?: number[] }> {
  if (aId === bId) return { ok: false, error: 'same agent' };
  const net = require('./v3-network');
  const a2a = require('./v3-a2a');
  const ca = await net.getAgentContact(aId), cb = await net.getAgentContact(bId);
  if (!ca || !cb) return { ok: false, error: 'agent(s) not found' };
  const why = reason ? (' ' + String(reason).slice(0, 400)) : '';
  const card = (c: any, id: number) => `${c.name || ('#' + id)}${c.tg_username ? (' @' + c.tg_username) : ''} (роль ${c.role})`;
  await a2a.notifyPeer(introducer, aId, `🤝 Знакомство от #${introducer}: ${card(cb, bId)}.${why} Напиши ему: network_dm(to_agent_id=${bId}) или network_message.`, 'introduce', `intro:${introducer}:${aId}:${bId}`);
  await a2a.notifyPeer(introducer, bId, `🤝 Знакомство от #${introducer}: ${card(ca, aId)}.${why} Напиши ему: network_dm(to_agent_id=${aId}) или network_message.`, 'introduce', `intro:${introducer}:${bId}:${aId}`);
  try { await a2a.notifyOwnerOf(aId, `Твоего агента познакомили с ${cb.name || ('#' + bId)}.`); await a2a.notifyOwnerOf(bId, `Твоего агента познакомили с ${ca.name || ('#' + aId)}.`); } catch { /* */ }
  return { ok: true, introduced: [aId, bId] };
}

// ═══ 7. N-AGENT ROOMS (network_room) ════════════════════════════════════════
export async function openRoom(opener: number, goal: string, memberIds: number[]): Promise<{ ok: boolean; room_id: string; members: number[] }> {
  const r = await pool().query(`INSERT INTO builder_bot.v3_rooms (opener_agent, goal, status) VALUES ($1,$2,'open') RETURNING id`, [opener, String(goal || '').slice(0, 500)]);
  const roomId = String(r.rows[0].id);
  const members = Array.from(new Set([opener, ...(memberIds || []).map(Number).filter((x) => x > 0)]));
  for (const m of members) {
    await pool().query(`INSERT INTO builder_bot.v3_room_members (room_id, agent_id, member_role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [roomId, m, m === opener ? 'opener' : 'member']);
  }
  await postRoom(roomId, opener, `Комната открыта. Цель: ${String(goal || '').slice(0, 300)}`, true);
  return { ok: true, room_id: roomId, members };
}

export async function joinRoom(roomId: string, agentId: number): Promise<{ ok: boolean; error?: string; room_id?: string }> {
  const room = (await pool().query(`SELECT status FROM builder_bot.v3_rooms WHERE id=$1`, [roomId])).rows[0];
  if (!room) return { ok: false, error: 'room not found' };
  if (room.status !== 'open') return { ok: false, error: 'room ' + room.status };
  // идемпотентно: постим «присоединился» + будим членов ТОЛЬКО если реально вступил впервые
  const ins = await pool().query(`INSERT INTO builder_bot.v3_room_members (room_id, agent_id, member_role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING RETURNING agent_id`, [roomId, agentId]);
  if (ins.rows.length > 0) await postRoom(roomId, agentId, `Агент #${agentId} присоединился`, true);
  return { ok: true, room_id: roomId, joined: ins.rows.length > 0 };
}

/** Пост в комнату: канонический в v3_room_posts + фан-аут wake-нотисов остальным членам. */
export async function postRoom(roomId: string, fromAgent: number, text: string, system = false): Promise<{ ok: boolean; error?: string; delivered?: number }> {
  const members = (await pool().query(`SELECT agent_id FROM builder_bot.v3_room_members WHERE room_id=$1`, [roomId])).rows.map((x: any) => Number(x.agent_id));
  if (members.length === 0) return { ok: false, error: 'room not found or empty' };
  if (!system && members.indexOf(fromAgent) < 0) return { ok: false, error: 'not a room member' };
  await pool().query(`INSERT INTO builder_bot.v3_room_posts (room_id, from_agent, text) VALUES ($1,$2,$3)`,
    [roomId, system ? null : fromAgent, String(text || '').slice(0, 4000)]);
  const a2a = require('./v3-a2a');
  const scan = a2a.scanInbound(String(text || ''));
  const mb = require('./v3-mailbox');
  let delivered = 0;
  for (const m of members) {
    if (m === fromAgent) continue;
    await mb.sendMessage({ fromAgent: system ? null : fromAgent, toAgent: m, kind: 'notice', intent: 'message',
      threadId: 'room:' + roomId, ref: 'room:' + roomId, body: { text, room: roomId }, scan: scan.safe ? 0 : 2, scanReason: scan.matched });
    delivered++;
  }
  return { ok: true, delivered };
}

export async function roomTranscript(roomId: string, agentId: number, limit = 100): Promise<{ ok: boolean; error?: string; posts?: any[] }> {
  const mem = (await pool().query(`SELECT 1 FROM builder_bot.v3_room_members WHERE room_id=$1 AND agent_id=$2`, [roomId, agentId])).rows[0];
  if (!mem) return { ok: false, error: 'not a room member' };
  const r = await pool().query(`SELECT from_agent, text, created_at FROM builder_bot.v3_room_posts WHERE room_id=$1 ORDER BY created_at ASC LIMIT $2`,
    [roomId, Math.min(Math.max(1, limit), 300)]);
  return { ok: true, posts: r.rows.map((x: any) => ({ from_agent: x.from_agent, text: x.text, at: x.created_at })) };
}

export async function listRooms(agentId: number, limit = 20): Promise<any[]> {
  const r = await pool().query(
    `SELECT r.id, r.goal, r.status, r.created_at,
            (SELECT COUNT(*)::int FROM builder_bot.v3_room_members mm WHERE mm.room_id=r.id) AS members
       FROM builder_bot.v3_rooms r JOIN builder_bot.v3_room_members m ON m.room_id=r.id
      WHERE m.agent_id=$1 ORDER BY r.created_at DESC LIMIT $2`,
    [agentId, Math.min(Math.max(1, limit), 50)]);
  return r.rows.map((x: any) => ({ room_id: String(x.id), goal: x.goal, status: x.status, members: x.members, created_at: x.created_at }));
}

// ═══ 8. SELF-ASSEMBLING CREWS (network_recruit) ═════════════════════════════
/** Менеджер-агент собирает КОМАНДУ под цель: на каждую подзадачу подбираем лучшего пира
 *  (по capability/роли/репутации), открываем комнату, делегируем каждому. Композиция
 *  capability-routing + rooms + delegation. Декомпозицию на подзадачи даёт сам менеджер. */
export async function recruit(manager: number, goal: string, subtasks: Array<{ title: string; capability?: string; role?: string; category?: string }>, opts?: { limitPerTask?: number }): Promise<{ ok: boolean; error?: string; room_id?: string; crew?: any[]; unstaffed?: string[] }> {
  if (!goal || !Array.isArray(subtasks) || subtasks.length === 0) return { ok: false, error: 'goal + subtasks required' };
  const net = require('./v3-network');
  const picked = new Set<number>();
  const crew: any[] = [];
  const unstaffed: string[] = [];
  for (const st of subtasks.slice(0, 12)) {
    let cand: any = null;
    // 1) по конкретному навыку
    if (st.capability) {
      const r = await findByCapability(st.capability, { limit: 8 });
      cand = r.find((a: any) => a.agent_id !== manager && !picked.has(a.agent_id)) || null;
    }
    // 2) фолбэк — по роли/категории среди подключённых, ранжируя по effectiveScore
    if (!cand) {
      const rows = await net.listConnectedAgents({ role: st.role, category: st.category, limit: 12 });
      cand = (rows || []).find((a: any) => a.agent_id !== manager && !picked.has(a.agent_id)) || null;
    }
    if (cand) { picked.add(cand.agent_id); crew.push({ subtask: st.title, agent_id: cand.agent_id, agent_name: cand.name || null }); }
    else { unstaffed.push(st.title); crew.push({ subtask: st.title, agent_id: null, agent_name: null }); }
  }
  const members = crew.map((c) => c.agent_id).filter((x) => x != null);
  const room = await openRoom(manager, goal, members);
  // делегируем каждую укомплектованную подзадачу + постим назначение в комнату
  for (const c of crew) {
    if (!c.agent_id) continue;
    try {
      const d = await delegate(manager, c.agent_id, { text: c.subtask, goal, room: room.room_id }, { threadId: 'room:' + room.room_id });
      c.delegation_id = d.ok ? d.id : null;
      await postRoom(room.room_id, manager, `Назначение: «${c.subtask}» → ${c.agent_name || ('#' + c.agent_id)}${d.ok ? ' (делегация #' + d.id + ')' : ''}`, true);
    } catch { /* одно назначение не роняет сбор */ }
  }
  return { ok: true, room_id: room.room_id, crew, unstaffed };
}

// ═══ 9. AGENT SITUATION ROOM (network_status) ═══════════════════════════════
/** Один вызов «что у меня в сети»: непрочитанное, где мой ход, открытые сделки/делегации,
 *  комнаты, моя peer-репутация. Дешёвая read-агрегация — экономит round-trips агента. */
export async function statusFor(agentId: number): Promise<any> {
  const mb = require('./v3-mailbox');
  const [unread, deals, delegs, rooms, rep] = await Promise.all([
    mb.unreadCount(agentId).catch(() => 0),
    listHandshakes(agentId, 20).catch(() => []),
    delegationStatus(agentId, { limit: 20 }).catch(() => []),
    listRooms(agentId, 10).catch(() => []),
    peerReputation(agentId).catch(() => ({ score: 0, endorsers: 0, signals: 0 })),
  ]);
  const yourMove = (deals as any[]).filter((d: any) => d.your_move);
  const openDeals = (deals as any[]).filter((d: any) => ['proposed', 'countered'].indexOf(d.state) >= 0);
  const openDelegs = (delegs as any[]).filter((d: any) => ['open', 'accepted'].indexOf(d.status) >= 0);
  return {
    ok: true,
    unread, your_move_deals: yourMove.length, open_deals: openDeals.length,
    open_delegations: openDelegs.length, rooms: (rooms as any[]).length, peer_reputation: rep,
    deals_awaiting_you: yourMove.slice(0, 5).map((d: any) => ({ id: d.id, state: d.state, terms: d.terms })),
    delegation_items: openDelegs.slice(0, 5).map((d: any) => ({ id: d.id, role: d.role, status: d.status })),
    room_list: (rooms as any[]).slice(0, 5),
    hint: 'unread → network_inbox · your_move_deals → network_deal(list) · delegations → network_delegate(status)',
  };
}

// ═══ 10. OFFER-EXPIRY SWEEPER ═══════════════════════════════════════════════
/** Фоновый разбор: сделки с истёкшим expires_at (proposed/countered) → 'expired' + пинг обеим
 *  сторонам. Чтобы офферы не висели вечно «предложено». Зовётся по интервалу из index.ts. */
export async function sweepExpiredHandshakes(): Promise<{ expired: number }> {
  const r = await pool().query(
    `UPDATE builder_bot.v3_handshakes SET state='expired', updated_at=NOW()
      WHERE state IN ('proposed','countered') AND expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING id, initiator, counterparty`);
  for (const h of r.rows) {
    try {
      const a2a = require('./v3-a2a');
      await a2a.notifyPeer(null, Number(h.initiator), `Сделка #${h.id} истекла (не приняли вовремя).`, 'inform', 'deal:' + h.id);
      await a2a.notifyPeer(null, Number(h.counterparty), `Сделка #${h.id} истекла.`, 'inform', 'deal:' + h.id);
    } catch { /* */ }
  }
  if (r.rows.length) console.log(`[V3A2ACoop] swept ${r.rows.length} expired handshakes`);
  return { expired: r.rows.length };
}
