const {Pool} = require('pg');
const p = new Pool({host:'localhost',port:5432,user:'ton_agent',password:'changeme',database:'ton_agent_platform'});
Promise.all([
  p.query("SELECT id, name, is_active FROM builder_bot.agents WHERE id IN (98,99) ORDER BY id"),
  p.query("SELECT agent_id, level, message, created_at FROM builder_bot.agent_logs WHERE agent_id=99 ORDER BY created_at DESC LIMIT 10"),
]).then(([agents, logs]) => {
  console.log('=== AGENTS ===');
  agents.rows.forEach(r => console.log('#'+r.id, r.name, 'active:'+r.is_active));
  console.log('=== LOGS #99 ===');
  if (logs.rows.length === 0) console.log('(нет логов — ещё не запускался)');
  logs.rows.forEach(r => console.log(r.created_at.toISOString().slice(11,19), '['+r.level+']', r.message.slice(0,120)));
  return p.end();
});
