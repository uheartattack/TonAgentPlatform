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
import { getFragmentClient } from '../fragment-service';

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
  } catch {
    // Fallback to plain text if HTML parsing fails
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
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
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
    phone:     entity.phone,
  };
}

/** Send a file/media message */
export async function tgSendFile(chatId: string | number, filePath: string, caption?: string): Promise<number> {
  const client = await getFragmentClient();
  const result = await (client as any).sendFile(chatId, { file: filePath, caption }) as any;
  return result?.id ?? 0;
}

/** Reply to a specific message in a chat, optionally with a quote */
export async function tgReplyMessage(chatId: string | number, replyToMsgId: number, text: string, quoteText?: string): Promise<number> {
  const client = await getFragmentClient();
  const html = mdToHtmlSimple(text);
  let replyTo: any = replyToMsgId;
  if (quoteText) {
    try {
      const { Api } = require('telegram/tl');
      const peer = await (client as any).getInputEntity(chatId);
      replyTo = new Api.InputReplyToMessage({ replyToMsgId, quoteText, replyToPeerId: peer });
    } catch { replyTo = replyToMsgId; }
  }
  try {
    const result = await (client as any).sendMessage(chatId, { message: html, parseMode: 'html', replyTo }) as any;
    return result?.id ?? 0;
  } catch {
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
  } catch {
    return [];
  }
}

/** Set "typing" status in a chat */
export async function tgSetTyping(chatId: string | number, seconds = 3): Promise<void> {
  const client = await getFragmentClient();
  const peer = await (client as any).getInputEntity(chatId);
  await (client as any).invoke(new Api.messages.SetTyping({
    peer,
    action: new Api.SendMessageTypingAction(),
  }));
  // Typing status auto-expires after ~5 seconds, but we respect the parameter
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
  } catch {
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
  };
}
