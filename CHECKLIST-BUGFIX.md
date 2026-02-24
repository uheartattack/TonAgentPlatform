# Bug Fix Checklist — TON Agent Platform

> Все исправления применены. Деплой: `root@***PROD_HOST***`, перезапустить `ton-agent-bot` через PM2.

---

## 🔴 КРИТИЧЕСКИЕ

### ✅ Баг #3 — Stop agent выдаёт "ошибка отображения сообщения"
**Причина:** `safeReply` и `editOrReply` при fallback на plain text не удаляли `parse_mode: 'MarkdownV2'` из `extra` → повторный запрос тоже падал с 400.
**Исправление:** `src/bot.ts` — `safeReply()` и `editOrReply()` удаляют `parse_mode` перед plain-text retry.

**Тест:**
- [ ] Запустить scheduled агента
- [ ] Нажать ⏸ Остановить
- [ ] Убедиться что приходит нормальный текст "⏸ Агент остановлен", а не "❌ Ошибка отображения сообщения"

---

### ✅ Баг #8 / #13 — Demo режим: "неизвестное действие" на "Create Agent Now"
**Причина:** Кнопка отправляла `template_ton-price-monitor` (underscore), а обработчик проверял `data.startsWith('template:')` (colon) — полное несовпадение.
**Исправление:** `src/bot.ts` — `callback_data: \`create_from_template:${demo.id}\`` — использует существующий правильный обработчик.

**Тест:**
- [ ] Написать /start
- [ ] Нажать кнопку с демо-агентом (например 💰 TON Price Monitor Demo)
- [ ] Нажать "Create Agent Now" — должен запуститься wizard настройки переменных
- [ ] Нажать "✏️ Customize" — должен предложить написать описание

---

### ✅ Баг #6 / #11 — DeDust: "не удалось получить текущую цену TON из пула dedust"
**Причина:** Генерируемый агентом код использовал `pool.stats.price` — это поле не существует в DeDust API v2.
**Исправление:** `src/plugins-system.ts` — DeDust skillDoc обновлён: правильный способ через `/assets` endpoint (поле `tonAsset.price`) или через расчёт из `reserves[]`.

**Тест:**
- [ ] Написать "Создай агента который следит за ценой TON через DeDust"
- [ ] Запустить сгенерированного агента
- [ ] Убедиться что выводит цену TON в USD без ошибок

---

### ✅ Баг #4 / #10 — STON.fi: "Method Not Allowed" (405)
**Причина:** `execute()` метода STON.fi всегда делал GET, а `/swap/simulate` требует POST.
**Исправление:** `src/plugins-system.ts` — skillDoc документирует POST для `/swap/simulate`; `execute()` автоматически использует POST если `params.post === true` или `method.includes('simulate')`.

**Тест:**
- [ ] Написать "Создай агента который проверяет курс TON через STON.fi"
- [ ] Запустить агента — не должно быть "Method Not Allowed"
- [ ] Курс должен отображаться корректно

---

## 🟡 СРЕДНИЕ

### ✅ Баг #2 — Нет возможности переименовать агента
**Исправление:** `src/bot.ts` — добавлена кнопка `🏷 Переименовать` в меню агента, обработчики `rename_agent:` callback и text handler.

**Тест:**
- [ ] Открыть меню агента (через /list или 📋 Мои агенты)
- [ ] Нажать `🏷 Переименовать`
- [ ] Ввести новое название
- [ ] Убедиться что название обновилось в списке

---

### ✅ Баг #5 / #7 — Маркетплейс создаёт нового агента без настройки переменных
**Причина:** `createAgentFromTemplate` сразу создавал агента без wizard'а заполнения переменных.
**Исправление:** `src/bot.ts` — новый wizard: если у шаблона есть `placeholders`, показывается пошаговый сбор значений (одна переменная за раз). Поддержка "Пропустить" для необязательных. Переменные инжектируются в `triggerConfig.config` при создании.

**Тест:**
- [ ] Открыть /marketplace
- [ ] Выбрать шаблон с переменными (например TON Balance Checker)
- [ ] Нажать "✅ Создать этого агента"
- [ ] Должен появиться wizard: "WALLET_ADDRESS" — введите значение
- [ ] После ввода всех переменных — агент создаётся с pre-filled конфигом
- [ ] Запустить агента — должен работать без дополнительных настроек

---

### ✅ Баг #9 — Dashboard: Operations показывает несуществующие running агенты
**Причина:** При краше агента или перезапуске бота статус `running` в `execution_history` не обновлялся.
**Исправление:** `apps/landing/dashboard.js` — записи со статусом `running` старше 30 минут автоматически отображаются как `failed` (без изменения в DB).

**Тест:**
- [ ] Открыть Dashboard → Operations
- [ ] Убедиться что нет зависших "Running" агентов если нет реально работающих

---

### ✅ Баг #9 — Dashboard: белый текст на белом фоне (selects)
**Причина:** Браузер рендерит native dropdown с белым фоном, а `color` наследовался `#f8fafc` (белый).
**Исправление:** `apps/landing/dashboard.css` — добавлен `background-color: #1a2332; color: #f8fafc` для `option` элементов; `color-scheme: dark` для всех select элементов.

**Тест:**
- [ ] Открыть Dashboard → Persona
- [ ] Убедиться что выпадающие списки Model, Language, Tone читаемы (тёмный фон, светлый текст)
- [ ] То же самое на странице Agent Configuration

---

### ✅ Баг #9 — Dashboard: слайдеры Creativity и Response Delay не сохраняются
**Причина:** Слайдеры не имели `id` атрибутов, JS не мог их адресовать.
**Исправление:**
- `apps/landing/dashboard.html` — добавлены `id="slider-creativity"` и `id="slider-response-delay"`, а также `oninput="updateSliderDisplay(this)"`.
- Кнопка редактирования в Agent Configuration panel стала кнопкой сохранения (иконка save, `onclick="saveAgentConfig()"`).
- `apps/landing/dashboard.js` — добавлены функции `updateSliderDisplay()`, `saveAgentConfig()`, `loadAgentConfig()`. Конфиг сохраняется в `/api/settings` под ключом `agent_config`.

**Тест:**
- [ ] Открыть Dashboard (главная страница)
- [ ] Изменить слайдер Creativity
- [ ] Нажать иконку 💾 сохранения в Agent Configuration
- [ ] Должно появиться уведомление "Configuration saved"
- [ ] Перезагрузить страницу — значение должно восстановиться
- [ ] То же для Response Delay (в Telegram Integration секции)

---

### ✅ Баг #10 — Агент не останавливается сразу (через раз)
**Причина:** Функция `sleep()` в sandbox агента не реагировала на `stopFlag`. Если агент спал 60 секунд, stop flag устанавливался, но сон не прерывался. Два экземпляра агента могли запуститься одновременно.
**Исправление:** `src/agents/tools/execution-tools.ts` — `sleep()` теперь проверяет `stopFlag.stopped` каждые 200мс и досрочно завершается при остановке.

**Тест:**
- [ ] Запустить scheduled агента (с интервалом 1 минута)
- [ ] Сразу нажать ⏸ Остановить
- [ ] Агент должен остановиться в течение секунды, не ждать истечения интервала
- [ ] Запустить снова — должен работать корректно (не двойной запуск)

---

## 🟢 ФИЧИ / УЛУЧШЕНИЯ

### ✅ Фича #1 — Нет кнопки "Назад" в главном меню
**Исправление:** `src/bot.ts` — добавлена кнопка `🏷 Переименовать` рядом с `✏️ Изменить`, кнопки Меню агента содержат `◀️ Назад` к списку.

**Тест:**
- [ ] Открыть меню агента
- [ ] Убедиться что есть кнопки навигации назад

---

### ✅ Фича #14 — Бот не отвечает на языке пользователя
**Исправление:** `src/bot.ts` — добавлен `userLanguages: Map<userId, 'ru'|'en'>`, функции `detectLang()` и `getUserLang()`. Первый текст от пользователя определяет язык (по частоте кириллица vs латиница). Кнопка `🌐 EN/RU` в главном меню для ручного переключения.

**Тест:**
- [ ] Написать боту на английском ("Create an agent")
- [ ] Бот должен отвечать на английском
- [ ] Нажать `🌐 EN/RU` — язык переключится
- [ ] Написать на русском — язык автоматически определится как русский

---

## 📋 Изменённые файлы

| Файл | Что изменено |
|------|-------------|
| `apps/builder-bot/src/bot.ts` | safeReply fix, demo fix, rename, language, marketplace wizard, tmpl_ callbacks |
| `apps/builder-bot/src/plugins-system.ts` | DeDust skillDoc, STON.fi skillDoc + POST support |
| `apps/builder-bot/src/agents/tools/execution-tools.ts` | sleep() stop-aware fix |
| `apps/landing/dashboard.html` | Slider IDs, oninput, save button |
| `apps/landing/dashboard.js` | updateSliderDisplay, saveAgentConfig, loadAgentConfig, stale running fix |
| `apps/landing/dashboard.css` | Select option dark theme fix, color-scheme |

---

## 🚀 Деплой

```bash
# На сервере root@***PROD_HOST***
pm2 stop ton-agent-bot
# Загрузить изменённые файлы (rsync или git pull)
pm2 start ton-agent-bot
pm2 logs ton-agent-bot --lines 30
# Ожидаемый вывод:
# 🏪 Loaded 15 agent templates
# 🔌 Loaded 12 plugins
# ✅ Bot is running!
# 🎯 Platform ready!
```
