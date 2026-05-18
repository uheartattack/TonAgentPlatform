---
name: defi
description: TON DeFi — DEX swaps, price quotes, and on-chain arbitrage via STON.fi and DeDust. Use when the user asks about token prices (jetton/USDT/TON), swap quotes, liquidity pools, slippage, or running a swap on TON. Read BEFORE picking a DEX tool — STON.fi and DeDust have different quote/execute calling conventions.
license: Proprietary. TON Agent Platform.
compatibility: Requires the `defi` or `stonfi` capabilities.
metadata:
  category: trading
  version: "1.0"
---

# TON DeFi — STON.fi + DeDust

## Tool selection by intent

| User intent             | Best tool                                        |
| ----------------------- | ------------------------------------------------ |
| Price quote (any DEX)   | `dex_get_prices`                                 |
| Swap quote STON.fi      | `stonfi_swap_quote` or `stonfi_quote`            |
| Swap quote DeDust       | `dedust_quote`                                   |
| Compare both            | `dex_swap_simulate`                              |
| Execute STON.fi swap    | `stonfi_swap_execute` (requires user confirmation) |
| Execute DeDust swap     | `dedust_swap` (requires user confirmation)       |
| List tokens / search    | `stonfi_search`, `stonfi_assets`                 |
| Trending / hot          | `stonfi_trending`                                |
| Pool details            | `stonfi_pools`, `dedust_pools`                   |

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
