import type { Agent } from './agent';

export function calculatePriority(agent: Agent): number {
  if (agent.user_priority !== undefined) {
    return agent.user_priority;
  }

  const defaults: Record<string, number> = {
    'payment_out': 1,
    'payment_subscription': 2,
    'swap_dex': 3,
    'buy_limit': 4,
    'alert_price_critical': 5,
    'alert_price': 6,
    'alert_balance': 7,
    'analytics': 8,
    'report': 9,
    'other': 10
  };

  return defaults[agent.template_type] || 10;
}