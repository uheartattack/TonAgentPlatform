/**
 * Telegram Userbot Service
 *
 * Exposes GramJS MTProto capabilities to agent sandboxes:
 *  - sendMessage   — send as real Telegram user
 *  - getMessages   — read messages from any chat/channel
 *  - getChannelInfo — metadata about a channel/group
 *  - joinChannel   — join a public channel/group
 *  - leaveChannel  — leave a channel/group
 *  - getDialogs    — list of active chats (inbox)
 *  - getMembers    — list of members in a group
 *  - forwardMessage — forward a message
 *  - deleteMessage — delete own message
 *  - searchMessages — search messages in a chat
 *  - getUserInfo   — get info about a user
 *
 * Uses the authenticated GramJS session from fragment-service (shared session).
 * Agents can only use this if the platform owner authenticated via /tglogin.
 */

import { Api } from 'telegram/tl';
import crypto from 'crypto';
import { getFragmentClient } from '../fragment-service';

// ── Security: URL validation to prevent SSRF ──
const BLOCKED_URL_PATTERNS = [
  /^https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)/i,
  /^https?:\/\/169\.254\.\d+\.\d+/i,  // AWS metadata
  /^https?:\/\/\[?::1\]?/i,           // IPv6 loopback
  /^file:/i,                           // File protocol
  /^ftp:/i,                            // FTP
];

function validateExternalUrl(url: string): void {
  if (!url || typeof url !== 'string') throw new Error('URL is required');
  if (!/^https?:\/\//i.test(url)) throw new Error('Only HTTP(S) URLs allowed');
  for (const pat of BLOCKED_URL_PATTERNS) {
    if (pat.test(url)) throw new Error('URL points to internal/restricted network');
  }
}

// ── Security: max download size (10MB) ──
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

async function safeFetchBuffer(url: string, timeoutMs = 15000): Promise<Buffer> {
  validateExternalUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetch = (globalThis as any).fetch || (() => { try { return require('node-fetch'); } catch { throw new Error('No fetch implementation available (globalThis.fetch missing and node-fetch not installed)'); } })();
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      throw new Error(`File too large: ${contentLength} bytes (max ${MAX_DOWNLOAD_BYTES})`);
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > MAX_DOWNLOAD_BYTES) {
      throw new Error(`Downloaded file too large: ${buffer.length} bytes (max ${MAX_DOWNLOAD_BYTES})`);
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

// ── Utility: safe random ID (non-zero, full 64-bit range) ──
function safeRandomId(): any {
  const buf = crypto.randomBytes(8);
  // Ensure non-zero by setting the top bit
  buf[0] = buf[0] | 0x01;
  return BigInt('0x' + buf.toString('hex'));
}

type TgMsg = {
  id:     number;
  text:   string;
  date:   number;
  from?:  string;
  fromId?: number;
};

type TgDialog = {
  id:     string;
  title:  string;
  type:   string;
  unread: number;
};

/** Send a text message as the authenticated Telegram user (with Markdown→HTML formatting) */
export async function tgSendMessage(chatId: string | number, text: string): Promise<number> {
  const client = await getFragmentClient();
  // Convert markdown to HTML for Telegram formatting
  const html = mdToHtmlSimple(text);
  try {
    const result = await (client as any).sendMessage(chatId, { message: html, parseMode: 'html' }) as any;
    return result?.id ?? 0;
  } catch (e: any) {
    console.warn(`[tgSendMessage] HTML parse failed, falling back to plain text: ${e.message?.slice(0, 100)}`);
    const result = await (client as any).sendMessage(chatId, { message: text }) as any;
    return result?.id ?? 0;
  }
}

function mdToHtmlSimple(text: string): string {
  if (/<[a-z][^>]*>/i.test(text)) {
    return text.replace(/<(?!\/?(?:b|i|s|u|code|pre|a|tg-spoiler)[\s>\/])[^>]+>/gi, '').trim();
  }
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
      // Security: block javascript: and data: URLs in links
      if (/^(javascript|data|vbscript):/i.test(url.trim())) return text;
      // Escape & and " in URL to prevent attribute injection
      const safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<a href="${safeUrl}">${text}</a>`;
    })
    .trim();
}

/** Get latest messages from a chat/channel */
export async function tgGetMessages(chatId: string | number, limit = 20): Promise<TgMsg[]> {
  const client = await getFragmentClient();
  const msgs = await (client as any).getMessages(chatId, { limit }) as any[];
  return msgs.map((m: any) => ({
    id:     m.id,
    text:   m.message || '',
    date:   m.date,
    from:   m.sender?.username || m.sender?.firstName || '',
    fromId: m.senderId?.toJSNumber?.() ?? m.senderId,
  }));
}

/** Get channel/group info */
export async function tgGetChannelInfo(chatId: string | number): Promise<{
  id: string; title: string; username?: string; membersCount?: number; description?: string;
}> {
  const client = await getFragmentClient();
  const entity = await (client as any).getEntity(chatId) as any;
  return {
    id:           String(entity.id),
    title:        entity.title || entity.firstName || String(chatId),
    username:     entity.username,
    membersCount: entity.participantsCount,
    description:  entity.about,
  };
}

/** Join a public channel/group by username or invite link */
export async function tgJoinChannel(channelUsername: string): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).invoke(new Api.channels.JoinChannel({
    channel: await (client as any).getEntity(channelUsername),
  }));
}

/** Leave a channel/group */
export async function tgLeaveChannel(channelUsername: string | number): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).invoke(new Api.channels.LeaveChannel({
    channel: await (client as any).getEntity(channelUsername),
  }));
}

/** Get list of dialogs (active chats) */
export async function tgGetDialogs(limit = 20): Promise<TgDialog[]> {
  const client = await getFragmentClient();
  const dialogs = await (client as any).getDialogs({ limit }) as any[];
  return dialogs.map((d: any) => ({
    id:     String(d.id),
    title:  d.title || d.name || String(d.id),
    type:   d.isChannel ? 'channel' : d.isGroup ? 'group' : 'user',
    unread: d.unreadCount || 0,
  }));
}

/** Get group/channel members */
export async function tgGetMembers(chatId: string | number, limit = 50): Promise<{
  id: number; username?: string; name: string;
}[]> {
  const client = await getFragmentClient();
  const participants = await (client as any).getParticipants(chatId, { limit }) as any[];
  return participants.map((p: any) => ({
    id:       p.id?.toJSNumber?.() ?? Number(p.id),
    username: p.username,
    name:     [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username || String(p.id),
  }));
}

/** Forward a message from one chat to another */
export async function tgForwardMessage(fromChatId: string | number, messageId: number, toChatId: string | number): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).forwardMessages(toChatId, {
    messages: [messageId],
    fromPeer: fromChatId,
  });
}

/** Delete own message */
export async function tgDeleteMessage(chatId: string | number, messageId: number): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).deleteMessages(chatId, [messageId], { revoke: true });
}

/** Search messages in a chat */
export async function tgSearchMessages(chatId: string | number, query: string, limit = 20): Promise<TgMsg[]> {
  const client = await getFragmentClient();
  const msgs = await (client as any).getMessages(chatId, { limit, search: query }) as any[];
  return msgs.map((m: any) => ({
    id:     m.id,
    text:   m.message || '',
    date:   m.date,
    from:   m.sender?.username || m.sender?.firstName || '',
    fromId: m.senderId?.toJSNumber?.() ?? m.senderId,
  }));
}

/** Get info about a Telegram user by username or ID */
export async function tgGetUserInfo(userIdentifier: string | number): Promise<{
  id: number; username?: string; firstName?: string; lastName?: string; bio?: string; phone?: string;
}> {
  const client = await getFragmentClient();
  const entity = await (client as any).getEntity(userIdentifier) as any;
  return {
    id:        entity.id?.toJSNumber?.() ?? Number(entity.id),
    username:  entity.username,
    firstName: entity.firstName,
    lastName:  entity.lastName,
    bio:       entity.about,
    phone:     entity.phone ? `***${(entity.phone || '').slice(-4)}` : undefined, // Redacted for privacy
  };
}

/** Send a file/media message (URL only — no local filesystem paths) */
export async function tgSendFile(chatId: string | number, filePath: string, caption?: string): Promise<number> {
  // Security: only allow HTTP(S) URLs, block local filesystem paths
  if (/^(data|javascript):/i.test(filePath)) {
    throw new Error('data: and javascript: URIs are not allowed.');
  } else if (/^https?:\/\//i.test(filePath)) {
    validateExternalUrl(filePath);
  } else if (/^[\/\\]|^[a-zA-Z]:\\/.test(filePath)) {
    throw new Error('Local filesystem paths are not allowed. Use an HTTP(S) URL.');
  }
  const client = await getFragmentClient();
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(filePath); // SVG removed — Telegram doesn't support inline SVG
  const result = await (client as any).sendFile(chatId, {
    file: filePath,
    caption,
    forceDocument: !isImage,
  }) as any;
  return result?.id ?? 0;
}

/** Reply to a specific message in a chat, optionally with a quote */
export async function tgReplyMessage(chatId: string | number, replyToMsgId: number, text: string, quoteText?: string): Promise<number> {
  const client = await getFragmentClient();
  const html = mdToHtmlSimple(text);
  let replyTo: any = replyToMsgId;
  if (quoteText) {
    try {
      const peer = await (client as any).getInputEntity(chatId);
      replyTo = new Api.InputReplyToMessage({ replyToMsgId, quoteText, replyToPeerId: peer });
    } catch (e: any) { console.warn(`[tgReplyMessage] Quote setup failed: ${e.message?.slice(0, 100)}`); replyTo = replyToMsgId; }
  }
  try {
    const result = await (client as any).sendMessage(chatId, { message: html, parseMode: 'html', replyTo }) as any;
    return result?.id ?? 0;
  } catch (e: any) {
    console.warn(`[tgReplyMessage] HTML send failed, falling back to plain text: ${e.message?.slice(0, 100)}`);
    const result = await (client as any).sendMessage(chatId, { message: text, replyTo }) as any;
    return result?.id ?? 0;
  }
}

/** Send reaction (emoji) to a message */
export async function tgReactMessage(chatId: string | number, messageId: number, emoji: string): Promise<void> {
  const client = await getFragmentClient();
  const peer = await (client as any).getInputEntity(chatId);
  await (client as any).invoke(new Api.messages.SendReaction({
    peer,
    msgId: messageId,
    reaction: [new Api.ReactionEmoji({ emoticon: emoji })],
  }));
}

/** Edit own message */
export async function tgEditMessage(chatId: string | number, messageId: number, newText: string): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).editMessage(chatId, { message: messageId, text: newText });
}

/** Pin a message in a chat */
export async function tgPinMessage(chatId: string | number, messageId: number, silent = true): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).pinMessage(chatId, messageId, { notify: !silent });
}

/** Mark messages in a chat as read */
export async function tgMarkRead(chatId: string | number): Promise<void> {
  const client = await getFragmentClient();
  await (client as any).markAsRead(chatId);
}

/** Get discussion/comments for a channel post */
export async function tgGetComments(chatId: string | number, postMsgId: number, limit = 30): Promise<TgMsg[]> {
  const client = await getFragmentClient();
  try {
    const peer = await (client as any).getInputEntity(chatId);
    const result = await (client as any).invoke(new Api.messages.GetReplies({
      peer,
      msgId: postMsgId,
      offsetId: 0,
      offsetDate: 0,
      addOffset: 0,
      limit,
      maxId: 0,
      minId: 0,
      hash: 0 as any,
    })) as any;
    return (result.messages || []).map((m: any) => ({
      id:     m.id,
      text:   m.message || '',
      date:   m.date,
      from:   '',
      fromId: m.fromId?.userId?.toJSNumber?.() ?? m.fromId?.userId ?? 0,
    }));
  } catch (e: any) {
    console.warn(`[tgGetComments] Failed to get comments: ${e.message?.slice(0, 100)}`);
    return [];
  }
}

/** Set "typing" status in a chat for a given duration */
export async function tgSetTyping(chatId: string | number, seconds = 3): Promise<void> {
  const client = await getFragmentClient();
  const peer = await (client as any).getInputEntity(chatId);
  // Typing indicator auto-expires after ~5s, so re-send every 4s for longer durations
  const clampedSec = Math.min(Math.max(seconds, 1), 30); // Clamp 1-30s
  const iterations = Math.ceil(clampedSec / 4);
  for (let i = 0; i < iterations; i++) {
    await (client as any).invoke(new Api.messages.SetTyping({
      peer,
      action: new Api.SendMessageTypingAction(),
    }));
    if (i < iterations - 1) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

/** Send message with HTML formatting */
export async function tgSendFormatted(chatId: string | number, html: string, replyTo?: number): Promise<number> {
  const client = await getFragmentClient();
  const result = await (client as any).sendMessage(chatId, {
    message: html,
    parseMode: 'html',
    replyTo: replyTo || undefined,
  }) as any;
  return result?.id ?? 0;
}

/** Get specific message by ID */
export async function tgGetMessageById(chatId: string | number, messageId: number): Promise<TgMsg | null> {
  const client = await getFragmentClient();
  try {
    const msgs = await (client as any).getMessages(chatId, { ids: [messageId] }) as any[];
    if (msgs.length === 0) return null;
    const m = msgs[0];
    return {
      id:     m.id,
      text:   m.message || '',
      date:   m.date,
      from:   m.sender?.username || m.sender?.firstName || '',
      fromId: m.senderId?.toJSNumber?.() ?? m.senderId,
    };
  } catch (e: any) {
    console.warn(`[tgGetMessageById] Failed to get message: ${e.message?.slice(0, 100)}`);
    return null;
  }
}

/** Get unread dialogs with messages */
export async function tgGetUnread(limit = 10): Promise<{ chatId: string; title: string; unread: number; lastMessage: string }[]> {
  const client = await getFragmentClient();
  const dialogs = await (client as any).getDialogs({ limit: 50 }) as any[];
  return dialogs
    .filter((d: any) => (d.unreadCount || 0) > 0)
    .slice(0, limit)
    .map((d: any) => ({
      chatId: String(d.id),
      title: d.title || d.name || String(d.id),
      unread: d.unreadCount || 0,
      lastMessage: d.message?.message?.slice(0, 200) || '',
    }));
}

/**
 * Build a sandbox-safe userbot object for agent execution.
 * Only exposed if user is authenticated via /tglogin.
 */
export function buildUserbotSandbox() {
  return {
    sendMessage:    tgSendMessage,
    getMessages:    tgGetMessages,
    getChannelInfo: tgGetChannelInfo,
    joinChannel:    tgJoinChannel,
    leaveChannel:   tgLeaveChannel,
    getDialogs:     tgGetDialogs,
    getMembers:     tgGetMembers,
    forwardMessage: tgForwardMessage,
    deleteMessage:  tgDeleteMessage,
    searchMessages: tgSearchMessages,
    getUserInfo:    tgGetUserInfo,
    sendFile:       tgSendFile,
    replyMessage:   tgReplyMessage,
    reactMessage:   tgReactMessage,
    editMessage:    tgEditMessage,
    pinMessage:     tgPinMessage,
    markRead:       tgMarkRead,
    getComments:    tgGetComments,
    setTyping:      tgSetTyping,
    sendFormatted:  tgSendFormatted,
    getMessageById: tgGetMessageById,
    getUnread:      tgGetUnread,
    // Profile management
    setAvatar:      tgSetAvatar,
    setBio:         tgSetBio,
    setName:        tgSetName,
    getMyProfile:   tgGetMyProfile,
    deleteAvatar:   tgDeleteAvatar,
    // Gift operations
    sendGift:       tgSendGift,
    getReceivedGifts: tgGetReceivedGifts,
    // Enhanced media
    sendPhoto:      tgSendPhoto,
    sendVoice:      tgSendVoice,
    createPoll:     tgCreatePoll,
    scheduleMessage: tgScheduleMessage,
    getAdmins:      tgGetAdmins,
  };
}

// ═══════════════════════════════════════════════
// ═══ PROFILE MANAGEMENT ═══════════════════════
// ═══════════════════════════════════════════════

/** Change the authenticated user's profile photo from a URL */
export async function tgSetAvatar(photoUrl: string): Promise<{ ok: boolean }> {
  const client = await getFragmentClient();
  // Download image with SSRF protection and size limit
  const buffer = await safeFetchBuffer(photoUrl, 20000);

  // Upload photo via MTProto
  const uploadResult = await (client as any).uploadFile({
    file: buffer,
    fileName: 'avatar.jpg',
    workers: 1,
  });
  await (client as any).invoke(new Api.photos.UploadProfilePhoto({
    file: uploadResult,
  }));
  return { ok: true };
}

/** Delete the current profile photo */
export async function tgDeleteAvatar(): Promise<{ ok: boolean }> {
  const client = await getFragmentClient();
  // Get current photos and delete the first one
  const photos = await (client as any).invoke(new Api.photos.GetUserPhotos({
    userId: new Api.InputUserSelf(),
    offset: 0,
    maxId: 0 as any,
    limit: 1,
  })) as any;
  if (photos.photos && photos.photos.length > 0) {
    const photo = photos.photos[0];
    await (client as any).invoke(new Api.photos.DeletePhotos({
      id: [new Api.InputPhoto({ id: photo.id, accessHash: photo.accessHash, fileReference: photo.fileReference })],
    }));
  }
  return { ok: true };
}

/** Update profile bio (about) */
export async function tgSetBio(about: string): Promise<{ ok: boolean }> {
  const client = await getFragmentClient();
  await (client as any).invoke(new Api.account.UpdateProfile({ about: about.slice(0, 70) }));
  return { ok: true };
}

/** Update profile first and last name */
export async function tgSetName(firstName: string, lastName?: string): Promise<{ ok: boolean }> {
  const client = await getFragmentClient();
  const params: any = { firstName: firstName.slice(0, 64) };
  if (lastName !== undefined) params.lastName = lastName.slice(0, 64);
  await (client as any).invoke(new Api.account.UpdateProfile(params));
  return { ok: true };
}

/** Get own profile info */
export async function tgGetMyProfile(): Promise<{ firstName: string; lastName: string; bio: string; username: string; phone: string }> {
  const client = await getFragmentClient();
  const me = await (client as any).getMe() as any;
  // Get full user for bio
  let bio = '';
  try {
    const full = await (client as any).invoke(new Api.users.GetFullUser({
      id: new Api.InputUserSelf(),
    })) as any;
    bio = full?.fullUser?.about || '';
  } catch (e: any) { console.warn(`[tgGetMyProfile] Failed to get bio: ${e.message?.slice(0, 100)}`); }
  return {
    firstName: me.firstName || '',
    lastName: me.lastName || '',
    bio,
    username: me.username || '',
    phone: me.phone || '',
  };
}

// ═══════════════════════════════════════════════
// ═══ GIFT OPERATIONS ══════════════════════════
// ═══════════════════════════════════════════════

/** Send a star gift to a user (3-step payment flow) */
export async function tgSendGift(userId: string | number, giftId: number | string, message?: string): Promise<{ ok: boolean; error?: string }> {
  // Validate giftId before BigInt conversion
  let giftIdBig: bigint;
  try {
    giftIdBig = BigInt(giftId);
    if (giftIdBig <= BigInt(0)) throw new Error('Gift ID must be positive');
  } catch (e: any) {
    return { ok: false, error: `Invalid gift ID "${giftId}": ${e.message}` };
  }

  const client = await getFragmentClient();
  let userPeer: any;
  try {
    userPeer = await (client as any).getInputEntity(userId);
  } catch (e: any) {
    return { ok: false, error: `User not found: ${e.message}` };
  }

  try {
    // Step 1: Build invoice
    const invoice = new (Api as any).InputInvoiceStarGift({
      userId: userPeer,
      giftId: giftIdBig,
      ...(message ? { message: new Api.TextWithEntities({ text: message, entities: [] }) } : {}),
    });

    // Step 2: Get payment form
    const form = await (client as any).invoke(
      new (Api as any).payments.GetPaymentForm({ invoice })
    ) as any;

    if (!form?.formId) {
      return { ok: false, error: 'Failed to get payment form (no formId)' };
    }

    // Step 3: Send payment
    await (client as any).invoke(
      new (Api as any).payments.SendStarsForm({
        formId: form.formId,
        invoice,
      })
    );

    return { ok: true };
  } catch (e: any) {
    const msg = e.message || String(e);
    // Detect specific Telegram errors
    if (/BALANCE_TOO_LOW|not enough/i.test(msg)) {
      return { ok: false, error: 'Insufficient star balance to send this gift' };
    }
    if (/GIFT_SOLD_OUT/i.test(msg)) {
      return { ok: false, error: 'This gift is sold out' };
    }
    return { ok: false, error: `Gift payment failed: ${msg.slice(0, 200)}` };
  }
}

/** Get received star gifts */
export async function tgGetReceivedGifts(userId?: string | number, limit = 20): Promise<any[]> {
  const client = await getFragmentClient();
  try {
    const peer = userId ? await (client as any).getInputEntity(userId) : new Api.InputUserSelf();
    const result = await (client as any).invoke(new (Api as any).payments.GetUserStarGifts({
      userId: peer,
      offset: '',
      limit,
    })) as any;
    return (result?.gifts || []).map((g: any) => ({
      id: g.gift?.id?.toString() || '',
      from: g.fromId?.toString() || 'anonymous',
      date: g.date,
      message: g.message?.text || '',
      stars: g.gift?.stars?.toJSNumber?.() || g.gift?.stars || 0,
      limited: g.gift?.limited || false,
      soldOut: g.gift?.soldOut || false,
      name: g.gift?.title || '',
    }));
  } catch (e: any) {
    console.warn(`[tgGetReceivedGifts] API error: ${e.message?.slice(0, 100)}`);
    return []; // Return empty array on error — callers expect consistent shape
  }
}

// ═══════════════════════════════════════════════
// ═══ ENHANCED MEDIA ═══════════════════════════
// ═══════════════════════════════════════════════

/** Send a photo from URL as a proper Telegram photo (not document).
 * Uses InputMediaPhotoExternal → Telegram server downloads the URL.
 * Fallback: download manually → InputMediaUploadedPhoto. */
export async function tgSendPhoto(chatId: string | number, photoUrl: string, caption?: string): Promise<number> {
  // Validate URL upfront to fail fast
  validateExternalUrl(photoUrl);

  const client = await getFragmentClient();
  const peer = await (client as any).getInputEntity(chatId);

  // Method 1: InputMediaPhotoExternal — Telegram downloads the URL directly
  try {
    const result = await (client as any).invoke(new Api.messages.SendMedia({
      peer,
      media: new Api.InputMediaPhotoExternal({ url: photoUrl }),
      message: caption || '',
      randomId: safeRandomId(),
    })) as any;
    // Extract message ID from updates (prefer UpdateNewMessage, fall back to any update with id)
    const msgId = result?.updates?.find((u: any) => u.className === 'UpdateNewMessage')?.message?.id
      ?? result?.updates?.find((u: any) => u.id)?.id ?? 0;
    return msgId;
  } catch (e1: any) {
    console.log(`[tgSendPhoto] InputMediaPhotoExternal failed: ${e1.message?.slice(0, 80)}, trying upload...`);
  }

  // Method 2: Download + upload as InputMediaUploadedPhoto
  try {
    const buffer = await safeFetchBuffer(photoUrl, 20000);
    const uploaded = await (client as any).uploadFile({
      file: buffer,
      fileName: 'photo.jpg',
      workers: 1,
    });
    const result = await (client as any).invoke(new Api.messages.SendMedia({
      peer,
      media: new Api.InputMediaUploadedPhoto({ file: uploaded }),
      message: caption || '',
      randomId: safeRandomId(),
    })) as any;
    const msgId = result?.updates?.find((u: any) => u.className === 'UpdateNewMessage')?.message?.id
      ?? result?.updates?.find((u: any) => u.id)?.id ?? 0;
    return msgId;
  } catch (e2: any) {
    console.log(`[tgSendPhoto] Upload also failed: ${e2.message?.slice(0, 80)}, falling back to sendFile`);
  }

  // Method 3: GramJS sendFile fallback
  const result = await (client as any).sendFile(chatId, {
    file: photoUrl,
    caption,
    forceDocument: false,
  }) as any;
  return result?.id ?? 0;
}

/** Send a voice message (text-to-speech) */
export async function tgSendVoice(chatId: string | number, text: string): Promise<number> {
  const client = await getFragmentClient();
  // Detect language for TTS from text content
  const lang = /[а-яёА-ЯЁ]/.test(text) ? 'ru' : 'en';
  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
    const buffer = await safeFetchBuffer(ttsUrl, 10000);
    const result = await (client as any).sendFile(chatId, {
      file: buffer,
      voiceNote: true,
      attributes: [new Api.DocumentAttributeAudio({ voice: true, duration: Math.ceil(text.length / 15) })],
    }) as any;
    return result?.id ?? 0;
  } catch (e: any) {
    console.warn(`[tgSendVoice] TTS failed: ${e.message?.slice(0, 100)}, sending as text`);
  }
  // Fallback: send as text with 🎤 prefix
  return tgSendMessage(chatId, '🎤 ' + text);
}

/** Create a poll in a chat */
export async function tgCreatePoll(chatId: string | number, question: string, options: string[]): Promise<number> {
  const client = await getFragmentClient();
  const poll = new Api.InputMediaPoll({
    poll: new Api.Poll({
      id: safeRandomId(),
      question: new Api.TextWithEntities({ text: question, entities: [] }),
      answers: options.slice(0, 10).map((opt, i) => new Api.PollAnswer({
        text: new Api.TextWithEntities({ text: opt.slice(0, 100), entities: [] }),
        option: Buffer.from([i]),
      })),
    }),
  });
  const peer = await (client as any).getInputEntity(chatId);
  const result = await (client as any).invoke(new Api.messages.SendMedia({
    peer,
    media: poll,
    message: '',
    randomId: safeRandomId(),
  })) as any;
  return result?.updates?.find((u: any) => u.className === 'UpdateNewMessage')?.message?.id
    ?? result?.updates?.[0]?.id ?? 0;
}

/** Schedule a message for later. timestamp can be in seconds (Unix) or milliseconds (JS Date). */
export async function tgScheduleMessage(chatId: string | number, text: string, timestamp: number): Promise<number> {
  const client = await getFragmentClient();
  const peer = await (client as any).getInputEntity(chatId);
  // Auto-detect: if timestamp > 1e12 it's in ms, otherwise seconds
  const scheduleSec = timestamp > 1e12 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (scheduleSec <= now) throw new Error('Schedule date must be in the future');
  if (scheduleSec > now + 365 * 86400) throw new Error('Schedule date too far in the future (max 1 year)');
  const result = await (client as any).invoke(new Api.messages.SendMessage({
    peer,
    message: text,
    randomId: safeRandomId(),
    scheduleDate: scheduleSec,
  })) as any;
  return result?.updates?.find((u: any) => u.className === 'UpdateNewMessage')?.message?.id
    ?? result?.updates?.[0]?.id ?? 0;
}

/** Get admins of a chat */
export async function tgGetAdmins(chatId: string | number): Promise<Array<{ id: number; name: string; role: string }>> {
  const client = await getFragmentClient();
  try {
    const peer = await (client as any).getInputEntity(chatId);
    const result = await (client as any).invoke(new Api.channels.GetParticipants({
      channel: peer,
      filter: new Api.ChannelParticipantsAdmins(),
      offset: 0,
      limit: 50,
      hash: 0 as any,
    })) as any;
    return (result.participants || []).map((p: any) => {
      const user = (result.users || []).find((u: any) => u.id?.toJSNumber?.() === p.userId?.toJSNumber?.() || u.id === p.userId);
      return {
        id: p.userId?.toJSNumber?.() || p.userId || 0,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown',
        role: p.className || 'admin',
      };
    });
  } catch (e: any) {
    console.warn(`[tgGetAdmins] Failed to get admins: ${e.message?.slice(0, 100)}`);
    return [];
  }
}
