/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSCRIBE — audio → text via Gemini multimodal (preferred) or OpenAI Whisper.
 *
 * Used by:
 *   • bot.ts voice-message handler (Telegram /voice)
 *   • api-server.ts POST /api/voice/transcribe (Studio mic)
 *   • runtime tool `audio_transcribe` (agent calls)
 *
 * Returns { text, provider, error? } so callers can surface WHY it failed
 * instead of silently swallowing both attempts.
 *
 * Pre-v2.3.3 the logic lived inline in 3 places; subtle bugs (Gemini errors
 * eaten silently, no diagnostic logs) caused users to see "Could not
 * transcribe" with zero clue why.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type TranscribeProvider = 'gemini' | 'whisper';

export interface TranscribeResult {
  ok: boolean;
  text: string;
  provider: TranscribeProvider | null;
  error?: string;
  attempts: Array<{ provider: TranscribeProvider; ok: boolean; error?: string }>;
}

export interface TranscribeInput {
  audio: Buffer;
  format?: 'ogg' | 'mp3' | 'wav' | 'm4a' | 'webm';
  /** Hint to Whisper (Gemini auto-detects). Default: 'auto'. */
  lang?: 'auto' | 'ru' | 'en';
  /** Override the Gemini key (otherwise process.env.GEMINI_API_KEY / OPENAI_API_KEY). */
  geminiKey?: string;
  /** Override the Whisper key (otherwise OPENAI_API_KEY). */
  whisperKey?: string;
  /** Override the Whisper endpoint root (defaults to api.openai.com). */
  whisperBaseUrl?: string;
  /** Timeout for each provider attempt (ms). Default 20000. */
  timeoutMs?: number;
  /** Prompt override for Gemini. */
  prompt?: string;
}

/**
 * Transcribe an audio buffer. Tries Gemini multimodal first (cheap + fast),
 * then OpenAI Whisper. Returns the first successful result OR a structured
 * error showing what each provider returned.
 */
export async function transcribeAudio(input: TranscribeInput): Promise<TranscribeResult> {
  const attempts: TranscribeResult['attempts'] = [];
  const audio = input.audio;
  if (!audio || audio.length === 0) {
    return { ok: false, text: '', provider: null, error: 'Empty audio buffer', attempts };
  }
  const fmt = input.format || 'ogg';
  const timeoutMs = input.timeoutMs ?? 20_000;
  const langHint = input.lang === 'ru' ? 'ru' : input.lang === 'en' ? 'en' : 'auto';
  const prompt = input.prompt ||
    'Транскрибируй это голосовое сообщение. Верни ТОЛЬКО текст, без пояснений и кавычек. Сохрани язык оригинала.';

  // ── Attempt 1: Gemini multimodal (audio inline) ──────────────────────────
  const geminiKey = input.geminiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (geminiKey) {
    try {
      const b64 = audio.toString('base64');
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + geminiKey,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'input_audio', input_audio: { data: b64, format: fmt } },
            ],
          }],
          max_tokens: 1024,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (resp.ok) {
        const j = await resp.json() as any;
        const text = j.choices?.[0]?.message?.content?.trim() || '';
        if (text && text.length >= 2) {
          attempts.push({ provider: 'gemini', ok: true });
          return { ok: true, text, provider: 'gemini', attempts };
        }
        attempts.push({ provider: 'gemini', ok: false, error: 'Empty response body' });
      } else {
        let detail = '';
        try { detail = (await resp.text()).slice(0, 200); } catch {}
        attempts.push({ provider: 'gemini', ok: false, error: `HTTP ${resp.status}: ${detail}` });
      }
    } catch (e: any) {
      attempts.push({ provider: 'gemini', ok: false, error: String(e?.message || e).slice(0, 200) });
    }
  } else {
    attempts.push({ provider: 'gemini', ok: false, error: 'No GEMINI_API_KEY / OPENAI_API_KEY available' });
  }

  // ── Attempt 2: OpenAI Whisper API ────────────────────────────────────────
  const whisperKey = input.whisperKey || process.env.OPENAI_API_KEY || '';
  // If OPENAI_API_KEY is actually a Gemini key (AIzaSy…), Whisper will reject.
  const whisperKeyLooksValid = whisperKey && /^sk-/i.test(whisperKey);
  if (whisperKeyLooksValid) {
    try {
      const baseUrl = input.whisperBaseUrl || 'https://api.openai.com';
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(audio)], { type: `audio/${fmt}` }), `voice.${fmt}`);
      formData.append('model', 'whisper-1');
      if (langHint !== 'auto') formData.append('language', langHint);
      const resp = await fetch(baseUrl.replace(/\/v1$/, '') + '/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + whisperKey },
        body: formData as any,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (resp.ok) {
        const j = await resp.json() as any;
        const text = String(j.text || '').trim();
        if (text && text.length >= 2) {
          attempts.push({ provider: 'whisper', ok: true });
          return { ok: true, text, provider: 'whisper', attempts };
        }
        attempts.push({ provider: 'whisper', ok: false, error: 'Empty whisper response' });
      } else {
        let detail = '';
        try { detail = (await resp.text()).slice(0, 200); } catch {}
        attempts.push({ provider: 'whisper', ok: false, error: `HTTP ${resp.status}: ${detail}` });
      }
    } catch (e: any) {
      attempts.push({ provider: 'whisper', ok: false, error: String(e?.message || e).slice(0, 200) });
    }
  } else {
    attempts.push({ provider: 'whisper', ok: false, error: whisperKey ? 'OPENAI_API_KEY is not a real sk- key (likely a Gemini key)' : 'No OPENAI_API_KEY available' });
  }

  // Both attempts failed — return aggregated error
  const errSummary = attempts.map(a => `${a.provider}: ${a.error || 'unknown'}`).join(' | ');
  return { ok: false, text: '', provider: null, error: errSummary, attempts };
}

/** Convenience: download an audio file by URL and transcribe it. */
export async function transcribeAudioFromUrl(
  url: string,
  opts: Omit<TranscribeInput, 'audio' | 'format'> & { format?: TranscribeInput['format'] } = {},
): Promise<TranscribeResult> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) {
      return { ok: false, text: '', provider: null, error: `Fetch failed: HTTP ${resp.status}`, attempts: [] };
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    // Infer format from URL suffix or Content-Type if not provided
    let fmt = opts.format;
    if (!fmt) {
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('ogg')) fmt = 'ogg';
      else if (ct.includes('mpeg') || ct.includes('mp3')) fmt = 'mp3';
      else if (ct.includes('wav')) fmt = 'wav';
      else if (ct.includes('m4a') || ct.includes('mp4')) fmt = 'm4a';
      else if (ct.includes('webm')) fmt = 'webm';
      else fmt = (url.match(/\.(ogg|mp3|wav|m4a|webm)/i)?.[1]?.toLowerCase() as any) || 'ogg';
    }
    return await transcribeAudio({ ...opts, audio: buf, format: fmt });
  } catch (e: any) {
    return { ok: false, text: '', provider: null, error: String(e?.message || e).slice(0, 200), attempts: [] };
  }
}
