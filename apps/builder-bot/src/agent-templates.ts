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
  triggerType: 'manual' | 'scheduled' | 'webhook';
  triggerConfig: Record<string, any>;
  placeholders: Array<{
    name: string;
    description: string;
    example: string;
    required: boolean;
    question?: string;   // Текст вопроса для wizard (если нужно спросить у пользователя)
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

const arbitrageScanner: AgentTemplate = {
  id: 'arbitrage-scanner',
  name: 'Arbitrage Scanner',
  description: 'Ищет арбитражные возможности между DEX',
  category: 'finance',
  icon: '⚡',
  tags: ['arbitrage', 'dex', 'trading', 'opportunity'],
  triggerType: 'scheduled',
  triggerConfig: { intervalMs: 30000 },
  code: `
async function agent(context) {
  const tokenAddress = context.config.TOKEN_ADDRESS;
  const minProfit = parseFloat(context.config.MIN_PROFIT) || 0.5;
  
  if (!tokenAddress) {
    return { success: false, error: 'TOKEN_ADDRESS не указан' };
  }
  
  try {
    console.log('⚡ Сканирую арбитраж...');
    
    const [dedustPrice, stonfiPrice] = await Promise.all([
      fetch('https://api.dedust.io/v2/pools/' + tokenAddress + '/price').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('https://api.ston.fi/v1/pools?token=' + tokenAddress).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    
    const price1 = dedustPrice?.price ? parseFloat(dedustPrice.price) : 0;
    const price2 = stonfiPrice?.pools?.[0]?.price ? parseFloat(stonfiPrice.pools[0].price) : 0;
    
    if (!price1 || !price2) {
      return { success: true, result: { error: 'Не удалось получить цены' } };
    }
    
    const diff = Math.abs(price1 - price2);
    const avgPrice = (price1 + price2) / 2;
    const profitPercent = (diff / avgPrice) * 100;
    
    const buyOn = price1 < price2 ? 'DeDust' : 'STON.fi';
    const sellOn = price1 < price2 ? 'STON.fi' : 'DeDust';
    
    let opportunity = null;
    if (profitPercent >= minProfit) {
      opportunity = { profit: profitPercent.toFixed(2) + '%', buyOn, sellOn };
    }
    
    return {
      success: true,
      result: { token: tokenAddress, prices: { dedust: price1, stonfi: price2 }, profitPercent: profitPercent.toFixed(2) + '%', opportunity }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
`,
  placeholders: [
    { name: 'TOKEN_ADDRESS', description: 'Адрес токена для арбитража', example: 'EQCx...', required: true },
    { name: 'MIN_PROFIT', description: 'Минимальный профит для уведомления (%)', example: '0.5', required: false }
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
  arbitrageScanner,
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
    { name: 'WALLET_ADDRESS', description: 'Адрес TON кошелька', example: 'UQB5Ltvn5_q9axVSBXd4GGUVZaAh-hNgPT5emHjNsyYUDgzf', required: true },
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

// ВСЕ шаблоны (для маркетплейса)
export const allAgentTemplates: AgentTemplate[] = [
  ...agentTemplates,
  ...advancedAgentTemplates,
  ...multiAgentTemplates,
  telegramGiftMonitor,
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