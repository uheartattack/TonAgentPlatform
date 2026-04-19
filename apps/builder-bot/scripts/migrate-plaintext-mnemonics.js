#!/usr/bin/env node
/**
 * One-time migration: re-encrypts any plaintext `wallet_mnemonic` rows in
 * builder_bot.agent_state under the current WALLET_ENCRYPTION_KEY.
 * Idempotent: rows that already start with `enc:` are skipped.
 *
 * Usage:  node scripts/migrate-plaintext-mnemonics.js [--dry-run]
 */

require("dotenv").config();
const { Pool } = require("pg");

const DRY_RUN = process.argv.includes("--dry-run");

(async () => {
  if (!process.env.WALLET_ENCRYPTION_KEY) {
    console.error("WALLET_ENCRYPTION_KEY is not set. Aborting.");
    process.exit(1);
  }

  // Dynamic import so we reuse the project's encryptMnemonic()
  const { encryptMnemonic } = require("../src/services/agentic-wallet");

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

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} errors=${errors}${DRY_RUN ? " (dry-run)" : ""}`);
  await p.end();
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
