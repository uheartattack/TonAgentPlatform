#!/usr/bin/env node
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const PROBLEM_AGENTS = [243, 246, 252];

(async () => {
  for (const id of PROBLEM_AGENTS) {
    console.log(`\n════ Agent #${id} ════`);
    const a = await p.query(
      `SELECT id, name, code, trigger_type, trigger_config, user_id, updated_at
       FROM builder_bot.agents WHERE id = $1`,
      [id]
    );
    if (!a.rows[0]) { console.log('  (not found)'); continue; }
    const row = a.rows[0];
    console.log(`  name=${row.name}`);
    console.log(`  user=${row.user_id}`);
    console.log(`  trigger=${row.trigger_type}`);
    console.log(`  updated=${row.updated_at}`);

    const tc = typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : (row.trigger_config || {});
    const cfg = tc.config || {};
    console.log(`  AI_PROVIDER=${cfg.AI_PROVIDER || '(default)'}`);
    console.log(`  AI_MODEL=${cfg.AI_MODEL || '(default)'}`);
    console.log(`  intervalMs=${cfg.intervalMs || tc.intervalMs || '(event-driven)'}`);
    console.log(`  code length=${(row.code || '').length} chars`);
    console.log(`  code preview: ${(row.code || '').slice(0, 200)}...`);

    // Last 20 errors with full message
    const errs = await p.query(`
      SELECT level, message, created_at
      FROM builder_bot.agent_logs
      WHERE agent_id = $1 AND level IN ('error', 'warn')
      ORDER BY created_at DESC LIMIT 20
    `, [id]);
    console.log(`\n  Recent errors (${errs.rows.length}):`);
    for (const e of errs.rows) {
      console.log(`    [${e.level}] ${e.created_at.toISOString().slice(0, 19)} ${(e.message || '').slice(0, 200)}`);
    }

    // Conversation history stats
    const hist = await p.query(`
      SELECT pg_column_size(value) AS bytes, value
      FROM builder_bot.agent_state
      WHERE agent_id = $1 AND key = '_conversation_history'
    `, [id]);
    if (hist.rows[0]) {
      const kb = Math.round(hist.rows[0].bytes / 1024);
      console.log(`\n  conversation_history: ${kb}KB`);
      try {
        const v = typeof hist.rows[0].value === 'string' ? hist.rows[0].value : hist.rows[0].value.value;
        const parsed = typeof v === 'string' ? JSON.parse(v) : v;
        if (Array.isArray(parsed)) {
          console.log(`  messages count: ${parsed.length}`);
          const lastMsg = parsed[parsed.length - 1];
          if (lastMsg) console.log(`  last role=${lastMsg.role}, content len=${(lastMsg.content || '').length}`);
        }
      } catch {}
    }
  }

  p.end();
})().catch((e) => { console.error("FATAL:", e.message); p.end(); });
