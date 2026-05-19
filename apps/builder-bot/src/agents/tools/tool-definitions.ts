import type OpenAI from 'openai';

/**
 * All AI agent tool definitions (OpenAI function_call format).
 * Extracted from ai-agent-runtime.ts to reduce file size.
 *
 * Used by buildToolDefinitions() in ai-agent-runtime.ts.
 */
export function buildBaseToolDefinitions(agentRole?: string): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'task_create',
        description: 'Add a durable task to your task graph (persists across ticks). Use for multi-step work where order matters. Set blocked_by to enforce dependencies (DAG). Auto-cascades: when a task hits status=completed, its ID is removed from every dependent.',
        parameters: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: '1-line task subject (max 500 chars)' },
            details: { type: 'string', description: 'Optional details/notes (max 4000 chars)' },
            blocked_by: { type: 'array', items: { type: 'number' }, description: 'IDs of tasks that must complete first' },
            owner: { type: 'string', description: 'Optional owner label (e.g. agent role)' },
            priority: { type: 'number', description: '1-10 (default 5, higher = more urgent)' },
          },
          required: ['subject'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'task_update',
        description: 'Update an existing task in the graph. Setting status=completed auto-unblocks dependents.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] },
            result: { type: 'string', description: 'Optional final result/notes (max 4000 chars)' },
            details: { type: 'string' },
            priority: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'task_list',
        description: 'List tasks in your graph. Filter by status. Pass only_actionable=true to get pending tasks with no blockers (ready to work on).',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            only_actionable: { type: 'boolean' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'task_get',
        description: 'Get full details of a task by ID.',
        parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'compact',
        description: 'Request context compression on the next iteration. Older tool results will be replaced with placeholders to free token budget. Use when you see your own context filling up with stale tool outputs.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'remember_hybrid',
        description: 'Save a long-term memory chunk with hybrid retrieval (vector + keyword + RRF fusion). Use for: durable facts, lessons learned, summaries, user preferences. Gets embedded automatically via Gemini text-embedding-004 (768d). Searchable via recall_hybrid.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The memory text (max 4000 chars)' },
            source: { type: 'string', description: 'Origin tag: "agent" | "user" | "tool" | "auto-compact" etc.' },
            importance: { type: 'number', description: '0..1 weight, default 0.5. Higher = more relevant in recall filtering.' },
            metadata: { type: 'object', description: 'Arbitrary JSON metadata.' },
          },
          required: ['content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'recall_hybrid',
        description: 'Hybrid-retrieve memories relevant to a query. Combines vector cosine similarity (semantic) with Postgres tsvector keyword match, fused via Reciprocal Rank Fusion. Returns top-K with score + which branch matched (vector / keyword / both).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural-language query — what to find' },
            top_k: { type: 'number', description: '1..20 (default 8)' },
            min_importance: { type: 'number', description: 'Filter: ignore memories below this importance (0..1)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_count_hybrid',
        description: 'How many hybrid-RAG memories are stored for this agent.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mailbox_send',
        description: 'Send a durable message to another of your agents (s09 pattern). Recipient must belong to the same user (security). Persists in builder_bot.agent_mailbox; recipient receives on next tick via mailbox_read.',
        parameters: {
          type: 'object',
          properties: {
            to_agent_id: { type: 'number', description: 'Recipient agent ID (must be yours)' },
            subject: { type: 'string', description: 'Short subject (max 200 chars)' },
            body: { type: 'string', description: 'Message body (max 8000 chars)' },
            metadata: { type: 'object' },
          },
          required: ['to_agent_id', 'body'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mailbox_read',
        description: 'Read messages from your inbox. Default: only unread, latest 10. Marks fetched messages as read.',
        parameters: {
          type: 'object',
          properties: {
            only_unread: { type: 'boolean', description: 'Default true' },
            limit: { type: 'number', description: '1..50, default 10' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bg_schedule',
        description: 'Schedule a background task to wake you up at a future time (session 08 pattern). Persists across bot restarts. Use for: "remind me in 1 hour to recheck X", "every morning at 9 run analysis Y".',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'What to do when the task fires (max 500 chars)' },
            delay_ms: { type: 'number', description: 'Milliseconds from now (min 1000, max 86400000)' },
          },
          required: ['description', 'delay_ms'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bg_list',
        description: 'List your pending background tasks (scheduled but not yet fired).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'task',
        description: 'Delegate a focused subtask to a fresh-context SUBAGENT. The child runs with empty messages (no context pollution), drops the `task` tool itself (no recursion), drops on-chain + cross-agent tools, runs up to 3 iterations, and returns ONLY the final summary text (you do NOT see its tool-call history). Use for: "research X", "validate Y", "summarize Z" — anything that would otherwise bloat your own context. Max 4000 chars in description.',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Clear, self-contained task description. Subagent has no inherited context — spell out what to do.' },
            role: { type: 'string', description: 'Optional role hint for the subagent (e.g. "researcher", "validator"). Max 80 chars.' },
          },
          required: ['description'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'todo_write',
        description: 'Create or update an in-memory checklist for the CURRENT task/session. Use for any multi-step work (3+ subtasks). Statuses: pending | in_progress | completed. Constraint: AT MOST ONE in_progress at a time. The system will auto-remind you to update the list every 3 rounds if items remain open. Best practice: mark as in_progress BEFORE starting the step, completed IMMEDIATELY after. Discards on tick completion.',
        parameters: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string', description: 'Imperative form: "Fetch gift prices", "Send TON to addr"' },
                  activeForm: { type: 'string', description: 'Present continuous: "Fetching gift prices", "Sending TON"' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                },
                required: ['content', 'status'],
              },
              description: 'Full replacement list (not delta). Send the entire updated checklist each call.',
            },
          },
          required: ['todos'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'todo_read',
        description: 'Read your current in-memory checklist. Use to remember what step you are on if context was compacted.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_my_full_state',
        description: 'Deep self-introspection: returns complete agent state — identity (name/role/level/XP), config (with secrets masked), capabilities + their tool lists, enabled skills, wallet+balance, plugins, active goals, recent lessons, MCP servers, 24h tick stats, auto-pause counters. Use when the user asks "what can you do", "what do you have", "what is your config", "are you OK", or when YOU need to verify your own setup before taking a complex action. No args.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_skill',
        description: 'Load full instructions for one of the agent skills listed in the system prompt inventory (gifts, nft, defi, ton-wallet, fragment, telegram-stars, web3-monitor, acton, tolk, func2tolk, ton-blockchain). MANDATORY before picking tools for a domain task — skills contain the correct tool-selection rules. Returns the SKILL.md body (markdown). Spec: https://agentskills.io',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name (e.g. "gifts"). Must match a name from the [AGENT SKILLS] inventory block in the system prompt.' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_skill_references',
        description: 'List supplementary reference files bundled with a skill. Use after read_skill if the body mentions references/ folder. Returns array of filenames; pair with read_skill_reference to load one.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_skill_reference',
        description: 'Read a specific reference file from a skill. Use only after list_skill_references shows the file exists.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
            ref: { type: 'string', description: 'Reference filename (no path traversal allowed)' },
          },
          required: ['name', 'ref'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_ton_balance',
        description: 'Получить баланс TON кошелька агента. Используй для проверки баланса перед send_ton, stonfi_swap_execute, tonstakers_stake. Возвращает баланс в TON.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес (EQ...)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_nft_floor',
        description: '⛔ ТОЛЬКО для настоящих NFT коллекций на TON (TON Punks, TON Diamonds и т.д.) — НЕ для Telegram-подарков (Lol Pop, Jelly Bunny и т.д.). Для подарков используй get_gift_floor_real.',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Адрес NFT коллекции (EQ/UQ/raw) — только настоящие NFT, не подарки' },
            ton_api_key: { type: 'string', description: 'TONAPI_KEY (опционально)' },
          },
          required: ['collection'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_catalog',
        description: 'Получить список доступных Telegram подарков из каталога с ценами',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_fragment_listings',
        description: 'Получить листинги уникального подарка на Fragment (цены перепродажи)',
        parameters: {
          type: 'object',
          properties: {
            gift_slug: { type: 'string', description: 'Slug подарка на Fragment' },
            limit: { type: 'number', description: 'Количество листингов (макс. 50)' },
          },
          required: ['gift_slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'appraise_gift',
        description: 'Оценить уникальный подарок: floor price, средняя цена, последняя продажа',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug подарка' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scan_arbitrage',
        description: '⚠️ УСТАРЕЛО — используй scan_real_arbitrage вместо этого. Данные могут быть неточными.',
        parameters: {
          type: 'object',
          properties: {
            max_price_stars: { type: 'number', description: 'Максимальная цена покупки в Stars' },
            min_profit_pct:  { type: 'number', description: 'Минимальная прибыль в %' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_catalog_gift',
        description: 'Купить подарок из каталога Telegram (требует Stars на балансе бота или userbot)',
        parameters: {
          type: 'object',
          properties: {
            gift_id:      { type: 'string',  description: 'ID подарка из каталога' },
            recipient_id: { type: 'number',  description: 'Telegram user ID получателя' },
            use_userbot:  { type: 'boolean', description: 'Использовать userbot (MTProto) вместо Bot API' },
          },
          required: ['gift_id', 'recipient_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_resale_gift',
        description: 'Купить уникальный подарок с Fragment маркетплейса по slug',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug уникального подарка на Fragment' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_gift_for_sale',
        description: 'Выставить подарок на продажу на Fragment (нужен msg_id подарка в userbot)',
        parameters: {
          type: 'object',
          properties: {
            msg_id:      { type: 'number', description: 'ID сообщения с подарком в userbot' },
            price_stars: { type: 'number', description: 'Цена продажи в Stars' },
          },
          required: ['msg_id', 'price_stars'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_stars_balance',
        description: 'Получить текущий баланс Stars на аккаунте userbot',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_upgrade_stats',
        description: 'Получить статистику апгрейдов подарка — сколько уже улучшено, текущая стоимость апгрейда в Stars, ожидаемый номер следующего. Помогает оценить выгодность апгрейда.',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug/название подарка (например: "homemade-cake", "jelly-bunny")' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_gift_profitability',
        description: 'Полный анализ выгодности подарка: текущая pre-market цена в Stars, стоимость апгрейда, floor price NFT на рынках, потенциальная прибыль. Ответ: стоит ли апгрейдить.',
        parameters: {
          type: 'object',
          properties: {
            slug:       { type: 'string',  description: 'Slug подарка' },
            budget_ton: { type: 'number',  description: 'Максимальный бюджет в TON для покупки' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'smart_buy_gift',
        description: 'УМНАЯ ПОКУПКА ПОДАРКА. Один тул — вся цепочка автоматически: проверка кошелька, поиск на всех маркетах, расчёт комиссий, выбор лучшего варианта, проверка баланса, покупка. Используй ВСЕГДА когда юзер просит купить подарок — НЕ нужно вызывать get_gift_aggregator/get_ton_balance/buy_market_gift по отдельности. Минимум один фильтр обязателен (gift / backdrop / marketplace / max_price_ton). Если юзер сказал "купи NFT с фоном X" без имени — передай {backdrop: "X"}. Если "купи любой подарок на портале до 5 тон" → {marketplace: "portals", max_price_ton: 5}. Поток: 1) Первый вызов с фильтрами → топ-5 кандидатов. 2) Покажи юзеру, спроси. 3) Второй вызов с {candidate_index, confirm_purchase: true} → покупка.',
        parameters: {
          type: 'object',
          properties: {
            gift:           { type: 'string', description: 'Название подарка (опц): "Hex Pot", "Plush Pepe", "Lol Pop"' },
            max_price_ton:  { type: 'number', description: 'Максимальный бюджет в TON (с учётом комиссий и газа)' },
            backdrop:       { type: 'string', description: 'Конкретный фон/бэкдроп (опц): "Mystic Pearl", "Black"' },
            model:          { type: 'string', description: 'Конкретная модель (опц)' },
            marketplace:    { type: 'string', description: 'Конкретный маркет (опц): "portals" | "mrkt" | "getgems" | "tonnel" | "fragment"' },
            recipient:      { type: 'string', description: 'Получатель (опц): @username или telegram user ID' },
            auto_select:    { type: 'boolean', description: 'true = сразу купить самый дешёвый без подтверждения юзера' },
            candidate_index: { type: 'number', description: 'Индекс варианта из предыдущего ответа (для второго вызова)' },
            confirm_purchase: { type: 'boolean', description: 'true = выполнить покупку выбранного варианта' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_market_gift',
        description: 'НИЗКОУРОВНЕВАЯ покупка через прямой tx_payload. Используй ТОЛЬКО если smart_buy_gift не подходит. ВСЕГДА предпочитай smart_buy_gift для покупок.',
        parameters: {
          type: 'object',
          properties: {
            tx_contract:  { type: 'string', description: 'Адрес смарт-контракта (item.tx_contract из get_gift_aggregator)' },
            tx_payload:   { type: 'string', description: 'Base64 BOC payload транзакции (item.tx_payload из get_gift_aggregator)' },
            price_ton:    { type: 'number', description: 'Цена покупки в TON (item.price_ton)' },
            gift_name:    { type: 'string', description: 'Название подарка для уведомления' },
          },
          required: ['tx_contract', 'tx_payload', 'price_ton'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_agent_wallet',
        description: 'Получить или создать TON кошелёк агента. Агент может хранить TON и совершать транзакции. Пользователь должен задепозитить TON на этот адрес.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_daily_spend',
        description: 'Узнать дневной лимит расходов агента и сколько потрачено сегодня (TON)',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_ton',
        description: 'Отправить TON с кошелька агента на указанный адрес (требует предварительного пополнения кошелька агента)',
        parameters: {
          type: 'object',
          properties: {
            to:      { type: 'string', description: 'Адрес получателя (EQ.../UQ...)' },
            amount:  { type: 'number', description: 'Сумма в TON' },
            comment: { type: 'string', description: 'Комментарий к транзакции (опционально)' },
          },
          required: ['to', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_jetton',
        description: 'Отправить Jetton-токен (USDT, NOT и др.) с кошелька агента. Требует предварительного пополнения.',
        parameters: {
          type: 'object',
          properties: {
            to:             { type: 'string', description: 'Адрес получателя (EQ.../UQ...)' },
            jetton_master:  { type: 'string', description: 'Адрес Jetton Master контракта (EQ...)' },
            amount:         { type: 'string', description: 'Сумма в минимальных единицах (nano). Для USDT 6 знаков: 1 USDT = 1000000' },
            comment:        { type: 'string', description: 'Комментарий (опционально)' },
          },
          required: ['to', 'jetton_master', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dex_get_prices',
        description: 'Получить цены токенов на DeDust DEX (USD). Можно искать по символу.',
        parameters: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Символ токена (TON, USDT, NOT и т.д.). Если не указан — вернёт все.' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dex_swap_simulate',
        description: 'Симулировать обмен токенов на STON.fi DEX. Показывает курс и price impact. Популярные адреса: TON=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c, USDT=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs, NOT=EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT. Сначала используй dex_get_prices чтобы найти адрес нужного токена.',
        parameters: {
          type: 'object',
          properties: {
            offer_address: { type: 'string', description: 'Адрес токена для продажи. TON = EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c' },
            ask_address:   { type: 'string', description: 'Адрес токена для покупки. Используй dex_get_prices чтобы найти адрес.' },
            amount:        { type: 'string', description: 'Сумма в nano-единицах (1 TON = 1000000000, 1 USDT = 1000000)' },
            slippage:      { type: 'string', description: 'Допустимый slippage (по умолчанию 0.01 = 1%)' },
          },
          required: ['offer_address', 'ask_address', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_state',
        description: 'Прочитать данные из постоянного хранилища агента. Данные сохраняются между перезапусками. Используй для: настроек, счётчиков, списков, кэша. Пара к set_state. Для множественного чтения — get_state_multi.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Ключ состояния' },
          },
          required: ['key'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_state_multi',
        description: 'Получить несколько ключей состояния за один запрос (batch). Эффективнее чем несколько get_state вызовов.',
        parameters: {
          type: 'object',
          properties: {
            keys: { type: 'array', items: { type: 'string' }, description: 'Массив ключей состояния' },
          },
          required: ['keys'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_state',
        description: 'Записать данные в постоянное хранилище. Сохраняется между перезапусками. Пара к get_state. value может быть строкой, числом или JSON. Используй вместо notify для данных которые не нужно показывать юзеру.',
        parameters: {
          type: 'object',
          properties: {
            key:   { type: 'string', description: 'Ключ состояния' },
            value: { type: 'string', description: 'Значение (строка или JSON-строка)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_state_keys',
        description: 'Показать все сохранённые ключи состояния агента. Используй перед get_state чтобы знать какие ключи существуют.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_shared_state',
        description: 'Получить общее состояние аккаунта (shared между всеми агентами на этом TG аккаунте). Используй для данных, которые нужны всем агентам: адрес кошелька, настройки, общие заметки.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Ключ общего состояния' },
          },
          required: ['key'],
        },
      },
    },
    // ── Self-Awareness tools ──
    {
      type: 'function',
      function: {
        name: 'remember',
        description: 'Запомнить важную информацию от владельца или из опыта. Категории: contact (контакт/канал), fact (факт), preference (предпочтение), task (задача), insight (наблюдение). Всё запомненное будет доступно в каждом тике.',
        parameters: {
          type: 'object',
          properties: {
            key:      { type: 'string', description: 'Короткий ключ (например: owner_channel, wallet, preference)' },
            value:    { type: 'string', description: 'Что запомнить' },
            category: { type: 'string', enum: ['contact', 'fact', 'preference', 'task', 'insight'], description: 'Категория памяти (необязательно, по умолчанию fact)' },
            importance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Важность (high=всегда в контексте, medium=обычная, low=может быть сжата)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'recall',
        description: 'Вспомнить всё что было запомнено через remember. Возвращает все заметки агента.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_self_prompt',
        description: 'Дополнить свой системный промпт новыми инструкциями. НЕ перезаписывает исходный — добавляет в конец. Используй когда владелец просит изменить поведение.',
        parameters: {
          type: 'object',
          properties: {
            addition: { type: 'string', description: 'Дополнительные инструкции для себя (1-3 предложения)' },
          },
          required: ['addition'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_lesson',
        description: 'Сохранить урок/вывод из опыта. Агент учится из ошибок и успехов. Уроки загружаются в каждом тике для контекста.',
        parameters: {
          type: 'object',
          properties: {
            lesson:   { type: 'string', description: 'Что ты узнал (1-2 предложения)' },
            category: { type: 'string', enum: ['error', 'success', 'insight'], description: 'Категория: error (ошибка), success (успех), insight (наблюдение)' },
          },
          required: ['lesson', 'category'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'manage_goals',
        description: 'Управлять своими целями. Агент сам формирует цели из задачи и отмечает выполненные.',
        parameters: {
          type: 'object',
          properties: {
            action:   { type: 'string', enum: ['add', 'complete', 'remove', 'list'], description: 'Действие: add, complete, remove, list' },
            goal:     { type: 'string', description: 'Текст цели (для add/complete/remove)' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Приоритет (для add)' },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_pause',
        description: 'Экстренная остановка. Агент обнаружил проблему и хочет остановиться. Уведомит владельца и деактивирует агента.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Причина остановки (1-2 предложения)' },
          },
          required: ['reason'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'rollback_prompt',
        description: 'Откатить дополнения к системному промпту. Удаляет все добавленные через update_self_prompt инструкции.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Dossier Tools ──────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'get_contact_dossier',
        description: 'Получить досье на контакт. Возвращает: имя, username, кол-во сообщений, интересы, настроение, отношения, заметки.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'Telegram user ID контакта' },
          },
          required: ['user_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_contact_note',
        description: 'Добавить заметку о контакте. Запомнить важное о человеке для будущих разговоров.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'Telegram user ID контакта' },
            note:    { type: 'string', description: 'Заметка (до 200 символов)' },
          },
          required: ['user_id', 'note'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_contact_relationship',
        description: 'Установить уровень отношений с контактом (stranger/acquaintance/regular/friend/vip).',
        parameters: {
          type: 'object',
          properties: {
            user_id:      { type: 'string', description: 'Telegram user ID' },
            relationship: { type: 'string', enum: ['stranger', 'acquaintance', 'regular', 'friend', 'vip'], description: 'Уровень отношений' },
          },
          required: ['user_id', 'relationship'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_chat_dossier',
        description: 'Получить досье на чат/канал. Возвращает: тип, кол-во сообщений, активность, участников, заметки.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Telegram chat ID' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_chat_note',
        description: 'Добавить заметку о чате/канале. Запомнить тему, правила, важное.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Telegram chat ID' },
            note:    { type: 'string', description: 'Заметка (до 200 символов)' },
          },
          required: ['chat_id', 'note'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_contacts',
        description: 'Список всех известных контактов с краткой инфой (имя, статус, интересы). Для полного досье используй get_contact_dossier.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_chat_policy',
        description: 'Установить режим для конкретного чата: active (сам решаю отвечать/реагировать/игнорить), open (отвечаю всем), mention-only (только по упоминанию), disabled (молчу). Используй для управления в каких чатах быть активным.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Telegram chat ID или @username' },
            policy:  { type: 'string', enum: ['active', 'open', 'mention-only', 'disabled'], description: 'Режим для этого чата' },
          },
          required: ['chat_id', 'policy'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_chat_policies',
        description: 'Показать текущие настройки по чатам: какой режим в каком чате (active/open/mention-only/disabled). Также показывает глобальный режим по умолчанию.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Event-Driven Tools ──────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'set_next_wake',
        description: 'Запланировать следующее пробуждение агента. Минимум 1800 сек (30 мин), максимум 7 дней. Для контент-постов используй интервалы 2-6 часов.',
        parameters: {
          type: 'object',
          properties: {
            delay_seconds: { type: 'number', description: 'Через сколько секунд проснуться (1800-604800)' },
            reason:        { type: 'string', description: 'Зачем просыпаться (для контекста в следующем тике)' },
          },
          required: ['delay_seconds', 'reason'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'subscribe_event',
        description: 'Подписаться на событие платформы. Агент проснётся когда событие произойдёт. Типы: price_change (изменение цены), wallet_tx (транзакция кошелька), custom (кастомное от другого агента).',
        parameters: {
          type: 'object',
          properties: {
            event_type: { type: 'string', enum: ['price_change', 'wallet_tx', 'custom'], description: 'Тип события' },
            filter:     { type: 'object', description: 'Фильтр (необязательно). Для price_change: {asset, threshold}. Для wallet_tx: {direction}. Для custom: {name}.' },
          },
          required: ['event_type'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'unsubscribe_event',
        description: 'Отписаться от события. Если тип не указан — отписывается от всех.',
        parameters: {
          type: 'object',
          properties: {
            event_type: { type: 'string', enum: ['price_change', 'wallet_tx', 'custom'], description: 'Тип события (необязательно — без него отписка от всех)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'emit_event',
        description: 'Отправить кастомное событие. Другие агенты, подписанные на custom с подходящим фильтром, проснутся.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Имя события (например: "price_alert", "task_done")' },
            data: { type: 'object', description: 'Данные события (произвольный объект)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_wake_info',
        description: 'Узнать когда следующее запланированное пробуждение и список подписок на события.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_shared_state',
        description: 'Сохранить общее состояние аккаунта (shared между всеми агентами на этом TG аккаунте). Другие агенты на том же аккаунте смогут прочитать это значение.',
        parameters: {
          type: 'object',
          properties: {
            key:   { type: 'string', description: 'Ключ общего состояния' },
            value: { type: 'string', description: 'Значение (строка или JSON-строка)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notify',
        description: 'Отправить уведомление владельцу агента в Telegram. Макс 3 за 10 мин. Используй для важных алертов (цена изменилась, задача выполнена). Для данных — используй set_state. Для форматированных — notify_rich.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Текст уведомления' },
          },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notify_rich',
        description: 'Отправить красивое уведомление с HTML-разметкой и кнопками. Поддерживает <b>жирный</b>, <i>курсив</i>, <code>код</code>.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'HTML-текст уведомления. Используй <b>, <i>, <code> для форматирования.' },
            buttons: {
              type: 'array',
              description: 'Массив кнопок под сообщением (необязательно)',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Текст кнопки' },
                  url: { type: 'string', description: 'URL для перехода (необязательно)' },
                },
                required: ['text'],
              },
            },
          },
          required: ['message'],
        },
      },
    },
    // ── Web tools ─────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Поиск в интернете (Google). Возвращает топ-5 результатов. Используй для: актуальных цен, новостей, документации. Для получения содержимого страницы — используй fetch_url с URL из результатов.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: 'Получить текстовое содержимое веб-страницы по URL (первые 3000 символов).',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL страницы' },
          },
          required: ['url'],
        },
      },
    },
    // ── Tonstakers — liquid staking TON → tsTON ──────────────────
    {
      type: 'function',
      function: {
        name: 'tonstakers_info',
        description: 'Информация о стейкинге Tonstakers: APY, TVL, курс tsTON/TON. Крупнейший liquid staking на TON (70M+ TON, 100K+ юзеров).',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tonstakers_balance',
        description: 'Проверить баланс застейканных tsTON для кошелька.',
        parameters: {
          type: 'object',
          properties: {
            wallet_address: { type: 'string', description: 'Адрес TON кошелька' },
          },
          required: ['wallet_address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tonstakers_stake',
        description: 'Застейкать TON → получить tsTON (liquid staking, ~4.5% APY). Минимум 1 TON. ВАЖНО: спрашивай подтверждение!',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'string', description: 'Сколько TON застейкать (мин. 1)' },
          },
          required: ['amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tonstakers_unstake',
        description: 'Анстейкнуть tsTON → получить TON обратно. Стандартный вывод (ждёт раунд).',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'string', description: 'Сколько tsTON анстейкать' },
          },
          required: ['amount'],
        },
      },
    },
    // ── STON.fi DEX tools — swap TON ↔ jettons ───────────────────
    {
      type: 'function',
      function: {
        name: 'stonfi_swap_quote',
        description: 'Получить котировку свапа на STON.fi DEX — сколько получишь и price impact. Используй ПЕРЕД stonfi_swap_execute чтобы показать юзеру что он получит. Также используй для проверки цен токенов (stonfi_price — упрощённая версия). Поддерживает TON, USDC, USDT и любые jettons.',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Из чего свапаем: "TON", "USDC", "USDT" или адрес jetton' },
            to: { type: 'string', description: 'Во что свапаем: "TON", "USDC", "USDT" или адрес jetton' },
            amount: { type: 'string', description: 'Сколько отправляем (напр. "1.5")' },
          },
          required: ['from', 'to', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'stonfi_swap_execute',
        description: 'Выполнить свап на STON.fi DEX. Отправляет транзакцию из кошелька агента. ВАЖНО: всегда показывай котировку и спрашивай подтверждение!',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Из чего: "TON", "USDC", "USDT" или адрес jetton' },
            to: { type: 'string', description: 'Во что: "TON", "USDC", "USDT" или адрес jetton' },
            amount: { type: 'string', description: 'Сколько отправляем' },
          },
          required: ['from', 'to', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'stonfi_assets',
        description: 'Список доступных активов на STON.fi DEX с ценами в USD.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'stonfi_price',
        description: 'Узнать цену свапа: сколько одного токена стоит в другом (напр. 1 TON = ? USDC).',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Токен (TON, USDC, USDT или адрес)' },
            to: { type: 'string', description: 'Токен для сравнения' },
            amount: { type: 'string', description: 'Количество (по умолчанию 1)' },
          },
          required: ['from', 'to'],
        },
      },
    },
    // ── Bitrefill tools — gift cards, eSIM, mobile top-ups ────────
    {
      type: 'function',
      function: {
        name: 'bitrefill_search',
        description: 'Поиск подарочных карт, eSIM и пополнений мобильного на Bitrefill (1500+ брендов: Amazon, Steam, Netflix, Spotify, Uber). Оплата криптой (USDC, Lightning). Цепочка: bitrefill_search → bitrefill_product (номиналы) → bitrefill_buy (покупка). Для покупки нужны средства на кошельке.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Что ищем (напр. "Netflix", "Steam", "eSIM Turkey")' },
            country: { type: 'string', description: 'Код страны ISO (US, RU, TR, DE). По умолчанию US.' },
            type: { type: 'string', enum: ['giftcard', 'esim'], description: 'Тип: giftcard или esim' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bitrefill_product',
        description: 'Получить детали продукта Bitrefill — доступные номиналы, цены, инструкции по активации.',
        parameters: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'ID продукта из результатов поиска' },
          },
          required: ['product_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bitrefill_buy',
        description: 'Купить подарочную карту или eSIM на Bitrefill. Оплата USDC (Base), Lightning или балансом. ВАЖНО: всегда спрашивай подтверждение у владельца перед покупкой!',
        parameters: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'ID продукта' },
            package_value: { type: 'string', description: 'Номинал (напр. "50", "1 Month", "1GB, 7 Days")' },
            payment_method: { type: 'string', enum: ['lightning', 'usdc_base', 'balance'], description: 'Способ оплаты. По умолчанию lightning.' },
          },
          required: ['product_id', 'package_value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bitrefill_invoice',
        description: 'Проверить статус заказа на Bitrefill по ID инвойса.',
        parameters: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string', description: 'ID инвойса' },
          },
          required: ['invoice_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bitrefill_orders',
        description: 'Список последних заказов на Bitrefill.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Макс. количество (по умолчанию 5)' },
          },
        },
      },
    },
    // ── Telegram Userbot tools (MTProto) ──────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_send_message',
        description: 'Отправить сообщение через подключённый Telegram аккаунт. Основной способ коммуникации. Поддерживает ответы (reply_to), форматирование. Для форматированных сообщений используй tg_send_formatted. Для медиа — tg_send_photo/tg_send_file. chat_id: @username, числовой ID, или ID из tg_get_dialogs.',
        parameters: {
          type: 'object',
          properties: {
            peer:    { type: 'string', description: 'Username (@channel), chat ID, или ссылка на чат' },
            message: { type: 'string', description: 'Текст сообщения' },
          },
          required: ['peer', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_messages',
        description: 'Получить последние сообщения из чата/канала через MTProto',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username или chat ID' },
            limit: { type: 'number', description: 'Количество сообщений (макс 100)' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_channel_info',
        description: 'Получить информацию о канале/группе: название, подписчики, описание',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username или chat ID канала' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_join_channel',
        description: 'Вступить в канал/группу',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username канала/группы' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_leave_channel',
        description: 'Покинуть канал/группу',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username канала/группы' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_dialogs',
        description: 'Получить список чатов (диалогов) аккаунта',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Количество чатов (по умолчанию 20)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_members',
        description: 'Получить участников канала/группы',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username группы/канала' },
            limit: { type: 'number', description: 'Количество (макс 200)' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_search_messages',
        description: 'Поиск сообщений в чате по ключевым словам',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username или chat ID' },
            query: { type: 'string', description: 'Поисковый запрос' },
            limit: { type: 'number', description: 'Количество результатов' },
          },
          required: ['peer', 'query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_user_info',
        description: 'Получить информацию о пользователе Telegram',
        parameters: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'Username или user ID' },
          },
          required: ['user'],
        },
      },
    },
    // ── Extended Telegram Userbot tools ──
    {
      type: 'function',
      function: {
        name: 'tg_reply',
        description: 'Ответить на конкретное сообщение в чате/канале. Можно процитировать часть текста (quote). Используй для обсуждений.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:     { type: 'string', description: 'ID чата/канала или username' },
            reply_to_id: { type: 'number', description: 'ID сообщения на которое отвечаем' },
            text:        { type: 'string', description: 'Текст ответа' },
            quote:       { type: 'string', description: 'Цитата — часть текста оригинального сообщения которую выделяем (необязательно)' },
          },
          required: ['chat_id', 'reply_to_id', 'text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_react',
        description: 'Поставить реакцию (эмодзи) на сообщение. Поддерживает: 👍❤️🔥😂😮😢',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
            emoji:      { type: 'string', description: 'Эмодзи реакции (напр. 👍, ❤️, 🔥)' },
          },
          required: ['chat_id', 'message_id', 'emoji'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_edit',
        description: 'Редактировать своё сообщение в чате/канале',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения для редактирования' },
            new_text:   { type: 'string', description: 'Новый текст сообщения' },
          },
          required: ['chat_id', 'message_id', 'new_text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_forward',
        description: 'Переслать сообщение из одного чата в другой',
        parameters: {
          type: 'object',
          properties: {
            from_chat: { type: 'string', description: 'Чат-источник (ID или username)' },
            msg_id:    { type: 'number', description: 'ID сообщения для пересылки' },
            to_chat:   { type: 'string', description: 'Чат-назначение (ID или username)' },
          },
          required: ['from_chat', 'msg_id', 'to_chat'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_pin',
        description: 'Закрепить сообщение в чате/канале',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения для закрепления' },
            silent:     { type: 'boolean', description: 'Без уведомления (по умолчанию true)' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_mark_read',
        description: 'Пометить все сообщения в чате как прочитанные',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата/канала или username' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_comments',
        description: 'Получить комментарии к посту в канале. Для чтения обсуждений.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID канала или username' },
            post_id: { type: 'number', description: 'ID поста в канале' },
            limit:   { type: 'number', description: 'Количество комментариев (по умолчанию 30)' },
          },
          required: ['chat_id', 'post_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_typing',
        description: 'Показать статус "печатает" в чате. Используй перед отправкой сообщения для естественности.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата или username' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_formatted',
        description: 'Отправить сообщение с HTML-форматированием (жирный, курсив, ссылки, код)',
        parameters: {
          type: 'object',
          properties: {
            chat_id:   { type: 'string', description: 'ID чата/канала или username' },
            html:      { type: 'string', description: 'HTML-текст: <b>bold</b>, <i>italic</i>, <a href="url">link</a>, <code>code</code>' },
            reply_to:  { type: 'number', description: 'ID сообщения для ответа (опционально)' },
          },
          required: ['chat_id', 'html'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_message_by_id',
        description: 'Получить конкретное сообщение по ID',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_unread',
        description: 'Получить список чатов с непрочитанными сообщениями. Используй для мониторинга новых сообщений.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Количество чатов (по умолчанию 10)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_file',
        description: 'Отправить файл/изображение в чат. Файл по URL будет скачан и отправлен.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:  { type: 'string', description: 'ID чата/канала или username' },
            file_url: { type: 'string', description: 'URL файла или путь к файлу' },
            caption:  { type: 'string', description: 'Подпись к файлу (опционально)' },
          },
          required: ['chat_id', 'file_url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_copy_media',
        description: 'Скопировать медиа (фото/видео/GIF/документ) из одного сообщения и отправить в другой чат. Скачивает медиа и пересылает.',
        parameters: {
          type: 'object',
          properties: {
            from_chat_id: { type: 'string', description: 'Чат-источник (ID или username)' },
            message_id:   { type: 'number', description: 'ID сообщения с медиа' },
            to_chat_id:   { type: 'string', description: 'Чат-получатель (ID или username)' },
            caption:      { type: 'string', description: 'Новая подпись (опционально)' },
          },
          required: ['from_chat_id', 'message_id', 'to_chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_media_info',
        description: 'Получить информацию о медиа в сообщении (тип, размер, имя файла) без скачивания.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    // ── Extended Telegram tools ─────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_delete_message',
        description: 'Удалить сообщение(я) в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_ids: { oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }], description: 'ID сообщения или массив ID' },
        }, required: ['chat_id', 'message_ids'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_poll',
        description: 'Создать голосование в чате/канале.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          question: { type: 'string', description: 'Вопрос голосования' },
          options: { type: 'array', items: { type: 'string' }, description: 'Варианты ответа (2-10)' },
          anonymous: { type: 'boolean', description: 'Анонимное (по умолчанию true)' },
          multiple_choice: { type: 'boolean', description: 'Множественный выбор' },
        }, required: ['chat_id', 'question', 'options'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_kick_user',
        description: 'Кикнуть пользователя из группы/канала (без бана, может вернуться).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID или username пользователя' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_ban_user',
        description: 'Забанить пользователя в группе/канале.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID или username пользователя' },
          duration_sec: { type: 'number', description: 'Длительность в секундах (0 = навсегда)' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unban_user',
        description: 'Разбанить пользователя.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID пользователя' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_mute_user',
        description: 'Замутить пользователя (запретить писать) в группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
          user_id: { type: 'string', description: 'ID пользователя' },
          duration_sec: { type: 'number', description: 'На сколько секунд (по умолчанию 3600 = 1 час)' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_admins',
        description: 'Получить список администраторов группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_admin',
        description: 'Назначить пользователя администратором группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID пользователя' },
          rights: { type: 'object', description: 'Права: { post_messages, edit_messages, delete_messages, ban_users, invite_users, pin_messages }' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_invite_link',
        description: 'Создать пригласительную ссылку для группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unpin',
        description: 'Открепить сообщение или все сообщения.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения (если не указать — открепит все)' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_schedule_message',
        description: 'Запланировать отправку сообщения на конкретное время.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
          send_at: { type: 'number', description: 'Unix timestamp когда отправить' },
        }, required: ['chat_id', 'text', 'send_at'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_chat_title',
        description: 'Изменить название группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          title: { type: 'string', description: 'Новое название' },
        }, required: ['chat_id', 'title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_chat_about',
        description: 'Изменить описание (about) группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          about: { type: 'string', description: 'Новое описание' },
        }, required: ['chat_id', 'about'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_chat_photo',
        description: 'Изменить фото группы/канала (загрузить из URL).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          photo_url: { type: 'string', description: 'URL фото' },
        }, required: ['chat_id', 'photo_url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_group',
        description: 'Создать новую группу (чат).',
        parameters: { type: 'object', properties: {
          title: { type: 'string', description: 'Название группы' },
          user_ids: { type: 'array', items: { type: 'string' }, description: 'ID пользователей для добавления' },
        }, required: ['title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_channel',
        description: 'Создать новый канал.',
        parameters: { type: 'object', properties: {
          title: { type: 'string', description: 'Название канала' },
          about: { type: 'string', description: 'Описание канала' },
          megagroup: { type: 'boolean', description: 'Супергруппа вместо канала (по умолчанию false)' },
        }, required: ['title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_invite_users',
        description: 'Пригласить пользователей в группу/канал.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_ids: { type: 'array', items: { type: 'string' }, description: 'ID или usernames пользователей' },
        }, required: ['chat_id', 'user_ids'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_archive_chat',
        description: 'Архивировать чат.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_online_count',
        description: 'Получить количество онлайн-пользователей в группе/канале.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_contact',
        description: 'Поделиться контактом в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          phone: { type: 'string', description: 'Номер телефона' },
          first_name: { type: 'string', description: 'Имя' },
          last_name: { type: 'string', description: 'Фамилия' },
        }, required: ['chat_id', 'phone', 'first_name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_location',
        description: 'Отправить геолокацию в чат.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          lat: { type: 'number', description: 'Широта' },
          lng: { type: 'number', description: 'Долгота' },
        }, required: ['chat_id', 'lat', 'lng'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_history_count',
        description: 'Получить количество сообщений в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_album',
        description: 'Отправить альбом (несколько фото/видео) в чат.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          media_urls: { type: 'array', items: { type: 'string' }, description: 'Массив URL медиафайлов (до 10)' },
          caption: { type: 'string', description: 'Подпись к альбому' },
        }, required: ['chat_id', 'media_urls'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_profile_photos',
        description: 'Получить аватарки пользователя.',
        parameters: { type: 'object', properties: {
          user_id: { type: 'string', description: 'ID или username пользователя' },
          limit: { type: 'number', description: 'Количество (по умолчанию 5)' },
        }, required: ['user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_silent',
        description: 'Отправить сообщение без уведомления (беззвучно).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
        }, required: ['chat_id', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_webpage',
        description: 'Извлечь превью URL (заголовок, описание, изображение).',
        parameters: { type: 'object', properties: {
          url: { type: 'string', description: 'URL для извлечения превью' },
        }, required: ['url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_press_button',
        description: 'Нажать inline-кнопку на сообщении бота.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения с кнопками' },
          button_index: { type: 'number', description: 'Индекс кнопки (0 = первая)' },
        }, required: ['chat_id', 'message_id', 'button_index'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_chat_stats',
        description: 'Получить статистику контента в чате (фото, видео, документы, ссылки, голосовые).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_save_draft',
        description: 'Сохранить черновик сообщения в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст черновика' },
        }, required: ['chat_id', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_with_buttons',
        description: 'Отправить сообщение с inline-кнопками (URL или callback).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
          buttons: { type: 'array', items: { type: 'object', properties: {
            text: { type: 'string', description: 'Текст кнопки' },
            url: { type: 'string', description: 'URL (для URL-кнопки)' },
            data: { type: 'string', description: 'Callback data (для callback-кнопки)' },
          }, required: ['text'] }, description: 'Массив кнопок' },
        }, required: ['chat_id', 'text', 'buttons'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_poll_results',
        description: 'Получить результаты голосования.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения с голосованием' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_sticker',
        description: 'Отправить стикер из стикерпака. Укажи shortName набора и индекс стикера (0 = первый).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          sticker_set_name: { type: 'string', description: 'Short name стикерпака (например: HotCherry)' },
          index: { type: 'number', description: 'Индекс стикера в наборе (0 = первый). По умолчанию 0.' },
        }, required: ['chat_id', 'sticker_set_name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_gif',
        description: 'Найти и отправить GIF через @gif inline-бота. Случайная GIF из топ-5 результатов.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          query: { type: 'string', description: 'Поисковый запрос для GIF (например: "happy", "dance", "thumbs up")' },
        }, required: ['chat_id', 'query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_voice',
        description: 'Озвучить текст (TTS) и отправить голосовым сообщением. Макс 200 символов.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст для озвучки (макс 200 символов)' },
          lang: { type: 'string', description: 'Язык озвучки (ru, en, de, fr и т.д.). По умолчанию ru.' },
        }, required: ['chat_id', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_transcribe_voice',
        description: 'Расшифровать (транскрибировать) голосовое сообщение в текст через встроенный STT Telegram.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата с голосовым сообщением' },
          message_id: { type: 'number', description: 'ID голосового сообщения (из [voice msg_id=X] аннотации)' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_sticker_sets',
        description: 'Получить список установленных стикерпаков пользователя. Можно искать по названию.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'Поисковый запрос для фильтрации (опционально)' },
        }, required: [] },
      },
    },
    // ── Dice / interactive ──
    {
      type: 'function',
      function: {
        name: 'tg_send_dice',
        description: 'Отправить анимированные кубики/дартс/слот/боулинг. Emoji определяет тип: 🎲🎯🏀⚽🎰🎳',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          emoji: { type: 'string', description: 'Тип: 🎲 (кубик), 🎯 (дартс), 🏀 (баскетбол), ⚽ (футбол), 🎰 (слоты), 🎳 (боулинг)', enum: ['🎲','🎯','🏀','⚽','🎰','🎳'] },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_quiz',
        description: 'Создать квиз с правильным ответом. Пользователи видят результат после ответа.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          question: { type: 'string', description: 'Вопрос квиза' },
          options: { type: 'array', items: { type: 'string' }, description: 'Варианты ответов (2-10)' },
          correct_option: { type: 'number', description: 'Индекс правильного ответа (0-based)' },
          explanation: { type: 'string', description: 'Пояснение (показывается после ответа)' },
        }, required: ['chat_id', 'question', 'options', 'correct_option'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_reply_keyboard',
        description: 'Отправить сообщение с кнопками reply keyboard (под полем ввода, не inline).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
          buttons: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Двумерный массив кнопок [[row1btn1, row1btn2], [row2btn1]]' },
          one_time: { type: 'boolean', description: 'Скрыть клавиатуру после нажатия' },
          resize: { type: 'boolean', description: 'Уменьшить размер клавиатуры' },
        }, required: ['chat_id', 'text', 'buttons'] },
      },
    },
    // ── Folder management ──
    {
      type: 'function',
      function: {
        name: 'tg_get_folders',
        description: 'Получить список папок/фильтров чатов пользователя.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_folder',
        description: 'Создать новую папку чатов с фильтрами.',
        parameters: { type: 'object', properties: {
          title: { type: 'string', description: 'Название папки' },
          include_chats: { type: 'array', items: { type: 'string' }, description: 'ID чатов для включения' },
          exclude_chats: { type: 'array', items: { type: 'string' }, description: 'ID чатов для исключения' },
        }, required: ['title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_add_to_folder',
        description: 'Добавить чат в существующую папку.',
        parameters: { type: 'object', properties: {
          folder_id: { type: 'number', description: 'ID папки' },
          chat_id: { type: 'string', description: 'ID чата для добавления' },
        }, required: ['folder_id', 'chat_id'] },
      },
    },
    // ── Sticker management ──
    {
      type: 'function',
      function: {
        name: 'tg_search_stickers',
        description: 'Поиск стикерпаков по ключевому слову.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'Поисковый запрос' },
        }, required: ['query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_add_sticker_set',
        description: 'Установить/добавить стикерпак в свою коллекцию.',
        parameters: { type: 'object', properties: {
          short_name: { type: 'string', description: 'Short name стикерпака (из URL t.me/addstickers/...)' },
        }, required: ['short_name'] },
      },
    },
    // ── User relationships ──
    {
      type: 'function',
      function: {
        name: 'tg_get_blocked',
        description: 'Получить список заблокированных пользователей.',
        parameters: { type: 'object', properties: {
          limit: { type: 'number', description: 'Максимум результатов (по умолчанию 100)' },
        }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_common_chats',
        description: 'Получить общие группы/каналы с пользователем.',
        parameters: { type: 'object', properties: {
          user_id: { type: 'string', description: 'ID или username пользователя' },
        }, required: ['user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_check_username',
        description: 'Проверить доступность username в Telegram.',
        parameters: { type: 'object', properties: {
          username: { type: 'string', description: 'Username для проверки (без @)' },
        }, required: ['username'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_username',
        description: 'Изменить username аккаунта.',
        parameters: { type: 'object', properties: {
          username: { type: 'string', description: 'Новый username (без @, или пустая строка для удаления)' },
        }, required: ['username'] },
      },
    },
    // ── Gift lifecycle ──
    {
      type: 'function',
      function: {
        name: 'tg_transfer_collectible',
        description: 'Передать коллекционный Star Gift NFT другому пользователю. Это НЕОБРАТИМОЕ действие — подарок уйдёт навсегда.\n\nПОТОК: tg_get_received_gifts() → найти подарок → tg_get_collectible_info(slug) → подтверждение у владельца → tg_transfer_collectible(slug, to_user).\n\nВАЖНО:\n- slug берётся из t.me/nft/SLUG ссылки или из tg_get_received_gifts\n- ВСЕГДА подтверждай с владельцем перед передачей (это необратимо!)\n- Если владелец даёт ссылку t.me/nft/X — X это slug, используй tg_get_collectible_info(X) сначала',
        parameters: { type: 'object', properties: {
          gift_id: { type: 'string', description: 'Slug подарка (напр. FreshSocks-31961). Извлекай из ссылки t.me/nft/FreshSocks-31961 или из tg_get_received_gifts' },
          to_user: { type: 'string', description: 'Telegram user ID (числовой) или @username получателя' },
        }, required: ['gift_id', 'to_user'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_gift_visibility',
        description: 'Показать или скрыть коллекционный подарок в профиле Telegram. Скрытые подарки не видны другим пользователям.',
        parameters: { type: 'object', properties: {
          gift_id: { type: 'string', description: 'ID подарка' },
          visible: { type: 'boolean', description: 'true = показать, false = скрыть' },
        }, required: ['gift_id', 'visible'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_stars_transactions',
        description: 'Получить историю транзакций Stars.',
        parameters: { type: 'object', properties: {
          limit: { type: 'number', description: 'Максимум записей (по умолчанию 50)' },
          offset: { type: 'string', description: 'Оффсет для пагинации' },
        }, required: [] },
      },
    },
    // ── Scheduled messages management ──
    {
      type: 'function',
      function: {
        name: 'tg_get_scheduled',
        description: 'Получить список запланированных сообщений в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_delete_scheduled',
        description: 'Удалить запланированное сообщение.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID запланированного сообщения' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_scheduled_now',
        description: 'Отправить запланированное сообщение немедленно.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID запланированного сообщения' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    // ── Channel discovery ──
    {
      type: 'function',
      function: {
        name: 'tg_get_admined_channels',
        description: 'Список каналов/групп где ты админ.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_check_channel_username',
        description: 'Проверить доступность username для канала/группы.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          username: { type: 'string', description: 'Username для проверки' },
        }, required: ['chat_id', 'username'] },
      },
    },
    // ── GIF search ──
    {
      type: 'function',
      function: {
        name: 'tg_search_gifs',
        description: 'Поиск GIF анимаций по запросу.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'Поисковый запрос' },
          limit: { type: 'number', description: 'Максимум результатов (по умолчанию 20)' },
        }, required: ['query'] },
      },
    },
    // ── Profile extras ──
    {
      type: 'function',
      function: {
        name: 'tg_set_personal_channel',
        description: 'Установить личный канал в профиле (отображается у всех).',
        parameters: { type: 'object', properties: {
          channel_id: { type: 'string', description: 'ID канала (или пустая строка для удаления)' },
        }, required: ['channel_id'] },
      },
    },
    // ── Gift advanced ──
    {
      type: 'function',
      function: {
        name: 'tg_get_collectible_info',
        description: 'ПЕРВЫЙ ШАГ при любой работе с подарком. Получает ВСЮ информацию о Telegram Star Gift NFT: владелец, атрибуты (backdrop, symbol, pattern), редкость, текущая цена, доступность.\n\nКОГДА ВЫЗЫВАТЬ:\n- Пользователь прислал ссылку t.me/nft/SLUG → вызови с этим SLUG\n- Перед tg_transfer_collectible (проверить что подарок наш и узнать детали)\n- Перед tg_set_collectible_price (узнать текущую цену)\n- Перед tg_send_gift_offer (узнать владельца)\n\nСЛУГ: извлекай из ссылки t.me/nft/FreshSocks-31961 → slug = "FreshSocks-31961"\n\nВозвращает: owner_id, collection_name, attributes, floor_price, is_for_sale, rarity',
        parameters: { type: 'object', properties: {
          gift_id: { type: 'string', description: 'Slug подарка. Из ссылки t.me/nft/SLUG берётся часть после /nft/. Примеры: "FreshSocks-31961", "PlushPepe-5042", "LolPop-128"' },
        }, required: ['gift_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_unique_gift_value',
        description: 'Оценить рыночную стоимость Star Gift NFT. Возвращает: floor_price, avg_price, last_sale, estimated_value.\n\nПОТОК ОЦЕНКИ: tg_get_collectible_info(slug) → tg_get_unique_gift_value(slug) → решение о цене\n\nИспользуй ПЕРЕД:\n- tg_set_collectible_price — чтобы не продешевить\n- tg_send_gift_offer — чтобы знать адекватную цену\n- Ответом на "сколько стоит мой подарок?"',
        parameters: { type: 'object', properties: {
          gift_id: { type: 'string', description: 'Slug подарка (напр. FreshSocks-31961). Из t.me/nft/SLUG берётся часть после /nft/' },
        }, required: ['gift_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_collectible_price',
        description: 'Выставить свой Star Gift NFT на продажу за Stars или снять с продажи (price=0).\n\nПОТОК ПРОДАЖИ: tg_get_received_gifts() → tg_get_unique_gift_value(slug) → tg_set_collectible_price(slug, price)\n\nВАЖНО:\n- Подарок должен быть НАШИ (проверь через tg_get_received_gifts)\n- Сначала оцени через tg_get_unique_gift_value чтобы не продешевить\n- ВСЕГДА спрашивай подтверждение у владельца перед выставлением',
        parameters: { type: 'object', properties: {
          gift_id: { type: 'string', description: 'Slug подарка (напр. FreshSocks-31961)' },
          price: { type: 'number', description: 'Цена в Stars. 0 = снять с продажи' },
        }, required: ['gift_id', 'price'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_gift_offer',
        description: 'Отправить предложение обмена Star Gift NFT его владельцу. Предлагаешь свой подарок в обмен на чужой.\n\nПОТОК ОБМЕНА:\n1. tg_get_collectible_info(want_slug) → узнать владельца и цену\n2. tg_get_received_gifts() → выбрать свой подарок для обмена\n3. tg_send_gift_offer(owner, my_slug, want_slug)\n\nВАЖНО: ВСЕГДА подтверждай с владельцем перед отправкой оффера',
        parameters: { type: 'object', properties: {
          to_user: { type: 'string', description: 'Username или числовой ID владельца нужного подарка' },
          my_gift_id: { type: 'string', description: 'Slug МОЕГО подарка для обмена (из tg_get_received_gifts)' },
          want_gift_id: { type: 'string', description: 'Slug подарка который хочу получить (из tg_get_collectible_info)' },
          message: { type: 'string', description: 'Сообщение к офферу (опционально)' },
        }, required: ['to_user', 'my_gift_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_resolve_gift_offer',
        description: 'Принять или отклонить оффер обмена подарками.',
        parameters: { type: 'object', properties: {
          offer_id: { type: 'string', description: 'ID оффера' },
          accept: { type: 'boolean', description: 'true = принять, false = отклонить' },
        }, required: ['offer_id', 'accept'] },
      },
    },
    // ── STON.fi DEX ──
    { type: 'function', function: { name: 'stonfi_swap', description: '[PREVIEW] Симуляция свапа на STON.fi — показывает котировку и маршрут. Реальный свап требует подключения кошелька.', parameters: { type: 'object', properties: { from_token: { type: 'string', description: 'Адрес токена для продажи (или TON)' }, to_token: { type: 'string', description: 'Адрес токена для покупки' }, amount: { type: 'number', description: 'Количество токенов (в обычных единицах, не nano)' }, slippage: { type: 'number', description: 'Макс. проскальзывание в % (по умолчанию 1)' } }, required: ['from_token', 'to_token', 'amount'] } } },
    { type: 'function', function: { name: 'stonfi_quote', description: 'Получить котировку свапа на STON.fi без выполнения.', parameters: { type: 'object', properties: { from_token: { type: 'string', description: 'Адрес токена для продажи' }, to_token: { type: 'string', description: 'Адрес токена для покупки' }, amount: { type: 'number', description: 'Количество' } }, required: ['from_token', 'to_token', 'amount'] } } },
    { type: 'function', function: { name: 'stonfi_search', description: 'Поиск токенов на STON.fi по имени или адресу.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Название, тикер или адрес токена' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'stonfi_trending', description: 'Топ трендовых токенов на STON.fi (по объёму).', parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Макс. количество (по умолчанию 10)' } }, required: [] } } },
    { type: 'function', function: { name: 'stonfi_pools', description: 'Список пулов ликвидности на STON.fi.', parameters: { type: 'object', properties: { token: { type: 'string', description: 'Фильтр по токену (опционально)' }, limit: { type: 'number', description: 'Макс. количество' } }, required: [] } } },
    // ── DeDust DEX ──
    { type: 'function', function: { name: 'dedust_swap', description: '[PREVIEW] Симуляция свапа на DeDust — показывает котировку. Реальный свап требует кошелька.', parameters: { type: 'object', properties: { from_token: { type: 'string', description: 'Адрес исходного токена' }, to_token: { type: 'string', description: 'Адрес целевого токена' }, amount: { type: 'number', description: 'Количество (в обычных единицах)' }, slippage: { type: 'number', description: 'Проскальзывание %' } }, required: ['from_token', 'to_token', 'amount'] } } },
    { type: 'function', function: { name: 'dedust_quote', description: 'Котировка свапа на DeDust без выполнения.', parameters: { type: 'object', properties: { from_token: { type: 'string', description: 'Исходный токен' }, to_token: { type: 'string', description: 'Целевой токен' }, amount: { type: 'number', description: 'Количество' } }, required: ['from_token', 'to_token', 'amount'] } } },
    { type: 'function', function: { name: 'dedust_pools', description: 'Список пулов DeDust с ликвидностью и APY.', parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Макс. количество' } }, required: [] } } },
    { type: 'function', function: { name: 'dedust_prices', description: 'Текущие цены токенов на DeDust.', parameters: { type: 'object', properties: { tokens: { type: 'array', items: { type: 'string' }, description: 'Список адресов токенов' } }, required: [] } } },
    { type: 'function', function: { name: 'dedust_token_info', description: 'Информация о токене на DeDust (ликвидность, объём, цена).', parameters: { type: 'object', properties: { token: { type: 'string', description: 'Адрес или тикер токена' } }, required: ['token'] } } },
    // ── TON DNS ──
    { type: 'function', function: { name: 'dns_check', description: 'Проверить доступность .ton домена.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен (например alice.ton)' } }, required: ['domain'] } } },
    { type: 'function', function: { name: 'dns_resolve', description: 'Разрешить .ton домен в адрес кошелька.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен для разрешения' } }, required: ['domain'] } } },
    { type: 'function', function: { name: 'dns_auctions', description: 'Список активных аукционов .ton доменов.', parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Макс. количество' } }, required: [] } } },
    { type: 'function', function: { name: 'dns_start_auction', description: 'Начать аукцион на .ton домен.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен' } }, required: ['domain'] } } },
    { type: 'function', function: { name: 'dns_bid', description: 'Сделать ставку на аукционе .ton домена.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен' }, amount: { type: 'number', description: 'Ставка в TON' } }, required: ['domain', 'amount'] } } },
    { type: 'function', function: { name: 'dns_link', description: 'Привязать .ton домен к кошельку/сайту.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен' }, address: { type: 'string', description: 'Адрес кошелька для привязки' } }, required: ['domain', 'address'] } } },
    { type: 'function', function: { name: 'dns_unlink', description: 'Отвязать .ton домен.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен' } }, required: ['domain'] } } },
    { type: 'function', function: { name: 'dns_set_site', description: 'Привязать сайт к .ton домену (ADNL адрес).', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен' }, site_address: { type: 'string', description: 'ADNL адрес сайта' } }, required: ['domain', 'site_address'] } } },
    { type: 'function', function: { name: 'dns_get_my_domains', description: 'Список всех .ton доменов на указанном кошельке (если не указать — на текущем кошельке агента).', parameters: { type: 'object', properties: { wallet: { type: 'string', description: 'TON-адрес кошелька (опционально)' } } } } },
    { type: 'function', function: { name: 'dns_get_auction', description: 'Детали активного аукциона на конкретный .ton домен: текущий бид, минимальный следующий бид, время окончания, адрес лидера.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен (с .ton или без)' } }, required: ['domain'] } } },
    { type: 'function', function: { name: 'dns_transfer', description: 'Передать .ton домен новому владельцу (NFT transfer). Необратимо — требует подтверждения юзера.', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Домен' }, new_owner: { type: 'string', description: 'TON-адрес нового владельца' }, forward_amount_ton: { type: 'number', description: 'Notification к получателю в TON (0.001-0.1, опционально)' } }, required: ['domain', 'new_owner'] } } },
    // ── Payment verification ──
    { type: 'function', function: { name: 'verify_payment', description: 'Проверить TON платёж на блокчейне с защитой от повторного использования.', parameters: { type: 'object', properties: { wallet: { type: 'string', description: 'Адрес кошелька получателя' }, amount: { type: 'number', description: 'Ожидаемая сумма в TON' }, memo: { type: 'string', description: 'Мемо/комментарий платежа (ID пользователя)' }, max_age_min: { type: 'number', description: 'Макс. возраст платежа в минутах (по умолчанию 10)' } }, required: ['wallet', 'amount', 'memo'] } } },
    // ── Memory/Session search ──
    {
      type: 'function',
      function: {
        name: 'session_search',
        description: 'Поиск по прошлым сессиям агента — резюме, ключевые решения, действия.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'Поисковый запрос' },
          limit: { type: 'number', description: 'Максимум результатов (по умолчанию 10)' },
        }, required: ['query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_read',
        description: 'Прочитать всю постоянную память агента.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Journal / Trading log tools ──
    {
      type: 'function',
      function: {
        name: 'journal_log',
        description: 'Записать сделку/операцию в торговый журнал. Используй для КАЖДОЙ финансовой операции.',
        parameters: { type: 'object', properties: {
          type: { type: 'string', enum: ['trade','gift_buy','gift_sell','send','receive','swap','deal','other'], description: 'Тип операции' },
          asset: { type: 'string', description: 'Актив (TON, USDT, ChillGuy #123, и т.д.)' },
          direction: { type: 'string', enum: ['buy','sell','send','receive'], description: 'Направление' },
          amount: { type: 'number', description: 'Количество' },
          price: { type: 'number', description: 'Цена за единицу (опционально)' },
          reasoning: { type: 'string', description: 'Причина/обоснование сделки' },
          counterparty: { type: 'string', description: 'Контрагент (username или ID)' },
          tx_hash: { type: 'string', description: 'Хеш транзакции в блокчейне' },
        }, required: ['type', 'asset', 'direction', 'amount', 'reasoning'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'journal_query',
        description: 'Поиск и анализ записей торгового журнала. Фильтрация по типу, активу, статусу.',
        parameters: { type: 'object', properties: {
          type: { type: 'string', description: 'Фильтр по типу (trade, gift_buy, swap, etc.)' },
          asset: { type: 'string', description: 'Фильтр по активу' },
          status: { type: 'string', enum: ['open','closed','cancelled'], description: 'Фильтр по статусу' },
          days: { type: 'number', description: 'Период в днях (по умолчанию 30)' },
          limit: { type: 'number', description: 'Максимум записей' },
        }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'journal_update',
        description: 'Обновить запись журнала — добавить P&L, закрыть сделку, добавить tx hash.',
        parameters: { type: 'object', properties: {
          trade_id: { type: 'string', description: 'ID записи' },
          pnl: { type: 'number', description: 'Прибыль/убыток' },
          status: { type: 'string', enum: ['open','closed','cancelled'], description: 'Новый статус' },
          tx_hash: { type: 'string', description: 'Хеш транзакции' },
          reasoning: { type: 'string', description: 'Дополнительное обоснование' },
        }, required: ['trade_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'journal_stats',
        description: 'Статистика торговли: общий P&L, win rate, средний P&L, лучшая/худшая сделка.',
        parameters: { type: 'object', properties: {
          days: { type: 'number', description: 'Период в днях (по умолчанию 30)' },
        }, required: [] },
      },
    },
    // ── Deal system tools ──
    {
      type: 'function',
      function: {
        name: 'deal_propose',
        description: 'Предложить P2P сделку пользователю (обмен подарками, TON, услугами).',
        parameters: { type: 'object', properties: {
          counterparty: { type: 'string', description: 'Username или ID контрагента' },
          offer: { type: 'string', description: 'Что предлагаем (описание)' },
          ask: { type: 'string', description: 'Что просим взамен' },
          amount: { type: 'number', description: 'Сумма в TON (если применимо)' },
          expires_hours: { type: 'number', description: 'Срок действия в часах (по умолчанию 24)' },
        }, required: ['counterparty', 'offer', 'ask'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deal_verify',
        description: 'Проверить оплату/выполнение условий сделки.',
        parameters: { type: 'object', properties: {
          deal_id: { type: 'string', description: 'ID сделки' },
          tx_hash: { type: 'string', description: 'Хеш подтверждающей транзакции' },
        }, required: ['deal_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deal_status',
        description: 'Получить статус конкретной сделки.',
        parameters: { type: 'object', properties: {
          deal_id: { type: 'string', description: 'ID сделки' },
        }, required: ['deal_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deal_list',
        description: 'Список активных сделок.',
        parameters: { type: 'object', properties: {
          status: { type: 'string', enum: ['open','closed','cancelled'], description: 'Фильтр по статусу' },
          limit: { type: 'number', description: 'Максимум записей' },
        }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deal_cancel',
        description: 'Отменить сделку.',
        parameters: { type: 'object', properties: {
          deal_id: { type: 'string', description: 'ID сделки' },
          reason: { type: 'string', description: 'Причина отмены' },
        }, required: ['deal_id'] },
      },
    },
    // ── Profile management tools ──
    {
      type: 'function',
      function: {
        name: 'tg_set_avatar',
        description: 'Установить аватарку профиля из URL изображения.',
        parameters: { type: 'object', properties: {
          photo_url: { type: 'string', description: 'URL изображения для аватарки (JPG/PNG)' },
        }, required: ['photo_url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_delete_avatar',
        description: 'Удалить текущую аватарку профиля.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_bio',
        description: 'Изменить био/описание профиля (макс 70 символов).',
        parameters: { type: 'object', properties: {
          text: { type: 'string', description: 'Новое описание профиля (максимум 70 символов)' },
        }, required: ['text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_name',
        description: 'Изменить имя и фамилию в профиле Telegram.',
        parameters: { type: 'object', properties: {
          first_name: { type: 'string', description: 'Новое имя (обязательно)' },
          last_name:  { type: 'string', description: 'Новая фамилия (опционально, пусто = убрать)' },
        }, required: ['first_name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_my_profile',
        description: 'Получить свой профиль: имя, фамилию, био, username, телефон.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Gift tools ──
    {
      type: 'function',
      function: {
        name: 'tg_send_gift',
        description: 'Купить Star Gift из каталога и отправить пользователю. Стоит Stars (списываются с баланса).\n\nПОТОК: get_gift_catalog() → выбрать подарок → tg_send_gift(user, gift_id)\n\nЭТО НЕ для коллекционных NFT (t.me/nft/) — это покупка нового подарка из каталога.\nДля передачи СВОЕГО подарка используй tg_transfer_collectible.\nДля покупки с маркетплейса — buy_resale_gift или buy_market_gift.\n\nВАЖНО: ВСЕГДА подтверждай с владельцем перед покупкой (стоит Stars!)',
        parameters: { type: 'object', properties: {
          user_id: { type: 'string', description: 'Telegram user ID (числовой) или @username получателя' },
          gift_id: { type: 'string', description: 'ID подарка из каталога (получить через get_gift_catalog)' },
          message: { type: 'string', description: 'Сообщение с подарком (до 255 символов, опционально)' },
        }, required: ['user_id', 'gift_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_received_gifts',
        description: 'Получить коллекцию Star Gift NFT пользователя. Возвращает список подарков с: slug (= ссылка t.me/nft/{slug}), collection_name, attributes, rarity, is_for_sale, msg_id.\n\nКОГДА ВЫЗЫВАТЬ:\n- "покажи мои подарки" → tg_get_received_gifts() (без user_id = свои)\n- "отправь мой подарок X" → tg_get_received_gifts() → найти подарок → tg_transfer_collectible\n- "продай мой подарок" → tg_get_received_gifts() → tg_get_unique_gift_value → tg_set_collectible_price\n- Нужен slug для любой операции с подарками\n\nВозвращённые slug используй в: tg_get_collectible_info, tg_transfer_collectible, tg_set_collectible_price, tg_get_unique_gift_value',
        parameters: { type: 'object', properties: {
          user_id: { type: 'string', description: 'Telegram user ID (опционально). Без него = свои подарки' },
          limit: { type: 'number', description: 'Максимальное количество (по умолчанию 20)' },
        }, required: [] },
      },
    },
    // ── Enhanced media tools ──
    {
      type: 'function',
      function: {
        name: 'tg_send_photo',
        description: 'Отправить фото по URL как встроенное изображение в Telegram (НЕ как документ/файл). Используй это вместо tg_send_file для фотографий.',
        parameters: { type: 'object', properties: {
          chat_id:   { type: 'string', description: 'ID чата/канала или username' },
          photo_url: { type: 'string', description: 'URL изображения (JPG/PNG/WEBP)' },
          caption:   { type: 'string', description: 'Подпись к фото (опционально)' },
        }, required: ['chat_id', 'photo_url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'http_fetch',
        description: 'HTTP-запрос к любому URL (GET/POST). Для API, вебхуков, парсинга.',
        parameters: {
          type: 'object',
          properties: {
            url:     { type: 'string', description: 'URL запроса' },
            method:  { type: 'string', description: 'HTTP метод (GET/POST/PUT/DELETE)' },
            headers: { type: 'object', description: 'Заголовки запроса' },
            body:    { type: 'string', description: 'Тело запроса (для POST/PUT)' },
          },
          required: ['url'],
        },
      },
    },
    // ── Gift Metadata (api.changes.tg) — backdrops, models, patterns, rarity ──
    {
      type: 'function',
      function: {
        name: 'get_gift_backdrops',
        description: 'Получить ВСЕ доступные бэкграунды (фоны) для подарка с редкостью. Используй когда юзер спрашивает про фоны/бэкдропы, или хочет купить подарок с конкретным фоном (Mystic Pearl, Platinum, Emerald и т.д.).',
        parameters: { type: 'object', properties: {
          gift: { type: 'string', description: 'Название подарка: "Hex Pot", "Plush Pepe", "Lol Pop" и т.д.' },
        }, required: ['gift'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_models',
        description: 'Получить все модели (варианты) подарка отсортированные по редкости. Каждая модель — уникальная анимация.',
        parameters: { type: 'object', properties: {
          gift: { type: 'string', description: 'Название подарка' },
        }, required: ['gift'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_metadata',
        description: 'Детальная информация о подарке: количество моделей, бэкдропов, паттернов, общая статистика.',
        parameters: { type: 'object', properties: {
          gift: { type: 'string', description: 'Название подарка' },
        }, required: ['gift'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_all_gift_names',
        description: 'Список ВСЕХ существующих Telegram Star Gift подарков (100+ коллекций). Используй если не знаешь точное название подарка.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── GiftAsset / SwiftGifts market data tools ─────────────────
    {
      type: 'function',
      function: {
        name: 'get_gift_floor_real',
        description: 'FLOOR PRICE для Telegram Star Gift подарков (Plush Pepe, Lol Pop, Jelly Bunny, Cupid Charm, Fresh Socks и т.д.). Возвращает РЕАЛЬНЫЕ актуальные цены со всех маркетплейсов (GetGems, MRKT, Portals, Fragment). ЭТО ЕДИНСТВЕННЫЙ ПРАВИЛЬНЫЙ ТУЛДЛЯ "floor price" подарков. НЕ ИСПОЛЬЗУЙ get_nft_floor для подарков — он для NFT коллекций (TON Punks и т.д.), НЕ для Star Gifts.',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Название подарка: "Plush Pepe", "Lol Pop", "Jelly Bunny", "Cupid Charm", "Fresh Socks", "Homemade Cake" и т.д.' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_sales_history',
        description: 'Получить историю последних продаж подарка (с ценами и датами)',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции подарка' },
            limit:           { type: 'number', description: 'Количество записей (макс 50)' },
            model_name:      { type: 'string', description: 'Фильтр по модели (опционально)' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_overview',
        description: 'Получить обзор рынка подарков: все коллекции с последними продажами + статистика апгрейдов',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_price_list',
        description: 'Получить прайс-лист floor цен по всем подаркам (все маркетплейсы)',
        parameters: {
          type: 'object',
          properties: {
            models: { type: 'string', description: 'Фильтр по моделям (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scan_real_arbitrage',
        description: 'Найти РЕАЛЬНЫЕ кросс-маркет арбитраж возможности (цены в TON). Возвращает buyPriceTon/sellPriceTon. Tonnel исключён из продаж.',
        parameters: {
          type: 'object',
          properties: {
            max_price_ton:  { type: 'number', description: 'Максимальная цена покупки в TON' },
            min_profit_pct: { type: 'number', description: 'Минимальная прибыль в % (default: 5)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_top_deals',
        description: 'Найти лучшие сделки на рынке подарков — топ арбитраж возможности отсортированные по профиту. Алиас scan_real_arbitrage.',
        parameters: {
          type: 'object',
          properties: {
            max_price_ton:  { type: 'number', description: 'Максимальная цена покупки в TON' },
            min_profit_pct: { type: 'number', description: 'Минимальная прибыль в % (default: 5)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_aggregator',
        description: 'Поиск лучших предложений подарка по всем маркетплейсам (SwiftGifts агрегатор). Каждый item содержит options.payload — готовый BOC для TON транзакции (можно сразу покупать!). Сортирует по редкости фона, потом по цене.',
        parameters: {
          type: 'object',
          properties: {
            name:       { type: 'string', description: 'Название подарка (например "Lol Pop", "Plush Pepe")' },
            receiver:   { type: 'number', description: 'Telegram user ID получателя подарка (обязательно для генерации payload)' },
            backdrop:   { type: 'string', description: 'Фильтр по фону: "All" (все), "Black", "Dark" и т.д.' },
            model:      { type: 'string', description: 'Фильтр по модели: "All" (все) или конкретная модель' },
            from_price: { type: 'number', description: 'Минимальная цена в TON' },
            to_price:   { type: 'number', description: 'Максимальная цена в TON' },
            market:     { type: 'array', items: { type: 'string' }, description: 'Маркетплейсы: tonnel, portals, Mrkt, getgems, fragment. По умолчанию offchain (tonnel, portals, Mrkt)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_top_deals',
        description: 'Топ-сделки дня — лучшие арбитражные возможности, ранжированные по прибыли (GiftAsset Pro API). Используй в начале каждого тика для быстрой разведки рынка.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_backdrop_floors',
        description: 'Цены флора по цветам фона (backdrop) для коллекции. Чёрный фон стоит в 2-5 раз дороже обычного. Используй для оценки конкретных листингов.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции (например "Plush Pepe"), пусто = все коллекции' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_user_portfolio',
        description: 'Получить портфель подарков пользователя Telegram (с оценкой стоимости)',
        parameters: {
          type: 'object',
          properties: {
            username:    { type: 'string', description: 'Telegram @username' },
            telegram_id: { type: 'string', description: 'Telegram user ID (альтернатива username)' },
          },
          required: [],
        },
      },
    },
    // ── New GiftAsset Pro tools ──
    {
      type: 'function',
      function: {
        name: 'get_collection_offers',
        description: 'Активные buy offers для коллекции — гарантированные покупатели по конкретным ценам. Если есть offer по цене X = можно продать МГНОВЕННО по X. Самый надёжный источник цены продажи.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
            min_price: { type: 'number', description: 'Минимальная цена оффера в TON' },
            max_price: { type: 'number', description: 'Максимальная цена оффера в TON' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_health',
        description: 'Индекс здоровья и жадности рынка по коллекциям. Высокий greed_index = перегрев (продавай). Низкий = недооценка (покупай). health_index = общая ликвидность.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_attribute_volumes',
        description: 'Объём продаж по атрибутам (backdrop/model) — какие варианты подарков покупают чаще. Полезно для понимания реального спроса.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции (пусто = все)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_unique_gift_prices',
        description: 'Цены уникальных подарков с разбивкой по вариантам (backdrop + model). Точные цены per-variant без смешения разного качества.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
          },
          required: [],
        },
      },
    },
    // ── Smart valuation tools ──
    {
      type: 'function',
      function: {
        name: 'find_underpriced_gifts',
        description: 'УМНЫЙ ПОИСК НЕДООЦЕНЁННЫХ ПОДАРКОВ. Сравнивает цену каждого листинга с fair value (флор по backdrop+model). Возвращает подарки, которые продаются НИЖЕ рыночной стоимости их атрибутов. Лучший инструмент для поиска выгодных покупок.',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Slug коллекции (lol-pop, jelly-bunny, plush-pepe и т.д.)' },
            max_price: { type: 'number', description: 'Максимальная цена в TON (бюджет)' },
            min_discount_pct: { type: 'number', description: 'Минимальный % скидки от fair value (default: 10)' },
          },
          required: ['collection'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_price_history',
        description: 'История цен коллекции за последние дни/недели. Показывает тренды: растёт, падает, стабильна. Используй для принятия решения: покупать сейчас или подождать.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_activity',
        description: 'Лента покупок/продаж/изменений цен в реальном времени. Показывает ЧТО покупают прямо сейчас, по какой цене, на каком маркете. Используй для анализа спроса и определения реальной ликвидности.',
        parameters: {
          type: 'object',
          properties: {
            gift: { type: 'string', description: 'Slug подарка (опционально — для конкретной коллекции)' },
            type: { type: 'string', enum: ['buy', 'listing', 'change_price'], description: 'Тип действия: buy=покупки, listing=новые листинги, change_price=изменения цен' },
            min_price: { type: 'number', description: 'Минимальная цена фильтра' },
            max_price: { type: 'number', description: 'Максимальная цена фильтра' },
            markets: { type: 'array', items: { type: 'string' }, description: 'Маркеты: tonnel, portals, Mrkt, getgems, fragment' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_collections_marketcap',
        description: 'Капитализация всех коллекций подарков. Общий объём рынка, топ коллекции по стоимости.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_user_profile_price',
        description: 'Рассчитать общую стоимость профиля пользователя (портфеля подарков). Показывает стоимость по каждому маркетплейсу.',
        parameters: { type: 'object', properties: {
          username: { type: 'string', description: 'Telegram @username' },
        }, required: ['username'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_user_collections',
        description: 'Все коллекции подарков которыми владеет пользователь (сколько штук каждого вида).',
        parameters: { type: 'object', properties: {
          username: { type: 'string', description: 'Telegram @username' },
        }, required: ['username'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_by_name',
        description: 'Детальная информация о конкретном подарке по имени (атрибуты, редкость, медиа, цены).',
        parameters: { type: 'object', properties: {
          name: { type: 'string', description: 'Имя подарка (например "EasterEgg-1", "PlushPepe-42")' },
        }, required: ['name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_collections_metadata',
        description: 'Метаданные всех коллекций подарков (backdrop атрибуты, telegram_id).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_providers_fee',
        description: 'Комиссии маркетплейсов (GetGems, MRKT, Portals, Fragment). Нужно для расчёта чистой прибыли при арбитраже.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_providers_volumes',
        description: 'Объёмы торгов по маркетплейсам (часовые/дневные). Показывает какой маркет самый активный.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_provider_sales_history',
        description: 'История продаж конкретного маркетплейса с ценами и временем.',
        parameters: { type: 'object', properties: {
          provider: { type: 'string', description: 'Маркетплейс: getgems, mrkt, portals, tonnel, fragment' },
          limit: { type: 'number', description: 'Количество записей (по умолч. 50)' },
        }, required: ['provider'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_all_providers_sales',
        description: 'Общая история продаж ВСЕХ маркетплейсов вместе — последние сделки по всему рынку.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_unique_deals',
        description: 'Уникальные сделки с фильтром по минимальной цене. Для поиска крупных покупок.',
        parameters: { type: 'object', properties: {
          gift_min_price: { type: 'number', description: 'Минимальная цена в TON' },
          collection_name: { type: 'string', description: 'Фильтр по коллекции (опционально)' },
          limit: { type: 'number', description: 'Количество (по умолч. 20)' },
        }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_collections_volumes',
        description: 'Текущие объёмы торгов по коллекциям (за сегодня). Часовая статистика, пиковые часы.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_week_volumes',
        description: 'Объёмы торгов за неделю по дням. Тренды роста/падения.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_month_volumes',
        description: 'Объёмы торгов за месяц по дням.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_collections_emission',
        description: 'Эмиссия коллекций: сколько выпущено, удалено, спрятано, уникальных владельцев, whale holdings.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_greed_index',
        description: 'Индекс жадности рынка. Компоненты: hidden ratio, whale concentration, upgrade rate. Высокий = перегрев.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── TonAPI Blockchain tools ──────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'ton_get_account',
        description: 'Получить полную информацию об аккаунте TON: баланс, статус, интерфейсы, имя. Работает с EQ/UQ и raw адресами.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес (EQ.../UQ.../0:hex)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_transactions',
        description: 'Получить последние транзакции аккаунта с деталями (суммы, адреса, комментарии)',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес' },
            limit:   { type: 'number', description: 'Количество транзакций (макс 100, по умолчанию 20)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_jettons',
        description: 'Получить список токенов (Jettons) на аккаунте с балансами и ценами',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес владельца' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_nfts',
        description: 'Получить NFT-коллекции и предметы на аккаунте',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес владельца' },
            limit:   { type: 'number', description: 'Количество (по умолчанию 50)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_run_method',
        description: 'Вызвать GET-метод смарт-контракта (read-only). Например: get_pool_data, get_jetton_data, get_nft_data, seqno, get_wallet_data.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Адрес смарт-контракта' },
            method:  { type: 'string', description: 'Имя GET-метода (например: get_pool_data, seqno)' },
            args:    { type: 'array', items: { type: 'string' }, description: 'Аргументы метода (опционально)' },
          },
          required: ['address', 'method'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_rates',
        description: 'Получить курсы TON или любого жетона в fiat/крипто. Поддерживает: ton, jetton адреса. Валюты: usd, eur, rub, btc, eth.',
        parameters: {
          type: 'object',
          properties: {
            tokens:     { type: 'string', description: 'Токен(ы) через запятую: "ton" или адрес jetton' },
            currencies: { type: 'string', description: 'Валюты через запятую: "usd,rub,eur" (по умолчанию: "usd,rub")' },
          },
          required: ['tokens'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_dns_resolve',
        description: 'Резолвить TON DNS домен (например: "foundation.ton") в адрес. Также показывает привязанный кошелёк и сайт.',
        parameters: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'TON DNS домен (например: "foundation.ton", "telegram-bot.ton")' },
          },
          required: ['domain'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_staking_pools',
        description: 'Получить список стейкинг-пулов TON с APY, минимальным депозитом и статистикой',
        parameters: {
          type: 'object',
          properties: {
            available_for: { type: 'string', description: 'Адрес номинатора для фильтра (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_emulate_tx',
        description: 'Эмулировать транзакцию перед отправкой — показывает что произойдёт: изменения балансов, газ, ошибки. Безопасная "песочница" для проверки.',
        parameters: {
          type: 'object',
          properties: {
            boc: { type: 'string', description: 'Base64-encoded BOC транзакции для эмуляции' },
          },
          required: ['boc'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_send_boc',
        description: 'Отправить BOC (сырую транзакцию) в сеть TON. ⚠️ НЕОБРАТИМО — транзакция будет исполнена. Используй ton_emulate_tx для проверки перед отправкой.',
        parameters: {
          type: 'object',
          properties: {
            boc: { type: 'string', description: 'Base64-encoded BOC для отправки' },
          },
          required: ['boc'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_validators',
        description: 'Получить список текущих валидаторов сети TON',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_parse_address',
        description: 'Парсинг TON адреса — конвертация между форматами (bounceable EQ, non-bounceable UQ, raw 0:hex)',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес в любом формате' },
          },
          required: ['address'],
        },
      },
    },
    // ── Plugin tools ──
    {
      type: 'function',
      function: {
        name: 'list_plugins',
        description: 'Получить список всех доступных плагинов платформы (DeFi, аналитика, уведомления, безопасность). Используй чтобы узнать какие плагины есть и предложить пользователю нужный.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'suggest_plugin',
        description: 'Порекомендовать плагин пользователю на основе задачи. Возвращает подходящие плагины с описанием.',
        parameters: {
          type: 'object',
          properties: {
            task_description: { type: 'string', description: 'Описание задачи пользователя — агент подберёт подходящий плагин' },
          },
          required: ['task_description'],
        },
      },
    },
    // ── Inter-agent tools ──
    {
      type: 'function',
      function: {
        name: 'list_my_agents',
        description: 'Список всех агентов текущего пользователя. Используй чтобы узнать к кому можно обратиться.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ask_agent',
        description: 'Отправить сообщение другому агенту пользователя. Агент ответит на следующем тике. Используй только если пользователь разрешил межагентную коммуникацию.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'number', description: 'ID агента которому отправляем сообщение' },
            message:  { type: 'string', description: 'Текст сообщения агенту' },
          },
          required: ['agent_id', 'message'],
        },
      },
    },
    // ── Custom plugins tools ──
    {
      type: 'function',
      function: {
        name: 'run_custom_plugin',
        description: 'Выполнить пользовательский плагин по имени. Плагин — JavaScript код, созданный пользователем через /plugin create.',
        parameters: {
          type: 'object',
          properties: {
            name:   { type: 'string', description: 'Имя плагина' },
            params: { type: 'object', description: 'Параметры для плагина (передаются как объект params)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_custom_plugins',
        description: 'Показать список пользовательских плагинов.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Role-based exclusive tools ──
    ...((agentRole === 'director' || agentRole === 'manager') ? [
      { type: 'function' as const, function: { name: 'assign_task', description: 'Assign a task to a real human team member. Returns task ID.', parameters: { type: 'object', properties: { assignee: { type: 'string', description: 'Name or @username of person' }, task: { type: 'string', description: 'Task description' }, deadline: { type: 'string', description: 'Deadline (optional)' } }, required: ['assignee', 'task'] } } },
      { type: 'function' as const, function: { name: 'check_tasks', description: 'Check status of all assigned tasks (human + agent)', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter: all|pending|done|overdue' } } } } },
      { type: 'function' as const, function: { name: 'manage_agent', description: 'Start, stop, or restart another agent by ID', parameters: { type: 'object', properties: { agent_id: { type: 'number' }, action: { type: 'string', enum: ['start', 'stop', 'restart'] } }, required: ['agent_id', 'action'] } } },
      { type: 'function' as const, function: { name: 'send_report', description: 'Send a structured report to the owner via notification', parameters: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['title', 'body'] } } },
    ] : []),
    // Trader exclusive tools (already in capabilities, but boost visibility)
    ...((agentRole === 'trader') ? [
      { type: 'function' as const, function: { name: 'trade_log', description: 'Log a trade entry for P&L tracking: BUY/SELL, asset, amount, price', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['buy', 'sell'] }, asset: { type: 'string' }, amount: { type: 'number' }, price: { type: 'number' }, reason: { type: 'string' } }, required: ['action', 'asset', 'amount', 'price'] } } },
    ] : []),
    // ── apply / remove plugin ──
    {
      type: 'function' as const,
      function: {
        name: 'apply_plugin',
        description: 'Подключить плагин к этому агенту. Документация плагина будет доступна на следующем тике.',
        parameters: {
          type: 'object',
          properties: {
            plugin_id: { type: 'string', description: 'ID плагина (из list_plugins)' },
          },
          required: ['plugin_id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'remove_plugin',
        description: 'Отключить плагин от этого агента.',
        parameters: {
          type: 'object',
          properties: {
            plugin_id: { type: 'string', description: 'ID плагина' },
          },
          required: ['plugin_id'],
        },
      },
    },
    // ── Self-modification tools (agent evolves itself) ──
    {
      type: 'function' as const,
      function: {
        name: 'get_my_config',
        description: 'Получить свой текущий системный промпт, интервал и описание. Используй перед update_my_prompt чтобы понять что менять.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_my_prompt',
        description: 'Обновить свой системный промпт (свою "душу"). Используй когда пользователь просит изменить твоё поведение, роль, стиль или задачи. Пиши ПОЛНЫЙ новый промпт — он заменит текущий целиком.',
        parameters: {
          type: 'object',
          properties: {
            new_prompt: { type: 'string', description: 'Новый полный системный промпт (заменит текущий)' },
            reason: { type: 'string', description: 'Почему меняешь промпт (для лога)' },
          },
          required: ['new_prompt'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_my_interval',
        description: 'Изменить интервал проактивных тиков (как часто ты просыпаешься для самостоятельных действий). 0 = только реактивный режим.',
        parameters: {
          type: 'object',
          properties: {
            interval_minutes: { type: 'number', description: 'Интервал в минутах (0 = отключить проактивность, 5-60 минут рекомендуется)' },
          },
          required: ['interval_minutes'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_my_description',
        description: 'Обновить своё описание (видно в меню агентов).',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Новое описание агента' },
          },
          required: ['description'],
        },
      },
    },
    // ── Workflow / Planning tools ──
    {
      type: 'function' as const,
      function: {
        name: 'create_plan',
        description: 'Создать пошаговый план действий. Каждый шаг будет выполнен последовательно. Используй для сложных задач.',
        parameters: {
          type: 'object',
          properties: {
            plan_name: { type: 'string', description: 'Название плана' },
            steps: {
              type: 'array',
              description: 'Шаги плана в порядке выполнения',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string', description: 'Описание действия' },
                  tool: { type: 'string', description: 'Какой тул вызвать (опционально)' },
                  condition: { type: 'string', description: 'Условие выполнения (опционально, например: "если цена > 100")' },
                },
                required: ['action'],
              },
            },
          },
          required: ['plan_name', 'steps'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_execution_stats',
        description: 'Получить статистику своей работы: сколько запусков, тулов вызвано, ошибок, токенов потрачено.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Knowledge store ──
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_save',
        description: 'Сохранить важную информацию в долгосрочную память (knowledge base). Используй для фактов, контактов, правил, заметок.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Категория: contacts, rules, facts, notes, tasks' },
            title: { type: 'string', description: 'Краткий заголовок' },
            content: { type: 'string', description: 'Содержимое записи' },
            tags: { type: 'string', description: 'Теги через запятую (опционально)' },
          },
          required: ['category', 'title', 'content'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_search',
        description: 'Поиск по базе знаний агента. Ищет по тексту, категории и тегам.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос (ищет в title и content)' },
            category: { type: 'string', description: 'Фильтр по категории (опционально)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_list',
        description: 'Показать все записи в базе знаний агента, по категориям.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Фильтр по категории (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_delete',
        description: 'Удалить запись из базы знаний по ID.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID записи для удаления' },
          },
          required: ['id'],
        },
      },
    },
    // ── Schedule / Cron ──
    {
      type: 'function' as const,
      function: {
        name: 'schedule_action',
        description: 'Запланировать действие на будущее. Агент выполнит его в указанное время.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Описание действия (будет передано как pending task)' },
            when: { type: 'string', description: 'Когда выполнить: "in 30 minutes", "at 18:00", "tomorrow 10:00"' },
          },
          required: ['action', 'when'],
        },
      },
    },
    // ── Image processing tools ──
    {
      type: 'function' as const,
      function: {
        name: 'image_download',
        description: 'Скачать изображение по URL во временный файл. Возвращает путь к файлу.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL изображения для скачивания' },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_resize',
        description: 'Изменить размер изображения. Можно указать ширину и/или высоту.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            width: { type: 'number', description: 'Новая ширина в пикселях (опционально)' },
            height: { type: 'number', description: 'Новая высота в пикселях (опционально)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_crop',
        description: 'Обрезать изображение по координатам.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            left: { type: 'number', description: 'Отступ слева (px)' },
            top: { type: 'number', description: 'Отступ сверху (px)' },
            width: { type: 'number', description: 'Ширина области обрезки (px)' },
            height: { type: 'number', description: 'Высота области обрезки (px)' },
          },
          required: ['path', 'left', 'top', 'width', 'height'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_add_text',
        description: 'Добавить текст (водяной знак) на изображение.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            text: { type: 'string', description: 'Текст для наложения' },
            position: { type: 'string', enum: ['top', 'bottom', 'center'], description: 'Позиция текста (по умолчанию bottom)' },
            font_size: { type: 'number', description: 'Размер шрифта (по умолчанию 32)' },
            color: { type: 'string', description: 'Цвет текста (по умолчанию white)' },
          },
          required: ['path', 'text'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_filter',
        description: 'Применить фильтр к изображению: blur, sharpen, grayscale, negate, flip, flop, rotate90, rotate180.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            filter: { type: 'string', enum: ['blur', 'sharpen', 'grayscale', 'negate', 'flip', 'flop', 'rotate90', 'rotate180'], description: 'Фильтр для применения' },
          },
          required: ['path', 'filter'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_convert',
        description: 'Конвертировать изображение в другой формат (png, jpg, webp).',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            format: { type: 'string', enum: ['png', 'jpg', 'webp'], description: 'Целевой формат' },
          },
          required: ['path', 'format'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_info',
        description: 'Получить информацию об изображении: размеры, формат, вес файла.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_composite',
        description: 'Наложить одно изображение на другое (overlay).',
        parameters: {
          type: 'object',
          properties: {
            base_path: { type: 'string', description: 'Путь к базовому изображению' },
            overlay_path: { type: 'string', description: 'Путь к изображению-оверлею' },
            x: { type: 'number', description: 'X координата наложения (по умолчанию 0)' },
            y: { type: 'number', description: 'Y координата наложения (по умолчанию 0)' },
            opacity: { type: 'number', description: 'Прозрачность оверлея 0-1 (по умолчанию 1)' },
          },
          required: ['base_path', 'overlay_path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_create_text',
        description: 'Создать изображение с текстом на цветном фоне (для мемов, баннеров и т.д.).',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Текст для изображения' },
            width: { type: 'number', description: 'Ширина (по умолчанию 800)' },
            height: { type: 'number', description: 'Высота (по умолчанию 400)' },
            bg_color: { type: 'string', description: 'Цвет фона (по умолчанию #1a1a2e)' },
            text_color: { type: 'string', description: 'Цвет текста (по умолчанию white)' },
            font_size: { type: 'number', description: 'Размер шрифта (по умолчанию 48)' },
          },
          required: ['text'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_analyze',
        description: 'Анализировать изображение с помощью AI Vision. Для фото из Telegram — передай chat_id и message_id (из аннотации [photo msg_id=X] в контексте чата). Для внешних картинок — URL.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата в Telegram (откуда фото)' },
            message_id: { type: 'number', description: 'ID сообщения с фото (из [photo msg_id=X] в контексте)' },
            path_or_url: { type: 'string', description: 'URL изображения (если не из Telegram)' },
            question: { type: 'string', description: 'Вопрос об изображении (по умолчанию: описать)' },
          },
          required: [],
        },
      },
    },

    // ── Multimodal (v2.3.4) — multi-image vision, video, charts, TTS ──
    {
      type: 'function' as const,
      function: {
        name: 'image_analyze_batch',
        description: 'Анализирует до 16 картинок ОДНИМ Gemini-вызовом. Используй для сравнения: "какая из этих NFT редчайшая", "какой товар лучше выглядит". В разы дешевле чем 16 image_analyze.',
        parameters: {
          type: 'object',
          properties: {
            urls: { type: 'array', items: { type: 'string' }, description: 'URL картинок (до 16)' },
            prompt: { type: 'string', description: 'Что спросить про эти картинки (по умолчанию: сравни)' },
          },
          required: ['urls'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'video_analyze',
        description: 'Анализирует видео (mp4/webm) через Gemini multimodal. Описывает что происходит, ключевые моменты с тайм-кодами. Видео должно быть по URL.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL видео (mp4/webm)' },
            prompt: { type: 'string', description: 'Что спросить про видео' },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'chart_render',
        description: 'Рисует PNG-график через QuickChart. Возвращает URL картинки которую можно отправить через tg_send_file. Поддерживает line/bar/pie/doughnut/radar/scatter/candlestick.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'line/bar/pie/doughnut/radar/scatter/candlestick' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Подписи по X (для line/bar)' },
            datasets: { type: 'array', description: 'Массив { label, data: [числа или {x,y}], backgroundColor?, borderColor? }' },
            title: { type: 'string', description: 'Заголовок графика' },
            width: { type: 'number', description: 'Ширина PNG (по умолчанию 800)' },
            height: { type: 'number', description: 'Высота PNG (по умолчанию 500)' },
          },
          required: ['type', 'datasets'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tts_reply',
        description: 'Преобразует текст в речь через Gemini TTS. Возвращает audio base64 (wav). Можно потом отправить в TG как voice message.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Текст для озвучки (до 4000 символов)' },
            voice: { type: 'string', description: 'Голос: Kore (default), Puck, Charon, Aoede, Fenrir' },
          },
          required: ['text'],
        },
      },
    },

    // ── Bot API 10.0 (May 2026) — Live Photos, reaction moderation, bot-to-bot ──
    {
      type: 'function' as const,
      function: {
        name: 'tg_send_live_photo',
        description: 'Отправляет Live Photo (фото + короткое видео, формат iPhone). НОВИНКА Bot API 10.0. Photo и video — оба URL.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата или @username' },
            photo_url: { type: 'string', description: 'URL фото (jpg/png)' },
            video_url: { type: 'string', description: 'URL короткого видео (mp4)' },
            caption: { type: 'string', description: 'Подпись (опционально)' },
          },
          required: ['chat_id', 'photo_url', 'video_url'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_delete_reaction',
        description: 'Удаляет реакцию с сообщения. Без user_id — удаляет реакцию бота. Bot API 10.0.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата' },
            message_id: { type: 'number', description: 'ID сообщения' },
            user_id: { type: 'number', description: 'ID юзера чью реакцию удалить (опц.)' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_delete_all_reactions',
        description: 'Удаляет ВСЕ реакции с сообщения. Для модерации. Bot API 10.0.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата' },
            message_id: { type: 'number', description: 'ID сообщения' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_send_to_bot',
        description: 'Отправить сообщение другому боту через @username. Оба бота должны включить bot-to-bot communication. Bot API 10.0.',
        parameters: {
          type: 'object',
          properties: {
            bot_username: { type: 'string', description: '@username другого бота' },
            text: { type: 'string', description: 'Текст сообщения' },
          },
          required: ['bot_username', 'text'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_set_my_profile_photo',
        description: 'Установить аватарку бота из URL. Bot API 9.4.',
        parameters: {
          type: 'object',
          properties: { photo_url: { type: 'string', description: 'URL картинки' } },
          required: ['photo_url'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_remove_my_profile_photo',
        description: 'Удалить текущую аватарку бота. Bot API 9.4.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_get_user_profile_audios',
        description: 'Получить список аудио из профиля пользователя (например голосовая визитка). Bot API 9.4.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'number', description: 'ID пользователя' },
            limit: { type: 'number', description: 'Максимум аудио (1-100, по умолчанию 20)' },
          },
          required: ['user_id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_set_chat_member_tag',
        description: 'Назначить тег (цветной "роль") участнику чата. Например "VIP", "Модератор". Bot API 9.5.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата' },
            user_id: { type: 'number', description: 'ID пользователя' },
            tag: { type: 'string', description: 'Текст тега (до 40 символов)' },
          },
          required: ['chat_id', 'user_id', 'tag'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'tg_create_poll_v2',
        description: 'Создать продвинутый опрос или квиз. Bot API 9.6/10.0: поддержка multiple correct answers, description, allows_revoting, shuffle_options, hide_results_until_closes, members_only, country_codes.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата' },
            question: { type: 'string', description: 'Вопрос' },
            options: { type: 'array', items: { type: 'string' }, description: 'Варианты ответов (1-12)' },
            type: { type: 'string', description: '"regular" (default) или "quiz"' },
            correct_option_ids: { type: 'array', items: { type: 'number' }, description: 'Для quiz — индексы правильных (МАССИВ, может быть несколько)' },
            explanation: { type: 'string', description: 'Объяснение для quiz' },
            description: { type: 'string', description: 'Описание опроса (до 400 символов)' },
            is_anonymous: { type: 'boolean', description: 'Анонимный (default: true)' },
            allows_multiple_answers: { type: 'boolean', description: 'Можно выбрать несколько вариантов' },
            allows_revoting: { type: 'boolean', description: 'Можно изменить голос' },
            shuffle_options: { type: 'boolean', description: 'Перемешать варианты' },
            hide_results_until_closes: { type: 'boolean', description: 'Скрыть результаты до закрытия' },
            allow_adding_options: { type: 'boolean', description: 'Юзеры могут добавлять свои варианты' },
            members_only: { type: 'boolean', description: 'Только для участников канала' },
            country_codes: { type: 'array', items: { type: 'string' }, description: 'Список ISO-кодов стран кому видно' },
            open_period: { type: 'number', description: 'Автозакрытие через N секунд (макс 2628000)' },
          },
          required: ['chat_id', 'question', 'options'],
        },
      },
    },

    // ── Audio: transcribe voice / podcast / call recording ──
    {
      type: 'function' as const,
      function: {
        name: 'audio_transcribe',
        description: 'Транскрибировать аудио в текст. Принимает URL (mp3/ogg/wav/m4a/webm) или base64. Пробует Gemini multimodal (быстро/дёшево), потом OpenAI Whisper как fallback. Возвращает текст + какой провайдер сработал + причину если провалилось.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL аудиофайла (mp3/ogg/wav/m4a/webm). ИЛИ передай base64.' },
            base64: { type: 'string', description: 'Аудио base64-кодированное (если нет URL). Формат указывай в format.' },
            format: { type: 'string', description: 'Формат: ogg/mp3/wav/m4a/webm. Если URL — авто-определится.' },
            lang: { type: 'string', description: 'Подсказка языка: ru, en, auto (по умолчанию auto)' },
            timeout_ms: { type: 'number', description: 'Таймаут на одну попытку (по умолчанию 20000)' },
          },
          required: [],
        },
      },
    },

    // ── Workspace (file management) tools ──────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'file_write',
        description: 'Записать файл в рабочую директорию агента. Создаёт директории автоматически.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу (относительно workspace агента)' },
            content: { type: 'string', description: 'Содержимое файла' },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_read',
        description: 'Прочитать файл из рабочей директории агента (макс 50KB).',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_list',
        description: 'Список файлов и папок в рабочей директории агента.',
        parameters: {
          type: 'object',
          properties: {
            dir: { type: 'string', description: 'Путь к директории (по умолчанию корень workspace)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_delete',
        description: 'Удалить файл из рабочей директории агента.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_append',
        description: 'Дописать текст в конец файла в рабочей директории агента.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу' },
            content: { type: 'string', description: 'Текст для добавления' },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'workspace_info',
        description: 'Информация о рабочей директории агента (количество файлов и размер).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },

    // ── MCP (Model Context Protocol) tools ─────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'mcp_connect',
        description: 'Подключиться к внешнему MCP серверу для использования его инструментов.',
        parameters: {
          type: 'object',
          properties: {
            server_url: { type: 'string', description: 'URL MCP сервера (HTTP endpoint)' },
            server_name: { type: 'string', description: 'Название сервера для идентификации' },
            api_key: { type: 'string', description: 'API ключ для аутентификации (опционально)' },
          },
          required: ['server_url', 'server_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_list_servers',
        description: 'Список подключённых MCP серверов.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_list_tools',
        description: 'Список доступных инструментов на подключённых MCP серверах.',
        parameters: {
          type: 'object',
          properties: {
            server_id: { type: 'string', description: 'ID сервера (опционально, по умолчанию все серверы)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_call',
        description: 'Вызвать инструмент на подключённом MCP сервере.',
        parameters: {
          type: 'object',
          properties: {
            tool_name: { type: 'string', description: 'Имя инструмента' },
            args: { type: 'object', description: 'Аргументы для инструмента' },
          },
          required: ['tool_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_disconnect',
        description: 'Отключиться от MCP сервера.',
        parameters: {
          type: 'object',
          properties: {
            server_id: { type: 'string', description: 'ID сервера для отключения' },
          },
          required: ['server_id'],
        },
      },
    },

    // ── Human-in-the-Loop: ask_user_confirmation ─────────────────────
    {
      type: 'function',
      function: {
        name: 'ask_user_confirmation',
        description: 'Отправить пользователю вопрос и дождаться ответа да/нет. Используй для подтверждения важных действий.',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Вопрос для пользователя (будет отправлен в чат)' },
            timeout_seconds: { type: 'number', description: 'Таймаут ожидания ответа в секундах (по умолчанию 120, макс 300)' },
          },
          required: ['question'],
        },
      },
    },

    // ── s10 protocol: plan-approval HitL ─────────────────────────────
    {
      type: 'function',
      function: {
        name: 'ask_for_plan_approval',
        description: 'Отправить юзеру черновик мульти-шагового плана действий, дождаться одобрения. Юзер может: одобрить как есть ("да"), отклонить ("нет"), или дать правки ("правки: <текст>"). Возвращает { approved, with_edits, edits, user_reply }. Используй когда план опасен / нетривиален / тратит ресурсы.',
        parameters: {
          type: 'object',
          properties: {
            plan: { type: 'string', description: 'Текст плана (numbered list, до 4000 символов)' },
            timeout_seconds: { type: 'number', description: 'Таймаут (30-900 сек, по умолчанию 300)' },
          },
          required: ['plan'],
        },
      },
    },

    // ── Image Generation ─────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Сгенерировать изображение по текстовому описанию. Возвращает URL изображения.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Описание изображения (на английском для лучшего результата)' },
            width: { type: 'number', description: 'Ширина в пикселях (по умолчанию 1024, макс 2048)' },
            height: { type: 'number', description: 'Высота в пикселях (по умолчанию 1024, макс 2048)' },
            style: { type: 'string', description: 'Стиль: realistic, anime, digital-art, oil-painting (опционально)' },
          },
          required: ['prompt'],
        },
      },
    },

    // ── Email / SMTP ─────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'send_email',
        description: 'Отправить email через SMTP. Требует настройки SMTP в конфиге агента (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Email получателя' },
            subject: { type: 'string', description: 'Тема письма' },
            body: { type: 'string', description: 'Текст письма (plain text)' },
            html: { type: 'string', description: 'HTML версия письма (опционально)' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    },

    // ── Channel Management (userbot-manager) ────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_create_channel2',
        description: 'Создать новый канал или супергруппу через userbot (расширенная версия с about и megagroup).',
        parameters: { type: 'object', properties: {
          title: { type: 'string', description: 'Название канала/группы' },
          about: { type: 'string', description: 'Описание канала' },
          megagroup: { type: 'boolean', description: 'Создать супергруппу вместо канала (по умолчанию false)' },
        }, required: ['title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_edit_channel_title',
        description: 'Изменить название канала/группы.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          title: { type: 'string', description: 'Новое название' },
        }, required: ['chat_id', 'title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_edit_channel_about',
        description: 'Изменить описание канала/группы.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          about: { type: 'string', description: 'Новое описание' },
        }, required: ['chat_id', 'about'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_channel_username',
        description: 'Установить публичный username канала/группы.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          username: { type: 'string', description: 'Новый username (без @)' },
        }, required: ['chat_id', 'username'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_toggle_slow_mode',
        description: 'Включить/выключить медленный режим в группе. 0 = выключить.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
          seconds: { type: 'number', description: 'Интервал в секундах (0, 10, 30, 60, 300, 900, 3600)' },
        }, required: ['chat_id', 'seconds'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_delete_channel',
        description: 'Удалить канал/группу. НЕОБРАТИМО!',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы для удаления' },
        }, required: ['chat_id'] },
      },
    },

    // ── Moderation (userbot-manager) ────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_edit_admin2',
        description: 'Назначить/изменить права администратора в канале/группе (расширенная версия).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          target_user_id: { type: 'string', description: 'ID пользователя' },
          rights: { type: 'object', description: 'Права: { post_messages, edit_messages, delete_messages, ban_users, invite_users, pin_messages, manage_call, add_admins, anonymous, manage_topics }' },
        }, required: ['chat_id', 'target_user_id', 'rights'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_ban_user2',
        description: 'Забанить пользователя в группе/канале (расширенная версия с until_date).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          target_user_id: { type: 'string', description: 'ID пользователя' },
          until_date: { type: 'number', description: 'Unix timestamp окончания бана (0 = навсегда)' },
        }, required: ['chat_id', 'target_user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_kick_user2',
        description: 'Кикнуть пользователя из группы/канала (расширенная версия).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          target_user_id: { type: 'string', description: 'ID пользователя' },
        }, required: ['chat_id', 'target_user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_mute_user2',
        description: 'Замутить пользователя в группе (расширенная версия с until_date).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
          target_user_id: { type: 'string', description: 'ID пользователя' },
          until_date: { type: 'number', description: 'Unix timestamp окончания мута (0 = навсегда)' },
        }, required: ['chat_id', 'target_user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_delete_user_messages',
        description: 'Удалить все сообщения конкретного пользователя в группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
          target_user_id: { type: 'string', description: 'ID пользователя' },
        }, required: ['chat_id', 'target_user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_toggle_antispam',
        description: 'Включить/выключить встроенный антиспам Telegram в группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
          enabled: { type: 'boolean', description: 'Включить (true) или выключить (false) антиспам' },
        }, required: ['chat_id', 'enabled'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_admin_log',
        description: 'Получить лог действий администраторов в канале/группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          limit: { type: 'number', description: 'Количество записей (по умолчанию 50)' },
        }, required: ['chat_id'] },
      },
    },

    // ── Invite Links (userbot-manager) ──────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_create_invite_link2',
        description: 'Создать пригласительную ссылку с расширенными параметрами (лимит, срок, одобрение, название).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          expire_date: { type: 'number', description: 'Unix timestamp истечения ссылки (опционально)' },
          usage_limit: { type: 'number', description: 'Максимум использований (опционально)' },
          request_needed: { type: 'boolean', description: 'Требовать одобрение заявки (опционально)' },
          title: { type: 'string', description: 'Название ссылки (опционально)' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_approve_join_request',
        description: 'Одобрить или отклонить заявку на вступление в группу/канал.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          target_user_id: { type: 'string', description: 'ID пользователя' },
          approve: { type: 'boolean', description: 'true = одобрить, false = отклонить' },
        }, required: ['chat_id', 'target_user_id', 'approve'] },
      },
    },

    // ── Stories (userbot-manager) ───────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_send_story',
        description: 'Опубликовать историю (story) в Telegram. Медиа загружается по URL.',
        parameters: { type: 'object', properties: {
          media_url: { type: 'string', description: 'URL фото или видео для истории' },
          caption: { type: 'string', description: 'Подпись к истории (опционально)' },
          pinned: { type: 'boolean', description: 'Закрепить историю в профиле (опционально)' },
        }, required: ['media_url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_delete_story',
        description: 'Удалить свою историю.',
        parameters: { type: 'object', properties: {
          story_id: { type: 'number', description: 'ID истории для удаления' },
        }, required: ['story_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_story_views',
        description: 'Получить статистику просмотров истории.',
        parameters: { type: 'object', properties: {
          story_id: { type: 'number', description: 'ID истории' },
        }, required: ['story_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_peer_stories',
        description: 'Получить список историй пользователя/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID пользователя/канала или username' },
        }, required: ['chat_id'] },
      },
    },

    // ── Media (userbot-manager) ─────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_download_media2',
        description: 'Скачать медиа из сообщения (фото/видео/документ) и получить base64/путь.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения с медиа' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_copy_message2',
        description: 'Скопировать сообщение из одного чата в другой (сохраняя форматирование).',
        parameters: { type: 'object', properties: {
          from_chat_id: { type: 'string', description: 'ID чата-источника' },
          message_id: { type: 'number', description: 'ID сообщения' },
          to_chat_id: { type: 'string', description: 'ID чата-назначения' },
        }, required: ['from_chat_id', 'message_id', 'to_chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_export_message_link',
        description: 'Получить публичную ссылку на сообщение в канале/группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы' },
          message_id: { type: 'number', description: 'ID сообщения' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unpin_message2',
        description: 'Открепить конкретное сообщение (расширенная версия).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения для открепления' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unpin_all',
        description: 'Открепить все закреплённые сообщения в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_video_note',
        description: 'Отправить видеокружок (кружочек/видеозаметку) в чат. Видео загружается по URL.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          video_url: { type: 'string', description: 'URL видео для кружочка' },
        }, required: ['chat_id', 'video_url'] },
      },
    },

    // ── Forum topics (userbot-manager) ──────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_create_forum_topic',
        description: 'Создать топик (тему) в форум-группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID форум-группы' },
          title: { type: 'string', description: 'Название топика' },
          icon_color: { type: 'number', description: 'Цвет иконки (опционально)' },
        }, required: ['chat_id', 'title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_edit_forum_topic',
        description: 'Редактировать топик форума (название, закрыть/открыть).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID форум-группы' },
          topic_id: { type: 'number', description: 'ID топика' },
          title: { type: 'string', description: 'Новое название (опционально)' },
          closed: { type: 'boolean', description: 'Закрыть (true) или открыть (false) топик (опционально)' },
        }, required: ['chat_id', 'topic_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_forum_topics',
        description: 'Получить список топиков форум-группы.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID форум-группы' },
          limit: { type: 'number', description: 'Количество (по умолчанию 50)' },
        }, required: ['chat_id'] },
      },
    },

    // ── Analytics (userbot-manager) ─────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_get_channel_stats',
        description: 'Получить детальную статистику канала (подписчики, просмотры, рост и т.д.).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_group_stats',
        description: 'Получить статистику группы (участники, сообщения, активность).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
        }, required: ['chat_id'] },
      },
    },

    // ── Discovery (userbot-manager) ─────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_search_global',
        description: 'Глобальный поиск по Telegram: каналы, группы, пользователи, сообщения.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'Поисковый запрос' },
          limit: { type: 'number', description: 'Количество результатов (по умолчанию 20)' },
        }, required: ['query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_resolve_username',
        description: 'Получить информацию о пользователе/канале/группе по username.',
        parameters: { type: 'object', properties: {
          username: { type: 'string', description: 'Username (без @)' },
        }, required: ['username'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_block_user',
        description: 'Заблокировать пользователя в личных сообщениях.',
        parameters: { type: 'object', properties: {
          target_user_id: { type: 'string', description: 'ID пользователя' },
        }, required: ['target_user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unblock_user',
        description: 'Разблокировать пользователя.',
        parameters: { type: 'object', properties: {
          target_user_id: { type: 'string', description: 'ID пользователя' },
        }, required: ['target_user_id'] },
      },
    },

    // ── Premium (userbot-manager) ───────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_apply_boost',
        description: 'Применить буст к каналу/группе (требует Telegram Premium).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID канала/группы для буста' },
        }, required: ['chat_id'] },
      },
    },

    // ── Self-Memory Management Tools ──────────────────────────────────
    {
      type: 'function' as const,
      function: {
        name: 'memory_stats',
        description: 'Get statistics about your memory: count of entries by category, total size, evolution count. Use to understand what you remember.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'clear_memory_category',
        description: 'Clear all entries in a specific memory category. Use carefully — this is irreversible.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['memories', 'lessons', 'knowledge', 'contacts', 'chatDossiers', 'engagement', 'all'], description: 'Category to clear' },
          },
          required: ['category'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'compress_memories',
        description: 'Compress old memories or lessons into fewer consolidated entries using AI summarization. Reduces clutter while preserving key facts.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['memories', 'lessons'], description: 'Category to compress (default: memories)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'browse_memory',
        description: 'Browse your memory entries by category with pagination. Returns key, preview and size of each entry.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['memories', 'lessons', 'knowledge', 'contacts', 'chatDossiers', 'engagement'], description: 'Category to browse (omit for all)' },
            offset: { type: 'number', description: 'Starting position (default: 0)' },
            limit: { type: 'number', description: 'Number of entries (default: 10, max: 20)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'run_memory_maintenance',
        description: 'Run memory maintenance: enforce retention limits, apply TTL, clean old daily logs. Returns count of pruned/expired entries.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_memory_settings',
        description: 'Get current memory configuration: enabled categories, retention limits, TTL, context injection priority.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_memory_settings',
        description: 'Update memory configuration. Pass only the fields you want to change.',
        parameters: {
          type: 'object',
          properties: {
            enableMemories: { type: 'boolean', description: 'Enable remember/recall' },
            enableLessons: { type: 'boolean', description: 'Enable save_lesson' },
            enableKnowledge: { type: 'boolean', description: 'Enable knowledge base' },
            enableContacts: { type: 'boolean', description: 'Enable contact dossiers' },
            enableEvolution: { type: 'boolean', description: 'Enable prompt self-evolution' },
            maxMemories: { type: 'number', description: 'Max memory entries (default 200)' },
            maxLessons: { type: 'number', description: 'Max lesson entries (default 30)' },
            memoryTTLDays: { type: 'number', description: 'Auto-expire memories after N days (0=never)' },
            lessonTTLDays: { type: 'number', description: 'Auto-expire lessons after N days (0=never)' },
            maxContextTokens: { type: 'number', description: 'Token budget for memory in context (default 2000)' },
            evolveInterval: { type: 'number', description: 'Interactions between evolutions (default 50)' },
          },
          required: [],
        },
      },
    },
  ];
}
