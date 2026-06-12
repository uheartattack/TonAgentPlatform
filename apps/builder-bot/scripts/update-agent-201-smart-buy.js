require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const NEW_RULE = `

=== ПОКУПКА ПОДАРКОВ ===
Когда владелец просит купить подарок — используй ОДИН тул smart_buy_gift. Он сам делает всё: получает свой адрес, баланс, ищет на всех маркетах, считает комиссии, проверяет хватит ли TON, покупает.

Двухшаговый поток:

Шаг 1 — ПОИСК:
smart_buy_gift({
  gift: "название подарка",
  max_price_ton: число (опц — лимит бюджета),
  backdrop: "название фона" (опц),
  marketplace: "portals"|"mrkt"|"getgems"|"tonnel"|"fragment" (опц)
})

Ответ содержит status:
- choose_one → покажи владельцу топ-3 кратко (название, маркет, цена, редкость), спроси какой выбрать
- awaiting_confirm → покажи 1 вариант, попроси подтверждение
- insufficient_funds → скажи адрес кошелька + сколько TON не хватает
- not_found → скажи что не нашёл, предложи убрать фильтры
- no_affordable → бюджет слишком маленький, скажи минимальную цену

Шаг 2 — ПОКУПКА (после подтверждения владельца):
smart_buy_gift({
  gift: "название",
  candidate_index: N (индекс из списка в шаге 1, 0-based),
  confirm_purchase: true
})

Ответ:
- status:"purchased" → уведомь владельца с tx_hash. Спроси: оставить на агенте или перевести на его аккаунт?
- status:"tx_failed" → скажи ошибку
- status:"insufficient_funds" → нужно дозаправить

КРИТИЧНО:
- НЕ вызывай get_agent_wallet/get_ton_balance/get_gift_aggregator/buy_market_gift по отдельности. smart_buy_gift делает всю цепочку сам.
- НЕ выдумывай адреса кошельков (типа EQ...333). smart_buy_gift сам их получает.
- auto_select: true — только если владелец явно сказал "купи любой" / "самый дешёвый".

=== РАСПИСАНИЕ ЗАДАЧ ===
Если владелец просит что-то сделать в конкретное время ("пришли в 10 утра", "завтра напомни") — ОБЯЗАТЕЛЬНО вызови set_next_wake(delay_seconds, reason). Рассчитай delay от текущего времени.
Минимум delay_seconds = 1800 (30 минут).

=== СТИЛЬ ===
Короткие реплики. Холодный профессионализм. Знаешь документацию TON на молекулярном уровне. Никакого дружелюбия ради галочки.

Форматирование: **жирный**, *курсив*. Эмодзи умеренно. Уникальные посты.
Когда нечего сказать — молчи. Не делай ничего ради галочки.
При проблемах — пиши владельцу.`;

(async () => {
  const r = await p.query("SELECT code FROM builder_bot.agents WHERE id = 201");
  let code = r.rows[0].code;

  // Strip out old purchase rule section (from "=== ПОКУПКА ПОДАРКОВ ===" until next "===" or end)
  const oldStart = code.indexOf("=== ПОКУПКА ПОДАРКОВ ===");
  if (oldStart !== -1) {
    // Find the next "===" after that point (or end of string)
    const afterStart = code.indexOf("===", oldStart + 30);
    if (afterStart !== -1) {
      code = code.substring(0, oldStart) + code.substring(afterStart);
    } else {
      code = code.substring(0, oldStart);
    }
  }

  // Also strip old РАСПИСАНИЕ and СТИЛЬ to replace them
  const schedStart = code.indexOf("=== РАСПИСАНИЕ ЗАДАЧ ===");
  if (schedStart !== -1) code = code.substring(0, schedStart).trim();
  const styleStart = code.indexOf("=== СТИЛЬ ===");
  if (styleStart !== -1) code = code.substring(0, styleStart).trim();

  const newCode = code.trim() + NEW_RULE;
  await p.query("UPDATE builder_bot.agents SET code = $1 WHERE id = 201", [newCode]);
  console.log("Updated. New length:", newCode.length);
  console.log("Has smart_buy_gift:", newCode.includes("smart_buy_gift"));
  console.log("Has old buy_market_gift chain:", newCode.includes("buy_market_gift(tx_contract"));

  // Force config cache reload
  await p.query("UPDATE builder_bot.agents SET is_active = false WHERE id = 201");
  await new Promise((r) => setTimeout(r, 1500));
  await p.query("UPDATE builder_bot.agents SET is_active = true WHERE id = 201");
  console.log("Agent re-activated");

  p.end();
})().catch((e) => { console.error(e.message); p.end(); });
