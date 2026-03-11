#!/bin/bash
set -e

echo "🚀 TON Agent Platform — Quick Setup"
echo "======================================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required (v20+). Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "📦 Installing pnpm..."; npm i -g pnpm; }
command -v docker >/dev/null 2>&1 || { echo "⚠️ Docker not found. You'll need to set up PostgreSQL manually."; }

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Copy .env if not exists
if [ ! -f apps/builder-bot/.env ]; then
  cp apps/builder-bot/.env.example apps/builder-bot/.env
  echo "✅ Created apps/builder-bot/.env — edit it with your BOT_TOKEN and DB credentials"
else
  echo "✅ .env already exists"
fi

# Start database
if command -v docker >/dev/null 2>&1; then
  echo ""
  echo "🐘 Starting PostgreSQL..."
  export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-dev_password_change_me}
  docker compose -f infrastructure/docker-compose.yml up -d
  echo "✅ PostgreSQL running on localhost:5432"
fi

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit apps/builder-bot/.env with your BOT_TOKEN"
echo "  2. Run: pnpm --filter builder-bot dev"
echo "  3. Open Telegram -> @TonAgentPlatformBot -> /start"
echo ""
