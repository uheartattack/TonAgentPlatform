// ===================================================================
// TAB GROUP 2 — My Agents, Analytics, Capabilities, Notifications
// ===================================================================

// ─── MY AGENTS (Мои агенты) ────────────────────────────────────────
const MyAgentsTab = () => {
  const [filter, setFilter] = useState('all');
  const agents = [
    { id: 277, name: 'Смешливый ТГ-Бот', desc: 'Агент для Telegram-аккаунта, который отвечает смешно и остроумно в личных сообщениях.', tag: 'CREATIVE', tagTone: 'purple', lvl: 1, age: '1 д', state: 'pause' },
    { id: 274, name: 'Gift Sniper',       desc: 'Снайпер подарков — автоматически находит и скупает недооценённые подарки ниже флора от 5%, перепродаёт с профитом.', tag: 'WORKER', tagTone: '', lvl: 1, age: '4 д', state: 'pause' },
    { id: 228, name: 'Шизо-Тролль 🌸 ✦', desc: 'Абсурдный шизопостер-тролль, который кидает рандомный бред на миксе русского и English, тролит собеседников абсурдными темами.', tag: 'SPECIALIST', tagTone: 'amber', lvl: 5, age: '2 д', state: 'pause' },
    { id: 201, name: 'TON Price Monitor', desc: 'Следит за ценой TON 24/7. Push-уведомления при отклонении от целевых уровней. Поддерживает алерты ATH/ATL.', tag: 'MONITOR', tagTone: 'green', lvl: 3, age: '6 д', state: 'pause' },
  ];
  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Мои агенты"
        title="Управляйте своими"
        grad="AI-агентами"
        subtitle="8 агентов · 0 активных · 8 на паузе"
        actions={
          <>
            <Btn icon={<I.Upload size={13}/>}>Импорт</Btn>
            <Btn variant="primary" icon={<I.Plus size={14}/>}>Создать агента</Btn>
          </>
        }
      />

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <Stat icon={<I.Cube size={16}/>} label="Всего агентов" value="8" valueClass="plain" />
        <Stat icon={<I.Play size={16}/>} label="Активных"     value="0" valueClass="green" />
        <Stat icon={<I.Pause size={16}/>} label="На паузе"    value="8" valueClass="amber" />
        <Stat icon={<I.Brain size={16}/>} label="AI-агентов"  value="8" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <PillTabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all',    label: 'Все',         count: 8 },
            { value: 'active', label: 'Активные',    count: 0 },
            { value: 'paused', label: 'Неактивные',  count: 8 },
          ]}
        />
      </div>

      <div className="col gap-14">
        {agents.map(a => (
          <div className="card hoverable" key={a.id} style={{ padding: '20px 24px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="eyebrow amber"><I.Pause size={9}/> На паузе</span>
              <Btn icon={<I.Chat size={13}/>}>AI Агент</Btn>
            </div>
            <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div className="row gap-10" style={{ marginBottom: 8 }}>
                  <span className="mono muted" style={{ fontSize: 12, fontWeight: 700 }}>#{a.id}</span>
                  <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{a.name}</h4>
                </div>
                <div className="secondary" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 14, maxWidth: 720 }}>{a.desc}</div>
                <div className="row gap-8">
                  <Chip tone={a.tagTone}>{a.tag}</Chip>
                  <Chip tone="muted"><I.TrendUp size={11} /> Ур. {a.lvl}</Chip>
                  <Chip tone="muted"><I.Clock size={11}/> {a.age}</Chip>
                </div>
              </div>

              <div className="col gap-10" style={{ alignItems: 'flex-end' }}>
                <div className="row gap-8">
                  <Btn variant="primary" icon={<I.Rocket size={13}/>}>Запуск</Btn>
                  <button className="btn btn-secondary btn-icon"><I.Copy size={13}/></button>
                  <button className="btn btn-secondary btn-icon"><I.Download size={13}/></button>
                  <button className="btn btn-secondary btn-icon"><I.Send size={13}/></button>
                  <button className="btn btn-secondary btn-icon"><I.Star size={13}/></button>
                  <button className="btn btn-danger btn-icon"><I.Trash size={13}/></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ANALYTICS (Аналитика) ─────────────────────────────────────────
const AnalyticsTab = () => {
  const [range, setRange] = useState('7');
  const data = [
    { label: 'вс, 17', value: 0 },
    { label: 'пн, 18', value: 0 },
    { label: 'вт, 19', value: 1 },
    { label: 'ср, 20', value: 1 },
    { label: 'чт, 21', value: 0 },
    { label: 'пт, 22', value: 1 },
    { label: 'сб, 23', value: 1 },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Analytics"
        title="Метрики и"
        grad="производительность"
        subtitle="Статистика выполнения и производительность агентов"
        actions={
          <>
            <PillTabs value={range} onChange={setRange} tabs={[
              { value: '7',  label: '7 дн'  },
              { value: '14', label: '14 дн' },
              { value: '30', label: '30 дн' },
            ]}/>
            <Btn icon={<I.Refresh size={13}/>}>Обновить</Btn>
          </>
        }
      />

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <Stat icon={<I.Rocket size={16}/>} label="Запуски"   value="2 009" />
        <Stat icon={<I.Check size={16}/>}  label="Успешность" value="5%"  valueClass="amber" />
        <Stat icon={<I.X size={16}/>}      label="Ошибки"     value="0"   valueClass="green" />
        <Stat icon={<I.Clock size={16}/>}  label="Ср. время"  value="9.2s" />
      </div>

      <div className="stat-grid" style={{ marginBottom: 32 }}>
        <Stat icon={<I.Hash size={16}/>}     label="Токены"  value="9 338K" />
        <Stat icon={<I.Cube size={16}/>}     label="Агентов" value="2"   valueClass="plain" />
        <Stat icon={<I.Trophy size={16}/>}   label="Лидер"   value="Джордж" />
        <Stat icon={<I.Calendar size={16}/>} label="Период"  value="7 дн" valueClass="plain" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="section-head"><h3>Запуски по дням</h3><span className="muted mono" style={{ fontSize: 11 }}>17–23 мая 2026</span></div>
          <BarChart data={data} height={220} />
        </div>
        <div className="card">
          <div className="section-head"><h3>Распределение</h3></div>
          <Donut value={0.05} label="успех"/>
          <div className="col gap-8" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <LegendRow color="var(--green)" label="Успешно" value="106" />
            <LegendRow color="var(--red)"   label="Ошибки"  value="0" />
            <LegendRow color="var(--primary)" label="Прочее" value="1 903" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head"><h3>Активность по часам</h3><span className="muted" style={{ fontSize: 12 }}>heatmap 7 дн × 24 ч</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 3, marginTop: 8 }}>
          <div></div>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="muted" style={{ fontSize: 10, textAlign: 'center', paddingBottom: 6 }}>
              {h % 3 === 0 ? h.toString().padStart(2, '0') : ''}
            </div>
          ))}
          {['вс','пн','вт','ср','чт','пт','сб'].map((d, di) => (
            <React.Fragment key={d}>
              <div className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>{d}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const intensity = Math.max(0, Math.min(1, (Math.sin(di * 0.7 + h * 0.4) + 1) / 2 * (di > 1 ? 1 : 0.3)));
                return (
                  <div key={h} style={{
                    height: 22, borderRadius: 4,
                    background: `linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),${intensity*0.55}), rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),${intensity*0.45}))`,
                    border: `1px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),${intensity*0.18 + 0.04})`,
                  }} />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const LegendRow = ({ color, label, value }) => (
  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
    <span className="row gap-8 secondary">
      <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
      {label}
    </span>
    <span className="mono" style={{ fontWeight: 700 }}>{value}</span>
  </div>
);

// ─── CAPABILITIES (Возможности) ────────────────────────────────────
const CapabilitiesTab = () => {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState({ 1: true });
  const [toggles, setToggles] = useState({});

  const groups = [
    { id: 1,  name: 'Сделки и эскроу', tools: 5,  state: 'Mixed' },
    { id: 2,  name: 'DeDust DEX',      tools: 5,  state: 'Mixed' },
    { id: 3,  name: 'DEX Агрегатор',   tools: 3,  state: 'All' },
    { id: 4,  name: 'TON DNS',         tools: 7,  state: 'Mixed' },
    { id: 5,  name: 'Jetton токены',   tools: 6,  state: 'Mixed' },
    { id: 6,  name: 'Журнал активности', tools: 3, state: 'Mixed' },
    { id: 7,  name: 'Контекстная память', tools: 4, state: 'Mixed' },
    { id: 8,  name: 'NFT коллекции',   tools: 4,  state: 'All' },
    { id: 9,  name: 'STON.fi Фарминг', tools: 5,  state: 'Mixed' },
    { id: 10, name: 'Telegram Bots',   tools: 8,  state: 'Mixed' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● 127 инструментов · 16 групп"
        title="Возможности"
        grad="агентов"
        subtitle="Включай и выключай группы инструментов для своих агентов"
        actions={
          <div className="search" style={{ width: 280 }}>
            <I.Search size={14} className="muted"/>
            <input placeholder="Search capabilities…"/>
          </div>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <PillTabs value={filter} onChange={setFilter} tabs={[
          { value: 'all',      label: 'Все',         count: 16 },
          { value: 'active',   label: 'Активные',    count: 14 },
          { value: 'inactive', label: 'Неактивные',  count: 2  },
        ]}/>
      </div>

      <div className="col gap-10">
        {groups.map(g => {
          const isOpen = !!open[g.id];
          const isOn = toggles[g.id] !== false;
          return (
            <div className="card" key={g.id} style={{ padding: '18px 22px' }}>
              <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setOpen({ ...open, [g.id]: !isOpen })}>
                <div className="row gap-14">
                  <I.Chevron size={14} className="muted" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}/>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{g.name}</span>
                  <Chip tone="muted">{g.tools} tools</Chip>
                </div>
                <div className="row gap-12">
                  <Chip tone={g.state === 'All' ? 'green' : 'amber'}>{g.state}</Chip>
                  <Toggle on={isOn} onChange={(v) => setToggles({ ...toggles, [g.id]: v })}/>
                </div>
              </div>
              {isOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="grid-2">
                    {Array.from({ length: g.tools }, (_, i) => (
                      <div className="row" key={i} style={{
                        padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                        justifyContent: 'space-between'
                      }}>
                        <div className="row gap-10">
                          <span className="mono primary" style={{ fontSize: 11, fontWeight: 700 }}>{String(i+1).padStart(2,'0')}</span>
                          <span style={{ fontSize: 13 }}>{g.name.toLowerCase().replace(/\s/g,'_')}_{i+1}</span>
                        </div>
                        <Toggle on={i % 3 !== 0} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── NOTIFICATIONS (Уведомления) ───────────────────────────────────
const NotificationsTab = () => {
  const [filter, setFilter] = useState('all');
  const alerts = [
    { tone: 'err',  ico: <I.AlertTri size={16}/>, title: 'API ключ не настроен',         tag: 'Gift Sniper',     msg: 'Агент не может работать без AI ключа. Перейдите в настройки и добавьте ключ.', time: '1 ч назад', actionLabel: 'Исправить' },
    { tone: 'err',  ico: <I.AlertTri size={16}/>, title: 'API ключ не настроен',         tag: 'Токсичный Тролль',msg: 'Агент не может работать без AI ключа. Перейдите в настройки и добавьте ключ.', time: '1 ч назад', actionLabel: 'Исправить' },
    { tone: 'warn', ico: <I.Clock size={16}/>,     title: 'Circuit breaker open',        tag: 'Агент #201',      msg: 'Слишком много API failures. Повторная попытка через 2 минуты.', time: '3 ч назад' },
    { tone: 'ok',   ico: <I.Check size={16}/>,     title: 'Агент успешно опубликован',   tag: 'Token Pulse v1.2',msg: 'Опубликован в маркетплейс. Стоимость публикации: 0.05 TON.', time: 'вчера' },
    { tone: '',     ico: <I.Info size={16}/>,      title: 'Доступна новая версия модели', tag: 'gemini-2.5-flash', msg: 'Google выпустил обновлённую версию модели. Переключиться в Персона → AI Модель.', time: '2 дн назад', actionLabel: 'Подробнее' },
    { tone: 'warn', ico: <I.AlertTri size={16}/>,  title: 'Низкий баланс кошелька',      tag: 'Root Wallet',     msg: 'Остаток 0.58 TON — рекомендуем пополнить до 1.5 TON для безостановочной работы агентов.', time: '3 дн назад', actionLabel: 'Пополнить' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Уведомления"
        title="Алерты, проблемы и"
        grad="рекомендации"
        subtitle="2 непрочитанных уведомления · последнее 1 час назад"
        actions={
          <>
            <Btn icon={<I.Check size={13}/>}>Прочитать все</Btn>
            <Btn variant="danger" icon={<I.Trash size={13}/>}>Очистить</Btn>
          </>
        }
      />

      <div className="stat-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Stat icon={<I.Bell size={16}/>}      label="Всего"           value="6" valueClass="plain" />
        <Stat icon={<I.AlertTri size={16}/>}  label="Ошибки"          value="3" valueClass="red" />
        <Stat icon={<I.Clock size={16}/>}     label="Предупреждения"  value="2" valueClass="amber" />
        <Stat icon={<I.Check size={16}/>}     label="Успехи"          value="1" valueClass="green" />
      </div>

      <div style={{ marginBottom: 22 }}>
        <PillTabs value={filter} onChange={setFilter} tabs={[
          { value: 'all',     label: 'Все',          count: 6 },
          { value: 'err',     label: 'Ошибки',       count: 3 },
          { value: 'warn',    label: 'Предупреждения', count: 2 },
          { value: 'ok',      label: 'Успехи',       count: 1 },
          { value: 'info',    label: 'Инфо',         count: 0 },
          { value: 'fb',      label: 'Фидбек' },
        ]}/>
      </div>

      <div className="col gap-12">
        {alerts.map((a, i) => (
          <div className={'alert ' + a.tone} key={i}>
            <div className="ico">{a.ico}</div>
            <div>
              <div className="alert-title">
                {a.title}
                <Chip tone="muted">{a.tag}</Chip>
              </div>
              <div className="alert-msg">{a.msg}</div>
              {a.actionLabel && (
                <div style={{ marginTop: 12 }}>
                  <Btn variant={a.tone === 'err' ? 'danger' : 'secondary'} icon={<I.ArrowRight size={12}/>}>{a.actionLabel}</Btn>
                </div>
              )}
            </div>
            <div className="alert-actions">
              <span className="alert-time">{a.time}</span>
              <button className="btn btn-secondary btn-icon" style={{ width: 28, height: 28 }}><I.X size={12}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { MyAgentsTab, AnalyticsTab, CapabilitiesTab, NotificationsTab });
