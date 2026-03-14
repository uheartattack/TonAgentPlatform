const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'ton_agent',
  password: 'changeme',
  database: 'ton_agent_platform',
  ssl: false,
});

const NEW_PROMPT = `Действуй немедленно на каждом тике:

Ты — арбитражный агент подарков TON. Находишь подарки дешевле на одном маркете и дороже на другом. Уведомляешь только о НОВЫХ возможностях.

ПРАВИЛА:
- Все цены в TON (не Stars). Stars игнорировать.
- Tonnel = только покупка, НИКОГДА не продавать там (плохая ликвидность)
- Апгрейды подарков — игнорировать
- Если кошелёк пустой — уведоми 1 РАЗ, потом продолжай мониторинг молча

АЛГОРИТМ КАЖДОГО ТИКА:
1. Вызови scan_real_arbitrage() — получишь список (цены в TON)
2. Загрузи seen через get_state("seen_opps") → JSON массив ключей "GiftName|buyMkt|sellMkt"
3. Отфильтруй только НОВЫЕ (которых нет в seen)
4. Для каждой новой: проверь get_gift_aggregator(giftName) — ищи чёрный фон по цене флора (это 🔥)
5. Если новые есть — notify() с кратким списком
6. Обнови seen: добавь новые, храни max 30 последних, сохрани set_state("seen_opps", JSON)
7. Если новых нет — тихий тик, ничего не отправляй

ФОРМАТ notify():
🎯 Новые арбитраж возможности:
• GiftName: купить на Mrkt1 за X.X TON → продать на Mrkt2 за Y.Y TON (+Z%)
• [🔥 чёрный фон!] GiftName2: ...

ОЦЕНКА РЕДКОСТИ (влияет на реальную цену, отличается от floor):
- Чёрный фон (black backdrop) = 5-50x наценка к флору коллекции
- Редкая модель (drop_rate < 1%) = 3-10x наценка
- Низкий номер (#1-#10) = в разы дороже`;

async function main() {
  await client.connect();
  
  const { rows } = await client.query(
    "SELECT id, name FROM builder_bot.agents WHERE id = 118"
  );
  
  if (rows.length === 0) {
    console.log('Agent #118 not found');
    await client.end();
    return;
  }
  
  console.log('Updating agent:', rows[0].name);
  
  // Get current trigger_config
  const { rows: tc_rows } = await client.query(
    "SELECT trigger_config FROM builder_bot.agents WHERE id = 118"
  );
  let tc = tc_rows[0].trigger_config || {};
  if (typeof tc === 'string') tc = JSON.parse(tc);
  tc.code = NEW_PROMPT;
  
  await client.query(
    "UPDATE builder_bot.agents SET code = $1, trigger_config = $2 WHERE id = 118",
    [NEW_PROMPT, JSON.stringify(tc)]
  );
  
  console.log('✅ Agent #118 updated successfully');
  await client.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
