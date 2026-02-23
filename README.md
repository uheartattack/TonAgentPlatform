<p align="center">
  <img src="logo.jpg" alt="TON Agent Platform Logo" width="200"/>
</p>

<h1 align="center">TON Agent Platform</h1>

# TON Agent Platform

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
