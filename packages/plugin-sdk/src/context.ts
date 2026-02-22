import { PluginContext } from './types';
import { MemoryStorageAdapter } from './storage';

export function createPluginContext(agentId: string): PluginContext {
  return {
    agentId,
    storage: new MemoryStorageAdapter(),
    logger: {
      info: (msg: string, meta?: any) => console.log(`[${agentId}] INFO:`, msg, meta),
      error: (msg: string, meta?: any) => console.error(`[${agentId}] ERROR:`, msg, meta),
      warn: (msg: string, meta?: any) => console.warn(`[${agentId}] WARN:`, msg, meta),
    },
  };
}