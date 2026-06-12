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
  console.log("=== HEALTH CHECK ===\n");

  // 1. Tables
  const tables = [
    "beta_testers", "feedback", "beta_invite_codes",
    "beta_quest_progress", "beta_task_progress", "beta_achievements",
    "beta_bug_verifications", "beta_squads", "beta_internship_applications",
    "beta_test_scenarios", "beta_events"
  ];
  console.log("TABLES:");
  for (const t of tables) {
    try {
      const r = await p.query("SELECT COUNT(*) as cnt FROM builder_bot." + t);
      console.log("  " + t + ": " + r.rows[0].cnt + " rows");
    } catch (e) {
      console.log("  " + t + ": MISSING - " + e.message.slice(0, 60));
    }
  }

  // 2. Columns on beta_testers
  console.log("\nBETA_TESTERS COLUMNS:");
  const cols = await p.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='builder_bot' AND table_name='beta_testers' ORDER BY ordinal_position"
  );
  console.log("  " + cols.rows.map(r => r.column_name).join(", "));

  // 3. Active testers
  const testers = await p.query("SELECT user_id, username, xp, level, status, streak_days FROM builder_bot.beta_testers WHERE status='active' ORDER BY xp DESC");
  console.log("\nACTIVE TESTERS (" + testers.rows.length + "):");
  testers.rows.forEach(t => {
    console.log("  @" + (t.username || t.user_id) + " - XP:" + t.xp + " Lv:" + t.level + " Streak:" + t.streak_days);
  });

  // 4. Feedback stats
  const fb = await p.query("SELECT type, COUNT(*) as cnt FROM builder_bot.feedback GROUP BY type");
  console.log("\nFEEDBACK:");
  fb.rows.forEach(r => console.log("  " + r.type + ": " + r.cnt));

  // 5. Internship applications
  const intern = await p.query("SELECT user_id, username, xp_at_apply, status FROM builder_bot.beta_internship_applications");
  console.log("\nINTERNSHIP APPLICATIONS (" + intern.rows.length + "):");
  intern.rows.forEach(r => console.log("  @" + (r.username || r.user_id) + " XP:" + r.xp_at_apply + " Status:" + r.status));

  // 6. Tags check
  console.log("\nTAGS:");
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const GROUP_ID = process.env.BETA_GROUP_ID;
  for (const t of testers.rows.slice(0, 3)) {
    try {
      const res = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/getChatMember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: parseInt(GROUP_ID), user_id: Number(t.user_id) })
      }).then(r => r.json());
      const status = res.result?.status || "?";
      const tag = res.result?.custom_title || res.result?.tag || "none";
      console.log("  @" + (t.username || t.user_id) + ": status=" + status + " tag=" + tag);
    } catch (e) {
      console.log("  @" + (t.username || t.user_id) + ": error");
    }
  }

  // 7. Scheduled tasks check
  console.log("\nENV:");
  console.log("  BETA_GROUP_ID:", process.env.BETA_GROUP_ID || "NOT SET");
  console.log("  BETA_ANNOUNCEMENTS_TOPIC:", process.env.BETA_ANNOUNCEMENTS_TOPIC || "NOT SET");
  console.log("  GIFTASSET_API_KEY:", process.env.GIFTASSET_API_KEY ? process.env.GIFTASSET_API_KEY.slice(0, 8) + "..." : "NOT SET");

  console.log("\n=== DONE ===");
  p.end();
})().catch(e => { console.error("FATAL:", e.message); p.end(); });
