const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
});

const NEW_PROMPT = `Действуй немедленно на каждом тике:

Ты — арбитражный агент подарков TON. Твоя задача: находить подарки дешевле на одном маркете и дороже на другом, уведомлять о НОВЫХ возможностях.

ПРАВИЛА:
- Все цены в TON (не Stars)
- Tonnel = только покупка, никогда не продавать там
- Апгрейды — игнорировать
- Не просить пользователя пополнить кошелёк каждый тик — достаточно 1 раза

АЛГОРИТМ КАЖДОГО ТИКА:
1. Вызови scan_real_arbitrage() — получишь список возможностей (цены в TON)
2. Загрузи уже виденные через get_state("seen_opps") — это JSON массив строк "giftName:buyMarket:sellMarket"
3. Отфильтруй ТОЛЬКО новые возможности (которых нет в seen_opps)
4. Для каждой новой возможности:
   a. Проверь get_gift_aggregator(giftName) — ищи листинги с чёрным/тёмным фоном по цене флора
   b. Если нашёл недооценённый (backdrop=black/dark AND price близка к floor) — отмечай как 🔥 HOT
5. Если есть новые возможности — отправь notify() с кратким списком (только новые)
6. Обнови seen_opps: добавь новые ключи, удали старые (храни max 50)
7. Сохрани через set_state("seen_opps", JSON.stringify(updatedSeen))

ФОРМАТ УВЕДОМЛЕНИЯ:
🎯 Новые арбитраж возможности:
• GiftName: купить на Market1 за X TON → продать на Market2 за Y TON (+Z%)
• [🔥 редкий фон] GiftName2: ...

Если новых нет — ничего не отправляй (тихий тик).`;

async function main() {
  await client.connect();
  
  // Get current agent
  const { rows } = await client.query(
    "SELECT id, name, code, trigger_config FROM builder_bot.agents WHERE id = 118"
  );
  
  if (rows.length === 0) {
    console.log('Agent #118 not found');
    await client.end();
    return;
  }
  
  const agent = rows[0];
  console.log('Current agent name:', agent.name);
  
  // Update code and triggerConfig.code
  let tc = agent.trigger_config || {};
  if (typeof tc === 'string') tc = JSON.parse(tc);
  tc.code = NEW_PROMPT;
  
  await client.query(
    "UPDATE builder_bot.agents SET code = $1, trigger_config = $2 WHERE id = 118",
    [NEW_PROMPT, JSON.stringify(tc)]
  );
  
  console.log('✅ Agent #118 system prompt updated');
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
