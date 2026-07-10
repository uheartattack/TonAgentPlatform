# Contributing to TON Agent Platform

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Prerequisites
node >= 20.0.0
pnpm >= 8.0.0
docker (for PostgreSQL)

# Install
git clone https://github.com/spendollars/TonAgentPlatform
cd TonAgentPlatform && pnpm install

# Database
docker compose -f infrastructure/docker-compose.prod.yml up -d

# Configure
cp apps/builder-bot/.env.example apps/builder-bot/.env
# Fill in BOT_TOKEN, DATABASE_URL, etc.

# Run
pnpm --filter builder-bot dev
```

## Project Structure

- `apps/builder-bot/src/agents/` — AI runtime, orchestrator, tools
- `apps/builder-bot/src/services/` — Business logic services
- `apps/builder-bot/src/api-server.ts` — REST API endpoints
- `apps/builder-bot/src/bot.ts` — Telegram bot handlers
- `apps/landing/` — Web Studio (static HTML/CSS/JS)

## Code Style

- TypeScript strict mode
- No `any` unless absolutely necessary (legacy code exceptions exist)
- Async/await over raw promises
- Error messages in English for logs, Russian for user-facing text
- Use `console.log`/`console.warn`/`console.error` with `[ModuleName]` prefix

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Test locally with the bot
4. Submit a PR with a clear description

## Security

If you find a security vulnerability, please report it privately via Telegram: [@despensive](https://t.me/despensive). Do NOT open a public issue.

## License

By contributing, you agree that your contributions will be licensed under BSL 1.1.
