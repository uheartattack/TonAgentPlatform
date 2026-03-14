// Update agent #98 code: replace GetGems API scanning with TonAPI
const { Pool } = require('pg');

const newCode = `async function agent(context) {
  // ── Конфиг ───────────────────────────────────────────────────────
  const TONAPI_KEY   = context.config.TONAPI_KEY || '';
  const GG_KEY       = context.config.GETGEMS_API_KEY || '';
  const COLLECTIONS  = (context.config.TARGET_COLLECTIONS || '').split(',').map(s => s.trim()).filter(Boolean);
  const MAX_BUY_TON  = parseFloat(context.config.MAX_BUY_PRICE_TON  || '50');
  const MIN_PROFIT   = parseFloat(context.config.MIN_PROFIT_PCT      || '15');
  const DAILY_LIMIT  = parseFloat(context.config.DAILY_LIMIT_TON     || '200');
  const SELL_MARKUP  = parseFloat(context.config.SELL_MARKUP_PCT     || '20');
  const AUTO_NOTIFY  = (context.config.AUTO_NOTIFY || 'true') === 'true';

  // ── Кошелёк: авто-создание если не задан ─────────────────────────
  let WALLET_MNEMONIC = (context.config.WALLET_MNEMONIC || '').trim();
  let WALLET_ADDRESS  = '';

  const storedMnemonic = getState('wallet_mnemonic');
  if (!WALLET_MNEMONIC && storedMnemonic) WALLET_MNEMONIC = String(storedMnemonic);

  if (!WALLET_MNEMONIC) {
    const newWallet = await tonCreateWallet();
    WALLET_MNEMONIC = newWallet.mnemonic;
    WALLET_ADDRESS  = newWallet.address;
    setState('wallet_mnemonic', WALLET_MNEMONIC);
    setState('wallet_address',  WALLET_ADDRESS);
    console.log('Кошелёк создан:', WALLET_ADDRESS);
    if (AUTO_NOTIFY) {
      await notify('Арбитражник создал кошелёк!\\n\\nАдрес: ' + WALLET_ADDRESS + '\\n\\nПополни кошелёк TON для старта. Дневной лимит: ' + DAILY_LIMIT + ' TON');
    }
    return { success: true, result: { action: 'wallet_created', address: WALLET_ADDRESS } };
  }

  const storedAddr = getState('wallet_address');
  WALLET_ADDRESS = WALLET_ADDRESS || (storedAddr ? String(storedAddr) : '') || await tonGetWalletAddress(WALLET_MNEMONIC);
  const walletBalance = await tonGetBalance(WALLET_ADDRESS);
  const REAL_MODE = WALLET_MNEMONIC.split(' ').filter(function(w) { return w.length > 0; }).length >= 12 && walletBalance > 0.1;

  if (COLLECTIONS.length === 0) {
    return { success: false, error: 'TARGET_COLLECTIONS не указаны. Укажите адреса коллекций через запятую.' };
  }

  // ── TonAPI helper ─────────────────────────────────────────────────
  var tonapiKey = TONAPI_KEY || process.env.TONAPI_KEY || '';
  function tonapiHeaders() {
    return tonapiKey ? { 'Authorization': 'Bearer ' + tonapiKey } : {};
  }

  // EQ/UQ → raw 0:hex conversion (for TonAPI collection endpoints)
  function eqToRaw(addr) {
    try {
      var b64 = addr.replace(/-/g, '+').replace(/_/g, '/');
      var buf = Buffer.from(b64, 'base64');
      var workchain = buf[1] === 0xff ? -1 : buf[1];
      var hash = buf.slice(2, 34).toString('hex');
      return workchain + ':' + hash;
    } catch(e) { return addr; }
  }

  // Get floor price via TonAPI (replaces GetGems API)
  async function getFloor(collAddr) {
    try {
      var raw = eqToRaw(collAddr);
      var url = 'https://tonapi.io/v2/nfts/collections/' + encodeURIComponent(raw) + '/items?limit=50&offset=0';
      var resp = await fetch(url, { headers: tonapiHeaders() });
      if (!resp.ok) return null;
      var data = await resp.json();
      if (!data.nft_items) return null;
      var prices = [];
      for (var i = 0; i < data.nft_items.length; i++) {
        var item = data.nft_items[i];
        if (item.sale && item.sale.price && item.sale.price.token_name === 'TON') {
          prices.push(Number(item.sale.price.value) / 1e9);
        }
      }
      if (prices.length === 0) return null;
      prices.sort(function(a, b) { return a - b; });
      return prices[0];
    } catch(e) { return null; }
  }

  // Scan listings via TonAPI (replaces GetGems API)
  async function scanListings(collAddr, maxPriceTon) {
    var results = [];
    try {
      var raw = eqToRaw(collAddr);
      var offset = 0;
      var pages = 0;
      while (pages < 5) {
        var url = 'https://tonapi.io/v2/nfts/collections/' + encodeURIComponent(raw) + '/items?limit=50&offset=' + offset;
        var resp = await fetch(url, { headers: tonapiHeaders() });
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
              address:     item.address,
              name:        meta.name || item.address.slice(0, 12),
              priceTon:    priceTon,
              saleAddr:    item.sale.contract_address || '',
              saleVersion: 3
            });
          }
        }
        if (!foundBelow) break;
        offset += 50;
        pages++;
      }
    } catch(e) { /* ignore, return what we have */ }
    results.sort(function(a, b) { return a.priceTon - b.priceTon; });
    return results;
  }

  // Buy via GetGems sale contract directly (on-chain, no API needed)
  async function executeBuy(listing) {
    try {
      if (!listing.saleAddr) return { success: false, error: 'Нет адреса sale-контракта' };
      // GetGems FixPrice sale: send priceNano + 0.05 TON fee with OP_BUY opcode
      var priceNano = String(Math.floor(listing.priceTon * 1e9));
      var feeNano   = String(50000000); // 0.05 TON
      var totalNano = String(Math.floor(listing.priceTon * 1e9) + 50000000);
      // OP_BUY = 0x474f26cc — standard GetGems buy payload
      var opBuf = Buffer.alloc(4);
      opBuf.writeUInt32BE(0x474f26cc, 0);
      var payloadB64 = opBuf.toString('base64');
      var txHash = await tonSend({
        mnemonic:      WALLET_MNEMONIC,
        to:            listing.saleAddr,
        amountNano:    totalNano,
        payloadBase64: payloadB64
      });
      return { success: true, txHash: txHash };
    } catch(e) {
      return { success: false, error: e.message || String(e) };
    }
  }

  // ── Состояние ────────────────────────────────────────────────────
  var today    = new Date().toISOString().slice(0, 10);
  var spentKey = 'daily_spent_' + today;
  var posKey   = 'positions';
  var statsKey = 'stats';

  var dailySpent;
  try {
    var sv = getState(spentKey);
    dailySpent = parseFloat((sv !== null && sv !== undefined ? String(sv) : '') || '0') || 0;
  } catch(e) { dailySpent = 0; }

  var positions;
  try {
    var pv = getState(posKey);
    var ps = (pv !== null && pv !== undefined) ? (typeof pv === 'string' ? pv : JSON.stringify(pv)) : '[]';
    positions = JSON.parse(ps || '[]');
    if (!Array.isArray(positions)) positions = [];
  } catch(e) { positions = []; }

  var stats;
  try {
    var stv = getState(statsKey);
    var sts = (stv !== null && stv !== undefined) ? (typeof stv === 'string' ? stv : JSON.stringify(stv)) : '';
    stats = JSON.parse(sts || '{"scans":0,"buys":0,"sells":0,"totalPnl":0}');
    if (typeof stats !== 'object' || stats === null) stats = {scans:0,buys:0,sells:0,totalPnl:0};
  } catch(e) { stats = {scans:0,buys:0,sells:0,totalPnl:0}; }

  stats.scans = (stats.scans || 0) + 1;
  console.log('NFT Arbitrage Pro — скан #' + stats.scans + (REAL_MODE ? ' [REAL]' : walletBalance <= 0.1 ? ' [NO FUNDS]' : ' [SIM]'));
  console.log('   Кошелёк: ' + WALLET_ADDRESS.slice(0,16) + '... | Баланс: ' + walletBalance.toFixed(3) + ' TON');
  console.log('   Коллекций: ' + COLLECTIONS.length + ' | Лимит: ' + dailySpent.toFixed(2) + '/' + DAILY_LIMIT + ' TON');

  var opportunities = [];
  var actions       = [];

  // ── Проверка открытых позиций (авто-продажа) ─────────────────────
  var updatedPositions = [];
  for (var pi = 0; pi < positions.length; pi++) {
    var pos = positions[pi];
    try {
      var floor = await getFloor(pos.collectionAddr);
      if (floor === null) { updatedPositions.push(pos); continue; }
      var targetSell = pos.boughtAt * (1 + SELL_MARKUP / 100);
      var stopLoss   = pos.boughtAt * 0.85;
      if (floor >= targetSell) {
        var pnl = floor - pos.boughtAt;
        stats.sells++;
        stats.totalPnl += pnl;
        actions.push({ type: 'SELL', nft: pos.nftAddr, buyPrice: pos.boughtAt, sellPrice: floor, pnl: pnl.toFixed(2) });
        if (AUTO_NOTIFY) await notify('SELL ' + pos.nftName + '\\nКуплено: ' + pos.boughtAt.toFixed(2) + ' TON\\nFloor: ' + floor.toFixed(2) + ' TON\\nPnL: +' + pnl.toFixed(2) + ' TON');
        console.log('Тейк-профит: ' + pos.nftName + ' +' + pnl.toFixed(2) + ' TON');
      } else if (floor <= stopLoss) {
        var pnl2 = floor - pos.boughtAt;
        stats.sells++;
        stats.totalPnl += pnl2;
        actions.push({ type: 'STOP_LOSS', nft: pos.nftAddr, buyPrice: pos.boughtAt, sellPrice: floor, pnl: pnl2.toFixed(2) });
        if (AUTO_NOTIFY) await notify('STOP-LOSS ' + pos.nftName + '\\nPnL: ' + pnl2.toFixed(2) + ' TON');
        console.log('Стоп-лосс: ' + pos.nftName + ' ' + pnl2.toFixed(2) + ' TON');
      } else {
        pos.currentFloor = floor;
        pos.unrealizedPnl = (floor - pos.boughtAt).toFixed(2);
        updatedPositions.push(pos);
      }
    } catch(e) { updatedPositions.push(pos); }
  }
  positions = updatedPositions;

  // ── Скан коллекций (поиск возможностей) ──────────────────────────
  for (var ci = 0; ci < COLLECTIONS.length; ci++) {
    var collAddr = COLLECTIONS[ci];
    console.log('   Сканирую коллекцию: ' + collAddr.slice(0,10) + '...');

    var floor2 = await getFloor(collAddr);
    if (floor2 === null) { console.log('   Не удалось получить floor (TonAPI)'); continue; }

    var threshold = floor2 * (1 - MIN_PROFIT / 100);
    var listings  = await scanListings(collAddr, Math.min(threshold, MAX_BUY_TON));
    console.log('   Floor: ' + floor2.toFixed(2) + ' TON | Листингов < порога: ' + listings.length);

    for (var li = 0; li < listings.length; li++) {
      var listing = listings[li];
      var profitPct = ((floor2 - listing.priceTon) / listing.priceTon) * 100;
      var profitTon = floor2 - listing.priceTon;
      var gasEst    = 0.15;
      var netProfit = profitTon - gasEst;
      if (netProfit <= 0) continue;

      opportunities.push({
        collection: collAddr,
        nft: listing.address,
        name: listing.name,
        buyPrice: listing.priceTon,
        floor: floor2,
        profitPct: profitPct.toFixed(1),
        netProfit: netProfit.toFixed(2)
      });

      var canSpend    = (dailySpent + listing.priceTon) <= DAILY_LIMIT;
      var alreadyOwned = positions.some(function(p) { return p.nftAddr === listing.address; });

      if (canSpend && !alreadyOwned && listing.priceTon <= MAX_BUY_TON) {
        var txHash = null;
        var buyOk  = true;

        if (REAL_MODE) {
          var buyResult = await executeBuy(listing);
          if (buyResult.success) {
            txHash = buyResult.txHash;
            console.log('REAL BUY TX: ' + txHash);
          } else {
            buyOk = false;
            console.log('BUY FAILED: ' + buyResult.error);
            if (AUTO_NOTIFY) await notify('Ошибка покупки ' + listing.name + '\\n' + buyResult.error);
          }
        } else {
          console.log('SIM BUY: ' + listing.name + ' ' + listing.priceTon.toFixed(2) + ' TON');
        }

        if (buyOk) {
          dailySpent += listing.priceTon;
          stats.buys++;
          positions.push({
            nftAddr:        listing.address,
            nftName:        listing.name,
            collectionAddr: collAddr,
            boughtAt:       listing.priceTon,
            boughtTs:       Date.now(),
            currentFloor:   floor2,
            txHash:         txHash
          });
          actions.push({
            type:      REAL_MODE ? 'BUY_REAL' : 'BUY_SIM',
            nft:       listing.address,
            name:      listing.name,
            price:     listing.priceTon,
            floor:     floor2,
            profitPct: profitPct.toFixed(1),
            txHash:    txHash
          });
          if (AUTO_NOTIFY) {
            await notify((REAL_MODE ? 'КУПЛЕНО ' : 'SIM BUY ') + listing.name + '\\nЦена: ' + listing.priceTon.toFixed(2) + ' TON\\nFloor: ' + floor2.toFixed(2) + ' TON\\nПотенциал: +' + profitPct.toFixed(1) + '%' + (txHash ? '\\nTX: ' + txHash : '') + '\\nРасход за день: ' + dailySpent.toFixed(2) + '/' + DAILY_LIMIT + ' TON');
          }
        }
      }
    }
  }

  // ── Сохранение состояния ─────────────────────────────────────────
  setState(spentKey,  String(dailySpent));
  setState(posKey,    JSON.stringify(positions));
  setState(statsKey,  JSON.stringify(stats));

  // ── Итоговый отчёт ───────────────────────────────────────────────
  var report = {
    scan:          stats.scans,
    date:          today,
    collections:   COLLECTIONS.length,
    opportunities: opportunities.length,
    actions:       actions.length,
    openPositions: positions.length,
    dailySpent:    dailySpent.toFixed(2),
    totalPnl:      (stats.totalPnl || 0).toFixed(2),
    buysTotal:     stats.buys,
    sellsTotal:    stats.sells,
    topOpps:       opportunities.slice(0, 5)
  };

  if (opportunities.length > 0 && AUTO_NOTIFY && actions.length === 0) {
    await notify('NFT Арбитраж: ' + opportunities.length + ' возможностей найдено\\nЛучшая: ' + opportunities[0].name + ' (' + opportunities[0].profitPct + '%)\\nОткрытых позиций: ' + positions.length + '\\nPnL всего: ' + (stats.totalPnl || 0).toFixed(2) + ' TON');
  }

  console.log('Итог скана: ' + report.opportunities + ' возможностей, ' + report.actions + ' действий, PnL: ' + report.totalPnl + ' TON');
  return { success: true, result: report };
}`;

const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'ton_agent', password: 'changeme',
  database: 'ton_agent_platform'
});

pool.query(
  "UPDATE builder_bot.agents SET code = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name",
  [newCode, 98]
).then(r => {
  if (r.rows.length === 0) console.error('No rows updated!');
  else console.log('Updated agent #' + r.rows[0].id + ' "' + r.rows[0].name + '"');
  return pool.end();
}).catch(e => { console.error('DB error:', e.message); process.exit(1); });
