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
  // Wipe cached conversation history and chat state so agent re-learns wallet from state
  const keysToWipe = [
    "_conversation_history",
    "_chats",
    "_token_usage",
  ];
  for (const k of keysToWipe) {
    const r = await p.query(
      "DELETE FROM builder_bot.agent_state WHERE agent_id=201 AND key=$1",
      [k]
    );
    console.log(`deleted key=${k}: ${r.rowCount} rows`);
  }
  // Also wipe per-chat memory
  const r2 = await p.query(
    "DELETE FROM builder_bot.agent_state WHERE agent_id=201 AND key LIKE '_chat:%'"
  );
  console.log(`deleted _chat:* keys: ${r2.rowCount} rows`);

  // Inject a system note into agent state with NEW wallet address as a reminder
  const walletNote = "ВНИМАНИЕ: Твой кошелёк сменился. Новый адрес: UQBd65-SW3ctDozYUTmcKh5IfnpDPhRsWYX3LqjfjaWTI9Qr. На нём 5 TON. Старый UQDYC5... больше не используется — забудь его.";
  await p.query(
    `INSERT INTO builder_bot.agent_state (agent_id, user_id, key, value, updated_at)
     VALUES (201, 130806013, 'wallet_reset_note', $1, NOW())
     ON CONFLICT (agent_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify({ value: walletNote })]
  );
  console.log("injected wallet_reset_note");

  // Force cache reload
  await p.query("UPDATE builder_bot.agents SET is_active=false WHERE id=201");
  await new Promise((r) => setTimeout(r, 1500));
  await p.query("UPDATE builder_bot.agents SET is_active=true WHERE id=201");
  console.log("Agent reactivated — fresh context");

  p.end();
})().catch((e) => {
  console.error(e.message);
  p.end();
});
