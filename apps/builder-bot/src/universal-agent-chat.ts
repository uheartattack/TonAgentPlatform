/**
 * Universal Agent Chat
 *
 * Allows users to chat with ANY agent type via AI:
 *  - Agent answers questions about what it does
 *  - Agent can self-improve: rewrites its own code on request
 *  - Uses user's configured AI provider (or server CLIProxy fallback)
 */

import OpenAI from 'openai';

const SERVER_AI_BASE_URL = process.env.AI_API_URL  || 'http://127.0.0.1:8317';
const SERVER_AI_MODEL    = process.env.AI_MODEL    || 'claude-sonnet-4-5-20250929';
const SERVER_AI_KEY      = process.env.AI_API_KEY  || 'local';

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
  const apiKey = (config.AI_API_KEY as string) || SERVER_AI_KEY;
  const userProvider = config.AI_PROVIDER as string || '';

  let baseURL: string;
  let model: string;

  if (userProvider) {
    const prov = resolveProvider(userProvider);
    baseURL = (config.AI_BASE_URL as string) || prov.baseURL;
    model   = (config.AI_MODEL   as string) || prov.defaultModel;
  } else {
    // No provider configured — fall back to server CLIProxy
    baseURL = SERVER_AI_BASE_URL;
    model   = SERVER_AI_MODEL;
  }

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

  const codeSection = agentCode
    ? `\n\nТекущий код агента:\n\`\`\`javascript\n${agentCode.slice(0, 3000)}\n\`\`\``
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

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system',  content: systemPrompt },
      { role: 'user',    content: userMessage  },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const reply = response.choices[0]?.message?.content?.trim() || '...';

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
