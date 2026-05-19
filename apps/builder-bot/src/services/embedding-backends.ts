/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EMBEDDING BACKENDS — pluggable embedding provider for Hybrid RAG memory.
 *
 * Backend selected via env var EMBEDDING_BACKEND:
 *   • 'gemini' (default)  — Google's text-embedding-004, 768d, requires API key.
 *                            Costs Gemini quota; falls back to FTS-only if no key.
 *   • 'local'             — @huggingface/transformers + Xenova/all-MiniLM-L6-v2,
 *                            384d, runs ONNX on CPU in-process. Zero API cost,
 *                            works offline. First call downloads ~90MB model to
 *                            ~/.cache/huggingface/. Subsequent calls ~50-200ms.
 *
 * Deploy-level choice (not per-request). When you switch, ALL new memories use
 * the new backend's dimensionality. Old memories from prior backend remain in
 * the DB but the cosine-sim code returns 0 on dim mismatch, so they degrade to
 * FTS-only retrieval (still works).
 *
 * Public API matches the prior inline `embed()` in hybrid-memory.ts:
 *   embed(text) → number[] | null
 * ═══════════════════════════════════════════════════════════════════════════
 */

import OpenAI from 'openai';

export type EmbeddingBackendId = 'gemini' | 'local';
export const EMBEDDING_BACKEND: EmbeddingBackendId =
  (process.env.EMBEDDING_BACKEND as EmbeddingBackendId) || 'gemini';

export const MAX_CHUNK_CHARS = 4000;

// ── Backend: Gemini (API) ───────────────────────────────────────────────────

let _geminiClient: OpenAI | null = null;
function getGeminiClient(): OpenAI | null {
  if (_geminiClient) return _geminiClient;
  const key = process.env.HYBRID_EMBED_KEY || process.env.OPENAI_API_KEY || '';
  const base = process.env.HYBRID_EMBED_URL || process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  if (!key) return null;
  _geminiClient = new OpenAI({ apiKey: key, baseURL: base });
  return _geminiClient;
}

async function embedGemini(text: string): Promise<number[] | null> {
  const client = getGeminiClient();
  if (!client) return null;
  try {
    const r = await client.embeddings.create({
      model: process.env.HYBRID_EMBED_MODEL || 'text-embedding-004',
      input: text,
    });
    const v = r.data?.[0]?.embedding;
    return Array.isArray(v) ? (v as number[]) : null;
  } catch (e: any) {
    console.warn(`[Embed/Gemini] failed: ${e?.message?.slice(0, 100)}`);
    return null;
  }
}

// ── Backend: Local (ONNX MiniLM-L6-v2) ──────────────────────────────────────

let _localExtractor: any = null;
let _localLoading: Promise<any> | null = null;

async function loadLocalExtractor(): Promise<any> {
  if (_localExtractor) return _localExtractor;
  if (_localLoading) return _localLoading;
  _localLoading = (async () => {
    try {
      // Dynamic import — @huggingface/transformers may not be installed in
      // gemini-only deployments. Falls back to null on import failure.
      const { pipeline } = await import('@huggingface/transformers' as any);
      const modelId = process.env.LOCAL_EMBED_MODEL || 'Xenova/all-MiniLM-L6-v2';
      console.log(`[Embed/Local] loading ${modelId} (first call downloads ~90MB to ~/.cache/huggingface/)...`);
      const t0 = Date.now();
      _localExtractor = await pipeline('feature-extraction', modelId, {
        // Use quantized model for ~4x smaller download + faster CPU inference
        quantized: true,
      });
      console.log(`[Embed/Local] ${modelId} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return _localExtractor;
    } catch (e: any) {
      console.error(`[Embed/Local] failed to load model: ${e?.message}. Falling back to FTS-only.`);
      _localExtractor = null;
      _localLoading = null;
      return null;
    }
  })();
  return _localLoading;
}

async function embedLocal(text: string): Promise<number[] | null> {
  const extractor = await loadLocalExtractor();
  if (!extractor) return null;
  try {
    // Mean-pool token embeddings, L2-normalize → unit vector ready for cosine sim
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (e: any) {
    console.warn(`[Embed/Local] inference failed: ${e?.message?.slice(0, 100)}`);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Embed text using the configured backend. Returns null on failure.
 * Caller (hybrid-memory) treats null as "vector branch unavailable" and
 * degrades gracefully to FTS-only retrieval.
 */
export async function embed(text: string): Promise<number[] | null> {
  const truncated = String(text || '').slice(0, MAX_CHUNK_CHARS);
  if (!truncated) return null;
  return EMBEDDING_BACKEND === 'local' ? await embedLocal(truncated) : await embedGemini(truncated);
}

/**
 * Reports which backend is active and its expected vector dimension. Used
 * by health endpoints + the agent's `get_my_full_state` introspection.
 */
export function embeddingBackendInfo(): { backend: EmbeddingBackendId; expectedDim: number; ready: boolean } {
  if (EMBEDDING_BACKEND === 'local') {
    return { backend: 'local', expectedDim: 384, ready: _localExtractor !== null };
  }
  return { backend: 'gemini', expectedDim: 768, ready: _geminiClient !== null };
}

/**
 * Optional pre-warm for the local backend — call from boot if EMBEDDING_BACKEND=local
 * so the first user-facing recall doesn't pay the model-load latency.
 */
export async function prewarmEmbedding(): Promise<void> {
  if (EMBEDDING_BACKEND === 'local') {
    await loadLocalExtractor();
  }
}
