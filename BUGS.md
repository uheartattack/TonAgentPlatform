# TON Agent Platform — Bug Tracker

> Этот файл — живой трекер всех найденных багов. Тестируй платформу, записывай баги сюда, фиксим вместе.
> Формат: `[SEVERITY] FILE:LINE — описание`
> Severity: 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🔵 LOW

---

## 🔴 CRITICAL

### C1. execution-tools.ts — vm module не security boundary
- **Статус**: ⚠️ KNOWN LIMITATION
- **Описание**: Мигрировали с vm2 (CVE) на Node.js `vm` module. `vm` module НЕ является security sandbox — это documented limitation. Для полной изоляции нужен `isolated-vm`.
- **Риск**: Теоретический sandbox escape через prototype pollution
- **Fix**: Миграция на `isolated-vm` (отдельный спринт, ~500 строк)

### C2. agentic-wallet.ts — мнемоники без WALLET_ENCRYPTION_KEY
- **Статус**: ✅ КОД ГОТОВ, ⚠️ ENV НЕ НАСТРОЕН
- **Описание**: AES-256-GCM шифрование добавлено, но `WALLET_ENCRYPTION_KEY` не задан на проде. Мнемоники пока хранятся plaintext (backward compatible).
- **Fix**: `ssh root@prod 'echo WALLET_ENCRYPTION_KEY=<random-64-hex> >> /app/apps/builder-bot/.env'`

### C3. runner.ts:97 — data access before null check
- **Статус**: 🔧 TODO
- **Описание**: `agentResult.data` используется до проверки `!agentResult.data`
- **Fix**: Переместить null check перед использованием data

---

## 🟠 HIGH

### H1. telegram-userbot.ts:50 — runtime require('node-fetch') без обработки
- **Статус**: 🔧 TODO
- **Описание**: `safeFetchBuffer` fallback на `require('node-fetch')` без try-catch. Если node-fetch не установлен и Node < 18, крашнется.
- **Fix**: Статический import вверху файла

### H2. giftasset.ts:49 — race condition в кеше
- **Статус**: 🔧 TODO
- **Описание**: `cached()` не дедуплицирует параллельные вызовы. Два одновременных запроса оба вызовут API.
- **Fix**: Pending promises map для дедупликации

### H3. ai-agent-runtime.ts:189 — race condition в Pool singleton
- **Статус**: 🔧 TODO
- **Описание**: `_getSharedStatePool()` может создать дупликат Pool при параллельных вызовах
- **Fix**: Promise-based singleton или sync init

### H4. universal-agent-chat.ts:41 — OpenAI client без валидации
- **Статус**: 🔧 TODO
- **Описание**: `new OpenAI({ baseURL, apiKey })` без проверки что значения не undefined
- **Fix**: `if (!apiKey || !baseURL) throw new Error('Missing credentials')`

### H5. TonConnect.ts:82 — unsafe JSON cast
- **Статус**: 🔧 TODO
- **Описание**: `await res.json() as any` без проверки res.ok
- **Fix**: Добавить `if (!res.ok)` check

---

## 🟡 MEDIUM

### M1. bot.ts:301-310 — memory leak в pending Maps
- **Статус**: 🔧 TODO
- **Описание**: Только pendingCreations имеет auto-cleanup. 10+ других Maps (pendingRenames, pendingEdits, pendingRefinements, pendingAgentChats, pendingTgAuth, pendingApiKey, pendingPublish, pendingTemplateSetup) растут бесконечно.
- **Fix**: Добавить TTL cleanup для всех pending Maps

### M2. orchestrator.ts:144 — unreachable code
- **Статус**: 🔧 TODO
- **Описание**: Дупликат проверки `!isRetryable` — строка 144 никогда не выполнится
- **Fix**: Удалить дупликат

### M3. payments.ts:35 — TTLMap eviction недостаточная
- **Статус**: 🔧 TODO
- **Описание**: evict() удаляет только 1 entry при превышении maxSize
- **Fix**: Удалять до 80% maxSize

### M4. notifier.ts:84 — regex callback не возвращает значение
- **Статус**: 🔧 TODO
- **Описание**: safeTruncate() replace callback для подсчёта тегов не работает корректно
- **Fix**: Переписать подсчёт тегов

### M5. fragment-service.ts:62 — unsafe cast session.save()
- **Статус**: 🔧 TODO
- **Описание**: `_client.session.save() as unknown as string` маскирует реальный тип
- **Fix**: Проверить actual return type и handle null

### M6. creator.ts:88 — NaN interval calculation
- **Статус**: 🔧 TODO
- **Описание**: parseInt может вернуть NaN если m[1] не число
- **Fix**: `const num = parseInt(m[1]); if (isNaN(num)) return null;`

### M7. api-server.ts:62 — fire-and-forget без catch
- **Статус**: 🔧 TODO
- **Описание**: persistSession() pool.query() без .catch()
- **Fix**: Добавить `.catch(e => console.warn(...))`

### M8. plugin-marketplace.ts:47 — migration без catch
- **Статус**: 🔧 TODO
- **Описание**: Инициализация таблиц pool.query() без proper error handling
- **Fix**: Добавить .catch() с логированием

### M9. ai-agent-runtime.ts:190-202 — Pool resource leak
- **Статус**: 🔧 TODO
- **Описание**: SharedStatePool никогда не закрывается при shutdown
- **Fix**: Зарегистрировать pool для graceful shutdown

### M10. telegram-gifts.ts:65 — json() без проверки res.ok
- **Статус**: 🔧 TODO
- **Описание**: Вызов .json() на error response может крашнуться
- **Fix**: `if (!res.ok) return [];`

---

## 🔵 LOW

### L1. ai-agent-runtime.ts:154 — слабый hash (32-bit)
- **Статус**: ⏳ LOW PRIORITY
- **Описание**: _hashContent() — 32-bit hash, коллизии для длинных строк
- **Fix**: Использовать crypto.createHash('sha256')

### L2. db/schema-extensions.ts:95 — hardcoded schema name
- **Статус**: ⏳ LOW PRIORITY
- **Описание**: 'builder_bot' hardcoded в DDL. Не injection risk (не от юзера), но не гибко
- **Fix**: Вынести в константу

### L3. claude-code-bridge.ts:83 — неинформативная ошибка
- **Статус**: ⏳ LOW PRIORITY
- **Описание**: findClaudeCli() не логирует какие пути проверены
- **Fix**: Логировать каждый проверенный путь

### L4. index.ts:88 — silent require catch
- **Статус**: ⏳ LOW PRIORITY
- **Описание**: Динамический require модулей с silent catch
- **Fix**: `console.error('[Module] Failed:', e.stack)`

---

## 🧪 TESTING NOTES

### Что тестить:
1. **Создание агента** — /create, описать задачу, проверить что создался
2. **Уточнение** — после создания написать "теперь добавь ещё..."
3. **Crew** — /crew, создать команду через AI
4. **Marketplace** — /plugin_market, установить плагин, оценить
5. **KYA** — /kya <id> для любого агента
6. **Leaderboard** — /leaderboard
7. **GDP** — /gdp
8. **Domain** — /domain, /domain claim <id> <name>, /domain resolve <name.ton>
9. **Wallet** — /wallet, отправка TON
10. **Gifts** — арбитраж, каталог, анализ
11. **Voice** — голосовое сообщение для создания агента
12. **Chat** — чат с AI агентом, подтверждение действий (HitL)

### Как записывать баги:
```
### BUG_ID. Короткое описание
- **Шаги**: что сделал
- **Ожидал**: что должно было случиться
- **Получил**: что случилось (скриншот/текст ошибки)
- **Статус**: 🔧 TODO
```

---

## 📊 STATS
- **Найдено**: 24 бага
- **Зафикшено**: 0 (из этого списка)
- **Критических**: 3
- **High**: 5
- **Medium**: 10
- **Low**: 4
- **Последний аудит**: 2026-03-20
