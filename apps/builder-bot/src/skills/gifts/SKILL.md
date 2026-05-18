---
name: gifts
description: Telegram Gifts pricing, arbitrage, and trading. Use this skill when the user mentions gifts, gift names (Plush Pepe, Lol Pop, Jelly Bunny, Heart Locket, etc.), arbitrage, gift floor prices, gift portfolio, gift collections, marketplaces (Tonnel, Portals, MRKT, GetGems, Fragment, GiftAsset, SwiftGifts), or anything about buying/selling Telegram gifts. Read this BEFORE picking any tool for a gift-related task — the most common mistake is using NFT or balance tools for gifts.
license: Proprietary. TON Agent Platform.
compatibility: Requires gifts capability enabled (CAPABILITY_TOOL_MAP.gifts) and GiftAsset + SwiftGifts API keys configured.
metadata:
  category: trading
  version: "1.0"
  author: TON Agent Platform
---

# Telegram Gifts — Trading & Arbitrage Skill

## 🚨 Tool selection rule (READ FIRST)

For ANY gift-related question:
- ✅ USE: `get_gift_floor_real`, `get_collection_offers`, `get_gift_aggregator`,
  `scan_real_arbitrage`, `get_price_list`, `get_market_overview`,
  `find_underpriced_gifts`, `get_unique_gift_prices`, `get_backdrop_floors`
- ❌ NEVER USE: `get_nft_floor` (that's for NFT collections, not gifts),
  `get_ton_balance`, `ton_get_*` (those are blockchain ops)

Gift data is ALWAYS available via GiftAsset/SwiftGifts API — offchain markets
(Tonnel/Portals/MRKT) and onchain markets (GetGems/Fragment).

If `get_collection_offers` returns `[]` — no active buy-orders right now.
Explain to the user how to sell via a listing on GetGems instead.

## 📦 Gift lifecycle (3 stages)

1. **PRE-MARKET** (regular gift) — issued as a regular item, NOT yet an NFT.
   Cannot be transferred or sold. Lives in the user's bot inventory.
2. **UPGRADE** (paid with Stars) — user pays Stars to upgrade. The gift becomes
   a unique NFT with a sequence number (#1, #2, #3...). Each upgraded gift
   gets a UNIQUE number within its collection.
3. **UNIQUE GIFT (NFT)** — tradeable on markets (Fragment / GetGems /
   GiftAsset / Telegram Market).

## 💰 Price formation

- **Issue number (#)**: Lower = more expensive. #1 costs 50,000+ Stars,
  #100 is much cheaper.
- **Background (backdrop)**: THE MOST important factor. Black (#000000 or
  "Black") = max price. Coloured backgrounds are cheaper. Example: "Homemade
  Cake" with a black backdrop costs 10-50× more than the white version.
- **Model**: Gift design. Rare models (lower drop_rate %) are more expensive.
- **Symbol/decor**: Minor influence.
- **Supply %**: Lower % drop rate → rarer → more expensive.

## 📊 Marketplaces

**OFFCHAIN** (gift not on blockchain — cheaper):
- Tonnel → prices in TON. ⚠️ BUY ONLY — poor sell liquidity.
- Portals → prices in TON. Buy + sell.
- MRKT.tg → prices in TON. Buy + sell.

**ONCHAIN** (NFT on blockchain — more expensive but best liquidity):
- GetGems → TON. Best sell market.
- Fragment.com → TON. High liquidity.
- GiftAsset.pro → TON. Aggregator (Premium API).
- SwiftGifts → TON. Aggregator across 7 marketplaces.

## ⚠️ Critical rules

- ONCHAIN gifts cost MORE than offchain analogues (10-25% spread) — that's NORMAL.
- When reporting floor: ALWAYS show offchain floor AND onchain floor SEPARATELY.
- Example correct answer: `Portals (offchain): 4.74 TON | GetGems (onchain): 5.40 TON`.
- Tonnel = buy source ONLY. NEVER sell on Tonnel.
- Gift upgrades — IGNORE. Arbitrage is between marketplaces only.
- Stars prices — IGNORE. Work in TON only.
- NEVER ask the user to top up the wallet. Just notify if balance insufficient.
- Don't repeat the same opportunities every tick — use `set_state`/`get_state`
  for deduplication.

## 🚫 Anti-hallucination & anti-spam (STRICT)

- `notify()` ONLY after a tool returned a concrete listing with the fields
  `provider`, `price_ton`, `link`.
- NEVER call `notify()` based on: `get_state` results, assumptions, logic
  without an API response.
- ORDER IS MANDATORY: tool call → check `items[]` → if non-empty → THEN `notify()`.
- If `get_gift_aggregator` returned `items[] = []` → don't notify, finish silently.
- If `get_gift_aggregator` returned `items[0]` with real `price_ton` + `link` →
  THEN `notify()` with that link.

## 📵 ONE notify() per run — ABSOLUTE RULE

- NEVER call `notify()` multiple times in one run — that's spam.
- Combine all findings into ONE message: "Found 3 Lol Pop: cheapest 4.47 on
  Portals, 4.83 on MRKT...".
- If user said "up to X TON" → only notify if `items[0].price_ton ≤ X`.
- If only found more expensive than asked → DO NOT notify, finish silently.

❓ Don't ask for Telegram ID — receiver is taken from the system automatically.

## 🎯 Quality scoring (affects price)

1. **Backdrops** (most expensive → cheapest):
   Black > Dark blue > Purple > Other colours > White/Grey
   - Black backdrop = 5-50× markup over collection floor.
   - ALWAYS check `backdrop` on every listing via `get_gift_aggregator`.
2. **Models**: lower `drop_rate %` → rarer → higher price.
   - Example: a model with `drop_rate 0.5%` is 3-10× more expensive than
     one with `drop_rate 10%`.
   - If listing price < expected by model rarity → UNDERVALUED → buy.
3. **Issue number (#N)**: #1-#10 are significantly more expensive. #100+ —
   close to floor.

## 🔄 Arbitrage strategies

- **Offchain → Onchain**: buy cheap on Portals/MRKT (offchain) → sell on
  GetGems (onchain) = 10-25% profit.
- **Tonnel is cheapest** → buy there, sell on GetGems / MRKT / Portals.
- **Hunt undervalued gifts**: black backdrop or rare model at floor price = 🔥.
- **Watch fresh collections**: first listings are usually below market.

## 🛠 Full tool arsenal (23 gift tools)

### 📊 Analytics & market overview

1. `get_top_deals()` — TOP deals of the day (GiftAsset Pro). Start monitoring here.
2. `get_collections_marketcap()` — market cap of ALL collections. Which markets are biggest.
3. `get_market_health()` — greed + health indices (>70 greed = sell, <30 = buy).
4. `get_market_activity(gift?, type, markets)` — realtime buy/sell feed. What's selling RIGHT NOW.
5. `get_price_history(collection_name)` — price trend over days/weeks.

### 💰 Valuation & deal hunting

6. `find_underpriced_gifts(collection, max_price?, min_discount_pct?)` — 🔥 PRIMARY TOOL.
   Finds listings below fair value by backdrop + model.
7. `get_unique_gift_prices(name)` — per-variant prices (backdrop+model combo). More precise than collection floor.
8. `get_backdrop_floors(collection)` — floor by background colour (black = 5-50× white).
9. `get_attribute_volumes(name)` — sales volume by attribute. What's actually liquid.
10. `get_price_list()` — current floor for ALL collections at once.

### 🔍 Concrete listing lookup

11. `get_gift_aggregator(name, to_price?, backdrop?, model?)` — live listings
    from ALL markets + BOC ready to buy.
12. `scan_real_arbitrage()` — cross-market spreads, verified by the aggregator.
13. `get_collection_offers(name)` — GUARANTEED buyers (buy offers). Reliable sell price.
14. `get_gift_floor_real(slug)` — floor by every market (offchain vs onchain).
15. `get_gift_sales_history(slug)` — last sales of a specific collection.

### 🛒 Buy & sell

16. `buy_market_gift(tx_contract, tx_payload, price_ton)` — INSTANT BUY (requires `can_buy_now=true`).
17. `get_agent_wallet()` — agent's wallet address + balance.
18. `send_ton(to, amount)` — send TON.
19. `list_gift_for_sale(gift_id, price)` — list a gift for sale.

### 📦 Portfolio & info

20. `get_user_portfolio(username/telegram_id)` — user portfolio with valuation.
21. `get_gift_upgrade_stats()` — upgrade statistics.
22. `analyze_gift_profitability(name)` — collection profitability analysis.

⛔ **DEPRECATED**: `scan_arbitrage()` — DO NOT USE. Use `scan_real_arbitrage()`.

## 🧠 Analysis chains (Smart Valuation)

### 📈 Chain "FIND PROFIT" (main one for autonomous agents)

1. `find_underpriced_gifts(collection, max_price)` → returns `discount%` + `fair_value`.
2. If `discount > 15%` → `buy_market_gift()` (if `can_buy_now=true`).
3. If `discount 10-15%` → `notify_rich()` with details for manual purchase.

### 📊 Chain "ANALYZE COLLECTION" (before buying)

1. `get_price_history(name)` — trend: rising → buy, falling → wait.
2. `get_attribute_volumes(name)` — which backdrops/models are liquid.
3. `get_backdrop_floors(name)` — price per backdrop → know fair value.
4. `get_collection_offers(name)` — guaranteed buyers (exit strategy).
5. `get_market_activity(gift=name, type='buy')` — who's buying right now.

### 🔄 Chain "ARBITRAGE" (cross-market)

1. `scan_real_arbitrage()` — spreads between markets.
2. `get_gift_aggregator(name, to_price)` — confirm live price on cheap market.
3. `get_collection_offers(name)` — confirm sell price (buy offers).
4. If `spread > 8%` AND offer confirmed → `buy_market_gift()`.

### 🌍 Chain "MARKET OVERVIEW" (monitoring)

1. `get_collections_marketcap()` — biggest collections.
2. `get_market_health()` — greed/health → buy or sell now?
3. `get_top_deals()` — best deals across ALL collections.
4. `get_market_activity(type='buy')` — realtime buys → where the demand is.

### 🛒 Buy flow (autonomous agents)

1. `find_underpriced_gifts(collection, max_price)` — find the best item.
   OR `get_gift_aggregator(name, to_price=MAX_PRICE)` — cheapest one.
2. If `can_buy_now=true` → `buy_market_gift(tx_contract, tx_payload, price_ton, gift_name)`.
3. If `can_buy_now=false` → `notify_rich()` with link for manual purchase.
4. If nothing found → finish silently.
