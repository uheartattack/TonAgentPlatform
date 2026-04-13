require("dotenv").config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.BETA_GROUP_ID;
const OWNER_ID = process.env.OWNER_ID;

const text = `Sent to your DM`;

fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: parseInt(OWNER_ID),
    text: `<tg-emoji emoji-id="5445284980978621387">\u{1F680}</tg-emoji> <b>Yo! Welcome to the beta!</b>

Glad you\u2019re here. Quick rundown:

1. Open <a href="https://t.me/TonAgentPlatformBot">@TonAgentPlatformBot</a> \u2192 /mystats \u2014 your profile, XP, level
2. /checkin \u2014 daily check-in, +1 XP, don\u2019t skip it
3. /feedback \u2014 found a bug or have an idea? Report it, +5 XP. Screenshots welcome
4. /tasks \u2014 current testing tasks
5. /shop \u2014 spend your Points on rewards
6. /role \u2014 pick 1-3 zones you want to focus on

XP = experience for everything you do. Points = you get them on level-ups and when your reported bugs get fixed. Spend Points in /shop.

Break stuff, report everything, have fun. Let\u2019s build this together \u{1F91D}`,
    parse_mode: "HTML",
    disable_web_page_preview: true
  })
}).then(r => r.json()).then(r => {
  if (r.ok) console.log("Sent! msg_id:", r.result.message_id);
  else console.log("Error:", JSON.stringify(r));
}).catch(e => console.error(e.message));
