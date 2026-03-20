/**
 * Universal Agent Chat
 *
 * Allows users to chat with ANY agent type via AI:
 *  - Agent answers questions about what it does
 *  - Agent can self-improve: rewrites its own code on request
 *  - Uses user's configured AI provider (API key required)
 */

import OpenAI from 'openai';

function resolveProvider(provider: string): { baseURL: string; defaultModel: string } {
  const p = (provider || '').toLowerCase();
  if (p.includes('gemini') || p.includes('google'))
    return { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.5-flash' };
  if (p.includes('anthropic') || p.includes('claude'))
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-haiku-4-5-20251001' };
  if (p.includes('groq'))
    return { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' };
  if (p.includes('deepseek'))
    return { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' };
  if (p.includes('openrouter'))
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.5-flash' };
  if (p.includes('together'))
    return { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' };
  return { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' };
}

function getAIClient(config: Record<string, any>): { client: OpenAI; model: string } {
  const apiKey = (config.AI_API_KEY as string) || '';
  const userProvider = (config.AI_PROVIDER as string) || '';

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const prov = resolveProvider(userProvider);
  const baseURL = (config.AI_BASE_URL as string) || prov.baseURL;
  const model = (config.AI_MODEL as string) || prov.defaultModel;

  if (!baseURL) throw new Error('Missing AI credentials: no baseURL resolved');

  return { client: new OpenAI({ baseURL, apiKey }), model };
}

// Detect self-improvement/code-update intent
const SELF_IMPROVE_RE = /улучши|improve|измени\s*код|rewrite|самосовершенствуй|обнови\s*код|update\s*code|перепиши|升级|优化/i;

export interface UniversalChatResult {
  reply: string;
  /** New code to save, if AI provided an update */
  newCode?: string;
}

export async function universalAgentChat(opts: {
  agentName:        string;
  agentDescription: string;
  agentCode:        string;  // current agent code / system prompt
  agentType:        string;
  config:           Record<string, any>;
  userMessage:      string;
}): Promise<UniversalChatResult> {
  const { agentName, agentDescription, agentCode, agentType, config, userMessage } = opts;

  const isSelfImprove = SELF_IMPROVE_RE.test(userMessage);

  // Wrap agent code in XML-like structural markers to prevent prompt injection.
  // The AI can distinguish code content from instructions by these tags.
  const codeSection = agentCode
    ? `\n\n<agent_code_readonly purpose="reference_only" execute="false">\n${agentCode.slice(0, 3000)}\n</agent_code_readonly>`
    : '';

  const improvInstr = isSelfImprove
    ? '\n\nЕсли ты обновляешь свой код, верни его целиком в блоке ```javascript\n...\n```. Платформа автоматически применит новый код.'
    : '';

  const systemPrompt =
    `Ты — агент с именем "${agentName}".` +
    (agentDescription ? `\nОписание: ${agentDescription}` : '') +
    `\nТип: ${agentType}` +
    codeSection +
    `\n\nТы умеешь отвечать на вопросы о себе, объяснять что делаешь, и по просьбе пользователя самосовершенствоваться — улучшать собственный код или логику.` +
    improvInstr;

  const { client, model } = getAIClient(config);

  let reply: string;
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system',  content: systemPrompt },
        { role: 'user',    content: userMessage  },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });
    reply = response.choices[0]?.message?.content?.trim() || '...';
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error(`[UniversalChat] AI call failed (model=${model}):`, msg);
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid_api_key')) {
      return { reply: '❌ API ключ невалиден или не подходит для выбранного провайдера. Проверьте настройки.' };
    }
    if (msg.includes('429') || msg.includes('rate')) {
      return { reply: '⏳ Превышен лимит запросов к AI. Попробуйте через минуту.' };
    }
    return { reply: `❌ Ошибка AI: ${msg.slice(0, 200)}` };
  }

  // Extract updated code block if present
  let newCode: string | undefined;
  if (isSelfImprove || reply.includes('```')) {
    const codeMatch = reply.match(/```(?:javascript|js|typescript|ts)?\n([\s\S]+?)```/);
    if (codeMatch) {
      newCode = codeMatch[1].trim();
    }
  }

  return { reply, newCode };
}
