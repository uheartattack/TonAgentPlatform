/**
 * tool-rag.ts — Hybrid tool selection: embedding (cosine) + keyword (BM25-like).
 * Adapted from teleton-agent tool-index.ts + registry.ts pattern.
 * Uses Gemini text-embedding-004 (free tier) for embeddings.
 * Falls back to pure keyword if embedding fails.
 */

import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMS = 256; // Gemini supports dimensionality reduction
const VECTOR_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;
const MIN_SCORE = 0.08;
const ALWAYS_INCLUDE_PATTERNS = [
  /^tg_send_message$/, /^tg_reply_message$/, /^tg_get_messages$/,
  /^get_state$/, /^set_state$/, /^notify_user$/, /^remember$/,
  /^save_lesson$/, /^web_search$/, /^image_analyze$/,
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
let _embeddingClient: OpenAI | null = null;

function getEmbeddingClient(): OpenAI {
  if (!_embeddingClient) {
    const key = process.env.PLATFORM_AI_KEY || process.env.GEMINI_API_KEY || '';
    _embeddingClient = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: key,
    });
  }
  return _embeddingClient;
}

/** Get embedding for a single text */
async function embed(text: string): Promise<number[] | null> {
  try {
    const client = getEmbeddingClient();
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMS,
    } as any);
    return (res.data[0] as any)?.embedding || null;
  } catch (e: any) {
    // Silent fail — fallback to keyword only
    return null;
  }
}

/** Batch embed (Gemini supports up to 2048 inputs) */
async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  try {
    const client = getEmbeddingClient();
    // Split into chunks of 100 for safety
    const results: (number[] | null)[] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMS,
      } as any);
      for (const item of res.data) {
        results.push((item as any)?.embedding || null);
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

interface ToolDef {
  function: { name: string; description?: string; parameters?: any };
}

function toolToSearchText(t: ToolDef): string {
  const fn = t.function || (t as any);
  const name = fn.name || '';
  const desc = fn.description || '';
  const paramNames = fn.parameters?.properties
    ? Object.keys(fn.parameters.properties).join(' ')
    : '';
  return `${name} ${name.replace(/_/g, ' ')} ${desc} ${paramNames}`;
}

/** Index all tools — compute embeddings (async, cached) */
export async function indexTools(tools: ToolDef[]): Promise<void> {
  const sig = tools.map(t => (t.function?.name || (t as any).name || '')).sort().join(',');
  if (sig === _toolSignature && _toolEmbeddings.size > 0) return; // already indexed

  const texts = tools.map(toolToSearchText);
  const names = tools.map(t => t.function?.name || (t as any).name || '');

  // Batch embed all tool descriptions
  const vectors = await embedBatch(texts);

  _toolEmbeddings = new Map();
  for (let i = 0; i < names.length; i++) {
    _toolEmbeddings.set(names[i], {
      vector: vectors[i] || [],
      text: texts[i].toLowerCase(),
    });
  }
  _toolSignature = sig;

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
  const queryVec = await embed(query);
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
  allTools: ToolDef[],
  userMessage: string,
  systemPrompt: string,
  maxTools: number = 30,
): Promise<ToolDef[]> {
  if (allTools.length <= maxTools) return allTools;

  // Ensure tools are indexed
  await indexTools(allTools);

  // Always-included tools
  const alwaysTools = allTools.filter(t => isAlwaysIncluded(t.function?.name || (t as any).name || ''));
  const alwaysNames = new Set(alwaysTools.map(t => t.function?.name || (t as any).name));

  // Search with user message context
  const query = `${userMessage} ${systemPrompt}`.slice(0, 500);
  const results = await searchTools(query, maxTools);

  // Build result set: always-included + top scored
  const selectedNames = new Set(alwaysNames);
  const selected: ToolDef[] = [...alwaysTools];

  const toolMap = new Map(allTools.map(t => [t.function?.name || (t as any).name, t]));

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
