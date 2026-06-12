---
name: ton-wallet
description: TON wallet operations — balance checks, address lookup, sending TON / jettons, and safe transaction practices. Use this when the user asks about their wallet, balance, sending TON, transferring tokens, or any wallet-level action. Read BEFORE choosing tools — mnemonic handling rules in this skill are MANDATORY and not optional.
license: Proprietary. TON Agent Platform.
compatibility: Requires `ton-wallet` capability. Mnemonic operations require WALLET_MNEMONIC in agent config, never in prompts.
metadata:
  category: blockchain
  version: "1.0"
---

# TON Wallet Operations

## 🔒 Security rules — NON-NEGOTIABLE

1. **NEVER quote a mnemonic in any output** — not in `notify()`, not in
   `tg_send_message`, not in logs. If a user asks "what's my mnemonic", refuse
   and direct them to Studio → Wallet → Export.
2. **NEVER write mnemonic to `agent_state` or `knowledge_save`** — those are
   not safe storage. Mnemonics live in `WALLET_MNEMONIC` env-injected config.
3. **NEVER paste a mnemonic into a tool argument** other than the explicit
   wallet ops that need it (`send_ton`, `list_gift_for_sale`).
4. If a user PASTES a mnemonic in chat → respond: "I'm not going to keep that
   in our conversation. Please rotate it via Studio → Wallet → Re-import."

## Read-only operations (no signing)

- `get_agent_wallet()` — current address + balance.
- `get_ton_balance(addr)` — any TON address.
- `ton_get_account(addr)` — full account info via TonAPI.
- `ton_get_jettons(addr)` — jetton balances.
- `ton_get_transactions(addr, limit)` — recent txs.

## Sending TON

```
send_ton(to: string, amount_ton: number, memo?: string)
```

- `amount_ton` is in TON, not nano. Internally converts to nano.
- `memo` becomes the transaction comment (forwarded as text payload).
- **Always** ask user confirmation for `amount > 1 TON` via `ask_user_confirmation`.
- **Always** check balance first with `get_agent_wallet` — don't try and fail.
- **Always** check `daily_spend_limit_ton` in agent config.

## Sending jettons

For jetton transfers, the address calculation differs (must derive jetton wallet
address from `master_address` + `owner_address`).

Prefer the dedicated DEX tools (`stonfi_swap_execute` / `dedust_swap`) over
raw jetton transfers — they handle the wallet derivation correctly.

## Address parsing

- TON addresses come in two formats: bouncable EQ (`EQAo92DY...`) and raw
  (`0:9dd1dfc2...`).
- TonAPI accepts both, but some tools expect raw — use `ton_parse_address(addr)`
  to normalize first.

## High-value transaction confirmation

For any send > `HIGH_VALUE_TX_LIMIT_TON` (default 100 TON), the runtime ALWAYS
requires user confirmation via the human-in-the-loop flow. Don't bypass — that
threshold is set per-deployment for a reason.

## Common failure modes

- Insufficient TON for gas: explain to the user, don't auto-top-up.
- Wallet not initialized: `get_agent_wallet` returns address `EQ...` but no
  balance — wallet has never received TON. Tell the user to fund it first.
- Wrong network (testnet vs mainnet): all agent wallets are MAINNET. If a
  user supplies a testnet address, refuse the operation.
