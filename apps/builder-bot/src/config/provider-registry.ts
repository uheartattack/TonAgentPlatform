/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROVIDER REGISTRY — single source of truth for every AI provider TAP supports.
 *
 * Pattern adapted from Teleton's `src/config/providers.ts`. Each provider record
 * carries everything Studio + the runtime + the auth layer need to wire it up:
 *
 *   • baseURL       — endpoint root
 *   • envVar        — name of the .env key holding the user's API token
 *   • keyPrefix     — optional validation prefix (e.g. "sk-ant-" or "gsk_")
 *   • keyHint       — placeholder string shown in the Studio "API key" input
 *   • consoleUrl    — link to the provider's dashboard for "get a key" UX
 *   • defaultModel  — chat-level model (user-facing turns)
 *   • utilityModel  — cheaper model for housekeeping (summarization, intent,
 *                     tool-RAG selection). Falls back to defaultModel.
 *   • toolLimit     — max tools per call. null = unlimited.
 *   • maxContextChars — soft cap on prompt size before micro-compaction kicks in
 *   • authHeader    — 'bearer' | 'x-api-key' | 'none'  (covers Anthropic vs OpenAI vs Local)
 *   • supportsStream — does the provider's API support SSE streaming?
 *
 * Old PROVIDER_URLS / PROVIDER_MODELS / PROVIDER_LIMITS in platform.ts are kept
 * for backwards compatibility (derived from this registry).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type ProviderId =
  | 'gemini' | 'anthropic' | 'openai' | 'groq' | 'deepseek' | 'openrouter' | 'together'
  | 'xai' | 'moonshot' | 'mistral' | 'cerebras' | 'zai' | 'minimax' | 'huggingface'
  | 'cocoon' | 'local';

export interface ProviderMetadata {
  id:                ProviderId;
  displayName:       string;
  envVar:            string;        // empty string for keyless providers (local, cocoon)
  keyPrefix:         string | null; // null = no prefix validation
  keyHint:           string;
  consoleUrl:        string;
  baseURL:           string;
  defaultModel:      string;
  utilityModel:      string;
  toolLimit:         number | null; // null = unlimited (Anthropic paid)
  maxContextChars:   number;
  authHeader:        'bearer' | 'x-api-key' | 'none';
  supportsStream:    boolean;
  openaiCompatible:  boolean;       // true → use OpenAI SDK with baseURL; false → custom adapter
  notes?:            string;
}

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderMetadata> = {
  // ── Tier 0: original 7 (v1.x) ─────────────────────────────────────────────
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    envVar: 'OPENAI_API_KEY',  // we route via OpenAI-compat proxy
    keyPrefix: 'AIza',
    keyHint: 'AIza...',
    consoleUrl: 'https://aistudio.google.com/apikey',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.5-flash',
    utilityModel: 'gemini-2.0-flash-lite',
    toolLimit: 60,
    maxContextChars: 40_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic Claude',
    envVar: 'ANTHROPIC_API_KEY',
    keyPrefix: 'sk-ant-',
    keyHint: 'sk-ant-api03-...',
    consoleUrl: 'https://console.anthropic.com/',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    utilityModel: 'claude-haiku-4-5-20251001',
    toolLimit: null,             // paid tiers effectively unlimited
    maxContextChars: 40_000,
    authHeader: 'x-api-key',
    supportsStream: true,
    openaiCompatible: false,     // Anthropic SDK uses /v1/messages, not /chat/completions
    notes: 'Native SDK path in api-server.ts/atlas; OAuth sk-ant-oat- tokens REJECTED.',
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    keyPrefix: 'sk-',
    keyHint: 'sk-proj-...',
    consoleUrl: 'https://platform.openai.com/api-keys',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    utilityModel: 'gpt-4o-mini',
    toolLimit: 128,
    maxContextChars: 30_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  groq: {
    id: 'groq',
    displayName: 'Groq',
    envVar: 'GROQ_API_KEY',
    keyPrefix: 'gsk_',
    keyHint: 'gsk_...',
    consoleUrl: 'https://console.groq.com/keys',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    utilityModel: 'llama-3.1-8b-instant',
    toolLimit: 15,               // free tier 12K TPM hard cap
    maxContextChars: 8_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    utilityModel: 'deepseek-chat',  // no cheap variant
    toolLimit: 60,
    maxContextChars: 25_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    keyPrefix: 'sk-or-',
    keyHint: 'sk-or-v1-...',
    consoleUrl: 'https://openrouter.ai/keys',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    utilityModel: 'google/gemini-2.0-flash-lite:free',
    toolLimit: 40,
    maxContextChars: 20_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
    notes: 'Used as Atlas fallback when Gemini quota exhausted.',
  },
  together: {
    id: 'together',
    displayName: 'Together.ai',
    envVar: 'TOGETHER_API_KEY',
    keyPrefix: null,
    keyHint: '...',
    consoleUrl: 'https://api.together.ai/settings/api-keys',
    baseURL: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    utilityModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    toolLimit: 30,
    maxContextChars: 15_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },

  // ── Tier 1: added in v2.3.2 (Teleton catch-up) ────────────────────────────
  xai: {
    id: 'xai',
    displayName: 'xAI Grok',
    envVar: 'XAI_API_KEY',
    keyPrefix: 'xai-',
    keyHint: 'xai-...',
    consoleUrl: 'https://console.x.ai/',
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-3',
    utilityModel: 'grok-3-mini-fast',
    toolLimit: 80,
    maxContextChars: 30_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  moonshot: {
    id: 'moonshot',
    displayName: 'Moonshot (Kimi)',
    envVar: 'MOONSHOT_API_KEY',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    consoleUrl: 'https://platform.moonshot.ai/',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2',
    utilityModel: 'kimi-k2',
    toolLimit: 60,
    maxContextChars: 40_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  mistral: {
    id: 'mistral',
    displayName: 'Mistral AI',
    envVar: 'MISTRAL_API_KEY',
    keyPrefix: null,
    keyHint: 'key...',
    consoleUrl: 'https://console.mistral.ai/api-keys',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    utilityModel: 'ministral-8b-latest',
    toolLimit: 40,
    maxContextChars: 30_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  cerebras: {
    id: 'cerebras',
    displayName: 'Cerebras',
    envVar: 'CEREBRAS_API_KEY',
    keyPrefix: 'csk-',
    keyHint: 'csk-...',
    consoleUrl: 'https://cloud.cerebras.ai/',
    baseURL: 'https://api.cerebras.ai/v1',
    defaultModel: 'qwen-3-235b-a22b-instruct-2507',
    utilityModel: 'llama3.1-8b',
    toolLimit: 30,
    maxContextChars: 8_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
    notes: 'Ultra-fast inference, small context, no tool-call streaming for some models.',
  },
  zai: {
    id: 'zai',
    displayName: 'Z.AI (GLM)',
    envVar: 'ZAI_API_KEY',
    keyPrefix: null,
    keyHint: 'key...',
    consoleUrl: 'https://z.ai/manage-apikey/apikey-list',
    baseURL: 'https://api.z.ai/v1',
    defaultModel: 'glm-4.5',
    utilityModel: 'glm-4.5-flash',
    toolLimit: 40,
    maxContextChars: 25_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
  },
  minimax: {
    id: 'minimax',
    displayName: 'MiniMax',
    envVar: 'MINIMAX_API_KEY',
    keyPrefix: null,
    keyHint: 'key (shown only once on platform.minimax.io)',
    consoleUrl: 'https://platform.minimax.io/',
    baseURL: 'https://api.minimax.chat/v1',
    defaultModel: 'MiniMax-M2',
    utilityModel: 'MiniMax-M2',
    toolLimit: 40,
    maxContextChars: 30_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
    notes: 'Strong on multi-modal; some tool-call quirks (function_call vs tools).',
  },
  huggingface: {
    id: 'huggingface',
    displayName: 'HuggingFace Inference',
    envVar: 'HF_TOKEN',
    keyPrefix: 'hf_',
    keyHint: 'hf_...',
    consoleUrl: 'https://huggingface.co/settings/tokens',
    baseURL: 'https://api-inference.huggingface.co/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    utilityModel: 'Qwen/Qwen2.5-7B-Instruct',
    toolLimit: 15,
    maxContextChars: 8_000,
    authHeader: 'bearer',
    supportsStream: true,
    openaiCompatible: true,
    notes: 'Free tier rate-limited; route variability per model card.',
  },
  cocoon: {
    id: 'cocoon',
    displayName: 'Cocoon (TON Decentralized)',
    envVar: '',                  // no API key — pays in TON
    keyPrefix: null,
    keyHint: 'No key — pays in TON per call',
    consoleUrl: 'https://cocoon.network',
    baseURL: 'https://api.cocoon.network/v1',
    defaultModel: 'Qwen/Qwen3-32B',
    utilityModel: 'Qwen/Qwen3-32B',
    toolLimit: 30,
    maxContextChars: 16_000,
    authHeader: 'none',
    supportsStream: false,
    openaiCompatible: true,
    notes: 'Decentralized inference; pays in TON; uses agentic_wallet for billing.',
  },
  local: {
    id: 'local',
    displayName: 'Local (Ollama / vLLM / LM Studio)',
    envVar: '',
    keyPrefix: null,
    keyHint: 'No key needed',
    consoleUrl: '',
    baseURL: 'http://127.0.0.1:11434/v1',  // Ollama default
    defaultModel: 'llama3.1',
    utilityModel: 'llama3.1',
    toolLimit: 30,
    maxContextChars: 16_000,
    authHeader: 'none',
    supportsStream: true,
    openaiCompatible: true,
    notes: 'User runs own inference. Override baseURL via LOCAL_AI_URL env.',
  },
};

/**
 * Resolve a provider's metadata; throws if id is unknown.
 * Pass `'platform'` to get a sentinel that resolves to whatever PLATFORM_AI uses.
 */
export function getProvider(id: string): ProviderMetadata {
  const meta = (PROVIDER_REGISTRY as any)[id];
  if (!meta) throw new Error(`Unknown AI provider: ${id}`);
  return meta;
}

/** Validate a user-pasted API key for a given provider. */
export function validateApiKey(providerId: string, key: string): { ok: boolean; error?: string } {
  if (!key) return { ok: false, error: 'API key is empty' };
  const meta = (PROVIDER_REGISTRY as any)[providerId];
  if (!meta) return { ok: false, error: `Unknown provider "${providerId}"` };
  if (meta.envVar === '' && meta.authHeader === 'none') return { ok: true };  // keyless
  if (meta.keyPrefix && !key.startsWith(meta.keyPrefix)) {
    return { ok: false, error: `Expected key starting with "${meta.keyPrefix}"` };
  }
  if (key.length < 8) return { ok: false, error: 'API key too short' };
  return { ok: true };
}

/** Provider listing for Studio UI (sorted with originals first, then alphabetically). */
export function listProvidersForUI(): Array<Pick<ProviderMetadata, 'id' | 'displayName' | 'envVar' | 'keyHint' | 'consoleUrl' | 'defaultModel'>> {
  const ORIGINAL = new Set(['gemini', 'anthropic', 'openai', 'groq', 'deepseek', 'openrouter', 'together']);
  const all = Object.values(PROVIDER_REGISTRY);
  const original = all.filter(p => ORIGINAL.has(p.id)).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const rest = all.filter(p => !ORIGINAL.has(p.id)).sort((a, b) => a.displayName.localeCompare(b.displayName));
  return [...original, ...rest].map(({ id, displayName, envVar, keyHint, consoleUrl, defaultModel }) =>
    ({ id, displayName, envVar, keyHint, consoleUrl, defaultModel }));
}
