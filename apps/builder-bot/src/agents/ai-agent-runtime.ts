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
import { notifyUser, notifyRich } from '../notifier';
import { getTelegramGiftsService } from '../services/telegram-gifts';
import {
  getAgentStateRepository,
  getAgentLogsRepository,
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
    return { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.5-pro' };
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
    return { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.5-pro' };
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
const WEB_REQUESTS_PER_TICK = 10; // max web_search + fetch_url per tick
function checkWebRateLimit(agentId: number): boolean {
  const now = Date.now();
  const entry = _webRequestCounts.get(agentId);
  if (!entry || now > entry.resetAt) {
    _webRequestCounts.set(agentId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= WEB_REQUESTS_PER_TICK) return false;
  entry.count++;
  return true;
}

// ── Security: Aegis402 Shield Protocol patterns ─────────────────────────────
// Per-agent address blacklists
const _addressBlacklists = new Map<number, Set<string>>(); // agentId → Set<address>
// Per-agent known addresses (sent to before)
const _knownAddresses = new Map<number, Set<string>>(); // agentId → Set<address>
// Per-agent financial tx rate tracking
const _txRateCounts = new Map<number, { count: number; resetAt: number }>();
const TX_RATE_LIMIT_PER_HOUR = 10;
const HIGH_AMOUNT_THRESHOLD_TON = 100;

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface SecurityScanResult {
  riskLevel: RiskLevel;
  warnings: string[];
  isBlacklisted: boolean;
  isNewAddress: boolean;
  isHighAmount: boolean;
  isHighFrequency: boolean;
  txCountLastHour: number;
}

function getAgentBlacklist(agentId: number): Set<string> {
  if (!_addressBlacklists.has(agentId)) _addressBlacklists.set(agentId, new Set());
  return _addressBlacklists.get(agentId)!;
}

function getKnownAddresses(agentId: number): Set<string> {
  if (!_knownAddresses.has(agentId)) _knownAddresses.set(agentId, new Set());
  return _knownAddresses.get(agentId)!;
}

function trackTxRate(agentId: number): number {
  const now = Date.now();
  const entry = _txRateCounts.get(agentId);
  if (!entry || now > entry.resetAt) {
    _txRateCounts.set(agentId, { count: 1, resetAt: now + 3600_000 });
    return 1;
  }
  entry.count++;
  return entry.count;
}

function getTxCountLastHour(agentId: number): number {
  const now = Date.now();
  const entry = _txRateCounts.get(agentId);
  if (!entry || now > entry.resetAt) return 0;
  return entry.count;
}

// Financial tools that involve sending funds or buying/selling
const FINANCIAL_TOOLS = new Set([
  'send_ton', 'send_jetton', 'dex_swap_execute',
  'buy_catalog_gift', 'buy_resale_gift', 'buy_market_gift', 'list_gift_for_sale',
]);

// Tools that send to an address (for address checks)
const ADDRESS_SEND_TOOLS = new Set(['send_ton', 'send_jetton']);

function preTransactionScan(agentId: number, toolName: string, args: any): SecurityScanResult {
  const warnings: string[] = [];
  let isBlacklisted = false;
  let isNewAddress = false;
  let isHighAmount = false;
  let isHighFrequency = false;

  // Address checks for send tools
  if (ADDRESS_SEND_TOOLS.has(toolName) && args.to) {
    const addr = String(args.to);
    const blacklist = getAgentBlacklist(agentId);
    if (blacklist.has(addr)) {
      isBlacklisted = true;
      warnings.push('\u26d4 Адрес в черном списке агента');
    }
    const known = getKnownAddresses(agentId);
    if (!known.has(addr)) {
      isNewAddress = true;
      warnings.push('\u26a0\ufe0f Новый адрес — ранее не использовался');
    }
  }

  // Amount check for TON sends
  if (toolName === 'send_ton' && args.amount) {
    const amount = Number(args.amount);
    if (amount > HIGH_AMOUNT_THRESHOLD_TON) {
      isHighAmount = true;
      warnings.push(`\ud83d\udea8 Крупная сумма: ${amount} TON`);
    }
  }

  // Rate limit check
  const txCount = getTxCountLastHour(agentId);
  if (txCount > TX_RATE_LIMIT_PER_HOUR) {
    isHighFrequency = true;
    warnings.push(`\u26a0\ufe0f Высокая активность: ${txCount} транзакций за час`);
  }

  // Calculate risk level
  let riskLevel: RiskLevel = 'LOW';
  if (isBlacklisted) {
    riskLevel = 'CRITICAL';
  } else if ((isNewAddress && isHighAmount) || isHighFrequency) {
    riskLevel = 'HIGH';
  } else if (isNewAddress || isHighAmount) {
    riskLevel = 'MEDIUM';
  }

  return { riskLevel, warnings, isBlacklisted, isNewAddress, isHighAmount, isHighFrequency, txCountLastHour: txCount };
}

function riskEmoji(level: RiskLevel): string {
  switch (level) {
    case 'LOW': return '\ud83d\udfe2';
    case 'MEDIUM': return '\ud83d\udfe1';
    case 'HIGH': return '\ud83d\udfe0';
    case 'CRITICAL': return '\ud83d\udd34';
  }
}

// ── Prompt Library Cache ──────────────────────────────────────────────────
interface PromptEntry { act: string; prompt: string; }
let _promptCache: PromptEntry[] | null = null;
let _promptCacheTime = 0;
const PROMPT_CACHE_TTL = 3600_000; // 1 hour

async function getPromptLibrary(): Promise<PromptEntry[]> {
  const now = Date.now();
  if (_promptCache && now - _promptCacheTime < PROMPT_CACHE_TTL) return _promptCache;
  const resp = await fetch('https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv', {
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error('Failed to fetch prompt library: ' + resp.status);
  const text = await resp.text();
  const lines = text.split('\n');
  const entries: PromptEntry[] = [];
  // CSV format: "act","prompt" — first line is header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Parse CSV with quoted fields
    const match = line.match(/^"([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)"$/);
    if (match) {
      entries.push({ act: match[1].replace(/""/g, '"'), prompt: match[2].replace(/""/g, '"') });
    }
  }
  _promptCache = entries;
  _promptCacheTime = now;
  return entries;
}


// ── Per-agent transaction safety (large amount confirmation) ────────────────
const HIGH_VALUE_TX_LIMIT_TON = 100; // TON threshold requiring confirmation

// ── Notify-called flag per active tick (agentId → bool) ────────────────────
// Used to suppress duplicate sends when AI calls notify() AND produces finalContent
const _tickNotifyFlag = new Map<number, boolean>();

export function addMessageToAIAgent(agentId: number, text: string): void {
  if (!_pendingMessages.has(agentId)) _pendingMessages.set(agentId, []);
  _pendingMessages.get(agentId)!.push(text);
  // Trigger an immediate tick so the user gets a fast response
  runImmediateTick(agentId);
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
}

const _activeHandles = new Map<number, ActiveHandle>();

/** Run an immediate tick for the given agent (e.g. when a chat message arrives). */
function runImmediateTick(agentId: number): void {
  const handle = _activeHandles.get(agentId);
  if (!handle) return; // agent not active — nothing to trigger
  if (handle.tickRunning) return; // tick already in progress, message will be picked up
  handle.tick().catch(e => console.error('[Runtime]', e?.message || e));
}

// ── Capability → Tool mapping ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
// AUDIT TRAIL — logs every tool call to DB
// ═══════════════════════════════════════════════════════════
const DANGEROUS_TOOLS = new Set([
  'send_ton', 'send_jetton', 'buy_catalog_gift', 'buy_resale_gift',
  'buy_market_gift', 'list_gift_for_sale', 'dex_swap_execute',
  'tg_leave_channel', 'tg_delete_message',
  'x_post_tweet', 'x_reply_tweet', 'x_retweet', 'x_like_tweet',
]);

async function auditLog(agentId: number, userId: number, toolName: string, args: any, result: any, success: boolean, errorMsg: string | null, durationMs: number): Promise<void> {
  try {
    const { pool } = await import('../db');
    const safeResult = JSON.stringify(result || {}).slice(0, 2000);
    const safeArgs = JSON.stringify(args || {}).slice(0, 2000);
    await pool.query(
      `INSERT INTO builder_bot.agent_audit_log (agent_id, user_id, tool_name, args, result, success, error_message, duration_ms)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
      [agentId, userId, toolName, safeArgs, safeResult, success, errorMsg, durationMs]
    );
  } catch (e: any) {
    console.warn('[Audit] Failed to log:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// APPROVAL WORKFLOWS — confirm dangerous actions
// ═══════════════════════════════════════════════════════════
interface PendingApproval {
  id: number;
  agentId: number;
  userId: number;
  toolName: string;
  args: any;
  resolve: (approved: boolean) => void;
}

const _pendingApprovals = new Map<number, PendingApproval>();

export function resolvePendingApproval(approvalId: number, approved: boolean): boolean {
  const pending = _pendingApprovals.get(approvalId);
  if (!pending) return false;
  pending.resolve(approved);
  _pendingApprovals.delete(approvalId);
  return true;
}

async function requestApproval(agentId: number, userId: number, toolName: string, args: any): Promise<boolean> {
  try {
    const { pool } = await import('../db');
    const res = await pool.query(
      `INSERT INTO builder_bot.agent_approvals (agent_id, user_id, tool_name, args, status)
       VALUES ($1, $2, $3, $4::jsonb, 'pending') RETURNING id`,
      [agentId, userId, toolName, JSON.stringify(args || {})]
    );
    const approvalId = res.rows[0].id;

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        _pendingApprovals.delete(approvalId);
        pool.query(`UPDATE builder_bot.agent_approvals SET status='expired', resolved_at=NOW() WHERE id=$1`, [approvalId]).catch(() => {});
        resolve(false);
      }, 120_000);

      _pendingApprovals.set(approvalId, {
        id: approvalId, agentId, userId, toolName, args,
        resolve: (approved: boolean) => {
          clearTimeout(timeout);
          pool.query(`UPDATE builder_bot.agent_approvals SET status=$1, resolved_at=NOW() WHERE id=$2`, [approved ? 'approved' : 'rejected', approvalId]).catch(() => {});
          resolve(approved);
        },
      });

      // Notify user via bot
      try {
        const { notifyApprovalRequest } = require('../notifier');
        notifyApprovalRequest(userId, agentId, approvalId, toolName, args);
      } catch (e: any) {
        console.warn('[Approval] notify failed:', e.message);
        clearTimeout(timeout);
        _pendingApprovals.delete(approvalId);
        resolve(true); // auto-approve on notification failure
      }
    });
  } catch (e: any) {
    console.warn('[Approval] DB error:', e.message);
    return true;
  }
}

// ═══════════════════════════════════════════════════════════
// TOOL ARG VALIDATION
// ═══════════════════════════════════════════════════════════
const TOOL_SCHEMAS: Record<string, { required?: string[]; types?: Record<string, string> }> = {
  send_ton:          { required: ['to', 'amount'], types: { amount: 'number', to: 'string' } },
  send_jetton:       { required: ['jetton', 'to', 'amount'], types: { amount: 'number' } },
  buy_catalog_gift:  { required: ['gift_name'], types: { gift_name: 'string' } },
  buy_resale_gift:   { required: ['gift_slug'], types: { gift_slug: 'string' } },
  list_gift_for_sale:{ required: ['gift_id', 'price'], types: { price: 'number' } },
  tg_send_message:   { required: ['chat_id', 'text'], types: { text: 'string' } },
  tg_get_messages:   { required: ['chat_id'], types: {} },
  web_search:        { required: ['query'], types: { query: 'string' } },
  fetch_url:         { required: ['url'], types: { url: 'string' } },
  set_state:         { required: ['key', 'value'], types: { key: 'string' } },
  get_state:         { required: ['key'], types: { key: 'string' } },
  notify:            { required: ['text'], types: { text: 'string' } },
  dex_get_prices:    { required: ['token'], types: { token: 'string' } },
  discord_send_message: { required: ['channel_id', 'text'], types: { channel_id: 'string', text: 'string' } },
  discord_get_messages: { required: ['channel_id'], types: { channel_id: 'string' } },
  discord_get_channels: { required: ['guild_id'], types: { guild_id: 'string' } },
  discord_add_reaction: { required: ['channel_id', 'message_id', 'emoji'], types: { channel_id: 'string', message_id: 'string', emoji: 'string' } },
  discord_get_members:  { required: ['guild_id'], types: { guild_id: 'string' } },
  x_search_tweets:     { required: ['query'], types: { query: 'string' } },
  x_get_tweet:         { required: ['tweet_id'], types: { tweet_id: 'string' } },
  x_get_user:          { required: ['username'], types: { username: 'string' } },
  x_post_tweet:        { required: ['text'], types: { text: 'string' } },
  x_reply_tweet:       { required: ['tweet_id', 'text'], types: { tweet_id: 'string', text: 'string' } },
  x_like_tweet:        { required: ['tweet_id'], types: { tweet_id: 'string' } },
  x_retweet:           { required: ['tweet_id'], types: { tweet_id: 'string' } },
  x_get_timeline:      { required: ['user_id'], types: { user_id: 'string' } },
  x_get_followers:     { required: ['user_id'], types: { user_id: 'string' } },
  exa_search:        { required: ['query'], types: { query: 'string', num_results: 'number', type: 'string' } },
  security_scan_address:     { required: ['address'], types: { address: 'string' } },
  security_blacklist_address:{ required: ['address'], types: { address: 'string', reason: 'string' } },
  security_get_risk_report:  { required: [], types: {} },
  generate_image:    { required: ['prompt'], types: { prompt: 'string', size: 'string' } },
};

function validateToolArgs(toolName: string, args: any): { ok: boolean; error?: string } {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return { ok: true };
  if (!args || typeof args !== 'object') {
    if (schema.required && schema.required.length > 0) {
      return { ok: false, error: `Missing required args: ${schema.required.join(', ')}` };
    }
    return { ok: true };
  }
  if (schema.required) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        return { ok: false, error: `Missing required field: "${field}"` };
      }
    }
  }
  if (schema.types) {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (args[field] !== undefined && typeof args[field] !== expectedType) {
        if (expectedType === 'number' && !isNaN(Number(args[field]))) {
          args[field] = Number(args[field]);
        } else if (expectedType === 'string') {
          args[field] = String(args[field]);
        } else {
          return { ok: false, error: `Field "${field}" must be ${expectedType}, got ${typeof args[field]}` };
        }
      }
    }
  }
  return { ok: true };
}

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
                'get_collections_marketcap', 'subscribe_price_stream', 'get_stream_stats'],
  telegram:    ['tg_send_message', 'tg_get_messages', 'tg_get_channel_info', 'tg_join_channel',
                'tg_leave_channel', 'tg_get_dialogs', 'tg_get_members', 'tg_search_messages',
                'tg_get_user_info', 'tg_reply', 'tg_react', 'tg_edit', 'tg_forward', 'tg_pin',
                'tg_mark_read', 'tg_get_comments', 'tg_set_typing', 'tg_send_formatted',
                'tg_get_message_by_id', 'tg_get_unread', 'tg_send_file',
                'bot_create_forum_topic', 'bot_close_forum_topic', 'bot_reopen_forum_topic',
                'bot_set_chat_description', 'bot_set_chat_title', 'bot_ban_member', 'bot_unban_member',
                'bot_create_invite_link', 'bot_get_sticker_set', 'bot_create_invoice', 'bot_send_invoice'],
  web:         ['web_search', 'fetch_url', 'http_fetch', 'exa_search'],
  media:       ['generate_image'],
  state:       ['get_state', 'set_state', 'list_state_keys'],
  notify:      ['notify', 'notify_rich'],
  plugins:     ['list_plugins', 'suggest_plugin', 'run_custom_plugin', 'list_custom_plugins',
                'apply_plugin', 'remove_plugin'],
  inter_agent: ['list_my_agents', 'ask_agent', 'assign_task', 'check_tasks', 'manage_agent', 'send_report'],
  blockchain:  ['ton_get_account', 'ton_get_transactions', 'ton_get_jettons', 'ton_get_nfts',
                'ton_run_method', 'ton_get_rates', 'ton_dns_resolve', 'ton_get_staking_pools',
                'ton_emulate_tx', 'ton_send_boc', 'ton_get_validators', 'ton_parse_address'],
  defi:        ['dex_get_prices', 'dex_swap_simulate'],
  discord:     ['discord_send_message', 'discord_get_messages', 'discord_get_channels',
                'discord_add_reaction', 'discord_get_members', 'discord_get_bot_info'],
  x_twitter:   ['x_search_tweets', 'x_get_tweet', 'x_get_user', 'x_post_tweet',
                'x_reply_tweet', 'x_like_tweet', 'x_retweet', 'x_get_timeline', 'x_get_followers'],
    knowledge:   ['skill_tree_read', 'skill_tree_write', 'skill_tree_list', 'skill_tree_search'],
  ton_mcp:     [], // dynamic — MCP tools discovered at runtime and injected via mcpTools param
  blockchain_analytics: ['dune_execute_query', 'dune_get_results', 'dune_run_sql', 'dune_search_tables'],
  prompts:     ['get_prompt_template', 'list_prompt_categories'],
  security:    ['security_scan_address', 'security_blacklist_address', 'security_get_risk_report'],
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
        description: 'Получить сохранённое состояние агента по ключу (persists between ticks)',
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
        name: 'set_state',
        description: 'Сохранить состояние агента (persists between ticks). Используй list_state_keys чтобы узнать какие ключи уже сохранены.',
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
        parameters: { type: 'object', properties: {} },
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
        description: 'Ответить на конкретное сообщение в чате/канале. Используй для участия в обсуждениях.',
        parameters: {
          type: 'object',
          properties: {
            chat_id:     { type: 'string', description: 'ID чата/канала или username' },
            reply_to_id: { type: 'number', description: 'ID сообщения на которое отвечаем' },
            text:        { type: 'string', description: 'Текст ответа' },
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
    {
      type: 'function',
      function: {
        name: 'subscribe_price_stream',
        description: 'Включить/выключить WebSocket real-time поток цен подарков. Когда включён, данные о ценах обновляются мгновенно (без задержки 30с). Используй для арбитража и мониторинга.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['start', 'stop', 'status'], description: 'start = включить поток, stop = выключить, status = текущий статус' },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_stream_stats',
        description: 'Получить статистику WebSocket потока цен: подключён ли, сколько сообщений получено, размер кеша.',
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
    // ── Director tools (only for role=director) ──
    ...(agentRole === 'director' ? [
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
    // ── Skill Tree tools (knowledge capability) ──────────────────────────
    {
      type: 'function',
      function: {
        name: 'skill_tree_read',
        description: 'Read a skill tree node by path. Returns the node content and list of child paths.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Node path, e.g. "trading/arbitrage" or "knowledge/ton"' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'skill_tree_write',
        description: 'Create or update a skill tree node. Stores knowledge that persists across sessions.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Node path (e.g. "trading/strategies/scalping")' },
            title: { type: 'string', description: 'Human-readable title for this knowledge node' },
            content: { type: 'string', description: 'The knowledge content (markdown, notes, data)' },
            parent_path: { type: 'string', description: 'Parent node path (optional, auto-derived from path)' },
          },
          required: ['path', 'title', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'skill_tree_list',
        description: 'List all skill tree nodes for this agent. Returns paths and titles.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'skill_tree_search',
        description: 'Search skill tree by keyword. Returns matching nodes with path, title, and content preview.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (searches in title and content)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'manage_capabilities',
        description: 'Enable or disable capabilities. Available: wallet, nft, gifts, telegram, web, discord, x_twitter, media (image gen), knowledge (skill trees), security, blockchain_analytics, prompts, and more.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['enable', 'disable', 'list'], description: 'enable/disable a capability, or list all' },
            capability: { type: 'string', description: 'Capability ID: wallet, nft, gifts, gifts_market, telegram, web, state, notify, plugins, inter_agent, blockchain, defi, ton_mcp, blockchain_analytics, prompts, discord, x_twitter, media, knowledge, security' },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_my_capabilities',
        description: 'Get list of currently enabled capabilities and all available ones',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Shared State tools (for multi-agent on same TG account) ──
    {
      type: 'function',
      function: {
        name: 'get_shared_state',
        description: 'Read shared state accessible by ALL agents on the same Telegram account. Use for shared data like wallet addresses, user preferences, common knowledge.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'State key to read' },
          },
          required: ['key'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_shared_state',
        description: 'Write shared state accessible by ALL agents on the same Telegram account. Other agents will see this data.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'State key to write' },
            value: { description: 'Value to store (any JSON-serializable)' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_shared_state_keys',
        description: 'List all shared state keys for agents on the same Telegram account.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Bot API: Payments ──
    {
      type: 'function',
      function: {
        name: 'bot_create_invoice',
        description: 'Create a Telegram Stars invoice link for payments. Returns a URL the user can click to pay.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Product title' },
            description: { type: 'string', description: 'Product description' },
            payload: { type: 'string', description: 'Internal payload (e.g. order ID)' },
            amount: { type: 'number', description: 'Price in Telegram Stars' },
          },
          required: ['title', 'description', 'payload', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_send_invoice',
        description: 'Send a payment invoice directly to a chat via bot.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Chat ID to send invoice to' },
            title: { type: 'string', description: 'Product title' },
            description: { type: 'string', description: 'Product description' },
            payload: { type: 'string', description: 'Internal payload' },
            amount: { type: 'number', description: 'Price in Telegram Stars' },
          },
          required: ['chat_id', 'title', 'description', 'payload', 'amount'],
        },
      },
    },
    // ── Bot API: Forum Topics ──
    {
      type: 'function',
      function: {
        name: 'bot_create_forum_topic',
        description: 'Create a new forum topic in a group with forum enabled.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Group chat ID' },
            name: { type: 'string', description: 'Topic name' },
            icon_emoji: { type: 'string', description: 'Optional emoji icon for the topic' },
          },
          required: ['chat_id', 'name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_close_forum_topic',
        description: 'Close (archive) a forum topic.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Group chat ID' },
            message_thread_id: { type: 'number', description: 'Topic thread ID' },
          },
          required: ['chat_id', 'message_thread_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_reopen_forum_topic',
        description: 'Reopen a closed forum topic.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Group chat ID' },
            message_thread_id: { type: 'number', description: 'Topic thread ID' },
          },
          required: ['chat_id', 'message_thread_id'],
        },
      },
    },
    // ── Bot API: Chat Management ──
    {
      type: 'function',
      function: {
        name: 'bot_set_chat_description',
        description: 'Set the description of a group, supergroup, or channel.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Chat ID' },
            description: { type: 'string', description: 'New description (0-255 chars)' },
          },
          required: ['chat_id', 'description'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_set_chat_title',
        description: 'Set the title of a group, supergroup, or channel.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Chat ID' },
            title: { type: 'string', description: 'New title (1-128 chars)' },
          },
          required: ['chat_id', 'title'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_ban_member',
        description: 'Ban a user from a group or channel.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Chat ID' },
            user_id: { type: 'number', description: 'User ID to ban' },
          },
          required: ['chat_id', 'user_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_unban_member',
        description: 'Unban a user from a group or channel.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Chat ID' },
            user_id: { type: 'number', description: 'User ID to unban' },
          },
          required: ['chat_id', 'user_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bot_create_invite_link',
        description: 'Create a chat invite link with optional limits.',
        parameters: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', description: 'Chat ID' },
            name: { type: 'string', description: 'Link name' },
            member_limit: { type: 'number', description: 'Max number of users (1-99999)' },
            expire_date: { type: 'number', description: 'Expiry Unix timestamp' },
          },
          required: ['chat_id'],
        },
      },
    },
    // ── Bot API: Stickers ──
    {
      type: 'function',
      function: {
        name: 'bot_get_sticker_set',
        description: 'Get a sticker set by name.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Sticker set name' },
          },
          required: ['name'],
        },
      },
    },
    // ── Exa AI Search ──
    {
      type: 'function',
      function: {
        name: 'exa_search',
        description: 'Search the web using Exa AI neural search. Returns high-quality structured results with titles, URLs, and text snippets.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            num_results: { type: 'number', description: 'Number of results (1-10, default 5)' },
            type: { type: 'string', enum: ['neural', 'keyword'], description: 'Search type: neural (semantic) or keyword (default: neural)' },
          },
          required: ['query'],
        },
      },
    },
    // ── fal.ai Image Generation ──
    {
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Generate an image from a text prompt using fal.ai Flux Schnell model. Returns the URL of the generated image.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Text description of the image to generate' },
            size: { type: 'string', description: 'Image size, e.g. 1024x1024, 512x512 (default: 1024x1024)' },
          },
          required: ['prompt'],
        },
      },
    },
    // ── Dune Analytics ──
    {
      type: 'function',
      function: {
        name: 'dune_execute_query',
        description: 'Execute a saved Dune Analytics query by query_id. Returns execution_id to poll results.',
        parameters: {
          type: 'object',
          properties: {
            query_id: { type: 'number', description: 'Dune query ID (from URL: dune.com/queries/XXXXX)' },
            parameters: { type: 'object', description: 'Optional query parameters as key-value pairs' },
          },
          required: ['query_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dune_get_results',
        description: 'Get results of a Dune query execution by execution_id.',
        parameters: {
          type: 'object',
          properties: {
            execution_id: { type: 'string', description: 'Execution ID from dune_execute_query' },
          },
          required: ['execution_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dune_run_sql',
        description: 'Execute raw DuneSQL query and get results. Supports 130+ blockchain chains (ethereum, solana, ton, polygon, etc). Auto-polls for results (up to 30s).',
        parameters: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'DuneSQL query (e.g. SELECT * FROM ethereum.transactions LIMIT 10)' },
            name: { type: 'string', description: 'Query name (default: agent_query)' },
          },
          required: ['sql'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dune_search_tables',
        description: 'Search for available tables/schemas in Dune Analytics database.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term (e.g. "ethereum transactions", "uniswap", "ton")' },
          },
          required: ['query'],
        },
      },
    },
    // ── Prompt Library ──
    {
      type: 'function',
      function: {
        name: 'get_prompt_template',
        description: 'Search for a prompt template by role/keyword from awesome-chatgpt-prompts library. Returns top 3 matches.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword or role (e.g. "linux terminal", "translator", "interviewer")' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_prompt_categories',
        description: 'List all available prompt template categories from awesome-chatgpt-prompts library.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ── Security Tools (Aegis402 Shield Protocol) ──
    {
      type: 'function',
      function: {
        name: 'security_scan_address',
        description: 'Проверить адрес: черный список, история транзакций с этим адресом, оценка риска',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес для проверки' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'security_blacklist_address',
        description: 'Добавить адрес в черный список агента. Все отправки на этот адрес будут заблокированы.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'TON адрес для блокировки' },
            reason: { type: 'string', description: 'Причина блокировки' },
          },
          required: ['address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'security_get_risk_report',
        description: 'Получить отчет о безопасности: количество транзакций, уникальные адреса, объем за час',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
  ];

  // Append MCP tools (dynamically discovered from @ton/mcp server)
  if (mcpTools && mcpTools.length > 0) {
    allTools.push(...mcpTools);
  }

  // Filter by enabled capabilities
  if (enabledCapabilities && Array.isArray(enabledCapabilities)) {
    const allowed = new Set<string>();
    for (const capId of enabledCapabilities) {
      const tools = CAPABILITY_TOOL_MAP[capId];
      if (tools) tools.forEach(t => allowed.add(t));
    }
    // Always allow core tools
    ['get_state', 'set_state', 'notify', 'notify_rich', 'apply_plugin', 'remove_plugin',
     'list_plugins', 'suggest_plugin', 'manage_capabilities', 'get_my_capabilities',
         'get_shared_state', 'set_shared_state', 'list_shared_state_keys',
     'security_scan_address', 'security_blacklist_address', 'security_get_risk_report'].forEach(t => allowed.add(t));
    // Always allow MCP tools if ton_mcp capability is enabled
    if (enabledCapabilities.includes('ton_mcp') && mcpTools) {
      mcpTools.forEach(t => allowed.add((t as any).function.name));
    }
    return allTools.filter(t => allowed.has((t as any).function.name));
  }

  return allTools;
}

// ── Tool executor ──────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, any>,
  params: AIAgentTickParams,
): Promise<any> {
  // ── Validate args ──
  const validation = validateToolArgs(name, args);
  if (!validation.ok) {
    console.warn(`[Tool] Validation failed for ${name}: ${validation.error}`);
    auditLog(params.agentId || 0, params.userId || 0, name, args, { error: validation.error }, false, validation.error || null, 0);
    return { error: validation.error };
  }

  // ── Pre-transaction security scan (Aegis402 Shield Protocol) ──
  let _secScan: SecurityScanResult | null = null;
  if (FINANCIAL_TOOLS.has(name)) {
    _secScan = preTransactionScan(params.agentId || 0, name, args);
    console.log(`[Security] ${riskEmoji(_secScan.riskLevel)} ${name} risk: ${_secScan.riskLevel}` +
      (_secScan.warnings.length ? ' | ' + _secScan.warnings.join('; ') : ''));

    // CRITICAL: block blacklisted addresses immediately
    if (_secScan.isBlacklisted) {
      const blockMsg = `Security BLOCKED: destination address is blacklisted.`;
      auditLog(params.agentId || 0, params.userId || 0, name, args,
        { blocked: true, reason: 'blacklisted_address', risk: 'CRITICAL' }, false, blockMsg, 0);
      return { error: blockMsg, blocked: true, riskLevel: 'CRITICAL' };
    }

    // Track transaction rate
    trackTxRate(params.agentId || 0);

    // Mark address as known for future checks
    if (ADDRESS_SEND_TOOLS.has(name) && args.to) {
      getKnownAddresses(params.agentId || 0).add(String(args.to));
    }
  }

  // ── Approval check for dangerous tools (with risk info) ──
  const _approvalMode = params.config?.approvalMode;
  if (_approvalMode !== 'disabled' && DANGEROUS_TOOLS.has(name)) {
    console.log(`[Tool] ⚠️ Dangerous tool "${name}" — requesting approval`);
    // Attach security scan info to args for approval notification
    const approvalArgs = _secScan ? { ...args, _securityScan: {
      riskLevel: _secScan.riskLevel,
      warnings: _secScan.warnings,
    }} : args;
    const approved = await requestApproval(params.agentId || 0, params.userId || 0, name, approvalArgs);
    if (!approved) {
      const msg = `Action "${name}" was rejected or expired. User did not approve.`;
      auditLog(params.agentId || 0, params.userId || 0, name, args, { rejected: true }, false, 'User rejected', 0);
      return { error: msg, rejected: true };
    }
    console.log(`[Tool] ✅ "${name}" approved`);
  }

  // ── Execute with audit ──
  const _auditStart = Date.now();
  try {
    const _result = await _executeToolInner(name, args, params);
    auditLog(params.agentId || 0, params.userId || 0, name, args, _result, true, null, Date.now() - _auditStart);
    return _result;
  } catch (_auditErr: any) {
    auditLog(params.agentId || 0, params.userId || 0, name, args, null, false, _auditErr.message, Date.now() - _auditStart);
    throw _auditErr;
  }
}

async function _executeToolInner(
  name: string,
  args: Record<string, any>,
  params: AIAgentTickParams,
): Promise<any> {
  const gifts  = getTelegramGiftsService();
  const stateRepo = getAgentStateRepository();

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
    case 'manage_capabilities': {
      const poolMC = (await import('../db')).pool;
      const validCapsMC = ['wallet','nft','gifts','gifts_market','telegram','web','state','notify','plugins','inter_agent','blockchain','defi','ton_mcp','blockchain_analytics','prompts','discord','x_twitter','media','knowledge','security'];
      const capDescMC: Record<string, string> = {
        wallet: 'TON wallet (balance, transfers)',
        nft: 'NFT collections (floor prices)',
        gifts: 'Telegram gifts (catalog, buy/sell)',
        gifts_market: 'Gift market analytics (arbitrage, prices)',
        telegram: 'Telegram account (messages, channels)',
        web: 'Web search & fetch URLs',
        state: 'Persistent key-value storage',
        notify: 'Push notifications to owner',
        plugins: 'MCP plugins',
        inter_agent: 'Inter-agent communication',
        blockchain: 'TON blockchain data reader',
        defi: 'DeFi swaps (DeDust/STON.fi)',
        ton_mcp: 'TON MCP server (advanced)',
        blockchain_analytics: 'Dune Analytics (SQL on 130+ chains)',
        prompts: 'Prompt library (awesome-chatgpt-prompts)',
        discord: 'Discord bot integration',
        x_twitter: 'X (Twitter) posting & monitoring',
        media: 'Media processing (images, audio, video)',
        knowledge: 'Knowledge base & RAG',
        security: 'Security scanning & address blacklists',
      };
      if (args.action === 'list') {
        const rowMC = await poolMC.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
        const tcMC = rowMC.rows[0]?.trigger_config || {};
        const cfgMC = tcMC.config || {};
        const enMC = Array.isArray(cfgMC.enabledCapabilities) ? cfgMC.enabledCapabilities : [];
        return { enabled: enMC, available: validCapsMC.map(c => ({ id: c, desc: capDescMC[c], on: enMC.includes(c) })) };
      }
      if (!args.capability || !validCapsMC.includes(args.capability)) {
        return { error: 'Invalid capability. Valid: ' + validCapsMC.join(', ') };
      }
      const rowMC2 = await poolMC.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
      const tcMC2 = typeof rowMC2.rows[0]?.trigger_config === 'string' ? JSON.parse(rowMC2.rows[0].trigger_config) : (rowMC2.rows[0]?.trigger_config || {});
      if (!tcMC2.config) tcMC2.config = {};
      let capsMC: string[] = Array.isArray(tcMC2.config.enabledCapabilities) ? tcMC2.config.enabledCapabilities : [];
      if (args.action === 'enable') {
        if (!capsMC.includes(args.capability)) capsMC.push(args.capability);
      } else if (args.action === 'disable') {
        capsMC = capsMC.filter((c: string) => c !== args.capability);
      }
      tcMC2.config.enabledCapabilities = capsMC;
      await poolMC.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tcMC2), params.agentId]);
      params.config.enabledCapabilities = capsMC;
      // Return with tool names so AI knows what it can call now
      const newToolNames: string[] = [];
      for (const capId of capsMC) {
        const capTools = CAPABILITY_TOOL_MAP[capId];
        if (capTools) capTools.forEach(t => newToolNames.push(t));
      }
      return { ok: true, action: args.action, capability: args.capability, now_enabled: capsMC, available_tools: newToolNames, hint: 'You can now call these tools directly. Use the exact tool names listed in available_tools.' };
    }

    case 'get_my_capabilities': {
      const poolGC = (await import('../db')).pool;
      const rowGC = await poolGC.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
      const tcGC = rowGC.rows[0]?.trigger_config || {};
      const cfgGC = tcGC.config || {};
      const enGC = cfgGC.enabledCapabilities;
      if (!enGC || !Array.isArray(enGC)) return { enabled: 'all (no restrictions)', note: 'No filter set' };
      return { enabled: enGC, total: enGC.length };
    }

    // ── Shared State (multi-agent on same TG account) ──
    case 'get_shared_state': {
      const tgUserId = params.config?.telegramUserId || params.config?.telegram_session?.telegramUserId;
      if (!tgUserId) return { error: 'No Telegram account linked (telegramUserId not found)' };
      try {
        const { pool } = await import('../db');
        const res = await pool.query(
          'SELECT value FROM builder_bot.agent_shared_state WHERE tg_user_id=$1 AND key=$2',
          [tgUserId, args.key]
        );
        return res.rows.length > 0 ? { key: args.key, value: res.rows[0].value } : { key: args.key, value: null };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'set_shared_state': {
      const tgUid = params.config?.telegramUserId || params.config?.telegram_session?.telegramUserId;
      if (!tgUid) return { error: 'No Telegram account linked' };
      try {
        const { pool } = await import('../db');
        await pool.query(
          `INSERT INTO builder_bot.agent_shared_state (tg_user_id, owner_user_id, key, value, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tg_user_id, key) DO UPDATE SET value=$4, updated_at=NOW()`,
          [tgUid, params.userId, args.key, JSON.stringify(args.value)]
        );
        return { ok: true, key: args.key };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'list_shared_state_keys': {
      const tgUidK = params.config?.telegramUserId || params.config?.telegram_session?.telegramUserId;
      if (!tgUidK) return { error: 'No Telegram account linked' };
      try {
        const { pool } = await import('../db');
        const res = await pool.query(
          'SELECT key, updated_at FROM builder_bot.agent_shared_state WHERE tg_user_id=$1 ORDER BY key',
          [tgUidK]
        );
        return { keys: res.rows.map((r: any) => ({ key: r.key, updated_at: r.updated_at })) };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Bot API: Payments, Forum, Chat Management, Stickers
    // ═══════════════════════════════════════════════════════════

    case 'bot_create_invoice': {
      try {
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) return { error: 'BOT_TOKEN not configured' };
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: args.title, description: args.description, payload: args.payload,
            currency: 'XTR', prices: [{ label: args.title, amount: args.amount }],
          }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { invoice_link: data.result } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_send_invoice': {
      try {
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) return { error: 'BOT_TOKEN not configured' };
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: args.chat_id, title: args.title, description: args.description,
            payload: args.payload, currency: 'XTR',
            prices: [{ label: args.title, amount: args.amount }],
          }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { sent: true, message_id: data.result?.message_id } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_create_forum_topic': {
      try {
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) return { error: 'BOT_TOKEN not configured' };
        const body: any = { chat_id: args.chat_id, name: args.name };
        if (args.icon_emoji) body.icon_custom_emoji_id = args.icon_emoji;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/createForumTopic`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { topic: data.result } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_close_forum_topic': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/closeForumTopic`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: args.chat_id, message_thread_id: args.message_thread_id }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { closed: true } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_reopen_forum_topic': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/reopenForumTopic`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: args.chat_id, message_thread_id: args.message_thread_id }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { reopened: true } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_set_chat_description': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/setChatDescription`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: args.chat_id, description: args.description }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { updated: true } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_set_chat_title': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/setChatTitle`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: args.chat_id, title: args.title }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { updated: true } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_ban_member': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: args.chat_id, user_id: args.user_id }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { banned: true } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_unban_member': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: args.chat_id, user_id: args.user_id, only_if_banned: true }),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { unbanned: true } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_create_invite_link': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const body: any = { chat_id: args.chat_id };
        if (args.name) body.name = args.name;
        if (args.member_limit) body.member_limit = args.member_limit;
        if (args.expire_date) body.expire_date = args.expire_date;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await (resp as any).json() as any;
        return data.ok ? { invite_link: data.result } : { error: data.description };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'bot_get_sticker_set': {
      try {
        const botToken = process.env.BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(args.name)}`);
        const data = await (resp as any).json() as any;
        if (!data.ok) return { error: data.description };
        return { name: data.result.name, title: data.result.title, sticker_count: data.result.stickers?.length || 0 };
      } catch (e: any) { return { error: e.message }; }
    }

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

    case 'set_agent_role': {
      try {
        const validRoles = ['worker', 'manager', 'specialist', 'monitor'];
        const newRole = String(args.role || '').toLowerCase();
        if (!validRoles.includes(newRole)) return { error: 'Invalid role. Must be: ' + validRoles.join(', ') };
        const pool = getPool();
        await pool.query('UPDATE builder_bot.agents SET role=$1 WHERE id=$2', [newRole, params.agentId]);
        await logToDb(params.agentId, 'info', `[ROLE] Changed role to ${newRole}`, params.userId);
        return { ok: true, role: newRole, note: 'Role updated. Studio dashboard will reflect this change.' };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'get_agent_wallet': {
      try {
        let addr = (await stateRepo.get(params.agentId, 'wallet_address'))?.value;
        let mnemonic = (await stateRepo.get(params.agentId, 'wallet_mnemonic'))?.value;
        // Fallback: check trigger_config (Studio may have created it)
        if (!addr || !mnemonic) {
          try {
            const pool = getPool();
            const row = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
            const tc = row.rows[0]?.trigger_config || {};
            if (tc.config?.WALLET_ADDRESS && tc.config?.WALLET_MNEMONIC) {
              addr = tc.config.WALLET_ADDRESS;
              mnemonic = tc.config.WALLET_MNEMONIC;
              await stateRepo.set(params.agentId, params.userId, 'wallet_address', addr);
              await stateRepo.set(params.agentId, params.userId, 'wallet_mnemonic', mnemonic);
            }
          } catch {}
        }
        if (!addr || !mnemonic) {
          const { generateAgentWallet } = await import('../services/TonConnect');
          const w = await generateAgentWallet();
          await stateRepo.set(params.agentId, params.userId, 'wallet_address', w.address);
          await stateRepo.set(params.agentId, params.userId, 'wallet_mnemonic', w.mnemonic);
          addr = w.address;
          mnemonic = w.mnemonic;
          // Sync wallet to trigger_config for Studio dashboard
          try {
            const pool = getPool();
            const row = await pool.query('SELECT trigger_config FROM builder_bot.agents WHERE id=$1', [params.agentId]);
            const tc = row.rows[0]?.trigger_config || {};
            if (!tc.config) tc.config = {};
            tc.config.WALLET_ADDRESS = w.address;
            tc.config.WALLET_MNEMONIC = w.mnemonic;
            await pool.query('UPDATE builder_bot.agents SET trigger_config=$1 WHERE id=$2', [JSON.stringify(tc), params.agentId]);
          } catch (syncErr: any) { console.error('[AI Runtime] wallet sync to trigger_config failed:', syncErr.message); }
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
          // Track spend
          const totalSpent = Number((await stateRepo.get(params.agentId, 'total_ton_spent'))?.value || 0) + amount;
          await stateRepo.set(params.agentId, params.userId, 'total_ton_spent', String(totalSpent));
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


    // ── Skill Tree tools ──────────────────────────────────────────────
    case 'skill_tree_read': {
      const path = String(args.path || '');
      if (!path) return { error: 'path is required' };
      try {
        const { pool } = await import('../db');
        const nodeRes = await pool.query(
          'SELECT id, path, title, content, parent_path, sort_order, created_at, updated_at FROM builder_bot.agent_skill_tree WHERE agent_id = $1 AND path = $2',
          [params.agentId, path]
        );
        if (nodeRes.rows.length === 0) return { error: 'Node not found at path: ' + path };
        const node = nodeRes.rows[0];
        // Get children
        const childRes = await pool.query(
          'SELECT path, title FROM builder_bot.agent_skill_tree WHERE agent_id = $1 AND parent_path = $2 ORDER BY sort_order, path',
          [params.agentId, path]
        );
        return {
          path: node.path,
          title: node.title,
          content: node.content,
          parent_path: node.parent_path,
          children: childRes.rows.map((r: any) => ({ path: r.path, title: r.title })),
          updated_at: node.updated_at,
        };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'skill_tree_write': {
      const path = String(args.path || '');
      const title = String(args.title || '');
      const nodeContent = String(args.content || '');
      if (!path || !title || !nodeContent) return { error: 'path, title, and content are required' };
      // Auto-derive parent_path if not provided
      const parentPath = args.parent_path ? String(args.parent_path) : (path.includes('/') ? path.split('/').slice(0, -1).join('/') : null);
      try {
        const { pool } = await import('../db');
        await pool.query(
          `INSERT INTO builder_bot.agent_skill_tree (agent_id, user_id, path, title, content, parent_path, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (agent_id, path) DO UPDATE SET title = $4, content = $5, parent_path = $6, updated_at = NOW()`,
          [params.agentId, params.userId, path, title, nodeContent, parentPath]
        );
        return { ok: true, path, title, parent_path: parentPath };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'skill_tree_list': {
      try {
        const { pool } = await import('../db');
        const res = await pool.query(
          'SELECT path, title, parent_path, sort_order FROM builder_bot.agent_skill_tree WHERE agent_id = $1 ORDER BY path',
          [params.agentId]
        );
        return {
          nodes: res.rows.map((r: any) => ({
            path: r.path,
            title: r.title,
            parent_path: r.parent_path,
            sort_order: r.sort_order,
          })),
          count: res.rows.length,
        };
      } catch (e: any) { return { nodes: [], error: e.message }; }
    }

    case 'skill_tree_search': {
      const query = String(args.query || '');
      if (!query) return { error: 'query is required' };
      try {
        const { pool } = await import('../db');
        const searchPattern = '%' + query.replace(/[%_]/g, '') + '%';
        const res = await pool.query(
          `SELECT path, title, content FROM builder_bot.agent_skill_tree
           WHERE agent_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
           ORDER BY path LIMIT 20`,
          [params.agentId, searchPattern]
        );
        return {
          results: res.rows.map((r: any) => ({
            path: r.path,
            title: r.title,
            content_preview: (r.content || '').slice(0, 200),
          })),
          count: res.rows.length,
        };
      } catch (e: any) { return { results: [], error: e.message }; }
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
          const htmlResp = await fetch('https://html.duckduckgo.com/html/?q=' + encoded, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
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
        // SSRF protection
        const u = new URL(url);
        const h = u.hostname.toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1'
          || h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('172.16.')
          || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')
          || h === '169.254.169.254' || h.endsWith('.internal') || h.endsWith('.local')
          || u.protocol === 'file:') {
          return { error: 'Access to internal addresses is blocked' };
        }
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'TONAgentBot/1.0' },
          signal: AbortSignal.timeout(10000),
        });
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

    // ── Exa AI Search ──
    case 'exa_search': {
      const query = String(args.query || '');
      if (!query) return { error: 'query required' };
      if (!checkWebRateLimit(params.agentId)) return { error: 'Rate limit: too many web requests per minute. Slow down.' };
      const exaKey = params.config?.EXA_API_KEY || process.env.EXA_API_KEY;
      if (!exaKey) return { error: 'EXA_API_KEY not configured. Add it to agent settings or environment.' };
      try {
        const numResults = Math.min(Math.max(Number(args.num_results) || 5, 1), 10);
        const searchType = args.type === 'keyword' ? 'keyword' : 'neural';
        const resp = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': exaKey,
          },
          body: JSON.stringify({
            query,
            numResults,
            type: searchType,
            contents: { text: { maxCharacters: 500 } },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          return { error: 'Exa API error: ' + resp.status + ' ' + errText.slice(0, 200) };
        }
        const data = await resp.json() as any;
        const results = (data.results || []).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: (r.text || '').slice(0, 500),
          score: r.score,
          publishedDate: r.publishedDate,
        }));
        return { results, total: results.length, searchType };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    // ── fal.ai Image Generation ──
    case 'generate_image': {
      const prompt = String(args.prompt || '');
      if (!prompt) return { error: 'prompt required' };
      const falKey = params.config?.FAL_API_KEY || process.env.FAL_API_KEY;
      if (!falKey) return { error: 'FAL_API_KEY not configured. Add it to agent settings or environment.' };
      try {
        const size = String(args.size || '1024x1024');
        const [w, h] = size.split('x').map(Number);
        const width = (w && w >= 256 && w <= 2048) ? w : 1024;
        const height = (h && h >= 256 && h <= 2048) ? h : 1024;
        const resp = await fetch('https://fal.run/fal-ai/flux/schnell', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Key ' + falKey,
          },
          body: JSON.stringify({
            prompt,
            image_size: { width, height },
            num_images: 1,
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          return { error: 'fal.ai API error: ' + resp.status + ' ' + errText.slice(0, 200) };
        }
        const data = await resp.json() as any;
        const imageUrl = data.images?.[0]?.url || data.image?.url || '';
        if (!imageUrl) return { error: 'No image URL in response' };
        return { image_url: imageUrl, prompt, size: width + 'x' + height };
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
    case 'tg_send_file': {
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
          case 'tg_send_message': return await tgSandbox.sendMessage(args.peer, args.message || args.text);
          case 'tg_get_messages': return await tgSandbox.getMessages(args.peer, args.limit ?? 20);
          case 'tg_get_channel_info': return await tgSandbox.getChannelInfo(args.peer);
          case 'tg_join_channel': return await tgSandbox.joinChannel(args.peer);
          case 'tg_leave_channel': return await tgSandbox.leaveChannel(args.peer);
          case 'tg_get_dialogs': return await tgSandbox.getDialogs(args.limit ?? 20);
          case 'tg_get_members': return await tgSandbox.getMembers(args.peer, args.limit ?? 50);
          case 'tg_search_messages': return await tgSandbox.searchMessages(args.peer, args.query, args.limit ?? 20);
          case 'tg_get_user_info': return await tgSandbox.getUserInfo(args.user);
          case 'tg_reply': { const id = await tgSandbox.replyMessage(args.chat_id, args.reply_to_id, args.text); return { ok: true, message_id: id }; }
          case 'tg_react': { await tgSandbox.reactMessage(args.chat_id, args.message_id, args.emoji); return { ok: true }; }
          case 'tg_edit': { await tgSandbox.editMessage(args.chat_id, args.message_id, args.new_text); return { ok: true }; }
          case 'tg_forward': { await tgSandbox.forwardMessage(args.from_chat, args.msg_id, args.to_chat); return { ok: true }; }
          case 'tg_pin': { await tgSandbox.pinMessage(args.chat_id, args.message_id, args.silent !== false); return { ok: true }; }
          case 'tg_mark_read': { await tgSandbox.markRead(args.chat_id); return { ok: true }; }
          case 'tg_get_comments': return await tgSandbox.getComments(args.chat_id, args.post_id, args.limit ?? 30);
          case 'tg_set_typing': { await tgSandbox.setTyping(args.chat_id); return { ok: true }; }
          case 'tg_send_formatted': { const id = await tgSandbox.sendFormatted(args.chat_id, args.html, args.reply_to); return { ok: true, message_id: id }; }
          case 'tg_get_message_by_id': { const msg = await tgSandbox.getMessageById(args.chat_id, args.message_id); return msg || { error: 'Message not found' }; }
          case 'tg_get_unread': return await tgSandbox.getUnread(args.limit ?? 10);
          case 'tg_send_file': { const id = await tgSandbox.sendFile(args.chat_id, args.file_url, args.caption); return { ok: true, message_id: id }; }
          default: return { error: 'Unknown tg tool' };
        }
      } catch (e: any) { return { error: e.message }; }
    }

    case 'http_fetch': {
      try {
        const url = args.url as string;
        // SSRF protection: block internal/private IPs
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1'
          || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.')
          || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
          || host === '169.254.169.254' || host.endsWith('.internal') || host.endsWith('.local')
          || host.endsWith('.localhost') || parsed.protocol === 'file:' || parsed.protocol === 'ftp:') {
          return { error: 'Access to internal/private addresses is blocked' };
        }
        const method = (args.method as string || 'GET').toUpperCase();
        const headers = (args.headers || {}) as Record<string, string>;
        const body = args.body as string | undefined;
        const res = await fetch(url, {
          method,
          headers: { 'User-Agent': 'TON-Agent-Platform/1.0', ...headers },
          body: method !== 'GET' ? body : undefined,
          signal: AbortSignal.timeout(15000),
        });
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

    case 'subscribe_price_stream': {
      try {
        const { startRealtimeStream, stopRealtimeStream, getStreamStats } = await import('../services/giftasset');
        const action = (args.action as string || '').toLowerCase();
        if (action === 'start') {
          const stream = startRealtimeStream();
          return { status: 'started', message: 'Real-time price stream is now active. Price data will update instantly instead of every 30s.', stats: getStreamStats() };
        } else if (action === 'stop') {
          stopRealtimeStream();
          return { status: 'stopped', message: 'Real-time price stream stopped. Prices will use regular 30s cache.' };
        } else {
          const stats = getStreamStats();
          return { status: stats ? (stats.connected ? 'connected' : 'disconnected') : 'not_started', stats: stats || { running: false, connected: false, messageCount: 0, cacheSize: 0 } };
        }
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'get_stream_stats': {
      try {
        const { getStreamStats } = await import('../services/giftasset');
        const stats = getStreamStats();
        return stats || { running: false, connected: false, messageCount: 0, lastMessageAt: 0, cacheSize: 0, note: 'Stream not started. Use subscribe_price_stream(action: "start") to enable.' };
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

        // Send message
        addMessageToAIAgent(targetId, `[От агента #${params.agentId}]: ${message}`);
        return { success: true, message: `Сообщение отправлено агенту #${targetId} «${targetAgent.data.name || ''}». Ответ придёт на следующем тике.` };
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

    // ── Discord tools ──
    case 'discord_send_message': {
      try {
        const { discordManager } = await import('../services/discord-manager');
        const discordToken = params.config?.DISCORD_BOT_TOKEN;
        if (!discordToken) return { error: 'DISCORD_BOT_TOKEN not configured. Set it in agent settings.' };
        await discordManager.registerAgent(params.agentId, { botToken: discordToken });
        return await discordManager.sendMessage(params.agentId, args.channel_id, args.text);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'discord_get_messages': {
      try {
        const { discordManager } = await import('../services/discord-manager');
        const discordToken = params.config?.DISCORD_BOT_TOKEN;
        if (!discordToken) return { error: 'DISCORD_BOT_TOKEN not configured.' };
        await discordManager.registerAgent(params.agentId, { botToken: discordToken });
        return await discordManager.getMessages(params.agentId, args.channel_id, args.limit ?? 20);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'discord_get_channels': {
      try {
        const { discordManager } = await import('../services/discord-manager');
        const discordToken = params.config?.DISCORD_BOT_TOKEN;
        if (!discordToken) return { error: 'DISCORD_BOT_TOKEN not configured.' };
        await discordManager.registerAgent(params.agentId, { botToken: discordToken });
        return await discordManager.getGuildChannels(params.agentId, args.guild_id);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'discord_add_reaction': {
      try {
        const { discordManager } = await import('../services/discord-manager');
        const discordToken = params.config?.DISCORD_BOT_TOKEN;
        if (!discordToken) return { error: 'DISCORD_BOT_TOKEN not configured.' };
        await discordManager.registerAgent(params.agentId, { botToken: discordToken });
        await discordManager.addReaction(params.agentId, args.channel_id, args.message_id, args.emoji);
        return { ok: true };
      } catch (e: any) { return { error: e.message }; }
    }
    case 'discord_get_members': {
      try {
        const { discordManager } = await import('../services/discord-manager');
        const discordToken = params.config?.DISCORD_BOT_TOKEN;
        if (!discordToken) return { error: 'DISCORD_BOT_TOKEN not configured.' };
        await discordManager.registerAgent(params.agentId, { botToken: discordToken });
        return await discordManager.getGuildMembers(params.agentId, args.guild_id, args.limit ?? 50);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'discord_get_bot_info': {
      try {
        const { discordManager } = await import('../services/discord-manager');
        const discordToken = params.config?.DISCORD_BOT_TOKEN;
        if (!discordToken) return { error: 'DISCORD_BOT_TOKEN not configured.' };
        await discordManager.registerAgent(params.agentId, { botToken: discordToken });
        return await discordManager.getBotInfo(params.agentId);
      } catch (e: any) { return { error: e.message }; }
    }

    // ── X (Twitter) tools ──
    case 'x_search_tweets': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured. Set it in agent settings.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.searchTweets(params.agentId, args.query, args.max_results ?? 10);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_get_tweet': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.getTweet(params.agentId, args.tweet_id);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_get_user': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.getUserByUsername(params.agentId, args.username);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_post_tweet': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.postTweet(params.agentId, args.text);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_reply_tweet': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.replyToTweet(params.agentId, args.tweet_id, args.text);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_like_tweet': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        const xUserId = params.config?.X_USER_ID;
        if (!xUserId) return { error: 'X_USER_ID not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken, userId: xUserId });
        return await xManager.likeTweet(params.agentId, xUserId, args.tweet_id);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_retweet': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        const xUserId = params.config?.X_USER_ID;
        if (!xUserId) return { error: 'X_USER_ID not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken, userId: xUserId });
        return await xManager.retweet(params.agentId, xUserId, args.tweet_id);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_get_timeline': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.getUserTimeline(params.agentId, args.user_id, args.max_results ?? 10);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'x_get_followers': {
      try {
        const { xManager } = await import('../services/x-manager');
        const xToken = params.config?.X_BEARER_TOKEN;
        if (!xToken) return { error: 'X_BEARER_TOKEN not configured.' };
        await xManager.registerAgent(params.agentId, { bearerToken: xToken });
        return await xManager.getFollowers(params.agentId, args.user_id, args.max_results ?? 50);
      } catch (e: any) { return { error: e.message }; }
    }

    
    // ── Dune Analytics tools ──
    case 'dune_execute_query': {
      const queryId = args.query_id;
      if (!queryId) return { error: 'query_id required' };
      const duneKey = params.config?.DUNE_API_KEY || process.env.DUNE_API_KEY;
      if (!duneKey) return { error: 'DUNE_API_KEY not configured. Add it in agent settings or environment.' };
      try {
        const body: any = {};
        if (args.parameters && typeof args.parameters === 'object') {
          body.query_parameters = args.parameters;
        }
        const resp = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
          method: 'POST',
          headers: { 'X-Dune-Api-Key': duneKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
        const data = await resp.json() as any;
        if (!resp.ok) return { error: data.error || `Dune API error: ${resp.status}` };
        return { execution_id: data.execution_id, state: data.state };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'dune_get_results': {
      const execId = args.execution_id;
      if (!execId) return { error: 'execution_id required' };
      const duneKey2 = params.config?.DUNE_API_KEY || process.env.DUNE_API_KEY;
      if (!duneKey2) return { error: 'DUNE_API_KEY not configured' };
      try {
        const resp = await fetch(`https://api.dune.com/api/v1/execution/${execId}/results`, {
          headers: { 'X-Dune-Api-Key': duneKey2 },
          signal: AbortSignal.timeout(15000),
        });
        const data = await resp.json() as any;
        if (!resp.ok) return { error: data.error || `Dune API error: ${resp.status}` };
        // Limit rows
        if (data.result?.rows && data.result.rows.length > 50) {
          data.result.rows = data.result.rows.slice(0, 50);
          data.result._truncated = true;
        }
        return { state: data.state, result: data.result, execution_id: data.execution_id };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'dune_run_sql': {
      const sql = String(args.sql || '');
      if (!sql) return { error: 'sql required' };
      const duneKey3 = params.config?.DUNE_API_KEY || process.env.DUNE_API_KEY;
      if (!duneKey3) return { error: 'DUNE_API_KEY not configured' };
      const duneHeaders = { 'X-Dune-Api-Key': duneKey3, 'Content-Type': 'application/json' };
      try {
        // 1. Create query
        const createResp = await fetch('https://api.dune.com/api/v1/query', {
          method: 'POST',
          headers: duneHeaders,
          body: JSON.stringify({ sql, name: args.name || 'agent_query', is_private: true }),
          signal: AbortSignal.timeout(15000),
        });
        const createData = await createResp.json() as any;
        if (!createResp.ok) return { error: createData.error || `Create query failed: ${createResp.status}` };
        const qid = createData.query_id;

        // 2. Execute
        const execResp = await fetch(`https://api.dune.com/api/v1/query/${qid}/execute`, {
          method: 'POST',
          headers: duneHeaders,
          body: '{}',
          signal: AbortSignal.timeout(15000),
        });
        const execData = await execResp.json() as any;
        if (!execResp.ok) return { error: execData.error || `Execute failed: ${execResp.status}` };
        const eid = execData.execution_id;

        // 3. Poll for results (max 30s, every 2s)
        const pollStart = Date.now();
        while (Date.now() - pollStart < 30000) {
          await new Promise(r => setTimeout(r, 2000));
          const statusResp = await fetch(`https://api.dune.com/api/v1/execution/${eid}/status`, {
            headers: { 'X-Dune-Api-Key': duneKey3 },
            signal: AbortSignal.timeout(10000),
          });
          const statusData = await statusResp.json() as any;
          if (statusData.state === 'QUERY_STATE_COMPLETED') break;
          if (statusData.state === 'QUERY_STATE_FAILED') {
            return { error: 'Query failed: ' + (statusData.error || 'unknown error'), query_id: qid };
          }
          if (statusData.state === 'QUERY_STATE_CANCELLED') {
            return { error: 'Query was cancelled', query_id: qid };
          }
        }

        // 4. Get results
        const resResp = await fetch(`https://api.dune.com/api/v1/execution/${eid}/results`, {
          headers: { 'X-Dune-Api-Key': duneKey3 },
          signal: AbortSignal.timeout(15000),
        });
        const resData = await resResp.json() as any;
        if (resData.result?.rows && resData.result.rows.length > 50) {
          resData.result.rows = resData.result.rows.slice(0, 50);
          resData.result._truncated = true;
          resData.result._total_rows = resData.result.metadata?.total_row_count;
        }
        return { query_id: qid, execution_id: eid, state: resData.state, result: resData.result };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'dune_search_tables': {
      const q = String(args.query || '');
      if (!q) return { error: 'query required' };
      const duneKey4 = params.config?.DUNE_API_KEY || process.env.DUNE_API_KEY;
      if (!duneKey4) return { error: 'DUNE_API_KEY not configured' };
      try {
        const resp = await fetch(`https://api.dune.com/api/v1/table/search?q=${encodeURIComponent(q)}`, {
          headers: { 'X-Dune-Api-Key': duneKey4 },
          signal: AbortSignal.timeout(10000),
        });
        const data = await resp.json() as any;
        if (!resp.ok) return { error: data.error || `Dune API error: ${resp.status}` };
        // Limit results
        const tables = Array.isArray(data.tables) ? data.tables.slice(0, 20) : (Array.isArray(data) ? data.slice(0, 20) : data);
        return { tables, total: Array.isArray(data.tables) ? data.tables.length : (Array.isArray(data) ? data.length : 0) };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Prompt Library tools ──
    case 'get_prompt_template': {
      const q = String(args.query || '').toLowerCase();
      if (!q) return { error: 'query required' };
      try {
        const prompts = await getPromptLibrary();
        // Score each prompt by keyword match
        const keywords = q.split(/\s+/).filter(Boolean);
        const scored = prompts.map(p => {
          const text = (p.act + ' ' + p.prompt).toLowerCase();
          let score = 0;
          for (const kw of keywords) {
            if (p.act.toLowerCase().includes(kw)) score += 3; // act match is stronger
            if (text.includes(kw)) score += 1;
          }
          // Exact act match bonus
          if (p.act.toLowerCase() === q) score += 10;
          return { ...p, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const top = scored.filter(s => s.score > 0).slice(0, 3);
        if (top.length === 0) return { matches: [], message: 'No matching prompt templates found. Try different keywords.' };
        return { matches: top.map(t => ({ act: t.act, prompt: t.prompt.slice(0, 1500), score: t.score })) };
      } catch (e: any) { return { error: e.message }; }
    }

    case 'list_prompt_categories': {
      try {
        const prompts = await getPromptLibrary();
        const categories = [...new Set(prompts.map(p => p.act))].sort();
        return { categories, total: categories.length };
      } catch (e: any) { return { error: e.message }; }
    }

    // ── Security Tools (Aegis402 Shield Protocol) ──
    case 'security_scan_address': {
      const addr = String(args.address || '');
      if (!addr) return { error: 'Address required' };
      const agentId = params.agentId || 0;
      const blacklist = getAgentBlacklist(agentId);
      const known = getKnownAddresses(agentId);
      const isBlacklisted = blacklist.has(addr);
      const isKnown = known.has(addr);
      // Query audit log for tx history with this address
      let txHistory: any[] = [];
      try {
        const { pool } = await import('../db');
        const res = await pool.query(
          `SELECT tool_name, args, success, created_at FROM builder_bot.agent_audit_log
           WHERE agent_id=$1 AND args::text LIKE $2
           ORDER BY created_at DESC LIMIT 20`,
          [agentId, `%${addr}%`]
        );
        txHistory = res.rows.map((r: any) => ({
          tool: r.tool_name,
          success: r.success,
          date: r.created_at,
        }));
      } catch {}
      return {
        address: addr,
        isBlacklisted,
        isKnownAddress: isKnown,
        previousTransactions: txHistory.length,
        txHistory,
        riskLevel: isBlacklisted ? 'CRITICAL' : (!isKnown ? 'MEDIUM' : 'LOW'),
      };
    }

    case 'security_blacklist_address': {
      const addr = String(args.address || '');
      if (!addr) return { error: 'Address required' };
      const reason = String(args.reason || 'Manual blacklist');
      const agentId = params.agentId || 0;
      getAgentBlacklist(agentId).add(addr);
      console.log(`[Security] Agent ${agentId} blacklisted address: ${addr} (${reason})`);
      auditLog(agentId, params.userId || 0, 'security_blacklist_address',
        { address: addr, reason }, { success: true }, true, null, 0);
      return { success: true, address: addr, reason, message: `Address ${addr} added to blacklist` };
    }

    case 'security_get_risk_report': {
      const agentId = params.agentId || 0;
      const txCount = getTxCountLastHour(agentId);
      const blacklist = getAgentBlacklist(agentId);
      const known = getKnownAddresses(agentId);
      // Query recent audit for volume
      let totalVolume = 0;
      let recentTxCount = 0;
      let uniqueAddrs = new Set<string>();
      try {
        const { pool } = await import('../db');
        const res = await pool.query(
          `SELECT tool_name, args, success FROM builder_bot.agent_audit_log
           WHERE agent_id=$1 AND tool_name IN ('send_ton','send_jetton','buy_catalog_gift','buy_resale_gift','buy_market_gift','list_gift_for_sale','dex_swap_execute')
           AND created_at > NOW() - INTERVAL '1 hour' AND success=true`,
          [agentId]
        );
        recentTxCount = res.rows.length;
        for (const row of res.rows) {
          try {
            const a = typeof row.args === 'string' ? JSON.parse(row.args) : row.args;
            if (a.amount) totalVolume += Number(a.amount) || 0;
            if (a.to) uniqueAddrs.add(a.to);
          } catch {}
        }
      } catch {}
      return {
        riskSummary: {
          txCountLastHour: txCount,
          dbTxCountLastHour: recentTxCount,
          totalVolumeLastHour: totalVolume,
          uniqueAddressesContacted: uniqueAddrs.size,
          blacklistedAddresses: blacklist.size,
          knownAddresses: known.size,
        },
        riskLevel: txCount > TX_RATE_LIMIT_PER_HOUR ? 'HIGH' : (txCount > 5 ? 'MEDIUM' : 'LOW'),
      };
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
        'run_sql': 'dune_run_sql',
        'execute_query': 'dune_execute_query',
        'search_tables': 'dune_search_tables',
        'prompt_template': 'get_prompt_template',
        'prompt_categories': 'list_prompt_categories',
        'state_keys': 'list_state_keys',
        'get_agents': 'list_my_agents',
        'my_agents': 'list_my_agents',
        'nft_floor': 'get_nft_floor',
        'gift_catalog': 'get_gift_catalog',
        'react': 'tg_react',
        'discord_message': 'discord_send_message',
        'send_discord': 'discord_send_message',
        'tweet': 'x_post_tweet',
        'post_tweet': 'x_post_tweet',
        'search_tweets': 'x_search_tweets',
        'twitter_search': 'x_search_tweets',
        'reply': 'tg_reply',
        'scan_address': 'security_scan_address',
        'blacklist_address': 'security_blacklist_address',
        'risk_report': 'security_get_risk_report',
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
    case 'tg_reply': { const id = await tgReplyMessage(args.chat_id, args.reply_to_id, args.text); return { ok: true, message_id: id }; }
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

  await logToDb(params.agentId, 'info', `[AI tick] start, pendingMsgs=${msgs.length}`, params.userId);

  // ── Execute compiled flow code if present (deterministic — NO AI fallback) ──
  const execCode = params.config.execCode as string | undefined;
  if (execCode && msgs.length === 0) {
    // Flow code = constructor agent. Execute ONLY the compiled code, never fall to AI.
    const flowResult = await executeFlowCode(execCode, params);
    if (flowResult.success) {
      await logToDb(params.agentId, 'info', `[AI tick] flow code executed OK`, params.userId);
    } else {
      await logToDb(params.agentId, 'error', `[AI tick] flow code FAILED: ${flowResult.error}`, params.userId);
      // Notify user about the error so they can fix their flow
      const errNotice = `⚠️ Ошибка в конструкторе: ${flowResult.error}\n\nПроверьте настройки блоков (подключён ли Telegram аккаунт?)`;
      if (params.onNotify) await params.onNotify(errNotice).catch(() => {});
      else await notifyUser(params.userId, errNotice).catch(() => {});
    }
    // ALWAYS return here — constructor agents never use AI loop
    return { toolCallCount: 0, finalResponse: flowResult.success ? 'Flow executed' : flowResult.error };
  }

  // ── Build initial message list ──────────────────────────────────
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
- Не повторять одни и те же возможности каждый тик — использовать set_state/get_state для дедупликации

🚫 СТРОГИЙ ЗАПРЕТ ГАЛЛЮЦИНАЦИЙ И СПАМА:
- notify() ТОЛЬКО после того, как инструмент вернул конкретный листинг с полями: provider, price_ton, link
- НИКОГДА не вызывай notify() на основе: get_state результата, предположений, логики без API-ответа
- ПОРЯДОК ОБЯЗАТЕЛЕН: сначала инструмент → проверь ответ items[] → если непустой → только тогда notify()
- Если get_gift_aggregator вернул items[] = [] → не нотифицировать, просто завершить тик молча
- Если get_gift_aggregator вернул items[0] с реальным price_ton и link → ТОГДА notify() с этой ссылкой

📵 ОДИН notify() ЗА ТИК — АБСОЛЮТНОЕ ПРАВИЛО:
- НИКОГДА не вызывай notify() несколько раз за один тик — это СПАМ
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
4. Если ничего не найдено → завершить тик молча
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
   Исключение: если предыдущий тик (get_state 'last_report_time') был <5 мин назад И ничего нового → молча.
   Формат отчёта: <b>📊 Мониторинг</b>\\n• Проверено: [что]\\n• Результат: [находки или "ничего нового"]
ПРАВИЛО: notify() вызывай ОДИН раз за тик. Данные ТОЛЬКО из tool_result, не из головы.`;

  const contextMsg = `[Текущий тик агента]
Время: ${new Date().toISOString()}
Конфиг: ${configSummary || '(пусто)'}${pluginHint}${interAgentHint}
${GIFT_SYSTEM_KNOWLEDGE}${modeHint}
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
14. SECURITY: Before sending funds to a new address, use security_scan_address to check it first.
15. NEVER send funds to blacklisted addresses. Use security_blacklist_address to block suspicious addresses.
16. Large transactions (>100 TON) require extra caution. Check the risk report with security_get_risk_report.
17. If you detect suspicious patterns (rapid transactions, unknown addresses, unusual amounts), pause and notify the owner.
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
    { role: 'user',      content: contextMsg },
  ];

  // ── Agentic loop (up to 5 iterations) ──────────
  // Get agent role for conditional director tools
  let agentRole = 'worker';
  try {
    const roleRes = await (await import('../db')).pool.query('SELECT role FROM builder_bot.agents WHERE id = $1', [params.agentId]);
    if (roleRes.rows[0]?.role) agentRole = roleRes.rows[0].role;
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

  const tools = buildToolDefinitions(agentRole, enabledCaps, mcpToolDefs);
  let totalToolCalls = 0;
  let finalContent: string | undefined;
  _tickNotifyFlag.set(params.agentId, false); // reset flag for this tick
  const usedModel = (params.config.AI_MODEL as string) || process.env.AI_MODEL || defaultModel;
  console.log(`[AI runtime] Agent #${params.agentId} AI call: model=${usedModel} baseURL=${(ai as any).baseURL} tools=${tools.length} msgs=${messages.length}`);

  for (let iter = 0; iter < 5; iter++) {
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
        // Full error dump for debugging
        console.error(`[AI runtime] Agent #${params.agentId} AI error dump: status=${e.status} code=${e.code} type=${e.type} msg=${e.message?.slice(0, 200)} headers=${JSON.stringify(e.headers || {}).slice(0, 200)} body=${JSON.stringify(e.error || e.body || {}).slice(0, 300)}`);
        const is429 = e.message?.includes('429') || e.status === 429 || e.statusCode === 429;
        if (is429 && retry < 2) {
          const delay = (retry + 1) * 5000; // 5s, 10s
          console.log(`[AI runtime] Agent #${params.agentId} 429 rate limit, retry ${retry + 1}/3 in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        const errMsg = `AI call failed: ${e.message}`;
        await logToDb(params.agentId, 'error', errMsg);
        return { toolCallCount: totalToolCalls, error: errMsg };
      }
    }
    if (lastErr) {
      const errMsg = `AI call failed after retries: ${lastErr.message}`;
      await logToDb(params.agentId, 'error', errMsg);
      return { toolCallCount: totalToolCalls, error: errMsg };
    }

    const choice    = response.choices[0];
    const assistant = choice.message;
    messages.push(assistant);

    // No tool calls → agent is done
    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      finalContent = assistant.content || undefined;
      console.log(`[AI runtime] Agent #${params.agentId} iter=${iter} content="${(assistant.content || '').slice(0, 100)}" finish=${choice.finish_reason}`);
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
        try {
          result = await executeTool(f.name, toolArgs, params);
        } catch (toolErr: any) {
          result = { error: toolErr.message || 'Tool execution failed' };
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
  }

  // ── Notify if there were user messages and AI replied ────────────
  // Only send finalContent if:
  // 1. There IS a text response (finalContent)
  // 2. User sent a message (msgs.length > 0) → this is a chat reply
  // 3. notify() was NOT already called during the tick (prevents duplicates)
  const notifyWasCalled = _tickNotifyFlag.get(params.agentId) === true;
  _tickNotifyFlag.delete(params.agentId); // cleanup

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

  await logToDb(params.agentId, 'info', `[AI tick] done, tools=${totalToolCalls}, notified=${notifyWasCalled}`, params.userId);

  // ── XP / Level gamification ──────────────────────────────────
  try {
    const xpGain = 10 + totalToolCalls * 5; // base 10 XP + 5 per tool call
    await (await import('../db')).pool.query(
      `UPDATE builder_bot.agents SET xp = COALESCE(xp, 0) + $1,
       level = GREATEST(1, FLOOR(LOG(2, GREATEST(COALESCE(xp, 0) + $1, 1)) / 2) + 1)
       WHERE id = $2`,
      [xpGain, params.agentId]
    );
  } catch {}

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
        } catch (e) {
          console.error(`[AI runtime] tick error agent #${opts.agentId}:`, e);
        } finally {
          entry.tickRunning = false;
        }
      },
    };

    // Register handle (needed for addMessageToAIAgent even without ticks)
    _activeHandles.set(opts.agentId, entry);

    // If agent has a Telegram session → it responds to messages, no scheduled ticks needed
    // This avoids burning Gemini rate limit on periodic ticks
    const hasTgSession = !!(opts.config as any)?._hasTgSession;
    if (hasTgSession) {
      console.log(`[AI runtime] Agent #${opts.agentId} has TG session — skipping scheduled ticks (message-driven only)`);
      entry.interval = null as any;
    } else {
      entry.interval = setInterval(entry.tick, opts.intervalMs);
      // Delay first tick by 30s
      setTimeout(() => {
        entry.tick().catch((e) => {
          console.error(`[AI runtime] first tick failed for agent #${opts.agentId}:`, e);
          logToDb(opts.agentId, 'error', `First tick failed: ${(e as any)?.message || String(e)}`, opts.userId);
        });
      }, 30000);
    }

    // ── Enable incoming message listener (agent acts as real TG user) ──
    // Retry with delay since TG sessions may not be restored yet at startup
    const setupListener = async (attempt: number) => {
      try {
        const { userbotManager, registerAgentMessageConfig } = await import('../services/userbot-manager');
        const tgInfo = await userbotManager.getAgentTelegramInfo(opts.agentId);
        console.log(`[AI runtime] setupListener #${opts.agentId} attempt=${attempt} authorized=${tgInfo.authorized} username=${tgInfo.username || 'none'}`);
        if (tgInfo.authorized) {
          try {
            registerAgentMessageConfig({
              agentId: opts.agentId,
              userId: opts.userId,
              selfTgId: tgInfo.telegramUserId || 0,
              selfUsername: tgInfo.username || '',
              systemPrompt: opts.systemPrompt,
              dmPolicy: (opts.config.dmPolicy as any) || 'open',
              groupPolicy: (opts.config.groupPolicy as any) || 'mention-only',
              config: opts.config,
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
        } else if (attempt < 3) {
          // TG session not restored yet, retry after delay
          setTimeout(() => setupListener(attempt + 1), 8000);
        }
      } catch (e: any) {
        if (attempt < 3) setTimeout(() => setupListener(attempt + 1), 8000);
        else console.error(`[AI runtime] Message listener setup failed for #${opts.agentId}:`, e.message);
      }
    };
    setupListener(0);

    console.log(`[AI runtime] Agent #${opts.agentId} activated, interval=${opts.intervalMs}ms`);
  }

  // Деактивировать AI-агента
  deactivate(agentId: number): void {
    const h = _activeHandles.get(agentId);
    if (h) {
      clearInterval(h.interval);
      _activeHandles.delete(agentId);
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
  if (!_runtime) _runtime = new AIAgentRuntime();
  return _runtime;
}
