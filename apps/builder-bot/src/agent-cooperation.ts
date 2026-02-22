// ============================================
// Agent Cooperation System
// Кооперация агентов - цепочки и workflow
// ============================================

import { getDBTools } from './agents/tools/db-tools';
import { getRunnerAgent } from './agents/sub-agents/runner';
import { getMemoryManager } from './db/memory';

// Тип связи между агентами
export type AgentLinkType = 
  | 'sequential'    // Последовательно: А → Б → В
  | 'parallel'      // Параллельно: А и Б и В
  | 'conditional'   // Условно: если А успешно → Б, иначе → В
  | 'loop'          // Цикл: повторять А пока условие
  | 'fan-out'       // Распределение: А → [Б, В, Г]
  | 'fan-in';       // Сборка: [А, Б, В] → Г

// Узел workflow
export interface WorkflowNode {
  id: string;
  agentId: number;
  name: string;
  type: AgentLinkType;
  next?: string[];        // ID следующих узлов
  condition?: string;     // Условие для conditional
  maxRetries?: number;    // Максимум попыток
  timeout?: number;       // Таймаут в мс
}

// Workflow (цепочка агентов)
export interface Workflow {
  id: string;
  name: string;
  description: string;
  userId: number;
  nodes: WorkflowNode[];
  startNode: string;
  isActive: boolean;
  createdAt: Date;
  lastRun?: Date;
}

// Результат выполнения узла
export interface NodeResult {
  nodeId: string;
  agentId: number;
  success: boolean;
  output: any;
  executionTime: number;
  error?: string;
  retries: number;
}

// Результат выполнения workflow
export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  nodeResults: NodeResult[];
  totalExecutionTime: number;
  finalOutput?: any;
  error?: string;
}

// ===== Workflow Engine =====

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private runningWorkflows: Set<string> = new Set();
  
  // Создать workflow
  async createWorkflow(
    userId: number,
    name: string,
    description: string,
    nodes: WorkflowNode[]
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Валидация
      if (nodes.length === 0) {
        return { success: false, error: 'Workflow must have at least one node' };
      }
      
      // Проверяем что все агенты существуют
      for (const node of nodes) {
        const agent = await getDBTools().getAgent(node.agentId, userId);
        if (!agent.success) {
          return { success: false, error: `Agent ${node.agentId} not found` };
        }
      }
      
      const workflowId = `wf_${userId}_${Date.now()}`;
      const workflow: Workflow = {
        id: workflowId,
        name,
        description,
        userId,
        nodes,
        startNode: nodes[0].id,
        isActive: false,
        createdAt: new Date()
      };
      
      this.workflows.set(workflowId, workflow);
      
      // Сохраняем в БД
      await getMemoryManager().addMessage(
        userId,
        'system',
        `Workflow "${name}" created with ${nodes.length} nodes`,
        { type: 'workflow_created', workflowId, nodeCount: nodes.length }
      );
      
      return { success: true, workflowId };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create workflow' 
      };
    }
  }
  
  // Выполнить workflow
  async executeWorkflow(
    workflowId: string,
    userId: number,
    initialInput?: any
  ): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        workflowId,
        success: false,
        nodeResults: [],
        totalExecutionTime: 0,
        error: 'Workflow not found'
      };
    }
    
    if (workflow.userId !== userId) {
      return {
        workflowId,
        success: false,
        nodeResults: [],
        totalExecutionTime: 0,
        error: 'Access denied'
      };
    }
    
    if (this.runningWorkflows.has(workflowId)) {
      return {
        workflowId,
        success: false,
        nodeResults: [],
        totalExecutionTime: 0,
        error: 'Workflow is already running'
      };
    }
    
    this.runningWorkflows.add(workflowId);
    const startTime = Date.now();
    const nodeResults: NodeResult[] = [];
    
    try {
      console.log(`🔄 Starting workflow: ${workflow.name}`);
      
      // Выполняем начиная со стартового узла
      const result = await this.executeNode(
        workflow,
        workflow.startNode,
        userId,
        initialInput,
        nodeResults
      );
      
      const totalExecutionTime = Date.now() - startTime;
      
      // Логируем
      await getMemoryManager().addMessage(
        userId,
        'system',
        `Workflow "${workflow.name}" completed`,
        { 
          type: 'workflow_completed', 
          workflowId, 
          success: result.success,
          executionTime: totalExecutionTime 
        }
      );
      
      this.runningWorkflows.delete(workflowId);
      
      return {
        workflowId,
        success: result.success,
        nodeResults,
        totalExecutionTime,
        finalOutput: result.output,
        error: result.error
      };
    } catch (error) {
      this.runningWorkflows.delete(workflowId);
      return {
        workflowId,
        success: false,
        nodeResults,
        totalExecutionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Workflow execution failed'
      };
    }
  }
  
  // Выполнить узел
  private async executeNode(
    workflow: Workflow,
    nodeId: string,
    userId: number,
    input: any,
    results: NodeResult[]
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      return { success: false, error: `Node ${nodeId} not found` };
    }
    
    const nodeStartTime = Date.now();
    let retries = 0;
    let lastError: string | undefined;
    
    // Пробуем выполнить с ретраями
    while (retries <= (node.maxRetries || 0)) {
      try {
        console.log(`▶️ Executing node: ${node.name} (agent #${node.agentId})`);
        
        // Запускаем агента
        const runner = getRunnerAgent();
        const result = await runner.runAgent({
          agentId: node.agentId,
          userId,
          context: { input, workflowId: workflow.id }
        });
        
        const executionTime = Date.now() - nodeStartTime;
        
        const nodeResult: NodeResult = {
          nodeId,
          agentId: node.agentId,
          success: result.success && result.data?.success,
          output: result.data?.executionResult,
          executionTime,
          error: result.error,
          retries
        };
        
        results.push(nodeResult);
        
        if (result.success && result.data?.success) {
          console.log(`✅ Node ${node.name} completed`);
          
          // Выполняем следующие узлы
          if (node.next && node.next.length > 0) {
            const nextResults = await this.executeNextNodes(
              workflow,
              node,
              userId,
              result.data?.executionResult,
              results
            );
            
            // Возвращаем результат последнего узла
            const lastResult = nextResults[nextResults.length - 1];
            return {
              success: lastResult?.success ?? true,
              output: lastResult?.output,
              error: lastResult?.error
            };
          }
          
          return { success: true, output: result.data?.executionResult };
        } else {
          throw new Error(result.error || result.data?.message || 'Agent execution failed');
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        retries++;
        
        if (retries <= (node.maxRetries || 0)) {
          console.log(`🔄 Retry ${retries}/${node.maxRetries} for node ${node.name}`);
          await new Promise(r => setTimeout(r, 1000 * retries)); // Exponential backoff
        }
      }
    }
    
    // Все ретраи исчерпаны
    return { success: false, error: lastError };
  }
  
  // Выполнить следующие узлы
  private async executeNextNodes(
    workflow: Workflow,
    currentNode: WorkflowNode,
    userId: number,
    input: any,
    results: NodeResult[]
  ): Promise<NodeResult[]> {
    if (!currentNode.next || currentNode.next.length === 0) {
      return [];
    }
    
    switch (currentNode.type) {
      case 'parallel':
        // Параллельное выполнение
        const parallelResults = await Promise.all(
          currentNode.next.map(nextId =>
            this.executeNode(workflow, nextId, userId, input, results)
          )
        );
        return parallelResults.map((r, i) => ({
          nodeId: currentNode.next![i],
          agentId: 0,
          success: r.success,
          output: r.output,
          executionTime: 0,
          retries: 0
        }));
        
      case 'conditional':
        // Условное выполнение
        const condition = this.evaluateCondition(currentNode.condition, input);
        const nextId = condition ? currentNode.next[0] : currentNode.next[1];
        if (nextId) {
          await this.executeNode(workflow, nextId, userId, input, results);
        }
        return [];
        
      case 'fan-out':
        // Распределение
        const fanOutResults = await Promise.all(
          currentNode.next.map((nextId, index) =>
            this.executeNode(workflow, nextId, userId, { ...input, index }, results)
          )
        );
        return fanOutResults.map((r, i) => ({
          nodeId: currentNode.next![i],
          agentId: 0,
          success: r.success,
          output: r.output,
          executionTime: 0,
          retries: 0
        }));
        
      case 'fan-in':
        // Сборка - собираем результаты всех предыдущих
        const fanInInput = results
          .filter(r => currentNode.next!.includes(r.nodeId))
          .map(r => r.output);
        if (currentNode.next[0]) {
          await this.executeNode(workflow, currentNode.next[0], userId, fanInInput, results);
        }
        return [];
        
      default:
        // Последовательное выполнение
        for (const nextId of currentNode.next) {
          await this.executeNode(workflow, nextId, userId, input, results);
        }
        return [];
    }
  }
  
  // Оценить условие
  private evaluateCondition(condition: string | undefined, data: any): boolean {
    if (!condition) return true;
    
    try {
      // Простые условия
      if (condition.includes('>')) {
        const [left, right] = condition.split('>');
        return this.getValue(left.trim(), data) > this.getValue(right.trim(), data);
      }
      if (condition.includes('<')) {
        const [left, right] = condition.split('<');
        return this.getValue(left.trim(), data) < this.getValue(right.trim(), data);
      }
      if (condition.includes('==')) {
        const [left, right] = condition.split('==');
        return this.getValue(left.trim(), data) == this.getValue(right.trim(), data);
      }
      
      return !!this.getValue(condition, data);
    } catch {
      return false;
    }
  }
  
  // Получить значение из данных по пути
  private getValue(path: string, data: any): any {
    const keys = path.split('.');
    let value = data;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }
  
  // Получить workflow
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }
  
  // Получить все workflow пользователя
  getUserWorkflows(userId: number): Workflow[] {
    return Array.from(this.workflows.values()).filter(w => w.userId === userId);
  }
  
  // Удалить workflow
  deleteWorkflow(id: string, userId: number): boolean {
    const workflow = this.workflows.get(id);
    if (workflow && workflow.userId === userId) {
      this.workflows.delete(id);
      return true;
    }
    return false;
  }
  
  // Получить шаблоны workflow
  getWorkflowTemplates(): Array<{ name: string; description: string; nodes: WorkflowNode[] }> {
    return [
      {
        name: '💎 TON Monitor → Alert',
        description: 'Мониторинг цены TON → Уведомление если цена изменилась',
        nodes: [
          { id: 'monitor', agentId: 0, name: 'TON Price Monitor', type: 'sequential', next: ['alert'] },
          { id: 'alert', agentId: 0, name: 'Telegram Notifier', type: 'sequential' }
        ]
      },
      {
        name: '📊 Multi-DEX Arbitrage',
        description: 'Проверка цен на DeDust и STON.fi → Поиск арбитража',
        nodes: [
          { id: 'dedust', agentId: 0, name: 'DeDust Price', type: 'parallel', next: ['compare'] },
          { id: 'stonfi', agentId: 0, name: 'STON.fi Price', type: 'parallel', next: ['compare'] },
          { id: 'compare', agentId: 0, name: 'Compare Prices', type: 'fan-in', next: ['notify'] },
          { id: 'notify', agentId: 0, name: 'Send Alert', type: 'sequential' }
        ]
      },
      {
        name: '💰 Balance Check → Decision',
        description: 'Проверка баланса → Если низкий, уведомить',
        nodes: [
          { id: 'check', agentId: 0, name: 'Balance Checker', type: 'conditional', next: ['alert', 'ok'] },
          { id: 'alert', agentId: 0, name: 'Low Balance Alert', type: 'sequential' },
          { id: 'ok', agentId: 0, name: 'Balance OK Log', type: 'sequential' }
        ]
      }
    ];
  }

  // ── Создать workflow из текстового описания с AI ─────────────
  async createFromDescription(
    userId: number,
    description: string,
    existingAgents: Array<{ id: number; name: string; description: string }>
  ): Promise<{
    success: boolean;
    plan?: string;
    workflowId?: string;
    suggestedAgents?: string[];
    error?: string;
  }> {
    try {
      const PROXY_BASE = process.env.OPENAI_BASE_URL || `${process.env.CLAUDE_BASE_URL || 'http://127.0.0.1:8317'}/v1`;
      const PROXY_KEY = process.env.OPENAI_API_KEY || 'ton-agent-key-123';
      const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

      const agentList = existingAgents.length > 0
        ? existingAgents.map(a => `• Agent #${a.id}: "${a.name}" — ${a.description}`).join('\n')
        : '(пользователь не создал агентов ещё)';

      const systemPrompt = `Ты — архитектор AI-workflow для платформы TON Agent Platform.
Тебе дают описание желаемого workflow и список агентов пользователя.
Ответь ТОЛЬКО JSON (без markdown) следующего формата:
{
  "canBuild": true/false,
  "planText": "Понятное описание что будет делать workflow (по-русски)",
  "steps": ["Шаг 1: ...", "Шаг 2: ..."],
  "usedAgentIds": [1, 2],  // IDs агентов которые войдут в workflow (только если они есть)
  "connectionType": "sequential" | "parallel" | "conditional",
  "missingAgents": ["Описание агента которого нужно создать если не хватает"]
}`;

      const userPrompt = `Пользователь хочет создать workflow:\n"${description}"\n\nЕго агенты:\n${agentList}\n\nСоздай план workflow.`;

      const res = await fetch(`${PROXY_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PROXY_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });

      if (!res.ok) throw new Error(`AI error ${res.status}`);
      const data = await res.json() as any;
      const text: string = data.choices?.[0]?.message?.content || '{}';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const plan = JSON.parse(jsonMatch[0]);

      if (!plan.canBuild || !plan.usedAgentIds?.length) {
        // Нельзя создать — возвращаем план с подсказками
        return {
          success: true,
          plan: plan.planText || 'Для этого workflow нужны дополнительные агенты.',
          suggestedAgents: plan.missingAgents || [],
        };
      }

      // Создаём workflow из существующих агентов
      const connectionType: AgentLinkType = plan.connectionType || 'sequential';
      const nodes: WorkflowNode[] = plan.usedAgentIds.map((agentId: number, i: number) => {
        const agent = existingAgents.find(a => a.id === agentId);
        return {
          id: `node_${i}`,
          agentId,
          name: agent?.name || `Agent #${agentId}`,
          type: connectionType,
          next: i < plan.usedAgentIds.length - 1 ? [`node_${i + 1}`] : undefined,
        };
      });

      const wfName = description.slice(0, 40);
      const result = await this.createWorkflow(userId, wfName, description, nodes);

      return {
        success: result.success,
        plan: plan.planText,
        workflowId: result.workflowId,
        suggestedAgents: plan.missingAgents || [],
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка создания workflow',
      };
    }
  }
}

// Singleton
let workflowEngine: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine();
  }
  return workflowEngine;
}

export default getWorkflowEngine;
