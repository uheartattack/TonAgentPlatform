/**
 * v3-network.ts — off-chain мост к v3.0 Autonomous Network (on-chain контракты).
 *
 * ⚠️ v0 / ИЗОЛИРОВАННЫЙ. Новый модуль, новые таблицы (builder_bot schema).
 * НЕ подключён к startup, НЕ меняет существующие флоу — инертен, пока его явно
 * не заинитят (initV3Network) и не запустят поллер. Тестировать на сервере.
 *
 * Что делает:
 *   - зеркалит on-chain состояние агент-NFT (владелец, провенанс) в БД для Studio;
 *   - при transfer агента (= продажа) — биндит агента к аккаунту покупателя,
 *     пишет историю продаж, дёргает хук провижнинга (стереть личное / оставить навыки);
 *   - зеркалит escrow-сделки (доска задач) + статусы.
 *
 * Контракты (testnet): Agent Collection (provenance) = 0QD8QO30…, escrow — per-job.
 * On-chain истина первична; это — кэш/витрина + триггеры провижнинга.
 */

import type { Pool } from 'pg';
import { TonClient, Address, TupleBuilder } from '@ton/ton';

let _pool: Pool | null = null;
let _client: TonClient | null = null;
let _collection: Address | null = null;
function pool(): Pool {
  if (!_pool) throw new Error('[V3Network] not initialised — call initV3Network(pool) first');
  return _pool;
}

// ── Внешние зависимости (инъекция, чтобы не тащить связки) ──────────────────
export interface V3Deps {
  /** wallet-адрес → tap user_id (из agentic_wallets/TonConnect). null если не наш юзер.
   *  Возвращается СТРОКОЙ (BIGINT) — 19-значные Telegram OIDC id не влезают в JS Number. */
  resolveUserByWallet: (walletAddress: string) => Promise<number | string | null>;
  /** Провижнинг агента новому владельцу: привязать к user_id (+ опц. скраб секретов).
   *  newUserId — number|string (BIGINT-safe). */
  provisionAgentToOwner: (agentNft: string, tapAgentId: number | null, newUserId: number | string) => Promise<void>;
  /** Слэш репутации исполнителя (reject/timeout по escrow). */
  slashReputation?: (executorWallet: string, reason: string) => Promise<void>;
}
let _deps: V3Deps | null = null;
function deps(): V3Deps {
  if (!_deps) throw new Error('[V3Network] deps not set — pass to initV3Network');
  return _deps;
}

// ── Init / DDL (идемпотентно) ───────────────────────────────────────────────
export async function initV3Network(
  pgPool: Pool,
  depsImpl: V3Deps,
  config: { endpoint: string; collectionAddress: string },
): Promise<void> {
  _pool = pgPool;
  _deps = depsImpl;
  // V3_TONCENTER_API_KEY (опц.) приоритетнее; иначе на testnet — общий TONCENTER_API_KEY (снимает 429),
  // на mainnet анонимно (общий ключ testnet-only → 403). Снять лимит на mainnet → задать V3_TONCENTER_API_KEY.
  const apiKey = process.env.V3_TONCENTER_API_KEY || (config.endpoint.includes('testnet') ? process.env.TONCENTER_API_KEY : undefined);
  _client = new TonClient({ endpoint: config.endpoint, apiKey });
  _collection = Address.parse(config.collectionAddress);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_agents (
      agent_nft       TEXT PRIMARY KEY,
      collection      TEXT NOT NULL,
      tap_agent_id    BIGINT,
      creator         TEXT,                       -- оригинальный автор (не меняется)
      current_owner   TEXT,                       -- on-chain владелец (wallet)
      bound_user_id   BIGINT,                     -- tap user (владелец) в Studio
      transfer_count  INTEGER NOT NULL DEFAULT 0,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_agent_provenance (
      id          BIGSERIAL PRIMARY KEY,
      agent_nft   TEXT NOT NULL,
      event       TEXT NOT NULL,                  -- 'mint' | 'transfer'
      from_addr   TEXT,
      to_addr     TEXT,
      tx_hash     TEXT,
      at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_prov_agent ON builder_bot.v3_agent_provenance (agent_nft, at);
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_jobs (
      escrow_addr   TEXT PRIMARY KEY,
      poster        TEXT,
      executor      TEXT,
      tap           TEXT,
      amount_nano   NUMERIC,
      fee_bps       INTEGER,
      status        SMALLINT,                     -- 0 FUNDED 1 CLAIMED 2 DELIVERED 3 RELEASED 4 REFUNDED
      deadline      BIGINT,
      accept_window INTEGER,
      delivered_at  BIGINT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_jobs_status ON builder_bot.v3_jobs (status);
  `);
  // курсор поллера (последний обработанный lt по адресу)
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_indexer_cursor (
      address    TEXT PRIMARY KEY,
      last_lt    NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('[V3Network] tables ready');
}

// ── Агенты: минт ────────────────────────────────────────────────────────────
export async function onAgentMint(args: {
  agentNft: string; collection: string; tapAgentId: number | null;
  creator: string; owner: string; txHash?: string;
}): Promise<void> {
  const ownerUser = await deps().resolveUserByWallet(args.owner);
  await pool().query(
    `INSERT INTO builder_bot.v3_agents (agent_nft, collection, tap_agent_id, creator, current_owner, bound_user_id, transfer_count)
     VALUES ($1,$2,$3,$4,$5,$6,0)
     ON CONFLICT (agent_nft) DO UPDATE SET collection=EXCLUDED.collection, tap_agent_id=EXCLUDED.tap_agent_id,
       creator=EXCLUDED.creator, current_owner=EXCLUDED.current_owner, bound_user_id=EXCLUDED.bound_user_id, updated_at=NOW()`,
    [args.agentNft, args.collection, args.tapAgentId, args.creator, args.owner, ownerUser],
  );
  await pool().query(
    `INSERT INTO builder_bot.v3_agent_provenance (agent_nft, event, from_addr, to_addr, tx_hash)
     VALUES ($1,'mint',NULL,$2,$3)`,
    [args.agentNft, args.owner, args.txHash ?? null],
  );
  console.log(`[V3Network] mint ${args.agentNft} → owner ${args.owner} (creator ${args.creator})`);
}

// ── Агенты: transfer (= продажа) → бинд покупателю + провижнинг ──────────────
export async function onAgentTransfer(args: {
  agentNft: string; from: string; to: string; txHash?: string;
}): Promise<void> {
  const buyerUser = await deps().resolveUserByWallet(args.to);
  const row = await pool().query(`SELECT tap_agent_id FROM builder_bot.v3_agents WHERE agent_nft=$1`, [args.agentNft]);
  const tapAgentId: number | null = row.rows[0]?.tap_agent_id ?? null;

  await pool().query(
    `UPDATE builder_bot.v3_agents
     SET current_owner=$2, bound_user_id=$3, transfer_count=transfer_count+1, updated_at=NOW()
     WHERE agent_nft=$1`,
    [args.agentNft, args.to, buyerUser],
  );
  await pool().query(
    `INSERT INTO builder_bot.v3_agent_provenance (agent_nft, event, from_addr, to_addr, tx_hash)
     VALUES ($1,'transfer',$2,$3,$4)`,
    [args.agentNft, args.from, args.to, args.txHash ?? null],
  );

  // «магия вторички»: агент оживает в кабинете покупателя (если он наш юзер)
  if (buyerUser != null) {
    await deps().provisionAgentToOwner(args.agentNft, tapAgentId, buyerUser);
    console.log(`[V3Network] agent ${args.agentNft} sold ${args.from}→${args.to}, provisioned to user ${buyerUser}`);
  } else {
    console.log(`[V3Network] agent ${args.agentNft} transferred to non-registered ${args.to} — dormant до онбординга`);
  }
}

// ── Escrow: зеркалирование сделки + триггеры ─────────────────────────────────
export async function onEscrowUpdate(deal: {
  escrowAddr: string; poster: string; executor: string | null; tap: string;
  amountNano: string; feeBps: number; status: number;
  deadline: number; acceptWindow: number; deliveredAt: number;
}): Promise<void> {
  await pool().query(
    `INSERT INTO builder_bot.v3_jobs (escrow_addr, poster, executor, tap, amount_nano, fee_bps, status, deadline, accept_window, delivered_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (escrow_addr) DO UPDATE SET executor=EXCLUDED.executor, status=EXCLUDED.status,
       delivered_at=EXCLUDED.delivered_at, updated_at=NOW()`,
    [deal.escrowAddr, deal.poster, deal.executor, deal.tap, deal.amountNano, deal.feeBps,
     deal.status, deal.deadline, deal.acceptWindow, deal.deliveredAt],
  );
  // status 4 REFUNDED после DELIVERED = reject → слэш исполнителя (если задан)
  if (deal.status === 4 && deal.executor && deps().slashReputation) {
    await deps().slashReputation!(deal.executor, 'escrow_refund_after_deliver');
  }
}

// ── Витрина для Studio ──────────────────────────────────────────────────────
export async function getAgentProvenance(agentNft: string) {
  // нормализуем адрес к той же форме, что хранит поллер (Address.toString() default)
  let key = agentNft;
  try { key = Address.parse(agentNft).toString(); } catch { /* оставляем как есть */ }
  // bound_user_id (Telegram id) НЕ отдаём наружу — это PII; витрина публичная.
  const a = await pool().query(
    `SELECT agent_nft, creator, current_owner, transfer_count FROM builder_bot.v3_agents WHERE agent_nft=$1`,
    [key],
  );
  const hist = await pool().query(
    `SELECT event, from_addr, to_addr, tx_hash, at FROM builder_bot.v3_agent_provenance WHERE agent_nft=$1 ORDER BY at ASC`,
    [key],
  );
  return { agent: a.rows[0] ?? null, history: hist.rows };
}

export async function listOpenJobs(limit = 50) {
  const r = await pool().query(
    `SELECT * FROM builder_bot.v3_jobs WHERE status IN (0,1) ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows;
}

/** Паспорт on-chain агента по его tap_agent_id (id платформенного агента).
 *  Прим.: tap_agent_id — BIGINT, node-postgres отдаёт его строкой; на фронте String()/Number().
 *  bound_user_id (PII) наружу не отдаём. */
export async function getAgentByTapId(tapId: number) {
  const a = await pool().query(
    `SELECT agent_nft, collection, tap_agent_id, creator, current_owner, transfer_count, updated_at
       FROM builder_bot.v3_agents WHERE tap_agent_id=$1 ORDER BY updated_at DESC LIMIT 1`,
    [tapId],
  );
  if (a.rows.length === 0) return { onchain: false, agent: null, history: [] as any[] };
  const nft = a.rows[0].agent_nft;
  const hist = await pool().query(
    `SELECT event, from_addr, to_addr, tx_hash, at FROM builder_bot.v3_agent_provenance WHERE agent_nft=$1 ORDER BY at ASC`,
    [nft],
  );
  return { onchain: true, agent: a.rows[0], history: hist.rows };
}

/** Список агентов сети (cross-owner реестр) для витрины Studio. */
export async function listNetworkAgents(limit = 100) {
  const r = await pool().query(
    `SELECT agent_nft, collection, tap_agent_id, creator, current_owner, transfer_count, updated_at
       FROM builder_bot.v3_agents ORDER BY updated_at DESC LIMIT $1`,
    [Math.min(Math.max(1, limit), 500)],
  );
  return r.rows;
}

// ── Поллер цепочки ──────────────────────────────────────────────────────────
// Обходит коллекцию через get-методы (проверено на testnet: index-collection.js),
// сверяет on-chain состояние агентов с БД, пишет провенанс + провижнит покупателя.
// Источник истины — on-chain get_provenance/get_nft_data (не парсинг тел сообщений).
// Запускать по интервалу из index.ts (напр. каждые 30–60с).
export async function pollChainOnce(): Promise<{ scanned: number; mints: number; sales: number }> {
  if (!_client || !_collection) throw new Error('[V3Network] not configured — call initV3Network with config');
  const client = _client;
  const coll = _collection;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const THROTTLE = 1100; // toncenter без ключа лимитит ~1 req/s — троттлим вызовы

  const cd = await client.runMethod(coll, 'get_collection_data');
  const nextIndex = cd.stack.readBigNumber();

  let scanned = 0, mints = 0, sales = 0;
  for (let i = 0n; i < nextIndex; i++) {
    await sleep(THROTTLE);
    const tb = new TupleBuilder();
    tb.writeNumber(i);
    const ra = await client.runMethod(coll, 'get_nft_address_by_index', tb.build());
    const itemAddr = ra.stack.readAddress();
    const nft = itemAddr.toString();

    await sleep(THROTTLE);
    // провенанс (источник истины)
    const pv = await client.runMethod(itemAddr, 'get_provenance');
    const creator = pv.stack.readAddressOpt();
    pv.stack.readBigNumber();                       // mint_time
    const onchainCount = Number(pv.stack.readBigNumber());
    const lastSeller = pv.stack.readAddressOpt();
    pv.stack.readBigNumber();                       // last_transfer_time

    await sleep(THROTTLE);
    const nd = await client.runMethod(itemAddr, 'get_nft_data');
    nd.stack.readBoolean(); nd.stack.readBigNumber(); nd.stack.readAddressOpt();
    const owner = nd.stack.readAddressOpt();

    let tapAgentId: number | null = null;
    try {
      await sleep(THROTTLE);
      const ad = await client.runMethod(itemAddr, 'get_agent_data');
      ad.stack.readBigNumber(); ad.stack.readCell(); tapAgentId = Number(ad.stack.readBigNumber());
    } catch { /* агент без get_agent_data */ }

    scanned++;
    const ownerStr = owner ? owner.toString() : null;
    const creatorStr = creator ? creator.toString() : null;
    const sellerStr = lastSeller ? lastSeller.toString() : null;
    const buyerUser = ownerStr ? await deps().resolveUserByWallet(ownerStr) : null;

    const existing = await pool().query(`SELECT transfer_count FROM builder_bot.v3_agents WHERE agent_nft=$1`, [nft]);

    if (existing.rows.length === 0) {
      await pool().query(
        `INSERT INTO builder_bot.v3_agents (agent_nft, collection, tap_agent_id, creator, current_owner, bound_user_id, transfer_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (agent_nft) DO NOTHING`,
        [nft, coll.toString(), tapAgentId, creatorStr, ownerStr, buyerUser, onchainCount],
      );
      await pool().query(
        `INSERT INTO builder_bot.v3_agent_provenance (agent_nft, event, from_addr, to_addr) VALUES ($1,'mint',NULL,$2)`,
        [nft, creatorStr],
      );
      mints++;
    } else if (onchainCount > Number(existing.rows[0].transfer_count)) {
      // была продажа с прошлого опроса
      await pool().query(
        `UPDATE builder_bot.v3_agents SET current_owner=$2, bound_user_id=$3, transfer_count=$4, updated_at=NOW() WHERE agent_nft=$1`,
        [nft, ownerStr, buyerUser, onchainCount],
      );
      await pool().query(
        `INSERT INTO builder_bot.v3_agent_provenance (agent_nft, event, from_addr, to_addr) VALUES ($1,'transfer',$2,$3)`,
        [nft, sellerStr, ownerStr],
      );
      // «магия вторички»: агент оживает у покупателя (стереть личное / оставить навыки)
      if (buyerUser != null) { await deps().provisionAgentToOwner(nft, tapAgentId, buyerUser); }
      sales++;
    }
  }
  return { scanned, mints, sales };
}
