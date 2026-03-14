const {Pool} = require('pg');
const p = new Pool({host:'localhost',port:5432,user:'ton_agent',password:'changeme',database:'ton_agent_platform'});
p.query("SELECT id, name, is_active, trigger_config FROM builder_bot.agents WHERE id IN (98,99) ORDER BY id").then(r=>{
  r.rows.forEach(row => {
    const cfg = row.trigger_config;
    console.log("#"+row.id, row.name, "active:"+row.is_active, "| TARGET_COLLECTIONS:", cfg && cfg.config && cfg.config.TARGET_COLLECTIONS || "(not set)");
  });
  return p.end();
});
