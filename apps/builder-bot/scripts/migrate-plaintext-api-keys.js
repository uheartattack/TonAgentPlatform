#!/usr/bin/env node
/**
 * One-time migration: encrypts plaintext AI_API_KEY / OPENAI_API_KEY / etc.
 * stored in:
 *   1. builder_bot.user_settings rows with key='user_variables' (global per-user keys)
 *   2. builder_bot.agents.trigger_config.config.AI_API_KEY  (Studio per-agent override)
 *
 * Uses the same AES-256-GCM scheme + ENCRYPTION_KEY as crypto-utils.ts. Idempotent:
 * values already starting with `enc:` are skipped.
 *
 * Usage:  node scripts/migrate-plaintext-api-keys.js [--dry-run]
 */

require("dotenv").config();
const { Pool } = require("pg");
const crypto = require("crypto");

const DRY_RUN = process.argv.includes("--dry-run");

// Mirrored from crypto-utils.ts so this script can run without ts-node.
const _ALGO = "aes-256-gcm";
const _KEY = (() => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) return Buffer.from(envKey.slice(0, 32), "utf8");
  if (envKey) return crypto.createHash("sha256").update(envKey).digest();
  const botToken = process.env.BOT_TOKEN;
  if (botToken) return crypto.createHash("sha256").update(botToken).digest();
  throw new Error("ENCRYPTION_KEY or BOT_TOKEN required");
})();

function encryptApiKey(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(_ALGO, _KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

const SECRET_VAR_KEYS = ["AI_API_KEY", "TONAPI_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"];

(async () => {
  const p = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // ── Part 1: user_settings.user_variables.AI_API_KEY (and friends) ──────────
  const usRes = await p.query(
    "SELECT user_id, value FROM builder_bot.user_settings WHERE key='user_variables'"
  );
  let usMig = 0, usSkip = 0, usErr = 0;
  for (const row of usRes.rows) {
    const uv = typeof row.value === "string" ? JSON.parse(row.value) : (row.value || {});
    if (!uv || typeof uv !== "object") { usSkip++; continue; }
    let changed = false;
    for (const k of SECRET_VAR_KEYS) {
      const v = uv[k];
      if (typeof v !== "string" || v.length === 0) continue;
      if (v.startsWith("enc:")) continue;
      try { uv[k] = encryptApiKey(v); changed = true; }
      catch (e) { console.error(`  user ${row.user_id} ${k} ERROR:`, e.message); usErr++; }
    }
    if (!changed) { usSkip++; continue; }
    if (!DRY_RUN) {
      await p.query(
        "UPDATE builder_bot.user_settings SET value = $1::jsonb, updated_at = NOW() WHERE user_id = $2 AND key = 'user_variables'",
        [JSON.stringify(uv), row.user_id]
      );
    }
    console.log(`  user ${row.user_id} ${DRY_RUN ? "[dry-run]" : "migrated"}`);
    usMig++;
  }

  // ── Part 2: agents.trigger_config.config.AI_API_KEY ────────────────────────
  const tcRes = await p.query(
    "SELECT id, trigger_config FROM builder_bot.agents WHERE trigger_config::text LIKE '%AI_API_KEY%'"
  );
  let tcMig = 0, tcSkip = 0, tcErr = 0;
  for (const row of tcRes.rows) {
    let tc;
    try { tc = typeof row.trigger_config === "string" ? JSON.parse(row.trigger_config) : (row.trigger_config || {}); }
    catch (e) { console.error(`  agent #${row.id} JSON parse error: ${e.message}`); tcErr++; continue; }
    const cfg = tc?.config;
    if (!cfg) { tcSkip++; continue; }
    let changed = false;
    for (const k of SECRET_VAR_KEYS) {
      const v = cfg[k];
      if (typeof v !== "string" || v.length === 0) continue;
      if (v.startsWith("enc:")) continue;
      try { cfg[k] = encryptApiKey(v); changed = true; }
      catch (e) { console.error(`  agent #${row.id} ${k} ERROR:`, e.message); tcErr++; }
    }
    if (!changed) { tcSkip++; continue; }
    if (!DRY_RUN) {
      await p.query(
        "UPDATE builder_bot.agents SET trigger_config = $1, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(tc), row.id]
      );
    }
    console.log(`  agent #${row.id} ${DRY_RUN ? "[dry-run]" : "migrated"} (trigger_config)`);
    tcMig++;
  }

  console.log(`\nuser_settings:  migrated=${usMig} skipped=${usSkip} errors=${usErr}`);
  console.log(`trigger_config: migrated=${tcMig} skipped=${tcSkip} errors=${tcErr}`);
  console.log(DRY_RUN ? "(dry-run)" : "Migration committed.");
  await p.end();
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
