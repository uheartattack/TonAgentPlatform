/**
 * MCP Client — connect to external MCP servers
 * Agents can connect to MCP servers and use their tools
 * Uses stdio transport (spawn process) or SSE transport (HTTP)
 */

// Simple MCP client supporting SSE (HTTP) and stdio (child process)
export interface MCPServerConfig {
  id: string;
  name: string;
  url?: string;          // SSE endpoint URL (when transport='sse')
  apiKey?: string;       // Bearer for SSE
  transport?: 'sse' | 'stdio';
  command?: string;      // executable path for stdio (e.g. 'npx')
  args?: string[];       // args for stdio command (e.g. ['-y', '@notion/mcp'])
  cwd?: string;
}

/**
 * Stdio transport — spawns child process with hardened env. Blocks
 * LD_PRELOAD / NODE_OPTIONS / LD_LIBRARY_PATH / PYTHONSTARTUP to prevent
 * an MCP server config from injecting code into the parent bot via env
 * vars. Inherits ONLY a small whitelist: PATH, HOME, USER, LANG, LC_ALL,
 * TZ + anything starting with MCP_*.
 */
function buildSafeEnv(extraEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const WHITELIST = new Set(['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TZ', 'NODE_ENV', 'TMPDIR', 'TEMP']);
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (WHITELIST.has(k) || k.startsWith('MCP_')) out[k] = v;
  }
  if (extraEnv) {
    for (const [k, v] of Object.entries(extraEnv)) {
      // Never let extraEnv re-introduce injection vectors
      if (/^(LD_|DYLD_|NODE_OPTIONS|PYTHONSTARTUP|PRELOAD)/i.test(k)) continue;
      out[k] = v;
    }
  }
  return out;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

const serverConnections = new Map<string, MCPConnection>();

/**
 * Validate an MCP server URL before connecting.
 * Rejects localhost, private IP ranges, non-http(s) protocols.
 * Without this, a malicious agent config could point MCP at an internal
 * service (metadata server, Redis, postgres admin UI, etc.) and exfiltrate
 * or manipulate data via the agent.
 */
function validateMcpUrl(rawUrl: string): { ok: boolean; error?: string } {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return { ok: false, error: `Invalid URL: ${rawUrl}` }; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: `Protocol "${parsed.protocol}" not allowed — use http(s)` };
  }
  const host = parsed.hostname.toLowerCase();
  // Localhost / loopback
  if (host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: `Local/internal host rejected: ${host}` };
  }
  // Metadata endpoints
  if (host === 'metadata.google.internal' || host === '169.254.169.254') {
    return { ok: false, error: `Metadata endpoint rejected: ${host}` };
  }
  // IPv4 private ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0 ||
      a >= 224
    ) return { ok: false, error: `Private/reserved IP rejected: ${host}` };
  }
  // IPv6 loopback / link-local / ULA
  if (/^(::1|::|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i.test(host)) {
    return { ok: false, error: `Private/reserved IPv6 rejected: ${host}` };
  }
  return { ok: true };
}

class MCPConnection {
  private tools: MCPTool[] = [];
  private connected = false;
  private stdioProc: any = null;
  private stdioBuf = '';
  private stdioPending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>();
  private stdioNextId = 1;

  constructor(private config: MCPServerConfig) {}

  async connect(): Promise<void> {
    if ((this.config.transport || 'sse') === 'stdio') {
      return this.connectStdio();
    }
    if (!this.config.url) {
      console.warn(`[MCP] Cannot connect ${this.config.id}: no URL set (transport=sse)`);
      this.connected = false;
      return;
    }
    const v = validateMcpUrl(this.config.url);
    if (!v.ok) {
      console.warn(`[MCP] Rejected MCP server ${this.config.id}: ${v.error}`);
      this.connected = false;
      return;
    }
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
    if (!this.connected) throw new Error(`MCP server ${this.config.id} is not connected (rejected or unreachable)`);

    // stdio path uses JSON-RPC via spawned child
    if ((this.config.transport || 'sse') === 'stdio') {
      return await this.rpcCall('tools/call', { name: toolName, arguments: args });
    }

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
    if (this.stdioProc && !this.stdioProc.killed) {
      try { this.stdioProc.kill(); } catch {}
      this.stdioProc = null;
    }
    for (const p of this.stdioPending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('MCP disconnected'));
    }
    this.stdioPending.clear();
  }

  getConfig(): MCPServerConfig {
    return this.config;
  }

  // ── stdio transport ──────────────────────────────────────────────────────
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      console.warn(`[MCP] stdio config missing command for ${this.config.id}`);
      this.connected = false;
      return;
    }
    try {
      const { spawn } = require('child_process');
      this.stdioProc = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd || undefined,
        env: buildSafeEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.stdioProc.stdout.setEncoding('utf-8');
      this.stdioProc.stdout.on('data', (chunk: string) => {
        this.stdioBuf += chunk;
        let nl;
        while ((nl = this.stdioBuf.indexOf('\n')) >= 0) {
          const line = this.stdioBuf.slice(0, nl).trim();
          this.stdioBuf = this.stdioBuf.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            const pending = this.stdioPending.get(msg.id);
            if (pending) {
              clearTimeout(pending.timer);
              this.stdioPending.delete(msg.id);
              if (msg.error) pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
              else pending.resolve(msg.result);
            }
          } catch { /* malformed line, ignore */ }
        }
      });
      this.stdioProc.stderr.on('data', (d: any) => {
        // MCP servers often log to stderr — surface only on debug
        if (process.env.MCP_DEBUG) console.warn(`[MCP:${this.config.id}] stderr: ${String(d).slice(0, 200)}`);
      });
      this.stdioProc.on('exit', (code: number) => {
        console.log(`[MCP:${this.config.id}] stdio process exited with code ${code}`);
        this.connected = false;
        for (const p of this.stdioPending.values()) p.reject(new Error('MCP process exited'));
        this.stdioPending.clear();
      });
      // Initialize protocol handshake
      const initResult = await this.rpcCall('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'ton-agent-platform', version: '2.3.2' },
      });
      void initResult;
      // List tools
      const toolsList = await this.rpcCall('tools/list', {});
      this.tools = (toolsList?.tools || []) as MCPTool[];
      this.connected = true;
      console.log(`[MCP:${this.config.id}] stdio connected — ${this.tools.length} tools`);
    } catch (e: any) {
      console.warn(`[MCP:${this.config.id}] stdio connect failed: ${e.message}`);
      this.connected = false;
      if (this.stdioProc) { try { this.stdioProc.kill(); } catch {} }
    }
  }

  private rpcCall(method: string, params: any, timeoutMs = 30_000): Promise<any> {
    if (!this.stdioProc || this.stdioProc.killed) return Promise.reject(new Error('stdio process not running'));
    const id = this.stdioNextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params, id });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stdioPending.delete(id);
        reject(new Error(`MCP rpc timeout: ${method}`));
      }, timeoutMs);
      this.stdioPending.set(id, { resolve, reject, timer });
      this.stdioProc.stdin.write(payload + '\n');
    });
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

/** Sanitize MCP server id to a tool-name-safe token (a-z0-9_). */
function nsToken(serverId: string): string {
  return serverId.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);
}

export function getMCPTools(serverId?: string): MCPTool[] {
  if (serverId) {
    const conn = serverConnections.get(serverId);
    if (!conn) return [];
    const ns = nsToken(serverId);
    return conn.getTools().map(t => ({
      ...t,
      name: t.name.startsWith(`mcp_${ns}_`) ? t.name : `mcp_${ns}_${t.name}`,
    }));
  }
  const allTools: MCPTool[] = [];
  for (const [id, conn] of serverConnections) {
    const ns = nsToken(id);
    for (const t of conn.getTools()) {
      allTools.push({
        ...t,
        name: t.name.startsWith(`mcp_${ns}_`) ? t.name : `mcp_${ns}_${t.name}`,
      });
    }
  }
  return allTools;
}

export async function callMCPTool(toolName: string, args: any): Promise<any> {
  // Resolve namespaced tool name back to (serverId, realToolName)
  // Format: mcp_<ns>_<toolname>
  const m = toolName.match(/^mcp_([a-z0-9_]+?)_(.+)$/);
  if (m) {
    const [, ns, realName] = m;
    for (const [id, conn] of serverConnections) {
      if (nsToken(id) !== ns) continue;
      if (conn.getTools().some(t => t.name === realName)) {
        return await conn.callTool(realName, args);
      }
    }
  }
  // Legacy non-namespaced lookup: find any server that owns this tool
  for (const [id, conn] of serverConnections) {
    if (conn.getTools().some(t => t.name === toolName)) {
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
