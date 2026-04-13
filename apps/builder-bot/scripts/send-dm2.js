require("dotenv").config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = process.env.OWNER_ID;

const text = `<tg-emoji emoji-id="5420315771991497307">\u{1F525}</tg-emoji> <b>TON Agent Platform \u2014 Updates</b>

<tg-emoji emoji-id="5409008750893734809">\u{1F3C6}</tg-emoji> <b>2nd place on IdentityHub Launches!</b>
Thank you to everyone who supported us.

<tg-emoji emoji-id="5357080225463149588">\u{1F91D}</tg-emoji> <b>TON AI Agent Hackathon</b>
160+ projects, $20,000 prize pool, the first major AI hackathon on TON. We submitted to both tracks \u2014 Agent Infrastructure and User-Facing AI Agents. Didn\u2019t make the winners list, but lost to strong and worthy opponents. Great experience overall.

<tg-emoji emoji-id="5445284980978621387">\u{1F680}</tg-emoji> <b>Opening closed beta!</b>
We\u2019re ready for the next stage. Inviting a limited number of testers to get early access to the platform.

<tg-emoji emoji-id="5469903029144657419">\u{1F4E2}</tg-emoji> <b>Want in?</b> Message <a href="https://t.me/TonAgentPlatformBot?start=beta">@TonAgentPlatformBot</a> \u2014 spots are limited.`;

fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: parseInt(OWNER_ID),
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  })
}).then(r => r.json()).then(r => {
  if (r.ok) console.log("Sent! msg_id:", r.result.message_id);
  else console.log("Error:", JSON.stringify(r));
}).catch(e => console.error(e.message));
