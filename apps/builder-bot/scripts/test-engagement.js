require("dotenv").config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = process.env.OWNER_ID;

async function sendAndCheck(command) {
  // Simulate command by calling bot internally
  // Instead, we'll test the engagement.ts functions directly
}

// Test all engagement.ts exports
async function testAll() {
  console.log("=== TESTING ENGAGEMENT SYSTEM ===\n");

  let eng;
  try {
    require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "commonjs" } });
    eng = require("../src/engagement");
    console.log("✅ engagement.ts loaded, exports:", Object.keys(eng).length);
  } catch (e) {
    console.log("❌ engagement.ts FAILED:", e.message.slice(0, 200));
    return;
  }

  const testUserId = parseInt(OWNER_ID);

  // 1. Quest
  console.log("\n--- QUEST ---");
  try {
    const qp = await eng.getQuestProgress(testUserId);
    console.log("✅ getQuestProgress:", JSON.stringify(qp).slice(0, 150));
  } catch (e) { console.log("❌ getQuestProgress:", e.message.slice(0, 100)); }

  try {
    const qm = await eng.formatQuestMessage(testUserId, true);
    console.log("✅ formatQuestMessage:", qm.slice(0, 100) + "...");
  } catch (e) { console.log("❌ formatQuestMessage:", e.message.slice(0, 100)); }

  // 2. Daily Quest
  console.log("\n--- DAILY QUEST ---");
  try {
    const dq = eng.getDailyQuest(new Date().getDay());
    console.log("✅ getDailyQuest:", JSON.stringify(dq).slice(0, 150));
  } catch (e) { console.log("❌ getDailyQuest:", e.message.slice(0, 100)); }

  try {
    const dm = eng.formatDailyQuestMessage(true);
    console.log("✅ formatDailyQuestMessage:", dm.slice(0, 100) + "...");
  } catch (e) { console.log("❌ formatDailyQuestMessage:", e.message.slice(0, 100)); }

  // 3. Event
  console.log("\n--- EVENT ---");
  try {
    const ev = eng.getCurrentEvent();
    console.log("✅ getCurrentEvent:", ev ? JSON.stringify(ev).slice(0, 100) : "null (no active event)");
  } catch (e) { console.log("❌ getCurrentEvent:", e.message.slice(0, 100)); }

  try {
    const em = eng.formatEventMessage(true);
    console.log("✅ formatEventMessage:", em.slice(0, 100) + "...");
  } catch (e) { console.log("❌ formatEventMessage:", e.message.slice(0, 100)); }

  // 4. Zone Tasks
  console.log("\n--- ZONE TASKS ---");
  try {
    const tasks = eng.getTasksForUser(["core", "gifts"], 1);
    console.log("✅ getTasksForUser(core,gifts,lv1):", tasks.length, "tasks");
  } catch (e) { console.log("❌ getTasksForUser:", e.message.slice(0, 100)); }

  try {
    const completed = await eng.getCompletedTasks(testUserId);
    console.log("✅ getCompletedTasks:", completed.length, "completed");
  } catch (e) { console.log("❌ getCompletedTasks:", e.message.slice(0, 100)); }

  try {
    const tasks = eng.getTasksForUser(["core"], 1);
    const tm = eng.formatTasksMessage(tasks, [], true);
    console.log("✅ formatTasksMessage:", tm.slice(0, 100) + "...");
  } catch (e) { console.log("❌ formatTasksMessage:", e.message.slice(0, 100)); }

  // 5. Achievements
  console.log("\n--- ACHIEVEMENTS ---");
  try {
    const stats = await eng.loadUserStats(testUserId);
    console.log("✅ loadUserStats:", JSON.stringify(stats).slice(0, 150));
  } catch (e) { console.log("❌ loadUserStats:", e.message.slice(0, 100)); }

  try {
    const stats = await eng.loadUserStats(testUserId);
    const earned = await eng.checkAchievements(testUserId, stats);
    console.log("✅ checkAchievements:", earned.length, "newly earned");
  } catch (e) { console.log("❌ checkAchievements:", e.message.slice(0, 100)); }

  try {
    const fm = eng.formatAchievementsMessage([], eng.ACHIEVEMENTS, true);
    console.log("✅ formatAchievementsMessage:", fm.slice(0, 100) + "...");
  } catch (e) { console.log("❌ formatAchievementsMessage:", e.message.slice(0, 100)); }

  console.log("\n✅ Total achievements defined:", eng.ACHIEVEMENTS.length);
  console.log("  Secret:", eng.ACHIEVEMENTS.filter(a => a.secret).length);
  console.log("  Visible:", eng.ACHIEVEMENTS.filter(a => !a.secret).length);

  // 6. Daily Digest
  console.log("\n--- DAILY DIGEST ---");
  try {
    const { Pool } = require("pg");
    const pool = new Pool({
      host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    });
    const dd = await eng.generateDailyDigest(pool, true);
    console.log("✅ generateDailyDigest:", dd.slice(0, 150) + "...");
    pool.end();
  } catch (e) { console.log("❌ generateDailyDigest:", e.message.slice(0, 100)); }

  // 7. Hall of Fame
  console.log("\n--- HALL OF FAME ---");
  try {
    const { Pool } = require("pg");
    const pool = new Pool({
      host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    });
    const hf = await eng.generateHallOfFame(pool, true);
    console.log("✅ generateHallOfFame:", hf.slice(0, 150) + "...");
    pool.end();
  } catch (e) { console.log("❌ generateHallOfFame:", e.message.slice(0, 100)); }

  // 8. Quality Score
  console.log("\n--- QUALITY SCORE ---");
  try {
    const qs = eng.calculateQualityScore("Баг: при нажатии кнопки ничего не происходит. Шаги: 1. Открыть бота 2. Нажать кнопку. Ожидал: ответ. Получил: тишина.", true);
    console.log("✅ calculateQualityScore:", JSON.stringify(qs));
  } catch (e) { console.log("❌ calculateQualityScore:", e.message.slice(0, 100)); }

  // 9. Streak Multiplier
  console.log("\n--- STREAK ---");
  try {
    console.log("✅ getStreakMultiplier(0):", eng.getStreakMultiplier(0));
    console.log("✅ getStreakMultiplier(7):", eng.getStreakMultiplier(7));
    console.log("✅ getStreakMultiplier(14):", eng.getStreakMultiplier(14));
    console.log("✅ getStreakMultiplier(21):", eng.getStreakMultiplier(21));
  } catch (e) { console.log("❌ getStreakMultiplier:", e.message.slice(0, 100)); }

  // 10. Internship
  console.log("\n--- INTERNSHIP ---");
  try {
    const ii = eng.formatInternshipInfo(true);
    console.log("✅ formatInternshipInfo:", ii.slice(0, 100) + "...");
  } catch (e) { console.log("❌ formatInternshipInfo:", e.message.slice(0, 100)); }

  // 11. Inactive Pings
  console.log("\n--- INACTIVE PINGS ---");
  try {
    const { Pool } = require("pg");
    const pool = new Pool({
      host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    });
    const inactive = await eng.getInactiveTesters(pool, 3);
    console.log("✅ getInactiveTesters(3d):", inactive.length, "inactive");
    pool.end();
  } catch (e) { console.log("❌ getInactiveTesters:", e.message.slice(0, 100)); }

  // 12. Zone task count per zone
  console.log("\n--- ZONE TASK COUNTS ---");
  try {
    const zones = ["core", "defi", "gifts", "telegram", "studio", "community"];
    for (const z of zones) {
      const tasks = eng.getTasksForUser([z], 5); // level 5 = see all
      console.log("  " + z + ": " + tasks.length + " tasks");
    }
  } catch (e) { console.log("❌ zone tasks:", e.message.slice(0, 100)); }

  console.log("\n=== ALL TESTS DONE ===");
}

testAll().catch(e => console.error("FATAL:", e.message));
