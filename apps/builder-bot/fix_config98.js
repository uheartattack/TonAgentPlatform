const { Pool } = require('pg');
const p = new Pool({ host:'localhost', port:5432, user:'ton_agent', password:'changeme', database:'ton_agent_platform' });
const addr = 'EQC6zjid8vJNEWqcXk10XjsdDLRKbcPZzbHusuEW6FokOWIm';

// Use $1 directly as a text param — PostgreSQL will cast it to jsonb string via to_jsonb()
p.query(
  `UPDATE builder_bot.agents
   SET trigger_config = jsonb_set(trigger_config, '{config,TARGET_COLLECTIONS}', to_jsonb($1::varchar))
   WHERE id = 98
   RETURNING (trigger_config->'config'->>'TARGET_COLLECTIONS') as col_val`,
  [addr]
).then(r => {
  console.log('✅ TARGET_COLLECTIONS =', r.rows[0].col_val);
  return p.end();
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
