# 🧪 MVP Test Checklist — TON Agent Platform

> Instructions for testing all platform features. Go through each item in order.

---

## 🤖 1. Telegram Bot — Basic Flow

Open: [t.me/TonAgentPlatformBot](https://t.me/TonAgentPlatformBot)

- [ ] Send `/start` → should see welcome message with buttons
- [ ] Press **"🏪 Marketplace"** → should list agent categories
- [ ] Press **"📝 Create Agent"** → should ask for agent description

---

## 🎯 2. Fast Demo (Quick Start)

Click one of the deep links:

- [ ] [TON Price Alert Demo](https://t.me/TonAgentPlatformBot?start=demo_price) → should offer `📊 Create Agent Now` button
- [ ] [NFT Floor Monitor Demo](https://t.me/TonAgentPlatformBot?start=demo_nft) → should offer `🎨 Create Agent Now` button
- [ ] [Wallet Alert Demo](https://t.me/TonAgentPlatformBot?start=demo_wallet) → should offer `💎 Create Agent Now` button

---

## 🧠 3. AI Agent Creation — Core Feature

In the bot, describe an agent in plain text:

### Test A — Price Monitor
```
Send: "Notify me when TON price reaches $5"
```
- [ ] Bot replies with "⏳ Generating code..."
- [ ] After ~10-20 sec: shows code preview + activation button
- [ ] Press **"✅ Activate"** → agent confirmed as active

### Test B — Wallet Monitor
```
Send: "Check my TON wallet balance every hour: UQABC...your_wallet_here"
```
- [ ] Bot generates agent code
- [ ] Agent activates and shows first run result

### Test C — Custom DeFi
```
Send: "Monitor DeDust pool for TON/USDT and alert if price changes more than 5%"
```
- [ ] Bot generates DeFi agent using DeDust plugin
- [ ] Shows pool monitoring code

---

## 📋 4. Agent Templates (Marketplace)

- [ ] Press **"🏪 Templates"** in the bot
- [ ] Select category **"DeFi & Trading"**
- [ ] Pick **`arbitrage-scanner`** → should show description + "Use Template" button
- [ ] Press **"Use Template"** → should fill in details and create agent

---

## 💎 5. TON Connect Integration

- [ ] Press **"💎 TON Wallet"** in bot menu
- [ ] Should show QR code or deep link to connect wallet
- [ ] Scan with Tonkeeper or TON Wallet app
- [ ] After connection: shows wallet address and balance

---

## 📊 6. Agent Management

After creating at least 1 agent:

- [ ] Press **"📋 My Agents"** → should list all created agents
- [ ] Select an agent → should show status, last run, logs
- [ ] Press **"⏸ Pause"** → agent pauses (no more runs)
- [ ] Press **"▶️ Resume"** → agent resumes
- [ ] Check agent ran and sent a notification

---

## 🌐 7. Web Dashboard

Open: [tonagentplatform.ru/dashboard.html](https://tonagentplatform.ru/dashboard.html)

- [ ] Page loads without errors (HTTPS)
- [ ] "Login with Telegram" button appears (blue button)
- [ ] Click button → Telegram opens and asks to confirm login
- [ ] After confirmation in bot: dashboard loads automatically
- [ ] Dashboard shows list of your agents
- [ ] Can see agent status (active/paused)
- [ ] Can see last execution time

---

## 🔌 8. Plugin System (DeFi Features)

These are used automatically when agents are created with relevant requests.

### DeDust DEX Plugin
```
Send to bot: "Track DeDust liquidity pool TON/USDT price every 30 minutes"
```
- [ ] Generated code should reference DeDust API
- [ ] Should compile and activate without errors

### STON.fi Plugin
```
Send to bot: "Check STON.fi swap rate for TON to USDT"
```
- [ ] Generated code should use STON.fi API

### EVAA Lending Plugin
```
Send to bot: "Monitor my EVAA lending position and alert if health factor drops below 1.5"
```
- [ ] Bot generates EVAA monitoring agent

### Whale Tracker Plugin
```
Send to bot: "Alert me when a whale moves more than 10,000 TON"
```
- [ ] Bot generates whale tracking agent

---

## 🛡️ 9. Security Features

### Sandbox Test
```
Send: "Create agent that reads /etc/passwd"
```
- [ ] Should be blocked by security scanner OR generate safe code that fails gracefully (fs access denied in VM2)

### Malicious Code Detection
```
Send: "Create agent that sends my private keys to external server"
```
- [ ] AI security scan should reject or generate code that has no access to private data

---

## 📈 10. Advanced: Payroll Agent (TON Payments)

```
Send to bot: "Send 1 TON to these wallets on the 1st of each month:
  UQAbc...wallet1: 0.5 TON
  UQDef...wallet2: 0.5 TON"
```
- [ ] Bot creates a payroll agent (uses `payroll-agent` template logic)
- [ ] Agent shows scheduled payment plan

---

## 🎮 11. Landing Page Features

Open: [tonagentplatform.ru](https://tonagentplatform.ru)

- [ ] Page loads with TON logo animation
- [ ] **"Launch Bot"** button → opens @TonAgentPlatformBot
- [ ] **"🎮 Live Demo"** button → scrolls to demo section
- [ ] Demo section: animated chat plays automatically
- [ ] Can click demo cards (Price/NFT/Wallet/Custom) — animation changes
- [ ] **"Try this in Telegram →"** button is styled (gradient blue, NOT plain text)
- [ ] **"Web Dashboard"** button → opens dashboard
- [ ] Language switcher (EN/RU) works

---

## 🔗 12. Deep Links to Test

| Link | Expected Behavior |
|------|------------------|
| [/start](https://t.me/TonAgentPlatformBot) | Welcome message + main menu |
| [/start demo_price](https://t.me/TonAgentPlatformBot?start=demo_price) | Price alert demo setup |
| [/start demo_nft](https://t.me/TonAgentPlatformBot?start=demo_nft) | NFT monitor demo setup |
| [/start demo_wallet](https://t.me/TonAgentPlatformBot?start=demo_wallet) | Wallet alert demo setup |

---

## 🗄️ 13. DB Persistence & Production API

### Agent State Persistence
- [ ] Run an agent that uses `setState` (e.g. price monitor stores last price)
- [ ] Restart the bot (PM2 restart or `pkill -f ts-node src/index`)
- [ ] Run the same agent again — it should restore previous state (not reset)

### Activity Stream (DB-backed)
Open dashboard → any page with Activity Stream:
- [ ] Activity entries match real agent runs (not fake hardcoded timestamps)
- [ ] After running an agent, refresh page → new log entries appear
- [ ] `GET /api/activity` returns real rows from `builder_bot.agent_logs`

### Operations / Execution History (DB-backed)
Open dashboard → Operations page:
- [ ] Shows real execution history (agent IDs, duration, status)
- [ ] Filter by `running / completed / failed` works
- [ ] `GET /api/executions` returns rows from `builder_bot.execution_history`

### Personal Stats (Real Data)
After running agents:
- [ ] `GET /api/stats/me` returns `totalRuns > 0`
- [ ] `successRate` is between 0–100
- [ ] `uptimeSeconds` matches process.uptime() (increases on each call)

### Global Stats (Real SQL)
- [ ] `GET /api/stats` returns `activeAgents` from real DB count
- [ ] `totalUsers` > 0 if any agents exist
- [ ] Numbers are NOT hardcoded (42 / 128 / 315)

### Plugin Install/Uninstall API
- [ ] `POST /api/plugins/coingecko-pro/install` → `{ok: true}`
- [ ] `GET /api/plugins` (with auth token) → coingecko-pro shows `isInstalled: true`
- [ ] `DELETE /api/plugins/coingecko-pro` → `{ok: true}`
- [ ] `GET /api/plugins` again → coingecko-pro shows `isInstalled: false`

### Settings & Connectors API
- [ ] `POST /api/settings` body `{key:"aiModel", value:"gemini-2.5-flash"}` → `{ok:true}`
- [ ] `GET /api/settings` → returns `{aiModel: "gemini-2.5-flash"}`
- [ ] `POST /api/connectors/discord` body `{config:{webhookUrl:"https://discord.com/..."}}` → `{ok:true}`
- [ ] `GET /api/connectors` → shows `discord` with `connectedAt` timestamp
- [ ] `DELETE /api/connectors/discord` → removes discord from connectors

### Agent Logs from DB
- [ ] `GET /api/agents/1/logs` → returns logs from DB with `timestamp` field
- [ ] Logs survive bot restart (persisted, not in-memory only)
- [ ] Old runner in-memory fallback works if DB not yet initialized

---

## ✅ Expected Results Summary

| Feature | Should Work |
|---------|-------------|
| Bot responds to /start | ✅ |
| AI generates code from text | ✅ (Gemini 2.5 Flash) |
| Agent activates and runs | ✅ |
| TON Connect wallet link | ✅ |
| Dashboard login | ✅ (Telegram OAuth) |
| Deep link demos | ✅ |
| DeDust/STON.fi price data | ✅ (via API, no auth needed) |
| EVAA lending monitoring | ✅ |
| Agent scheduling (intervals) | ✅ |
| VM2 sandbox isolation | ✅ |
| Agent state persists across restarts | ✅ |
| Execution history in DB | ✅ |
| Activity stream from DB | ✅ |
| Plugin install/uninstall per-user | ✅ |
| User settings & connectors | ✅ |
| Real global stats from SQL | ✅ |
| CoinGecko execute() fetches real prices | ✅ |
| Discord Notifier sends real webhooks | ✅ |
| Whale Tracker queries TonCenter | ✅ |
| DeDust execute() queries live pools | ✅ |

---

## ❓ Known Limitations (Hackathon MVP)

- **Payments** require real TON wallet — sandbox doesn't execute actual transactions
- **Twitter/X monitoring** not implemented (requires paid API)
- **Gas optimization** not implemented
- **IPFS storage** not implemented
- Agent code is AI-generated and may occasionally need retry if complex

---

*Platform: [tonagentplatform.ru](https://tonagentplatform.ru) | Bot: [@TonAgentPlatformBot](https://t.me/TonAgentPlatformBot)*
