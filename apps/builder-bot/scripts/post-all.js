require("dotenv").config();
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "commonjs" } });

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.BETA_GROUP_ID;

const TOPICS = { announcements: 11, daily_quest: 573, events: 576 };
const groupLink = "https://t.me/c/3739874856";

async function post(topicId, text, label) {
  const res = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: parseInt(GROUP_ID),
      text: text,
      parse_mode: "HTML",
      message_thread_id: topicId,
      disable_web_page_preview: true,
    }),
  }).then(r => r.json());
  console.log(label + ":", res.ok ? "OK (msg_id:" + res.result?.message_id + ")" : res.description);
}

(async () => {
  const eng = require("../src/engagement");

  // 1. Event → #Events
  const eventText = eng.formatEventMessage(true);
  await post(TOPICS.events, eventText, "Event \u2192 #Events");

  // 2. Daily Quest → #Daily-Quest
  const dailyText = eng.formatDailyQuestMessage(true);
  await post(TOPICS.daily_quest, dailyText, "Daily \u2192 #Daily-Quest");

  // 3. Announcement with hyperlinks → #Announcements
  const announceText =
    "<b>\u{1F680} \u041D\u043E\u0432\u044B\u0435 \u0444\u0438\u0447\u0438 \u0434\u043B\u044F \u0442\u0435\u0441\u0442\u0435\u0440\u043E\u0432!</b>\n\n" +
    "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430 \u043F\u043E\u043B\u043D\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0430, \u043A\u0432\u0435\u0441\u0442\u043E\u0432 \u0438 \u0438\u0432\u0435\u043D\u0442\u043E\u0432.\n\n" +
    "<b>\u0427\u0442\u043E \u043D\u043E\u0432\u043E\u0433\u043E:</b>\n" +
    '\u2022 <a href="' + groupLink + '/576">\u0418\u0432\u0435\u043D\u0442 \u043D\u0435\u0434\u0435\u043B\u0438</a> \u2014 \u041D\u0435\u0434\u0435\u043B\u044F \u0411\u0430\u0433\u043E\u0432 (x2 XP)\n' +
    '\u2022 <a href="' + groupLink + '/573">\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u0434\u043D\u044F</a> \u2014 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0435 \u043A\u0432\u0435\u0441\u0442\u044B\n' +
    "\u2022 78 \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0439 \u2014 /achievements\n" +
    "\u2022 \u041A\u043E\u043C\u0430\u043D\u0434\u044B \u2014 /squad\n" +
    "\u2022 \u041D\u0430\u0441\u0442\u0430\u0432\u043D\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u2014 /mentor\n" +
    '\u2022 <a href="' + groupLink + '/585">\u0421\u0442\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0430</a> \u2014 /internship\n\n' +
    "<b>\u041A\u043E\u043C\u0430\u043D\u0434\u044B:</b>\n" +
    "<code>/quest /daily /event /tasks /achievements /coverage /verify /squad /mentor /internship</code>\n\n" +
    "\u041D\u0435 \u0437\u0430\u0431\u044B\u0432\u0430\u0439\u0442\u0435 /checkin \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C!";

  await post(TOPICS.announcements, announceText, "Announce \u2192 #Announcements");

  console.log("\nDone!");
})();
