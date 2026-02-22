export type AgentStatus = 'active' | 'paused' | 'error' | 'frozen';
export type AgentTemplate = 'alert' | 'payment' | 'swap' | 'custom';
export type TriggerType = 'cron' | 'price' | 'event' | 'manual';

export interface Agent {
  id: string;
  owner_tg_id: number;
  name: string;
  description?: string;
  code: string;
  current_version: string;
  template_type: AgentTemplate;
  wallet_address: string;
  wallet_mnemonic_encrypted: string;
  wallet_max_spend_per_tx: number;
  wallet_max_spend_per_day: number;
  wallet_balance: number;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  user_priority?: number;
  status: AgentStatus;
  error_count: number;
  last_run_at?: Date;
  last_error_at?: Date;
  last_error_message?: string;
  is_public: boolean;
  is_purchasable: boolean;
  purchase_price_ton?: number;
  rent_price_ton_per_day?: number;
  author_id?: string;
  total_executions: number;
  total_spent_ton: number;
  created_at: Date;
  updated_at: Date;
}