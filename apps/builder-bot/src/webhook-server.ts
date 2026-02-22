// ============================================
// Webhook Server for TON Agent Platform
// ============================================

import express from 'express';
import { getRunnerAgent } from './agents/sub-agents/runner';
import { getDBTools } from './agents/tools/db-tools';
import { getMemoryManager } from './db/memory';
import { getWorkflowEngine } from './agent-cooperation';

const app = express();
app.use(express.json());

// ===== Webhook Routes =====

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook для агента
app.post('/webhook/:agentId', async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const secret = req.headers['x-webhook-secret'] as string;
  
  console.log(`🔗 Webhook received for agent #${agentId}`);
  
  try {
    // Получаем агента
    const agentResult = await getDBTools().getAgent(agentId, 0); // 0 = system user
    
    if (!agentResult.success || !agentResult.data) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const agent = agentResult.data;
    
    // Проверяем секрет если настроен
    const triggerConfig = agent.triggerConfig as Record<string, any>;
    if (triggerConfig?.secret && triggerConfig.secret !== secret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
    
    // Выполняем агента с данными вебхука
    const runner = getRunnerAgent();
    const result = await runner.runAgent({
      agentId,
      userId: agent.userId,
      context: {
        webhookData: req.body,
        headers: req.headers,
        query: req.query
      }
    });
    
    // Логируем
    await getMemoryManager().addMessage(
      agent.userId,
      'system',
      `Webhook triggered agent #${agentId}`,
      { type: 'webhook_triggered', agentId, success: result.success }
    );
    
    res.json({
      success: result.success,
      result: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal error'
    });
  }
});

// Webhook для workflow
app.post('/webhook/workflow/:workflowId', async (req, res) => {
  const workflowId = req.params.workflowId;
  
  console.log(`🔗 Webhook received for workflow ${workflowId}`);
  
  try {
    const engine = getWorkflowEngine();
    const workflow = engine.getWorkflow(workflowId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Выполняем workflow
    const result = await engine.executeWorkflow(workflowId, workflow.userId, req.body);
    
    res.json({
      success: result.success,
      result: result.finalOutput,
      executionTime: result.totalExecutionTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Workflow webhook error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Получить список агентов пользователя
app.get('/api/agents/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const apiKey = req.headers['x-api-key'] as string;
  
  // Проверка API ключа (в продакшене)
  // if (apiKey !== process.env.API_KEY) return res.status(401).json({ error: 'Invalid API key' });
  
  try {
    const result = await getDBTools().getUserAgents(userId);
    res.json(result.data || []);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Запустить агента
app.post('/api/agents/:agentId/run', async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const { userId, context } = req.body;
  
  try {
    const runner = getRunnerAgent();
    const result = await runner.runAgent({ agentId, userId, context });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Получить логи агента
app.get('/api/agents/:agentId/logs', async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const userId = parseInt(req.query.userId as string);
  const limit = parseInt(req.query.limit as string) || 20;
  
  try {
    const runner = getRunnerAgent();
    const result = await runner.getLogs(agentId, userId, limit);
    res.json(result.data?.logs || []);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Создать workflow
app.post('/api/workflows', async (req, res) => {
  const { userId, name, description, nodes } = req.body;
  
  try {
    const engine = getWorkflowEngine();
    const result = await engine.createWorkflow(userId, name, description, nodes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Запустить workflow
app.post('/api/workflows/:workflowId/run', async (req, res) => {
  const workflowId = req.params.workflowId;
  const { userId, input } = req.body;
  
  try {
    const engine = getWorkflowEngine();
    const result = await engine.executeWorkflow(workflowId, userId, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Получить workflow пользователя
app.get('/api/workflows/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  try {
    const engine = getWorkflowEngine();
    const workflows = engine.getUserWorkflows(userId);
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

// API: Получить плагины
app.get('/api/plugins', (req, res) => {
  const { getPluginManager } = require('./plugins-system');
  const manager = getPluginManager();
  res.json(manager.getAllPlugins());
});

// API: Установить плагин
app.post('/api/plugins/:pluginId/install', async (req, res) => {
  const { pluginId } = req.params;
  const { getPluginManager } = require('./plugins-system');
  const manager = getPluginManager();
  
  const success = await manager.installPlugin(pluginId);
  res.json({ success });
});

// ===== Start Server =====

const PORT = process.env.WEBHOOK_PORT || 3000;

export function startWebhookServer() {
  app.listen(PORT, () => {
    console.log(`🔗 Webhook server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Webhook endpoint: http://localhost:${PORT}/webhook/:agentId`);
  });
}

export default app;
