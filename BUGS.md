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

### C4. payments.ts:561 — double-spend на topup (нет usedTxHashes check)
- **Статус**: 🔧 TODO
- **Описание**: `verifyTopupTransaction()` НЕ проверяет usedTxHashes. Юзер может кредитовать баланс одной и той же транзакцией многократно.
- **Fix**: Добавить `if (usedTxHashes.has(txHash)) continue;` как в verifyTonTransaction

### C5. orchestrator.ts:541 — clarification bypass через magic string
- **Статус**: 🔧 TODO
- **Описание**: Юзер может вписать `__ATLAS_CLARIFIED__:` в сообщение и пропустить все вопросы уточнения
- **Fix**: Boolean flag в контексте вместо magic string

### C6. context.ts:30 — hardcoded OWNER_ID fallback `130806013`
- **Статус**: 🔧 TODO
- **Описание**: Без env var любой юзер с ID 130806013 получает admin. Дефолт должен быть '0'.
- **Fix**: `parseInt(process.env.OWNER_ID || '0', 10)`

### C7. webhook-server.ts:112 — auth закомментирован, API открыт
- **Статус**: 🔧 TODO
- **Описание**: API key check закомментирован. Любой может листить и запускать агентов по userId.
- **Fix**: Раскомментировать auth или удалить эндпоинты (api-server.ts уже имеет auth)

### C8. creator.ts:295 — агент сохраняется при failed security scan
- **Статус**: 🔧 TODO
- **Описание**: Если security scan фейлит, агент всё равно сохраняется + potential null deref на data!.score
- **Fix**: `if (!securityPassed) return error;`

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

### H6. giftasset.ts:205 — wrong auth header in Dev API fallback
- **Статус**: 🔧 TODO
- **Описание**: `gaDevFetch` шлёт Pro key (`GA_KEY`) вместо Dev key (`GA_DEV_KEY`). Весь fallback на Dev API сломан — получает 401.
- **Fix**: Заменить `'X-API-Key': GA_KEY` на `'x-api-token': GA_DEV_KEY`

### H7. plugin-manager.ts:298 — new PG Pool на каждый notify()
- **Статус**: 🔧 TODO
- **Описание**: Каждый вызов `ctx.notify()` создаёт новый Pool, query, end(). Под нагрузкой = connection exhaustion.
- **Fix**: Импортировать и использовать shared pool

### H8. userbot-manager.ts:852 — chatRing singleton shared between agents
- **Статус**: 🔧 TODO
- **Описание**: Единственный `ChatHistoryRing` шарится между ВСЕМИ агентами. Если 2 агента в одном чате — их контексты смешиваются.
- **Fix**: Per-agent ChatHistoryRing instances

### H9. userbot-manager.ts:93 — XSS в mdToHtml (нет URL sanitization)
- **Статус**: 🔧 TODO
- **Описание**: `mdToHtml` не блокирует `javascript:` URLs и не экранирует `"` в href. Attribute injection возможен.
- **Fix**: Добавить ту же санитизацию что в telegram-userbot.ts

### H10. universal-agent-chat.ts:17 — Anthropic keys fail через OpenRouter
- **Статус**: 🔧 TODO
- **Описание**: Anthropic provider роутится на OpenRouter, а не напрямую. sk-ant-* ключи не работают с OpenRouter.
- **Fix**: Для Anthropic использовать нативный SDK или документировать что нужен OpenRouter key

### H11. claude-code-bridge.ts:159 — potential shell injection в CLI args
- **Статус**: 🔧 TODO
- **Описание**: argsStr экранирует только кавычки, но не backticks и `$(...)`. User prompt может содержать shell metacharacters.
- **Fix**: Всегда использовать stdin pipe для untrusted content

### H12. schema-extensions.ts — missing DDL columns для /metrics
- **Статус**: 🔧 TODO
- **Описание**: agent_audit_log не имеет tool_name, duration_ms, success — /metrics endpoint крашится
- **Fix**: ALTER TABLE ADD COLUMN IF NOT EXISTS

### H13. index.ts:73 — startBot() не awaited
- **Статус**: 🔧 TODO
- **Описание**: Bot может не быть готов когда restoreActiveAgents() запускается. Agents шлют notifications в неподключённый бот.
- **Fix**: `await startBot();`

### H14. runner.ts:534 — restoreActiveAgents без rate limiting
- **Статус**: 🔧 TODO
- **Описание**: 50+ агентов восстанавливаются одновременно при рестарте — overload AI API
- **Fix**: Задержка 500ms между активациями

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

### M11. agentic-wallet.ts:28 — static salt в scryptSync
- **Статус**: 🔧 TODO
- **Описание**: Hardcoded salt `'agentic-wallet-salt'` — все ключи из одного пароля дают одинаковый AES key
- **Fix**: Per-mnemonic random salt, хранить вместе с шифротекстом

### M12. agent-memory.ts:564 — race condition в evolvePrompt
- **Статус**: 🔧 TODO
- **Описание**: Read-modify-write на code + trigger_config без транзакции
- **Fix**: Обернуть в BEGIN/COMMIT

### M13. agent-reputation.ts:651 — GDP query crash на невалидном ton_amount
- **Статус**: 🔧 TODO
- **Описание**: `::real` cast на произвольный JSONB string может крашнуть весь запрос
- **Fix**: Safe cast с regex validation или COALESCE

### M14. discord-manager.ts:25 — SSRF path injection
- **Статус**: 🔧 TODO
- **Описание**: channelId/guildId интерполируются в URL без валидации, `../` injection
- **Fix**: Валидация `if (!/^\d+$/.test(id))`

### M15. agent-memory.ts:99 — silent errors в daily log
- **Статус**: 🔧 TODO
- **Описание**: Both INSERT paths имеют `.catch(() => {})` — ошибки молча глотаются
- **Fix**: console.warn в catch

### M16. userbot-manager.ts:853 — _rawDedup Set без cleanup
- **Статус**: 🔧 TODO
- **Описание**: Set растёт бесконечно, каждый messageId добавляется но не удаляется
- **Fix**: Periodic cleanup или TTL

### M17. plugin-marketplace.ts:240 — install count при re-install
- **Статус**: 🔧 TODO
- **Описание**: Re-activation expired плагина тоже инкрементит install count
- **Fix**: Проверять rowCount от INSERT vs UPDATE

### M18. crew-system.ts:96 — unbounded shared memory
- **Статус**: 🔧 TODO
- **Описание**: sharedMem Map растёт без ограничений — нет cap на количество crew
- **Fix**: Cleanup crews старше порога

### M19. x-manager.ts:36 — path injection в X API URLs
- **Статус**: 🔧 TODO
- **Описание**: tweetId/userId интерполируются без валидации
- **Fix**: `encodeURIComponent()` или regex validation

### M20. payments.ts:344 — generation tracker TTL (24h) < billing period (month)
- **Статус**: 🔧 TODO
- **Описание**: TTLMap evicts count каждые 24h, но лимит месячный. Юзер получает бесплатные генерации.
- **Fix**: TTL = 31 день или persist в DB

### M21. execution-tools.ts:22 — fixLiteralNewlinesInStrings не обрабатывает regex literals
- **Статус**: 🔧 TODO
- **Описание**: `/it's a test/` вызовет парсер войти в single-quote mode и испортит код
- **Fix**: Добавить regex literal detection

### M22. execution-tools.ts:318 — SSRF bypass через octal/decimal localhost
- **Статус**: 🔧 TODO
- **Описание**: `0177.0.0.1`, `2130706433`, `0x7f000001` не блокируются regex
- **Fix**: Resolve hostname → IP before checking

### M23. execution-tools.ts:112 — agentState Map leak для deleted agents
- **Статус**: 🔧 TODO
- **Описание**: При удалении агента его state в Map остаётся навсегда
- **Fix**: Вызывать pruneAgentMemory(agentId) при удалении

### M24. notifier.ts:52 — interval не .unref()
- **Статус**: 🔧 TODO
- **Описание**: Node.js не может graceful exit если этот interval последний
- **Fix**: `.unref()` на interval

### M25. orchestrator.ts:518 — слишком широкий retry pattern
- **Статус**: 🔧 TODO
- **Описание**: `msg.includes('function')` матчит любой JS stacktrace → бесполезные ретраи
- **Fix**: Более специфичные паттерны: 'does not support tools'

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
- **Найдено**: 55 багов (ещё 2 аудитора работают: bot.ts, ai-agent-runtime.ts)
- **Зафикшено**: 0 (из этого списка)
- **Критических**: 8
- **High**: 14
- **Medium**: 25
- **Low**: 4
- **Последний аудит**: 2026-03-20
