import { PluginMetadata } from '@ton-agent/shared-types';
import { ActionDefinition, PluginContext } from './types';

export abstract class Plugin {
  abstract metadata: PluginMetadata;

  abstract init(context: PluginContext): Promise<void>;
  abstract destroy(): Promise<void>;
  abstract getActions(): ActionDefinition[];
}

// ────────────────────────────────────────────────────────────
// Functional factory API — simpler alternative to class syntax
// ────────────────────────────────────────────────────────────

export interface PluginToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  execute: (params: any, context?: PluginContext) => Promise<any>;
}

export interface PluginDefinition {
  name: string;
  version: string;
  description: string;
  author?: string;
  permissions?: string[];
  tools: PluginToolDefinition[];
  onInit?: (context: PluginContext) => Promise<void>;
  onDestroy?: () => Promise<void>;
}

/**
 * definePlugin — functional helper to create a plugin without extending Plugin class.
 *
 * @example
 * export default definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   description: 'Does something useful',
 *   tools: [{ name: 'my_tool', description: '...', execute: async (params) => ({}) }],
 * });
 */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition;
}