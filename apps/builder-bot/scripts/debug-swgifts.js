require("dotenv").config();
const { Pool } = require("pg");

const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

(async () => {
  const agent = await p.query("SELECT user_id FROM builder_bot.agents WHERE id=201");
  console.log("agent.user_id:", agent.rows[0].user_id);

  const tgId = Number(agent.rows[0].user_id);  // agents.user_id IS the telegram_id in this schema
  console.log("resolved tgId:", tgId);

  if (!tgId) {
    console.log("NO TG_ID — cannot call SwiftGifts properly");
    p.end();
    return;
  }

  // Test 1: Hex Pot with real tg_id
  console.log("\n=== Test 1: Hex Pot to_price=5 with real tg_id ===");
  const r1 = await fetch("https://partners.swiftgifts.tg/api/aggregator?page=0", {
    method: "POST",
    headers: { "x-api-key": process.env.SWIFTGIFTS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Hex Pot",
      model: "All",
      symbol: "All",
      backdrop: "All",
      number: null,
      from_price: null,
      to_price: 5,
      market: ["tonnel", "portals", "Mrkt"],
      receiver: tgId,
    }),
  });
  const j1 = await r1.json();
  console.log("status:", r1.status, "total:", j1.total, "items:", (j1.items || []).length);
  if (j1.error) console.log("error:", j1.error);
  if ((j1.items || []).length > 0) {
    const it = j1.items[0];
    console.log("first item:", it.provider, it.title, it.price, "bg=", it.attributes?.backdrop?.value);
  }

  // Test 2: with Mystic Pearl backdrop
  console.log("\n=== Test 2: Hex Pot + backdrop=Mystic Pearl ===");
  const r2 = await fetch("https://partners.swiftgifts.tg/api/aggregator?page=0", {
    method: "POST",
    headers: { "x-api-key": process.env.SWIFTGIFTS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Hex Pot",
      model: "All",
      symbol: "All",
      backdrop: "Mystic Pearl",
      number: null,
      from_price: null,
      to_price: 5,
      market: ["tonnel", "portals", "Mrkt"],
      receiver: tgId,
    }),
  });
  const j2 = await r2.json();
  console.log("status:", r2.status, "total:", j2.total, "items:", (j2.items || []).length);
  if (j2.error) console.log("error:", j2.error);

  // Test 3: get all gift names
  console.log("\n=== Test 3: getAllGiftNames() count ===");
  try {
    const r3 = await fetch("https://api.changes.tg/gifts", { signal: AbortSignal.timeout(8000) });
    const arr = await r3.json();
    console.log("total gifts:", arr.length, "first 5:", arr.slice(0, 5));
  } catch (e) {
    console.log("error:", e.message);
  }

  p.end();
})().catch((e) => {
  console.error("FATAL:", e.message);
  p.end();
});
