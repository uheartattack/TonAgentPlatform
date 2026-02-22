export interface User {
  id: number;
  tg_id: number;
  tg_username?: string;
  wallet_address?: string;
  created_at: Date;
  updated_at: Date;
}