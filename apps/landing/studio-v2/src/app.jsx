// Main app — sidebar + topbar + tab router.

const TABS = [
  {
    group: 'Главное',
    items: [
      { id: 'overview',    label: 'Обзор',         icon: I.Grid     },
      { id: 'constructor', label: 'Конструктор',   icon: I.Wrench,  badge: 'BETA' },
      { id: 'market',      label: 'Маркетплейс',   icon: I.Store    },
      { id: 'skills',      label: 'Скиллы',        icon: I.Sparkles, badge: 'NEW' },
      { id: 'mcp',         label: 'MCP-серверы',   icon: I.Server,  badge: 'NEW' },
      { id: 'assistant',   label: 'AI Ассистент',  icon: I.Chat     },
    ]
  },
  {
    group: 'Агенты',
    items: [
      { id: 'myagents',  label: 'Мои агенты',  icon: I.Users,    counter: 8 },
      { id: 'network',   label: 'Сеть агентов', icon: I.Share   },
      { id: 'analytics', label: 'Аналитика',    icon: I.Chart   },
      { id: 'all',       label: 'Все агенты',   icon: I.Shield, badge: 'ADM' },
      { id: 'payouts',   label: 'Выплаты',      icon: I.Coin,   badge: 'ADM' },
      { id: 'wallets',   label: 'Кошельки',     icon: I.Wallet, badge: 'BETA' },
      { id: 'activity',  label: 'Активность',   icon: I.Activity, live: true },
      { id: 'tester',    label: 'Тестер Хаб',   icon: I.Trophy, badge: 'BETA' },
    ]
  },
  {
    group: 'Настройка',
    items: [
      { id: 'persona',    label: 'Персона',     icon: I.User      },
      { id: 'kb',         label: 'База знаний', icon: I.Book      },
      { id: 'caps',       label: 'Возможности', icon: I.Star,     counter: 81 },
      { id: 'ext',        label: 'Расширения',  icon: I.Power     },
      { id: 'connectors', label: 'Коннекторы',  icon: I.Plug      },
    ]
  },
  {
    group: 'Аккаунт',
    items: [
      { id: 'profile',   label: 'Профиль',      icon: I.User  },
      { id: 'wallet',    label: 'Кошелёк',      icon: I.Wallet  },
      { id: 'settings',  label: 'Настройки',    icon: I.Settings },
      { id: 'guide',     label: 'Инструкции',   icon: I.Help     },
      { id: 'notif',     label: 'Уведомления',  icon: I.Bell, counter: 2 },
      { id: 'bugs',      label: 'Баг-трекер',   icon: I.Bug, badge: 'ADM' },
      { id: 'themes',    label: 'Темы',         icon: I.Palette, badge: 'NEW' },
    ]
  }
];

const App = () => {
  const [active, setActive] = useState('overview');
  const [accent, setAccent] = useState('aurora');

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const tabContent = () => {
    switch (active) {
      case 'overview':    return <DashboardTab />;
      case 'constructor': return <ConstructorTab />;
      case 'market':      return <MarketplaceTab />;
      case 'skills':      return <SkillsTab />;
      case 'myagents':    return <MyAgentsTab />;
      case 'analytics':   return <AnalyticsTab />;
      case 'caps':        return <CapabilitiesTab />;
      case 'notif':       return <NotificationsTab />;
      case 'settings':    return <SettingsTab accent={accent} setAccent={setAccent} />;
      case 'wallet':      return <WalletTab />;
      case 'bugs':        return <BugTrackerTab />;
      case 'persona':     return <PersonaTab />;
      case 'ext':         return <ExtensionsTab />;
      case 'activity':    return <ActivityTab />;
      case 'tester':      return <TesterHubTab />;
      case 'themes':      return <ThemesTab accent={accent} setAccent={setAccent} />;
      case 'profile':     return <ProfileTab />;
      default:            return <Placeholder id={active} />;
    }
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">A</div>
          <div>
            <div className="brand-name">TON <span className="accent">Agent Studio</span></div>
            <div className="brand-sub">AI Agent Builder</div>
          </div>
        </div>

        <div className="nav-scroll">
          {TABS.map(g => (
            <div className="nav-group" key={g.group}>
              <div className="nav-group-title">{g.group}</div>
              {g.items.map(t => {
                const Icon = t.icon;
                const isActive = active === t.id;
                return (
                  <div key={t.id}
                    className={'nav-item ' + (isActive ? 'active' : '')}
                    onClick={() => setActive(t.id)}>
                    <Icon size={16} />
                    <span>{t.label}</span>
                    {t.badge && <span className={'badge ' + (t.badge === 'BETA' ? '' : t.badge === 'NEW' ? '' : t.badge === 'ADM' ? '' : '')}>{t.badge}</span>}
                    {t.counter != null && (
                      <span className="badge" style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border)'
                      }}>{t.counter}</span>
                    )}
                    {t.live && <span className="dot" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="nav-foot">
          <div className="user-card" onClick={() => setActive('profile')} style={{ cursor: 'pointer' }}>
            <div className="user-avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">spend $</div>
              <div className="user-tier">◆ Unlimited · Beta</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: 'space-between', padding: '0 4px' }}>
            <div className="row gap-4">
              <button className={'pill-tab'} style={{ padding: '5px 10px', fontSize: 11 }}>EN</button>
              <button className={'pill-tab active'} style={{ padding: '5px 10px', fontSize: 11 }}>RU</button>
            </div>
            <span className="muted mono" style={{ fontSize: 10.5 }}>v2.4.1</span>
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center', padding: '9px', fontSize: 12, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.18)' }}>
            <I.Power size={13}/> Выйти
          </button>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <main>
        {/* TOPBAR */}
        <div className="topbar">
          <div className="search">
            <I.Search size={14} className="muted"/>
            <input placeholder="Search agents, tools, settings…"/>
            <span className="kbd">⌘K</span>
          </div>
          <div className="row gap-14">
            <button className="btn btn-secondary btn-icon"><I.Bell size={14}/></button>
            <div className="balance-pill">
              <div className="coin">◆</div>
              <em>Balance</em>
              <strong>0.58</strong>
              <span className="ton">TON</span>
            </div>
            <div className="avatar-btn" />
          </div>
        </div>

        {/* PAGE */}
        <div key={active}>
          {tabContent()}
        </div>
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => setActive('themes')} title="Сменить тему">
        <I.Palette size={20}/>
      </button>
    </div>
  );
};

const Placeholder = ({ id }) => (
  <div className="page fade-in">
    <PageHead
      eyebrow="● Placeholder"
      title="Эта вкладка"
      grad="скоро"
      subtitle={`Tab "${id}" не реализован в этом редизайн-прототипе. Открыты: Обзор, Конструктор, Маркетплейс, Скиллы, Мои агенты, Аналитика, Возможности, Уведомления, Настройки, Кошелёк, Баг-трекер, Персона, Расширения, Активность, Тестер Хаб, Темы.`}
    />
    <div className="tip">
      <div className="ico"><I.Info size={14}/></div>
      <div>В реальной версии все вкладки переехали бы на тот же визуальный язык: hero (только там где он уже был), eyebrow-бейджи, gradient-словa в заголовках, pill-tabs с активной градиентной подсветкой, cards с radial-glow и top-line, chips на 100px, uppercase-eyebrows для разделителей.</div>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
