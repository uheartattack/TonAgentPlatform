---
name: defi
description: TON DeFi — same-chain DEX swaps (STON.fi + DeDust) AND CROSS-CHAIN bridges TON ↔ Ethereum / Polygon / Base / BNB via STON.fi Omniston. Use when the user asks about token prices (jetton/USDT/TON), swap quotes, liquidity pools, slippage, running a swap on TON, or moving stables BETWEEN chains (e.g. "перекинь USDC с Base на TON"). Read BEFORE picking a DEX tool — STON.fi, DeDust, and Omniston have different quote/execute calling conventions.
license: Proprietary. TON Agent Platform.
compatibility: Requires the `defi`, `stonfi`, or `omniston` capabilities.
metadata:
  category: trading
  version: "1.1"
---

# TON DeFi — STON.fi + DeDust + Omniston (cross-chain)

## Tool selection by intent

| User intent                          | Best tool                                        |
| ------------------------------------ | ------------------------------------------------ |
| Price quote (any DEX)                | `dex_get_prices`                                 |
| Swap quote STON.fi (same-chain)      | `stonfi_swap_quote` or `stonfi_quote`            |
| Swap quote DeDust (same-chain)       | `dedust_quote`                                   |
| Compare same-chain DEXes             | `dex_swap_simulate`                              |
| Execute STON.fi swap                 | `stonfi_swap_execute` (requires user confirmation) |
| Execute DeDust swap                  | `dedust_swap` (requires user confirmation)       |
| **Cross-chain quote** (TON ↔ EVM)    | **`omniston_quote`**                             |
| **Cross-chain bridge prep**          | **`omniston_bridge_prepare`** (returns wallet payload) |
| **List supported cross-chain routes**| **`omniston_routes`**                            |
| List tokens / search                 | `stonfi_search`, `stonfi_assets`                 |
| Trending / hot                       | `stonfi_trending`                                |
| Pool details                         | `stonfi_pools`, `dedust_pools`                   |

## Same-chain vs cross-chain — pick the right tool

- **Both assets on TON?** → `stonfi_swap_*` or `dedust_*`. Cheap, fast, single-tx.
- **Assets on DIFFERENT chains?** → `omniston_*`. Routes through STON.fi
  Omniston aggregator. Currently supported pairs:
  - USD₮ on TON ↔ USDC on Base
  - USD₮ on TON ↔ pUSD on Polygon
  - USD₮ on TON ↔ USD₮ on Ethereum
  - USD₮ on TON ↔ USD₮ on BNB Chain
- **Don't mix** — calling `stonfi_swap_quote(from=ton:usdt, to=polygon:pusd)` will fail. Use `omniston_quote` instead.

## Cross-chain flow (Omniston)

1. **Quote** — `omniston_quote(from, to, amount)` returns `quote_id`, output amount, valid window. Show this to the user.
2. **Confirm** with the user.
3. **Prepare** — `omniston_bridge_prepare(quote_id, owner_src_address, trader_dst_address, src_chain, dst_chain)`. Returns:
   - `tonConnectPayload` if source is TON → user signs in TonConnect.
   - `evmTransactionRequest` if source is EVM → user signs in MetaMask / WalletConnect.
4. **Hand off to UI** — Studio renders the payload as a "Sign in your wallet" CTA. We do NOT auto-sign; the user controls every bridge.

## Cross-chain safety

- Quotes are **time-limited** (~30s). If user takes long to confirm, requote.
- Sandbox endpoint: set `OMNISTON_SANDBOX=1` in env to use `wss://omni-ws-sandbox.ston.fi`. Use for testing!
- Bridge fees: covered in the quote's output amount (no surprise deduction).
- Slippage default 0.1% (`slippage_pips: 100`). For volatile windows bump to 1% (`1000`).

## STON.fi gotchas

- `/swap/simulate` requires **POST**, not GET.
- The `execute()` method detects the right endpoint by method name — don't
  hand-craft URLs.
- Price source: `/assets` endpoint (NOT `pool.stats.price` — that's stale).

## DeDust gotchas

- Token prices via `/assets` endpoint.
- `dedust_token_info(addr)` gives accurate decimals before quoting.

## Arbitrage between DEXes

Cross-DEX spread > 1% AFTER gas is profitable on TON only for sizeable orders
(>500 TON). Below that, gas (~0.3 TON per swap, two swaps = 0.6) eats it.

1. `dex_get_prices(token)` → both STON.fi + DeDust prices.
2. If spread > 1.5% → `dex_swap_simulate(from=cheap, to=expensive, amount)`
   on both legs to confirm.
3. Surface to user via `notify_rich()` — DON'T auto-execute swaps.

## Safety

- Swaps are HIGH-VALUE actions. Always require explicit user confirmation
  via `ask_user_confirmation` before `*_execute`.
- Slippage: default 1%, max 3%. If a swap quote shows >3% impact, abort
  and explain to the user.
- Daily spend limit (`daily_spend_limit_ton` in agent config) applies —
  check before executing.
