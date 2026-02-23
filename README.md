<p align="center">
  <img src="logo.gif" alt="TON Agent Platform" width="400"/>
</p>

<h1 align="center">TON Agent Platform</h1>

<p align="center">
  No-code toolkit for building AI agents on <strong>TON blockchain</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Telegram-Bot-0088cc?logo=telegram" alt="Telegram Bot">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Status-Alpha-orange" alt="Status">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Quick Start

```bash
git clone https://github.com/spendollars/TonAgentPlatform.git
cd TonAgentPlatform
docker-compose up

No-code платформа для создания AI-агентов в Telegram с интеграцией TON.

## Быстрый старт
```bash
# 1. Установить зависимости
pnpm install

# 2. Запустить базу данных
pnpm db:up

# 3. Применить миграции
pnpm db:migrate

# 4. Настроить переменные окружения
cp .env.example .env
# Отредактировать .env

# 5. Запустить разработку
pnpm dev
```

## Структура проекта

- `apps/builder-bot` — Telegram бот для создания агентов
- `apps/runner` — Исполнитель агентов (фоновый процесс)
- `apps/plugin-registry` — API каталога плагинов
- `packages/shared-types` — Общие TypeScript типы
- `packages/plugin-sdk` — SDK для разработки плагинов

## Встроенные плагины

- **GiftIndex** — Арбитраж подарков Telegram
- **Strategy Builder** — Визуальные торговые стратегии
- **Social Signals** — Анализ соцсетей и сентимент
- **OnChain Analytics** — Анализ блокчейна TON
- **Oracle** — Агрегированные цены и внешние данные
- **NFT Tools** — NFT снайпинг и торговля

## Технологии

- TypeScript
- Grammy (Telegram Bot)
- Claude API (генерация кода)
- PostgreSQL + Redis
- TON SDK
- Turborepo (monorepo)

## Лицензия

MIT
'@
