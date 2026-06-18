/**
 * v3-oracles.ts — дата-агенты / оракулы (v3.0 Фаза 2).
 *
 * Агент-оракул публикует ПЛАТНЫЙ сигнал-фид (арбитраж/флор/киты/любой live-сигнал).
 *   Подписчик платит за месяц(ы) через escrow (подписчик→владелец фида) и получает доступ
 *   к свежим сигналам. Доступ к сигналам гейтится активной подпиской (expires_at > now) или
 *   владельцем фида. Бот деньги не двигает — подписчик подписывает escrow-фандинг.
 */
import { Pool } from 'pg';
import { toNano } from '@ton/core';

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Oracle] not initialized'); return _pool; };

export async function initV3Oracle(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_oracle_feeds (
      id               BIGSERIAL PRIMARY KEY,
      tap_agent_id     INTEGER,
      owner_user       BIGINT,
      owner_wallet     TEXT,
      title            TEXT NOT NULL,
      description      TEXT,
      price_month_nano NUMERIC NOT NULL,
      active           BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS builder_bot.v3_oracle_signals (
      id         BIGSERIAL PRIMARY KEY,
      feed_id    BIGINT NOT NULL,
      payload    JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_orcsig_feed ON builder_bot.v3_oracle_signals (feed_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS builder_bot.v3_oracle_subs (
      id                BIGSERIAL PRIMARY KEY,
      feed_id           BIGINT NOT NULL,
      subscriber_user   BIGINT,
      subscriber_wallet TEXT,
      months            INTEGER NOT NULL DEFAULT 1,
      escrow_addr       TEXT,
      expires_at        BIGINT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (feed_id, subscriber_user)
    );
  `);
  console.log('[V3Oracle] tables ready');
}

export async function createFeed(args: { tapAgentId?: number; ownerUser: number | string; ownerWallet?: string; title: string; description?: string; pricePerMonthGram: number }) {
  if (!(args.pricePerMonthGram > 0)) throw new Error('price/month must be > 0');
  const r = await pool().query(
    `INSERT INTO builder_bot.v3_oracle_feeds (tap_agent_id, owner_user, owner_wallet, title, description, price_month_nano)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [args.tapAgentId ?? null, args.ownerUser ?? null, args.ownerWallet ?? null, args.title, args.description ?? null, toNano(String(args.pricePerMonthGram)).toString()],
  );
  return { ok: true, feedId: String(r.rows[0].id) };
}

export async function listFeeds(limit = 50): Promise<any[]> {
  const r = await pool().query(
    `SELECT f.id, f.tap_agent_id, f.title, f.description, f.price_month_nano, f.created_at,
            (SELECT COUNT(*) FROM builder_bot.v3_oracle_subs s WHERE s.feed_id=f.id AND s.expires_at > extract(epoch from now())) AS subs,
            (SELECT MAX(created_at) FROM builder_bot.v3_oracle_signals g WHERE g.feed_id=f.id) AS last_signal
       FROM builder_bot.v3_oracle_feeds f WHERE f.active=TRUE ORDER BY f.created_at DESC LIMIT $1`,
    [Math.min(Math.max(1, limit), 200)],
  );
  return r.rows.map((x: any) => ({ ...x, price_month_gram: Number(BigInt(x.price_month_nano)) / 1e9, subs: Number(x.subs) || 0 }));
}

export async function publishSignal(feedId: string, ownerUser: number | string, payload: any): Promise<any> {
  const f = (await pool().query(`SELECT owner_user FROM builder_bot.v3_oracle_feeds WHERE id=$1`, [feedId])).rows[0];
  if (!f) return { ok: false, error: 'feed not found' };
  if (f.owner_user != null && String(f.owner_user) !== String(ownerUser)) return { ok: false, error: 'only feed owner can publish' };
  const r = await pool().query(`INSERT INTO builder_bot.v3_oracle_signals (feed_id, payload) VALUES ($1,$2) RETURNING id`, [feedId, JSON.stringify(payload ?? {})]);
  return { ok: true, signalId: String(r.rows[0].id) };
}

export async function subscribe(args: { feedId: string; subscriberUser: number | string; subscriberWallet: string; months: number }): Promise<any> {
  const f = (await pool().query(`SELECT * FROM builder_bot.v3_oracle_feeds WHERE id=$1 AND active=TRUE`, [args.feedId])).rows[0];
  if (!f) return { ok: false, error: 'feed not found or inactive' };
  if (!f.owner_wallet) return { ok: false, error: 'feed has no payout wallet' };
  const months = Math.max(1, Math.floor(args.months || 1));
  const totalNano = BigInt(f.price_month_nano) * BigInt(months);
  const now = Math.floor(Date.now() / 1000);
  const expires = now + months * 30 * 86400;
  const { escrowFundLink } = require('./v3-jobs');
  const link = escrowFundLink(args.subscriberWallet, f.owner_wallet, totalNano, expires + 86400, months * 30 * 86400);
  await pool().query(
    `INSERT INTO builder_bot.v3_oracle_subs (feed_id, subscriber_user, subscriber_wallet, months, escrow_addr, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (feed_id, subscriber_user) DO UPDATE SET months=EXCLUDED.months, escrow_addr=EXCLUDED.escrow_addr,
       expires_at=GREATEST(builder_bot.v3_oracle_subs.expires_at, EXCLUDED.expires_at), subscriber_wallet=EXCLUDED.subscriber_wallet`,
    [args.feedId, args.subscriberUser ?? null, args.subscriberWallet, months, link.escrowAddr, expires],
  );
  return { ok: true, escrowAddr: link.escrowAddr, deployLink: link.deployLink, totalGram: Number(totalNano) / 1e9, months, expiresAt: expires };
}

export async function getSignals(feedId: string, requesterUser: number | string, limit = 20): Promise<any> {
  const f = (await pool().query(`SELECT owner_user FROM builder_bot.v3_oracle_feeds WHERE id=$1`, [feedId])).rows[0];
  if (!f) return { ok: false, error: 'feed not found' };
  let active = f.owner_user != null && String(f.owner_user) === String(requesterUser);
  if (!active) {
    const s = (await pool().query(
      `SELECT 1 FROM builder_bot.v3_oracle_subs WHERE feed_id=$1 AND subscriber_user=$2 AND expires_at > $3`,
      [feedId, requesterUser, Math.floor(Date.now() / 1000)],
    )).rows[0];
    active = !!s;
  }
  if (!active) return { ok: true, subscribed: false, signals: [] };
  const r = await pool().query(`SELECT id, payload, created_at FROM builder_bot.v3_oracle_signals WHERE feed_id=$1 ORDER BY created_at DESC LIMIT $2`, [feedId, Math.min(Math.max(1, limit), 100)]);
  return { ok: true, subscribed: true, signals: r.rows };
}
