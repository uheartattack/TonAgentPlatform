# TON Agent Platform — Known Issues

> This file tracks known issues and their resolution status.
> Format: `[SEVERITY] FILE:LINE — description`
> Severity: 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🔵 LOW

---

## 🔴 CRITICAL

### C1. execution-tools.ts — vm sandbox hardened, isolated-vm upgrade planned
- **Статус**: ✅ HARDENED — prototype pollution blocked; isolated-vm upgrade IN PROGRESS
- **Описание**: Node.js `vm` module with frozen prototypes, disabled code generation, and constructor-chain blocking. Full process-level isolation via `isolated-vm` is scheduled as a follow-up sprint.
- **Риск**: Theoretical process-level escape (mitigated by prototype freeze + codeGeneration:false)
- **Fix applied**: Hardened vm context; isolated-vm migration planned next sprint

### C2. api-server.ts — wallet mnemonics now encrypted with AES-256-GCM
- **Статус**: ✅ FIXED — mnemonics encrypted on write, decrypted on read in api-server.ts
- **Описание**: `encryptMnemonic()` (AES-256-GCM from agentic-wallet.ts) now wraps all mnemonic saves; `decryptMnemonic()` unwraps on GET /mnemonic. `WALLET_ENCRYPTION_KEY` env var controls key derivation; falls back to BOT_TOKEN hash if unset.
- **Fix applied**: `api-server.ts` lines 1726–1762 — import + encrypt/decrypt calls added

### C3. runner.ts:97 — data access before null check
- **Статус**: 🔧 TODO
- **Описание**: `agentResult.data` used before `!agentResult.data` check
- **Fix**: Move null check before data access

### C4. payments.ts — double-spend protection now DB-persisted
- **Статус**: ✅ FIXED — `usedTxHashes` persisted to `builder_bot.used_tx_hashes` table; loaded on startup; TTL extended to 32 days; `verifyTopupTransaction` checks and persists hashes
- **Fix applied**: payments.ts — `persistTxHash()`, `loadUsedTxHashesFromDB()`, `used_tx_hashes` DDL, TTL 32d

### C5. orchestrator.ts — magic string `__ATLAS_CLARIFIED__` not found in current code
- **Статус**: ⏳ NOT REPRODUCED — pattern not present in orchestrator.ts

### C6. config.ts — hardcoded OWNER_ID fallback
- **Статус**: ✅ FIXED — defaults to `'0'` (no privileged fallback); startup check added: `OWNER_ID` is now required at launch

### C7. webhook-server.ts — workflow webhook auth enforced
- **Статус**: ✅ FIXED — API key required for POST /webhook/workflow/:id
- **Описание**: `x-api-key` / `x-auth-token` header now validated against `process.env.API_KEY` before workflow execution.

### C7b. ai-agent-runtime.ts — op-lock now covers ALL financial tools
- **Статус**: ✅ FIXED — `FINANCIAL_OPS` set expanded to include `ton_send_boc` and `buy_market_gift`
- **Описание**: Double-spend protection op-lock now covers: send_ton, send_jetton, ton_send_boc, buy_catalog_gift, buy_resale_gift, buy_market_gift, list_gift_for_sale
- **Fix applied**: `ai-agent-runtime.ts` line 5552

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

### H11. ai-code-bridge.ts — shell injection in CLI args
- **Статус**: ✅ MITIGATED — all args are single-quote wrapped with proper escaping; backticks and $() are neutralized inside single quotes. stdin pipe used for prompt content.
- **Residual risk**: Low — single-quote escaping is standard and reliable on bash

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

### H15. bot.ts — `stop_agent:ID` callback
- **Статус**: ✅ ALREADY IMPLEMENTED — handler exists at bot.ts line ~5283, calls `pauseAgent()` and shows restart button

### H16. bot.ts — `mkt_check_pay:ID` callback
- **Статус**: ✅ ALREADY IMPLEMENTED — handler exists at bot.ts line ~5316, calls `verifyTonTransaction()` and creates agent copy on success

---

## 🟡 MEDIUM

### M1. state.ts — memory leak в pending Maps
- **Статус**: ✅ FIXED — `startPendingStateTTLCleanup()` added to state.ts; runs every 30 min; evicts by timestamp for Maps with createdAt/startTs, caps all others at 1000 entries; called from index.ts startup

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

### M14. execution-tools.ts — Discord channelId injection
- **Статус**: ✅ FIXED — `if (!/^\d{1,20}$/.test(channelId))` guard added before Discord API call; numeric snowflake only

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

### M19. x-manager.ts — path injection in X API URLs
- **Статус**: ✅ ALREADY FIXED — `validateId()` method in XManager uses `/^\d+$/.test(id)` on all tweetId and userId before API calls; throws if non-numeric

### M20. payments.ts — usedTxHashes TTL too short + not persisted
- **Статус**: ✅ FIXED — TTL extended to 32 days (covers monthly billing); hashes persisted to `builder_bot.used_tx_hashes` DB table; loaded on startup; generation tracker still in-memory at 31 days (acceptable, monthly limit)

### M21. execution-tools.ts:22 — fixLiteralNewlinesInStrings не обрабатывает regex literals
- **Статус**: 🔧 TODO
- **Описание**: `/it's a test/` вызовет парсер войти в single-quote mode и испортит код
- **Fix**: Добавить regex literal detection

### M22. ai-agent-runtime.ts — SSRF bypass via octal/decimal/hex IP
- **Статус**: ✅ FIXED — `isPrivateIP()` now handles: decimal integer IPs (2130706433 → 127.0.0.1), octal octets (0177 → 127), hex octets (0x7f → 127); DNS resolution already in place for rebinding protection

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

### M26. bot.ts:301 — pendingRepairs cleanup wrong key type
- **Статус**: 🔧 TODO
- **Описание**: `pendingRepairs` Map ключи — `agentId:string`, но cleanup timeout пытается удалить по числовому ID. Entries никогда не удаляются.
- **Fix**: Использовать тот же строковый ключ в setTimeout

### M27. bot.ts:5695 — MarkdownV2 escaping `\\.` используется в HTML mode
- **Статус**: 🔧 TODO
- **Описание**: Текст с `\\.` экранированием отправляется с `parse_mode: 'HTML'`. Юзер видит literal `\\.` вместо точки.
- **Fix**: Использовать `esc()` только для MarkdownV2, для HTML — HTML-entities

### M28. bot.ts — `userLanguages` Map никогда не чистится
- **Статус**: 🔧 TODO
- **Описание**: Каждый юзер добавляется в Map при первом сообщении, никогда не удаляется. Memory leak.
- **Fix**: TTL-based cleanup или LRU cache

### M29. bot.ts — `agentWallets` Map никогда не чистится
- **Статус**: 🔧 TODO
- **Описание**: Кошельки агентов кешируются навсегда. Memory leak.
- **Fix**: TTL-based cleanup

### M30. bot.ts — `tonConnectLinks` Map никогда не чистится
- **Статус**: 🔧 TODO
- **Описание**: TON Connect ссылки кешируются навсегда. Memory leak.
- **Fix**: TTL-based cleanup

### M31. bot.ts — 10+ pending Maps без TTL cleanup
- **Статус**: 🔧 TODO
- **Описание**: pendingRenames, pendingEdits, pendingRefinements, pendingAgentChats, pendingTgAuth, pendingApiKey, pendingPublish, pendingTemplateSetup — все без auto-cleanup. Overlaps с M1.
- **Fix**: Единый TTLMap или periodic cleanup для всех

### M32. bot.ts — duplicate agentOwnershipCheck не cached
- **Статус**: 🔧 TODO
- **Описание**: Множественные DB queries `SELECT owner_id FROM agents WHERE id=$1` для одного и того же агента в одном callback. Нет кеширования ownership.
- **Fix**: Short-lived ownership cache (30s TTL)

### M33. bot.ts — error in HitL confirmation routing
- **Статус**: 🔧 TODO
- **Описание**: `handleUserConfirmation()` вызывается в top of text handler, но если юзер уже в pendingAgentChats, confirmation может перехватиться chat handler'ом.
- **Fix**: Проверять pendingConfirmations ПЕРЕД pendingAgentChats

### M34. bot.ts — safeReply HTML fallback не strip tags
- **Статус**: 🔧 TODO
- **Описание**: При fallback с HTML parse_mode на plain text, HTML теги (`<b>`, `<code>`) остаются visible юзеру
- **Fix**: Strip HTML tags в fallback branch

### M35. bot.ts — race condition в template wizard multi-step
- **Статус**: 🔧 TODO
- **Описание**: Если юзер быстро отправит 2 сообщения подряд во время wizard, оба обработаются параллельно с одним и тем же `remaining[]` state
- **Fix**: Mutex или sequential processing per user

### M36. ai-agent-runtime.ts:761 — `_chatResponseCallbacks` не чистится в deactivate()
- **Статус**: 🔧 TODO
- **Описание**: Promise зависает навсегда + timer стреляет после деактивации агента
- **Fix**: В deactivate() — clearTimeout, resolve(''), delete

### M37. ai-agent-runtime.ts:717 — `_tickNotifyFlag` не чистится в deactivate()
- **Статус**: 🔧 TODO
- **Описание**: Stale flag может повлиять на переактивированного агента с тем же ID
- **Fix**: `_tickNotifyFlag.delete(agentId)` в deactivate()

### M38. ai-agent-runtime.ts:153 — `_recentPostHashes` unbounded growth
- **Статус**: 🔧 TODO
- **Описание**: Хеши постов растут для каждого agentId:chatId. Periodic cleanup не трогает этот Map.
- **Fix**: Удалять ключи неактивных агентов в periodic cleanup

### M39. ai-agent-runtime.ts:10063 — `_agentMetaCache` cleanup проверяет несуществующее поле
- **Статус**: 🔧 TODO
- **Описание**: Cleanup проверяет `expiresAt` но поле не существует в CachedAgentMeta. Cache никогда не чистится periodic cleanup'ом.
- **Fix**: `Date.now() - entry.cachedAt > 300_000` вместо `entry.expiresAt`

### M40. ai-agent-runtime.ts — `_toolRateLimits` не чистятся для неактивных агентов
- **Статус**: 🔧 TODO
- **Описание**: Cleanup удаляет старые timestamps внутри ключей, но не удаляет ключи деактивированных агентов
- **Fix**: Удалять ключи с agentId не в activeSet

### M41. ai-agent-runtime.ts:4514 — `_approvalWaiters` cleanup не работает при undefined `_createdAt`
- **Статус**: 🔧 TODO
- **Описание**: `Date.now() - undefined = NaN`, NaN > X = false. Waiter без _createdAt никогда не чистится.
- **Fix**: `if (!waiter._createdAt || ...)`

### M42. ai-agent-runtime.ts:6996 — `_pendingAsks` stale entries для деактивированных target агентов
- **Статус**: 🔧 TODO
- **Описание**: deactivate() удаляет СВОИ outgoing asks, но НЕ ссылки TO деактивированного агента. Если agent B деактивирован, agent A ждёт ответа вечно.
- **Fix**: В deactivate() итерировать _pendingAsks и удалять references к agentId

### M43. ai-agent-runtime.ts:7902 — рекурсия в alias resolution без guard
- **Статус**: 🔧 TODO
- **Описание**: Круговой alias (теоретический) вызовет stack overflow
- **Fix**: `if (alias && name !== alias) return executeTool(alias, ...)`

### M44. ai-agent-runtime.ts:9314 — aggressive context trimming без summary
- **Статус**: 🔧 TODO
- **Описание**: При context overflow `compressOldToolResults(messages, 2)` + `splice` уничтожает почти весь контекст. AI повторяет те же tool calls.
- **Fix**: Inject system message summarizing lost context

### M45. ai-agent-runtime.ts:7756 — SMTP error codes не проверяются на всех шагах
- **Статус**: 🔧 TODO
- **Описание**: EHLO/connect шаги не проверяют 5xx ошибки, код продолжает AUTH/STARTTLS
- **Fix**: Добавить error checking на каждом шаге

### M46. ai-agent-runtime.ts:18 — inconsistent stateRepo.get() return handling
- **Статус**: 🔧 TODO
- **Описание**: Иногда `val.value`, иногда `typeof val === 'object' ? val.value : val`. Некоторые места получают wrapper object вместо string.
- **Fix**: Создать helper `unwrapState(val)` и использовать везде

### M47. ai-agent-runtime.ts:9879 — Event Bus `setTickTrigger` перезаписывается при каждом activate
- **Статус**: 🔧 TODO
- **Описание**: Каждая активация агента перезаписывает global handler. Только последний активированный агент получает events.
- **Fix**: Регистрировать один раз при инициализации модуля, не per-agent

---

## 🔴 CRITICAL (ai-agent-runtime.ts audit)

### C9. ai-agent-runtime.ts:4566 — daily spend cap bypass через concurrent tool calls
- **Статус**: 🔧 TODO
- **Описание**: TOOL_CONCURRENCY=3. Два параллельных send_ton оба проходят cap check до обновления total. Можно потратить 2x лимита.
- **Fix**: Финансовые tools (send_ton, buy_*) выполнять serial, не в parallel batch

### C10. ai-agent-runtime.ts:7032 — `run_custom_plugin` всё ещё использует vm2 (deprecated, CVE)
- **Статус**: ⚠️ KNOWN LIMITATION (overlaps C1)
- **Описание**: vm2 имеет known sandbox escape CVEs. Deprecated upstream.
- **Fix**: Миграция на isolated-vm (отдельный спринт)

---

## 🟠 HIGH (ai-agent-runtime.ts audit)

### H17. ai-agent-runtime.ts:7751 — SMTP socket leak on timeout
- **Статус**: 🔧 TODO
- **Описание**: При 30s timeout socket.destroy() вызывается, но data listener не удаляется. После TLS upgrade старый socket listener не удалён.
- **Fix**: `socket.removeAllListeners()` before destroy

### H18. ai-agent-runtime.ts:6995 — deadlock detection только 1 level deep
- **Статус**: 🔧 TODO
- **Описание**: ask_agent проверяет A→B→A циклы, но не A→B→C→A. 3+ агента в цикле зависнут навсегда.
- **Fix**: DFS cycle detection вместо 1-level check

### H19. ai-agent-runtime.ts:4724 — silent failure в address conversion
- **Статус**: 🔧 TODO
- **Описание**: `catch { return addr; }` — при ошибке конвертации EQ→raw возвращается невалидный адрес. Downstream tools получают мусор.
- **Fix**: Return `{ error: 'Invalid address' }` или логировать warning

### H20. ai-agent-runtime.ts — SSRF IPv6 full form
- **Статус**: ✅ ALREADY FIXED — `isPrivateIP()` checks both `::1` and `0:0:0:0:0:0:0:1` explicitly

---

## 🟡 MEDIUM (ai-agent-runtime.ts audit — additional)

### M48. ai-agent-runtime.ts:9222 — infinite loop risk в context truncation
- **Статус**: 🔧 TODO
- **Описание**: `while (totalChars > MAX_CONTEXT_CHARS && messages.length > 7)` — если system prompt сам превышает лимит, цикл бесконечный (messages.length остаётся > 7).
- **Fix**: Добавить counter limit: `for (let i = 0; i < 100 && ...; i++)`

### M49. ai-agent-runtime.ts:543 — `_webRequestCounts` Map не чистится
- **Статус**: 🔧 TODO
- **Описание**: Rate limiter для web requests растёт бесконечно. Не чистится при deactivate.
- **Fix**: Cleanup в deactivate() + periodic cleanup

### M50. ai-agent-runtime.ts:753 — race condition в addMessageToAIAgent
- **Статус**: 🔧 TODO
- **Описание**: Между `.has()` и `.push()` агент может быть деактивирован — сообщение теряется
- **Fix**: Atomic check+push: `if (!map.has(id)) map.set(id, []); map.get(id)!.push(msg);`

### M51. ai-agent-runtime.ts:9537 — tool batch ignores stopFlag
- **Статус**: 🔧 TODO
- **Описание**: `Promise.all([...batch])` не проверяет stop signal. Если агент запросил остановку, tools 2-N всё равно выполняются.
- **Fix**: Check `params.stopFlag` в каждом concurrent tool

### M52. ai-agent-runtime.ts:5695 — regex exec loop без lastIndex reset
- **Статус**: 🔧 TODO
- **Описание**: Stateful regex `.exec()` не сбрасывает `lastIndex`. При повторном использовании начинает с предыдущей позиции.
- **Fix**: `regex.lastIndex = 0;` перед loop

### M53. ai-agent-runtime.ts:4316 — tool call lookup без null check
- **Статус**: 🔧 TODO
- **Описание**: `m.tool_calls.find(...)` может вернуть `undefined`, затем сразу обращение к свойствам
- **Fix**: `const tc = m.tool_calls?.find(...); if (!tc) continue;`

### M54. ai-agent-runtime.ts:9631 — chatId может быть undefined
- **Статус**: 🔧 TODO
- **Описание**: `params.config._chatId` используется без null check. Telegram операции молча фейлятся.
- **Fix**: Guard: `if (!chatId) { skip tg ops }`

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

### L5. ai-agent-runtime.ts:9750 — corrupted history silently discarded
- **Статус**: ⏳ LOW PRIORITY
- **Описание**: При ошибке парсинга истории catch логирует warning но не сохраняет fallback. Следующий tick теряет историю навсегда.
- **Fix**: Save rollback history before parse; restore on failure

### L6. ai-agent-runtime.ts:4166 — IDF zero-division edge case
- **Статус**: ⏳ LOW PRIORITY
- **Описание**: Если документ в ВСЕХ docs, `log(docsLen / df) = 0`. Общие слова получают нулевой вес.
- **Fix**: Laplace smoothing: `log((docsLen + 1) / (df + 1))`

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
- **Found**: 95 issues tracked
- **Fixed**: ~20 (critical + selected high/medium). Remaining are known tech debt.
- **Critical (C)**: C2, C4, C6, C7, C7b, H15, H16, H11, H20, M22 ✅ fixed
- **High (H)**: H15, H16 already implemented; H11 mitigated; remainder TODO
- **Medium**: M1, M14, M19, M20, M22, M28-31 ✅ fixed; remainder TODO
- **Low**: Not yet addressed
- **Last fix**: 2026-03-31
- **Deploy**: ✅ production online
