/**
 * state.ts — centralised shared state for bot pending-Maps and caches.
 *
 * Extracted from bot.ts to allow handler modules to import shared state
 * without creating circular dependencies.
 */

import type { Complete2FAFn } from './fragment-service';
import type { AgentWallet } from './services/TonConnect';

// ============================================================
// Rate limiter
// ============================================================
export const _rateLimits = new Map<number, { count: number; resetAt: number }>();
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW = 60000;

// ============================================================
// Caches
// ============================================================
export const agentWallets = new Map<number, AgentWallet>();
export const tonConnectLinks = new Map<number, string>();
export const userLanguages = new Map<number, 'ru' | 'en'>();
export const _ownerCache = new Map<number, { ownerId: number; ts: number }>();

// ============================================================
// Interfaces for pending state machines
// ============================================================

export interface PendingAgentCreation {
  description: string;
  step: 'schedule';
  name?: string;
  createdAt?: number;
}

export interface PendingNameAsk {
  description: string;
}

export interface PendingAgentSetup {
  agentId: number;
  steps: Array<'tg_auth' | 'wallet' | 'api_key'>;
  currentStep: number;
  tgAuthed: boolean;
  hasApiKey: boolean;
  walletCreated: boolean;
}

export interface PendingTemplateSetup {
  templateId: string;
  collected: Record<string, string>;
  remaining: string[];
}

export interface PendingPublish {
  step: 'name';
  agentId: number;
  price: number;
}

export interface PendingOnboarding {
  step: 'welcome' | 'provider' | 'apikey' | 'create_agent';
  provider?: string;
  apiKey?: string;
  createdAt: number;
}

// ============================================================
// Pending state Maps
// ============================================================

export const pendingRepairs = new Map<string, string>();
export const pendingCreations = new Map<number, PendingAgentCreation>();
export const pendingNameAsk = new Map<number, PendingNameAsk>();
export const pendingPluginCreation = new Map<number, { step: 'name' | 'description' | 'code'; name?: string; description?: string }>();
export const pendingRenames = new Map<number, number>();
export const pendingEdits = new Map<number, number>();
export const pendingRefinements = new Map<number, number>();
export const pendingAgentChats = new Map<number, number>();
export const pendingBlocklistAdd = new Map<number, number>();
export const pendingTriggerAdd = new Map<number, { agentId: number; step: 'keyword' | 'context'; keyword?: string }>();
export const pendingProposalDiscuss = new Map<number, string>();
export const pendingAgentSetup = new Map<number, PendingAgentSetup>();
export const pendingLangSetup = new Set<number>();
export const pendingWithdrawal = new Map<number, { step: 'enter_address' | 'enter_amount'; address?: string }>();
export const pendingTemplateSetup = new Map<number, PendingTemplateSetup>();
export const _wizardLock = new Set<number>();
export const pendingPublish = new Map<number, PendingPublish>();
export const pendingTgAuth = new Map<number, 'phone' | 'code' | 'password' | 'qr_waiting' | 'qr_password'>();
export const qrPollingHandles = new Map<number, NodeJS.Timeout>();
export const complete2FAFns = new Map<number, Complete2FAFn>();
export const pendingOnboarding = new Map<number, PendingOnboarding>();
export const pendingUserIdea = new Map<number, boolean>();
export const pendingWalletImport = new Map<number, { type: 'address' | 'mnemonic'; startTs: number }>();
export const pendingWalletLimit = new Map<number, { walletId: number; startTs: number }>();
export const pendingWalletRename = new Map<number, { walletId: number; startTs: number }>();
export const pendingTopup = new Map<number, { startTs: number; amountTon?: number }>();
export const processedTopupTx = new Set<string>();
export const pendingApiKey = new Map<number, { provider?: string }>();

// ============================================================
// Owner cache helpers
// ============================================================

export function getCachedOwner(agentId: number): number | null {
  const c = _ownerCache.get(agentId);
  if (c && Date.now() - c.ts < 30000) return c.ownerId;
  return null;
}

export function setCachedOwner(agentId: number, ownerId: number): void {
  _ownerCache.set(agentId, { ownerId, ts: Date.now() });
  if (_ownerCache.size > 5000) _ownerCache.clear();
}

// ============================================================
// Language helpers
// ============================================================

export function detectLang(text: string): 'ru' | 'en' {
  const ruChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  return ruChars >= enChars ? 'ru' : 'en';
}

export function getUserLang(userId: number, text?: string): 'ru' | 'en' {
  if (userLanguages.has(userId)) return userLanguages.get(userId)!;
  if (text) {
    const detected = detectLang(text);
    userLanguages.set(userId, detected);
    return detected;
  }
  return 'ru';
}

// ============================================================
// TTL cleanup — run every 30 minutes to prevent memory leaks
// ============================================================

const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function startPendingStateTTLCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - PENDING_TTL_MS;

    for (const [userId, state] of pendingCreations) {
      if (state.createdAt && state.createdAt < cutoff) pendingCreations.delete(userId);
    }
    for (const [userId, state] of pendingOnboarding) {
      if (state.createdAt < cutoff) pendingOnboarding.delete(userId);
    }
    for (const [userId, state] of pendingWalletImport) {
      if (state.startTs < cutoff) pendingWalletImport.delete(userId);
    }
    for (const [userId, state] of pendingWalletLimit) {
      if (state.startTs < cutoff) pendingWalletLimit.delete(userId);
    }
    for (const [userId, state] of pendingWalletRename) {
      if (state.startTs < cutoff) pendingWalletRename.delete(userId);
    }
    for (const [userId, state] of pendingTopup) {
      if (state.startTs < cutoff) pendingTopup.delete(userId);
    }

    // Maps without timestamps: cap at 1000 entries (evict oldest by Map insertion order)
    const CAPS: Array<Map<any, any> | Set<any>> = [
      pendingRenames, pendingEdits, pendingRefinements, pendingAgentChats,
      pendingBlocklistAdd, pendingTriggerAdd, pendingProposalDiscuss,
      pendingWithdrawal, pendingTemplateSetup, pendingPublish,
      pendingTgAuth, pendingApiKey, pendingUserIdea, pendingPluginCreation,
      pendingNameAsk, pendingAgentSetup, pendingRepairs, pendingLangSetup,
    ];
    for (const m of CAPS) {
      if (m.size > 1000) {
        const iter = (m as Map<any, any>).keys?.() ?? (m as Set<any>).values();
        while (m.size > 800) {
          const { value, done } = iter.next();
          if (done) break;
          (m as any).delete(value);
        }
      }
    }

    // Cap caches
    if (_ownerCache.size > 10000) _ownerCache.clear();
    if (userLanguages.size > 10000) userLanguages.clear();
    if (_rateLimits.size > 5000) {
      // Evict expired rate limit windows
      for (const [k, v] of _rateLimits) {
        if (v.resetAt < now) _rateLimits.delete(k);
      }
    }
  }, 30 * 60 * 1000);
}

// ============================================================
// clearAllPendingStates — clears every pending Map for a userId
// ============================================================

export function clearAllPendingStates(userId: number): void {
  pendingCreations.delete(userId);
  pendingNameAsk.delete(userId);
  pendingRenames.delete(userId);
  pendingEdits.delete(userId);
  pendingAgentChats.delete(userId);
  pendingWithdrawal.delete(userId);
  pendingTemplateSetup.delete(userId);
  _wizardLock.delete(userId);
  pendingPublish.delete(userId);
  pendingTgAuth.delete(userId);
  pendingApiKey.delete(userId);
  pendingLangSetup.delete(userId);
  pendingAgentSetup.delete(userId);
  pendingPluginCreation.delete(userId);
  pendingOnboarding.delete(userId);
  pendingTopup.delete(userId);
  pendingUserIdea.delete(userId);
  pendingProposalDiscuss.delete(userId);
  pendingWalletImport.delete(userId);
  pendingWalletLimit.delete(userId);
  pendingWalletRename.delete(userId);
  pendingRefinements.delete(userId);
  pendingBlocklistAdd.delete(userId);
  pendingTriggerAdd.delete(userId);
  const qrHandle = qrPollingHandles.get(userId);
  if (qrHandle) { clearInterval(qrHandle); qrPollingHandles.delete(userId); }
  complete2FAFns.delete(userId);
}
