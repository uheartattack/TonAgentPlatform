# TON Agent Runner

Agent execution engine that keeps AI agents running 24/7 with persistent scheduling.

> **Note**: The runner is integrated into `builder-bot` as `sub-agents/runner.ts` and `ai-agent-runtime.ts`. This package exists as a future standalone runner for horizontal scaling.

## Current Implementation (in builder-bot)

The runner functionality lives in two files:

### `runner.ts` — Scheduling & Lifecycle
- Restores active agents on bot restart (DB-backed)
- Manages agent intervals (1m, 5m, 15m, 1h, daily)
- Handles start/stop/pause with graceful shutdown
- Pre-warms agent state from DB into memory cache
- Tracks execution history (started_at, duration_ms, status)

### `ai-agent-runtime.ts` — AI Agent Execution
- Autonomous agentic loop: AI decides which tools to call
- 65+ tools available (TON, gifts, NFT, web, Telegram, state)
- Up to 5 sequential tool calls per tick
- Write-through state cache (survives restarts)
- Circuit breaker on repeated failures
- Per-agent AI provider selection (7 providers)

## Execution Model

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Scheduler  │────>│  AI Runtime   │────>│  Tool Executor │
│  (interval)  │     │  (agentic)    │     │  (sandboxed)   │
└─────────────┘     └──────────────┘     └───────────────┘
       │                    │                      │
       │                    ▼                      ▼
       │             ┌──────────┐           ┌──────────┐
       │             │  State   │           │  Notify  │
       │             │  (DB)    │           │  (Tg)    │
       └─────────────┴──────────┘           └──────────┘
```

### Trigger Types
| Type | Description |
|------|-------------|
| `manual` | User triggers via bot or API |
| `scheduled` | Runs on interval (cron-like) |
| `webhook` | Triggered by HTTP POST to webhook URL |
| `ai_agent` | Autonomous AI loop with tool calling |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_USER` | PostgreSQL user | postgres |
| `DB_PASSWORD` | PostgreSQL password | — |
| `DB_NAME` | Database name | builder_bot |
| `TONAPI_KEY` | TonAPI key for blockchain tools | — |

## Future Plans

- Standalone runner process for horizontal scaling
- Redis-based job queue
- Multi-node agent distribution
- Prometheus metrics export
- Configurable concurrency limits

## License

MIT
