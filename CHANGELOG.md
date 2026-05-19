# Changelog

All notable changes to TON Agent Platform are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.1] — 2026-05-19 — "MCP & Edit-with-AI"

### Added
- **MCP server management UI** — `mcp_servers` + `agent_mcp_servers` tables,
  full CRUD via REST (`GET/POST/DELETE /api/mcp-servers`, `POST
  /api/mcp-servers/:id/test`, `GET /api/mcp-servers/:id/tools`). Studio gets
  a top-level "MCP Servers" page + per-agent "MCP" tab to enable/disable
  user-added servers. Tools from enabled servers are appended to that
  agent's tool schema at tick time.
- **Auto-reconnect on boot** — every `status='connected'` row is rehydrated
  through `mcp-client.ts`. Failures flip `status='error'` with the message
  cached in `last_error` so the user sees it in the UI.
- **Edit with AI** — `POST /api/agents/:id/edit-with-ai` rewrites a
  field (`code` = Soul / system prompt, or `description`) per a
  natural-language instruction using the same Gemini fallback chain as
  Atlas. UI: button on the Soul tab → modal → side-by-side diff → Apply.

### Security
- MCP URL validator: localhost, private IPs (RFC 1918), link-local,
  metadata endpoints, ULA/IPv6-loopback rejected before connect.
- MCP bearer tokens encrypted at rest (AES-256-GCM, same key resolver as
  wallet mnemonics) and never returned in list responses.

---

## [2.3.0] — 2026-05-19 — "Memory & Coordination"

The cognition stack. Agents now remember things across sessions, talk to each
other through durable mailboxes, schedule themselves into the future, pick up
work autonomously, take TON payments directly, and route every tool call
through a rate-limited audit gateway.

### Added
- **Hybrid RAG memory** — `agent_memory_vec` table with Gemini
  `text-embedding-004` (768d) vectors + Postgres `tsvector` FTS + RRF
  fusion (k=60). New tools: `remember_hybrid`, `recall_hybrid`,
  `memory_count_hybrid`. Cosine similarity computed in JS (no `pgvector`
  required) — fine up to ~5K memories per agent.
- **Auto context compression** — when message log exceeds 30 entries or
  estimated 60K tokens, the runtime LLM-summarizes the older half and
  replaces it with a compact recap block. Hard 100K token emergency trim
  still in place. Plus a per-iteration micro layer that strips large
  tool-result bodies once the iteration is finished.
- **Durable mailboxes** — `agent_mailbox` table for inter-agent messages
  that survive restart. Tools: `mailbox_send(toAgentId, subject, body)`,
  `mailbox_read(limit)`. Read pointer per agent, unread index.
- **Background task daemon** — `bg_schedule(at, action)` and `bg_list()`
  tools. Two run modes per job: (a) wake the agent with a synthetic
  message at the target time, or (b) execute a tool directly. Queue
  persisted in `agent_state._bg_jobs`, hydrated on boot, ticks every 30s.
- **Autonomous task claiming** — agents with
  `trigger_config.config.autonomous = true` poll `agent_task_graph`
  every 60s for actionable tasks (pending + no blockers), claim atomically
  (UPDATE ... WHERE status='pending'), and wake themselves with a
  synthetic "take task #N" message. Max 3 parallel claims per agent.
- **TON Pay invoices** — `services/ton-pay.ts` generates `ton://transfer`
  URLs with unique memo, then verifies on-chain via TonAPI. 15-minute TTL,
  99% amount tolerance (gas absorption). API endpoints:
  `POST /api/skills/:name/buy`, `GET /api/skills/purchases/:invoiceId`,
  `GET /api/me/purchases`. `skill_purchases` table records every paid
  install.
- **Tool Gateway** — `services/tool-gateway.ts` middleware: per-(agent,
  tool) sliding-window rate limits, prompt-injection scan on high-risk
  tool args (`send_ton`, `buy_market_gift`, `mailbox_send`, etc.),
  fire-and-forget audit log to `agent_audit_log`. `gatewayInvoke()`
  wrapper combines all three.

### Changed
- Schema: 4 new tables (`agent_memory_vec`, `agent_transcripts`,
  `agent_mailbox`, `skill_purchases`) — all created idempotently in
  `ensureBetaSchemaExtensions()` at boot.

### Fixed
- PM2 process recovery procedure persisted via `pm2 save` so the bot
  comes back automatically on server reboot.
- Atlas fallback chain expanded to 6 different Gemini families to avoid
  all-3-models-429-from-same-quota lockup.

---

## [2.2.0] — 2026-05-18 — "Skills Release"

The biggest architecture update since launch. TAP joins the **Agent Skills
Compatible** runtime line — full agentskills.io spec support with progressive
disclosure, safety scanner, and 12 built-in skills.

### Added
- **Agent Skills runtime** — full [agentskills.io](https://agentskills.io)
  specification support: progressive disclosure (metadata → activation →
  resources), per-agent toggle, marketplace publishing, GitHub URL import,
  prompt-injection safety scanner.
- **12 built-in skills**: `gifts`, `nft`, `defi`, `ton-wallet`, `fragment`,
  `telegram-stars`, `web3-monitor`, `agentic-wallets` (runtime) +
  `acton`, `tolk`, `func2tolk`, `ton-blockchain` (TON dev tooling per
  the Acton standard).
- **Agentic Wallets** ([agents.ton.org](https://agents.ton.org)) — official
  TON Foundation standard via `@ton/mcp@alpha`. Master-key (user) +
  operator-key (agent) separation, on-chain freeze/revoke, daily spend
  limits enforced by smart contract.
- **TON DNS write operations** — 5 new tools: `dns_bid`, `dns_start_auction`,
  `dns_link`, `dns_unlink`, `dns_set_site`. Agents can now participate in
  `.ton` domain auctions and manage resolver records.
- **Self-awareness expansion** — system prompt now intrinsically knows
  enabled skills, plugin list, active goals, recent lessons, MCP servers
  connected, wallet balance, 24h tick stats, auto-pause counters.
- **`get_my_full_state` tool** — deep agent introspection on demand
  (returns identity + config + capabilities + skills + wallet + plugins +
  goals + lessons + MCP + stats + pause status, secrets masked).
- **TodoWrite mechanism** — in-memory checklist with FSM constraint
  (only one `in_progress`) + nag reminder after 3 rounds without updates.
- **Skill safety scanner** — detects prompt-injection signatures,
  credential leaks, code-execution patterns, data-exfiltration intent
  in skill bodies. HIGH-severity matches block publishing.
- **URL whitelist for skill imports** — only `raw.githubusercontent.com`,
  `gist.githubusercontent.com`, `agentskills.io`, `cdn.jsdelivr.net`.
- **Studio Skills tab** — list view with built-in/mine/public filters,
  per-agent enable/disable, markdown editor for creation, import-from-URL.
- **Studio Skills sub-tab** in agent settings (per-agent toggle UI).

### Changed
- AI provider 401 / 402 / 429 / 413 errors now auto-pause agents after
  N consecutive failures (NO_API_KEY=1, others=3). Counters persist in
  `agent_state` and wipe on success.
- Free-tier `MAX_TOOLS` is now capped to the provider's known-safe limit
  (Groq=15, OpenRouter=40, etc.). Users can opt in to higher caps via
  `PROVIDER_TIER='paid'` config.
- Default wallet creation flow tries MCP-based agentic wallet first;
  legacy V4R2 only as fallback when MCP unreachable.
- Studio theme: electric-blue `#00a8ff` + purple `#8b5cf6` palette;
  legacy TON-blue `#0098EA` removed from 13 hardcoded references.
- Logo replaced everywhere in Studio (auth screen, sidebar, onboarding).
- Database schema: new tables `builder_bot.skills` (user-authored)
  and `builder_bot.agent_skills` (per-agent enable/disable).

### Fixed
- Agent `#246` and `#272`-class spam loops (Groq 401/429) now auto-pause
  within 3 ticks instead of running indefinitely.
- TS-narrowing issue on discriminated unions in skill-registry
  (`validateSkill` return type).
- userIdStr precision: 19-digit OIDC sub IDs no longer truncated to
  JS Number precision (was breaking display as `7698131116661179000`).
- TOS popup persists in `localStorage` — no longer re-appears on F5.

### Removed
- Legacy `fix198.js`, `fix-emoji.py`, `init-schema.sql` (duplicate),
  `logo.gif`, `logo.jpg`, `TON_Agent_Platform_Checklist.docx`,
  `generate-checklist.js` cleanup.
- `GIFT_SYSTEM_KNOWLEDGE` inline prompt block (~140 lines) — migrated
  to `skills/gifts/SKILL.md` with progressive disclosure.

### Security
- AES-256-GCM mnemonic encryption with `WALLET_ENCRYPTION_KEY` env
  (fallback to BOT_TOKEN-derived key with startup warning).
- Skill import URL whitelist (see "Added").
- Body safety scanner (see "Added").
- Skill name shadowing prevention: user-authored skills cannot use a name
  matching a built-in (built-in wins, prevents safety-rule bypass).

---

## [2.1.0] — 2026-04-19 — "Tester Hub"

### Added
- Tester Hub rewards: 10% gross platform revenue / 2-year pool / quarterly
  TON payouts. Multipliers: Newbie×1 → Legend×3.
- Referral system: 2-level XP bonuses (L1=20 XP, L2=5 XP) + 10% of
  referee's lifetime platform spend.
- Crons: Hall of Week (Fri 20-22 MSK), Monthly Snapshot (1st 00:00 MSK),
  Inactive Decay (every 12h), Auto-Kick (every 24h).
- Commands: `/levels`, `/rewards`, `/onboarding`, `/mystats`.

### Changed
- Premium landing redesign (glassmorphism, 3D, mesh gradients).

---

## [2.0.0] — 2026-Q1 — "Marketplace"

### Added
- Agent marketplace with publishing flow (`pendingPublish` state machine).
- 12 plugins, 22 templates.
- Studio Dashboard with 29+ settings tabs.
- Telegram Userbot (MTProto via GramJS) — agent operates as a real user.
- GiftAsset + SwiftGifts gift-market integration.
- Multi-provider AI support (7 providers with fallback).
- Voice-driven agent creation (Gemini multimodal + Whisper fallback).

---

## [0.1.0-alpha] — 2026-Q1 — Initial public alpha

First public release. Telegraf bot + basic agent runtime + PostgreSQL.

[2.2.0]: https://github.com/spendollars/TonAgentPlatform/releases/tag/v2.2.0
[2.1.0]: https://github.com/spendollars/TonAgentPlatform/releases/tag/v2.1.0
[2.0.0]: https://github.com/spendollars/TonAgentPlatform/releases/tag/v2.0.0
[0.1.0-alpha]: https://github.com/spendollars/TonAgentPlatform/releases/tag/v0.1.0-alpha
