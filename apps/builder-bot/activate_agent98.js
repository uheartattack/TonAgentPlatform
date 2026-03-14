// Activate agent #98
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'ton_agent', password: 'changeme',
  database: 'ton_agent_platform'
});
pool.query("UPDATE builder_bot.agents SET is_active=true WHERE id=98 RETURNING id, name, is_active")
  .then(r => {
    console.log('Result:', JSON.stringify(r.rows[0]));
    return pool.end();
  }).catch(e => { console.error('DB error:', e.message); process.exit(1); });
