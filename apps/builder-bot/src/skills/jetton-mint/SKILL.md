---
name: jetton-mint
description: Deploy and manage custom Jetton tokens on TON (memecoins, project tokens, reward tokens). Use when the user asks to "create a token", "deploy a coin", "make a memecoin", "mint X tokens", "launch a jetton", or to mint tokens for distribution/airdrops/rewards. Read BEFORE picking a tool — jetton creation is multi-step (deploy contract → wait → mint → optionally renounce admin) and you must confirm parameters with the user before spending gas.
license: Proprietary. TON Agent Platform.
compatibility: Requires the `jetton_mint` capability and agent wallet with ≥0.3 TON balance (mainnet) or ≥0.3 testnet TON.
metadata:
  category: trading
  version: "1.0"
---

# Jetton Mint — Deploy and manage TON tokens

## When to use this skill

User wants to:
- **Launch a memecoin / project token** ("make me a coin called X", "deploy MEMECOIN")
- **Mint tokens** for an airdrop, rewards, distribution
- **Hand off ownership** to a user (transfer admin rights)
- **Freeze supply** (renounce admin → set null address)

If user just wants to **send existing tokens** (USDT, NOT, etc.) → use `send_jetton` from the `wallet` skill, not this one.

## Tool selection by intent

| User intent                          | Tool                  |
| ------------------------------------ | --------------------- |
| Create new token                     | `jetton_deploy`       |
| Mint tokens to an address            | `jetton_mint`         |
| Transfer admin to user               | `jetton_change_admin` |
| Freeze supply forever                | `jetton_change_admin` to `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c` (null address) |

## CRITICAL workflow — always 3 phases

### Phase 1: Confirm with user BEFORE deploying

Gas cost is **~0.15 TON per deploy + 0.08 TON per mint** — not free. Always show the user:

1. **Name** (e.g. "My Meme Coin")
2. **Symbol** (e.g. "MEME" — 2-12 chars, uppercase)
3. **Decimals** (default 9 — same as TON. Memecoins almost always use 9.)
4. **Image URL** (logo, HTTPS, square 256×256+ recommended)
5. **Description** (optional but recommended)
6. **Network** — `mainnet` (real) or `testnet` (testing only)
7. **Initial mint amount** (how many tokens to mint immediately after deploy)
8. **Who gets the initial mint** (user's wallet, agent's wallet, multiple recipients)

Use `ask_user_confirmation` tool. Reject if user says no.

### Phase 2: Deploy → wait → mint

```
1. jetton_deploy({name, symbol, decimals, image, description, network})
   → returns jetton_master address. SAVE IT.
2. Wait ~30 seconds (sleep / set_next_wake) — blockchain needs to confirm.
   Or call ton_get_account on jetton_master to check status === "active".
3. jetton_mint({jetton_master, to: <recipient>, amount: <nano>, network})
   → mints to first recipient.
4. Repeat jetton_mint for each additional recipient.
```

**Amount math (CRITICAL):**
- `amount` is in **nano-units** (base 10^decimals).
- For `decimals=9`: 1 token = `"1000000000"`, 1 million = `"1000000000000000"`, 1 billion = `"1000000000000000000"`.
- For `decimals=6` (USDT-style): 1 token = `"1000000"`.
- ALWAYS pass `amount` as a **STRING** of digits — JS numbers lose precision at 2^53. NEVER `1e18` or `1_000_000_000`.

### Phase 3: Hand off OR freeze (optional but recommended for memecoins)

Memecoins typically need to **freeze supply** to build trust ("rug-proof").

```
jetton_change_admin({
  jetton_master,
  new_admin: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",  // null address
  network,
})
```

Or hand off to user so they control future mints:

```
jetton_change_admin({
  jetton_master,
  new_admin: <user's TON wallet>,
  network,
})
```

After this, the agent can no longer mint. Confirm with user before doing it.

## Network selection

- **`network: 'testnet'`** — for tests, demos, development. Free testnet TON.
- **`network: 'mainnet'`** — REAL TOKEN with REAL VALUE. Default ONLY if user explicitly asks for real launch.

**If user says "test" / "тест" / "проба"** → use testnet. Confirm explicitly.

## Token Metadata Standard

Metadata is **on-chain TEP-64 snake format** (encoded inside contract data, no external JSON hosting needed). Stored fields:

- `name` — full name (string)
- `symbol` — ticker (string, uppercase)
- `decimals` — string-encoded number ("9")
- `description` — optional text
- `image` — URL to logo (HTTPS or `data:image/...` base64)

**Image hosting tips:**
- HTTPS URL: must be publicly accessible. Cloudflare R2, GitHub raw, ImgBB all work.
- `data:image/png;base64,...` URI: embedded directly, no external dep, but contract data grows. Stay under 50KB to avoid storage fees.

## Cost summary

| Operation              | Gas (TON) | Notes                                 |
| ---------------------- | --------- | ------------------------------------- |
| `jetton_deploy`        | ~0.15     | One-time per token                    |
| `jetton_mint`          | ~0.08     | Per recipient                         |
| `jetton_change_admin`  | ~0.05     | Once at the end                       |
| `send_jetton` (transfer) | ~0.05   | Already-minted tokens between holders |

**Agent wallet needs ≥ deploy + (mints × 0.08) + 0.1 buffer.** For a typical meme launch with 1 deploy + 5 airdrop mints + freeze = ~0.6 TON minimum.

## Gotchas

1. **Symbol uniqueness:** TON does NOT enforce unique symbols. "PEPE" can exist 1000 times. The `jetton_master` address is the only true identifier — show it to users always.

2. **Initial supply = 0:** Right after deploy, supply is 0. You MUST call `jetton_mint` at least once to create tokens. Don't deploy and stop.

3. **Bounce confirmation:** Deploy uses `bounce: false` (contract doesn't exist yet). Mint uses `bounce: true` — if it bounces, the mint failed (most likely wrong admin or insufficient gas).

4. **30-second wait between deploy and first mint:** the minter contract must be in `active` state. If you mint too fast, the mint message bounces because there's no contract code yet at that address.

5. **Decimals are sticky:** can't be changed after deploy. Pick correctly upfront.

6. **Admin change is irreversible if new_admin is null address.** Confirm twice with user before renouncing.

## Example flows

### Flow A: User launches "$DOGE" memecoin on testnet

```
1. ask_user_confirmation: "Deploy DOGE token (9 decimals) on testnet, mint 1 billion to your wallet UQxxx, then freeze supply? Cost ~0.3 testnet TON."
2. jetton_deploy({name: "Doge Coin", symbol: "DOGE", decimals: 9, image: "https://example.com/doge.png", network: "testnet"})
   → jetton_master = "kQA..."
3. sleep(30)
4. jetton_mint({jetton_master: "kQA...", to: "UQxxx", amount: "1000000000000000000", network: "testnet"})  // 1 billion tokens
5. jetton_change_admin({jetton_master: "kQA...", new_admin: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", network: "testnet"})
6. notify_rich: "✅ $DOGE deployed at kQA..., 1B minted to your wallet, supply frozen. View on testnet.tonscan.org."
```

### Flow B: Reward token for community, agent keeps admin to mint future rewards

```
1. jetton_deploy({name: "Community Points", symbol: "CPT", network: "mainnet"})
2. sleep(30)
3. jetton_mint({...}) for each of 100 community members
4. // skip jetton_change_admin — agent keeps admin to mint future rewards
```

## Safety

- Refuse to deploy on mainnet without explicit user confirmation including the exact name, symbol, network.
- Refuse to mint amounts > 1e18 nano-units without confirmation (could be a typo).
- Always log the resulting `jetton_master` address to agent state under `jetton:{symbol}:master` for later reference (`jetton_deploy` does this automatically).
- After freezing admin, **double-confirm** with user — the action is permanent and cannot be undone.
