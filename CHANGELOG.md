# Changelog

All notable changes to TON Agent Platform are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.5] — 2026-05-20 — "Payouts unblocked"

Hot-fix release. Studio Admin → Payouts / Withdrawals was broken end-to-end:
the owner couldn't see pending payouts, couldn't trigger Tonkeeper signing,
and user-initiated withdrawals crashed with `relation does not exist`.

### Fixed
- **`requireOwner` auth gate**: now also matches `session.telegramId`, not
  only `session.userId`. OIDC logins store userId as the OIDC sub
  (12-digit), telegramId as the real TG id — without the fallback the owner
  never authed past `/api/admin/payouts/*` even with correct `OWNER_ID`.
- **`/api/admin/withdrawals/pending` 500**: the `builder_bot.withdrawal_requests`
  table was created lazily inside POST `/api/withdraw`, so the admin GET
  hit a missing relation until any user requested a withdrawal. Table now
  pre-created on prod; DDL stays inline for fresh installs.
- **TonConnect "Подключи Tonkeeper в Профиле" toast**: admin payout/withdraw
  sign buttons read `window._tonConnect` (never set) instead of the
  module-scoped `_tonConnectUI`. Plus `_tonConnectUI` was only initialised
  when the user opened Profile; opening Admin first left it `null`. Both
  handlers now lazy-`initTonConnect()` and open the wallet-pick modal in
  place when not yet connected.

---

## [2.3.4] — 2026-05-19 — "Bot API 10.0 + Multimodal Mega"

12 new tools landed in one shot — half of them adopting fresh Telegram Bot
API 10.0 / 9.6 / 9.5 / 9.4 endpoints (May 2026 releases), half multimodal.

### Added — Multimodal
- **`image_analyze_batch(urls, prompt)`** — up to 16 images in ONE Gemini
  call. Use for NFT comparison, product picking, photo-set summarization.
  16× cheaper than 16 sequential `image_analyze` calls.
- **`video_analyze(url, prompt)`** — Gemini multimodal on mp4/webm. Returns
  scene description with time codes.
- **`chart_render(type, datasets, labels?, title?)`** — PNG charts via
  QuickChart.io (no API key required). Line / bar / pie / doughnut / radar
  / scatter / candlestick. Returns a public URL the agent can send via
  `tg_send_file`.
- **`tts_reply(text, voice?)`** — Gemini TTS. Agent replies as voice
  message. Voices: Kore (default), Puck, Charon, Aoede, Fenrir.

### Added — Telegram Bot API 10.0 (May 8, 2026)
- **`tg_send_live_photo`** — Live Photos (photo + short video, iPhone-style).
- **`tg_delete_reaction(chat_id, message_id, user_id?)`** — moderation.
- **`tg_delete_all_reactions(chat_id, message_id)`** — wipe all reactions.
- **`tg_send_to_bot(@username, text)`** — bot-to-bot messaging via username.
  Both bots must enable bot-to-bot communication.

### Added — Telegram Bot API 9.4 (Feb 9, 2026)
- **`tg_set_my_profile_photo(photo_url)`** — agent changes its own avatar.
- **`tg_remove_my_profile_photo()`** — wipe avatar.
- **`tg_get_user_profile_audios(user_id, limit?)`** — list audios from a
  user's profile (e.g. voice business card).

### Added — Telegram Bot API 9.5 (Mar 1, 2026)
- **`tg_set_chat_member_tag(chat_id, user_id, tag)`** — colored "role" tags
  for chat members (e.g. "VIP", "Модератор").

### Added — Telegram Bot API 9.6 / 10.0 (advanced polls)
- **`tg_create_poll_v2`** — advanced poll/quiz. New fields:
  `correct_option_ids` (MULTIPLE correct answers for quizzes!),
  `description`, `allows_revoting`, `shuffle_options`,
  `hide_results_until_closes`, `allow_adding_options`, `members_only`,
  `country_codes`, `open_period` (auto-close up to 30 days).

### New capability categories
- `audio` — `audio_transcribe`, `tts_reply`
- `video` — `video_analyze`
- `chart` — `chart_render`

### Files
- New: `services/multimodal-tools.ts` (4 tools)
- New: `services/bot-api-10.ts` (9 tools)
- Updated: `agents/tools/tool-definitions.ts` (+12 schemas)
- Updated: `agents/ai-agent-runtime.ts` (+12 case handlers, capability map)

---

## [2.3.3] — 2026-05-19 — "Vision, Voice & Polish"

### Added
- **`audio_transcribe` tool** — first-class agent tool for converting audio
  (URL or base64) to text. Tries Gemini multimodal first (cheap + fast),
  falls back to OpenAI Whisper. Returns `{ ok, text, provider, attempts }`
  so the agent sees WHY it failed instead of an empty string. New
  capability `audio` in `CAPABILITY_TOOL_MAP`.
- **`services/transcribe.ts`** — reusable transcribe utility. Replaces the
  inline duplicate logic in `bot.ts` voice handler and `api-server.ts`
  POST /api/voice/transcribe.

### Fixed
- **Voice transcription "tihko ne robit"** — root cause was silent fallback:
  Gemini error swallowed, then Whisper attempt re-used a Gemini key (since
  OPENAI_API_KEY on prod is actually the Gemini key) which Whisper refused.
  New service surfaces the cause (`Gemini HTTP 429 ... | Whisper: OPENAI_API_KEY
  is not a real sk- key`). User now sees a useful hint in the Telegram reply
  ("need Gemini or OpenAI key in settings") instead of a dead-end message.
- **Map cleanup misses on deactivate** — `_pendingContext`, `_agentTodos`,
  `_agentMetaCache`, `_toolRateLimits` were leaking entries for deactivated
  agents. Now properly swept by deactivate(agentId).

### Infrastructure
- **PM2 systemd hook** — `systemctl enable pm2-root` set up on prod.
  `pm2 save` persisted the current process list. Server reboot → bot
  auto-starts. Was missing since v2.0.

---

## [2.3.2] — 2026-05-19 — "Providers, Patterns & Local Memory"

Big internal upgrade. Substrate-level work that doesn't add visible new
features for end users, but unlocks meaningfully better cost, latency,
and reach.

### Added
- **9 new AI providers** (7 → 16 total): xAI Grok, Moonshot Kimi, Mistral
  AI, Cerebras, Z.AI GLM, MiniMax, HuggingFace Inference, Cocoon (TON
  decentralized), Local (Ollama/vLLM/LM Studio).
- **Single provider registry** — `src/config/provider-registry.ts` with rich
  metadata per provider: baseURL, defaultModel, utilityModel (cheap for
  housekeeping), toolLimit, maxContextChars, authHeader, envVar, keyPrefix,
  keyHint, consoleUrl. `PROVIDER_URLS`/`PROVIDER_LIMITS` in `platform.ts`
  are now derived from this.
- **OpenRouter fallback chain** — when Gemini quota is exhausted, Atlas
  chat, Edit-with-AI, and the eval helper fall over to OpenRouter free
  models (DeepSeek-v4-flash, Llama-3.3-70b, Hermes-3-405b).
- **Pluggable embedding backend** — `EMBEDDING_BACKEND=local` switches
  Hybrid RAG memory from Gemini `text-embedding-004` (768d API) to local
  ONNX `Xenova/all-MiniLM-L6-v2` (384d in-process). Zero API cost,
  offline-capable. Default stays `gemini`.
- **MCP server stdio transport** — `mcp-client.ts` can now spawn child
  processes (e.g. `npx -y @notion/mcp`) in addition to SSE. Env hardened
  (`buildSafeEnv()` whitelists PATH/HOME/USER/LANG/TZ + MCP_*, blocks
  LD_PRELOAD / NODE_OPTIONS / LD_LIBRARY_PATH injection). Tools
  auto-namespaced as `mcp_<server>_<tool>`.
- **+3 TON DNS tools** (8 → 11 total): `dns_get_my_domains` (list owned),
  `dns_get_auction` (live auction state, min next bid), `dns_transfer`
  (NFT-transfer ownership, gated by HitL confirmation).
- **s10 plan-approval HitL** — new `ask_for_plan_approval` tool. Agent
  drafts a multi-step plan, user replies `да`/`нет`/`правки: <edits>`.
  Always available via CORE_TOOLS.
- **s12 per-task DB-tx isolation** — `task_update` + auto-cascade now
  wrapped in `BEGIN`/`COMMIT`. Prevents dirty reads when concurrent
  autonomous-claim + manual-edit race on `blocked_by` arrays.
- **Claude Code leaked-architecture patterns** (4 more shipped, brings
  total to 11/16):
  - #6 token-budget diminishing-returns stop (kills stuck continuations)
  - #10 SYSTEM_PROMPT_DYNAMIC_BOUNDARY cache-split for Anthropic
    (`cache_control: ephemeral` on the static prefix)
  - #11 command priority queue (real user input ordered before
    `<task-notification>`-wrapped synthetic events)
  - #13 `<task-notification>` XML wrapper around synthetic wake-ups
    (autonomous claim, bg-tasks, mailbox) so the agent distinguishes
    them from real user messages
  - #14 auto-spawn fresh context when incoming message has <20% 4-gram
    overlap with the last user message

### Changed
- **Alphabetic sort of `tools[]`** right before every LLM API call —
  byte-stable tool block raises prompt-cache hit rate on Anthropic /
  OpenAI / OpenRouter. Cheap O(N log N) on ~60 tools per call.
- Atlas tool-error UX: when ALL models in the fallback chain fail,
  send a friendly «⏳ AI временно недоступен» chunk instead of leaking
  the raw exception (`404 status code (no body)`).

### Fixed
- **Atlas 404** — Google deprecated `gemini-1.5-flash` /
  `gemini-1.5-flash-8b`, they now return 404. Removed from fallback chain
  in both Atlas chat and Edit-with-AI. 404 / not_found now retryable.
- **`_cachedDialogs is not defined`** in UserbotMgr channel-subscription
  init — variable was const-scoped inside one try block, referenced in a
  later one. Lifted declaration.
- **TonConnect.ts** — `await res.json()` after Toncenter call without
  `res.ok` check could parse a non-2xx error body as success shape. Now
  returns `Toncenter HTTP <code>: <detail>` on failure.
- **universal-agent-chat.ts** — `new OpenAI({ apiKey })` no longer
  proceeds with an empty / <8-char apiKey; throws explicit error early.
- **`/api/feedback/:id/screenshot`** — added `requireAuth` + owner check
  (or admin via `OWNER_ID`). Previously any caller could enumerate beta
  feedback screenshots by ID.

### Security
- MCP env hardening (see Added). User MCP configs can no longer set
  `LD_PRELOAD` / `NODE_OPTIONS` etc to inject code into the parent bot.

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
