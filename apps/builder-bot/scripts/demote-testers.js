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

(async () => {
  const testers = await p.query(
    "SELECT user_id FROM builder_bot.beta_testers WHERE status = 'active'"
  );
  console.log("Demoting", testers.rows.length, "testers from admin...");

  for (const t of testers.rows) {
    try {
      // Demote: set all rights to false = regular member
      const res = await fetch(
        "https://api.telegram.org/bot" + BOT_TOKEN + "/promoteChatMember",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: parseInt(GROUP_ID),
            user_id: Number(t.user_id),
            can_manage_chat: false,
            can_change_info: false,
            can_delete_messages: false,
            can_invite_users: false,
            can_restrict_members: false,
            can_pin_messages: false,
            can_promote_members: false,
            can_manage_video_chats: false,
          }),
        }
      ).then((r) => r.json());
      console.log(t.user_id, res.ok ? "demoted" : res.description);
    } catch (e) {
      console.log(t.user_id, "error:", e.message);
    }
  }
  p.end();
})();
