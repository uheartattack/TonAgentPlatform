/**
 * MCP Client — connect to external MCP servers
 * Agents can connect to MCP servers and use their tools
 * Uses stdio transport (spawn process) or SSE transport (HTTP)
 */

// Simple MCP client over HTTP/SSE (no heavy SDK dependency)
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string; // SSE endpoint URL
  apiKey?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

const serverConnections = new Map<string, MCPConnection>();

class MCPConnection {
  private tools: MCPTool[] = [];
  private connected = false;

  constructor(private config: MCPServerConfig) {}

  async connect(): Promise<void> {
    try {
      // Fetch available tools from MCP server
      const resp = await fetch(`${this.config.url}/tools/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json() as any;
      this.tools = data.result?.tools || data.tools || [];
      this.connected = true;
      console.log(`[MCP] Connected to ${this.config.id}: ${this.tools.length} tools`);
    } catch (e: any) {
      console.warn(`[MCP] Failed to connect to ${this.config.id}: ${e.message}`);
      this.connected = false;
    }
  }

  async callTool(toolName: string, args: any): Promise<any> {
    if (!this.connected) await this.connect();

    const resp = await fetch(`${this.config.url}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: args },
        id: Date.now(),
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await resp.json() as any;
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.result;
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.connected = false;
  }

  getConfig(): MCPServerConfig {
    return this.config;
  }
}

// ── Public API ──

const MAX_MCP_CONNECTIONS = 50;

export async function connectMCPServer(config: MCPServerConfig): Promise<{ tools: number }> {
  const conn = new MCPConnection(config);
  await conn.connect();
  // Evict oldest connection if at capacity
  if (serverConnections.size >= MAX_MCP_CONNECTIONS && !serverConnections.has(config.id)) {
    const oldestKey = serverConnections.keys().next().value;
    if (oldestKey !== undefined) {
      serverConnections.get(oldestKey)?.disconnect();
      serverConnections.delete(oldestKey);
    }
  }
  serverConnections.set(config.id, conn);
  return { tools: conn.getTools().length };
}

export function getMCPTools(serverId?: string): MCPTool[] {
  if (serverId) {
    return serverConnections.get(serverId)?.getTools() || [];
  }
  const allTools: MCPTool[] = [];
  for (const conn of serverConnections.values()) {
    allTools.push(...conn.getTools());
  }
  return allTools;
}

export async function callMCPTool(toolName: string, args: any): Promise<any> {
  // Find which server has this tool
  for (const [id, conn] of serverConnections) {
    const tool = conn.getTools().find(t => t.name === toolName);
    if (tool) {
      return await conn.callTool(toolName, args);
    }
  }
  return { error: `MCP tool ${toolName} not found on any connected server` };
}

export function disconnectMCPServer(serverId: string): void {
  serverConnections.get(serverId)?.disconnect();
  serverConnections.delete(serverId);
}

export function listMCPServers(): Array<{ id: string; name: string; connected: boolean; tools: number }> {
  const result: any[] = [];
  for (const [id, conn] of serverConnections) {
    result.push({
      id,
      name: conn.getConfig().name,
      connected: conn.isConnected(),
      tools: conn.getTools().length,
    });
  }
  return result;
}
