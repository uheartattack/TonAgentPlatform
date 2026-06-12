// ===================================================================
// THEMES — preset gallery + side-by-side comparison
// ===================================================================

const ThemesTab = ({ accent, setAccent }) => {
  const allPresets = [
    { id: 'aurora',  name: 'Aurora',  desc: 'TON blue × purple',  c1: '#0098EA', c2: '#a855f7' },
    { id: 'cyber',   name: 'Cyber',   desc: 'cyan × magenta',     c1: '#06b6d4', c2: '#ec4899' },
    { id: 'plasma',  name: 'Plasma',  desc: 'purple × pink',      c1: '#a855f7', c2: '#ec4899' },
    { id: 'emerald', name: 'Emerald', desc: 'emerald × teal',     c1: '#10b981', c2: '#14b8a6' },
    { id: 'sunset',  name: 'Sunset',  desc: 'amber × red',        c1: '#f59e0b', c2: '#ef4444' },
    { id: 'mono',    name: 'Mono',    desc: 'sky × indigo',       c1: '#0ea5e9', c2: '#6366f1' },
  ];

  const [compare, setCompare] = useState(['aurora', 'cyber', 'sunset']);
  const cycleCompare = (idx, dir) => {
    const cur = allPresets.findIndex(p => p.id === compare[idx]);
    const next = (cur + dir + allPresets.length) % allPresets.length;
    const out = [...compare];
    out[idx] = allPresets[next].id;
    setCompare(out);
  };

  return (
    <div className="page fade-in">
      <Hero
        eyebrow="● Theme Studio"
        title="Gradient"
        grad="presets"
        subtitle="6 готовых пресетов: каждый меняет --primary, --accent-2 и RGB-компоненты обоих одновременно. Hero / cards / chips / tabs / glow — всё подстраивается."
        cta={
          <>
            <Btn icon={<I.Palette size={13}/>}>Custom</Btn>
            <Btn variant="primary" icon={<I.Check size={13}/>}>Применить</Btn>
          </>
        }
      />

      {/* ── Preset gallery ── */}
      <SectionDivider count={allPresets.length}>Палитра</SectionDivider>
      <div className="grid-3" style={{ marginBottom: 32 }}>
        {allPresets.map(p => (
          <div key={p.id}
            className={'preset-card ' + (accent === p.id ? 'active' : '')}
            data-accent={p.id}
            onClick={() => setAccent(p.id)}
            style={{
              padding: 20, borderRadius: 16, cursor: 'pointer',
              background: 'var(--bg-secondary)',
              border: '1px solid ' + (accent === p.id ? 'rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.5)' : 'var(--border)'),
              position: 'relative', overflow: 'hidden',
              boxShadow: accent === p.id ? '0 0 0 1px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.30), 0 12px 32px rgba(0,0,0,0.25)' : 'none'
            }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${p.c1}, ${p.c2})`,
              opacity: accent === p.id ? 1 : 0.5
            }}/>
            <div style={{
              height: 96, borderRadius: 12, overflow: 'hidden',
              background: `linear-gradient(135deg, ${p.c1}, ${p.c2})`,
              marginBottom: 14, position: 'relative',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 6px 20px rgba(${p.c1.replace('#','').match(/../g).map(h=>parseInt(h,16)).join(',')},0.3)`
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle at 0% 100%, rgba(255,255,255,0.18), transparent 60%)`
              }}/>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{p.desc}</div>
              </div>
              {accent === p.id ? (
                <span className="eyebrow"><I.Check size={10}/> ACTIVE</span>
              ) : (
                <span className="chip" style={{ padding: '4px 10px', fontSize: 10.5 }}>tap</span>
              )}
            </div>
            <div className="row gap-8" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <span className="mono muted" style={{ fontSize: 10.5 }}>{p.c1.toUpperCase()}</span>
              <span className="muted" style={{ fontSize: 10.5 }}>→</span>
              <span className="mono muted" style={{ fontSize: 10.5 }}>{p.c2.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Side-by-side comparison ── */}
      <SectionDivider>Сравнение: один и тот же Dashboard, три пресета</SectionDivider>
      <div className="secondary" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 18, maxWidth: 760 }}>
        Каждая колонка — scoped <span className="mono primary">[data-accent]</span> блок. Меняйте пресет в каждой колонке кнопками снизу, чтобы поэкспериментировать.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {compare.map((presetId, i) => {
          const p = allPresets.find(x => x.id === presetId);
          return (
            <div key={i} data-accent={presetId} className="theme-preview-col">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <button className="btn btn-secondary btn-icon" onClick={() => cycleCompare(i, -1)} style={{ width: 28, height: 28 }}>
                  <I.ArrowLeft size={12}/>
                </button>
                <div className="row gap-8">
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                </div>
                <button className="btn btn-secondary btn-icon" onClick={() => cycleCompare(i, 1)} style={{ width: 28, height: 28 }}>
                  <I.ArrowRight size={12}/>
                </button>
              </div>
              <MiniDashboard />
            </div>
          );
        })}
      </div>

      {/* ── Implementation snippet ── */}
      <SectionDivider>CSS — пресеты в финальной форме</SectionDivider>
      <div className="card" style={{ padding: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>:root[data-accent="…"] presets</h3>
          <Btn icon={<I.Copy size={12}/>}>Скопировать</Btn>
        </div>
        <pre className="code" style={{ margin: 0, padding: 18, overflowX: 'auto', fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
{`:root[data-accent="aurora"]  { --primary: #0098EA; --accent-2: #a855f7;
                               --accent-r: 0;   --accent-g: 152; --accent-b: 234;
                               --accent2-r: 168; --accent2-g: 85;  --accent2-b: 247; }

:root[data-accent="cyber"]   { --primary: #06b6d4; --accent-2: #ec4899;
                               --accent-r: 6;   --accent-g: 182; --accent-b: 212;
                               --accent2-r: 236; --accent2-g: 72;  --accent2-b: 153; }

:root[data-accent="plasma"]  { --primary: #a855f7; --accent-2: #ec4899; … }
:root[data-accent="emerald"] { --primary: #10b981; --accent-2: #14b8a6; … }
:root[data-accent="sunset"]  { --primary: #f59e0b; --accent-2: #ef4444; … }
:root[data-accent="mono"]    { --primary: #0ea5e9; --accent-2: #6366f1; … }

/* switch globally */
document.documentElement.dataset.accent = 'cyber';

/* or scope to one block */
<div data-accent="emerald"> … </div>`}
        </pre>
      </div>

      <style>{`
        .theme-preview-col {
          padding: 16px;
          border-radius: 18px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
        }
        .preset-card.active { transform: translateY(-2px); }
        .preset-card:hover { transform: translateY(-2px); }
      `}</style>
    </div>
  );
};

// Compact dashboard for theme comparison — uses ONLY var() so each
// scoped data-accent container flips independently.
const MiniDashboard = () => (
  <div>
    {/* hero */}
    <div style={{
      position: 'relative',
      padding: 18,
      borderRadius: 14,
      background: `
        radial-gradient(circle at 0% 0%, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.25), transparent 55%),
        radial-gradient(circle at 100% 100%, rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.18), transparent 55%),
        linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.05), rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.03))`,
      border: '1px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.20)',
      marginBottom: 12, overflow: 'hidden'
    }}>
      <span className="eyebrow" style={{ fontSize: 9, padding: '3px 8px' }}>● LIVE</span>
      <div style={{
        fontSize: 19, fontWeight: 700, marginTop: 8, letterSpacing: '-0.02em', lineHeight: 1.15
      }}>
        Добрый день, <span style={{
          background: 'linear-gradient(135deg, var(--primary), var(--accent-2))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800
        }}>spend $</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>5 агентов · 9.2с avg</div>
    </div>

    {/* stat strip */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
      {[
        { l: 'ЗАПУСКОВ', v: '9973' },
        { l: 'УСПЕХ', v: '25%' },
      ].map((s) => (
        <div key={s.l} style={{
          position: 'relative',
          padding: 12, borderRadius: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, var(--primary), var(--accent-2))',
            opacity: 0.55
          }}/>
          <div className="muted" style={{ fontSize: 9, letterSpacing: '0.14em', fontWeight: 700 }}>{s.l}</div>
          <div style={{
            fontSize: 22, fontWeight: 800, marginTop: 6,
            background: 'linear-gradient(135deg, var(--primary), var(--accent-2))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontFamily: 'JetBrains Mono, monospace'
          }}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* pill tabs */}
    <div style={{
      display: 'inline-flex', gap: 3, padding: 4,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12, marginBottom: 12
    }}>
      <button className="pill-tab active" style={{ padding: '6px 12px', fontSize: 10.5 }}>Все</button>
      <button className="pill-tab" style={{ padding: '6px 12px', fontSize: 10.5 }}>DeFi</button>
      <button className="pill-tab" style={{ padding: '6px 12px', fontSize: 10.5 }}>NFT</button>
    </div>

    {/* card with num-cube + chips */}
    <div style={{
      position: 'relative',
      padding: 14, borderRadius: 14,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, var(--primary), var(--accent-2))',
        opacity: 0.55
      }}/>
      <div className="row gap-10" style={{ marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.15), rgba(var(--accent2-r),var(--accent2-g),var(--accent2-b),0.15))',
          border: '1px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.25)',
          color: 'var(--primary)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 12
        }}>01</div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Token Pulse</div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>
        Мониторит активность токенов TON: объём, киты, листинги, новые пары.
      </div>
      <div className="row gap-6">
        <span className="chip" style={{ padding: '3px 8px', fontSize: 10 }}>MONITORING</span>
        <span className="chip green" style={{ padding: '3px 8px', fontSize: 10 }}>active</span>
      </div>
    </div>

    {/* CTA */}
    <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: '10px 14px', fontSize: 12, justifyContent: 'center' }}>
      <I.Rocket size={12}/> Запустить агента
    </button>
  </div>
);

Object.assign(window, { ThemesTab });
