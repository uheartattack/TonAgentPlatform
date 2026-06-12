---
name: agentic-wallets
description: TON Agentic Wallets — self-custody multisig wallets for autonomous AI agents. Use when the user wants to create a separate wallet just for their agent (not their personal one), or asks about safe agent funding, withdrawal limits, agent wallet permissions, master-key control, sub-wallet management. This is the OFFICIAL TON Foundation standard (agents.ton.org) for agent self-custody. Read BEFORE picking tools — the security model has strict invariants you cannot bypass.
license: Proprietary. TON Agent Platform. Integrates official @ton/mcp SDK.
compatibility: Requires `@ton/mcp` MCP server registered. User must have a root wallet (master key) configured. Agent gets a sub-wallet (operator key only).
metadata:
  category: blockchain
  version: "1.0"
  upstream: https://agents.ton.org/
---

# TON Agentic Wallets

## The big idea

Agentic Wallets are **self-custody multisig** designed specifically for AI agents:

- **Master key** → held by the user. Can fund, withdraw, freeze, or revoke at any time.
- **Operator key** → held by the agent. Can only execute transactions within
  the limits the user set (daily spend cap, allowed destinations, etc.).
- **On-chain enforcement** → all rules live in the contract, not in trust.

This means: **the user can never lose control** even if the agent goes rogue
or its key leaks. Worst-case the agent drains UP TO the daily limit and the
user freezes it.

This is the OFFICIAL standard from TON Foundation — docs at **agents.ton.org**.

## When this skill applies

- "Create a wallet just for this agent"
- "How do I fund my agent safely"
- "Limit how much my agent can spend per day"
- "Freeze my agent's funds"
- "Revoke my agent's wallet access"
- "What's the difference between agentic and a regular wallet"

If the user just wants to send TON or check balance with their PERSONAL
wallet — use the `ton-wallet` skill instead. This skill is specifically for
the agent-owned sub-wallet model.

## Tool selection

- `agentic_wallet_create(name)` — create a fresh sub-wallet for this agent
- `agentic_wallet_info()` — current agent's sub-wallet status + balance + limits
- `agentic_wallet_send(to, amount, memo?)` — send from sub-wallet (operator key)
- `agentic_wallet_set_limit(daily_ton)` — owner-only: change daily cap
- `agentic_wallet_freeze()` — owner-only: lock sub-wallet
- `agentic_wallet_revoke()` — owner-only: destroy sub-wallet, return funds

## Architecture

```
User                                            Agent
 │                                                │
 │  master key (signs critical ops)               │  operator key (daily ops)
 │                                                │
 ▼                                                ▼
 ┌──────────────────────────┐         ┌──────────────────────────┐
 │   Root wallet (V4R2)     │ ◀────── │  Sub-wallet (NFT-based)  │
 │   • holds main balance   │  send   │  • funded by root        │
 │   • mints sub-wallets    │  funds  │  • limited to daily cap  │
 │   • can freeze/revoke    │ ─────▶  │  • can be frozen on-chain│
 └──────────────────────────┘         └──────────────────────────┘
```

Every sub-wallet is an NFT — minted from the root wallet contract. Owner
of the NFT controls the master operations.

## Security invariants (NEVER violate)

1. **The agent NEVER touches the master key.** The master mnemonic is stored
   encrypted under the user's account; the agent runtime cannot decrypt it.
2. **Daily spend cap is on-chain.** Don't try to bypass via multiple small
   transactions — the contract tracks cumulative spend per UTC day.
3. **Freeze takes effect at the next block.** Within ~10 seconds of the user
   calling freeze, no more outgoing tx can be signed by the operator key.
4. **Revoke returns all funds to root.** If revoked mid-task, in-flight tx
   may still go through but new ones will bounce.

## Common flows

### Set up a fresh agent with $50 TON budget
```
1. agentic_wallet_create("trading-bot-2026")           ← creates NFT sub-wallet
2. (user funds it from their root wallet, e.g. 50 TON via Studio UI)
3. agentic_wallet_set_limit(10)                        ← max 10 TON/day spending
4. agent starts using agentic_wallet_send() for all ops
```

### Freeze an agent that's misbehaving
```
1. User clicks "Freeze" in Studio
2. agentic_wallet_freeze() → tx signed with master key
3. Within 10s: operator key can no longer sign sends
4. User reviews logs, either revokes or unfreezes
```

### Daily-limit safety
```
agent calls agentic_wallet_send(to=X, amount=15) but daily cap is 10:
→ Contract rejects. Tx bounces with exit_code=403 ("daily_limit_exceeded")
→ Agent should: log the rejection, notify owner, do NOT retry until next UTC day
```

## Integration details

- We use the official `@ton/mcp@alpha` SDK via MCP transport (stdio).
- The MCP server runs as a child process and exposes wallet tools.
- Sub-wallet ops route through `ton-mcp-client.ts` in our service layer.
- All mnemonic encryption uses AES-256-GCM with `WALLET_ENCRYPTION_KEY` env.
- Falls back to legacy V4R2 wallet if agentic isn't configured (graceful).

## See also

- `ton-wallet` skill — personal (user-owned) wallet ops
- `defi` skill — swaps + DEX (use agentic wallet as the signer for safety)
- `web3-monitor` skill — monitor on-chain activity (e.g. detect freeze events)
- [agents.ton.org](https://agents.ton.org/) — official spec + reference dashboard
