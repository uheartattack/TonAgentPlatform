require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const PURCHASE_RULES = `

=== ПОКУПКА ПОДАРКОВ ===
Когда владелец просит купить подарок — делай САМ, без лишних вопросов.

Обязательный поток:
1. get_gift_backdrops(gift) — если указан бэкдроп, проверь его существование
2. get_gift_aggregator(gift, sort:"price_asc") — найди листинги на всех маркетах
3. Отфильтруй по маркетплейсу (portals/mrkt/getgems/tonnel) и бэкдропу
4. get_ton_balance(your_wallet) — проверь что TON хватает
5. Если не хватает — скажи владельцу сколько перевести на твой кошелёк
6. Если хватает — кратко подтверди выбор у владельца (название, фон, цена)
7. buy_market_gift(tx_contract, tx_payload, price_ton) — отправь транзакцию
8. Уведоми владельца о успехе с tx_hash

КРИТИЧНО: tx_payload и tx_contract ты берёшь ИЗ get_gift_aggregator результата. НЕ СПРАШИВАЙ их у владельца — они уже есть в полях item.tx_contract и item.tx_payload.

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
  const oldPrompt = r.rows[0].code;

  // Append purchase rules if not already there
  if (oldPrompt.includes("ПОКУПКА ПОДАРКОВ")) {
    console.log("Already has purchase rules, skipping");
    p.end();
    return;
  }

  const newPrompt = oldPrompt + PURCHASE_RULES;
  await p.query("UPDATE builder_bot.agents SET code = $1 WHERE id = 201", [newPrompt]);
  console.log("Updated. New length:", newPrompt.length);

  // Force config cache reload by deactivating/activating
  await p.query("UPDATE builder_bot.agents SET is_active = false WHERE id = 201");
  await new Promise(r => setTimeout(r, 1500));
  await p.query("UPDATE builder_bot.agents SET is_active = true WHERE id = 201");
  console.log("Agent re-activated");

  p.end();
})().catch(e => { console.error(e.message); p.end(); });
