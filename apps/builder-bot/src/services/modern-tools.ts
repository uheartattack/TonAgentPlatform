/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN TOOLS — v2.3.5 batch of "what's hot in 2026" capabilities.
 *
 * Each function returns { ok, ...data | error }. Caller (ai-agent-runtime)
 * dispatches via thin case handlers.
 *
 * Provider keys read from env at call time (no module-level caching since
 * agents can override via params.config).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as crypto from 'crypto';

const GEMINI_OPENAI = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_NATIVE = 'https://generativelanguage.googleapis.com/v1beta';

function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || null;
}

// ── QR code generation ──────────────────────────────────────────────────
export interface QrInput {
  data?: string;                          // raw payload (URL, text, ...)
  ton_pay?: { address: string; amount_ton?: number; memo?: string };  // build ton://transfer link
  size?: number;                          // px (default 400, max 1024)
  margin?: number;                        // pixels (default 2)
  fg_color?: string;                      // hex without #
  bg_color?: string;
}
export async function generateQrCode(input: QrInput): Promise<{
  ok: boolean; url?: string; payload?: string; error?: string;
}> {
  let payload = input.data || '';
  if (input.ton_pay) {
    const { address, amount_ton, memo } = input.ton_pay;
    if (!address) return { ok: false, error: 'ton_pay.address is required' };
    const params: string[] = [];
    if (amount_ton && amount_ton > 0) params.push(`amount=${Math.floor(amount_ton * 1e9)}`);
    if (memo) params.push(`text=${encodeURIComponent(memo)}`);
    payload = `ton://transfer/${address}${params.length ? '?' + params.join('&') : ''}`;
  }
  if (!payload) return { ok: false, error: 'data or ton_pay is required' };
  const size = Math.min(1024, Math.max(64, input.size || 400));
  const margin = Math.min(20, Math.max(0, input.margin ?? 2));
  // Use api.qrserver.com — free, no API key
  const q = new URLSearchParams({
    data: payload,
    size: `${size}x${size}`,
    margin: String(margin),
    color: (input.fg_color || '000000').replace('#', ''),
    bgcolor: (input.bg_color || 'ffffff').replace('#', ''),
    format: 'png',
  });
  return { ok: true, url: `https://api.qrserver.com/v1/create-qr-code/?${q.toString()}`, payload };
}

// ── Reverse image search ────────────────────────────────────────────────
// Strategy: use Google Images via SerpApi if SERPAPI_KEY set, else fall back
// to TinEye-style scraping via duckduckgo image proxy (best-effort).
export async function reverseImageSearch(url: string): Promise<{
  ok: boolean; matches?: Array<{ source_url: string; title?: string; thumb?: string }>;
  search_url?: string; error?: string;
}> {
  if (!url) return { ok: false, error: 'url is required' };
  const serpKey = process.env.SERPAPI_KEY || '';
  if (serpKey) {
    try {
      const u = new URL('https://serpapi.com/search.json');
      u.searchParams.set('engine', 'google_reverse_image');
      u.searchParams.set('image_url', url);
      u.searchParams.set('api_key', serpKey);
      const r = await fetch(u.toString(), { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) return { ok: false, error: `SerpApi HTTP ${r.status}` };
      const j = await r.json() as any;
      const results = (j.image_results || j.inline_images || []).slice(0, 20)
        .map((m: any) => ({ source_url: m.link || m.source, title: m.title, thumb: m.thumbnail }));
      return { ok: true, matches: results, search_url: u.toString() };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e).slice(0, 200) };
    }
  }
  // Fallback: just return the Google reverse-search URL the user can open manually
  const fallback = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(url)}`;
  return { ok: true, matches: [], search_url: fallback, error: 'No SERPAPI_KEY — returned Google manual URL' };
}

// ── Email send via Resend ────────────────────────────────────────────────
export async function emailSend(input: {
  to: string | string[]; subject: string; html?: string; text?: string;
  from?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY || '';
  if (!key) return { ok: false, error: 'RESEND_API_KEY not configured' };
  const from = input.from || process.env.RESEND_FROM || 'noreply@tonagentplatform.com';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        from, to: input.to,
        subject: String(input.subject).slice(0, 200),
        html: input.html, text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json() as any;
    if (!r.ok) return { ok: false, error: j.message || `HTTP ${r.status}` };
    return { ok: true, id: j.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── Podcast generate via Gemini multi-speaker TTS ──────────────────────
export async function podcastGenerate(input: {
  script: string;                          // dialogue: "Alice: ...\nBob: ..."
  speakers?: Array<{ name: string; voice: string }>;  // default: Alice=Kore, Bob=Puck
  model?: string;
}): Promise<{ ok: boolean; audio_base64?: string; mime?: string; error?: string }> {
  if (!input.script || input.script.length < 20) return { ok: false, error: 'script is required (≥20 chars)' };
  if (input.script.length > 8000) return { ok: false, error: 'script too long (max 8000 chars)' };
  const key = geminiKey();
  if (!key) return { ok: false, error: 'No Gemini key' };
  const speakers = input.speakers && input.speakers.length > 0 ? input.speakers
    : [{ name: 'Alice', voice: 'Kore' }, { name: 'Bob', voice: 'Puck' }];
  const model = input.model || 'gemini-2.5-flash-preview-tts';
  try {
    const r = await fetch(`${GEMINI_NATIVE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: speakers.map(s => ({
                speaker: s.name,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } },
              })),
            },
          },
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) { let d = ''; try { d = (await r.text()).slice(0, 200); } catch {} return { ok: false, error: `Gemini HTTP ${r.status}: ${d}` }; }
    const j = await r.json() as any;
    const audio = j.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
    if (!audio) return { ok: false, error: 'No audio in response' };
    const inline = audio.inlineData || audio.inline_data;
    return { ok: true, audio_base64: inline.data, mime: inline.mimeType || 'audio/wav' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── Image edit via Gemini Flash Image ──────────────────────────────────
export async function imageEdit(input: {
  url: string;                             // input image URL
  prompt: string;                          // edit instruction
  model?: string;
}): Promise<{ ok: boolean; image_base64?: string; mime?: string; error?: string }> {
  if (!input.url || !input.prompt) return { ok: false, error: 'url + prompt required' };
  const key = geminiKey();
  if (!key) return { ok: false, error: 'No Gemini key' };
  try {
    const imgResp = await fetch(input.url, { signal: AbortSignal.timeout(20_000) });
    if (!imgResp.ok) return { ok: false, error: `Image fetch HTTP ${imgResp.status}` };
    const mime = imgResp.headers.get('content-type') || 'image/jpeg';
    const b64 = Buffer.from(await imgResp.arrayBuffer()).toString('base64');
    const model = input.model || 'gemini-2.5-flash-image';
    const r = await fetch(`${GEMINI_NATIVE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mime, data: b64 } },
            { text: input.prompt.slice(0, 4000) },
          ],
        }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) { let d = ''; try { d = (await r.text()).slice(0, 200); } catch {} return { ok: false, error: `Gemini HTTP ${r.status}: ${d}` }; }
    const j = await r.json() as any;
    const img = j.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
    if (!img) return { ok: false, error: 'No image returned' };
    const inline = img.inlineData || img.inline_data;
    return { ok: true, image_base64: inline.data, mime: inline.mimeType || 'image/png' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── Video generate via Gemini Veo ──────────────────────────────────────
export async function videoGenerate(input: {
  prompt: string;                          // text → video
  duration_seconds?: number;               // 4-8
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  model?: string;
}): Promise<{ ok: boolean; video_uri?: string; poll_url?: string; error?: string }> {
  if (!input.prompt) return { ok: false, error: 'prompt required' };
  const key = geminiKey();
  if (!key) return { ok: false, error: 'No Gemini key' };
  const model = input.model || 'veo-3.0-generate-preview';
  try {
    const r = await fetch(`${GEMINI_NATIVE}/models/${model}:predictLongRunning?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{
          prompt: input.prompt.slice(0, 4000),
        }],
        parameters: {
          aspectRatio: input.aspect_ratio || '16:9',
          durationSeconds: Math.min(8, Math.max(4, input.duration_seconds || 5)),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) { let d = ''; try { d = (await r.text()).slice(0, 200); } catch {} return { ok: false, error: `Gemini Veo HTTP ${r.status}: ${d}` }; }
    const j = await r.json() as any;
    // Veo is async — returns an operation name to poll later
    return { ok: true, video_uri: j.name, poll_url: `${GEMINI_NATIVE}/${j.name}?key=${encodeURIComponent(key)}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── Translate / sentiment — both via Gemini, cheap utility model ──────
export async function translateText(input: { text: string; target_lang: string; source_lang?: string }): Promise<{
  ok: boolean; translated?: string; detected_lang?: string; error?: string;
}> {
  if (!input.text || !input.target_lang) return { ok: false, error: 'text + target_lang required' };
  const key = geminiKey();
  if (!key) return { ok: false, error: 'No Gemini key' };
  const prompt = `Translate the following text to ${input.target_lang}. Return ONLY the translation, no explanations, no quotes. Preserve formatting.\n\n${input.text}`;
  try {
    const r = await fetch(`${GEMINI_OPENAI}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gemini-2.0-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(8000, input.text.length * 3),
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return { ok: false, error: `Gemini HTTP ${r.status}` };
    const j = await r.json() as any;
    const translated = j.choices?.[0]?.message?.content?.trim() || '';
    return { ok: !!translated, translated };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

export async function sentimentAnalyze(input: { text: string }): Promise<{
  ok: boolean; sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  score?: number; red_flags?: string[]; summary?: string; error?: string;
}> {
  if (!input.text) return { ok: false, error: 'text required' };
  const key = geminiKey();
  if (!key) return { ok: false, error: 'No Gemini key' };
  const prompt = `Analyze the sentiment of the following text. Return STRICTLY a JSON object with keys: "sentiment" (positive|neutral|negative|mixed), "score" (-1 to 1), "red_flags" (array of strings — scams/hate/threats/spam/manipulation detected), "summary" (1 short sentence). Return ONLY JSON, no markdown fences.\n\nTEXT:\n${input.text.slice(0, 4000)}`;
  try {
    const r = await fetch(`${GEMINI_OPENAI}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gemini-2.0-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600, temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return { ok: false, error: `Gemini HTTP ${r.status}` };
    const j = await r.json() as any;
    const raw = (j.choices?.[0]?.message?.content || '').trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true, ...parsed };
    } catch {
      return { ok: false, error: 'Could not parse sentiment JSON', summary: raw };
    }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── Webhook integrations: Discord / Slack ──────────────────────────────
export async function discordSend(input: {
  webhook_url: string; text: string; username?: string; avatar_url?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.webhook_url || !input.text) return { ok: false, error: 'webhook_url + text required' };
  if (!/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(input.webhook_url)) {
    return { ok: false, error: 'Invalid Discord webhook URL' };
  }
  try {
    const r = await fetch(input.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: input.text.slice(0, 2000),
        username: input.username?.slice(0, 80),
        avatar_url: input.avatar_url,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok && r.status !== 204) return { ok: false, error: `Discord HTTP ${r.status}` };
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 200) }; }
}

export async function slackSend(input: { webhook_url: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  if (!input.webhook_url || !input.text) return { ok: false, error: 'webhook_url + text required' };
  if (!/^https:\/\/hooks\.slack\.com\//.test(input.webhook_url)) {
    return { ok: false, error: 'Invalid Slack webhook URL' };
  }
  try {
    const r = await fetch(input.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.text.slice(0, 4000) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, error: `Slack HTTP ${r.status}` };
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 200) }; }
}
