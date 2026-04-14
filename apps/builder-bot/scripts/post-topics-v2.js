require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.BETA_GROUP_ID;
const groupLink = "https://t.me/c/3739874856";

// Premium emoji helper
const CE = {
  fire:'5420315771991497307', trophy:'5409008750893734809', diamond:'5471952986970267163',
  rocket:'5445284980978621387', crown:'5467406098367521267', bug:'5397991236361527676',
  bulb:'5472146462362048818', coin:'5375296873982604963', lab:'5411512278740640309',
  check:'5427009714745517609', star:'5469741319330996757', target:'5350460637182993292',
  cart:'5431499171045581032', sparkle:'5472164874886846699', handshake:'5357080225463149588',
  lock:'5472308992514464048', cross:'5465665476971471368', key:'5330115548900501467',
  bell:'5242628160297641831', megaphone:'5469903029144657419', party:'5436040291507247633',
  pencil:'5334882760735598374',
  divider:'5382360493161725288',
};
function ce(name, fb) {
  return CE[name] ? `<tg-emoji emoji-id="${CE[name]}">${fb}</tg-emoji>` : fb;
}

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
  console.log(label + ":", res.ok ? "OK" : res.description);
}

(async () => {

  // ── #Content (582) ──
  await post(582,
    `${ce('megaphone','\u{1F4E2}')} <b>\u041A\u043E\u043D\u0442\u0435\u043D\u0442</b>\n\n` +
    `<i>\u0421\u043E\u0437\u0434\u0430\u0432\u0430\u0439 \u043A\u043E\u043D\u0442\u0435\u043D\u0442 \u043F\u0440\u043E \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443 \u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0439 \u043E\u043F\u044B\u0442.</i>\n\n` +
    ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + `\n\n` +
    `${ce('target','\u{1F3AF}')} <b>\u0427\u0442\u043E \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F:</b>\n` +
    `  ${ce('check','\u2705')} \u041F\u043E\u0441\u0442 \u043F\u0440\u043E \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443 \u0432 \u043B\u044E\u0431\u043E\u043C TON \u0447\u0430\u0442\u0435 \u0438\u043B\u0438 \u043A\u0430\u043D\u0430\u043B\u0435\n` +
    `  ${ce('check','\u2705')} \u0412\u0438\u0434\u0435\u043E-\u043E\u0431\u0437\u043E\u0440 \u0438\u043B\u0438 \u0442\u0443\u0442\u043E\u0440\u0438\u0430\u043B\n` +
    `  ${ce('check','\u2705')} \u0413\u0430\u0439\u0434 \u0434\u043B\u044F \u043D\u043E\u0432\u0438\u0447\u043A\u043E\u0432 <i>(500+ \u0441\u043B\u043E\u0432 = \u0430\u0447\u0438\u0432\u043A\u0430 \u041F\u0438\u0441\u0430\u0442\u0435\u043B\u044C)</i>\n` +
    `  ${ce('check','\u2705')} \u041C\u0435\u043C\u044B \u0442\u043E\u0436\u0435 \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F\n\n` +
    `${ce('coin','\u{1FA99}')} <b>\u041D\u0430\u0433\u0440\u0430\u0434\u044B:</b>\n` +
    `  ${ce('sparkle','\u2728')} \u041A\u0430\u0436\u0434\u0430\u044F \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044F: <code>+30 XP</code>\n` +
    `  ${ce('trophy','\u{1F3C6}')} <a href="${groupLink}/576">\u041D\u0435\u0434\u0435\u043B\u044F \u041A\u043E\u043D\u0442\u0435\u043D\u0442\u0430</a> <i>(\u043D\u0435\u0434\u0435\u043B\u044F 3)</i> \u2014 \u043B\u0443\u0447\u0448\u0438\u0439 \u043F\u043E\u043B\u0443\u0447\u0438\u0442 <code>150 Points</code>\n` +
    `  ${ce('star','\u2B50')} \u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F: <i>\u041F\u0438\u0441\u0430\u0442\u0435\u043B\u044C \u0438 \u0410\u0432\u0442\u043E\u0440</i>\n\n` +
    ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + `\n\n` +
    `${ce('bulb','\u{1F4A1}')} <i>\u041E\u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u043B \u2014 \u0441\u043A\u0438\u043D\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0441\u044E\u0434\u0430.</i>`,
    "#Content"
  );

  // ── #Internship (585) ──
  await post(585,
    `${ce('crown','\u{1F451}')} <b>\u0421\u0442\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 TON Agent Platform</b>\n\n` +
    `<i>\u041B\u0443\u0447\u0448\u0438\u0435 \u0442\u0435\u0441\u0442\u0435\u0440\u044B \u043F\u043E \u0438\u0442\u043E\u0433\u0430\u043C \u0441\u0435\u0437\u043E\u043D\u0430 \u043F\u043E\u043B\u0443\u0447\u0430\u0442 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0443.</i>\n\n` +
    ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + `\n\n` +
    `${ce('rocket','\u{1F680}')} <b>\u0424\u043E\u0440\u043C\u0430\u0442:</b>\n` +
    `  ${ce('diamond','\u{1F48E}')} 2-3 \u043C\u0435\u0441\u044F\u0446\u0430, \u0443\u0434\u0430\u043B\u0451\u043D\u043D\u043E, <code>5-10 \u0447/\u043D\u0435\u0434</code>\n` +
    `  ${ce('diamond','\u{1F48E}')} \u041C\u0435\u043D\u0442\u043E\u0440\u0441\u0442\u0432\u043E \u043E\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B\n` +
    `  ${ce('diamond','\u{1F48E}')} \u0414\u043E\u0441\u0442\u0443\u043F \u043A GitHub, \u0441\u0435\u0440\u0432\u0435\u0440\u0443, \u0430\u0440\u0445\u0438\u0442\u0435\u043A\u0442\u0443\u0440\u0435\n` +
    `  ${ce('diamond','\u{1F48E}')} \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0438\u0441\u044C\u043C\u043E\n` +
    `  ${ce('diamond','\u{1F48E}')} \u041B\u0443\u0447\u0448\u0438\u0439 \u043C\u043E\u0436\u0435\u0442 \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0435\n\n` +
    `${ce('target','\u{1F3AF}')} <b>\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F:</b>\n` +
    `  ${ce('bug','\u{1F41B}')} <b>QA</b> \u2014 <i>\u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435, \u0430\u0432\u0442\u043E\u0442\u0435\u0441\u0442\u044B</i>\n` +
    `  ${ce('rocket','\u{1F680}')} <b>\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0430</b> \u2014 <i>TypeScript, TON, Telegram</i>\n` +
    `  ${ce('bulb','\u{1F4A1}')} <b>AI</b> \u2014 <i>\u0430\u0433\u0435\u043D\u0442\u043D\u044B\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B</i>\n` +
    `  ${ce('handshake','\u{1F91D}')} <b>\u0421\u043E\u043E\u0431\u0449\u0435\u0441\u0442\u0432\u043E</b> \u2014 <i>\u043A\u043E\u043D\u0442\u0435\u043D\u0442, \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u044F</i>\n\n` +
    ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + `\n\n` +
    `${ce('key','\u{1F511}')} <b>\u041A\u0430\u043A \u043F\u043E\u043F\u0430\u0441\u0442\u044C:</b>\n` +
    `  ${ce('star','\u2B50')} \u041C\u0438\u043D\u0438\u043C\u0443\u043C <code>500 XP</code>\n` +
    `  ${ce('star','\u2B50')} \u0423\u0447\u0430\u0441\u0442\u0438\u0435 \u0432\u043E \u0432\u0441\u0435\u0445 4 \u0438\u0432\u0435\u043D\u0442\u0430\u0445\n` +
    `  ${ce('star','\u2B50')} \u041C\u0438\u043D\u0438\u043C\u0443\u043C 3 \u0437\u043E\u043D\u044B\n` +
    `  ${ce('star','\u2B50')} \u0421\u0435\u0440\u0438\u044F <code>14+</code> \u0434\u043D\u0435\u0439\n\n` +
    `${ce('trophy','\u{1F3C6}')} \u041E\u0442\u0431\u043E\u0440 \u043F\u043E\u0441\u043B\u0435 <a href="${groupLink}/576">\u0424\u0438\u043D\u0430\u043B\u0430 \u0421\u0435\u0437\u043E\u043D\u0430</a> <i>(\u043D\u0435\u0434\u0435\u043B\u044F 4)</i>\n` +
    `${ce('pencil','\u270F\uFE0F')} \u0417\u0430\u044F\u0432\u043A\u0430: /internship`,
    "#Internship"
  );

  // ── #Squads (579) ──
  await post(579,
    `${ce('handshake','\u{1F91D}')} <b>\u041A\u043E\u043C\u0430\u043D\u0434\u044B</b>\n\n` +
    `<i>\u0421\u043E\u0440\u0435\u0432\u043D\u0443\u0439\u0442\u0435\u0441\u044C \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C\u0438 \u043F\u043E 3 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430. \u041E\u0431\u0449\u0438\u0439 XP = \u0441\u0447\u0451\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B.</i>\n\n` +
    ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + `\n\n` +
    `${ce('target','\u{1F3AF}')} <b>\u041A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442:</b>\n` +
    `  ${ce('diamond','\u{1F48E}')} \u041A\u043E\u043C\u0430\u043D\u0434\u044B \u0444\u043E\u0440\u043C\u0438\u0440\u0443\u044E\u0442\u0441\u044F <b>\u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438</b> \u043F\u0435\u0440\u0435\u0434 \u043A\u0430\u0436\u0434\u044B\u043C \u0438\u0432\u0435\u043D\u0442\u043E\u043C\n` +
    `  ${ce('diamond','\u{1F48E}')} \u041E\u0431\u0449\u0438\u0439 XP \u0432\u0441\u0435\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 = <code>\u0441\u0447\u0451\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B</code>\n` +
    `  ${ce('diamond','\u{1F48E}')} \u041F\u0440\u043E\u0438\u0433\u0440\u0430\u0432\u0448\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0442\u0435\u0440\u044F\u0435\u0442 \u0442\u0435\u0433 \u043D\u0430 \u043D\u0435\u0434\u0435\u043B\u044E\n` +
    `  ${ce('diamond','\u{1F48E}')} \u041F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u044E\u0442 <code>\u0431\u043E\u043D\u0443\u0441 XP</code> \u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0442\u0435\u0433\n\n` +
    `${ce('rocket','\u{1F680}')} <b>\u041A\u043E\u043C\u0430\u043D\u0434\u0430:</b> /squad\n\n` +
    ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + ce('divider','\u2796') + `\n\n` +
    `${ce('bulb','\u{1F4A1}')} <i>\u041F\u0435\u0440\u0432\u044B\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u043A\u043E\u0433\u0434\u0430 \u0431\u0443\u0434\u0435\u0442 \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0442\u0435\u0441\u0442\u0435\u0440\u043E\u0432.</i>`,
    "#Squads"
  );

  console.log("\nDone!");
})();
