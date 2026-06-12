// ===================================================================
// TAB GROUP 3 — Settings, Wallet, Bug Tracker, Persona, Extensions, Activity, Tester Hub
// ===================================================================

// ─── SETTINGS (Настройки) ──────────────────────────────────────────
const SettingsTab = ({ accent, setAccent }) => {
  const presets = [
    { id: 'aurora',  name: 'Aurora',  desc: 'TON blue × purple',  c1: '#0098EA', c2: '#a855f7' },
    { id: 'cyber',   name: 'Cyber',   desc: 'cyan × magenta',     c1: '#06b6d4', c2: '#ec4899' },
    { id: 'plasma',  name: 'Plasma',  desc: 'purple × pink',      c1: '#a855f7', c2: '#ec4899' },
    { id: 'emerald', name: 'Emerald', desc: 'emerald × teal',     c1: '#10b981', c2: '#14b8a6' },
    { id: 'sunset',  name: 'Sunset',  desc: 'amber × red',        c1: '#f59e0b', c2: '#ef4444' },
    { id: 'mono',    name: 'Mono',    desc: 'sky × indigo',       c1: '#0ea5e9', c2: '#6366f1' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Settings"
        title="Настройки и"
        grad="предпочтения"
        subtitle="Настройте агента и предпочтения платформы"
        actions={<Btn variant="primary" icon={<I.Save size={14}/>}>Сохранить</Btn>}
      />

      <div className="grid-2" style={{ marginBottom: 18 }}>
        {/* AI API key */}
        <div className="card">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>01</span> AI API Ключ</h3>
            <span className="eyebrow green">● Сохранён</span>
          </div>
          <div className="secondary" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
            Вашим агентам нужен AI ключ для работы. Выберите провайдера и введите ключ — он шифруется и синхронизируется с настройками бота.
          </div>
          <label className="field-label">Провайдер</label>
          <div className="input" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="row gap-8"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }}/> Gemini (Google)</span>
            <I.ChevronDown size={14} className="muted"/>
          </div>
          <label className="field-label">API Key</label>
          <div className="row gap-8" style={{ marginBottom: 14 }}>
            <input className="input mono" defaultValue="AIzaSy••••••••••••••••••••••HAG4" style={{ flex: 1 }}/>
            <Btn icon={<I.Eye size={13}/>}>Показать</Btn>
          </div>
          <div className="row gap-8">
            <Btn variant="primary" icon={<I.Save size={13}/>}>Сохранить ключ</Btn>
            <Btn variant="danger" icon={<I.Trash size={13}/>}>Очистить</Btn>
          </div>
        </div>

        {/* Telegram */}
        <div className="card">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>02</span> Telegram аккаунт</h3>
            <span className="eyebrow amber">● Не подключён</span>
          </div>
          <div className="secondary" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 20 }}>
            Подключите любой Telegram аккаунт. Ваши агенты будут действовать от его имени через MTProto. Сессия сохраняется локально.
          </div>
          <Btn variant="primary" icon={<I.Send size={13}/>}>Подключить Telegram</Btn>

          <div className="tip" style={{ marginTop: 24 }}>
            <div className="ico"><I.Info size={14}/></div>
            <div>Сессия сохраняется. Агенты используют этот аккаунт для сообщений, каналов и т.д.</div>
          </div>
        </div>
      </div>

      {/* ── Theme presets — new gradient picker ── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>03</span> Тема акцентов</h3>
          <span className="muted" style={{ fontSize: 12 }}>Текущий: <span className="primary" style={{ fontWeight: 700 }}>{presets.find(p => p.id === accent)?.name}</span></span>
        </div>
        <div className="secondary" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
          Каждый пресет определяет <span className="mono primary">--primary</span> и <span className="mono" style={{ color: 'var(--accent-2)' }}>--accent-2</span> одновременно. Меняет hero, cards, chips, tabs и все glow-эффекты во всём приложении.
        </div>
        <div className="grid-3">
          {presets.map(p => (
            <div key={p.id}
              className={'preset-card ' + (accent === p.id ? 'active' : '')}
              data-accent={p.id}
              onClick={() => setAccent(p.id)}>
              <div className="preset-swatch">
                <div className="ps-large" style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                <div className="ps-small ps-1" style={{ background: p.c1 }} />
                <div className="ps-small ps-2" style={{ background: p.c2 }} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{p.desc}</div>
                </div>
                {accent === p.id && <span className="primary"><I.Check size={16}/></span>}
              </div>
              <div className="row gap-6" style={{ marginTop: 12 }}>
                <span className="eyebrow" style={{ padding: '3px 8px', fontSize: 9.5 }}>● PREVIEW</span>
                <span className="chip" style={{ padding: '4px 9px', fontSize: 10.5 }}>chip</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="card">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>04</span> Безопасность</h3>
          <Chip tone="green">WCAG AA</Chip>
        </div>
        {[
          { title: 'Логирование',          desc: 'Записывать все действия агента',  on: true },
          { title: 'Подтверждать действия', desc: 'Спрашивать перед критическими операциями', on: true },
          { title: 'Авто-завершение сессий', desc: 'Закрывать неактивные сессии через 30 минут', on: false },
          { title: 'Двухфакторная аутентификация', desc: 'Через Telegram при критических действиях', on: true },
        ].map((row, i) => (
          <div className="row" key={i} style={{
            padding: '14px 0', borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{row.title}</div>
              <div className="secondary" style={{ fontSize: 12.5, marginTop: 2 }}>{row.desc}</div>
            </div>
            <Toggle on={row.on}/>
          </div>
        ))}
      </div>

      <style>{`
        .preset-card {
          position: relative;
          padding: 18px;
          border-radius: 16px;
          background:
            linear-gradient(180deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.04), transparent 60%),
            var(--bg-secondary);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: all .2s var(--ease);
          overflow: hidden;
        }
        .preset-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--primary), var(--accent-2));
          opacity: 0;
          transition: opacity .2s;
        }
        .preset-card:hover { border-color: rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.32); transform: translateY(-2px); }
        .preset-card:hover::before { opacity: 0.55; }
        .preset-card.active {
          border-color: rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.5);
          box-shadow: 0 0 0 1px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.30),
                      0 12px 32px rgba(0,0,0,0.25);
        }
        .preset-card.active::before { opacity: 1; }
        .preset-swatch {
          position: relative; height: 78px; margin-bottom: 14px;
          border-radius: 12px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .ps-large { position: absolute; inset: 0; }
        .ps-small { position: absolute; bottom: 10px; width: 28px; height: 28px; border-radius: 8px; border: 2px solid var(--bg-secondary); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
        .ps-1 { right: 50px; }
        .ps-2 { right: 14px; }
      `}</style>
    </div>
  );
};

// ─── WALLET (Кошелёк) ──────────────────────────────────────────────
const WalletTab = () => {
  const txs = [
    { type: 'out', label: 'Вывод', sub: 'Withdraw request → UQATIAR49Ab1… [tx:e8720e3…]', amt: '−2.31 TON', amtTone: 'red', ts: '20 мая 22:35' },
    { type: 'in',  label: 'Пополнение', sub: 'Dashboard topup', amt: '+2.85 TON', amtTone: 'green', ts: '20 мая 22:34' },
    { type: 'out', label: 'Вывод', sub: 'Withdraw request → UQATIAR49Ab1… [tx:0ed08cd…]', amt: '−0.16 TON', amtTone: 'red', ts: '20 мая 22:09' },
    { type: 'out', label: 'Вывод', sub: 'Withdraw request → UQATIAR49Ab1… [tx:0ed08cd…]', amt: '−0.80 TON', amtTone: 'red', ts: '20 мая 22:09' },
    { type: 'in',  label: 'Пополнение', sub: 'Author royalty: Token Pulse', amt: '+1.20 TON', amtTone: 'green', ts: '19 мая 14:02' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● TON Кошелёк"
        title="Управляйте балансом и"
        grad="транзакциями"
        subtitle="Self-custody · ваши средства, ваш контроль"
        actions={
          <>
            <Btn icon={<I.Plus size={13}/>}>Пополнить</Btn>
            <Btn variant="primary" icon={<I.ArrowUp size={13}/>}>Вывести</Btn>
          </>
        }
      />

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: '24px 26px' }}>
          <div className="row gap-10" style={{ marginBottom: 12 }}>
            <div className="stat-icon"><I.Wallet size={16}/></div>
            <span className="stat-label">Баланс</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.025em',
            background: 'linear-gradient(135deg, var(--primary), var(--accent-2))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontFamily: 'JetBrains Mono, monospace' }}>
            0.58<span style={{ fontSize: 18, marginLeft: 8 }}>TON</span>
          </div>
          <div className="secondary" style={{ fontSize: 12.5, marginTop: 8 }}>≈ $3.42 USD</div>
        </div>

        <div className="card" style={{ padding: '24px 26px' }}>
          <div className="row gap-10" style={{ marginBottom: 12 }}>
            <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.25)', color: 'var(--green)' }}><I.TrendUp size={16}/></div>
            <span className="stat-label">Всего заработано</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.025em',
            background: 'linear-gradient(135deg, var(--green), #34d399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontFamily: 'JetBrains Mono, monospace' }}>
            3.85<span style={{ fontSize: 18, marginLeft: 8 }}>TON</span>
          </div>
          <div className="secondary" style={{ fontSize: 12.5, marginTop: 8 }}>Авторские отчисления, маркетплейс</div>
        </div>

        <div className="card" style={{ padding: '24px 26px' }}>
          <div className="row gap-10" style={{ marginBottom: 12 }}>
            <div className="stat-icon"><I.Link size={16}/></div>
            <span className="stat-label">Кошелёк платформы</span>
          </div>
          <div className="primary mono" style={{ fontSize: 16, fontWeight: 700 }}>agentplatform.ton</div>
          <div className="mono muted" style={{ fontSize: 11.5, marginTop: 8, wordBreak: 'break-all' }}>UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h3>Подключенный кошелёк</h3>
          <span className="eyebrow green">● Tonkeeper · Подключён</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', padding: '14px 0' }}>
          <div className="row gap-14">
            <div className="num-cube" style={{ background: 'linear-gradient(135deg, #0098EA, #00b3ff)' }}>
              <I.Wallet size={18}/>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Tonkeeper</div>
              <div className="mono muted" style={{ fontSize: 12, marginTop: 2 }}>UQCfRr…y_dh</div>
            </div>
          </div>
          <Btn variant="danger">Отключить</Btn>
        </div>
      </div>

      <div className="card">
        <div className="section-head" style={{ marginBottom: 6 }}>
          <h3>История транзакций</h3>
          <PillTabs value="all" onChange={()=>{}} tabs={[
            { value: 'all',  label: 'Все' },
            { value: 'in',   label: 'Пополнения' },
            { value: 'out',  label: 'Выводы' },
            { value: 'fees', label: 'Расходы' },
          ]}/>
        </div>
        <div>
          {txs.map((t, i) => (
            <div key={i} className="row" style={{
              padding: '14px 4px', borderBottom: i < txs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              justifyContent: 'space-between'
            }}>
              <div className="row gap-14">
                <div className="stat-icon" style={{
                  background: t.type === 'in' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
                  borderColor: t.type === 'in' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                  color: t.type === 'in' ? 'var(--green)' : 'var(--red)'
                }}>
                  {t.type === 'in' ? <I.ArrowDown size={16}/> : <I.ArrowUp size={16}/>}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</div>
                  <div className="mono muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.sub}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={t.amtTone + ' mono'} style={{ fontWeight: 700 }}>{t.amt}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.ts}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── BUG TRACKER (Баг-трекер) ──────────────────────────────────────
const BugTrackerTab = () => {
  const [view, setView] = useState('platform');
  const sources = [
    { name: 'ai-agent-runtime', count: 23517, pct: 100 },
    { name: 'agent:246',        count: 15689, pct: 66 },
    { name: 'console.error',    count: 14645, pct: 62 },
    { name: 'agent:201',        count: 7645,  pct: 32 },
    { name: 'agent:252',        count: 4880,  pct: 20 },
    { name: 'src/index.ts',     count: 3921,  pct: 16 },
    { name: 'agent:270',        count: 3073,  pct: 13 },
    { name: 'agent:243',        count: 2342,  pct: 10 },
    { name: 'agent:272',        count: 971,   pct: 4 },
    { name: 'agent:258',        count: 895,   pct: 4 },
  ];
  const bugs = [
    { id: 'x16015', src: 'ai-agent-runtime', msg: '[AI runtime] Agent #281 AI error dump: status=429 code=undefined type=undefined msg=429 status code (no body) headers={} body={} tools=60 msgCount=7', first: '42 дн', last: '4 ч' },
    { id: 'x15687', src: 'agent:246',        msg: 'AI call failed: 429 status code (no body)', first: '39 дн', last: '4 ч' },
    { id: 'x13992', src: 'console.error',    msg: 'TIMEOUT', first: '35 дн', last: 'сейчас' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Bug Tracker · ADM"
        title="Баг-трекер"
        grad="платформы"
        subtitle="202 открытых · 11 исправлено · 1 проигнорирован"
        actions={<PillTabs value={view} onChange={setView} tabs={[
          { value: 'platform', label: 'Платформа' },
          { value: 'agents',   label: 'Агенты' },
          { value: 'feedback', label: 'Фидбек' },
          { value: 'reports',  label: 'Отчёты' },
        ]}/>}
      />

      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <Stat icon={<I.Bug size={16}/>}      label="Открытые"     value="202" valueClass="red" />
        <Stat icon={<I.Clock size={16}/>}    label="В работе"     value="0"   valueClass="amber" />
        <Stat icon={<I.Check size={16}/>}    label="Исправлены"   value="11"  valueClass="green" />
        <Stat icon={<I.X size={16}/>}        label="Игнорируются" value="1"   valueClass="plain" />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h3>Источники</h3>
          <span className="muted" style={{ fontSize: 12 }}>топ-10 по объёму</span>
        </div>
        <div className="col gap-10">
          {sources.map(s => (
            <div key={s.name} className="row" style={{ gap: 16 }}>
              <div className="mono" style={{ fontSize: 12.5, width: 180, color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</div>
              <div className="progress" style={{ flex: 1 }}><span style={{ width: s.pct + '%' }} /></div>
              <div className="mono" style={{ width: 60, textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12.5 }}>{s.count.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <SectionDivider count={bugs.length}>Последние баги</SectionDivider>

      <div className="col gap-12">
        {bugs.map(b => (
          <div className="card" key={b.id} style={{ padding: '18px 22px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="row gap-12">
                <Chip tone="red">{b.id}</Chip>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600 }}>{b.src}</span>
              </div>
              <div className="row gap-6">
                <Btn icon={<I.Wrench size={11}/>}>Fix</Btn>
                <Btn icon={<I.Check size={11}/>}>Done</Btn>
                <Btn icon={<I.X size={11}/>}>Ign</Btn>
              </div>
            </div>
            <div className="mono secondary" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{b.msg}</div>
            <div className="row gap-14 muted" style={{ marginTop: 12, fontSize: 11.5 }}>
              <span><I.Calendar size={11} style={{ verticalAlign:'-1px', marginRight:4 }}/>First: {b.first}</span>
              <span><I.Clock size={11} style={{ verticalAlign:'-1px', marginRight:4 }}/>Last: {b.last}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PERSONA (Персона) ─────────────────────────────────────────────
const PersonaTab = () => (
  <div className="page fade-in">
    <PageHead
      eyebrow="● Persona"
      title="Настройки"
      grad="AI-персоны"
      subtitle="Настройки AI-персоны и языка для ваших агентов"
      actions={<Btn variant="primary" icon={<I.Save size={14}/>}>Сохранить</Btn>}
    />
    <div className="grid-2">
      <div className="card">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>01</span> AI модель</h3>
        </div>
        <div className="col gap-14">
          <div>
            <label className="field-label">Модель</label>
            <div className="input" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span className="row gap-8"><I.Brain size={14} className="primary"/> Gemini 2.5 Flash <span className="chip" style={{ padding: '3px 8px', fontSize: 10 }}>default</span></span>
              <I.ChevronDown size={14} className="muted"/>
            </div>
          </div>
          <div>
            <label className="field-label">Язык ответов</label>
            <div className="input" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Auto-detect</span><I.ChevronDown size={14} className="muted"/>
            </div>
          </div>
          <div>
            <label className="field-label">Тон</label>
            <div className="row gap-6">
              {['Professional','Casual','Friendly','Witty'].map((t, i) => (
                <button key={t} className={'pill-tab ' + (i === 0 ? 'active' : '')} style={{ flex: 1, justifyContent: 'center' }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Имя персоны</label>
            <input className="input" placeholder="e.g. TradeBot, DeFi Watcher"/>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>02</span> Инструкции для AI</h3>
          <span className="muted" style={{ fontSize: 12 }}>system prompt prefix</span>
        </div>
        <div className="secondary" style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>
          Эти инструкции добавляются к каждому запросу создания агента.
        </div>
        <textarea className="textarea" rows={11} placeholder="e.g. Always use USDT prices. Notify in Russian. Avoid leveraged positions. Keep responses under 200 chars in Telegram."/>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <span className="muted mono" style={{ fontSize: 11 }}>0 / 2000 chars</span>
          <Btn icon={<I.Code size={12}/>}>Шаблоны</Btn>
        </div>
      </div>
    </div>
  </div>
);

// ─── EXTENSIONS (Расширения) ───────────────────────────────────────
const ExtensionsTab = () => {
  const [tab, setTab] = useState('installed');
  const installed = [
    { name: 'GiftStat Аналитика', status: 'installed', desc: 'Аналитика в реальном времени для маркетплейса Telegram Gifts. Отслеживайте цены, статистику коллекций, объём торгов и исторические тренды.', tags: ['market-data','telegram','analytics','gifts'], by: 'TON Agent Team', v: '2.1.0', tools: 12 },
    { name: 'Gas111 Launcher',    status: 'update',    desc: 'Запускайте и управляйте меме-токенами на протоколе Gas111. Создавайте токенсейлы, настраивайте вестинг и отслеживайте метрики.', tags: ['token-launch','ton','defi','meme'], by: 'Gas111 Labs', v: '4.2.1', tools: 15, newV: '4.3.0' },
  ];
  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Расширения"
        title="Улучшите агента"
        grad="плагинами"
        subtitle="Улучшите агента с помощью плагинов сообщества"
        actions={
          <div className="search" style={{ width: 280 }}>
            <I.Search size={14} className="muted"/>
            <input placeholder="Search extensions…"/>
          </div>
        }
      />
      <div style={{ marginBottom: 22 }}>
        <PillTabs value={tab} onChange={setTab} tabs={[
          { value: 'installed', label: 'Установлено', count: 2 },
          { value: 'market',    label: 'Маркетплейс', count: 142 },
          { value: 'updates',   label: 'Обновления',  count: 1 },
        ]}/>
      </div>

      <div className="col gap-14">
        {installed.map(ext => (
          <div className="card hoverable" key={ext.name}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div className="row gap-14">
                <div className="num-cube" style={{ width: 48, height: 48, fontSize: 17, borderRadius: 14 }}>
                  {ext.name[0]}
                </div>
                <div>
                  <div className="row gap-10">
                    <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{ext.name}</h4>
                    <span className="eyebrow green">● Установлено</span>
                    {ext.status === 'update' && <span className="eyebrow amber">● Обновление v{ext.newV}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>by {ext.by} · v{ext.v} · {ext.tools} tools</div>
                </div>
              </div>
              <div className="row gap-8">
                {ext.status === 'update' && <Btn variant="primary" icon={<I.Refresh size={13}/>}>Обновить</Btn>}
                <Btn variant="danger" icon={<I.Trash size={13}/>}>Удалить</Btn>
              </div>
            </div>
            <div className="secondary" style={{ fontSize: 13.5, lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>{ext.desc}</div>
            <div className="row gap-6">
              {ext.tags.map(t => <Chip key={t} tone="muted">{t}</Chip>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ACTIVITY (Активность) ─────────────────────────────────────────
const ActivityTab = () => {
  const logs = [
    { ts: '16:03:02', msg: '[Агент #201] Circuit breaker open: too many API failures. Retry in 1 minutes.', lvl: 'warn' },
    { ts: '16:02:02', msg: '[Агент #201] Circuit breaker open: too many API failures. Retry in 2 minutes.', lvl: 'warn' },
    { ts: '16:01:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '16:00:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '15:59:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '15:58:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '15:57:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '15:56:02', msg: '[Агент #201] Circuit breaker open: too many API failures. Retry in 1 minutes.', lvl: 'warn' },
    { ts: '15:55:02', msg: '[Агент #201] Circuit breaker open: too many API failures. Retry in 2 minutes.', lvl: 'warn' },
    { ts: '15:54:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '15:53:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
    { ts: '15:52:02', msg: '[Агент #201] [AI run] start, pendingMsgs=0', lvl: '' },
  ];
  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● В прямом эфире"
        eyebrowTone="green"
        title="Поток"
        grad="активности"
        subtitle="Логи всех агентов в реальном времени · 1 запись в секунду"
        actions={
          <>
            <Btn icon={<I.Filter size={13}/>}>Фильтр</Btn>
            <Btn variant="danger" icon={<I.Trash size={13}/>}>Очистить</Btn>
          </>
        }
      />

      <div className="card flat" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="row" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between', background: 'rgba(255,255,255,0.015)' }}>
          <div className="row gap-10">
            <span className="row gap-6 mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
              <I.Activity size={12} className="green"/> LIVE FEED
            </span>
            <span className="muted mono" style={{ fontSize: 11 }}>· tail -f /var/log/agents</span>
          </div>
          <div className="row gap-8 muted mono" style={{ fontSize: 11 }}>
            <span className="green">● info: 10</span>
            <span className="amber">● warn: 4</span>
            <span className="red">● err: 0</span>
          </div>
        </div>
        <div>
          {logs.map((l, i) => (
            <div key={i} className="log-row">
              <span className={'lvl ' + (l.lvl || '')}>{l.lvl ? l.lvl.toUpperCase() : 'INFO'}</span>
              <span className="ts">{l.ts}</span>
              <span className="msg">{l.msg.split(' ').map((w, wi) => /\[Агент/.test(w) || /Circuit/.test(w) || /\[AI/.test(w) ? <b key={wi}>{w} </b> : <span key={wi}>{w} </span>)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── TESTER HUB (Тестер Хаб) ───────────────────────────────────────
const TesterHubTab = () => {
  const leaderboard = [
    { rank: 1, name: 'despensive', xp: 1165, you: true },
    { rank: 2, name: 'uheartattack', xp: 68 },
    { rank: 3, name: 'wordless', xp: 43 },
    { rank: 4, name: 'balance_new', xp: 6 },
    { rank: 5, name: 'autistic_prince', xp: 3 },
    { rank: 6, name: 'spreadollars', xp: 2 },
    { rank: 7, name: 'a01xxx', xp: 2 },
    { rank: 8, name: 'nedarni', xp: 1 },
  ];
  const shop = [
    { name: '+10 Генераций',         price: 10  },
    { name: 'Ранний доступ',         price: 20  },
    { name: 'Голос x2',              price: 30  },
    { name: 'Настройка агента',      price: 50  },
    { name: '1:1 с разработчиком',   price: 75  },
    { name: 'Имя в Credits',         price: 100 },
    { name: 'Закрытый канал',        price: 150 },
    { name: 'Заморозка streak',      price: 10  },
  ];
  const achievements = [
    { name: 'Первая кровь',    sub: 'Report your first bug',     done: true },
    { name: 'Охотник за багами', sub: '10 bugs reported',          done: true },
    { name: 'Истребитель',     sub: '50 bugs reported',          done: false },
    { name: 'Визионер',        sub: '5 features proposed',       done: false },
    { name: 'Архитектор',      sub: 'Your feature was implemented', done: false },
    { name: 'Стабильный',      sub: '7-day streak',              done: false },
  ];

  return (
    <div className="page fade-in">
      <Hero
        eyebrow="● Tester Hub · BETA"
        title="Уровень 5 —"
        grad="Мастер"
        subtitle="7 очков · 335 до Легенды. 2% прогресса до следующего уровня."
        stats={[
          { value: '1165', label: 'XP' },
          { value: '7',    label: 'Очки' },
          { value: '4',    label: 'Баги' },
          { value: '4',    label: 'Фичи' },
        ]}
        cta={<Btn variant="primary" icon={<I.Plus size={14}/>}>Daily Check-in (+1 очко)</Btn>}
      />

      <div className="card" style={{ marginBottom: 24, padding: 22 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="row gap-10">
            <span className="muted mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>Lv.5</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Мастер</span>
          </div>
          <div className="row gap-10">
            <span className="primary mono" style={{ fontWeight: 700 }}>2%</span>
            <span className="muted mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>Lv.6 Легенда</span>
          </div>
        </div>
        <div className="progress" style={{ height: 10 }}><span style={{ width: '2%' }} /></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h3><I.Trophy size={15} className="primary"/> Лидерборд</h3>
            <Chip tone="amber"><I.Calendar size={11}/> 1 дн streak</Chip>
          </div>
          <div className="col gap-4">
            {leaderboard.map(p => (
              <div className="row" key={p.rank} style={{
                padding: '12px 14px', borderRadius: 10,
                background: p.you ? 'linear-gradient(90deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.10), transparent)' : 'transparent',
                border: '1px solid ' + (p.you ? 'rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.25)' : 'transparent'),
                justifyContent: 'space-between'
              }}>
                <div className="row gap-12">
                  <span className={'mono ' + (p.rank <= 3 ? 'primary' : 'muted')} style={{ fontWeight: 800, width: 18 }}>{p.rank}</span>
                  <span style={{ fontWeight: p.you ? 700 : 500 }}>{p.name}</span>
                  {p.you && <Chip tone="green">YOU</Chip>}
                </div>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.xp} XP</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h3><I.Tag size={15} className="primary"/> Магазин <span className="muted" style={{ fontSize: 12 }}>(7 доступно)</span></h3>
          </div>
          <div className="col gap-6">
            {shop.map(s => (
              <div className="row" key={s.name} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>{s.name}</span>
                <span className="row gap-10">
                  <span className="mono primary" style={{ fontSize: 11.5, fontWeight: 700 }}>{s.price} pts</span>
                  <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}>Купить</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h3><I.Star size={15} className="primary"/> Достижения</h3>
          <span className="muted" style={{ fontSize: 12 }}>2 из 6 разблокировано</span>
        </div>
        <div className="grid-3">
          {achievements.map(a => (
            <div key={a.name} style={{
              padding: 16, borderRadius: 14,
              background: a.done ? 'linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.08), rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.05))' : 'rgba(255,255,255,0.015)',
              border: '1px solid ' + (a.done ? 'rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.28)' : 'var(--border-subtle)'),
              opacity: a.done ? 1 : 0.55
            }}>
              <div className="num-cube" style={{ width: 36, height: 36, fontSize: 14, marginBottom: 10 }}>
                {a.done ? <I.Check size={14}/> : <I.Star size={14}/>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{a.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SettingsTab, WalletTab, BugTrackerTab, PersonaTab, ExtensionsTab, ActivityTab, TesterHubTab });
