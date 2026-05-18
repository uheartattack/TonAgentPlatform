---
name: telegram-stars
description: Telegram Stars balance, transfers, and gift-purchase flows. Use when the user asks about their Stars balance, sending Stars, gifting Stars, buying Telegram Premium with Stars, or topping up Stars. Read BEFORE picking a tool — Stars are NOT TON. Conversion rates and tools differ.
license: Proprietary. TON Agent Platform.
compatibility: Requires `telegram_premium` capability. Some ops require GramJS session (/tglogin).
metadata:
  category: telegram
  version: "1.0"
---

# Telegram Stars

## What Stars are (and aren't)

- Stars are Telegram's internal currency, separate from TON.
- Buy Stars: via Telegram in-app (iOS/Android/Premium subscription).
- Use Stars to: tip channels, upgrade gifts, buy in-app stickers.
- ❌ Cannot withdraw Stars to TON directly. Some bots offer it via off-chain
  swaps — those are scams unless verified.

## Tool selection

- `get_stars_balance(userId)` — current Stars balance for an authed user.
- `tg_apply_boost(channel, amount)` — boost a channel with Stars.
- `gift_upgrade_with_stars(gift_id)` — promote a gift from PRE-MARKET to NFT
  (consumes Stars, makes it tradeable on Fragment/GetGems).

## Pricing context

When a user asks "is this gift cheap?" and you see a Stars price (e.g. 50k Stars),
do NOT convert to TON for arbitrage purposes — Stars and TON prices reflect
different demand pools. Stars prices are for upgrades only. For TRADING,
always work in TON via the `gifts` skill.

## Failure modes

- Stars balance check requires user auth. If `isAuthorized(userId) === false`,
  tell user to run `/tglogin` first.
- Upgrade ops are PER-GIFT — you upgrade one specific instance, then it gets
  a sequence number (#1, #2...). Number assignment is server-side, can't predict.
