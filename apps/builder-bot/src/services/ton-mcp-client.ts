/**
 * TON MCP Client — bridges @ton/mcp server into AI Agent Runtime.
 *
 * Each agent gets its own MCP server subprocess (different wallets → different MNEMONIC).
 * Tools are discovered dynamically via `tools/list` and converted to OpenAI function-call format.
 * All MCP tool names are prefixed with `mcp_` to avoid conflicts with existing tools.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface ConnectOpts {
  mnemonic: string;
  network?: string;          // 'mainnet' | 'testnet', default 'mainnet'
  toncenterApiKey?: string;
}

// ── Per-agent MCP client ───────────────────────────────────────────────────

class TonMcpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private cachedOpenAITools: OpenAITool[] = [];
  private mcpToolNames: string[] = [];
  public readonly agentId: number;

  constructor(agentId: number) {
    this.agentId = agentId;
  }

  /** Spawn @ton/mcp subprocess, connect, discover tools */
  async connect(opts: ConnectOpts): Promise<void> {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      MNEMONIC: opts.mnemonic,
      NETWORK: opts.network || 'mainnet',
    };
    if (opts.toncenterApiKey) env.TONCENTER_API_KEY = opts.toncenterApiKey;

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@ton/mcp@alpha'],
      env,
    });

    this.client = new Client(
      { name: `ton-agent-${this.agentId}`, version: '1.0.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);

    // Discover available tools
    const res = await this.client.listTools();
    const mcpTools: McpTool[] = (res as any).tools || [];
    this.mcpToolNames = mcpTools.map(t => t.name);
    this.cachedOpenAITools = convertMcpToOpenAI(mcpTools);

    console.log(`[MCP] Agent #${this.agentId} connected, ${this.cachedOpenAITools.length} tools: ${this.mcpToolNames.join(', ')}`);
  }

  /** Call a tool on the MCP server (pass original name WITHOUT mcp_ prefix) */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.client) throw new Error('MCP client not connected');

    const result = await this.client.callTool({ name: toolName, arguments: args });
    // MCP returns { content: [{ type: 'text', text: '...' }] }
    const content = (result as any).content;
    if (!content || !Array.isArray(content) || content.length === 0) return result;

    const text = content[0]?.text || '';
    // Try parse as JSON
    try { return JSON.parse(text); } catch { return { result: text }; }
  }

  /** Get OpenAI-format tool definitions (with mcp_ prefix) */
  getOpenAITools(): OpenAITool[] {
    return this.cachedOpenAITools;
  }

  /** Get list of original MCP tool names */
  getMcpToolNames(): string[] {
    return this.mcpToolNames;
  }

  /** Graceful shutdown */
  async destroy(): Promise<void> {
    try {
      if (this.client) await this.client.close();
    } catch {}
    this.client = null;
    this.transport = null;
    this.cachedOpenAITools = [];
    this.mcpToolNames = [];
    console.log(`[MCP] Agent #${this.agentId} disconnected`);
  }
}

// ── Schema conversion ──────────────────────────────────────────────────────

function convertMcpToOpenAI(mcpTools: McpTool[]): OpenAITool[] {
  return mcpTools.map(t => ({
    type: 'function' as const,
    function: {
      name: `mcp_${t.name}`,
      description: `[TON MCP] ${t.description || t.name}`,
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

// ── Singleton manager ──────────────────────────────────────────────────────

class TonMcpClientManager {
  private clients = new Map<number, TonMcpClient>();
  private connecting = new Map<number, Promise<TonMcpClient>>();

  /** Get or create MCP client for an agent (deduplicates concurrent calls) */
  async getOrCreate(agentId: number, opts: ConnectOpts): Promise<TonMcpClient> {
    const existing = this.clients.get(agentId);
    if (existing) return existing;

    // Dedup concurrent getOrCreate calls for the same agent
    const inflight = this.connecting.get(agentId);
    if (inflight) return inflight;

    const promise = (async () => {
      const mc = new TonMcpClient(agentId);
      try {
        await mc.connect(opts);
        this.clients.set(agentId, mc);
        return mc;
      } catch (e: any) {
        console.error(`[MCP] Agent #${agentId} connect failed: ${e.message}`);
        throw e;
      } finally {
        this.connecting.delete(agentId);
      }
    })();

    this.connecting.set(agentId, promise);
    return promise;
  }

  /** Call an MCP tool for a specific agent */
  async callTool(agentId: number, toolName: string, args: Record<string, any>): Promise<any> {
    const mc = this.clients.get(agentId);
    if (!mc) return { error: 'MCP not connected for this agent' };
    try {
      return await mc.callTool(toolName, args);
    } catch (e: any) {
      // Try reconnect once
      console.error(`[MCP] Agent #${agentId} tool ${toolName} failed: ${e.message}, destroying client`);
      await this.destroy(agentId);
      return { error: `MCP tool error: ${e.message}` };
    }
  }

  /** Get OpenAI-format tool definitions for an agent */
  getOpenAITools(agentId: number): OpenAITool[] {
    return this.clients.get(agentId)?.getOpenAITools() || [];
  }

  /** Check if an agent has MCP connected */
  has(agentId: number): boolean {
    return this.clients.has(agentId);
  }

  /** Destroy a specific agent's MCP client */
  async destroy(agentId: number): Promise<void> {
    const mc = this.clients.get(agentId);
    if (mc) {
      await mc.destroy();
      this.clients.delete(agentId);
    }
  }

  /** Destroy all MCP clients (graceful shutdown) */
  async destroyAll(): Promise<void> {
    const ids = [...this.clients.keys()];
    await Promise.all(ids.map(id => this.destroy(id)));
  }
}

// ── Singleton export ───────────────────────────────────────────────────────

let _manager: TonMcpClientManager | null = null;

export function getTonMcpManager(): TonMcpClientManager {
  if (!_manager) _manager = new TonMcpClientManager();
  return _manager;
}

export { TonMcpClient, TonMcpClientManager, OpenAITool, ConnectOpts };
