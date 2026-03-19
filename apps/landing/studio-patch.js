
// ===== STUDIO PATCH: New Features (March 2026) =====
// This file is appended to studio.js to add: Audit Trail, Approvals, Health Metrics,
// Knowledge Base tree, Security section, updated Capabilities (20), Agent Settings providers

// ===== UPDATED CAPABILITIES DATA (20 capabilities) =====
window._patchedCapabilities = [
  { id: 'wallet', name: 'Wallet Manager', nameRu: 'Менеджер кошельков', count: 5, mode: 'Mixed', enabled: true,
    icon: 'wallet', description: 'Manage TON wallets, check balances, send transactions', descriptionRu: 'Управляйте TON кошельками, проверяйте балансы, отправляйте транзакции',
    tools: ['get_ton_balance', 'send_ton', 'create_wallet', 'import_wallet', 'get_transactions'] },
  { id: 'nft', name: 'NFT Collections', nameRu: 'NFT коллекции', count: 4, mode: 'All', enabled: true,
    icon: 'nft_image', description: 'Query NFT data, verify ownership, track floor prices', descriptionRu: 'Данные NFT, проверка владения, отслеживание floor цен',
    tools: ['get_nft_floor', 'get_nft_info', 'verify_ownership', 'transfer_nft'] },
  { id: 'gifts', name: 'Telegram Gifts', nameRu: 'Telegram подарки', count: 4, mode: 'Mixed', enabled: true,
    icon: 'gift', description: 'Gift catalog, appraisal, buy from catalog and resale', descriptionRu: 'Каталог подарков, оценка, покупка из каталога и перепродажа',
    tools: ['get_gift_catalog', 'appraise_gift', 'buy_catalog_gift', 'buy_resale_gift'] },
  { id: 'gifts_market', name: 'Gifts Market', nameRu: 'Рынок подарков', count: 7, mode: 'Mixed', enabled: true,
    icon: 'chart', description: 'Real-time floor prices, arbitrage scanning, market overview', descriptionRu: 'Floor цены в реальном времени, сканирование арбитража, обзор рынка',
    tools: ['get_gift_floor_real', 'scan_real_arbitrage', 'get_market_overview', 'get_price_list', 'get_gift_sales_history', 'get_gift_aggregator', 'get_user_portfolio'],
    needsKey: 'GIFTASSET_API_KEY' },
  { id: 'telegram', name: 'Telegram API', nameRu: 'Telegram API', count: 63, mode: 'Mixed', enabled: true,
    icon: 'phone', description: 'Send messages, media, manage channels via Bot API and MTProto', descriptionRu: 'Отправка сообщений, медиа, управление каналами через Bot API и MTProto',
    tools: ['send_message', 'send_photo', 'send_document', 'get_chat_info', 'forward_message', 'get_fragment_listings'] },
  { id: 'web', name: 'Web Access', nameRu: 'Веб-доступ', count: 2, mode: 'Mixed', enabled: true,
    icon: 'globe', description: 'Web search via DuckDuckGo and fetch URL content', descriptionRu: 'Поиск в интернете через DuckDuckGo и загрузка страниц',
    tools: ['web_search', 'fetch_url'] },
  { id: 'defi', name: 'DeFi Trading', nameRu: 'DeFi трейдинг', count: 5, mode: 'Mixed', enabled: true,
    icon: 'exchange', description: 'DEX swaps via DeDust and STON.fi with smart routing', descriptionRu: 'DEX свапы через DeDust и STON.fi со смарт-роутингом',
    tools: ['defi_swap', 'get_pool_info', 'get_price', 'add_liquidity', 'remove_liquidity'] },
  { id: 'blockchain', name: 'Blockchain Reader', nameRu: 'Чтение блокчейна', count: 3, mode: 'All', enabled: true,
    icon: 'chain_block', description: 'Read TON blockchain state, accounts, transactions', descriptionRu: 'Чтение состояния блокчейна TON, аккаунтов, транзакций',
    tools: ['get_account_info', 'get_transaction', 'get_block'] },
  { id: 'blockchain_analytics', name: 'Blockchain Analytics', nameRu: 'Аналитика блокчейна', count: 4, mode: 'Mixed', enabled: true,
    icon: 'chart_line', description: 'On-chain analytics, whale tracking, token metrics', descriptionRu: 'Ончейн-аналитика, отслеживание китов, метрики токенов',
    tools: ['get_token_metrics', 'track_whale', 'analyze_wallet', 'get_market_data'],
    needsKey: 'TONAPI_KEY' },
  { id: 'plugins', name: 'MCP Plugins', nameRu: 'MCP плагины', count: 1, mode: 'Mixed', enabled: true,
    icon: 'plug', description: 'Call external MCP-compatible plugins and services', descriptionRu: 'Вызов внешних MCP-совместимых плагинов и сервисов',
    tools: ['mcp_call'] },
  { id: 'inter_agent', name: 'Inter-Agent', nameRu: 'Между агентами', count: 2, mode: 'Mixed', enabled: true,
    icon: 'handshake', description: 'Delegate tasks to other agents, cross-agent communication', descriptionRu: 'Делегирование задач другим агентам, межагентная коммуникация',
    tools: ['send_to_agent', 'query_agent'] },
  { id: 'discord', name: 'Discord', nameRu: 'Discord', count: 3, mode: 'None', enabled: false,
    icon: 'chat', description: 'Send messages, manage channels, moderate Discord servers', descriptionRu: 'Отправка сообщений, управление каналами, модерация серверов Discord',
    tools: ['discord_send', 'discord_channel', 'discord_moderate'],
    needsKey: 'DISCORD_BOT_TOKEN' },
  { id: 'x_twitter', name: 'X / Twitter', nameRu: 'X / Twitter', count: 3, mode: 'None', enabled: false,
    icon: 'send', description: 'Post tweets, read timeline, manage X/Twitter account', descriptionRu: 'Публикация твитов, чтение ленты, управление аккаунтом X/Twitter',
    tools: ['x_post', 'x_timeline', 'x_reply'],
    needsKey: 'X_API_KEY' },
  { id: 'media', name: 'Media Generation', nameRu: 'Генерация медиа', count: 2, mode: 'None', enabled: false,
    icon: 'image', description: 'Generate images and video with fal.ai and other providers', descriptionRu: 'Генерация изображений и видео через fal.ai и другие провайдеры',
    tools: ['generate_image', 'generate_video'],
    needsKey: 'FAL_AI_KEY' },
  { id: 'knowledge', name: 'Knowledge Base', nameRu: 'База знаний', count: 4, mode: 'Mixed', enabled: true,
    icon: 'book', description: 'Store and recall structured knowledge, skill trees', descriptionRu: 'Хранение и извлечение структурированных знаний, деревья навыков',
    tools: ['store_knowledge', 'recall_knowledge', 'search_knowledge', 'manage_skills'] },
  { id: 'security', name: 'Security Tools', nameRu: 'Безопасность', count: 3, mode: 'Mixed', enabled: true,
    icon: 'shield', description: 'Pre-transaction scans, address blacklist checks, risk scoring', descriptionRu: 'Пре-транзакционные сканы, проверка черных списков, оценка рисков',
    tools: ['scan_address', 'check_blacklist', 'risk_score'] },
  { id: 'prompts', name: 'Prompt Library', nameRu: 'Библиотека промптов', count: 3, mode: 'Mixed', enabled: true,
    icon: 'lightbulb', description: 'Manage system prompts, templates, and agent instructions', descriptionRu: 'Управление системными промптами, шаблонами и инструкциями',
    tools: ['get_prompt', 'save_prompt', 'list_prompts'] },
  { id: 'ton_mcp', name: 'TON MCP', nameRu: 'TON MCP', count: 2, mode: 'All', enabled: true,
    icon: 'link', description: 'Advanced TON operations via Model Context Protocol', descriptionRu: 'Расширенные операции TON через Model Context Protocol',
    tools: ['ton_mcp', 'ton_mcp_query'] },
  { id: 'state', name: 'State Store', nameRu: 'Хранилище состояния', count: 2, mode: 'Mixed', enabled: true,
    icon: 'database', description: 'Persistent key-value store for agent state', descriptionRu: 'Персистентное хранилище ключ-значение для состояния агента',
    tools: ['get_state', 'set_state'] },
  { id: 'notify', name: 'Notifications', nameRu: 'Уведомления', count: 2, mode: 'Mixed', enabled: true,
    icon: 'bell', description: 'Push notifications to Telegram with rich formatting', descriptionRu: 'Push-уведомления в Telegram с форматированием',
    tools: ['notify', 'notify_rich'] },
];

// Apply patched capabilities
(function() {
  if (typeof capabilitiesData !== 'undefined') {
    capabilitiesData.length = 0;
    window._patchedCapabilities.forEach(function(c) { capabilitiesData.push(c); });
  }
})();

// Capability icon resolver
function capabilityIcon(iconName) {
  if (typeof IC !== 'undefined' && IC[iconName]) return IC[iconName];
  return '';
}

// Override renderCapabilities with icons and needsKey warning
renderCapabilities = function() {
  var container = document.getElementById('capabilities-list');
  if (!container) return;
  var filtered = capabilitiesData.slice();
  if (currentCapabilityFilter === 'active') filtered = filtered.filter(function(c){return c.enabled;});
  else if (currentCapabilityFilter === 'inactive') filtered = filtered.filter(function(c){return !c.enabled;});
  if (capabilitySearchQuery) {
    var q = capabilitySearchQuery.toLowerCase();
    filtered = filtered.filter(function(c) {
      return c.name.toLowerCase().includes(q) || c.nameRu.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) || c.descriptionRu.toLowerCase().includes(q);
    });
  }
  var allCount = capabilitiesData.length;
  var activeCount = capabilitiesData.filter(function(c){return c.enabled;}).length;
  var inactiveCount = allCount - activeCount;
  document.querySelectorAll('.filter-chip .chip-count').forEach(function(el) {
    var chip = el.closest('.filter-chip');
    if (!chip) return;
    var f = chip.dataset.filter;
    if (f === 'all') el.textContent = allCount;
    else if (f === 'active') el.textContent = activeCount;
    else if (f === 'inactive') el.textContent = inactiveCount;
  });
  var subtitle = document.querySelector('#capabilities-page .page-subtitle');
  if (subtitle) {
    var totalTools = 0; capabilitiesData.forEach(function(c){totalTools += c.count;});
    subtitle.textContent = (currentLang === 'ru'
      ? totalTools + ' встроенных инструментов в ' + allCount + ' группах'
      : totalTools + ' built-in tools across ' + allCount + ' capability groups');
  }
  container.innerHTML = filtered.map(function(cap) {
    var icon = cap.icon ? capabilityIcon(cap.icon) : '';
    var keyWarning = cap.needsKey
      ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:var(--warning);margin-left:8px" title="Requires: '+cap.needsKey+'">' + (typeof IC !== 'undefined' ? IC.warn : '') + ' ' + (currentLang === 'ru' ? 'Нужен ключ' : 'Needs key') + '</span>'
      : '';
    return '<div class="capability-item" data-id="'+cap.id+'">' +
      '<div class="capability-header" onclick="toggleCapability(\''+cap.id+'\')">' +
        '<div class="capability-info">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capability-chevron"><polyline points="9 18 15 12 9 6"/></svg>' +
          (icon ? '<span style="display:inline-flex;align-items:center;gap:0;opacity:0.7">' + icon + '</span>' : '') +
          '<span class="capability-name">' + (currentLang === 'ru' ? cap.nameRu : cap.name) + '</span>' +
          '<span class="capability-count">' + cap.count + ' tools</span>' +
          keyWarning +
        '</div>' +
        '<div class="capability-actions">' +
          '<select class="capability-mode" onchange="changeCapabilityMode(\''+cap.id+'\', this.value)" onclick="event.stopPropagation()">' +
            '<option value="Mixed"'+(cap.mode==='Mixed'?' selected':'')+'>Mixed</option>' +
            '<option value="All"'+(cap.mode==='All'?' selected':'')+'>All</option>' +
            '<option value="None"'+(cap.mode==='None'?' selected':'')+'>None</option>' +
          '</select>' +
          '<label class="toggle-switch" onclick="event.stopPropagation()">' +
            '<input type="checkbox"'+(cap.enabled?' checked':'')+' onchange="toggleCapabilityEnabled(\''+cap.id+'\', this.checked)">' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="capability-details" id="cap-details-'+cap.id+'" style="display:none;padding:0 20px 20px">' +
        '<p style="color:var(--text-secondary);margin-bottom:12px;font-size:0.875rem">'+(currentLang==='ru'?cap.descriptionRu:cap.description)+'</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          cap.tools.map(function(t){return '<span style="padding:4px 10px;background:rgba(255,255,255,0.05);border-radius:4px;font-size:0.75rem;font-family:JetBrains Mono,monospace;color:var(--text-muted)">'+t+'</span>';}).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
};

// ===== AUDIT TRAIL PAGE =====
async function loadAuditTrail() {
  var container = document.getElementById('audit-trail-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + IC.hourglass + ' Loading...</div>';
  var agentsData = await apiRequest('GET', '/api/agents');
  var agents = (agentsData.ok && agentsData.agents) || [];
  var selectedAgent = document.getElementById('audit-agent-filter');
  var agentId = selectedAgent ? selectedAgent.value : '';
  var audits = [];
  if (agentId) {
    var data = await apiRequest('GET', '/api/agents/' + agentId + '/audit');
    if (data.ok && (data.audit || data.entries)) audits = data.audit || data.entries;
  } else {
    for (var i = 0; i < Math.min(agents.length, 5); i++) {
      var d = await apiRequest('GET', '/api/agents/' + agents[i].id + '/audit');
      if (d.ok && (d.audit || d.entries)) {
        (d.audit || d.entries).forEach(function(e) { e._agentId = agents[i].id; e._agentName = agents[i].name; audits.push(e); });
      }
    }
  }
  audits.sort(function(a,b) { return new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0); });
  var isRu = currentLang === 'ru';
  var html = '';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">';
  html += '<label style="font-size:.85rem;font-weight:500;color:var(--text-secondary)">' + (isRu ? 'Агент:' : 'Agent:') + '</label>';
  html += '<select id="audit-agent-filter" onchange="loadAuditTrail()" class="form-input" style="max-width:240px;padding:8px 12px;font-size:.85rem">';
  html += '<option value="">' + (isRu ? 'Все агенты' : 'All agents') + '</option>';
  agents.forEach(function(a) { html += '<option value="' + a.id + '"' + (agentId == a.id ? ' selected' : '') + '>#' + a.id + ' ' + escHtml(a.name || 'Unnamed') + '</option>'; });
  html += '</select>';
  html += '<span style="font-size:.78rem;color:var(--text-muted)">' + audits.length + (isRu ? ' записей' : ' entries') + '</span>';
  html += '</div>';
  if (!audits.length) {
    html += '<div style="text-align:center;padding:3rem;color:var(--text-muted)">';
    html += '<div style="font-size:2.5rem;margin-bottom:12px;opacity:0.5">' + IC.clipboard + '</div>';
    html += '<p>' + (isRu ? 'Нет записей аудита' : 'No audit entries yet') + '</p>';
    html += '<p style="font-size:.8rem;margin-top:6px">' + (isRu ? 'Записи появятся после выполнения агентов' : 'Entries will appear after agent executions') + '</p></div>';
  } else {
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.83rem">';
    html += '<thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:.72rem;text-transform:uppercase;letter-spacing:0.5px">';
    html += '<th style="text-align:left;padding:.6rem .75rem">' + (isRu ? 'Время' : 'Time') + '</th>';
    if (!agentId) html += '<th style="text-align:left;padding:.6rem .75rem">' + (isRu ? 'Агент' : 'Agent') + '</th>';
    html += '<th style="text-align:left;padding:.6rem .75rem">' + (isRu ? 'Инструмент' : 'Tool') + '</th>';
    html += '<th style="text-align:center;padding:.6rem .75rem">' + (isRu ? 'Статус' : 'Status') + '</th>';
    html += '<th style="text-align:right;padding:.6rem .75rem">' + (isRu ? 'Время (мс)' : 'Duration') + '</th>';
    html += '</tr></thead><tbody>';
    audits.slice(0, 100).forEach(function(e) {
      var ts = e.timestamp || e.createdAt || e.started_at;
      var timeStr = ts ? new Date(ts).toLocaleString() : '—';
      var tool = e.tool || e.toolName || e.action || '—';
      var ok = e.success !== false && e.status !== 'error' && e.status !== 'failed';
      var dur = e.duration_ms || e.durationMs || e.duration || null;
      html += '<tr style="border-bottom:1px solid var(--border-subtle)">';
      html += '<td style="padding:.5rem .75rem;color:var(--text-muted);white-space:nowrap">' + timeStr + '</td>';
      if (!agentId) html += '<td style="padding:.5rem .75rem;font-weight:500">#' + (e._agentId || '') + '</td>';
      html += '<td style="padding:.5rem .75rem"><code style="font-size:.78rem;padding:2px 8px;background:rgba(200,225,255,0.06);border-radius:4px;font-family:JetBrains Mono,monospace">' + escHtml(tool) + '</code></td>';
      html += '<td style="padding:.5rem .75rem;text-align:center">' + (ok ? IC.checkCircle : IC.xCircle) + '</td>';
      html += '<td style="padding:.5rem .75rem;text-align:right;color:var(--text-muted)">' + (dur ? dur + 'ms' : '—') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  container.innerHTML = html;
}

// ===== APPROVALS PAGE =====
async function loadApprovals() {
  var container = document.getElementById('approvals-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + IC.hourglass + ' Loading...</div>';
  var agentsData = await apiRequest('GET', '/api/agents');
  var agents = (agentsData.ok && agentsData.agents) || [];
  var allApprovals = [];
  for (var i = 0; i < agents.length; i++) {
    var d = await apiRequest('GET', '/api/agents/' + agents[i].id + '/approvals');
    if (d.ok && (d.approvals || d.entries)) {
      (d.approvals || d.entries || []).forEach(function(e) { e._agentId = agents[i].id; e._agentName = agents[i].name; allApprovals.push(e); });
    }
  }
  allApprovals.sort(function(a,b) { return new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0); });
  var isRu = currentLang === 'ru';
  var pending = allApprovals.filter(function(a) { return a.status === 'pending'; });
  var resolved = allApprovals.filter(function(a) { return a.status !== 'pending'; });
  var html = '';
  html += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';
  html += '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 24px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;min-width:100px"><span style="font-size:1.2rem;font-weight:700;color:var(--warning)">' + pending.length + '</span><span style="font-size:.75rem;color:var(--text-muted)">' + (isRu ? 'Ожидают' : 'Pending') + '</span></div>';
  html += '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 24px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;min-width:100px"><span style="font-size:1.2rem;font-weight:700;color:var(--success)">' + resolved.filter(function(a){return a.status==='approved';}).length + '</span><span style="font-size:.75rem;color:var(--text-muted)">' + (isRu ? 'Одобрено' : 'Approved') + '</span></div>';
  html += '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 24px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;min-width:100px"><span style="font-size:1.2rem;font-weight:700;color:var(--danger)">' + resolved.filter(function(a){return a.status==='rejected';}).length + '</span><span style="font-size:.75rem;color:var(--text-muted)">' + (isRu ? 'Отклонено' : 'Rejected') + '</span></div>';
  html += '</div>';
  if (pending.length) {
    html += '<h3 style="font-size:.9rem;font-weight:600;margin-bottom:12px;color:var(--warning);display:flex;align-items:center;gap:8px">' + IC.warn + ' ' + (isRu ? 'Ожидают решения' : 'Pending Approvals') + '</h3>';
    pending.forEach(function(ap) {
      html += '<div style="background:var(--bg-secondary);border:1px solid rgba(245,166,35,0.3);border-radius:12px;padding:16px;margin-bottom:10px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
      html += '<div><strong style="font-size:.85rem">' + escHtml(ap.action || ap.tool || 'Action') + '</strong>';
      html += '<span style="font-size:.75rem;color:var(--text-muted);margin-left:8px">Agent #' + (ap._agentId || '') + '</span></div>';
      html += '<span style="font-size:.72rem;color:var(--text-muted)">' + (ap.createdAt ? new Date(ap.createdAt).toLocaleString() : '') + '</span></div>';
      if (ap.description || ap.details) html += '<p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:12px">' + escHtml(ap.description || ap.details || '') + '</p>';
      html += '<div style="display:flex;gap:8px">';
      html += '<button class="btn btn-success btn-sm" onclick="resolveApproval(' + (ap._agentId||0) + ',\'' + (ap.id||'') + '\',\'approved\')">' + IC.check + ' ' + (isRu ? 'Одобрить' : 'Approve') + '</button>';
      html += '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="resolveApproval(' + (ap._agentId||0) + ',\'' + (ap.id||'') + '\',\'rejected\')">' + IC.x + ' ' + (isRu ? 'Отклонить' : 'Reject') + '</button>';
      html += '</div></div>';
    });
  }
  if (resolved.length) {
    html += '<h3 style="font-size:.9rem;font-weight:600;margin:20px 0 12px;color:var(--text-secondary)">' + (isRu ? 'Решённые' : 'Resolved') + ' (' + resolved.length + ')</h3>';
    html += '<div style="max-height:400px;overflow-y:auto">';
    resolved.slice(0, 50).forEach(function(ap) {
      var isApproved = ap.status === 'approved';
      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border-subtle)">';
      html += '<span>' + (isApproved ? IC.checkCircle : IC.xCircle) + '</span>';
      html += '<div style="flex:1;min-width:0"><span style="font-size:.82rem;font-weight:500">' + escHtml(ap.action || ap.tool || 'Action') + '</span>';
      html += '<span style="font-size:.72rem;color:var(--text-muted);margin-left:8px">Agent #' + (ap._agentId||'') + '</span></div>';
      html += '<span style="font-size:.72rem;color:var(--text-muted)">' + (ap.resolvedAt || ap.updatedAt ? new Date(ap.resolvedAt || ap.updatedAt).toLocaleString() : '') + '</span></div>';
    });
    html += '</div>';
  }
  if (!allApprovals.length) {
    html += '<div style="text-align:center;padding:3rem;color:var(--text-muted)">';
    html += '<div style="font-size:2.5rem;margin-bottom:12px;opacity:0.5">' + IC.thumbsup + '</div>';
    html += '<p>' + (isRu ? 'Нет запросов на одобрение' : 'No approval requests') + '</p>';
    html += '<p style="font-size:.8rem;margin-top:6px">' + (isRu ? 'Агенты запрашивают одобрение перед критическими операциями' : 'Agents request approval before critical operations') + '</p></div>';
  }
  container.innerHTML = html;
}

async function resolveApproval(agentId, approvalId, status) {
  var data = await apiRequest('POST', '/api/agents/' + agentId + '/approvals/' + approvalId, { status: status });
  toast(data.ok ? (status === 'approved' ? (currentLang==='ru'?'Одобрено':'Approved') : (currentLang==='ru'?'Отклонено':'Rejected')) : (data.error || 'Error'), data.ok ? 'success' : 'error');
  loadApprovals();
}

// ===== HEALTH METRICS PAGE =====
async function loadHealthMetrics() {
  var container = document.getElementById('health-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">' + IC.hourglass + ' Loading...</div>';
  var metricsData = {};
  try {
    var res = await fetch(API_BASE + '/metrics');
    var text = await res.text();
    try { metricsData = JSON.parse(text); } catch(e) {
      text.split('\n').forEach(function(line) {
        if (line.startsWith('#') || !line.trim()) return;
        var parts = line.split(' ');
        if (parts.length >= 2) metricsData[parts[0]] = parseFloat(parts[1]);
      });
    }
  } catch(e) { console.error('Metrics fetch error:', e); }
  var statsData = await apiRequest('GET', '/api/stats/me');
  var isRu = currentLang === 'ru';
  var html = '';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:28px">';
  var healthCards = [
    { label: isRu ? 'Статус' : 'Status', value: 'Healthy', color: '#22c55e', icon: IC.checkCircle },
    { label: isRu ? 'Аптайм' : 'Uptime', value: statsData.ok && statsData.uptimeSeconds ? Math.floor(statsData.uptimeSeconds/3600)+'h '+Math.floor((statsData.uptimeSeconds%3600)/60)+'m' : '—', color: '#0098ea', icon: IC.clock },
    { label: isRu ? 'Агентов активно' : 'Active Agents', value: (statsData.ok ? statsData.agentsActive : 0) || '0', color: '#8b5cf6', icon: IC.robot },
    { label: isRu ? 'Запусков за 24ч' : 'Runs (24h)', value: (statsData.ok ? statsData.last24hRuns : 0) || '0', color: '#f5a623', icon: IC.bolt },
  ];
  healthCards.forEach(function(c) {
    html += '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:18px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="color:'+c.color+'">' + c.icon + '</span><span style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">' + c.label + '</span></div>';
    html += '<div style="font-size:1.4rem;font-weight:700;color:'+c.color+'">' + c.value + '</div></div>';
  });
  html += '</div>';
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px">';
  html += '<h3 style="font-size:.9rem;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">' + IC.chart_line + ' ' + (isRu ? 'Латентность инструментов' : 'Tool Latency') + '</h3>';
  var toolMetrics = [];
  Object.keys(metricsData).forEach(function(key) {
    var match = key.match(/tool_duration_(.+?)_(p50|p95|p99|count)/);
    if (match) {
      var toolName = match[1]; var metric = match[2];
      var existing = toolMetrics.find(function(t) { return t.name === toolName; });
      if (!existing) { existing = { name: toolName }; toolMetrics.push(existing); }
      existing[metric] = metricsData[key];
    }
  });
  if (toolMetrics.length) {
    html += '<table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:.72rem;text-transform:uppercase">';
    html += '<th style="text-align:left;padding:.5rem .75rem">' + (isRu ? 'Инструмент' : 'Tool') + '</th><th style="text-align:right;padding:.5rem .75rem">p50</th><th style="text-align:right;padding:.5rem .75rem">p95</th><th style="text-align:right;padding:.5rem .75rem">p99</th><th style="text-align:right;padding:.5rem .75rem">' + (isRu ? 'Вызовов' : 'Calls') + '</th></tr></thead><tbody>';
    toolMetrics.forEach(function(t) {
      html += '<tr style="border-bottom:1px solid var(--border-subtle)"><td style="padding:.5rem .75rem"><code style="font-size:.78rem">' + escHtml(t.name) + '</code></td>';
      html += '<td style="padding:.5rem .75rem;text-align:right;color:var(--success)">' + (t.p50 ? t.p50.toFixed(0)+'ms' : '—') + '</td>';
      html += '<td style="padding:.5rem .75rem;text-align:right;color:var(--warning)">' + (t.p95 ? t.p95.toFixed(0)+'ms' : '—') + '</td>';
      html += '<td style="padding:.5rem .75rem;text-align:right;color:var(--danger)">' + (t.p99 ? t.p99.toFixed(0)+'ms' : '—') + '</td>';
      html += '<td style="padding:.5rem .75rem;text-align:right;color:var(--text-muted)">' + (t.count || '—') + '</td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:var(--text-muted);font-size:.82rem">' + (isRu ? 'Метрики инструментов будут доступны после выполнений' : 'Tool metrics will appear after executions') + '</p>';
  }
  html += '</div>';
  var rawKeys = Object.keys(metricsData);
  if (rawKeys.length) {
    html += '<details style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px">';
    html += '<summary style="cursor:pointer;font-size:.82rem;font-weight:500;color:var(--text-secondary)">' + (isRu ? 'Все метрики ('+rawKeys.length+')' : 'All Metrics ('+rawKeys.length+')') + '</summary>';
    html += '<div style="margin-top:12px;max-height:300px;overflow-y:auto">';
    rawKeys.sort().forEach(function(k) {
      html += '<div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:.78rem;border-bottom:1px solid var(--border-subtle)">';
      html += '<code style="color:var(--primary);font-family:JetBrains Mono,monospace">' + escHtml(k) + '</code>';
      html += '<span style="color:var(--text-secondary)">' + metricsData[k] + '</span></div>';
    });
    html += '</div></details>';
  }
  container.innerHTML = html;
}

// Register page load functions
if (typeof pageLoadFns !== 'undefined') {
  pageLoadFns['audit-trail'] = function() { return loadAuditTrail(); };
  pageLoadFns['approvals'] = function() { return loadApprovals(); };
  pageLoadFns['health'] = function() { return loadHealthMetrics(); };
}

// ===== ENHANCED SECURITY SECTION =====
function renderSecuritySection() {
  var secCard = document.querySelector('#settings-page .settings-section:last-of-type .settings-card');
  if (!secCard || document.getElementById('sec-pre-tx-scan')) return;
  // Try more specific selector
  if (!secCard) {
    var allCards = document.querySelectorAll('#settings-page .settings-card');
    for (var i = 0; i < allCards.length; i++) {
      if (allCards[i].querySelector('#sec-logging')) { secCard = allCards[i]; break; }
    }
  }
  if (!secCard) return;
  var newItems = '';
  newItems += '<div class="setting-item"><div class="setting-info"><span class="setting-name" data-en="Pre-Transaction Scan" data-ru="Пре-транзакционный скан">Pre-Transaction Scan</span><span class="setting-desc" data-en="Scan addresses and contracts before transactions" data-ru="Сканировать адреса и контракты перед транзакциями">Scan addresses and contracts before transactions</span></div><label class="toggle-switch"><input type="checkbox" id="sec-pre-tx-scan" checked onchange="saveSecuritySettings()"><span class="toggle-slider"></span></label></div>';
  newItems += '<div class="setting-item"><div class="setting-info"><span class="setting-name" data-en="Address Blacklist" data-ru="Черный список адресов">Address Blacklist</span><span class="setting-desc" data-en="Block transactions to known scam addresses" data-ru="Блокировать транзакции к мошенническим адресам">Block transactions to known scam addresses</span></div><label class="toggle-switch"><input type="checkbox" id="sec-blacklist" checked onchange="saveSecuritySettings()"><span class="toggle-slider"></span></label></div>';
  newItems += '<div class="setting-item"><div class="setting-info"><span class="setting-name" data-en="Max Transaction Amount" data-ru="Макс. сумма транзакции">Max Transaction Amount</span><span class="setting-desc" data-en="Require approval above this amount (TON)" data-ru="Требовать одобрение свыше этой суммы (TON)">Require approval above this amount (TON)</span></div><input type="number" id="sec-max-amount" class="form-input" style="max-width:120px;text-align:right" value="100" min="0" step="10" onchange="saveSecuritySettings()"></div>';
  newItems += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-subtle)"><div style="font-size:.75rem;font-weight:500;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px" data-en="Blacklisted Addresses" data-ru="Заблокированные адреса">Blacklisted Addresses</div><div id="blacklist-addresses" style="max-height:120px;overflow-y:auto;margin-bottom:8px"></div><div style="display:flex;gap:8px"><input type="text" id="blacklist-new-addr" class="form-input" placeholder="EQ... / UQ..." style="flex:1;font-size:.82rem"><button class="btn btn-ghost btn-sm" onclick="addBlacklistAddress()">Add</button></div></div>';
  secCard.insertAdjacentHTML('beforeend', newItems);
  loadBlacklistAddresses();
}

var _blacklistAddresses = [];
async function loadBlacklistAddresses() {
  try {
    var data = await apiRequest('GET', '/api/settings?key=address_blacklist');
    if (data && data.value) _blacklistAddresses = Array.isArray(data.value) ? data.value : [];
  } catch(e) {}
  renderBlacklist();
}
function renderBlacklist() {
  var el = document.getElementById('blacklist-addresses');
  if (!el) return;
  if (!_blacklistAddresses.length) { el.innerHTML = '<div style="padding:8px;font-size:.78rem;color:var(--text-muted)">' + (currentLang==='ru'?'Список пуст':'No addresses') + '</div>'; return; }
  el.innerHTML = _blacklistAddresses.map(function(addr, i) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid var(--border-subtle)"><code style="font-size:.75rem;flex:1;word-break:break-all;font-family:JetBrains Mono,monospace;color:var(--text-secondary)">' + escHtml(addr) + '</code><button class="btn btn-ghost btn-sm" style="color:var(--danger);flex-shrink:0" onclick="removeBlacklistAddress('+i+')">' + IC.x + '</button></div>';
  }).join('');
}
function addBlacklistAddress() {
  var input = document.getElementById('blacklist-new-addr');
  if (!input) return;
  var addr = input.value.trim();
  if (!addr || (!addr.startsWith('EQ') && !addr.startsWith('UQ') && !addr.startsWith('0:'))) { toast(currentLang==='ru'?'Введите корректный TON адрес':'Enter a valid TON address','error'); return; }
  _blacklistAddresses.push(addr); input.value = '';
  apiRequest('POST', '/api/settings', { key: 'address_blacklist', value: _blacklistAddresses }).catch(function(){});
  renderBlacklist();
}
function removeBlacklistAddress(idx) {
  _blacklistAddresses.splice(idx, 1);
  apiRequest('POST', '/api/settings', { key: 'address_blacklist', value: _blacklistAddresses }).catch(function(){});
  renderBlacklist();
}

// Enhanced saveSecuritySettings
saveSecuritySettings = function() {
  var sec = {
    logging: document.getElementById('sec-logging') ? document.getElementById('sec-logging').checked : true,
    confirmActions: document.getElementById('sec-confirm') ? document.getElementById('sec-confirm').checked : true,
    rateLimiting: document.getElementById('sec-rate-limit') ? document.getElementById('sec-rate-limit').checked : true,
    preTxScan: document.getElementById('sec-pre-tx-scan') ? document.getElementById('sec-pre-tx-scan').checked : true,
    blacklistEnabled: document.getElementById('sec-blacklist') ? document.getElementById('sec-blacklist').checked : true,
    maxTxAmount: document.getElementById('sec-max-amount') ? parseFloat(document.getElementById('sec-max-amount').value) || 100 : 100,
  };
  apiRequest('POST', '/api/settings', { key: 'security_settings', value: sec });
  showNotification(currentLang === 'ru' ? 'Настройки безопасности сохранены' : 'Security settings saved', 'success');
};

// Enhanced loadSecuritySettings
var _origLoadSec = loadSecuritySettings;
loadSecuritySettings = async function() {
  try {
    var data = await apiRequest('GET', '/api/settings?key=security_settings');
    if (data && data.value) {
      var sec = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      var el1 = document.getElementById('sec-logging'); if (el1) el1.checked = sec.logging !== false;
      var el2 = document.getElementById('sec-confirm'); if (el2) el2.checked = sec.confirmActions !== false;
      var el3 = document.getElementById('sec-rate-limit'); if (el3) el3.checked = sec.rateLimiting !== false;
      var el4 = document.getElementById('sec-pre-tx-scan'); if (el4) el4.checked = sec.preTxScan !== false;
      var el5 = document.getElementById('sec-blacklist'); if (el5) el5.checked = sec.blacklistEnabled !== false;
      var el6 = document.getElementById('sec-max-amount'); if (el6 && sec.maxTxAmount != null) el6.value = sec.maxTxAmount;
    }
  } catch(e) {}
};

// ===== AGENT SETTINGS: Extra API keys (Discord, X, fal.ai, real-time toggle) =====
function patchAITabWithExtras() {
  var body = document.getElementById('agent-settings-body');
  if (!body || _settingsTab !== 'ai' || document.getElementById('extra-api-keys-section')) return;
  var a = _detailAgentData; if (!a) return;
  var config = {};
  try { config = typeof a.trigger_config === 'string' ? JSON.parse(a.trigger_config) : (a.trigger_config || {}); } catch(e) {}
  var ac = config.config || {};
  var isRu = currentLang === 'ru';
  var _inputSt = 'width:100%;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text-primary);font-size:.85rem;font-family:inherit;outline:none;transition:border-color 0.2s;box-sizing:border-box';
  var _labelSt = 'font-size:.75rem;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px';
  var extra = '<div id="extra-api-keys-section" style="margin-top:20px"><div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:20px">';
  extra += '<div style="font-size:.85rem;font-weight:600;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px">' + IC.link + ' ' + (isRu ? 'Дополнительные API ключи' : 'Additional API Keys') + '</div>';
  var extraKeys = [
    { id: 'discord', label: 'Discord Bot Token', key: 'DISCORD_BOT_TOKEN', placeholder: 'Bot token...' },
    { id: 'x', label: 'X / Twitter API Key', key: 'X_API_KEY', placeholder: 'API key...' },
    { id: 'fal', label: 'fal.ai API Key', key: 'FAL_AI_KEY', placeholder: 'fal-...' },
  ];
  extraKeys.forEach(function(ek) {
    var hasKey = !!ac[ek.key];
    extra += '<div style="margin-bottom:14px"><div style="'+_labelSt+'">'+ek.label+'</div>';
    extra += '<input type="password" id="extra-'+ek.id+'-key" placeholder="'+(hasKey?'************':ek.placeholder)+'" style="'+_inputSt+'">';
    if (hasKey) extra += '<div style="display:flex;align-items:center;gap:4px;margin-top:4px"><span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span><span style="font-size:.7rem;color:#22c55e">'+(isRu?'Установлен':'Set')+'</span></div>';
    extra += '</div>';
  });
  extra += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border-subtle)">';
  extra += '<div><span style="font-size:.82rem;font-weight:500">'+(isRu?'Потоковые цены':'Real-time Price Stream')+'</span>';
  extra += '<div style="font-size:.72rem;color:var(--text-muted)">'+(isRu?'SSE-соединение для мониторинга цен':'SSE connection for real-time price monitoring')+'</div></div>';
  extra += '<label class="toggle-switch"><input type="checkbox" id="extra-realtime-stream"'+(ac.REALTIME_STREAM?' checked':'')+'><span class="toggle-slider"></span></label></div>';
  extra += '<button class="btn btn-ghost btn-sm" onclick="saveExtraKeys()" style="width:100%;margin-top:10px;padding:8px;font-weight:500">'+(isRu?'Сохранить доп. ключи':'Save Extra Keys')+'</button>';
  extra += '</div></div>';
  body.insertAdjacentHTML('beforeend', extra);
}

async function saveExtraKeys() {
  if (!_detailAgentId || !_detailAgentData) return;
  var config = {};
  try { config = typeof _detailAgentData.trigger_config === 'string' ? JSON.parse(_detailAgentData.trigger_config) : (_detailAgentData.trigger_config || {}); } catch(e) {}
  if (!config.config) config.config = {};
  var pairs = [['extra-discord-key','DISCORD_BOT_TOKEN'],['extra-x-key','X_API_KEY'],['extra-fal-key','FAL_AI_KEY']];
  pairs.forEach(function(p) { var el = document.getElementById(p[0]); if (el && el.value.trim()) config.config[p[1]] = el.value.trim(); });
  var rs = document.getElementById('extra-realtime-stream');
  if (rs) config.config.REALTIME_STREAM = rs.checked;
  var data = await apiRequest('POST', '/api/agents/' + _detailAgentId + '/config', { triggerConfig: config });
  toast(data.ok ? (currentLang==='ru'?'Ключи сохранены':'Keys saved') : (data.error || 'Error'), data.ok ? 'success' : 'error');
  if (data.ok) refreshAgentDetail();
}

// Hook switchSettingsTab for AI extras
var _origSwitchTab = switchSettingsTab;
switchSettingsTab = function(tab) {
  _origSwitchTab(tab);
  if (tab === 'ai') setTimeout(patchAITabWithExtras, 50);
};

// ===== INIT PATCHES =====
var _patchApplied = false;
function applyPatches() {
  if (_patchApplied) return;
  _patchApplied = true;
  setTimeout(renderSecuritySection, 500);
  setTimeout(function() { if (typeof initCapabilities === 'function') initCapabilities(); }, 300);
}

var _origShowApp = showApp;
showApp = function() {
  _origShowApp();
  applyPatches();
};

document.addEventListener('DOMContentLoaded', function() { if (authToken) setTimeout(applyPatches, 1000); });
if (document.readyState === 'complete' && authToken) setTimeout(applyPatches, 500);

console.log('[Studio] Patch v2 loaded: 20 capabilities, audit trail, approvals, health metrics, security, extra API keys');
