// Fix agent #98: restore good code + update collection address in config
const { Pool } = require('pg');

const NEW_COLLECTION = 'EQC6zjid8vJNEWqcXk10XjsdDLRKbcPZzbHusuEW6FokOWIm';

// New agent code with:
// 1. TonAPI for floor/listings (no GetGems API)
// 2. URL parsing for collection addresses (getgems.io/collection/EQ... → EQ...)
// 3. Built-in popular collections fallback if none specified
// 4. try/catch around all JSON.parse calls
const newCode = `async function agent(context) {
  // ── Конфиг ───────────────────────────────────────────────────────
  var MAX_BUY_TON  = parseFloat(context.config.MAX_BUY_PRICE_TON  || '50');
  var MIN_PROFIT   = parseFloat(context.config.MIN_PROFIT_PCT      || '15');
  var DAILY_LIMIT  = parseFloat(context.config.DAILY_LIMIT_TON     || '200');
  var SELL_MARKUP  = parseFloat(context.config.SELL_MARKUP_PCT     || '20');
  var AUTO_NOTIFY  = (context.config.AUTO_NOTIFY || 'true') === 'true';

  // ── Парсинг адресов коллекций (принимает EQ-адрес или getgems.io URL) ─
  function parseCollectionAddr(raw) {
    raw = (raw || '').trim();
    // Extract from getgems.io URL: https://getgems.io/collection/EQxxxx
    var m = raw.match(/(?:getgems\\.io\\/collection\\/|fragment\\.com\\/collection\\/|tonscan\\.org\\/address\\/)([EUk][Qq][\\w-]{46})/);
    if (m) return m[1];
    // Plain EQ/UQ address
    if (/^[EUk][Qq][\\w-]{46}$/.test(raw)) return raw;
    return null;
  }

  // Popular TON NFT collections (used as fallback if none specified)
  var POPULAR_COLLECTIONS = [
    'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN', // TON Punks
    'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir', // TON Diamonds
    'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N', // Anonymous Numbers
  ];

  var rawCollections = (context.config.TARGET_COLLECTIONS || '').split(',');
  var COLLECTIONS = [];
  for (var i = 0; i < rawCollections.length; i++) {
    var addr = parseCollectionAddr(rawCollections[i]);
    if (addr) COLLECTIONS.push(addr);
  }
  if (COLLECTIONS.length === 0) {
    // Use popular collections if none specified
    COLLECTIONS = POPULAR_COLLECTIONS;
    console.log('TARGET_COLLECTIONS не задан — сканирую популярные коллекции');
  }

  // ── Кошелёк: авто-создание если не задан ─────────────────────────
  var WALLET_MNEMONIC = (context.config.WALLET_MNEMONIC || '').trim();
  var WALLET_ADDRESS  = '';

  var storedMnemonic = getState('wallet_mnemonic');
  if (!WALLET_MNEMONIC && storedMnemonic) WALLET_MNEMONIC = String(storedMnemonic);

  if (!WALLET_MNEMONIC) {
    var newWallet = await tonCreateWallet();
    WALLET_MNEMONIC = newWallet.mnemonic;
    WALLET_ADDRESS  = newWallet.address;
    setState('wallet_mnemonic', WALLET_MNEMONIC);
    setState('wallet_address',  WALLET_ADDRESS);
    console.log('Кошелёк создан:', WALLET_ADDRESS);
    if (AUTO_NOTIFY) {
      await notify('Арбитражник создал кошелёк!\\n\\nАдрес: ' + WALLET_ADDRESS + '\\n\\nПополни кошелёк TON для старта.\\nДневной лимит: ' + DAILY_LIMIT + ' TON');
    }
    return { success: true, result: { action: 'wallet_created', address: WALLET_ADDRESS } };
  }

  var storedAddr = getState('wallet_address');
  WALLET_ADDRESS = WALLET_ADDRESS || (storedAddr ? String(storedAddr) : '') || await tonGetWalletAddress(WALLET_MNEMONIC);
  var walletBalance = await tonGetBalance(WALLET_ADDRESS);
  var REAL_MODE = WALLET_MNEMONIC.split(' ').filter(function(w){ return w.length > 0; }).length >= 12 && walletBalance > 0.1;

  // ── TonAPI helpers ────────────────────────────────────────────────
  var TONAPI_KEY = context.config.TONAPI_KEY || '';

  function tonapiHdr() {
    return TONAPI_KEY ? { 'Authorization': 'Bearer ' + TONAPI_KEY } : {};
  }

  // EQ/UQ base64url → raw 0:hex for TonAPI collection endpoints
  function eqToRaw(addr) {
    try {
      var b64 = addr.replace(/-/g, '+').replace(/_/g, '/');
      var buf = Buffer.from(b64, 'base64');
      var workchain = buf[1] === 0xff ? -1 : buf[1];
      var hash = buf.slice(2, 34).toString('hex');
      return workchain + ':' + hash;
    } catch(e) { return addr; }
  }

  // Get floor price via TonAPI
  async function getFloor(collAddr) {
    try {
      var raw = eqToRaw(collAddr);
      var resp = await fetch('https://tonapi.io/v2/nfts/collections/' + encodeURIComponent(raw) + '/items?limit=50', { headers: tonapiHdr() });
      if (!resp.ok) return null;
      var data = await resp.json();
      var prices = [];
      for (var i = 0; i < (data.nft_items || []).length; i++) {
        var item = data.nft_items[i];
        if (item.sale && item.sale.price && item.sale.price.token_name === 'TON') {
          prices.push(Number(item.sale.price.value) / 1e9);
        }
      }
      if (prices.length === 0) return null;
      prices.sort(function(a, b){ return a - b; });
      return prices[0];
    } catch(e) { return null; }
  }

  // Get collection name via TonAPI
  async function getCollectionName(collAddr) {
    try {
      var raw = eqToRaw(collAddr);
      var resp = await fetch('https://tonapi.io/v2/nfts/collections/' + encodeURIComponent(raw), { headers: tonapiHdr() });
      if (!resp.ok) return collAddr.slice(0, 10) + '...';
      var data = await resp.json();
      return (data.metadata && data.metadata.name) ? data.metadata.name : collAddr.slice(0, 10) + '...';
    } catch(e) { return collAddr.slice(0, 10) + '...'; }
  }

  // Scan listings below price threshold via TonAPI
  async function scanListings(collAddr, maxPriceTon) {
    var results = [];
    try {
      var raw = eqToRaw(collAddr);
      var offset = 0;
      var pages = 0;
      while (pages < 5) {
        var resp = await fetch('https://tonapi.io/v2/nfts/collections/' + encodeURIComponent(raw) + '/items?limit=50&offset=' + offset, { headers: tonapiHdr() });
        if (!resp.ok) break;
        var data = await resp.json();
        if (!data.nft_items || data.nft_items.length === 0) break;
        var foundBelow = false;
        for (var i = 0; i < data.nft_items.length; i++) {
          var item = data.nft_items[i];
          if (!item.sale || !item.sale.price || item.sale.price.token_name !== 'TON') continue;
          var priceTon = Number(item.sale.price.value) / 1e9;
          if (priceTon <= maxPriceTon) {
            foundBelow = true;
            var meta = item.metadata || {};
            results.push({
              address:  item.address,
              name:     meta.name || item.address.slice(0, 12),
              priceTon: priceTon,
              saleAddr: item.sale.contract_address || ''
            });
          }
        }
        if (!foundBelow) break;
        offset += 50;
        pages++;
      }
    } catch(e) { /* return what we have */ }
    results.sort(function(a, b){ return a.priceTon - b.priceTon; });
    return results;
  }

  // Buy via GetGems sale contract (on-chain, no GetGems API needed)
  async function executeBuy(listing) {
    try {
      if (!listing.saleAddr) return { success: false, error: 'Нет адреса sale-контракта' };
      var opBuf = Buffer.alloc(4);
      opBuf.writeUInt32BE(0x474f26cc, 0);
      var txHash = await tonSend({
        mnemonic:      WALLET_MNEMONIC,
        to:            listing.saleAddr,
        amountNano:    String(Math.floor(listing.priceTon * 1e9) + 50000000),
        payloadBase64: opBuf.toString('base64')
      });
      return { success: true, txHash: txHash };
    } catch(e) {
      return { success: false, error: e.message || String(e) };
    }
  }

  // ── Загрузка состояния ────────────────────────────────────────────
  var today    = new Date().toISOString().slice(0, 10);
  var spentKey = 'daily_spent_' + today;

  var dailySpent = 0;
  try {
    var sv = getState(spentKey);
    dailySpent = parseFloat(String(sv !== null && sv !== undefined ? sv : '0')) || 0;
  } catch(e) { dailySpent = 0; }

  var positions = [];
  try {
    var pv = getState('positions');
    var ps = pv !== null && pv !== undefined ? (typeof pv === 'string' ? pv : JSON.stringify(pv)) : '[]';
    positions = JSON.parse(ps || '[]');
    if (!Array.isArray(positions)) positions = [];
  } catch(e) { positions = []; }

  var stats = { scans: 0, buys: 0, sells: 0, totalPnl: 0 };
  try {
    var stv = getState('stats');
    var sts = stv !== null && stv !== undefined ? (typeof stv === 'string' ? stv : JSON.stringify(stv)) : '';
    var parsed = JSON.parse(sts || '{}');
    if (parsed && typeof parsed === 'object') {
      stats.scans    = parsed.scans    || 0;
      stats.buys     = parsed.buys     || 0;
      stats.sells    = parsed.sells    || 0;
      stats.totalPnl = parsed.totalPnl || 0;
    }
  } catch(e) { /* use defaults */ }

  stats.scans++;
  console.log('NFT Arbitrage — скан #' + stats.scans + (REAL_MODE ? ' [REAL]' : walletBalance <= 0.1 ? ' [NO FUNDS]' : ' [SIM]'));
  console.log('   Кошелёк: ' + WALLET_ADDRESS.slice(0, 16) + '... | Баланс: ' + walletBalance.toFixed(3) + ' TON');
  console.log('   Коллекций: ' + COLLECTIONS.length + ' | Расход: ' + dailySpent.toFixed(2) + '/' + DAILY_LIMIT + ' TON');

  var opportunities = [];
  var actions = [];

  // ── Проверка позиций (стоп-лосс / тейк-профит) ───────────────────
  var updatedPos = [];
  for (var pi = 0; pi < positions.length; pi++) {
    var pos = positions[pi];
    try {
      var fl = await getFloor(pos.collectionAddr);
      if (fl === null) { updatedPos.push(pos); continue; }
      var targetSell = pos.boughtAt * (1 + SELL_MARKUP / 100);
      var stopLoss   = pos.boughtAt * 0.85;
      if (fl >= targetSell) {
        stats.sells++;
        stats.totalPnl += fl - pos.boughtAt;
        actions.push({ type: 'SELL', nft: pos.nftAddr, pnl: (fl - pos.boughtAt).toFixed(2) });
        if (AUTO_NOTIFY) await notify('SELL ' + pos.nftName + ' +' + (fl - pos.boughtAt).toFixed(2) + ' TON');
      } else if (fl <= stopLoss) {
        stats.sells++;
        stats.totalPnl += fl - pos.boughtAt;
        actions.push({ type: 'STOP_LOSS', nft: pos.nftAddr, pnl: (fl - pos.boughtAt).toFixed(2) });
        if (AUTO_NOTIFY) await notify('STOP-LOSS ' + pos.nftName + ' ' + (fl - pos.boughtAt).toFixed(2) + ' TON');
      } else {
        pos.currentFloor = fl;
        updatedPos.push(pos);
      }
    } catch(e) { updatedPos.push(pos); }
  }
  positions = updatedPos;

  // ── Сканирование коллекций ────────────────────────────────────────
  for (var ci = 0; ci < COLLECTIONS.length; ci++) {
    var collAddr = COLLECTIONS[ci];
    var collName = await getCollectionName(collAddr);
    console.log('   [' + collName + '] ' + collAddr.slice(0, 10) + '...');

    var floor = await getFloor(collAddr);
    if (floor === null) { console.log('     Floor: недоступен'); continue; }

    var threshold = floor * (1 - MIN_PROFIT / 100);
    var listings  = await scanListings(collAddr, Math.min(threshold, MAX_BUY_TON));
    console.log('     Floor: ' + floor.toFixed(2) + ' TON | Ниже порога (' + threshold.toFixed(2) + ' TON): ' + listings.length);

    for (var li = 0; li < listings.length; li++) {
      var listing = listings[li];
      var profitPct = ((floor - listing.priceTon) / listing.priceTon) * 100;
      var netProfit = floor - listing.priceTon - 0.15;
      if (netProfit <= 0) continue;

      opportunities.push({ collection: collName, nft: listing.address, name: listing.name, buyPrice: listing.priceTon, floor: floor, profitPct: profitPct.toFixed(1), netProfit: netProfit.toFixed(2) });

      var canSpend = (dailySpent + listing.priceTon) <= DAILY_LIMIT;
      var alreadyOwned = positions.some(function(p){ return p.nftAddr === listing.address; });

      if (canSpend && !alreadyOwned && listing.priceTon <= MAX_BUY_TON) {
        var buyOk = true;
        var txHash = null;
        if (REAL_MODE) {
          var res = await executeBuy(listing);
          if (res.success) {
            txHash = res.txHash;
            console.log('     REAL BUY: ' + listing.name + ' ' + listing.priceTon.toFixed(2) + ' TON | TX: ' + txHash);
          } else {
            buyOk = false;
            console.log('     BUY FAILED: ' + res.error);
            if (AUTO_NOTIFY) await notify('Ошибка покупки ' + listing.name + ': ' + res.error);
          }
        } else {
          console.log('     SIM BUY: ' + listing.name + ' ' + listing.priceTon.toFixed(2) + ' TON (+' + profitPct.toFixed(1) + '%)');
        }
        if (buyOk) {
          dailySpent += listing.priceTon;
          stats.buys++;
          positions.push({ nftAddr: listing.address, nftName: listing.name, collectionAddr: collAddr, boughtAt: listing.priceTon, boughtTs: Date.now(), currentFloor: floor, txHash: txHash });
          actions.push({ type: REAL_MODE ? 'BUY_REAL' : 'BUY_SIM', name: listing.name, price: listing.priceTon, floor: floor, profitPct: profitPct.toFixed(1) });
          if (AUTO_NOTIFY) await notify((REAL_MODE ? 'КУПЛЕНО ' : 'SIM BUY ') + listing.name + '\\nЦена: ' + listing.priceTon.toFixed(2) + ' TON | Floor: ' + floor.toFixed(2) + ' TON\\nПотенциал: +' + profitPct.toFixed(1) + '%' + (txHash ? '\\nTX: ' + txHash : '') + '\\nРасход: ' + dailySpent.toFixed(2) + '/' + DAILY_LIMIT + ' TON');
        }
      }
    }
  }

  // ── Сохранение состояния ─────────────────────────────────────────
  setState(spentKey,   String(dailySpent));
  setState('positions', JSON.stringify(positions));
  setState('stats',     JSON.stringify(stats));

  var report = { scan: stats.scans, date: today, collections: COLLECTIONS.length, opportunities: opportunities.length, actions: actions.length, openPositions: positions.length, dailySpent: dailySpent.toFixed(2), totalPnl: stats.totalPnl.toFixed(2), mode: REAL_MODE ? 'REAL' : 'SIM' };

  if (opportunities.length > 0 && AUTO_NOTIFY && actions.length === 0) {
    await notify('NFT Арбитраж: ' + opportunities.length + ' возможностей\\nЛучшая: ' + opportunities[0].name + ' (+' + opportunities[0].profitPct + '%)\\nОткрытых позиций: ' + positions.length);
  }

  console.log('Итог: ' + opportunities.length + ' возм., ' + actions.length + ' действий, PnL: ' + stats.totalPnl.toFixed(2) + ' TON');
  return { success: true, result: report };
}`;

const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'ton_agent', password: 'changeme',
  database: 'ton_agent_platform'
});

// Update code AND trigger_config with new collection
pool.query(
  `UPDATE builder_bot.agents
   SET code = $1,
       trigger_config = jsonb_set(
         COALESCE(trigger_config, '{}'),
         '{config,TARGET_COLLECTIONS}',
         $2::jsonb
       ),
       updated_at = NOW()
   WHERE id = 98
   RETURNING id, name`,
  [newCode, JSON.stringify(JSON.stringify(NEW_COLLECTION))]
).then(r => {
  if (r.rows.length === 0) console.error('No rows updated!');
  else console.log('✅ Fixed agent #' + r.rows[0].id + ' "' + r.rows[0].name + '"');
  return pool.end();
}).catch(e => { console.error('DB error:', e.message); process.exit(1); });
