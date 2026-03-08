// ============================================
// Agent Templates for TON Agent Platform
// Все шаблоны в одном файле
// ============================================

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ton' | 'monitoring' | 'finance' | 'utility' | 'social';
  icon: string;
  tags: string[];
  code: string;
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'ai_agent';
  triggerConfig: Record<string, any>;
  placeholders: Array<{
    name: string;
    description: string;
    example: string;
    required: boolean;
    question?: string;   // Текст вопроса для wizard
    options?: string[];  // Если задан — показывать кнопки выбора вместо текстового ввода
  }>;
}

// ===== БАЗОВЫЕ ШАБЛОНЫ =====

const tonBalanceChecker: AgentTemplate = {
  id: 'ton-balance-checker',
  name: 'TON Balance Checker',
  description: 'Проверяет баланс TON кошелька и показывает детальную информацию',
  category: 'ton',
  icon: '💎',
  tags: ['ton', 'balance', 'wallet', 'checker'],
  triggerType: 'manual',
  triggerConfig: {},
  code: `
async function agent(context) {
  const walletAddress = context.config.WALLET_ADDRESS || context.wallet;
  
  if (!walletAddress) {
    return { 
      success: false, 
      error: 'WALLET_ADDRESS не указан. Укажите адрес кошелька в настройках.' 
    };
  }
  
  try {
    console.log('🔍 Проверяю баланс кошелька:', walletAddress);
    
    const response = await fetch(
      'https://toncenter.com/api/v2/getAddressBalance?address=' + encodeURIComponent(walletAddress)
    );
    
    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Unknown API error');
    }
    
    const balanceNano = data.result;
    const balanceTon = parseInt(balanceNano) / 1e9;
    const shortAddr = walletAddress.slice(0, 8) + '...' + walletAddress.slice(-6);

    console.log('✅ Баланс получен:', balanceTon.toFixed(4), 'TON');

    await notify(
      '💎 *TON Balance Check*\\n\\n' +
      '👛 Кошелёк: \`' + shortAddr + '\`\\n' +
      '💰 Баланс:  \`' + balanceTon.toFixed(4) + ' TON\`'
    );

    return {
      wallet: shortAddr,
      balance: balanceTon.toFixed(4) + ' TON',
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'WALLET_ADDRESS',
      description: 'Адрес TON кошелька (например: EQD...)',
      example: 'EQD...',
      required: true
    }
  ]
};

const tonPriceMonitor: AgentTemplate = {
  id: 'ton-price-monitor',
  name: 'TON Price Monitor',
  description: 'Мониторит цену TON и уведомляет о изменениях',
  category: 'finance',
  icon: '📈',
  tags: ['ton', 'price', 'monitor', 'crypto'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 300000 },
  code: `
async function agent(context) {
  const targetPrice = parseFloat(context.config.TARGET_PRICE) || 0;
  const condition = context.config.CONDITION || 'above';

  try {
    console.log('📊 Получаю цену TON с CoinGecko...');

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=the-open-network&vs_currencies=usd' +
      '&include_24hr_change=true&include_24hr_vol=true'
    );
    if (!response.ok) throw new Error('CoinGecko ' + response.status);

    const data = await response.json();
    const ton  = data['the-open-network'];
    const price    = ton.usd;
    const change   = ton.usd_24h_change;
    const vol      = ton.usd_24h_vol;

    const arrow    = change >= 0 ? '📈' : '📉';
    const sign     = change >= 0 ? '+' : '';
    const volM     = (vol / 1_000_000).toFixed(1);
    const timeUTC  = new Date().toUTCString().slice(17, 22);

    // Красивое уведомление — всегда отправляем
    const msg =
      '💎 *TON/USD — Price Update*\\n\\n' +
      '💰 Цена:  \`$' + price.toFixed(3) + '\`\\n' +
      arrow + ' 24ч:    \`' + sign + change.toFixed(2) + '%\`\\n' +
      '📊 Объём: \`$' + volM + 'M\`\\n' +
      '⏰ ' + timeUTC + ' UTC';

    await notify(msg);
    console.log('✅ Уведомление отправлено: $' + price.toFixed(3));

    // Алерт при достижении цели
    if (targetPrice > 0) {
      const hit = (condition === 'above' && price >= targetPrice)
               || (condition === 'below' && price <= targetPrice);
      if (hit) {
        const dir = condition === 'above' ? '≥' : '≤';
        await notify(
          '🚨 *Целевая цена достигнута\\!*\\n\\n' +
          'TON ' + dir + ' $' + targetPrice + '\\n' +
          'Сейчас: \`$' + price.toFixed(3) + '\`'
        );
      }
    }

    return { success: true, price: price.toFixed(3), change24h: sign + change.toFixed(2) + '%' };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'TARGET_PRICE',
      description: 'Целевая цена для уведомления (0 = без уведомлений)',
      example: '3.50',
      required: false
    },
    {
      name: 'CONDITION',
      description: 'Условие: above (выше) или below (ниже)',
      example: 'above',
      required: false
    }
  ]
};

const lowBalanceAlert: AgentTemplate = {
  id: 'low-balance-alert',
  name: 'Low Balance Alert',
  description: 'Проверяет баланс и уведомляет когда он падает ниже порога',
  category: 'ton',
  icon: '🔔',
  tags: ['ton', 'alert', 'balance', 'monitoring'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 600000 },
  code: `
async function agent(context) {
  const walletAddress = context.config.WALLET_ADDRESS;
  const minBalance = parseFloat(context.config.MIN_BALANCE) || 10;
  
  if (!walletAddress) {
    return { 
      success: false, 
      error: 'WALLET_ADDRESS не указан' 
    };
  }
  
  try {
    console.log('🔍 Проверяю баланс:', walletAddress);
    console.log('⚠️ Минимальный порог:', minBalance, 'TON');
    
    const response = await fetch(
      'https://toncenter.com/api/v2/getAddressBalance?address=' + encodeURIComponent(walletAddress)
    );
    
    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Unknown API error');
    }
    
    const balanceNano = data.result;
    const balanceTon = parseInt(balanceNano) / 1e9;
    const shortAddr = walletAddress.slice(0, 8) + '...' + walletAddress.slice(-6);
    const isLow = balanceTon < minBalance;

    console.log('💰 Текущий баланс:', balanceTon.toFixed(4), 'TON', isLow ? '⚠️ НИЗКИЙ!' : '✅ OK');

    if (isLow) {
      await notify(
        '🔔 *Low Balance Alert*\\n\\n' +
        '🚨 Баланс ниже порога!\\n' +
        '👛 Кошелёк: \`' + shortAddr + '\`\\n' +
        '💰 Баланс:  \`' + balanceTon.toFixed(4) + ' TON\`\\n' +
        '⚠️ Порог:   \`' + minBalance + ' TON\`'
      );
    } else {
      console.log('✅ Баланс в норме');
    }

    return {
      wallet: shortAddr,
      balance: balanceTon.toFixed(4) + ' TON',
      threshold: minBalance + ' TON',
      status: isLow ? '⚠️ низкий' : '✅ норма',
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'WALLET_ADDRESS',
      description: 'Адрес TON кошелька',
      example: 'EQD...',
      required: true
    },
    {
      name: 'MIN_BALANCE',
      description: 'Минимальный баланс для уведомления (TON)',
      example: '10',
      required: true
    }
  ]
};

const dailyTonReport: AgentTemplate = {
  id: 'daily-ton-report',
  name: 'Daily TON Report',
  description: 'Ежедневный отчёт по кошельку TON с балансом и ценой',
  category: 'ton',
  icon: '📅',
  tags: ['ton', 'daily', 'report', 'balance', 'price'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 86400000 },
  code: `
async function agent(context) {
  const walletAddress = context.config.WALLET_ADDRESS;
  
  if (!walletAddress) {
    return { 
      success: false, 
      error: 'WALLET_ADDRESS не указан' 
    };
  }
  
  try {
    console.log('📅 Формирую ежедневный отчёт...');
    
    const balanceResponse = await fetch(
      'https://toncenter.com/api/v2/getAddressBalance?address=' + encodeURIComponent(walletAddress)
    );
    
    const balanceData = await balanceResponse.json();
    const balanceTon = parseInt(balanceData.result) / 1e9;
    
    const priceResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,rub&include_24hr_change=true'
    );
    
    const priceData = await priceResponse.json();
    const priceUsd = priceData['the-open-network'].usd;
    const priceRub = priceData['the-open-network'].rub;
    const change24h = priceData['the-open-network'].usd_24h_change;
    
    const portfolioUsd = balanceTon * priceUsd;
    const portfolioRub = balanceTon * priceRub;
    const arrow = change24h >= 0 ? '📈' : '📉';
    const sign  = change24h >= 0 ? '+' : '';
    const date  = new Date().toISOString().split('T')[0];
    const shortAddr = walletAddress.slice(0, 8) + '...' + walletAddress.slice(-6);

    console.log('✅ Отчёт сформирован:', balanceTon.toFixed(4), 'TON = $' + portfolioUsd.toFixed(2));

    await notify(
      '📅 *Daily TON Report — ' + date + '*\\n\\n' +
      '👛 \`' + shortAddr + '\`\\n\\n' +
      '💎 *Баланс:*\\n' +
      '   \`' + balanceTon.toFixed(4) + ' TON\`\\n' +
      '   \`$' + portfolioUsd.toFixed(2) + '\` · \`₽' + portfolioRub.toFixed(0) + '\`\\n\\n' +
      arrow + ' *Цена TON:* \`$' + priceUsd.toFixed(3) + '\` \\(' + sign + change24h.toFixed(2) + '%\\)'
    );

    return {
      date,
      wallet: shortAddr,
      balance: balanceTon.toFixed(4) + ' TON',
      value_usd: '$' + portfolioUsd.toFixed(2),
      ton_price: '$' + priceUsd.toFixed(3),
      change_24h: sign + change24h.toFixed(2) + '%',
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'WALLET_ADDRESS',
      description: 'Адрес TON кошелька',
      example: 'EQD...',
      required: true
    }
  ]
};

const cryptoPortfolio: AgentTemplate = {
  id: 'crypto-portfolio',
  name: 'Crypto Portfolio',
  description: 'Отслеживает портфель криптовалют с ценами и балансами',
  category: 'finance',
  icon: '💰',
  tags: ['crypto', 'portfolio', 'price', 'bitcoin', 'ethereum'],
  triggerType: 'manual',
  triggerConfig: {},
  code: `
async function agent(context) {
  const coins = (context.config.COINS || 'bitcoin,ethereum,the-open-network').split(',');
  const amounts = (context.config.AMOUNTS || '0,0,0').split(',').map(a => parseFloat(a) || 0);
  
  try {
    console.log('💰 Получаю данные портфеля...');
    console.log('📊 Монеты:', coins.join(', '));
    
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=' + coins.join(',') + '&vs_currencies=usd&include_24hr_change=true'
    );
    
    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }
    
    const data = await response.json();
    
    const portfolio = [];
    let totalUsd = 0;
    
    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i].trim();
      const amount = amounts[i] || 0;
      const coinData = data[coin];
      
      if (coinData) {
        const price = coinData.usd;
        const change24h = coinData.usd_24h_change;
        const value = amount * price;
        totalUsd += value;
        
        portfolio.push({
          coin: coin,
          amount: amount,
          price: price.toFixed(4),
          value: value.toFixed(2),
          change24h: (change24h || 0).toFixed(2) + '%'
        });
      }
    }
    
    console.log('✅ Портфель:', portfolio.length, 'монет, $' + totalUsd.toFixed(2));

    // Формируем красивую таблицу
    let lines = '💰 *Crypto Portfolio*\\n\\n';
    portfolio.forEach(function(p) {
      var arrow = parseFloat(p.change24h) >= 0 ? '🟢' : '🔴';
      var name = p.coin.replace('the-open-network', 'TON').replace('bitcoin', 'BTC').replace('ethereum', 'ETH');
      lines += arrow + ' \`' + name.toUpperCase() + '\`  \`$' + p.price + '\`  ' + p.change24h + '\\n';
      if (p.amount > 0) lines += '   кол-во: ' + p.amount + ' · стоимость: \`$' + p.value + '\`\\n';
    });
    lines += '\\n💵 Итого: \`$' + totalUsd.toFixed(2) + '\`';
    await notify(lines);

    return {
      coins: portfolio.length + ' шт',
      total_usd: '$' + totalUsd.toFixed(2),
      top: portfolio[0] ? portfolio[0].coin.replace('the-open-network','TON') + ' $' + portfolio[0].price : '—',
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'COINS',
      description: 'Список монет через запятую',
      example: 'bitcoin,ethereum,the-open-network',
      required: false
    },
    {
      name: 'AMOUNTS',
      description: 'Количество каждой монеты через запятую',
      example: '0.5,2,100',
      required: false
    }
  ]
};

const websiteMonitor: AgentTemplate = {
  id: 'website-monitor',
  name: 'Website Monitor',
  description: 'Проверяет доступность сайта и уведомляет о проблемах',
  category: 'utility',
  icon: '🌐',
  tags: ['website', 'monitor', 'uptime', 'alert'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 300000 },
  code: `
async function agent(context) {
  const url = context.config.WEBSITE_URL;
  const expectedStatus = parseInt(context.config.EXPECTED_STATUS) || 200;
  const timeout = parseInt(context.config.TIMEOUT) || 10000;
  
  if (!url) {
    return { 
      success: false, 
      error: 'WEBSITE_URL не указан' 
    };
  }
  
  try {
    console.log('🌐 Проверяю доступность:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const isUp = response.status === expectedStatus;
    const icon = isUp ? '✅' : '⚠️';
    const timeUTC = new Date().toUTCString().slice(17, 22);

    if (isUp) {
      console.log('✅ Сайт доступен:', response.status);
    } else {
      console.warn('⚠️ Статус отличается:', response.status, '(ожидалось', expectedStatus + ')');
      await notify(
        '🌐 *Website Monitor*\\n\\n' +
        '⚠️ Статус изменился!\\n' +
        '🔗 \`' + url + '\`\\n' +
        '📊 Статус: \`' + response.status + '\` (ожидался ' + expectedStatus + ')\\n' +
        '⏰ ' + timeUTC + ' UTC'
      );
    }

    return { url: url, status: response.status, isUp: isUp ? 'online' : 'degraded', checked: timeUTC + ' UTC' };
  } catch (error) {
    console.error('❌ Сайт недоступен:', error.message);
    const timeUTC = new Date().toUTCString().slice(17, 22);
    await notify(
      '🌐 *Website Monitor*\\n\\n' +
      '❌ Сайт недоступен!\\n' +
      '🔗 \`' + url + '\`\\n' +
      '💥 ' + error.message
    );
    return { url: url, status: 0, isUp: 'down', error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'WEBSITE_URL',
      description: 'URL сайта для проверки',
      example: 'https://example.com',
      required: true
    },
    {
      name: 'EXPECTED_STATUS',
      description: 'Ожидаемый HTTP статус',
      example: '200',
      required: false
    },
    {
      name: 'TIMEOUT',
      description: 'Таймаут в миллисекундах',
      example: '10000',
      required: false
    }
  ]
};

const weatherNotifier: AgentTemplate = {
  id: 'weather-notifier',
  name: 'Weather Notifier',
  description: 'Получает текущую погоду для указанного города',
  category: 'utility',
  icon: '🌤',
  tags: ['weather', 'api', 'notification'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 3600000 },
  code: `
async function agent(context) {
  const city = context.config.CITY || 'Moscow';
  
  try {
    console.log('🌤 Получаю погоду для:', city);
    
    const geoResponse = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1'
    );
    
    if (!geoResponse.ok) {
      throw new Error('Geocoding API error');
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('Город не найден: ' + city);
    }
    
    const location = geoData.results[0];
    const lat = location.latitude;
    const lon = location.longitude;
    
    console.log('📍 Координаты:', lat, lon, '(' + location.name + ', ' + location.country + ')');
    
    const weatherResponse = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m'
    );
    
    if (!weatherResponse.ok) {
      throw new Error('Weather API error');
    }
    
    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    
    const weatherCodes: Record<number, string> = {
      0: '☀️ Ясно',
      1: '🌤 Малооблачно',
      2: '⛅ Переменная облачность',
      3: '☁️ Облачно',
      45: '🌫 Туман',
      51: '🌦 Морось',
      61: '🌧 Дождь',
      71: '🌨 Снег',
      95: '⛈ Гроза'
    };
    
    const description = weatherCodes[current.weather_code] || '🌡';
    const timeUTC = new Date().toUTCString().slice(17, 22);

    console.log('🌡 Температура:', current.temperature_2m + '°C', '|', description);

    await notify(
      '🌤 *Weather Update*\\n\\n' +
      '📍 \`' + location.name + ', ' + location.country + '\`\\n\\n' +
      description + '\\n' +
      '🌡 \`' + current.temperature_2m + '°C\`\\n' +
      '💧 Влажность: \`' + current.relative_humidity_2m + '%\`\\n' +
      '💨 Ветер: \`' + current.wind_speed_10m + ' km/h\`\\n' +
      '⏰ ' + timeUTC + ' UTC'
    );

    return {
      city: location.name + ', ' + location.country,
      weather: description,
      temperature: current.temperature_2m + '°C',
      humidity: current.relative_humidity_2m + '%',
      wind: current.wind_speed_10m + ' km/h',
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'CITY',
      description: 'Название города',
      example: 'Moscow',
      required: false
    }
  ]
};

const telegramNotifier: AgentTemplate = {
  id: 'telegram-notifier',
  name: 'Telegram Notifier',
  description: 'Отправляет сообщение в указанный Telegram чат',
  category: 'social',
  icon: '📨',
  tags: ['telegram', 'notification', 'message'],
  triggerType: 'manual',
  triggerConfig: {},
  code: `
async function agent(context) {
  const botToken = context.config.BOT_TOKEN;
  const chatId = context.config.CHAT_ID;
  const message = context.config.MESSAGE || 'Привет от TON Agent!';
  
  if (!botToken || !chatId) {
    return { 
      success: false, 
      error: 'BOT_TOKEN и CHAT_ID обязательны' 
    };
  }
  
  try {
    console.log('📨 Отправляю сообщение в Telegram...');
    console.log('💬 Чат:', chatId);
    
    const response = await fetch(
      'https://api.telegram.org/bot' + botToken + '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error('Telegram API: ' + data.description);
    }
    
    console.log('✅ Сообщение отправлено');
    
    return {
      success: true,
      result: {
        messageId: data.result.message_id,
        chatId: chatId,
        text: message,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'BOT_TOKEN',
      description: 'Токен Telegram бота',
      example: '123456:ABC...',
      required: true
    },
    {
      name: 'CHAT_ID',
      description: 'ID чата для отправки',
      example: '-1001234567890',
      required: true
    },
    {
      name: 'MESSAGE',
      description: 'Текст сообщения',
      example: 'Привет! Это уведомление от агента.',
      required: false
    }
  ]
};

// ===== ПРОДВИНУТЫЕ ШАБЛОНЫ =====

const nftFloorMonitor: AgentTemplate = {
  id: 'nft-floor-monitor',
  name: 'NFT Floor Price Monitor',
  description: 'Мониторит floor price NFT коллекции и уведомляет об изменениях',
  category: 'ton',
  icon: '🖼',
  tags: ['nft', 'floor', 'price', 'monitor', 'collection'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 300000 },
  code: `
async function agent(context) {
  const collectionAddress = context.config.COLLECTION_ADDRESS;
  const targetPrice = parseFloat(context.config.TARGET_PRICE) || 0;
  
  if (!collectionAddress) {
    return { success: false, error: 'COLLECTION_ADDRESS не указан' };
  }
  
  try {
    console.log('🖼 Проверяю floor price коллекции:', collectionAddress);
    
    const response = await fetch(
      'https://tonapi.io/v2/nfts/collections/' + collectionAddress,
      { headers: { 'Authorization': 'Bearer ' + (context.config.TONAPI_KEY || '') } }
    );
    
    if (!response.ok) {
      const getgemsResponse = await fetch('https://api.getgems.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'query { collection(address: "' + collectionAddress + '") { floorPrice itemsCount } }'
        })
      });
      
      const getgemsData = await getgemsResponse.json();
      const floorPrice = getgemsData.data?.collection?.floorPrice || 0;
      
      let alert = null;
      if (targetPrice > 0 && floorPrice <= targetPrice) {
        alert = '🚨 Floor price достиг цели! Текущий: ' + floorPrice + ' TON';
      }
      
      return {
        success: true,
        result: { collection: collectionAddress, floorPrice: floorPrice.toFixed(2), alert }
      };
    }
    
    const data = await response.json();
    return { success: true, result: { collection: collectionAddress, metadata: data.metadata } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'COLLECTION_NAME',
      description: 'Название NFT коллекции',
      example: 'Plush Pepes',
      required: true,
      question: '🎨 Какую NFT коллекцию отслеживать?\n\n_Например: TON Punks, Plush Pepes, TON Diamonds_\n\n_Адрес найдём автоматически по названию_ 🔍',
    },
    { name: 'TARGET_PRICE', description: 'Целевая цена для уведомления (TON)', example: '10', required: false },
  ]
};

const jettonBalanceChecker: AgentTemplate = {
  id: 'jetton-balance-checker',
  name: 'Jetton Balance Checker',
  description: 'Проверяет баланс Jetton токенов (USDT, NOT, etc.)',
  category: 'ton',
  icon: '🪙',
  tags: ['jetton', 'token', 'balance', 'checker'],
  triggerType: 'manual',
  triggerConfig: {},
  code: `
async function agent(context) {
  const walletAddress = context.config.WALLET_ADDRESS;
  const jettonMaster = context.config.JETTON_MASTER;
  
  if (!walletAddress || !jettonMaster) {
    return { success: false, error: 'WALLET_ADDRESS и JETTON_MASTER обязательны' };
  }
  
  try {
    console.log('🪙 Проверяю баланс Jetton...');
    
    const response = await fetch(
      'https://tonapi.io/v2/accounts/' + walletAddress + '/jettons/' + jettonMaster,
      { headers: { 'Authorization': 'Bearer ' + (context.config.TONAPI_KEY || '') } }
    );
    
    if (!response.ok) {
      const fallback = await fetch('https://toncenter.com/api/v3/jetton/wallets?owner_address=' + walletAddress + '&jetton_address=' + jettonMaster);
      const fallbackData = await fallback.json();
      const balance = fallbackData.jetton_wallets?.[0]?.balance || '0';
      return { success: true, result: { wallet: walletAddress, jetton: jettonMaster, balance } };
    }
    
    const data = await response.json();
    const balance = data.balance || '0';
    const metadata = data.metadata || {};
    const decimals = metadata.decimals || 9;
    const formattedBalance = (parseInt(balance) / Math.pow(10, decimals)).toFixed(decimals);
    
    return {
      success: true,
      result: {
        wallet: walletAddress,
        jetton: { address: jettonMaster, name: metadata.name, symbol: metadata.symbol },
        balance,
        formattedBalance
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    { name: 'WALLET_ADDRESS', description: 'Адрес кошелька', example: 'EQD...', required: true },
    { name: 'JETTON_MASTER', description: 'Адрес Jetton Master', example: 'EQCx...', required: true },
    { name: 'TONAPI_KEY', description: 'API ключ TonAPI', example: 'your_api_key', required: false }
  ]
};

const dexSwapMonitor: AgentTemplate = {
  id: 'dex-swap-monitor',
  name: 'DEX Swap Monitor',
  description: 'Мониторит свапы на DEX и уведомляет о крупных сделках',
  category: 'finance',
  icon: '🔄',
  tags: ['dex', 'swap', 'trading', 'monitor'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 60000 },
  code: `
async function agent(context) {
  const minAmount = parseFloat(context.config.MIN_AMOUNT) || 1000;
  const lastChecked = context.state?.lastChecked || Date.now() - 60000;
  
  try {
    console.log('🔄 Мониторю свапы на DEX...');
    
    const response = await fetch('https://api.dedust.io/v2/swaps?limit=20');
    
    if (!response.ok) {
      throw new Error('DeDust API error: ' + response.status);
    }
    
    const data = await response.json();
    const swaps = data.swaps || [];
    
    const largeSwaps = swaps.filter(swap => {
      const amount = parseFloat(swap.amount_usd) || 0;
      const timestamp = new Date(swap.timestamp).getTime();
      return amount >= minAmount && timestamp > lastChecked;
    });
    
    console.log('💰 Крупных свапов:', largeSwaps.length);
    
    context.setState({ lastChecked: Date.now() });
    
    return {
      success: true,
      result: {
        largeSwaps: largeSwaps.map(s => ({
          amountUSD: s.amount_usd,
          tokenIn: s.token_in,
          tokenOut: s.token_out,
          trader: s.trader
        })),
        minThreshold: minAmount
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    { name: 'MIN_AMOUNT', description: 'Минимальная сумма свапа для уведомления (USD)', example: '1000', required: false }
  ]
};

const nftArbitrageV2: AgentTemplate = {
  id: 'nft-arbitrage-v2',
  name: 'NFT Arbitrage Pro',
  description: 'Сканирует NFT коллекции через TonAPI, ищет листинги ниже floor-цены, отслеживает позиции и P&L. Принимает GetGems URL или EQ-адреса. Встроенные популярные коллекции как fallback.',
  category: 'finance',
  icon: '🎯',
  tags: ['nft', 'arbitrage', 'tonapi', 'trading', 'floor', 'ton'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 300000 },
  code: `
async function agent(context) {
  // ── Конфиг ───────────────────────────────────────────────────────
  var MAX_BUY_TON  = parseFloat(context.config.MAX_BUY_PRICE_TON  || '50');
  var MIN_PROFIT   = parseFloat(context.config.MIN_PROFIT_PCT      || '15');
  var DAILY_LIMIT  = parseFloat(context.config.DAILY_LIMIT_TON     || '200');
  var SELL_MARKUP  = parseFloat(context.config.SELL_MARKUP_PCT     || '20');
  var AUTO_NOTIFY  = (context.config.AUTO_NOTIFY || 'true') === 'true';

  // ── Парсинг адресов коллекций (принимает EQ-адрес или getgems.io URL) ─
  function parseCollectionAddr(raw) {
    raw = (raw || '').trim();
    var m = raw.match(/(?:getgems\\.io\\/collection\\/|fragment\\.com\\/collection\\/|tonscan\\.org\\/address\\/)([EUk][Qq][\\w-]{46})/);
    if (m) return m[1];
    if (/^[EUk][Qq][\\w-]{46}$/.test(raw)) return raw;
    return null;
  }

  var POPULAR_COLLECTIONS = [
    'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN',
    'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir',
    'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N',
  ];

  var rawCollections = (context.config.TARGET_COLLECTIONS || '').split(',');
  var COLLECTIONS = [];
  for (var i = 0; i < rawCollections.length; i++) {
    var addr = parseCollectionAddr(rawCollections[i]);
    if (addr) COLLECTIONS.push(addr);
  }
  if (COLLECTIONS.length === 0) {
    COLLECTIONS = POPULAR_COLLECTIONS;
    console.log('TARGET_COLLECTIONS не задан — сканирую популярные коллекции');
  }

  // ── Кошелёк ───────────────────────────────────────────────────────
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

  function eqToRaw(addr) {
    try {
      var b64 = addr.replace(/-/g, '+').replace(/_/g, '/');
      var buf = Buffer.from(b64, 'base64');
      var workchain = buf[1] === 0xff ? -1 : buf[1];
      var hash = buf.slice(2, 34).toString('hex');
      return workchain + ':' + hash;
    } catch(e) { return addr; }
  }

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

  async function getCollectionName(collAddr) {
    try {
      var raw = eqToRaw(collAddr);
      var resp = await fetch('https://tonapi.io/v2/nfts/collections/' + encodeURIComponent(raw), { headers: tonapiHdr() });
      if (!resp.ok) return collAddr.slice(0, 10) + '...';
      var data = await resp.json();
      return (data.metadata && data.metadata.name) ? data.metadata.name : collAddr.slice(0, 10) + '...';
    } catch(e) { return collAddr.slice(0, 10) + '...'; }
  }

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
}
`,
  placeholders: [
    {
      name: 'TARGET_COLLECTIONS',
      description: 'Адреса NFT коллекций или getgems.io ссылки через запятую. Если не указано — сканируются популярные коллекции.',
      example: 'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN,https://getgems.io/collection/EQAG2...',
      required: false,
      question: 'Введите адреса коллекций (EQ...) или ссылки getgems.io (пропустите для сканирования популярных):'
    },
    {
      name: 'MAX_BUY_PRICE_TON',
      description: 'Максимальная цена покупки одного NFT (TON)',
      example: '50',
      required: false,
      question: 'Максимальная цена покупки NFT в TON (по умолчанию 50):'
    },
    {
      name: 'MIN_PROFIT_PCT',
      description: 'Минимальный потенциальный профит для сделки (%)',
      example: '15',
      required: false,
      question: 'Минимальный профит для входа в сделку, % (по умолчанию 15):'
    },
    {
      name: 'DAILY_LIMIT_TON',
      description: 'Лимит расходов за день (TON)',
      example: '200',
      required: false,
      question: 'Дневной лимит расходов в TON (по умолчанию 200):'
    },
    {
      name: 'SELL_MARKUP_PCT',
      description: 'Наценка при продаже относительно цены покупки (%)',
      example: '20',
      required: false
    },
    {
      name: 'TONAPI_KEY',
      description: 'API ключ TonAPI (опционально, для увеличения лимитов запросов)',
      example: 'AGYDGN4RZD4XLPY...',
      required: false
    },
    {
      name: 'WALLET_MNEMONIC',
      description: '24 слова мнемоники кошелька через пробел (для реальных покупок). Без мнемоники агент работает в режиме симуляции.',
      example: 'word1 word2 word3 ... word24',
      required: false,
      question: 'Мнемоника кошелька (24 слова) для реальных покупок. Оставьте пустым для режима симуляции:'
    },
    {
      name: 'AUTO_NOTIFY',
      description: 'Отправлять уведомления о каждой сделке (true/false)',
      example: 'true',
      required: false
    }
  ]
};

const payrollAgent: AgentTemplate = {
  id: 'payroll-agent',
  name: 'Payroll Agent',
  description: 'Отправляет зарплату сотрудникам по расписанию (требует TON Connect)',
  category: 'ton',
  icon: '💸',
  tags: ['payroll', 'salary', 'payment', 'ton'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 86400000 },
  code: `
async function agent(context) {
  const employees = context.config.EMPLOYEES ? JSON.parse(context.config.EMPLOYEES) : [];
  
  if (employees.length === 0) {
    return { success: false, error: 'EMPLOYEES не указаны. Формат: [{"address":"EQ...","amount":10}]' };
  }
  
  if (!context.wallet) {
    return { success: false, error: 'TON Connect: Кошелёк не подключен', action: 'connect_wallet' };
  }
  
  try {
    console.log('💸 Подготовка выплаты зарплаты...');
    
    const totalAmount = employees.reduce((sum, emp) => sum + (emp.amount || 0), 0);
    console.log('   Сотрудников:', employees.length, 'Общая сумма:', totalAmount, 'TON');
    
    const balanceResponse = await fetch('https://toncenter.com/api/v2/getAddressBalance?address=' + context.wallet);
    const balanceData = await balanceResponse.json();
    const balanceTon = parseInt(balanceData.result) / 1e9;
    
    if (balanceTon < totalAmount) {
      return { success: false, error: 'Недостаточно средств. Баланс: ' + balanceTon.toFixed(2) + ' TON' };
    }
    
    const transactions = employees.map(emp => ({
      to: emp.address,
      amount: emp.amount,
      comment: 'Зарплата от ' + new Date().toLocaleDateString()
    }));
    
    return {
      success: true,
      result: {
        totalAmount,
        employeeCount: employees.length,
        transactions,
        wallet: context.wallet,
        balance: balanceTon.toFixed(2),
        action: 'confirm_batch_send',
        message: 'Готово к отправке! Подтвердите в TON Connect.'
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    { name: 'EMPLOYEES', description: 'JSON массив сотрудников: [{"address":"EQ...","amount":10,"name":"Иван"}]', example: '[{"address":"EQD...","amount":10}]', required: true }
  ]
};

const webhookReceiver: AgentTemplate = {
  id: 'webhook-receiver',
  name: 'Webhook Receiver',
  description: 'Получает вебхуки от внешних сервисов и выполняет действия',
  category: 'utility',
  icon: '🔗',
  tags: ['webhook', 'api', 'integration'],
  triggerType: 'webhook',
  triggerConfig: { endpoint: '/webhook/:agentId' },
  code: `
async function agent(context) {
  const webhookData = context.webhookData;
  const secret = context.config.WEBHOOK_SECRET;
  
  if (secret && context.headers['x-webhook-secret'] !== secret) {
    return { success: false, error: 'Invalid webhook secret', status: 401 };
  }
  
  try {
    console.log('🔗 Webhook received:', webhookData);
    const eventType = webhookData.event || 'unknown';
    
    return {
      success: true,
      result: { event: eventType, data: webhookData, timestamp: new Date().toISOString() }
    };
  } catch (error) {
    return { success: false, error: error.message, status: 500 };
  }
}
`,
  placeholders: [
    { name: 'WEBHOOK_SECRET', description: 'Секрет для проверки подлинности вебхуков', example: 'your_webhook_secret', required: false }
  ]
};

const nftFloorPredictor: AgentTemplate = {
  id: 'nft-floor-predictor',
  name: 'NFT Floor Price + AI Forecast',
  description: 'Мониторит floor price ЛЮБОЙ NFT коллекции (GetGems, TonAPI), строит AI-прогноз тренда на основе истории',
  category: 'ton',
  icon: '🔮',
  tags: ['nft', 'floor', 'ai', 'forecast', 'prediction', 'getgems', 'tonapi'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 1800000 }, // каждые 30 минут
  code: `
async function agent(context) {
  const collection = context.config.COLLECTION_NAME;
  if (!collection) {
    await notify('⚠️ Агент не настроен: укажите COLLECTION_NAME (название NFT коллекции).');
    return { error: 'no_collection_configured' };
  }
  const TONAPI_KEY = context.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
  // Известные коллекции → адреса (verified on TonAPI)
  const KNOWN = {
    'ton punks':    'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN',
    'tonpunks':     'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN',
    'панки':        'EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN',
    'ton diamonds': 'EQAG2BH0JlmFkbMrLEnyn2bIITaOSssd4WdisE4BdFMkZbir',
    'ton whales':   'EQAHOxMCdof3VJZC1jARSaTxXaTuBOElHcNfFAKl4ELjVFOG',
    'anonymous':    'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N',
    'tonxpunks':    '0:9dd1dfc276588412f79b64e4d659d8427d61add13014125c30133c17d3c99044',
    'plush pepes':  'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS',
    'plush pepe':   'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS',
    'пепе':         'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS',
  };
  const collectionAddr = context.config.COLLECTION_ADDRESS ||
    KNOWN[collection.toLowerCase()] || '';

  // ── Convert EQ address to raw 0:hex format for TonAPI ──
  function eqToRaw(addr) {
    if (!addr || addr.startsWith('0:')) return addr;
    try {
      const s = addr.replace(/-/g, '+').replace(/_/g, '/');
      const padded = s + '=='.slice(0, (4 - s.length % 4) % 4);
      const buf = Buffer.from(padded, 'base64');
      return '0:' + buf.slice(2, 34).toString('hex');
    } catch { return addr; }
  }

  // ── Fetch real NFT data from TonAPI (primary, works with API key) ──
  async function fetchTonAPIData(addr) {
    if (!addr) return null;
    try {
      const rawAddr = eqToRaw(addr);
      const headers = {
        'Accept': 'application/json',
        ...(TONAPI_KEY ? { 'Authorization': 'Bearer ' + TONAPI_KEY } : {}),
      };

      // Get collection metadata (total items only — keep user-configured name as display name)
      let name = collection; // always use the configured name, never override
      let itemsCount = 0;
      try {
        const colResp = await fetch('https://tonapi.io/v2/nfts/collections/' + rawAddr, { headers });
        if (colResp.ok) {
          const colData = await colResp.json();
          // Do NOT override name with TonAPI metadata — use the name the user configured
          itemsCount = colData?.next_item_index || 0;
        }
      } catch {}

      // Get floor price from listed items (scan up to 200)
      const prices = [];
      for (let offset = 0; offset < 200; offset += 100) {
        const r = await fetch(
          'https://tonapi.io/v2/nfts/collections/' + rawAddr + '/items?limit=100&offset=' + offset,
          { headers }
        );
        if (!r.ok) break;
        const d = await r.json();
        const items = d.nft_items || [];
        if (items.length === 0) break;
        for (const item of items) {
          const val = item?.sale?.price?.value;
          if (val && parseInt(val) > 0) prices.push(parseInt(val) / 1e9);
        }
      }
      prices.sort((a, b) => a - b);
      const floor = prices.length > 0 ? prices[0] : 0;
      console.log('✅ TonAPI: floor=' + floor.toFixed(2) + ' TON from ' + prices.length + ' listings, total=' + itemsCount);
      return { floor, items: itemsCount, holders: 0, totalVolTon: 0, name, source: 'tonapi.io', listings: prices.length };
    } catch (e) {
      console.warn('⚠️ TonAPI failed:', e.message);
      return null;
    }
  }

  // Keep for legacy - now just calls TonAPI
  async function fetchGetGemsData(addr) {
    return fetchTonAPIData(addr);
  }

  // ── Get TON price in USD ──
  async function getTonPrice() {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true');
      const d = await r.json();
      return { usd: d['the-open-network'].usd || 0, change24h: d['the-open-network'].usd_24h_change || 0 };
    } catch { return { usd: 0, change24h: 0 }; }
  }

  try {
    console.log('🎨 NFT Monitor: ' + collection + (collectionAddr ? ' [' + collectionAddr.slice(0, 8) + '...]' : ''));

    // Fetch real data
    let data = await fetchGetGemsData(collectionAddr);
    if (!data || data.floor === 0) {
      data = await fetchTonAPIData(collectionAddr);
    }
    if (!data) {
      // Use cached price as last resort (never fake random)
      const cached = getState('last_price');
      if (cached) {
        data = { floor: cached, items: 0, holders: 0, totalVolTon: 0, name: collection, source: 'cached' };
        console.log('📌 Using cached price:', cached);
      } else {
        await notify('⚠️ *' + collection + '*\\nНе удалось получить данные.\\nПроверьте адрес коллекции.');
        return { error: 'no_data', collection };
      }
    }

    // Нет активных листингов — сообщаем пользователю и выходим до следующей проверки
    if (data.floor === 0 && data.listings === 0) {
      const addr = collectionAddr ? collectionAddr.slice(0, 14) + '…' : '';
      await notify(
        '📭 *' + collection + '*\\n' +
        '━━━━━━━━━━━━━━━━━━━━\\n' +
        '⚠️ Нет активных листингов на продажу\\n' +
        '_Буду проверять каждые 30 минут_' +
        (addr ? '\\n_Адрес: ' + addr + '_' : '')
      );
      return { status: 'no_listings', collection };
    }

    const tonPriceData = await getTonPrice();
    const floorTon = data.floor;
    const floorUsd = tonPriceData.usd > 0 ? (floorTon * tonPriceData.usd).toFixed(0) : '?';

    // Price history for trend analysis (up to 14 points = 7 days at 12h interval)
    const history = getState('price_history') || [];
    history.push({ price: floorTon, ts: Date.now() });
    if (history.length > 14) history.shift();
    setState('price_history', history);
    setState('last_price', floorTon);
    setState('last_holders', data.holders);

    // Trend calculation: linear regression over history
    let forecast = floorTon;
    let trendPct = 0;
    let momentum = 'нейтральный';
    if (history.length >= 2) {
      const prices = history.map(h => h.price);
      const n = prices.length;
      // Linear regression
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i; sumY += prices[i];
        sumXY += i * prices[i]; sumX2 += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      forecast = Math.max(0, intercept + slope * n);
      trendPct = floorTon > 0 ? ((forecast - floorTon) / floorTon) * 100 : 0;

      // Momentum detection
      const recent3 = prices.slice(-3);
      const avg3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
      const older = prices.slice(0, -3);
      if (older.length > 0) {
        const avgOld = older.reduce((a, b) => a + b, 0) / older.length;
        const momentumPct = ((avg3 - avgOld) / avgOld) * 100;
        if (momentumPct > 3) momentum = 'бычий 🐂';
        else if (momentumPct < -3) momentum = 'медвежий 🐻';
        else momentum = 'боковик ↔️';
      }
    }

    // Change since last check
    const prevPrice = history.length >= 2 ? history[history.length - 2].price : floorTon;
    const changePct = prevPrice > 0 ? ((floorTon - prevPrice) / prevPrice) * 100 : 0;
    const changeSign = changePct >= 0 ? '+' : '';
    const trendArrow = trendPct >= 0 ? '📈' : '📉';
    const confidence = Math.min(40 + history.length * 3, 85);
    const forecastSign = trendPct >= 0 ? '+' : '';
    const timeUTC = new Date().toUTCString().replace(/.*?(\\d{2}:\\d{2}).*/, '$1');

    // Smart signal
    let signal = '⚖️ ДЕРЖАТЬ';
    let signalReason = '';
    if (trendPct > 5 && data.holders > 500) {
      signal = '🟢 ПОКУПАТЬ'; signalReason = 'Восходящий тренд + сильная база держателей';
    } else if (trendPct < -5) {
      signal = '🔴 ПРОДАВАТЬ'; signalReason = 'Нисходящий тренд, риск дальнейшего снижения';
    } else if (trendPct > 2) {
      signal = '🟡 НАКАПЛИВАТЬ'; signalReason = 'Слабый рост, можно добирать на откатах';
    } else if (data.holders > 0 && data.items > 0) {
      const holderRatio = data.holders / data.items;
      if (holderRatio > 0.3) signalReason = 'Хорошее распределение (' + Math.round(holderRatio * 100) + '%)';
    }

    await notify(
      '🎨 *' + collection + '*\\n' +
      '━━━━━━━━━━━━━━━━━━━━\\n' +
      '💰 Floor: \`' + floorTon.toFixed(2) + ' TON\`' + (floorUsd !== '?' ? ' ≈ $' + floorUsd : '') + '\\n' +
      (changePct !== 0 ? (changePct >= 0 ? '📈' : '📉') + ' Изм: \`' + changeSign + changePct.toFixed(1) + '%\`\\n' : '') +
      (data.holders > 0 ? '👥 Holders: \`' + data.holders.toLocaleString() + '\`\\n' : '') +
      (data.items > 0 ? '🖼 Items: \`' + data.items.toLocaleString() + '\`\\n' : '') +
      (data.totalVolTon > 0 ? '📊 Volume: \`' + data.totalVolTon.toLocaleString() + ' TON\`\\n' : '') +
      '\\n🔮 *AI Прогноз (12ч):*\\n' +
      '   ' + trendArrow + ' \`' + forecast.toFixed(2) + ' TON\` (' + forecastSign + trendPct.toFixed(1) + '%)\\n' +
      '   Моментум: ' + momentum + '\\n' +
      '   Уверенность: \`' + confidence + '%\` (' + history.length + ' точек)\\n' +
      '\\n📡 *Сигнал: ' + signal + '*\\n' +
      (signalReason ? '_' + signalReason + '_\\n' : '') +
      '\\n_Источник: ' + data.source + ' • ' + timeUTC + ' UTC_'
    );

    console.log('✅ Sent: floor=' + floorTon.toFixed(2) + ' forecast=' + forecast.toFixed(2) + ' signal=' + signal);

    return {
      collection: collection,
      floor: floorTon.toFixed(2) + ' TON',
      forecast: forecast.toFixed(2) + ' TON',
      trend: forecastSign + trendPct.toFixed(1) + '%',
      signal,
      momentum,
      confidence: confidence + '%',
      source: data.source,
    };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    await notify('❌ NFT Monitor ошибка: ' + error.message);
    return { error: error.message };
  }
}
`,
  placeholders: [
    {
      name: 'COLLECTION_NAME',
      description: 'Название NFT коллекции для мониторинга',
      example: 'Plush Pepes',
      required: true,
      question: '🎨 Какую NFT коллекцию отслеживать?\n\n_Например: TON Punks, Plush Pepes, TON Diamonds_\n\n_Адрес найдём автоматически по названию_ 🔍',
    },
  ]
};

const webhookSender: AgentTemplate = {
  id: 'webhook-sender',
  name: 'Webhook Sender',
  description: 'Отправляет вебхуки на внешние URL при срабатывании условий',
  category: 'utility',
  icon: '📤',
  tags: ['webhook', 'notification', 'integration'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 60000 },
  code: `
async function agent(context) {
  const webhookUrl = context.config.WEBHOOK_URL;
  const condition = context.config.CONDITION || 'always';
  
  if (!webhookUrl) {
    return { success: false, error: 'WEBHOOK_URL не указан' };
  }
  
  try {
    let payload = { event: 'scheduled_ping', timestamp: Date.now() };
    
    if (condition === 'ton_price_change') {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true');
      const data = await response.json();
      payload = { event: 'ton_price_alert', price: data['the-open-network'].usd, change: data['the-open-network'].usd_24h_change };
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    return { success: true, result: { sent: true, status: response.status } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    { name: 'WEBHOOK_URL', description: 'URL для отправки вебхуков', example: 'https://hooks.slack.com/...', required: true },
    { name: 'CONDITION', description: 'Условие отправки: always, ton_price_change', example: 'ton_price_change', required: false }
  ]
};

// ===== ЭКСПОРТ =====

// Базовые шаблоны
export const agentTemplates: AgentTemplate[] = [
  tonBalanceChecker,
  tonPriceMonitor,
  lowBalanceAlert,
  dailyTonReport,
  cryptoPortfolio,
  websiteMonitor,
  weatherNotifier,
  telegramNotifier
];

// Продвинутые шаблоны
export const advancedAgentTemplates: AgentTemplate[] = [
  nftFloorPredictor,
  nftFloorMonitor,
  jettonBalanceChecker,
  dexSwapMonitor,
  nftArbitrageV2,
  payrollAgent,
  webhookReceiver,
  webhookSender
];

// ── Мультиагентные шаблоны ────────────────────────────────────

const multiAgentOrchestrator: AgentTemplate = {
  id: 'multi_agent_orchestrator',
  name: '🎭 Мультиагентный оркестратор',
  description: 'Агент-оркестратор, управляющий несколькими специализированными агентами. Собирает данные от мониторинговых агентов, принимает решения, вызывает исполнительных агентов.',
  category: 'utility',
  icon: '🎭',
  tags: ['multi-agent', 'orchestrator', 'automation', 'coordination'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 60000 },
  placeholders: [
    { name: 'MONITOR_AGENT_ID', description: 'ID агента-монитора', example: '1', required: false },
    { name: 'NOTIFY_AGENT_ID', description: 'ID агента-уведомлялки', example: '2', required: false },
  ],
  code: `async function agent(context) {
  const { config } = context;

  // ID подчинённых агентов (настраиваются через конфиг)
  const MONITOR_AGENT_ID = parseInt(config.MONITOR_AGENT_ID || '{{MONITOR_AGENT_ID}}');
  const NOTIFY_AGENT_ID  = parseInt(config.NOTIFY_AGENT_ID  || '{{NOTIFY_AGENT_ID}}');

  try {
    console.log('🎭 Оркестратор запущен...');

    // 1. Получаем данные от мониторинговых агентов
    const messages = agent_receive();
    console.log(\`📨 Получено сообщений: \${messages.length}\`);

    if (messages.length === 0) {
      console.log('⏳ Нет новых данных от агентов');
      return { success: true, result: { processed: 0 } };
    }

    let alerts = [];
    for (const msg of messages) {
      const data = msg.data;
      console.log(\`📊 Агент #\${msg.from}: \${JSON.stringify(data).slice(0, 80)}\`);

      // Бизнес-логика оркестратора
      if (data.alert || data.balance < (data.threshold || 1)) {
        alerts.push(\`⚠️ Агент #\${msg.from}: \${data.summary || JSON.stringify(data)}\`);
      }
    }

    // 2. Если есть алерты — отправляем агенту-уведомлялке или напрямую
    if (alerts.length > 0) {
      const summary = alerts.join('\\n');
      notify('🚨 Оркестратор: обнаружены события!\\n\\n' + summary);

      // Опционально: пересылаем исполнительному агенту
      if (NOTIFY_AGENT_ID) {
        agent_send(NOTIFY_AGENT_ID, { type: 'alert', alerts, timestamp: new Date().toISOString() });
      }
    }

    return { success: true, result: { processed: messages.length, alerts: alerts.length } };
  } catch (error) {
    console.error('❌ Оркестратор упал:', error.message);
    notify('❌ Ошибка оркестратора: ' + error.message);
    return { success: false, error: error.message };
  }
}`,
};

const balanceMonitorAgent: AgentTemplate = {
  id: 'balance_monitor_v2',
  name: '💰 Мониторинг баланса TON',
  description: 'Проверяет баланс TON-кошелька и уведомляет только при изменении. Использует change-detection — нет спама каждую минуту.',
  category: 'ton',
  icon: '💰',
  tags: ['balance', 'ton', 'monitoring', 'alert'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 60000 },
  placeholders: [
    { name: 'WALLET_ADDRESS', description: 'Адрес TON кошелька', example: 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh', required: true },
    { name: 'MIN_BALANCE', description: 'Минимальный баланс для алерта (TON)', example: '1', required: false },
  ],
  code: `async function agent(context) {
  const { config } = context;
  const WALLET    = config.WALLET_ADDRESS || '{{WALLET_ADDRESS}}';
  const THRESHOLD = parseFloat(config.MIN_BALANCE || '1');

  try {
    const balance = await getTonBalance(WALLET);
    const prev    = getState('balance');

    console.log(\`💰 Баланс: \${balance.toFixed(4)} TON (было: \${prev ?? 'неизвестно'})\`);

    if (prev === null) {
      notify(\`✅ Мониторинг запущен!\\n\\n💰 Баланс: \${balance.toFixed(4)} TON\\n📍 Кошелёк: \${WALLET.slice(0,12)}...\`);
    } else {
      const diff = balance - prev;
      if (Math.abs(diff) > 0.001) {
        const sign = diff > 0 ? '+' : '';
        notify(\`💰 Баланс изменился!\\n\\nБыло: \${prev.toFixed(4)} TON\\nСтало: \${balance.toFixed(4)} TON\\nИзменение: \${sign}\${diff.toFixed(4)} TON\`);
      }
    }

    if (balance < THRESHOLD) {
      notify(\`⚠️ НИЗКИЙ БАЛАНС: \${balance.toFixed(4)} TON < \${THRESHOLD} TON!\`);
    }

    setState('balance', balance);
    return { success: true, result: { balance, prev } };
  } catch (error) {
    notify('❌ Ошибка проверки баланса: ' + error.message);
    return { success: false, error: error.message };
  }
}`,
};

const priceAlertAgent: AgentTemplate = {
  id: 'price_alert_v2',
  name: '📈 Алерт изменения цены',
  description: 'Следит за ценой TON/криптовалюты и присылает уведомление только при значительном изменении (>X%). Без спама.',
  category: 'finance',
  icon: '📈',
  tags: ['price', 'alert', 'ton', 'crypto', 'monitoring'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 60000 },
  placeholders: [
    { name: 'SYMBOL', description: 'Тикер монеты (TON, BTC, ETH...)', example: 'TON', required: false },
    { name: 'CHANGE_PCT', description: 'Порог изменения цены в %', example: '3', required: false },
  ],
  code: `async function agent(context) {
  const { config } = context;
  const SYMBOL    = config.SYMBOL || 'TON';
  const THRESHOLD = parseFloat(config.CHANGE_PCT || '3'); // % изменение для алерта

  try {
    const price = await getPrice(SYMBOL);
    const prev  = getState('price');

    console.log(\`📈 \${SYMBOL}: $\${price.toFixed(4)} (было: \${prev ? '$' + prev.toFixed(4) : 'неизвестно'})\`);

    if (prev === null) {
      notify(\`✅ Ценовой мониторинг запущен!\\n\\n📈 \${SYMBOL}: $\${price.toFixed(4)}\`);
    } else {
      const changePct = ((price - prev) / prev) * 100;
      if (Math.abs(changePct) >= THRESHOLD) {
        const sign = changePct > 0 ? '🟢 +' : '🔴 ';
        notify(\`📈 \${SYMBOL} \${sign}\${changePct.toFixed(2)}%\\n\\nБыло: $\${prev.toFixed(4)}\\nСтало: $\${price.toFixed(4)}\`);
      }
    }

    setState('price', price);
    return { success: true, result: { symbol: SYMBOL, price, prev } };
  } catch (error) {
    notify('❌ Ошибка: ' + error.message);
    return { success: false, error: error.message };
  }
}`,
};

export const multiAgentTemplates: AgentTemplate[] = [
  multiAgentOrchestrator,
  balanceMonitorAgent,
  priceAlertAgent,
];

// ── Telegram Star Gift Monitor ────────────────────────────────
const telegramGiftMonitor: AgentTemplate = {
  id: 'telegram-gift-monitor',
  name: 'Telegram Gift Floor Monitor',
  description: 'Мониторит floor price Telegram Star Gift на Fragment.com. Работает с любыми подарками: Love Potion, Jelly Bunny, Plush Pepe и другими. Требует /tglogin авторизацию.',
  category: 'ton',
  icon: '🎁',
  tags: ['gift', 'fragment', 'stars', 'telegram', 'floor', 'monitor'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 1800000 }, // каждые 30 минут
  placeholders: [
    {
      name: 'GIFT_NAME',
      description: 'Название подарка (например: Love Potion, Jelly Bunny, Plush Pepe)',
      example: 'Love Potion',
      required: true,
      question: '🎁 Какой подарок отслеживать?\n\nВведите название (например: _Love Potion_, _Jelly Bunny_, _Plush Pepe_)',
    },
  ],
  code: `
async function agent(context) {
  const giftName = context.config.GIFT_NAME;
  if (!giftName) {
    await notify('⚠️ Агент не настроен: укажите GIFT_NAME (название Telegram подарка).');
    return { error: 'no_gift_configured' };
  }

  // Конвертируем название в slug: "Love Potion" → "love-potion"
  const slug = giftName.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Получаем данные через локальный Fragment API (fragment-service.ts + MTProto)
  let data;
  try {
    const resp = await fetch('http://localhost:3001/api/fragment/gift/' + slug);
    data = await resp.json();
  } catch(e) {
    await notify('❌ Не удалось подключиться к Fragment API. Бот недоступен?');
    return { error: 'api_unavailable' };
  }

  if (!data.ok) {
    if (data.error === 'not_authenticated') {
      await notify(
        '🔐 *' + giftName + '*\\n' +
        '━━━━━━━━━━━━━━━━━━━━\\n' +
        '❌ Нужна авторизация Telegram для Fragment\\n' +
        '_Отправьте /tglogin в боте и пройдите авторизацию_'
      );
      return { error: 'not_authenticated' };
    }
    if (data.error === 'not_found') {
      await notify(
        '⚠️ *' + giftName + '*\\n' +
        '━━━━━━━━━━━━━━━━━━━━\\n' +
        '❌ Подарок не найден на Fragment\\n' +
        '_Проверьте название: оно должно совпадать с именем на fragment.com_'
      );
      return { error: 'not_found' };
    }
    await notify('⚠️ Fragment API: ' + (data.error || 'Unknown error'));
    return { error: data.error };
  }

  const floorStars = data.floorStars || 0;
  const floorTon = data.floorTon || 0;
  const listed = data.listed || 0;

  if (floorStars === 0) {
    await notify(
      '📭 *' + giftName + '*\\n' +
      '━━━━━━━━━━━━━━━━━━━━\\n' +
      '⚠️ Нет активных листингов на Fragment\\n' +
      '_Буду проверять каждые 30 минут_'
    );
    return { status: 'no_listings', giftName };
  }

  // Считаем изменение цены
  const lastFloor = getState('last_floor') || 0;
  const change = lastFloor ? floorStars - lastFloor : 0;
  setState('last_floor', floorStars);
  setState('last_check', Date.now());

  const changeStr = change !== 0 ? ' (' + (change > 0 ? '+' : '') + change + '★)' : '';
  const tonStr = floorTon > 0 ? ' ≈ ' + floorTon.toFixed(4) + ' TON' : '';

  await notify(
    '🎁 *' + giftName + '*\\n' +
    '━━━━━━━━━━━━━━━━━━━━\\n' +
    '⭐ Floor: *' + floorStars + ' Stars*' + changeStr + '\\n' +
    (tonStr ? '_' + tonStr + '_\\n' : '') +
    '📋 Listed: ' + listed + '\\n' +
    (data.avgStars ? '📊 Avg: ' + data.avgStars + '★\\n' : '') +
    '_Источник: Fragment.com_'
  );

  return { giftName, floorStars, listed, change };
}
`,
};

// ===== AI-AGENT: Unified Arbitrage =====
// triggerType === 'ai_agent': agent.code = system prompt, AI calls tools autonomously

const unifiedArbitrageAI: AgentTemplate = {
  id: 'unified-arbitrage-ai',
  name: '🤖 AI Арбитраж (подарки + NFT)',
  description: 'Автономный AI-агент который сам ищет арбитраж в Telegram подарках и TON NFT. Общается с вами в чате, объясняет решения.',
  category: 'finance',
  icon: '🤖',
  tags: ['ai', 'arbitrage', 'gifts', 'nft', 'ton', 'fragment', 'auto'],
  triggerType: 'ai_agent',
  triggerConfig: {
    intervalMs: 300_000, // 5 min default
    config: {
      AI_PROVIDER:      '{{AI_PROVIDER}}',
      AI_API_KEY:       '{{AI_API_KEY}}',
      TONAPI_KEY:       '{{TONAPI_KEY}}',
      MAX_BUY_STARS:    '500',
      MIN_PROFIT_PCT:   '15',
      TARGET_COLLECTIONS: '',
      WALLET_MNEMONIC:  '{{WALLET_MNEMONIC}}',
    },
  },
  // agent.code = system prompt (the "soul" of the agent)
  code: `Ты — автономный AI-арбитражный агент на TON Agent Platform.

Твоя задача: каждый тик (каждые 5 минут) анализировать рынок Telegram подарков и TON NFT, находить выгодные возможности и сообщать о них пользователю.

## Твои инструменты:

### Рыночные данные (GiftAsset + SwiftGifts API — РЕАЛЬНЫЕ цены!):
- **scan_real_arbitrage(max_price_stars, min_profit_pct)** — НАСТОЯЩИЙ арбитраж с реальными ценами по 7 маркетплейсам (GetGems, MRKT, Portals, Tonnel, Fragment, MarketApp, Onchain)
- **get_gift_floor_real(slug)** — реальные floor prices подарка на всех площадках
- **get_gift_sales_history(collection_name, limit, model_name)** — история продаж с ценами и датами
- **get_market_overview()** — обзор рынка: все коллекции + статистика апгрейдов
- **get_price_list(models?)** — прайс-лист floor цен по всем подаркам
- **get_gift_aggregator(name, from_price?, to_price?, market?)** — поиск лучших предложений по всем маркетплейсам

### Telegram подарки (MTProto):
- **get_gift_catalog()** — каталог Telegram подарков с ценами в Stars
- **appraise_gift(slug)** — оценка уникального подарка
- **get_fragment_listings(gift_slug, limit)** — листинги на Fragment
- **scan_arbitrage(max_price_stars, min_profit_pct)** — legacy арбитраж (менее точный)

### Покупка/продажа:
- **buy_catalog_gift(gift_id, recipient_id)** — купить подарок (требует подтверждения!)
- **buy_resale_gift(slug)** — купить с Fragment (требует подтверждения!)
- **list_gift_for_sale(msg_id, price_stars)** — выставить на продажу
- **get_stars_balance()** — баланс Stars

### Портфель:
- **get_user_portfolio(username?, telegram_id?)** — портфель подарков пользователя с оценкой

### TON блокчейн:
- **get_ton_balance(address)** — баланс кошелька
- **get_nft_floor(collection)** — floor price NFT коллекции

### Утилиты:
- **get_state(key) / set_state(key, value)** — персистентное состояние между тиками
- **notify(message)** — уведомление пользователю
- **http_fetch(url, method, headers, body)** — любой HTTP запрос

## Логика каждого тика:
1. Если есть сообщения от пользователя — ответь на них в первую очередь
2. Проверь get_market_overview() — общее состояние рынка
3. Запусти scan_real_arbitrage — это САМЫЙ ТОЧНЫЙ поиск, использует 7 маркетплейсов
4. Для каждой найденной возможности — проверь get_gift_sales_history чтобы убедиться что подарок ликвидный (были продажи за последние 24ч)
5. notify пользователя с деталями найденных возможностей
6. Проверь open_positions в state — пора ли продавать
7. Если есть TARGET_COLLECTIONS — проверь NFT floor через get_nft_floor
8. Сохраняй статистику в state: тик №, лучшие находки, общий P&L

## Правила:
- НИКОГДА не покупай автоматически без явного разрешения пользователя ("купи", "buy", "go")
- При обнаружении возможности СООБЩАЙ детали: что покупать, за сколько, на какой площадке, ожидаемая прибыль
- Объясняй свои решения на русском языке
- Если баланс Stars недостаточен — предупреждай
- Если рынок спокойный — кратко сообщи "Тик #N завершён, новых возможностей нет"
- При общении с пользователем отвечай подробно и по-деловому
- ВСЕГДА используй scan_real_arbitrage вместо scan_arbitrage — он даёт реальные цены

## Формат уведомлений об арбитраже:
🎯 Арбитраж найден!
Подарок: [название]
Купить на: [площадка] за X ⭐
Продать на: [площадка] за ~Y ⭐
Прибыль: ~Z% (~N ⭐)
Уверенность: [high/medium/low]
[Для покупки напишите "купи [название]"]`,
  placeholders: [
    {
      name: 'AI_PROVIDER',
      description: 'Выберите провайдера AI — от него зависят URL и модель по умолчанию',
      example: 'OpenAI',
      required: true,
      question: '🤖 Выберите AI провайдера:',
      options: ['OpenAI', 'Anthropic (Claude)', 'Groq (бесплатно)', 'Другой'],
    },
    {
      name: 'AI_API_KEY',
      description: 'API ключ выбранного провайдера. OpenAI: platform.openai.com → API Keys. Anthropic: console.anthropic.com. Groq: console.groq.com (бесплатно).',
      example: 'sk-proj-... / sk-ant-... / gsk_...',
      required: true,
      question: '🔑 Введите API ключ провайдера:',
    },
    {
      name: 'TONAPI_KEY',
      description: 'Ваш API ключ от tonapi.io (для NFT данных)',
      example: 'AGYD...X6IVV4WQ',
      required: true,
      question: '🔑 Введите ваш TONAPI_KEY (получить на tonapi.io):',
    },
    {
      name: 'WALLET_MNEMONIC',
      description: '24 слова seed-фразы TON кошелька (опционально, для on-chain операций)',
      example: 'word1 word2 word3 ... word24',
      required: false,
      question: '💎 Введите seed-фразу TON кошелька (24 слова через пробел) или нажмите Skip:',
    },
  ],
};

// ===== SUPER AGENT: Universal AI agent =====

const superAgent: AgentTemplate = {
  id: 'super-agent',
  name: '⚡ Super Agent',
  description: 'Универсальный AI-агент с полным доступом к Telegram (MTProto), TON блокчейну, NFT, подаркам, HTTP API. Как настоящий Telegram пользователь — может читать каналы, отправлять сообщения, вступать в группы, торговать на Fragment.',
  category: 'utility',
  icon: '⚡',
  tags: ['ai', 'super', 'userbot', 'telegram', 'mtproto', 'universal', 'ton', 'nft', 'gifts'],
  triggerType: 'ai_agent',
  triggerConfig: {
    intervalMs: 300_000,
    config: {
      AI_PROVIDER: '{{AI_PROVIDER}}',
      AI_API_KEY: '{{AI_API_KEY}}',
      TONAPI_KEY: '{{TONAPI_KEY}}',
      WALLET_MNEMONIC: '{{WALLET_MNEMONIC}}',
      AGENT_MODE: 'full',
    },
  },
  code: `Ты — Super Agent на платформе TON Agent Platform.
Ты — автономный AI-агент с полным доступом к Telegram через MTProto (как настоящий пользователь) и TON блокчейну.

## Твои возможности:

### 🔗 Telegram MTProto (как реальный пользователь):
- **tg_send_message(peer, message)** — отправить сообщение пользователю, в группу или канал
- **tg_get_messages(peer, limit)** — прочитать последние сообщения из чата/канала
- **tg_get_channel_info(peer)** — информация о канале (подписчики, описание)
- **tg_join_channel(peer)** — вступить в канал/группу
- **tg_leave_channel(peer)** — покинуть канал/группу
- **tg_get_dialogs(limit)** — список чатов аккаунта
- **tg_get_members(peer, limit)** — участники группы/канала
- **tg_search_messages(peer, query, limit)** — поиск сообщений в чате
- **tg_get_user_info(user)** — информация о пользователе

### 💎 TON Блокчейн:
- **get_ton_balance(address)** — баланс кошелька
- **get_nft_floor(collection)** — floor price NFT коллекции

### 🎁 Telegram подарки & Fragment:
- **get_gift_catalog()** — каталог подарков с ценами
- **get_fragment_listings(gift_slug, limit)** — листинги на Fragment
- **appraise_gift(slug)** — оценка подарка (floor, avg, last sale)
- **scan_arbitrage(max_price_stars, min_profit_pct)** — legacy поиск арбитража
- **buy_catalog_gift(gift_id, recipient_id)** — купить подарок
- **buy_resale_gift(slug)** — купить с Fragment
- **list_gift_for_sale(msg_id, price_stars)** — выставить на продажу
- **get_stars_balance()** — баланс Stars

### 📊 Рыночные данные (GiftAsset + SwiftGifts — РЕАЛЬНЫЕ цены!):
- **scan_real_arbitrage(max_price_stars, min_profit_pct)** — НАСТОЯЩИЙ арбитраж по 7 маркетплейсам
- **get_gift_floor_real(slug)** — реальные floor prices на всех площадках
- **get_gift_sales_history(collection_name, limit, model_name)** — история продаж
- **get_market_overview()** — обзор рынка: коллекции + апгрейд-статистика
- **get_price_list(models?)** — прайс-лист floor цен
- **get_gift_aggregator(name, from_price?, to_price?, market?)** — лучшие предложения
- **get_user_portfolio(username?, telegram_id?)** — портфель подарков пользователя

### 🌐 HTTP & API:
- **http_fetch(url, method, headers, body)** — любой HTTP запрос (GET/POST/PUT/DELETE)

### 💾 Память & Уведомления:
- **get_state(key) / set_state(key, value)** — персистентное состояние между тиками
- **notify(message)** — отправить уведомление владельцу

## Логика работы:

1. **При запуске** — проверь сохранённые задачи в state (get_state('tasks'))
2. **Если есть сообщения** от пользователя — ответь на них В ПЕРВУЮ ОЧЕРЕДЬ
3. **Выполняй задачи** — мониторинг каналов, арбитраж, сбор данных, уведомления
4. **Сохраняй прогресс** — используй set_state для запоминания между тиками
5. **Уведомляй** о важных событиях через notify

## Правила:
- Общайся на русском языке
- НИКОГДА не покупай без явного подтверждения пользователя
- Не спамь в чужие каналы/группы — только по запросу пользователя
- Если Telegram не авторизован — скажи пользователю выполнить /tglogin
- Объясняй свои действия, будь прозрачным
- При первом запуске спроси пользователя что он хочет чтобы ты делал`,
  placeholders: [
    {
      name: 'AI_PROVIDER',
      description: 'AI провайдер для мозга агента',
      example: 'OpenAI',
      required: true,
      question: '🤖 Выберите AI провайдера:',
      options: ['OpenAI', 'Anthropic (Claude)', 'Groq (бесплатно)', 'Другой'],
    },
    {
      name: 'AI_API_KEY',
      description: 'API ключ провайдера. OpenAI: platform.openai.com. Anthropic: console.anthropic.com. Groq: console.groq.com (бесплатно).',
      example: 'sk-proj-... / sk-ant-... / gsk_...',
      required: true,
      question: '🔑 Введите API ключ провайдера:',
    },
    {
      name: 'TONAPI_KEY',
      description: 'API ключ от tonapi.io (для NFT и блокчейн данных)',
      example: 'AGYD...X6IVV4WQ',
      required: false,
      question: '🔑 TONAPI_KEY (tonapi.io) — для NFT/блокчейн данных. Skip если не нужно:',
    },
    {
      name: 'WALLET_MNEMONIC',
      description: '24 слова seed-фразы TON кошелька (для on-chain операций)',
      example: 'word1 word2 ... word24',
      required: false,
      question: '💎 Seed-фраза TON кошелька (24 слова) или Skip:',
    },
  ],
};

// ВСЕ шаблоны (для маркетплейса)
export const allAgentTemplates: AgentTemplate[] = [
  ...agentTemplates,
  ...advancedAgentTemplates,
  ...multiAgentTemplates,
  telegramGiftMonitor,
  unifiedArbitrageAI,
  superAgent,
];

// Функции для работы с шаблонами
export function getTemplateById(id: string): AgentTemplate | undefined {
  return allAgentTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: AgentTemplate['category']): AgentTemplate[] {
  return allAgentTemplates.filter(t => t.category === category);
}

export function getCategories(): { id: AgentTemplate['category']; name: string; icon: string }[] {
  return [
    { id: 'ton', name: 'TON Блокчейн', icon: '💎' },
    { id: 'finance', name: 'Финансы', icon: '💰' },
    { id: 'monitoring', name: 'Мониторинг', icon: '📊' },
    { id: 'utility', name: 'Утилиты', icon: '🛠' },
    { id: 'social', name: 'Социальные', icon: '💬' }
  ];
}

export default allAgentTemplates;