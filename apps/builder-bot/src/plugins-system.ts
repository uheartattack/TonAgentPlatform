// ============================================
// Plugin System for TON Agent Platform
// Маркетплейс плагинов
// ============================================

// Типы плагинов
export type PluginType = 
  | 'defi'        // DeFi протоколы
  | 'analytics'   // Аналитика и отчёты
  | 'notification' // Уведомления (Email, SMS, Discord)
  | 'data-source' // Источники данных (CoinGecko, TonAPI)
  | 'security'    // Безопасность и аудит
  | 'automation'  // Автоматизация задач
  | 'social'      // Социальные сети
  | 'storage';    // Хранилище данных

// Интерфейс плагина
export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  type: PluginType;
  icon: string;
  price: number; // в TON, 0 = бесплатно
  isInstalled: boolean;

  // Метаданные
  tags: string[];
  rating: number;
  downloads: number;
  lastUpdated: Date;

  // SKILL.md — подробная документация для AI при генерации кода агентов
  // Паттерн из OpenClaw: каждый плагин описывает свои API так, чтобы AI
  // знал точный синтаксис вызовов, форматы ответов и примеры использования
  skillDoc?: string;

  // Конфигурация
  configSchema: PluginConfigSchema[];

  // Хуки (точки расширения)
  hooks: PluginHooks;

  // Методы
  install: () => Promise<boolean>;
  uninstall: () => Promise<boolean>;
  execute: (params: any) => Promise<any>;
}

// Схема конфигурации плагина
export interface PluginConfigSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'array';
  label: string;
  description: string;
  required: boolean;
  default?: any;
  options?: { value: string; label: string }[]; // для select
}

// Хуки плагина (точки расширения)
export interface PluginHooks {
  // Вызывается при создании агента
  onAgentCreate?: (agentData: any) => Promise<any>;
  
  // Вызывается перед выполнением агента
  onAgentBeforeRun?: (agentId: number, context: any) => Promise<any>;
  
  // Вызывается после выполнения агента
  onAgentAfterRun?: (agentId: number, result: any) => Promise<any>;
  
  // Вызывается при получении данных
  onDataFetch?: (source: string, data: any) => Promise<any>;
  
  // Вызывается для отправки уведомления
  onNotify?: (message: string, options: any) => Promise<boolean>;
}

// ===== ПЛАГИНЫ =====

// DeFi Plugins
export const defiPlugins: Plugin[] = [
  {
    id: 'dedust-connector',
    name: 'DeDust DEX Connector',
    description: 'Подключение к DeDust DEX для свапов и ликвидности',
    version: '1.0.0',
    author: 'TON Agent Team',
    type: 'defi',
    icon: '💧',
    price: 0,
    isInstalled: false,
    tags: ['dex', 'swap', 'liquidity', 'dedust'],
    rating: 4.8,
    downloads: 1250,
    lastUpdated: new Date('2024-02-15'),
    skillDoc: `## 💧 DeDust DEX — Pools & Prices
API base: https://api.dedust.io/v2  (no auth required)

GET /pools — all liquidity pools
  Response: [{address, type, assets:[{type,address,decimals,metadata:{symbol}}], reserves:["nanoTON","nanoUSDT"], stats:{tvl,volume24h}}]

GET /assets — all listed assets with prices in USD
  Response: [{address, type, symbol, decimals, price}]  ← price is USD string

USDT jetton address: EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
TON native type: "native"

CORRECT usage to get TON price in USD:
  // Method 1: fastest — assets endpoint
  const assets = await fetch('https://api.dedust.io/v2/assets').then(r=>r.json());
  const tonAsset = assets.find(a => a.type === 'native');
  const tonPriceUsd = parseFloat(tonAsset?.price || '0');

  // Method 2: from pool reserves (more real-time)
  const pools = await fetch('https://api.dedust.io/v2/pools').then(r=>r.json());
  const USDT = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  const pool = pools.find(p =>
    (p.assets?.[0]?.type === 'native' && p.assets?.[1]?.address === USDT) ||
    (p.assets?.[1]?.type === 'native' && p.assets?.[0]?.address === USDT)
  );
  if (pool && pool.reserves) {
    const tonFirst = pool.assets[0].type === 'native';
    const tonReserve  = Number(tonFirst ? pool.reserves[0] : pool.reserves[1]) / 1e9;
    const usdtReserve = Number(tonFirst ? pool.reserves[1] : pool.reserves[0]) / 1e6;
    const tonPriceUsd = usdtReserve / tonReserve;
  }

NOTE: Do NOT use pool.stats.price — this field does not exist. Use the methods above.`,
    configSchema: [
      {
        name: 'apiEndpoint',
        type: 'string',
        label: 'API Endpoint',
        description: 'DeDust API endpoint',
        required: false,
        default: 'https://api.dedust.io/v2'
      }
    ],
    hooks: {
      onDataFetch: async (source, data) => {
        if (source === 'dedust') {
          // Обработка данных DeDust
          return { processed: true, data };
        }
        return data;
      }
    },
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const method = params.method || 'pools';
      const url = `https://api.dedust.io/v2/${method}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`DeDust API ${response.status}: ${await response.text()}`);
      return response.json();
    }
  },
  
  {
    id: 'stonfi-connector',
    name: 'STON.fi Connector',
    description: 'Подключение к STON.fi DEX',
    version: '1.0.0',
    author: 'TON Agent Team',
    type: 'defi',
    icon: '🗿',
    price: 0,
    isInstalled: false,
    tags: ['dex', 'swap', 'stonfi'],
    rating: 4.6,
    downloads: 980,
    lastUpdated: new Date('2024-02-10'),
    skillDoc: `## 🗿 STON.fi DEX — Swap Rates & Pools
API base: https://api.ston.fi/v1  (no auth required)

GET /assets — all assets with prices (RECOMMENDED for price checks)
  Response: {asset_list: [{contract_address,display_name,symbol,decimals,dex_price_usd,third_party_price_usd,kind}]}

GET /pools — all liquidity pools
  Response: {pool_list: [{address,token0_address,token1_address,lp_total_supply,tvl_usd,apy_1d,apy_7d,apy_30d}]}

POST /swap/simulate — simulate swap (MUST be POST, not GET — GET returns 405 Method Not Allowed)
  Body: {offer_address, ask_address, units, slippage_tolerance}
  Response: {offer_units,ask_units,swap_rate,price_impact,fee_units}

TON native address: EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c
USDT address: EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs

CORRECT usage to get TON price from STON.fi:
  // Method 1: from assets (simplest, no swap needed)
  const resp = await fetch('https://api.ston.fi/v1/assets').then(r=>r.json());
  const ton = (resp.asset_list || []).find(a => a.symbol === 'TON');
  const tonPriceUsd = parseFloat(ton?.dex_price_usd || ton?.third_party_price_usd || '0');

  // Method 2: swap simulate (POST!)
  const sim = await fetch('https://api.ston.fi/v1/swap/simulate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      offer_address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
      ask_address:   'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      units: '1000000000',
      slippage_tolerance: '0.01'
    })
  }).then(r=>r.json());
  const usdtPerTon = parseFloat(sim.swap_rate || '0');

NOTE: /swap/simulate is POST-only. Always use Method 1 (assets) for simple price checks.`,
    configSchema: [],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const method = params.method || 'assets';
      const isPost = method.includes('simulate') || params.post;
      const url = `https://api.ston.fi/v1/${method}`;
      const opts: RequestInit = isPost
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params.body || {}) }
        : { headers: { 'Accept': 'application/json' } };
      const response = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`STON.fi API ${response.status}: ${await response.text()}`);
      return response.json();
    }
  },
  
  {
    id: 'evaa-lending',
    name: 'EVAA Lending Protocol',
    description: 'Интеграция с EVAA для кредитования и займов',
    version: '1.0.0',
    author: 'EVAA Team',
    type: 'defi',
    icon: '🏦',
    price: 0.5, // 0.5 TON
    isInstalled: false,
    tags: ['lending', 'borrow', 'supply', 'evaa'],
    rating: 4.5,
    downloads: 450,
    lastUpdated: new Date('2024-02-01'),
    skillDoc: `## 🏦 EVAA Lending — Rates & Positions
API base: https://app.evaa.finance/api (or use EVAA SDK)

Key public data via TonAPI (no auth):
  GET https://tonapi.io/v2/accounts/EQB3ncyBUTjZUA5EnFKR5_EnOMI9V1tTEAAPaiU71gc4TiUt/events?limit=20
  — EVAA master contract events (supply/borrow/liquidation)

Alternative: fetch EVAA contract state directly
  const state = await fetch('https://tonapi.io/v2/accounts/EQB3nc...EVAA_CONTRACT').then(r=>r.json());
  // state.storage — contract data

Typical use: monitor borrow rates, alert on liquidation events
Note: EVAA doesn't have a public REST API — use TonAPI events for monitoring`,
    configSchema: [
      {
        name: 'apiKey',
        type: 'string',
        label: 'API Key',
        description: 'EVAA API ключ',
        required: true
      }
    ],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      // Track whale transactions via TonCenter public API
      const address = params.address || params.watchAddress;
      if (!address) throw new Error('whale-tracker: address is required');
      const minTon = parseFloat(params.minAmount || params.minTon || '1000');
      const limit  = Math.min(parseInt(params.limit || '50', 10), 100);

      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(address)}&limit=${limit}&to_lt=0`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`TonCenter ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json() as any;
      const txs = (data.result || []) as any[];
      const whales = txs.filter(tx => {
        const inVal  = parseInt(tx.in_msg?.value  || '0', 10) / 1e9;
        const outVal = (tx.out_msgs || []).reduce((s: number, m: any) => s + parseInt(m.value || '0', 10) / 1e9, 0);
        return Math.max(inVal, outVal) >= minTon;
      }).map(tx => ({
        hash:      tx.transaction_id?.hash,
        lt:        tx.transaction_id?.lt,
        utime:     tx.utime,
        inTon:     (parseInt(tx.in_msg?.value  || '0', 10) / 1e9).toFixed(2),
        outTon:    ((tx.out_msgs || []).reduce((s: number, m: any) => s + parseInt(m.value || '0', 10) / 1e9, 0)).toFixed(2),
        from:      tx.in_msg?.source,
        message:   tx.in_msg?.message,
      }));

      return { address, minTon, totalChecked: txs.length, whalesFound: whales.length, whales };
    }
  }
];

// Analytics Plugins
export const analyticsPlugins: Plugin[] = [
  {
    id: 'ton-stat-analytics',
    name: 'TON Statistics Pro',
    description: 'Расширенная аналитика TON блокчейна',
    version: '2.0.0',
    author: 'TON Stats',
    type: 'analytics',
    icon: '📊',
    price: 1, // 1 TON
    isInstalled: false,
    tags: ['analytics', 'statistics', 'charts', 'reports'],
    rating: 4.9,
    downloads: 2100,
    lastUpdated: new Date('2024-02-18'),
    skillDoc: `## 📊 TON Statistics Pro — Blockchain Analytics
Free public endpoints (no auth):

TonAPI v2:
  GET https://tonapi.io/v2/rates?tokens=TON&currencies=USD,RUB,EUR
    Response: {rates:{TON:{prices:{USD,RUB,EUR},diff_24h:{USD},diff_7d:{USD}}}}
  GET https://tonapi.io/v2/jettons?limit=20 — top jettons
    Response: {jettons:[{address,name,symbol,total_supply,holders_count,admin,verification}]}
  GET https://tonapi.io/v2/nfts/collections?limit=20 — NFT collections
    Response: {nft_collections:[{address,name,approx_items_count,owner}]}
  GET https://tonapi.io/v2/blockchain/masterchain-head — current block

TonCenter:
  GET https://toncenter.com/api/v2/getMasterchainInfo — masterchain state

Usage example:
  const rates = await fetch('https://tonapi.io/v2/rates?tokens=TON&currencies=USD,RUB').then(r=>r.json());
  const tonUsd = rates.rates?.TON?.prices?.USD;
  const change24h = rates.rates?.TON?.diff_24h?.USD;`,
    configSchema: [
      {
        name: 'reportFormat',
        type: 'select',
        label: 'Формат отчётов',
        description: 'Формат экспорта отчётов',
        required: false,
        default: 'json',
        options: [
          { value: 'json', label: 'JSON' },
          { value: 'csv', label: 'CSV' },
          { value: 'pdf', label: 'PDF' }
        ]
      }
    ],
    hooks: {
      onAgentAfterRun: async (agentId, result) => {
        // Сохраняем аналитику
        console.log('Analytics saved for agent', agentId);
        return result;
      }
    },
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      // Fetch TON price and top jettons from TonAPI (no auth required)
      const [ratesRes, jettonsRes] = await Promise.all([
        fetch('https://tonapi.io/v2/rates?tokens=TON&currencies=USD,RUB,EUR', { signal: AbortSignal.timeout(8000) }),
        fetch('https://tonapi.io/v2/jettons?limit=10', { signal: AbortSignal.timeout(8000) }),
      ]);
      const rates: any   = ratesRes.ok   ? await ratesRes.json()   : {};
      const jettons: any = jettonsRes.ok ? await jettonsRes.json() : {};
      return {
        tonPrice: rates.rates?.TON?.prices?.USD || null,
        tonChange24h: rates.rates?.TON?.diff_24h?.USD || null,
        topJettons: (jettons.jettons || []).slice(0, 5).map((j: any) => ({
          name: j.name, symbol: j.symbol, holders: j.holders_count,
        })),
        timestamp: Date.now(),
      };
    }
  },
  
  {
    id: 'whale-tracker',
    name: 'Whale Tracker',
    description: 'Отслеживание крупных транзакций (китов)',
    version: '1.5.0',
    author: 'CryptoTrack',
    type: 'analytics',
    icon: '🐋',
    price: 2, // 2 TON
    isInstalled: false,
    tags: ['whale', 'tracking', 'alerts', 'big-transactions'],
    rating: 4.7,
    downloads: 1500,
    lastUpdated: new Date('2024-02-12'),
    skillDoc: `## 🐋 Whale Tracker — Monitor Large TON Transactions
Track big movers using TonCenter public API (no auth):

GET https://toncenter.com/api/v2/getTransactions?address={addr}&limit=20&to_lt=0
  Response: {ok, result: [{transaction_id:{lt,hash}, utime, in_msg:{source,destination,value,message},
    out_msgs:[{source,destination,value,message}]}]}

Convert nanotons → TON: value / 1e9

Usage example:
  const minTon = parseFloat(config.MIN_AMOUNT || '10000');
  const watchAddr = config.WATCH_ADDRESS || '{{WATCH_ADDRESS}}';
  const r = await fetch('https://toncenter.com/api/v2/getTransactions?address=' + watchAddr + '&limit=20').then(x=>x.json());
  const whales = (r.result||[]).filter(tx => {
    const inVal = parseInt(tx.in_msg?.value || '0') / 1e9;
    const outVal = (tx.out_msgs||[]).reduce((s,m) => s + parseInt(m.value||'0')/1e9, 0);
    return Math.max(inVal, outVal) >= minTon;
  });`,
    configSchema: [
      {
        name: 'minAmount',
        type: 'number',
        label: 'Минимальная сумма (TON)',
        description: 'Минимальная сумма для отслеживания',
        required: false,
        default: 1000
      }
    ],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const watchAddr = params.address || params.watchAddress || params.watch_address;
      if (!watchAddr) throw new Error('whale-tracker: address is required');
      const minTon = parseFloat(params.minAmount || params.min_amount || '1000');
      const limit = Math.min(parseInt(params.limit || '50'), 100);

      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(watchAddr)}&limit=${limit}&to_lt=0&archival=false`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`TonCenter ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const data = await response.json() as any;
      if (!data.ok) throw new Error(`TonCenter error: ${data.error || 'unknown'}`);

      const txs = data.result || [];
      const whales = txs
        .map((tx: any) => {
          const inVal = parseInt(tx.in_msg?.value || '0') / 1e9;
          const outVal = (tx.out_msgs || []).reduce((s: number, m: any) => s + parseInt(m.value || '0') / 1e9, 0);
          const maxVal = Math.max(inVal, outVal);
          if (maxVal < minTon) return null;
          return {
            hash: tx.transaction_id?.hash,
            time: new Date(tx.utime * 1000).toISOString(),
            direction: inVal >= outVal ? 'incoming' : 'outgoing',
            amount_ton: Math.round(maxVal * 100) / 100,
            from: tx.in_msg?.source || null,
            to: tx.in_msg?.destination || null,
            comment: tx.in_msg?.message || null,
          };
        })
        .filter(Boolean);

      return {
        address: watchAddr,
        minTon,
        totalChecked: txs.length,
        whalesFound: whales.length,
        whales: whales.slice(0, 20),
      };
    }
  }
];

// Notification Plugins
export const notificationPlugins: Plugin[] = [
  {
    id: 'discord-notifier',
    name: 'Discord Notifier',
    description: 'Отправка уведомлений в Discord канал',
    version: '1.0.0',
    author: 'TON Agent Team',
    type: 'notification',
    icon: '💬',
    price: 0,
    isInstalled: false,
    tags: ['discord', 'notification', 'webhook'],
    rating: 4.5,
    downloads: 800,
    lastUpdated: new Date('2024-01-20'),
    skillDoc: `## 💬 Discord Notifier — Send messages to Discord
Requires: config.DISCORD_WEBHOOK (Discord webhook URL from Server Settings → Integrations → Webhooks)

Simple text message:
  await fetch(config.DISCORD_WEBHOOK || '{{DISCORD_WEBHOOK}}', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ content: 'Your message here' })
  });

Rich embed message:
  await fetch(config.DISCORD_WEBHOOK || '{{DISCORD_WEBHOOK}}', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      embeds: [{
        title: '🚨 Alert Title',
        description: 'Detailed message',
        color: 0xff0000,  // red=ff0000, green=00ff00, blue=0000ff
        fields: [{name: 'TON Price', value: '$5.23', inline: true}],
        timestamp: new Date().toISOString()
      }]
    })
  });`,
    configSchema: [
      {
        name: 'webhookUrl',
        type: 'string',
        label: 'Webhook URL',
        description: 'Discord webhook URL',
        required: true
      }
    ],
    hooks: {
      onNotify: async (message, options) => {
        // Реальная отправка в Discord
        return true;
      }
    },
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const webhookUrl = params.webhookUrl || params.webhook_url;
      if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        throw new Error('discord-notifier: invalid or missing webhookUrl (must start with https://discord.com/api/webhooks/)');
      }

      // Build payload — supports plain text or rich embed
      let payload: any;
      if (params.embed) {
        payload = {
          embeds: [{
            title:       params.embed.title || params.title || '🔔 TON Agent Alert',
            description: params.embed.description || params.message || '',
            color:       params.embed.color || 0x3498db,
            fields:      params.embed.fields || [],
            timestamp:   new Date().toISOString(),
          }],
        };
      } else {
        payload = { content: params.message || params.content || '' };
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord webhook ${response.status}: ${text.slice(0, 200)}`);
      }
      return { success: true, statusCode: response.status };
    }
  },
  
  {
    id: 'email-notifier',
    name: 'Email Alerts',
    description: 'Отправка email уведомлений',
    version: '1.0.0',
    author: 'TON Agent Team',
    type: 'notification',
    icon: '📧',
    price: 0.3, // 0.3 TON
    isInstalled: false,
    tags: ['email', 'smtp', 'notification'],
    rating: 4.3,
    downloads: 600,
    lastUpdated: new Date('2024-01-15'),
    skillDoc: `## 📧 Email Alerts — Send email notifications
Note: Direct SMTP requires a server. For agent code, use REST email APIs instead.

Option 1 — Mailgun REST API (free tier available):
  const res = await fetch('https://api.mailgun.net/v3/' + (config.MAILGUN_DOMAIN||'{{MAILGUN_DOMAIN}}') + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa('api:' + (config.MAILGUN_KEY||'{{MAILGUN_KEY}}')) },
    body: new URLSearchParams({
      from: 'agent@' + (config.MAILGUN_DOMAIN||'{{MAILGUN_DOMAIN}}'),
      to: config.EMAIL_TO || '{{EMAIL_TO}}',
      subject: 'TON Agent Alert',
      text: 'Your alert message here'
    })
  });

Option 2 — EmailJS (free, no server needed):
  Use a webhook to your own email service endpoint.

Option 3 — Prefer Discord/Slack webhooks — simpler, free, no setup.`,
    configSchema: [
      {
        name: 'smtpHost',
        type: 'string',
        label: 'SMTP Host',
        description: 'SMTP сервер',
        required: true
      },
      {
        name: 'smtpUser',
        type: 'string',
        label: 'SMTP User',
        description: 'SMTP пользователь',
        required: true
      },
      {
        name: 'smtpPass',
        type: 'string',
        label: 'SMTP Password',
        description: 'SMTP пароль',
        required: true
      }
    ],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      // Supports Mailgun REST API (most reliable for agents)
      const domain = params.mailgunDomain || params.smtpHost;
      const apiKey = params.mailgunKey || params.smtpPass;
      const to = params.to || params.emailTo || params.smtpUser;
      const subject = params.subject || 'TON Agent Alert';
      const text = params.message || params.text || params.body || '';

      if (!domain || !apiKey || !to) {
        throw new Error('email-notifier: mailgunDomain (or smtpHost), mailgunKey (or smtpPass), and to (or smtpUser) are required');
      }

      // Mailgun REST API
      const mailgunUrl = `https://api.mailgun.net/v3/${domain}/messages`;
      const formData = new URLSearchParams({
        from: params.from || `agent@${domain}`,
        to,
        subject,
        text,
      });

      const response = await fetch(mailgunUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
        },
        body: formData,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Mailgun ${response.status}: ${errText.slice(0, 200)}`);
      }
      const result = await response.json() as any;
      return { success: true, id: result.id, message: result.message };
    }
  },

  {
    id: 'slack-notifier',
    name: 'Slack Integration',
    description: 'Отправка уведомлений в Slack',
    version: '1.0.0',
    author: 'TON Agent Team',
    type: 'notification',
    icon: '💼',
    price: 0,
    isInstalled: false,
    tags: ['slack', 'webhook', 'notification'],
    rating: 4.4,
    downloads: 550,
    lastUpdated: new Date('2024-01-25'),
    skillDoc: `## 💼 Slack Integration — Send messages to Slack
Requires: config.SLACK_WEBHOOK (Slack Incoming Webhook URL from api.slack.com/apps)

Simple message:
  await fetch(config.SLACK_WEBHOOK || '{{SLACK_WEBHOOK}}', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ text: 'Your message here' })
  });

Rich Block Kit message:
  await fetch(config.SLACK_WEBHOOK || '{{SLACK_WEBHOOK}}', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🚨 TON Alert' } },
        { type: 'section', text: { type: 'mrkdwn', text: '*TON Price*: $5.23 (+2.1%)' } },
        { type: 'divider' }
      ]
    })
  });`,
    configSchema: [
      {
        name: 'webhookUrl',
        type: 'string',
        label: 'Slack Webhook URL',
        description: 'Slack incoming webhook URL',
        required: true
      }
    ],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const webhookUrl = params.webhookUrl || params.webhook_url;
      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        throw new Error('slack-notifier: invalid or missing webhookUrl (must start with https://hooks.slack.com/)');
      }

      let payload: any;
      if (params.blocks) {
        // Rich Block Kit message
        payload = { blocks: params.blocks };
        if (params.text) payload.text = params.text; // fallback text
      } else {
        // Simple text message
        payload = { text: params.message || params.text || params.content || '' };
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack webhook ${response.status}: ${text.slice(0, 200)}`);
      }
      return { success: true, statusCode: response.status };
    }
  }
];

// Data Source Plugins
export const dataSourcePlugins: Plugin[] = [
  {
    id: 'tonapi-pro',
    name: 'TonAPI Pro',
    description: 'Расширенный доступ к TonAPI с высоким rate limit',
    version: '1.0.0',
    author: 'TON Foundation',
    type: 'data-source',
    icon: '🔌',
    price: 3, // 3 TON/месяц
    isInstalled: false,
    tags: ['tonapi', 'api', 'data', 'pro'],
    rating: 4.9,
    downloads: 3000,
    lastUpdated: new Date('2024-02-20'),
    skillDoc: `## 🔌 TonAPI Pro — Rich TON Blockchain Data
API base: https://tonapi.io/v2
Auth: Bearer token (optional — add header if config.TONAPI_KEY is set)

ALWAYS use this pattern:
  const apiKey = config.TONAPI_KEY || '';
  const h = apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
  const fetch_ = (url) => fetch(url, {headers: h}).then(r => r.json());

Key endpoints:
  fetch_('https://tonapi.io/v2/accounts/{addr}')
    → {address, balance (nanotons), status, interfaces:[]}

  fetch_('https://tonapi.io/v2/accounts/{addr}/events?limit=20')
    → {events:[{lt,timestamp,actions:[{type,TonTransfer:{sender,recipient,amount,comment}}]}]}

  fetch_('https://tonapi.io/v2/accounts/{addr}/jettons/balances')
    → {balances:[{balance, price:{prices:{USD}}, jetton:{name,symbol,decimals,image}}]}

  fetch_('https://tonapi.io/v2/accounts/{addr}/nfts?limit=50')
    → {nft_items:[{address, collection:{name,address}, metadata:{name,image,attributes}}]}

  fetch_('https://tonapi.io/v2/rates?tokens=TON&currencies=USD,RUB,EUR')
    → {rates:{TON:{prices:{USD,RUB,EUR}, diff_24h:{USD}, diff_7d:{USD}}}}

  fetch_('https://tonapi.io/v2/jettons?limit=20')
    → {jettons:[{address,name,symbol,decimals,total_supply,holders_count,verification}]}`,
    configSchema: [
      {
        name: 'apiKey',
        type: 'string',
        label: 'API Key',
        description: 'TonAPI Pro ключ',
        required: true
      }
    ],
    hooks: {
      onDataFetch: async (source, data) => {
        // Расширенная обработка данных
        return data;
      }
    },
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const apiKey = params.apiKey || params.api_key || '';
      const endpoint = params.endpoint || 'rates?tokens=TON&currencies=USD';
      if (!endpoint) throw new Error('tonapi-pro: endpoint is required');
      const headers: any = { 'Accept': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(`https://tonapi.io/v2/${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`TonAPI ${response.status}: ${text.slice(0, 200)}`);
      }
      return response.json();
    }
  },
  
  {
    id: 'coingecko-pro',
    name: 'CoinGecko Pro',
    description: 'Данные о ценах криптовалют от CoinGecko',
    version: '1.0.0',
    author: 'CoinGecko',
    type: 'data-source',
    icon: '🦎',
    price: 0,
    isInstalled: false,
    tags: ['coingecko', 'price', 'crypto', 'api'],
    rating: 4.8,
    downloads: 5000,
    lastUpdated: new Date('2024-02-15'),
    skillDoc: `## 🦎 CoinGecko — Crypto Prices (FREE, no auth)
API base: https://api.coingecko.com/api/v3

GET /simple/price?ids=the-open-network&vs_currencies=usd,rub,eur&include_24hr_change=true&include_market_cap=true
  Multiple: ids=bitcoin,ethereum,the-open-network,binancecoin,solana
  Response: {'the-open-network': {usd: 5.23, rub: 480.5, usd_24h_change: 2.1, usd_market_cap: 18e9}}

GET /coins/markets?vs_currency=usd&ids=the-open-network&order=market_cap_desc
  Response: [{id,symbol,name,current_price,market_cap,price_change_percentage_24h,
    total_volume,high_24h,low_24h,circulating_supply}]

GET /coins/{id}/market_chart?vs_currency=usd&days=7&interval=daily
  Response: {prices:[[timestamp_ms, price],...], market_caps:[[ts,cap],...]}

GET /simple/supported_vs_currencies — list of supported fiat currencies

Popular coin IDs: the-open-network, bitcoin, ethereum, binancecoin, solana, toncoin
Note: Free tier has rate limit ~50 calls/min. For higher limits add ?x_cg_api_key= to URL`,
    configSchema: [
      {
        name: 'apiKey',
        type: 'string',
        label: 'API Key (опционально)',
        description: 'CoinGecko API ключ для Pro версии',
        required: false
      }
    ],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const coinId      = params.coinId || params.coin_id || 'the-open-network';
      const currencies  = params.currencies || 'usd,rub,eur';
      const apiKey      = params.apiKey || params.api_key || '';

      const qs = new URLSearchParams({
        ids:                    coinId,
        vs_currencies:          currencies,
        include_24hr_change:    'true',
        include_market_cap:     'true',
        include_24hr_vol:       'true',
      });
      if (apiKey) qs.set('x_cg_api_key', apiKey);

      const url = `https://api.coingecko.com/api/v3/simple/price?${qs}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`CoinGecko ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = await response.json() as any;
      const coin = data[coinId];
      if (!coin) throw new Error(`CoinGecko: coin "${coinId}" not found`);

      return {
        coinId,
        usd:           coin.usd,
        rub:           coin.rub,
        eur:           coin.eur,
        usd_24h_change: coin.usd_24h_change,
        usd_market_cap: coin.usd_market_cap,
        usd_24h_vol:    coin.usd_24h_vol,
      };
    }
  }
];

// Security Plugins
export const securityPlugins: Plugin[] = [
  {
    id: 'drain-detector',
    name: 'Drain Attack Detector',
    description: 'Обнаружение drain-атак в коде агентов',
    version: '1.0.0',
    author: 'TON Security',
    type: 'security',
    icon: '🛡️',
    price: 0,
    isInstalled: true, // Уже встроен
    tags: ['security', 'drain', 'detection', 'audit'],
    rating: 5.0,
    downloads: 10000,
    lastUpdated: new Date('2024-02-20'),
    skillDoc: `## 🛡️ Drain Attack Detector — Built-in Security
This plugin is always active — all agent code is automatically scanned before execution.

IMPORTANT rules for safe agent code:
  ✅ Use fetch() only for READ operations (GET requests) by default
  ✅ If sending TON/tokens — require user configuration (config.WALLET_ADDRESS + config.PRIVATE_KEY)
  ✅ Never hardcode private keys or mnemonics in code
  ✅ Validate amounts before sending: if (amount > MAX_AMOUNT) throw new Error('Amount too large')
  ✅ Use whitelist for destination addresses: ALLOWED_ADDRESSES.includes(recipient)

  Patterns that WILL be blocked:
  ❌ Sending to addresses not configured by user
  ❌ Private keys as literals in code
  ❌ Unconditional drain of wallet balance`,
    configSchema: [],
    hooks: {
      onAgentBeforeRun: async (agentId, context) => {
        // Сканируем код на drain-атаки
        console.log('Security scan for agent', agentId);
        return context;
      }
    },
    install: async () => true,
    uninstall: async () => false, // Нельзя удалить
    execute: async (params: any) => {
      const code = params.code || params.agentCode || '';
      if (!code) throw new Error('drain-detector: code is required for scanning');

      const issues: { severity: string; pattern: string; description: string; line?: number }[] = [];
      const lines = code.split('\n');

      // Check each line for dangerous patterns
      const dangerousPatterns = [
        { regex: /private[_\s]*key|mnemonic|seed[_\s]*phrase/i, severity: 'critical', desc: 'Hardcoded private key or mnemonic detected' },
        { regex: /['"`][A-Za-z0-9]{48,}['"`]/, severity: 'high', desc: 'Possible hardcoded secret or key literal' },
        { regex: /transfer\s*\(\s*['"`](?:EQ|UQ|0:)[^'"]+['"`]/i, severity: 'critical', desc: 'Hardcoded transfer destination address' },
        { regex: /\.sendTransaction|\.send\s*\(|internal\s*\(/i, severity: 'warning', desc: 'Transaction sending detected — ensure amounts are validated' },
        { regex: /process\.env/i, severity: 'warning', desc: 'Environment variable access' },
        { regex: /eval\s*\(|Function\s*\(/i, severity: 'high', desc: 'Dynamic code execution (eval/Function)' },
        { regex: /require\s*\(\s*['"`]child_process|exec\s*\(|spawn\s*\(/i, severity: 'critical', desc: 'System command execution' },
        { regex: /fs\s*\.\s*(writeFile|readFile|unlink|rmdir)/i, severity: 'high', desc: 'Filesystem access detected' },
        { regex: /\.balance\s*[*/]\s*[0-9.]+|getBalance.*send/i, severity: 'high', desc: 'Balance-proportional drain pattern' },
      ];

      for (let i = 0; i < lines.length; i++) {
        for (const pat of dangerousPatterns) {
          if (pat.regex.test(lines[i])) {
            issues.push({ severity: pat.severity, pattern: pat.regex.source, description: pat.desc, line: i + 1 });
          }
        }
      }

      const criticalCount = issues.filter(i => i.severity === 'critical').length;
      const highCount = issues.filter(i => i.severity === 'high').length;
      const safe = criticalCount === 0 && highCount === 0;

      return {
        safe,
        totalIssues: issues.length,
        critical: criticalCount,
        high: highCount,
        warnings: issues.filter(i => i.severity === 'warning').length,
        issues: issues.slice(0, 20),
        verdict: safe ? 'Code appears safe' : `Found ${criticalCount} critical and ${highCount} high severity issues`,
      };
    }
  },
  
  {
    id: 'contract-auditor',
    name: 'Smart Contract Auditor',
    description: 'Аудит смарт-контрактов перед взаимодействием',
    version: '1.0.0',
    author: 'TON Security',
    type: 'security',
    icon: '🔍',
    price: 1.5, // 1.5 TON
    isInstalled: false,
    tags: ['audit', 'contract', 'security', 'verification'],
    rating: 4.7,
    downloads: 1200,
    lastUpdated: new Date('2024-02-05'),
    skillDoc: `## 🔍 Smart Contract Auditor — Verify before interacting
Check any contract before sending transactions:

Via TonAPI (free):
  const addr = config.CONTRACT_ADDRESS || '{{CONTRACT_ADDRESS}}';
  const info = await fetch('https://tonapi.io/v2/accounts/' + addr).then(r=>r.json());
  // info.status: 'active'|'uninit'|'frozen'
  // info.interfaces: ['wallet_v4r2', 'jetton_master', 'nft_collection', etc]
  // info.get_methods: list of available contract methods

Check if verified on TON Verifier:
  const verified = await fetch('https://tonapi.io/v2/accounts/' + addr + '/dns').then(r=>r.json());

Red flags to check:
  - status !== 'active' → contract not deployed
  - Empty interfaces → unknown contract type
  - Very new contract (check first_transaction via events)`,
    configSchema: [],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params: any) => {
      const address = params.address || params.contractAddress || params.contract_address;
      if (!address) throw new Error('contract-auditor: address is required');

      const apiKey = params.apiKey || params.tonapi_key || '';
      const headers: any = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

      // Fetch account info and events in parallel
      const [accountRes, eventsRes] = await Promise.all([
        fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`, {
          headers, signal: AbortSignal.timeout(10000),
        }),
        fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/events?limit=5`, {
          headers, signal: AbortSignal.timeout(10000),
        }),
      ]);

      if (!accountRes.ok) {
        throw new Error(`TonAPI ${accountRes.status}: ${(await accountRes.text()).slice(0, 200)}`);
      }
      const account = await accountRes.json() as any;
      const events = eventsRes.ok ? (await eventsRes.json() as any) : { events: [] };

      const redFlags: string[] = [];
      const greenFlags: string[] = [];

      // Check status
      if (account.status !== 'active') {
        redFlags.push(`Contract status: ${account.status} (not active/deployed)`);
      } else {
        greenFlags.push('Contract is active and deployed');
      }

      // Check interfaces
      const interfaces = account.interfaces || [];
      if (interfaces.length === 0) {
        redFlags.push('No known interfaces — unknown contract type');
      } else {
        greenFlags.push(`Known interfaces: ${interfaces.join(', ')}`);
      }

      // Check balance
      const balanceTon = parseInt(account.balance || '0') / 1e9;
      if (balanceTon < 0.01 && account.status === 'active') {
        redFlags.push(`Very low balance: ${balanceTon.toFixed(4)} TON`);
      }

      // Check age from events
      const eventList = events.events || [];
      if (eventList.length > 0) {
        const oldest = eventList[eventList.length - 1];
        const ageMs = Date.now() - (oldest.timestamp || 0) * 1000;
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        if (ageDays < 7) {
          redFlags.push(`Very new contract (${ageDays} days old)`);
        } else {
          greenFlags.push(`Contract age: ${ageDays} days`);
        }
      }

      // Check if wallet type
      const isWallet = interfaces.some((i: string) => i.startsWith('wallet_'));
      if (isWallet) {
        greenFlags.push('Standard wallet contract');
      }

      const riskScore = redFlags.length === 0 ? 'LOW' : redFlags.length <= 2 ? 'MEDIUM' : 'HIGH';

      return {
        address,
        status: account.status,
        balance_ton: Math.round(balanceTon * 1000) / 1000,
        interfaces,
        riskScore,
        redFlags,
        greenFlags,
        recentEvents: eventList.length,
        verdict: riskScore === 'LOW'
          ? 'Contract appears safe for interaction'
          : riskScore === 'MEDIUM'
            ? 'Some concerns — review red flags before interacting'
            : 'High risk — multiple red flags detected, proceed with extreme caution',
      };
    }
  }
];

// ===== Plugin Manager =====

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private installedPlugins: Set<string> = new Set();
  
  constructor() {
    // Регистрируем все плагины
    [
      ...defiPlugins,
      ...analyticsPlugins,
      ...notificationPlugins,
      ...dataSourcePlugins,
      ...securityPlugins
    ].forEach(plugin => {
      this.plugins.set(plugin.id, plugin);
    });
  }
  
  // Получить все плагины
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  // Получить плагины по типу
  getPluginsByType(type: PluginType): Plugin[] {
    return this.getAllPlugins().filter(p => p.type === type);
  }
  
  // Получить плагин по ID
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }
  
  // Установить плагин
  async installPlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    
    const success = await plugin.install();
    if (success) {
      plugin.isInstalled = true;
      this.installedPlugins.add(id);
    }
    return success;
  }
  
  // Удалить плагин
  async uninstallPlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    
    const success = await plugin.uninstall();
    if (success) {
      plugin.isInstalled = false;
      this.installedPlugins.delete(id);
    }
    return success;
  }
  
  // Выполнить плагин
  async executePlugin(id: string, params: any): Promise<any> {
    const plugin = this.plugins.get(id);
    if (!plugin || !plugin.isInstalled) {
      return { error: 'Plugin not found or not installed' };
    }
    return plugin.execute(params);
  }
  
  // Вызвать хук
  async callHook(hookName: keyof PluginHooks, ...args: any[]): Promise<any[]> {
    const results = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.isInstalled && plugin.hooks[hookName]) {
        try {
          const result = await (plugin.hooks[hookName] as Function)(...args);
          results.push(result);
        } catch (error) {
          console.error(`Hook ${hookName} failed for plugin ${plugin.id}:`, error);
        }
      }
    }
    return results;
  }
  
  // Получить статистику
  getStats() {
    const all = this.getAllPlugins();
    return {
      total: all.length,
      installed: all.filter(p => p.isInstalled).length,
      byType: {
        defi: this.getPluginsByType('defi').length,
        analytics: this.getPluginsByType('analytics').length,
        notification: this.getPluginsByType('notification').length,
        'data-source': this.getPluginsByType('data-source').length,
        security: this.getPluginsByType('security').length,
      },
      totalDownloads: all.reduce((sum, p) => sum + p.downloads, 0),
      averageRating: all.reduce((sum, p) => sum + p.rating, 0) / all.length
    };
  }
}

// Singleton
let pluginManager: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!pluginManager) {
    pluginManager = new PluginManager();
  }
  return pluginManager;
}

// ─── OpenClaw SKILL.md pattern ──────────────────────────────────────────────
// Возвращает строку с документацией всех доступных плагинов для инъекции
// в системный промпт при генерации кода агентов.
// Аналог bundled-context.ts + SKILL.md injection из OpenClaw.
export function getSkillDocsForCodeGeneration(pluginIds?: string[]): string {
  const pm = getPluginManager();
  const allPlugins = pm.getAllPlugins();
  const plugins = pluginIds
    ? allPlugins.filter(p => pluginIds.includes(p.id))
    : allPlugins;

  const docsWithContent = plugins
    .filter(p => p.skillDoc && p.skillDoc.trim().length > 0)
    .map(p => p.skillDoc!.trim());

  if (docsWithContent.length === 0) return '';

  return `\n━━━ AVAILABLE PLUGIN APIs (use these in agent code) ━━━\n\n${docsWithContent.join('\n\n')}\n`;
}

export default getPluginManager;
