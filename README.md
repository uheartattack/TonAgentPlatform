<div align="center">

# 🤖 TON Agent Platform

**Autonomous AI agents for the TON blockchain — built in Telegram, no code required**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Telegram Bot](https://img.shields.io/badge/Telegram-@TonAgentPlatformBot-2CA5E0.svg)](https://t.me/TonAgentPlatformBot)
[![Live Demo](https://img.shields.io/badge/Demo-tonagentplatform.online-brightgreen.svg)](https://tonagentplatform.online)

*Create, deploy and manage AI-powered agents that trade, monitor, and automate on TON — entirely through a Telegram conversation.*

[**Live Demo**](https://tonagentplatform.online) · [**Try the Bot**](https://t.me/TonAgentPlatformBot) · [**Docs**](#api) · [**Contributing**](#contributing)

</div>

---

## What is this?

TON Agent Platform lets anyone create autonomous AI agents that run 24/7 on the TON blockchain — price monitors, DEX traders, wallet watchers, NFT snipers — without writing a single line of code. Users describe what they want in plain language; the platform generates, sandboxes, and deploys the agent instantly.

> "The Zapier for TON blockchain" — point, click, automate.

---

## Quick Start

\`\`\`bash
# 1. Clone and install
git clone https://github.com/your-org/ton-agent-platform
cd ton-agent-platform && pnpm install

# 2. Configure
cp apps/builder-bot/.env.example apps/builder-bot/.env
# Edit .env: add BOT_TOKEN, ANTHROPIC_API_KEY

# 3. Launch (Docker required)
docker compose -f infrastructure/docker-compose.yml up -d
pnpm --filter builder-bot dev
\`\`\`

Open Telegram → [@TonAgentPlatformBot](https://t.me/TonAgentPlatformBot) → \`/start\`

---

## Features

| | Feature | Description |
|---|---|---|
| 🧠 | **AI Code Generation** | Claude generates agent code from natural language descriptions |
| 🔒 | **Sandboxed Execution** | Every agent runs in an isolated VM2 sandbox with resource limits |
| 📊 | **18 Agent Templates** | Ready-to-use templates for common TON automation tasks |
| 🔌 | **Plugin Marketplace** | 12 plugins: DeDust, STON.fi, TonAPI, CoinGecko, and more |
| ⏱️ | **Persistent Scheduling** | Agents run 24/7 with configurable intervals |
| 💎 | **TON Connect** | Native wallet integration — sign transactions without leaving Telegram |
| 📈 | **Real-time Alerts** | Push notifications for price movements, wallet events, trade fills |
| 🌐 | **Web Dashboard** | Monitor all agents, view P&L at tonagentplatform.online |

---

## Architecture

\`\`\`mermaid
graph TB
    User((User)) -->|Telegram| Bot[Telegraf Bot]
    User -->|Browser| Dashboard[Web Dashboard]
    Bot --> Orchestrator[AI Orchestrator]
    Bot --> APIServer[REST API :3001]
    Orchestrator --> Creator[Agent Creator - Claude AI]
    Orchestrator --> Runner[Agent Runner - VM2 Sandbox]
    Runner --> Plugins[Plugin System]
    Plugins --> DeDust[DeDust DEX]
    Plugins --> STON[STON.fi DEX]
    Plugins --> TonAPI[TonAPI]
    Creator --> DB[(PostgreSQL)]
    Runner --> Redis[(Redis Cache)]
    APIServer --> Dashboard
    Bot --> TonConnect[TON Connect]
\`\`\`

---

## Plugin Library

| Plugin | Type | Description | Status |
|--------|------|-------------|--------|
| 💧 DeDust DEX Connector | DeFi | Swaps, liquidity pools, price feeds | ✅ Ready |
| 🌊 STON.fi Connector | DeFi | AMM swaps, pool analytics | ✅ Ready |
| 🔍 TonAPI Connector | Data | Wallet data, NFTs, transactions | ✅ Ready |
| 📊 CoinGecko Price Feed | Data | Real-time & historical prices | ✅ Ready |
| 📡 DexScreener Analytics | Analytics | DEX pair analytics, volume | ✅ Ready |
| 🔔 Telegram Notifier | Notification | Push alerts to Telegram | ✅ Ready |
| 📧 Email Notifier | Notification | SMTP email alerts | ✅ Ready |
| 📱 Discord Webhook | Notification | Discord channel notifications | ✅ Ready |
| 🛡️ Security Scanner | Security | AI-powered malicious code detection | ✅ Ready |
| 🗄️ IPFS Storage | Storage | Decentralized data storage | ✅ Ready |
| 🐦 Twitter/X Monitor | Social | Sentiment, keyword tracking | 🔧 Beta |
| ⛽ Gas Optimizer | Utility | Optimal gas fee selection | 🔧 Beta |

---

## Agent Templates

**DeFi & Trading**
- \`ton-price-monitor\` — Alert when TON price crosses a threshold
- \`dex-arbitrage-detector\` — Find price gaps across DeDust / STON.fi
- \`wallet-balance-tracker\` — Monitor wallet balance changes 24/7
- \`token-price-alert\` — Track any Jetton price with custom conditions

**NFT & Drops**
- \`nft-floor-monitor\` — Watch NFT collection floor prices
- \`nft-sales-tracker\` — Get notified on every sale in a collection

**Automation**
- \`scheduled-report\` — Daily P&L reports for your portfolio
- \`webhook-trigger\` — React to external events via HTTP webhooks

---

## API

\`\`\`
GET  /api/config              → bot username, landing URL, manifest URL
POST /api/auth/request        → initiate Telegram bot auth flow
GET  /api/auth/check/:token   → poll authentication status
GET  /tonconnect-manifest.json → TON Connect manifest
\`\`\`

---

## Security

- **Sandboxed execution** — VM2 with restricted globals; no \`fs\`, \`child_process\`, \`net\` access
- **Resource limits** — 30s max execution time, memory cap per agent
- **AI security scanner** — Static analysis before every agent deployment
- **Rate limiting** — Per-user API rate limits on all endpoints
- **Auth** — Telegram OAuth + deeplink auth; no passwords ever

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot framework | Telegraf v4 |
| Language | TypeScript 5.x |
| AI backend | Claude (Anthropic API) |
| Database | PostgreSQL 15 + Drizzle ORM |
| Cache | Redis 7 |
| Sandbox | VM2 (isolated Node.js) |
| TON | @ton/core, @tonconnect/sdk |
| Infrastructure | Docker Compose + nginx + PM2 |
| SSL | Let's Encrypt |

---

## Contributing

### Adding a Plugin

1. Open \`apps/builder-bot/src/plugins-system.ts\`
2. Implement the \`Plugin\` interface with a \`skillDoc\` (AI uses this to generate agent code)
3. Add your \`configSchema\` (shown to users in Telegram)
4. Submit a PR

\`\`\`typescript
interface Plugin {
  id: string;
  name: string;
  type: PluginType;
  skillDoc: string;        // Markdown docs for AI code generation
  configSchema: Schema[];  // Config fields in Telegram UI
  execute: (params) => Promise<any>;
}
\`\`\`

---

## Roadmap

- [x] AI agent code generation (Claude)
- [x] VM2 sandboxed execution
- [x] PostgreSQL persistence + Drizzle ORM
- [x] TON Connect wallet integration
- [x] Plugin marketplace (12 plugins)
- [x] 18 agent templates
- [x] Web dashboard with Telegram auth
- [x] Persistent 24/7 agent scheduling
- [x] Production deployment (tonagentplatform.online)
- [ ] Prometheus + Grafana monitoring
- [ ] Agent marketplace (community-published agents)
- [ ] Telegram Mini App (mobile-optimized)
- [ ] On-chain agent registry (TON smart contract)
- [ ] Agent-to-agent collaboration
- [ ] Multi-chain support (ETH, SOL)

---

## License

MIT © 2026 TON Agent Platform

---

<div align="center">

Built for the TON ecosystem · [tonagentplatform.online](https://tonagentplatform.online) · [@TonAgentPlatformBot](https://t.me/TonAgentPlatformBot)

</div>
