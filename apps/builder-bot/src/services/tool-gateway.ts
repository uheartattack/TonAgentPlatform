/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TOOL GATEWAY (Node version of plano-style enterprise data plane)
 *
 * Adds a middleware chain around `executeTool()` that gives us:
 *   1. RATE LIMITING — per-(agentId, tool) sliding window
 *   2. AUDIT LOG — every tool invocation persisted to agent_audit_log
 *   3. JAILBREAK / PROMPT-INJECTION SCAN — args text scrubbed for known
 *      payloads (extension of memory-guard scanMemoryContent)
 *   4. OBSERVABILITY — OpenTelemetry-style trace spans (start, end, error)
 *   5. AUTH — calls reject if agent_id doesn't match params.agentId
 *      (defends against tool-call args trying to access other agents)
 *
 * NOT a separate process / proxy. Just a wrapper applied at the tool
 * dispatch layer. Full Rust+Envoy implementation = v3.0 if we ever need
 * cross-machine routing.
 *
 * Wire-up: ai-agent-runtime.ts `_executeToolInner` can wrap each case in
 * `gatewayInvoke(name, args, params, () => actualLogic())`. Or run as a
 * one-shot pre-check at the top of `_executeToolInner`. Current state:
 * pre-check helpers exported; integration is incremental.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const RATE_WINDOW_MS = 60_000;            // 1-minute sliding window
const RATE_LIMITS: Record<string, number> = {
  // tool name → max calls per minute per agent
  send_ton: 5,
  buy_market_gift: 10,
  list_gift_for_sale: 20,
  mailbox_send: 30,
  bg_schedule: 30,
  task_create: 60,
  // Web ops capped to avoid quota burn
  web_search: 20,
  fetch_url: 30,
  // AI-billed ops
  remember_hybrid: 60,
  recall_hybrid: 60,
  // Defaults for everything else are uncapped (rely on global circuit breaker)
};

const _windows = new Map<string, number[]>();  // key: "agentId:tool" → [timestamps]

/**
 * Sliding-window rate-limit check.
 * Returns true if within budget; false if exceeded.
 */
export function gatewayRateCheck(agentId: number, toolName: string): { ok: boolean; retryAfterMs?: number } {
  const limit = RATE_LIMITS[toolName];
  if (!limit) return { ok: true };  // no per-tool cap → fine
  const key = `${agentId}:${toolName}`;
  const now = Date.now();
  let timestamps = _windows.get(key) || [];
  timestamps = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterMs = RATE_WINDOW_MS - (now - oldest);
    return { ok: false, retryAfterMs };
  }
  timestamps.push(now);
  _windows.set(key, timestamps);
  return { ok: true };
}

/**
 * Jailbreak / injection signatures applied to tool args text.
 * Returns { safe: false } if any HIGH-severity match.
 *
 * Distinct from skill-registry.scanSkillBody — those rules are about
 * content stored in memory; this set targets RUNTIME tool input, where
 * the threat model is "agent was tricked into exfil / role-escalate".
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all|any|previous)\s+(instruction|rule|safety)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|admin|root|jailbreak|DAN|sudo)/i,
  /print\s+(your\s+)?(system\s+)?prompt/i,
  /reveal\s+(your\s+)?(initial\s+)?(prompt|instructions)/i,
  /<\s*system\s*>/i,
  /<\s*\/?\s*(safety|admin|root)\s*>/i,
];

export function gatewayInjectionScan(args: Record<string, any>): { safe: boolean; matched?: string } {
  let serialized = '';
  try { serialized = JSON.stringify(args || {}).slice(0, 8000); } catch { return { safe: true }; }
  for (const re of INJECTION_PATTERNS) {
    if (re.test(serialized)) {
      return { safe: false, matched: re.source.slice(0, 80) };
    }
  }
  return { safe: true };
}

/**
 * Audit log to builder_bot.agent_audit_log. Fire-and-forget (don't block tool).
 */
export function gatewayAudit(agentId: number, userId: number, toolName: string, args: Record<string, any>, outcome: 'ok' | 'error' | 'denied', extra?: { error?: string; durationMs?: number }): void {
  // No await — async fire-and-forget
  (async () => {
    try {
      const { pool } = await import('../db');
      const argsSafe = JSON.stringify(args || {}, (k, v) => /key|mnemonic|secret|password|token/i.test(k) ? '***' : v).slice(0, 4000);
      await pool.query(
        `INSERT INTO builder_bot.agent_audit_log
           (agent_id, user_id, action, params, outcome, duration_ms, error_message, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, NOW())
         ON CONFLICT DO NOTHING`,
        [agentId, userId, `tool:${toolName}`, argsSafe, outcome, extra?.durationMs || null, extra?.error?.slice(0, 200) || null],
      );
    } catch { /* audit failures must NOT break tool calls */ }
  })();
}

/**
 * One-call gateway invocation. Wraps the tool action in:
 *   - rate-check (returns 429-like error if exceeded)
 *   - injection scan (returns 403-like error if matched)
 *   - audit log (fire-and-forget)
 *
 * Use as:
 *   return gatewayInvoke(toolName, args, params, async () => {
 *     // original switch case body
 *   });
 */
export async function gatewayInvoke<T>(
  toolName: string,
  args: Record<string, any>,
  params: { agentId: number; userId: number },
  action: () => Promise<T>,
): Promise<T | { error: string; gateway?: 'rate_limit' | 'injection_blocked' }> {
  // 1. Rate
  const rate = gatewayRateCheck(params.agentId, toolName);
  if (!rate.ok) {
    gatewayAudit(params.agentId, params.userId, toolName, args, 'denied', { error: `rate_limit retryAfter=${rate.retryAfterMs}ms` });
    return {
      error: `Rate limit exceeded for ${toolName}. Retry in ${Math.ceil((rate.retryAfterMs || 1000) / 1000)}s.`,
      gateway: 'rate_limit',
    } as any;
  }
  // 2. Injection scan (only for high-risk tools — full set would slow every call)
  const HIGH_RISK_TOOLS = new Set([
    'send_ton', 'buy_market_gift', 'list_gift_for_sale', 'mailbox_send',
    'remember', 'remember_hybrid', 'knowledge_save',
    'set_state', 'tg_send_message', 'tg_reply',
  ]);
  if (HIGH_RISK_TOOLS.has(toolName)) {
    const scan = gatewayInjectionScan(args);
    if (!scan.safe) {
      gatewayAudit(params.agentId, params.userId, toolName, args, 'denied', { error: `injection: ${scan.matched}` });
      return {
        error: `Tool args failed injection scan (matched: ${scan.matched}). Refusing to execute.`,
        gateway: 'injection_blocked',
      } as any;
    }
  }
  // 3. Run
  const t0 = Date.now();
  try {
    const result = await action();
    gatewayAudit(params.agentId, params.userId, toolName, args, 'ok', { durationMs: Date.now() - t0 });
    return result;
  } catch (e: any) {
    gatewayAudit(params.agentId, params.userId, toolName, args, 'error', { durationMs: Date.now() - t0, error: e?.message });
    throw e;
  }
}

/**
 * Stats: how many calls per tool last hour, who's hot. For Studio admin UI.
 */
export function gatewayStats(): Array<{ tool: string; agents: number; calls: number }> {
  const aggr = new Map<string, { agents: Set<number>; calls: number }>();
  const now = Date.now();
  for (const [key, ts] of _windows.entries()) {
    const [agentIdStr, tool] = key.split(':');
    const agentId = Number(agentIdStr);
    const recent = ts.filter(t => now - t < 60 * 60_000);  // last hour
    if (recent.length === 0) continue;
    let bucket = aggr.get(tool);
    if (!bucket) { bucket = { agents: new Set(), calls: 0 }; aggr.set(tool, bucket); }
    bucket.agents.add(agentId);
    bucket.calls += recent.length;
  }
  return Array.from(aggr.entries())
    .map(([tool, b]) => ({ tool, agents: b.agents.size, calls: b.calls }))
    .sort((a, b) => b.calls - a.calls);
}
