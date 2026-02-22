import { logger } from '../utils/logger.js';
import { PluginError } from '../utils/errors.js';

// Simplified version without plugin imports for now
// TODO: Load plugins dynamically

export class PluginLoader {
  private loadedPlugins: Map<string, any> = new Map();

  async loadPlugin(pluginName: string): Promise<any> {
    if (this.loadedPlugins.has(pluginName)) {
      return this.loadedPlugins.get(pluginName)!;
    }

    logger.warn(`Plugin ${pluginName} not loaded - dynamic loading not yet implemented`);
    return null;
  }

  getPlugin(pluginName: string): any {
    return this.loadedPlugins.get(pluginName);
  }

  async loadAll(): Promise<void> {
    logger.info('Plugin loading skipped - will be implemented later');
  }
}

export const pluginLoader = new PluginLoader();
