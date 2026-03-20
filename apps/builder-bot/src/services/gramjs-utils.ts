/**
 * gramjs-utils.ts — Telethon-style ID parsing for GramJS
 *
 * In Telethon (Python), peer IDs follow a canonical format:
 *   PeerUser    → positive user_id
 *   PeerChat    → negative -chat_id
 *   PeerChannel → -100 prefixed: -(1000000000000 + channel_id)
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
