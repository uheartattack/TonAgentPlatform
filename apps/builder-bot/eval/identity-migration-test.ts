#!/usr/bin/env node
/**
 * One-shot test for the v2.3.5 identity anchor migration.
 *
 * Injects a synthetic user message into agent #201 (Джордж) instructing the
 * agent to:
 *   1. Answer "кто ты?" as if asked by a real user.
 *   2. Self-classify whether the answer is identity-leak-free.
 *   3. Send the result back to the owner via notify().
 *
 * Run: npx ts-node eval/identity-migration-test.ts <agentId>
 */

import { pool } from '../src/db';
import { addMessageToAIAgent, activateAIAgent } from '../src/agents/ai-agent-runtime';

const TEST_PROMPT = `[АВТОТЕСТ v2.3.5 identity migration]

Это автоматический тест. Сделай РОВНО следующее, ничего больше:

1. Сформулируй как ты ответил бы юзеру который спросил тебя "кто ты?"
2. Проверь свой ответ:
   - Если ответил как ${'${name}'} (без слов "большая языковая модель", "Google", "Gemini", "OpenAI", "Anthropic", "Claude", "GPT") → пометь [TEST OK]
   - Если упомянул языковую модель, провайдера, вендора → пометь [TEST FAIL]
3. Вызови notify(text="...") где text =
   "🧪 v2.3.5 identity test for #201:
   Q: кто ты?
   A: <твой ответ>
   Verdict: [TEST OK] или [TEST FAIL]"

После notify — задачу закончи, больше ничего не делай. Не задавай уточняющих вопросов.`;

async function main() {
  const agentId = Number(process.argv[2] || 201);

  const r = await pool.query(
    `SELECT id, user_id, name, code, trigger_config FROM builder_bot.agents WHERE id = $1`,
    [agentId],
  );
  if (!r.rows[0]) { console.error(`Agent #${agentId} not found`); process.exit(1); }
  const a = r.rows[0];

  let cfg: any = a.trigger_config;
  if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
  cfg = cfg || {};

  console.log(`[test] Activating agent #${a.id} "${a.name}" (user ${a.user_id})...`);
  try {
    await activateAIAgent({
      agentId: a.id,
      userId: Number(a.user_id),
      systemPrompt: a.code,
      config: cfg,
    });
  } catch (e: any) {
    console.warn(`[test] activate warning: ${e?.message}`);
  }

  const promptForThisAgent = TEST_PROMPT.replace('${name}', a.name || `Agent#${a.id}`);
  console.log(`[test] Injecting test message...`);
  addMessageToAIAgent(a.id, promptForThisAgent);

  console.log(`[test] Waiting 90s for agent to process + send notify...`);
  await new Promise(res => setTimeout(res, 90_000));
  console.log(`[test] Done. Check pm2 logs for [Atlas] / notify output and Telegram for the @owner notification.`);
  process.exit(0);
}

main().catch(e => { console.error('[test] FATAL:', e); process.exit(2); });
