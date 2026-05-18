# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

```bash
# Dev (runs ts-node, no compile step — fastest iteration)
pnpm --filter builder-bot dev

# Build (tsc → dist/)
pnpm --filter @ton-agent/builder-bot build

# Type check without emitting (CI does this but with `|| true` — non-blocking)
pnpm --filter @ton-agent/builder-bot exec tsc --noEmit

# Tests (Jest, ts-jest)
pnpm --filter @ton-agent/builder-bot test
pnpm --filter @ton-agent/builder-bot test:watch
pnpm --filter @ton-agent/builder-bot exec jest src/__tests__/foo.test.ts   # single test file
pnpm --filter @ton-agent/builder-bot exec jest -t "test name pattern"      # by name

# Postgres (Docker)
pnpm db:up           # start ton-agent-postgres container
pnpm db:connect      # psql shell
pnpm db:migrate      # run init.sql

# Whole repo (turbo orchestrates)
pnpm dev | build | test | lint
```

Requirements: Node ≥20, pnpm ≥8, Docker (for Postgres). The `pnpm.onlyBuiltDependencies` allow-list (`isolated-vm`, `better-sqlite3`) means most native compilation is skipped.

## Production deploy (single-server)

```bash
# Server: root@***.***.***.***  (SSH key ~/.ssh/id_ed25519_***)
# App path: /app/apps/builder-bot/   |   PM2 process: ton-agent-bot
# Postgres in Docker container: ton-agent-postgres

# Standard flow:
scp -i ~/.ssh/id_ed25519_*** <file> root@***.***.***.***:/app/apps/builder-bot/src/...
ssh -i ~/.ssh/id_ed25519_*** root@***.***.***.*** 'pm2 restart ton-agent-bot'
ssh -i ~/.ssh/id_ed25519_*** root@***.***.***.*** 'pm2 logs ton-agent-bot --lines 30 --nostream'
```

## Architecture — read these to be productive

### Monorepo layout
- `apps/builder-bot/` — the entire bot (Telegraf + Express API). ~95% of code lives here.
- `apps/landing/` — Web Studio: static `studio.html` + `studio.js` (~15k LOC, no framework) + `studio.css`. The Studio is an SPA built with vanilla JS, served directly from disk.
- `apps/runner/`, `apps/plugin-registry/` — separate workers.
- `packages/shared-types`, `packages/plugin-sdk` — workspace-shared TS types and plugin SDK.
- pnpm workspace + Turborepo. Packages are hoisted to root `node_modules/.pnpm/`; `apps/builder-bot/node_modules` is mostly empty.

### How an agent runs (the core flow)
1. `apps/builder-bot/src/index.ts` boots Telegraf + Express + the runner.
2. **Telegram message** → `apps/builder-bot/src/bot.ts` (Telegraf handlers, holds `pending*` state-machine Maps for multi-step flows like agent creation).
3. **Orchestrator** (`src/agents/orchestrator.ts`) classifies intent (NLU) and dispatches to either: a creation flow, a chat-with-agent flow, or NFT/gift analysis.
4. **Agent runtime** (`src/agents/ai-agent-runtime.ts`, ~10k LOC) is the engine. **Use Grep, not Read, on this file.** Key functions:
   - `buildToolDefinitions(role, enabledCapabilities, mcpTools)` — assembles OpenAI tool schemas, filtered by the agent's `enabledCapabilities`. The big map `CAPABILITY_TOOL_MAP` (line ~1107) defines which tool names belong to each capability ID.
   - `selectRelevantTools` (TF-IDF) — picks the top-N tools per turn so the LLM doesn't get the full 65+ tool list every call. The per-provider cap is in `src/config/platform.ts` `PROVIDER_LIMITS`.
   - The main loop is `for (let iter = 0; iter < MAX_ITERS; iter++)` — 5 iterations max per tick. Each iter calls LLM, runs returned tool_calls in parallel (up to `TOOL_CONCURRENCY`), feeds results back. Hard token cap (~100K) triggers emergency trim.
   - `executeTool(name, args, params)` (line ~2152) — single giant switch over all tool names. New tools = new `case` branch here PLUS new schema in `src/agents/tools/tool-definitions.ts` PLUS (often) a new entry in `CAPABILITY_TOOL_MAP`.
   - System prompt is assembled inline (~line 7200+) including a self-awareness block (`selfAwareness.push(...)`), skill inventory (via `buildSkillsInventory`), memory blocks, mode hints, dossier blocks. The whole thing is one large template literal — be careful when refactoring.
5. **AI providers** are routed via `resolveProvider(provider, overrideMaxTools, providerTier)`. Supports OpenAI, Anthropic, Gemini, Groq, DeepSeek, OpenRouter, Together. Per-provider URL/model/limits in `src/config/platform.ts`.
6. **Auto-pause**: `src/services/agent-auto-pause.ts` increments per-reason counters in `agent_state`; agents auto-pause once a counter reaches its threshold. `recordSuccess(agentId)` wipes ALL counters after a successful response.

| Reason | Threshold | Triggers on |
|---|---|---|
| `NO_API_KEY` | 1 (immediate) | missing `AI_API_KEY` and no platform fallback |
| `INVALID_API_KEY` | 3 | 401 / `invalid_api_key` / `expired_api_key` |
| `INSUFFICIENT_CREDITS` | 3 | 402 / `insufficient credit` |
| `TPM_EXCEEDED` | 3 | 413 OR 429 OR `tokens per minute` / `rate_limit_exceeded` |
| `CONTEXT_OVERFLOW` | 5 | persistent context-overflow |
| `CIRCUIT_BREAKER` | 10 | generic repeated AI failures (last resort) |

When wiring a new failure mode, add the case to `recordErrorMaybePause()` calls at the two AI-error catch sites in `ai-agent-runtime.ts` (around the retry loop and after retry exhaustion).

7. **Self-introspection tools**: `get_my_full_state` (returns identity + config + capabilities + skills + wallet + plugins + goals + lessons + MCP + stats, secrets masked) and `todo_write` / `todo_read` (in-memory checklist for multi-step tasks, FSM constraint: at most one `in_progress`; nag reminder after 3 rounds without an update). Both in CORE_TOOLS — always available regardless of `enabledCapabilities`.

### Agent Skills (agentskills.io spec)
- Spec-compliant skill loader at `src/services/skill-registry.ts`.
- 12 built-in skills under `src/skills/<name>/SKILL.md` (YAML frontmatter + Markdown body). They are loaded from disk at runtime; do NOT bundle into the dist build.
- Progressive disclosure: only `name + description` for each skill goes into the system prompt on every tick (cheap). The full body is loaded by the agent calling the `read_skill(name)` tool on demand.
- User-authored skills live in the `builder_bot.skills` table (per-user). `builder_bot.agent_skills` controls per-agent enable/disable (default ON; only DISABLED rows are stored).
- Skill names cannot collide with built-in names (security: built-in wins on collision, prevents shadowing of safety rules).
- Body safety: `scanSkillBody()` runs prompt-injection + code-exec + credential-leak regex; public skills must pass HIGH-severity scan. Import URLs whitelisted to GitHub raw / gist / jsdelivr / agentskills.io.

### Sub-agents
- `src/agents/sub-agents/` — `analyst`, `creator`, `editor`, `runner`. The orchestrator invokes these for specialized flows (e.g., creator builds a new agent's system prompt; editor revises an existing one). They share the AI client but use distinct prompt templates.

### Atlas (Studio AI assistant)
- `POST /api/chat/stream` in `src/api-server.ts` (~line 4913). This is the chat the user sees on `studio.html/assistant`. NOT the agent runtime — Atlas is the platform's own AI helping the user manage things.
- **Auth routing**: only `/^sk-ant-api/` keys go to the native Anthropic SDK path. `sk-ant-oat...` (Claude Code OAuth tokens) are explicitly rejected — they return 401 on `api.anthropic.com/v1/messages`. Everything else (incl. OAuth tokens and no-Anthropic-key) falls through to Gemini via OpenAI-compat at `generativelanguage.googleapis.com`.
- **Anti-hallucination pattern**: the system prompt is BUILT AT REQUEST TIME by importing live data (`CAPABILITY_TOOL_MAP` keys, `listSkillsForAgent()`, `agentTemplates`) and injecting it under a "📦 РЕАЛЬНЫЕ CAPABILITIES" header with anti-hallucination rules. Without this, Atlas invented names like `TON_Storage`, `Code_interpreter`, `Calendar`. **Mirror this pattern for any new "tell the user what we can do" surface.**
- **Anthropic SDK quirk**: Anthropic's API does NOT speak OpenAI's `/chat/completions` schema. When `useNativeAnthropic = true` the code MUST use `client.messages.stream({ model, system, messages, max_tokens })` — never `client.chat.completions.create()`. Streaming events are `content_block_delta` with `delta.text`.
- Model fallback chain: native Anthropic → `[ATLAS_MODEL, claude-haiku-4-5-20251001]`. Gemini path → `[gemini-2.5-flash, gemini-2.0-flash]`. Rate-limit (429/529) falls to next model; non-retryable errors propagate.
- `max_tokens: 4096` (was 1024 — responses kept getting cut off in long capability listings). If you bump it again, change both call sites.

### Database
- Single file holds all schema: `src/db/schema-extensions.ts`. DDL is wrapped in `ensureBetaSchemaExtensions()` (auto-runs at boot, fully idempotent — every `CREATE TABLE IF NOT EXISTS`). To add a new table, append a new `await client.query(\`CREATE TABLE IF NOT EXISTS ...\`)` block before the final `COMMIT`.
- **Important `agent_state` quirk**: composite UNIQUE is `(agent_id, key)`, NOT `(agent_id, user_id, key)`. Inserts must use `ON CONFLICT (agent_id, key)`. But the table still requires `user_id NOT NULL` — look up the owner from `builder_bot.agents` first.
- `agent_state` is the catch-all KV: keys with `_paused_reason`, `_err_counter_<REASON>`, `_active_goals`, etc. are reserved and meaningful — see `isProtectedStateKey` in the runtime.
- Drizzle ORM is used in some places, raw `pool.query` in many others. Both styles exist and are fine.

### REST API
- `src/api-server.ts` — Express, 80+ endpoints, all protected by `requireAuth` middleware.
- `requireAuth` preserves the Telegram numeric ID as a string (`req.userIdStr`) to avoid JS Number precision loss on 19-digit OIDC sub IDs. Use `(req as any).userIdStr` when echoing user IDs in API responses.
- Studio frontend (`apps/landing/studio.js`) is auth-bound to `/api/*` via `apiRequest()` helper. Pages register lazy loaders in the `pageLoadFns` object.

### TypeScript looseness (read this before fighting the compiler)
- `apps/builder-bot/tsconfig.json` has `strict: false` and `transpileOnly: true` for ts-node.
- **There are pre-existing TS errors in the codebase**. The bot still runs because ts-node skips type-checking at runtime. CI runs `tsc --noEmit || true` — non-blocking. Do not assume `pnpm exec tsc --noEmit` exiting non-zero means your change broke something; check whether the errors existed beforehand.
- Frequent existing patterns: `as any`, `(client as any)`, `as unknown as Foo` to bridge incompatible 3rd-party types (especially GramJS newer APIs).

### Studio frontend gotchas
- `apps/landing/studio.js` is ~15k LOC of vanilla JS in one file. Use Grep heavily, never full Read.
- Modal pattern: `openModal(title, bodyHtml, footerHtml)` and `closeModal()` (NOT `showModal({...})`). The container element is `#generic-modal`.
- Page loader pattern: each page has `<div id="<name>-page" class="page">` in HTML; `navigateTo(name)` toggles `.active`; `pageLoadFns[name]` is the lazy-load callback.
- Settings tabs inside an agent: `switchSettingsTab(tab)` is one giant if/else chain that renders into `#agent-settings-body`. New tabs need (a) a button under `#agent-settings-tabs` in `studio.html`, (b) a branch in `switchSettingsTab`.
- Cache busting: bump the `?v=YYYYMMDD<suffix>` in `<link rel="preload">` and `<script src=>` when shipping new `studio.js`.
- Theme palette: primary `#00a8ff` (electric blue), purple accent `#8b5cf6`. Old TON-blue `#0098EA` is being phased out via `studio-theme-sync.css`.
- **Nav badges (BETA/ADM/NEW) and `.nav-new` MUST use `var(--accent-dim)` + `var(--primary-light)`, NEVER hardcoded `rgba(255,255,255,…) !important`.** There was a duplicate rule in `studio.css` (line ~7692) that broke accent-color customisation. If you add a new badge variant, follow the var-based pattern at the top of `studio.css`.
- The `.metric-change` slot under a metric card is for delta values like "+5%". If the value already includes a unit (e.g. `66%` rendered via `animateCount(..., '%')`), DO NOT also include a `<span class="metric-change">%</span>` — that produces a duplicate suffix.

### Wallet integration
- Two layers: `src/services/agentic-wallet.ts` (preferred) and legacy V4R2 (fallback). The agentic path uses `@ton/mcp@alpha` (TON Foundation's official MCP server, spec at agents.ton.org) spawned as a child process via `StdioClientTransport`.
- All mnemonics encrypted (AES-256-GCM) before persisting. Encryption key resolution: `WALLET_ENCRYPTION_KEY` → `ENCRYPTION_KEY` → BOT_TOKEN-derived fallback (warns at startup).
- `WALLET_TYPE='solo'` means the agent has its own wallet; `'root'` means the agent uses the user's root wallet (deprecated path).

### Persistent operational facts
- Domain: `tonagentplatform.com`. Bot: `@TonAgentPlatformBot`. GitHub: `github.com/spendollars/TonAgentPlatform`.
- TON Foundation grant winner. Two AI hackathon prizes referenced in README badges.
- TON dev tooling skills (`acton`, `tolk`, `func2tolk`, `ton-blockchain`) ship bundled. They're for agents that write TON smart contracts; runtime agents don't need them.
- The `staging/` directory under `apps/builder-bot/` is git-tracked but excluded from `tsconfig.include` — don't put runtime code there.
- **Release log lives in `CHANGELOG.md`** (Keep a Changelog format) — every notable change should land there before the tag. README has a high-level roadmap only.
- Current line ending convention: LF in repo, `core.autocrlf` typically `true` on Windows hosts. Git prints "LF will be replaced by CRLF" warnings on `git add` — they are harmless, leave them.

### When something Atlas/agent-related "isn't working"
1. Check `pm2 logs ton-agent-bot --lines 80 --nostream | grep -E "Atlas|AutoPause|❌"` first.
2. For agent runtime issues: ask the agent `get_my_full_state` via the tool — returns its complete state with secrets masked.
3. For Atlas hallucination/wrong-info issues: it's almost always the system prompt missing live data. See "Atlas — anti-hallucination pattern" above. Add the live inventory; don't try to fix with stricter prose.
4. For "agent floods logs": check `_err_counter_*` in `agent_state`. If counters incrementing but no pause → check that the matching reason is in the `recordErrorMaybePause` ladder at both AI-error catch sites.
