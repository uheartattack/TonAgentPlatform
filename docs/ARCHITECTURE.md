# Architecture

## System Overview

```mermaid
graph TD
    TG[Telegram Bot] --> ORC[Orchestrator]
    WEB[Web Studio] --> API[REST API Server]
    API --> ORC
    ORC --> TOOLS[Platform Tools]
    ORC --> AI[AI Provider]

    TOOLS --> DB[(PostgreSQL)]
    TOOLS --> TON[TON Blockchain]
    TOOLS --> MCP[TON MCP Server]
    TOOLS --> GIFTS[Telegram Gifts]
    TOOLS --> DEFI[DeFi: DeDust/STON.fi]

    ORC --> RUNTIME[AI Agent Runtime]
    RUNTIME --> AGENTS[Autonomous Agents]
    AGENTS --> TOOLS

    SI[Self-Improvement] --> AGENTS
```

## Core Components

### Orchestrator (`src/agents/orchestrator.ts`)
Central brain of the platform. Routes user messages to appropriate tools:
- Intent detection via AI function calling
- Agent CRUD operations
- Multi-provider AI (7 providers + fallback)
- Context-aware responses (knows current Studio page)

### AI Agent Runtime (`src/agents/ai-agent-runtime.ts`)
Autonomous agent execution engine:
- Agentic loop: AI calls tools iteratively (up to 5 per tick)
- 65+ tools: TON, NFT, gifts, web, Telegram, DeFi
- Safety rules: transaction limits, scraping rate limits
- MCP integration: per-agent TON MCP subprocess
- VM2 sandbox for flow code execution

### REST API Server (`src/api-server.ts`)
HTTP API for Web Studio:
- Telegram OAuth authentication
- Agent management endpoints (42 routes)
- Rate limiting per user/IP
- CORS with HTTPS enforcement
- Input validation on all endpoints

### Bot (`src/bot.ts`)
Telegraf v4 bot for Telegram interface:
- Command handlers (/start, /agents, /wallet, etc.)
- Callback query routing (50+ handlers)
- Voice command transcription
- State machines for multi-step flows
- Pending Map cleanup with TTL

## Data Flow

```mermaid
sequenceDiagram
    User->>Orchestrator: "Monitor TON price"
    Orchestrator->>AI: Function calling
    AI-->>Orchestrator: create_agent(desc)
    Orchestrator->>Creator: Generate system prompt
    Creator->>DB: Save agent
    Orchestrator->>Runtime: Activate agent
    Runtime->>Agent: Start tick loop
    loop Every interval
        Agent->>AI: What should I do?
        AI->>Tools: get_ton_balance, web_search
        Tools-->>AI: Results
        AI->>Tools: notify (if threshold met)
        Tools-->>User: Telegram notification
    end
```

## TON Integration Map

| Layer | Technology | Usage |
|-------|-----------|-------|
| Wallet | @ton/core, @ton/ton, @ton/crypto | Key derivation, message signing, BOC |
| API | TonAPI v2 (tonapi.io) | Balances, NFTs, transactions, DNS |
| DeFi | DeDust API, STON.fi API | Swap simulation, pool data, prices |
| Connect | @tonconnect/sdk | User wallet connection (Tonkeeper) |
| MCP | @ton/mcp | Dynamic tool discovery per agent |
| Gifts | Telegram Bot API + GramJS MTProto | Gift catalog, purchases, arbitrage |

## Security Architecture

- **No eval()** — safe expression evaluator for workflows
- **VM2 sandbox** — all dynamic code runs in isolated VM
- **SSRF protection** — blocked internal IPs, metadata endpoints
- **Rate limiting** — per-user/IP on all critical endpoints
- **Transaction limits** — max 100 TON per autonomous transfer
- **AI safety rules** — injected into every agent's system prompt
- **Input validation** — message length limits, type checks
- **Session management** — 24h TTL, periodic cleanup
