# TON Agent Platform - Complete Project Specification

## 🎯 Project Overview

Create a complete AI-powered agent platform on TON blockchain with plugin marketplace, Telegram bot interface, and autonomous agent execution system.

## 📋 Tech Stack

- **Language**: TypeScript (strict mode)
- **Monorepo**: Turbo + pnpm workspaces
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Bot**: Grammy (Telegram)
- **AI**: Claude API (Anthropic) for code generation
- **Blockchain**: TON (@ton/ton, @ton/crypto)
- **Wallet**: TON Connect integration
- **Dashboard**: Next.js 14 (App Router)
- **Sandbox**: VM2 for secure code execution
- **Monitoring**: Prometheus metrics

## 📁 Complete Project Structure

```
ton-agent-platform/
├── .github/workflows/
│   ├── ci.yml
│   ├── deploy-staging.yml
│   └── deploy-production.yml
├── .husky/
│   └── pre-commit
├── docs/
│   ├── README.md
│   ├── API.md
│   ├── PLUGINS.md
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── init.sql
│   ├── nginx.conf
│   └── terraform/main.tf
├── packages/
│   ├── shared-types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── agent.ts
│   │       ├── user.ts
│   │       ├── plugin.ts
│   │       ├── queue.ts
│   │       └── utils.ts
│   └── plugin-sdk/
│       ├── package.json
│       ├── tsconfig.json
│       ├── README.md
│       └── src/
│           ├── index.ts
│           ├── types.ts
│           ├── decorators.ts
│           ├── base-plugin.ts
│           ├── context.ts
│           ├── storage.ts
│           ├── ton-helpers.ts
│           └── examples/
│               ├── index.ts
│               ├── giftindex.ts
│               ├── strategy-builder.ts
│               ├── social-signals.ts
│               ├── onchain-analytics.ts
│               ├── oracle.ts
│               └── nft-tools.ts
├── apps/
│   ├── builder-bot/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts
│   │       ├── bot.ts
│   │       ├── config.ts
│   │       ├── context.ts
│   │       ├── ai/
│   │       │   ├── claude.ts
│   │       │   ├── prompts/
│   │       │   │   ├── base.ts
│   │       │   │   ├── with-plugins.ts
│   │       │   │   └── plugins/
│   │       │   │       ├── giftindex.ts
│   │       │   │       ├── strategy.ts
│   │       │   │       ├── social.ts
│   │       │   │       ├── analytics.ts
│   │       │   │       ├── oracle.ts
│   │       │   │       └── nft.ts
│   │       │   └── templates/
│   │       │       ├── base-agent.ts
│   │       │       └── plugin-wrapper.ts
│   │       ├── scenes/
│   │       │   ├── index.ts
│   │       │   ├── start.ts
│   │       │   ├── create.ts
│   │       │   ├── create-with-plugins.ts
│   │       │   ├── edit.ts
│   │       │   ├── manage.ts
│   │       │   ├── marketplace.ts
│   │       │   ├── settings.ts
│   │       │   └── admin.ts
│   │       ├── plugins/
│   │       │   ├── index.ts
│   │       │   ├── loader.ts
│   │       │   ├── registry.ts
│   │       │   ├── validator.ts
│   │       │   └── built-in/
│   │       │       ├── index.ts
│   │       │       ├── giftindex.ts
│   │       │       ├── strategy.ts
│   │       │       ├── social.ts
│   │       │       ├── analytics.ts
│   │       │       ├── oracle.ts
│   │       │       └── nft.ts
│   │       ├── payments/
│   │       │   ├── ton-connect.ts
│   │       │   ├── invoices.ts
│   │       │   └── subscriptions.ts
│   │       ├── db/
│   │       │   ├── index.ts
│   │       │   ├── users.ts
│   │       │   ├── agents.ts
│   │       │   ├── plugins.ts
│   │       │   └── executions.ts
│   │       ├── utils/
│   │       │   ├── logger.ts
│   │       │   ├── errors.ts
│   │       │   ├── validators.ts
│   │       │   └── formatters.ts
│   │       └── types/
│   │           └── index.ts
│   ├── runner/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts
│   │       ├── executor.ts
│   │       ├── queues/
│   │       │   ├── index.ts
│   │       │   ├── critical.ts
│   │       │   ├── normal.ts
│   │       │   └── low.ts
│   │       ├── sandbox/
│   │       │   ├── index.ts
│   │       │   ├── vm.ts
│   │       │   ├── plugin-host.ts
│   │       │   ├── timeout.ts
│   │       │   └── security.ts
│   │       ├── ton/
│   │       │   ├── client.ts
│   │       │   ├── wallet.ts
│   │       │   ├── transactions.ts
│   │       │   └── contracts/
│   │       │       ├── jetton.ts
│   │       │       ├── nft.ts
│   │       │       └── dex.ts
│   │       ├── plugins/
│   │       │   ├── index.ts
│   │       │   ├── loader.ts
│   │       │   └── executor.ts
│   │       └── monitoring/
│   │           ├── health.ts
│   │           ├── metrics.ts
│   │           └── alerts.ts
│   ├── plugin-registry/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api.ts
│   │       ├── validator.ts
│   │       ├── scanner.ts
│   │       ├── sandbox.ts
│   │       ├── monetization.ts
│   │       └── reviews.ts
│   └── dashboard/
│       ├── package.json
│       ├── next.config.js
│       ├── tsconfig.json
│       └── src/
│           ├── app/
│           │   ├── page.tsx
│           │   ├── layout.tsx
│           │   ├── agents/
│           │   │   └── page.tsx
│           │   ├── plugins/
│           │   │   └── page.tsx
│           │   ├── analytics/
│           │   │   └── page.tsx
│           │   └── settings/
│           │       └── page.tsx
│           ├── components/
│           │   ├── AgentCard.tsx
│           │   ├── PluginCard.tsx
│           │   ├── Header.tsx
│           │   └── Sidebar.tsx
│           └── lib/
│               ├── api.ts
│               └── utils.ts
├── contracts/
│   ├── escrow.fc
│   ├── fee-distribution.fc
│   └── plugin-registry.fc
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── setup.sh
│   ├── migrate.sh
│   ├── backup.sh
│   └── deploy.sh
├── .env.example
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 🎯 Key Features to Implement

### 1. Plugin System (packages/plugin-sdk)

**6 Built-in Plugins with FULL implementations:**

1. **GiftIndex Plugin** - Telegram Gifts Arbitrage
   - Monitor gift prices across Telegram marketplace
   - Calculate arbitrage opportunities
   - Auto-buy underpriced gifts
   - Auto-sell overpriced gifts
   - Track profit/loss

2. **Strategy Builder Plugin** - Visual Trading Strategies
   - DCA (Dollar Cost Averaging)
   - Grid trading
   - Momentum strategies
   - Conditional orders
   - Backtest support

3. **Social Signals Plugin** - Social Media Sentiment
   - Monitor Twitter/X mentions
   - Sentiment analysis
   - Trending topics detection
   - Influencer tracking
   - Signal aggregation

4. **OnChain Analytics Plugin** - Blockchain Analysis
   - Wallet tracking
   - Large transaction alerts
   - DEX volume analysis
   - Liquidity pool monitoring
   - Smart money following

5. **Oracle Plugin** - External Data Feeds
   - Price oracles
   - Weather data
   - Sports scores
   - News feeds
   - Custom API integration

6. **NFT Tools Plugin** - NFT Automation
   - Floor price tracking
   - Auto-mint new drops
   - Rarity analysis
   - Auto-listing
   - Batch operations

**Plugin SDK Features:**
- Decorators: @Action, @Trigger, @Hook, @RequirePermissions
- Storage adapter for persistent data
- TON helpers for blockchain operations
- Permission system
- Lifecycle hooks
- Type-safe context

### 2. Builder Bot (apps/builder-bot)

**AI Integration (Claude API):**
- Generate agent code from natural language
- Specialized prompts for each plugin
- Code templates for common patterns
- Validation and security checks
- Interactive refinement

**Scenes (Complete Implementations):**
1. **Start** - Welcome, onboarding
2. **Create** - Basic agent creation
3. **Create with Plugins** - AI-assisted creation with plugin selection
4. **Edit** - Modify existing agents
5. **Manage** - List, start, stop, delete agents
6. **Marketplace** - Browse and install plugins
7. **Settings** - User preferences, wallet, notifications
8. **Admin** - User management, statistics, system health

**TON Connect Integration:**
- Wallet connection flow
- QR code display
- Deep linking
- Session management
- Transaction signing

**Database Operations:**
- Users CRUD
- Agents CRUD
- Plugins CRUD
- Execution logs
- Subscriptions tracking

### 3. Runner (apps/runner)

**Queue System (BullMQ):**
- **Critical Queue** (Priority 1): TON transactions, time-sensitive operations
- **Normal Queue** (Priority 2): Notifications, AI calls, data fetching
- **Low Queue** (Priority 3): Analytics, logging, cleanup

**Sandbox Execution:**
- VM2 for isolated code execution
- Memory limits
- CPU timeouts
- Network restrictions
- File system isolation

**TON Integration:**
- Wallet management (v3R2, v4R2)
- Transaction building and signing
- Jetton operations
- NFT operations
- DEX interactions (DeDust, STON.fi)

**Monitoring:**
- Health checks endpoint
- Prometheus metrics
- Alert system (Telegram notifications)
- Performance tracking

### 4. Plugin Registry (apps/plugin-registry)

**REST API:**
- GET /plugins - List all plugins
- GET /plugins/:id - Get plugin details
- POST /plugins - Submit new plugin
- PUT /plugins/:id - Update plugin
- DELETE /plugins/:id - Remove plugin
- GET /plugins/:id/reviews - Get reviews
- POST /plugins/:id/reviews - Add review

**Security:**
- Code validator (AST analysis)
- Vulnerability scanner
- Sandbox testing
- Rate limiting
- Authentication

**Monetization:**
- Plugin pricing
- Rental system
- Revenue sharing
- Payment processing via TON

### 5. Dashboard (apps/dashboard)

**Next.js 14 App Router:**
- Server Components
- API Routes
- Real-time updates
- Responsive design

**Pages:**
1. **Home** - Overview, quick stats
2. **Agents** - Create, manage, monitor agents
3. **Plugins** - Marketplace, installed plugins
4. **Analytics** - Execution stats, performance
5. **Settings** - Profile, wallet, preferences

### 6. Smart Contracts (contracts/)

**FunC Contracts:**

1. **escrow.fc** - Escrow for P2P plugin sales
   - Lock funds
   - Release on condition
   - Dispute resolution
   - Refund mechanism

2. **fee-distribution.fc** - Revenue sharing
   - Collect platform fees
   - Distribute to plugin authors
   - Stake rewards
   - Governance

3. **plugin-registry.fc** - On-chain plugin registry
   - Register plugins
   - Metadata storage
   - Verification badges
   - Rating system

## 🔒 Security Requirements

1. **Sandbox Security:**
   - No access to file system
   - No network outside allowed domains
   - Memory limits enforced
   - CPU timeout enforced
   - No eval() or Function()

2. **Code Validation:**
   - AST parsing
   - Forbidden patterns detection
   - Dependency scanning
   - Known vulnerability checks

3. **Permission System:**
   - wallet:read - Read wallet balance
   - wallet:spend:limited - Spend up to limit
   - wallet:spend:unlimited - Unlimited spending
   - network:ton - Access TON blockchain
   - network:external - External API calls
   - storage:persistent - Persistent storage
   - agent:spawn - Create new agents
   - notification - Send notifications

## 📊 Database Schema (PostgreSQL)

**Tables:**
```sql
users (
  id UUID PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  username TEXT,
  wallet_address TEXT,
  subscription_tier TEXT,
  created_at TIMESTAMP
)

agents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  name TEXT,
  template_type TEXT,
  status TEXT,
  config JSONB,
  code TEXT,
  created_at TIMESTAMP
)

plugins (
  id UUID PRIMARY KEY,
  name TEXT,
  slug TEXT UNIQUE,
  author_id UUID REFERENCES users,
  category TEXT,
  code_hash TEXT,
  is_public BOOLEAN,
  rating DECIMAL,
  created_at TIMESTAMP
)

plugin_installations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  plugin_id UUID REFERENCES plugins,
  is_rented BOOLEAN,
  rent_expires_at TIMESTAMP
)

executions (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents,
  status TEXT,
  result JSONB,
  gas_used BIGINT,
  created_at TIMESTAMP
)

plugin_reviews (
  id UUID PRIMARY KEY,
  plugin_id UUID REFERENCES plugins,
  user_id UUID REFERENCES users,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMP
)
```

## 🚀 Infrastructure

**Docker Compose Services:**
- PostgreSQL 15
- Redis 7
- Builder Bot
- Runner
- Plugin Registry
- Dashboard
- Nginx (reverse proxy)

**Environment Variables:**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
TELEGRAM_BOT_TOKEN=...
ANTHROPIC_API_KEY=...
TON_NETWORK=testnet|mainnet
TON_API_KEY=...
JWT_SECRET=...
```

## 📝 Documentation Requirements

Create comprehensive documentation:

1. **README.md** - Project overview, quick start
2. **API.md** - REST API reference
3. **PLUGINS.md** - Plugin development guide
4. **ARCHITECTURE.md** - System architecture
5. **DEPLOYMENT.md** - Deployment instructions

## ✅ Implementation Checklist

**Phase 1: Foundation**
- [ ] Monorepo setup (Turbo + pnpm)
- [ ] packages/shared-types with all types
- [ ] packages/plugin-sdk base classes
- [ ] All 6 plugins with full implementations
- [ ] Infrastructure (Docker, PostgreSQL, Redis)

**Phase 2: Builder Bot**
- [ ] Grammy bot setup
- [ ] Claude AI integration
- [ ] All 9 scenes implemented
- [ ] TON Connect integration
- [ ] Database operations
- [ ] Plugin prompts (6 specialized)

**Phase 3: Runner**
- [ ] BullMQ 3-tier queues
- [ ] VM2 sandbox
- [ ] TON client integration
- [ ] Plugin executor
- [ ] Monitoring system

**Phase 4: Plugin Registry**
- [ ] REST API
- [ ] Code validator
- [ ] Security scanner
- [ ] Monetization system
- [ ] Review system

**Phase 5: Dashboard**
- [ ] Next.js setup
- [ ] All pages
- [ ] Components
- [ ] API integration
- [ ] Real-time updates

**Phase 6: Smart Contracts**
- [ ] Escrow contract
- [ ] Fee distribution contract
- [ ] Plugin registry contract
- [ ] Contract tests

**Phase 7: Testing & Docs**
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] All documentation

## 🎯 Critical Implementation Notes

1. **Plugin SDK Must Have:**
   - Full TypeScript support
   - Decorator support (@Action, @Trigger, @Hook)
   - Storage interface implementation
   - TON blockchain helpers
   - Security sandbox integration
   - Each of 6 plugins must be FULLY functional

2. **AI Code Generation:**
   - Use Claude API (Anthropic)
   - Separate prompts for each plugin type
   - Include code validation
   - Handle errors gracefully
   - Support iterative refinement

3. **Queue Priorities:**
   - CRITICAL: TON transactions (can't wait)
   - NORMAL: Notifications, API calls
   - LOW: Analytics, cleanup

4. **TON Connect:**
   - Full wallet connection flow
   - QR code + deep link
   - Transaction signing
   - Session persistence

5. **Security:**
   - VM2 sandbox for all user code
   - AST-based validation
   - Permission system enforcement
   - Rate limiting everywhere

## 📦 Dependencies

**Key packages to include:**
```json
{
  "grammy": "^1.21.1",
  "@grammyjs/conversations": "^1.2.0",
  "@anthropic-ai/sdk": "^0.24.0",
  "@ton/ton": "^13.0.0",
  "@ton/crypto": "^3.2.0",
  "@tonconnect/sdk": "^3.0.0",
  "bullmq": "^4.0.0",
  "ioredis": "^5.3.0",
  "vm2": "^3.9.0",
  "pg": "^8.11.0",
  "winston": "^3.11.0",
  "next": "^14.0.0",
  "react": "^18.0.0"
}
```

## 🎯 Success Criteria

Project is complete when:
1. ✅ All 6 plugins work end-to-end
2. ✅ Bot can create agents using AI
3. ✅ Runner executes agents in sandbox
4. ✅ TON Connect wallet integration works
5. ✅ Plugin marketplace is functional
6. ✅ Dashboard displays real data
7. ✅ Smart contracts are deployable
8. ✅ All documentation is complete
9. ✅ Docker Compose starts everything
10. ✅ No TypeScript errors

## 🚀 Final Notes

- **Code Quality**: Strict TypeScript, proper error handling, logging
- **Production Ready**: Environment configs, health checks, monitoring
- **Documentation**: Every file needs comments, every API needs docs
- **Testing**: Structure for tests (actual tests can be added later)
- **Security**: Sandbox everything, validate everything
- **Performance**: Efficient queues, caching, indexing

Create ALL files with COMPLETE, WORKING implementations. No placeholders, no TODOs unless marked for future features.
