---
name: ton-blockchain
description: TON blockchain runtime context — architecture, message model, gas economics, standards (TIPs), and ecosystem references. Use when the user asks general questions about how TON works, what TVM is, message bouncing, jetton standards (TEP-74), NFT standards (TEP-62/64), or needs context BEFORE writing any contract. Read this BEFORE writing onchain code or explaining transaction behavior.
license: Adapted from https://github.com/ton-blockchain/acton-contracts (Apache 2.0)
compatibility: Pure documentation skill. No runtime requirements.
metadata:
  category: ton-dev
  version: "1.0"
  upstream: https://docs.ton.org/
---

# TON Blockchain — Runtime Context

## Architecture in one paragraph

TON is a sharded blockchain with **TVM (TON Virtual Machine)** running stack-based
bytecode. Every account is a **smart contract** — even "wallets" are contracts.
Communication between contracts is by **asynchronous internal messages** — no
synchronous calls, no shared state. State lives in the contract's **data cell**
(persistent storage).

## Message model — UNDERSTAND THIS

Two message types:

- **External**: from "outside" the chain (user wallet signing a transaction).
  Validated by the recipient contract.
- **Internal**: from another contract. Carries TON, has source/dest addresses.

When you send TON, you're really sending an **internal message** with a `value`
field. The recipient contract decides what to do.

### Bounce semantics

- `bounce = true` (default for internal messages): if the recipient fails,
  funds return.
- `bounce = false`: fire-and-forget. Use ONLY for known-good transfers
  (e.g. to a fully-initialized wallet). Funds lost if recipient throws.

When writing contracts, ALWAYS check `(flags & 1) != 0` (bounced message) and
handle the refund case explicitly.

## Gas economics

- Every TVM instruction costs gas. Fees paid in nanoTON.
- **Forward fee**: covers carrying the message to the recipient shard.
- **Storage fee**: contracts accrue debt over time based on data size + age.
  Pay periodically (e.g. via wallet top-ups) or contract becomes "frozen".
- **Gas limit per tx**: ~1M units typical. Hot contracts (jetton master,
  DEX pools) bump this to 10M+.

## Standards (TIPs / TEPs)

| Standard | What it defines           | Reference                   |
| -------- | ------------------------- | --------------------------- |
| TEP-62   | NFT (basic)               | docs.ton.org/dev/dapps/nft  |
| TEP-64   | NFT metadata              | docs.ton.org/dev/dapps/nft  |
| TEP-66   | NFT royalties             | docs.ton.org/dev/dapps/nft  |
| TEP-74   | Jetton (fungible)         | docs.ton.org/dev/dapps/jetton |
| TEP-89   | Discoverable jettons      | github.com/ton-blockchain   |
| TEP-100  | Wallet contract interface | github.com/ton-blockchain   |

When implementing, START from the standard — don't invent a new opcode if
TEP-74 already defines `0x0f8a7ea5` (transfer) for it.

## Address formats

| Form                        | Use for                              |
| --------------------------- | ------------------------------------ |
| Raw `0:<hex32>`             | Internal contract logic, TonAPI raw  |
| User-friendly `EQ...`       | Display, bouncable                   |
| User-friendly `UQ...`       | Display, non-bouncable               |
| testnet prefix `kQ`/`0Q`    | Testnet equivalents                  |

Don't hand-convert. Use `ton-parse-address` (or the equivalent in your SDK).

## TVM gotchas

1. **Stack-based**: too many locals = stack overflow. Keep functions short.
2. **No floating-point**: use integer math with fixed-point scaling
   (e.g. TON amounts in nanoTON × 10⁹).
3. **No mutable globals**: storage is the only mutable state. Reads + writes
   happen via `getContractData()` / `setContractData()`.
4. **Action phase**: messages emitted during execution don't fire until the
   action phase at the end. You can't read your own emitted message back.
5. **Exit codes**: 0 = success, anything else = revert. Custom errors should
   use codes ≥ 256 (lower codes are TVM-reserved).

## Common contract patterns

- **Wallet**: holds TON + signs outgoing messages (W5 is current standard).
- **Jetton master**: mints + tracks supply.
- **Jetton wallet**: per-user balance shard.
- **NFT collection**: deploys per-item NFT contracts.
- **NFT item**: holds metadata + owner.
- **DEX pool**: holds liquidity, processes swaps.
- **Multisig**: requires N-of-M signatures to execute actions.

Each pattern has reference implementations in the official TON repos. Don't
reinvent — fork, audit, adapt.

## Wallet versions cheat sheet

| Version | When to use                      |
| ------- | -------------------------------- |
| V3      | Legacy, deprecated.              |
| V4      | Long-lived, has plugin support.  |
| V5 (W5) | Current, gas-efficient, batches. |

User wallets in production are usually V4 or W5. Agent wallets in TAP use
V4 (`WalletContractV4` from `@ton/ton`).

## See also

- `acton` skill — toolkit + CLI.
- `tolk` skill — modern contract language.
- `func2tolk` skill — migration guide.
- `ton-wallet` skill — runtime wallet ops.
