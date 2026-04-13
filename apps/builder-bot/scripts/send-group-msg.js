require("dotenv").config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.BETA_GROUP_ID;

const text = `<tg-emoji emoji-id="5445284980978621387">\u{1F680}</tg-emoji> <b>Welcome to the beta team!</b>

Quick start:

1. Open <a href="https://t.me/TonAgentPlatformBot">@TonAgentPlatformBot</a> \u2192 /mystats \u2014 your profile
2. /checkin \u2014 daily check-in (+1 XP), don\u2019t skip
3. /feedback \u2014 found a bug or have an idea? Report it (+5 XP)
4. /tasks \u2014 testing tasks for this week
5. /shop \u2014 spend Points on rewards
6. /role \u2014 pick your testing zones

<tg-emoji emoji-id="5472146462362048818">\u{1F4A1}</tg-emoji> <b>How it works:</b>
\u2022 XP = experience for every action (bugs, features, check-ins)
\u2022 Points = currency you get on level-ups and when your bugs get fixed
\u2022 Spend Points in /shop

<tg-emoji emoji-id="5397991236361527676">\u{1F41B}</tg-emoji> <b>Found a bug?</b> /feedback in bot DM, attach a screenshot

<tg-emoji emoji-id="5420315771991497307">\u{1F525}</tg-emoji> Let\u2019s go!`;

fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: parseInt(GROUP_ID),
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  })
}).then(r => r.json()).then(r => {
  if (r.ok) console.log("Posted! msg_id:", r.result.message_id);
  else console.log("Error:", JSON.stringify(r));
}).catch(e => console.error(e.message));
