# TON Agent Platform — Hackathon Plan (21 марта 2026)

## Проблемы которые УБИВАЮТ продукт прямо сейчас

### 1. Gemini/Google AI не работает (КРИТИЧНО)
- `resolveProvider()` в `ai-agent-runtime.ts:49-59` знает только OpenAI, Anthropic, Groq
- Юзер выбирает "Gemini" → ключ отправляется на `api.openai.com` → 404
- **Фикс**: добавить Gemini + OpenRouter + произвольный URL

### 2. Шаблоны доминируют над свободным созданием
- `orchestrator.ts:657-699`: regex-матч шаблонов ВСЕГДА первый
- Юзер пишет "арбитражник подарков" → regex ловит "подарок" → суёт в gift-monitor
- AI-генерация — это запасной fallback, а должно быть наоборот
- **Фикс**: AI-first подход. Шаблоны = подсказки, а не обязательный путь

### 3. Нельзя легко добавить API ключ к агенту
- Единственный способ: через wizard шаблона при создании
- "Редактирование" агента не понимает "добавь апи ключ"
- Smart config detection (`bot.ts:3158-3177`) знает только TON адреса и числовые параметры
- **Фикс**: распознавать API ключи в edit flow + UI кнопка "Настройки" в меню агента

### 4. Chat с агентом ломается без AI ключа
- `bot.ts:2892` — при попытке поговорить с агентом без AI_API_KEY → крэш
- Нет fallback на платформенный AI (proxy)
- **Фикс**: fallback на платформенный AI для чата + понятное сообщение

### 5. UX перегружен и запутан
- 8+ pendingMap'ов (pendingCreations, pendingEdits, pendingTemplateSetup, pendingRenames, pendingPublish, pendingRepairs, pendingAgentChats, pendingWithdrawal, pendingTgAuth, pendingTopup, pendingNameAsk)
- Юзер теряется между состояниями
- **Фикс**: унифицированная state machine + inline keyboards вместо текстового ввода

---

## АРХИТЕКТУРНАЯ РЕВОЛЮЦИЯ: AI-First Agents

### Текущая архитектура (плохая):
```
Юзер → Regex template match → Шаблон кода → VM2 sandbox → Scheduled execution
                                    ↓ (fallback)
                              AI Code Generation → VM2 sandbox
```

### Новая архитектура (правильная):
```
Юзер → AI понимает задачу → Создаёт AI Agent (system prompt + tools)
                           → Агент СРАЗУ работает
                           → Агент САМ решает что делать и когда
                           → Юзер общается с агентом в чате
```

### Ключевые принципы:
1. **ВСЕ агенты = AI agents** (тип `ai_agent` по умолчанию)
2. **Код не нужен** — AI получает system prompt + набор tools
3. **Мультипровайдер** — Gemini Flash (дешёвый), OpenAI, Claude, Groq, OpenRouter
4. **Агент = живая сущность** с памятью, tools, коммуникацией
5. **Платформа = рантайм** для агентов, а не генератор скриптов

---

## ФАЗЫ РЕАЛИЗАЦИИ (15 дней до хакатона)

---

### ФАЗА 1: CORE FIX (День 1-2) — Всё должно работать
**Приоритет: КРИТИЧЕСКИЙ**

#### 1.1 Мультипровайдер AI
**Файл**: `src/agents/ai-agent-runtime.ts:49-59`

Добавить провайдеры:
```
Gemini     → https://generativelanguage.googleapis.com/v1beta/openai/
OpenRouter → https://openrouter.ai/api/v1
Together   → https://api.together.xyz/v1
DeepSeek   → https://api.deepseek.com/v1
Local      → http://127.0.0.1:8317/v1 (CLIProxyAPIPlus)
Custom URL → любой OpenAI-compatible endpoint
```

Модели по умолчанию:
- Gemini: `gemini-2.5-flash` (дешёвый, быстрый, 1M контекст)
- OpenAI: `gpt-4o-mini`
- Groq: `llama-3.3-70b-versatile`
- DeepSeek: `deepseek-chat`
- Anthropic: `claude-haiku-4-5-20251001`

#### 1.2 Smart API Key Detection в Edit Flow
**Файл**: `src/bot.ts:3158-3177`

Добавить распознавание:
- `AIzaSy...` → Gemini ключ → `config.AI_PROVIDER='Gemini'`, `config.AI_API_KEY=...`
- `sk-...` → OpenAI ключ → `config.AI_PROVIDER='OpenAI'`, `config.AI_API_KEY=...`
- `sk-ant-...` → Anthropic ключ → `config.AI_PROVIDER='Anthropic'`, `config.AI_API_KEY=...`
- `gsk_...` → Groq ключ → `config.AI_PROVIDER='Groq'`, `config.AI_API_KEY=...`

Юзер пишет: "добавь ему апи gemini=AIzaSy..." → парсим, сохраняем в config.

#### 1.3 UI кнопка "Настройки" в меню агента
**Файл**: `src/bot.ts` (showAgentMenu ~line 3821)

Новая кнопка: `⚙️ Настройки` → callback `agent_settings:ID`
Показывает:
- AI провайдер: [текущий или "не настроен"]
- AI ключ: `AIzaS...***` (маскированный)
- Модель: [текущая]
- Интервал: [текущий]
- Кнопки: "Сменить провайдер", "Добавить ключ", "Сменить модель"

#### 1.4 Fallback AI для чата
**Файл**: `src/bot.ts:2840-2893`

Если у агента нет `AI_API_KEY` → использовать платформенный proxy (CLIProxyAPIPlus) для чата.
Не крашить с 404, а ответить через платформенный AI.

---

### ФАЗА 2: AI-FIRST CREATION (День 2-4) — Создание без шаблонов
**Приоритет: ВЫСОКИЙ**

#### 2.1 Переосмыслить handleCreateAgent()
**Файл**: `src/agents/orchestrator.ts:611-699`

Новый flow:
```
1. Юзер описывает задачу на естественном языке
2. AI АНАЛИЗИРУЕТ задачу (через платформенный proxy)
3. AI ГЕНЕРИРУЕТ:
   - system_prompt для агента
   - список нужных tools
   - предложение по провайдеру + расписанию
4. Создаётся ai_agent (НЕ VM2 скрипт)
5. Если у юзера есть API ключ → сразу запускается
6. Если нет → "Добавь API ключ чтобы запустить"
```

Шаблоны остаются как **готовые рецепты** в маркетплейсе, но НЕ перехватывают создание.

#### 2.2 Убрать regex template matching из основного flow
**Файл**: `src/agents/orchestrator.ts:655-699`

- Regex match → УДАЛИТЬ из handleCreateAgent
- Шаблоны доступны ТОЛЬКО через маркетплейс (кнопка "Маркетплейс")
- Свободное создание всегда через AI

#### 2.3 Умный system prompt generator
**Новая функция** в orchestrator:

AI на платформенном proxy генерирует system prompt для агента:
```
Input:  "хочу арбитражника подарков"
Output: {
  systemPrompt: "Ты — AI-арбитражник Telegram подарков. Твоя задача:
    1) Каждый тик сканируй цены подарков через scan_real_arbitrage
    2) Если спред > 10% — уведоми пользователя через notify
    3) При одобрении — покупай через buy_catalog_gift
    ...",
  suggestedTools: ["scan_real_arbitrage", "get_gift_floor_real", "notify", "get_state", "set_state"],
  suggestedProvider: "Gemini 2.5 Flash (дешёвый, 1000 RPD бесплатно)",
  suggestedInterval: 300000  // 5 мин
}
```

#### 2.4 Первый запуск без API ключа
Если юзер не задал ключ:
1. Показать "Для работы агента нужен AI. Выберите провайдер:"
2. Inline кнопки: `Gemini (бесплатно)` | `OpenAI` | `Groq (бесплатно)` | `Свой`
3. После выбора: "Вставьте API ключ:"
4. Сохраняем, запускаем

---

### ФАЗА 3: AGENT UX REVOLUTION (День 4-7) — Интуитивный интерфейс
**Приоритет: ВЫСОКИЙ**

#### 3.1 Унифицированный Start Flow
Когда юзер нажимает /start или заходит впервые:

```
👋 Привет! Я платформа AI-агентов на TON.

Напиши что хочешь автоматизировать — я создам агента.

Примеры:
• "Следи за ценой подарка Love Potion и уведоми если дешевле 3 TON"
• "Арбитражь подарки — покупай дешёвые, продавай дорогие"
• "Мониторь мой кошелёк EQ... и алерти если баланс < 5 TON"
• "Каждое утро присылай отчёт по крипторынку"

Или выбери готовый рецепт: [🏪 Маркетплейс]
```

БЕЗ лишних кнопок, БЕЗ меню с 10 пунктами.

#### 3.2 Inline настройка при создании (НЕ text input)
Вместо "введите значение" — inline keyboards:

**Выбор провайдера:**
```
🧠 Выберите AI для агента:
[Google Gemini ⚡] [OpenAI 🔮]
[Groq (бесплатно)] [Свой URL]
```

**Вставка ключа:**
```
🔑 Вставьте API ключ Gemini:
(получить: https://aistudio.google.com/apikey)
```

**Расписание:**
```
⏰ Как часто запускать?
[Каждую минуту] [Каждые 5 мин]
[Каждый час] [Раз в день]
```

#### 3.3 Лайв-дашборд агента
После создания → компактная карточка:

```
🤖 Арбитражник подарков  #107
━━━━━━━━━━━━━━━━━━━━━━━━
🟢 Активен · Gemini 2.5 Flash
⏱ Каждые 5 мин · Тиков: 42
📊 Найдено сделок: 3

[💬 Чат] [⏸ Стоп] [⚙️ Настройки]
[📋 Логи] [🗑 Удалить]
```

#### 3.4 Менеджер API ключей (глобальный)
В профиле юзера — раздел "Мои AI ключи":

```
🔑 Мои AI ключи:
• Gemini: AIzaS...***Do ✅
• OpenAI: не настроен
• Groq: не настроен

Ключи используются всеми агентами по умолчанию.
Можно задать отдельный ключ для конкретного агента.

[➕ Добавить ключ] [📝 Изменить]
```

Хранить ключи в `UserSettings` (`user_settings` table), использовать как default для новых агентов.

---

### ФАЗА 4: REAL AGENT TOOLS (День 7-10) — Суперспособности
**Приоритет: СРЕДНИЙ-ВЫСОКИЙ**

#### 4.1 Расширенный набор tools для AI agents
Текущие tools: 19 штук. Нужно добавить:

**Веб и данные:**
- `web_search` — поиск в интернете (через Serper/SerpAPI/DuckDuckGo)
- `fetch_url` — HTTP GET любого URL, парсинг JSON/HTML
- `fetch_json_api` — вызов любого REST API

**TON Blockchain:**
- `ton_get_transactions` — история транзакций кошелька
- `ton_get_jettons` — баланс жеттонов
- `ton_send_transaction` — отправка TON (с подтверждением юзера)
- `ton_deploy_contract` — деплой простого контракта

**Telegram:**
- `tg_send_message` — отправить сообщение в чат/канал (через MTProto если авторизован)
- `tg_read_channel` — читать последние посты канала
- `tg_search` — поиск по чатам

**Утилиты:**
- `schedule_task` — запланировать одноразовую задачу
- `create_sub_agent` — агент создаёт подагента для подзадачи
- `run_code` — выполнить JS/Python код (VM2 sandbox)

#### 4.2 Persistent Memory для агентов
Текущий `get_state`/`set_state` хранит key-value. Нужно:
- **Conversation memory** — агент помнит историю разговоров
- **Knowledge base** — агент может сохранять заметки и факты
- **Learning** — агент анализирует свои ошибки и улучшается

#### 4.3 Human-in-the-Loop
Агент может спросить юзера перед важным действием:
```
🤖 Арбитражник: Нашёл сделку!
Love Potion: купить за 2.1 TON, продать за 2.8 TON
Профит: 0.7 TON (33%)

Выполнить? [✅ Да] [❌ Нет] [⚙️ Автоматизировать]
```

Если юзер нажимает "Автоматизировать" → агент запоминает и больше не спрашивает.

---

### ФАЗА 5: MULTI-AGENT & COOPERATION (День 10-13)
**Приоритет: СРЕДНИЙ**

#### 5.1 Agent Teams
Юзер создаёт "команду" агентов:
```
📋 Команда "Крипто-стратег":
  🔍 Сканер — мониторит цены
  📊 Аналитик — анализирует тренды
  💰 Трейдер — исполняет сделки
  📢 Репортер — присылает отчёты

Агенты общаются между собой автоматически.
```

#### 5.2 Agent Marketplace 2.0
- Юзеры делятся не кодом, а **system prompts + tool configs**
- Рейтинг и отзывы
- "Форк" агента = скопировать prompt + настройки
- Монетизация через TON

---

### ФАЗА 6: POLISH & HACKATHON PREP (День 13-15)
**Приоритет: КРИТИЧЕСКИЙ**

#### 6.1 Landing Page
- Обновить `dashboard.html` → красивый лендинг
- Демо-видео / GIF агентов в действии
- "Try it now" → ссылка на бот

#### 6.2 Onboarding Flow
- Первый вход: 3-секундный туториал
- Создание первого агента за 30 секунд
- Предложить Gemini Free Tier для старта

#### 6.3 Demo Scenario для хакатона
Подготовить wow-демо:
1. Создать агента одним предложением
2. Агент сразу работает
3. Поговорить с агентом
4. Агент находит арбитраж
5. Показать inter-agent коммуникацию
6. TON транзакция в реальном времени

#### 6.4 Стабильность
- Graceful error handling везде
- Rate limiting для AI вызовов
- Мониторинг через логи
- Health check endpoint

---

## КОНКРЕТНЫЕ ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

| Файл | Что менять | Фаза |
|------|-----------|------|
| `ai-agent-runtime.ts` | resolveProvider(), добавить Gemini/OpenRouter/DeepSeek/custom | 1 |
| `bot.ts:3158` | Smart API key detection в edit flow | 1 |
| `bot.ts:showAgentMenu` | Кнопка "Настройки", callback agent_settings | 1 |
| `bot.ts:2840-2893` | Fallback AI для чата | 1 |
| `orchestrator.ts:655-699` | Убрать regex из основного flow | 2 |
| `orchestrator.ts:handleCreateAgent` | AI-first creation: prompt generator | 2 |
| `bot.ts:sendResult` | Inline keyboards для настройки | 3 |
| `bot.ts:/start` | Новый onboarding flow | 3 |
| `bot.ts:showProfile` | Менеджер API ключей | 3 |
| `ai-agent-runtime.ts:buildToolDefinitions` | Новые tools (web, fetch, tg) | 4 |
| `ai-agent-runtime.ts:executeTool` | Executor для новых tools | 4 |
| `agent-cooperation.ts` | Agent teams | 5 |
| `landing/` | Новый лендинг | 6 |

---

## ПРИОРИТЕТЫ

### MUST HAVE (к хакатону обязательно):
- [x] ~~Domain agentplatform.ton~~
- [x] ~~Реальный вывод TON~~
- [ ] **Gemini + мультипровайдер AI** (Фаза 1.1)
- [ ] **Smart API key в edit flow** (Фаза 1.2)
- [ ] **AI-first создание агентов** (Фаза 2.1-2.3)
- [ ] **Inline UI для настройки** (Фаза 3.2)
- [ ] **Глобальный менеджер ключей** (Фаза 3.4)
- [ ] **web_search + fetch_url tools** (Фаза 4.1 частично)
- [ ] **Demo scenario** (Фаза 6.3)

### SHOULD HAVE (очень желательно):
- [ ] Кнопка "Настройки" в меню агента (Фаза 1.3)
- [ ] Human-in-the-Loop подтверждения (Фаза 4.3)
- [ ] Persistent memory/learning (Фаза 4.2)
- [ ] Красивый лендинг (Фаза 6.1)
- [ ] Onboarding (Фаза 6.2)

### NICE TO HAVE:
- [ ] Agent Teams (Фаза 5)
- [ ] Marketplace 2.0 (Фаза 5.2)
- [ ] create_sub_agent tool (Фаза 4.1)
- [ ] TON contract deploy (Фаза 4.1)

---

## КОНКУРЕНТНОЕ ПРЕИМУЩЕСТВО

Почему мы победим на хакатоне:

1. **Telegram-native** — агенты живут в Telegram, не нужен отдельный сайт
2. **TON-integrated** — реальные транзакции, кошельки, NFT, подарки
3. **Мультипровайдер** — юзер выбирает свой AI (Gemini бесплатно!)
4. **Реальные инструменты** — арбитраж, мониторинг, трейдинг
5. **Inter-agent** — агенты общаются и кооперируют
6. **Human-in-the-Loop** — человек контролирует важные решения
7. **No-code** — просто опиши задачу, AI сделает остальное

vs конкуренты:
- **AutoGPT/AgentGPT** — только чат, нет Telegram/TON
- **CrewAI** — требует код, не для обычных юзеров
- **OpenClaw** — self-hosted, сложная настройка

Мы = **AutoGPT + TON + Telegram + Gift Economy** в одном боте.

---

## АРХИТЕКТУРНЫЕ ДЕТАЛИ (после глубокого анализа кодовой базы)

### Что уже работает (и можно использовать):

1. **`loadUserVariables(userId)`** в `runner.ts:10-17` — загружает глобальные переменные юзера из `user_settings` → `'user_variables'`. Ключи оттуда **уже мёржатся** в agent config при активации (runner.ts:129-131). Значит инфраструктура для глобальных API ключей **уже есть** — нужен только UI.

2. **`UserSettingsRepository.setMerge(userId, key, partial)`** — обновляет только переданные поля, не стирая остальные. Идеально для добавления ключей.

3. **`ai_agent` triggerType** — полноценный agentic loop (до 5 итераций/тик, tool calling, persistent state). Это **уже правильная архитектура** — нужно сделать её основной.

4. **17 tools** уже доступны AI агентам (TON, NFT, gifts, arbitrage, state, notify, Telegram MTProto).

5. **Self-improvement system** — auto-repair агентов с 3+ ошибками, 3 уровня автономности.

6. **Inter-agent** (`ask_agent`, `list_my_agents`) + toggle в меню — уже готово.

### Что критически сломано:

1. **`resolveProvider()`** — 3 провайдера hardcoded (OpenAI, Anthropic, Groq). Нет: Gemini, DeepSeek, OpenRouter, Together, custom URL.

2. **Template regex перехватывает ВСЁ** до AI генерации — `handleCreateAgent()` line 657.

3. **Smart config detection** в edit flow — парсит только TON-адреса и числа, не API ключи.

4. **Chat с агентом** (bot.ts:2840-2893) — при отсутствии AI_API_KEY → crash + непонятная ошибка "404 page not found". Нет fallback.

5. **Model selector** (`/model`) — работает ТОЛЬКО для платформенного AI (генерация кода), НЕ для user agents. Юзеры думают что выбирают модель для своего агента, а на деле нет.

6. **Gemini OpenAI-compatible URL**: `https://generativelanguage.googleapis.com/v1beta/openai/` — это официальный Google endpoint для OpenAI SDK compatibility. Ключ передаётся как Bearer token. Поддерживает function calling.

### Gemini API (подтверждённые данные):

- **Free tier**: 5-15 RPM, 1000 RPD, no credit card needed
- **Paid tier ($5 deposit юзера)**: higher limits
- **Gemini 2.5 Flash**: $0.30/1M input, $2.50/1M output — **самый дешёвый из умных**
- **Function calling**: полностью поддерживается через OpenAI-совместимый API
- **Thinking budget**: можно контролировать глубину рассуждений
- **1M token context** — можно загружать огромный контекст

### OpenClaw (конкурент, ключевые идеи):

- **Session isolation** — каждый чат = отдельная сессия с состоянием
- **Skill registry** — bundled/managed/workspace skills с auto-discovery через ClawHub
- **sessions_send** — агенты общаются через сессии (аналог нашего ask_agent)
- **Multi-channel** — 20+ платформ (мы пока только Telegram — но это наш фокус)
- **Node tools** — `system.run`, `camera.snap`, `screen.record` (у нас аналог: VM2 sandbox + MTProto)
- **DM pairing** — безопасность через pairing codes (у нас: Telegram auth built-in)

### Конкретный план мёржа user_variables:

```
runner.ts:129 уже делает:
  const userVarsAI = await loadUserVariables(userId);
  // Returns: { AI_PROVIDER: 'Gemini', AI_API_KEY: 'AIza...', TONAPI_KEY: '...' }

  const mergedConfigAI = { ...userVarsAI, ...triggerConfig.config };
  // Agent-specific config overrides user-level defaults
```

Значит если юзер сохранит `AI_PROVIDER='Gemini'` и `AI_API_KEY='AIzaSy...'` в `user_variables` → ВСЕ его агенты автоматически получат этот ключ при активации. Нужно только:
1. UI в боте для сохранения ключей
2. Исправить `resolveProvider()` чтобы Gemini URL резолвился правильно
