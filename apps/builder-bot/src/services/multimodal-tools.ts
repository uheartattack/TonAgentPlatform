/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MULTIMODAL TOOLS — Gemini multimodal + QuickChart + TTS
 *
 * Bundles the four new v2.3.4 multimodal tools so the runtime handlers
 * stay thin:
 *   • analyzeBatch(urls, prompt) — up to 16 images at once
 *   • renderChart(data, type)     — PNG chart via QuickChart.io
 *   • analyzeVideo(url, prompt)   — Gemini sees video (mp4/webm)
 *   • textToSpeech(text, voice?)  — Gemini TTS → wav buffer
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Helper: pick a Gemini key, prefer GEMINI_API_KEY → OPENAI_API_KEY (which is Gemini on our prod) ──
function getGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || null;
}

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_NATIVE_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function fetchAsBase64(url: string, signal?: AbortSignal): Promise<{ b64: string; mime: string } | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const mime = r.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await r.arrayBuffer());
    return { b64: buf.toString('base64'), mime };
  } catch { return null; }
}

// ─── analyzeBatch — up to 16 images in ONE Gemini call ────────────────────
export interface AnalyzeBatchInput {
  urls: string[];
  prompt?: string;
  model?: string;
}
export async function analyzeBatch(input: AnalyzeBatchInput): Promise<{
  ok: boolean; answer?: string; analyzed?: number; model?: string; error?: string;
}> {
  const urls = (input.urls || []).slice(0, 16);
  if (urls.length === 0) return { ok: false, error: 'urls is empty' };
  const key = getGeminiKey();
  if (!key) return { ok: false, error: 'No Gemini key available' };
  const model = input.model || 'gemini-2.5-flash';
  const prompt = (input.prompt || 'Опиши и сравни эти изображения. Отметь общее, различия, что выделяется.').slice(0, 4000);

  // Download in parallel, base64-encode each
  const blobs = await Promise.all(urls.map(u => fetchAsBase64(u, AbortSignal.timeout(20_000))));
  const ok = blobs.filter(Boolean) as Array<{ b64: string; mime: string }>;
  if (ok.length === 0) return { ok: false, error: 'failed to fetch any image' };

  // Send as multi-part OpenAI-compat message (Gemini supports image_url with data URLs)
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const blob of ok) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${blob.mime};base64,${blob.b64}` },
    });
  }
  try {
    const r = await fetch(`${GEMINI_OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        max_tokens: 2048,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      let det = ''; try { det = (await r.text()).slice(0, 200); } catch {}
      return { ok: false, error: `Gemini HTTP ${r.status}: ${det}` };
    }
    const j = await r.json() as any;
    const answer = j.choices?.[0]?.message?.content?.trim() || '';
    if (!answer) return { ok: false, error: 'empty Gemini response' };
    return { ok: true, answer, analyzed: ok.length, model };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ─── renderChart — PNG chart via QuickChart.io (no API key needed) ───────
export interface RenderChartInput {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble' | 'candlestick';
  labels?: (string | number)[];
  datasets: Array<{ label?: string; data: number[] | Array<{ x: number; y: number }>; backgroundColor?: string; borderColor?: string }>;
  title?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
}
export async function renderChart(input: RenderChartInput): Promise<{
  ok: boolean; url?: string; png_base64?: string; error?: string;
}> {
  try {
    const chartConfig = {
      type: input.type,
      data: { labels: input.labels || [], datasets: input.datasets },
      options: input.title ? { title: { display: true, text: input.title } } : {},
    };
    const params = new URLSearchParams({
      c: JSON.stringify(chartConfig),
      w: String(input.width || 800),
      h: String(input.height || 500),
      bkg: input.backgroundColor || 'white',
    });
    const url = `https://quickchart.io/chart?${params.toString()}`;
    // Verify it works (also gives a public URL agents can re-share)
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
    if (!head.ok) return { ok: false, error: `QuickChart HTTP ${head.status}` };
    return { ok: true, url };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ─── analyzeVideo — Gemini multimodal on a single video URL ──────────────
export interface AnalyzeVideoInput {
  url: string;
  prompt?: string;
  model?: string;
}
export async function analyzeVideo(input: AnalyzeVideoInput): Promise<{
  ok: boolean; answer?: string; model?: string; error?: string;
}> {
  if (!input.url) return { ok: false, error: 'url is required' };
  const key = getGeminiKey();
  if (!key) return { ok: false, error: 'No Gemini key available' };
  const blob = await fetchAsBase64(input.url, AbortSignal.timeout(60_000));
  if (!blob) return { ok: false, error: 'failed to fetch video' };

  // Gemini native API accepts video inline (no OpenAI-compat for video yet)
  const model = input.model || 'gemini-2.5-flash';
  const prompt = (input.prompt || 'Опиши что происходит в этом видео. Перечисли ключевые моменты с тайм-кодами.').slice(0, 4000);
  try {
    const r = await fetch(`${GEMINI_NATIVE_BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: blob.mime, data: blob.b64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) {
      let det = ''; try { det = (await r.text()).slice(0, 200); } catch {}
      return { ok: false, error: `Gemini HTTP ${r.status}: ${det}` };
    }
    const j = await r.json() as any;
    const parts = j.candidates?.[0]?.content?.parts || [];
    const answer = parts.map((p: any) => p.text || '').join('').trim();
    if (!answer) return { ok: false, error: 'empty Gemini response' };
    return { ok: true, answer, model };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ─── textToSpeech — Gemini TTS via native API ────────────────────────────
export interface TextToSpeechInput {
  text: string;
  voice?: string;       // 'Kore' (default) | 'Puck' | 'Charon' | 'Aoede' | 'Fenrir'
  model?: string;       // 'gemini-2.5-flash-preview-tts' (default)
}
export async function textToSpeech(input: TextToSpeechInput): Promise<{
  ok: boolean; audio_base64?: string; mime?: string; voice?: string; error?: string;
}> {
  if (!input.text || input.text.trim().length === 0) return { ok: false, error: 'text is required' };
  if (input.text.length > 4000) return { ok: false, error: 'text too long (max 4000 chars)' };
  const key = getGeminiKey();
  if (!key) return { ok: false, error: 'No Gemini key available' };
  const voice = input.voice || 'Kore';
  const model = input.model || 'gemini-2.5-flash-preview-tts';
  try {
    const r = await fetch(`${GEMINI_NATIVE_BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      let det = ''; try { det = (await r.text()).slice(0, 200); } catch {}
      return { ok: false, error: `Gemini HTTP ${r.status}: ${det}` };
    }
    const j = await r.json() as any;
    const parts = j.candidates?.[0]?.content?.parts || [];
    const audio = parts.find((p: any) => p.inlineData || p.inline_data);
    if (!audio) return { ok: false, error: 'No audio in Gemini response' };
    const inline = audio.inlineData || audio.inline_data;
    return {
      ok: true,
      audio_base64: inline.data,
      mime: inline.mimeType || inline.mime_type || 'audio/wav',
      voice,
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}
