# TON Agent Platform — STON.fi Vibe Coding Hackathon, Wave 2

**Cohort:** Vibe Coding Hackathon Cohort 2 (June 2026)
**Submission deadline:** 8 June 2026, **09:00 UTC**
**Pitch day:** 8 June 2026, 15:00 UTC (we submit in writing, no live pitch)
**Team:** spend $ + @uheartattack
**Submission form:** https://identityhub.app/contests/stonfi-vibecoding-hackathon-cohort-2/submit?trackId=cmp59nxuw01fo01ntoxddo7iq
**Live URL:** https://tonagentplatform.com
**Repo (public):** https://github.com/uheartattack/TonAgentPlatform
**Telegram:** [@TonAgentPlatformBot](https://t.me/TonAgentPlatformBot)

---

## TL;DR

**TON Agent Platform** lets anyone build a 24/7 autonomous AI agent for TON
without writing code — through a Telegram bot or the web Studio. Agents can
chat, trade on STON.fi, send/receive TON, watch NFT floors, and now —
**bridge stablecoins across chains** via STON.fi Omniston.

For Wave 2 we built an **AI-callable Omniston cross-chain layer**. Any
agent in our marketplace can quote a USDT/USDC/pUSD swap between TON,
Polygon, Base, Ethereum and BNB Chain, prepare a TonConnect / EVM
payload for the user to sign, and report the result back in chat.

---

## The problem

Cross-chain DeFi today requires:

1. Knowing where the asset lives (chain + token contract).
2. Picking the right bridge / aggregator.
3. Connecting two wallets and signing two transactions.
4. Watching the swap status manually.

Each of those is a friction point that keeps non-technical TON users
inside TON. STON.fi Omniston removes the bridge plumbing, but it still
requires a UI. We thought: what if you didn't need a UI at all — you
just *told an agent* what you want?

## What we built

We added Omniston as **a first-class capability** in our existing
agent runtime. Three tools end up in the agent's tool list:

| Tool                       | Purpose                                                                          |
|----------------------------|----------------------------------------------------------------------------------|
| `omniston_routes`          | List supported cross-chain pairs (TON ↔ Polygon/Base/Ethereum/BNB stables)       |
| `omniston_quote`           | RFQ over Omniston WebSocket — get output amount, rate, validUntil                |
| `omniston_bridge_prepare`  | Build a TonConnect payload (TON-side) or EVM transaction request (other side)   |

When an agent's system prompt sees the capability, it can plan a
conversation like:

> User: «Закинь 100 USDC с Base на TON»
> Agent → `omniston_routes` → confirms the pair is live
> Agent → `omniston_quote(from: base:usdc, to: ton:usdt, amount: 100)`
> Agent: «Получишь ≈99.8 USDT (rate 0.998), валидно 30s. Продолжить?»
> User: «Да»
> Agent → `omniston_bridge_prepare(...)` → returns `evmTransactionRequest`
> Frontend hands the payload to MetaMask → user signs → swap settles

**No platform-held keys.** We only build the payload; the user signs in
their own wallet (TonConnect for TON, MetaMask/WalletConnect for EVM).

## How it works (architecture)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Web Studio  /  Telegram bot                                          │
│                                                                      │
│        ▲ chat (intent: "bridge 100 USDC base → ton")                 │
│        │                                                             │
│        ▼                                                             │
│ ai-agent-runtime.ts                                                  │
│  ├── tool selection (RAG + capability filter)                        │
│  └── routes "omniston_*" call to ──┐                                 │
│                                    │                                 │
│  ┌─────────────────────────────────▼──────────────────────────────┐  │
│  │ services/omniston.ts                                          │  │
│  │   resolveAsset(query)        ← "base:usdc" / "USDC base"      │  │
│  │   quoteCrossChain(input)     ← RFQ over WebSocket             │  │
│  │   prepareBridgePayload(...)  ← TonConnect / EVM tx request    │  │
│  │   pingOmniston()             ← health check                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                    │                                 │
│                                    ▼                                 │
│                 wss://omni-ws.ston.fi  (or sandbox)                  │
│                          │                                           │
│                          ▼                                           │
│                STON.fi Omniston resolvers                            │
└──────────────────────────────────────────────────────────────────────┘
```

Key files:

- [`apps/builder-bot/src/services/omniston.ts`](apps/builder-bot/src/services/omniston.ts) — Omniston wrapper (asset registry, quote, prepare, ping).
- [`apps/builder-bot/src/agents/tools/tool-definitions.ts`](apps/builder-bot/src/agents/tools/tool-definitions.ts) — tool schemas exposed to the LLM.
- [`apps/builder-bot/src/agents/ai-agent-runtime.ts`](apps/builder-bot/src/agents/ai-agent-runtime.ts) — `case 'omniston_quote' | 'omniston_routes' | 'omniston_bridge_prepare'` handlers.

## Supported routes today

```
TON           USDT (jetton EQCxE6mU…)
Base          USDC  (0x833589fC…)
Polygon       pUSD  (0x8B2f7Ae8…)
Ethereum      USDT  (0xdAC17F95…)
BNB Chain     USDT  (0x55d39832…)
```

We register both directions for every cross-chain pair (`listSupportedRoutes`
returns 20+ routes). Resolvers on Omniston decide which can be quoted at
any given moment.

## What was already there (STON.fi same-chain)

Before this hackathon we already shipped 7 STON.fi DEX tools that operate
**inside TON**: `stonfi_swap_quote`, `stonfi_swap_execute`, `stonfi_assets`,
`stonfi_price`, `stonfi_search`, `stonfi_trending`, `stonfi_pools`. They
are still in the agent toolset — Omniston complements them for
cross-chain flows, not replaces them.

## Hackathon scope (what's new since Kickoff, 4 June)

- New file: `apps/builder-bot/src/services/omniston.ts` (350 LOC).
- New deps: `@ston-fi/omniston-sdk@^0.8.3`, `rxjs@^7.8.1`.
- New tools: `omniston_routes`, `omniston_quote`, `omniston_bridge_prepare`.
- New runtime cases in `ai-agent-runtime.ts`.
- Agents get the capability via `omniston` capability slot in role profiles.
- `OMNISTON_SANDBOX=1` env toggle for sandbox vs production WebSocket.

## How to try

1. **Web:** [https://tonagentplatform.com](https://tonagentplatform.com) → log in via Telegram → Studio → open AI Assistant → ask it to bridge stablecoins.
2. **Bot:** [@TonAgentPlatformBot](https://t.me/TonAgentPlatformBot) → `/start` → talk in plain language.

## Tech stack

- **Backend**: Node 20 + TypeScript (`ts-node --transpile-only` in prod)
- **Bot**: Telegram Bot API (Telegraf), runs under PM2 (`ton-agent-bot`)
- **Web**: Static HTML/CSS/JS Studio on nginx
- **Database**: PostgreSQL 15 (Docker container `ton-agent-postgres`)
- **AI providers**: 7 (Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, OpenRouter, Together)
- **On-chain**: `@ton/ton`, `@ton/core` for TON; `@ston-fi/sdk` + `@ston-fi/api` for same-chain DEX; `@ston-fi/omniston-sdk` for cross-chain.
- **TonConnect** for user-side TON signing; MetaMask / WalletConnect for EVM.

## Demo

Video and live URL submitted via the contest form.

## Submission checklist

- [x] Functional app with TON integration (live, bot + Studio)
- [x] STON.fi track deliverable — Omniston cross-chain agent tools, dated
      4–8 June commits (not a pre-existing repo)
- [x] Public GitHub repo: https://github.com/uheartattack/TonAgentPlatform
- [x] Live production URL: https://tonagentplatform.com
- [x] Written project description (this file, English)
- [ ] **Demo video 60–90 s** (mainnet, small amount, English subtitles)
- [ ] **Submit the contest form** before 8 June 09:00 UTC
- [ ] (optional) X/Twitter post tagging `@ston_fi`
      — `#VibeCodingWithSTONfi #TONBuilders #HackathonLife`
- [ ] (optional) Mira track — promo clip via Seedance/Mira = second prize shot

## License

Source closed for now; will be open-sourced post-judging.
