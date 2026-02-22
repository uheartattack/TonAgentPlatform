import { Plugin } from '../base-plugin';
import { PluginMetadata } from '@ton-agent/shared-types';
import { ActionDefinition, PluginContext } from '../types';

interface PriceSource {
  name: string;
  url: string;
  weight: number;
  reliability: number;
}

interface PriceFeed {
  asset: string;
  price: number;
  sources: Array<{
    source: string;
    price: number;
    timestamp: Date;
  }>;
  confidence: number;
  timestamp: Date;
}

interface CustomDataRequest {
  type: 'weather' | 'sports' | 'election' | 'flight_status' | 'custom';
  query: string;
  sources: string[];
}

export class OraclePlugin extends Plugin {
  metadata: PluginMetadata = {
    name: 'Oracle',
    version: '1.0.0',
    author: 'TON Agent Platform',
    description: 'Price feeds and external data aggregator',
    permissions: ['network:external', 'network:ton', 'storage:persistent'],
  };

  async init(context: PluginContext): Promise<void> {
    context.logger.info('Oracle plugin initialized');

    // Инициализация дефолтных источников
    const defaultSources: PriceSource[] = [
      { name: 'CoinGecko', url: 'https://api.coingecko.com', weight: 1.0, reliability: 0.95 },
      { name: 'CoinMarketCap', url: 'https://api.coinmarketcap.com', weight: 1.2, reliability: 0.98 },
      { name: 'Binance', url: 'https://api.binance.com', weight: 1.5, reliability: 0.99 },
      { name: 'DeDust', url: 'https://api.dedust.io', weight: 0.8, reliability: 0.85 },
    ];

    await context.storage.set('price_sources', defaultSources);
  }

  async destroy(): Promise<void> {}

  getActions(): ActionDefinition[] {
    return [
      {
        name: 'getPrice',
        description: 'Get aggregated price from multiple sources',
        params: [
          { name: 'asset', type: 'string', required: true, description: 'Asset symbol (e.g., TON, BTC)' },
          { name: 'vs_currency', type: 'string', required: false, description: 'Quote currency (default: USD)' },
        ],
        execute: this.getPrice.bind(this),
      },
      {
        name: 'getCustomData',
        description: 'Get custom off-chain data',
        params: [
          { name: 'type', type: 'string', required: true },
          { name: 'query', type: 'string', required: true },
          { name: 'sources', type: 'array', required: false },
        ],
        execute: this.getCustomData.bind(this),
      },
      {
        name: 'addSource',
        description: 'Add a custom price source',
        params: [
          { name: 'name', type: 'string', required: true },
          { name: 'url', type: 'string', required: true },
          { name: 'weight', type: 'number', required: false },
        ],
        execute: this.addSource.bind(this),
      },
      {
        name: 'requestData',
        description: 'Request data from a specific API',
        params: [
          { name: 'url', type: 'string', required: true },
          { name: 'method', type: 'string', required: false },
          { name: 'params', type: 'object', required: false },
        ],
        execute: this.requestData.bind(this),
      },
      {
        name: 'verifyOnChain',
        description: 'Verify data on TON blockchain',
        params: [
          { name: 'data', type: 'object', required: true },
          { name: 'contract', type: 'string', required: true },
        ],
        execute: this.verifyOnChain.bind(this),
      },
    ];
  }

  private async getPrice(params: any, context: PluginContext): Promise<PriceFeed> {
    const { asset, vs_currency = 'USD' } = params;

    context.logger.info(`Fetching price for ${asset}/${vs_currency}`);

    const sources = await context.storage.get('price_sources') || [];

    // Mock данные от разных источников
    const source_prices = [
      { source: 'CoinGecko', price: 5.45, timestamp: new Date() },
      { source: 'CoinMarketCap', price: 5.47, timestamp: new Date() },
      { source: 'Binance', price: 5.46, timestamp: new Date() },
      { source: 'DeDust', price: 5.44, timestamp: new Date() },
    ];

    // Вычисляем медиану для устранения выбросов
    const prices = source_prices.map(s => s.price).sort((a, b) => a - b);
    const median_price = prices[Math.floor(prices.length / 2)];

    // Взвешенное среднее с учётом надёжности
    let weighted_sum = 0;
    let total_weight = 0;

    for (const sp of source_prices) {
      const source = sources.find((s: PriceSource) => s.name === sp.source);
      const weight = source ? source.weight * source.reliability : 1.0;
      weighted_sum += sp.price * weight;
      total_weight += weight;
    }

    const aggregated_price = weighted_sum / total_weight;

    // Confidence based on agreement between sources
    const max_deviation = Math.max(...prices) - Math.min(...prices);
    const confidence = 1 - (max_deviation / median_price);

    const feed: PriceFeed = {
      asset,
      price: aggregated_price,
      sources: source_prices,
      confidence,
      timestamp: new Date(),
    };

    await context.storage.set(`price:${asset}:${vs_currency}:latest`, feed);

    context.logger.info(`${asset} price: ${aggregated_price.toFixed(4)} ${vs_currency} (confidence: ${(confidence * 100).toFixed(1)}%)`);

    return feed;
  }

  private async getCustomData(params: any, context: PluginContext): Promise<any> {
    const { type, query, sources = [] } = params;

    context.logger.info(`Fetching custom data: ${type} - ${query}`);

    // Mock responses based on type
    const responses: Record<string, any> = {
      weather: {
        location: query,
        temperature: 22,
        condition: 'Sunny',
        humidity: 65,
        source: 'OpenWeather',
      },
      sports: {
        event: query,
        score: '2-1',
        status: 'finished',
        source: 'ESPN',
      },
      election: {
        location: query,
        results: { candidate_a: 52, candidate_b: 48 },
        status: 'preliminary',
        source: 'AP',
      },
      flight_status: {
        flight: query,
        status: 'On Time',
        departure: '14:30',
        arrival: '18:45',
        source: 'FlightAware',
      },
    };

    const result = responses[type] || { query, data: 'No data available', source: 'none' };

    await context.storage.set(`custom_data:${type}:${query}`, {
      ...result,
      timestamp: new Date(),
    });

    return result;
  }

  private async addSource(params: any, context: PluginContext): Promise<any> {
    const { name, url, weight = 1.0 } = params;

    const sources = await context.storage.get('price_sources') || [];

    const new_source: PriceSource = {
      name,
      url,
      weight,
      reliability: 0.5, // Начальная надёжность, будет корректироваться
    };

    sources.push(new_source);
    await context.storage.set('price_sources', sources);

    context.logger.info(`Added price source: ${name}`);

    return {
      success: true,
      total_sources: sources.length,
      source: new_source,
    };
  }

  private async requestData(params: any, context: PluginContext): Promise<any> {
    const { url, method = 'GET', params: query_params = {} } = params;

    context.logger.info(`Requesting data from: ${url}`);

    // Mock HTTP request
    const response = {
      url,
      method,
      status: 200,
      data: {
        message: 'Mock response',
        timestamp: new Date(),
        params: query_params,
      },
    };

    return response;
  }

  private async verifyOnChain(params: any, context: PluginContext): Promise<any> {
    const { data, contract } = params;

    context.logger.info(`Verifying data on contract: ${contract}`);

    // Mock on-chain verification
    const verification = {
      contract,
      data_hash: this.hashData(data),
      verified: true,
      block_height: 12345678,
      timestamp: new Date(),
    };

    return verification;
  }

  private hashData(data: any): string {
    // Simple mock hash
    return 'hash_' + JSON.stringify(data).length.toString(16);
  }
}