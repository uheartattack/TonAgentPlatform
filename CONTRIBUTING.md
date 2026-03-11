# Contributing to TON Agent Platform

## Development Setup

```bash
# 1. Clone
git clone https://github.com/spendollars/TonAgentPlatform
cd TonAgentPlatform

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL
docker compose -f infrastructure/docker-compose.yml up -d

# 4. Configure
cp apps/builder-bot/.env.example apps/builder-bot/.env
# Edit .env with your BOT_TOKEN and DB credentials

# 5. Run
pnpm --filter builder-bot dev
```

## Code Style

- TypeScript strict mode
- No `eval()` or `new Function()` — use VM2 sandbox for dynamic code
- All HTML output must use `escHtml()` to prevent XSS
- All API endpoints must have input validation and rate limiting
- Fetch calls must include `signal: AbortSignal.timeout(15000)`
- Never log secrets (mnemonics, API keys, passwords)

## Testing

```bash
pnpm --filter builder-bot test          # Run all tests
pnpm --filter builder-bot test:watch    # Watch mode
pnpm --filter builder-bot test:coverage # With coverage
```

## Pull Request Process

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass: `pnpm test`
4. Follow the code style guidelines above
5. Submit a PR with a clear description

## Creating Plugins

See `apps/builder-bot/src/plugins-system.ts` for the plugin API. Plugins must:

1. Export a `register()` function
2. Declare required API keys in `requiredKeys`
3. Include a `skillDoc` for AI agents to understand the plugin
4. Handle errors gracefully with try/catch

## Security

If you find a security vulnerability, please report it via GitHub Issues with the `security` label. Do NOT disclose vulnerabilities publicly before they are patched.
