export interface PluginMetadata {
  name: string;
  version: string;
  author: string;
  description: string;
  permissions: string[];
  dependencies?: string[];
  hooks?: string[];
}

export type PluginPermission =
  | 'wallet:read'
  | 'wallet:spend:limited'
  | 'wallet:spend:unlimited'
  | 'network:external'
  | 'network:ton'
  | 'storage:persistent'
  | 'agent:spawn'
  | 'notification';