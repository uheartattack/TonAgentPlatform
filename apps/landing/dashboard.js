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
  document.querySelectorAll(`[data-placeholder-${lang}]`).forEach(el => {
    el.placeholder = el.dataset[`placeholder${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
  });
}

// Initialize language
switchLang(currentLang);

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

// Called by Telegram Login Widget
async function onTelegramAuth(user) {
  // Verify with our server (HMAC-SHA256)
  const data = await apiRequest('POST', '/api/auth/telegram', user);
  if (!data.ok) {
    alert('Auth failed: ' + (data.error || 'Unknown error'));
    return;
  }
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
  // Active agents
  const sessEl = document.getElementById('sessions-value');
  if (sessEl) sessEl.textContent = data.agentsActive || 0;
  // Installed plugins
  const toolsEl = document.getElementById('tools-value');
  if (toolsEl) toolsEl.textContent = data.pluginsInstalled || data.pluginsTotal || 12;
  // Total runs
  const runsEl = document.getElementById('runs-value');
  if (runsEl) runsEl.textContent = data.totalRuns || 0;
  // Success rate
  const rateEl = document.getElementById('success-rate-value');
  if (rateEl) rateEl.textContent = (data.successRate != null ? data.successRate : 100) + '%';
  // Last 24h
  const h24El = document.getElementById('last24h-value');
  if (h24El) h24El.textContent = data.last24hRuns || 0;
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
    agentsEl.innerHTML = '<div class="empty-state">⚠️ Failed to load agents. Make sure the bot server is running.</div>';
    return;
  }
  const agents = data.agents || [];
  if (!agents.length) {
    const botLink = (window._appConfig && window._appConfig.botLink) || 'https://t.me/TonAgentPlatformBot';
    agentsEl.innerHTML = `
      <div class="empty-state">
        <p>No agents yet.</p>
        <a href="${escHtml(botLink)}" target="_blank" class="btn btn-primary btn-sm">
          Create your first agent →
        </a>
      </div>`;
    return;
  }

  agentsEl.innerHTML = agents.map(a => `
    <div class="agent-card" data-id="${a.id}">
      <div class="agent-status ${a.isActive ? 'active' : 'paused'}">
        <span class="status-dot"></span>
        <span>${a.isActive ? 'Active' : 'Paused'}</span>
      </div>
      <div class="agent-info">
        <strong>#${a.id} ${escHtml(a.name || 'Unnamed')}</strong>
        <span class="agent-desc">${escHtml((a.description || '').slice(0, 80))}</span>
        <span class="agent-trigger">${a.triggerType === 'scheduled' ? '⏰ Scheduled' : a.triggerType === 'webhook' ? '🔗 Webhook' : '▶️ Manual'}</span>
      </div>
      <div class="agent-actions">
        <button class="btn btn-sm ${a.isActive ? 'btn-warning' : 'btn-success'}" onclick="toggleAgent(${a.id}, ${a.isActive})">
          ${a.isActive ? '⏸ Stop' : '🚀 Run'}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="loadAgentLogs(${a.id})">📋 Logs</button>
      </div>
    </div>
  `).join('');
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

async function loadAgentLogs(agentId) {
  const data = await apiRequest('GET', `/api/agents/${agentId}/logs?limit=15`);
  if (!data.ok) { alert('Failed to load logs'); return; }
  const logs = data.logs || [];
  const text = logs.length
    ? logs.map(l => {
        const ts = l.timestamp || l.createdAt;
        const time = ts ? new Date(ts).toLocaleTimeString() : '--:--:--';
        return `[${time}] ${(l.level || 'info').toUpperCase()}: ${l.message}`;
      }).join('\n')
    : 'No logs yet.';
  alert(`Logs for agent #${agentId}:\n\n${text}`);
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
// Strategy:
//   HTTP (localhost/dev) → bot-deeplink auth immediately (widget needs HTTPS)
//   HTTPS (production)   → Telegram Login Widget first, bot-auth as fallback
async function initAuth() {
  // 1. Fetch platform config
  try {
    const cfg = await fetch(API_BASE + '/api/config').then(r => r.json());
    if (cfg && cfg.ok) window._appConfig = cfg;
  } catch (_) {}

  const isHttps = window.location.protocol === 'https:';

  if (!isHttps) {
    // Localhost / HTTP: widget won't work → go straight to bot-auth button
    showBotAuthButton();
    return;
  }

  // HTTPS: try Telegram Login Widget
  const botUsername = (window._appConfig && window._appConfig.botUsername) || 'TonAgentPlatformBot';
  const container = document.getElementById('tg-widget-container');
  if (!container) return;

  container.innerHTML = ''; // clear "Loading..." placeholder
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '8');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  script.setAttribute('data-request-access', 'write');
  container.appendChild(script);

  // After 3s: if widget iframe didn't load (domain not registered in BotFather)
  // fall back to bot-auth button
  setTimeout(() => {
    const iframe = document.querySelector('#tg-widget-container iframe');
    if (!iframe) showBotAuthButton();
  }, 3000);
}

// Check if already logged in (token in localStorage)
async function checkExistingSession() {
  if (!authToken) {
    // No stored session — init widget and let user log in
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
        Войти через Telegram
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
    container.innerHTML = `<div style="text-align:center;padding:16px 0;color:var(--text-secondary);font-size:.875rem;">⏳ Подключаюсь к серверу...</div>`;
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
  window.open(data.botLink, '_blank');

  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:2rem;margin-bottom:8px;">📱</div>
        <p style="color:var(--text-secondary);font-size:.875rem;margin-bottom:4px;font-weight:500;">Ожидаю подтверждения в Telegram...</p>
        <p style="color:var(--text-muted);font-size:.75rem;margin-bottom:16px;">Нажмите /start в боте — он откроется автоматически</p>
        <a href="${escHtml(data.botLink)}" target="_blank"
           style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:rgba(33,150,243,.15);color:#2196F3;border:1px solid rgba(33,150,243,.3);border-radius:6px;font-size:.8125rem;text-decoration:none;margin-bottom:10px;">
          🤖 Открыть бота снова
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
  analytics: () => loadAnalytics(),
  persona:   () => loadPersona(),
  knowledge: () => loadKnowledge(),
  connectors:() => loadConnectors(),
  profile:   () => loadProfile(),
};

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

function initCapabilities() {
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
  }
}

function toggleCapabilityEnabled(id, enabled) {
  const cap = capabilitiesData.find(c => c.id === id);
  if (cap) {
    cap.enabled = enabled;
    renderCapabilities();
  }
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
      showNotification(data.error || 'Install failed', 'error');
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
      showNotification(data.error || 'Uninstall failed', 'error');
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
    showNotification(currentLang === 'ru' ? 'Войдите для сохранения' : 'Log in first', 'error');
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
    showNotification(currentLang === 'ru' ? 'Конфигурация сохранена' : 'Configuration saved', 'success');
  } else {
    showNotification(data.error || 'Error saving config', 'error');
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
  
  // Simulate random activity
  const activityMessages = [
    { en: 'Processing user query', ru: 'Обработка запроса пользователя', type: 'info' },
    { en: 'Tool executed: get_balance', ru: 'Выполнен инструмент: get_balance', type: 'success' },
    { en: 'API call completed in 245ms', ru: 'API вызов выполнен за 245мс', type: 'info' },
    { en: 'Memory updated: 2 entries', ru: 'Память обновлена: 2 записи', type: 'info' },
    { en: 'Webhook received from Telegram', ru: 'Получен вебхук от Telegram', type: 'info' },
    { en: 'Transaction signed via TON Connect', ru: 'Транзакция подписана через TON Connect', type: 'success' },
    { en: 'Rate limit check passed', ru: 'Проверка лимита запросов пройдена', type: 'info' },
    { en: 'Context window optimized', ru: 'Контекстное окно оптимизировано', type: 'info' },
  ];
  
  setInterval(() => {
    if (Math.random() > 0.6) {
      const msg = activityMessages[Math.floor(Math.random() * activityMessages.length)];
      addActivity(msg.en, msg.ru, msg.type);
    }
  }, 5000);
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
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

async function saveSettings() {
  if (!authToken) {
    showNotification(currentLang === 'ru' ? 'Войдите чтобы сохранить настройки' : 'Log in to save settings', 'error');
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
    showNotification(currentLang === 'ru' ? 'Настройки сохранены' : 'Settings saved', 'success');
  } else {
    showNotification(data.error || 'Failed to save settings', 'error');
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
    tableEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">No executions yet</div>';
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
    showNotification(currentLang === 'ru' ? 'Войдите для сохранения' : 'Log in first', 'error');
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
    showNotification(currentLang === 'ru' ? 'Персона сохранена' : 'Persona saved', 'success');
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
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">No entries yet. Click "Add Entry" to begin.</div>';
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
  if (!authToken) { showNotification('Log in first', 'error'); return; }
  const title = (document.getElementById('kb-title') || {}).value?.trim();
  const content = (document.getElementById('kb-content') || {}).value?.trim();
  if (!title || !content) {
    showNotification(currentLang === 'ru' ? 'Заполните название и содержимое' : 'Fill title and content', 'error');
    return;
  }

  _knowledgeEntries.push({ title, content, createdAt: new Date().toISOString() });
  const data = await apiRequest('POST', '/api/settings', { settings: { knowledge_base: _knowledgeEntries } });
  if (data.ok) {
    document.getElementById('kb-title').value = '';
    document.getElementById('kb-content').value = '';
    document.getElementById('knowledge-add-form').style.display = 'none';
    renderKnowledge();
    showNotification(currentLang === 'ru' ? 'Запись добавлена' : 'Entry added', 'success');
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
    showNotification(currentLang === 'ru' ? 'Запись удалена' : 'Entry deleted', 'success');
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
    el.textContent = connected ? 'Connected' : 'Disconnected';
    el.className = 'credential-status ' + (connected ? 'active' : '');
  };
  setStatus('discord-status', !!(_connectors.discord && _connectors.discord.webhookUrl));
  setStatus('slack-status', !!(_connectors.slack && _connectors.slack.webhookUrl));
  setStatus('custom-webhook-status', !!(_connectors.custom_webhook && _connectors.custom_webhook.url));

  renderVariables();
}

async function saveConnector(service, config) {
  if (!authToken) { showNotification('Log in first', 'error'); return; }
  const data = await apiRequest('POST', `/api/connectors/${service}`, { config });
  if (data.ok) {
    _connectors[service] = config;
    showNotification(currentLang === 'ru' ? 'Коннектор сохранён' : 'Connector saved', 'success');
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
    showNotification(currentLang === 'ru' ? 'Коннектор удалён' : 'Connector removed', 'success');
    loadConnectors();
  } else {
    showNotification(data.error || 'Error', 'error');
  }
}

async function testConnector(service) {
  if (!authToken) { showNotification('Log in first', 'error'); return; }
  const cfg = _connectors[service] || {};
  const url = cfg.webhookUrl || cfg.url;
  if (!url) { showNotification('Save the connector first', 'error'); return; }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '✅ TON Agent Platform: test connection', username: 'TonAgent' }) });
    if (res.ok) {
      showNotification(currentLang === 'ru' ? 'Тест успешен!' : 'Test succeeded!', 'success');
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
    el.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">No variables yet.</div>';
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
  if (!authToken) { showNotification('Log in first', 'error'); return; }
  const key = (document.getElementById('var-key')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const val = (document.getElementById('var-value')?.value || '').trim();
  if (!key) { showNotification('Variable name required', 'error'); return; }

  _userVars[key] = val;
  const data = await apiRequest('POST', '/api/settings', { settings: { user_variables: _userVars } });
  if (data.ok) {
    document.getElementById('var-key').value = '';
    document.getElementById('var-value').value = '';
    document.getElementById('add-variable-form').style.display = 'none';
    renderVariables();
    showNotification(currentLang === 'ru' ? 'Переменная сохранена' : 'Variable saved', 'success');
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
    showNotification(currentLang === 'ru' ? 'Переменная удалена' : 'Variable deleted', 'success');
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

  // Stats from API
  const stats = await apiRequest('GET', '/api/stats/me');
  if (stats.ok) {
    setEl('profile-total-agents', stats.agentsTotal ?? '—');
    setEl('profile-active-agents', stats.agentsActive ?? '—');
    setEl('profile-total-runs', stats.totalRuns ?? '—');
    setEl('profile-success-rate', stats.successRate != null ? stats.successRate + '%' : '—');
  }
}

console.log('TON Agent Platform Dashboard v2.0 loaded successfully!');
