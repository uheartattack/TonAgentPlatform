# TON Agent Platform - Landing & Dashboard

Public-facing website and web dashboard for the TON Agent Platform.

**Live**: [tonagentplatform.ru](https://tonagentplatform.ru)

## Structure

```
apps/landing/
├── index.html          # Landing page (features, pricing, roadmap, FAQ)
├── dashboard.html      # Web dashboard (agents, plugins, wallet, logs)
├── dashboard.js        # Dashboard logic (API calls, auth, real-time updates)
├── dashboard.css       # Dashboard styles (responsive, dark theme)
├── logo.gif            # Animated logo
└── favicon files
```

## Landing Page (`index.html`)

- **Hero section** with animated stats (agents created, active users)
- **How It Works** — 3-step flow: describe -> AI generates -> agent runs
- **Agent Capabilities** — 65+ tools, 7 AI providers, voice commands, gift arbitrage
- **Plugin Library** — 12 plugins across DeFi, Analytics, Notifications, Security
- **Live Demo** — interactive agent creation simulation
- **Pricing** — Free (3 agents), Starter (5 TON), Pro (15 TON), Unlimited (30 TON)
- **Roadmap** — completed milestones and upcoming features
- **FAQ** — common questions and answers
- **Bilingual** — English/Russian toggle

## Dashboard (`dashboard.html`)

Authenticated via Telegram (deeplink auth or Login Widget).

### Pages

| Page | Description |
|------|-------------|
| **Overview** | Metrics cards, activity stream, quick actions |
| **My Agents** | Agent list with start/stop/delete, logs, config |
| **Marketplace** | Browse and purchase community agents |
| **Plugins** | Install/uninstall plugins with configuration |
| **Wallet** | Balance, topup (QR + deeplink), withdraw, transaction history |
| **Settings** | AI provider config, notification preferences |
| **Profile** | User info, subscription, connected wallet, API keys |

### Features

- Real-time activity polling (30s interval)
- Agent start/stop/rename/delete via API
- Plugin install/uninstall with per-plugin config
- Wallet: topup via TON transfer, withdraw to any address
- Transaction history with type filtering
- Responsive: mobile breakpoints at 768px and 480px
- Hamburger menu on mobile
- Dark theme

## API Connection

Dashboard connects to the bot's REST API at `/api/*` (42 endpoints). Auth token stored in `localStorage`.

Key endpoints used:
- `GET /api/me` — user profile
- `GET /api/agents` — agent list
- `GET /api/agents/:id/logs` — agent logs
- `POST /api/agents/:id/run` — start agent
- `GET /api/plugins` — plugin list
- `GET /api/balance` — wallet balance
- `GET /api/transactions` — transaction history
- `POST /api/topup/check` — verify topup
- `POST /api/withdraw` — withdraw TON

## Local Development

```bash
cd apps/landing
npx serve .
# Open http://localhost:3000
```

For API access, the bot must be running on `localhost:3001`.

## Deployment

Files are served by nginx on the production server:

```bash
scp index.html dashboard.html dashboard.js dashboard.css root@server:/app/apps/landing/
```

Nginx config points `/` to `index.html` and serves static files from `/app/apps/landing/`.

## License

MIT
