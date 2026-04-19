#!/usr/bin/env node
/**
 * Targeted fixes for 3 agents hitting rate-limits:
 *  #243 — Groq 413 TPM: lower MAX_TOOLS + auto-switch to llama-3.1-8b-instant
 *  #246 — Gemini 429: raise intervalMs 60s → 180s
 *  #252 — CoinGecko fetch fails: not an AI issue but we'll add retry note
 *
 * Does NOT change provider without user consent — only tunes *their* chosen
 * provider's safe parameters.
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

async function updateAgentConfig(id, mutator, reason) {
  const r = await p.query("SELECT trigger_config FROM builder_bot.agents WHERE id = $1", [id]);
  if (!r.rows[0]) { console.log(`#${id}: not found`); return; }
  const tc = typeof r.rows[0].trigger_config === "string" ? JSON.parse(r.rows[0].trigger_config) : (r.rows[0].trigger_config || {});
  if (!tc.config) tc.config = {};
  const before = JSON.stringify(tc.config);
  mutator(tc);
  const after = JSON.stringify(tc.config);
  if (before === after) {
    console.log(`#${id}: no change needed`);
    return;
  }
  await p.query("UPDATE builder_bot.agents SET trigger_config = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(tc), id]);
  await p.query(
    "INSERT INTO builder_bot.agent_logs (agent_id, user_id, level, message) SELECT id, user_id, 'info', $2 FROM builder_bot.agents WHERE id = $1",
    [id, `[PlatformOps] Auto-tuned config: ${reason}`]
  );
  console.log(`✅ #${id}: ${reason}`);
}

(async () => {
  // #243 — Groq TPM: cap tools aggressively, keep model as user set it
  await updateAgentConfig(243, (tc) => {
    // Tell runtime to use ≤12 tools (safe under 12K TPM Groq free)
    tc.config.MAX_TOOLS = 12;
    // Also use smaller Groq model as conservative default if user didn't pin one
    if (!tc.config.AI_MODEL) {
      tc.config.AI_MODEL = "llama-3.1-8b-instant"; // lower overhead than 70b
    }
  }, "Groq free TPM protection: MAX_TOOLS=12, default model llama-3.1-8b-instant");

  // #246 — Gemini RPM: increase interval from 60s to 180s
  await updateAgentConfig(246, (tc) => {
    const cur = Number(tc.config.intervalMs || tc.intervalMs || 60000);
    if (cur < 180_000) {
      tc.config.intervalMs = 180_000;
    }
  }, "Gemini 2.5-flash free RPM=10 protection: intervalMs 60s → 180s");

  // #252 — scheduled CoinGecko fetch (NOT AI, not our runtime)
  // Just drop a hint in logs, code-level fix would require editing the agent's code
  await p.query(
    "INSERT INTO builder_bot.agent_logs (agent_id, user_id, level, message) SELECT id, user_id, 'warn', $2 FROM builder_bot.agents WHERE id = 252",
    [252, "[PlatformOps] fetch failed — CoinGecko may rate-limit or block. Consider switching to TonAPI or adding retry+fallback in agent code."]
  );
  console.log("⚠️  #252: logged hint (user must update their agent code)");

  p.end();
})().catch((e) => { console.error("FATAL:", e.message); p.end(); });
