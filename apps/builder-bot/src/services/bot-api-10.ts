/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BOT API 10.0 / 9.6 / 9.5 / 9.4 wrappers
 *
 * Thin helpers around the new endpoints introduced May 2026 (Bot API 10.0)
 * and previous spring '26 updates. Bot API is HTTP-based so we just POST
 * to api.telegram.org/bot<token>/<method>.
 *
 * Auth: process.env.BOT_TOKEN (single source of truth — same token Telegraf
 * uses). Each helper returns { ok, ... } and never throws on Telegram-side
 * errors — they're returned in `error` so agents can recover.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TG_API = 'https://api.telegram.org';

function token(): string | null { return process.env.BOT_TOKEN || null; }

async function tgCall(method: string, body: any): Promise<{ ok: boolean; result?: any; error?: string }> {
  const tok = token();
  if (!tok) return { ok: false, error: 'BOT_TOKEN not configured' };
  try {
    const r = await fetch(`${TG_API}/bot${tok}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await r.json() as any;
    if (!r.ok || !j.ok) return { ok: false, error: j.description || `HTTP ${r.status}` };
    return { ok: true, result: j.result };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── Bot API 10.0: Live Photos ───────────────────────────────────────────
export async function sendLivePhoto(chatId: string | number, photoUrl: string, videoUrl: string, caption?: string) {
  return await tgCall('sendLivePhoto', {
    chat_id: chatId,
    photo: photoUrl,
    video: videoUrl,
    caption,
  });
}

// ── Bot API 10.0: Reaction management ───────────────────────────────────
export async function deleteMessageReaction(chatId: string | number, messageId: number, userId?: number) {
  return await tgCall('deleteMessageReaction', {
    chat_id: chatId,
    message_id: messageId,
    user_id: userId, // omit to delete all of bot's own reactions on this msg
  });
}

export async function deleteAllMessageReactions(chatId: string | number, messageId: number) {
  return await tgCall('deleteAllMessageReactions', {
    chat_id: chatId,
    message_id: messageId,
  });
}

// ── Bot API 10.0: Bot-to-bot messaging ──────────────────────────────────
export async function sendMessageToBot(botUsername: string, text: string) {
  // Bot-to-bot uses sendMessage with @username as chat_id
  const id = botUsername.startsWith('@') ? botUsername : `@${botUsername}`;
  return await tgCall('sendMessage', { chat_id: id, text });
}

// ── Bot API 9.4: Profile photo management ──────────────────────────────
export async function setMyProfilePhoto(photoUrl: string) {
  return await tgCall('setMyProfilePhoto', { photo: photoUrl });
}

export async function removeMyProfilePhoto() {
  return await tgCall('removeMyProfilePhoto', {});
}

// ── Bot API 9.4: User profile audios ───────────────────────────────────
export async function getUserProfileAudios(userId: number, offset?: number, limit?: number) {
  return await tgCall('getUserProfileAudios', {
    user_id: userId,
    offset: offset || 0,
    limit: Math.min(100, Math.max(1, limit || 20)),
  });
}

// ── Bot API 9.5: Chat member tags ──────────────────────────────────────
export async function setChatMemberTag(chatId: string | number, userId: number, tag: string) {
  return await tgCall('setChatMemberTag', {
    chat_id: chatId,
    user_id: userId,
    tag: String(tag).slice(0, 40),
  });
}

// ── Live location (existed in Bot API for a while, never exposed as a tool here) ──
export async function sendLiveLocation(
  chatId: string | number, lat: number, lng: number, livePeriod: number,
  opts?: { heading?: number; horizontal_accuracy?: number; proximity_alert_radius?: number },
) {
  const body: any = {
    chat_id: chatId,
    latitude: lat,
    longitude: lng,
    live_period: Math.min(86400, Math.max(60, livePeriod)),
  };
  if (opts?.heading) body.heading = Math.min(360, Math.max(1, opts.heading));
  if (opts?.horizontal_accuracy) body.horizontal_accuracy = Math.min(1500, Math.max(0, opts.horizontal_accuracy));
  if (opts?.proximity_alert_radius) body.proximity_alert_radius = opts.proximity_alert_radius;
  return await tgCall('sendLocation', body);
}

// ── Bot API 9.6 / 10.0: Advanced polls + quizzes ───────────────────────
export interface SendPollV2Input {
  chat_id: string | number;
  question: string;
  options: string[];
  is_anonymous?: boolean;
  allows_multiple_answers?: boolean;
  // v9.6
  description?: string;
  allows_revoting?: boolean;
  shuffle_options?: boolean;
  hide_results_until_closes?: boolean;
  allow_adding_options?: boolean;
  // v10.0
  members_only?: boolean;
  country_codes?: string[];
  // v9.6 quizzes
  type?: 'regular' | 'quiz';
  correct_option_ids?: number[];   // multiple correct answers
  explanation?: string;
  // Auto-close
  open_period?: number;
}
export async function sendPollV2(input: SendPollV2Input) {
  const body: any = {
    chat_id: input.chat_id,
    question: String(input.question).slice(0, 300),
    options: (input.options || []).slice(0, 12).map(o => String(o).slice(0, 200)),
    is_anonymous: input.is_anonymous !== false,
    allows_multiple_answers: !!input.allows_multiple_answers,
  };
  if (input.description) body.description = String(input.description).slice(0, 400);
  if (input.allows_revoting) body.allows_revoting = true;
  if (input.shuffle_options) body.shuffle_options = true;
  if (input.hide_results_until_closes) body.hide_results_until_closes = true;
  if (input.allow_adding_options) body.allow_adding_options = true;
  if (input.members_only) body.members_only = true;
  if (input.country_codes && input.country_codes.length > 0) body.country_codes = input.country_codes;
  if (input.type === 'quiz') {
    body.type = 'quiz';
    if (input.correct_option_ids) body.correct_option_ids = input.correct_option_ids;
    if (input.explanation) body.explanation = String(input.explanation).slice(0, 600);
  }
  if (input.open_period) body.open_period = Math.min(2_628_000, Math.max(5, input.open_period));
  return await tgCall('sendPoll', body);
}
