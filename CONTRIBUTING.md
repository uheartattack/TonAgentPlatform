# Contributing to TON Agent Platform

## Prerequisites

- **Node.js** 20+
- **pnpm** (workspace manager)
- **PostgreSQL** 15+ (or Docker)
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))

## Development Setup

```bash
# 1. Clone
git clone https://github.com/spendollars/TonAgentPlatform
cd TonAgentPlatform

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL
docker compose -f infrastructure/docker-compose.yml up -d

# 4. Configure environment
cp apps/builder-bot/.env.example apps/builder-bot/.env
```

Edit `apps/builder-bot/.env` with required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from BotFather |
| `DB_HOST` | Yes | PostgreSQL host (default: localhost) |
| `DB_USER` | Yes | PostgreSQL user |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `DB_NAME` | Yes | PostgreSQL database name |
| `OPENAI_API_KEY` | No* | OpenAI API key |
| `ANTHROPIC_API_KEY` | No* | Anthropic API key |

*At least one AI provider key is recommended. Without any key, the platform proxy fallback is used.

```bash
# 5. Run the bot
npx ts-node apps/builder-bot/src/index.ts

# Or with pnpm:
pnpm --filter builder-bot dev
```

Healthy startup output:
```
Loaded 22 agent templates
Loaded 12 plugins
Bot is running!
Platform ready!
```

## Project Structure

This is a **pnpm workspace** monorepo. Packages are hoisted to the workspace root `node_modules/.pnpm/`, so do not look for them inside `apps/builder-bot/node_modules/`.

```
apps/
  builder-bot/    # Main application (Telegraf bot + REST API)
  landing/        # Web dashboard (static HTML/JS/CSS)
packages/         # Shared packages
infrastructure/   # Docker, nginx, deployment configs
```

## Code Style

- **TypeScript** strict mode
- Prefer `async/await` over raw Promises
- No `eval()` or `new Function()` — use VM2 sandbox for dynamic code
- All HTML output must use `escHtml()` to prevent XSS
- All API endpoints must have input validation and rate limiting
- Fetch calls must include `signal: AbortSignal.timeout(15000)`
- Never log secrets (mnemonics, API keys, passwords)
- MarkdownV2 output: use the `esc()` helper to escape all 18 special characters

## Testing

```bash
pnpm --filter builder-bot test          # Run all tests
pnpm --filter builder-bot test:watch    # Watch mode
pnpm --filter builder-bot test:coverage # With coverage
```

## Pull Request Process

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass
4. Follow the code style guidelines above
5. Submit a PR with a clear description

## Creating Plugins

See `apps/builder-bot/src/plugins-system.ts` for the plugin API:

1. Implement the `Plugin` interface
2. Include a `skillDoc` (AI uses this to understand your plugin)
3. Declare `configSchema` for user-facing configuration
4. Handle errors gracefully with try/catch
5. Submit a PR

## Security

If you find a security vulnerability, please report it via GitHub Issues with the `security` label. Do NOT disclose vulnerabilities publicly before they are patched.
