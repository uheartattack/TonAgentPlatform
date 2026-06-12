// ===================================================================
// TAB GROUP 1 — Dashboard, Marketplace, Skills, Constructor
// ===================================================================

// ─── DASHBOARD (Обзор) ─────────────────────────────────────────────
const DashboardTab = () => (
  <div className="page fade-in">
    <Hero
      eyebrow="● Live · 22 мая 2026"
      title="Добрый день,"
      grad="spend $"
      subtitle="Статус системы и метрики в реальном времени. 5 агентов активны, среднее время отклика 9.2с."
      cta={
        <>
          <Btn icon={<I.Refresh size={14} />}>Обновить</Btn>
          <Btn variant="primary" icon={<I.Plus size={14} />}>Создать агента</Btn>
        </>
      }
    />

    <div className="stat-grid" style={{ marginBottom: 18 }}>
      <Stat icon={<I.Clock size={16}/>} label="Время работы" value="2h 17m" valueClass="plain" foot="ваших агентов" />
      <Stat icon={<I.Brain size={16}/>} label="AI модель"   value="gemini-2.5-flash" foot="по умолчанию" />
      <Stat icon={<I.Users size={16}/>} label="Активные сессии" value="0" valueClass="plain" foot="активных" />
      <Stat icon={<I.Wrench size={16}/>} label="Возможности" value="81" foot="инструментов" />
    </div>

    <div className="stat-grid" style={{ marginBottom: 32 }}>
      <Stat icon={<I.Activity size={16}/>} label="Всего запусков" value="9 973" foot="за всё время" trend={{ dir:'up', text:'+12.4% к прошлой неделе' }} />
      <Stat icon={<I.Check size={16}/>} label="Успешность"      value="25%" valueClass="amber" foot="средняя" trend={{ dir:'down', text:'−3.1% сегодня' }}/>
      <Stat icon={<I.Calendar size={16}/>} label="Запусков за 24ч" value="1 056" foot="сегодня" trend={{ dir:'up', text:'+18.0%' }} />
      <Stat icon={<I.Cube size={16}/>} label="Всего агентов"   value="5" foot="создано" />
    </div>

    <div className="card flat" style={{ marginBottom: 28, padding: 0, overflow: 'hidden' }}>
      <div className="section-head" style={{ padding: '22px 24px 16px', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
        <h3><I.Star size={16} className="primary"/> Мои агенты <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>· закреплённые</span></h3>
        <Btn>Все агенты <I.Chevron size={12}/></Btn>
      </div>
      <div style={{ padding: 28 }}>
        <div className="empty" style={{ border: 'none', padding: '32px 8px' }}>
          <div className="ico"><I.Star size={22}/></div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Пока пусто</div>
          Закрепите агентов в «Мои агенты», чтобы они появились здесь
          <div style={{ marginTop: 16 }}>
            <Btn variant="primary" icon={<I.ArrowRight size={13}/>}>Перейти к агентам</Btn>
          </div>
        </div>
      </div>
    </div>

    <div className="grid-2">
      <div className="card">
        <div className="section-head" style={{ marginBottom: 18 }}>
          <h3>План и лимиты</h3>
          <span className="eyebrow green">● Unlimited</span>
        </div>
        <div className="col gap-16">
          <PlanRow icon={<I.Users size={16}/>} label="Агенты"   value="5 / ∞" />
          <PlanRow icon={<I.Clock size={16}/>} label="Активные" value="0 / ∞" />
          <PlanRow icon={<I.Sparkles size={16}/>} label="AI запросы" value="847 / ∞" />
          <PlanRow icon={<I.Database size={16}/>} label="База знаний" value="0 / 100 МБ" pct={0} />
        </div>
      </div>

      <div className="card">
        <div className="section-head" style={{ marginBottom: 18 }}>
          <h3>Конфигурация агента</h3>
          <button className="btn btn-secondary btn-icon"><I.Save size={14}/></button>
        </div>
        <div className="col gap-14">
          <div>
            <label className="field-label">AI Провайдер</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="row gap-8"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }} /> Anthropic (Claude)</span>
              <I.ChevronDown size={14} className="muted"/>
            </div>
          </div>
          <div>
            <label className="field-label">Версия модели</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono">Claude 3.5 Sonnet</span>
              <I.ChevronDown size={14} className="muted"/>
            </div>
          </div>
          <div>
            <label className="field-label">Креативность · <span className="primary mono">0.7</span></label>
            <Slider value={0.7} />
          </div>
          <div className="grid-2">
            <div>
              <label className="field-label">Макс. токенов</label>
              <input className="input" defaultValue="4096" />
            </div>
            <div>
              <label className="field-label">Итерации</label>
              <input className="input" defaultValue="5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PlanRow = ({ icon, label, value, pct }) => (
  <div>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
      <span className="row gap-10 secondary"><span className="stat-icon" style={{ width: 32, height: 32 }}>{icon}</span> {label}</span>
      <span className="mono" style={{ fontWeight: 700 }}>{value}</span>
    </div>
    <div className="progress green"><span style={{ width: (pct != null ? pct : 80) + '%' }} /></div>
  </div>
);

// ─── MARKETPLACE (Маркетплейс) ─────────────────────────────────────
const MarketplaceTab = () => {
  const [filter, setFilter] = useState('all');
  const filters = [
    { value: 'all',     label: 'Все',        count: 142 },
    { value: 'mon',     label: 'Мониторинг', count: 38  },
    { value: 'defi',    label: 'DeFi',       count: 24  },
    { value: 'nft',     label: 'NFT',        count: 31  },
    { value: 'gifts',   label: 'Подарки',    count: 17  },
    { value: 'util',    label: 'Утилиты',    count: 22  },
    { value: 'mine',    label: 'Мои' },
    { value: 'bought',  label: 'Купленные' },
  ];

  const cards = [
    { tag: 'NFT',        tagTone: 'purple', price: 'Бесплатно', priceTone: 'green', title: 'NFT Floor Watcher', desc: 'Следит за ценой подарков и скидывает в чат информацию о падениях ниже флора.', author: 'TON Agent Team', installs: '1.2K', runs: '128K' },
    { tag: 'MONITORING', tagTone: '',       price: 'Бесплатно', priceTone: 'green', title: 'NFT Arbitrage Pro', desc: 'НАХОДИТ NFT-подарки ниже флора для арбитража, мониторит цены Fragment, GetGems, MRKT, Portals, Tonnel.', author: '@arbi_dev', installs: '892', runs: '54K' },
    { tag: 'MONITORING', tagTone: '',       price: 'Бесплатно', priceTone: 'green', title: 'Gift Sniper Lite',  desc: 'Базовый снайпер для подарков. Уведомления в Telegram, готовые шаблоны.', author: 'sitiop', installs: '450', runs: '12K' },
    { tag: 'MONITORING', tagTone: '',       price: 'Бесплатно', priceTone: 'green', title: 'Token Pulse',       desc: 'Мониторит активность токенов TON: объём, киты, листинги, новые пары на DEX.', author: '@analytics_ton', installs: '670', runs: '38K' },
    { tag: 'OTHER',      tagTone: 'amber',  price: '1.00 TON',  priceTone: 'primary', title: 'Portfolio Tracker', desc: 'Агент, который будет трекать твой крипто портфель: holdings, P&L, газ, рекомендации.', author: 'cryptoboy', installs: '128', runs: '7.4K' },
    { tag: 'DEFI',       tagTone: 'green',  price: '0.50 TON',  priceTone: 'primary', title: 'DEX Aggregator',   desc: 'Лучший своп через STON.fi, DeDust, агрегирует ликвидность, минимальные комиссии.', author: 'TON Agent Team', installs: '2.1K', runs: '189K' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Marketplace"
        title="Маркетплейс"
        grad="агентов"
        subtitle="Обзор, установка и публикация шаблонов агентов · 142 публикации"
        actions={
          <>
            <Btn icon={<I.Filter size={13}/>}>Фильтры</Btn>
            <Btn variant="primary" icon={<I.Upload size={14}/>}>Опубликовать</Btn>
          </>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <PillTabs tabs={filters} value={filter} onChange={setFilter} />
      </div>

      <div className="grid-3">
        {cards.map((c, i) => (
          <div className="card hoverable" key={i}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <Chip tone={c.tagTone}>{c.tag}</Chip>
              <span className={c.priceTone === 'primary' ? 'primary mono' : 'green mono'} style={{ fontWeight: 700, fontSize: 12.5 }}>{c.price}</span>
            </div>
            <div className="row gap-12" style={{ marginBottom: 12 }}>
              <div className="num-cube" style={{ width: 38, height: 38, fontSize: 14 }}>{c.title[0]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>by {c.author}</div>
              </div>
            </div>
            <div className="secondary" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, minHeight: 60 }}>{c.desc}</div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row gap-12 muted" style={{ fontSize: 11.5 }}>
                <span className="row gap-4"><I.Download size={12}/>{c.installs}</span>
                <span className="row gap-4"><I.Activity size={12}/>{c.runs}</span>
              </div>
              <Btn variant={c.price === 'Бесплатно' ? 'primary' : 'primary'} icon={c.price === 'Бесплатно' ? <I.Download size={13}/> : <I.Coin size={13}/>}>
                {c.price === 'Бесплатно' ? 'Установить' : 'Купить'}
              </Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── SKILLS (Скиллы) ───────────────────────────────────────────────
const SkillsTab = () => {
  const [filter, setFilter] = useState('all');
  const filters = [
    { value: 'all',  label: 'Все',         count: 11 },
    { value: 'in',   label: 'Встроенные',  count: 11 },
    { value: 'mine', label: 'Мои' },
    { value: 'pub',  label: 'Публичные' },
  ];

  const skills = [
    { name: 'acton',           cat: 'TON-DEV', v: '1.0', desc: 'Acton — Rust-based CLI toolkit for TON smart contract development. Use when the user wants to create, compile, test, deploy, or verify a TON smart contract written in Tolk.', deps: true },
    { name: 'agentic-wallets', cat: 'BLOCKCHAIN', v: '1.0', desc: 'TON Agentic Wallets — self-custody multisig wallets for autonomous AI agents. Use when the user wants to create a separate wallet for their agent (not their personal one).', deps: true },
    { name: 'defi',            cat: 'TRADING', v: '1.0', desc: 'TON DeFi — DEX swaps, price quotes, and on-chain arbitrage via STON.fi and DeDust. Use when the user asks about token prices (jetton/USDT/TON), swap quotes, liquidity pools, slippage.', deps: true },
    { name: 'fragment',        cat: 'TRADING', v: '1.0', desc: 'Fragment.com gift floor prices and Telegram-account-authenticated operations via GramJS MTProto. Use when the user asks about Fragment gift prices, listings.', deps: true },
    { name: 'func2tolk',       cat: 'TON-DEV', v: '1.0', desc: 'Migrate FunC smart contracts to Tolk. Use when the user has an existing FunC (.fc) contract and wants to upgrade to Tolk.', deps: true },
    { name: 'gifts',           cat: 'TRADING', v: '1.0', desc: 'Telegram Gifts pricing, arbitrage, and trading. Plush Pepe, Lol Pop, Jelly Bunny, Heart Locket, arbitrage, floor prices.', deps: true },
    { name: 'nft',             cat: 'TRADING', v: '1.0', desc: 'TON NFT collections — pricing, holdings, sales analysis. TON Punks, TON Diamonds, Anonymous Numbers, TONXPUNKS, GetGems collections.', deps: true },
    { name: 'telegram-stars',  cat: 'TELEGRAM', v: '1.0', desc: 'Telegram Stars balance, transfers, and gift-purchase flows. Sending Stars, gifting Stars, buying Telegram Premium with Stars.', deps: true },
    { name: 'tolk',            cat: 'TON-DEV', v: '2.0', desc: 'Tolk — the recommended language for TON smart contracts (replaces FunC). Statically typed, declarative cell layouts.', deps: true },
    { name: 'ton-blockchain',  cat: 'TON-DEV', v: '1.0', desc: 'TON blockchain runtime context — architecture, message model, gas economics, standards (TIPs), and ecosystem references.', deps: true },
    { name: 'ton-wallet',      cat: 'TON-DEV', v: '1.0', desc: 'TON wallet operations — balance checks, address lookup, sending TON / jettons, and safe transaction practices.', deps: true },
    { name: 'web3-monitor',    cat: 'MONITOR',  v: '1.0', desc: 'On-chain monitoring — wallet activity, contract events, price alerts, and threshold-based notifications.', deps: true },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Skills · agentskills.io"
        title="Скиллы"
        grad="агентов"
        subtitle="Переиспользуемые наборы знаний — грузятся по требованию"
        actions={
          <>
            <Btn icon={<I.Upload size={13}/>}>Импорт</Btn>
            <Btn variant="primary" icon={<I.Plus size={14}/>}>Новый скилл</Btn>
          </>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <PillTabs tabs={filters} value={filter} onChange={setFilter} />
      </div>

      <div className="grid-3">
        {skills.map((s, i) => (
          <div className="card hoverable" key={i}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="row gap-12">
                <div className="num-cube" style={{ width: 36, height: 36, fontSize: 13 }}>{s.name.slice(0,2)}</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
              </div>
              <Chip tone="muted">BUILT-IN</Chip>
            </div>
            <div className="secondary" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 18, minHeight: 95 }}>{s.desc}</div>
            <div className="row" style={{ justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="row gap-10">
                <span className="mono muted" style={{ fontSize: 10.5, letterSpacing: '0.1em' }}>{s.cat}</span>
                <span className="mono muted" style={{ fontSize: 11 }}>· v{s.v}</span>
              </div>
              <span className="row gap-4 amber" style={{ fontSize: 11.5, fontWeight: 600 }}>
                <I.AlertTri size={11}/> deps
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── CONSTRUCTOR (Конструктор) ─────────────────────────────────────
const ConstructorTab = () => {
  const palette = [
    { group: 'Инструкция', tone: 'primary', items: ['📘 Инструкция'] },
    { group: 'Триггеры',   tone: 'amber',   items: ['⏱ Таймер', '▶ Вручную', '⇢ Webhook'] },
    { group: 'TON Блокчейн', tone: 'primary', items: ['$ Баланс', '◆ Цена NFT', '↗ Отправить TON'] },
    { group: 'Подарки',    tone: 'purple',  items: ['✦ Цены подарков', '↕ Арбитраж', '▭ Цена подарка', '▣ Обзор рынка'] },
    { group: 'Веб',        tone: 'green',   items: ['◎ Поиск', '◎ Загрузить URL', '⇄ HTTP запрос'] },
  ];

  return (
    <div className="page fade-in" style={{ padding: '24px 32px', maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <Btn icon={<I.ArrowLeft size={14}/>}>Назад</Btn>
        <div className="row gap-10">
          <span className="eyebrow"><I.Flow size={11}/> Конструктор</span>
        </div>
        <div className="row gap-10">
          <input className="input" placeholder="Имя агента…" style={{ width: 200 }}/>
          <input className="input" placeholder="Что должен делать?" style={{ width: 240 }}/>
          <Btn variant="primary" icon={<I.Rocket size={14}/>}>Запуск</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 16, height: 'calc(100vh - 170px)' }}>
        {/* PALETTE */}
        <div className="card flat" style={{ padding: 12, overflowY: 'auto' }}>
          <SectionDivider>Палитра</SectionDivider>
          {palette.map(g => (
            <div key={g.group} style={{ marginBottom: 14 }}>
              <div className="row" style={{ padding: '6px 10px', justifyContent: 'space-between' }}>
                <span className="row gap-8" style={{ fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: g.tone === 'amber' ? 'var(--amber)' : g.tone === 'purple' ? 'var(--accent-2)' : g.tone === 'green' ? 'var(--green)' : 'var(--primary)' }} />
                  {g.group}
                </span>
                <I.ChevronDown size={12} className="muted"/>
              </div>
              {g.items.map(item => (
                <div key={item} className="palette-item">{item}</div>
              ))}
            </div>
          ))}
        </div>

        {/* CANVAS */}
        <div className="canvas-bg" style={{ borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="num-cube" style={{ width: 64, height: 64, margin: '0 auto 18px', fontSize: 24 }}>
                <I.Flow size={24}/>
              </div>
              <div className="row gap-10" style={{ justifyContent: 'center', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                <I.ArrowLeft size={14}/> Добавьте ноды из палитры
              </div>
              <div className="secondary" style={{ marginTop: 8, fontSize: 13 }}>Соединяйте порты для создания flow</div>
            </div>
          </div>

          {/* canvas controls */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-icon" style={{ width: 30, height: 30 }}><I.Plus size={12}/></button>
            <span className="mono" style={{ padding: '8px 10px', fontSize: 12 }}>100%</span>
            <button className="btn btn-secondary btn-icon" style={{ width: 30, height: 30 }}><I.X size={12}/></button>
            <button className="btn btn-secondary btn-icon" style={{ width: 30, height: 30 }}><I.Grid size={12}/></button>
            <button className="btn btn-secondary btn-icon" style={{ width: 30, height: 30 }}>1:1</button>
          </div>
        </div>

        {/* SETTINGS */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Настройки</div>
          <div className="empty" style={{ padding: '32px 8px', border: 'none', background: 'transparent' }}>
            <div className="ico"><I.Settings size={20}/></div>
            <div style={{ fontSize: 13 }}>Кликните на ноду<br/>для настройки</div>
          </div>
        </div>
      </div>

      <style>{`
        .palette-item {
          padding: 10px 12px;
          margin: 4px 0;
          border-radius: 10px;
          background: rgba(255,255,255,0.025);
          border: 1px solid var(--border);
          font-size: 12.5px;
          color: var(--text-secondary);
          cursor: grab;
          transition: all .15s var(--ease);
        }
        .palette-item:hover {
          border-color: rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.35);
          background: rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.06);
          color: var(--text-primary);
          transform: translateX(2px);
        }
      `}</style>
    </div>
  );
};

Object.assign(window, { DashboardTab, MarketplaceTab, SkillsTab, ConstructorTab });
