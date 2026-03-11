# API Reference

Base URL: `https://tonagentplatform.com`

All endpoints except auth and public stats require the `X-Auth-Token` header:

```
X-Auth-Token: <token>
```

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/telegram` | Authenticate via Telegram Login Widget (HMAC-SHA256) |
| POST | `/api/auth/telegram-oidc` | Authenticate via Telegram OIDC |
| GET | `/api/auth/request` | Start Telegram deeplink auth flow |
| GET | `/api/auth/check/:token` | Poll deeplink auth status |

### POST /api/auth/telegram

```json
// Request
{ "id": "123456", "first_name": "John", "auth_date": "1710000000", "hash": "..." }

// Response
{ "ok": true, "token": "abc123...", "user": { "id": 123456, "firstName": "John" } }
```

## Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents for authenticated user |
| POST | `/api/agents` | Create agent from description (AI-first) |
| GET | `/api/agents/:id` | Get agent details |
| POST | `/api/agents/:id/run` | Start agent |
| POST | `/api/agents/:id/stop` | Stop agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/rename` | Rename agent |
| PUT | `/api/agents/:id/code` | Update agent code / system prompt |
| PUT | `/api/agents/:id/provider` | Switch AI provider for agent |
| PUT | `/api/agents/:id/role` | Update agent role |
| PUT | `/api/agents/:id/capabilities` | Update agent capabilities |
| GET | `/api/agents/:id/logs` | Get execution logs |
| GET | `/api/agents/:id/audit` | Get audit trail |
| POST | `/api/agents/:id/chat` | Send message to agent (agent chat) |
| POST | `/api/agents/:id/wallet` | Create per-agent TON wallet |

### POST /api/agents

```json
// Request
{ "description": "Monitor TON price and notify when it drops below $3" }

// Response
{ "ok": true, "agent": { "id": 5, "name": "TON Price Monitor" }, "type": "agent_created" }
```

## Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to platform AI assistant |
| GET | `/api/chat/history` | Get chat history |

### POST /api/chat

```json
// Request (max 4000 chars)
{ "message": "Create a gift arbitrage bot", "context": { "page": "overview", "source": "studio" } }

// Response
{ "ok": true, "result": { "content": "I'll create...", "type": "agent_created", "buttons": [] } }
```

## Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings |
| POST | `/api/settings` | Save user settings |

## Marketplace

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/marketplace` | Browse marketplace listings |
| GET | `/api/marketplace/my` | User's own listings |
| GET | `/api/marketplace/purchases` | User's purchases |
| POST | `/api/marketplace` | Publish agent to marketplace |
| POST | `/api/marketplace/:id/install` | Install marketplace template |
| DELETE | `/api/marketplace/:id` | Remove listing |

## Plugins

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plugins` | List available plugins |
| POST | `/api/plugins/:id/install` | Install plugin for user |
| DELETE | `/api/plugins/:id` | Uninstall plugin |

## Wallet & Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/balance` | Get wallet balance |
| GET | `/api/transactions` | Transaction history |
| POST | `/api/topup/check` | Verify TON topup |
| POST | `/api/withdraw` | Withdraw TON |

## Proposals (Self-Improvement)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals` | List AI improvement proposals |
| POST | `/api/proposals/:id/approve` | Approve proposal |
| POST | `/api/proposals/:id/reject` | Reject proposal |
| POST | `/api/proposals/:id/rollback` | Rollback applied proposal |

## Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Current user profile |
| GET | `/api/stats/me` | Personal statistics |
| GET | `/api/stats` | Platform-wide statistics (public) |
| GET | `/api/config` | Platform config (public) |
| GET | `/api/platform/health` | Health check (public) |
| GET | `/api/activity` | Activity stream |
| GET | `/api/executions` | Executions with filters |
| GET | `/api/connectors` | External service connectors |
| POST | `/api/connectors/:service` | Connect external service |
| DELETE | `/api/connectors/:service` | Disconnect external service |
| GET | `/api/tonconnect-manifest.json` | TON Connect manifest (public) |
| POST | `/api/emergency-stop` | Emergency stop all agents |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/auth/*` | 10/min per IP |
| `/api/chat` | 20/min per user |
| `/api/agents` (POST) | 5/min per user |
| All other endpoints | 60/min per user |
