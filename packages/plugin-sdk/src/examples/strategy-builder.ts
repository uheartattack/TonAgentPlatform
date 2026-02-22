import { Plugin } from '../base-plugin';
import { PluginMetadata } from '@ton-agent/shared-types';
import { ActionDefinition, PluginContext } from '../types';

interface StrategyNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'split';
  config: any;
  next?: string[];
}

interface Strategy {
  id: string;
  name: string;
  nodes: StrategyNode[];
  active: boolean;
}

export class StrategyBuilderPlugin extends Plugin {
  metadata: PluginMetadata = {
    name: 'StrategyBuilder',
    version: '1.0.0',
    author: 'TON Agent Platform',
    description: 'Visual trading strategy builder with templates',
    permissions: ['wallet:spend:limited', 'storage:persistent', 'notification'],
  };

  async init(context: PluginContext): Promise<void> {
    context.logger.info('StrategyBuilder plugin initialized');
  }

  async destroy(): Promise<void> {}

  getActions(): ActionDefinition[] {
    return [
      {
        name: 'createStrategy',
        description: 'Create a new trading strategy',
        params: [
          { name: 'name', type: 'string', required: true },
          { name: 'template', type: 'string', required: false },
        ],
        execute: this.createStrategy.bind(this),
      },
      {
        name: 'addNode',
        description: 'Add a node to strategy',
        params: [
          { name: 'strategy_id', type: 'string', required: true },
          { name: 'node', type: 'object', required: true },
        ],
        execute: this.addNode.bind(this),
      },
      {
        name: 'executeStrategy',
        description: 'Execute a strategy',
        params: [
          { name: 'strategy_id', type: 'string', required: true },
        ],
        execute: this.executeStrategy.bind(this),
      },
      {
        name: 'getTemplates',
        description: 'Get available strategy templates',
        params: [],
        execute: this.getTemplates.bind(this),
      },
    ];
  }

  private async createStrategy(params: any, context: PluginContext): Promise<Strategy> {
    const { name, template } = params;

    const strategy: Strategy = {
      id: `strategy_${Date.now()}`,
      name,
      nodes: template ? this.loadTemplate(template) : [],
      active: false,
    };

    await context.storage.set(`strategy:${strategy.id}`, strategy);
    context.logger.info(`Created strategy: ${name}`);

    return strategy;
  }

  private async addNode(params: any, context: PluginContext): Promise<any> {
    const { strategy_id, node } = params;

    const strategy = await context.storage.get(`strategy:${strategy_id}`);
    if (!strategy) throw new Error('Strategy not found');

    strategy.nodes.push(node);
    await context.storage.set(`strategy:${strategy_id}`, strategy);

    return { success: true, nodes_count: strategy.nodes.length };
  }

  private async executeStrategy(params: any, context: PluginContext): Promise<any> {
    const { strategy_id } = params;

    const strategy = await context.storage.get(`strategy:${strategy_id}`);
    if (!strategy) throw new Error('Strategy not found');

    context.logger.info(`Executing strategy: ${strategy.name}`);

    // Простая симуляция выполнения
    const result = {
      strategy_id,
      executed_at: new Date(),
      nodes_executed: strategy.nodes.length,
      status: 'completed',
    };

    return result;
  }

  private async getTemplates(params: any, context: PluginContext): Promise<any> {
    return {
      templates: [
        { id: 'dca', name: 'Dollar Cost Averaging', description: 'Buy fixed amount at intervals' },
        { id: 'grid', name: 'Grid Trading', description: 'Buy low, sell high in grid' },
        { id: 'momentum', name: 'Momentum', description: 'Follow price momentum' },
      ],
    };
  }

  private loadTemplate(template: string): StrategyNode[] {
    const templates: Record<string, StrategyNode[]> = {
      dca: [
        { id: '1', type: 'trigger', config: { schedule: '0 0 * * 0' }, next: ['2'] },
        { id: '2', type: 'action', config: { type: 'buy', amount: 100 } },
      ],
      grid: [
        { id: '1', type: 'trigger', config: { type: 'price_change' }, next: ['2'] },
        { id: '2', type: 'condition', config: { if: 'price < buy_level' }, next: ['3', '4'] },
        { id: '3', type: 'action', config: { type: 'buy' } },
        { id: '4', type: 'action', config: { type: 'sell' } },
      ],
    };

    return templates[template] || [];
  }
}