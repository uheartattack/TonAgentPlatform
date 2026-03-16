/**
 * AI Agent Runtime — autonomous agentic loop
 *
 * Instead of running a static JS script, AI agents receive:
 *   - agent.code = system prompt (soul of the agent)
 *   - Tools injected by the platform (TON, gifts, state, notify)
 *
 * Each tick:
 *   1. Build messages: system(soul) + context(state/config) + chat messages
 *   2. Agentic loop (up to 5 iters): call AI → execute tools → append results
 *   3. Send final reply to user if chat was active
 */

import OpenAI from 'openai';
import { promises as dnsPromises } from 'dns';
import { isIP } from 'net';
import { notifyUser, notifyRich } from '../notifier';
import { getTelegramGiftsService } from '../services/telegram-gifts';
import {
  getAgentStateRepository,
  getAgentLogsRepository,
  getExecutionHistoryRepository,
  getBugTracker,
} from '../db/schema-extensions';
import { isAuthorized } from '../fragment-service';
import {
  tgSendMessage, tgGetMessages, tgGetChannelInfo,
  tgJoinChannel, tgLeaveChannel, tgGetDialogs,
  tgGetMembers, tgSearchMessages, tgGetUserInfo, tgSendFile,
  tgForwardMessage, tgReplyMessage, tgReactMessage, tgEditMessage,
  tgPinMessage, tgMarkRead, tgGetComments, tgSetTyping,
  tgSendFormatted, tgGetMessageById, tgGetUnread,
} from '../services/telegram-userbot';
import { userbotManager } from '../services/userbot-manager';

// ── Channel post rate limiter (platform-level anti-spam) ────────────────────
// Key: `${agentId}:${chatId}` → last post timestamp
const _channelPostTimes = new Map<string, number>();
const CHANNEL_POST_COOLDOWN = 30 * 60 * 1000; // 30 minutes between posts to same chat

function canPostToChat(agentId: number, chatId: string, isReply: boolean): { allowed: boolean; waitMinutes?: number } {
  if (isReply) return { allowed: true }; // replies to user messages always allowed
  const key = `${agentId}:${String(chatId).toLowerCase()}`;
  const last = _channelPostTimes.get(key) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < CHANNEL_POST_COOLDOWN) {
    return { allowed: false, waitMinutes: Math.ceil((CHANNEL_POST_COOLDOWN - elapsed) / 60000) };
  }
  return { allowed: true };
}

function markPosted(agentId: number, chatId: string) {
  const key = `${agentId}:${String(chatId).toLowerCase()}`;
  _channelPostTimes.set(key, Date.now());
}

// ── Singleton pool for shared state ─────────────────────────────────────────
let _sharedStatePool: any = null;
function _getSharedStatePool(): any {
  if (!_sharedStatePool) {
    const { Pool } = require('pg');
    _sharedStatePool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'ton_agent',
      password: process.env.DB_PASSWORD || 'changeme',
      database: process.env.DB_NAME || 'ton_agent_platform',
      max: 3,
    });
  }
  return _sharedStatePool;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface AIAgentTickParams {
  agentId:    number;
  userId:     number;
  systemPrompt: string;           // agent.code — the "soul"
  config:     Record<string, any>; // from trigger_config.config
  pendingMessages?: string[];     // chat messages from user since last tick
  onNotify?: (msg: string) => Promise<void>; // send message to user
}

interface ToolCall {
  id:       string;
  name:     string;
  args:     Record<string, any>;
}

// ── AI provider config: maps human-friendly name → baseURL + default model ─

interface ProviderCfg { baseURL: string; defaultModel: string; }

function resolveProvider(provider: string): ProviderCfg {
  const p = (provider || '').toLowerCase();
  if (p.includes('gemini') || p.includes('google')) {
    return { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.5-flash' };
  }
  if (p.includes('anthropic') || p.includes('claude')) {
    // Anthropic native API is NOT OpenAI-compatible, route through OpenRouter
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-haiku-4-5-20251001' };
  }
  if (p.includes('groq')) {
    return { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' };
  }
  if (p.includes('deepseek')) {
    return { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' };
  }
  if (p.includes('openrouter')) {
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.5-flash' };
  }
  if (p.includes('together')) {
    return { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' };
  }
  // Default: OpenAI
  return { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' };
}

// Returns AI client using user's own API key. Throws if no key configured.
function getAIClient(config: Record<string, any>): { client: OpenAI; defaultModel: string } {
  const apiKey = (config.AI_API_KEY as string) || '';
  const provider = (config.AI_PROVIDER as string) || '';

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const { baseURL, defaultModel } = resolveProvider(provider);
  const finalURL = (config.AI_BASE_URL as string) || baseURL;
  return { client: new OpenAI({ baseURL: finalURL, apiKey }), defaultModel };
}

// ── Markdown → HTML converter (for AI-generated text) ─────────────────────
export function mdToHtml(text: string): string {
  // If text already has HTML tags (AI sometimes outputs <b> directly) — pass through as-is.
  // Only strip truly dangerous tags; Telegram supports: b, i, code, pre, s, u, a, tg-spoiler.
  if (/<[a-z][^>]*>/i.test(text)) {
    return text
      .replace(/<(?!\/?(?:b|i|s|u|code|pre|a|tg-spoiler)[\s>\/])[^>]+>/gi, '')
      .trim();
  }
  // Escape HTML entities first to prevent XSS, then convert markdown → HTML
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (``` ... ```) → <pre><code>
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
    // Inline code (`code`) → <code>
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    // Italic: *text* or _text_ (avoid matching inside words)
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<i>$1</i>')
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Headers: ### H → bold line
    .replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>')
    .trim();
}

// ── In-memory pending messages (chat → agent) ──────────────────────────────

const _pendingMessages = new Map<number, string[]>(); // agentId → messages[]

// ── Per-agent web request rate limiter (anti-scraping) ──────────────────────
const _webRequestCounts = new Map<number, { count: number; resetAt: number }>();
const WEB_REQUESTS_PER_RUN = 10; // max web_search + fetch_url per run
function checkWebRateLimit(agentId: number): boolean {
  const now = Date.now();
  const entry = _webRequestCounts.get(agentId);
  if (!entry || now > entry.resetAt) {
    _webRequestCounts.set(agentId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= WEB_REQUESTS_PER_RUN) return false;
  entry.count++;
  return true;
}

// ── SSRF protection: validate URL + resolved IP ─────────────────────────────
function isPrivateIP(ip: string): boolean {
  // Normalize: strip IPv6 brackets, lowercase
  let addr = ip.replace(/^\[|\]$/g, '').toLowerCase();

  // IPv6-mapped IPv4 (::ffff:x.x.x.x) → extract the IPv4 part
  const mappedMatch = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedMatch) addr = mappedMatch[1];

  // IPv6 loopback
  if (addr === '::1' || addr === '0:0:0:0:0:0:0:1') return true;

  // IPv6 ULA (fc00::/7) and link-local (fe80::/10)
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true;

  // IPv4 checks
  const parts = addr.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 127) return true;                          // 127.0.0.0/8
    if (a === 0) return true;                            // 0.0.0.0/8
    if (a === 10) return true;                           // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 100 && b >= 64 && b <= 127) return true;   // 100.64.0.0/10 (CGNAT)
  }
  return false;
}

function fullyDecodeURI(s: string): string {
  let prev = s;
  for (let i = 0; i < 5; i++) {
    try { s = decodeURIComponent(s); } catch { break; }
    if (s === prev) break;
    prev = s;
  }
  return s;
}

async function validateUrlSSRF(rawUrl: string): Promise<{ error?: string; decodedUrl?: string }> {
  // 1. Fully decode (handles double/triple encoding like %2531%2532%2537)
  const decodedUrl = fullyDecodeURI(rawUrl);

  // 2. Parse
  let parsed: URL;
  try {
    parsed = new URL(decodedUrl);
  } catch {
    return { error: 'Invalid URL' };
  }

  // 3. Protocol whitelist
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http/https URLs are allowed' };
  }

  // 4. Hostname pre-check (catches obvious cases before DNS)
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')
    || host.endsWith('.internal') || host.endsWith('.local')
    || host === 'metadata.google.internal'
    || host === 'instance-data') {
    return { error: 'Access to internal addresses is blocked' };
  }

  // Check if hostname is already an IP
  if (isPrivateIP(host)) {
    return { error: 'Access to internal/private addresses is blocked' };
  }

  // 5. DNS resolution check (prevents DNS rebinding with private IPs)
  try {
    const addresses = await dnsPromises.resolve4(parsed.hostname).catch(() => [] as string[]);
    const addresses6 = await dnsPromises.resolve6(parsed.hostname).catch(() => [] as string[]);
    const allIPs = [...addresses, ...addresses6];

    // If hostname resolved to nothing and isn't already an IP literal, block it
    if (allIPs.length === 0 && !isIP(parsed.hostname)) {
      // hostname didn't resolve — allow the fetch to fail naturally
      return { decodedUrl };
    }

    for (const ip of allIPs) {
      if (isPrivateIP(ip)) {
        return { error: 'Access to internal/private addresses is blocked (resolved IP)' };
      }
    }
  } catch {
    // DNS resolution failed — let the fetch attempt proceed and fail naturally
  }

  return { decodedUrl };
}

// ── Per-agent tool rate limiter (financial + gift + TG tools) ────────────────
const _toolRateLimits = new Map<string, number[]>(); // "agentId:toolGroup" → timestamps[]
const TOOL_RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  financial: { max: 5, windowMs: 60_000 },  // 5 financial ops per minute
  gift:      { max: 10, windowMs: 60_000 }, // 10 gift ops per minute
  tg:        { max: 15, windowMs: 60_000 }, // 15 TG ops per minute
};
const TOOL_GROUP_MAP: Record<string, string> = {
  send_ton: 'financial', send_jetton: 'financial', ton_send_boc: 'financial',
  buy_catalog_gift: 'gift', buy_resale_gift: 'gift', buy_market_gift: 'gift',
  list_gift_for_sale: 'gift', get_gift_floor_real: 'gift', get_gift_catalog: 'gift',
  scan_real_arbitrage: 'gift', appraise_gift: 'gift',
  tg_send_message: 'tg', tg_edit_message: 'tg', tg_forward_message: 'tg',
  tg_send_sticker: 'tg', tg_send_gif: 'tg', tg_send_voice: 'tg',
};
function checkToolRateLimit(agentId: number, toolName: string): boolean {
  const group = TOOL_GROUP_MAP[toolName];
  if (!group) return true;
  const limit = TOOL_RATE_LIMITS[group];
  if (!limit) return true;
  const key = `${agentId}:${group}`;
  const now = Date.now();
  let timestamps = _toolRateLimits.get(key) || [];
  timestamps = timestamps.filter(t => now - t < limit.windowMs);
  if (timestamps.length >= limit.max) return false;
  timestamps.push(now);
  _toolRateLimits.set(key, timestamps);
  return true;
}

// ── Per-agent transaction safety (large amount confirmation) ────────────────
const HIGH_VALUE_TX_LIMIT_TON = 100; // TON threshold requiring confirmation
const DAILY_SPEND_LIMIT_TON = 500;   // Default daily spend cap per agent (in TON)

// ── Notify-called flag per active tick (agentId → bool) ────────────────────
// Used to suppress duplicate sends when AI calls notify() AND produces finalContent
const _tickNotifyFlag = new Map<number, boolean>();

// ── Agent metadata cache (60s TTL) ──────────────────────────────────────────
interface CachedAgentMeta {
  name: string; description: string; role: string; userId: string;
  ownerName: string; ownerUsername: string; createdAt: string;
  cachedAt: number;
}
const _agentMetaCache = new Map<number, CachedAgentMeta>();
const META_CACHE_TTL = 60_000; // 60 seconds

async function getAgentMeta(agentId: number): Promise<CachedAgentMeta | null> {
  const cached = _agentMetaCache.get(agentId);
  if (cached && Date.now() - cached.cachedAt < META_CACHE_TTL) return cached;
  try {
    const { pool } = await import('../db');
    const res = await pool.query(
      `SELECT a.name, a.description, a.created_at, a.role, a.user_id,
              u.first_name as owner_name, u.username as owner_username
       FROM builder_bot.agents a LEFT JOIN builder_bot.users u ON a.user_id = u.telegram_id
       WHERE a.id = $1`, [agentId]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    const meta: CachedAgentMeta = {
      name: r.name || '', description: r.description || '', role: r.role || 'worker',
      userId: String(r.user_id || ''), ownerName: r.owner_name || '', ownerUsername: r.owner_username || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      cachedAt: Date.now(),
    };
    _agentMetaCache.set(agentId, meta);
    return meta;
  } catch (e: any) {
    console.warn(`[MetaCache] Failed for agent #${agentId}: ${e.message}`);
    return cached || null; // return stale cache if available
  }
}

export function addMessageToAIAgent(agentId: number, text: string): void {
  if (!_pendingMessages.has(agentId)) _pendingMessages.set(agentId, []);
  _pendingMessages.get(agentId)!.push(text);
  // Trigger an immediate tick so the user gets a fast response
  runImmediateTick(agentId);
}

// ── Chat response callbacks (for studio chat) ──
const _chatResponseCallbacks = new Map<number, { resolve: (text: string) => void; timer: NodeJS.Timeout }>();

/**
 * Send a message to the agent and WAIT for its text response (up to 30s).
 * Used by the studio chat endpoint.
 */
export function sendMessageAndWaitResponse(agentId: number, text: string): Promise<string> {
  return new Promise((resolve) => {
    // Clean up any existing callback
    const existing = _chatResponseCallbacks.get(agentId);
    if (existing) { clearTimeout(existing.timer); existing.resolve(''); }

    const timer = setTimeout(() => {
      _chatResponseCallbacks.delete(agentId);
      resolve('[Агент обрабатывает запрос... ответ появится в следующем тике]');
    }, 30_000);

    _chatResponseCallbacks.set(agentId, { resolve, timer });

    // Queue message and trigger tick
    if (!_pendingMessages.has(agentId)) _pendingMessages.set(agentId, []);
    _pendingMessages.get(agentId)!.push(`[Studio Chat] ${text}`);
    runImmediateTick(agentId);
  });
}

/** Called from the agentic loop when AI produces text content */
function _resolveChatCallback(agentId: number, text: string): void {
  const cb = _chatResponseCallbacks.get(agentId);
  if (cb) {
    clearTimeout(cb.timer);
    _chatResponseCallbacks.delete(agentId);
    cb.resolve(text);
  }
}

function popMessages(agentId: number): string[] {
  const msgs = _pendingMessages.get(agentId) || [];
  _pendingMessages.delete(agentId);
  return msgs;
}

// ── Active AI agent handles ────────────────────────────────────────────────

interface ActiveHandle {
  interval: NodeJS.Timeout;
  tick: () => Promise<void>;
  tickRunning: boolean;
  firstTickTimer?: NodeJS.Timeout;
  setupListenerActive?: boolean;
  consecutiveErrors: number;  // Circuit breaker: deactivate after MAX_CONSECUTIVE_ERRORS
}

const MAX_CONSECUTIVE_ERRORS = 5; // Deactivate agent after 5 consecutive tick failures

const _activeHandles = new Map<number, ActiveHandle>();

/** Run an immediate tick for the given agent (e.g. when a chat message arrives). */
function runImmediateTick(agentId: number): void {
  const handle = _activeHandles.get(agentId);
  if (!handle) return; // agent not active — nothing to trigger
  if (handle.tickRunning) return; // tick already in progress, message will be picked up
  handle.tick().catch(e => console.error('[Runtime]', e?.message || e));
}

// ── Capability → Tool mapping ──────────────────────────────────────────────
const CAPABILITY_TOOL_MAP: Record<string, string[]> = {
  wallet:      ['get_ton_balance', 'send_ton', 'send_jetton', 'get_agent_wallet'],
  nft:         ['get_nft_floor'],
  gifts:       ['get_gift_catalog', 'get_fragment_listings', 'appraise_gift', 'scan_arbitrage',
                'buy_catalog_gift', 'buy_resale_gift', 'list_gift_for_sale', 'get_stars_balance',
                'get_gift_upgrade_stats', 'analyze_gift_profitability', 'buy_market_gift'],
  gifts_market:['get_gift_floor_real', 'get_gift_sales_history', 'get_market_overview',
                'get_price_list', 'scan_real_arbitrage', 'get_gift_aggregator', 'get_top_deals',
                'get_backdrop_floors', 'get_user_portfolio', 'get_collection_offers',
                'get_market_health', 'get_attribute_volumes', 'get_unique_gift_prices',
                'find_underpriced_gifts', 'get_price_history', 'get_market_activity',
                'get_collections_marketcap'],
  telegram:    ['tg_send_message', 'tg_get_messages', 'tg_get_channel_info', 'tg_join_channel',
                'tg_leave_channel', 'tg_get_dialogs', 'tg_get_members', 'tg_search_messages',
                'tg_get_user_info', 'tg_reply', 'tg_react', 'tg_edit', 'tg_forward', 'tg_pin',
                'tg_mark_read', 'tg_get_comments', 'tg_set_typing', 'tg_send_formatted',
                'tg_get_message_by_id', 'tg_get_unread', 'tg_send_file',
                'tg_copy_media', 'tg_get_media_info', 'tg_delete_message',
                'tg_create_poll', 'tg_kick_user', 'tg_ban_user', 'tg_unban_user',
                'tg_mute_user', 'tg_get_admins', 'tg_set_admin', 'tg_create_invite_link',
                'tg_unpin', 'tg_schedule_message', 'tg_set_chat_title', 'tg_set_chat_about',
                'tg_set_chat_photo', 'tg_create_group', 'tg_create_channel', 'tg_invite_users',
                'tg_archive_chat', 'tg_get_online_count', 'tg_send_contact', 'tg_send_location',
                'tg_get_history_count', 'tg_send_album', 'tg_get_profile_photos',
                'tg_send_silent', 'tg_get_webpage', 'tg_press_button',
                'tg_get_chat_stats', 'tg_save_draft', 'tg_send_with_buttons',
                'tg_get_poll_results', 'tg_send_sticker', 'tg_send_gif',
                'tg_send_voice', 'tg_transcribe_voice', 'tg_get_sticker_sets'],
  web:         ['web_search', 'fetch_url', 'http_fetch'],
  state:       ['get_state', 'get_state_multi', 'set_state', 'list_state_keys', 'get_shared_state', 'set_shared_state'],
  events:      ['set_next_wake', 'subscribe_event', 'unsubscribe_event', 'emit_event', 'get_wake_info'],
  notify:      ['notify', 'notify_rich'],
  plugins:     ['list_plugins', 'suggest_plugin', 'run_custom_plugin', 'list_custom_plugins',
                'apply_plugin', 'remove_plugin'],
  inter_agent: ['list_my_agents', 'ask_agent', 'assign_task', 'check_tasks', 'manage_agent', 'send_report'],
  blockchain:  ['ton_get_account', 'ton_get_transactions', 'ton_get_jettons', 'ton_get_nfts',
                'ton_run_method', 'ton_get_rates', 'ton_dns_resolve', 'ton_get_staking_pools',
                'ton_emulate_tx', 'ton_send_boc', 'ton_get_validators', 'ton_parse_address'],
  defi:        ['dex_get_prices', 'dex_swap_simulate'],
  image:       ['image_download', 'image_resize', 'image_crop', 'image_add_text', 'image_filter',
                'image_convert', 'image_info', 'image_composite', 'image_create_text', 'image_analyze'],
  ton_mcp:     [], // dynamic — MCP tools discovered at runtime and injected via mcpTools param
};

// ── Tool definitions (OpenAI function_call format) ─────────────────────────

export function buildToolDefinitions(agentRole?: string, enabledCapabilities?: string[] | null, mcpTools?: OpenAI.ChatCompletionTool[]): OpenAI.ChatCompletionTool[] {
  const allTools: OpenAI.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_ton_balance',
        description: 'Получить баланс TON кошелька',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес (EQ...)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_nft_floor',
        description: '⛔ ТОЛЬКО для настоящих NFT коллекций на TON (TON Punks, TON Diamonds и т.д.) — НЕ для Telegram-подарков (Lol Pop, Jelly Bunny и т.д.). Для подарков используй get_gift_floor_real.',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Адрес NFT коллекции (EQ/UQ/raw) — только настоящие NFT, не подарки' },
            ton_api_key: { type: 'string', description: 'TONAPI_KEY (опционально)' },
          },
          required: ['collection'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_catalog',
        description: 'Получить список доступных Telegram подарков из каталога с ценами',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_fragment_listings',
        description: 'Получить листинги уникального подарка на Fragment (цены перепродажи)',
        parameters: {
          type: 'object',
          properties: {
            gift_slug: { type: 'string', description: 'Slug подарка на Fragment' },
            limit: { type: 'number', description: 'Количество листингов (макс. 50)' },
          },
          required: ['gift_slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'appraise_gift',
        description: 'Оценить уникальный подарок: floor price, средняя цена, последняя продажа',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug подарка' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scan_arbitrage',
        description: '⚠️ УСТАРЕЛО — используй scan_real_arbitrage вместо этого. Данные могут быть неточными.',
        parameters: {
          type: 'object',
          properties: {
            max_price_stars: { type: 'number', description: 'Максимальная цена покупки в Stars' },
            min_profit_pct:  { type: 'number', description: 'Минимальная прибыль в %' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_catalog_gift',
        description: 'Купить подарок из каталога Telegram (требует Stars на балансе бота или userbot)',
        parameters: {
          type: 'object',
          properties: {
            gift_id:      { type: 'string',  description: 'ID подарка из каталога' },
            recipient_id: { type: 'number',  description: 'Telegram user ID получателя' },
            use_userbot:  { type: 'boolean', description: 'Использовать userbot (MTProto) вместо Bot API' },
          },
          required: ['gift_id', 'recipient_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_resale_gift',
        description: 'Купить уникальный подарок с Fragment маркетплейса по slug',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug уникального подарка на Fragment' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_gift_for_sale',
        description: 'Выставить подарок на продажу на Fragment (нужен msg_id подарка в userbot)',
        parameters: {
          type: 'object',
          properties: {
            msg_id:      { type: 'number', description: 'ID сообщения с подарком в userbot' },
            price_stars: { type: 'number', description: 'Цена продажи в Stars' },
          },
          required: ['msg_id', 'price_stars'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_stars_balance',
        description: 'Получить текущий баланс Stars на аккаунте userbot',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_upgrade_stats',
        description: 'Получить статистику апгрейдов подарка — сколько уже улучшено, текущая стоимость апгрейда в Stars, ожидаемый номер следующего. Помогает оценить выгодность апгрейда.',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug/название подарка (например: "homemade-cake", "jelly-bunny")' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_gift_profitability',
        description: 'Полный анализ выгодности подарка: текущая pre-market цена в Stars, стоимость апгрейда, floor price NFT на рынках, потенциальная прибыль. Ответ: стоит ли апгрейдить.',
        parameters: {
          type: 'object',
          properties: {
            slug:       { type: 'string',  description: 'Slug подарка' },
            budget_ton: { type: 'number',  description: 'Максимальный бюджет в TON для покупки' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_market_gift',
        description: 'Купить подарок на маркете используя tx_payload из get_gift_aggregator. Отправляет транзакцию с кошелька агента. Требует: можно_купить=true (can_buy_now=true в листинге). ИСПОЛЬЗУЙ ТОЛЬКО когда get_gift_aggregator вернул item с tx_payload и tx_contract.',
        parameters: {
          type: 'object',
          properties: {
            tx_contract:  { type: 'string', description: 'Адрес смарт-контракта (item.tx_contract из get_gift_aggregator)' },
            tx_payload:   { type: 'string', description: 'Base64 BOC payload транзакции (item.tx_payload из get_gift_aggregator)' },
            price_ton:    { type: 'number', description: 'Цена покупки в TON (item.price_ton)' },
            gift_name:    { type: 'string', description: 'Название подарка для уведомления' },
          },
          required: ['tx_contract', 'tx_payload', 'price_ton'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_agent_wallet',
        description: 'Получить или создать TON кошелёк агента. Агент может хранить TON и совершать транзакции. Пользователь должен задепозитить TON на этот адрес.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_daily_spend',
        description: 'Узнать дневной лимит расходов агента и сколько потрачено сегодня (TON)',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_ton',
        description: 'Отправить TON с кошелька агента на указанный адрес (требует предварительного пополнения кошелька агента)',
        parameters: {
          type: 'object',
          properties: {
            to:      { type: 'string', description: 'Адрес получателя (EQ.../UQ...)' },
            amount:  { type: 'number', description: 'Сумма в TON' },
            comment: { type: 'string', description: 'Комментарий к транзакции (опционально)' },
          },
          required: ['to', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_jetton',
        description: 'Отправить Jetton-токен (USDT, NOT и др.) с кошелька агента. Требует предварительного пополнения.',
        parameters: {
          type: 'object',
          properties: {
            to:             { type: 'string', description: 'Адрес получателя (EQ.../UQ...)' },
            jetton_master:  { type: 'string', description: 'Адрес Jetton Master контракта (EQ...)' },
            amount:         { type: 'string', description: 'Сумма в минимальных единицах (nano). Для USDT 6 знаков: 1 USDT = 1000000' },
            comment:        { type: 'string', description: 'Комментарий (опционально)' },
          },
          required: ['to', 'jetton_master', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dex_get_prices',
        description: 'Получить цены токенов на DeDust DEX (USD). Можно искать по символу.',
        parameters: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Символ токена (TON, USDT, NOT и т.д.). Если не указан — вернёт все.' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dex_swap_simulate',
        description: 'Симулировать обмен токенов на STON.fi DEX. Показывает курс и price impact. Популярные адреса: TON=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c, USDT=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs, NOT=EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT. Сначала используй dex_get_prices чтобы найти адрес нужного токена.',
        parameters: {
          type: 'object',
          properties: {
            offer_address: { type: 'string', description: 'Адрес токена для продажи. TON = EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c' },
            ask_address:   { type: 'string', description: 'Адрес токена для покупки. Используй dex_get_prices чтобы найти адрес.' },
            amount:        { type: 'string', description: 'Сумма в nano-единицах (1 TON = 1000000000, 1 USDT = 1000000)' },
            slippage:      { type: 'string', description: 'Допустимый slippage (по умолчанию 0.01 = 1%)' },
          },
          required: ['offer_address', 'ask_address', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_state',
        description: 'Получить сохранённое состояние агента по ключу (постоянное хранилище)',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Ключ состояния' },
          },
          required: ['key'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_state_multi',
        description: 'Получить несколько ключей состояния за один запрос (batch). Эффективнее чем несколько get_state вызовов.',
        parameters: {
          type: 'object',
          properties: {
            keys: { type: 'array', items: { type: 'string' }, description: 'Массив ключей состояния' },
          },
          required: ['keys'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_state',
        description: 'Сохранить состояние агента (постоянное хранилище). Используй list_state_keys чтобы узнать какие ключи уже сохранены.',
        parameters: {
          type: 'object',
          properties: {
            key:   { type: 'string', description: 'Ключ состояния' },
            value: { type: 'string', description: 'Значение (строка или JSON-строка)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_state_keys',
        description: 'Показать все сохранённые ключи состояния агента. Используй перед get_state чтобы знать какие ключи существуют.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_shared_state',
        description: 'Получить общее состояние аккаунта (shared между всеми агентами на этом TG аккаунте). Используй для данных, которые нужны всем агентам: адрес кошелька, настройки, общие заметки.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Ключ общего состояния' },
          },
          required: ['key'],
        },
      },
    },
    // ── Self-Awareness tools ──
    {
      type: 'function',
      function: {
        name: 'remember',
        description: 'Запомнить важную информацию от владельца или из опыта. Категории: contact (контакт/канал), fact (факт), preference (предпочтение), task (задача), insight (наблюдение). Всё запомненное будет доступно в каждом тике.',
        parameters: {
          type: 'object',
          properties: {
            key:      { type: 'string', description: 'Короткий ключ (например: owner_channel, wallet, preference)' },
            value:    { type: 'string', description: 'Что запомнить' },
            category: { type: 'string', enum: ['contact', 'fact', 'preference', 'task', 'insight'], description: 'Категория памяти (необязательно, по умолчанию fact)' },
            importance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Важность (high=всегда в контексте, medium=обычная, low=может быть сжата)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'recall',
        description: 'Вспомнить всё что было запомнено через remember. Возвращает все заметки агента.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_self_prompt',
        description: 'Дополнить свой системный промпт новыми инструкциями. НЕ перезаписывает исходный — добавляет в конец. Используй когда владелец просит изменить поведение.',
        parameters: {
          type: 'object',
          properties: {
            addition: { type: 'string', description: 'Дополнительные инструкции для себя (1-3 предложения)' },
          },
          required: ['addition'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_lesson',
        description: 'Сохранить урок/вывод из опыта. Агент учится из ошибок и успехов. Уроки загружаются в каждом тике для контекста.',
        parameters: {
          type: 'object',
          properties: {
            lesson:   { type: 'string', description: 'Что ты узнал (1-2 предложения)' },
            category: { type: 'string', enum: ['error', 'success', 'insight'], description: 'Категория: error (ошибка), success (успех), insight (наблюдение)' },
          },
          required: ['lesson', 'category'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'manage_goals',
        description: 'Управлять своими целями. Агент сам формирует цели из задачи и отмечает выполненные.',
        parameters: {
          type: 'object',
          properties: {
            action:   { type: 'string', enum: ['add', 'complete', 'remove', 'list'], description: 'Действие: add, complete, remove, list' },
            goal:     { type: 'string', description: 'Текст цели (для add/complete/remove)' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Приоритет (для add)' },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_pause',
        description: 'Экстренная остановка. Агент обнаружил проблему и хочет остановиться. Уведомит владельца и деактивирует агента.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Причина остановки (1-2 предложения)' },
          },
          required: ['reason'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'rollback_prompt',
        description: 'Откатить дополнения к системному промпту. Удаляет все добавленные через update_self_prompt инструкции.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Dossier Tools ──────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'get_contact_dossier',
        description: 'Получить досье на контакт. Возвращает: имя, username, кол-во сообщений, интересы, настроение, отношения, заметки.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'Telegram user ID контакта' },
          },
          required: ['user_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_contact_note',
        description: 'Добавить заметку о контакте. Запомнить важное о человеке для будущих разговоров.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'Telegram user ID контакта' },
            note:    { type: 'string', description: 'Заметка (до 200 символов)' },
          },
          required: ['user_id', 'note'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_contact_relationship',
        description: 'Установить уровень отношений с контактом (stranger/acquaintance/regular/friend/vip).',
        parameters: {
          type: 'object',
          properties: {
            user_id:      { type: 'string', description: 'Telegram user ID' },
            relationship: { type: 'string', enum: ['stranger', 'acquaintance', 'regular', 'friend', 'vip'], description: 'Уровень отношений' },
          },
          required: ['user_id', 'relationship'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_chat_dossier',
        description: 'Получить досье на чат/канал. Возвращает: тип, кол-во сообщений, активность, участников, заметки.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Telegram chat ID' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_chat_note',
        description: 'Добавить заметку о чате/канале. Запомнить тему, правила, важное.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Telegram chat ID' },
            note:    { type: 'string', description: 'Заметка (до 200 символов)' },
          },
          required: ['chat_id', 'note'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_contacts',
        description: 'Список всех известных контактов с краткой инфой (имя, статус, интересы). Для полного досье используй get_contact_dossier.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_chat_policy',
        description: 'Установить режим для конкретного чата: active (сам решаю отвечать/реагировать/игнорить), open (отвечаю всем), mention-only (только по упоминанию), disabled (молчу). Используй для управления в каких чатах быть активным.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Telegram chat ID или @username' },
            policy:  { type: 'string', enum: ['active', 'open', 'mention-only', 'disabled'], description: 'Режим для этого чата' },
          },
          required: ['chat_id', 'policy'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_chat_policies',
        description: 'Показать текущие настройки по чатам: какой режим в каком чате (active/open/mention-only/disabled). Также показывает глобальный режим по умолчанию.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Event-Driven Tools ──────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'set_next_wake',
        description: 'Запланировать следующее пробуждение агента. Вместо фиксированного интервала, агент сам решает когда проснуться. Минимум 10 сек, максимум 7 дней.',
        parameters: {
          type: 'object',
          properties: {
            delay_seconds: { type: 'number', description: 'Через сколько секунд проснуться (10-604800)' },
            reason:        { type: 'string', description: 'Зачем просыпаться (для контекста в следующем тике)' },
          },
          required: ['delay_seconds', 'reason'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'subscribe_event',
        description: 'Подписаться на событие платформы. Агент проснётся когда событие произойдёт. Типы: price_change (изменение цены), wallet_tx (транзакция кошелька), custom (кастомное от другого агента).',
        parameters: {
          type: 'object',
          properties: {
            event_type: { type: 'string', enum: ['price_change', 'wallet_tx', 'custom'], description: 'Тип события' },
            filter:     { type: 'object', description: 'Фильтр (необязательно). Для price_change: {asset, threshold}. Для wallet_tx: {direction}. Для custom: {name}.' },
          },
          required: ['event_type'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'unsubscribe_event',
        description: 'Отписаться от события. Если тип не указан — отписывается от всех.',
        parameters: {
          type: 'object',
          properties: {
            event_type: { type: 'string', enum: ['price_change', 'wallet_tx', 'custom'], description: 'Тип события (необязательно — без него отписка от всех)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'emit_event',
        description: 'Отправить кастомное событие. Другие агенты, подписанные на custom с подходящим фильтром, проснутся.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Имя события (например: "price_alert", "task_done")' },
            data: { type: 'object', description: 'Данные события (произвольный объект)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_wake_info',
        description: 'Узнать когда следующее запланированное пробуждение и список подписок на события.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_shared_state',
        description: 'Сохранить общее состояние аккаунта (shared между всеми агентами на этом TG аккаунте). Другие агенты на том же аккаунте смогут прочитать это значение.',
        parameters: {
          type: 'object',
          properties: {
            key:   { type: 'string', description: 'Ключ общего состояния' },
            value: { type: 'string', description: 'Значение (строка или JSON-строка)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notify',
        description: 'Отправить уведомление пользователю в Telegram (простой текст)',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Текст уведомления' },
          },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notify_rich',
        description: 'Отправить красивое уведомление с HTML-разметкой и кнопками. Поддерживает <b>жирный</b>, <i>курсив</i>, <code>код</code>.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'HTML-текст уведомления. Используй <b>, <i>, <code> для форматирования.' },
            buttons: {
              type: 'array',
              description: 'Массив кнопок под сообщением (необязательно)',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Текст кнопки' },
                  url: { type: 'string', description: 'URL для перехода (необязательно)' },
                },
                required: ['text'],
              },
            },
          },
          required: ['message'],
        },
      },
    },
    // ── Web tools ─────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Поиск в интернете. Возвращает топ-5 результатов (заголовок, описание, URL).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: 'Получить текстовое содержимое веб-страницы по URL (первые 3000 символов).',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL страницы' },
          },
          required: ['url'],
        },
      },
    },
    // ── Telegram Userbot tools (MTProto) ──────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_send_message',
        description: 'Отправить сообщение через Telegram аккаунт (MTProto userbot). Работает с пользователями, группами, каналами.',
        parameters: {
          type: 'object',
          properties: {
            peer:    { type: 'string', description: 'Username (@channel), chat ID, или ссылка на чат' },
            message: { type: 'string', description: 'Текст сообщения' },
          },
          required: ['peer', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_messages',
        description: 'Получить последние сообщения из чата/канала через MTProto',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username или chat ID' },
            limit: { type: 'number', description: 'Количество сообщений (макс 100)' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_channel_info',
        description: 'Получить информацию о канале/группе: название, подписчики, описание',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username или chat ID канала' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_join_channel',
        description: 'Вступить в канал/группу',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username канала/группы' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_leave_channel',
        description: 'Покинуть канал/группу',
        parameters: {
          type: 'object',
          properties: {
            peer: { type: 'string', description: 'Username канала/группы' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_dialogs',
        description: 'Получить список чатов (диалогов) аккаунта',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Количество чатов (по умолчанию 20)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_members',
        description: 'Получить участников канала/группы',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username группы/канала' },
            limit: { type: 'number', description: 'Количество (макс 200)' },
          },
          required: ['peer'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_search_messages',
        description: 'Поиск сообщений в чате по ключевым словам',
        parameters: {
          type: 'object',
          properties: {
            peer:  { type: 'string', description: 'Username или chat ID' },
            query: { type: 'string', description: 'Поисковый запрос' },
            limit: { type: 'number', description: 'Количество результатов' },
          },
          required: ['peer', 'query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_user_info',
        description: 'Получить информацию о пользователе Telegram',
        parameters: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'Username или user ID' },
          },
          required: ['user'],
        },
      },
    },
    // ── Extended Telegram Userbot tools ──
    {
      type: 'function',
      function: {
        name: 'tg_reply',
        description: 'Ответить на конкретное сообщение в чате/канале. Можно процитировать часть текста (quote). Используй для обсуждений.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:     { type: 'string', description: 'ID чата/канала или username' },
            reply_to_id: { type: 'number', description: 'ID сообщения на которое отвечаем' },
            text:        { type: 'string', description: 'Текст ответа' },
            quote:       { type: 'string', description: 'Цитата — часть текста оригинального сообщения которую выделяем (необязательно)' },
          },
          required: ['chat_id', 'reply_to_id', 'text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_react',
        description: 'Поставить реакцию (эмодзи) на сообщение. Поддерживает: 👍❤️🔥😂😮😢',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
            emoji:      { type: 'string', description: 'Эмодзи реакции (напр. 👍, ❤️, 🔥)' },
          },
          required: ['chat_id', 'message_id', 'emoji'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_edit',
        description: 'Редактировать своё сообщение в чате/канале',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения для редактирования' },
            new_text:   { type: 'string', description: 'Новый текст сообщения' },
          },
          required: ['chat_id', 'message_id', 'new_text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_forward',
        description: 'Переслать сообщение из одного чата в другой',
        parameters: {
          type: 'object',
          properties: {
            from_chat: { type: 'string', description: 'Чат-источник (ID или username)' },
            msg_id:    { type: 'number', description: 'ID сообщения для пересылки' },
            to_chat:   { type: 'string', description: 'Чат-назначение (ID или username)' },
          },
          required: ['from_chat', 'msg_id', 'to_chat'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_pin',
        description: 'Закрепить сообщение в чате/канале',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения для закрепления' },
            silent:     { type: 'boolean', description: 'Без уведомления (по умолчанию true)' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_mark_read',
        description: 'Пометить все сообщения в чате как прочитанные',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата/канала или username' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_comments',
        description: 'Получить комментарии к посту в канале. Для чтения обсуждений.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID канала или username' },
            post_id: { type: 'number', description: 'ID поста в канале' },
            limit:   { type: 'number', description: 'Количество комментариев (по умолчанию 30)' },
          },
          required: ['chat_id', 'post_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_typing',
        description: 'Показать статус "печатает" в чате. Используй перед отправкой сообщения для естественности.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'ID чата или username' },
          },
          required: ['chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_formatted',
        description: 'Отправить сообщение с HTML-форматированием (жирный, курсив, ссылки, код)',
        parameters: {
          type: 'object',
          properties: {
            chat_id:   { type: 'string', description: 'ID чата/канала или username' },
            html:      { type: 'string', description: 'HTML-текст: <b>bold</b>, <i>italic</i>, <a href="url">link</a>, <code>code</code>' },
            reply_to:  { type: 'number', description: 'ID сообщения для ответа (опционально)' },
          },
          required: ['chat_id', 'html'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_message_by_id',
        description: 'Получить конкретное сообщение по ID',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата/канала или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_unread',
        description: 'Получить список чатов с непрочитанными сообщениями. Используй для мониторинга новых сообщений.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Количество чатов (по умолчанию 10)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_file',
        description: 'Отправить файл/изображение в чат. Файл по URL будет скачан и отправлен.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:  { type: 'string', description: 'ID чата/канала или username' },
            file_url: { type: 'string', description: 'URL файла или путь к файлу' },
            caption:  { type: 'string', description: 'Подпись к файлу (опционально)' },
          },
          required: ['chat_id', 'file_url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_copy_media',
        description: 'Скопировать медиа (фото/видео/GIF/документ) из одного сообщения и отправить в другой чат. Скачивает медиа и пересылает.',
        parameters: {
          type: 'object',
          properties: {
            from_chat_id: { type: 'string', description: 'Чат-источник (ID или username)' },
            message_id:   { type: 'number', description: 'ID сообщения с медиа' },
            to_chat_id:   { type: 'string', description: 'Чат-получатель (ID или username)' },
            caption:      { type: 'string', description: 'Новая подпись (опционально)' },
          },
          required: ['from_chat_id', 'message_id', 'to_chat_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_media_info',
        description: 'Получить информацию о медиа в сообщении (тип, размер, имя файла) без скачивания.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:    { type: 'string', description: 'ID чата или username' },
            message_id: { type: 'number', description: 'ID сообщения' },
          },
          required: ['chat_id', 'message_id'],
        },
      },
    },
    // ── Extended Telegram tools ─────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'tg_delete_message',
        description: 'Удалить сообщение(я) в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_ids: { oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }], description: 'ID сообщения или массив ID' },
        }, required: ['chat_id', 'message_ids'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_poll',
        description: 'Создать голосование в чате/канале.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          question: { type: 'string', description: 'Вопрос голосования' },
          options: { type: 'array', items: { type: 'string' }, description: 'Варианты ответа (2-10)' },
          anonymous: { type: 'boolean', description: 'Анонимное (по умолчанию true)' },
          multiple_choice: { type: 'boolean', description: 'Множественный выбор' },
        }, required: ['chat_id', 'question', 'options'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_kick_user',
        description: 'Кикнуть пользователя из группы/канала (без бана, может вернуться).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID или username пользователя' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_ban_user',
        description: 'Забанить пользователя в группе/канале.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID или username пользователя' },
          duration_sec: { type: 'number', description: 'Длительность в секундах (0 = навсегда)' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unban_user',
        description: 'Разбанить пользователя.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID пользователя' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_mute_user',
        description: 'Замутить пользователя (запретить писать) в группе.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы' },
          user_id: { type: 'string', description: 'ID пользователя' },
          duration_sec: { type: 'number', description: 'На сколько секунд (по умолчанию 3600 = 1 час)' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_admins',
        description: 'Получить список администраторов группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_admin',
        description: 'Назначить пользователя администратором группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_id: { type: 'string', description: 'ID пользователя' },
          rights: { type: 'object', description: 'Права: { post_messages, edit_messages, delete_messages, ban_users, invite_users, pin_messages }' },
        }, required: ['chat_id', 'user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_invite_link',
        description: 'Создать пригласительную ссылку для группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_unpin',
        description: 'Открепить сообщение или все сообщения.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения (если не указать — открепит все)' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_schedule_message',
        description: 'Запланировать отправку сообщения на конкретное время.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
          send_at: { type: 'number', description: 'Unix timestamp когда отправить' },
        }, required: ['chat_id', 'text', 'send_at'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_chat_title',
        description: 'Изменить название группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          title: { type: 'string', description: 'Новое название' },
        }, required: ['chat_id', 'title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_chat_about',
        description: 'Изменить описание (about) группы/канала.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          about: { type: 'string', description: 'Новое описание' },
        }, required: ['chat_id', 'about'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_set_chat_photo',
        description: 'Изменить фото группы/канала (загрузить из URL).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          photo_url: { type: 'string', description: 'URL фото' },
        }, required: ['chat_id', 'photo_url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_group',
        description: 'Создать новую группу (чат).',
        parameters: { type: 'object', properties: {
          title: { type: 'string', description: 'Название группы' },
          user_ids: { type: 'array', items: { type: 'string' }, description: 'ID пользователей для добавления' },
        }, required: ['title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_create_channel',
        description: 'Создать новый канал.',
        parameters: { type: 'object', properties: {
          title: { type: 'string', description: 'Название канала' },
          about: { type: 'string', description: 'Описание канала' },
          megagroup: { type: 'boolean', description: 'Супергруппа вместо канала (по умолчанию false)' },
        }, required: ['title'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_invite_users',
        description: 'Пригласить пользователей в группу/канал.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
          user_ids: { type: 'array', items: { type: 'string' }, description: 'ID или usernames пользователей' },
        }, required: ['chat_id', 'user_ids'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_archive_chat',
        description: 'Архивировать чат.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_online_count',
        description: 'Получить количество онлайн-пользователей в группе/канале.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID группы/канала' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_contact',
        description: 'Поделиться контактом в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          phone: { type: 'string', description: 'Номер телефона' },
          first_name: { type: 'string', description: 'Имя' },
          last_name: { type: 'string', description: 'Фамилия' },
        }, required: ['chat_id', 'phone', 'first_name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_location',
        description: 'Отправить геолокацию в чат.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          lat: { type: 'number', description: 'Широта' },
          lng: { type: 'number', description: 'Долгота' },
        }, required: ['chat_id', 'lat', 'lng'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_history_count',
        description: 'Получить количество сообщений в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_album',
        description: 'Отправить альбом (несколько фото/видео) в чат.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          media_urls: { type: 'array', items: { type: 'string' }, description: 'Массив URL медиафайлов (до 10)' },
          caption: { type: 'string', description: 'Подпись к альбому' },
        }, required: ['chat_id', 'media_urls'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_profile_photos',
        description: 'Получить аватарки пользователя.',
        parameters: { type: 'object', properties: {
          user_id: { type: 'string', description: 'ID или username пользователя' },
          limit: { type: 'number', description: 'Количество (по умолчанию 5)' },
        }, required: ['user_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_silent',
        description: 'Отправить сообщение без уведомления (беззвучно).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
        }, required: ['chat_id', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_webpage',
        description: 'Извлечь превью URL (заголовок, описание, изображение).',
        parameters: { type: 'object', properties: {
          url: { type: 'string', description: 'URL для извлечения превью' },
        }, required: ['url'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_press_button',
        description: 'Нажать inline-кнопку на сообщении бота.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения с кнопками' },
          button_index: { type: 'number', description: 'Индекс кнопки (0 = первая)' },
        }, required: ['chat_id', 'message_id', 'button_index'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_chat_stats',
        description: 'Получить статистику контента в чате (фото, видео, документы, ссылки, голосовые).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
        }, required: ['chat_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_save_draft',
        description: 'Сохранить черновик сообщения в чате.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст черновика' },
        }, required: ['chat_id', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_with_buttons',
        description: 'Отправить сообщение с inline-кнопками (URL или callback).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст сообщения' },
          buttons: { type: 'array', items: { type: 'object', properties: {
            text: { type: 'string', description: 'Текст кнопки' },
            url: { type: 'string', description: 'URL (для URL-кнопки)' },
            data: { type: 'string', description: 'Callback data (для callback-кнопки)' },
          }, required: ['text'] }, description: 'Массив кнопок' },
        }, required: ['chat_id', 'text', 'buttons'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_poll_results',
        description: 'Получить результаты голосования.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          message_id: { type: 'number', description: 'ID сообщения с голосованием' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_sticker',
        description: 'Отправить стикер из стикерпака. Укажи shortName набора и индекс стикера (0 = первый).',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          sticker_set_name: { type: 'string', description: 'Short name стикерпака (например: HotCherry)' },
          index: { type: 'number', description: 'Индекс стикера в наборе (0 = первый). По умолчанию 0.' },
        }, required: ['chat_id', 'sticker_set_name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_gif',
        description: 'Найти и отправить GIF через @gif inline-бота. Случайная GIF из топ-5 результатов.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          query: { type: 'string', description: 'Поисковый запрос для GIF (например: "happy", "dance", "thumbs up")' },
        }, required: ['chat_id', 'query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_send_voice',
        description: 'Озвучить текст (TTS) и отправить голосовым сообщением. Макс 200 символов.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата' },
          text: { type: 'string', description: 'Текст для озвучки (макс 200 символов)' },
          lang: { type: 'string', description: 'Язык озвучки (ru, en, de, fr и т.д.). По умолчанию ru.' },
        }, required: ['chat_id', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_transcribe_voice',
        description: 'Расшифровать (транскрибировать) голосовое сообщение в текст через встроенный STT Telegram.',
        parameters: { type: 'object', properties: {
          chat_id: { type: 'string', description: 'ID чата с голосовым сообщением' },
          message_id: { type: 'number', description: 'ID голосового сообщения (из [voice msg_id=X] аннотации)' },
        }, required: ['chat_id', 'message_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tg_get_sticker_sets',
        description: 'Получить список установленных стикерпаков пользователя. Можно искать по названию.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'Поисковый запрос для фильтрации (опционально)' },
        }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'http_fetch',
        description: 'HTTP-запрос к любому URL (GET/POST). Для API, вебхуков, парсинга.',
        parameters: {
          type: 'object',
          properties: {
            url:     { type: 'string', description: 'URL запроса' },
            method:  { type: 'string', description: 'HTTP метод (GET/POST/PUT/DELETE)' },
            headers: { type: 'object', description: 'Заголовки запроса' },
            body:    { type: 'string', description: 'Тело запроса (для POST/PUT)' },
          },
          required: ['url'],
        },
      },
    },
    // ── GiftAsset / SwiftGifts market data tools ─────────────────
    {
      type: 'function',
      function: {
        name: 'get_gift_floor_real',
        description: 'Получить РЕАЛЬНЫЕ floor prices подарка на маркетплейсах (GetGems, MRKT, Portals, Fragment и др.) через GiftAsset + SwiftGifts API',
        parameters: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug/название подарка (например: "Plush Pepe", "Lol Pop", "Cupid Charm")' },
          },
          required: ['slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_sales_history',
        description: 'Получить историю последних продаж подарка (с ценами и датами)',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции подарка' },
            limit:           { type: 'number', description: 'Количество записей (макс 50)' },
            model_name:      { type: 'string', description: 'Фильтр по модели (опционально)' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_overview',
        description: 'Получить обзор рынка подарков: все коллекции с последними продажами + статистика апгрейдов',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_price_list',
        description: 'Получить прайс-лист floor цен по всем подаркам (все маркетплейсы)',
        parameters: {
          type: 'object',
          properties: {
            models: { type: 'string', description: 'Фильтр по моделям (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scan_real_arbitrage',
        description: 'Найти РЕАЛЬНЫЕ кросс-маркет арбитраж возможности (цены в TON). Возвращает buyPriceTon/sellPriceTon. Tonnel исключён из продаж.',
        parameters: {
          type: 'object',
          properties: {
            max_price_ton:  { type: 'number', description: 'Максимальная цена покупки в TON' },
            min_profit_pct: { type: 'number', description: 'Минимальная прибыль в % (default: 5)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gift_aggregator',
        description: 'Поиск лучших предложений подарка по всем маркетплейсам (SwiftGifts агрегатор). Каждый item содержит options.payload — готовый BOC для TON транзакции (можно сразу покупать!). Сортирует по редкости фона, потом по цене.',
        parameters: {
          type: 'object',
          properties: {
            name:       { type: 'string', description: 'Название подарка (например "Lol Pop", "Plush Pepe")' },
            receiver:   { type: 'number', description: 'Telegram user ID получателя подарка (обязательно для генерации payload)' },
            backdrop:   { type: 'string', description: 'Фильтр по фону: "All" (все), "Black", "Dark" и т.д.' },
            model:      { type: 'string', description: 'Фильтр по модели: "All" (все) или конкретная модель' },
            from_price: { type: 'number', description: 'Минимальная цена в TON' },
            to_price:   { type: 'number', description: 'Максимальная цена в TON' },
            market:     { type: 'array', items: { type: 'string' }, description: 'Маркетплейсы: tonnel, portals, Mrkt, getgems, fragment. По умолчанию offchain (tonnel, portals, Mrkt)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_top_deals',
        description: 'Топ-сделки дня — лучшие арбитражные возможности, ранжированные по прибыли (GiftAsset Pro API). Используй в начале каждого тика для быстрой разведки рынка.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_backdrop_floors',
        description: 'Цены флора по цветам фона (backdrop) для коллекции. Чёрный фон стоит в 2-5 раз дороже обычного. Используй для оценки конкретных листингов.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции (например "Plush Pepe"), пусто = все коллекции' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_user_portfolio',
        description: 'Получить портфель подарков пользователя Telegram (с оценкой стоимости)',
        parameters: {
          type: 'object',
          properties: {
            username:    { type: 'string', description: 'Telegram @username' },
            telegram_id: { type: 'string', description: 'Telegram user ID (альтернатива username)' },
          },
          required: [],
        },
      },
    },
    // ── New GiftAsset Pro tools ──
    {
      type: 'function',
      function: {
        name: 'get_collection_offers',
        description: 'Активные buy offers для коллекции — гарантированные покупатели по конкретным ценам. Если есть offer по цене X = можно продать МГНОВЕННО по X. Самый надёжный источник цены продажи.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
            min_price: { type: 'number', description: 'Минимальная цена оффера в TON' },
            max_price: { type: 'number', description: 'Максимальная цена оффера в TON' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_health',
        description: 'Индекс здоровья и жадности рынка по коллекциям. Высокий greed_index = перегрев (продавай). Низкий = недооценка (покупай). health_index = общая ликвидность.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_attribute_volumes',
        description: 'Объём продаж по атрибутам (backdrop/model) — какие варианты подарков покупают чаще. Полезно для понимания реального спроса.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции (пусто = все)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_unique_gift_prices',
        description: 'Цены уникальных подарков с разбивкой по вариантам (backdrop + model). Точные цены per-variant без смешения разного качества.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
          },
          required: [],
        },
      },
    },
    // ── Smart valuation tools ──
    {
      type: 'function',
      function: {
        name: 'find_underpriced_gifts',
        description: 'УМНЫЙ ПОИСК НЕДООЦЕНЁННЫХ ПОДАРКОВ. Сравнивает цену каждого листинга с fair value (флор по backdrop+model). Возвращает подарки, которые продаются НИЖЕ рыночной стоимости их атрибутов. Лучший инструмент для поиска выгодных покупок.',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Slug коллекции (lol-pop, jelly-bunny, plush-pepe и т.д.)' },
            max_price: { type: 'number', description: 'Максимальная цена в TON (бюджет)' },
            min_discount_pct: { type: 'number', description: 'Минимальный % скидки от fair value (default: 10)' },
          },
          required: ['collection'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_price_history',
        description: 'История цен коллекции за последние дни/недели. Показывает тренды: растёт, падает, стабильна. Используй для принятия решения: покупать сейчас или подождать.',
        parameters: {
          type: 'object',
          properties: {
            collection_name: { type: 'string', description: 'Название коллекции' },
          },
          required: ['collection_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_market_activity',
        description: 'Лента покупок/продаж/изменений цен в реальном времени. Показывает ЧТО покупают прямо сейчас, по какой цене, на каком маркете. Используй для анализа спроса и определения реальной ликвидности.',
        parameters: {
          type: 'object',
          properties: {
            gift: { type: 'string', description: 'Slug подарка (опционально — для конкретной коллекции)' },
            type: { type: 'string', enum: ['buy', 'listing', 'change_price'], description: 'Тип действия: buy=покупки, listing=новые листинги, change_price=изменения цен' },
            min_price: { type: 'number', description: 'Минимальная цена фильтра' },
            max_price: { type: 'number', description: 'Максимальная цена фильтра' },
            markets: { type: 'array', items: { type: 'string' }, description: 'Маркеты: tonnel, portals, Mrkt, getgems, fragment' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_collections_marketcap',
        description: 'Капитализация всех коллекций подарков. Общий объём рынка, топ коллекции по стоимости. Используй для обзора рынка и выбора перспективных коллекций.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── TonAPI Blockchain tools ──────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'ton_get_account',
        description: 'Получить полную информацию об аккаунте TON: баланс, статус, интерфейсы, имя. Работает с EQ/UQ и raw адресами.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес (EQ.../UQ.../0:hex)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_transactions',
        description: 'Получить последние транзакции аккаунта с деталями (суммы, адреса, комментарии)',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес' },
            limit:   { type: 'number', description: 'Количество транзакций (макс 100, по умолчанию 20)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_jettons',
        description: 'Получить список токенов (Jettons) на аккаунте с балансами и ценами',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес владельца' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_nfts',
        description: 'Получить NFT-коллекции и предметы на аккаунте',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес владельца' },
            limit:   { type: 'number', description: 'Количество (по умолчанию 50)' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_run_method',
        description: 'Вызвать GET-метод смарт-контракта (read-only). Например: get_pool_data, get_jetton_data, get_nft_data, seqno, get_wallet_data.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Адрес смарт-контракта' },
            method:  { type: 'string', description: 'Имя GET-метода (например: get_pool_data, seqno)' },
            args:    { type: 'array', items: { type: 'string' }, description: 'Аргументы метода (опционально)' },
          },
          required: ['address', 'method'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_rates',
        description: 'Получить курсы TON или любого жетона в fiat/крипто. Поддерживает: ton, jetton адреса. Валюты: usd, eur, rub, btc, eth.',
        parameters: {
          type: 'object',
          properties: {
            tokens:     { type: 'string', description: 'Токен(ы) через запятую: "ton" или адрес jetton' },
            currencies: { type: 'string', description: 'Валюты через запятую: "usd,rub,eur" (по умолчанию: "usd,rub")' },
          },
          required: ['tokens'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_dns_resolve',
        description: 'Резолвить TON DNS домен (например: "foundation.ton") в адрес. Также показывает привязанный кошелёк и сайт.',
        parameters: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'TON DNS домен (например: "foundation.ton", "telegram-bot.ton")' },
          },
          required: ['domain'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_staking_pools',
        description: 'Получить список стейкинг-пулов TON с APY, минимальным депозитом и статистикой',
        parameters: {
          type: 'object',
          properties: {
            available_for: { type: 'string', description: 'Адрес номинатора для фильтра (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_emulate_tx',
        description: 'Эмулировать транзакцию перед отправкой — показывает что произойдёт: изменения балансов, газ, ошибки. Безопасная "песочница" для проверки.',
        parameters: {
          type: 'object',
          properties: {
            boc: { type: 'string', description: 'Base64-encoded BOC транзакции для эмуляции' },
          },
          required: ['boc'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_send_boc',
        description: 'Отправить BOC (сырую транзакцию) в сеть TON. ⚠️ НЕОБРАТИМО — транзакция будет исполнена. Используй ton_emulate_tx для проверки перед отправкой.',
        parameters: {
          type: 'object',
          properties: {
            boc: { type: 'string', description: 'Base64-encoded BOC для отправки' },
          },
          required: ['boc'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_get_validators',
        description: 'Получить список текущих валидаторов сети TON',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ton_parse_address',
        description: 'Парсинг TON адреса — конвертация между форматами (bounceable EQ, non-bounceable UQ, raw 0:hex)',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес в любом формате' },
          },
          required: ['address'],
        },
      },
    },
    // ── Plugin tools ──
    {
      type: 'function',
      function: {
        name: 'list_plugins',
        description: 'Получить список всех доступных плагинов платформы (DeFi, аналитика, уведомления, безопасность). Используй чтобы узнать какие плагины есть и предложить пользователю нужный.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'suggest_plugin',
        description: 'Порекомендовать плагин пользователю на основе задачи. Возвращает подходящие плагины с описанием.',
        parameters: {
          type: 'object',
          properties: {
            task_description: { type: 'string', description: 'Описание задачи пользователя — агент подберёт подходящий плагин' },
          },
          required: ['task_description'],
        },
      },
    },
    // ── Inter-agent tools ──
    {
      type: 'function',
      function: {
        name: 'list_my_agents',
        description: 'Список всех агентов текущего пользователя. Используй чтобы узнать к кому можно обратиться.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ask_agent',
        description: 'Отправить сообщение другому агенту пользователя. Агент ответит на следующем тике. Используй только если пользователь разрешил межагентную коммуникацию.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'number', description: 'ID агента которому отправляем сообщение' },
            message:  { type: 'string', description: 'Текст сообщения агенту' },
          },
          required: ['agent_id', 'message'],
        },
      },
    },
    // ── Custom plugins tools ──
    {
      type: 'function',
      function: {
        name: 'run_custom_plugin',
        description: 'Выполнить пользовательский плагин по имени. Плагин — JavaScript код, созданный пользователем через /plugin create.',
        parameters: {
          type: 'object',
          properties: {
            name:   { type: 'string', description: 'Имя плагина' },
            params: { type: 'object', description: 'Параметры для плагина (передаются как объект params)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_custom_plugins',
        description: 'Показать список пользовательских плагинов.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Director & Manager tools ──
    ...((agentRole === 'director' || agentRole === 'manager') ? [
      {
        type: 'function' as const,
        function: {
          name: 'assign_task',
          description: 'Назначить задачу реальному человеку через Telegram. Агент отправит ему сообщение с описанием задачи и кнопками Принять/Отклонить.',
          parameters: {
            type: 'object',
            properties: {
              telegram_user_id: { type: 'number', description: 'Telegram ID пользователя, которому назначить задачу' },
              task:             { type: 'string', description: 'Описание задачи' },
              deadline:         { type: 'string', description: 'Дедлайн (опционально, напр. "завтра 18:00")' },
            },
            required: ['telegram_user_id', 'task'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'check_tasks',
          description: 'Проверить статус всех назначенных задач (pending/accepted/rejected/done)',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'manage_agent',
          description: 'Управлять другим агентом: запустить, остановить, получить статус или логи',
          parameters: {
            type: 'object',
            properties: {
              agent_id: { type: 'number', description: 'ID агента для управления' },
              action:   { type: 'string', enum: ['start', 'stop', 'status', 'logs'], description: 'Действие' },
            },
            required: ['agent_id', 'action'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'send_report',
          description: 'Отправить отчёт/сообщение руководителю (реальному человеку) через Telegram',
          parameters: {
            type: 'object',
            properties: {
              user_id: { type: 'number', description: 'Telegram ID получателя' },
              report:  { type: 'string', description: 'Текст отчёта' },
            },
            required: ['user_id', 'report'],
          },
        },
      },
    ] : []),
    // ── apply / remove plugin ──
    {
      type: 'function' as const,
      function: {
        name: 'apply_plugin',
        description: 'Подключить плагин к этому агенту. Документация плагина будет доступна на следующем тике.',
        parameters: {
          type: 'object',
          properties: {
            plugin_id: { type: 'string', description: 'ID плагина (из list_plugins)' },
          },
          required: ['plugin_id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'remove_plugin',
        description: 'Отключить плагин от этого агента.',
        parameters: {
          type: 'object',
          properties: {
            plugin_id: { type: 'string', description: 'ID плагина' },
          },
          required: ['plugin_id'],
        },
      },
    },
    // ── Self-modification tools (agent evolves itself) ──
    {
      type: 'function' as const,
      function: {
        name: 'get_my_config',
        description: 'Получить свой текущий системный промпт, интервал и описание. Используй перед update_my_prompt чтобы понять что менять.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_my_prompt',
        description: 'Обновить свой системный промпт (свою "душу"). Используй когда пользователь просит изменить твоё поведение, роль, стиль или задачи. Пиши ПОЛНЫЙ новый промпт — он заменит текущий целиком.',
        parameters: {
          type: 'object',
          properties: {
            new_prompt: { type: 'string', description: 'Новый полный системный промпт (заменит текущий)' },
            reason: { type: 'string', description: 'Почему меняешь промпт (для лога)' },
          },
          required: ['new_prompt'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_my_interval',
        description: 'Изменить интервал проактивных тиков (как часто ты просыпаешься для самостоятельных действий). 0 = только реактивный режим.',
        parameters: {
          type: 'object',
          properties: {
            interval_minutes: { type: 'number', description: 'Интервал в минутах (0 = отключить проактивность, 5-60 минут рекомендуется)' },
          },
          required: ['interval_minutes'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_my_description',
        description: 'Обновить своё описание (видно в меню агентов).',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Новое описание агента' },
          },
          required: ['description'],
        },
      },
    },
    // ── Workflow / Planning tools ──
    {
      type: 'function' as const,
      function: {
        name: 'create_plan',
        description: 'Создать пошаговый план действий. Каждый шаг будет выполнен последовательно. Используй для сложных задач.',
        parameters: {
          type: 'object',
          properties: {
            plan_name: { type: 'string', description: 'Название плана' },
            steps: {
              type: 'array',
              description: 'Шаги плана в порядке выполнения',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string', description: 'Описание действия' },
                  tool: { type: 'string', description: 'Какой тул вызвать (опционально)' },
                  condition: { type: 'string', description: 'Условие выполнения (опционально, например: "если цена > 100")' },
                },
                required: ['action'],
              },
            },
          },
          required: ['plan_name', 'steps'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_execution_stats',
        description: 'Получить статистику своей работы: сколько запусков, тулов вызвано, ошибок, токенов потрачено.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Knowledge store ──
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_save',
        description: 'Сохранить важную информацию в долгосрочную память (knowledge base). Используй для фактов, контактов, правил, заметок.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Категория: contacts, rules, facts, notes, tasks' },
            title: { type: 'string', description: 'Краткий заголовок' },
            content: { type: 'string', description: 'Содержимое записи' },
            tags: { type: 'string', description: 'Теги через запятую (опционально)' },
          },
          required: ['category', 'title', 'content'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_search',
        description: 'Поиск по базе знаний агента. Ищет по тексту, категории и тегам.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос (ищет в title и content)' },
            category: { type: 'string', description: 'Фильтр по категории (опционально)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_list',
        description: 'Показать все записи в базе знаний агента, по категориям.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Фильтр по категории (опционально)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'knowledge_delete',
        description: 'Удалить запись из базы знаний по ID.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID записи для удаления' },
          },
          required: ['id'],
        },
      },
    },
    // ── Schedule / Cron ──
    {
      type: 'function' as const,
      function: {
        name: 'schedule_action',
        description: 'Запланировать действие на будущее. Агент выполнит его в указанное время.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Описание действия (будет передано как pending task)' },
            when: { type: 'string', description: 'Когда выполнить: "in 30 minutes", "at 18:00", "tomorrow 10:00"' },
          },
          required: ['action', 'when'],
        },
      },
    },
    // ── Image processing tools ──
    {
      type: 'function' as const,
      function: {
        name: 'image_download',
        description: 'Скачать изображение по URL во временный файл. Возвращает путь к файлу.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL изображения для скачивания' },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_resize',
        description: 'Изменить размер изображения. Можно указать ширину и/или высоту.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            width: { type: 'number', description: 'Новая ширина в пикселях (опционально)' },
            height: { type: 'number', description: 'Новая высота в пикселях (опционально)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_crop',
        description: 'Обрезать изображение по координатам.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            left: { type: 'number', description: 'Отступ слева (px)' },
            top: { type: 'number', description: 'Отступ сверху (px)' },
            width: { type: 'number', description: 'Ширина области обрезки (px)' },
            height: { type: 'number', description: 'Высота области обрезки (px)' },
          },
          required: ['path', 'left', 'top', 'width', 'height'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_add_text',
        description: 'Добавить текст (водяной знак) на изображение.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            text: { type: 'string', description: 'Текст для наложения' },
            position: { type: 'string', enum: ['top', 'bottom', 'center'], description: 'Позиция текста (по умолчанию bottom)' },
            font_size: { type: 'number', description: 'Размер шрифта (по умолчанию 32)' },
            color: { type: 'string', description: 'Цвет текста (по умолчанию white)' },
          },
          required: ['path', 'text'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_filter',
        description: 'Применить фильтр к изображению: blur, sharpen, grayscale, negate, flip, flop, rotate90, rotate180.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            filter: { type: 'string', enum: ['blur', 'sharpen', 'grayscale', 'negate', 'flip', 'flop', 'rotate90', 'rotate180'], description: 'Фильтр для применения' },
          },
          required: ['path', 'filter'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_convert',
        description: 'Конвертировать изображение в другой формат (png, jpg, webp).',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
            format: { type: 'string', enum: ['png', 'jpg', 'webp'], description: 'Целевой формат' },
          },
          required: ['path', 'format'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_info',
        description: 'Получить информацию об изображении: размеры, формат, вес файла.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Путь к файлу изображения' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_composite',
        description: 'Наложить одно изображение на другое (overlay).',
        parameters: {
          type: 'object',
          properties: {
            base_path: { type: 'string', description: 'Путь к базовому изображению' },
            overlay_path: { type: 'string', description: 'Путь к изображению-оверлею' },
            x: { type: 'number', description: 'X координата наложения (по умолчанию 0)' },
            y: { type: 'number', description: 'Y координата наложения (по умолчанию 0)' },
            opacity: { type: 'number', description: 'Прозрачность оверлея 0-1 (по умолчанию 1)' },
          },
          required: ['base_path', 'overlay_path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_create_text',
        description: 'Создать изображение с текстом на цветном фоне (для мемов, баннеров и т.д.).',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Текст для изображения' },
            width: { type: 'number', description: 'Ширина (по умолчанию 800)' },
            height: { type: 'number', description: 'Высота (по умолчанию 400)' },
            bg_color: { type: 'string', description: 'Цвет фона (по умолчанию #1a1a2e)' },
            text_color: { type: 'string', description: 'Цвет текста (по умолчанию white)' },
            font_size: { type: 'number', description: 'Размер шрифта (по умолчанию 48)' },
          },
          required: ['text'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'image_analyze',
        description: 'Анализировать изображение с помощью AI Vision. Можно задать вопрос об изображении.',
        parameters: {
          type: 'object',
          properties: {
            path_or_url: { type: 'string', description: 'Путь к файлу или URL изображения' },
            question: { type: 'string', description: 'Вопрос об изображении (по умолчанию: описать изображение)' },
          },
          required: ['path_or_url'],
        },
      },
    },
  ];

  // Append MCP tools (dynamically discovered from @ton/mcp server)
  if (mcpTools && mcpTools.length > 0) {
    allTools.push(...mcpTools);
  }

  // Filter by enabled capabilities
  if (enabledCapabilities && enabledCapabilities.length > 0) {
    const allowed = new Set<string>();
    for (const capId of enabledCapabilities) {
      const tools = CAPABILITY_TOOL_MAP[capId];
      if (tools) tools.forEach(t => allowed.add(t));
    }
    // Always allow core tools (state, notify, self-awareness, events)
    ['get_state', 'get_state_multi', 'set_state', 'list_state_keys', 'notify', 'notify_rich', 'apply_plugin', 'remove_plugin',
     'list_plugins', 'suggest_plugin', 'get_my_config', 'update_my_prompt', 'update_my_interval', 'update_my_description',
     'create_plan', 'get_execution_stats', 'knowledge_save', 'knowledge_search', 'knowledge_list', 'knowledge_delete', 'schedule_action',
     // Self-awareness & learning (MUST always be available)
     'remember', 'recall', 'update_self_prompt', 'save_lesson', 'manage_goals', 'request_pause', 'rollback_prompt',
     // Dossier system (contact/chat memory)
     'get_contact_dossier', 'add_contact_note', 'set_contact_relationship', 'get_chat_dossier', 'add_chat_note', 'list_contacts',
     // Chat policy management
     'set_chat_policy', 'list_chat_policies',
     // Event-driven (agent decides when to wake up)
     'set_next_wake', 'subscribe_event', 'unsubscribe_event', 'emit_event', 'get_wake_info',
    ].forEach(t => allowed.add(t));
    // Always allow MCP tools if ton_mcp capability is enabled
    if (enabledCapabilities.includes('ton_mcp') && mcpTools) {
      mcpTools.forEach(t => allowed.add((t as any).function.name));
    }
    return allTools.filter(t => allowed.has((t as any).function.name));
  }

  return allTools;
}

// ── Tool RAG: select top-K relevant tools per message ──────────────────────

const TOOL_RELEVANCE: Record<string, string[]> = {
  'get_ton_balance|send_ton|get_agent_wallet|get_nft_floor|send_jetton': ['ton', 'тон', 'крипт', 'crypto', 'баланс', 'balance', 'кошел', 'wallet', 'nft', 'отправ', 'send', 'перевод', 'transfer'],
  'get_gift_floor|scan_real_arbitrage|get_market_overview|get_price_list|buy_catalog_gift|buy_resale_gift|list_gift_for_sale|get_gift_aggregator|get_user_portfolio|get_gift_sales_history': ['подарк', 'gift', 'арбитраж', 'arbitrage', 'трейд', 'trade', 'торг', 'buy', 'sell', 'купить', 'продать', 'floor', 'маркет', 'market'],
  'image_download|image_resize|image_crop|image_add_text|image_filter|image_convert|image_info|image_composite|image_create_text|image_analyze': ['фото', 'photo', 'картинк', 'image', 'изображ', 'picture', 'resize', 'crop', 'фильтр', 'filter', 'водяной знак', 'watermark', 'текст на', 'мем', 'meme'],
  'web_search|fetch_url|tg_get_webpage': ['поиск', 'search', 'найди', 'find', 'сайт', 'site', 'url', 'http', 'ссылк', 'link', 'новост', 'news', 'статья', 'article'],
  'tg_send_formatted|tg_pin|tg_unpin|tg_set_chat_title|tg_set_chat_about|tg_set_chat_photo|tg_create_invite_link|tg_get_channel_info|tg_get_comments|tg_schedule_message': ['канал', 'channel', 'пост', 'post', 'публик', 'publish', 'закреп', 'pin', 'описание', 'about', 'название', 'title', 'инвайт', 'invite'],
  'tg_kick_user|tg_ban_user|tg_unban_user|tg_mute_user|tg_set_admin|tg_get_admins': ['бан', 'ban', 'кик', 'kick', 'мут', 'mute', 'админ', 'admin', 'модер', 'moder'],
  'tg_send_file|tg_send_album|tg_copy_media|tg_get_media_info|tg_send_sticker|tg_send_gif|tg_send_voice': ['медиа', 'media', 'файл', 'file', 'фото', 'photo', 'видео', 'video', 'стикер', 'sticker', 'гиф', 'gif', 'голос', 'voice', 'альбом', 'album'],
  'tg_create_poll|tg_get_poll_results': ['голосов', 'poll', 'опрос', 'quiz', 'vote'],
  'get_state|set_state|knowledge_save|knowledge_search|add_contact_note|add_chat_note|get_contact_dossier|get_chat_dossier|save_lesson': ['запомн', 'remember', 'память', 'memory', 'состояние', 'state', 'знания', 'knowledge', 'досье', 'dossier', 'контакт', 'contact'],
  'update_self_prompt|update_my_prompt|rollback_prompt': ['промпт', 'prompt', 'улучш', 'improv', 'обнов', 'update', 'измени себя'],
  'ton_get_account|ton_get_transactions|ton_get_jettons|ton_get_nfts|ton_run_method|ton_get_rates|ton_dns_resolve': ['блокчейн', 'blockchain', 'транзакц', 'transaction', 'аккаунт', 'account', 'jetton', 'жетон', 'dns'],
  'dex_get_prices|dex_swap_simulate': ['dex', 'дефи', 'defi', 'swap', 'обмен', 'цена', 'price', 'dedust', 'ston'],
  'buy_market_gift|get_fragment_listings|appraise_gift|get_gift_catalog': ['fragment', 'фрагмент', 'каталог', 'catalog', 'оценк', 'apprais', 'листинг', 'listing'],
};

const CORE_TOOLS = new Set([
  'tg_reply', 'tg_send_message', 'tg_get_messages', 'tg_react', 'tg_edit',
  'tg_mark_read', 'tg_set_typing', 'tg_search_messages', 'tg_get_user_info',
  'get_state', 'set_state', 'notify', 'web_search', 'fetch_url',
  'knowledge_save', 'knowledge_search', 'set_next_wake',
  'add_contact_note', 'add_chat_note', 'get_contact_dossier', 'get_chat_dossier',
  'tg_get_channel_info', 'tg_send_formatted',
]);

export function selectRelevantTools(allTools: any[], message: string, systemPrompt: string, maxTools: number = 40): any[] {
  if (allTools.length <= maxTools) return allTools;

  const textLower = (message + ' ' + systemPrompt).toLowerCase();

  const scored: { tool: any; score: number }[] = allTools.map(t => {
    const name = t.function?.name || t.name || '';

    // Core tools always get high score
    if (CORE_TOOLS.has(name)) return { tool: t, score: 100 };

    // Check category relevance
    let catScore = 0;
    for (const [toolPattern, keywords] of Object.entries(TOOL_RELEVANCE)) {
      if (new RegExp(toolPattern).test(name)) {
        for (const kw of keywords) {
          if (textLower.includes(kw)) { catScore = 50; break; }
        }
        break;
      }
    }

    // Tool name mentioned in text
    if (textLower.includes(name.replace(/_/g, ' ')) || textLower.includes(name)) catScore = Math.max(catScore, 60);

    return { tool: t, score: catScore };
  });

  // Sort by score desc, take top maxTools
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, maxTools).map(s => s.tool);

  console.log(`[ToolRAG] Selected ${selected.length}/${allTools.length} tools (${scored.filter(s => s.score > 0).length} relevant)`);
  return selected;
}

// ── Observation Masking: compress old tool results to save context ──────────

function compressOldToolResults(messages: any[], keepLastN: number = 2): any[] {
  let toolResultCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'tool' || messages[i].role === 'function') {
      toolResultCount++;
      if (toolResultCount > keepLastN) {
        const content = typeof messages[i].content === 'string' ? messages[i].content : JSON.stringify(messages[i].content);
        if (content.length > 200) {
          messages[i] = {
            ...messages[i],
            content: content.slice(0, 100) + `... [truncated ${content.length} chars]`,
          };
        }
      }
    }
  }
  return messages;
}

// ── Tool executor ──────────────────────────────────────────────────────────

// ── Human-in-the-Loop: dangerous actions that require user approval ──
const DANGEROUS_ACTIONS: Record<string, { label: string; descFn: (args: Record<string, any>) => string }> = {
  'send_ton':           { label: '💸 Отправка TON',      descFn: a => `Отправить ${a.amount} TON → ${String(a.to).slice(0, 20)}...${a.comment ? ' ('+a.comment+')' : ''}` },
  'send_jetton':        { label: '💸 Отправка Jetton',   descFn: a => `Отправить ${a.amount} jetton ${String(a.jetton_master).slice(0, 16)}... → ${String(a.to).slice(0, 20)}...` },
  'buy_catalog_gift':   { label: '🎁 Покупка подарка',   descFn: a => `Купить подарок "${a.gift_name || a.gift_id}" из каталога` },
  'buy_resale_gift':    { label: '🎁 Покупка с перепродажи', descFn: a => `Купить подарок #${a.gift_id} с перепродажи` },
  'buy_market_gift':    { label: '🎁 Покупка на маркете', descFn: a => `Купить подарок "${a.name}" за ${a.max_price || '?'} ⭐` },
  'list_gift_for_sale': { label: '📤 Листинг на продажу', descFn: a => `Выставить подарок #${a.gift_id} за ${a.price} ⭐` },
  'ton_send_boc':       { label: '📦 Отправка BOC',      descFn: a => `Отправить сырую транзакцию в сеть TON` },
};

// Pending approval futures: approvalId → { resolve, reject }
const _approvalWaiters = new Map<number, { resolve: (v: 'approved' | 'rejected') => void; timer: any }>();

export function resolveApprovalWaiter(approvalId: number, status: 'approved' | 'rejected'): boolean {
  const w = _approvalWaiters.get(approvalId);
  if (!w) return false;
  clearTimeout(w.timer);
  w.resolve(status);
  _approvalWaiters.delete(approvalId);
  return true;
}

async function requestApproval(
  name: string,
  args: Record<string, any>,
  params: AIAgentTickParams,
  dangerInfo: { label: string; descFn: (a: Record<string, any>) => string },
): Promise<'approved' | 'rejected' | 'timeout'> {
  try {
    const { getAgentApprovalsRepository } = await import('../db/schema-extensions');
    const desc = dangerInfo.descFn(args);
    const row = await getAgentApprovalsRepository().create(params.agentId, params.userId, name, { args, description: desc });
    const approvalId = row.id;

    // Send rich notification with approve/reject buttons
    await notifyRich(params.userId, {
      text: `⚠️ <b>Агент запрашивает подтверждение</b>\n\n` +
            `${dangerInfo.label}\n` +
            `📋 ${desc}\n\n` +
            `🤖 Агент #${params.agentId}\n` +
            `⏱ Таймаут: 5 минут`,
      agentId: params.agentId,
      buttons: [
        [
          { text: '✅ Одобрить', callback_data: `approve_action:${approvalId}` },
          { text: '❌ Отклонить', callback_data: `reject_action:${approvalId}` },
        ],
      ],
    });

    // Wait for user response (max 5 minutes)
    return new Promise<'approved' | 'rejected' | 'timeout'>((resolve) => {
      const timer = setTimeout(() => {
        _approvalWaiters.delete(approvalId);
        resolve('timeout');
      }, 5 * 60 * 1000);
      _approvalWaiters.set(approvalId, { resolve: resolve as any, timer, _createdAt: Date.now() });
    });
  } catch (e: any) {
    console.error('[HITL] Approval request failed:', e.message);
    return 'timeout'; // fail-safe: don't execute
  }
}

// ── Daily spend cap enforcement ────────────────────────────────────────────
async function checkDailySpendCap(agentId: number, userId: number, amountTon: number): Promise<string | null> {
  try {
    const { getAgentDailySpendRepository } = await import('../db/schema-extensions');
    const spendRepo = getAgentDailySpendRepository();
    const amountNano = BigInt(Math.round(amountTon * 1e9));
    // Check agent-specific limit from state, or use default
    const stateRepo = getAgentStateRepository();
    const customLimit = await stateRepo.get(agentId, 'daily_spend_limit_ton').catch(() => null);
    const limitTon = customLimit ? Number((customLimit as any).value || DAILY_SPEND_LIMIT_TON) : DAILY_SPEND_LIMIT_TON;
    const limitNano = BigInt(Math.round(limitTon * 1e9));
    const canSpend = await spendRepo.canSpend(agentId, amountNano, limitNano);
    if (!canSpend) {
      const spentNano = await spendRepo.getSpent(agentId);
      const spentTon = Number(spentNano) / 1e9;
      return `Daily spend limit reached: ${spentTon.toFixed(2)}/${limitTon} TON spent today. Try again tomorrow or ask user to increase limit.`;
    }
    return null; // OK to spend
  } catch (e: any) {
    console.warn(`[DailySpend] check failed for agent #${agentId}: ${e.message}`);
    return null; // fail-open: allow if DB error
  }
}

async function recordDailySpend(agentId: number, userId: number, amountTon: number): Promise<void> {
  try {
    const { getAgentDailySpendRepository } = await import('../db/schema-extensions');
    const spendRepo = getAgentDailySpendRepository();
    const amountNano = BigInt(Math.round(amountTon * 1e9));
    await spendRepo.addSpend(agentId, userId, amountNano);
  } catch (e: any) {
    console.warn(`[DailySpend] record failed for agent #${agentId}: ${e.message}`);
  }
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  params: AIAgentTickParams,
): Promise<any> {
  const gifts  = getTelegramGiftsService();
  const stateRepo = getAgentStateRepository();

  // ── Tool rate limiting ──
  if (!checkToolRateLimit(params.agentId, name)) {
    const group = TOOL_GROUP_MAP[name] || 'unknown';
    await logToDb(params.agentId, 'warn', `[RateLimit] ${name} (${group} group) rate limited`, params.userId);
    return { error: `Rate limited: too many ${group} operations. Wait a moment before retrying.` };
  }

  // ── Daily spend cap check for financial actions ──
  if (name === 'send_ton' || name === 'send_jetton') {
    const amount = Number(args.amount) || 0;
    const amountTon = name === 'send_ton' ? amount : 0.05; // jetton tx costs ~0.05 TON gas
    const capErr = await checkDailySpendCap(params.agentId, params.userId, amountTon);
    if (capErr) {
      await logToDb(params.agentId, 'warn', `[DailySpend] Blocked ${name}: ${capErr}`, params.userId);
      return { error: capErr };
    }
  }

  // ── Human-in-the-Loop: check if action needs approval ──
  const dangerInfo = DANGEROUS_ACTIONS[name];
  if (dangerInfo) {
    // Check if user disabled approval for this agent
    const autoApprove = await stateRepo.get(params.agentId, 'auto_approve').catch(() => null);
    if (!autoApprove || autoApprove !== 'true') {
      await logToDb(params.agentId, 'info', `[HITL] Requesting approval for ${name}(${JSON.stringify(args).slice(0, 150)})`, params.userId);
      const decision = await requestApproval(name, args, params, dangerInfo);
      if (decision === 'rejected') {
        await logToDb(params.agentId, 'info', `[HITL] User REJECTED ${name}`, params.userId);
        // Save rejection as a lesson so agent learns
        try {
          const lessonKey = `lesson:rejection_${Date.now()}`;
          const lessonValue = JSON.stringify({
            type: 'rejection',
            tool: name,
            args: JSON.stringify(args).slice(0, 200),
            lesson: `User rejected ${dangerInfo.label}: ${dangerInfo.descFn(args)}. Don't repeat this action without explicit user instruction.`,
            savedAt: new Date().toISOString(),
          });
          await stateRepo.set(params.agentId, params.userId, lessonKey, lessonValue);
        } catch {}
        return { error: 'Пользователь отклонил действие. Не выполняй его повторно без явного указания.' };
      }
      if (decision === 'timeout') {
        await logToDb(params.agentId, 'warn', `[HITL] Approval TIMEOUT for ${name}`, params.userId);
        return { error: 'Пользователь не ответил на запрос подтверждения (таймаут 5 мин). Попробуй позже или уведоми пользователя.' };
      }
      await logToDb(params.agentId, 'info', `[HITL] User APPROVED ${name}`, params.userId);
    }
  }

  // ── MCP tools (dynamically routed to @ton/mcp server) ──
  if (name.startsWith('mcp_')) {
    const { getTonMcpManager } = await import('../services/ton-mcp-client');
    const mcpToolName = name.slice(4); // strip "mcp_" prefix
    try {
      return await getTonMcpManager().callTool(params.agentId, mcpToolName, args);
    } catch (e: any) {
      return { error: `MCP tool error: ${e.message}` };
    }
  }

  switch (name) {
    case 'get_ton_balance': {
      try {
        const addr = args.address as string;
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res  = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        const bal  = data.balance ? (parseInt(data.balance) / 1e9).toFixed(4) : '0';
        return { address: addr, balance_ton: bal, status: data.status };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_nft_floor': {
      try {
        const raw = args.collection as string;
        const tonApiKey = args.ton_api_key || params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;

        // Convert EQ to raw if needed
        function eqToRaw(addr: string): string {
          try {
            const b64 = addr.slice(2).replace(/-/g, '+').replace(/_/g, '/');
            const buf = Buffer.from(b64, 'base64');
            const wc  = buf[1] === 0xff ? -1 : buf[1];
            const hex = buf.slice(2, 34).toString('hex');
            return `${wc}:${hex}`;
          } catch { return addr; }
        }

        let collAddr = raw;
        if (raw.includes('getgems.io')) {
          const m = raw.match(/\/collection\/(EQ[A-Za-z0-9_\-]+)/);
          if (m) collAddr = m[1];
        }
        const rawAddr = /^EQ|^UQ/.test(collAddr) ? eqToRaw(collAddr) : collAddr;

        const url = `https://tonapi.io/v2/nfts/collections/${encodeURIComponent(rawAddr)}/items?limit=30&offset=0`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;

        const prices: number[] = [];
        for (const item of (data.nft_items || [])) {
          const s = item.sale;
          if (s?.price?.value) prices.push(parseInt(s.price.value) / 1e9);
        }
        prices.sort((a, b) => a - b);
        const floor = prices[0] ?? null;
        return { collection: collAddr, floor_ton: floor, listed_count: prices.length, top_prices: prices.slice(0, 5) };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_gift_catalog': {
      const catalog = await gifts.getAvailableGifts();
      return { count: catalog.length, gifts: catalog.slice(0, 30) };
    }

    case 'get_fragment_listings': {
      const listings = await gifts.getFragmentListings(args.gift_slug as string, args.limit ?? 20);
      return { slug: args.gift_slug, count: listings.length, listings };
    }

    case 'appraise_gift': {
      return await gifts.appraiseGift(args.slug as string);
    }

    case 'scan_arbitrage': {
      const opps = await gifts.scanArbitrageOpportunities({
        maxPriceStars: args.max_price_stars,
        minProfitPct:  args.min_profit_pct,
        tonApiKey:     params.config.TONAPI_KEY,
      });
      return { count: opps.length, opportunities: opps };
    }

    case 'buy_catalog_gift': {
      if (args.use_userbot) {
        return await gifts.buyGiftUserbot(String(args.gift_id), Number(args.recipient_id));
      }
      return await gifts.buyGiftBot(String(args.gift_id), Number(args.recipient_id));
    }

    case 'buy_resale_gift': {
      return await gifts.buyResaleGift(args.slug as string);
    }

    case 'list_gift_for_sale': {
      return await gifts.listGiftForSale(Number(args.msg_id), Number(args.price_stars));
    }

    case 'get_stars_balance': {
      return await gifts.getStarsBalance();
    }

    case 'get_gift_upgrade_stats': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const slug = (args.slug as string || '').toLowerCase().replace(/\s+/g, '-');
        // Get upgrade statistics
        const [floorData, catalogData] = await Promise.allSettled([
          ga.getFloorPrices(slug),
          ga.getPriceList(),
        ]);
        const floor = floorData.status === 'fulfilled' ? floorData.value : null;
        const catalog = catalogData.status === 'fulfilled' ? catalogData.value : null;
        // Find this gift in catalog
        const giftCatalogEntry = Array.isArray(catalog)
          ? catalog.find((g: any) =>
              (g.slug || '').toLowerCase().includes(slug) ||
              (g.name || '').toLowerCase().includes(slug)
            )
          : null;
        return {
          slug,
          floor_prices: floor,
          catalog_entry: giftCatalogEntry,
          note: 'Upgrade cost depends on current edition number. Lower numbers cost more Stars. Check floor price to estimate profitability.',
        };
      } catch (e: any) {
        return { slug: args.slug, error: e.message, note: 'Try get_gift_floor_real or get_gift_catalog for available data.' };
      }
    }

    case 'analyze_gift_profitability': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const slug = (args.slug as string || '').toLowerCase().replace(/\s+/g, '-');
        const budgetTon = Number(args.budget_ton || 999999);
        const [floorData, salesData, aggData] = await Promise.allSettled([
          ga.getFloorPrices(slug),
          ga.getUniqueSales(slug, 20),
          ga.swAggregate({ name: slug, page: 0, receiver: Number(params.userId || 0) }),
        ]);
        const floor = floorData.status === 'fulfilled' ? floorData.value : null;
        const sales = salesData.status === 'fulfilled' ? salesData.value : null;
        const agg = aggData.status === 'fulfilled' ? aggData.value : null;
        // Find cheapest offer (swAggregate returns { total, items[] })
        const cheapest = (agg as any)?.items?.[0] || null;
        const cheapestPriceTon = cheapest?.price_ton ? Number(cheapest.price_ton) : (cheapest?.price ? Number(cheapest.price) : null);
        const floorTon = (floor as any)?.min_price_ton || null;
        const withinBudget = cheapestPriceTon && cheapestPriceTon <= budgetTon;
        return {
          slug,
          analysis: {
            cheapest_offer_ton: cheapestPriceTon,
            floor_ton: floorTon,
            within_budget: withinBudget,
            recommendation: withinBudget && floorTon && cheapestPriceTon && floorTon > cheapestPriceTon * 1.1
              ? `✅ BUY: cheapest=${cheapestPriceTon} TON, floor=${floorTon} TON, spread=${((floorTon/cheapestPriceTon-1)*100).toFixed(1)}% profit`
              : '⚠️ Not obviously profitable at current prices',
          },
          floor_data: floor,
          recent_sales: Array.isArray(sales) ? sales.slice(0, 5) : sales,
          cheapest_offers: (agg as any)?.items?.slice(0, 5) || null,
        };
      } catch (e: any) {
        return { slug: args.slug, error: e.message };
      }
    }

    case 'buy_market_gift': {
      try {
        const walletAddr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        const walletMn   = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        if (!walletAddr || !walletMn) {
          return { error: 'Agent wallet not created. Call get_agent_wallet first, then have user deposit TON.' };
        }
        const priceTon = Number(args.price_ton);
        if (!priceTon || priceTon <= 0) return { error: 'price_ton must be > 0' };

        // Check balance before sending
        let balanceTon = 0;
        try {
          const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(walletAddr)}`, {
            headers: { Authorization: `Bearer ${process.env.TONAPI_KEY || ''}` },
            signal: AbortSignal.timeout(10000),
          });
          const j = await r.json() as any;
          balanceTon = Number(j.balance || 0) / 1e9;
        } catch {}
        if (balanceTon < priceTon + 0.05) {
          return {
            error: `Insufficient balance: ${balanceTon.toFixed(3)} TON, need ${(priceTon + 0.05).toFixed(3)} TON (price + 0.05 TON network fee)`,
            wallet_address: walletAddr,
            needed: priceTon + 0.05,
            available: balanceTon,
          };
        }

        const { walletFromMnemonic, sendAgentTransactionWithCell } = await import('../services/TonConnect');
        const wallet = await walletFromMnemonic(walletMn, 'v4r2');
        const result = await sendAgentTransactionWithCell(
          wallet,
          String(args.tx_contract),
          priceTon + 0.01, // +0.01 TON for gas
          String(args.tx_payload)
        );

        if ((result as any)?.ok) {
          const giftName = String(args.gift_name || 'подарок');
          const totalSpent = Number((await stateRepo.get(params.agentId, 'total_ton_spent'))?.value || 0) + priceTon;
          await stateRepo.set(params.agentId, params.userId, 'total_ton_spent', String(totalSpent));
          await notifyUser(params.userId, `✅ Куплен ${giftName} за ${priceTon} TON! Tx: ${(result as any).hash}`);
          return { ok: true, hash: (result as any).hash, price_ton: priceTon, gift: giftName };
        }
        return { ok: false, error: (result as any).error || 'Transaction failed' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_daily_spend': {
      try {
        const { getAgentDailySpendRepository } = await import('../db/schema-extensions');
        const spendRepo = getAgentDailySpendRepository();
        const spentNano = await spendRepo.getSpent(params.agentId);
        const spentTon = Number(spentNano) / 1e9;
        const customLimit = await stateRepo.get(params.agentId, 'daily_spend_limit_ton').catch(() => null);
        const limitTon = customLimit ? Number((customLimit as any).value || DAILY_SPEND_LIMIT_TON) : DAILY_SPEND_LIMIT_TON;
        return { spent_ton: spentTon, limit_ton: limitTon, remaining_ton: Math.max(0, limitTon - spentTon), date: new Date().toISOString().slice(0, 10) };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'get_agent_wallet': {
      try {
        // ── Unified wallet lookup: check BOTH state AND trigger_config ──
        let addr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        let mnemonic = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;

        // Fallback: check trigger_config.config (studio-created wallets)
        if (!addr || !mnemonic) {
          try {
            const { pool } = await import('../db');
            const cfgRow = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id = $1', [params.agentId]);
            if (cfgRow.rows[0]) {
              const tc = typeof cfgRow.rows[0].trigger_config === 'string'
                ? JSON.parse(cfgRow.rows[0].trigger_config) : (cfgRow.rows[0].trigger_config || {});
              if (tc.config?.WALLET_ADDRESS && tc.config?.WALLET_MNEMONIC) {
                addr = tc.config.WALLET_ADDRESS;
                mnemonic = tc.config.WALLET_MNEMONIC;
                // Sync to state for future lookups
                await stateRepo.set(params.agentId, params.userId, 'wallet_address', addr);
                await stateRepo.set(params.agentId, params.userId, 'wallet_mnemonic', mnemonic);
              }
            }
          } catch (syncErr: any) { console.warn('[Wallet] sync from config:', syncErr.message); }
        }

        if (!addr || !mnemonic) {
          const { generateAgentWallet } = await import('../services/TonConnect');
          const w = await generateAgentWallet();
          addr = w.address;
          mnemonic = w.mnemonic;
          // Save to BOTH state and trigger_config for full sync
          await stateRepo.set(params.agentId, params.userId, 'wallet_address', addr);
          await stateRepo.set(params.agentId, params.userId, 'wallet_mnemonic', mnemonic);
          try {
            const { pool } = await import('../db');
            const cfgRow = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id = $1', [params.agentId]);
            if (cfgRow.rows[0]) {
              const tc = typeof cfgRow.rows[0].trigger_config === 'string'
                ? JSON.parse(cfgRow.rows[0].trigger_config) : (cfgRow.rows[0].trigger_config || {});
              if (!tc.config) tc.config = {};
              tc.config.WALLET_ADDRESS = addr;
              tc.config.WALLET_MNEMONIC = mnemonic;
              await pool.query('UPDATE builder_bot.agents SET trigger_config = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(tc), params.agentId]);
            }
          } catch (syncErr: any) { console.warn('[Wallet] sync to config:', syncErr.message); }
        }
        let balanceTon = 0;
        try {
          const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}`, {
            headers: { Authorization: `Bearer ${process.env.TONAPI_KEY || ''}` },
            signal: AbortSignal.timeout(10000),
          });
          const j = await r.json() as any;
          balanceTon = Number(j.balance || 0) / 1e9;
        } catch {}
        return { address: addr, balance_ton: balanceTon, status: 'ok', note: 'User must deposit TON to this address before agent can send transactions.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'send_ton': {
      try {
        const amount = Number(args.amount);
        if (isNaN(amount) || amount <= 0) return { error: 'Invalid amount' };
        if (amount > HIGH_VALUE_TX_LIMIT_TON) {
          return { error: `Safety: transaction of ${amount} TON exceeds limit (${HIGH_VALUE_TX_LIMIT_TON} TON). Reduce amount or contact platform admin.` };
        }
        const walletAddr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        const walletMn   = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        if (!walletAddr || !walletMn) return { error: 'Agent wallet not created. Call get_agent_wallet first.' };
        const { walletFromMnemonic, sendAgentTransaction } = await import('../services/TonConnect');
        const wallet = await walletFromMnemonic(walletMn, 'v4r2');
        const result = await sendAgentTransaction(wallet, String(args.to), amount, String(args.comment || ''));
        if ((result as any)?.ok) {
          // Track spend (state + daily cap)
          const totalSpent = Number((await stateRepo.get(params.agentId, 'total_ton_spent'))?.value || 0) + amount;
          await stateRepo.set(params.agentId, params.userId, 'total_ton_spent', String(totalSpent));
          await recordDailySpend(params.agentId, params.userId, amount);
          await logToDb(params.agentId, 'info', `[TX] Sent ${amount} TON to ${args.to}, hash=${(result as any).hash}`, params.userId);
          return { ok: true, hash: (result as any).hash, note: `Sent ${amount} TON to ${args.to}` };
        }
        return { ok: false, error: (result as any).error };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'send_jetton': {
      try {
        const walletMn = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        const walletAddr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        if (!walletAddr || !walletMn) return { error: 'Agent wallet not created. Call get_agent_wallet first.' };
        const jettonMaster = String(args.jetton_master);
        const toAddr = String(args.to);
        const amount = String(args.amount);
        if (!amount || BigInt(amount) <= 0n) return { error: 'Invalid amount' };

        // Get agent's jetton wallet address via TonAPI
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const jettonsRes = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(walletAddr)}/jettons`, { headers, signal: AbortSignal.timeout(10000) });
        const jettonsData = await jettonsRes.json() as any;
        const jettonBalance = (jettonsData.balances || []).find((b: any) =>
          b.jetton?.address === jettonMaster || b.jetton?.address?.includes(jettonMaster.replace(/^0:/, ''))
        );
        if (!jettonBalance?.wallet_address?.address) return { error: `No jetton wallet found for ${jettonMaster}. Ensure agent has this token.` };

        // Build jetton transfer message via TonAPI
        const { walletFromMnemonic } = await import('../services/TonConnect');
        const { mnemonicToWalletKey } = await import('@ton/crypto');
        const { beginCell, Address, toNano, internal: internalMsg } = await import('@ton/core');
        const { WalletContractV4 } = await import('@ton/ton');
        const TonClient4Mod = await import('@ton/ton');

        const keys = await mnemonicToWalletKey(walletMn.split(' '));
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });

        // Build jetton transfer payload (op=0xf8a7ea5)
        const forwardPayload = args.comment
          ? beginCell().storeUint(0, 32).storeStringTail(String(args.comment)).endCell()
          : beginCell().storeUint(0, 32).endCell();

        const jettonTransferBody = beginCell()
          .storeUint(0xf8a7ea5, 32)     // op: jetton transfer
          .storeUint(0, 64)              // query_id
          .storeCoins(BigInt(amount))     // amount in jetton nano
          .storeAddress(Address.parse(toAddr))  // destination
          .storeAddress(Address.parse(walletAddr)) // response_destination (excess back to sender)
          .storeBit(false)               // no custom_payload
          .storeCoins(toNano('0.01'))    // forward_ton_amount for notification
          .storeBit(true)                // forward_payload as ref
          .storeRef(forwardPayload)
          .endCell();

        const client = new TonClient4Mod.TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });
        const seqno = await client.open(wallet).getSeqno();
        const transfer = wallet.createTransfer({
          seqno,
          secretKey: keys.secretKey,
          messages: [
            internalMsg({
              to: Address.parse(jettonBalance.wallet_address.address),
              value: toNano('0.05'), // gas for jetton transfer
              body: jettonTransferBody,
            }),
          ],
        });

        // Send BOC via TonAPI
        const boc = transfer.toBoc().toString('base64');
        const sendRes = await fetch('https://tonapi.io/v2/blockchain/message', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ boc }),
          signal: AbortSignal.timeout(15000),
        });
        if (!sendRes.ok) {
          const errText = await sendRes.text();
          return { error: `Send failed: ${sendRes.status} ${errText}` };
        }

        await logToDb(params.agentId, 'info', `[TX] Sent jetton ${jettonMaster} amount=${amount} to ${toAddr}`, params.userId);
        return { ok: true, note: `Jetton transfer sent: ${amount} of ${jettonMaster} to ${toAddr}` };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'dex_get_prices': {
      try {
        // Use DeDust pools endpoint which has actual price data (lastPrice)
        const [poolsRes, assetsRes] = await Promise.all([
          fetch('https://api.dedust.io/v2/pools', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
          }),
          fetch('https://api.dedust.io/v2/assets', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
          }),
        ]);
        if (!poolsRes.ok) return { error: `DeDust pools API ${poolsRes.status}` };
        if (!assetsRes.ok) return { error: `DeDust assets API ${assetsRes.status}` };

        const pools = await poolsRes.json() as any[];
        const assets = await assetsRes.json() as any[];
        const symbol = args.symbol ? String(args.symbol).toUpperCase() : null;

        // Build asset lookup: address → metadata
        const assetMap = new Map<string, any>();
        for (const a of assets) {
          if (a.address) assetMap.set(a.address, a);
          // native TON has no address
          if (a.type === 'native') assetMap.set('native', a);
        }

        // Find pools with TON as one side (for USD pricing) that have lastPrice
        const tonPools = pools.filter((p: any) =>
          p.lastPrice && p.assets?.length === 2 &&
          p.assets.some((a: any) => a.type === 'native')
        );

        // Build price list from TON-paired pools
        const prices: any[] = [];
        for (const pool of tonPools) {
          const tonAsset = pool.assets.find((a: any) => a.type === 'native');
          const otherAsset = pool.assets.find((a: any) => a.type !== 'native');
          if (!otherAsset) continue;

          const meta = otherAsset.metadata || assetMap.get(otherAsset.address) || {};
          const sym = meta.symbol || meta.name || '?';
          const tokenIsFirst = pool.assets[0].type !== 'native';
          // lastPrice = price of asset[0] in terms of asset[1]
          const priceInTon = tokenIsFirst ? parseFloat(pool.lastPrice) : (1 / parseFloat(pool.lastPrice));

          if (symbol && sym.toUpperCase() !== symbol) continue;

          prices.push({
            symbol: sym,
            name: meta.name || sym,
            address: otherAsset.address,
            price_ton: priceInTon.toFixed(6),
            reserves: pool.reserves,
            pool_address: pool.address,
          });
        }

        // Sort by reserves (liquidity)
        prices.sort((a: any, b: any) => {
          const rA = parseInt(a.reserves?.[0] || '0');
          const rB = parseInt(b.reserves?.[0] || '0');
          return rB - rA;
        });

        return {
          count: prices.length,
          note: 'Prices are in TON. Multiply by TON/USD rate for USD value.',
          prices: prices.slice(0, symbol ? 5 : 30).map((p: any) => ({
            symbol: p.symbol,
            name: p.name,
            address: p.address,
            price_ton: p.price_ton,
            pool_address: p.pool_address,
          })),
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'dex_swap_simulate': {
      try {
        const sim = await fetch('https://api.ston.fi/v1/swap/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offer_address: String(args.offer_address),
            ask_address:   String(args.ask_address),
            units:         String(args.amount),
            slippage_tolerance: String(args.slippage || '0.01'),
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!sim.ok) {
          const errText = await sim.text();
          return { error: `STON.fi API ${sim.status}: ${errText}` };
        }
        const data = await sim.json() as any;
        return {
          offer_units: data.offer_units,
          ask_units: data.ask_units,
          swap_rate: data.swap_rate,
          price_impact: data.price_impact,
          fee_units: data.fee_units,
          min_ask_units: data.min_ask_units,
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'get_state': {
      try {
        const row = await stateRepo.get(params.agentId, args.key as string);
        return { key: args.key, value: row?.value ?? null };
      } catch { return { key: args.key, value: null }; }
    }

    case 'get_state_multi': {
      try {
        const keys = args.keys as string[];
        if (!Array.isArray(keys) || keys.length === 0) return { error: 'keys must be a non-empty array' };
        const rows = await stateRepo.getMulti(params.agentId, keys);
        const result: Record<string, any> = {};
        for (const k of keys) result[k] = null; // default all to null
        for (const row of rows) result[row.key] = row.value;
        return { values: result };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'set_state': {
      try {
        await stateRepo.set(params.agentId, params.userId, args.key as string, args.value);
        return { ok: true, key: args.key };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    }

    case 'list_state_keys': {
      try {
        const allState = await stateRepo.getAll(params.agentId);
        return {
          keys: (allState || []).map((s: any) => ({
            key: s.key,
            value_preview: String(s.value || '').slice(0, 100),
            updated: s.updatedAt,
          })),
        };
      } catch (e: any) { return { keys: [], error: e.message }; }
    }

    // ── Self-Awareness tools ──
    case 'remember': {
      try {
        const memKey = `mem:${String(args.key).slice(0, 50)}`;
        const category = args.category || 'fact';
        const importance = args.importance || 'medium';
        const memValue = JSON.stringify({
          value: String(args.value).slice(0, 500),
          category,
          importance,
          savedAt: new Date().toISOString(),
        });
        await stateRepo.set(params.agentId, params.userId, memKey, memValue);
        return { ok: true, remembered: args.key, category, importance };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'recall': {
      try {
        const allKeys = await stateRepo.listKeys(params.agentId);
        const memKeys = allKeys.filter((k: string) => k.startsWith('mem:'));
        const structured: Record<string, Array<{ key: string; value: string; importance?: string }>> = {
          contact: [], fact: [], preference: [], task: [], insight: [],
        };
        for (const key of memKeys) {
          const raw = await stateRepo.get(params.agentId, key).catch(() => null);
          const cleanKey = key.replace('mem:', '');
          if (!raw?.value) continue;
          // Parse structured or legacy plain text
          let parsed: any;
          try { parsed = JSON.parse(raw.value); } catch { parsed = { value: raw.value, category: 'fact', importance: 'medium' }; }
          const cat = parsed.category || 'fact';
          if (!structured[cat]) structured[cat] = [];
          structured[cat].push({ key: cleanKey, value: parsed.value || raw.value, importance: parsed.importance });
        }
        const total = Object.values(structured).reduce((sum, arr) => sum + arr.length, 0);
        return { memories: structured, count: total };
      } catch (e: any) { return { memories: {}, error: e.message }; }
    }

    case 'update_self_prompt': {
      try {
        const addition = String(args.addition).slice(0, 500);
        // Load existing additions
        const existingRaw = await stateRepo.get(params.agentId, '_prompt_additions').catch(() => null);
        let additions: string[] = [];
        try { additions = JSON.parse(existingRaw?.value || '[]'); } catch { additions = []; }
        // ── Version history: save previous state before modifying ──
        try {
          const versionsRaw = await stateRepo.get(params.agentId, '_prompt_versions').catch(() => null);
          let versions: Array<{ additions: string[]; savedAt: string }> = [];
          try { versions = JSON.parse(versionsRaw?.value || '[]'); } catch { versions = []; }
          versions.push({ additions: [...additions], savedAt: new Date().toISOString() });
          if (versions.length > 5) versions = versions.slice(-5); // keep last 5 versions
          await stateRepo.set(params.agentId, params.userId, '_prompt_versions', JSON.stringify(versions));
        } catch {}
        additions.push(addition);
        // Keep max 10 additions
        if (additions.length > 10) additions = additions.slice(-10);
        await stateRepo.set(params.agentId, params.userId, '_prompt_additions', JSON.stringify(additions));
        return { ok: true, totalAdditions: additions.length, added: addition };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'request_pause': {
      try {
        const reason = String(args.reason || 'Agent requested pause').slice(0, 300);
        await logToDb(params.agentId, 'warn', `[SELF-STOP] Agent requested pause: ${reason}`, params.userId);
        // Notify user
        try {
          await notifyRich(params.userId, {
            text: `⏸ <b>Агент #${params.agentId} запросил остановку</b>\n\n📋 Причина: ${reason}\n\nАгент обнаружил проблему и остановился сам. Проверьте логи.`,
            agentId: params.agentId,
          });
        } catch {}
        // Deactivate
        setTimeout(() => {
          try { getAIAgentRuntime().deactivate(params.agentId); } catch {}
          import('../db').then(({ pool }) =>
            pool.query('UPDATE builder_bot.agents SET is_active = false WHERE id = $1', [params.agentId])
          ).catch(() => {});
        }, 100);
        return { ok: true, message: 'Agent paused. Owner notified.' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'rollback_prompt': {
      try {
        // Try to restore from version history
        const versionsRaw = await stateRepo.get(params.agentId, '_prompt_versions').catch(() => null);
        let restored = false;
        if (versionsRaw?.value) {
          try {
            const versions: Array<{ additions: string[]; savedAt: string }> = JSON.parse(versionsRaw.value);
            if (versions.length > 0) {
              // Pop the latest version (restore to the one before it)
              versions.pop(); // remove current
              if (versions.length > 0) {
                const prev = versions[versions.length - 1];
                await stateRepo.set(params.agentId, params.userId, '_prompt_additions', JSON.stringify(prev.additions));
                await stateRepo.set(params.agentId, params.userId, '_prompt_versions', JSON.stringify(versions));
                await logToDb(params.agentId, 'info', `[ROLLBACK] Restored to version from ${prev.savedAt} (${prev.additions.length} additions)`, params.userId);
                return { ok: true, message: `Rolled back to version from ${prev.savedAt}`, additions: prev.additions.length, versionsRemaining: versions.length };
              }
            }
          } catch {}
        }
        // No versions — clear everything
        await stateRepo.set(params.agentId, params.userId, '_prompt_additions', '[]');
        await stateRepo.set(params.agentId, params.userId, '_prompt_versions', '[]');
        await logToDb(params.agentId, 'info', '[ROLLBACK] All prompt additions cleared (no versions to restore)', params.userId);
        return { ok: true, message: 'All prompt additions rolled back to empty.' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'save_lesson': {
      try {
        const lesson = { text: args.lesson, category: args.category || 'insight', savedAt: new Date().toISOString() };
        const key = `lesson:${Date.now()}`;
        await stateRepo.set(params.agentId, params.userId, key, JSON.stringify(lesson));
        // Keep max 30 lessons — prune oldest
        const allKeys = await stateRepo.listKeys(params.agentId);
        const lessonKeys = allKeys.filter((k: string) => k.startsWith('lesson:')).sort();
        if (lessonKeys.length > 30) {
          for (const old of lessonKeys.slice(0, lessonKeys.length - 30)) {
            await stateRepo.delete(params.agentId, old).catch(() => {});
          }
        }
        return { ok: true, lesson: lesson.text, totalLessons: Math.min(lessonKeys.length + 1, 30) };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'manage_goals': {
      try {
        const goalsRaw = await stateRepo.get(params.agentId, '_goals').catch(() => null);
        let goals: Array<{ goal: string; priority: string; status: string; addedAt: string }> = [];
        try { goals = JSON.parse(goalsRaw?.value || '[]'); } catch { goals = []; }

        switch (args.action) {
          case 'add':
            goals.push({ goal: args.goal, priority: args.priority || 'medium', status: 'active', addedAt: new Date().toISOString() });
            break;
          case 'complete':
            for (const g of goals) { if (g.goal === args.goal && g.status === 'active') g.status = 'completed'; }
            break;
          case 'remove':
            goals = goals.filter(g => g.goal !== args.goal);
            break;
          case 'list':
            return { goals };
        }
        await stateRepo.set(params.agentId, params.userId, '_goals', JSON.stringify(goals));
        return { ok: true, activeGoals: goals.filter(g => g.status === 'active').length, totalGoals: goals.length };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    // ── Dossier Tools ──
    case 'get_contact_dossier': {
      try {
        const { getContactMemory } = require('../services/userbot-manager');
        const cm = getContactMemory(params.agentId);
        await cm.loadFromDb(params.agentId);
        const dossier = cm.getContactDossier(args.user_id);
        return { ok: true, dossier: dossier || 'Контакт не найден в досье' };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'add_contact_note': {
      try {
        const { getContactMemory } = require('../services/userbot-manager');
        const cm = getContactMemory(params.agentId);
        await cm.loadFromDb(params.agentId);
        const ok = cm.addNote(args.user_id, args.note);
        if (ok) await cm.persistToDb(params.agentId, params.userId);
        return { ok, message: ok ? 'Заметка добавлена' : 'Контакт не найден' };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'set_contact_relationship': {
      try {
        const { getContactMemory } = require('../services/userbot-manager');
        const cm = getContactMemory(params.agentId);
        await cm.loadFromDb(params.agentId);
        const ok = cm.setRelationship(args.user_id, args.relationship);
        if (ok) await cm.persistToDb(params.agentId, params.userId);
        return { ok, message: ok ? `Отношения установлены: ${args.relationship}` : 'Контакт не найден' };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'get_chat_dossier': {
      try {
        const { getContactMemory } = require('../services/userbot-manager');
        const cm = getContactMemory(params.agentId);
        await cm.loadFromDb(params.agentId);
        const dossier = cm.getChatDossier(args.chat_id);
        return { ok: true, dossier: dossier || 'Чат не найден в досье' };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'add_chat_note': {
      try {
        const { getContactMemory } = require('../services/userbot-manager');
        const cm = getContactMemory(params.agentId);
        await cm.loadFromDb(params.agentId);
        const ok = cm.addChatNote(args.chat_id, args.note);
        if (ok) await cm.persistToDb(params.agentId, params.userId);
        return { ok, message: ok ? 'Заметка о чате добавлена' : 'Чат не найден' };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'list_contacts': {
      try {
        const { getContactMemory } = require('../services/userbot-manager');
        const cm = getContactMemory(params.agentId);
        await cm.loadFromDb(params.agentId);
        return { ok: true, summary: cm.getSummary() || 'Досье пусто — пока нет контактов' };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    // ── Chat Policy Management ──
    case 'set_chat_policy': {
      try {
        const pool = (await import('../db')).pool;
        // Normalize chat_id: resolve usernames/URLs to numeric ID
        let normalizedChatId = String(args.chat_id || '');
        // Extract username from URL like https://t.me/toncischat
        const urlMatch = normalizedChatId.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/);
        if (urlMatch) normalizedChatId = '@' + urlMatch[1];
        // If it's a @username, try to resolve to numeric chat ID via MTProto
        if (normalizedChatId.startsWith('@')) {
          try {
            const { UserbotManager } = require('../services/userbot-manager');
            const mgr = UserbotManager.getInstance();
            const client = await (mgr as any).getClient(params.agentId);
            if (client) {
              const entity = await client.getEntity(normalizedChatId);
              const numId = entity?.id?.toJSNumber?.() ?? Number(entity?.id);
              if (numId) {
                // Channels/supergroups need -100 prefix
                const isChannel = entity?.className === 'Channel' || entity?.className === 'ChatForbidden';
                normalizedChatId = isChannel ? `-100${numId}` : String(numId);
              }
            }
          } catch (resolveErr: any) {
            console.log(`[set_chat_policy] Could not resolve ${normalizedChatId}: ${resolveErr.message}`);
            // Keep the @username as fallback
          }
        }
        // Read current trigger_config
        const res = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id = $1', [params.agentId]);
        if (!res.rows.length) return { ok: false, error: 'Agent not found' };
        const tc = res.rows[0].trigger_config || { config: {} };
        if (!tc.config) tc.config = {};
        if (!tc.config.chatPolicies) tc.config.chatPolicies = {};
        tc.config.chatPolicies[normalizedChatId] = args.policy;
        await pool.query('UPDATE builder_bot.agents SET trigger_config = $1 WHERE id = $2', [JSON.stringify(tc), params.agentId]);
        // Also update in-memory config
        try {
          const { _agentMsgConfigs } = require('../services/userbot-manager');
          const cfg = _agentMsgConfigs?.get?.(params.agentId);
          if (cfg) {
            if (!cfg.chatPolicies) cfg.chatPolicies = {};
            cfg.chatPolicies[normalizedChatId] = args.policy;
          }
        } catch {}
        return { ok: true, chat_id: normalizedChatId, policy: args.policy, message: `Чат ${normalizedChatId} → ${args.policy}` };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'list_chat_policies': {
      try {
        const pool = (await import('../db')).pool;
        const res = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id = $1', [params.agentId]);
        if (!res.rows.length) return { ok: false, error: 'Agent not found' };
        const tc = res.rows[0].trigger_config || { config: {} };
        const globalPolicy = tc.config?.groupPolicy || 'mention-only';
        const chatPolicies = tc.config?.chatPolicies || {};
        return {
          ok: true,
          globalDefault: globalPolicy,
          perChat: chatPolicies,
          count: Object.keys(chatPolicies).length,
        };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    case 'get_shared_state': {
      try {
        const tgUserId = params.config?.telegramUserId || params.config?._tgUserId || 0;
        if (!tgUserId) return { key: args.key, value: null, error: 'No TG account linked' };
        const namespace = `tg_${tgUserId}`;
        const pg = _getSharedStatePool();
        const res = await pg.query(
          `SELECT value FROM builder_bot.agent_shared_state WHERE user_id = $1 AND namespace = $2 AND key = $3`,
          [params.userId, namespace, args.key]
        );
        return { key: args.key, value: res.rows.length > 0 ? res.rows[0].value : null };
      } catch (e: any) { return { key: args.key, value: null, error: e.message }; }
    }

    case 'set_shared_state': {
      try {
        const tgUserId = params.config?.telegramUserId || params.config?._tgUserId || 0;
        if (!tgUserId) return { ok: false, error: 'No TG account linked' };
        const namespace = `tg_${tgUserId}`;
        const pg = _getSharedStatePool();
        await pg.query(
          `INSERT INTO builder_bot.agent_shared_state (user_id, namespace, key, value, updated_by, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
           ON CONFLICT ON CONSTRAINT agent_shared_state_unique
           DO UPDATE SET value = $4::jsonb, updated_by = $5, updated_at = NOW()`,
          [params.userId, namespace, args.key, JSON.stringify(args.value), params.agentId]
        );
        return { ok: true, key: args.key };
      } catch (e: any) { return { ok: false, error: e.message }; }
    }

    // ── Event-Driven Tools ─────────────────────────────────────
    case 'set_next_wake': {
      const { getEventBus } = require('./event-bus');
      const delaySec = Number(args.delay_seconds) || 60;
      const reason = String(args.reason || 'scheduled wake');
      const result = getEventBus().setNextWake(params.agentId, delaySec * 1000, reason);
      return { ok: true, wake_at: new Date(result.wakeAt).toISOString(), delay_seconds: delaySec, reason };
    }

    case 'subscribe_event': {
      const { getEventBus } = require('./event-bus');
      const eventType = String(args.event_type || 'custom');
      getEventBus().subscribe(params.agentId, params.userId, eventType as any, args.filter);
      return { ok: true, event_type: eventType, filter: args.filter || null };
    }

    case 'unsubscribe_event': {
      const { getEventBus } = require('./event-bus');
      getEventBus().unsubscribe(params.agentId, args.event_type);
      return { ok: true, event_type: args.event_type || 'all' };
    }

    case 'emit_event': {
      const { getEventBus } = require('./event-bus');
      const eventName = String(args.name || 'custom');
      getEventBus().emit({
        type: 'custom',
        source: `agent:${params.agentId}`,
        data: { name: eventName, ...(args.data || {}) },
        timestamp: Date.now(),
      });
      return { ok: true, event_name: eventName };
    }

    case 'get_wake_info': {
      const { getEventBus } = require('./event-bus');
      const bus = getEventBus();
      const wake = bus.getWakeInfo(params.agentId);
      const subs = bus.getSubscriptions(params.agentId);
      return {
        next_wake: wake ? { at: new Date(wake.wakeAt).toISOString(), reason: wake.reason } : null,
        subscriptions: subs.map((s: any) => ({ event_type: s.eventType, filter: s.filter })),
      };
    }

    case 'notify': {
      const msg = String(args.message || '');
      _tickNotifyFlag.set(params.agentId, true); // mark: notify was called in this tick
      // Use notifyRich for markdown rendering; fallback to plain text
      await notifyRich(params.userId, {
        text: mdToHtml(msg),
        agentId: params.agentId,
      }).catch(async () => {
        if (params.onNotify) await params.onNotify(msg).catch(e => console.error('[Runtime]', e?.message || e));
        else await notifyUser(params.userId, msg).catch(e => console.error('[Runtime]', e?.message || e));
      });
      return { ok: true };
    }

    // ── Web tools ─────────────────────────────────────────────────
    case 'web_search': {
      const query = String(args.query || '');
      if (!query) return { error: 'query required' };
      if (!checkWebRateLimit(params.agentId)) return { error: 'Rate limit: too many web requests per minute. Slow down.' };
      try {
        const encoded = encodeURIComponent(query);
        const results: any[] = [];

        // 1) Try DuckDuckGo HTML search (works for general queries)
        try {
          // Detect Russian query (Cyrillic chars) for locale
          const hasRussian = /[а-яА-ЯёЁ]/.test(query);
          const locale = hasRussian ? '&kl=ru-ru' : '';
          const htmlResp = await fetch('https://html.duckduckgo.com/html/?q=' + encoded + locale, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept-Language': hasRussian ? 'ru-RU,ru;q=0.9,en;q=0.5' : 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(10000),
          });
          if (htmlResp.ok) {
            const html = await htmlResp.text();
            // Extract results from DuckDuckGo HTML: <a class="result__a" href="...">title</a> <a class="result__snippet">...</a>
            const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
            const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
            const links: Array<{ url: string; title: string }> = [];
            let m;
            while ((m = linkRegex.exec(html)) && links.length < 5) {
              const rawUrl = m[1];
              const title = m[2].replace(/<[^>]+>/g, '').trim();
              // DDG wraps URLs: //duckduckgo.com/l/?uddg=ENCODED_URL
              let url = rawUrl;
              const uddg = rawUrl.match(/uddg=([^&]+)/);
              if (uddg) url = decodeURIComponent(uddg[1]);
              links.push({ url, title });
            }
            const snippets: string[] = [];
            while ((m = snippetRegex.exec(html)) && snippets.length < 5) {
              snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
            }
            for (let i = 0; i < links.length; i++) {
              results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || '' });
            }
          }
        } catch {}

        // 2) Fallback: DuckDuckGo Instant Answer API (for wiki/facts)
        if (results.length === 0) {
          const resp = await fetch('https://api.duckduckgo.com/?q=' + encoded + '&format=json&no_html=1', {
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const data = await resp.json() as any;
            if (data.AbstractText) {
              results.push({ title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL || '' });
            }
            if (data.RelatedTopics) {
              for (const topic of data.RelatedTopics.slice(0, 5)) {
                if (topic.Text && topic.FirstURL) {
                  results.push({ title: topic.Text.slice(0, 100), snippet: topic.Text, url: topic.FirstURL });
                }
              }
            }
          }
        }

        return { results: results.slice(0, 5), total: results.length };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'fetch_url': {
      const url = String(args.url || '');
      if (!url) return { error: 'url required' };
      if (!checkWebRateLimit(params.agentId)) return { error: 'Rate limit: too many web requests per minute. Slow down.' };
      try {
        // SSRF protection: decode, validate hostname, resolve DNS, check IPs
        const ssrfCheck = await validateUrlSSRF(url);
        if (ssrfCheck.error) return { error: ssrfCheck.error };
        const safeUrl = ssrfCheck.decodedUrl!;
        const resp = await fetch(safeUrl, {
          headers: { 'User-Agent': 'TONAgentBot/1.0' },
          signal: AbortSignal.timeout(10000),
          redirect: 'manual', // prevent redirect to internal IPs
        });
        // Check redirects for SSRF (Location header might point to internal IP)
        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (location) {
            const redirCheck = await validateUrlSSRF(new URL(location, safeUrl).href);
            if (redirCheck.error) return { error: 'Redirect blocked: ' + redirCheck.error };
          }
          return { error: 'Redirect not followed for safety. Target: ' + (resp.headers.get('location') || 'unknown') };
        }
        if (!resp.ok) return { error: 'Fetch failed: ' + resp.status };
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('json')) {
          const json = await resp.json() as any;
          return { content: JSON.stringify(json).slice(0, 5000), type: 'json' };
        }
        const text = await resp.text();
        // Strip HTML tags for readability
        const clean = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const truncated = clean.length > 3000;
        return { content: clean.slice(0, 3000), type: 'text', truncated, originalLength: clean.length };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'notify_rich': {
      const msg = String(args.message || '');
      const buttons = (args.buttons as any[]) || [];
      _tickNotifyFlag.set(params.agentId, true); // mark: notify was called in this tick
      await notifyRich(params.userId, {
        text: msg,
        agentId: params.agentId,
        agentName: (params as any).agentName || 'Agent #' + params.agentId,
        buttons: buttons.map((b: any) => ({
          text: String(b.text || ''),
          url: b.url ? String(b.url) : undefined,
        })),
      }).catch(e => console.error('[Runtime]', e?.message || e));
      return { ok: true };
    }

    // ── Telegram Userbot tools (MTProto, per-agent) ──
    case 'tg_send_message': case 'tg_get_messages': case 'tg_get_channel_info':
    case 'tg_join_channel': case 'tg_leave_channel': case 'tg_get_dialogs':
    case 'tg_get_members': case 'tg_search_messages': case 'tg_get_user_info':
    case 'tg_reply': case 'tg_react': case 'tg_edit': case 'tg_forward':
    case 'tg_pin': case 'tg_mark_read': case 'tg_get_comments': case 'tg_set_typing':
    case 'tg_send_formatted': case 'tg_get_message_by_id': case 'tg_get_unread':
    case 'tg_send_file': case 'tg_copy_media': case 'tg_get_media_info':
    case 'tg_delete_message': case 'tg_create_poll': case 'tg_kick_user':
    case 'tg_ban_user': case 'tg_unban_user': case 'tg_mute_user':
    case 'tg_get_admins': case 'tg_set_admin': case 'tg_create_invite_link':
    case 'tg_unpin': case 'tg_schedule_message': case 'tg_set_chat_title':
    case 'tg_set_chat_about': case 'tg_set_chat_photo': case 'tg_create_group':
    case 'tg_create_channel': case 'tg_invite_users': case 'tg_archive_chat':
    case 'tg_get_online_count': case 'tg_send_contact': case 'tg_send_location':
    case 'tg_get_history_count': case 'tg_send_album': case 'tg_get_profile_photos':
    case 'tg_send_silent': case 'tg_get_webpage': case 'tg_press_button':
    case 'tg_get_chat_stats': case 'tg_save_draft': case 'tg_send_with_buttons':
    case 'tg_get_poll_results': case 'tg_send_sticker': case 'tg_send_gif':
    case 'tg_send_voice': case 'tg_transcribe_voice': case 'tg_get_sticker_sets': {
      try {
        // Per-AGENT Telegram auth — each agent has its own TG account
        const tgSandbox = await userbotManager.buildAgentSandbox(params.agentId || 0) || await userbotManager.buildUserSandbox(params.userId);
        if (!tgSandbox) {
          // Fallback: try global auth (backward compat)
          if (!(await isAuthorized())) {
            return { error: 'Telegram not connected. Connect via Studio Settings → Telegram' };
          }
          // Use old global functions as fallback
          return await executeGlobalTgTool(name, args);
        }

        // Route to per-user sandbox function
        switch (name) {
          case 'tg_send_message': {
            const isReply = !!(params.pendingMessages && params.pendingMessages.length > 0);
            const check = canPostToChat(params.agentId, args.peer, isReply);
            if (!check.allowed) return { error: `Rate limited: wait ${check.waitMinutes}min before posting to this chat again. Use set_next_wake to schedule.` };
            const r = await tgSandbox.sendMessage(args.peer, args.message || args.text);
            markPosted(params.agentId, args.peer);
            return r;
          }
          case 'tg_get_messages': return await tgSandbox.getMessages(args.peer, args.limit ?? 20);
          case 'tg_get_channel_info': return await tgSandbox.getChannelInfo(args.peer);
          case 'tg_join_channel': return await tgSandbox.joinChannel(args.peer);
          case 'tg_leave_channel': return await tgSandbox.leaveChannel(args.peer);
          case 'tg_get_dialogs': return await tgSandbox.getDialogs(args.limit ?? 20);
          case 'tg_get_members': return await tgSandbox.getMembers(args.peer, args.limit ?? 50);
          case 'tg_search_messages': return await tgSandbox.searchMessages(args.peer, args.query, args.limit ?? 20);
          case 'tg_get_user_info': return await tgSandbox.getUserInfo(args.user);
          case 'tg_reply': { const id = await tgSandbox.replyMessage(args.chat_id, args.reply_to_id, args.text, args.quote); return { ok: true, message_id: id }; }
          case 'tg_react': { await tgSandbox.reactMessage(args.chat_id, args.message_id, args.emoji); return { ok: true }; }
          case 'tg_edit': { await tgSandbox.editMessage(args.chat_id, args.message_id, args.new_text); return { ok: true }; }
          case 'tg_forward': { await tgSandbox.forwardMessage(args.from_chat, args.msg_id, args.to_chat); return { ok: true }; }
          case 'tg_pin': { await tgSandbox.pinMessage(args.chat_id, args.message_id, args.silent !== false); return { ok: true }; }
          case 'tg_mark_read': { await tgSandbox.markRead(args.chat_id); return { ok: true }; }
          case 'tg_get_comments': return await tgSandbox.getComments(args.chat_id, args.post_id, args.limit ?? 30);
          case 'tg_set_typing': { await tgSandbox.setTyping(args.chat_id); return { ok: true }; }
          case 'tg_send_formatted': {
            const isReply = !!(params.pendingMessages && params.pendingMessages.length > 0);
            const check = canPostToChat(params.agentId, args.chat_id, isReply);
            if (!check.allowed) return { error: `Rate limited: wait ${check.waitMinutes}min before posting to this chat again. Use set_next_wake to schedule.` };
            const id = await tgSandbox.sendFormatted(args.chat_id, args.html, args.reply_to);
            markPosted(params.agentId, args.chat_id);
            return { ok: true, message_id: id };
          }
          case 'tg_get_message_by_id': { const msg = await tgSandbox.getMessageById(args.chat_id, args.message_id); return msg || { error: 'Message not found' }; }
          case 'tg_get_unread': return await tgSandbox.getUnread(args.limit ?? 10);
          case 'tg_send_file': { const id = await tgSandbox.sendFile(args.chat_id, args.file_url, args.caption); return { ok: true, message_id: id }; }
          case 'tg_copy_media': { const id = await tgSandbox.copyMedia(args.from_chat_id, args.message_id, args.to_chat_id, args.caption); return { ok: true, message_id: id }; }
          case 'tg_get_media_info': return await tgSandbox.getMediaInfo(args.chat_id, args.message_id);
          // ── New extended tools ──
          case 'tg_delete_message': return await tgSandbox.deleteMsg(args.chat_id, args.message_ids);
          case 'tg_create_poll': return await tgSandbox.createPoll(args.chat_id, args.question, args.options, args.anonymous !== false, args.multiple_choice || false);
          case 'tg_kick_user': return await tgSandbox.kickUser(args.chat_id, args.user_id);
          case 'tg_ban_user': return await tgSandbox.banUser(args.chat_id, args.user_id, args.duration_sec || 0);
          case 'tg_unban_user': return await tgSandbox.unbanUser(args.chat_id, args.user_id);
          case 'tg_mute_user': return await tgSandbox.muteUser(args.chat_id, args.user_id, args.duration_sec || 3600);
          case 'tg_get_admins': return await tgSandbox.getAdmins(args.chat_id);
          case 'tg_set_admin': return await tgSandbox.setAdmin(args.chat_id, args.user_id, args.rights);
          case 'tg_create_invite_link': return await tgSandbox.createInviteLink(args.chat_id);
          case 'tg_unpin': return await tgSandbox.unpinMessage(args.chat_id, args.message_id);
          case 'tg_schedule_message': return await tgSandbox.scheduleMessage(args.chat_id, args.text, args.send_at);
          case 'tg_set_chat_title': return await tgSandbox.setChatTitle(args.chat_id, args.title);
          case 'tg_set_chat_about': return await tgSandbox.setChatAbout(args.chat_id, args.about);
          case 'tg_set_chat_photo': return await tgSandbox.setChatPhoto(args.chat_id, args.photo_url);
          case 'tg_create_group': return await tgSandbox.createGroup(args.title, args.user_ids || []);
          case 'tg_create_channel': return await tgSandbox.createChannel(args.title, args.about || '', args.megagroup || false);
          case 'tg_invite_users': return await tgSandbox.inviteToChannel(args.chat_id, args.user_ids);
          case 'tg_archive_chat': return await tgSandbox.archiveChat(args.chat_id);
          case 'tg_get_online_count': return await tgSandbox.getOnlineCount(args.chat_id);
          case 'tg_send_contact': return await tgSandbox.sendContact(args.chat_id, args.phone, args.first_name, args.last_name || '');
          case 'tg_send_location': return await tgSandbox.sendLocation(args.chat_id, args.lat, args.lng);
          case 'tg_get_history_count': return await tgSandbox.getHistoryCount(args.chat_id);
          case 'tg_send_album': return await tgSandbox.sendAlbum(args.chat_id, args.media_urls, args.caption);
          case 'tg_get_profile_photos': return await tgSandbox.getProfilePhotos(args.user_id, args.limit || 5);
          case 'tg_send_silent': return await tgSandbox.sendSilent(args.chat_id, args.text);
          case 'tg_get_webpage': return await tgSandbox.getWebPage(args.url);
          case 'tg_press_button': return await tgSandbox.pressButton(args.chat_id, args.message_id, args.button_index);
          case 'tg_get_chat_stats': return await tgSandbox.getChatStats(args.chat_id);
          case 'tg_save_draft': return await tgSandbox.saveDraft(args.chat_id, args.text);
          case 'tg_send_with_buttons': return await tgSandbox.sendWithButtons(args.chat_id, args.text, args.buttons);
          case 'tg_get_poll_results': return await tgSandbox.getPollResults(args.chat_id, args.message_id);
          case 'tg_send_sticker': return await tgSandbox.sendSticker(args.chat_id, args.sticker_set_name, args.index ?? 0);
          case 'tg_send_gif': return await tgSandbox.sendGif(args.chat_id, args.query);
          case 'tg_send_voice': return await tgSandbox.sendVoice(args.chat_id, args.text, args.lang || 'ru');
          case 'tg_transcribe_voice': return await tgSandbox.transcribeVoice(args.chat_id, args.message_id);
          case 'tg_get_sticker_sets': return await tgSandbox.getStickerSets(args.query);
          default: return { error: 'Unknown tg tool' };
        }
      } catch (e: any) { return { error: e.message }; }
    }

    case 'http_fetch': {
      try {
        const url = args.url as string;
        // SSRF protection: decode, validate hostname, resolve DNS, check IPs
        const ssrfCheck = await validateUrlSSRF(url);
        if (ssrfCheck.error) return { error: ssrfCheck.error };
        const safeUrl = ssrfCheck.decodedUrl!;
        const method = (args.method as string || 'GET').toUpperCase();
        const headers = (args.headers || {}) as Record<string, string>;
        const body = args.body as string | undefined;
        const res = await fetch(safeUrl, {
          method,
          headers: { 'User-Agent': 'TON-Agent-Platform/1.0', ...headers },
          body: method !== 'GET' ? body : undefined,
          signal: AbortSignal.timeout(15000),
          redirect: 'manual',
        });
        // Check redirects for SSRF
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location');
          if (location) {
            const redirCheck = await validateUrlSSRF(new URL(location, safeUrl).href);
            if (redirCheck.error) return { error: 'Redirect blocked: ' + redirCheck.error };
          }
          return { error: 'Redirect not followed for safety. Target: ' + (res.headers.get('location') || 'unknown') };
        }
        const text = await res.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        return { status: res.status, ok: res.ok, data: json ?? text.slice(0, 4000) };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── GiftAsset / SwiftGifts tools ──────────────────────────────
    case 'get_gift_floor_real': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().getFloorPrices(args.slug as string);
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_gift_sales_history': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().getUniqueSales(
          args.collection_name as string,
          args.limit ?? 20,
          args.model_name as string | undefined,
        );
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_market_overview': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const [lastSales, upgradeStats] = await Promise.all([
          ga.getAllCollectionsLastSale(),
          ga.getUpgradeStats(),
        ]);
        return { lastSales, upgradeStats };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_price_list': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().getPriceList({ models: args.models });
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'scan_real_arbitrage': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        return await getGiftAssetClient().findArbitrageOpportunities({
          maxPriceStars: args.max_price_stars,
          minProfitPct: args.min_profit_pct,
        });
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_gift_aggregator': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const receiverId = Number(args.receiver || params.config?.OWNER_TELEGRAM_ID || params.userId || 0);
        // If to_price filter set → query ALL markets (offchain + onchain) to find cheapest
        const markets = (args.market as string[] | undefined) || (args.to_price != null ? ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'] : undefined);
        const result = await getGiftAssetClient().swAggregate({
          name:      args.name as string,
          receiver:  receiverId,
          backdrop:  args.backdrop as string | undefined,
          model:     args.model as string | undefined,
          fromPrice: args.from_price as number | undefined,
          toPrice:   args.to_price as number | undefined,
          market:    markets,
        });
        // Use rarity % directly from API — no heuristics
        const parseRarityPct = (r: any): number => {
          if (!r) return 100;
          const n = parseFloat(String(r).replace('%', ''));
          return isNaN(n) ? 100 : n;
        };
        const items = (result?.items || []).map((item: any) => {
          const backdropRarityPct = parseRarityPct(item.attributes?.backdrop?.rarity);
          const modelRarityPct    = parseRarityPct(item.attributes?.model?.rarity);
          const hasTx = !!(item.options?.payload);
          // Lower % = rarer = more valuable
          const isRareBackdrop = backdropRarityPct <= 2;
          const isRareModel    = modelRarityPct    <= 1;
          return {
            provider:            item.provider,
            price_ton:           item.price,
            title:               item.title,
            number:              item.number,
            slug:                item.slug,
            link:                item.link,
            model:               item.attributes?.model?.value,
            model_rarity_pct:    item.attributes?.model?.rarity,   // e.g. "1%"
            backdrop:            item.attributes?.backdrop?.value,
            backdrop_rarity_pct: item.attributes?.backdrop?.rarity, // e.g. "2%"
            symbol:              item.attributes?.symbol?.value,
            symbol_rarity_pct:   item.attributes?.symbol?.rarity,
            is_rare_backdrop:    isRareBackdrop,  // ≤2% = rare
            is_rare_model:       isRareModel,     // ≤1% = rare
            value_note: isRareBackdrop && isRareModel
              ? `🔥🔥 ULTRA RARE: backdrop ${backdropRarityPct}% + model ${modelRarityPct}% — potential 10-100x floor`
              : isRareBackdrop
              ? `🔥 Rare backdrop (${backdropRarityPct}%) — significantly above floor price`
              : isRareModel
              ? `⭐ Rare model (${modelRarityPct}%) — worth more than floor`
              : undefined,
            can_buy_now:  hasTx,
            tx_payload:   hasTx ? item.options?.payload   : undefined,
            tx_contract:  hasTx ? item.options?.contract  : undefined,
          };
        });
        // If price filter specified → sort by price (cheapest first) for floor hunting
        // Otherwise → sort by rarity (rarest first) for discovery/analysis
        const hasPriceFilter = args.to_price != null || args.from_price != null;
        if (hasPriceFilter) {
          items.sort((a: any, b: any) => a.price_ton - b.price_ton);
        } else {
          items.sort((a: any, b: any) => {
            const aRar = parseRarityPct(a.backdrop_rarity_pct);
            const bRar = parseRarityPct(b.backdrop_rarity_pct);
            if (aRar !== bRar) return aRar - bRar; // lower % = rarer = first
            return a.price_ton - b.price_ton;
          });
        }
        const limit = hasPriceFilter ? 50 : 20;
        return {
          total: result?.total || 0,
          items: items.slice(0, limit),
          cheapest_price_ton: items.length > 0 ? items[0].price_ton : null,
          note: hasPriceFilter
            ? 'Sorted by price (cheapest first). can_buy_now=true means tx_payload is ready for instant purchase.'
            : 'Sorted by backdrop rarity (rarest first), then price. can_buy_now=true means tx_payload is ready for purchase.',
        };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('SwiftGifts')) {
          return { status: 'unavailable', message: 'SwiftGifts API temporarily unavailable. Use scan_real_arbitrage (GiftAsset) as fallback.' };
        }
        return { error: e.message };
      }
    }

    case 'get_top_deals': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const deals = await getGiftAssetClient().getTopDeals();
        return {
          deals,
          note: 'Top arbitrage opportunities from GiftAsset Pro API. Each item has attributes with rarity% from API — lower % = rarer = more valuable. Use get_gift_aggregator for full listings with tx_payload to buy.',
        };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset Pro API temporarily unavailable. Falling back to scan_real_arbitrage.' };
        }
        return { error: e.message };
      }
    }

    case 'get_backdrop_floors': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const floors = await getGiftAssetClient().getBackdropFloors(args.collection_name as string | undefined);
        return {
          backdrop_floors: floors,
          note: 'Price premiums by backdrop color. Black/dark backdrops command 5-50x floor multiplier. Use to evaluate specific listings.',
        };
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset Pro API temporarily unavailable.' };
        }
        return { error: e.message };
      }
    }

    case 'get_collection_offers': {
      if (!args.collection_name) return { error: 'collection_name required' };
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const offers = await getGiftAssetClient().getCollectionOffers(
          args.collection_name as string,
          { minPrice: args.min_price, maxPrice: args.max_price }
        );
        console.log('[get_collection_offers] raw:', JSON.stringify(offers)?.slice(0, 300));
        const offersArr = Array.isArray(offers) ? offers
          : Array.isArray(offers?.offers) ? offers.offers
          : Array.isArray(offers?.data) ? offers.data
          : offers?.items ?? offers;
        return {
          collection: args.collection_name,
          offers: offersArr,
          total: Array.isArray(offersArr) ? offersArr.length : 'unknown',
          note: 'These are ACTIVE BUY ORDERS — guaranteed buyers. If you list at or below their offer price, sale is instant.',
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_market_health': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const [greed, health] = await Promise.allSettled([ga.getGreedIndex(), ga.getCollectionHealth()]);
        return {
          greed_index:  greed.status  === 'fulfilled' ? greed.value  : null,
          health_index: health.status === 'fulfilled' ? health.value : null,
          note: 'greed_index > 70 = market overheated (sell). < 30 = undervalued (buy). health_index = liquidity & activity.',
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_attribute_volumes': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getAttributeVolumes(args.collection_name as string | undefined);
        return { attribute_volumes: data, note: 'Shows which backdrops/models have highest sales volume. High volume = liquid market.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_unique_gift_prices': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getUniqueGiftsPriceList(args.collection_name as string | undefined);
        return { unique_prices: data, note: 'Per-variant prices by backdrop+model combination. More accurate than collection floor.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_user_portfolio': {
      if (!args.username && !args.telegram_id) return { error: 'Provide username or telegram_id' };
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        // Try SwiftGifts price profile first (includes valuation)
        if (args.username) {
          try {
            const profile = await ga.swPriceProfile(args.username as string);
            return profile;
          } catch {}
        }
        // Fallback to GiftAsset user_gifts
        return await ga.getUserGifts({
          username: args.username as string,
          telegramId: args.telegram_id as string,
        });
      } catch (e: any) {
        if (e.message?.includes('cooldown') || e.message?.includes('invalid') || e.message?.includes('GiftAsset')) {
          return { status: 'unavailable', message: 'GiftAsset/SwiftGifts API temporarily unavailable. The API key may be expired or rate-limited. Use web_search or other tools as fallback.' };
        }
        return { error: e.message };
      }
    }

    // ── Smart valuation tools ──
    case 'find_underpriced_gifts': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const ga = getGiftAssetClient();
        const collection = args.collection as string;
        const maxPrice = args.max_price as number | undefined;
        const minDiscount = (args.min_discount_pct as number) || 10;

        // 1. Get fair value per backdrop
        const [backdropData, listings] = await Promise.all([
          ga.getBackdropFloors(collection).catch(() => null),
          ga.swAggregate({
            name: collection,
            toPrice: maxPrice || null,
            market: ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'],
            receiver: params.userId,
          }).catch(() => ({ total: 0, items: [] })),
        ]);

        // 2. Build backdrop fair value map
        const fairValues: Record<string, number> = {};
        if (backdropData && typeof backdropData === 'object') {
          const entries = Array.isArray(backdropData) ? backdropData
            : backdropData.backdrops ? backdropData.backdrops
            : backdropData.data ? backdropData.data
            : Object.values(backdropData);
          for (const e of (entries as any[])) {
            if (e && e.backdrop && e.floor_price) {
              fairValues[String(e.backdrop).toLowerCase()] = Number(e.floor_price);
            } else if (e && e.name && e.price) {
              fairValues[String(e.name).toLowerCase()] = Number(e.price);
            }
          }
        }

        // 3. Also get per-variant prices for more precision
        let variantPrices: Record<string, number> = {};
        try {
          const uniqueData = await ga.getUniqueGiftsPriceList(collection);
          if (uniqueData && typeof uniqueData === 'object') {
            const variants = Array.isArray(uniqueData) ? uniqueData
              : uniqueData.variants || uniqueData.data || Object.values(uniqueData);
            for (const v of (variants as any[])) {
              if (v && v.model && v.backdrop && v.floor_price) {
                const key = `${String(v.model).toLowerCase()}:${String(v.backdrop).toLowerCase()}`;
                variantPrices[key] = Number(v.floor_price);
              }
            }
          }
        } catch {}

        // 4. Score each listing
        const underpriced: any[] = [];
        for (const item of (listings.items || [])) {
          const price = Number(item.price_ton || item.price);
          if (!price || price <= 0) continue;
          if (maxPrice && price > maxPrice) continue;

          const backdrop = String(item.backdrop || item.options?.backdrop || '').toLowerCase();
          const model = String(item.model || item.options?.model || '').toLowerCase();

          // Find fair value: variant-specific > backdrop-specific > skip
          const variantKey = `${model}:${backdrop}`;
          let fairValue = variantPrices[variantKey] || fairValues[backdrop] || 0;
          if (!fairValue || fairValue <= 0) continue;

          const discountPct = ((fairValue - price) / fairValue) * 100;
          if (discountPct >= minDiscount) {
            underpriced.push({
              title: item.title || item.name || collection,
              price_ton: price,
              fair_value: Number(fairValue.toFixed(2)),
              discount_pct: Number(discountPct.toFixed(1)),
              backdrop: item.backdrop || item.options?.backdrop,
              model: item.model || item.options?.model,
              provider: item.provider,
              link: item.link,
              can_buy_now: !!item.tx_payload,
              tx_contract: item.tx_contract,
              tx_payload: item.tx_payload,
            });
          }
        }

        // Sort by discount (biggest bargain first)
        underpriced.sort((a, b) => b.discount_pct - a.discount_pct);
        const top = underpriced.slice(0, 15);

        return {
          collection,
          total_listings: listings.total,
          underpriced_count: underpriced.length,
          backdrop_fair_values: fairValues,
          variant_fair_values_count: Object.keys(variantPrices).length,
          top_underpriced: top,
          note: top.length > 0
            ? `Found ${underpriced.length} underpriced items! Best deal: ${top[0].title} at ${top[0].price_ton} TON (fair value ${top[0].fair_value}, ${top[0].discount_pct}% below). Use buy_market_gift if can_buy_now=true.`
            : `No items found ${minDiscount}%+ below fair value in ${collection}. Market is efficiently priced right now.`,
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_price_history': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getPriceListHistory(args.collection_name as string);
        return { price_history: data, note: 'Historical price data. Compare with current floor to determine trend (rising/falling/stable). Use for timing buy/sell decisions.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_market_activity': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getMarketActions({
          gift: args.gift as string | undefined,
          type: (args.type as 'buy' | 'listing' | 'change_price') || 'buy',
          minPrice: args.min_price as number | undefined,
          maxPrice: args.max_price as number | undefined,
          markets: args.markets as string[] | undefined,
        });
        return { activity: data, note: 'Real-time market actions. type=buy shows actual purchases (demand indicator). type=listing shows new offers. Use to gauge liquidity and real demand.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_collections_marketcap': {
      try {
        const { getGiftAssetClient } = await import('../services/giftasset');
        const data = await getGiftAssetClient().getCollectionsMarketcap();
        return { marketcap: data, note: 'Total market capitalization of all gift collections. Top collections by value = most liquid markets.' };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    // ── TonAPI Blockchain tools ──────────────────────────────────
    case 'ton_get_account': {
      try {
        const addr = args.address as string;
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        return {
          address: data.address,
          balance_ton: data.balance ? (parseInt(data.balance) / 1e9).toFixed(4) : '0',
          status: data.status,
          name: data.name || null,
          icon: data.icon || null,
          is_wallet: data.is_wallet ?? null,
          interfaces: data.interfaces || [],
          memo_required: data.memo_required ?? false,
          get_methods: data.get_methods || [],
          last_activity: data.last_activity,
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_get_transactions': {
      try {
        const addr = args.address as string;
        const limit = Math.min(args.limit ?? 20, 100);
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}/events?limit=${limit}`, { headers, signal: AbortSignal.timeout(15000) });
        const data = await res.json() as any;
        const events = (data.events || []).map((ev: any) => ({
          event_id: ev.event_id,
          timestamp: ev.timestamp,
          is_scam: ev.is_scam,
          actions: (ev.actions || []).map((a: any) => ({
            type: a.type,
            status: a.status,
            simple_preview: a.simple_preview,
            ...(a.TonTransfer ? {
              ton_transfer: {
                sender: a.TonTransfer.sender?.address,
                recipient: a.TonTransfer.recipient?.address,
                amount_ton: (parseInt(a.TonTransfer.amount || '0') / 1e9).toFixed(4),
                comment: a.TonTransfer.comment,
              },
            } : {}),
            ...(a.JettonTransfer ? {
              jetton_transfer: {
                sender: a.JettonTransfer.sender?.address,
                recipient: a.JettonTransfer.recipient?.address,
                amount: a.JettonTransfer.amount,
                jetton: a.JettonTransfer.jetton?.name || a.JettonTransfer.jetton?.address,
              },
            } : {}),
            ...(a.NftItemTransfer ? {
              nft_transfer: {
                sender: a.NftItemTransfer.sender?.address,
                recipient: a.NftItemTransfer.recipient?.address,
                nft: a.NftItemTransfer.nft,
              },
            } : {}),
          })),
        }));
        return { address: addr, count: events.length, events };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_get_jettons': {
      try {
        const addr = args.address as string;
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}/jettons`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        const balances = (data.balances || []).map((b: any) => ({
          jetton: b.jetton?.name || b.jetton?.address,
          symbol: b.jetton?.symbol,
          balance: b.balance,
          decimals: b.jetton?.decimals,
          usd_price: b.price?.prices?.USD || null,
          wallet_address: b.wallet_address?.address,
        }));
        return { address: addr, count: balances.length, jettons: balances };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_get_nfts': {
      try {
        const addr = args.address as string;
        const limit = Math.min(args.limit ?? 50, 200);
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}/nfts?limit=${limit}&indirect_ownership=true`, { headers, signal: AbortSignal.timeout(15000) });
        const data = await res.json() as any;
        const nfts = (data.nft_items || []).map((n: any) => ({
          address: n.address,
          name: n.metadata?.name || 'Unknown',
          description: (n.metadata?.description || '').slice(0, 100),
          collection: n.collection ? { name: n.collection.name, address: n.collection.address } : null,
          sale: n.sale ? { price_ton: (parseInt(n.sale.price?.value || '0') / 1e9).toFixed(2), marketplace: n.sale.market?.name } : null,
          image: n.previews?.[0]?.url || n.metadata?.image,
        }));
        return { address: addr, count: nfts.length, nfts };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_run_method': {
      try {
        const addr = args.address as string;
        const method = args.method as string;
        const methodArgs = (args.args as string[]) || [];
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        let url = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(addr)}/methods/${encodeURIComponent(method)}`;
        if (methodArgs.length > 0) url += '?args=' + methodArgs.map(a => encodeURIComponent(a)).join(',');
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        return {
          success: data.success ?? !data.error,
          exit_code: data.exit_code,
          gas_used: data.gas_used,
          stack: data.stack,
          decoded: data.decoded,
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_get_rates': {
      try {
        const tokens = args.tokens as string || 'ton';
        const currencies = args.currencies as string || 'usd,rub';
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/rates?tokens=${encodeURIComponent(tokens)}&currencies=${encodeURIComponent(currencies)}`, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json() as any;
        return { rates: data.rates };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_dns_resolve': {
      try {
        const domain = args.domain as string;
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/dns/${encodeURIComponent(domain)}`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        return {
          domain,
          wallet: data.wallet,
          next_resolver: data.next_resolver,
          sites: data.sites,
          storage: data.storage,
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_get_staking_pools': {
      try {
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        let url = 'https://tonapi.io/v2/staking/pools';
        if (args.available_for) url = `https://tonapi.io/v2/staking/nominator/${encodeURIComponent(args.available_for as string)}/pools`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        const pools = (data.pools || []).slice(0, 20).map((p: any) => ({
          address: p.address,
          name: p.name,
          apy: p.apy,
          min_stake: p.min_stake ? (parseInt(p.min_stake) / 1e9).toFixed(2) : null,
          total_amount: p.total_amount ? (parseInt(p.total_amount) / 1e9).toFixed(0) : null,
          nominators_count: p.nominators_count,
          cycle_end: p.cycle_end,
          verified: p.verified,
        }));
        return { count: pools.length, pools, note: 'APY is annualized. min_stake in TON.' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_emulate_tx': {
      try {
        const boc = args.boc as string;
        if (!boc) return { error: 'boc required (base64-encoded transaction)' };
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch('https://tonapi.io/v2/wallet/emulate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ boc }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json() as any;
        if (!res.ok) return { error: data.error || `HTTP ${res.status}`, details: data };
        return {
          ok: true,
          event: data.event ? {
            actions: (data.event.actions || []).map((a: any) => ({ type: a.type, status: a.status, simple_preview: a.simple_preview })),
          } : null,
          risk: data.risk,
          trace: data.trace ? { id: data.trace.id } : null,
          note: 'This is a SIMULATION. No actual transaction was sent.',
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_send_boc': {
      try {
        const boc = args.boc as string;
        if (!boc) return { error: 'boc required (base64-encoded transaction)' };
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch('https://tonapi.io/v2/blockchain/message', {
          method: 'POST',
          headers,
          body: JSON.stringify({ boc }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          return { ok: true, note: 'Transaction broadcast to TON network. It may take a few seconds to be included in a block.' };
        }
        const data = await res.json() as any;
        return { ok: false, error: data.error || `HTTP ${res.status}`, details: data };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_get_validators': {
      try {
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch('https://tonapi.io/v2/blockchain/validators', { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json() as any;
        const validators = (data.validators || []).slice(0, 20).map((v: any) => ({
          address: v.address,
          stake: v.stake ? (parseInt(v.stake) / 1e9).toFixed(0) + ' TON' : null,
          adnl_address: v.adnl_address,
        }));
        return { total: data.validators?.length || 0, top_validators: validators };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ton_parse_address': {
      try {
        const addr = args.address as string;
        const tonApiKey = params.config.TONAPI_KEY || process.env.TONAPI_KEY || '';
        const headers: Record<string, string> = {};
        if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
        const res = await fetch(`https://tonapi.io/v2/address/${encodeURIComponent(addr)}/parse`, { headers, signal: AbortSignal.timeout(5000) });
        const data = await res.json() as any;
        return data;
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Plugin tools ──
    case 'list_plugins': {
      const { getPluginManager } = await import('../plugins-system');
      const pm = getPluginManager();
      const all = pm.getAllPlugins();
      return all.map(p => ({
        id: p.id, name: p.name, type: p.type,
        description: p.description,
        rating: p.rating, downloads: p.downloads,
        isInstalled: p.isInstalled,
        price: p.price || 'free',
      }));
    }

    case 'suggest_plugin': {
      const { getPluginManager } = await import('../plugins-system');
      const pm = getPluginManager();
      const all = pm.getAllPlugins();
      const task = (args.task_description as string || '').toLowerCase();

      // Keyword matching for plugin suggestion
      const scored = all.map(p => {
        let score = 0;
        const text = `${p.name} ${p.description} ${p.id} ${p.type}`.toLowerCase();
        const keywords = task.split(/\s+/);
        for (const kw of keywords) {
          if (kw.length >= 3 && text.includes(kw)) score += 2;
        }
        // Type-based boosting
        if (task.match(/defi|swap|обмен|торг|dex|пул|pool|ликвид/i) && p.type === 'defi') score += 3;
        if (task.match(/аналит|stats|стат|мониторинг|отслежив|track/i) && (p.type === 'analytics' || p.type === 'data-source')) score += 3;
        if (task.match(/уведомл|нотиф|alert|сообщ|notif/i) && p.type === 'notification') score += 3;
        if (task.match(/безопас|security|аудит|drain|protect/i) && p.type === 'security') score += 3;
        return { ...p, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

      if (scored.length === 0) {
        return { message: 'Подходящих плагинов не найдено. Попробуй выполнить задачу без плагинов.' };
      }
      return {
        suggestions: scored.map(p => ({
          id: p.id, name: p.name, type: p.type,
          description: p.description,
          isInstalled: p.isInstalled,
          reason: `Релевантность: ${p.score}`,
        })),
        tip: scored[0].isInstalled
          ? `Плагин "${scored[0].name}" уже установлен, можно использовать.`
          : `Для задачи рекомендуется плагин "${scored[0].name}". Попроси пользователя установить его.`,
      };
    }

    case 'apply_plugin': {
      const pluginId = args.plugin_id as string;
      const { getPluginManager } = await import('../plugins-system');
      const plugin = getPluginManager().getPlugin(pluginId);
      if (!plugin) return { error: `Плагин "${pluginId}" не найден. Используй list_plugins для списка.` };
      try {
        const { pool } = await import('../db');
        const row = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        const tc = row.rows[0]?.trigger_config || {};
        const config = tc.config || {};
        const ep: string[] = config.enabledPlugins || [];
        if (!ep.includes(pluginId)) ep.push(pluginId);
        config.enabledPlugins = ep;
        tc.config = config;
        await pool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), params.agentId]);
        return { ok: true, pluginId, name: plugin.name, message: `Плагин "${plugin.name}" подключён. Его API-документация будет доступна на следующем тике.` };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'remove_plugin': {
      const pluginId = args.plugin_id as string;
      try {
        const { pool } = await import('../db');
        const row = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        const tc = row.rows[0]?.trigger_config || {};
        const config = tc.config || {};
        const ep: string[] = config.enabledPlugins || [];
        config.enabledPlugins = ep.filter((id: string) => id !== pluginId);
        tc.config = config;
        await pool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), params.agentId]);
        return { ok: true, pluginId, message: `Плагин "${pluginId}" отключён.` };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Self-modification tools (agent evolves itself) ──
    case 'get_my_config': {
      try {
        const { pool } = await import('../db');
        const row = await pool.query('SELECT code, description, trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        if (!row.rows[0]) return { error: 'Agent not found' };
        const a = row.rows[0];
        const tc = a.trigger_config || {};
        return {
          current_prompt: a.code || '(empty)',
          description: a.description || '(empty)',
          intervalMs: tc.intervalMs || 0,
          interval_minutes: Math.round((tc.intervalMs || 0) / 60000),
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'update_my_prompt': {
      const newPrompt = args.new_prompt as string;
      const reason = (args.reason as string) || 'self-update';
      if (!newPrompt || newPrompt.length < 20) return { error: 'Промпт слишком короткий (минимум 20 символов)' };
      if (newPrompt.length > 10000) return { error: 'Промпт слишком длинный (максимум 10000 символов)' };
      try {
        const { pool } = await import('../db');
        // Backup old prompt in state
        const oldRow = await pool.query('SELECT code FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        const oldPrompt = oldRow.rows[0]?.code || '';
        const stateRepo = getAgentStateRepository();
        await stateRepo.set(params.agentId, params.userId, 'previous_prompt', oldPrompt).catch(() => {});
        await stateRepo.set(params.agentId, params.userId, 'prompt_update_reason', reason).catch(() => {});
        await stateRepo.set(params.agentId, params.userId, 'prompt_updated_at', new Date().toISOString()).catch(() => {});

        // Update code column
        await pool.query('UPDATE builder_bot.agents SET code=$1 WHERE id=$2', [newPrompt, params.agentId]);

        // Also update trigger_config.code
        const tcRow = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        const tc = tcRow.rows[0]?.trigger_config || {};
        tc.code = newPrompt;
        await pool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), params.agentId]);

        logToDb(params.agentId, 'info', `[SELF-EVOLVE] Prompt updated: ${reason}`);
        return { ok: true, message: 'Промпт обновлён. Новый промпт начнёт действовать со следующего тика.', prompt_length: newPrompt.length };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'update_my_interval': {
      const minutes = args.interval_minutes as number;
      if (typeof minutes !== 'number' || minutes < 0 || minutes > 1440) return { error: 'interval_minutes должен быть 0-1440' };
      const ms = Math.round(minutes * 60000);
      try {
        const { pool } = await import('../db');
        const tcRow = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        const tc = tcRow.rows[0]?.trigger_config || {};
        tc.intervalMs = ms;
        await pool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), params.agentId]);
        logToDb(params.agentId, 'info', `[SELF-EVOLVE] Interval changed to ${minutes} min`);
        return { ok: true, intervalMs: ms, minutes, message: ms === 0 ? 'Проактивный режим отключён. Будешь работать только реактивно.' : `Интервал обновлён на ${minutes} мин. Изменение вступит в силу при следующем перезапуске.` };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'update_my_description': {
      const desc = args.description as string;
      if (!desc || desc.length < 3) return { error: 'Описание слишком короткое' };
      if (desc.length > 500) return { error: 'Описание слишком длинное (максимум 500 символов)' };
      try {
        const { pool } = await import('../db');
        await pool.query('UPDATE builder_bot.agents SET description=$1 WHERE id=$2', [desc, params.agentId]);
        return { ok: true, description: desc };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Inter-agent tools ──
    case 'list_my_agents': {
      try {
        const db = (await import('./tools/db-tools')).getDBTools();
        const result = await db.getUserAgents(params.userId);
        if (!result.success) return { error: 'Не удалось получить список агентов' };
        return (result.data || []).map((a: any) => ({
          id: a.id, name: a.name, triggerType: a.triggerType,
          isActive: a.isActive,
          description: (a.description || '').slice(0, 100),
        }));
      } catch (e: any) { return { error: e.message }; }
    }

    case 'ask_agent': {
      const targetId = args.agent_id as number;
      const message = args.message as string;
      if (!targetId || !message) return { error: 'Нужны agent_id и message' };

      // Check inter-agent permission via agent state
      try {
        const stateRepo = getAgentStateRepository();
        const interAgentState = await stateRepo.get(params.agentId, 'inter_agent_enabled');
        if (!interAgentState || interAgentState.value !== 'true') {
          return { error: 'Межагентная коммуникация отключена для этого агента. Попроси пользователя включить её в меню агента.' };
        }

        // Verify target agent belongs to same user
        const db = (await import('./tools/db-tools')).getDBTools();
        const targetAgent = await db.getAgent(targetId, params.userId);
        if (!targetAgent.success || !targetAgent.data) {
          return { error: `Агент #${targetId} не найден у этого пользователя` };
        }

        // ── Deadlock detection: check if target is already waiting for us ──
        const pendingToUs = (_pendingMessages.get(params.agentId) || [])
          .filter(m => m.includes(`[От агента #${targetId}]`));
        if (pendingToUs.length > 2) {
          return { error: `Deadlock detected: Agent #${targetId} already has ${pendingToUs.length} pending messages to you. Process incoming messages first before sending more.` };
        }

        // ── Delivery check: verify target is active ──
        const targetActive = _activeHandles.has(targetId);
        const deliveryStatus = targetActive ? 'delivered' : 'queued';

        // ── Response pairing: add request ID ──
        const requestId = `req_${params.agentId}_${Date.now()}`;

        // Send message with request ID for response pairing
        addMessageToAIAgent(targetId, `[От агента #${params.agentId} | reqId=${requestId}]: ${message}`);
        await logToDb(params.agentId, 'info', `[InterAgent] → #${targetId}: ${message.slice(0, 100)} (${deliveryStatus})`, params.userId);

        return {
          success: true,
          requestId,
          deliveryStatus,
          targetActive,
          message: `Сообщение отправлено агенту #${targetId} «${targetAgent.data.name || ''}». Статус: ${deliveryStatus}.${!targetActive ? ' Агент неактивен — сообщение будет обработано при запуске.' : ''}`,
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'run_custom_plugin': {
      try {
        const pluginName = args.name as string;
        if (!pluginName) return { error: 'name required' };
        const { getCustomPluginsRepository } = await import('../db/schema-extensions');
        const plugin = await getCustomPluginsRepository().getByName(params.userId, pluginName);
        if (!plugin) return { error: `Plugin "${pluginName}" not found` };
        // Execute in VM2 sandbox
        const { NodeVM } = await import('vm2');
        const vm = new NodeVM({
          timeout: 10000,
          sandbox: { params: args.params || {} },
          eval: false,
          wasm: false,
        });
        const result = vm.run(`module.exports = (function() { ${plugin.code} })()`, 'plugin.js');
        await getCustomPluginsRepository().incrementExecCount(params.userId, pluginName);
        return { result: typeof result === 'object' ? result : String(result) };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'list_custom_plugins': {
      try {
        const { getCustomPluginsRepository } = await import('../db/schema-extensions');
        const plugins = await getCustomPluginsRepository().getByUser(params.userId);
        return { plugins: plugins.map(p => ({ name: p.name, description: p.description, execCount: p.exec_count })) };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'run_plugin': {
      try {
        const pluginId = args.plugin_id as string || args.pluginId as string;
        if (!pluginId) return { error: 'plugin_id required. Use list_plugins() to see available plugins.' };
        const { getPluginManager } = await import('../plugins-system');
        const pm = getPluginManager();
        const result = await pm.executePlugin(pluginId, { ...args.params, userId: params.userId });
        return result;
      } catch (e: any) {
        return { error: e.message };
      }
    }

    // ── Director tools ────────────────────────────────────────────
    case 'assign_task': {
      try {
        const telegramUserId = args.telegram_user_id as number;
        const task = args.task as string;
        const deadline = args.deadline as string | undefined;
        if (!telegramUserId || !task) return { error: 'telegram_user_id and task required' };
        const { getAgentTasksRepository } = await import('../db/schema-extensions');
        const taskRow = await getAgentTasksRepository().create(params.agentId, telegramUserId, params.userId, task, deadline);
        // Send message to human via bot
        try {
          const { getBotInstance } = await import('../bot');
          const bot = getBotInstance();
          if (bot) {
            const agentName = (params as any).agentName || `Agent #${params.agentId}`;
            const deadlineStr = deadline ? `\n⏰ Дедлайн: ${deadline}` : '';
            await bot.telegram.sendMessage(telegramUserId,
              `📋 <b>Новая задача от AI Director</b>\n\n` +
              `🤖 Агент: ${agentName}\n` +
              `📝 Задача: ${task}${deadlineStr}`,
              {
                parse_mode: 'HTML' as const,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '✅ Принять', callback_data: `task_accept:${taskRow.id}` },
                      { text: '❌ Отклонить', callback_data: `task_reject:${taskRow.id}` },
                    ],
                    [{ text: '💬 Обсудить', callback_data: `task_discuss:${taskRow.id}` }],
                  ],
                },
              }
            );
          }
        } catch (e: any) {
          return { taskId: taskRow.id, warning: `Task created but notification failed: ${e.message}` };
        }
        return { taskId: taskRow.id, status: 'sent', message: `Задача отправлена пользователю ${telegramUserId}` };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'check_tasks': {
      try {
        const { getAgentTasksRepository } = await import('../db/schema-extensions');
        const tasks = await getAgentTasksRepository().getByAgent(params.agentId);
        return {
          tasks: tasks.map(t => ({
            id: t.id,
            assignee: t.assignee_id,
            task: t.task,
            status: t.status,
            deadline: t.deadline,
            response: t.response,
            created: t.created_at,
          })),
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'manage_agent': {
      try {
        const targetId = args.agent_id as number;
        const action = args.action as string;
        if (!targetId || !action) return { error: 'agent_id and action required' };
        const db = (await import('./tools/db-tools')).getDBTools();
        const agent = await db.getAgent(targetId, params.userId);
        if (!agent.success || !agent.data) return { error: `Agent #${targetId} not found` };
        if (action === 'status') return { id: targetId, name: agent.data.name, isActive: agent.data.isActive };
        if (action === 'logs') {
          const logs = await getAgentLogsRepository().getByAgent(targetId, 10);
          return { logs: logs.map(l => ({ level: l.level, message: l.message, at: l.createdAt })) };
        }
        if (action === 'start' || action === 'stop') {
          const { getRunnerAgent: getRunner } = await import('./sub-agents/runner');
          const runner = getRunner();
          if (action === 'start') await runner.runAgent({ agentId: targetId, userId: params.userId });
          else await runner.pauseAgent(targetId, params.userId);
          return { ok: true, action, agentId: targetId };
        }
        return { error: 'Unknown action' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'send_report': {
      try {
        const targetUserId = args.user_id as number;
        const report = args.report as string;
        if (!targetUserId || !report) return { error: 'user_id and report required' };
        const { getBotInstance } = await import('../bot');
        const bot = getBotInstance();
        if (!bot) return { error: 'Bot not available' };
        const agentName = (params as any).agentName || `Agent #${params.agentId}`;
        await bot.telegram.sendMessage(targetUserId,
          `📊 <b>Отчёт от ${agentName}</b>\n\n${report}`,
          { parse_mode: 'HTML' as const }
        );
        return { ok: true, message: `Report sent to ${targetUserId}` };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Workflow / Planning ──
    case 'create_plan': {
      const planName = args.plan_name as string;
      const steps = args.steps as Array<{ action: string; tool?: string; condition?: string }>;
      if (!planName || !steps?.length) return { error: 'Нужны plan_name и steps' };
      const stateRepo = getAgentStateRepository();
      const plan = { name: planName, steps: steps.map((s, i) => ({ ...s, status: 'pending', id: i + 1 })), createdAt: new Date().toISOString() };
      await stateRepo.set(params.agentId, params.userId, `plan:${planName}`, JSON.stringify(plan));
      // Also add to pending_tasks for proactive execution
      const existing = await stateRepo.get(params.agentId, 'pending_tasks').catch(() => null);
      const tasks = existing ? (typeof existing.value === 'string' ? (() => { try { return JSON.parse(existing.value); } catch { return []; } })() : []) : [];
      for (const s of steps) tasks.push(`[Plan: ${planName}] ${s.action}`);
      await stateRepo.set(params.agentId, params.userId, 'pending_tasks', JSON.stringify(tasks));
      return { ok: true, plan_name: planName, steps_count: steps.length, message: `План "${planName}" создан с ${steps.length} шагами и добавлен в pending_tasks` };
    }

    case 'get_execution_stats': {
      try {
        const repo = getExecutionHistoryRepository();
        const stats = await repo.getStats(params.userId);
        const agentRuns = await repo.getByAgent(params.agentId, 5);
        return {
          overall: stats,
          recent_runs: agentRuns.map((r: any) => ({
            id: r.id, status: r.status, duration: r.durationMs,
            started: r.startedAt, tools: r.resultSummary?.toolCalls || 0,
            tokens: r.resultSummary?.tokensUsed || 0,
          })),
        };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Knowledge store (uses agent_state with prefix) ──
    case 'knowledge_save': {
      const cat = (args.category as string) || 'notes';
      const title = args.title as string;
      const content = args.content as string;
      const tags = (args.tags as string) || '';
      if (!title || !content) return { error: 'title и content обязательны' };
      const id = `kb:${cat}:${Date.now()}`;
      const entry = { title, content, category: cat, tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean), createdAt: new Date().toISOString() };
      await getAgentStateRepository().set(params.agentId, params.userId, id, JSON.stringify(entry));
      return { ok: true, id, category: cat, title };
    }

    case 'knowledge_search': {
      const q = (args.query as string || '').toLowerCase();
      const catFilter = args.category as string;
      if (!q) return { error: 'query обязателен' };
      const stateRepo = getAgentStateRepository();
      const allKeys = await stateRepo.listKeys(params.agentId);
      const kbKeys = allKeys.filter((k: string) => k.startsWith('kb:') && (!catFilter || k.startsWith(`kb:${catFilter}:`)));
      const results: any[] = [];
      for (const key of kbKeys.slice(0, 50)) {
        const val = await stateRepo.get(params.agentId, key).catch(() => null);
        if (!val) continue;
        let entry: any;
        const raw = typeof val === 'object' && val?.value !== undefined ? val.value : val;
        try { entry = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
        if (entry.title?.toLowerCase().includes(q) || entry.content?.toLowerCase().includes(q) || entry.tags?.some((t: string) => t.toLowerCase().includes(q))) {
          results.push({ id: key, ...entry });
        }
      }
      return { count: results.length, results: results.slice(0, 20) };
    }

    case 'knowledge_list': {
      const catFilter = args.category as string;
      const stateRepo = getAgentStateRepository();
      const allKeys = await stateRepo.listKeys(params.agentId);
      const kbKeys = allKeys.filter((k: string) => k.startsWith('kb:') && (!catFilter || k.startsWith(`kb:${catFilter}:`)));
      const entries: any[] = [];
      for (const key of kbKeys.slice(0, 30)) {
        const val = await stateRepo.get(params.agentId, key).catch(() => null);
        if (!val) continue;
        const raw = typeof val === 'object' && val?.value !== undefined ? val.value : val;
        try { entries.push({ id: key, ...(typeof raw === 'string' ? JSON.parse(raw) : raw) }); } catch {}
      }
      const byCategory: Record<string, any[]> = {};
      for (const e of entries) {
        const cat = e.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({ id: e.id, title: e.title, tags: e.tags });
      }
      return { total: entries.length, categories: byCategory };
    }

    case 'knowledge_delete': {
      const id = args.id as string;
      if (!id || !id.startsWith('kb:')) return { error: 'Неверный ID записи' };
      try {
        const { pool } = await import('../db');
        await pool.query('DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2', [params.agentId, id]);
        return { ok: true, deleted: id };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Image processing tools ─────────────────────────────────
    case 'image_download': {
      try {
        const { downloadImage } = await import('../services/image-service');
        const p = await downloadImage(String(args.url));
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_resize': {
      try {
        const { resizeImage } = await import('../services/image-service');
        const p = await resizeImage(String(args.path), args.width, args.height);
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_crop': {
      try {
        const { cropImage } = await import('../services/image-service');
        const p = await cropImage(String(args.path), args.left, args.top, args.width, args.height);
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_add_text': {
      try {
        const { addTextOverlay } = await import('../services/image-service');
        const p = await addTextOverlay(
          String(args.path), String(args.text),
          args.position || 'bottom', args.font_size || 32, args.color || 'white'
        );
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_filter': {
      try {
        const { applyFilter } = await import('../services/image-service');
        const p = await applyFilter(String(args.path), args.filter);
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_convert': {
      try {
        const { convertImage } = await import('../services/image-service');
        const p = await convertImage(String(args.path), args.format);
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_info': {
      try {
        const { getImageInfo } = await import('../services/image-service');
        return await getImageInfo(String(args.path));
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_composite': {
      try {
        const { compositeImages } = await import('../services/image-service');
        const p = await compositeImages(
          String(args.base_path), String(args.overlay_path),
          args.x || 0, args.y || 0, args.opacity ?? 1
        );
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_create_text': {
      try {
        const { createTextImage } = await import('../services/image-service');
        const p = await createTextImage(
          String(args.text), args.width || 800, args.height || 400,
          args.bg_color || '#1a1a2e', args.text_color || 'white', args.font_size || 48
        );
        return { path: p };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'image_analyze': {
      try {
        const { downloadImage } = await import('../services/image-service');
        const { promises: fs } = await import('fs');
        let imgPath = String(args.path_or_url);
        if (imgPath.startsWith('http')) imgPath = await downloadImage(imgPath);
        const imgBuf = await fs.readFile(imgPath);
        const base64 = imgBuf.toString('base64');
        const mimeType = imgPath.endsWith('.png') ? 'image/png' : imgPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

        const question = args.question || 'Describe this image in detail. What do you see?';

        // Try to use Gemini Vision API (best for multimodal)
        const apiKey = (params.config.AI_API_KEY as string) || process.env.GEMINI_API_KEY || '';
        if (!apiKey) return { error: 'No API key for vision analysis. Set AI_API_KEY.' };

        const visionResp = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: question },
              ]}],
            }),
            signal: AbortSignal.timeout(30000),
          }
        );
        const vData = await visionResp.json() as any;
        return { description: vData?.candidates?.[0]?.content?.parts?.[0]?.text || 'No description available' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'schedule_action': {
      const action = args.action as string;
      const when = args.when as string;
      if (!action || !when) return { error: 'action и when обязательны' };
      // Parse relative time
      let targetTime: Date;
      const now = new Date();
      const minMatch = when.match(/(\d+)\s*min/i);
      const hourMatch = when.match(/(\d+)\s*hour|(\d+)\s*час/i);
      const atMatch = when.match(/at\s*(\d{1,2}):(\d{2})|в\s*(\d{1,2}):(\d{2})/i);
      if (minMatch) {
        targetTime = new Date(now.getTime() + parseInt(minMatch[1]) * 60000);
      } else if (hourMatch) {
        targetTime = new Date(now.getTime() + parseInt(hourMatch[1] || hourMatch[2]) * 3600000);
      } else if (atMatch) {
        const h = parseInt(atMatch[1] || atMatch[3]);
        const m = parseInt(atMatch[2] || atMatch[4]);
        targetTime = new Date(now);
        targetTime.setHours(h, m, 0, 0);
        if (targetTime <= now) targetTime.setDate(targetTime.getDate() + 1);
      } else {
        targetTime = new Date(now.getTime() + 3600000); // default 1 hour
      }
      // Save as scheduled task in state
      const stateRepo = getAgentStateRepository();
      const existing = await stateRepo.get(params.agentId, 'scheduled_actions').catch(() => null);
      const scheduled = existing ? (() => { try { return JSON.parse(existing.value); } catch { return []; } })() : [];
      scheduled.push({ action, scheduledFor: targetTime.toISOString(), createdAt: now.toISOString() });
      await stateRepo.set(params.agentId, params.userId, 'scheduled_actions', JSON.stringify(scheduled));
      return { ok: true, action, scheduled_for: targetTime.toISOString() };
    }

    default: {
      // ── Tool name aliases (AI sometimes uses wrong names) ──
      const ALIASES: Record<string, string> = {
        'ton_get_balance': 'get_ton_balance',
        'ton_balance': 'get_ton_balance',
        'check_balance': 'get_ton_balance',
        'search_web': 'web_search',
        'google_search': 'web_search',
        'search': 'web_search',
        'send_message': 'tg_send_message',
        'read_messages': 'tg_get_messages',
        'get_messages': 'tg_get_messages',
        'get_balance': 'get_ton_balance',
        'get_prices': 'dex_get_prices',
        'token_prices': 'dex_get_prices',
        'swap_simulate': 'dex_swap_simulate',
        'state_keys': 'list_state_keys',
        'get_agents': 'list_my_agents',
        'my_agents': 'list_my_agents',
        'nft_floor': 'get_nft_floor',
        'gift_catalog': 'get_gift_catalog',
        'react': 'tg_react',
        'reply': 'tg_reply',
      };
      const alias = ALIASES[name];
      if (alias) {
        console.log(`[AI Runtime] Alias: ${name} → ${alias}`);
        return executeTool(alias, args, params);
      }
      console.warn(`[AI Runtime] Unknown tool called: ${name}, args: ${JSON.stringify(args).slice(0, 200)}`);
      return { error: `Unknown tool: ${name}. Use list_plugins() or check available tools.` };
    }
  }
}

// ── Global TG fallback (backward compat for single-session mode) ───────────
async function executeGlobalTgTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'tg_send_message': return await tgSendMessage(args.peer, args.message || args.text);
    case 'tg_get_messages': return await tgGetMessages(args.peer, args.limit ?? 20);
    case 'tg_get_channel_info': return await tgGetChannelInfo(args.peer);
    case 'tg_join_channel': return await tgJoinChannel(args.peer);
    case 'tg_leave_channel': return await tgLeaveChannel(args.peer);
    case 'tg_get_dialogs': return await tgGetDialogs(args.limit ?? 20);
    case 'tg_get_members': return await tgGetMembers(args.peer, args.limit ?? 50);
    case 'tg_search_messages': return await tgSearchMessages(args.peer, args.query, args.limit ?? 20);
    case 'tg_get_user_info': return await tgGetUserInfo(args.user);
    case 'tg_reply': { const id = await tgReplyMessage(args.chat_id, args.reply_to_id, args.text, args.quote); return { ok: true, message_id: id }; }
    case 'tg_react': { await tgReactMessage(args.chat_id, args.message_id, args.emoji); return { ok: true }; }
    case 'tg_edit': { await tgEditMessage(args.chat_id, args.message_id, args.new_text); return { ok: true }; }
    case 'tg_forward': { await tgForwardMessage(args.from_chat, args.msg_id, args.to_chat); return { ok: true }; }
    case 'tg_pin': { await tgPinMessage(args.chat_id, args.message_id, args.silent !== false); return { ok: true }; }
    case 'tg_mark_read': { await tgMarkRead(args.chat_id); return { ok: true }; }
    case 'tg_get_comments': return await tgGetComments(args.chat_id, args.post_id, args.limit ?? 30);
    case 'tg_set_typing': { await tgSetTyping(args.chat_id); return { ok: true }; }
    case 'tg_send_formatted': { const id = await tgSendFormatted(args.chat_id, args.html, args.reply_to); return { ok: true, message_id: id }; }
    case 'tg_get_message_by_id': { const msg = await tgGetMessageById(args.chat_id, args.message_id); return msg || { error: 'not found' }; }
    case 'tg_get_unread': return await tgGetUnread(args.limit ?? 10);
    case 'tg_send_file': { const id = await tgSendFile(args.chat_id, args.file_url, args.caption); return { ok: true, message_id: id }; }
    case 'tg_copy_media': {
      const ub = (await import('../services/userbot-manager')).getUserbotManager();
      const sb = await ub.buildUserSandbox(_currentUserId!);
      if (!sb) return { error: 'Telegram not connected' };
      const id = await sb.copyMedia(args.from_chat_id, args.message_id, args.to_chat_id, args.caption);
      return { ok: true, message_id: id };
    }
    case 'tg_get_media_info': {
      const ub2 = (await import('../services/userbot-manager')).getUserbotManager();
      const sb2 = await ub2.buildUserSandbox(_currentUserId!);
      if (!sb2) return { error: 'Telegram not connected' };
      return await sb2.getMediaInfo(args.chat_id, args.message_id);
    }
    case 'tg_send_silent': case 'tg_get_webpage': case 'tg_press_button':
    case 'tg_get_chat_stats': case 'tg_save_draft': case 'tg_send_with_buttons':
    case 'tg_get_poll_results': case 'tg_send_sticker': case 'tg_send_gif':
    case 'tg_send_voice': case 'tg_transcribe_voice': case 'tg_get_sticker_sets':
      return { error: 'This tool requires per-agent Telegram auth (userbot). Connect via agent settings.' };
    default: return { error: 'Unknown tg tool' };
  }
}

// ── Log to DB ──────────────────────────────────────────────────────────────

async function logToDb(agentId: number, level: string, message: string, userId = 0): Promise<void> {
  try {
    await getAgentLogsRepository().insert({ agentId, userId, level, message });
  } catch (e) {
    console.warn('[logToDb] Failed:', (e as any)?.message);
  }
}

// ── Memory Consolidation ─────────────────────────────────────────────────
// AI-powered compression of old agent state to keep context lean
// Runs automatically every N runs (default: every 20 runs)

const CONSOLIDATION_INTERVAL = 20; // runs between consolidations
const MAX_STATE_ENTRIES_BEFORE_CONSOLIDATION = 50;

async function maybeConsolidateMemory(params: AIAgentTickParams, ai: OpenAI, model: string): Promise<void> {
  const stateRepo = getAgentStateRepository();
  try {
    // Check if it's time to consolidate
    const runCountRaw = await stateRepo.get(params.agentId, '_consolidation_run_count').catch(() => null);
    const runCount = parseInt(String(runCountRaw?.value || runCountRaw || '0')) || 0;

    if (runCount < CONSOLIDATION_INTERVAL) {
      await stateRepo.set(params.agentId, params.userId, '_consolidation_run_count', String(runCount + 1));
      return;
    }

    // Reset counter
    await stateRepo.set(params.agentId, params.userId, '_consolidation_run_count', '0');

    // Get all state keys
    const allKeys = await stateRepo.listKeys(params.agentId);
    const userKeys = allKeys.filter(k => !k.startsWith('_') && k !== 'wallet_mnemonic' && k !== 'wallet_address' && k !== 'auto_approve' && k !== 'memory_summary' && k !== 'memory_digest');

    if (userKeys.length < MAX_STATE_ENTRIES_BEFORE_CONSOLIDATION) return;

    // Gather all state values
    const entries: Array<{ key: string; value: string }> = [];
    for (const key of userKeys.slice(0, 100)) {
      const val = await stateRepo.get(params.agentId, key).catch(() => null);
      if (!val) continue;
      const raw = typeof val === 'object' && val?.value !== undefined ? val.value : val;
      entries.push({ key, value: String(raw).slice(0, 500) });
    }

    // Ask AI to consolidate
    const consolidationPrompt = `Ты — система сжатия памяти AI-агента. Агент накопил ${entries.length} записей в состоянии.
Твоя задача: сжать всю несущественную информацию в одну запись "memory_summary".

Текущие записи:
${entries.map(e => `[${e.key}]: ${e.value}`).join('\n')}

Правила 3-уровневой памяти:
HOT (никогда не удалять): ключи с importance=high, wallet_address, contacts, mem: с importance=high
WARM (сжимать): conversation_context, старые записи last_post_time, повторяющаяся информация → объединить в summary
COLD (удалять): устаревшие timestamps, завершённые задачи, дубликаты

1. СОХРАНИ (HOT): wallet_address, pending_tasks, контакты, mem: записи с importance=high, scheduled_actions, plans
2. СОЖМИ (WARM): conversation_context (оставь только последний), повторяющуюся информацию → включи в summary
3. УДАЛЯЙ (COLD): устаревшие данные, завершённые задачи, старые timestamps, mem: записи с importance=low старше 3 дней
4. Верни JSON: { "keep": ["key1", "key2"], "delete": ["key3", "key4"], "summary": "Сжатая память агента" }
5. НИКОГДА не удаляй ключи: kb:*, plan:*, mem: с importance=high`;

    const response = await ai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: consolidationPrompt }],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const text = response.choices[0]?.message?.content || '';
    let result: { keep?: string[]; delete?: string[]; summary?: string };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch { return; }

    if (!result.delete?.length || !result.summary) return;

    // Safety: never delete more than 60% of entries
    if (result.delete.length > entries.length * 0.6) {
      result.delete = result.delete.slice(0, Math.floor(entries.length * 0.6));
    }

    // Save summary
    await stateRepo.set(params.agentId, params.userId, 'memory_summary', result.summary);

    // Delete old entries
    const { pool } = await import('../db');
    for (const key of result.delete) {
      if (key.startsWith('kb:') || key.startsWith('plan:') || key === 'wallet_mnemonic' || key === 'wallet_address') continue;
      // Protect high-importance memories from deletion
      if (key.startsWith('mem:')) {
        try {
          const val = await stateRepo.get(params.agentId, key).catch(() => null);
          if (val?.value) {
            const parsed = JSON.parse(val.value);
            if (parsed.importance === 'high') continue; // HOT tier — never delete
          }
        } catch {}
      }
      await pool.query('DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2', [params.agentId, key]);
    }

    await logToDb(params.agentId, 'info', `[Memory] Consolidated: kept ${result.keep?.length || 0}, deleted ${result.delete.length}, summary=${result.summary.slice(0, 100)}`, params.userId);
    console.log(`[Memory] Agent #${params.agentId}: consolidated ${result.delete.length} entries`);
  } catch (e: any) {
    console.warn('[Memory] Consolidation failed:', e.message?.slice(0, 100));
  }
}

// ── Flow code executor (deterministic) ──────────────────────────────────────
async function executeFlowCode(execCode: string, params: AIAgentTickParams): Promise<{ success: boolean; error?: string }> {
  await logToDb(params.agentId, 'info', '[flow-exec] Starting compiled flow code', params.userId);
  const stateRepo = getAgentStateRepository();

  // Helper functions available in flow code (with logging)
  const getBalance = async (addr: string) => {
    await logToDb(params.agentId, 'info', `[flow-exec] getBalance(${addr})`, params.userId);
    const r = await executeTool('get_ton_balance', { address: addr }, params);
    await logToDb(params.agentId, 'info', `[flow-exec] balance result: ${JSON.stringify(r).slice(0, 200)}`, params.userId);
    return r?.balance_ton ?? r;
  };
  const notify = async (msg: string) => {
    await logToDb(params.agentId, 'info', `[flow-exec] notify(${msg.slice(0, 100)})`, params.userId);
    return executeTool('notify', { message: msg }, params);
  };
  const webSearch = async (query: string) => {
    await logToDb(params.agentId, 'info', `[flow-exec] webSearch(${query})`, params.userId);
    const r = await executeTool('web_search', { query }, params);
    return r?.result ?? r;
  };
  const fetchUrl = async (url: string) => {
    await logToDb(params.agentId, 'info', `[flow-exec] fetchUrl(${url})`, params.userId);
    const r = await executeTool('fetch_url', { url }, params);
    return r?.content ?? r;
  };
  const getState = async (key: string) => {
    const v = await stateRepo.get(params.agentId, key);
    return (v as any)?.value ?? null;
  };
  const setState = async (key: string, val: any) => {
    await stateRepo.set(params.agentId, params.userId, key, String(val));
  };
  const sendTon = async (to: string, amount: string, memo?: string) => {
    return executeTool('send_ton', { to, amount, memo: memo || '' }, params);
  };
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, Math.min(ms, 30000)));
  const callTool = async (name: string, args: any) => {
    await logToDb(params.agentId, 'info', `[flow-exec] callTool: ${name}(${JSON.stringify(args).slice(0, 200)})`, params.userId);
    const r = await executeTool(name, args, params);
    await logToDb(params.agentId, 'info', `[flow-exec] result: ${JSON.stringify(r).slice(0, 300)}`, params.userId);
    return r;
  };

  try {
    // Execute flow code in VM2 sandbox (not via Function constructor) for security
    const { VM } = require('vm2');
    const vm = new VM({
      timeout: 30000,
      eval: false,
      wasm: false,
      sandbox: {
        getBalance, notify, webSearch, fetchUrl, getState, setState, sendTon, sleep, callTool,
        console: { log: () => {}, error: () => {}, warn: () => {} },
      },
    });
    // Wrap in async IIFE since VM2 doesn't natively support top-level await well
    const wrappedCode = `(async () => { ${execCode} })()`;
    await vm.run(wrappedCode);
    await logToDb(params.agentId, 'info', '[flow-exec] Flow code completed successfully', params.userId);
    return { success: true };
  } catch (e: any) {
    const errMsg = `[flow-exec] Error: ${e.message}`;
    await logToDb(params.agentId, 'error', errMsg, params.userId);
    return { success: false, error: e.message };
  }
}

// ── Core tick ──────────────────────────────────────────────────────────────

export async function runAIAgentTick(params: AIAgentTickParams): Promise<{
  finalResponse?: string;
  toolCallCount: number;
  error?: string;
}> {
  let ai: OpenAI;
  let defaultModel: string;
  try {
    const result = getAIClient(params.config);
    ai = result.client;
    defaultModel = result.defaultModel;
  } catch (e: any) {
    if (e.message === 'NO_API_KEY') {
      const errMsg = '🔑 API ключ не настроен. Добавьте ключ: Профиль → API ключи';
      if (params.onNotify) params.onNotify(errMsg);
      await logToDb(params.agentId, 'error', errMsg, params.userId);
      return { toolCallCount: 0, error: 'NO_API_KEY' };
    }
    throw e;
  }
  const msgs = params.pendingMessages || [];

  await logToDb(params.agentId, 'info', `[AI run] start, pendingMsgs=${msgs.length}`, params.userId);

  // ── Execution tracking ──
  let execId: number | null = null;
  const tickStart = Date.now();
  try {
    execId = await getExecutionHistoryRepository().startExecution({
      agentId: params.agentId, userId: params.userId, triggerType: msgs.length > 0 ? 'message' : 'proactive',
    });
  } catch (e: any) { console.warn(`[ExecTracker] startExecution failed: ${e.message}`); }
  let totalTokensUsed = 0;

  // ── Execute compiled flow code if present (deterministic — NO AI fallback) ──
  const execCode = params.config.execCode as string | undefined;
  if (execCode && msgs.length === 0) {
    // Flow code = constructor agent. Execute ONLY the compiled code, never fall to AI.
    const flowResult = await executeFlowCode(execCode, params);
    if (flowResult.success) {
      await logToDb(params.agentId, 'info', `[AI run] flow code executed OK`, params.userId);
    } else {
      await logToDb(params.agentId, 'error', `[AI run] flow code FAILED: ${flowResult.error}`, params.userId);
      // Notify user about the error so they can fix their flow
      const errNotice = `⚠️ Ошибка в конструкторе: ${flowResult.error}\n\nПроверьте настройки блоков (подключён ли Telegram аккаунт?)`;
      if (params.onNotify) await params.onNotify(errNotice).catch(() => {});
      else await notifyUser(params.userId, errNotice).catch(() => {});
    }
    // ALWAYS return here — constructor agents never use AI loop
    return { toolCallCount: 0, finalResponse: flowResult.success ? 'Flow executed' : flowResult.error };
  }

  // ── Build initial message list ──────────────────────────────────
  // ── Memory consolidation: compress old state entries if too many ──
  let memoryDigest = '';
  try {
    const _stateRepo = getAgentStateRepository();
    const allKeys = await _stateRepo.listKeys(params.agentId);
    const kbKeys = allKeys.filter((k: string) => k.startsWith('kb:'));
    const logKeys = allKeys.filter((k: string) => k.startsWith('log:') || k.startsWith('history:'));

    if (kbKeys.length > 40) {
      // Too many knowledge entries — create AI summary
      const oldEntries: string[] = [];
      const keysToRemove = kbKeys.slice(0, kbKeys.length - 20); // keep newest 20
      for (const key of keysToRemove.slice(0, 30)) {
        const val = await _stateRepo.get(params.agentId, key).catch(() => null);
        if (val) {
          const raw = typeof val === 'object' && val?.value !== undefined ? val.value : val;
          try {
            const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
            oldEntries.push(`[${entry.category}] ${entry.title}: ${(entry.content || '').slice(0, 200)}`);
          } catch {}
        }
      }
      if (oldEntries.length > 0) {
        // Store consolidated summary as single entry
        const consolidatedText = oldEntries.join('\n');
        const existingDigest = await _stateRepo.get(params.agentId, 'memory_digest').catch(() => null);
        const prevDigest = existingDigest ? (typeof existingDigest === 'string' ? existingDigest : existingDigest?.value || '') : '';
        const newDigest = (prevDigest ? prevDigest + '\n---\n' : '') + `[Consolidated ${new Date().toISOString().slice(0, 10)}]:\n${consolidatedText}`;
        // Keep digest under 3000 chars
        const trimmedDigest = newDigest.length > 3000 ? newDigest.slice(-3000) : newDigest;
        await _stateRepo.set(params.agentId, params.userId, 'memory_digest', trimmedDigest);
        // Remove old entries
        const { pool } = await import('../db');
        for (const key of keysToRemove) {
          await pool.query('DELETE FROM builder_bot.agent_state WHERE agent_id=$1 AND key=$2', [params.agentId, key]).catch(() => {});
        }
        await logToDb(params.agentId, 'info', `[Memory] Consolidated ${keysToRemove.length} old KB entries into digest`, params.userId);
      }
    }
    // Load memory digest + AI summary for context
    const digestVal = await _stateRepo.get(params.agentId, 'memory_digest').catch(() => null);
    const summaryVal = await _stateRepo.get(params.agentId, 'memory_summary').catch(() => null);
    const digestRaw = digestVal ? (typeof digestVal === 'string' ? digestVal : digestVal?.value || '') : '';
    const summaryRaw = summaryVal ? (typeof summaryVal === 'string' ? summaryVal : summaryVal?.value || '') : '';
    const combined = [summaryRaw, digestRaw].filter(Boolean).join('\n---\n');
    if (combined) {
      memoryDigest = `\n[MEMORY — consolidated knowledge]:\n${combined.slice(0, 3000)}\n`;
    }
  } catch (e: any) {
    console.error('[Memory consolidation]', e.message?.slice(0, 100));
  }

  // Context message: current state summary + config (without secrets)
  const configSummary = Object.entries(params.config)
    .filter(([k]) => !k.toLowerCase().includes('mnemonic') && !k.toLowerCase().includes('key'))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(', ');

  // Plugin summary for context
  let pluginHint = '';
  try {
    const { getPluginManager } = await import('../plugins-system');
    const pm = getPluginManager();
    const stats = pm.getStats();
    pluginHint = `\nПлагины: ${stats.installed} установлено из ${stats.total} (DeFi: ${stats.byType.defi}, Аналитика: ${stats.byType.analytics}, Уведомления: ${stats.byType.notification}, Безопасность: ${stats.byType.security}). Используй list_plugins/suggest_plugin если нужен плагин.`;
  } catch {}

  // Inter-agent status
  let interAgentHint = '';
  try {
    const iaState = await getAgentStateRepository().get(params.agentId, 'inter_agent_enabled');
    if (iaState && iaState.value === 'true') {
      interAgentHint = '\nМежагентная коммуникация: ВКЛЮЧЕНА. Используй list_my_agents и ask_agent для взаимодействия с другими агентами.';
    }
  } catch {}

  // ── Gift system knowledge (ONLY for agents with gifts capabilities) ─────────
  const _caps = (params.config.enabledCapabilities as string[]) || null;
  const hasGiftCaps = !_caps || _caps.some(c => c.includes('gift') || c === 'gifts' || c === 'gifts_market');
  const GIFT_SYSTEM_KNOWLEDGE = !hasGiftCaps ? '' : `
[TELEGRAM GIFTS KNOWLEDGE BASE]
🚨 ГЛАВНОЕ ПРАВИЛО:
Для ЛЮБЫХ вопросов о подарках (Lol Pop, Jelly Bunny, Heart Locket, Plush Pepe, и любое другое название коллекции подарков):
→ ТОЛЬКО инструменты: get_gift_floor_real, get_collection_offers, get_gift_aggregator, scan_real_arbitrage, get_price_list, get_market_overview
→ НИКОГДА не используй get_nft_floor, get_ton_balance или другие TON/NFT инструменты для подарков
→ Данные ВСЕГДА доступны через GiftAsset/SwiftGifts API — оффчейн (Tonnel/Portals/Mrkt) и ончейн (GetGems/Fragment)
→ Если get_collection_offers вернул [] — активных buy-ордеров нет прямо сейчас, объясни как продать через листинг на GetGems

📦 Стадии жизни подарка:
1. PRE-MARKET (обычный подарок) — выпускается в обычном виде, ещё НЕ является NFT. Нельзя передать или продать. Хранится у пользователя в боте.
2. UPGRADE (улучшение за Stars) — пользователь платит Stars чтобы улучшить подарок → он становится уникальным NFT с порядковым номером (#1, #2, #3...). Каждый улучшенный получает УНИКАЛЬНЫЙ номер внутри своей коллекции.
3. UNIQUE GIFT (NFT) — можно торговать на маркетах (Fragment/GetGems/GiftAsset/Telegram Market).

💰 Как формируется цена:
- Номер выпуска (#): Чем МЕНЬШЕ номер, тем ДОРОЖЕ. #1 стоит 50,000+ Stars, #100 намного дешевле.
- Фон (background): САМЫЙ важный фактор! Чёрный фон (#000000 или "Black") = максимальная цена. Цветные фоны дешевле. Пример: "Homemade Cake" с чёрным фоном стоит в 10-50x дороже чем с белым.
- Модель (model): Дизайн подарка. Редкие модели (lower drop rate %) стоят дороже.
- Символ/декор (symbol): Дополнительный элемент украшения, влияет на цену незначительно.
- Процент выпадения (supply %): Чем НИЖЕ % вероятности → тем РЕЖЕ → тем ДОРОЖЕ.

📊 Маркетплейсы и типы:
ОФФЧЕЙН маркеты (подарки НЕ на блокчейне — дешевле):
- Tonnel → цены в TON (⚠️ ТОЛЬКО ПОКУПКА — плохая ликвидность для продажи)
- Portals → цены в TON (оффчейн, можно и покупать и продавать)
- MRKT.tg → цены в TON (оффчейн)
ОНЧЕЙН маркеты (NFT на блокчейне — дороже, но лучшая ликвидность):
- GetGems → цены в TON (лучший ликвидный sell-маркет)
- Fragment.com → цены в TON (NFT торговля, высокая ликвидность)
- GiftAsset.pro → цены в TON (агрегатор, Premium API)
- SwiftGifts → цены в TON (агрегатор 7 маркетплейсов)

⚠️ КРИТИЧЕСКИЕ ПРАВИЛА:
- ОНЧЕЙН подарки стоят ДОРОЖЕ чем оффчейн аналоги (разница 10-25%) — это НОРМАЛЬНО
- Когда пишешь флор: ВСЕГДА указывай оффчейн-флор И ончейн-флор ОТДЕЛЬНО
- Пример правильного ответа: "Portals (offchain): 4.74 TON | GetGems (onchain): 5.40 TON"
- Tonnel = только источник покупки, НИКОГДА не продавать на Tonnel
- Апгрейды подарков — ИГНОРИРОВАТЬ. Арбитраж только между маркетплейсами.
- Stars цены — игнорировать. Только TON.
- НИКОГДА не просить пользователя пополнить кошелёк — просто уведомить если баланса недостаточно
- Не повторять одни и те же возможности каждый запуск — использовать set_state/get_state для дедупликации

🚫 СТРОГИЙ ЗАПРЕТ ГАЛЛЮЦИНАЦИЙ И СПАМА:
- notify() ТОЛЬКО после того, как инструмент вернул конкретный листинг с полями: provider, price_ton, link
- НИКОГДА не вызывай notify() на основе: get_state результата, предположений, логики без API-ответа
- ПОРЯДОК ОБЯЗАТЕЛЕН: сначала инструмент → проверь ответ items[] → если непустой → только тогда notify()
- Если get_gift_aggregator вернул items[] = [] → не нотифицировать, просто завершить молча
- Если get_gift_aggregator вернул items[0] с реальным price_ton и link → ТОГДА notify() с этой ссылкой

📵 ОДИН notify() ЗА ЗАПУСК — АБСОЛЮТНОЕ ПРАВИЛО:
- НИКОГДА не вызывай notify() несколько раз за один запуск — это СПАМ
- Объедини все находки в ОДНО сообщение: "Нашёл 3 Lol Pop: cheapest 4.47 на Portals, 4.83 на MRKT..."
- Если пользователь сказал "до X TON" → уведомлять ТОЛЬКО если items[0].price_ton ≤ X
- Если нашёл только дороже чем просили → НЕ нотифицировать, завершить молча

❓ НЕ СПРАШИВАЙ Telegram ID — receiver берётся автоматически из системы

🎯 Оценка КАЧЕСТВА подарка (влияет на цену):
1. ФОНЫ (от дороже к дешевле): Чёрный > Тёмно-синий > Фиолетовый > Другие цветные > Белый/Серый
   - Чёрный фон = наценка 5-50x к коллекционной стоимости
   - ВСЕГДА проверять backdrop у каждого листинга через get_gift_aggregator
2. МОДЕЛИ: чем НИЖЕ drop_rate% — тем редкость выше — тем цена выше
   - Пример: модель с drop_rate 0.5% стоит 3-10x дороже модели с drop_rate 10%
   - Если цена листинга < ожидаемой по редкости модели → недооценён → покупать
3. НОМЕР выпуска (#N): #1-#10 стоят значительно дороже. #100+ — ближе к флору.

🔄 Арбитраж стратегии:
- Оффчейн → Ончейн: купить дёшево на Portals/Mrkt (offchain) → продать на GetGems (onchain) = 10-25% прибыль
- Tonnel дешевле всего → купить там, продать на getgems/mrkt/portals
- Искать недооценённые подарки: чёрный фон или редкая модель по цене флора = 🔥
- Следить за свежими коллекциями: первые листинги обычно дешевле рынка

🛠 ПОЛНЫЙ АРСЕНАЛ ИНСТРУМЕНТОВ (23 gift-инструмента):

📊 АНАЛИТИКА И ОБЗОР РЫНКА:
1. get_top_deals() → ТОП сделки дня (GiftAsset Pro) — начинай мониторинг с этого
2. get_collections_marketcap() → капитализация ВСЕХ коллекций — какие рынки самые большие
3. get_market_health() → greed + health индексы (>70 greed = продавай, <30 = покупай)
4. get_market_activity(gift?, type, markets) → ЛЕНТА покупок/продаж в реалтайме — что покупают ПРЯМО СЕЙЧАС
5. get_price_history(collection_name) → ТРЕНД цен за дни/недели — растёт, падает, стабильна

💰 ОЦЕНКА И ПОИСК ВЫГОДЫ:
6. find_underpriced_gifts(collection, max_price?, min_discount_pct?) → 🔥 ГЛАВНЫЙ ИНСТРУМЕНТ — находит листинги дешевле fair value по backdrop+model
7. get_unique_gift_prices(name) → цены per-variant (backdrop+model combo) — точнее флора коллекции
8. get_backdrop_floors(collection) → флор по цвету фона (чёрный = 5-50x дороже белого)
9. get_attribute_volumes(name) → объём продаж по атрибутам — что реально покупают (ликвидность)
10. get_price_list() → текущие флор-цены ВСЕХ коллекций разом

🔍 ПОИСК КОНКРЕТНЫХ ПРЕДЛОЖЕНИЙ:
11. get_gift_aggregator(name, to_price?, backdrop?, model?) → живые листинги со ВСЕХ маркетов + BOC для покупки
12. scan_real_arbitrage() → кросс-маркет спреды, верифицированные агрегатором
13. get_collection_offers(name) → ГАРАНТИРОВАННЫЕ покупатели (buy offers) — надёжная цена продажи
14. get_gift_floor_real(slug) → флор по всем маркетам отдельно (offchain vs onchain)
15. get_gift_sales_history(slug) → последние сделки конкретной коллекции

🛒 ПОКУПКА И ПРОДАЖА:
16. buy_market_gift(tx_contract, tx_payload, price_ton) → МГНОВЕННАЯ ПОКУПКА (нужен can_buy_now=true)
17. get_agent_wallet() → адрес и баланс кошелька агента
18. send_ton(to, amount) → отправить TON
19. list_gift_for_sale(gift_id, price) → выставить подарок на продажу

📦 ПОРТФОЛИО И ИНФО:
20. get_user_portfolio(username/telegram_id) → портфолио пользователя с оценкой
21. get_gift_upgrade_stats() → статистика апгрейдов
22. analyze_gift_profitability(name) → анализ прибыльности коллекции

⛔ УСТАРЕВШИЕ: scan_arbitrage() — НЕ ИСПОЛЬЗУЙ. Только scan_real_arbitrage().

🧠 ЦЕПОЧКИ АНАЛИЗА (Smart Valuation):

📈 Цепочка "НАЙТИ ВЫГОДУ" (главная для автономных агентов):
1. find_underpriced_gifts(collection, max_price) → сразу получаешь discount% и fair_value
2. Если discount >15% → buy_market_gift() если can_buy_now=true
3. Если discount 10-15% → notify_rich() с деталями для ручной покупки

📊 Цепочка "АНАЛИЗ КОЛЛЕКЦИИ" (перед покупкой):
1. get_price_history(name) → тренд: растёт → покупай, падает → жди
2. get_attribute_volumes(name) → какие backdrop/model самые ликвидные
3. get_backdrop_floors(name) → сколько стоит каждый фон → знаешь fair value
4. get_collection_offers(name) → есть ли гарантированные покупатели (exit strategy)
5. get_market_activity(gift=name, type='buy') → кто покупает прямо сейчас (спрос)

🔄 Цепочка "АРБИТРАЖ" (кросс-маркет):
1. scan_real_arbitrage() → спреды между маркетами
2. get_gift_aggregator(name, to_price) → подтвердить живую цену на cheap-маркете
3. get_collection_offers(name) → подтвердить цену продажи (buy offers)
4. Если spread >8% и offer подтверждён → buy_market_gift()

🌍 Цепочка "ОБЗОР РЫНКА" (для мониторинга):
1. get_collections_marketcap() → крупнейшие коллекции
2. get_market_health() → greed/health → сейчас покупать или продавать?
3. get_top_deals() → лучшие сделки среди ВСЕХ коллекций
4. get_market_activity(type='buy') → реалтайм покупки → где спрос

🛒 ПОТОК ПОКУПКИ (для автономных агентов):
1. find_underpriced_gifts(collection, max_price) → найти самый выгодный item
   ИЛИ get_gift_aggregator(name, to_price=MAX_PRICE) → найти самый дешёвый
2. Если can_buy_now=true → buy_market_gift(tx_contract, tx_payload, price_ton, gift_name)
3. Если can_buy_now=false → notify_rich() с link для ручной покупки
4. Если ничего не найдено → завершить молча
[END GIFT KNOWLEDGE]`;

  // Chat mode vs monitoring mode instructions
  const modeHint = msgs.length > 0
    ? `\n\n⚠️ РЕЖИМ ЧАТА: Пользователь написал тебе сообщение. Ответь ТОЛЬКО текстом напрямую — НЕ вызывай инструмент notify(). Твой текстовый ответ будет доставлен автоматически. Используй инструменты только если они нужны для ответа на вопрос.`
    : `\n\n⚠️ РЕЖИМ МОНИТОРИНГА: Пользователь ждёт от тебя отчёт. Действуй:
1. Если в state есть target_gift (конкретная цель) → find_underpriced_gifts(collection=target_gift, max_price=target_price) — УМНЫЙ ПОИСК
   Fallback: get_gift_aggregator(name=target_gift, to_price=target_price) — прямой поиск
2. Если underpriced найдены с discount >15% и can_buy_now=true → buy_market_gift() автоматически
3. Если underpriced найдены но can_buy_now=false → notify_rich() с деталями + link
4. Если target_gift не задан → get_top_deals() → notify_rich() с кратким обзором
5. ВСЕГДА отправляй notify_rich() в конце тика с кратким отчётом: что проверил, что нашёл (или "ничего интересного").
   Исключение: если предыдущий запуск (get_state 'last_report_time') был <5 мин назад И ничего нового → молча.
   Формат отчёта: <b>📊 Мониторинг</b>\\n• Проверено: [что]\\n• Результат: [находки или "ничего нового"]
ПРАВИЛО: notify() вызывай ОДИН раз за запуск. Данные ТОЛЬКО из tool_result, не из головы.`;

  // ── Identity Card + Lessons + Goals + Stats ──
  let identityBlock = '';
  let lessonsBlock = '';
  let goalsBlock = '';
  let statsBlock = '';
  try {
    const meta = await getAgentMeta(params.agentId);
    if (meta) {
      const createdAt = new Date(meta.createdAt);
      const daysSince = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
      const ownerInfo = meta.ownerName
        ? `${meta.ownerName}${meta.ownerUsername ? ' (@' + meta.ownerUsername + ')' : ''}`
        : `User #${meta.userId || params.userId}`;
      // Role-specific behavior instructions
      const roleInstructions: Record<string, string> = {
        worker: `Ты — исполнитель. Фокусируйся на выполнении конкретных задач: мониторинг, сбор данных, автоматизация. Работай автономно, сообщай результаты владельцу. Не пытайся управлять другими агентами.`,
        manager: `Ты — координатор мультиагентной системы. Используй ask_agent для делегирования задач другим агентам. Контролируй их работу, собирай результаты, оптимизируй процессы. Отправляй сводные отчёты владельцу. Приоритет: координация > выполнение.`,
        specialist: `Ты — эксперт-аналитик. Давай глубокий, профессиональный анализ данных. Используй несколько источников, перепроверяй цифры, строй выводы с обоснованием. Отвечай подробно с числами и фактами. Качество > скорость.`,
        monitor: `Ты — система мониторинга и алертов. Отслеживай метрики, цены, события. Отправляй уведомления ТОЛЬКО при значимых изменениях (>5% движение, новые события). Не спамь — каждый алерт должен быть полезен. Формат: краткий + чёткий.`,
        director: `Ты — директор. Управляешь людьми и агентами. Используй assign_task для людей, manage_agent для агентов, send_report для отчётов руководству. Принимай стратегические решения, делегируй операционку.`,
      };
      const roleBehavior = roleInstructions[meta.role || 'worker'] || roleInstructions.worker;

      identityBlock = `
━━━ ТВОЯ ИДЕНТИЧНОСТЬ ━━━
Имя: ${meta.name || 'Без имени'}
Роль: ${meta.role || 'worker'}
Цель: ${meta.description || 'Не указана'}
Создатель: ${ownerInfo}
Создан: ${createdAt.toISOString().slice(0, 10)} (${daysSince} дн. назад)
ID: #${params.agentId}
Ты — автономный AI-агент. Ты можешь учиться, запоминать, формировать цели и менять своё поведение.

━━━ ПОВЕДЕНИЕ РОЛИ (${(meta.role || 'worker').toUpperCase()}) ━━━
${roleBehavior}
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
  } catch (e: any) { console.warn('[Identity]', e.message); }

  // Load agent memories (from remember tool)
  let memoriesBlock = '';
  try {
    const _sr = getAgentStateRepository();
    const allK = await _sr.listKeys(params.agentId);
    const memK = allK.filter((k: string) => k.startsWith('mem:'));
    if (memK.length > 0) {
      // Structured memory display with categories
      const categories: Record<string, string[]> = {};
      const categoryIcons: Record<string, string> = { contact: '👤', fact: '📌', preference: '⚙️', task: '📋', insight: '💡' };
      let highCount = 0;
      for (const key of memK.slice(-30)) {
        const raw = await _sr.get(params.agentId, key).catch(() => null);
        if (!raw?.value) continue;
        const cleanKey = key.replace('mem:', '');
        let parsed: any;
        try { parsed = JSON.parse(raw.value); } catch { parsed = { value: raw.value, category: 'fact', importance: 'medium' }; }
        const cat = parsed.category || 'fact';
        const imp = parsed.importance || 'medium';
        const val = parsed.value || raw.value;
        if (!categories[cat]) categories[cat] = [];
        const marker = imp === 'high' ? '❗' : '';
        categories[cat].push(`${marker}${cleanKey}: ${val}`);
        if (imp === 'high') highCount++;
      }
      const lines: string[] = [];
      for (const [cat, entries] of Object.entries(categories)) {
        const icon = categoryIcons[cat] || '📝';
        lines.push(`${icon} ${cat.toUpperCase()}:`);
        for (const e of entries) lines.push(`  • ${e}`);
      }
      if (lines.length > 0) {
        memoriesBlock = `\n━━━ ПАМЯТЬ (${memK.length} записей${highCount > 0 ? ', ' + highCount + ' важных' : ''}) ━━━\n${lines.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }
    }
    // Load prompt additions
    const addRaw = await _sr.get(params.agentId, '_prompt_additions').catch(() => null);
    if (addRaw?.value) {
      try {
        const additions: string[] = JSON.parse(addRaw.value);
        if (additions.length > 0) {
          memoriesBlock += `\n━━━ ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ━━━\n${additions.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
      } catch {}
    }
  } catch {}

  try {
    const _stateRepo = getAgentStateRepository();
    // Load lessons
    const allKeys = await _stateRepo.listKeys(params.agentId);
    const lessonKeys = allKeys.filter((k: string) => k.startsWith('lesson:')).sort().slice(-10);
    if (lessonKeys.length > 0) {
      const lessonEntries: string[] = [];
      for (const key of lessonKeys) {
        const raw = await _stateRepo.get(params.agentId, key).catch(() => null);
        if (raw?.value) {
          try {
            const l = JSON.parse(raw.value);
            const icon = l.category === 'error' ? '❌' : l.category === 'success' ? '✅' : '💡';
            lessonEntries.push(`${icon} ${l.text}`);
          } catch {}
        }
      }
      if (lessonEntries.length > 0) {
        lessonsBlock = `\n━━━ УРОКИ ИЗ ОПЫТА (${lessonEntries.length}) ━━━\n${lessonEntries.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }
    }

    // Load goals
    const goalsRaw = await _stateRepo.get(params.agentId, '_goals').catch(() => null);
    if (goalsRaw?.value) {
      try {
        const goals = JSON.parse(goalsRaw.value);
        const active = goals.filter((g: any) => g.status === 'active');
        const completed = goals.filter((g: any) => g.status === 'completed');
        if (active.length > 0 || completed.length > 0) {
          const lines: string[] = [];
          for (const g of active) {
            const p = g.priority === 'high' ? '🔴' : g.priority === 'low' ? '⚪' : '🟡';
            lines.push(`${p} [ACTIVE] ${g.goal}`);
          }
          for (const g of completed.slice(-3)) lines.push(`✅ [DONE] ${g.goal}`);
          goalsBlock = `\n━━━ ЦЕЛИ (${active.length} активных) ━━━\n${lines.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
      } catch {}
    }
  } catch {}

  // Execution stats
  try {
    const _pool = (await import('../db')).pool;
    const logRes = await _pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE level = 'error') as errors FROM builder_bot.agent_logs WHERE agent_id = $1`,
      [params.agentId]
    );
    const stats = logRes.rows[0] || {};
    const now = new Date();
    const dayName = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][now.getDay()];
    statsBlock = `\n📊 Статистика: ${stats.total || 0} записей в логе, ${stats.errors || 0} ошибок | ${dayName}, ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  } catch {}

  // ── Event Bus context ──
  let eventsBlock = '';
  try {
    const { getEventBus } = require('./event-bus');
    const bus = getEventBus();
    const subs = bus.getSubscriptions(params.agentId);
    const wake = bus.getWakeInfo(params.agentId);
    if (subs.length > 0 || wake) {
      const parts: string[] = [];
      if (wake) parts.push(`⏰ Следующее пробуждение: ${new Date(wake.wakeAt).toISOString()} (${wake.reason})`);
      if (subs.length > 0) parts.push(`📡 Подписки: ${subs.map((s: any) => s.eventType + (s.filter ? `(${JSON.stringify(s.filter)})` : '')).join(', ')}`);
      eventsBlock = `\n━━━ СОБЫТИЯ ━━━\n${parts.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
  } catch {}

  // ── Wallet info ──
  let walletBlock = '';
  try {
    const _sr2 = getAgentStateRepository();
    const wAddr = await _sr2.get(params.agentId, 'wallet_address').catch(() => null);
    if (wAddr?.value) {
      walletBlock = `\n💰 Твой TON-кошелёк: ${wAddr.value} (используй get_agent_wallet для деталей, get_ton_balance для баланса)`;
    }
  } catch {}

  const contextMsg = `[Контекст агента]
Время: ${new Date().toISOString()}${identityBlock}${walletBlock}${memoriesBlock}${lessonsBlock}${goalsBlock}${eventsBlock}${statsBlock}
Конфиг: ${configSummary || '(пусто)'}${pluginHint}${interAgentHint}${memoryDigest}
${GIFT_SYSTEM_KNOWLEDGE}${modeHint}
⚠️ HUMAN-IN-THE-LOOP: Опасные действия (send_ton, buy_*, list_gift_for_sale, ton_send_boc) требуют подтверждения пользователя. Если отклонено — НЕ ПОВТОРЯЙ.

🧠 САМООБУЧЕНИЕ: Когда получаешь фидбек (критику, исправления) от владельца:
1. save_lesson(text, 'feedback') — запомни что он хочет
2. update_self_prompt(addition) — добавь правило в свой промпт чтобы не повторять ошибку
3. Если фидбек критичный (стиль, формат, поведение) — update_my_prompt() с улучшенной версией

🔄 КОНТЕКСТ: Перед ответом/действием ВСЕГДА проверяй:
- get_state() для ранее сохранённых данных (каналы, настройки, предпочтения)
- knowledge_search() для долгосрочной памяти
- tg_get_messages() для контекста текущего чата/канала
НЕ ПЕРЕСПРАШИВАЙ то что уже знаешь! Если не уверен — проверь state/memory СНАЧАЛА.

Используй save_lesson для важных выводов. manage_goals для целей. set_next_wake для расписания.
${msgs.length > 0 ? `\nСообщения от пользователя:\n${msgs.map(m => `- ${m}`).join('\n')}` : ''}`;

  // Inject safety rules + plugin skillDocs
  const SAFETY_RULES = `
━━━ SAFETY & ETHICS RULES ━━━
You MUST follow these rules AT ALL TIMES:
1. NEVER help with scams, fraud, phishing, social engineering, or theft
2. NEVER scrape personal data, email lists, phone numbers, or private information in bulk
3. NEVER send spam, unsolicited messages, or mass notifications to users who didn't opt in
4. NEVER attempt to drain wallets, steal tokens, or exploit smart contract vulnerabilities maliciously
5. NEVER generate or distribute malware, ransomware, or harmful code
6. NEVER impersonate other people, services, or organizations
7. NEVER bypass security measures, rate limits, or access controls
8. NEVER store or transmit passwords, private keys, or seed phrases in plain text to external services
9. Limit web scraping to max 10 pages per task. Do NOT crawl entire websites.
10. If a user asks you to do something harmful or unethical, REFUSE and explain why.
11. Report suspicious activity patterns (many failed transactions, rapid API calls) in your logs.
12. When handling financial operations (send_ton, buy/sell gifts), ALWAYS double-check amounts and addresses.
13. NEVER execute transactions above 100 TON without explicit user confirmation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  let systemPromptFull = params.systemPrompt + '\n' + SAFETY_RULES;
  const enabledPlugins = (params.config.enabledPlugins as string[]) || [];
  if (enabledPlugins.length > 0) {
    try {
      const { getSkillDocsForCodeGeneration } = await import('../plugins-system');
      const pluginDocs = getSkillDocsForCodeGeneration(enabledPlugins);
      if (pluginDocs) systemPromptFull += '\n\n' + pluginDocs;
    } catch {}
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system',    content: systemPromptFull },
  ];

  // ── Load conversation history from previous runs ──
  try {
    const histRaw = await getAgentStateRepository().get(params.agentId, '_conversation_history').catch(() => null);
    const histStr = typeof histRaw === 'object' && histRaw?.value !== undefined ? histRaw.value : histRaw;
    if (histStr) {
      const history: Array<{ role: string; content: string }> = typeof histStr === 'string' ? JSON.parse(histStr) : histStr;
      // Inject up to last 40 messages as context (more = better memory)
      for (const msg of history.slice(-40)) {
        messages.push({ role: msg.role as any, content: msg.content });
      }
    }
  } catch {}

  // Current run context goes after history
  messages.push({ role: 'user', content: contextMsg });

  // ── Token overflow protection: trim messages if total chars > limit ──
  const MAX_CONTEXT_CHARS = 60_000; // ~15K tokens rough estimate
  let totalChars = messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
  while (totalChars > MAX_CONTEXT_CHARS && messages.length > 2) {
    // Remove oldest non-system message (keep system prompt + latest context)
    const removed = messages.splice(1, 1)[0];
    totalChars -= typeof removed.content === 'string' ? removed.content.length : 0;
  }

  // ── Agentic loop (up to 5 iterations) ──────────
  // Get agent role for conditional director tools
  let agentRole = 'worker';
  try {
    const meta = await getAgentMeta(params.agentId);
    if (meta?.role) agentRole = meta.role;
  } catch {}
  const enabledCaps = (params.config.enabledCapabilities as string[]) || null;

  // ── Connect TON MCP if ton_mcp capability enabled ──
  let mcpToolDefs: OpenAI.ChatCompletionTool[] = [];
  if (!enabledCaps || enabledCaps.includes('ton_mcp')) {
    try {
      const { getTonMcpManager } = await import('../services/ton-mcp-client');
      const manager = getTonMcpManager();
      const mnemonic = (await getAgentStateRepository().get(params.agentId, 'wallet_mnemonic'))?.value;
      if (mnemonic) {
        await manager.getOrCreate(params.agentId, {
          mnemonic,
          network: (params.config.TON_NETWORK as string) || 'mainnet',
          toncenterApiKey: (params.config.TONCENTER_API_KEY as string) || process.env.TONCENTER_API_KEY || '',
        });
        mcpToolDefs = manager.getOpenAITools(params.agentId) as any;
      }
    } catch (e: any) {
      console.error(`[MCP] Agent #${params.agentId} init failed: ${e.message}`);
    }
  }

  let allToolDefs = buildToolDefinitions(agentRole, enabledCaps, mcpToolDefs);
  // Tool RAG: select only relevant tools based on user message + system prompt
  const userMsgText = msgs.join(' ');
  let tools = selectRelevantTools(allToolDefs, userMsgText, params.systemPrompt, 40);
  let totalToolCalls = 0;
  let finalContent: string | undefined;
  _tickNotifyFlag.set(params.agentId, false); // reset flag for this tick

  // ── Loop detection: track tool call signatures per iteration ──
  let prevIterSignature = '';
  let sameSignatureCount = 0;
  const usedModel = (params.config.AI_MODEL as string) || process.env.AI_MODEL || defaultModel;
  console.log(`[AI runtime] Agent #${params.agentId} AI call: model=${usedModel} baseURL=${(ai as any).baseURL} tools=${tools.length}(of ${allToolDefs.length}) msgs=${messages.length}`);

  for (let iter = 0; iter < 5; iter++) {
    // Observation Masking: compress old tool results before each AI call
    if (iter > 0) compressOldToolResults(messages, 2);

    let response: OpenAI.ChatCompletion = undefined as any;
    // Retry loop for rate-limit (429) errors
    let lastErr: any = null;
    for (let retry = 0; retry < 3; retry++) {
      try {
        response = await ai.chat.completions.create({
          model:    (params.config.AI_MODEL as string) || process.env.AI_MODEL || defaultModel,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens:  2048,
        });
        lastErr = null;
        break; // success
      } catch (e: any) {
        lastErr = e;
        // Full error dump for debugging (sanitize API keys/tokens)
        const sanitize = (s: string) => s.replace(/(?:Bearer |sk-|AIzaSy|gsk_|sk-ant-|sk-or-|sk-proj-)[A-Za-z0-9_-]{4,}/g, '[REDACTED]');
        const safeHeaders = sanitize(JSON.stringify(e.headers || {}).slice(0, 200));
        const safeBody = sanitize(JSON.stringify(e.error || e.body || {}).slice(0, 300));
        console.error(`[AI runtime] Agent #${params.agentId} AI error dump: status=${e.status} code=${e.code} type=${e.type} msg=${e.message?.slice(0, 200)} headers=${safeHeaders} body=${safeBody}`);
        const is429 = e.message?.includes('429') || e.status === 429 || e.statusCode === 429;
        if (is429 && retry < 2) {
          const delay = (retry + 1) * 5000; // 5s, 10s
          console.log(`[AI runtime] Agent #${params.agentId} 429 rate limit, retry ${retry + 1}/3 in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        const errMsg = `AI call failed: ${e.message}`;
        await logToDb(params.agentId, 'error', errMsg);
        if (execId) try { await getExecutionHistoryRepository().finishExecution(execId, 'error', errMsg); } catch (e2: any) { console.warn('[ExecTracker] finishExecution:', e2.message); }
        return { toolCallCount: totalToolCalls, error: errMsg };
      }
    }
    if (lastErr) {
      const errMsg = `AI call failed after retries: ${lastErr.message}`;
      await logToDb(params.agentId, 'error', errMsg);
      if (execId) try { await getExecutionHistoryRepository().finishExecution(execId, 'error', errMsg); } catch (e2: any) { console.warn('[ExecTracker] finishExecution:', e2.message); }
      return { toolCallCount: totalToolCalls, error: errMsg };
    }

    const choice    = response.choices[0];
    const assistant = choice.message;

    // Track tokens
    if (response.usage) {
      totalTokensUsed += (response.usage.total_tokens || 0);
    }

    // ── Handle MALFORMED_FUNCTION_CALL from Gemini / broken tool_calls ──
    // Gemini sometimes returns tool_calls with invalid JSON or unknown function names
    if (assistant.tool_calls && assistant.tool_calls.length > 0) {
      const validToolNames = new Set(tools.map((t: any) => t.function?.name));
      const hasMalformed = assistant.tool_calls.some((tc: any) => {
        const fn = tc?.function;
        if (!fn?.name) return true;
        if (!validToolNames.has(fn.name)) return true;
        try { JSON.parse(fn.arguments || '{}'); return false; }
        catch { return true; }
      });
      if (hasMalformed) {
        console.warn(`[AI runtime] Agent #${params.agentId} MALFORMED tool_calls detected, retrying without tools`);
        await logToDb(params.agentId, 'warn', `[AI run] MALFORMED_FUNCTION_CALL — retrying as plain text`, params.userId);
        // Retry same iteration without tools
        try {
          const fallback = await ai.chat.completions.create({
            model: (params.config.AI_MODEL as string) || process.env.AI_MODEL || defaultModel,
            messages,
            max_tokens: 2048,
          });
          const fbMsg = fallback.choices[0]?.message;
          if (fbMsg) {
            messages.push(fbMsg);
            finalContent = fbMsg.content || undefined;
          }
        } catch (fbErr: any) {
          console.error(`[AI runtime] Agent #${params.agentId} fallback also failed: ${fbErr.message}`);
        }
        break;
      }
    }

    messages.push(assistant);

    // No tool calls → agent is done
    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      finalContent = assistant.content || undefined;
      console.log(`[AI runtime] Agent #${params.agentId} iter=${iter} content="${(assistant.content || '').slice(0, 100)}" finish=${choice.finish_reason}`);
      // Resolve studio chat callback if waiting
      if (finalContent) _resolveChatCallback(params.agentId, finalContent);
      break;
    }

    // ── Execute all tool calls in parallel ──────────────────────
    totalToolCalls += assistant.tool_calls.length;
    const toolResults = await Promise.all(
      assistant.tool_calls.map(async (tc) => {
        const f = (tc as any).function as { name: string; arguments: string };
        let toolArgs: Record<string, any>;
        try { toolArgs = JSON.parse(f.arguments || '{}'); }
        catch { toolArgs = {}; }
        await logToDb(params.agentId, 'info', `[tool] ${f.name}(${JSON.stringify(toolArgs).slice(0, 200)})`, params.userId);

        let result: any;
        const toolStart = Date.now();
        // Auto-retry on transient errors (network, timeout)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            result = await executeTool(f.name, toolArgs, params);
            break;
          } catch (toolErr: any) {
            const msg = toolErr.message || '';
            const isRetryable = /timeout|ECONNRESET|ENOTFOUND|fetch failed|503|429/i.test(msg);
            if (isRetryable && attempt === 0) {
              console.log(`[AI runtime] Agent #${params.agentId} tool ${f.name} retrying after: ${msg.slice(0, 80)}`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            result = { error: toolErr.message || 'Tool execution failed' };
            // Track bug in platform_bugs table
            try { getBugTracker().recordBug(`tool:${f.name}`, toolErr.message || 'unknown', toolErr.stack?.slice(0, 500)).catch(() => {}); } catch {}
          }
        }
        // Smart log: summarize tool results instead of raw JSON dump
        const resultStr = JSON.stringify(result);
        let logSummary: string;
        if (resultStr.length < 200) {
          logSummary = resultStr;
        } else {
          // Summarize: count items, show key fields
          const itemCount = (result?.deals ? Object.values(result.deals).flat().length : null)
            ?? result?.items?.length ?? result?.results?.length ?? null;
          if (itemCount !== null) {
            logSummary = `{${itemCount} items, ${(resultStr.length / 1024).toFixed(1)}KB}`;
          } else if (result?.error) {
            logSummary = `{error: "${result.error}"}`;
          } else {
            logSummary = `{${Object.keys(result || {}).join(', ')} | ${(resultStr.length / 1024).toFixed(1)}KB}`;
          }
        }
        await logToDb(params.agentId, 'info', `[tool_result] ${f.name} → ${logSummary}`, params.userId);

        return {
          role:         'tool' as const,
          tool_call_id: tc.id,
          content:      JSON.stringify(result),
        };
      })
    );

    messages.push(...toolResults);

    // ── Loop detection: break if agent repeats same tool calls 3 times ──
    const iterSignature = assistant.tool_calls
      .map((tc: any) => `${tc.function.name}:${tc.function.arguments}`)
      .sort()
      .join('|');
    if (iterSignature === prevIterSignature) {
      sameSignatureCount++;
      if (sameSignatureCount >= 2) {
        await logToDb(params.agentId, 'warn', `[AI run] Loop detected: same tools called ${sameSignatureCount + 1}x in a row (${assistant.tool_calls.map((tc: any) => tc.function.name).join(', ')}). Breaking.`, params.userId);
        // Inject a system message to redirect the AI
        messages.push({
          role: 'system' as any,
          content: 'LOOP DETECTED: You are repeating the same tool calls. Stop calling these tools and provide a final response to the user. If you are stuck, use notify() to ask the user for help.',
        });
        break;
      }
    } else {
      sameSignatureCount = 0;
    }
    prevIterSignature = iterSignature;

    // ── Rebuild tools if manage_capabilities was called this iteration ──
    const hadCapChange = assistant.tool_calls.some((tc: any) => tc.function.name === 'manage_capabilities');
    if (hadCapChange) {
      const updatedCaps = (params.config.enabledCapabilities as string[]) || null;
      allToolDefs = buildToolDefinitions(agentRole, updatedCaps, mcpToolDefs);
      tools = selectRelevantTools(allToolDefs, userMsgText, params.systemPrompt, 40);
      console.log(`[AI runtime] Agent #${params.agentId} tools rebuilt after manage_capabilities: ${tools.length}(of ${allToolDefs.length}) tools`);
    }
  }

  // ── Notify if there were user messages and AI replied ────────────
  // Only send finalContent if:
  // 1. There IS a text response (finalContent)
  // 2. User sent a message (msgs.length > 0) → this is a chat reply
  // 3. notify() was NOT already called during the tick (prevents duplicates)
  const notifyWasCalled = _tickNotifyFlag.get(params.agentId) === true;
  _tickNotifyFlag.delete(params.agentId); // cleanup

  // ── Prompt leak filter: strip system instructions from AI response ──
  if (finalContent) {
    const lines = finalContent.split('\n');
    const LEAK_PATTERNS = /^(You are|System:|Instructions:|Ты —|Системный промпт|<system>|As an AI|I am an AI|My instructions)/i;
    while (lines.length > 0 && LEAK_PATTERNS.test(lines[0].trim())) {
      lines.shift();
    }
    finalContent = lines.join('\n').trim() || undefined;
  }

  if (finalContent && !notifyWasCalled) {
    // Send AI's text response to the user (both chat and monitoring modes)
    await notifyRich(params.userId, {
      text: mdToHtml(finalContent),
      agentId: params.agentId,
      agentName: (params.config?.AGENT_NAME as string) || undefined,
    }).catch(async () => {
      // Fallback to plain notify if rich fails
      if (params.onNotify) await params.onNotify(finalContent!).catch(e => console.error('[Runtime]', e?.message || e));
      else await notifyUser(params.userId, finalContent!).catch(e => console.error('[Runtime]', e?.message || e));
    });
  }

  await logToDb(params.agentId, 'info', `[AI run] done, tools=${totalToolCalls}, tokens=${totalTokensUsed}, notified=${notifyWasCalled}`, params.userId);

  // ── Save conversation history for next run ──
  try {
    // Extract key messages: user inputs + assistant responses (skip tool calls/results for brevity)
    const historyToSave: Array<{ role: string; content: string }> = [];
    // Load existing history
    const existingRaw = await getAgentStateRepository().get(params.agentId, '_conversation_history').catch(() => null);
    const existingStr = typeof existingRaw === 'object' && existingRaw?.value !== undefined ? existingRaw.value : existingRaw;
    if (existingStr) {
      try {
        const existing = typeof existingStr === 'string' ? JSON.parse(existingStr) : existingStr;
        historyToSave.push(...existing);
      } catch {}
    }
    // Add messages from this run (user messages + assistant final response)
    if (msgs.length > 0) {
      for (const m of msgs) historyToSave.push({ role: 'user', content: m });
    }
    if (finalContent) {
      historyToSave.push({ role: 'assistant', content: finalContent });
    }
    // Also add summary of tool calls made
    if (totalToolCalls > 0) {
      const toolSummary = messages.filter((m: any) => m.role === 'assistant' && m.tool_calls)
        .flatMap((m: any) => (m.tool_calls || []).map((tc: any) => tc.function?.name))
        .filter(Boolean).join(', ');
      if (toolSummary) {
        historyToSave.push({ role: 'assistant', content: `[Выполнил: ${toolSummary}]` });
      }
    }
    // Keep only last 40 messages, trim long ones
    const trimmed = historyToSave.slice(-40).map(m => ({
      role: m.role,
      content: (m.content || '').slice(0, 800),
    }));
    await getAgentStateRepository().set(params.agentId, params.userId, '_conversation_history', JSON.stringify(trimmed));
  } catch {}

  // ── Memory consolidation (periodic) ──
  try { await maybeConsolidateMemory(params, ai, defaultModel); } catch (e: any) { console.warn('[Memory] consolidation:', e.message); }

  // ── Finish execution tracking ──
  if (execId) {
    try {
      await getExecutionHistoryRepository().finishExecution(
        execId, 'success', undefined,
        { toolCalls: totalToolCalls, tokensUsed: totalTokensUsed, durationMs: Date.now() - tickStart, hadResponse: !!finalContent },
      );
    } catch (e: any) { console.warn('[ExecTracker] finishExecution:', e.message); }
  }

  // ── XP / Level gamification ──────────────────────────────────
  try {
    const xpGain = 10 + totalToolCalls * 5; // base 10 XP + 5 per tool call
    await (await import('../db')).pool.query(
      `UPDATE builder_bot.agents SET xp = COALESCE(xp, 0) + $1,
       level = GREATEST(1, FLOOR(LOG(2, GREATEST(COALESCE(xp, 0) + $1, 1)) / 2) + 1)
       WHERE id = $2`,
      [xpGain, params.agentId]
    );
  } catch (e: any) { console.warn('[XP]', e.message); }

  return { finalResponse: finalContent, toolCallCount: totalToolCalls };
}

// ── AI Agent Runtime: activate / deactivate ────────────────────────────────

export class AIAgentRuntime {

  // Активировать AI-агента (первый тик сразу + setInterval + immediate on message)
  async activate(opts: {
    agentId:      number;
    userId:       number;
    systemPrompt: string;
    config:       Record<string, any>;
    intervalMs:   number;
    onNotify:     (msg: string) => Promise<void>;
  }): Promise<void> {
    // Stop existing handle if any
    this.deactivate(opts.agentId);

    // Create the handle entry first so the tick closure can reference tickRunning via it
    const entry: ActiveHandle = {
      interval: null as any, // will be set below after setInterval
      tickRunning: false,
      consecutiveErrors: 0,
      tick: async () => {
        if (entry.tickRunning) { return; } // skip overlapping tick
        entry.tickRunning = true;
        try {
          const pending = popMessages(opts.agentId);
          await runAIAgentTick({
            agentId:        opts.agentId,
            userId:         opts.userId,
            systemPrompt:   opts.systemPrompt,
            config:         opts.config,
            pendingMessages: pending,
            onNotify:       opts.onNotify,
          });
          entry.consecutiveErrors = 0; // Reset on success
        } catch (e: any) {
          entry.consecutiveErrors++;
          console.error(`[AI runtime] tick error agent #${opts.agentId} (${entry.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, e?.message || e);
          // Circuit breaker: deactivate after too many consecutive failures
          if (entry.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`[AI runtime] ⛔ Circuit breaker: deactivating agent #${opts.agentId} after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
            logToDb(opts.agentId, 'error', `⛔ Агент деактивирован: ${MAX_CONSECUTIVE_ERRORS} ошибок подряд. Последняя: ${(e?.message || '').slice(0, 200)}`, opts.userId);
            notifyUser(opts.userId, `⛔ Агент #${opts.agentId} остановлен — ${MAX_CONSECUTIVE_ERRORS} ошибок подряд.\nПоследняя ошибка: ${(e?.message || '').slice(0, 150)}\n\nПерезапустите агента после исправления проблемы.`).catch(() => {});
            // Deactivate async to avoid deadlock
            setTimeout(() => {
              try { getAIAgentRuntime().deactivate(opts.agentId); } catch {}
              // Mark inactive in DB
              _getSharedStatePool().query('UPDATE builder_bot.agents SET is_active = false WHERE id = $1', [opts.agentId]).catch(() => {});
            }, 100);
          }
        } finally {
          entry.tickRunning = false;
          // Guarantee _tickNotifyFlag cleanup (prevents stale flag from crashed tick)
          _tickNotifyFlag.delete(opts.agentId);
        }
      },
    };

    // Register handle (needed for addMessageToAIAgent even without ticks)
    _activeHandles.set(opts.agentId, entry);

    // ── Register Event Bus tick trigger ──
    const { getEventBus } = require('./event-bus');
    const bus = getEventBus();
    bus.setTickTrigger((eventAgentId: number, event: any) => {
      const handle = _activeHandles.get(eventAgentId);
      if (!handle) return;
      // Inject event context as a pending message so the agent sees it
      const eventMsg = `[SYSTEM EVENT] type=${event.type}, source=${event.source}, data=${JSON.stringify(event.data)}`;
      addMessageToAIAgent(eventAgentId, eventMsg);
    });

    // If agent has a Telegram session AND no explicit interval → message-driven only
    // But if intervalMs > 0, agent wants proactive ticks (posting, checking unread, etc.)
    const hasTgSession = !!(opts.config as any)?._hasTgSession;
    if (hasTgSession && (!opts.intervalMs || opts.intervalMs <= 0)) {
      console.log(`[AI runtime] Agent #${opts.agentId} has TG session, no interval — message-driven only`);
      entry.interval = null as any;
    } else {
      entry.interval = setInterval(entry.tick, opts.intervalMs);
      // Delay first tick by 30s (save handle for cleanup in deactivate)
      entry.firstTickTimer = setTimeout(() => {
        entry.firstTickTimer = undefined;
        entry.tick().catch((e) => {
          console.error(`[AI runtime] first tick failed for agent #${opts.agentId}:`, e);
          logToDb(opts.agentId, 'error', `First tick failed: ${(e as any)?.message || String(e)}`, opts.userId);
        });
      }, 30000);
    }

    // ── Enable incoming message listener (agent acts as real TG user) ──
    // Retry with delay since TG sessions may not be restored yet at startup
    const setupListener = async (attempt: number) => {
      // Guard: prevent re-entry / exponential callbacks
      if (entry.setupListenerActive) return;
      entry.setupListenerActive = true;
      try {
        // Check if agent was deactivated while waiting
        if (!_activeHandles.has(opts.agentId)) return;
        const { userbotManager, registerAgentMessageConfig } = await import('../services/userbot-manager');
        const tgInfo = await userbotManager.getAgentTelegramInfo(opts.agentId);
        console.log(`[AI runtime] setupListener #${opts.agentId} attempt=${attempt} authorized=${tgInfo.authorized} username=${tgInfo.username || 'none'}`);
        if (tgInfo.authorized) {
          try {
            // Inject tgUserId for shared state tools
            opts.config._tgUserId = tgInfo.telegramUserId || 0;
            opts.config.telegramUserId = tgInfo.telegramUserId || 0;
            registerAgentMessageConfig({
              agentId: opts.agentId,
              userId: opts.userId,
              selfTgId: tgInfo.telegramUserId || 0,
              selfUsername: tgInfo.username || '',
              systemPrompt: opts.systemPrompt,
              dmPolicy: (opts.config.dmPolicy as any) || 'open',
              groupPolicy: (opts.config.groupPolicy as any) || 'mention-only',
              config: opts.config,
              routingRules: opts.config.routingRules,
            });
            const ok = await userbotManager.enableMessageListener(opts.agentId);
            console.log(`[AI runtime] enableMessageListener #${opts.agentId} result=${ok}`);
            if (ok) {
              logToDb(opts.agentId, 'info', `[Runtime] ✅ Message listener ON — responds to DMs and @mentions`, opts.userId);
            }
          } catch (innerErr: any) {
            console.error(`[AI runtime] enableMessageListener CRASH #${opts.agentId}: ${innerErr.message}`);
            console.error(innerErr.stack);
          }
        } else if (attempt < 3 && _activeHandles.has(opts.agentId)) {
          // TG session not restored yet, retry after delay
          entry.setupListenerActive = false; // allow next attempt
          setTimeout(() => setupListener(attempt + 1), 8000);
          return; // don't reset flag yet
        }
      } catch (e: any) {
        if (attempt < 3 && _activeHandles.has(opts.agentId)) {
          entry.setupListenerActive = false;
          setTimeout(() => setupListener(attempt + 1), 8000);
          return;
        }
        console.error(`[AI runtime] Message listener setup failed for #${opts.agentId}:`, e.message);
      }
      entry.setupListenerActive = false;
    };
    setupListener(0);

    console.log(`[AI runtime] Agent #${opts.agentId} activated, interval=${opts.intervalMs}ms`);
  }

  // Деактивировать AI-агента
  deactivate(agentId: number): void {
    const h = _activeHandles.get(agentId);
    if (h) {
      clearInterval(h.interval);
      if (h.firstTickTimer) clearTimeout(h.firstTickTimer);
      _activeHandles.delete(agentId);
      // Clean up Event Bus (subscriptions + wake timers)
      try { require('./event-bus').getEventBus().cleanupAgent(agentId); } catch {}
      // Kill MCP subprocess if any
      import('../services/ton-mcp-client').then(m => m.getTonMcpManager().destroy(agentId)).catch(e => console.error('[Runtime]', e?.message || e));
      // Disable message listener
      import('../services/userbot-manager').then(m => m.userbotManager.disableMessageListener(agentId)).catch(() => {});
      console.log(`[AI runtime] Agent #${agentId} deactivated`);
    }
  }

  /** Deactivate all running agents (for graceful shutdown) */
  deactivateAll(): void {
    for (const agentId of [..._activeHandles.keys()]) {
      this.deactivate(agentId);
    }
  }

  // Проверить активен ли агент
  isActive(agentId: number): boolean {
    return _activeHandles.has(agentId);
  }

  // Список активных агентов
  getActiveIds(): number[] {
    return [..._activeHandles.keys()];
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _runtime: AIAgentRuntime | null = null;
export function getAIAgentRuntime(): AIAgentRuntime {
  if (!_runtime) {
    _runtime = new AIAgentRuntime();
    // ── Periodic cleanup of stale global maps (every 10 minutes) ──
    setInterval(() => {
      const activeIds: number[] = [];
      _activeHandles.forEach((_, id) => activeIds.push(id));
      const activeSet = new Set(activeIds);
      // Clean pendingMessages for deactivated agents
      _pendingMessages.forEach((_, id) => { if (!activeSet.has(id)) _pendingMessages.delete(id); });
      // Clean tickNotifyFlag for deactivated agents
      _tickNotifyFlag.forEach((_, id) => { if (!activeSet.has(id)) _tickNotifyFlag.delete(id); });
      // Clean webRequestCounts for deactivated agents
      _webRequestCounts.forEach((_, id) => { if (!activeSet.has(id)) _webRequestCounts.delete(id); });
      // Clean tool rate limit timestamps older than 2 minutes
      _toolRateLimits.forEach((timestamps, key) => {
        const fresh = timestamps.filter(t => Date.now() - t < 120_000);
        if (fresh.length === 0) _toolRateLimits.delete(key);
        else _toolRateLimits.set(key, fresh);
      });
      // Clean approval waiters older than 10 minutes
      _approvalWaiters.forEach((waiter, key) => {
        if (Date.now() - (waiter as any)._createdAt > 10 * 60 * 1000) _approvalWaiters.delete(key);
      });
    }, 10 * 60 * 1000);
  }
  return _runtime;
}
