/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBAGENT — fresh-context child loop (learn-claude-code s04 pattern)
 *
 * When the parent agent calls task(description), we spawn a SUBAGENT:
 *   • Fresh `messages: []` — no inherited context bloat
 *   • Smaller tool set — explicitly does NOT include the `task` tool itself
 *     (no recursion)
 *   • Bounded iterations (3 by default) to fit a single tick of the parent
 *   • Returns ONLY the final assistant text — parent never sees child's
 *     tool-call history
 *
 * Used to keep parent's context clean when delegating a focused subtask
 * (e.g. "research X", "validate Y", "summarize Z").
 *
 * Spec inspiration: learn-claude-code session 4.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import OpenAI from 'openai';

const SUBAGENT_MAX_ITERS = 3;
const SUBAGENT_MAX_TOKENS = 2048;

/** Tools we explicitly DROP from the child agent (no recursion, no escalation). */
const FORBIDDEN_IN_SUBAGENT = new Set<string>([
  'task',                  // no recursion
  'manage_agent', 'assign_task', 'ask_agent',  // no cross-agent calls
  'send_ton', 'ton_send_boc', 'buy_market_gift', 'list_gift_for_sale',  // no on-chain
  'request_pause', 'rollback_prompt',          // no self-mod
]);

export interface SubagentParams {
  description: string;
  /** Optional role hint for the subagent's system prompt. */
  role?: string;
  /** OpenAI client (shared with parent — same provider). */
  client: OpenAI;
  /** Model to use (typically parent's utility model — cheap). */
  model: string;
  /** Tool defs allowed for child. Filtered against FORBIDDEN_IN_SUBAGENT. */
  parentTools: OpenAI.ChatCompletionTool[];
  /** Tool dispatcher shared with parent (re-uses executeTool). */
  toolDispatch: (name: string, args: Record<string, any>) => Promise<any>;
}

export interface SubagentResult {
  ok: boolean;
  summary: string;        // final assistant text, what parent sees
  iterations: number;     // how many loops the child ran
  toolCallCount: number;  // for observability
  error?: string;
}

export async function runSubagent(params: SubagentParams): Promise<SubagentResult> {
  const { description, role, client, model, parentTools, toolDispatch } = params;

  // Filter tools — drop forbidden, drop the task tool itself
  const tools = parentTools.filter(t => !FORBIDDEN_IN_SUBAGENT.has((t as any).function.name));

  const systemPrompt = [
    `Ты — SUBAGENT, временно работающий над конкретной подзадачей.`,
    role ? `Твоя роль: ${role}.` : '',
    `Лимит итераций: ${SUBAGENT_MAX_ITERS}. Лимит токенов на ответ: ${SUBAGENT_MAX_TOKENS}.`,
    ``,
    `ЗАДАЧА:`,
    description,
    ``,
    `Сделай задачу, верни КРАТКИЙ итог (3-7 строк). Не используй task() — нельзя рекурсивно делегировать.`,
    `Если задача невозможна — честно скажи почему. Не выдумывай результаты.`,
  ].filter(Boolean).join('\n');

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Начни выполнять задачу.' },
  ];

  let toolCallCount = 0;
  let iter = 0;
  let finalText = '';

  try {
    for (iter = 0; iter < SUBAGENT_MAX_ITERS; iter++) {
      const resp = await client.chat.completions.create({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: SUBAGENT_MAX_TOKENS,
        temperature: 0.3,
      });
      const choice = resp.choices?.[0]?.message;
      if (!choice) break;
      messages.push(choice);

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        toolCallCount += choice.tool_calls.length;
        for (const call of choice.tool_calls) {
          const fnName = (call as any).function?.name || '';
          let args: any = {};
          try { args = JSON.parse((call as any).function?.arguments || '{}'); } catch {}

          if (FORBIDDEN_IN_SUBAGENT.has(fnName)) {
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: `Tool ${fnName} is not allowed in subagent context` }),
            });
            continue;
          }

          let result: any;
          try { result = await toolDispatch(fnName, args); }
          catch (e: any) { result = { error: e?.message || 'tool failed' }; }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 4000),  // cap tool output
          });
        }
        continue;
      }

      // No more tool calls — final text
      finalText = String(choice.content || '').trim();
      break;
    }
    return {
      ok: !!finalText,
      summary: finalText || '(no final summary produced within iteration budget)',
      iterations: iter,
      toolCallCount,
    };
  } catch (e: any) {
    return {
      ok: false,
      summary: '',
      iterations: iter,
      toolCallCount,
      error: e?.message?.slice(0, 200) || 'subagent failed',
    };
  }
}
