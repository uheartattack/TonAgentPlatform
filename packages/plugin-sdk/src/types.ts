export interface PluginContext {
  agentId: string;
  storage: StorageAdapter;
  logger: Logger;
  wallet?: WalletContext;
}

export interface WalletContext {
  address: string;
  balance: number;
  send: (to: string, amount: number) => Promise<void>;
}

export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
}

export interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

export type ParamType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface ActionDefinition {
  name: string;
  description: string;
  params: Array<{
    name: string;
    type: ParamType;
    required: boolean;
    description?: string;
  }>;
  execute: (params: any, context: PluginContext) => Promise<any>;
}