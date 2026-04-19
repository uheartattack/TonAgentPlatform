#!/usr/bin/env node
/**
 * Diagnose all active agents: fetch their recent errors, circuit breaker status,
 * last activity, and any warning patterns from agent_logs.
 */
require("dotenv").config();
const { Pool } = require("pg");

const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function fmtAgo(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

(async () => {
  // 1. List active agents
  const agents = await p.query(`
    SELECT id, name, user_id, trigger_type,
           COALESCE((trigger_config->'config'->>'intervalMs')::int, 0) AS interval_ms,
           updated_at,
           EXTRACT(epoch FROM (NOW() - updated_at))::int AS seconds_since_update
    FROM builder_bot.agents
    WHERE is_active = true
    ORDER BY id
  `);

  console.log(`\n═══ ACTIVE AGENTS: ${agents.rows.length} ═══\n`);
  for (const a of agents.rows) {
    console.log(`#${a.id} "${a.name}" user=${a.user_id} type=${a.trigger_type} interval=${Math.round(a.interval_ms / 1000)}s updated=${fmtAgo(a.seconds_since_update)} ago`);
  }

  console.log(`\n═══ RECENT ERRORS (last 24h) per agent ═══\n`);
  for (const a of agents.rows) {
    const errs = await p.query(`
      SELECT level, message, created_at
      FROM builder_bot.agent_logs
      WHERE agent_id = $1
        AND level IN ('error', 'warn')
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `, [a.id]);

    if (errs.rows.length === 0) {
      console.log(`✅ #${a.id} "${a.name}" — no errors/warnings in 24h`);
      continue;
    }

    // Group by first 60 chars of message
    const groups = {};
    for (const e of errs.rows) {
      const key = `[${e.level}] ${(e.message || '').slice(0, 80)}`;
      if (!groups[key]) groups[key] = { count: 0, latest: e.created_at };
      groups[key].count++;
    }

    console.log(`\n⚠️  #${a.id} "${a.name}" — ${errs.rows.length} errors/warns:`);
    for (const [key, g] of Object.entries(groups)) {
      console.log(`  ${g.count}x ${key}`);
    }
  }

  // 2. Check daily spend status
  console.log(`\n═══ DAILY SPEND STATUS ═══\n`);
  for (const a of agents.rows) {
    const spend = await p.query(`
      SELECT spent_nano, spend_date
      FROM builder_bot.agent_daily_spend
      WHERE agent_id = $1 AND spend_date::date = CURRENT_DATE
    `, [a.id]);
    if (spend.rows[0]) {
      const ton = Number(spend.rows[0].spent_nano) / 1e9;
      console.log(`#${a.id} spent today: ${ton.toFixed(3)} TON`);
    }
  }

  // 3. Conversation history size per agent (as a warning sign)
  console.log(`\n═══ CONVERSATION HISTORY SIZE ═══\n`);
  for (const a of agents.rows) {
    const hist = await p.query(`
      SELECT pg_column_size(value) AS bytes
      FROM builder_bot.agent_state
      WHERE agent_id = $1 AND key = '_conversation_history'
    `, [a.id]);
    if (hist.rows[0]) {
      const kb = Math.round(hist.rows[0].bytes / 1024);
      const marker = kb > 200 ? '⚠️ LARGE' : kb > 50 ? '📏' : '✅';
      console.log(`${marker} #${a.id} conversation_history: ${kb}KB`);
    }
  }

  // 4. Last tick / last reply per agent (from logs)
  console.log(`\n═══ LAST ACTIVITY (from logs) ═══\n`);
  for (const a of agents.rows) {
    const last = await p.query(`
      SELECT message, created_at,
             EXTRACT(epoch FROM (NOW() - created_at))::int AS ago
      FROM builder_bot.agent_logs
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [a.id]);
    if (last.rows[0]) {
      console.log(`#${a.id} last log ${fmtAgo(last.rows[0].ago)} ago: ${(last.rows[0].message || '').slice(0, 100)}`);
    } else {
      console.log(`#${a.id} no logs`);
    }
  }

  p.end();
})().catch((e) => {
  console.error("FATAL:", e.message);
  p.end();
});
