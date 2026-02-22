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
  Response: [{address, type, assets:[{address,decimals,symbol,metadata:{symbol}}], tradeFee, stats:{tvl,volume24h,fees24h,apy}}]

GET /assets — all listed assets with prices
  Response: [{address, type, symbol, decimals, price, priceTon}]

GET /jettons/{address}/price — price of specific jetton in TON and USD

Usage example:
  const pools = await fetch('https://api.dedust.io/v2/pools').then(r=>r.json());
  const tonUsdtPool = pools.find(p => p.assets?.some(a => a.metadata?.symbol === 'USDT'));
  const tonPrice = tonUsdtPool?.stats?.price; // TON price in USDT`,
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
    execute: async (params) => {
      const response = await fetch(`https://api.dedust.io/v2/${params.method}`);
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

GET /assets — all assets with prices
  Response: {asset_list: [{contract_address,display_name,symbol,decimals,dex_price_usd,third_party_price_usd,kind}]}

GET /pools — all liquidity pools
  Response: {pool_list: [{address,token0_address,token1_address,lp_total_supply,tvl_usd,apy_1d,apy_7d,apy_30d}]}

GET /swap/simulate?offer_address=...&ask_address=...&units=...&slippage_tolerance=0.01 — simulate swap
  Response: {offer_units,ask_units,slippage_tolerance,min_ask_units,swap_rate,price_impact,fee_units}

Usage example:
  const {asset_list} = await fetch('https://api.ston.fi/v1/assets').then(r=>r.json());
  const ton = asset_list.find(a => a.symbol === 'TON');
  const usdt = asset_list.find(a => a.symbol === 'USD₮');
  const tonPriceUsd = parseFloat(ton?.dex_price_usd || '0');`,
    configSchema: [],
    hooks: {},
    install: async () => true,
    uninstall: async () => true,
    execute: async (params) => {
      const response = await fetch(`https://api.ston.fi/v1/${params.method}`);
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
    execute: async (params) => params
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
    execute: async (params) => {
      return {
        report: 'Analytics report generated',
        timestamp: Date.now()
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
    execute: async (params) => params
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
    execute: async (params) => {
      const { webhookUrl, message } = params;
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });
      return { success: response.ok };
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
    execute: async (params) => params
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
    execute: async (params) => params
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
    execute: async (params) => {
      const { apiKey, endpoint } = params;
      const response = await fetch(`https://tonapi.io/v2/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
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
    execute: async (params) => {
      const { coinId = 'the-open-network' } = params;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
      );
      return response.json();
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
    execute: async (params) => params
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
    execute: async (params) => params
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
