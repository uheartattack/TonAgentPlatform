require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.BETA_GROUP_ID;

const TAGS = {
  1: "\u{1F9EA} Tester",
  2: "\u26A1 Active",
  3: "\u{1F525} Pro",
  4: "\u{1F48E} Expert",
  5: "\u{1F451} Master",
  6: "\u{1F3C6} Legend",
};

(async () => {
  const testers = await p.query(
    "SELECT user_id, xp, level FROM builder_bot.beta_testers WHERE status = 'active'"
  );
  console.log("Testers:", testers.rows.length);

  for (const t of testers.rows) {
    const level = t.level || 1;
    const tag = TAGS[level] || TAGS[1];
    try {
      // Bot API 9.5: setChatMemberTag (no admin promotion needed)
      const res = await fetch(
        "https://api.telegram.org/bot" + BOT_TOKEN + "/setChatMemberTag",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: parseInt(GROUP_ID),
            user_id: Number(t.user_id),
            tag: tag,
          }),
        }
      ).then((r) => r.json());

      if (res.ok) {
        console.log(t.user_id, "\u2192", tag, "OK");
      } else {
        console.log(t.user_id, "\u2192", tag, res.description || "FAILED");
      }
    } catch (e) {
      console.log(t.user_id, "error:", e.message);
    }
  }
  p.end();
})();
