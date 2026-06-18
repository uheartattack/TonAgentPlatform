/**
 * v3-jobs.ts — v3.0 «Autonomous Network» Фаза 0: cross-owner доска оплачиваемых задач.
 *
 * Поток (killer-демо): заказчик постит задачу с баунти → деплоит+фандит per-deal Escrow
 *   (подписывает САМ через ton://-ссылку, бот деньги не двигает) → исполнитель (агент другого
 *   владельца) КЛЕЙМИТ (гейтинг по trust-tier) → сдаёт → заказчик принимает / молчит → авто-релиз
 *   → escrow платит GRAM исполнителю (минус комиссия TAP) → индексер обновляет репутацию.
 *
 * ⚠️ Деньги: всё за флагом V3_JOBS_ENABLED (по умолчанию ВЫКЛ). Escrow на mainnet держит реальные
 *   (в т.ч. чужие) средства — включать только после формального аудита escrow + явного решения.
 *   Комиссия V3_JOB_FEE_BPS (по умолчанию 0 — «холодный старт 0%» по дизайну). Fee dest → TAP_TREASURY.
 *
 * Escrow-код: contracts/build/Escrow.compiled.json в V3_CONTRACTS_DIR (scp на сервер).
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { Address, beginCell, Cell, contractAddress, storeStateInit, toNano } from '@ton/core';
import { TonClient } from '@ton/ton';

const TREASURY = (() => {
  try { return Address.parse(process.env.TAP_TREASURY || 'EQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y6qk'); }
  catch { return Address.parse('EQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y6qk'); }
})();
const CONTRACTS_DIR = process.env.V3_CONTRACTS_DIR || path.join(__dirname, '..', '..', 'v3-contracts');
const FEE_BPS = Math.max(0, Math.min(10000, Number(process.env.V3_JOB_FEE_BPS) || 0)); // 0% cold-start
const TESTNET = (process.env.V3_TON_ENDPOINT || '').includes('testnet');

const ESCROW_OPS = { claim: 0x4a434c41, deliver: 0x4a444c56, accept: 0x4a414350, autorelease: 0x4a415552, refund: 0x4a524644, reject: 0x4a524a54 };
const ESCROW_STATUS = { FUNDED: 0, CLAIMED: 1, DELIVERED: 2, RELEASED: 3, REFUNDED: 4 };

// Лимит баунти по трасту (анти-абьюз на старте). GRAM.
const TIER_BOUNTY_LIMIT_GRAM: Record<string, number> = {
  unverified: 2, bronze: 10, silver: 100, gold: 1000, platinum: Number.MAX_SAFE_INTEGER,
};

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Jobs] not initialized'); return _pool; };

function escrowCode(): Cell {
  const j = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, 'Escrow.compiled.json'), 'utf8'));
  return Cell.fromBoc(Buffer.from(j.hex, 'hex'))[0];
}

// Точная копия storage-layout из wrappers/Escrow.ts (адрес контракта детерминирован от data).
function escrowData(poster: Address, executor: Address | null, amountNano: bigint, deadline: number, acceptWindow: number): Cell {
  return beginCell()
    .storeUint(ESCROW_STATUS.FUNDED, 8)
    .storeAddress(poster)
    .storeAddress(executor)
    .storeAddress(TREASURY)
    .storeCoins(amountNano)
    .storeUint(FEE_BPS, 16)
    .storeUint(deadline, 64)
    .storeUint(acceptWindow, 32)
    .storeUint(0, 64)
    .endCell();
}

function transferLink(to: string, amountNano: bigint, init?: { code: Cell; data: Cell }, body?: Cell): string {
  let q = `amount=${amountNano.toString()}`;
  if (init) {
    const si = beginCell().store(storeStateInit(init)).endCell();
    q += `&init=${encodeURIComponent(si.toBoc().toString('base64'))}`;
  }
  if (body) q += `&bin=${encodeURIComponent(body.toBoc().toString('base64'))}`;
  return `ton://transfer/${to}?${q}`;
}

const opBody = (op: number) => beginCell().storeUint(op, 32).storeUint(0, 64).endCell();

// ── DDL (идемпотентно) ──────────────────────────────────────────────────────
export async function initV3Jobs(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_job_specs (
      id              BIGSERIAL PRIMARY KEY,
      poster_user     BIGINT,
      poster_agent    INTEGER,
      poster_wallet   TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      category        TEXT,
      bounty_nano     NUMERIC NOT NULL,
      deadline        BIGINT NOT NULL,
      accept_window   INTEGER NOT NULL,
      escrow_addr     TEXT,
      executor_agent  INTEGER,
      executor_user   BIGINT,
      status          SMALLINT NOT NULL DEFAULT 0,   -- зеркало escrow-статуса (0..4); до фандинга = 0
      rep_settled     BOOLEAN NOT NULL DEFAULT FALSE, -- репутация уже учтена по финальному статусу
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_jobspec_status ON builder_bot.v3_job_specs (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_v3_jobspec_escrow ON builder_bot.v3_job_specs (escrow_addr);
  `);
  // Фаза 1: режим задачи (fixed | auction) + победитель аукциона + таблица бидов.
  await pgPool.query(`
    ALTER TABLE builder_bot.v3_job_specs ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'fixed';
    ALTER TABLE builder_bot.v3_job_specs ADD COLUMN IF NOT EXISTS awarded_agent INTEGER;
    CREATE TABLE IF NOT EXISTS builder_bot.v3_job_bids (
      id            BIGSERIAL PRIMARY KEY,
      job_id        BIGINT NOT NULL,
      bidder_agent  INTEGER NOT NULL,
      bidder_wallet TEXT,
      amount_nano   NUMERIC NOT NULL,
      note          TEXT,
      tier          TEXT,
      role          TEXT,
      effective     INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (job_id, bidder_agent)
    );
    CREATE INDEX IF NOT EXISTS idx_v3_bids_job ON builder_bot.v3_job_bids (job_id, effective DESC);
  `);
  console.log('[V3Jobs] tables ready (fee_bps=' + FEE_BPS + (TESTNET ? ', testnet' : ', mainnet') + ')');
}

// ── Создать задачу: спека + детерминированный адрес escrow + ссылка на деплой+фандинг ──
export async function createJob(args: {
  posterUser?: number | string | null; posterAgent?: number | null; posterWallet: string;
  title: string; description?: string; category?: string; mode?: string;
  bountyGram: number; deadlineUnix: number; acceptWindowSec?: number;
}): Promise<{ ok: boolean; jobId: string; escrowAddr: string; deployLink: string; feeBps: number; mode: string }> {
  const poster = Address.parse(args.posterWallet);
  const amountNano = toNano(String(args.bountyGram));
  const acceptWindow = args.acceptWindowSec && args.acceptWindowSec > 0 ? args.acceptWindowSec : 86400;
  if (amountNano <= 0n) throw new Error('bounty must be > 0');
  if (args.deadlineUnix <= Math.floor(Date.now() / 1000)) throw new Error('deadline must be in the future');

  const data = escrowData(poster, null, amountNano, args.deadlineUnix, acceptWindow);
  const init = { code: escrowCode(), data };
  const addr = contractAddress(0, init);
  const escrowAddr = addr.toString({ bounceable: false, testOnly: TESTNET });
  // деплой = фандинг: value = баунти + газ
  const deployLink = transferLink(escrowAddr, amountNano + toNano('0.1'), init);

  const mode = args.mode === 'auction' ? 'auction' : 'fixed';
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_job_specs
       (poster_user, poster_agent, poster_wallet, title, description, category, bounty_nano, deadline, accept_window, escrow_addr, status, mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11) RETURNING id`,
    [args.posterUser ?? null, args.posterAgent ?? null, poster.toString(), args.title, args.description ?? null,
     args.category ?? null, amountNano.toString(), args.deadlineUnix, acceptWindow, addr.toString(), mode],
  );
  return { ok: true, jobId: String(r.rows[0].id), escrowAddr, deployLink, feeBps: FEE_BPS, mode };
}

// ── Аукцион: бид исполнителя, список бидов, выбор победителя заказчиком ──
export async function placeBid(jobId: string, bidderAgent: number, bidderWallet: string | null, amountGram: number, note?: string): Promise<any> {
  const j = (await pool().query(`SELECT * FROM builder_bot.v3_job_specs WHERE id=$1`, [jobId])).rows[0];
  if (!j) return { ok: false, error: 'job not found' };
  if (j.mode !== 'auction') return { ok: false, error: 'job is not an auction' };
  if (j.status !== ESCROW_STATUS.FUNDED) return { ok: false, error: 'job not open' };
  const bountyGram = Number(BigInt(j.bounty_nano)) / 1e9;
  if (!(amountGram > 0) || amountGram > bountyGram) return { ok: false, error: 'bid must be in (0, bounty]' };
  // снимок репутации/роли/effective бидера под категорию задачи
  let tier = 'unverified', trust = 0, role = 'worker';
  try { const { getTrustScore } = require('./agent-reputation'); const ts = await getTrustScore(bidderAgent); if (ts) { tier = ts.tier || tier; trust = ts.score || 0; } } catch { /* */ }
  try { const ar = await pool().query(`SELECT role FROM builder_bot.agents WHERE id=$1`, [bidderAgent]); if (ar.rows[0]) role = ar.rows[0].role || 'worker'; } catch { /* */ }
  const { effectiveScore } = require('./v3-roles');
  const eff = effectiveScore(trust, role, j.category);
  await pool().query(
    `INSERT INTO builder_bot.v3_job_bids (job_id, bidder_agent, bidder_wallet, amount_nano, note, tier, role, effective)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (job_id, bidder_agent) DO UPDATE SET amount_nano=EXCLUDED.amount_nano, note=EXCLUDED.note,
       tier=EXCLUDED.tier, role=EXCLUDED.role, effective=EXCLUDED.effective, created_at=NOW()`,
    [jobId, bidderAgent, bidderWallet, toNano(String(amountGram)).toString(), note || null, tier, role, eff],
  );
  return { ok: true, jobId, bidderAgent, amountGram, tier, role, effective: eff };
}

export async function listBids(jobId: string): Promise<any[]> {
  const r = await pool().query(
    `SELECT id, bidder_agent, bidder_wallet, amount_nano, note, tier, role, effective, created_at
       FROM builder_bot.v3_job_bids WHERE job_id=$1 ORDER BY effective DESC NULLS LAST, amount_nano ASC`,
    [jobId],
  );
  return r.rows.map((x) => ({ ...x, amount_gram: Number(BigInt(x.amount_nano)) / 1e9 }));
}

export async function awardJob(jobId: string, posterUser: number | string, winnerAgent: number): Promise<any> {
  const j = (await pool().query(`SELECT * FROM builder_bot.v3_job_specs WHERE id=$1`, [jobId])).rows[0];
  if (!j) return { ok: false, error: 'job not found' };
  if (j.poster_user != null && String(j.poster_user) !== String(posterUser)) return { ok: false, error: 'only poster can award' };
  const bid = (await pool().query(`SELECT 1 FROM builder_bot.v3_job_bids WHERE job_id=$1 AND bidder_agent=$2`, [jobId, winnerAgent])).rows[0];
  if (!bid) return { ok: false, error: 'no bid from that agent' };
  await pool().query(`UPDATE builder_bot.v3_job_specs SET awarded_agent=$2, updated_at=NOW() WHERE id=$1`, [jobId, winnerAgent]);
  return { ok: true, jobId, awardedAgent: winnerAgent };
}

export async function listJobs(opts?: { status?: number; limit?: number; category?: string }): Promise<any[]> {
  const limit = Math.min(Math.max(1, opts?.limit || 50), 200);
  const conds: string[] = []; const params: any[] = [];
  if (opts && Number.isFinite(opts.status as number)) { params.push(opts.status); conds.push(`status=$${params.length}`); }
  if (opts && opts.category) { params.push(opts.category); conds.push(`category=$${params.length}`); }
  params.push(limit);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await pool().query(
    `SELECT id, poster_agent, title, description, category, bounty_nano, deadline, accept_window,
            escrow_addr, executor_agent, status, created_at
       FROM builder_bot.v3_job_specs ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((x) => ({ ...x, bounty_gram: Number(BigInt(x.bounty_nano)) / 1e9 }));
}

// ── Клейм-гейтинг по trust-tier + ссылка на claim-op для подписи исполнителем ──
export async function claimJob(jobId: string, executorAgentId: number, executorWallet?: string): Promise<any> {
  const j = (await pool().query(`SELECT * FROM builder_bot.v3_job_specs WHERE id=$1`, [jobId])).rows[0];
  if (!j) return { ok: false, allowed: false, reason: 'job not found' };
  if (j.status !== ESCROW_STATUS.FUNDED) return { ok: false, allowed: false, reason: 'job not open (status ' + j.status + ')' };

  // 1) репутация исполнителя
  let tier = 'unverified', trust = 0;
  try {
    const { getTrustScore } = require('./agent-reputation');
    const ts = await getTrustScore(executorAgentId);
    if (ts) { tier = ts.tier || 'unverified'; trust = ts.score || 0; }
  } catch (e: any) { console.warn('[V3Jobs] trust lookup failed:', e?.message); }

  // 2) роль исполнителя → вес роли × аффинити к категории задачи модулируют допуск баунти
  let role = 'worker';
  try { const ar = await pool().query(`SELECT role FROM builder_bot.agents WHERE id=$1`, [executorAgentId]); if (ar.rows[0]) role = ar.rows[0].role || 'worker'; } catch { /* нет агента */ }
  const { roleWeight, roleFit, effectiveScore } = require('./v3-roles');
  const w = roleWeight(role); const fit = roleFit(role, j.category);
  const effective = effectiveScore(trust, role, j.category);

  const bountyGram = Number(BigInt(j.bounty_nano)) / 1e9;
  const base = TIER_BOUNTY_LIMIT_GRAM[tier] ?? 0;
  const limit = base >= Number.MAX_SAFE_INTEGER ? base : Math.round(base * w * (0.5 + 0.5 * fit) * 100) / 100;
  const meta = { tier, role, trust, roleWeight: w, roleFit: Number(fit.toFixed(2)), effective, limit, bountyGram, category: j.category || null };
  if (bountyGram > limit) {
    return { ok: true, allowed: false, ...meta,
      reason: `тир ${tier}/${role}: допуск ${limit} GRAM (база ${base}×вес ${w}×фит ${fit.toFixed(2)}), задача ${bountyGram} GRAM` };
  }

  await pool().query(
    `UPDATE builder_bot.v3_job_specs SET executor_agent=$2, executor_user=$3, updated_at=NOW() WHERE id=$1`,
    [jobId, executorAgentId, null],
  );
  // ссылка claim-op (исполнитель подписывает; on-chain статус сменит индексер)
  const claimLink = transferLink(
    Address.parse(j.escrow_addr).toString({ bounceable: true, testOnly: TESTNET }),
    toNano('0.05'), undefined, opBody(ESCROW_OPS.claim),
  );
  return { ok: true, allowed: true, ...meta, claimLink };
}

// ── Ссылка на op (deliver/accept/refund/reject) для подписи стороной сделки ──
export function jobOpLink(escrowAddr: string, op: 'deliver' | 'accept' | 'refund' | 'reject' | 'autorelease'): string {
  return transferLink(
    Address.parse(escrowAddr).toString({ bounceable: true, testOnly: TESTNET }),
    toNano('0.05'), undefined, opBody(ESCROW_OPS[op]),
  );
}

function jobsClient(): TonClient {
  const endpoint = process.env.V3_TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
  const apiKey = process.env.V3_TONCENTER_API_KEY || (endpoint.includes('testnet') ? process.env.TONCENTER_API_KEY : undefined);
  return new TonClient({ endpoint, apiKey });
}

// ── Синк статусов escrow + хук репутации (вызывать по интервалу из индексера) ──
export async function pollJobEscrows(client?: any): Promise<{ checked: number; settled: number }> {
  if (!client) client = jobsClient();
  const open = await pool().query(
    `SELECT id, escrow_addr, executor_agent, poster_user, status, rep_settled
       FROM builder_bot.v3_job_specs WHERE escrow_addr IS NOT NULL AND rep_settled=FALSE`,
  );
  let settled = 0;
  for (const j of open.rows) {
    await new Promise((r) => setTimeout(r, 1100)); // троттл RPC
    let st: number;
    try {
      const res = await client.runMethod(Address.parse(j.escrow_addr), 'get_status');
      st = res.stack.readNumber();
    } catch { continue; } // ещё не задеплоен/недоступен
    if (st === j.status) continue;
    await pool().query(`UPDATE builder_bot.v3_job_specs SET status=$2, updated_at=NOW() WHERE id=$1`, [j.id, st]);
    // финальные статусы → учёт репутации исполнителя (отзыв от заказчика-контрагента)
    if ((st === ESCROW_STATUS.RELEASED || st === ESCROW_STATUS.REFUNDED) && j.executor_agent != null) {
      try {
        const { addReview, calculateTrustScore } = require('./agent-reputation');
        const rating = st === ESCROW_STATUS.RELEASED ? 5 : 2;
        const reviewer = j.poster_user != null ? Number(j.poster_user) : 0;
        await addReview(j.executor_agent, reviewer, rating, st === ESCROW_STATUS.RELEASED ? 'escrow released' : 'escrow refund/timeout');
        await calculateTrustScore(j.executor_agent);
        settled++;
      } catch (e: any) { console.warn('[V3Jobs] reputation hook failed:', e?.message); }
      await pool().query(`UPDATE builder_bot.v3_job_specs SET rep_settled=TRUE WHERE id=$1`, [j.id]);
    }
  }
  return { checked: open.rows.length, settled };
}
