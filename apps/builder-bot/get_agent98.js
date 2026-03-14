const {Pool} = require('pg');
const p = new Pool({host:'localhost',port:5432,user:'ton_agent',password:'changeme',database:'ton_agent_platform'});
p.query("SELECT code FROM builder_bot.agents WHERE id=98").then(r=>{
  const fs = require('fs');
  fs.writeFileSync('/tmp/agent98.js', r.rows[0].code);
  console.log('Written', r.rows[0].code.length, 'chars');
  p.end();
}).catch(e=>{console.error(e.message);process.exit(1);});
