# Changelog

All notable changes to TON Agent Platform are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.2.0] — 2026-05-18 — "Skills Release"

The biggest architecture update since launch. TAP joins the **Agent Skills
Compatible** runtime line — alongside Claude Code, Cursor, GitHub Copilot,
Goose, OpenHands and 25+ other products.

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
  Adapted from `learn-claude-code` session 3.
- **Skill safety scanner** — detects prompt-injection signatures,
  credential leaks, code-execution patterns, data-exfiltration intent
  in skill bodies. HIGH-severity matches block publishing.
- **URL whitelist for skill imports** — only `raw.githubusercontent.com`,
  `gist.githubusercontent.com`, `agentskills.io`, `cdn.jsdelivr.net`.
- **Studio Skills tab** — list view with built-in/mine/public filters,
  per-agent enable/disable, markdown editor for creation, import-from-URL.
- **Studio Skills sub-tab** in agent settings (per-agent toggle UI).
- **`CLAUDE.md`** — orientation file for future Claude Code sessions.

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
