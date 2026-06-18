/**
 * v3-rental.ts — аренда агентов (v3.0 Фаза 1).
 *
 * Владелец выставляет агента в аренду по цене/день; арендатор берёт на N дней и платит
 *   через тот же escrow (арендатор=заказчик → владелец=исполнитель, релиз по окончании окна).
 * MVP: учёт оффера/аренды + escrow-ссылка оплаты. Rental-mode рантайма (скиллы активны,
 *   приватная память владельца скрыта) — отдельный слой поверх (помечаем окно аренды).
 */
import { Pool } from 'pg';
import { toNano } from '@ton/core';

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Rental] not initialized'); return _pool; };

export async function initV3Rental(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_rental_offers (
      id              BIGSERIAL PRIMARY KEY,
      tap_agent_id    INTEGER NOT NULL UNIQUE,
      agent_nft       TEXT,
      owner_user      BIGINT,
      owner_wallet    TEXT NOT NULL,
      price_day_nano  NUMERIC NOT NULL,
      min_days        INTEGER NOT NULL DEFAULT 1,
      note            TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS builder_bot.v3_rentals (
      id            BIGSERIAL PRIMARY KEY,
      offer_id      BIGINT,
      tap_agent_id  INTEGER NOT NULL,
      owner_user    BIGINT,
      renter_user   BIGINT,
      renter_wallet TEXT,
      days          INTEGER NOT NULL,
      total_nano    NUMERIC NOT NULL,
      escrow_addr   TEXT,
      status        SMALLINT NOT NULL DEFAULT 0,  -- 0 pending(funding) · 1 active · 2 ended
      start_at      BIGINT,
      end_at        BIGINT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_rentals_agent ON builder_bot.v3_rentals (tap_agent_id, status);
  `);
  console.log('[V3Rental] tables ready');
}

export async function offerRental(args: {
  ownerUser: number | string; tapAgentId: number; agentNft?: string; ownerWallet: string;
  pricePerDayGram: number; minDays?: number; note?: string;
}): Promise<{ ok: boolean; offerId: string }> {
  if (!(args.pricePerDayGram > 0)) throw new Error('price/day must be > 0');
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_rental_offers (tap_agent_id, agent_nft, owner_user, owner_wallet, price_day_nano, min_days, note, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
     ON CONFLICT (tap_agent_id) DO UPDATE SET agent_nft=EXCLUDED.agent_nft, owner_user=EXCLUDED.owner_user,
       owner_wallet=EXCLUDED.owner_wallet, price_day_nano=EXCLUDED.price_day_nano, min_days=EXCLUDED.min_days,
       note=EXCLUDED.note, active=TRUE RETURNING id`,
    [args.tapAgentId, args.agentNft ?? null, args.ownerUser ?? null, args.ownerWallet,
     toNano(String(args.pricePerDayGram)).toString(), args.minDays && args.minDays > 0 ? args.minDays : 1, args.note ?? null],
  );
  return { ok: true, offerId: String(r.rows[0].id) };
}

export async function cancelOffer(ownerUser: number | string, tapAgentId: number): Promise<{ ok: boolean }> {
  await pool().query(`UPDATE builder_bot.v3_rental_offers SET active=FALSE WHERE tap_agent_id=$1 AND owner_user=$2`, [tapAgentId, ownerUser]);
  return { ok: true };
}

export async function listOffers(limit = 50): Promise<any[]> {
  const r = await pool().query(
    `SELECT o.id, o.tap_agent_id, o.agent_nft, o.owner_wallet, o.price_day_nano, o.min_days, o.note, o.created_at,
            a.role AS role, a.name AS name, COALESCE(ts.tier,'unverified') AS tier
       FROM builder_bot.v3_rental_offers o
       LEFT JOIN builder_bot.agents a ON a.id = o.tap_agent_id
       LEFT JOIN builder_bot.trust_scores ts ON ts.agent_id = o.tap_agent_id
       WHERE o.active=TRUE ORDER BY o.created_at DESC LIMIT $1`,
    [Math.min(Math.max(1, limit), 200)],
  );
  return r.rows.map((x: any) => ({ ...x, price_day_gram: Number(BigInt(x.price_day_nano)) / 1e9 }));
}

export async function rentAgent(args: { offerId: string; renterUser: number | string; renterWallet: string; days: number }): Promise<any> {
  const o = (await pool().query(`SELECT * FROM builder_bot.v3_rental_offers WHERE id=$1 AND active=TRUE`, [args.offerId])).rows[0];
  if (!o) return { ok: false, error: 'offer not found or inactive' };
  const days = Math.max(o.min_days || 1, Math.floor(args.days || 1));
  const totalNano = BigInt(o.price_day_nano) * BigInt(days);
  const periodSec = days * 86400;
  const now = Math.floor(Date.now() / 1000);
  const { escrowFundLink } = require('./v3-jobs');
  // арендатор(заказчик) → владелец(исполнитель); окно приёмки = срок аренды (по окончании авто-релиз владельцу)
  const link = escrowFundLink(args.renterWallet, o.owner_wallet, totalNano, now + periodSec + 86400, periodSec);
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_rentals (offer_id, tap_agent_id, owner_user, renter_user, renter_wallet, days, total_nano, escrow_addr, status, start_at, end_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10) RETURNING id`,
    [o.id, o.tap_agent_id, o.owner_user, args.renterUser ?? null, args.renterWallet, days, totalNano.toString(), link.escrowAddr, now, now + periodSec],
  );
  return { ok: true, rentalId: String(r.rows[0].id), escrowAddr: link.escrowAddr, deployLink: link.deployLink, totalGram: Number(totalNano) / 1e9, days, endAt: now + periodSec };
}

export async function listRentals(filter: { renterUser?: number | string; ownerUser?: number | string; agentId?: number }, limit = 50): Promise<any[]> {
  const conds: string[] = []; const params: any[] = [];
  if (filter.renterUser != null) { params.push(filter.renterUser); conds.push(`renter_user=$${params.length}`); }
  if (filter.ownerUser != null) { params.push(filter.ownerUser); conds.push(`owner_user=$${params.length}`); }
  if (filter.agentId != null) { params.push(filter.agentId); conds.push(`tap_agent_id=$${params.length}`); }
  params.push(Math.min(Math.max(1, limit), 200));
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await pool().query(
    `SELECT id, tap_agent_id, owner_user, renter_user, days, total_nano, escrow_addr, status, start_at, end_at, created_at
       FROM builder_bot.v3_rentals ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((x: any) => ({ ...x, total_gram: Number(BigInt(x.total_nano)) / 1e9 }));
}
