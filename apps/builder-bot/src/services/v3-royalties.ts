/**
 * v3-royalties.ts — роялти за скиллы (v3.0 Фаза 2).
 *
 * Автор пользовательского скилла получает микро-роялти каждый раз, когда скилл
 *   ЗАГРУЖАЕТСЯ для использования чужим агентом (см. hook в skill-registry.loadSkillFull).
 *   Само-использование автором не начисляется. Дедуп: не чаще 1×/60с на (skill,author,agent).
 *
 * ⚠️ Хук вызывается строго fire-and-forget (без await, всё в try/catch) — НЕ влияет на
 *    исполнение агента. Выплата авторам — учётный ledger; реальные деньги = будущий слой.
 */
import { Pool } from 'pg';
import { toNano } from '@ton/core';

const PER_USE_NANO = (() => { try { return toNano(String(process.env.V3_SKILL_ROYALTY_GRAM || '0.001')); } catch { return toNano('0.001'); } })();

let _pool: Pool | null = null;
const pool = () => { if (!_pool) throw new Error('[V3Royalties] not initialized'); return _pool; };

export async function initV3Royalties(pgPool: Pool): Promise<void> {
  _pool = pgPool;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.v3_skill_royalties (
      id           BIGSERIAL PRIMARY KEY,
      skill_name   TEXT NOT NULL,
      author_user  BIGINT NOT NULL,
      agent_id     INTEGER,
      amount_nano  NUMERIC NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_v3_roy_author ON builder_bot.v3_skill_royalties (author_user, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_v3_roy_skill ON builder_bot.v3_skill_royalties (skill_name);
  `);
  console.log('[V3Royalties] table ready (per_use=' + (Number(PER_USE_NANO) / 1e9) + ' GRAM)');
}

/** Учесть использование скилла. Вызывается fire-and-forget из loadSkillFull. */
export async function recordSkillUse(skillName: string, authorUser: number | string, agentId?: number): Promise<void> {
  if (!_pool || !authorUser || !skillName) return;
  // само-использование автором — не начисляем
  if (agentId) {
    try {
      const o = await pool().query(`SELECT 1 FROM builder_bot.agents WHERE id=$1 AND user_id=$2`, [agentId, authorUser]);
      if (o.rows.length) return;
    } catch { /* */ }
  }
  // дедуп: не чаще 1×/60с на (skill, author, agent)
  try {
    const recent = await pool().query(
      `SELECT 1 FROM builder_bot.v3_skill_royalties
        WHERE skill_name=$1 AND author_user=$2 AND COALESCE(agent_id,0)=$3 AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
      [skillName, authorUser, agentId || 0],
    );
    if (recent.rows.length) return;
  } catch { /* */ }
  await pool().query(
    `INSERT INTO builder_bot.v3_skill_royalties (skill_name, author_user, agent_id, amount_nano) VALUES ($1,$2,$3,$4)`,
    [skillName, authorUser, agentId ?? null, PER_USE_NANO.toString()],
  );
}

export async function skillEarnings(authorUser: number | string): Promise<{ total_gram: number; per_use_gram: number; skills: any[] }> {
  const tot = await pool().query(`SELECT COALESCE(SUM(amount_nano),0)::numeric AS t FROM builder_bot.v3_skill_royalties WHERE author_user=$1`, [authorUser]);
  const per = await pool().query(
    `SELECT skill_name, COUNT(*)::int AS uses, COALESCE(SUM(amount_nano),0)::numeric AS earned
       FROM builder_bot.v3_skill_royalties WHERE author_user=$1 GROUP BY skill_name ORDER BY earned DESC`,
    [authorUser],
  );
  return {
    total_gram: Number(BigInt(tot.rows[0].t || '0')) / 1e9,
    per_use_gram: Number(PER_USE_NANO) / 1e9,
    skills: per.rows.map((x: any) => ({ skill: x.skill_name, uses: x.uses, earned_gram: Number(BigInt(x.earned)) / 1e9 })),
  };
}

export async function skillStats(skillName: string): Promise<{ uses: number; unique_agents: number; earned_gram: number }> {
  const r = await pool().query(
    `SELECT COUNT(*)::int AS uses, COUNT(DISTINCT agent_id)::int AS ua, COALESCE(SUM(amount_nano),0)::numeric AS e
       FROM builder_bot.v3_skill_royalties WHERE skill_name=$1`,
    [skillName],
  );
  return { uses: r.rows[0].uses || 0, unique_agents: r.rows[0].ua || 0, earned_gram: Number(BigInt(r.rows[0].e || '0')) / 1e9 };
}
