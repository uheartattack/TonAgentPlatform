/**
 * gramjs-utils.ts — Full Telethon-style utilities for GramJS
 *
 * Port of Python Telethon's utils.py, helpers.py, and extensions:
 *   - Safe BigInt ↔ Number conversions
 *   - Peer ID parsing (get_peer_id, resolve_id)
 *   - InputPeer/InputUser/InputChannel builders (get_input_peer)
 *   - Entity display names (get_display_name)
 *   - Username/phone/invite link parsing (parse_username, parse_phone)
 *   - Media type detection (is_image, is_audio, is_video, get_extension)
 *   - Message utilities (get_message_id, get_reply_to)
 *   - Markdown → Telegram HTML conversion
 *   - File utilities
 *
 * GramJS returns BigInt objects that can overflow JS Number.MAX_SAFE_INTEGER.
 * This module provides safe conversion utilities used across the platform.
 */

// ── Safe BigInt → number conversion ────────────────────────────────────────

/** Convert any GramJS BigInt/bigint/number/object to a safe JS number. Returns 0 on overflow. */
export function safeNumber(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return Number.isSafeInteger(val) ? val : 0;
  if (typeof val === 'bigint') {
    // BigInt fits in safe integer range?
    if (val >= BigInt(-Number.MAX_SAFE_INTEGER) && val <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(val);
    }
    return 0;
  }
  // GramJS BigInteger object with toJSNumber()
  if (typeof val === 'object') {
    if (typeof val.toJSNumber === 'function') {
      const n = val.toJSNumber();
      return Number.isSafeInteger(n) ? n : 0;
    }
    if (typeof val.toString === 'function') {
      const s = val.toString();
      const n = parseInt(s, 10);
      return Number.isSafeInteger(n) ? n : 0;
    }
  }
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return Number.isSafeInteger(n) ? n : 0;
  }
  return 0;
}

// ── Peer type detection (Telethon-style) ──────────────────────────────────

export type PeerType = 'user' | 'chat' | 'channel' | 'unknown';

export interface ResolvedPeer {
  id: number;        // canonical Telethon-format ID
  rawId: number;     // raw positive ID (without -100 prefix)
  type: PeerType;
}

/**
 * Extract sender ID from a GramJS message.
 * Equivalent to Telethon's message.sender_id.
 */
export function getSenderId(msg: any): number {
  if (!msg) return 0;
  // msg.senderId is the primary source (GramJS sets this)
  const raw = msg.senderId ?? msg.fromId?.userId ?? msg._senderId ?? 0;
  return safeNumber(raw);
}

/**
 * Get canonical chat ID from a GramJS message (Telethon-style).
 *
 * Telethon format:
 *   User DM    → positive user_id
 *   Group chat → negative -chat_id
 *   Channel    → -100 + channel_id (e.g., channel 1234 → -1001234)
 *   Supergroup → same as channel (-100 prefix)
 */
export function getChatId(msg: any): string {
  if (!msg) return '0';

  // Direct chatId from GramJS (already negative for groups/channels)
  if (msg.chatId != null) {
    const n = safeNumber(msg.chatId);
    if (n !== 0) return String(n);
  }

  // Parse from peerId object (Telethon's get_peer_id equivalent)
  const peer = msg.peerId || msg.peer;
  if (peer) {
    return String(peerToId(peer));
  }

  return '0';
}

/**
 * Convert a GramJS Peer/InputPeer object to a Telethon-style numeric ID.
 *
 * PeerUser       → user_id (positive)
 * PeerChat       → -chat_id
 * PeerChannel    → -(1000000000000 + channel_id)
 */
export function peerToId(peer: any): number {
  if (!peer) return 0;

  const className = peer.className || peer.constructor?.name || '';

  // PeerUser / InputPeerUser
  if (className.includes('PeerUser') || peer.userId != null) {
    return safeNumber(peer.userId);
  }

  // PeerChat / InputPeerChat (regular group)
  if (className.includes('PeerChat') || (peer.chatId != null && !peer.channelId)) {
    const id = safeNumber(peer.chatId);
    return id > 0 ? -id : id;
  }

  // PeerChannel / InputPeerChannel (channel/supergroup)
  if (className.includes('PeerChannel') || className.includes('Channel') || peer.channelId != null) {
    const id = safeNumber(peer.channelId);
    if (id > 0) return -(1000000000000 + id);  // -100 prefix in Telethon
    return id;
  }

  // Fallback: try all fields
  if (peer.userId) return safeNumber(peer.userId);
  if (peer.channelId) {
    const id = safeNumber(peer.channelId);
    return id > 0 ? -(1000000000000 + id) : id;
  }
  if (peer.chatId) {
    const id = safeNumber(peer.chatId);
    return id > 0 ? -id : id;
  }

  return 0;
}

/**
 * Resolve a Telethon-style ID back to (rawId, type).
 * Inverse of peerToId().
 *
 * Equivalent to Telethon's utils.resolve_id().
 */
export function resolveId(peerId: number): ResolvedPeer {
  if (peerId > 0) {
    return { id: peerId, rawId: peerId, type: 'user' };
  }
  const absId = Math.abs(peerId);
  if (absId > 1000000000000) {
    // Channel/supergroup: -100 prefix
    const rawId = absId - 1000000000000;
    return { id: peerId, rawId, type: 'channel' };
  }
  // Regular group chat
  return { id: peerId, rawId: absId, type: 'chat' };
}

/**
 * Check if a message is from a group/supergroup/channel.
 */
export function isGroupMessage(msg: any): boolean {
  if (!msg) return false;
  // GramJS post flag → channel
  if (msg.post === true) return false; // channel post, not group
  const peer = msg.peerId || msg.peer;
  if (!peer) {
    // Fallback: negative chatId
    const chatId = safeNumber(msg.chatId);
    return chatId < 0;
  }
  const className = peer.className || peer.constructor?.name || '';
  return className.includes('PeerChat') || className.includes('PeerChannel')
    || peer.chatId != null || peer.channelId != null;
}

/**
 * Check if a message is a channel post (not a group message).
 */
export function isChannelPost(msg: any): boolean {
  return msg?.post === true;
}

/**
 * Get the access hash for a peer (needed for InputPeer construction).
 * Returns BigInt(0) if not available.
 */
export function getAccessHash(entity: any): bigint {
  if (!entity) return BigInt(0);
  const ah = entity.accessHash ?? entity.access_hash;
  if (ah == null) return BigInt(0);
  if (typeof ah === 'bigint') return ah;
  if (typeof ah === 'object' && ah.toString) {
    try { return BigInt(ah.toString()); } catch { return BigInt(0); }
  }
  try { return BigInt(ah); } catch { return BigInt(0); }
}

/**
 * Extract fromId fields from a GramJS message (for message mapping).
 * Returns { fromId: number } with safe conversion.
 */
export function getFromId(msg: any): number {
  // Primary: msg.senderId
  if (msg.senderId != null) return safeNumber(msg.senderId);
  // Fallback: msg.fromId (can be PeerUser/PeerChannel)
  if (msg.fromId) {
    if (msg.fromId.userId != null) return safeNumber(msg.fromId.userId);
    if (msg.fromId.channelId != null) return safeNumber(msg.fromId.channelId);
  }
  return 0;
}

/**
 * Safely extract entity ID (user/channel/chat).
 */
export function getEntityId(entity: any): number {
  if (!entity) return 0;
  return safeNumber(entity.id);
}

// ═══════════════════════════════════════════════════════════════════════════
// ── InputPeer Builders (Telethon's get_input_peer / get_input_user / etc.)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a GramJS InputPeer from an entity, peer, or numeric ID.
 * Equivalent to Telethon's utils.get_input_peer().
 *
 * Usage:
 *   getInputPeer(userId)          → InputPeerUser
 *   getInputPeer(-chatId)         → InputPeerChat
 *   getInputPeer(-100channelId)   → InputPeerChannel
 *   getInputPeer(entity)          → auto-detect from entity object
 */
export function getInputPeer(target: any, Api: any): any {
  if (!target) return new Api.InputPeerSelf();

  // Already an InputPeer
  const cn = target.className || target.constructor?.name || '';
  if (cn.startsWith('InputPeer')) return target;

  // Entity object (User, Chat, Channel)
  if (target.id != null && cn) {
    if (cn === 'User' || cn === 'UserFull') {
      return new Api.InputPeerUser({
        userId: safeBigInt(target.id),
        accessHash: getAccessHash(target),
      });
    }
    if (cn === 'Chat' || cn === 'ChatFull') {
      return new Api.InputPeerChat({ chatId: safeBigInt(target.id) });
    }
    if (cn === 'Channel' || cn === 'ChannelFull') {
      return new Api.InputPeerChannel({
        channelId: safeBigInt(target.id),
        accessHash: getAccessHash(target),
      });
    }
  }

  // Peer object → InputPeer
  if (cn.includes('PeerUser') || target.userId != null) {
    return new Api.InputPeerUser({
      userId: safeBigInt(target.userId),
      accessHash: BigInt(0),
    });
  }
  if (cn.includes('PeerChat') || (target.chatId != null && !target.channelId)) {
    return new Api.InputPeerChat({ chatId: safeBigInt(target.chatId) });
  }
  if (cn.includes('PeerChannel') || target.channelId != null) {
    return new Api.InputPeerChannel({
      channelId: safeBigInt(target.channelId),
      accessHash: BigInt(0),
    });
  }

  // Numeric ID (Telethon-style)
  if (typeof target === 'number' || typeof target === 'string') {
    const id = typeof target === 'string' ? parseInt(target, 10) : target;
    if (isNaN(id)) return new Api.InputPeerSelf();
    const resolved = resolveId(id);
    switch (resolved.type) {
      case 'user':    return new Api.InputPeerUser({ userId: BigInt(resolved.rawId), accessHash: BigInt(0) });
      case 'chat':    return new Api.InputPeerChat({ chatId: BigInt(resolved.rawId) });
      case 'channel': return new Api.InputPeerChannel({ channelId: BigInt(resolved.rawId), accessHash: BigInt(0) });
      default:        return new Api.InputPeerSelf();
    }
  }

  return new Api.InputPeerSelf();
}

/**
 * Build InputUser from entity or ID.
 * Telethon's utils.get_input_user().
 */
export function getInputUser(target: any, Api: any): any {
  if (!target) return new Api.InputUserSelf();
  const cn = target.className || target.constructor?.name || '';
  if (cn.startsWith('InputUser')) return target;
  if (cn === 'User' || cn === 'UserFull') {
    return new Api.InputUser({
      userId: safeBigInt(target.id),
      accessHash: getAccessHash(target),
    });
  }
  if (typeof target === 'number') {
    return new Api.InputUser({ userId: BigInt(target), accessHash: BigInt(0) });
  }
  return new Api.InputUserSelf();
}

/**
 * Build InputChannel from entity or ID.
 * Telethon's utils.get_input_channel().
 */
export function getInputChannel(target: any, Api: any): any {
  if (!target) throw new Error('No channel target');
  const cn = target.className || target.constructor?.name || '';
  if (cn.startsWith('InputChannel')) return target;
  if (cn === 'Channel' || cn === 'ChannelFull') {
    return new Api.InputChannel({
      channelId: safeBigInt(target.id),
      accessHash: getAccessHash(target),
    });
  }
  if (typeof target === 'number') {
    const resolved = resolveId(target);
    return new Api.InputChannel({
      channelId: BigInt(resolved.rawId),
      accessHash: BigInt(0),
    });
  }
  throw new Error(`Cannot get InputChannel from ${cn || typeof target}`);
}

/** Convert any value to BigInt for GramJS API calls. Safe wrapper. */
export function safeBigInt(val: any): bigint {
  if (val == null) return BigInt(0);
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(Math.trunc(val));
  if (typeof val === 'object') {
    if (typeof val.toJSNumber === 'function') return BigInt(val.toJSNumber());
    if (typeof val.toString === 'function') {
      try { return BigInt(val.toString()); } catch { return BigInt(0); }
    }
  }
  try { return BigInt(val); } catch { return BigInt(0); }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Display Name (Telethon's utils.get_display_name)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a human-readable display name from any entity.
 * Equivalent to Telethon's utils.get_display_name(entity).
 *
 * User    → "First Last" or "First" or "Deleted Account"
 * Chat    → chat title
 * Channel → channel title
 */
export function getDisplayName(entity: any): string {
  if (!entity) return '';
  // Channel/Chat title
  if (entity.title) return entity.title;
  // User first/last name
  const first = entity.firstName || entity.first_name || '';
  const last  = entity.lastName  || entity.last_name  || '';
  const full  = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  // Username fallback
  if (entity.username) return `@${entity.username}`;
  // Deleted account
  if (entity.deleted) return 'Deleted Account';
  return `id:${getEntityId(entity) || '?'}`;
}

/**
 * Format entity for display with @ prefix if username available.
 * Returns "First Last (@username)" or just "First Last" or "id:123"
 */
export function formatEntity(entity: any): string {
  const name = getDisplayName(entity);
  const username = entity?.username;
  if (username && !name.startsWith('@')) {
    return `${name} (@${username})`;
  }
  return name;
}

/**
 * Get username from entity or message sender.
 */
export function getUsername(entity: any): string {
  if (!entity) return '';
  return entity.username || entity.user?.username || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Username / Phone / Link Parsing (Telethon's utils.parse_username etc.)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a username string. Handles @username, t.me/username, URLs.
 * Equivalent to Telethon's utils.parse_username().
 *
 * Returns { username, isInvite } where:
 *   - username: cleaned username without @
 *   - isInvite: true if it's a t.me/joinchat/ or +hash invite link
 */
export function parseUsername(input: string): { username: string; isInvite: boolean } {
  if (!input || typeof input !== 'string') return { username: '', isInvite: false };
  input = input.trim();

  // t.me/joinchat/HASH or t.me/+HASH (invite links)
  const inviteMatch = input.match(/(?:t\.me|telegram\.me)\/(?:joinchat\/|\+)([a-zA-Z0-9_-]+)/i);
  if (inviteMatch) return { username: inviteMatch[1], isInvite: true };

  // t.me/username or telegram.me/username
  const linkMatch = input.match(/(?:t\.me|telegram\.me)\/([a-zA-Z]\w{3,31})/i);
  if (linkMatch) return { username: linkMatch[1], isInvite: false };

  // @username
  if (input.startsWith('@')) {
    return { username: input.slice(1), isInvite: false };
  }

  // Raw username (letters/digits/underscores, 5-32 chars, starts with letter)
  if (/^[a-zA-Z]\w{3,31}$/.test(input)) {
    return { username: input, isInvite: false };
  }

  return { username: input, isInvite: false };
}

/**
 * Parse a phone number. Strips all non-digit chars, ensures + prefix.
 * Equivalent to Telethon's utils.parse_phone().
 */
export function parsePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return '';
  return '+' + digits;
}

/**
 * Check if a string is a valid Telegram username (5-32 chars, starts with letter).
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z]\w{3,31}$/.test(username);
}

/**
 * Check if a string is a Telegram invite link.
 */
export function isInviteLink(text: string): boolean {
  return /(?:t\.me|telegram\.me)\/(?:joinchat\/|\+)[a-zA-Z0-9_-]+/i.test(text);
}

/**
 * Extract chat/channel target from user input.
 * Handles: numeric ID, @username, t.me/ link, invite link.
 * Returns normalized string suitable for client.getEntity().
 */
export function normalizeTarget(input: string): string | number {
  if (!input) return '';
  input = input.trim();

  // Numeric ID
  const num = parseInt(input, 10);
  if (!isNaN(num) && String(num) === input) return num;

  // Parse as username/link
  const { username, isInvite } = parseUsername(input);
  if (isInvite) return input; // Keep full invite link
  if (username) return username;
  return input;
}

/**
 * Resolve username via MTProto ResolveUsername API call.
 * Bypasses GramJS's VALID_USERNAME_RE which rejects collectible usernames < 5 chars.
 * Falls back to client.getEntity() if ResolveUsername fails.
 */
export async function resolveUsername(client: any, username: string): Promise<any> {
  const clean = username.replace(/^@/, '');
  try {
    // Direct API call bypasses GramJS's regex validation
    const { Api } = require('telegram/tl');
    const result = await client.invoke(new Api.contacts.ResolveUsername({ username: clean }));
    if (result.users?.length > 0) return result.users[0];
    if (result.chats?.length > 0) return result.chats[0];
  } catch {}
  // Fallback to standard resolution (works for normal usernames)
  try { return await client.getEntity(clean); } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Media Utilities (Telethon's utils.is_image, is_audio, is_video, etc.)
// ═══════════════════════════════════════════════════════════════════════════

/** Detect media type from a GramJS message. Returns descriptive string. */
export type MediaType = 'photo' | 'video' | 'voice' | 'audio' | 'sticker' | 'gif' | 'document' | 'contact' | 'location' | 'poll' | 'none';

export function getMediaType(msg: any): MediaType {
  if (!msg?.media) return 'none';
  const media = msg.media;
  const cn = media.className || media.constructor?.name || '';

  // Photo (incl. web page photo)
  if (cn === 'MessageMediaPhoto' || msg.photo || media.photo) return 'photo';

  // Document-based types
  if (cn === 'MessageMediaDocument' || media.document) {
    const doc = media.document || media;
    const mime = (doc.mimeType || '').toLowerCase();
    const attrs = doc.attributes || [];

    // Voice message
    if (attrs.some((a: any) => a.className === 'DocumentAttributeAudio' && a.voice)) return 'voice';
    // Audio file
    if (attrs.some((a: any) => a.className === 'DocumentAttributeAudio' && !a.voice)) return 'audio';
    // Sticker
    if (attrs.some((a: any) => a.className === 'DocumentAttributeSticker')) return 'sticker';
    // GIF / animation
    if (attrs.some((a: any) => a.className === 'DocumentAttributeAnimated') || mime === 'image/gif') return 'gif';
    // Video
    if (attrs.some((a: any) => a.className === 'DocumentAttributeVideo') || mime.startsWith('video/')) return 'video';
    // Image document
    if (mime.startsWith('image/')) return 'photo';

    return 'document';
  }

  // Special types
  if (cn === 'MessageMediaContact') return 'contact';
  if (cn === 'MessageMediaGeo' || cn === 'MessageMediaGeoLive' || cn === 'MessageMediaVenue') return 'location';
  if (cn === 'MessageMediaPoll') return 'poll';

  return 'none';
}

/** Get MIME type from a document entity. */
export function getDocMimeType(msg: any): string {
  const doc = msg?.media?.document || msg?.document;
  if (!doc) return '';
  return (doc.mimeType || '').toLowerCase();
}

/** Get filename from a document (looks in attributes). */
export function getDocFilename(msg: any): string {
  const doc = msg?.media?.document || msg?.document;
  if (!doc) return '';
  const attrs = doc.attributes || [];
  const fnAttr = attrs.find((a: any) => a.className === 'DocumentAttributeFilename' || a.fileName);
  if (fnAttr) return fnAttr.fileName || fnAttr.file_name || '';
  // Fallback: generate from mime type
  const mime = (doc.mimeType || '').toLowerCase();
  const ext = mimeToExtension(mime);
  return `file_${msg?.id || Date.now()}.${ext}`;
}

/** Get file extension from MIME type. Telethon's utils.get_extension(). */
export function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'image/tiff': 'tiff',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'video/x-matroska': 'mkv', 'video/avi': 'avi',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
    'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/flac': 'flac',
    'application/pdf': 'pdf', 'application/zip': 'zip',
    'application/json': 'json', 'text/plain': 'txt', 'text/html': 'html',
    'application/x-tar': 'tar', 'application/gzip': 'gz',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  return map[mime] || mime.split('/')[1] || 'bin';
}

/** Check if message has any media. */
export function hasMedia(msg: any): boolean {
  return getMediaType(msg) !== 'none';
}

/** Is the media an image? */
export function isImage(msg: any): boolean {
  const t = getMediaType(msg);
  return t === 'photo';
}

/** Is the media a video? */
export function isVideo(msg: any): boolean {
  return getMediaType(msg) === 'video';
}

/** Is the media a voice message? */
export function isVoice(msg: any): boolean {
  return getMediaType(msg) === 'voice';
}

/** Is the media a sticker? */
export function isSticker(msg: any): boolean {
  return getMediaType(msg) === 'sticker';
}

/** Is the media a GIF/animation? */
export function isGif(msg: any): boolean {
  return getMediaType(msg) === 'gif';
}

/** Get photo sizes from a message (sorted smallest→largest). */
export function getPhotoSizes(msg: any): any[] {
  const photo = msg?.media?.photo || msg?.photo;
  if (!photo?.sizes) return [];
  return [...photo.sizes].sort((a: any, b: any) => (a.w || 0) * (a.h || 0) - (b.w || 0) * (b.h || 0));
}

/** Get the largest photo size. */
export function getLargestPhoto(msg: any): any | null {
  const sizes = getPhotoSizes(msg);
  return sizes.length ? sizes[sizes.length - 1] : null;
}

/** Get file size in bytes from document attributes. */
export function getFileSize(msg: any): number {
  const doc = msg?.media?.document || msg?.document;
  if (doc?.size) return safeNumber(doc.size);
  return 0;
}

/** Recommended part size for upload/download (Telethon's get_appropriated_part_size). */
export function getPartSize(fileSize: number): number {
  if (fileSize <= 104857600)  return 64;    // ≤ 100MB → 64KB
  if (fileSize <= 786432000)  return 128;   // ≤ 750MB → 128KB
  return 512;                                // > 750MB → 512KB
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Message Utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Get message ID from a message object or number. */
export function getMessageId(msg: any): number {
  if (typeof msg === 'number') return msg;
  if (msg?.id) return safeNumber(msg.id);
  return 0;
}

/** Get reply-to message ID. */
export function getReplyToId(msg: any): number | null {
  if (!msg?.replyTo) return null;
  return safeNumber(msg.replyTo.replyToMsgId) || null;
}

/** Get quote text from reply (if quoted). */
export function getQuoteText(msg: any): string | null {
  return msg?.replyTo?.quoteText || null;
}

/** Check if message is a reply. */
export function isReply(msg: any): boolean {
  return !!msg?.replyTo?.replyToMsgId;
}

/** Check if message is forwarded. */
export function isForwarded(msg: any): boolean {
  return !!msg?.fwdFrom;
}

/** Get forward origin info. */
export function getForwardInfo(msg: any): { fromId: number; fromName: string; date: number } | null {
  if (!msg?.fwdFrom) return null;
  const fwd = msg.fwdFrom;
  const fromId = fwd.fromId ? peerToId(fwd.fromId) : 0;
  return {
    fromId,
    fromName: fwd.fromName || '',
    date: fwd.date || 0,
  };
}

/** Get message date as JS Date. */
export function getMessageDate(msg: any): Date {
  return new Date((msg?.date || 0) * 1000);
}

/** Check if message is outgoing (sent by us). */
export function isOutgoing(msg: any): boolean {
  return msg?.out === true;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Media Prefix Builder (for AI context)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a media annotation prefix for AI context.
 * e.g. "[photo msg_id=123]", "[voice msg_id=456]", ""
 */
export function buildMediaPrefix(msg: any): string {
  const type = getMediaType(msg);
  if (type === 'none') return '';
  return `[${type} msg_id=${msg?.id || 0}] `;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── HTML Escaping & Text Utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Escape text for Telegram HTML parse mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape text for Telegram MarkdownV2 parse mode. All 18 special chars. */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/** Strip all HTML tags from text. */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

/** Truncate text to maxLen, add "..." if truncated. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Convert basic Markdown to Telegram HTML.
 * Handles: **bold**, *italic*, `code`, ```pre```, ~~strike~~, [link](url)
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = escapeHtml(md);

  // Code blocks (``` ... ```)
  html = html.replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/__(.+?)__/g, '<b>$1</b>');
  // Italic (*text* or _text_)
  html = html.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<i>$1</i>');
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<i>$1</i>');
  // Strikethrough (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Entity Extraction from Message (for NLP context)
// ═══════════════════════════════════════════════════════════════════════════

/** Extract mentions from a message (@usernames). */
export function extractMentions(msg: any): string[] {
  const mentions: string[] = [];
  const text = msg?.message || msg?.text || '';
  // From message entities
  if (msg?.entities) {
    for (const e of msg.entities) {
      const cn = e.className || '';
      if (cn === 'MessageEntityMention') {
        const mention = text.substring(e.offset, e.offset + e.length);
        if (mention.startsWith('@')) mentions.push(mention.slice(1));
      }
      if (cn === 'MessageEntityMentionName') {
        mentions.push(String(safeNumber(e.userId)));
      }
    }
  }
  // Regex fallback
  const regex = /@([a-zA-Z]\w{3,31})/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!mentions.includes(match[1])) mentions.push(match[1]);
  }
  return mentions;
}

/** Extract URLs from a message. */
export function extractUrls(msg: any): string[] {
  const urls: string[] = [];
  const text = msg?.message || msg?.text || '';
  // From entities
  if (msg?.entities) {
    for (const e of msg.entities) {
      const cn = e.className || '';
      if (cn === 'MessageEntityUrl') {
        urls.push(text.substring(e.offset, e.offset + e.length));
      }
      if (cn === 'MessageEntityTextUrl' && e.url) {
        urls.push(e.url);
      }
    }
  }
  // Regex fallback
  const regex = /https?:\/\/[^\s<>\"']+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!urls.includes(match[0])) urls.push(match[0]);
  }
  return urls;
}

/** Extract hashtags from message. */
export function extractHashtags(msg: any): string[] {
  const tags: string[] = [];
  const text = msg?.message || msg?.text || '';
  if (msg?.entities) {
    for (const e of msg.entities) {
      if (e.className === 'MessageEntityHashtag') {
        tags.push(text.substring(e.offset, e.offset + e.length));
      }
    }
  }
  const regex = /#(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const tag = '#' + match[1];
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Misc Utilities (Telethon's helpers.py)
// ═══════════════════════════════════════════════════════════════════════════

/** Generate a random long integer (used for message random_id). */
export function generateRandomLong(): bigint {
  const buf = require('crypto').randomBytes(8);
  return buf.readBigInt64LE();
}

/** Check if two entities refer to the same peer. */
export function isSamePeer(a: any, b: any): boolean {
  const idA = typeof a === 'number' ? a : peerToId(a);
  const idB = typeof b === 'number' ? b : peerToId(b);
  return idA !== 0 && idA === idB;
}

/** Check if entity is a bot. */
export function isBot(entity: any): boolean {
  return entity?.bot === true;
}

/** Check if entity is verified. */
export function isVerified(entity: any): boolean {
  return entity?.verified === true;
}

/** Check if entity is a premium user. */
export function isPremium(entity: any): boolean {
  return entity?.premium === true;
}

/** Check if chat/channel is a megagroup (supergroup). */
export function isMegagroup(entity: any): boolean {
  return entity?.megagroup === true;
}

/** Get entity type string. */
export function getEntityType(entity: any): string {
  if (!entity) return 'unknown';
  const cn = entity.className || entity.constructor?.name || '';
  if (cn === 'User') return entity.bot ? 'bot' : 'user';
  if (cn === 'Chat') return 'group';
  if (cn === 'Channel') return entity.megagroup ? 'supergroup' : 'channel';
  return 'unknown';
}

/** Parse a t.me/ deep link into components. */
export function parseDeepLink(url: string): { type: string; value: string } | null {
  if (!url) return null;
  // t.me/username
  const userMatch = url.match(/t\.me\/([a-zA-Z]\w{3,31})$/i);
  if (userMatch) return { type: 'username', value: userMatch[1] };
  // t.me/+HASH (invite)
  const inviteMatch = url.match(/t\.me\/\+([a-zA-Z0-9_-]+)/i);
  if (inviteMatch) return { type: 'invite', value: inviteMatch[1] };
  // t.me/joinchat/HASH
  const joinMatch = url.match(/t\.me\/joinchat\/([a-zA-Z0-9_-]+)/i);
  if (joinMatch) return { type: 'invite', value: joinMatch[1] };
  // t.me/c/CHANNEL_ID/MSG_ID (private link)
  const privateMatch = url.match(/t\.me\/c\/(\d+)\/(\d+)/i);
  if (privateMatch) return { type: 'private_msg', value: `${privateMatch[1]}/${privateMatch[2]}` };
  // t.me/USERNAME/MSG_ID (public link)
  const publicMatch = url.match(/t\.me\/([a-zA-Z]\w+)\/(\d+)/i);
  if (publicMatch) return { type: 'public_msg', value: `${publicMatch[1]}/${publicMatch[2]}` };
  return null;
}
