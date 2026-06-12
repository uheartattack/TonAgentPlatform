/**
 * tool-rag.ts — Hybrid tool selection: embedding (cosine) + keyword (BM25-like).
 * Adapted from teleton-agent tool-index.ts + registry.ts pattern.
 * Uses Gemini text-embedding-004 (free tier) for embeddings.
 * Falls back to pure keyword if embedding fails.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const EMBEDDING_DIMS = 256; // Gemini supports dimensionality reduction
const VECTOR_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;
const MIN_SCORE = 0.08;
const ALWAYS_INCLUDE_PATTERNS = [
  /^tg_send_message$/, /^tg_reply_message$/, /^tg_get_messages$/,
  /^tg_send_formatted$/, /^tg_get_unread$/, /^tg_mark_read$/,
  /^tg_kick_user/, /^tg_ban_user/, /^tg_mute_user/, /^tg_unban_user$/,
  /^tg_react$/, /^tg_pin$/, /^tg_forward_message$/,
  /^tg_send_file$/, /^tg_send_photo$/, /^tg_send_voice$/,
  /^tg_get_dialogs$/, /^tg_search_messages$/, /^tg_get_channel_info$/,
  /^get_state$/, /^set_state$/, /^get_state_multi$/, /^list_state_keys$/,
  /^notify_user$/, /^notify$/, /^notify_rich$/, /^remember$/, /^recall$/,
  /^save_lesson$/, /^web_search$/, /^fetch_url$/, /^image_analyze$/,
  /^get_ton_balance$/, /^send_ton$/,
  /^schedule_action$/, /^set_next_wake$/,
];

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDING CACHE (in-memory, survives ticks)
// ═══════════════════════════════════════════════════════════════════════════

interface EmbeddingEntry {
  vector: number[];
  text: string;
}

let _toolEmbeddings = new Map<string, EmbeddingEntry>();
let _toolSignature = '';
let _lastEmbedApiKey = '';

/** Get embedding via native Gemini REST API (not OpenAI compat) */
async function embed(text: string, apiKey?: string): Promise<number[] | null> {
  // Use PLATFORM_AI_KEY, GEMINI_API_KEY, or OPENAI_API_KEY if Gemini base URL
  const isGeminiBase = (process.env.OPENAI_BASE_URL || '').includes('generativelanguage.googleapis.com');
  const key = apiKey || process.env.PLATFORM_AI_KEY || process.env.GEMINI_API_KEY || (isGeminiBase ? process.env.OPENAI_API_KEY : '') || '';
  if (!key || key === 'none') return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMS,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data as any).embedding?.values || null;
  } catch {
    return null;
  }
}

/** Batch embed via native Gemini REST API */
async function embedBatch(texts: string[], apiKey?: string): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  // Use PLATFORM_AI_KEY, GEMINI_API_KEY, or OPENAI_API_KEY if Gemini base URL
  const isGeminiBase = (process.env.OPENAI_BASE_URL || '').includes('generativelanguage.googleapis.com');
  const key = apiKey || process.env.PLATFORM_AI_KEY || process.env.GEMINI_API_KEY || (isGeminiBase ? process.env.OPENAI_API_KEY : '') || '';
  if (!key || key === 'none') return texts.map(() => null);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${key}`;
    const results: (number[] | null)[] = [];
    // Process in chunks of 100
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map(text => ({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMS,
          })),
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.warn(`[ToolRAG] Batch embedding HTTP ${resp.status}: ${errText.slice(0, 100)}`);
        for (let j = 0; j < batch.length; j++) results.push(null);
        continue;
      }
      const data = await resp.json();
      for (const emb of ((data as any).embeddings || [])) {
        results.push(emb?.values || null);
      }
    }
    return results;
  } catch (e: any) {
    console.warn(`[ToolRAG] Batch embedding failed: ${e.message?.slice(0, 100)}`);
    return texts.map(() => null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL INDEXING
// ═══════════════════════════════════════════════════════════════════════════

// Accept any tool shape (OpenAI ChatCompletionTool or custom)
type ToolDef = any;

function toolToSearchText(t: any): string {
  const fn = t.function || (t as any);
  const name = fn.name || '';
  const desc = fn.description || '';
  const paramNames = fn.parameters?.properties
    ? Object.keys(fn.parameters.properties).join(' ')
    : '';
  return `${name} ${name.replace(/_/g, ' ')} ${desc} ${paramNames}`;
}

/** Index all tools — compute embeddings (async, cached) */
export async function indexTools(tools: any[], apiKey?: string): Promise<void> {
  const sig = tools.map(t => (t.function?.name || (t as any).name || '')).sort().join(',');
  if (sig === _toolSignature && _toolEmbeddings.size > 0) return; // already indexed

  const texts = tools.map(toolToSearchText);
  const names = tools.map(t => t.function?.name || (t as any).name || '');

  // Batch embed all tool descriptions
  const vectors = await embedBatch(texts, apiKey);

  _toolEmbeddings = new Map();
  for (let i = 0; i < names.length; i++) {
    _toolEmbeddings.set(names[i], {
      vector: vectors[i] || [],
      text: texts[i].toLowerCase(),
    });
  }
  _toolSignature = sig;
  _lastEmbedApiKey = apiKey || '';

  const embeddedCount = vectors.filter(v => v && v.length > 0).length;
  console.log(`[ToolRAG] Indexed ${names.length} tools (${embeddedCount} with embeddings, ${names.length - embeddedCount} keyword-only)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH (hybrid: embedding + keyword)
// ═══════════════════════════════════════════════════════════════════════════

function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function keywordScore(query: string, toolText: string): number {
  const qTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (qTerms.length === 0) return 0;
  let matches = 0;
  for (const term of qTerms) {
    if (toolText.includes(term)) matches++;
  }
  return matches / qTerms.length;
}

export interface ToolScore {
  name: string;
  score: number;
  vectorScore: number;
  keywordScore: number;
}

/** Search tools by query — returns scored list */
export async function searchTools(
  query: string,
  topK: number = 30,
): Promise<ToolScore[]> {
  if (_toolEmbeddings.size === 0) return [];

  // Embed query
  const queryVec = await embed(query, _lastEmbedApiKey || undefined);
  const hasVectors = queryVec && queryVec.length > 0;

  // Determine weights
  const vWeight = hasVectors ? VECTOR_WEIGHT : 0;
  const kWeight = hasVectors ? KEYWORD_WEIGHT : 1.0;

  const scores: ToolScore[] = [];

  for (const [name, entry] of _toolEmbeddings) {
    // Vector similarity
    const vs = hasVectors && entry.vector.length > 0
      ? cosineSim(queryVec!, entry.vector)
      : 0;

    // Keyword score
    const ks = keywordScore(query, entry.text);

    const combined = vs * vWeight + ks * kWeight;

    if (combined >= MIN_SCORE) {
      scores.push({ name, score: combined, vectorScore: vs, keywordScore: ks });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: select tools for a request
// ═══════════════════════════════════════════════════════════════════════════

function isAlwaysIncluded(name: string): boolean {
  return ALWAYS_INCLUDE_PATTERNS.some(p => p.test(name));
}

/**
 * Select relevant tools using hybrid embedding + keyword search.
 * Falls back to original TF-IDF selectRelevantTools if embeddings unavailable.
 */
export async function selectToolsHybrid(
  allTools: any[],
  userMessage: string,
  systemPrompt: string,
  maxTools: number = 30,
  apiKey?: string,
): Promise<any[]> {
  if (allTools.length <= maxTools) return allTools;

  // Ensure tools are indexed (pass apiKey for Gemini embedding)
  await indexTools(allTools, apiKey);

  // Always-included tools
  const alwaysTools = allTools.filter((t: any) => isAlwaysIncluded(t.function?.name || t.name || ''));
  const alwaysNames = new Set(alwaysTools.map((t: any) => t.function?.name || t.name));

  // Search with user message context
  const query = `${userMessage} ${systemPrompt}`.slice(0, 500);
  const results = await searchTools(query, maxTools);

  // Build result set: always-included + top scored
  const selectedNames = new Set(alwaysNames);
  const selected: any[] = [...alwaysTools];

  const toolMap = new Map(allTools.map((t: any) => [t.function?.name || t.name, t]));

  for (const r of results) {
    if (selected.length >= maxTools) break;
    if (selectedNames.has(r.name)) continue;
    const tool = toolMap.get(r.name);
    if (tool) {
      selected.push(tool);
      selectedNames.add(r.name);
    }
  }

  // If we got very few results (embedding failed), fall back to all tools capped
  if (selected.length < Math.min(15, allTools.length)) {
    console.log(`[ToolRAG] Hybrid returned only ${selected.length} tools, falling back to full set capped at ${maxTools}`);
    return allTools.slice(0, maxTools);
  }

  const embCount = results.filter(r => r.vectorScore > 0).length;
  console.log(`[ToolRAG] Hybrid selected ${selected.length}/${allTools.length} tools (${alwaysNames.size} always + ${embCount} by embedding + ${selected.length - alwaysNames.size - embCount} by keyword)`);
  return selected;
}
