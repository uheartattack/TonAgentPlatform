require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

(async () => {
  const r = await p.query("SELECT code, trigger_config FROM builder_bot.agents WHERE id = 252");
  if (!r.rows[0]) { console.log("not found"); p.end(); return; }
  console.log("=== CODE ===");
  console.log(r.rows[0].code);
  console.log("\n=== TRIGGER_CONFIG ===");
  console.log(JSON.stringify(r.rows[0].trigger_config, null, 2));
  p.end();
})().catch((e) => { console.error(e.message); p.end(); });
