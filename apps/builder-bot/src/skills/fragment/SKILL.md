---
name: fragment
description: Fragment.com gift floor prices and Telegram-account-authenticated operations via GramJS MTProto. Use when the user asks about Fragment gift prices, Fragment listings, or anything that needs the user's own Telegram account (e.g. fetching their gifts). Read BEFORE picking a tool — Fragment is account-gated and requires /tglogin flow.
license: Proprietary. TON Agent Platform.
compatibility: Requires GramJS session (user authenticated via /tglogin). Falls back to TonAPI for floor when MTProto is unavailable.
metadata:
  category: trading
  version: "1.0"
---

# Fragment.com Integration

## When this skill applies

- "What's the floor on Fragment for X" → Fragment floor lookup.
- "What gifts do I own on Fragment" → user-authenticated query.
- "Buy a gift on Fragment" → MTProto-authenticated transaction.

If user is asking about **collection-level** gift data without needing their
own account, prefer the `gifts` skill (uses GiftAsset/SwiftGifts APIs — no
auth required, no rate limits).

## Authentication

User must run `/tglogin` in the bot first. Two flows:

- **QR code (recommended)**: `authStartQR()` → user scans → `pollQRLogin()`
  polls every 3s for completion. Done.
- **OTP / phone**: still available but Telegram frequently blocks this for
  the same account. Use only as fallback.

Check auth state:
```
isAuthorized(userId) → boolean
```
This call has a 5s timeout. It does NOT create a new client if uninitialized
(important — silent re-auth is forbidden).

## Tool selection

- `fragment_floor(slug)` — current floor for a Fragment-listed gift.
- `fragment_user_gifts(userId)` — gifts owned by the authed user.
- `fragment_listings(slug, limit)` — active listings.
- `fragment_buy(listing_id)` — buy a listing (requires MTProto session +
  TON balance + user confirmation).

## GramJS newer API notes

Some newer APIs (`InputInvoiceStarGiftResale`, `GetResaleStarGifts`) use
`(Api as any)` and `(client as any)` casts. ts-node shows warnings but doesn't
fail at runtime.

## Failure modes

- Session expired: tell user to re-run `/tglogin`. Do NOT auto-relogin.
- Rate limited by Telegram: back off 60s, then retry. Don't spam.
- Gift not found: explain Fragment vs Telegram-Gift confusion. Fragment lists
  only a subset of all gifts — most are on GetGems/Tonnel/Portals (use `gifts`
  skill for those).
