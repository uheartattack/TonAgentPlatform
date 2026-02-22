import { PluginMetadata } from '@ton-agent/shared-types';
import { ActionDefinition, PluginContext } from './types';

export abstract class Plugin {
  abstract metadata: PluginMetadata;

  abstract init(context: PluginContext): Promise<void>;
  abstract destroy(): Promise<void>;
  abstract getActions(): ActionDefinition[];
}