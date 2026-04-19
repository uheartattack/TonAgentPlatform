require("dotenv").config();
const { Pool } = require("pg");
const { mnemonicToWalletKey } = require("@ton/crypto");
const { WalletContractV4 } = require("@ton/ton");

const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

(async () => {
  // Get mnemonic from state
  const r = await p.query(
    "SELECT value FROM builder_bot.agent_state WHERE agent_id=201 AND key='wallet_mnemonic'"
  );
  const raw = r.rows[0].value;
  const mnemonic = typeof raw === "string" ? raw : raw.value || raw;
  console.log("Mnemonic (first 3 words):", mnemonic.split(" ").slice(0, 3).join(" "));

  const kp = await mnemonicToWalletKey(mnemonic.split(" "));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey });
  const correctAddr = wallet.address.toString({ urlSafe: true, bounceable: false });
  console.log("Correct V4R2 address:", correctAddr);

  // Update agent_state.wallet_address
  await p.query(
    "UPDATE builder_bot.agent_state SET value=$1 WHERE agent_id=201 AND key='wallet_address'",
    [JSON.stringify({ value: correctAddr })]
  );

  // Update trigger_config: fix WALLET_ADDRESS, remove WALLET_TYPE=agentic
  const tc = await p.query("SELECT trigger_config FROM builder_bot.agents WHERE id=201");
  const cfg = tc.rows[0].trigger_config || {};
  if (!cfg.config) cfg.config = {};
  cfg.config.WALLET_ADDRESS = correctAddr;
  delete cfg.config.WALLET_TYPE;
  await p.query("UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=201", [
    JSON.stringify(cfg),
  ]);

  // Verify
  const chk = await p.query(
    "SELECT value FROM builder_bot.agent_state WHERE agent_id=201 AND key='wallet_address'"
  );
  console.log("DB now stores:", JSON.stringify(chk.rows[0].value));

  // Force reload cache
  await p.query("UPDATE builder_bot.agents SET is_active=false WHERE id=201");
  await new Promise((r) => setTimeout(r, 1200));
  await p.query("UPDATE builder_bot.agents SET is_active=true WHERE id=201");
  console.log("Reactivated");

  p.end();
})().catch((e) => {
  console.error(e.message);
  p.end();
});
