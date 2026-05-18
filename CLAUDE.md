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
6. **Auto-pause**: `src/services/agent-auto-pause.ts` increments per-reason counters in `agent_state`; agents auto-pause at thresholds (`NO_API_KEY=1`, `INVALID_API_KEY=3`, `INSUFFICIENT_CREDITS=3`, `TPM_EXCEEDED=3` covers both 413 and 429, `CIRCUIT_BREAKER=10`). `recordSuccess(agentId)` wipes counters after a successful response.

### Agent Skills (agentskills.io spec)
- Spec-compliant skill loader at `src/services/skill-registry.ts`.
- 12 built-in skills under `src/skills/<name>/SKILL.md` (YAML frontmatter + Markdown body). They are loaded from disk at runtime; do NOT bundle into the dist build.
- Progressive disclosure: only `name + description` for each skill goes into the system prompt on every tick (cheap). The full body is loaded by the agent calling the `read_skill(name)` tool on demand.
- User-authored skills live in the `builder_bot.skills` table (per-user). `builder_bot.agent_skills` controls per-agent enable/disable (default ON; only DISABLED rows are stored).
- Skill names cannot collide with built-in names (security: built-in wins on collision, prevents shadowing of safety rules).
- Body safety: `scanSkillBody()` runs prompt-injection + code-exec + credential-leak regex; public skills must pass HIGH-severity scan. Import URLs whitelisted to GitHub raw / gist / jsdelivr / agentskills.io.

### Sub-agents
- `src/agents/sub-agents/` — `analyst`, `creator`, `editor`, `runner`. The orchestrator invokes these for specialized flows (e.g., creator builds a new agent's system prompt; editor revises an existing one). They share the AI client but use distinct prompt templates.

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

### Wallet integration
- Two layers: `src/services/agentic-wallet.ts` (preferred) and legacy V4R2 (fallback). The agentic path uses `@ton/mcp@alpha` (TON Foundation's official MCP server, spec at agents.ton.org) spawned as a child process via `StdioClientTransport`.
- All mnemonics encrypted (AES-256-GCM) before persisting. Encryption key resolution: `WALLET_ENCRYPTION_KEY` → `ENCRYPTION_KEY` → BOT_TOKEN-derived fallback (warns at startup).
- `WALLET_TYPE='solo'` means the agent has its own wallet; `'root'` means the agent uses the user's root wallet (deprecated path).

### Persistent operational facts
- Domain: `tonagentplatform.com`. Bot: `@TonAgentPlatformBot`. GitHub: `github.com/spendollars/TonAgentPlatform`.
- TON Foundation grant winner. Two AI hackathon prizes referenced in README badges.
- TON dev tooling skills (`acton`, `tolk`, `func2tolk`, `ton-blockchain`) ship bundled. They're for agents that write TON smart contracts; runtime agents don't need them.
- The `staging/` directory under `apps/builder-bot/` is git-tracked but excluded from `tsconfig.include` — don't put runtime code there.
