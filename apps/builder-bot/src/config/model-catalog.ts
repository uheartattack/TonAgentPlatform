/**
 * model-catalog.ts — 70+ models across 13 providers.
 * Used by Studio AI tab for model selection dropdowns.
 */

export interface ModelOption {
  value: string;
  name: string;
  description: string;
}

export const MODEL_OPTIONS: Record<string, ModelOption[]> = {
  gemini: [
    { value: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable, 1M ctx, $1.25/M' },
    { value: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, 1M ctx, $0.30/M' },
    { value: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Ultra cheap, 1M ctx' },
    { value: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Cheap, 1M ctx, $0.10/M' },
  ],
  anthropic: [
    { value: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most capable, 1M ctx, $5/M' },
    { value: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced, 200K ctx, $3/M' },
    { value: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fast & cheap, $1/M' },
  ],
  openai: [
    { value: 'gpt-4o', name: 'GPT-4o', description: 'Balanced, 128K ctx, $2.50/M' },
    { value: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cheap, 128K ctx, $0.15/M' },
    { value: 'gpt-4.1', name: 'GPT-4.1', description: '1M ctx, $2/M' },
    { value: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '1M ctx, cheap, $0.40/M' },
    { value: 'o3', name: 'o3', description: 'Reasoning, 200K ctx, $2/M' },
    { value: 'o4-mini', name: 'o4 Mini', description: 'Reasoning fast, 200K ctx' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'General, 131K ctx, $0.59/M' },
    { value: 'qwen/qwen3-32b', name: 'Qwen3 32B', description: 'Reasoning, 131K ctx, $0.29/M' },
    { value: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', description: 'Reasoning, $0.75/M' },
    { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick', description: 'Vision, $0.20/M' },
  ],
  deepseek: [
    { value: 'deepseek-chat', name: 'DeepSeek V3', description: 'General, 64K ctx, $0.14/M' },
    { value: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Reasoning, 64K ctx, $0.55/M' },
  ],
  openrouter: [
    { value: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '1M ctx, $0.30/M' },
    { value: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '200K ctx, $3/M' },
    { value: 'openai/gpt-4o', name: 'GPT-4o', description: '128K ctx, $2.50/M' },
    { value: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning, $0.70/M' },
    { value: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', description: 'Latest, 64K ctx' },
    { value: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', description: 'MoE, 262K ctx' },
    { value: 'x-ai/grok-4', name: 'Grok 4', description: '256K ctx, $3/M' },
    { value: 'perplexity/sonar-pro', name: 'Perplexity Sonar', description: 'Web search integrated' },
  ],
  together: [
    { value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B', description: 'General, fast' },
    { value: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', description: 'General, 128K ctx' },
    { value: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', description: 'Reasoning' },
  ],
  xai: [
    { value: 'grok-4', name: 'Grok 4', description: 'Reasoning, 256K ctx, $3/M' },
    { value: 'grok-4-fast', name: 'Grok 4 Fast', description: 'Vision, 2M ctx, $0.20/M' },
    { value: 'grok-3', name: 'Grok 3', description: 'Stable, 131K ctx, $3/M' },
  ],
  mistral: [
    { value: 'mistral-large-latest', name: 'Mistral Large', description: 'General, 128K ctx, $2/M' },
    { value: 'devstral-small-2507', name: 'Devstral Small', description: 'Coding, $0.10/M' },
    { value: 'magistral-small', name: 'Magistral Small', description: 'Reasoning, $0.50/M' },
  ],
  moonshot: [
    { value: 'k2p5', name: 'Kimi K2.5', description: 'Free, 262K ctx, multimodal' },
    { value: 'kimi-k2-thinking', name: 'Kimi K2 Thinking', description: 'Free, reasoning' },
  ],
  cerebras: [
    { value: 'llama3.1-8b', name: 'Llama 3.1 8B', description: 'Ultra fast, $0.10/M' },
    { value: 'qwen-3-235b-a22b-instruct-2507', name: 'Qwen3 235B', description: '$0.60/M' },
  ],
};

export function getModelsForProvider(provider: string): ModelOption[] {
  return MODEL_OPTIONS[provider] || MODEL_OPTIONS['gemini'] || [];
}

export function getAllProviders(): string[] {
  return Object.keys(MODEL_OPTIONS);
}
