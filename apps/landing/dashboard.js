// ===== LANGUAGE SYSTEM =====
let currentLang = localStorage.getItem('lang') || 'en';

function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);

  // Update buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Update all elements with data-en and data-ru
  document.querySelectorAll('[data-en][data-ru]').forEach(el => {
    el.textContent = el.dataset[lang];
  });

  // Update placeholders
  document.querySelectorAll('[data-placeholder-' + lang + ']').forEach(el => {
    el.placeholder = el.dataset['placeholder' + lang.charAt(0).toUpperCase() + lang.slice(1)];
  });

  // Re-render dynamic content that uses t()
  try {
    if (authToken && currentUser) loadAgents();
    // Re-render auth screen if visible
    const authScreen = document.getElementById('auth-screen');
    if (authScreen && !authScreen.classList.contains('hidden')) {
      const h2 = authScreen.querySelector('.auth-box h2');
      if (h2) h2.textContent = t('welcome_back');
      const desc = authScreen.querySelector('.auth-desc');
      if (desc) desc.textContent = t('sign_in_desc');
      const loginBtn = document.getElementById('tg-login-btn');
      if (loginBtn) {
        const svg = loginBtn.querySelector('svg');
        if (svg) loginBtn.innerHTML = svg.outerHTML + t('sign_in_tg');
      }
    }
    // Update page title
    document.title = lang === 'ru' ? 'TON Agent Platform \u2014 \u041F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F' : 'TON Agent Platform \u2014 Control Center';
    // Re-render flow palette with new language
    if (typeof buildFlowPalette === 'function') buildFlowPalette();
  } catch (_) {}
}

// Initialize language
switchLang(currentLang);

// ===== TRANSLATION DICTIONARY =====
const _tr = {
  // Agent status
  active: { en: 'Active', ru: 'Активен' },
  paused: { en: 'Paused', ru: 'На паузе' },
  run: { en: 'Run', ru: 'Запуск' },
  stop: { en: 'Stop', ru: 'Стоп' },
  logs: { en: 'Logs', ru: 'Логи' },
  unnamed: { en: 'Unnamed', ru: 'Без имени' },
  // Triggers
  trigger_scheduled: { en: '\u23F0 Scheduled', ru: '\u23F0 По расписанию' },
  trigger_webhook: { en: '\uD83D\uDD17 Webhook', ru: '\uD83D\uDD17 Вебхук' },
  trigger_manual: { en: '\u25B6\uFE0F Manual', ru: '\u25B6\uFE0F Ручной' },
  trigger_ai_agent: { en: '\uD83E\uDD16 AI Agent', ru: '\uD83E\uDD16 AI Агент' },
  // Empty states
  no_agents_yet: { en: 'No agents yet.', ru: 'Агентов пока нет.' },
  create_first: { en: 'Create your first agent \u2192', ru: 'Создать первого агента \u2192' },
  create_in_bot: { en: 'Create in Bot', ru: 'Создать в боте' },
  or_word: { en: 'or', ru: 'или' },
  failed_load: { en: 'Failed to load agents.', ru: 'Не удалось загрузить агентов.' },
  no_logs: { en: 'No logs yet.', ru: 'Логов пока нет.' },
  no_executions: { en: 'No executions yet.', ru: 'Выполнений пока нет.' },
  no_entries: { en: 'No entries yet. Click "Add Entry" to begin.', ru: 'Записей пока нет. Нажмите "Добавить" чтобы начать.' },
  no_variables: { en: 'No variables yet.', ru: 'Переменных пока нет.' },
  role: { en: 'Role', ru: 'Роль' },
  lv: { en: 'Lv.', ru: 'Ур.' },
  // Auth
  welcome_back: { en: 'Welcome Back', ru: 'Добро пожаловать' },
  sign_in_desc: { en: 'Sign in with Telegram to access your agents', ru: 'Войдите через Telegram для доступа к агентам' },
  sign_in_tg: { en: 'Sign in with Telegram', ru: 'Войти через Telegram' },
  sign_in_bot: { en: 'Sign in via bot', ru: 'Войти через бота' },
  auth_failed: { en: 'Auth failed', ru: 'Ошибка авторизации' },
  session_expired: { en: 'Session expired after server restart — please sign in again', ru: 'Сессия истекла после перезапуска сервера — войдите снова' },
  connecting: { en: 'Connecting to server...', ru: 'Подключаюсь к серверу...' },
  secure_auth: { en: 'Secure auth via Telegram', ru: 'Безопасная авторизация через Telegram' },
  // UI actions
  show: { en: 'Show', ru: 'Показать' },
  hide: { en: 'Hide', ru: 'Скрыть' },
  save: { en: 'Save', ru: 'Сохранить' },
  cancel: { en: 'Cancel', ru: 'Отмена' },
  delete: { en: 'Delete', ru: 'Удалить' },
  loading: { en: 'Loading...', ru: 'Загрузка...' },
  connected: { en: 'Connected', ru: 'Подключено' },
  disconnected: { en: 'Disconnected', ru: 'Не подключено' },
  // Notifications
  config_saved: { en: 'Configuration saved', ru: 'Конфигурация сохранена' },
  settings_saved: { en: 'Settings saved', ru: 'Настройки сохранены' },
  persona_saved: { en: 'Persona saved', ru: 'Персона сохранена' },
  var_saved: { en: 'Variable saved', ru: 'Переменная сохранена' },
  var_deleted: { en: 'Variable deleted', ru: 'Переменная удалена' },
  entry_added: { en: 'Entry added', ru: 'Запись добавлена' },
  entry_deleted: { en: 'Entry deleted', ru: 'Запись удалена' },
  connector_saved: { en: 'Connector saved', ru: 'Коннектор сохранён' },
  connector_deleted: { en: 'Connector removed', ru: 'Коннектор удалён' },
  login_first: { en: 'Log in first', ru: 'Сначала войдите' },
  install_failed: { en: 'Install failed', ru: 'Ошибка установки' },
  uninstall_failed: { en: 'Uninstall failed', ru: 'Ошибка удаления' },
  save_failed: { en: 'Save failed', ru: 'Ошибка сохранения' },
  test_ok: { en: 'Test succeeded!', ru: 'Тест успешен!' },
  save_connector_first: { en: 'Save the connector first', ru: 'Сначала сохраните коннектор' },
  fill_fields: { en: 'Fill title and content', ru: 'Заполните название и содержимое' },
  var_name_required: { en: 'Variable name required', ru: 'Укажите имя переменной' },
  // Wallet
  addr_copied: { en: 'Address copied', ru: 'Адрес скопирован' },
  comment_copied: { en: 'Comment copied', ru: 'Комментарий скопирован' },
  checking: { en: 'Checking...', ru: 'Проверяю...' },
  sending: { en: 'Sending...', ru: 'Отправка...' },
  withdraw: { en: 'Withdraw', ru: 'Вывести' },
  invalid_addr: { en: 'Enter a valid TON address (EQ.../UQ...)', ru: 'Введите корректный TON адрес (EQ.../UQ...)' },
  min_amount: { en: 'Minimum amount: 0.1 TON', ru: 'Минимальная сумма: 0.1 TON' },
  verify_sent: { en: 'I sent it \u2014 verify', ru: 'Я отправил \u2014 проверить' },
  // Extensions
  installed: { en: 'installed', ru: 'установлен' },
  uninstalled: { en: 'uninstalled', ru: 'удалён' },
  // Flow builder
  flow_builder: { en: 'Flow Builder', ru: 'Конструктор' },
  deploy: { en: 'Deploy', ru: 'Запуск' },
  agent_name: { en: 'Agent name...', ru: 'Имя агента...' },
  triggers: { en: 'Triggers', ru: 'Триггеры' },
  actions: { en: 'Actions', ru: 'Действия' },
  logic: { en: 'Logic', ru: 'Логика' },
  output: { en: 'Output', ru: 'Вывод' },
  state: { en: 'State', ru: 'Состояние' },
  config: { en: 'Settings', ru: 'Настройки' },
  no_node_selected: { en: 'Click a node to configure', ru: 'Кликните на ноду для настройки' },
  delete_node: { en: 'Delete Node', ru: 'Удалить ноду' },
  deploying: { en: 'Deploying...', ru: 'Запускаю...' },
  deployed_ok: { en: 'Agent deployed!', ru: 'Агент запущен!' },
  deploy_fail: { en: 'Deploy failed', ru: 'Ошибка запуска' },
};
function t(k) { const e = _tr[k]; return e ? (e[currentLang] || e.en || k) : k; }

// ===== ANIMATED COUNTER =====
// Плавно считает число от 0 до target за duration мс (WOW-эффект для метрик)
function animateCount(el, target, duration = 800, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const from = parseInt(el.textContent) || 0;
  const to = typeof target === 'number' ? target : parseInt(target) || 0;
  if (from === to) { el.textContent = to + suffix; return; }
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutQuart
    const eased = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ===== API CONFIG =====
// API server runs alongside the bot on port 3001
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : window.location.origin;  // on production same origin

// Cached platform config from /api/config
window._appConfig = null;

let authToken = localStorage.getItem('tg_token') || null;

async function apiRequest(method, path, body) {
  const opts = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  if (authToken) opts.headers['X-Auth-Token'] = authToken;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API_BASE + path, opts);
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    return { ok: false, error: e.message };
  }
}

// ===== AUTH SYSTEM =====
let currentUser = null;

// Called by new Telegram Login SDK (OIDC popup)
async function onTelegramAuth(result) {
  if (result.error) {
    console.error('Telegram Login error:', result.error);
    return;
  }
  // result has id_token (JWT) and user { id, name, preferred_username, picture }
  const data = await apiRequest('POST', '/api/auth/telegram-oidc', { id_token: result.id_token });
  if (!data.ok) {
    alert('Auth failed: ' + (data.error || 'Unknown error'));
    return;
  }
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { userId: data.userId, username: data.username, first_name: data.firstName };
  showApp();
}

// Legacy: old widget callback (keep for backwards compat)
async function onTelegramAuthLegacy(user) {
  const data = await apiRequest('POST', '/api/auth/telegram', user);
  if (!data.ok) { alert('Auth failed: ' + (data.error || 'Unknown error')); return; }
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { ...user, userId: data.userId };
  showApp();
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Update user info in sidebar
  if (currentUser) {
    const name = currentUser.first_name || currentUser.username || 'User';
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = name;

    if (currentUser.photo_url) {
      const img = document.getElementById('user-avatar');
      if (img) {
        img.src = currentUser.photo_url;
        img.classList.remove('hidden');
        const fallback = document.getElementById('user-avatar-fallback');
        if (fallback) fallback.classList.add('hidden');
      }
    }
  }

  // Load real data from API
  loadDashboard();

  // Load persisted slider/config values
  loadAgentConfig().catch(console.error);

  // Initialize static/async components
  initCapabilities();
  initExtensions();
  initActivityStream().catch(console.error);   // async — DB-backed
  initOperations().catch(console.error);        // async — DB-backed

  // Start live updates
  startLiveUpdates();
}

// Load real stats + agents + plugins
async function loadDashboard() {
  await Promise.all([loadMyStats(), loadAgents(), loadPluginsReal()]);
}

async function loadMyStats() {
  const data = await apiRequest('GET', '/api/stats/me');
  if (!data.ok) return;
  // Active agents — animated counter
  animateCount(document.getElementById('sessions-value'), data.agentsActive || 0);
  // Installed plugins
  animateCount(document.getElementById('tools-value'), data.pluginsInstalled || data.pluginsTotal || 12);
  // Total runs
  animateCount(document.getElementById('runs-value'), data.totalRuns || 0);
  // Success rate
  animateCount(document.getElementById('success-rate-value'), data.successRate != null ? data.successRate : 100, 800, '%');
  // Last 24h
  animateCount(document.getElementById('last24h-value'), data.last24hRuns || 0);
  // Init uptime counter from server
  if (data.uptimeSeconds != null) {
    window._serverUptimeBase = data.uptimeSeconds;
  }
}

async function loadAgents() {
  const agentsEl = document.getElementById('agents-list');
  if (!agentsEl) return;

  const data = await apiRequest('GET', '/api/agents');
  if (!data.ok) {
    agentsEl.innerHTML = '<div class="empty-state">\u26A0\uFE0F ' + t('failed_load') + '</div>';
    return;
  }
  const agents = data.agents || [];
  if (!agents.length) {
    agentsEl.innerHTML = `
      <div class="empty-state">
        <p>${t('no_agents_yet')}</p>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('builder')">${t('create_first')}</button>
      </div>`;
    return;
  }

  const triggerLabel = (tt) => tt === 'scheduled' ? t('trigger_scheduled') : tt === 'webhook' ? t('trigger_webhook') : tt === 'ai_agent' ? t('trigger_ai_agent') : t('trigger_manual');
  agentsEl.innerHTML = agents.map(a => {
    const role = a.role || 'worker';
    const lvl = a.level || 1;
    return `
    <div class="agent-card" data-id="${a.id}">
      <div class="agent-status ${a.isActive ? 'active' : 'paused'}">
        <span class="status-dot"></span>
        <span>${a.isActive ? t('active') : t('paused')}</span>
      </div>
      <div class="agent-info">
        <strong>#${a.id} ${escHtml(a.name || t('unnamed'))}</strong>
        <span class="agent-desc">${escHtml((a.description || '').slice(0, 80))}</span>
        <span class="agent-meta">
          <span class="agent-trigger">${triggerLabel(a.triggerType)}</span>
          <span class="agent-role-badge role-${role}">${role}</span>
          <span class="agent-level">${t('lv')}${lvl}</span>
        </span>
      </div>
      <div class="agent-actions">
        <button class="btn btn-sm ${a.isActive ? 'btn-warning' : 'btn-success'}" onclick="toggleAgent(${a.id}, ${a.isActive})">
          ${a.isActive ? '\u23F8 ' + t('stop') : '\uD83D\uDE80 ' + t('run')}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="loadAgentLogs(${a.id})">\uD83D\uDCCB ${t('logs')}</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger,#ef4444)" onclick="event.stopPropagation();deleteAgent(${a.id},'${escHtml(a.name || 'Agent').replace(/'/g, "\\'")}')">\uD83D\uDDD1</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleAgent(agentId, isActive) {
  const endpoint = isActive ? `/api/agents/${agentId}/stop` : `/api/agents/${agentId}/run`;
  const btn = document.querySelector(`[data-id="${agentId}"] .btn-success, [data-id="${agentId}"] .btn-warning`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const data = await apiRequest('POST', endpoint);
  if (!data.ok) {
    alert('Error: ' + (data.error || 'Unknown'));
  }
  // Reload agent list
  await loadAgents();
}

let _deleteAgentId = null;
let _deleteAgentName = '';

function deleteAgent(agentId, name) {
  _deleteAgentId = agentId;
  _deleteAgentName = name;
  const modal = document.getElementById('delete-agent-modal');
  const nameEl = document.getElementById('delete-agent-name');
  if (nameEl) nameEl.textContent = '#' + agentId + ' ' + name;
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-agent-modal');
  if (modal) modal.style.display = 'none';
  _deleteAgentId = null;
}

async function confirmDeleteAgent() {
  if (!_deleteAgentId) return;
  const btn = document.getElementById('delete-confirm-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳'; }
  const agentId = _deleteAgentId;
  const data = await apiRequest('DELETE', `/api/agents/${agentId}`);
  closeDeleteModal();
  if (btn) { btn.disabled = false; btn.innerHTML = '🗑 ' + t('delete'); }
  if (data.ok) {
    // Dissolve animation on the card
    const card = document.querySelector(`[data-id="${agentId}"]`);
    if (card) {
      card.classList.add('agent-card-dissolving');
      setTimeout(() => { card.remove(); }, 600);
    }
    showNotification('🗑 Agent #' + agentId + ' deleted', 'success');
    setTimeout(() => loadAgents(), 700);
  } else {
    showNotification('⚠️ ' + (data.error || 'Failed to delete'), 'error');
  }
}

let _logsAgentId = null;

async function loadAgentLogs(agentId) {
  _logsAgentId = agentId;
  const modal = document.getElementById('logs-modal');
  const body = document.getElementById('logs-modal-body');
  const title = document.getElementById('logs-modal-title');
  if (!modal || !body) return;
  title.textContent = t('logs') + ' — Agent #' + agentId;
  body.innerHTML = '<div style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">⏳ Loading...</div>';
  modal.style.display = 'flex';

  const data = await apiRequest('GET', `/api/agents/${agentId}/logs?limit=50`);
  if (!data.ok) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:#ef4444">⚠️ Failed to load logs</div>';
    return;
  }
  const logs = data.logs || [];
  if (!logs.length) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No logs yet.</div>';
    return;
  }
  body.innerHTML = logs.map(l => {
    const ts = l.timestamp || l.createdAt;
    const time = ts ? new Date(ts).toLocaleTimeString() : '--:--:--';
    const level = (l.level || 'info').toLowerCase();
    const lvlClass = ['error','warn','success'].includes(level) ? level : 'info';
    const msg = escHtml(l.message || '');
    return `<div class="log-entry ${lvlClass}">
      <span class="log-time">${time}</span>
      <span class="log-level ${lvlClass}">${level}</span>
      <span class="log-msg">${msg}</span>
    </div>`;
  }).join('');
  // Scroll to bottom (latest logs)
  body.scrollTop = body.scrollHeight;
}

function closeLogsModal() {
  const modal = document.getElementById('logs-modal');
  if (modal) modal.style.display = 'none';
  _logsAgentId = null;
}

function refreshLogs() {
  if (_logsAgentId) loadAgentLogs(_logsAgentId);
}

// Load real plugins from API (for Extensions page)
async function loadPluginsReal() {
  const data = await apiRequest('GET', '/api/plugins');
  if (!data.ok) return;
  window._realPlugins = data.plugins || [];
  // Update badge in nav
  const badge = document.querySelector('[data-page="extensions"] .nav-badge');
  if (badge) badge.textContent = window._realPlugins.length;
  // Update tab count
  const mktBadge = document.querySelector('[data-tab="marketplace"] .tab-count');
  if (mktBadge) mktBadge.textContent = window._realPlugins.length;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refreshData() {
  const icon = document.querySelector('.refresh-icon');
  if (icon) icon.style.animation = 'spin 1s linear infinite';
  await loadDashboard();
  if (icon) icon.style.animation = '';
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('tg_token');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

// ── Auth initialization ──────────────────────────────────────────────────────
// Uses new Telegram Login SDK (OIDC popup) — works on any domain
let _tgLoginReady = false;

async function initAuth() {
  // 1. Fetch platform config
  try {
    const cfg = await fetch(API_BASE + '/api/config').then(r => r.json());
    if (cfg && cfg.ok) window._appConfig = cfg;
  } catch (_) {}

  const isHttps = window.location.protocol === 'https:';
  const container = document.getElementById('tg-widget-container');
  if (!container) return;

  if (!isHttps) {
    showBotAuthButton();
    return;
  }

  // Load Telegram Login SDK
  const clientId = (window._appConfig && window._appConfig.tgClientId) || 8595707164;
  container.innerHTML = '';

  // Update auth screen text
  const welcomeEl = document.querySelector('.auth-card h2');
  if (welcomeEl) welcomeEl.textContent = t('welcome_back');
  const descEl = document.querySelector('.auth-card p');
  if (descEl) descEl.textContent = t('sign_in_desc');
  const secureEl = document.getElementById('auth-domain-note');
  if (secureEl) secureEl.textContent = t('secure_auth');
  const expiredEl = document.getElementById('auth-session-expired');
  if (expiredEl) expiredEl.textContent = t('session_expired');

  // Show login button
  const tgSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
  container.innerHTML = '<button id="tg-login-btn" style="display:flex;align-items:center;gap:10px;padding:12px 24px;background:linear-gradient(135deg,#2AABEE,#229ED9);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:500;cursor:pointer;width:100%;justify-content:center;transition:all .2s;box-shadow:0 2px 12px rgba(42,171,238,.3)" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
    tgSvg + t('sign_in_tg') + '</button>';

  // Button click → OIDC code flow redirect (popup mode broken on Telegram side)
  const redirectUri = window.location.origin + '/dashboard.html';
  document.getElementById('tg-login-btn').addEventListener('click', () => {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('tg_oauth_state', state);
    const params = new URLSearchParams({
      client_id: String(clientId),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state: state,
    });
    window.location.href = 'https://oauth.telegram.org/auth?' + params.toString();
  });

  // Also show bot-auth fallback below
  const fb = document.createElement('div');
  fb.style.cssText = 'margin-top:14px;text-align:center;';
  fb.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:.72rem;margin-bottom:6px;">' + t('or_word') + '</div>' +
    '<button onclick="showBotAuthButton()" style="padding:7px 16px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.08);border-radius:8px;font-size:.78rem;cursor:pointer;transition:all .2s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,.05)\'\">' + t('sign_in_bot') + '</button>';
  container.appendChild(fb);
}

// Handle OAuth redirect: ?code=XXX&state=YYY
async function handleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return false;

  // Verify state
  const savedState = sessionStorage.getItem('tg_oauth_state');
  if (state && savedState && state !== savedState) {
    console.error('OAuth state mismatch');
    return false;
  }
  sessionStorage.removeItem('tg_oauth_state');

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  // Exchange code for session via our backend
  const data = await apiRequest('POST', '/api/auth/telegram-code', { code, redirect_uri: window.location.origin + '/dashboard.html' });
  if (!data.ok) {
    console.error('Code exchange failed:', data.error);
    return false;
  }
  authToken = data.token;
  localStorage.setItem('tg_token', authToken);
  currentUser = { userId: data.userId, username: data.username, first_name: data.firstName };
  showApp();
  return true;
}

// Check if already logged in (token in localStorage)
async function checkExistingSession() {
  // First check if this is an OAuth redirect
  if (await handleOAuthRedirect()) return;

  if (!authToken) {
    await initAuth();
    return;
  }
  const data = await apiRequest('GET', '/api/me');
  if (data.ok) {
    currentUser = { userId: data.userId, username: data.username, first_name: data.firstName };
    showApp();
  } else {
    // Token expired (bot restarted / session wiped)
    authToken = null;
    localStorage.removeItem('tg_token');
    // Show friendly "session expired" hint in auth screen
    const hint = document.getElementById('auth-session-expired');
    if (hint) hint.style.display = 'block';
    await initAuth();
  }
}

// ===== BOT-AUTH (polling via deeplink — works on localhost without domain config) =====
let _botAuthToken = null;
let _botAuthPolling = null;

function showBotAuthButton() {
  const container = document.getElementById('tg-widget-container');
  if (container) {
    container.innerHTML = `
      <button
        onclick="startBotAuth()"
        style="display:flex;align-items:center;gap:10px;padding:12px 24px;background:#2196F3;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:500;cursor:pointer;width:100%;justify-content:center;transition:opacity .2s"
        onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        ${t('sign_in_tg')}
      </button>
    `;
  }
  // Hide the "Widget requires HTTPS" note — it's confusing for end users
  const note = document.getElementById('auth-domain-note');
  if (note) note.style.display = 'none';
}

async function startBotAuth() {
  const container = document.getElementById('tg-widget-container');
  if (container) {
    container.innerHTML = `<div style="text-align:center;padding:16px 0;color:var(--text-secondary);font-size:.875rem;">\u23F3 ${t('connecting')}</div>`;
  }

  const data = await apiRequest('GET', '/api/auth/request');
  if (!data.ok) {
    if (container) container.innerHTML = `
      <div style="text-align:center;padding:12px 0">
        <p style="color:#f59e0b;font-size:.9rem;margin:0 0 8px;font-weight:500;">⚠️ Не удалось подключиться</p>
        <p style="color:var(--text-muted);font-size:.75rem;margin:0 0 14px;">Убедитесь, что бот-сервер запущен</p>
        <button onclick="showBotAuthButton()"
          style="padding:8px 20px;background:#2196F3;color:#fff;border:none;border-radius:6px;font-size:.875rem;font-weight:500;cursor:pointer;">
          🔄 Повторить
        </button>
      </div>`;
    return;
  }

  _botAuthToken = data.authToken;
  // Do NOT use window.open() — it gets blocked by popup blockers after async calls.
  // Instead show a prominent <a> link the user clicks directly (real user gesture).
  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:1.75rem;margin-bottom:10px;">📲</div>
        <p style="color:var(--text-secondary);font-size:.9rem;margin-bottom:4px;font-weight:500;">Откройте Telegram и нажмите Start</p>
        <p style="color:var(--text-muted);font-size:.75rem;margin-bottom:16px;">После нажатия /start страница обновится автоматически</p>
        <a href="${escHtml(data.botLink)}" target="_blank"
           style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 28px;background:#2196F3;color:#fff;border-radius:8px;font-size:.9375rem;font-weight:600;text-decoration:none;margin-bottom:16px;min-width:200px;">
          🤖 Открыть Telegram
        </a><br>
        <button onclick="cancelBotAuth()"
          style="background:none;border:none;color:var(--text-muted);font-size:.8125rem;cursor:pointer;text-decoration:underline;">
          Отмена
        </button>
      </div>
    `;
  }

  _botAuthPolling = setInterval(async () => {
    const check = await apiRequest('GET', `/api/auth/check/${_botAuthToken}`);
    if (check.status === 'approved') {
      clearInterval(_botAuthPolling);
      _botAuthPolling = null;
      authToken = check.token;
      localStorage.setItem('tg_token', authToken);
      currentUser = {
        userId: check.userId,
        first_name: check.firstName || '',
        username: check.username || '',
      };
      showApp();
    } else if (!check.ok || check.status === 'not_found') {
      // Token expired or server error — reset
      clearInterval(_botAuthPolling);
      _botAuthPolling = null;
      showBotAuthButton();
    }
    // status === 'pending' — продолжаем ждать
  }, 2000);
}

function cancelBotAuth() {
  if (_botAuthPolling) { clearInterval(_botAuthPolling); _botAuthPolling = null; }
  _botAuthToken = null;
  showBotAuthButton();
}

// Auto-check session on load (also inits widget if no session)
checkExistingSession();

// ===== NAVIGATION =====
// Map page names to their lazy-load functions
const pageLoadFns = {
  overview:    () => loadOverview(),
  analytics:   () => loadAnalytics(),
  persona:     () => loadPersona(),
  knowledge:   () => loadKnowledge(),
  capabilities:() => initCapabilities(),
  connectors:  () => loadConnectors(),
  extensions:  () => loadExtensions(),
  activity:    () => initActivityStream(),
  operations:  () => loadOperations(),
  profile:     () => loadProfile(),
  wallet:      () => loadWallet(),
  settings:    () => loadSettings(),
  network:     () => loadNetworkMap(),
  builder:     () => initFlowBuilder(),
};

// Stub functions for pages that don't have dedicated load logic yet
function loadOverview() { loadMyStats(); loadAgents(); }
function loadOperations() { loadAgents(); }
async function loadSettings() {
  try {
    const data = await apiRequest('GET', '/api/settings');
    if (data.ok && data.settings) {
      // Populate existing settings fields if they exist
      const cfg = data.settings.agent_config || {};
      const fields = { 'ai-persona': cfg.persona, 'ai-model': cfg.model, 'response-delay': cfg.responseDelay };
      for (const [id, val] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && val !== undefined) {
          if (el.tagName === 'INPUT' && el.type === 'range') { el.value = val; updateSliderDisplay(el); }
          else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.value = val;
        }
      }
    }
  } catch {}
  // Load AI API key
  loadAIKey().catch(() => {});
  console.log('[Dashboard] Settings page loaded');
}
function loadExtensions() { loadPluginsReal(); }

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    // Show corresponding page
    const pageName = item.dataset.page;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const pageEl = document.getElementById(`${pageName}-page`);
    if (pageEl) pageEl.classList.add('active');

    // Lazy-load page data if authenticated
    if (authToken && pageLoadFns[pageName]) {
      pageLoadFns[pageName]().catch(console.error);
    }
  });
});

// ===== CAPABILITIES DATA =====
const capabilitiesData = [
  { 
    id: 'deals', 
    name: 'Deals & Escrow', 
    nameRu: 'Сделки и эскроу',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Create, manage and execute secure deals on TON blockchain',
    descriptionRu: 'Создавайте, управляйте и выполняйте безопасные сделки на блокчейне TON',
    tools: ['create_deal', 'get_deal_status', 'cancel_deal', 'list_deals', 'update_deal']
  },
  { 
    id: 'dedust', 
    name: 'DeDust DEX', 
    nameRu: 'DeDust DEX',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Swap tokens and manage liquidity on DeDust decentralized exchange',
    descriptionRu: 'Обменивайте токены и управляйте ликвидностью на децентрализованной бирже DeDust',
    tools: ['swap_tokens', 'get_pool_info', 'add_liquidity', 'remove_liquidity', 'get_price']
  },
  { 
    id: 'aggregator', 
    name: 'DEX Aggregator', 
    nameRu: 'DEX Агрегатор',
    count: 3, 
    mode: 'All', 
    enabled: true,
    description: 'Get best rates across all TON DEXes with smart routing',
    descriptionRu: 'Получайте лучшие курсы на всех DEX TON со смарт-роутингом',
    tools: ['get_best_rate', 'aggregate_swap', 'compare_prices']
  },
  { 
    id: 'dns', 
    name: 'TON DNS', 
    nameRu: 'TON DNS',
    count: 7, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Resolve domains, register new names, manage DNS records',
    descriptionRu: 'Резолвите домены, регистрируйте новые имена, управляйте DNS записями',
    tools: ['resolve_dns', 'get_domain_info', 'check_availability', 'register_domain', 'renew_domain', 'transfer_domain', 'set_records']
  },
  { 
    id: 'jettons', 
    name: 'Jetton Tokens', 
    nameRu: 'Jetton токены',
    count: 6, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Transfer, mint, burn and manage fungible tokens on TON',
    descriptionRu: 'Переводите, минтите, сжигайте и управляйте фунгибельными токенами на TON',
    tools: ['get_jetton_info', 'transfer_jetton', 'get_balance', 'mint_jetton', 'burn_jetton', 'get_holders']
  },
  { 
    id: 'journal', 
    name: 'Activity Journal', 
    nameRu: 'Журнал активности',
    count: 3, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Log and track agent activities with searchable history',
    descriptionRu: 'Логируйте и отслеживайте активность агента с возможностью поиска',
    tools: ['write_entry', 'read_entries', 'search_entries']
  },
  { 
    id: 'memory', 
    name: 'Context Memory', 
    nameRu: 'Контекстная память',
    count: 4, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Store and recall conversation context and user preferences',
    descriptionRu: 'Храните и вспоминайте контекст разговоров и предпочтения пользователей',
    tools: ['store_memory', 'recall_memory', 'update_context', 'clear_context']
  },
  { 
    id: 'nft', 
    name: 'NFT Collections', 
    nameRu: 'NFT коллекции',
    count: 4, 
    mode: 'All', 
    enabled: true,
    description: 'Query NFT data, verify ownership, track collections',
    descriptionRu: 'Запрашивайте данные NFT, проверяйте владение, отслеживайте коллекции',
    tools: ['get_nft_info', 'verify_ownership', 'get_collection', 'transfer_nft']
  },
  { 
    id: 'stonfi', 
    name: 'STON.fi Farming', 
    nameRu: 'STON.fi Фарминг',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Trade and farm on STON.fi DEX with yield optimization',
    descriptionRu: 'Торгуйте и фармите на STON.fi DEX с оптимизацией доходности',
    tools: ['swap_on_stonfi', 'get_farms', 'stake_tokens', 'unstake_tokens', 'claim_rewards']
  },
  { 
    id: 'telegram', 
    name: 'Telegram Messenger', 
    nameRu: 'Telegram мессенджер',
    count: 63, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Send messages, media, documents and interact with Telegram API',
    descriptionRu: 'Отправляйте сообщения, медиа, документы и взаимодействуйте с API Telegram',
    tools: ['send_message', 'send_photo', 'send_document', 'get_chat_info', 'pin_message', 'forward_message']
  },
  { 
    id: 'tonconnect', 
    name: 'TON Connect', 
    nameRu: 'TON Connect',
    count: 4, 
    mode: 'All', 
    enabled: true,
    description: 'Connect wallets and sign transactions securely',
    descriptionRu: 'Подключайте кошельки и подписывайте транзакции безопасно',
    tools: ['connect_wallet', 'disconnect_wallet', 'sign_transaction', 'get_connected_wallets']
  },
  { 
    id: 'wallet', 
    name: 'Wallet Manager', 
    nameRu: 'Менеджер кошельков',
    count: 5, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Manage multiple wallets, check balances, track transactions',
    descriptionRu: 'Управляйте несколькими кошельками, проверяйте балансы, отслеживайте транзакции',
    tools: ['get_balance', 'get_transactions', 'create_wallet', 'import_wallet', 'export_wallet']
  },
  { 
    id: 'web', 
    name: 'Web Scraping', 
    nameRu: 'Веб-скрапинг',
    count: 3, 
    mode: 'None', 
    enabled: false,
    description: 'Fetch and parse web content for data extraction',
    descriptionRu: 'Получайте и парсите веб-контент для извлечения данных',
    tools: ['fetch_page', 'parse_html', 'extract_data']
  },
  { 
    id: 'workspace', 
    name: 'File Workspace', 
    nameRu: 'Файловое хранилище',
    count: 6, 
    mode: 'All', 
    enabled: true,
    description: 'Store, organize and manage files for agent operations',
    descriptionRu: 'Храните, организуйте и управляйте файлами для операций агента',
    tools: ['upload_file', 'download_file', 'list_files', 'create_folder', 'delete_file', 'move_file']
  },
  { 
    id: 'analytics', 
    name: 'Analytics Engine', 
    nameRu: 'Аналитический движок',
    count: 8, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Process data, generate reports and visualize metrics',
    descriptionRu: 'Обрабатывайте данные, генерируйте отчёты и визуализируйте метрики',
    tools: ['process_data', 'generate_report', 'create_chart', 'export_csv', 'calculate_metrics', 'detect_anomalies']
  },
  { 
    id: 'notifications', 
    name: 'Notification Hub', 
    nameRu: 'Центр уведомлений',
    count: 4, 
    mode: 'Mixed', 
    enabled: true,
    description: 'Send alerts and notifications across multiple channels',
    descriptionRu: 'Отправляйте оповещения и уведомления через несколько каналов',
    tools: ['send_alert', 'schedule_notification', 'manage_subscriptions', 'get_delivery_status']
  },
];

let currentCapabilityFilter = 'all';
let capabilitySearchQuery = '';

async function initCapabilities() {
  // Load saved capabilities settings
  try {
    const saved = await apiRequest('GET', '/api/settings?key=default_capabilities');
    if (saved && saved.value) {
      const settings = typeof saved.value === 'string' ? JSON.parse(saved.value) : saved.value;
      if (settings && typeof settings === 'object') {
        for (const cap of capabilitiesData) {
          if (settings[cap.id] !== undefined) {
            cap.enabled = settings[cap.id].enabled !== false;
            if (settings[cap.id].mode) cap.mode = settings[cap.id].mode;
          }
        }
      }
    }
  } catch {}
  renderCapabilities();
}

function renderCapabilities() {
  const container = document.getElementById('capabilities-list');
  if (!container) return;
  
  let filtered = capabilitiesData;
  
  // Apply filter
  if (currentCapabilityFilter === 'active') {
    filtered = filtered.filter(c => c.enabled);
  } else if (currentCapabilityFilter === 'inactive') {
    filtered = filtered.filter(c => !c.enabled);
  }
  
  // Apply search
  if (capabilitySearchQuery) {
    const query = capabilitySearchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.nameRu.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.descriptionRu.toLowerCase().includes(query)
    );
  }
  
  container.innerHTML = filtered.map(cap => `
    <div class="capability-item" data-id="${cap.id}">
      <div class="capability-header" onclick="toggleCapability('${cap.id}')">
        <div class="capability-info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capability-chevron">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="capability-name">${currentLang === 'ru' ? cap.nameRu : cap.name}</span>
          <span class="capability-count">${cap.count} tools</span>
        </div>
        <div class="capability-actions">
          <select class="capability-mode" onchange="changeCapabilityMode('${cap.id}', this.value)" onclick="event.stopPropagation()">
            <option value="Mixed" ${cap.mode === 'Mixed' ? 'selected' : ''}>Mixed</option>
            <option value="All" ${cap.mode === 'All' ? 'selected' : ''}>All</option>
            <option value="None" ${cap.mode === 'None' ? 'selected' : ''}>None</option>
          </select>
          <label class="toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" ${cap.enabled ? 'checked' : ''} onchange="toggleCapabilityEnabled('${cap.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="capability-details" id="cap-details-${cap.id}" style="display:none;padding:0 20px 20px;">
        <p style="color:var(--text-secondary);margin-bottom:12px;font-size:0.875rem;">${currentLang === 'ru' ? cap.descriptionRu : cap.description}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${cap.tools.map(t => `<span style="padding:4px 10px;background:rgba(255,255,255,0.05);border-radius:4px;font-size:0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCapability(id) {
  const details = document.getElementById(`cap-details-${id}`);
  const item = document.querySelector(`.capability-item[data-id="${id}"]`);
  if (details && item) {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    item.classList.toggle('expanded', !isVisible);
  }
}

function changeCapabilityMode(id, mode) {
  const cap = capabilitiesData.find(c => c.id === id);
  if (cap) {
    cap.mode = mode;
    saveCapabilitiesSettings();
  }
}

function toggleCapabilityEnabled(id, enabled) {
  const cap = capabilitiesData.find(c => c.id === id);
  if (cap) {
    cap.enabled = enabled;
    renderCapabilities();
    saveCapabilitiesSettings();
  }
}

function saveCapabilitiesSettings() {
  const settings = {};
  for (const cap of capabilitiesData) {
    settings[cap.id] = { enabled: cap.enabled, mode: cap.mode };
  }
  apiRequest('POST', '/api/settings', { key: 'default_capabilities', value: settings }).catch(() => {});
}

function filterCapabilities(filter) {
  currentCapabilityFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  renderCapabilities();
}

function searchCapabilities(query) {
  capabilitySearchQuery = query;
  renderCapabilities();
}

// ===== EXTENSIONS DATA (Real plugins) =====
const extensionsData = [
  {
    id: 'giftstat',
    name: 'GiftStat Analytics',
    nameRu: 'GiftStat Аналитика',
    description: 'Real-time analytics for Telegram Gifts marketplace. Track floor prices, collection stats, trading volume, and historical trends across all gift categories.',
    descriptionRu: 'Аналитика в реальном времени для маркетплейса Telegram Gifts. Отслеживайте цены, статистику коллекций, объём торгов и исторические тренды.',
    tags: ['market-data', 'telegram', 'analytics', 'gifts'],
    author: 'TON Agent Team',
    version: '2.1.0',
    tools: 12,
    installed: true,
    hasUpdate: false,
  },
  {
    id: 'gas111',
    name: 'Gas111 Launcher',
    nameRu: 'Gas111 Launcher',
    description: 'Launch and manage meme tokens on Gas111 protocol. Create token sales, configure vesting schedules, and track performance metrics.',
    descriptionRu: 'Запускайте и управляйте меме-токенами на протоколе Gas111. Создавайте токенсейлы, настраивайте вестинг и отслеживайте метрики.',
    tags: ['token-launch', 'ton', 'defi', 'meme'],
    author: 'Gas111 Labs',
    version: '4.2.1',
    tools: 15,
    installed: true,
    hasUpdate: true,
    updateVersion: '4.3.0',
  },
  {
    id: 'stormtrade',
    name: 'Storm Trade Pro',
    nameRu: 'Storm Trade Pro',
    description: 'Advanced perpetual futures trading on TON. Access leverage up to 50x, portfolio margin, and automated risk management.',
    descriptionRu: 'Продвинутая торговля фьючерсами на TON. Доступ к плечу до 50x, портфельной марже и автоматическому управлению рисками.',
    tags: ['trading', 'futures', 'derivatives', 'storm'],
    author: 'Storm Team',
    version: '1.5.0',
    tools: 18,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'swapcoffee',
    name: 'Swap.Coffee Aggregator',
    nameRu: 'Swap.Coffee Агрегатор',
    description: 'DEX aggregator finding best swap routes across all TON exchanges. Save up to 15% on slippage with smart routing.',
    descriptionRu: 'DEX агрегатор, находящий лучшие маршруты обмена на всех биржах TON. Экономьте до 15% на проскальзывании со смарт-роутингом.',
    tags: ['dex', 'aggregator', 'swap', 'defi'],
    author: 'Swap.Coffee',
    version: '1.8.2',
    tools: 8,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'dedustpro',
    name: 'DeDust Pro Tools',
    nameRu: 'DeDust Pro Tools',
    description: 'Enhanced liquidity management for DeDust DEX. Advanced pool analytics, impermanent loss calculator, and yield optimizer.',
    descriptionRu: 'Расширенное управление ликвидностью для DeDust DEX. Продвинутая аналитика пулов, калькулятор непостоянных потерь и оптимизатор доходности.',
    tags: ['dedust', 'liquidity', 'yield', 'analytics'],
    author: 'DeDust Finance',
    version: '2.0.0',
    tools: 10,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'tontools',
    name: 'TON Developer Kit',
    nameRu: 'TON Developer Kit',
    description: 'Essential tools for TON developers. Contract deployment, transaction debugging, and network analytics in one package.',
    descriptionRu: 'Необходимые инструменты для разработчиков TON. Деплой контрактов, отладка транзакций и аналитика сети в одном пакете.',
    tags: ['developer', 'tools', 'debugging', 'deployment'],
    author: 'TON Foundation',
    version: '3.1.0',
    tools: 22,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'nftmaster',
    name: 'NFT Master Suite',
    nameRu: 'NFT Master Suite',
    description: 'Complete NFT management solution. Mint, transfer, analyze collections, and track royalty payments on TON.',
    descriptionRu: 'Полное решение для управления NFT. Минтите, передавайте, анализируйте коллекции и отслеживайте роялти на TON.',
    tags: ['nft', 'collections', 'minting', 'royalties'],
    author: 'NFT Masters',
    version: '1.9.0',
    tools: 14,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'walletguard',
    name: 'Wallet Guard',
    nameRu: 'Wallet Guard',
    description: 'Security monitoring for TON wallets. Detect suspicious transactions, set spending limits, and receive instant alerts.',
    descriptionRu: 'Мониторинг безопасности для кошельков TON. Обнаруживайте подозрительные транзакции, устанавливайте лимиты и получайте мгновенные оповещения.',
    tags: ['security', 'monitoring', 'alerts', 'wallet'],
    author: 'Security First',
    version: '1.2.0',
    tools: 9,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'chartpro',
    name: 'ChartPro Analytics',
    nameRu: 'ChartPro Аналитика',
    description: 'Professional charting and technical analysis for TON tokens. 50+ indicators, pattern recognition, and price alerts.',
    descriptionRu: 'Профессиональные графики и технический анализ для токенов TON. 50+ индикаторов, распознавание паттернов и ценовые алерты.',
    tags: ['charts', 'analytics', 'trading', 'indicators'],
    author: 'ChartPro',
    version: '2.3.0',
    tools: 11,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'socialbot',
    name: 'Social Bot Engine',
    nameRu: 'Social Bot Engine',
    description: 'Automated social media management for crypto projects. Schedule posts, track engagement, and manage communities.',
    descriptionRu: 'Автоматизированное управление соцсетями для крипто-проектов. Планируйте посты, отслеживайте вовлечённость и управляйте комьюнити.',
    tags: ['social', 'automation', 'marketing', 'community'],
    author: 'Social Labs',
    version: '1.0.5',
    tools: 16,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'airdropper',
    name: 'Airdrop Manager',
    nameRu: 'Airdrop Manager',
    description: 'Distribute tokens to thousands of addresses efficiently. Whitelist management, vesting schedules, and claim tracking.',
    descriptionRu: 'Распределяйте токены тысячам адресов эффективно. Управление вайтлистом, вестинг и отслеживание клеймов.',
    tags: ['airdrop', 'distribution', 'tokens', 'marketing'],
    author: 'DropMaster',
    version: '1.4.0',
    tools: 8,
    installed: false,
    hasUpdate: false,
  },
  {
    id: 'multisig',
    name: 'Multi-Sig Vault',
    nameRu: 'Multi-Sig Vault',
    description: 'Secure multi-signature wallet management. Configure signers, set thresholds, and execute transactions with team approval.',
    descriptionRu: 'Безопасное управление мультиподписными кошельками. Настраивайте подписантов, устанавливайте пороги и выполняйте транзакции с одобрением команды.',
    tags: ['security', 'multisig', 'wallet', 'team'],
    author: 'Vault Security',
    version: '2.0.0',
    tools: 12,
    installed: false,
    hasUpdate: false,
  },
];

let currentExtensionsTab = 'installed';
let extensionsSearchQuery = '';

function initExtensions() {
  renderExtensions();
}

function renderExtensions() {
  const container = document.getElementById('extensions-content');
  if (!container) return;

  // Merge real plugins into extensionsData if available
  const realPlugins = window._realPlugins || [];
  let baseData = extensionsData;
  if (realPlugins.length) {
    // Map real API plugins to the extension card format
    baseData = realPlugins.map(p => ({
      id: p.id,
      name: p.name,
      nameRu: p.name,
      description: p.description,
      descriptionRu: p.description,
      tags: p.tags || [],
      author: 'TON Agent Platform',
      version: '1.0.0',
      tools: p.tags ? p.tags.length : 1,
      installed: p.isInstalled,
      hasUpdate: false,
      updateVersion: '1.0.0',
    }));
  }

  // Update counts
  const installed = baseData.filter(e => e.installed);
  const updates = baseData.filter(e => e.installed && e.hasUpdate);
  const instCount = document.getElementById('installed-count');
  if (instCount) instCount.textContent = installed.length;

  let filtered = baseData;

  // Apply tab filter
  if (currentExtensionsTab === 'installed') {
    filtered = baseData.filter(e => e.installed);
  } else if (currentExtensionsTab === 'updates') {
    filtered = baseData.filter(e => e.installed && e.hasUpdate);
  }

  // Apply search
  if (extensionsSearchQuery) {
    const query = extensionsSearchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.nameRu.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query) ||
      e.descriptionRu.toLowerCase().includes(query) ||
      e.tags.some(t => t.toLowerCase().includes(query))
    );
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2l9 4.9V17L12 22l-9-4.9V7z"/>
          </svg>
        </div>
        <h3>${currentLang === 'ru' ? 'Ничего не найдено' : 'Nothing found'}</h3>
        <p>${currentLang === 'ru' ? 'Попробуйте изменить параметры поиска' : 'Try adjusting your search criteria'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filtered.map(ext => `
    <div class="extension-card ${ext.installed ? 'installed' : ''}">
      <div class="extension-main">
        <div>
          <div class="extension-header">
            <div class="extension-title-row">
              <span class="extension-name">${currentLang === 'ru' ? ext.nameRu : ext.name}</span>
              ${ext.installed ? `<span class="badge badge-success">${currentLang === 'ru' ? 'Установлено' : 'Installed'}</span>` : ''}
              ${ext.hasUpdate ? `<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">${currentLang === 'ru' ? 'Обновление' : 'Update'} v${ext.updateVersion}</span>` : ''}
            </div>
          </div>
          <p class="extension-desc">${currentLang === 'ru' ? ext.descriptionRu : ext.description}</p>
          <div class="extension-tags">
            ${ext.tags.map(tag => `<span class="extension-tag">${tag}</span>`).join('')}
          </div>
          <div class="extension-footer">
            <span class="extension-meta">by ${ext.author} · v${ext.version} · ${ext.tools} tools</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${ext.installed ? `
            ${ext.hasUpdate ? `
              <button class="btn btn-primary btn-sm" onclick="updateExtension('${ext.id}')">
                ${currentLang === 'ru' ? 'Обновить' : 'Update'}
              </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="uninstallExtension('${ext.id}')">
              ${currentLang === 'ru' ? 'Удалить' : 'Uninstall'}
            </button>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="installExtension('${ext.id}')">
              ${currentLang === 'ru' ? 'Установить' : 'Install'}
            </button>
          `}
        </div>
      </div>
    </div>
  `).join('');
}

function switchExtensionsTab(tab) {
  currentExtensionsTab = tab;
  document.querySelectorAll('.extensions-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderExtensions();
}

async function installExtension(id) {
  const ext = (window._realPlugins || extensionsData).find(e => e.id === id) || extensionsData.find(e => e.id === id);
  if (!ext) return;

  if (authToken) {
    const data = await apiRequest('POST', `/api/plugins/${id}/install`, { config: {} });
    if (!data.ok) {
      showNotification(data.error || t('install_failed'), 'error');
      return;
    }
  }
  // Update local data (both arrays to stay in sync)
  [extensionsData, window._realPlugins || []].forEach(arr => {
    const item = arr.find(e => e.id === id);
    if (item) item.installed = true;
  });
  renderExtensions();
  showNotification(currentLang === 'ru' ? `${ext.nameRu || ext.name} установлен` : `${ext.name} installed`, 'success');
}

async function uninstallExtension(id) {
  const ext = (window._realPlugins || extensionsData).find(e => e.id === id) || extensionsData.find(e => e.id === id);
  if (!ext) return;

  if (authToken) {
    const data = await apiRequest('DELETE', `/api/plugins/${id}`);
    if (!data.ok) {
      showNotification(data.error || t('uninstall_failed'), 'error');
      return;
    }
  }
  [extensionsData, window._realPlugins || []].forEach(arr => {
    const item = arr.find(e => e.id === id);
    if (item) { item.installed = false; item.hasUpdate = false; }
  });
  renderExtensions();
  showNotification(currentLang === 'ru' ? `${ext.nameRu || ext.name} удалён` : `${ext.name} uninstalled`, 'info');
}

function updateExtension(id) {
  const ext = extensionsData.find(e => e.id === id);
  if (ext) {
    ext.version = ext.updateVersion;
    ext.hasUpdate = false;
    renderExtensions();
    showNotification(currentLang === 'ru' ? `${ext.nameRu} обновлён до v${ext.version}` : `${ext.name} updated to v${ext.version}`, 'success');
  }
}

function searchExtensions(query) {
  extensionsSearchQuery = query;
  renderExtensions();
}

// ===== ACTIVITY STREAM =====
// DB-backed: populated from /api/activity, live updates appended in memory
const activityLog = [];

async function initActivityStream() {
  // Load recent activity from DB
  const data = await apiRequest('GET', '/api/activity?limit=30');
  if (data.ok && data.activity && data.activity.length) {
    activityLog.length = 0;
    data.activity.reverse().forEach(entry => {
      const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
      activityLog.push({
        time: `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}`,
        message: `[Agent #${entry.agentId}] ${entry.message}`,
        messageRu: `[Агент #${entry.agentId}] ${entry.message}`,
        type: entry.level === 'error' ? 'error' : entry.level === 'success' ? 'success' : 'info',
      });
    });
  } else if (!activityLog.length) {
    // Fallback starter entries if no DB data yet
    activityLog.push(
      { time: '--:--:--', message: 'Platform started — no activity yet', messageRu: 'Платформа запущена — активность отсутствует', type: 'info' }
    );
  }
  renderActivityStream();
}

function renderActivityStream() {
  const container = document.getElementById('activity-stream');
  if (!container) return;

  container.innerHTML = activityLog.map(log => `
    <div class="activity-item ${log.type}">
      <span class="activity-type">${log.type.toUpperCase()}</span>
      <span class="activity-time">${log.time}</span>
      <span class="activity-message">${currentLang === 'ru' ? log.messageRu : log.message}</span>
    </div>
  `).join('') || '<div class="activity-item info"><span class="activity-message" style="color:var(--text-muted)">No activity yet.</span></div>';

  container.scrollTop = container.scrollHeight;
}

function clearActivity() {
  activityLog.length = 0;
  renderActivityStream();
}

function addActivity(message, messageRu, type = 'info') {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  activityLog.push({ time, message, messageRu, type });

  if (activityLog.length > 100) {
    activityLog.shift();
  }

  renderActivityStream();
}

// ===== AGENT CONFIG SLIDERS =====
function updateSliderDisplay(el) {
  const span = el.parentElement.querySelector('.slider-value');
  if (!span) return;
  const val = parseFloat(el.value);
  span.textContent = (parseInt(el.max) > 100) ? val + 'ms' : val;
}

async function saveAgentConfig() {
  if (!authToken) {
    showNotification(t('login_first'), 'error');
    return;
  }
  const creativityEl  = document.getElementById('slider-creativity');
  const delayEl       = document.getElementById('slider-response-delay');
  const config = {
    creativity:    creativityEl  ? parseFloat(creativityEl.value)  : 0.7,
    responseDelay: delayEl       ? parseInt(delayEl.value)          : 1500,
  };
  const data = await apiRequest('POST', '/api/settings', { settings: { agent_config: config } });
  if (data.ok) {
    showNotification(t('config_saved'), 'success');
  } else {
    showNotification(data.error || t('save_failed'), 'error');
  }
}

async function loadAgentConfig() {
  const data = await apiRequest('GET', '/api/settings');
  if (!data.ok) return;
  const config = (data.settings && data.settings.agent_config) || {};

  const creativityEl = document.getElementById('slider-creativity');
  if (creativityEl && config.creativity != null) {
    creativityEl.value = config.creativity;
    updateSliderDisplay(creativityEl);
  }
  const delayEl = document.getElementById('slider-response-delay');
  if (delayEl && config.responseDelay != null) {
    delayEl.value = config.responseDelay;
    updateSliderDisplay(delayEl);
  }
}

// ===== OPERATIONS =====
// DB-backed: populated from /api/executions (execution_history table)
let operationsData = [];
let currentOperationFilter = 'all';

async function initOperations() {
  await loadOperations();
}

async function loadOperations() {
  const statusParam = currentOperationFilter !== 'all' ? `?status=${currentOperationFilter}` : '';
  const data = await apiRequest('GET', '/api/executions' + statusParam + (statusParam ? '&limit=20' : '?limit=20'));

  if (data.ok && data.executions) {
    operationsData = data.executions.map(ex => {
      const startedAt = ex.startedAt ? new Date(ex.startedAt) : new Date();
      const ageMs = Date.now() - startedAt.getTime();
      const ageStr = ageMs < 60000
        ? 'Just now'
        : ageMs < 3600000
          ? Math.floor(ageMs / 60000) + ' min ago'
          : Math.floor(ageMs / 3600000) + 'h ago';
      // Treat "running" entries older than 30 min as stale (crashed without cleanup)
      const STALE_MS = 30 * 60 * 1000;
      const isStaleRunning = ex.status === 'running' && ageMs > STALE_MS;
      return {
        id: ex.id,
        name: `Agent #${ex.agentId} run`,
        nameRu: `Запуск агента #${ex.agentId}`,
        description: `Trigger: ${ex.triggerType || 'manual'}`,
        descriptionRu: `Триггер: ${ex.triggerType || 'manual'}`,
        status: isStaleRunning      ? 'failed'
          : ex.status === 'running' ? 'running'
          : ex.status === 'success'  ? 'completed'
          : ex.status === 'error'    ? 'failed'
          : 'queued',
        createdAt: ageStr,
        createdAtRu: ageStr,
        duration: ex.durationMs ? (ex.durationMs / 1000).toFixed(1) + 's' : null,
        error: ex.errorMessage || null,
        errorRu: ex.errorMessage || null,
        progress: ex.status === 'running' ? 50 : null,
      };
    });
  }

  renderOperations();
}

function renderOperations() {
  const container = document.getElementById('operations-list');
  if (!container) return;

  let filtered = operationsData;

  if (currentOperationFilter !== 'all') {
    // Map UI filter name to DB status
    const statusMap = { completed: 'completed', running: 'running', failed: 'failed', queued: 'queued' };
    filtered = operationsData.filter(o => o.status === (statusMap[currentOperationFilter] || currentOperationFilter));
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px;text-align:center;color:var(--text-muted)">
        ${currentLang === 'ru' ? 'Нет выполнений. Запустите агента чтобы увидеть историю.' : 'No executions yet. Run an agent to see history here.'}
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(op => `
    <div class="operation-item">
      <div class="operation-header">
        <div class="operation-info">
          <span class="operation-id">#${op.id}</span>
          <span class="operation-name">${currentLang === 'ru' ? op.nameRu : op.name}</span>
        </div>
        <span class="operation-status ${op.status}">${op.status}</span>
      </div>
      <p class="operation-desc">${currentLang === 'ru' ? op.descriptionRu : op.description}</p>
      <div class="operation-meta">
        <span>${currentLang === 'ru' ? 'Создано: ' : 'Created: '}${currentLang === 'ru' ? op.createdAtRu : op.createdAt}</span>
        ${op.duration ? `<span>${currentLang === 'ru' ? 'Длительность: ' : 'Duration: '}${op.duration}</span>` : ''}
      </div>
      ${op.status === 'running' && op.progress != null ? `
        <div class="operation-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${op.progress}%"></div>
          </div>
        </div>
      ` : ''}
      ${op.error ? `
        <div style="margin-top:12px;padding:10px 12px;background:rgba(239,68,68,0.1);border-radius:8px;font-size:0.8125rem;color:var(--danger);">
          ${currentLang === 'ru' ? op.errorRu : op.error}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function filterOperations(status) {
  currentOperationFilter = status;
  document.querySelectorAll('.op-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  loadOperations();  // reload from API with new filter
}

// ===== LIVE UPDATES =====
function startLiveUpdates() {
  // Uptime counter — initialised from server (process.uptime()) via loadMyStats
  // Falls back to 0 if stats not loaded yet
  window._serverUptimeBase = window._serverUptimeBase || 0;
  const uptimeStart = Date.now();
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - uptimeStart) / 1000);
    const uptimeSeconds = (window._serverUptimeBase || 0) + elapsed;
    const hours = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const el = document.getElementById('uptime-value');
    if (el) el.textContent = `${hours}h ${mins}m`;
  }, 60000);
  
  // Poll for new real activity every 30 seconds
  setInterval(async () => {
    try {
      const data = await apiRequest('GET', '/api/activity?limit=5');
      if (data.ok && data.activity && data.activity.length) {
        const newEntries = data.activity.filter(e => {
          const entryTime = new Date(e.timestamp).getTime();
          return entryTime > (window._lastActivityPoll || 0);
        });
        newEntries.reverse().forEach(entry => {
          addActivity(
            `[Agent #${entry.agentId}] ${entry.message}`,
            `[Агент #${entry.agentId}] ${entry.message}`,
            entry.level === 'error' ? 'error' : entry.level === 'success' ? 'success' : 'info'
          );
        });
        if (newEntries.length > 0) {
          window._lastActivityPoll = Math.max(...newEntries.map(e => new Date(e.timestamp).getTime()));
        }
      }
    } catch {}
  }, 30000);
  window._lastActivityPoll = Date.now();
}

// ===== REFRESH DATA =====
// (real refreshData is defined above — calls API; this block removed to avoid duplicate)

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.875rem;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideIn 0.3s ease;
  `;
  
  if (type === 'success') {
    notification.style.borderColor = 'var(--success)';
  } else if (type === 'error') {
    notification.style.borderColor = 'var(--danger)';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ===== SETTINGS =====
function togglePassword(btn) {
  const input = btn.previousElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = t('hide');
  } else {
    input.type = 'password';
    btn.textContent = t('show');
  }
}

async function saveSettings() {
  if (!authToken) {
    showNotification(t('login_first'), 'error');
    return;
  }

  // Collect settings form values if present
  const settingsObj = {};
  const aiPersona = document.getElementById('ai-persona');
  if (aiPersona && aiPersona.value) settingsObj.aiPersona = aiPersona.value;
  const aiModel = document.getElementById('ai-model');
  if (aiModel && aiModel.value) settingsObj.aiModel = aiModel.value;
  const notifyEl = document.getElementById('notify-enabled');
  if (notifyEl) settingsObj.notificationsEnabled = notifyEl.checked;

  const data = await apiRequest('POST', '/api/settings', { settings: settingsObj });
  if (data.ok) {
    showNotification(t('settings_saved'), 'success');
  } else {
    showNotification(data.error || t('save_failed'), 'error');
  }
}

// ===== AI API KEY MANAGEMENT =====
const _aiProviderPlaceholders = {
  gemini: 'AIzaSy...',
  openai: 'sk-proj-...',
  anthropic: 'sk-ant-...',
  groq: 'gsk_...',
  deepseek: 'sk-...',
  openrouter: 'sk-or-...',
  together: 'sk-...',
};

function onAIProviderChange() {
  const sel = document.getElementById('ai-provider-select');
  const input = document.getElementById('ai-api-key-input');
  if (sel && input) {
    input.placeholder = _aiProviderPlaceholders[sel.value] || 'API Key...';
  }
}

async function loadAIKey() {
  try {
    const data = await apiRequest('GET', '/api/settings');
    if (!data.ok || !data.settings) return;
    const uv = data.settings.user_variables;
    if (!uv) return;
    const vars = typeof uv === 'string' ? JSON.parse(uv) : uv;
    const provider = vars.AI_PROVIDER || 'gemini';
    const hasKey = !!vars.AI_API_KEY;

    const sel = document.getElementById('ai-provider-select');
    if (sel) sel.value = provider;
    onAIProviderChange();

    const statusEl = document.getElementById('ai-key-status');
    if (statusEl) {
      statusEl.style.display = hasKey ? 'inline' : 'none';
      statusEl.textContent = hasKey ? (currentLang === 'ru' ? 'Сохранён' : 'Saved') : '';
    }
    const input = document.getElementById('ai-api-key-input');
    if (input && hasKey) {
      input.value = '';
      input.placeholder = vars.AI_API_KEY.slice(0, 6) + '...' + vars.AI_API_KEY.slice(-4);
    }
  } catch {}
}

async function saveAIKey() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const sel = document.getElementById('ai-provider-select');
  const input = document.getElementById('ai-api-key-input');
  const msgEl = document.getElementById('ai-key-msg');
  const provider = sel ? sel.value : 'gemini';
  const key = input ? input.value.trim() : '';

  if (!key) {
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--danger)'; msgEl.textContent = currentLang === 'ru' ? 'Введите ключ' : 'Enter a key'; }
    return;
  }

  // Get existing user_variables and merge
  let existingVars = {};
  try {
    const cur = await apiRequest('GET', '/api/settings');
    if (cur.ok && cur.settings && cur.settings.user_variables) {
      existingVars = typeof cur.settings.user_variables === 'string' ? JSON.parse(cur.settings.user_variables) : cur.settings.user_variables;
    }
  } catch {}

  existingVars.AI_PROVIDER = provider;
  existingVars.AI_API_KEY = key;

  const data = await apiRequest('POST', '/api/settings', { key: 'user_variables', value: existingVars });
  if (data.ok) {
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--success)'; msgEl.textContent = currentLang === 'ru' ? 'Ключ сохранён!' : 'Key saved!'; }
    const statusEl = document.getElementById('ai-key-status');
    if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = currentLang === 'ru' ? 'Сохранён' : 'Saved'; }
    input.value = '';
    input.placeholder = key.slice(0, 6) + '...' + key.slice(-4);
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
  } else {
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--danger)'; msgEl.textContent = data.error || t('save_failed'); }
  }
}

async function clearAIKey() {
  if (!authToken) return;
  let existingVars = {};
  try {
    const cur = await apiRequest('GET', '/api/settings');
    if (cur.ok && cur.settings && cur.settings.user_variables) {
      existingVars = typeof cur.settings.user_variables === 'string' ? JSON.parse(cur.settings.user_variables) : cur.settings.user_variables;
    }
  } catch {}

  delete existingVars.AI_API_KEY;
  delete existingVars.AI_PROVIDER;

  const data = await apiRequest('POST', '/api/settings', { key: 'user_variables', value: existingVars });
  if (data.ok) {
    const statusEl = document.getElementById('ai-key-status');
    if (statusEl) statusEl.style.display = 'none';
    const input = document.getElementById('ai-api-key-input');
    if (input) { input.value = ''; input.placeholder = 'sk-... / AIza... / gsk_...'; }
    const msgEl = document.getElementById('ai-key-msg');
    if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = 'var(--text-secondary)'; msgEl.textContent = currentLang === 'ru' ? 'Ключ удалён' : 'Key cleared'; setTimeout(() => { msgEl.style.display = 'none'; }, 3000); }
  }
}

// ===== MODALS =====
function showAddServerModal() {
  document.getElementById('add-server-modal').style.display = 'flex';
}

function hideAddServerModal() {
  document.getElementById('add-server-modal').style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in (for demo)
  // simulateLogin();
});

// ===== NAVIGATION HELPER =====
function navigateTo(pageName) {
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const pageEl = document.getElementById(`${pageName}-page`);
  if (pageEl) pageEl.classList.add('active');

  if (authToken && pageLoadFns[pageName]) {
    pageLoadFns[pageName]().catch(console.error);
  }
}

// ===== ANALYTICS PAGE =====
async function loadAnalytics() {
  const [statsData, exData] = await Promise.all([
    apiRequest('GET', '/api/stats/me'),
    apiRequest('GET', '/api/executions'),
  ]);

  // Fill stat cards
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (statsData.ok) {
    setEl('an-total-runs', statsData.totalRuns ?? '—');
    setEl('an-success-rate', (statsData.successRate != null ? statsData.successRate + '%' : '—'));
    setEl('an-last24h', statsData.last24hRuns ?? '—');
    setEl('an-active-agents', statsData.agentsActive ?? '—');
  }

  // Execution history table
  const tableEl = document.getElementById('analytics-executions-table');
  if (!tableEl) return;
  const execs = (exData.ok && exData.executions) || [];
  if (!execs.length) {
    tableEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('no_executions') + '</div>';
    return;
  }

  const statusIcon = s => s === 'success' ? '✅' : s === 'running' ? '🔄' : s === 'failed' ? '❌' : '⏳';
  tableEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead>
        <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
          <th style="text-align:left;padding:.6rem 1rem">Agent</th>
          <th style="text-align:left;padding:.6rem .5rem">Status</th>
          <th style="text-align:left;padding:.6rem .5rem">Duration</th>
          <th style="text-align:left;padding:.6rem .5rem">Time</th>
        </tr>
      </thead>
      <tbody>
        ${execs.slice(0, 50).map(ex => `
          <tr style="border-bottom:1px solid var(--border-subtle)">
            <td style="padding:.5rem 1rem;font-weight:500">#${ex.agentId}</td>
            <td style="padding:.5rem .5rem">${statusIcon(ex.status)} ${ex.status}</td>
            <td style="padding:.5rem .5rem">${ex.durationMs ? (ex.durationMs / 1000).toFixed(1) + 's' : '—'}</td>
            <td style="padding:.5rem .5rem;color:var(--text-muted)">${new Date(ex.startedAt || ex.createdAt).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ===== PERSONA PAGE =====
async function loadPersona() {
  const data = await apiRequest('GET', '/api/settings');
  if (!data.ok) return;
  const s = data.settings || {};
  const persona = s.persona || {};

  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  setVal('persona-model', persona.model);
  setVal('persona-language', persona.language);
  setVal('persona-tone', persona.tone);
  setVal('persona-name', persona.name);
  setVal('persona-instructions', persona.instructions);
}

async function savePersona() {
  if (!authToken) {
    showNotification(t('login_first'), 'error');
    return;
  }
  const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const persona = {
    model: getVal('persona-model'),
    language: getVal('persona-language'),
    tone: getVal('persona-tone'),
    name: getVal('persona-name'),
    instructions: getVal('persona-instructions'),
  };
  const data = await apiRequest('POST', '/api/settings', { settings: { persona } });
  if (data.ok) {
    showNotification(t('persona_saved'), 'success');
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

// ===== KNOWLEDGE BASE PAGE =====
let _knowledgeEntries = [];

async function loadKnowledge() {
  const data = await apiRequest('GET', '/api/settings');
  _knowledgeEntries = (data.ok && data.settings && data.settings.knowledge_base) || [];
  renderKnowledge();
}

function renderKnowledge() {
  const el = document.getElementById('knowledge-entries');
  if (!el) return;
  if (!_knowledgeEntries.length) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">' + t('no_entries') + '</div>';
    return;
  }
  el.innerHTML = _knowledgeEntries.map((entry, i) => `
    <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border-subtle);display:flex;gap:.75rem;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;margin-bottom:.25rem">${escHtml(entry.title || 'Entry ' + (i+1))}</div>
        <div style="color:var(--text-muted);font-size:.83rem;white-space:pre-wrap;max-height:60px;overflow:hidden">${escHtml((entry.content || '').slice(0, 200))}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="flex-shrink:0;color:#dc3545" onclick="deleteKnowledgeEntry(${i})">✕</button>
    </div>`).join('');
}

function showAddKnowledge() {
  const form = document.getElementById('knowledge-add-form');
  if (form) {
    form.style.display = 'block';
    const titleEl = document.getElementById('kb-title');
    if (titleEl) titleEl.focus();
  }
}

async function saveKnowledgeEntry() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const title = (document.getElementById('kb-title') || {}).value?.trim();
  const content = (document.getElementById('kb-content') || {}).value?.trim();
  if (!title || !content) {
    showNotification(t('fill_fields'), 'error');
    return;
  }

  _knowledgeEntries.push({ title, content, createdAt: new Date().toISOString() });
  const data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
  if (data.ok) {
    document.getElementById('kb-title').value = '';
    document.getElementById('kb-content').value = '';
    document.getElementById('knowledge-add-form').style.display = 'none';
    renderKnowledge();
    showNotification(t('entry_added'), 'success');
  } else {
    _knowledgeEntries.pop();
    showNotification(data.error || 'Error', 'error');
  }
}

async function deleteKnowledgeEntry(idx) {
  if (!authToken) return;
  _knowledgeEntries.splice(idx, 1);
  const data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
  if (data.ok) {
    renderKnowledge();
    showNotification(t('entry_deleted'), 'success');
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

// ===== CONNECTORS PAGE =====
let _connectors = {};
let _userVars = {};

async function loadConnectors() {
  const data = await apiRequest('GET', '/api/settings');
  if (!data.ok) return;
  const s = data.settings || {};
  _connectors = s.connectors || {};
  _userVars = s.user_variables || {};

  // Fill connector inputs
  const setConn = (service, field, elId) => {
    const val = (_connectors[service] || {})[field];
    const el = document.getElementById(elId);
    if (el && val) el.value = val;
  };
  setConn('discord', 'webhookUrl', 'discord-webhook');
  setConn('slack', 'webhookUrl', 'slack-webhook');
  setConn('custom_webhook', 'url', 'custom-webhook-url');

  // Update status badges
  const setStatus = (id, connected) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = connected ? t('connected') : t('disconnected');
    el.className = 'credential-status ' + (connected ? 'active' : '');
  };
  setStatus('discord-status', !!(_connectors.discord && _connectors.discord.webhookUrl));
  setStatus('slack-status', !!(_connectors.slack && _connectors.slack.webhookUrl));
  setStatus('custom-webhook-status', !!(_connectors.custom_webhook && _connectors.custom_webhook.url));

  renderVariables();
}

async function saveConnector(service, config) {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const data = await apiRequest('POST', `/api/connectors/${service}`, { config });
  if (data.ok) {
    _connectors[service] = config;
    showNotification(t('connector_saved'), 'success');
    loadConnectors(); // refresh statuses
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

async function removeConnector(service) {
  if (!authToken) return;
  const data = await apiRequest('DELETE', `/api/connectors/${service}`);
  if (data.ok) {
    delete _connectors[service];
    showNotification(t('connector_deleted'), 'success');
    loadConnectors();
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

async function testConnector(service) {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const cfg = _connectors[service] || {};
  const url = cfg.webhookUrl || cfg.url;
  if (!url) { showNotification(t('save_connector_first'), 'error'); return; }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '✅ TON Agent Platform: test connection', username: 'TonAgent' }) });
    if (res.ok) {
      showNotification(t('test_ok'), 'success');
    } else {
      showNotification(`HTTP ${res.status}`, 'error');
    }
  } catch(e) {
    showNotification(e.message, 'error');
  }
}

// ===== MY VARIABLES =====
function renderVariables() {
  const el = document.getElementById('variables-list');
  if (!el) return;
  const entries = Object.entries(_userVars);
  if (!entries.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">' + t('no_variables') + '</div>';
    return;
  }
  el.innerHTML = entries.map(([k, v]) => `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap">
      <code style="background:var(--bg-tertiary);padding:.2rem .5rem;border-radius:4px;font-size:.83rem;flex-shrink:0">${escHtml(k)}</code>
      <span style="color:var(--text-muted);font-size:.83rem">=</span>
      <span style="flex:1;font-size:.83rem;word-break:break-all">${escHtml(String(v))}</span>
      <button class="btn btn-ghost btn-sm" style="color:#dc3545;flex-shrink:0" onclick="deleteVariable('${escHtml(k)}')">✕</button>
    </div>`).join('');
}

function showAddVariable() {
  const form = document.getElementById('add-variable-form');
  if (form) { form.style.display = 'flex'; document.getElementById('var-key')?.focus(); }
}

async function saveVariable() {
  if (!authToken) { showNotification(t('login_first'), 'error'); return; }
  const key = (document.getElementById('var-key')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const val = (document.getElementById('var-value')?.value || '').trim();
  if (!key) { showNotification(t('var_name_required'), 'error'); return; }

  _userVars[key] = val;
  const data = await apiRequest('POST', '/api/settings', { settings: { user_variables: _userVars } });
  if (data.ok) {
    document.getElementById('var-key').value = '';
    document.getElementById('var-value').value = '';
    document.getElementById('add-variable-form').style.display = 'none';
    renderVariables();
    showNotification(t('var_saved'), 'success');
  } else {
    delete _userVars[key];
    showNotification(data.error || 'Error', 'error');
  }
}

async function deleteVariable(key) {
  if (!authToken) return;
  delete _userVars[key];
  const data = await apiRequest('POST', '/api/settings', { settings: { user_variables: _userVars } });
  if (data.ok) {
    renderVariables();
    showNotification(t('var_deleted'), 'success');
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

// ===== PROFILE PAGE =====
async function loadProfile() {
  if (!currentUser) return;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // User info from auth
  setEl('profile-name', [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.first_name || '—');
  setEl('profile-username', currentUser.username ? '@' + currentUser.username : '—');
  setEl('profile-id', currentUser.userId || currentUser.id || '—');

  // Avatar
  if (currentUser.photo_url) {
    const img = document.getElementById('profile-avatar');
    if (img) { img.src = currentUser.photo_url; img.style.display = 'block'; }
    const fb = document.getElementById('profile-avatar-fallback');
    if (fb) fb.style.display = 'none';
  }

  // Balance data
  const balance = await apiRequest('GET', '/api/balance');
  if (balance && !balance.error) {
    setEl('profile-balance', (balance.balance_ton ?? 0).toFixed(2) + ' TON');
    setEl('profile-earned', (balance.total_earned ?? 0).toFixed(2) + ' TON');
    setEl('profile-subscription', balance.subscription || 'Free');
    setEl('profile-wallet', balance.wallet_address ? balance.wallet_address.slice(0, 8) + '...' + balance.wallet_address.slice(-6) : 'Not linked');
  }

  // Stats from API
  const stats = await apiRequest('GET', '/api/stats/me');
  if (stats.ok) {
    setEl('profile-total-agents', stats.agentsTotal ?? '—');
    setEl('profile-active-agents', stats.agentsActive ?? '—');
    setEl('profile-total-runs', stats.totalRuns ?? '—');
    setEl('profile-success-rate', stats.successRate != null ? stats.successRate + '%' : '—');
  }
}

// ===== WALLET PAGE =====
let walletData = null;
let walletTxPage = 0;
const WALLET_TX_PER_PAGE = 20;
let walletTxFilter = 'all';
let _tonConnectUI = null;

async function loadWallet() {
  initTonConnect();
  await Promise.all([loadWalletBalance(), loadTransactions()]);
}

async function loadWalletBalance() {
  const data = await apiRequest('GET', '/api/balance');
  if (!data.ok && !data.balance_ton && data.balance_ton !== 0) return;
  walletData = data;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Balance
  const bal = parseFloat(data.balance_ton || 0);
  const balEl = document.getElementById('wallet-balance');
  if (balEl) balEl.innerHTML = bal.toFixed(2) + ' <span class="wallet-currency">TON</span>';

  // Total earned
  const earned = parseFloat(data.total_earned || 0);
  const earnedEl = document.getElementById('wallet-earned');
  if (earnedEl) earnedEl.innerHTML = earned.toFixed(2) + ' <span class="wallet-currency">TON</span>';

  // Platform wallet address (where users send TON for topup)
  const platformAddr = data.platform_wallet || '';
  setEl('wallet-platform-addr', platformAddr || '—');

  // User's linked personal wallet — 2-state UI
  if (data.wallet_address) {
    showConnectedWallet(data.wallet_address, data.wallet_name || '', data.connected_via || 'manual');
  } else {
    showDisconnectedWallet();
  }

  // Setup topup modal
  setupTopupModal(platformAddr);

  // Setup withdraw modal available balance
  const withdrawAvail = document.getElementById('withdraw-available');
  if (withdrawAvail) withdrawAvail.textContent = bal.toFixed(2) + ' TON';
}

async function loadTransactions() {
  const params = new URLSearchParams({
    limit: WALLET_TX_PER_PAGE.toString(),
    offset: (walletTxPage * WALLET_TX_PER_PAGE).toString(),
  });
  if (walletTxFilter !== 'all') params.set('type', walletTxFilter);

  const data = await apiRequest('GET', '/api/transactions?' + params.toString());
  const listEl = document.getElementById('wallet-transactions-list');
  if (!listEl) return;

  const txs = data.transactions || [];
  const total = data.total || 0;

  if (!txs.length) {
    const emptyMsg = currentLang === 'ru' ? 'Нет транзакций' : 'No transactions yet';
    listEl.innerHTML = '<div class="empty-state" style="padding:40px 20px"><p>' + emptyMsg + '</p></div>';
    const pgEl = document.getElementById('wallet-pagination');
    if (pgEl) pgEl.style.display = 'none';
    return;
  }

  const txIcons = { topup: '💰', withdraw: '💸', spend: '🔥', earn: '💎', refund: '🔄' };
  const txLabels = {
    en: { topup: 'Top Up', withdraw: 'Withdraw', spend: 'Spend', earn: 'Earned', refund: 'Refund' },
    ru: { topup: 'Пополнение', withdraw: 'Вывод', spend: 'Расход', earn: 'Заработок', refund: 'Возврат' }
  };

  listEl.innerHTML = txs.map(tx => {
    const type = tx.type || 'spend';
    const amount = parseFloat(tx.amount_ton || 0);
    const isPositive = amount > 0;
    const sign = isPositive ? '+' : '';
    const amountClass = isPositive ? 'positive' : 'negative';
    const date = new Date(tx.created_at);
    const dateStr = date.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const label = (txLabels[currentLang] || txLabels.en)[type] || type;
    const desc = tx.description || '';
    const status = tx.status || 'completed';

    return '<div class="wallet-tx-row">' +
      '<div class="wallet-tx-icon ' + type + '">' + (txIcons[type] || '📋') + '</div>' +
      '<div class="wallet-tx-info">' +
        '<div class="wallet-tx-type">' + label + '</div>' +
        (desc ? '<div class="wallet-tx-desc" title="' + desc.replace(/"/g, '&quot;') + '">' + desc + '</div>' : '') +
      '</div>' +
      '<div class="wallet-tx-amount ' + amountClass + '">' + sign + Math.abs(amount).toFixed(2) + ' TON</div>' +
      '<div class="wallet-tx-meta">' +
        '<span class="wallet-tx-date">' + dateStr + ' ' + timeStr + '</span>' +
        '<span class="wallet-tx-status ' + status + '">' + (status === 'completed' ? '✅' : status === 'pending' ? '⏳' : '❌') + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  // Pagination
  const totalPages = Math.ceil(total / WALLET_TX_PER_PAGE);
  const pgEl = document.getElementById('wallet-pagination');
  if (pgEl) {
    pgEl.style.display = totalPages > 1 ? 'flex' : 'none';
    const infoEl = document.getElementById('wallet-page-info');
    if (infoEl) infoEl.textContent = (walletTxPage + 1) + ' / ' + totalPages;
    const prevBtn = document.getElementById('wallet-prev-btn');
    const nextBtn = document.getElementById('wallet-next-btn');
    if (prevBtn) prevBtn.disabled = walletTxPage === 0;
    if (nextBtn) nextBtn.disabled = walletTxPage >= totalPages - 1;
  }
}

function filterTransactions(type) {
  walletTxFilter = type;
  walletTxPage = 0;
  document.querySelectorAll('.wallet-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  loadTransactions().catch(console.error);
}

function walletPrevPage() {
  if (walletTxPage > 0) { walletTxPage--; loadTransactions().catch(console.error); }
}

function walletNextPage() {
  walletTxPage++;
  loadTransactions().catch(console.error);
}

// ===== TOP UP MODAL =====
function setupTopupModal(platformAddr) {
  if (!platformAddr) return;
  const userId = currentUser ? (currentUser.userId || currentUser.id) : '';
  const comment = 'topup:' + userId;

  const addrEl = document.getElementById('topup-address');
  if (addrEl) addrEl.textContent = platformAddr;

  const commentEl = document.getElementById('topup-comment');
  if (commentEl) commentEl.textContent = comment;

  // Deep links (ton:// protocol)
  const amounts = [1, 5, 10];
  amounts.forEach(amt => {
    const linkEl = document.getElementById('topup-deeplink-' + amt);
    if (linkEl) {
      const nanoAmount = BigInt(amt) * BigInt(1e9);
      linkEl.href = 'ton://transfer/' + platformAddr + '?amount=' + nanoAmount.toString() + '&text=' + encodeURIComponent(comment);
    }
  });

  // QR Code
  const qrImg = document.getElementById('topup-qr-img');
  if (qrImg) {
    const qrData = 'ton://transfer/' + platformAddr + '?text=' + encodeURIComponent(comment);
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(qrData) + '&bgcolor=ffffff&color=000000';
    qrImg.style.display = 'block';
  }
}

function openTopupModal() {
  const modal = document.getElementById('topup-modal');
  if (modal) modal.style.display = 'flex';
  // Reset result
  const res = document.getElementById('topup-result');
  if (res) { res.style.display = 'none'; res.className = 'topup-result'; }
}

function closeTopupModal() {
  const modal = document.getElementById('topup-modal');
  if (modal) modal.style.display = 'none';
}

function copyTopupAddress() {
  const el = document.getElementById('topup-address');
  if (el) navigator.clipboard.writeText(el.textContent).then(() => showNotification(t('addr_copied'), 'success'));
}

function copyTopupComment() {
  const el = document.getElementById('topup-comment');
  if (el) navigator.clipboard.writeText(el.textContent).then(() => showNotification(t('comment_copied'), 'success'));
}

function copyWalletAddress() {
  const el = document.getElementById('wallet-platform-addr');
  if (el && el.textContent !== '—') {
    navigator.clipboard.writeText(el.textContent).then(() => showNotification(t('addr_copied'), 'success'));
  }
}

async function linkWalletPrompt() {
  const current = walletData && walletData.wallet_address ? walletData.wallet_address : '';
  const addr = prompt(currentLang === 'ru' ? 'Введите ваш TON адрес (EQ... / UQ...):' : 'Enter your TON wallet address (EQ... / UQ...):', current);
  if (!addr) return;
  const trimmed = addr.trim();
  if (!trimmed.startsWith('EQ') && !trimmed.startsWith('UQ') && !trimmed.startsWith('0:')) {
    showNotification(t('invalid_addr'), 'error');
    return;
  }
  await saveWalletAddress(trimmed, null, 'manual');
}

async function saveWalletAddress(address, walletName, connectedVia) {
  try {
    const body = { address };
    if (walletName) body.wallet_name = walletName;
    if (connectedVia) body.connected_via = connectedVia;
    const data = await apiRequest('POST', '/api/wallet/link', body);
    if (data.ok) {
      showNotification(currentLang === 'ru' ? 'Кошелёк привязан' : 'Wallet linked', 'success');
      if (walletData) {
        walletData.wallet_address = address;
        walletData.wallet_name = walletName || null;
        walletData.connected_via = connectedVia || 'manual';
      }
      showConnectedWallet(address, walletName || '', connectedVia || 'manual');
    } else {
      showNotification(data.error || t('save_failed'), 'error');
    }
  } catch (e) {
    showNotification(e.message || t('save_failed'), 'error');
  }
}

function showConnectedWallet(address, walletName, connectedVia) {
  const disc = document.getElementById('wallet-disconnected');
  const conn = document.getElementById('wallet-connected');
  if (disc) disc.style.display = 'none';
  if (conn) conn.style.display = 'flex';
  const nameEl = document.getElementById('wallet-connected-name');
  if (nameEl) nameEl.textContent = walletName || (connectedVia === 'tonconnect' ? 'TON Connect' : (currentLang === 'ru' ? 'Кошелёк' : 'Wallet'));
  const addrEl = document.getElementById('wallet-connected-addr');
  if (addrEl) addrEl.textContent = address.slice(0, 6) + '...' + address.slice(-4);
  addrEl && (addrEl.title = address);
}

function showDisconnectedWallet() {
  const disc = document.getElementById('wallet-disconnected');
  const conn = document.getElementById('wallet-connected');
  if (disc) disc.style.display = 'flex';
  if (conn) conn.style.display = 'none';
}

function _rawToFriendly(raw) {
  if (!raw.includes(':')) return raw; // already friendly
  const [wc, hex] = raw.split(':');
  const hash = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const payload = new Uint8Array(34);
  payload[0] = 0x51; // non-bounceable (UQ)
  payload[1] = parseInt(wc) & 0xff;
  payload.set(hash, 2);
  let crc = 0;
  for (let i = 0; i < 34; i++) { crc ^= payload[i] << 8; for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1; crc &= 0xffff; }
  const full = new Uint8Array(36);
  full.set(payload);
  full[34] = (crc >> 8) & 0xff;
  full[35] = crc & 0xff;
  return btoa(String.fromCharCode(...full)).replace(/\+/g, '-').replace(/\//g, '_');
}

function initTonConnect() {
  if (_tonConnectUI || typeof TON_CONNECT_UI === 'undefined') return;
  try {
    _tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    });
    _tonConnectUI.onStatusChange(wallet => {
      if (wallet) {
        const addr = wallet.account.address;
        const friendly = _rawToFriendly(addr);
        const appName = wallet.device && wallet.device.appName ? wallet.device.appName : 'TON Connect';
        saveWalletAddress(friendly, appName, 'tonconnect');
      }
    });
  } catch (e) {
    console.warn('TON Connect init failed:', e);
  }
}

async function connectTonWallet() {
  if (!_tonConnectUI) initTonConnect();
  if (!_tonConnectUI) {
    showNotification('TON Connect not available', 'error');
    return;
  }
  try {
    await _tonConnectUI.openModal();
  } catch (e) {
    console.warn('TON Connect modal error:', e);
  }
}

async function disconnectTonWallet() {
  try {
    if (_tonConnectUI && _tonConnectUI.connected) {
      await _tonConnectUI.disconnect();
    }
    await apiRequest('POST', '/api/wallet/disconnect', {});
    if (walletData) {
      walletData.wallet_address = null;
      walletData.wallet_name = null;
      walletData.connected_via = null;
    }
    showDisconnectedWallet();
    showNotification(currentLang === 'ru' ? 'Кошелёк отключён' : 'Wallet disconnected', 'success');
  } catch (e) {
    showNotification(e.message || 'Disconnect failed', 'error');
  }
}

async function checkTopup() {
  const btn = document.getElementById('btn-check-topup');
  const res = document.getElementById('topup-result');
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = t('checking'); }

  try {
    const data = await apiRequest('POST', '/api/topup/check', {});
    if (res) {
      res.style.display = 'block';
      if (data.credited) {
        res.className = 'topup-result success';
        const creditedAmt = parseFloat(data.credited || data.amount || 0).toFixed(2);
        const newBal = parseFloat(data.balance || data.newBalance || 0).toFixed(2);
        res.textContent = (currentLang === 'ru'
          ? '✅ Зачислено ' + creditedAmt + ' TON! Баланс: ' + newBal + ' TON'
          : '✅ Credited ' + creditedAmt + ' TON! Balance: ' + newBal + ' TON');
        // Refresh wallet data
        await loadWalletBalance();
        await loadTransactions();
      } else {
        res.className = 'topup-result error';
        res.textContent = (currentLang === 'ru'
          ? '❌ Транзакция не найдена. Убедитесь, что отправили TON с правильным комментарием.'
          : '❌ Transaction not found. Make sure you sent TON with the correct comment.');
      }
    }
  } catch (e) {
    if (res) {
      res.style.display = 'block';
      res.className = 'topup-result error';
      res.textContent = '❌ ' + (e.message || 'Error checking transaction');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector('span').textContent = t('verify_sent');
    }
  }
}

// ===== WITHDRAW MODAL =====
function openWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.style.display = 'flex';
  // Reset
  const res = document.getElementById('withdraw-result');
  if (res) { res.style.display = 'none'; }
  const err = document.getElementById('withdraw-error');
  if (err) err.style.display = 'none';
  const addrInput = document.getElementById('withdraw-address');
  const amtInput = document.getElementById('withdraw-amount');
  // Pre-fill saved wallet address
  if (addrInput) {
    const savedAddr = walletData && walletData.wallet_address ? walletData.wallet_address : '';
    addrInput.value = savedAddr;
  }
  if (amtInput) amtInput.value = '';
  updateWithdrawReceive();

  // Update available
  if (walletData) {
    const avail = document.getElementById('withdraw-available');
    if (avail) avail.textContent = parseFloat(walletData.balance_ton || 0).toFixed(2) + ' TON';
  }
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdraw-modal');
  if (modal) modal.style.display = 'none';
}

function setMaxWithdraw() {
  if (!walletData) return;
  const bal = parseFloat(walletData.balance_ton || 0);
  const maxAmount = Math.max(0, bal * 0.8 - 0.05); // 80% cap minus fee
  const amtInput = document.getElementById('withdraw-amount');
  if (amtInput) amtInput.value = maxAmount.toFixed(2);
  updateWithdrawReceive();
}

function updateWithdrawReceive() {
  const amtInput = document.getElementById('withdraw-amount');
  const receiveEl = document.getElementById('withdraw-receive');
  if (!amtInput || !receiveEl) return;
  const amount = parseFloat(amtInput.value) || 0;
  const receive = Math.max(0, amount - 0.05);
  receiveEl.textContent = receive.toFixed(2) + ' TON';
}

// Listen for amount changes
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'withdraw-amount') updateWithdrawReceive();
});

async function submitWithdraw() {
  const addrInput = document.getElementById('withdraw-address');
  const amtInput = document.getElementById('withdraw-amount');
  const errEl = document.getElementById('withdraw-error');
  const resEl = document.getElementById('withdraw-result');
  const btn = document.getElementById('btn-withdraw-submit');

  const address = (addrInput ? addrInput.value : '').trim();
  const amount = parseFloat(amtInput ? amtInput.value : '0');

  // Validate
  if (!address || (!address.startsWith('EQ') && !address.startsWith('UQ') && !address.startsWith('0:'))) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = t('invalid_addr'); }
    return;
  }
  if (!amount || amount < 0.1) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = t('min_amount'); }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (resEl) resEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = t('sending'); }

  try {
    const data = await apiRequest('POST', '/api/withdraw', { address, amount });
    if (data.ok || data.txHash) {
      if (resEl) {
        resEl.style.display = 'block';
        resEl.className = 'withdraw-result success';
        resEl.textContent = (currentLang === 'ru'
          ? '✅ Отправлено! TX: ' + (data.txHash || '—').substring(0, 16) + '...'
          : '✅ Sent! TX: ' + (data.txHash || '—').substring(0, 16) + '...');
      }
      // Save wallet address for future use (syncs with bot)
      saveWalletAddress(address, null, 'manual').catch(() => {});
      // Refresh
      await loadWalletBalance();
      await loadTransactions();
      // Clear form
      if (addrInput) addrInput.value = '';
      if (amtInput) amtInput.value = '';
    } else {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = data.error || (currentLang === 'ru' ? 'Ошибка вывода' : 'Withdraw failed');
      }
    }
  } catch (e) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '❌ ' + (e.message || 'Error');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector('span').textContent = t('withdraw');
    }
  }
}

// ===== MOBILE SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

// Close sidebar when navigating on mobile
const origNavigateTo = navigateTo;
navigateTo = function(pageName) {
  origNavigateTo(pageName);
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }
};

// ===== FLOW BUILDER (Visual Agent Constructor) =====
const FLOW_NODE_DEFS = {
  // ── Triggers ──
  timer:          { cat: 'triggers', color: '#f59e0b', icon: '\u23F0',  label: 'Timer',          labelRu: '\u0422\u0430\u0439\u043C\u0435\u0440',        desc: 'Run on interval',             descRu: '\u0417\u0430\u043F\u0443\u0441\u043A \u043F\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0443',         fields: [
    { key: 'intervalMs', label: 'Interval', labelRu: '\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B', type: 'select', options: [{ v: '60000', l: '1 min' }, { v: '300000', l: '5 min' }, { v: '600000', l: '10 min' }, { v: '1800000', l: '30 min' }, { v: '3600000', l: '1 hour' }] },
    { key: 'cron', label: 'Cron', type: 'text', placeholder: '0 9 * * 1-5' }
  ] },
  manual:         { cat: 'triggers', color: '#f59e0b', icon: '\u25B6\uFE0F', label: 'Manual',     labelRu: '\u0412\u0440\u0443\u0447\u043D\u0443\u044E',       desc: 'Start manually',              descRu: '\u0417\u0430\u043F\u0443\u0441\u043A \u0432\u0440\u0443\u0447\u043D\u0443\u044E',          fields: [] },
  webhook:        { cat: 'triggers', color: '#f59e0b', icon: '\uD83D\uDD17', label: 'Webhook',    labelRu: 'Webhook',         desc: 'Trigger via HTTP',            descRu: '\u0417\u0430\u043F\u0443\u0441\u043A \u0447\u0435\u0440\u0435\u0437 HTTP',          fields: [{ key: 'path', label: 'Path', type: 'text', placeholder: '/my-hook' }] },
  // ── TON ──
  get_balance:    { cat: 'ton',      color: '#3b82f6', icon: '\uD83D\uDCB0', label: 'Get Balance', labelRu: '\u0411\u0430\u043B\u0430\u043D\u0441',          desc: 'Check TON balance',           descRu: '\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441 TON',       fields: [{ key: 'address', label: 'Address', type: 'text', placeholder: 'EQ...' }] },
  nft_floor:      { cat: 'ton',      color: '#3b82f6', icon: '\uD83D\uDDBC\uFE0F', label: 'NFT Floor', labelRu: '\u0426\u0435\u043D\u0430 NFT', desc: 'NFT floor price',             descRu: 'Floor \u0446\u0435\u043D\u0430 NFT',            fields: [{ key: 'collection', label: 'Collection', type: 'text', placeholder: 'TON Punks' }] },
  send_ton:       { cat: 'ton',      color: '#3b82f6', icon: '\uD83D\uDCB8', label: 'Send TON',   labelRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C TON',   desc: 'Send TON transaction',        descRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C TON',           fields: [
    { key: 'address', label: 'To address', labelRu: '\u0410\u0434\u0440\u0435\u0441', type: 'text', placeholder: 'EQ...' },
    { key: 'amount', label: 'Amount', labelRu: '\u0421\u0443\u043C\u043C\u0430', type: 'number', placeholder: '1.0' },
    { key: 'memo', label: 'Memo', type: 'text', placeholder: 'Payment for...' }
  ] },
  // ── Gifts ──
  gift_prices:    { cat: 'gifts',    color: '#a855f7', icon: '\uD83C\uDF81', label: 'Gift Prices', labelRu: '\u0426\u0435\u043D\u044B \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432',   desc: 'Gift floor price',            descRu: 'Floor \u0446\u0435\u043D\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u0430',        fields: [{ key: 'slug', label: 'Gift slug', type: 'text', placeholder: 'gift-name' }] },
  scan_arbitrage: { cat: 'gifts',    color: '#a855f7', icon: '\uD83D\uDCC8', label: 'Scan Arbitrage', labelRu: '\u0410\u0440\u0431\u0438\u0442\u0440\u0430\u0436', desc: 'Find arbitrage deals',       descRu: '\u041F\u043E\u0438\u0441\u043A \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436\u0430',          fields: [{ key: 'min_profit_pct', label: 'Min profit %', type: 'number', placeholder: '5' }] },
  gift_floor:     { cat: 'gifts',    color: '#a855f7', icon: '\uD83D\uDCCA', label: 'Gift Floor', labelRu: '\u0426\u0435\u043D\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u0430',   desc: 'Real-time gift floor',        descRu: '\u0420\u0435\u0430\u043B\u044C\u043D\u0430\u044F \u0446\u0435\u043D\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u0430',     fields: [{ key: 'gift_name', label: 'Gift name', type: 'text', placeholder: 'Plush Pepe' }] },
  market_overview:{ cat: 'gifts',    color: '#a855f7', icon: '\uD83C\uDFEA', label: 'Market Overview', labelRu: '\u041E\u0431\u0437\u043E\u0440 \u0440\u044B\u043D\u043A\u0430', desc: 'Gift market overview',       descRu: '\u041E\u0431\u0437\u043E\u0440 \u0440\u044B\u043D\u043A\u0430 \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432',   fields: [] },
  // ── Web ──
  web_search:     { cat: 'web',      color: '#06b6d4', icon: '\uD83D\uDD0D', label: 'Web Search', labelRu: '\u041F\u043E\u0438\u0441\u043A',            desc: 'Search the web',              descRu: '\u041F\u043E\u0438\u0441\u043A \u0432 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442\u0435',        fields: [
    { key: 'query', label: 'Query', labelRu: '\u0417\u0430\u043F\u0440\u043E\u0441', type: 'text', placeholder: 'Search...' },
    { key: 'save_to', label: 'Save to variable', labelRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432', type: 'text', placeholder: 'search_result' }
  ] },
  fetch_url:      { cat: 'web',      color: '#06b6d4', icon: '\uD83C\uDF10', label: 'Fetch URL',  labelRu: '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C URL',    desc: 'HTTP GET request',            descRu: 'HTTP GET \u0437\u0430\u043F\u0440\u043E\u0441',            fields: [{ key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' }] },
  http_request:   { cat: 'web',      color: '#06b6d4', icon: '\u2194\uFE0F', label: 'HTTP Request', labelRu: 'HTTP \u0437\u0430\u043F\u0440\u043E\u0441',   desc: 'Custom HTTP request',         descRu: '\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u043B\u044C\u043D\u044B\u0439 HTTP \u0437\u0430\u043F\u0440\u043E\u0441',   fields: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' },
    { key: 'method', label: 'Method', labelRu: '\u041C\u0435\u0442\u043E\u0434', type: 'select', options: [{ v: 'GET', l: 'GET' }, { v: 'POST', l: 'POST' }, { v: 'PUT', l: 'PUT' }, { v: 'DELETE', l: 'DELETE' }] },
    { key: 'headers', label: 'Headers', labelRu: '\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438', type: 'textarea', placeholder: '{"Authorization":"Bearer ..."}' },
    { key: 'body', label: 'Body', labelRu: '\u0422\u0435\u043B\u043E', type: 'textarea', placeholder: '{"key":"value"}', showWhen: { key: 'method', value: 'POST' } },
    { key: 'save_to', label: 'Save to variable', labelRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432', type: 'text', placeholder: 'response_data' }
  ] },
  // ── Telegram ──
  send_message:   { cat: 'telegram', color: '#0ea5e9', icon: '\u2709\uFE0F', label: 'TG Message', labelRu: '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 TG',    desc: 'Send Telegram message',       descRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435',      fields: [{ key: 'peer', label: 'Chat/User', type: 'text', placeholder: '@username' }, { key: 'text', label: 'Text', type: 'textarea', placeholder: '{{result}} \u2014 use for prev step data' }] },
  tg_read:        { cat: 'telegram', color: '#0ea5e9', icon: '\uD83D\uDCE9', label: 'Read Messages', labelRu: '\u0427\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F', desc: 'Read chat messages', descRu: '\u0427\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0447\u0430\u0442\u0430', fields: [{ key: 'peer', label: 'Chat', type: 'text', placeholder: '@channel' }, { key: 'limit', label: 'Limit', type: 'number', placeholder: '10' }] },
  tg_react:       { cat: 'telegram', color: '#0ea5e9', icon: '\uD83D\uDC4D', label: 'Reaction',   labelRu: '\u0420\u0435\u0430\u043A\u0446\u0438\u044F',         desc: 'Add reaction to message',     descRu: '\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0435\u0430\u043A\u0446\u0438\u044E',         fields: [{ key: 'peer', label: 'Chat', type: 'text', placeholder: '@channel' }, { key: 'emoji', label: 'Emoji', type: 'text', placeholder: '\uD83D\uDC4D' }] },
  tg_forward:     { cat: 'telegram', color: '#0ea5e9', icon: '\u2197\uFE0F', label: 'Forward',    labelRu: '\u041F\u0435\u0440\u0435\u0441\u043B\u0430\u0442\u044C',       desc: 'Forward message',             descRu: '\u041F\u0435\u0440\u0435\u0441\u043B\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435',       fields: [{ key: 'from_peer', label: 'From chat', type: 'text', placeholder: '@source' }, { key: 'to_peer', label: 'To chat', type: 'text', placeholder: '@target' }] },
  // ── Output ──
  notify:         { cat: 'output',   color: '#10b981', icon: '\uD83D\uDD14', label: 'Notify',     labelRu: '\u0423\u0432\u0435\u0434\u043E\u043C\u0438\u0442\u044C',       desc: 'Send notification',           descRu: '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435',     fields: [
    { key: 'message', label: 'Message', labelRu: '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435', type: 'textarea', placeholder: '{{result}} \u2014 use for prev step data' },
    { key: 'format', label: 'Format', labelRu: '\u0424\u043E\u0440\u043C\u0430\u0442', type: 'select', options: [{v:'text',l:'Text'},{v:'html',l:'HTML'}] }
  ] },
  notify_rich:    { cat: 'output',   color: '#10b981', icon: '\uD83D\uDCE8', label: 'Rich Notify', labelRu: 'HTML \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435', desc: 'HTML notification',  descRu: 'HTML \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435',     fields: [{ key: 'message', label: 'HTML Message', type: 'textarea', placeholder: '<b>Alert</b>' }] },
  // ── Logic ──
  condition:      { cat: 'logic',    color: '#f43f5e', icon: '\uD83D\uDD00', label: 'Condition',  labelRu: '\u0423\u0441\u043B\u043E\u0432\u0438\u0435',        desc: 'If/else branch',              descRu: '\u0412\u0435\u0442\u0432\u043B\u0435\u043D\u0438\u0435 \u0435\u0441\u043B\u0438/\u0438\u043D\u0430\u0447\u0435',       fields: [
    { type: 'row', children: [
      { key: 'left', label: 'A', type: 'text', placeholder: 'minFloor / balance' },
      { key: 'operator', label: 'Op', type: 'select', options: [{v:'==',l:'=='},{v:'!=',l:'!='},{v:'>',l:'>'},{v:'<',l:'<'},{v:'>=',l:'>='},{v:'<=',l:'<='},{v:'contains',l:'\u2283'},{v:'is_empty',l:'\u2205'}] },
      { key: 'right', label: 'B', type: 'text', placeholder: '10' }
    ]},
    { key: 'expression', label: 'Free expression', labelRu: '\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435', type: 'text', placeholder: '{{result.minFloor}} > 0' }
  ], extraPorts: ['true', 'false'] },
  delay:          { cat: 'logic',    color: '#f43f5e', icon: '\u23F3',  label: 'Delay',          labelRu: '\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430',        desc: 'Wait before next step',       descRu: '\u041F\u0430\u0443\u0437\u0430 \u043F\u0435\u0440\u0435\u0434 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u0448\u0430\u0433\u043E\u043C',   fields: [
    { type: 'row', children: [
      { key: 'delay_amount', label: 'Wait', labelRu: '\u0416\u0434\u0430\u0442\u044C', type: 'number', placeholder: '5' },
      { key: 'delay_unit', label: 'Unit', labelRu: '\u0415\u0434.', type: 'select', options: [{v:'ms',l:'ms'},{v:'s',l:'sec'},{v:'min',l:'min'},{v:'h',l:'hour'}] }
    ]}
  ] },
  list_agents:    { cat: 'logic',    color: '#f43f5e', icon: '\uD83E\uDD16', label: 'List Agents', labelRu: '\u0421\u043F\u0438\u0441\u043E\u043A \u0430\u0433\u0435\u043D\u0442\u043E\u0432', desc: 'List your agents', descRu: '\u0421\u043F\u0438\u0441\u043E\u043A \u0432\u0430\u0448\u0438\u0445 \u0430\u0433\u0435\u043D\u0442\u043E\u0432', fields: [] },
  ask_agent:      { cat: 'logic',    color: '#f43f5e', icon: '\uD83D\uDCAC', label: 'Ask Agent',  labelRu: '\u0421\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0430\u0433\u0435\u043D\u0442\u0430', desc: 'Ask another agent',  descRu: '\u0421\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0430\u0433\u0435\u043D\u0442\u0430', fields: [{ key: 'agent_id', label: 'Agent ID', type: 'number', placeholder: '123' }, { key: 'message', label: 'Message', type: 'textarea', placeholder: 'What is...' }] },
  loop:           { cat: 'logic',    color: '#f43f5e', icon: '\uD83D\uDD04', label: 'Loop',       labelRu: '\u0426\u0438\u043A\u043B',            desc: 'Repeat actions',              descRu: '\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F',       fields: [
    { key: 'mode', label: 'Mode', labelRu: '\u0420\u0435\u0436\u0438\u043C', type: 'select', options: [{v:'repeat_n',l:'Repeat N'},{v:'while',l:'While'},{v:'for_each',l:'For Each'}] },
    { key: 'count', label: 'Count', labelRu: '\u041A\u043E\u043B-\u0432\u043E', type: 'number', placeholder: '5', showWhen: {key:'mode',value:'repeat_n'} },
    { key: 'while_cond', label: 'While condition', labelRu: '\u041F\u043E\u043A\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u0435', type: 'text', placeholder: 'balance > 0', showWhen: {key:'mode',value:'while'} },
    { key: 'list_var', label: 'List variable', labelRu: '\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u0441\u043F\u0438\u0441\u043A\u0430', type: 'text', placeholder: 'items', showWhen: {key:'mode',value:'for_each'} },
    { key: 'item_var', label: 'Item variable', labelRu: '\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430', type: 'text', placeholder: 'item', showWhen: {key:'mode',value:'for_each'} },
    { key: 'max_iter', label: 'Max iterations', labelRu: '\u041C\u0430\u043A\u0441. \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u0439', type: 'number', placeholder: '100' }
  ], extraPorts: ['loop', 'done'] },
  group_ref:      { cat: 'logic',    color: '#64748b', icon: '\uD83D\uDCE6', label: 'Function',   labelRu: '\u0424\u0443\u043D\u043A\u0446\u0438\u044F',        desc: 'Call function group',         descRu: '\u0412\u044B\u0437\u0432\u0430\u0442\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u044E',       fields: [
    { key: 'group_id', label: 'Function', labelRu: '\u0424\u0443\u043D\u043A\u0446\u0438\u044F', type: 'select', options: [] }
  ] },
  // ── State ──
  get_state:      { cat: 'state',    color: '#8b5cf6', icon: '\uD83D\uDCE5', label: 'Get State',  labelRu: '\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C',       desc: 'Read saved value',            descRu: '\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435',        fields: [{ key: 'key', label: 'Key', type: 'text', placeholder: 'my_key' }] },
  set_state:      { cat: 'state',    color: '#8b5cf6', icon: '\uD83D\uDCE4', label: 'Set State',  labelRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C',      desc: 'Save value',                  descRu: '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435',       fields: [{ key: 'key', label: 'Key', type: 'text', placeholder: 'my_key' }, { key: 'value', label: 'Value', type: 'text', placeholder: '...' }] },
};

const NODE_W = 180, NODE_H = 56, PORT_R = 6;
let _flowNodes = [], _flowEdges = [], _flowSelectedId = null;
let _flowDragNode = null, _flowDragOffset = { dx: 0, dy: 0 };
let _flowConnecting = null; // { fromId, fromPort, mx, my }
let _flowMouse = { x: 0, y: 0 };
let _flowAnimId = null;
let _flowCanvas = null, _flowCtx = null;
let _flowNextId = 1;
let _flowParticles = [];
let _flowMultiSelected = new Set();
let _flowGroups = []; // [{id, name, nodeIds[], collapsed}]
let _flowGroupNextId = 1;

// Zoom & Pan
let _flowZoom = 1;
let _flowPanX = 0, _flowPanY = 0;
let _flowPanning = false, _flowPanStart = { x: 0, y: 0 };
let _flowSpaceHeld = false;

// Undo/Redo history
let _flowHistory = [];     // [{nodes, edges}]
let _flowHistoryIdx = -1;
const _flowHistoryMax = 50;

function flowPushState() {
  // Trim future entries when we branch off
  _flowHistory = _flowHistory.slice(0, _flowHistoryIdx + 1);
  _flowHistory.push({
    nodes: JSON.parse(JSON.stringify(_flowNodes)),
    edges: JSON.parse(JSON.stringify(_flowEdges)),
  });
  if (_flowHistory.length > _flowHistoryMax) _flowHistory.shift();
  _flowHistoryIdx = _flowHistory.length - 1;
  updateUndoRedoButtons();
}

function flowUndo() {
  if (_flowHistoryIdx <= 0) return;
  _flowHistoryIdx--;
  const snap = _flowHistory[_flowHistoryIdx];
  _flowNodes = JSON.parse(JSON.stringify(snap.nodes));
  _flowEdges = JSON.parse(JSON.stringify(snap.edges));
  // Restore defs
  _flowNodes.forEach(n => { n.def = FLOW_NODE_DEFS[n.type]; });
  _flowSelectedId = null;
  _flowParticles = [];
  renderFlowConfig();
  updateUndoRedoButtons();
}

function flowRedo() {
  if (_flowHistoryIdx >= _flowHistory.length - 1) return;
  _flowHistoryIdx++;
  const snap = _flowHistory[_flowHistoryIdx];
  _flowNodes = JSON.parse(JSON.stringify(snap.nodes));
  _flowEdges = JSON.parse(JSON.stringify(snap.edges));
  _flowNodes.forEach(n => { n.def = FLOW_NODE_DEFS[n.type]; });
  _flowSelectedId = null;
  _flowParticles = [];
  renderFlowConfig();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('flow-undo-btn');
  const redoBtn = document.getElementById('flow-redo-btn');
  if (undoBtn) undoBtn.disabled = _flowHistoryIdx <= 0;
  if (redoBtn) redoBtn.disabled = _flowHistoryIdx >= _flowHistory.length - 1;
}

function togglePaletteCat(headerEl) {
  headerEl.parentElement.classList.toggle('collapsed');
}

const PALETTE_CAT_META = {
  triggers: { color: '#f59e0b', en: 'Triggers',       ru: '\u0422\u0440\u0438\u0433\u0433\u0435\u0440\u044B' },
  ton:      { color: '#3b82f6', en: 'TON Blockchain',  ru: 'TON \u0411\u043B\u043E\u043A\u0447\u0435\u0439\u043D' },
  gifts:    { color: '#a855f7', en: 'Gifts',           ru: '\u041F\u043E\u0434\u0430\u0440\u043A\u0438' },
  web:      { color: '#06b6d4', en: 'Web',             ru: '\u0412\u0435\u0431' },
  telegram: { color: '#0ea5e9', en: 'Telegram',        ru: 'Telegram' },
  output:   { color: '#10b981', en: 'Output',          ru: '\u0412\u044B\u0432\u043E\u0434' },
  logic:    { color: '#f43f5e', en: 'Logic',           ru: '\u041B\u043E\u0433\u0438\u043A\u0430' },
  state:    { color: '#8b5cf6', en: 'State',           ru: '\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435' },
};

function buildFlowPalette() {
  const container = document.getElementById('flow-palette-content');
  if (!container) return;
  const ru = currentLang === 'ru';

  // Group nodes by category
  const groups = {};
  for (const [type, def] of Object.entries(FLOW_NODE_DEFS)) {
    const cat = def.cat;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ type, def });
  }

  let html = '';
  const catOrder = ['triggers', 'ton', 'gifts', 'web', 'telegram', 'output', 'logic', 'state'];
  for (const cat of catOrder) {
    const nodes = groups[cat];
    if (!nodes || !nodes.length) continue;
    const meta = PALETTE_CAT_META[cat] || { color: '#888', en: cat, ru: cat };
    html += '<div class="palette-category" data-cat="' + cat + '">';
    html += '<div class="palette-cat-header" onclick="togglePaletteCat(this)">';
    html += '<span class="cat-dot" style="background:' + meta.color + '"></span>';
    html += '<span>' + (ru ? meta.ru : meta.en) + '</span>';
    html += '<svg class="cat-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    html += '</div>';
    html += '<div class="palette-nodes">';
    for (const { type, def } of nodes) {
      const label = (ru && def.labelRu) ? def.labelRu : def.label;
      const desc = (ru && def.descRu) ? def.descRu : (def.desc || '');
      html += '<div class="palette-node" data-type="' + type + '" onclick="addFlowNode(\'' + type + '\')" title="' + desc + '">';
      html += '<span class="pn-icon">' + def.icon + '</span>';
      html += '<span class="pn-label">' + label + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function addFlowNode(type) {
  const def = FLOW_NODE_DEFS[type];
  if (!def) return;
  const id = 'n' + (_flowNextId++);
  const cx = _flowCanvas ? _flowCanvas.width / 2 / (window.devicePixelRatio || 1) : 400;
  const cy = _flowCanvas ? _flowCanvas.height / 2 / (window.devicePixelRatio || 1) : 250;
  // Offset each new node slightly so they don't stack perfectly
  const jx = (Math.random() - 0.5) * 80;
  const jy = (Math.random() - 0.5) * 60;
  _flowNodes.push({
    id, type, x: cx + jx, y: cy + jy,
    config: {},
    def,
  });
  _flowSelectedId = id;
  flowPushState();
  renderFlowConfig();
}

function deleteFlowNode(id) {
  _flowNodes = _flowNodes.filter(n => n.id !== id);
  _flowEdges = _flowEdges.filter(e => e.from !== id && e.to !== id);
  _flowParticles = _flowParticles.filter(p => p.from !== id && p.to !== id);
  flowPushState();
  if (_flowSelectedId === id) { _flowSelectedId = null; renderFlowConfig(); }
}

function getFlowNode(id) { return _flowNodes.find(n => n.id === id); }

// Port positions
function getPortPos(node, port) {
  const x = node.x, y = node.y;
  if (port === 'in') return { x: x, y: y + NODE_H / 2 };
  if (port === 'out') return { x: x + NODE_W, y: y + NODE_H / 2 };
  if (port === 'true') return { x: x + NODE_W, y: y + NODE_H / 3 };
  if (port === 'false') return { x: x + NODE_W, y: y + NODE_H * 2 / 3 };
  if (port === 'loop') return { x: x + NODE_W, y: y + NODE_H / 3 };
  if (port === 'done') return { x: x + NODE_W, y: y + NODE_H * 2 / 3 };
  return { x: x + NODE_W, y: y + NODE_H / 2 };
}

function hitTestPort(node, mx, my) {
  const ports = ['in', 'out'];
  if (node.def.extraPorts) ports.push(...node.def.extraPorts);
  for (const p of ports) {
    const pos = getPortPos(node, p);
    const dx = mx - pos.x, dy = my - pos.y;
    if (dx * dx + dy * dy < (PORT_R + 4) * (PORT_R + 4)) return p;
  }
  return null;
}

function hitTestNode(mx, my) {
  for (let i = _flowNodes.length - 1; i >= 0; i--) {
    const n = _flowNodes[i];
    if (mx >= n.x && mx <= n.x + NODE_W && my >= n.y && my <= n.y + NODE_H) return n;
  }
  return null;
}

// Render config panel
function renderFlowConfig() {
  const body = document.getElementById('flow-config-body');
  if (!body) return;
  if (!_flowSelectedId) {
    body.innerHTML = '<p class="flow-config-empty">' + t('no_node_selected') + '</p>';
    return;
  }
  const node = getFlowNode(_flowSelectedId);
  if (!node) { body.innerHTML = ''; return; }
  const def = node.def;
  const cfgLabel = (currentLang === 'ru' && def.labelRu) ? def.labelRu : def.label;
  const cfgDesc = (currentLang === 'ru' && def.descRu) ? def.descRu : (def.desc || '');
  let html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
  html += '<span style="font-size:1.4rem">' + def.icon + '</span>';
  html += '<strong style="font-size:0.95rem">' + cfgLabel + '</strong>';
  html += '<span style="width:10px;height:10px;border-radius:50%;background:' + def.color + ';box-shadow:0 0 6px ' + def.color + '"></span>';
  html += '</div>';
  if (cfgDesc) {
    html += '<div style="font-size:0.8rem;color:rgba(255,255,255,0.4);margin-bottom:16px;">' + cfgDesc + '</div>';
  }

  function renderField(f, nodeId, config) {
    const flabel = (currentLang === 'ru' && f.labelRu) ? f.labelRu : f.label;
    let h = '';
    if (f.type === 'textarea') {
      h += '<textarea data-cfg-key="' + f.key + '" placeholder="' + (f.placeholder || '') + '" oninput="updateFlowNodeConfig(\'' + nodeId + '\',\'' + f.key + '\',this.value)">' + (config[f.key] || '') + '</textarea>';
    } else if (f.type === 'select') {
      h += '<select data-cfg-key="' + f.key + '" onchange="updateFlowNodeConfig(\'' + nodeId + '\',\'' + f.key + '\',this.value)">';
      for (const opt of (f.options || [])) {
        const sel = config[f.key] == opt.v ? ' selected' : '';
        h += '<option value="' + opt.v + '"' + sel + '>' + opt.l + '</option>';
      }
      h += '</select>';
    } else {
      h += '<input type="' + (f.type || 'text') + '" data-cfg-key="' + f.key + '" placeholder="' + (f.placeholder || '') + '" value="' + (config[f.key] || '') + '" oninput="updateFlowNodeConfig(\'' + nodeId + '\',\'' + f.key + '\',this.value)">';
    }
    return h;
  }

  for (const f of def.fields) {
    // showWhen: hide field if condition not met
    if (f.showWhen) {
      const curVal = node.config[f.showWhen.key] || '';
      if (curVal !== f.showWhen.value) continue;
    }
    if (f.type === 'row') {
      html += '<div class="form-group flow-row">';
      for (const child of (f.children || [])) {
        const clabel = (currentLang === 'ru' && child.labelRu) ? child.labelRu : child.label;
        html += '<div class="flow-row-item"><label>' + (clabel || '') + '</label>' + renderField(child, _flowSelectedId, node.config) + '</div>';
      }
      html += '</div>';
    } else {
      const flabel = (currentLang === 'ru' && f.labelRu) ? f.labelRu : f.label;
      html += '<div class="form-group">';
      html += '<label>' + flabel + '</label>';
      html += renderField(f, _flowSelectedId, node.config);
      html += '</div>';
    }
  }
  html += '<button class="btn-delete-node" onclick="deleteFlowNode(\'' + _flowSelectedId + '\')">\uD83D\uDDD1 ' + t('delete_node') + '</button>';
  // Multi-select: show "Create Function" button
  if (_flowMultiSelected.size >= 2) {
    const lbl = currentLang === 'ru' ? '\uD83D\uDCE6 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u044E' : '\uD83D\uDCE6 Create Function';
    html += '<button class="btn-create-group" onclick="createFlowGroup()" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:rgba(100,116,139,0.15);border:1px solid rgba(100,116,139,0.4);color:#94a3b8;cursor:pointer;font-size:0.8rem;font-weight:500;">' + lbl + '</button>';
  }
  body.innerHTML = html;
}

function updateFlowNodeConfig(nodeId, key, value) {
  const node = getFlowNode(nodeId);
  if (!node) return;
  node.config[key] = value;
  // Re-render if this key is referenced by a showWhen
  const def = node.def;
  const hasShowWhen = def.fields.some(f => f.showWhen && f.showWhen.key === key);
  if (hasShowWhen) renderFlowConfig();
}

function createFlowGroup() {
  if (_flowMultiSelected.size < 2) return;
  const nodeIds = [..._flowMultiSelected];
  const name = prompt(currentLang === 'ru' ? '\u0418\u043C\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u0438:' : 'Function name:', 'Function ' + _flowGroupNextId);
  if (!name) return;
  const group = { id: 'g' + (_flowGroupNextId++), name, nodeIds, collapsed: false };
  _flowGroups.push(group);
  _flowMultiSelected.clear();
  // Update group_ref options
  updateGroupRefOptions();
  renderFlowConfig();
}

function updateGroupRefOptions() {
  const def = FLOW_NODE_DEFS.group_ref;
  if (def) def.fields[0].options = _flowGroups.map(g => ({ v: g.id, l: g.name }));
}

function toggleFlowGroup(groupId) {
  const g = _flowGroups.find(gr => gr.id === groupId);
  if (g) g.collapsed = !g.collapsed;
}

// Deploy flow with brain convergence animation
let _deployAnimating = false;

async function deployFlow() {
  if (!_flowNodes.length) { showFlowToast(t('deploy_fail') + ': add nodes first', 'error'); return; }
  if (_deployAnimating) return;

  const name = document.getElementById('flow-agent-name')?.value?.trim() || 'Flow Agent';
  const flow = { nodes: _flowNodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config })), edges: _flowEdges.map(e => ({ from: e.from, fromPort: e.fromPort, to: e.to, toPort: e.toPort })), groups: _flowGroups };
  const btn = document.getElementById('flow-deploy-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '\u26A1 ' + t('deploying'); }

  // Run deploy animation
  _deployAnimating = true;
  await runDeployAnimation();

  try {
    const data = await apiRequest('POST', '/api/agents/flow', { name, flow });
    if (data.ok) {
      showFlowToast('\u2705 ' + t('deployed_ok') + ' #' + data.agentId, 'success');
      loadAgents();
    } else {
      showFlowToast('\u274C ' + (data.error || t('deploy_fail')), 'error');
    }
  } catch (e) {
    showFlowToast('\u274C ' + e.message, 'error');
  } finally {
    _deployAnimating = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg> ' + t('deploy'); }
  }
}

function runDeployAnimation() {
  return new Promise(resolve => {
    if (!_flowCanvas || !_flowCtx || !_flowNodes.length) { resolve(); return; }
    const ctx = _flowCtx;
    const wrap = _flowCanvas.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const centerX = W / 2, centerY = H / 2;

    // Save original positions
    const origPositions = _flowNodes.map(n => ({ id: n.id, x: n.x, y: n.y }));

    // Compute world-space center accounting for zoom/pan
    const worldCX = (centerX - _flowPanX) / _flowZoom;
    const worldCY = (centerY - _flowPanY) / _flowZoom;

    const duration = 2200; // ms total
    const convergeEnd = 1200; // blocks converge
    const glowStart = 800;
    const textStart = 1400;
    const startTime = performance.now();

    // Particles for sparkle effect
    const sparkles = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      sparkles.push({ x: worldCX, y: worldCY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 + Math.random() * 0.5, born: convergeEnd + Math.random() * 400, r: 2 + Math.random() * 3 });
    }

    // Temporarily stop normal draw
    if (_flowAnimId) { cancelAnimationFrame(_flowAnimId); _flowAnimId = null; }

    function animDeploy() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const convergeT = Math.min(elapsed / convergeEnd, 1);
      const easeConverge = 1 - Math.pow(1 - convergeT, 3); // ease-out cubic

      // Clear
      ctx.clearRect(0, 0, W, H);

      // Background darkens
      const darkFactor = Math.min(t * 1.5, 1);
      ctx.fillStyle = `rgba(5,8,18,${0.85 + darkFactor * 0.15})`;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(_flowPanX, _flowPanY);
      ctx.scale(_flowZoom, _flowZoom);

      // Move nodes toward center
      _flowNodes.forEach((n, i) => {
        const orig = origPositions[i];
        n.x = orig.x + (worldCX - NODE_W / 2 - orig.x) * easeConverge;
        n.y = orig.y + (worldCY - NODE_H / 2 - orig.y) * easeConverge;
      });

      // Draw edges fading
      const edgeAlpha = Math.max(0, 1 - convergeT * 2);
      if (edgeAlpha > 0) {
        _flowEdges.forEach(edge => {
          const fromNode = getFlowNode(edge.from);
          const toNode = getFlowNode(edge.to);
          if (!fromNode || !toNode) return;
          const from = getPortPos(fromNode, edge.fromPort);
          const to = getPortPos(toNode, edge.toPort || 'in');
          ctx.strokeStyle = `rgba(100,180,255,${edgeAlpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          const cpOff = Math.max(40, Math.abs(to.x - from.x) * 0.3);
          ctx.bezierCurveTo(from.x + cpOff, from.y, to.x - cpOff, to.y, to.x, to.y);
          ctx.stroke();
        });
      }

      // Draw nodes shrinking & fading
      const nodeAlpha = Math.max(0, 1 - Math.pow(convergeT, 2));
      const nodeScale = 1 - convergeT * 0.7;
      if (nodeAlpha > 0.01) {
        _flowNodes.forEach(n => {
          ctx.save();
          ctx.globalAlpha = nodeAlpha;
          ctx.translate(n.x + NODE_W / 2, n.y + NODE_H / 2);
          ctx.scale(nodeScale, nodeScale);
          ctx.fillStyle = n.def.color + '40';
          ctx.beginPath();
          ctx.roundRect(-NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 12);
          ctx.fill();
          ctx.strokeStyle = n.def.color + '88';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Icon
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(n.def.icon, 0, 0);
          ctx.restore();
        });
      }

      // Central brain glow
      if (elapsed > glowStart) {
        const glowT = Math.min((elapsed - glowStart) / 800, 1);
        const glowEase = 1 - Math.pow(1 - glowT, 2);
        const glowR = 20 + glowEase * 50;
        const pulse = Math.sin(elapsed / 150) * 5;

        // Outer glow rings
        for (let ring = 3; ring > 0; ring--) {
          ctx.beginPath();
          ctx.arc(worldCX, worldCY, glowR + ring * 15 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,136,204,${0.03 * glowEase * ring})`;
          ctx.fill();
        }

        // Core glow
        const coreGrad = ctx.createRadialGradient(worldCX, worldCY, 0, worldCX, worldCY, glowR);
        coreGrad.addColorStop(0, `rgba(0,200,255,${0.8 * glowEase})`);
        coreGrad.addColorStop(0.5, `rgba(0,136,204,${0.4 * glowEase})`);
        coreGrad.addColorStop(1, `rgba(0,68,136,0)`);
        ctx.beginPath();
        ctx.arc(worldCX, worldCY, glowR, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Brain emoji
        ctx.font = `${28 + glowEase * 16}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = glowEase;
        ctx.fillText('\uD83E\uDDE0', worldCX, worldCY);
        ctx.globalAlpha = 1;
      }

      // Sparkle particles
      sparkles.forEach(s => {
        if (elapsed < s.born) return;
        const age = (elapsed - s.born) / 1000;
        if (age > s.life) return;
        const alpha = 1 - age / s.life;
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.97; s.vy *= 0.97;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,255,${alpha * 0.8})`;
        ctx.shadowColor = '#00aaff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      // Text overlay (screen coords)
      if (elapsed > textStart) {
        const textT = Math.min((elapsed - textStart) / 600, 1);
        const textEase = 1 - Math.pow(1 - textT, 3);
        ctx.save();
        ctx.globalAlpha = textEase;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00aaff';
        ctx.shadowBlur = 20;
        const text = currentLang === 'ru' ? '\uD83E\uDD16 \u0410\u0433\u0435\u043D\u0442 \u0441\u043E\u0437\u0434\u0430\u043D!' : '\uD83E\uDD16 Agent Created!';
        ctx.fillText(text, centerX, centerY + 55);
        ctx.shadowBlur = 0;
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const sub = currentLang === 'ru' ? _flowNodes.length + ' \u0431\u043B\u043E\u043A\u043E\u0432 \u2192 1 \u0430\u0433\u0435\u043D\u0442' : _flowNodes.length + ' blocks \u2192 1 agent';
        ctx.fillText(sub, centerX, centerY + 80);
        ctx.restore();
      }

      if (t < 1) {
        requestAnimationFrame(animDeploy);
      } else {
        // Restore original positions
        _flowNodes.forEach((n, i) => {
          n.x = origPositions[i].x;
          n.y = origPositions[i].y;
        });
        // Restart normal drawing loop
        const _s = performance.now();
        function resumeDraw() {
          const time = (performance.now() - _s) / 1000;
          const ctx2 = _flowCtx;
          ctx2.clearRect(0, 0, W, H);
          // Will be drawn by normal drawFlowBuilder via initFlowBuilder reinit
          _flowAnimId = null;
        }
        // Re-init builder to restart draw loop
        initFlowBuilder();
        resolve();
      }
    }

    animDeploy();
  });
}

function showFlowToast(msg, type) {
  const el = document.createElement('div');
  el.className = 'flow-toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function updateZoomLabel() {
  const el = document.getElementById('flow-zoom-label');
  if (el) el.textContent = Math.round(_flowZoom * 100) + '%';
}

function flowZoomIn() {
  const newZoom = Math.min(3, _flowZoom * 1.2);
  const cx = (_flowCanvas ? _flowCanvas.parentElement.clientWidth : 800) / 2;
  const cy = (_flowCanvas ? _flowCanvas.parentElement.clientHeight : 500) / 2;
  _flowPanX = cx - (cx - _flowPanX) * (newZoom / _flowZoom);
  _flowPanY = cy - (cy - _flowPanY) * (newZoom / _flowZoom);
  _flowZoom = newZoom;
  updateZoomLabel();
}

function flowZoomOut() {
  const newZoom = Math.max(0.2, _flowZoom / 1.2);
  const cx = (_flowCanvas ? _flowCanvas.parentElement.clientWidth : 800) / 2;
  const cy = (_flowCanvas ? _flowCanvas.parentElement.clientHeight : 500) / 2;
  _flowPanX = cx - (cx - _flowPanX) * (newZoom / _flowZoom);
  _flowPanY = cy - (cy - _flowPanY) * (newZoom / _flowZoom);
  _flowZoom = newZoom;
  updateZoomLabel();
}

function flowZoomFit() {
  if (!_flowNodes.length) {
    _flowZoom = 1; _flowPanX = 0; _flowPanY = 0;
    updateZoomLabel();
    return;
  }
  const W = _flowCanvas ? _flowCanvas.parentElement.clientWidth : 800;
  const H = _flowCanvas ? _flowCanvas.parentElement.clientHeight : 500;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  _flowNodes.forEach(n => {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H);
  });
  const pad = 60;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;
  _flowZoom = Math.min(1.5, Math.min(W / bw, H / bh));
  _flowPanX = (W - bw * _flowZoom) / 2 - minX * _flowZoom + pad * _flowZoom;
  _flowPanY = (H - bh * _flowZoom) / 2 - minY * _flowZoom + pad * _flowZoom;
  updateZoomLabel();
}

function flowZoomReset() {
  _flowZoom = 1; _flowPanX = 0; _flowPanY = 0;
  updateZoomLabel();
}

// Canvas rendering & interaction
function initFlowBuilder() {
  buildFlowPalette();
  // Push initial empty state for undo
  if (!_flowHistory.length) flowPushState();
  const canvas = document.getElementById('flow-canvas');
  if (!canvas) return;
  _flowCanvas = canvas;
  _flowCtx = canvas.getContext('2d');

  // Size canvas
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = wrap.clientWidth * dpr;
  canvas.height = wrap.clientHeight * dpr;
  canvas.style.width = wrap.clientWidth + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
  _flowCtx.scale(dpr, dpr);

  const W = wrap.clientWidth, H = wrap.clientHeight;

  // Helper: screen coords → world coords (accounting for zoom/pan)
  function screenToWorld(sx, sy) {
    return { x: (sx - _flowPanX) / _flowZoom, y: (sy - _flowPanY) / _flowZoom };
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const { x: mx, y: my } = screenToWorld(sx, sy);
    _flowMouse.x = mx; _flowMouse.y = my;

    // Middle-click or space+click → pan
    if (e.button === 1 || _flowSpaceHeld) {
      _flowPanning = true;
      _flowPanStart = { x: e.clientX - _flowPanX, y: e.clientY - _flowPanY };
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Check port click first
    for (const n of _flowNodes) {
      const port = hitTestPort(n, mx, my);
      if (port && port !== 'in') {
        _flowConnecting = { fromId: n.id, fromPort: port, mx, my };
        return;
      }
    }

    // Check node click
    const node = hitTestNode(mx, my);
    if (node) {
      if (e.shiftKey) {
        // Multi-select toggle
        if (_flowMultiSelected.has(node.id)) _flowMultiSelected.delete(node.id);
        else _flowMultiSelected.add(node.id);
      } else {
        _flowMultiSelected.clear();
      }
      _flowSelectedId = node.id;
      _flowDragNode = node;
      _flowDragOffset.dx = mx - node.x;
      _flowDragOffset.dy = my - node.y;
      renderFlowConfig();
      canvas.classList.add('dragging');
    } else {
      _flowSelectedId = null;
      _flowMultiSelected.clear();
      renderFlowConfig();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    // Pan mode
    if (_flowPanning) {
      _flowPanX = e.clientX - _flowPanStart.x;
      _flowPanY = e.clientY - _flowPanStart.y;
      return;
    }

    const { x: mx, y: my } = screenToWorld(sx, sy);
    _flowMouse.x = mx; _flowMouse.y = my;

    if (_flowDragNode) {
      _flowDragNode.x = mx - _flowDragOffset.dx;
      _flowDragNode.y = my - _flowDragOffset.dy;
    }
    if (_flowConnecting) {
      _flowConnecting.mx = mx;
      _flowConnecting.my = my;
      // Magnetic snap — find nearest input port within 25px
      _flowConnecting.snapTarget = null;
      let minDist = 25;
      for (const n of _flowNodes) {
        if (n.id === _flowConnecting.fromId) continue;
        const inPos = getPortPos(n, 'in');
        const dx = mx - inPos.x, dy = my - inPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          _flowConnecting.snapTarget = { nodeId: n.id, port: 'in', x: inPos.x, y: inPos.y };
        }
      }
      // Snap cursor to target port
      if (_flowConnecting.snapTarget) {
        _flowConnecting.mx = _flowConnecting.snapTarget.x;
        _flowConnecting.my = _flowConnecting.snapTarget.y;
      }
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    // End pan
    if (_flowPanning) {
      _flowPanning = false;
      canvas.style.cursor = _flowSpaceHeld ? 'grab' : 'default';
      return;
    }

    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const { x: mx, y: my } = screenToWorld(sx, sy);

    if (_flowConnecting) {
      let connected = false;
      // Use snap target if available
      if (_flowConnecting.snapTarget) {
        const targetId = _flowConnecting.snapTarget.nodeId;
        const exists = _flowEdges.some(e => e.from === _flowConnecting.fromId && e.fromPort === _flowConnecting.fromPort && e.to === targetId);
        if (!exists) {
          _flowEdges.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: targetId, toPort: 'in' });
          _flowParticles.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: targetId, t: 0, speed: 0.004 + Math.random() * 0.004 });
        }
        connected = true;
      }
      // Fallback: hitTest (using world coords)
      if (!connected) {
        for (const n of _flowNodes) {
          if (n.id === _flowConnecting.fromId) continue;
          const port = hitTestPort(n, mx, my);
          if (port === 'in') {
            const exists = _flowEdges.some(e => e.from === _flowConnecting.fromId && e.fromPort === _flowConnecting.fromPort && e.to === n.id);
            if (!exists) {
              _flowEdges.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: n.id, toPort: 'in' });
              _flowParticles.push({ from: _flowConnecting.fromId, fromPort: _flowConnecting.fromPort, to: n.id, t: 0, speed: 0.004 + Math.random() * 0.004 });
              connected = true;
            }
            break;
          }
        }
      }
      if (connected) flowPushState();
      _flowConnecting = null;
    }
    if (_flowDragNode) {
      // Snap to grid (30px)
      _flowDragNode.x = Math.round(_flowDragNode.x / 30) * 30;
      _flowDragNode.y = Math.round(_flowDragNode.y / 30) * 30;
      flowPushState();
    }
    _flowDragNode = null;
    canvas.classList.remove('dragging');
  });

  canvas.addEventListener('mouseleave', () => {
    _flowDragNode = null;
    _flowConnecting = null;
    _flowPanning = false;
    canvas.classList.remove('dragging');
  });

  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3, Math.max(0.2, _flowZoom * zoomFactor));
    // Zoom toward mouse position
    _flowPanX = sx - (sx - _flowPanX) * (newZoom / _flowZoom);
    _flowPanY = sy - (sy - _flowPanY) * (newZoom / _flowZoom);
    _flowZoom = newZoom;
    updateZoomLabel();
  }, { passive: false });

  // Delete / Undo / Redo / Space keys
  window.addEventListener('keydown', (e) => {
    // Only respond when flow tab is active
    const flowPage = document.querySelector('[data-page="builder"]');
    const isFlowActive = flowPage && !flowPage.classList.contains('hidden');
    if (!isFlowActive) return;

    // Space key for pan mode
    if (e.code === 'Space' && document.activeElement === document.body) {
      e.preventDefault();
      _flowSpaceHeld = true;
      canvas.style.cursor = 'grab';
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      flowUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
      e.preventDefault();
      flowRedo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && _flowSelectedId && document.activeElement === document.body) {
      deleteFlowNode(_flowSelectedId);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      _flowSpaceHeld = false;
      if (!_flowPanning) canvas.style.cursor = 'default';
    }
  });

  // Start animation
  if (_flowAnimId) cancelAnimationFrame(_flowAnimId);
  let _flowStartTime = performance.now();

  function drawFlowBuilder() {
    const time = (performance.now() - _flowStartTime) / 1000;
    const ctx = _flowCtx;
    ctx.clearRect(0, 0, W, H);

    // Background (no transform — fills entire canvas)
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    bg.addColorStop(0, '#0d1526');
    bg.addColorStop(1, '#070b14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Apply zoom & pan transform
    ctx.save();
    ctx.translate(_flowPanX, _flowPanY);
    ctx.scale(_flowZoom, _flowZoom);

    // Grid (infinite feel: compute visible area in world coords)
    const gridStep = 30;
    const visMinX = -_flowPanX / _flowZoom;
    const visMinY = -_flowPanY / _flowZoom;
    const visMaxX = (W - _flowPanX) / _flowZoom;
    const visMaxY = (H - _flowPanY) / _flowZoom;
    const gx0 = Math.floor(visMinX / gridStep) * gridStep;
    const gy0 = Math.floor(visMinY / gridStep) * gridStep;

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1 / _flowZoom;
    for (let x = gx0; x < visMaxX; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, visMinY); ctx.lineTo(x, visMaxY); ctx.stroke(); }
    for (let y = gy0; y < visMaxY; y += gridStep) { ctx.beginPath(); ctx.moveTo(visMinX, y); ctx.lineTo(visMaxX, y); ctx.stroke(); }

    // Grid dots at intersections
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = gx0; x < visMaxX; x += gridStep) {
      for (let y = gy0; y < visMaxY; y += gridStep) {
        ctx.beginPath(); ctx.arc(x, y, 1 / _flowZoom, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Draw edges (bezier curves)
    _flowEdges.forEach((edge, idx) => {
      const fromNode = getFlowNode(edge.from);
      const toNode = getFlowNode(edge.to);
      if (!fromNode || !toNode) return;
      const from = getPortPos(fromNode, edge.fromPort);
      const to = getPortPos(toNode, edge.toPort);
      const isBackward = to.x < from.x - 20;

      // Edge glow
      ctx.save();
      ctx.shadowColor = fromNode.def.color;
      ctx.shadowBlur = 4;
      const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      grad.addColorStop(0, fromNode.def.color + 'aa');
      grad.addColorStop(1, toNode.def.color + 'aa');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      if (isBackward) {
        // Backward edge: curve below nodes
        const midY = Math.max(from.y, to.y) + 80;
        ctx.bezierCurveTo(from.x + 40, midY, to.x - 40, midY, to.x, to.y);
      } else {
        const cpOff = Math.max(60, Math.abs(to.x - from.x) * 0.4);
        ctx.bezierCurveTo(from.x + cpOff, from.y, to.x - cpOff, to.y, to.x, to.y);
      }
      ctx.stroke();
      ctx.restore();

      // Arrow head
      const ah_cpOff = isBackward ? -40 : Math.max(60, Math.abs(to.x - from.x) * 0.4);
      const angle = Math.atan2(to.y - (to.y - 1), to.x - (to.x - ah_cpOff * 0.2));
      ctx.fillStyle = toNode.def.color + 'cc';
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - 8 * Math.cos(angle - 0.4), to.y - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(to.x - 8 * Math.cos(angle + 0.4), to.y - 8 * Math.sin(angle + 0.4));
      ctx.fill();
    });

    // Edge particles
    _flowParticles.forEach(p => {
      const fromNode = getFlowNode(p.from);
      const toNode = getFlowNode(p.to);
      if (!fromNode || !toNode) return;
      const from = getPortPos(fromNode, p.fromPort);
      const to = getPortPos(toNode, 'in');
      const cpOff = Math.max(60, Math.abs(to.x - from.x) * 0.4);
      p.t = (p.t + p.speed) % 1;
      const tt = p.t;
      // Bezier interpolation
      const it = 1 - tt;
      const px = it*it*it*from.x + 3*it*it*tt*(from.x+cpOff) + 3*it*tt*tt*(to.x-cpOff) + tt*tt*tt*to.x;
      const py = it*it*it*from.y + 3*it*it*tt*from.y + 3*it*tt*tt*to.y + tt*tt*tt*to.y;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = fromNode.def.color;
      ctx.shadowColor = fromNode.def.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Connecting line (while dragging from port)
    if (_flowConnecting) {
      const fromNode = getFlowNode(_flowConnecting.fromId);
      if (fromNode) {
        const from = getPortPos(fromNode, _flowConnecting.fromPort);
        const targetX = _flowConnecting.mx, targetY = _flowConnecting.my;
        const cpOff = Math.max(40, Math.abs(targetX - from.x) * 0.4);
        const isSnapped = !!_flowConnecting.snapTarget;

        // Line style changes when snapped
        if (isSnapped) {
          ctx.setLineDash([]);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
        } else {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = fromNode.def.color + '99';
          ctx.lineWidth = 2;
        }
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(from.x + cpOff, from.y, targetX - cpOff, targetY, targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Green glow on snap target port
        if (isSnapped) {
          const snap = _flowConnecting.snapTarget;
          const pulse = Math.sin(time * 6) * 3 + 10;
          ctx.save();
          ctx.beginPath();
          ctx.arc(snap.x, snap.y, PORT_R + pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16,185,129,' + (0.15 + Math.sin(time * 6) * 0.1) + ')';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(snap.x, snap.y, PORT_R + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw groups (dashed rectangles around grouped nodes)
    _flowGroups.forEach(g => {
      const gNodes = g.nodeIds.map(id => getFlowNode(id)).filter(Boolean);
      if (!gNodes.length) return;
      if (g.collapsed) {
        // Collapsed: single large block
        const avgX = gNodes.reduce((s, n) => s + n.x, 0) / gNodes.length;
        const avgY = gNodes.reduce((s, n) => s + n.y, 0) / gNodes.length;
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#64748b88';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(100,116,139,0.08)';
        const gw = 200, gh = 70;
        ctx.beginPath();
        ctx.roundRect(avgX - 10, avgY - 7, gw, gh, 12);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('\uD83D\uDCE6 ' + g.name, avgX - 10 + gw / 2, avgY - 7 + gh / 2 + 4);
        ctx.textAlign = 'left';
        ctx.restore();
      } else {
        // Expanded: dashed rect around all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        gNodes.forEach(n => {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H);
        });
        const pad = 12;
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#64748b66';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(100,116,139,0.04)';
        ctx.beginPath();
        ctx.roundRect(minX - pad, minY - pad - 18, maxX - minX + pad * 2, maxY - minY + pad * 2 + 18, 10);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('\uD83D\uDCE6 ' + g.name, minX - pad + 6, minY - pad - 4);
        ctx.restore();
      }
    });

    // Draw nodes
    _flowNodes.forEach(n => {
      const selected = n.id === _flowSelectedId;
      const def = n.def;

      // Node shadow & glow
      if (selected) {
        ctx.save();
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 20;
      }

      // Node body
      const r = 12;
      ctx.beginPath();
      ctx.moveTo(n.x + r, n.y);
      ctx.lineTo(n.x + NODE_W - r, n.y);
      ctx.quadraticCurveTo(n.x + NODE_W, n.y, n.x + NODE_W, n.y + r);
      ctx.lineTo(n.x + NODE_W, n.y + NODE_H - r);
      ctx.quadraticCurveTo(n.x + NODE_W, n.y + NODE_H, n.x + NODE_W - r, n.y + NODE_H);
      ctx.lineTo(n.x + r, n.y + NODE_H);
      ctx.quadraticCurveTo(n.x, n.y + NODE_H, n.x, n.y + NODE_H - r);
      ctx.lineTo(n.x, n.y + r);
      ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
      ctx.closePath();

      // Fill
      ctx.fillStyle = selected ? 'rgba(20,30,50,0.95)' : 'rgba(15,22,40,0.9)';
      ctx.fill();

      // Border
      const isMulti = _flowMultiSelected.has(n.id);
      if (isMulti) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = selected ? def.color : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = selected ? 2 : 1;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (selected) ctx.restore();

      // Left color bar
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(n.x + r, n.y);
      ctx.lineTo(n.x + 4, n.y);
      ctx.quadraticCurveTo(n.x, n.y, n.x, n.y + r);
      ctx.lineTo(n.x, n.y + NODE_H - r);
      ctx.quadraticCurveTo(n.x, n.y + NODE_H, n.x + 4, n.y + NODE_H);
      ctx.lineTo(n.x + r, n.y + NODE_H);
      ctx.lineTo(n.x + r, n.y);
      ctx.closePath();
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Icon
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, n.x + 18, n.y + NODE_H / 2 - 6);

      // Label (localized)
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = '#fff';
      const nodeLabel = (currentLang === 'ru' && def.labelRu) ? def.labelRu : def.label;
      ctx.fillText(nodeLabel, n.x + 40, n.y + NODE_H / 2 - 6);

      // Subtitle (config summary or description)
      const cfgKeys = Object.keys(n.config).filter(k => n.config[k]);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      if (cfgKeys.length) {
        const summary = cfgKeys.map(k => n.config[k]).join(', ').slice(0, 22);
        ctx.fillText(summary, n.x + 40, n.y + NODE_H / 2 + 8);
      } else {
        const nodeDesc = (currentLang === 'ru' && def.descRu) ? def.descRu : (def.desc || '');
        if (nodeDesc) ctx.fillText(nodeDesc.slice(0, 24), n.x + 40, n.y + NODE_H / 2 + 8);
      }

      // Input port with hover glow
      const inP = getPortPos(n, 'in');
      const inDx = _flowMouse.x - inP.x, inDy = _flowMouse.y - inP.y;
      const inDist = Math.sqrt(inDx * inDx + inDy * inDy);
      if (inDist < 30) {
        const glow = (1 - inDist / 30) * 0.3;
        ctx.beginPath();
        ctx.arc(inP.x, inP.y, PORT_R + 6, 0, Math.PI * 2);
        ctx.fillStyle = def.color.slice(0, 7) + Math.round(glow * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(inP.x, inP.y, PORT_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,22,40,0.9)';
      ctx.fill();
      ctx.strokeStyle = def.color + '88';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Output ports
      const outPorts = def.extraPorts || ['out'];
      outPorts.forEach((p, pi) => {
        const pos = getPortPos(n, p);
        const pulse = Math.sin(time * 3 + pi) * 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PORT_R + pulse, 0, Math.PI * 2);
        ctx.fillStyle = def.color + '40';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PORT_R, 0, Math.PI * 2);
        ctx.fillStyle = def.color;
        ctx.fill();
        // Port labels for condition and loop
        if (p === 'true' || p === 'false' || p === 'loop' || p === 'done') {
          ctx.font = '9px Inter, sans-serif';
          const portColors = { 'true': '#10b981', 'false': '#ef4444', 'loop': '#f59e0b', 'done': '#10b981' };
          ctx.fillStyle = portColors[p] || '#fff';
          ctx.textAlign = 'right';
          ctx.fillText(p, pos.x - 10, pos.y + 3);
          ctx.textAlign = 'left';
        }
      });
    });

    // End zoom/pan transform
    ctx.restore();

    // Empty state (drawn in screen coords, centered)
    if (!_flowNodes.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(currentLang === 'ru' ? '\u2190 \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043D\u043E\u0434\u044B \u0438\u0437 \u043F\u0430\u043B\u0438\u0442\u0440\u044B' : '\u2190 Add nodes from the palette', W / 2, H / 2 - 10);
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillText(currentLang === 'ru' ? '\u0421\u043E\u0435\u0434\u0438\u043D\u044F\u0439\u0442\u0435 \u043F\u043E\u0440\u0442\u044B \u0434\u043B\u044F \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F flow' : 'Connect ports to build your flow', W / 2, H / 2 + 16);
    }

    // Zoom badge (screen coords, bottom-right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(Math.round(_flowZoom * 100) + '%', W - 12, H - 10);
    ctx.textAlign = 'left';

    _flowAnimId = requestAnimationFrame(drawFlowBuilder);
  }

  drawFlowBuilder();
  switchLang(currentLang);
}

// ===== AGENT NETWORK MAP (Neural Canvas) =====
let _networkAnimId = null;
let _networkNodes = [];
let _networkDragNode = null;
let _networkDragOffset = { dx: 0, dy: 0 };
let _networkMouse = { x: 0, y: 0 };

async function loadNetworkMap() {
  const canvas = document.getElementById('agent-network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set canvas size (with DPR for crisp rendering)
  const rect = canvas.parentElement.getBoundingClientRect();
  const _netDpr = window.devicePixelRatio || 1;
  const _netW = rect.width || 900, _netH = 500;
  canvas.width = _netW * _netDpr;
  canvas.height = _netH * _netDpr;
  canvas.style.width = _netW + 'px';
  canvas.style.height = _netH + 'px';
  ctx.scale(_netDpr, _netDpr);

  const data = await apiRequest('GET', '/api/agents');
  const agents = (data.ok ? data.agents : []) || [];

  if (!agents.length) {
    ctx.fillStyle = '#555';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No agents yet. Create one in the bot!', _netW / 2, _netH / 2);
    return;
  }

  // Build nodes
  _networkNodes = agents.map((a, i) => {
    const role = a.role || 'worker';
    const level = a.level || 1;
    const radius = role === 'director' ? 28 + level : role === 'manager' ? 22 + level : 16 + Math.min(level, 5);
    const color = role === 'director' ? '#ffd700' : a.isActive ? '#00ff88' : '#555';
    const emoji = role === 'director' ? '\u{1F9E0}' : role === 'manager' ? '\u{1F4CA}' : '\u{1F916}';
    return {
      id: a.id, name: a.name || 'Agent #' + a.id,
      role, level, xp: a.xp || 0,
      isActive: a.isActive,
      x: _netW / 2 + (Math.cos(i * 2.4) * 150) + (Math.random() - 0.5) * 80,
      y: _netH / 2 + (Math.sin(i * 2.4) * 120) + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0,
      radius, color, emoji,
    };
  });

  // Build edges: director → all workers, managers → nearby workers
  const edges = [];
  const directors = _networkNodes.filter(n => n.role === 'director');
  const managers = _networkNodes.filter(n => n.role === 'manager');
  const workers = _networkNodes.filter(n => n.role === 'worker');

  directors.forEach(d => {
    _networkNodes.forEach(n => {
      if (n.id !== d.id) edges.push({ from: d, to: n });
    });
  });
  managers.forEach(m => {
    workers.forEach(w => edges.push({ from: m, to: w }));
  });
  // If no directors/managers, connect all agents in chain
  if (!directors.length && !managers.length && _networkNodes.length > 1) {
    for (let i = 0; i < _networkNodes.length - 1; i++) {
      edges.push({ from: _networkNodes[i], to: _networkNodes[i + 1] });
    }
  }

  // Stars background
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * _netW,
    y: Math.random() * _netH,
    r: Math.random() * 1.2,
    a: Math.random() * 0.5 + 0.1,
  }));

  // Particles on edges
  const particles = edges.map(() => ({ t: Math.random(), speed: 0.003 + Math.random() * 0.005 }));

  // Tooltip
  const tooltip = document.getElementById('network-tooltip');

  // Mouse interaction
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    _networkMouse.x = e.clientX - r.left;
    _networkMouse.y = e.clientY - r.top;

    if (_networkDragNode) {
      _networkDragNode.x = _networkMouse.x - _networkDragOffset.dx;
      _networkDragNode.y = _networkMouse.y - _networkDragOffset.dy;
      _networkDragNode.vx = 0;
      _networkDragNode.vy = 0;
    }

    // Tooltip hover
    let hovered = null;
    for (const n of _networkNodes) {
      const dx = _networkMouse.x - n.x, dy = _networkMouse.y - n.y;
      if (dx * dx + dy * dy < n.radius * n.radius) { hovered = n; break; }
    }
    if (hovered && tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
      tooltip.innerHTML = `<b>${escHtml(hovered.name)}</b><br>` +
        `Role: ${hovered.role} | Lv.${hovered.level}<br>` +
        `XP: ${hovered.xp} | ${hovered.isActive ? '🟢 Active' : '⏸ Paused'}`;
    } else if (tooltip) {
      tooltip.style.display = 'none';
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    _networkMouse.x = e.clientX - r.left;
    _networkMouse.y = e.clientY - r.top;
    for (const n of _networkNodes) {
      const dx = _networkMouse.x - n.x, dy = _networkMouse.y - n.y;
      if (dx * dx + dy * dy < n.radius * n.radius) {
        _networkDragNode = n;
        _networkDragOffset.dx = dx;
        _networkDragOffset.dy = dy;
        break;
      }
    }
  });
  canvas.addEventListener('mouseup', () => { _networkDragNode = null; _networkDragOffset.dx = 0; _networkDragOffset.dy = 0; });
  canvas.addEventListener('mouseleave', () => {
    _networkDragNode = null;
    _networkDragOffset.dx = 0; _networkDragOffset.dy = 0;
    if (tooltip) tooltip.style.display = 'none';
  });

  // Animation loop
  let time = 0;
  if (_networkAnimId) cancelAnimationFrame(_networkAnimId);

  function animate() {
    time += 0.016;
    const W = _netW, H = _netH;
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W/2);
    bg.addColorStop(0, '#0d1526');
    bg.addColorStop(1, '#070b14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Stars
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a + Math.sin(time * 2 + s.x) * 0.1})`;
      ctx.fill();
    });

    // Force-directed physics
    const k = 8000;
    for (let i = 0; i < _networkNodes.length; i++) {
      for (let j = i + 1; j < _networkNodes.length; j++) {
        const a = _networkNodes[i], b = _networkNodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = k / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    edges.forEach(e => {
      const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const spring = 0.005;
      const target = 120;
      const force = (dist - target) * spring;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      e.from.vx += fx; e.from.vy += fy;
      e.to.vx -= fx; e.to.vy -= fy;
    });
    _networkNodes.forEach(n => {
      if (n === _networkDragNode) return;
      n.vx *= 0.92; n.vy *= 0.92;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.radius, Math.min(_netW - n.radius, n.x));
      n.y = Math.max(n.radius, Math.min(_netH - n.radius, n.y));
    });

    // Draw edges
    edges.forEach((e, idx) => {
      const grad = ctx.createLinearGradient(e.from.x, e.from.y, e.to.x, e.to.y);
      grad.addColorStop(0, e.from.color + '60');
      grad.addColorStop(1, e.to.color + '60');
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      ctx.lineTo(e.to.x, e.to.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Particle
      const p = particles[idx];
      p.t = (p.t + p.speed) % 1;
      const px = e.from.x + (e.to.x - e.from.x) * p.t;
      const py = e.from.y + (e.to.y - e.from.y) * p.t;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = e.from.color;
      ctx.fill();
    });

    // Draw nodes
    _networkNodes.forEach(n => {
      const pulse = n.isActive ? Math.sin(time * 3 + n.id) * 3 : 0;
      const r = n.radius + pulse;

      // Glow
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2);
      glow.addColorStop(0, n.color + '40');
      glow.addColorStop(1, n.color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color + '30';
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Emoji
      ctx.font = `${Math.max(12, r * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.emoji, n.x, n.y);

      // Name below
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(n.name.slice(0, 15), n.x, n.y + r + 12);

      // Level badge
      if (n.level > 1) {
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = n.color;
        ctx.fillText('Lv.' + n.level, n.x, n.y - r - 6);
      }
    });

    _networkAnimId = requestAnimationFrame(animate);
  }

  animate();
}

console.log('TON Agent Platform Dashboard v2.0 loaded successfully!');
