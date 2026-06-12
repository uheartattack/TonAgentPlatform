// Reusable primitives shared across tab components.

const { useState, useEffect, useRef, useMemo } = React;

// ── HERO ───────────────────────────────────────────────────────────
const Hero = ({ eyebrow, eyebrowTone, title, grad, subtitle, children, stats, cta }) => (
  <div className="hero">
    <div className="hero-grid">
      <div>
        {eyebrow && <span className={`eyebrow ${eyebrowTone || ''}`}>{eyebrow}</span>}
        <h1 className="hero-title">
          {title}
          {grad && <> <span className="grad">{grad}</span></>}
        </h1>
        {subtitle && <div className="hero-sub">{subtitle}</div>}
        {stats && (
          <div className="hero-stats">
            {stats.map((s, i) => (
              <div key={i} className="hero-stat">
                <div className="v">{s.value}</div>
                <div className="l">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {(cta || children) && <div className="hero-cta">{cta || children}</div>}
    </div>
  </div>
);

// ── PAGE HEAD (small variant when there's no hero) ─────────────────
const PageHead = ({ eyebrow, eyebrowTone, title, grad, subtitle, actions }) => (
  <div className="page-head">
    <div>
      {eyebrow && <span className={`eyebrow ${eyebrowTone || ''}`}>{eyebrow}</span>}
      <h1 className="page-title">
        {title}
        {grad && <> <span className="grad">{grad}</span></>}
      </h1>
      {subtitle && <div className="page-sub">{subtitle}</div>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

// ── PILL TABS ──────────────────────────────────────────────────────
const PillTabs = ({ tabs, value, onChange }) => (
  <div className="pill-tabs">
    {tabs.map(t => (
      <button
        key={t.value}
        className={'pill-tab ' + (t.value === value ? 'active' : '')}
        onClick={() => onChange(t.value)}>
        {t.label}
        {t.count != null && <span className="count">{t.count}</span>}
      </button>
    ))}
  </div>
);

// ── STAT CARD ──────────────────────────────────────────────────────
const Stat = ({ icon, label, value, valueClass, foot, trend }) => (
  <div className="stat">
    <div className="stat-head">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
    </div>
    <div className={`stat-value ${valueClass || ''}`}>{value}</div>
    {foot && <div className="stat-foot">{foot}</div>}
    {trend && (
      <div className={`stat-trend ${trend.dir}`} style={{ marginTop: 6 }}>
        {trend.dir === 'up' ? <I.ArrowUp size={11} /> : <I.ArrowDown size={11} />}
        {trend.text}
      </div>
    )}
  </div>
);

// ── CHIP ───────────────────────────────────────────────────────────
const Chip = ({ tone, children }) => (
  <span className={`chip ${tone || ''}`}>{children}</span>
);

// ── TIP / INFO BOX ─────────────────────────────────────────────────
const Tip = ({ icon, children }) => (
  <div className="tip">
    <div className="ico">{icon || <I.Info size={16} />}</div>
    <div>{children}</div>
  </div>
);

// ── SECTION DIVIDER (uppercase eyebrow + horizontal rule) ──────────
const SectionDivider = ({ children, count }) => (
  <div className="section-divider">
    <span>{children}</span>
    {count != null && <span className="count">· {count}</span>}
  </div>
);

// ── TOGGLE ─────────────────────────────────────────────────────────
const Toggle = ({ on, onChange }) => (
  <div className={'toggle ' + (on ? 'on' : '')} onClick={() => onChange && onChange(!on)} />
);

// ── SLIDER (presentational only) ───────────────────────────────────
const Slider = ({ value, min = 0, max = 1, step = 0.01, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const ref = useRef(null);
  return (
    <div className="slider-track" ref={ref}
      onClick={(e) => {
        if (!onChange) return;
        const r = ref.current.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const v = min + p * (max - min);
        onChange(Math.round(v / step) * step);
      }}>
      <div className="slider-fill" style={{ width: pct + '%' }} />
      <div className="slider-thumb" style={{ left: pct + '%' }} />
    </div>
  );
};

// ── DONUT (SVG) ────────────────────────────────────────────────────
const Donut = ({ value, label, size = 200, stroke = 14 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value);
  const gid = `g${Math.random().toString(36).slice(2,7)}`;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r}
          stroke={`url(#${gid})`} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <div className="center">
        <div className="v">{Math.round(value*100)}%</div>
        <div className="l">{label}</div>
      </div>
    </div>
  );
};

// ── BAR CHART ──────────────────────────────────────────────────────
const BarChart = ({ data, height = 200 }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="bar">
          <div className="bar-fill" style={{ height: (d.value / max) * (height - 30) + 'px' }}>
            <span className="bar-val">{d.value}</span>
          </div>
          <span className="bar-lbl">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── BUTTON ─────────────────────────────────────────────────────────
const Btn = ({ variant = 'secondary', icon, children, onClick, size }) => (
  <button className={`btn btn-${variant} ${size === 'icon' ? 'btn-icon' : ''}`} onClick={onClick}>
    {icon && icon}
    {children}
  </button>
);

// expose
Object.assign(window, {
  Hero, PageHead, PillTabs, Stat, Chip, Tip, SectionDivider,
  Toggle, Slider, Donut, BarChart, Btn,
});
