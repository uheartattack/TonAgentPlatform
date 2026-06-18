/**
 * v3-dns.ts — поддомены агентов (v3.0 Фаза 3, *.tonagent.ton визитка).
 *
 * Владелец застолбляет дружелюбное имя за агентом → публичная hire-page доступна по имени:
 *   tonagentplatform.com/agent.html?name=<имя>. Это off-chain реестр + резолв.
 *
 * NB: собственно on-chain *.tonagent.ton (поддомен в TON DNS) — инфра-шаг владельца
 *   (регистрация домена tonagent.ton + резолвер поддоменов → указывает на /agent.html?name=).
 *   Этот модуль даёт имя/резолв/URL, готовые к привязке к TON DNS.
 */
import { Pool } from 'pg';

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Dns] not initialized'); return _pool; };

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export async function initV3Dns(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_subdomains (
      name         TEXT PRIMARY KEY,
      tap_agent_id INTEGER NOT NULL,
      owner_user   BIGINT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_subdom_agent ON builder_bot.v3_subdomains (tap_agent_id);
  `);
  console.log('[V3Dns] table ready');
}

export function validName(name: string): boolean {
  return typeof name === 'string' && NAME_RE.test(name.toLowerCase());
}

export async function claimSubdomain(ownerUser: number | string, tapAgentId: number, name: string): Promise<any> {
  const n = String(name || '').toLowerCase().trim();
  if (!validName(n)) return { ok: false, error: 'name: 2-32 chars, a-z 0-9 hyphen, no leading/trailing hyphen' };
  // одно имя на агента: освобождаем старое имя этого агента
  await pool().query(`DELETE FROM builder_bot.v3_subdomains WHERE tap_agent_id=$1 AND owner_user=$2`, [tapAgentId, ownerUser]);
  try {
    await pool().query(`INSERT INTO builder_bot.v3_subdomains (name, tap_agent_id, owner_user) VALUES ($1,$2,$3)`, [n, tapAgentId, ownerUser]);
  } catch (e: any) {
    if (e?.code === '23505' || String(e?.message).includes('duplicate')) return { ok: false, error: 'name already taken' };
    throw e;
  }
  return { ok: true, name: n, url: '/agent.html?name=' + encodeURIComponent(n), dns: n + '.tonagent.ton' };
}

export async function resolveSubdomain(name: string): Promise<{ found: boolean; tap_agent_id?: number }> {
  const n = String(name || '').toLowerCase().trim();
  const r = await pool().query(`SELECT tap_agent_id FROM builder_bot.v3_subdomains WHERE name=$1`, [n]);
  return r.rows.length ? { found: true, tap_agent_id: r.rows[0].tap_agent_id } : { found: false };
}

export async function getAgentSubdomain(tapAgentId: number): Promise<string | null> {
  const r = await pool().query(`SELECT name FROM builder_bot.v3_subdomains WHERE tap_agent_id=$1 LIMIT 1`, [tapAgentId]);
  return r.rows.length ? r.rows[0].name : null;
}
