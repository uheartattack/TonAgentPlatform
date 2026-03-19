/**
 * wallets.js — Agentic Wallets Dashboard
 * Full management UI for self-custody agent wallets
 */

const API_BASE = window.location.origin;
let authToken = localStorage.getItem('tg_token') || localStorage.getItem('auth_token') || '';
let walletsData = [];
let statsData = {};
let selectedWallet = null;

// ── Auth ───────────────────────────────────────────────────────────────────

async function checkAuth() {
  if (!authToken) {
    document.getElementById('auth-screen').style.display = '';
    document.getElementById('app').style.display = 'none';
    return false;
  }
  try {
    const r = await apiFetch('/api/me');
    if (!r.ok) throw new Error('Unauthorized');
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = '';
    return true;
  } catch {
    document.getElementById('auth-screen').style.display = '';
    document.getElementById('app').style.display = 'none';
    return false;
  }
}

async function apiFetch(path, opts = {}) {
  const r = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(opts.headers || {}),
    },
  });
  return r.json();
}

// ── Data Loading ───────────────────────────────────────────────────────────

async function loadWallets() {
  try {
    const data = await apiFetch('/api/agentic-wallets');
    if (!data.ok) throw new Error(data.error || 'Failed');
    walletsData = data.wallets || [];
    statsData = data.stats || {};
    renderStats();
    renderRootSection();
    renderWallets();
  } catch (e) {
    console.error('Load wallets error:', e);
    showToast('Failed to load wallets: ' + e.message, 'error');
  }
}

async function refreshAll() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Refreshing...';
  try {
    await apiFetch('/api/agentic-wallets/refresh-all', { method: 'POST' });
    await loadWallets();
    showToast('Balances refreshed!');
  } catch (e) {
    showToast('Refresh failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Refresh`;
  }
}

// ── Renderers ──────────────────────────────────────────────────────────────

function renderStats() {
  const el = document.getElementById('stats-row');
  el.innerHTML = `
    <div class="stat-card blue">
      <span class="stat-label">Total Wallets</span>
      <span class="stat-value">${statsData.totalWallets || 0}</span>
    </div>
    <div class="stat-card green">
      <span class="stat-label">Total Balance</span>
      <span class="stat-value">${(statsData.totalBalanceTon || 0).toFixed(2)}</span>
      <span class="stat-sub">TON</span>
    </div>
    <div class="stat-card purple">
      <span class="stat-label">Active</span>
      <span class="stat-value">${statsData.activeWallets || 0}</span>
      <span class="stat-sub">${statsData.blockedWallets || 0} blocked</span>
    </div>
    <div class="stat-card yellow">
      <span class="stat-label">Spent Today</span>
      <span class="stat-value">${(statsData.totalSpentTodayTon || 0).toFixed(2)}</span>
      <span class="stat-sub">TON</span>
    </div>
  `;
}

function renderRootSection() {
  const el = document.getElementById('root-section');
  const root = walletsData.find(w => w.walletType === 'root');

  if (!root) {
    el.innerHTML = `
      <div class="setup-banner">
        <h2>Welcome to Agentic Wallets</h2>
        <p>Create a Root Wallet to get started. It will serve as your master wallet — all agent sub-wallets will be linked to it.</p>
        <div class="setup-actions">
          <button class="btn btn-primary" onclick="setupRootWallet()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
            Create Root Wallet
          </button>
          <button class="btn" onclick="showImportModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Import Existing
          </button>
        </div>
      </div>
    `;
    return;
  }

  const addrShort = root.address.slice(0, 10) + '...' + root.address.slice(-6);
  el.innerHTML = `
    <div class="root-banner">
      <div class="root-info">
        <h2>👑 Root Wallet</h2>
        <code class="root-address" onclick="copyAddress('${root.address}')" title="Click to copy">${addrShort}</code>
      </div>
      <div class="root-balance">
        <div class="amount">${root.balanceTon.toFixed(4)}</div>
        <div class="label">TON Balance</div>
      </div>
    </div>
  `;
}

function renderWallets() {
  const el = document.getElementById('wallets-grid');
  const subs = walletsData.filter(w => w.walletType === 'sub');
  const title = document.getElementById('wallets-title');
  title.textContent = `Agent Wallets (${subs.length})`;

  if (subs.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
        </svg>
        <h3>No agent wallets yet</h3>
        <p>Deploy a sub-wallet for your agents to use autonomously</p>
        <button class="btn btn-primary" onclick="showDeployModal()" style="margin-top:12px">+ New Wallet</button>
      </div>
    `;
    return;
  }

  el.innerHTML = subs.map(w => {
    const addrShort = w.address.slice(0, 8) + '...' + w.address.slice(-4);
    const statusClass = w.isBlocked ? 'blocked' : '';
    const agentLabel = w.agentId ? `Agent #${w.agentId}` : 'Unlinked';

    return `
      <div class="wallet-card ${statusClass}" onclick="showWalletDetail(${w.id})">
        <div class="wallet-header">
          <span class="wallet-name">
            <span class="wallet-status ${statusClass}"></span>
            ${escHtml(w.label || addrShort)}
          </span>
          <span style="font-size:12px;color:var(--text-dim)">#${w.id}</span>
        </div>
        <code class="wallet-address" onclick="event.stopPropagation();copyAddress('${w.address}')" title="Click to copy">${addrShort}</code>
        <div class="wallet-balance">
          ${w.balanceTon.toFixed(4)} <span class="currency">TON</span>
        </div>
        <div class="wallet-meta">
          <span>🤖 ${agentLabel}</span>
          <span>📊 ${w.spendLimitTon} TON/day</span>
          <span>${w.isBlocked ? '🔴 Blocked' : '🟢 Active'}</span>
        </div>
        <div class="wallet-actions" onclick="event.stopPropagation()">
          <button class="btn btn-sm" onclick="depositWallet(${w.id},'${w.address}')">💎 Deposit</button>
          <button class="btn btn-sm" onclick="refreshWallet(${w.id})">🔄</button>
          ${w.isBlocked
            ? `<button class="btn btn-sm btn-success" onclick="toggleBlock(${w.id},false)">Unblock</button>`
            : `<button class="btn btn-sm btn-danger" onclick="toggleBlock(${w.id},true)">Block</button>`}
          <button class="btn btn-sm" onclick="showTxs(${w.id})">📜 Txs</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function setupRootWallet() {
  showToast('Creating root wallet...');
  try {
    const data = await apiFetch('/api/agentic-wallets/setup-root', { method: 'POST' });
    if (data.dashboardUrl) {
      window.open(data.dashboardUrl, '_blank');
      showToast('Dashboard opened in new tab');
    } else if (data.ok) {
      showToast('Root wallet created!');
      await loadWallets();
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function showImportModal() {
  const modal = document.getElementById('modal-content');
  modal.innerHTML = `
    <h3>📥 Import Wallet</h3>
    <div class="form-group">
      <label>TON Address (EQ... or UQ...)</label>
      <input type="text" id="import-address" placeholder="EQA...">
    </div>
    <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px">Or enter 24-word mnemonic to import with full control:</p>
    <div class="form-group">
      <label>Mnemonic (24 words, optional)</label>
      <input type="password" id="import-mnemonic" placeholder="word1 word2 ... word24">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doImport()">Import</button>
    </div>
  `;
  openModal();
}

async function doImport() {
  const address = document.getElementById('import-address').value.trim();
  const mnemonic = document.getElementById('import-mnemonic').value.trim();

  if (!address && !mnemonic) {
    showToast('Enter address or mnemonic', 'error');
    return;
  }

  try {
    const body = {};
    if (address) body.address = address;
    if (mnemonic) body.mnemonic = mnemonic;

    const data = await apiFetch('/api/agentic-wallets/setup-root', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (data.ok) {
      closeModal();
      showToast('Wallet imported successfully!');
      await loadWallets();
    } else {
      showToast(data.error || 'Import failed', 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function showDeployModal() {
  const modal = document.getElementById('modal-content');
  modal.innerHTML = `
    <h3>➕ Deploy New Sub-Wallet</h3>
    <div class="form-group">
      <label>Agent ID (optional — leave empty for free wallet)</label>
      <input type="number" id="deploy-agent-id" placeholder="e.g. 199">
    </div>
    <div class="form-group">
      <label>Label</label>
      <input type="text" id="deploy-label" placeholder="e.g. Trading Bot Wallet" value="">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doDeploy()">Deploy</button>
    </div>
  `;
  openModal();
}

async function doDeploy() {
  const agentId = parseInt(document.getElementById('deploy-agent-id').value) || 0;
  const label = document.getElementById('deploy-label').value.trim();

  try {
    showToast('Deploying wallet...');
    const data = await apiFetch('/api/agentic-wallets/deploy', {
      method: 'POST',
      body: JSON.stringify({ agentId: agentId || undefined, label }),
    });

    if (data.ok) {
      closeModal();
      showToast('Wallet deployed!');
      await loadWallets();
    } else {
      showToast(data.error || 'Deploy failed', 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function toggleBlock(walletId, blocked) {
  try {
    await apiFetch(`/api/agentic-wallets/${walletId}/block`, {
      method: 'POST',
      body: JSON.stringify({ blocked }),
    });
    showToast(blocked ? 'Wallet blocked' : 'Wallet unblocked');
    await loadWallets();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function refreshWallet(walletId) {
  try {
    const data = await apiFetch(`/api/agentic-wallets/${walletId}/refresh`, { method: 'POST' });
    showToast(`Balance: ${(data.balanceTon || 0).toFixed(4)} TON`);
    await loadWallets();
  } catch (e) {
    showToast('Refresh error', 'error');
  }
}

function depositWallet(walletId, address) {
  const deepLink = `ton://transfer/${address}`;
  window.open(deepLink, '_blank');
  showToast('Opening wallet app...');
}

function copyAddress(address) {
  navigator.clipboard.writeText(address).then(() => {
    showToast('Address copied!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = address;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Address copied!');
  });
}

// ── Wallet Detail Modal ──

async function showWalletDetail(walletId) {
  const w = walletsData.find(x => x.id === walletId);
  if (!w) return;
  selectedWallet = w;

  const modal = document.getElementById('modal-content');
  const addrShort = w.address.slice(0, 12) + '...' + w.address.slice(-8);

  modal.innerHTML = `
    <h3>💼 ${escHtml(w.label || 'Wallet #' + w.id)}</h3>
    <div style="margin-bottom:16px">
      <label style="font-size:12px;color:var(--text-dim)">Address</label>
      <code class="wallet-address" onclick="copyAddress('${w.address}')" style="display:block;margin-top:4px">${w.address}</code>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;color:var(--text-dim)">Balance</label>
        <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:var(--green)">${w.balanceTon.toFixed(4)} TON</div>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-dim)">Daily Limit</label>
        <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono'">${w.spendLimitTon} TON</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;color:var(--text-dim)">Agent</label>
        <div>${w.agentId ? '🤖 Agent #' + w.agentId : 'Not linked'}</div>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-dim)">Status</label>
        <div>${w.isBlocked ? '🔴 Blocked' : '🟢 Active'}</div>
      </div>
    </div>

    <div class="form-group">
      <label>Update Label</label>
      <div style="display:flex;gap:6px">
        <input type="text" id="detail-label" value="${escHtml(w.label)}" style="flex:1">
        <button class="btn btn-sm" onclick="updateLabel(${w.id})">Save</button>
      </div>
    </div>
    <div class="form-group">
      <label>Set Daily Limit (TON)</label>
      <div style="display:flex;gap:6px">
        <input type="number" id="detail-limit" value="${w.spendLimitTon}" min="0" step="1" style="flex:1">
        <button class="btn btn-sm" onclick="updateLimit(${w.id})">Save</button>
      </div>
    </div>

    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn" onclick="depositWallet(${w.id},'${w.address}')">💎 Deposit</button>
      <button class="btn" onclick="showTxs(${w.id})">📜 Transactions</button>
      <a class="btn" href="https://tonscan.org/address/${w.address}" target="_blank">🔗 Tonscan</a>
      ${w.isBlocked
        ? `<button class="btn btn-success" onclick="toggleBlock(${w.id},false);closeModal()">🟢 Unblock</button>`
        : `<button class="btn btn-danger" onclick="toggleBlock(${w.id},true);closeModal()">🔴 Block</button>`}
      <button class="btn btn-danger" onclick="deleteWallet(${w.id})">🗑 Delete</button>
      <button class="btn" onclick="closeModal()">Close</button>
    </div>
  `;
  openModal();
}

async function updateLabel(walletId) {
  const label = document.getElementById('detail-label').value.trim();
  try {
    await apiFetch(`/api/agentic-wallets/${walletId}/label`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
    showToast('Label updated!');
    closeModal();
    await loadWallets();
  } catch (e) {
    showToast('Error', 'error');
  }
}

async function updateLimit(walletId) {
  const limitTon = parseFloat(document.getElementById('detail-limit').value);
  if (isNaN(limitTon) || limitTon < 0) { showToast('Invalid limit', 'error'); return; }
  try {
    await apiFetch(`/api/agentic-wallets/${walletId}/limit`, {
      method: 'POST',
      body: JSON.stringify({ limitTon }),
    });
    showToast(`Limit set to ${limitTon} TON/day`);
    closeModal();
    await loadWallets();
  } catch (e) {
    showToast('Error', 'error');
  }
}

async function deleteWallet(walletId) {
  if (!confirm('Are you sure? Make sure you withdrew all funds!')) return;
  try {
    await apiFetch(`/api/agentic-wallets/${walletId}`, { method: 'DELETE' });
    showToast('Wallet deleted');
    closeModal();
    await loadWallets();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function showTxs(walletId) {
  const modal = document.getElementById('modal-content');
  modal.innerHTML = `<h3>📜 Transactions</h3><div class="loading"><div class="spinner"></div></div>`;
  openModal();

  try {
    const data = await apiFetch(`/api/agentic-wallets/${walletId}/transactions`);
    const txs = data.transactions || [];
    const w = walletsData.find(x => x.id === walletId);
    const myAddr = w ? w.address.toLowerCase() : '';

    if (txs.length === 0) {
      modal.innerHTML = `
        <h3>📜 Transactions</h3>
        <div class="empty-state" style="padding:30px 0">
          <h3>No transactions yet</h3>
          <p>Deposit some TON to get started</p>
        </div>
        <div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>
      `;
      return;
    }

    let html = '<h3>📜 Transactions</h3><div class="tx-list">';
    for (const tx of txs.slice(0, 20)) {
      const isIncoming = tx.to.toLowerCase().includes(myAddr.slice(0, 20));
      const dir = isIncoming ? '📥' : '📤';
      const cls = isIncoming ? 'incoming' : 'outgoing';
      const sign = isIncoming ? '+' : '-';
      const time = new Date(tx.timestamp * 1000).toLocaleString();

      html += `
        <div class="tx-item">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <span class="tx-dir">${dir}</span>
            <div>
              <div class="tx-amount ${cls}">${sign}${tx.amountTon.toFixed(4)} TON</div>
              ${tx.comment ? `<div style="font-size:11px;color:var(--text-dim)">${escHtml(tx.comment.slice(0, 50))}</div>` : ''}
            </div>
          </div>
          <span class="tx-time">${time}</span>
        </div>
      `;
    }
    html += '</div>';
    html += '<div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>';
    modal.innerHTML = html;
  } catch (e) {
    modal.innerHTML = `<h3>Error</h3><p>${e.message}</p><div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>`;
  }
}

// ── Modal helpers ──────────────────────────────────────────────────────────

function openModal() {
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal-overlay').classList.remove('active');
}

// ── Toast ──────────────────────────────────────────────────────────────────

function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = type === 'error' ? 'var(--red)' : 'var(--accent)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Utils ──────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Keyboard shortcuts ──

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal(e);
  if (e.key === 'r' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); refreshAll(); }
});

// ── Init ───────────────────────────────────────────────────────────────────

(async function init() {
  // Try to get token from URL hash
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get('token')) {
    authToken = hash.get('token');
    localStorage.setItem('tg_token', authToken);
    history.replaceState(null, '', window.location.pathname);
  }

  // Also try query param
  const params = new URLSearchParams(window.location.search);
  if (params.get('token')) {
    authToken = params.get('token');
    localStorage.setItem('tg_token', authToken);
    history.replaceState(null, '', window.location.pathname);
  }

  const ok = await checkAuth();
  if (ok) {
    await loadWallets();
  }
})();
