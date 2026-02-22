# TON Agent Runner

Сервис для выполнения AI-агентов 24/7.

## Возможности

- ? Планировщик задач (scheduler)
- ? Выполнение агентов по расписанию
- ? Изолированное выполнение (sandbox)
- ? Загрузка плагинов
- ? Логирование выполнений
- ? Graceful shutdown

## Запуск
```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

## Переменные окружения

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `POLL_INTERVAL_MS` - Интервал проверки агентов (default: 5000)
- `MAX_CONCURRENT_EXECUTIONS` - Макс одновременных выполнений (default: 10)
- `EXECUTION_TIMEOUT_MS` - Таймаут выполнения (default: 300000)
