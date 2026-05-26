/**
 * crew-runner-simple.ts — minimal sequential crew executor.
 *
 * Wraps a single AI agent tick so the crew engine can pass `input` and get
 * `output` back, sequentially walking through agent_ids[]. This is the engine
 * behind POST /api/crews/:id/run (live monitor flow).
 *
 * The richer crew-system.ts has parallel/manager/conditional flows but uses
 * a separate TEXT-id schema that was never wired to prod data. This runner
 * uses the actual integer-schema crews table that Studio already manages.
 */

import { pool } from '../db';
import { runAIAgentTick } from '../agents/ai-agent-runtime';

/** Loaded once per crew run for the duration of the walk. */
interface CrewMemberContext {
  crewId: number;
  crewName: string;
  stepIndex: number;
  totalSteps: number;
  crewGoal?: string | null;
}

/**
 * Run ONE agent inside a crew. Returns the agent's final response text, or
 * throws if the tick failed / returned no response.
 *
 * Strategy:
 *   1. Load agent (code = system prompt, role, trigger_config).
 *   2. Load user_variables and merge with trigger_config → AI config.
 *   3. Prefix input with crew context block so the agent knows it's part of a
 *      crew and what the prior step produced.
 *   4. Single tick via runAIAgentTick — returns finalResponse.
 *   5. Surface the response back to the runner so it becomes the next step's
 *      input.
 */
export async function runAgentTickForCrew(
  agentId: number,
  userId: number,
  input: any,
  ctx: CrewMemberContext,
): Promise<string> {
  // 1) Agent row
  const ar = await pool.query(
    `SELECT id, name, role, code, trigger_config, goal, action_scope
       FROM builder_bot.agents
      WHERE id = $1 AND user_id = $2`,
    [agentId, userId],
  );
  if (!ar.rows[0]) throw new Error(`agent ${agentId} not found / not owned by user`);
  const agent = ar.rows[0];

  // 2) Config
  const triggerConfig = typeof agent.trigger_config === 'string'
    ? (() => { try { return JSON.parse(agent.trigger_config); } catch { return {}; } })()
    : (agent.trigger_config || {});

  let userVars: Record<string, any> = {};
  try {
    const uv = await pool.query(
      `SELECT key, value FROM builder_bot.user_variables WHERE user_id = $1`,
      [userId],
    );
    userVars = {};
    uv.rows.forEach((r: any) => { userVars[r.key] = r.value; });
  } catch {}

  // Trigger config wins over user vars (per-agent override is intentional)
  const config = { ...userVars, ...(triggerConfig.config || triggerConfig) };

  // 3) Build crew-aware input
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const crewBlock =
    `\n━━━ CREW CONTEXT ━━━\n` +
    `You are participating in crew "${ctx.crewName}" as step ${ctx.stepIndex + 1}/${ctx.totalSteps}.\n` +
    (ctx.crewGoal ? `Crew goal: ${ctx.crewGoal}\n` : '') +
    (ctx.stepIndex === 0
      ? `This is the FIRST step — you receive the user's original task.\n`
      : `Previous step produced this output (use as your starting point):\n${inputStr.slice(0, 2000)}\n`) +
    `Respond with the result of YOUR step — the next agent will receive your output as their input.\n` +
    `━━━ END CREW CONTEXT ━━━\n\n` +
    (ctx.stepIndex === 0 ? `User task: ${inputStr}` : `Do your part of the crew workflow given the prior output above.`);

  // 4) One tick — pass crew context for traceability
  const tickResult = await runAIAgentTick({
    agentId,
    userId,
    systemPrompt: agent.code || '',
    config,
    pendingMessages: [crewBlock],
    context: {
      _crewRun: true,
      crewId: ctx.crewId,
      crewName: ctx.crewName,
      stepIndex: ctx.stepIndex,
    },
  });

  if (tickResult.error) {
    throw new Error(`agent #${agentId} tick failed: ${tickResult.error}`);
  }
  const out = (tickResult.finalResponse || '').trim();
  if (!out) {
    throw new Error(`agent #${agentId} produced empty response (toolCalls=${tickResult.toolCallCount})`);
  }
  return out;
}
