/**
 * Tests for MCP → OpenAI tool schema conversion
 */

// ── Mirror of convertMcpToOpenAI from ton-mcp-client.ts ──
function convertMcpToOpenAI(mcpTools: Array<{ name: string; description?: string; inputSchema?: any }>): any[] {
  return mcpTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: `mcp_${tool.name}`,
      description: `[TON MCP] ${tool.description || tool.name}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

describe('convertMcpToOpenAI', () => {
  it('prefixes tool names with mcp_', () => {
    const result = convertMcpToOpenAI([{ name: 'get_balance' }]);
    expect(result[0].function.name).toBe('mcp_get_balance');
  });

  it('adds [TON MCP] prefix to description', () => {
    const result = convertMcpToOpenAI([{ name: 'send', description: 'Send TON' }]);
    expect(result[0].function.description).toBe('[TON MCP] Send TON');
  });

  it('preserves inputSchema as parameters', () => {
    const schema = { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] };
    const result = convertMcpToOpenAI([{ name: 'get_balance', inputSchema: schema }]);
    expect(result[0].function.parameters).toEqual(schema);
  });

  it('sets default empty parameters when no inputSchema', () => {
    const result = convertMcpToOpenAI([{ name: 'list_tools' }]);
    expect(result[0].function.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('sets type to function', () => {
    const result = convertMcpToOpenAI([{ name: 'test' }]);
    expect(result[0].type).toBe('function');
  });

  it('handles multiple tools', () => {
    const result = convertMcpToOpenAI([
      { name: 'get_balance', description: 'Get balance' },
      { name: 'send_ton', description: 'Send TON' },
      { name: 'get_nft', description: 'Get NFTs' },
    ]);
    expect(result.length).toBe(3);
    expect(result.map(r => r.function.name)).toEqual(['mcp_get_balance', 'mcp_send_ton', 'mcp_get_nft']);
  });

  it('handles empty array', () => {
    expect(convertMcpToOpenAI([])).toEqual([]);
  });
});

describe('MCP tool name routing', () => {
  it('correctly strips mcp_ prefix', () => {
    const name = 'mcp_get_balance';
    expect(name.startsWith('mcp_')).toBe(true);
    expect(name.slice(4)).toBe('get_balance');
  });

  it('does not strip non-mcp prefixes', () => {
    const name = 'get_ton_balance';
    expect(name.startsWith('mcp_')).toBe(false);
  });
});
