# API Reference

Base URL: `https://tonagentplatform.com`

## Authentication

All endpoints except `/api/stats` and `/api/auth/*` require a Bearer token.

```
Authorization: Bearer <token>
```

### POST /api/auth/telegram
Authenticate via Telegram Login Widget data.

```json
// Request
{ "id": "123456", "first_name": "John", "auth_date": "1710000000", "hash": "..." }

// Response
{ "ok": true, "token": "abc123...", "user": { "id": 123456, "firstName": "John" } }
```

## Agents

### GET /api/agents
List all agents for the authenticated user.

```json
// Response
{ "ok": true, "agents": [
  { "id": 1, "name": "TON Monitor", "trigger_type": "ai_agent", "is_active": true }
] }
```

### POST /api/agents
Create a new agent from description.

```json
// Request
{ "description": "Monitor TON price and notify when it drops below $3" }

// Response
{ "ok": true, "agent": { "id": 5, "name": "TON Price Monitor" }, "type": "agent_created" }
```

### POST /api/agents/:id/run
Start an agent.

### POST /api/agents/:id/stop
Stop an agent.

### GET /api/agents/:id/logs
Get agent execution logs.

## Chat

### POST /api/chat
Send a message to the AI assistant.

```json
// Request (max 4000 chars)
{ "message": "Create a gift arbitrage bot", "context": { "page": "overview", "source": "studio" } }

// Response
{ "ok": true, "result": { "content": "I'll create...", "type": "agent_created", "buttons": [] } }
```

### GET /api/chat/history
Get chat history.

## Wallet

### GET /api/wallet/balance
Get user wallet balance.

### POST /api/wallet/topup
Generate TON deposit address.

## Marketplace

### GET /api/marketplace
List available agent templates.

### POST /api/marketplace/:id/install
Install a marketplace template.

## Statistics

### GET /api/stats (public)
Platform-wide statistics.

```json
{ "ok": true, "agents": 150, "activeAgents": 45, "users": 80 }
```

### GET /api/stats/me
User-specific statistics.

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /api/auth/* | 10/min per IP |
| /api/chat | 20/min per user |
| /api/agents (POST) | 5/min per user |
