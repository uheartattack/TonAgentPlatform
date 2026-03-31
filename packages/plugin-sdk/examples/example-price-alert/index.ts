import { definePlugin } from '../../src';

export default definePlugin({
  name: 'price-alert-example',
  version: '1.0.0',
  description: 'Example plugin: alerts when TON price moves 5%+',
  tools: [
    {
      name: 'check_price_alert',
      description: 'Check if TON price has moved more than threshold%',
      parameters: {
        type: 'object',
        properties: {
          threshold: { type: 'number', description: 'Percentage threshold (default 5)' }
        }
      },
      execute: async ({ threshold = 5 }) => {
        // Example implementation
        return { triggered: false, currentPrice: 0, change: 0 };
      }
    }
  ]
});
