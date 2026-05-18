---
name: nft
description: TON NFT collections — pricing, holdings, sales analysis. Use when the user mentions NFT, TON Punks, TON Diamonds, Anonymous Numbers, TONXPUNKS, GetGems collections, NFT floor price, or asks about NFTs in a wallet. Read this BEFORE picking a tool — agents commonly confuse NFTs with Telegram Gifts (those use the `gifts` skill).
license: Proprietary. TON Agent Platform.
compatibility: Requires the `nft` capability and TONAPI_KEY in env.
metadata:
  category: trading
  version: "1.0"
---

# TON NFT — Collections, Floors, Holdings

## 🚨 Scope check

This skill is for **TON NFTs** (TON Punks, TON Diamonds, Anonymous Numbers, etc.).
If the user is asking about **Telegram Gifts** (Plush Pepe, Lol Pop, Heart Locket
...) → exit this skill and read `gifts` instead.

## Tool selection

- ✅ USE: `get_nft_floor`, `ton_get_nfts`, `nft_sales_history`, `nft_collection_info`
- ❌ DON'T USE: `get_gift_floor_real` (gifts only), `get_collection_offers` (gifts only)

## Data sources (in priority)

1. **TonAPI v2** (`tonapi.io/v2/nfts/collections/{raw_addr}/items`) — primary.
   Address format: requires raw `0:hex` format. Use the `eqToRaw()` helper.
2. **GetGems GraphQL** — BLOCKED for server IPs (GRAPHQL_STRANGE_QUERY error). Don't try.
3. **GetGems HTML scraping** — DOESN'T WORK (client-side rendered, no SSR).

## Verified collection addresses

```
TON Punks         → EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN
                    floor ~80 TON
TON Diamonds      → EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir
                    floor ~14 TON
Anonymous Numbers → EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N
TONXPUNKS         → 0:9dd1dfc276588412f79b64e4d659d8427d61add13014125c30133c17d3c99044
```

## Quick floor lookup

```
get_nft_floor(collection_address) → returns { floor_ton, last_sale, supply }
```

If you have the EQ address but the API needs raw — convert:
```
0:<hex> = eqToRaw(EQ_address)
```

## Holdings check

```
ton_get_nfts(owner_address) → list of NFTs owned by an address
```

Group by `collection.address` to count holdings per collection.
