// ===================================================================
// PROFILE — account info, plan, balance, stats
// ===================================================================

const ProfileTab = () => {
  const stats = [
    { label: 'Всего агентов',    value: '5',     icon: <I.Cube size={15}/>,    tone: 'plain' },
    { label: 'Активных агентов', value: '0',     icon: <I.Play size={15}/>,    tone: 'green' },
    { label: 'Всего запусков',   value: '10 072', icon: <I.Rocket size={15}/>, tone: '' },
    { label: 'Успешность',       value: '24.8%', icon: <I.Check size={15}/>,   tone: 'amber' },
    { label: 'Токены',           value: '9.3M',  icon: <I.Hash size={15}/>,    tone: '' },
    { label: 'Бюджет потрачен',  value: '3.85',  icon: <I.Coin size={15}/>,    tone: 'green', suffix: 'TON' },
  ];

  const milestones = [
    { date: 'Май 2026',  text: 'Перешёл на Unlimited',   tone: 'primary' },
    { date: 'Апр 2026',  text: 'Опубликовал Token Pulse в маркетплейс', tone: 'green' },
    { date: 'Мар 2026',  text: 'Создал первого агента — TON Price Monitor', tone: '' },
    { date: 'Мар 2026',  text: 'Зарегистрировался в TON Agent Studio', tone: 'muted' },
  ];

  return (
    <div className="page fade-in">
      <PageHead
        eyebrow="● Аккаунт"
        title="Профиль —"
        grad="spend $"
        subtitle="Информация об аккаунте и статистика"
        actions={
          <>
            <Btn icon={<I.Edit size={13}/>}>Изменить</Btn>
            <Btn variant="primary" icon={<I.Save size={14}/>}>Сохранить</Btn>
          </>
        }
      />

      {/* ── Plan card — Unlimited tier with progress bars ── */}
      <div className="plan-card" style={{ marginBottom: 24 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 20, marginBottom: 26 }}>
          <div className="plan-diamond">
            <I.Cube size={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="row gap-10" style={{ alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
                <span className="grad" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Unlimited</span>
              </h2>
              <span className="eyebrow">● BETA TESTER</span>
            </div>
            <div className="secondary" style={{ fontSize: 13.5, marginTop: 4 }}>Бессрочно · все возможности платформы открыты</div>
          </div>
          <Btn icon={<I.ArrowRight size={13}/>}>Подробнее о плане</Btn>
        </div>

        <div className="grid-3" style={{ gap: 28 }}>
          {[
            { label: 'Агенты',       used: '5',  cap: '∞', pct: 65 },
            { label: 'Активные',     used: '0',  cap: '∞', pct: 0  },
            { label: 'AI генерации', used: '0',  cap: '∞', pct: 30 },
          ].map(p => (
            <div key={p.label}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="secondary" style={{ fontSize: 12.5 }}>{p.label}</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{p.used} / <span className="muted">{p.cap}</span></span>
              </div>
              <div className="progress" style={{ height: 5 }}><span style={{ width: p.pct + '%' }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Account + Balance ── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Account */}
        <div className="card">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>01</span> Аккаунт</h3>
            <span className="eyebrow green">● Верифицирован</span>
          </div>
          <div className="row" style={{ gap: 18, alignItems: 'center', marginBottom: 22 }}>
            <div className="avatar-lg">
              <div className="avatar-status" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-8" style={{ alignItems: 'baseline' }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em' }}>spend</h3>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>$</span>
              </div>
              <a className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}>@despensive</a>
              <div className="mono muted" style={{ fontSize: 11, letterSpacing: '0.08em', marginTop: 3 }}>ID: 130806013</div>
            </div>
          </div>

          <div className="col gap-6">
            <ProfileRow icon={<I.Send size={13}/>}  label="Telegram"          value="@despensive" tone="primary" />
            <ProfileRow icon={<I.Globe size={13}/>} label="Язык"              value="Русский · RU" />
            <ProfileRow icon={<I.Calendar size={13}/>} label="С нами с"       value="Март 2026 · 73 дня" />
            <ProfileRow icon={<I.Wallet size={13}/>} label="Привязанный кошелёк" value="UQCfRr…B4y_dh" tone="mono" />
          </div>
        </div>

        {/* Balance */}
        <div className="card">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <h3><span className="num-cube" style={{ width: 32, height: 32, fontSize: 13 }}>02</span> Баланс</h3>
            <Btn icon={<I.Plus size={13}/>}>Пополнить</Btn>
          </div>

          <div style={{
            padding: '20px 22px', borderRadius: 14, marginBottom: 14,
            background: 'linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.10), rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.06))',
            border: '1px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.22)'
          }}>
            <div className="muted" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Баланс</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em',
                background: 'linear-gradient(135deg, var(--primary), var(--accent-2))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                fontFamily: 'JetBrains Mono, monospace', lineHeight: 1
              }}>0.58</span>
              <span className="primary" style={{ fontWeight: 700, fontSize: 14 }}>TON</span>
              <span className="muted" style={{ fontSize: 12.5, marginLeft: 'auto' }}>≈ $3.42</span>
            </div>
          </div>

          <div className="col gap-6">
            <ProfileRow icon={<I.TrendUp size={13}/>} label="Всего заработано"   value="3.85 TON" tone="green" />
            <ProfileRow icon={<I.ArrowDown size={13}/>} label="Пополнений"       value="6 транзакций · 8.40 TON" />
            <ProfileRow icon={<I.ArrowUp size={13}/>} label="Выводов"            value="11 транзакций · 11.67 TON" />
            <ProfileRow icon={<I.Link size={13}/>}    label="Привязанный адрес"  value="agentplatform.ton" tone="primary" />
          </div>

          <div className="row gap-8" style={{ marginTop: 16 }}>
            <Btn icon={<I.ArrowUp size={13}/>}>Вывести</Btn>
            <Btn icon={<I.Tag size={13}/>}>Тарифы</Btn>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <SectionDivider count={stats.length}>Статистика</SectionDivider>
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {stats.map(s => (
          <div className="card" key={s.label} style={{ padding: '18px 20px' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row gap-12">
                <div className="stat-icon" style={{ width: 34, height: 34 }}>{s.icon}</div>
                <div>
                  <div className="muted" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
                  <div
                    style={{
                      marginTop: 6, fontSize: 22, fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.015em',
                      background: !s.tone ? 'linear-gradient(135deg, var(--primary), var(--accent-2))' : 'none',
                      WebkitBackgroundClip: !s.tone ? 'text' : 'unset',
                      WebkitTextFillColor: !s.tone ? 'transparent' : 'inherit',
                      color: s.tone === 'green' ? 'var(--green)' : s.tone === 'amber' ? 'var(--amber)' : 'var(--text-primary)'
                    }}>
                    {s.value}{s.suffix && <span style={{ fontSize: 13, marginLeft: 4, color: 'var(--text-secondary)' }}>{s.suffix}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Timeline ── */}
      <SectionDivider count={milestones.length}>Хронология</SectionDivider>
      <div className="card" style={{ padding: '26px 28px' }}>
        <div className="timeline">
          {milestones.map((m, i) => (
            <div className="tl-row" key={i}>
              <div className={'tl-dot ' + (m.tone || '')}/>
              <div className="row" style={{ justifyContent: 'space-between', flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{m.text}</div>
                <div className="mono muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{m.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .plan-card {
          position: relative;
          padding: 32px 36px;
          border-radius: 22px;
          background:
            radial-gradient(circle at 0% 0%, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.22), transparent 55%),
            radial-gradient(circle at 100% 100%, rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.16), transparent 55%),
            linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.06), rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.04));
          border: 1px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.22);
          overflow: hidden;
        }
        .plan-card::after {
          content: ""; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.06) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse at top right, black, transparent 60%);
          -webkit-mask-image: radial-gradient(ellipse at top right, black, transparent 60%);
          pointer-events: none;
          opacity: 0.55;
        }
        .plan-card > * { position: relative; z-index: 1; }

        .plan-diamond {
          width: 56px; height: 56px; border-radius: 16px;
          background: linear-gradient(135deg, var(--primary), var(--accent-2));
          display: grid; place-items: center; color: white;
          box-shadow: 0 8px 24px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.45),
                      inset 0 1px 0 rgba(255,255,255,0.25);
          flex-shrink: 0;
        }

        .avatar-lg {
          position: relative;
          width: 80px; height: 80px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 50%),
            linear-gradient(135deg, #8b1f30, #4b0e15);
          border: 2px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.35);
          box-shadow: 0 0 0 4px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.10),
                      0 8px 24px rgba(0,0,0,0.35);
          flex-shrink: 0;
        }
        .avatar-status {
          position: absolute; bottom: 2px; right: 2px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: var(--green);
          border: 3px solid var(--bg-secondary);
          box-shadow: 0 0 10px var(--green);
        }

        .timeline { position: relative; }
        .timeline::before {
          content: ""; position: absolute;
          left: 6px; top: 8px; bottom: 8px;
          width: 1px;
          background: linear-gradient(180deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.4), rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.05));
        }
        .tl-row {
          display: flex; align-items: center; gap: 18px;
          padding: 12px 0;
          position: relative;
        }
        .tl-dot {
          width: 13px; height: 13px; border-radius: 50%;
          background: var(--text-muted);
          border: 3px solid var(--bg-secondary);
          box-shadow: 0 0 0 2px var(--border);
          flex-shrink: 0;
          position: relative; z-index: 1;
          margin-left: -1px;
        }
        .tl-dot.primary {
          background: var(--primary);
          box-shadow: 0 0 0 2px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.35),
                      0 0 12px var(--primary);
        }
        .tl-dot.green {
          background: var(--green);
          box-shadow: 0 0 0 2px rgba(34,197,94,0.35), 0 0 10px var(--green);
        }
        .tl-dot.muted { opacity: 0.5; }
      `}</style>
    </div>
  );
};

const ProfileRow = ({ icon, label, value, tone }) => (
  <div className="row" style={{
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-subtle)'
  }}>
    <span className="row gap-10 secondary" style={{ fontSize: 12.5 }}>
      <span className="muted">{icon}</span>
      {label}
    </span>
    <span className={tone === 'primary' ? 'primary' : tone === 'green' ? 'green' : ''}
      style={{
        fontFamily: tone === 'mono' ? 'JetBrains Mono, monospace' : 'inherit',
        fontSize: 12.5, fontWeight: 600,
        color: tone === 'mono' ? 'var(--text-primary)' : undefined
      }}>{value}</span>
  </div>
);

Object.assign(window, { ProfileTab });
