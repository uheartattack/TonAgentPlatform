#!/usr/bin/env node
/**
 * One-time migration: re-encrypts any plaintext mnemonics under the current
 * WALLET_ENCRYPTION_KEY in two locations:
 *   1. builder_bot.agent_state rows with key='wallet_mnemonic' (per-agent state)
 *   2. builder_bot.agents.trigger_config.config.WALLET_MNEMONIC (Studio-configured)
 * Idempotent: anything already starting with `enc:` is skipped.
 *
 * Usage:  node scripts/migrate-plaintext-mnemonics.js [--dry-run]
 */

require("dotenv").config();
const { Pool } = require("pg");
const crypto = require("crypto");

const DRY_RUN = process.argv.includes("--dry-run");

// Mirrored from services/agentic-wallet.ts so this script can run without
// ts-node / TS module resolution. Must match the on-server format byte-for-byte.
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-gcm";
function encryptMnemonic(plaintext) {
  if (!ENCRYPTION_KEY) throw new Error("WALLET_ENCRYPTION_KEY is required");
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `enc:${salt.toString("hex")}:${iv.toString("hex")}:${tag}:${encrypted}`;
}

(async () => {
  if (!ENCRYPTION_KEY) {
    console.error("WALLET_ENCRYPTION_KEY is not set. Aborting.");
    process.exit(1);
  }

  const p = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const res = await p.query(
    "SELECT agent_id, user_id, value FROM builder_bot.agent_state WHERE key = 'wallet_mnemonic'"
  );
  console.log(`Scanning ${res.rows.length} wallet_mnemonic rows...`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of res.rows) {
    const raw = typeof row.value === "string" ? row.value : row.value?.value;
    if (!raw || typeof raw !== "string") { skipped++; continue; }
    if (raw.startsWith("enc:")) { skipped++; continue; }
    // sanity: must look like a mnemonic (>=12 words)
    if (raw.split(/\s+/).length < 12) { skipped++; continue; }

    try {
      const encrypted = encryptMnemonic(raw);
      if (!DRY_RUN) {
        await p.query(
          "UPDATE builder_bot.agent_state SET value = $1, updated_at = NOW() WHERE agent_id = $2 AND key = 'wallet_mnemonic'",
          [JSON.stringify({ value: encrypted }), row.agent_id]
        );
      }
      console.log(`  agent_id=${row.agent_id} ${DRY_RUN ? "[dry-run]" : "migrated"}`);
      migrated++;
    } catch (e) {
      console.error(`  agent_id=${row.agent_id} ERROR: ${e.message}`);
      errors++;
    }
  }

  // ── Part 2: agents.trigger_config.config.WALLET_MNEMONIC ──────────────────
  const tcRes = await p.query(
    "SELECT id, trigger_config FROM builder_bot.agents WHERE trigger_config::text LIKE '%WALLET_MNEMONIC%'"
  );
  console.log(`\nScanning ${tcRes.rows.length} agents.trigger_config rows...`);

  let tcMigrated = 0;
  let tcSkipped = 0;
  let tcErrors = 0;

  for (const row of tcRes.rows) {
    let tc;
    try {
      tc = typeof row.trigger_config === "string" ? JSON.parse(row.trigger_config) : (row.trigger_config || {});
    } catch (e) {
      console.error(`  agent #${row.id} JSON parse error: ${e.message}`);
      tcErrors++;
      continue;
    }
    const mn = tc?.config?.WALLET_MNEMONIC;
    if (!mn || typeof mn !== "string") { tcSkipped++; continue; }
    if (mn.startsWith("enc:") || mn.startsWith("enc_fallback:")) { tcSkipped++; continue; }
    if (mn.split(/\s+/).length < 12) { tcSkipped++; continue; }

    try {
      tc.config.WALLET_MNEMONIC = encryptMnemonic(mn);
      if (!DRY_RUN) {
        await p.query(
          "UPDATE builder_bot.agents SET trigger_config = $1, updated_at = NOW() WHERE id = $2",
          [JSON.stringify(tc), row.id]
        );
      }
      console.log(`  agent #${row.id} ${DRY_RUN ? "[dry-run]" : "migrated"} (trigger_config)`);
      tcMigrated++;
    } catch (e) {
      console.error(`  agent #${row.id} ERROR: ${e.message}`);
      tcErrors++;
    }
  }

  // ── Part 3: user_settings.root_wallet_mnemonic (per-user agentic root) ─────
  const rwRes = await p.query(
    "SELECT user_id, value FROM builder_bot.user_settings WHERE key='root_wallet_mnemonic'"
  );
  let rwMig = 0, rwSkip = 0, rwErr = 0;
  for (const row of rwRes.rows) {
    let val = row.value;
    // JSONB column — pg returns the parsed JS value. A bare string mnemonic comes
    // back as a String; a JSON-quoted one looks the same. Normalize:
    if (typeof val !== "string") {
      try { val = String(val); } catch { rwSkip++; continue; }
    }
    if (!val) { rwSkip++; continue; }
    if (val.startsWith("enc:") || val.startsWith("\"enc:")) { rwSkip++; continue; }
    // strip JSON quoting if present (e.g. value stored as "wine diamond..." with quotes)
    let plain = val;
    if (plain.startsWith("\"") && plain.endsWith("\"")) plain = plain.slice(1, -1);
    if (plain.split(/\s+/).filter(Boolean).length < 12) { rwSkip++; continue; }
    try {
      const encrypted = encryptMnemonic(plain);
      if (!DRY_RUN) {
        await p.query(
          "UPDATE builder_bot.user_settings SET value = $1::jsonb, updated_at = NOW() WHERE user_id = $2 AND key = 'root_wallet_mnemonic'",
          [JSON.stringify(encrypted), row.user_id]
        );
      }
      console.log(`  user ${row.user_id} ${DRY_RUN ? "[dry-run]" : "migrated"} (root_wallet_mnemonic)`);
      rwMig++;
    } catch (e) {
      console.error(`  user ${row.user_id} ERROR:`, e.message);
      rwErr++;
    }
  }

  console.log(`\nAgent_state:           migrated=${migrated} skipped=${skipped} errors=${errors}`);
  console.log(`Trigger_config:        migrated=${tcMigrated} skipped=${tcSkipped} errors=${tcErrors}`);
  console.log(`Root_wallet_mnemonic:  migrated=${rwMig} skipped=${rwSkip} errors=${rwErr}`);
  console.log(DRY_RUN ? "(dry-run — no rows actually changed)" : "Migration committed.");
  await p.end();
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
