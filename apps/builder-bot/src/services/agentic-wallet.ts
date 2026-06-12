/**
 * agentic-wallet.ts — Agentic Wallets Service
 *
 * Official TON Foundation standard (agents.ton.org):
 *   • Root wallet  — user's master key. Funds, mints sub-wallets, freezes, revokes.
 *   • Sub-wallets  — NFT-based per-agent wallets with operator key. Bound to root.
 *   • On-chain enforcement of daily limits, freeze/revoke. No off-chain trust required.
 *
 * Default behavior:
 *   1. setupRootWallet → try @ton/mcp@alpha (deploy_agentic_root) first.
 *   2. deploySubWallet → try @ton/mcp@alpha (deploy_agentic_subwallet) first.
 *   3. V4R2 used ONLY as fallback when MCP unreachable (graceful degradation).
 *
 * Upgraded May 2026 to use @ton/mcp@alpha v0.1.15 per agents.ton.org spec.
 */

import crypto from 'crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { pool } from '../db/index';

// ── Mnemonic Encryption (AES-256-GCM) ────────────────────────────────────────

const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';

function encryptMnemonic(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    // Fallback to ENCRYPTION_KEY or BOT_TOKEN hash — NEVER store plaintext
    const fallback = process.env.ENCRYPTION_KEY || process.env.BOT_TOKEN;
    if (!fallback) {
      console.error('[SECURITY] Cannot encrypt mnemonic — no encryption key available!');
      throw new Error('WALLET_ENCRYPTION_KEY, ENCRYPTION_KEY, or BOT_TOKEN required for mnemonic encryption');
    }
    console.warn('[AgenticWallet] Using fallback encryption key (set WALLET_ENCRYPTION_KEY for production)');
    const { encryptApiKey } = require('../crypto-utils');
    return 'enc_fallback:' + encryptApiKey(plaintext);
  }
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc:${salt.toString('hex')}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Counter of legacy-plaintext mnemonics encountered during runtime — used to surface
 * migration hint to operator. Not a metric, just a one-time warning signal.
 */
let _legacyPlaintextWarned = false;

function decryptMnemonic(stored: string): string {
  if (!stored.startsWith('enc:')) {
    // Legacy unencrypted mnemonic in DB. Return as-is but warn operator so they
    // schedule a migration. Once all agents are re-saved via encryptMnemonic()
    // (happens on any wallet_mnemonic write), this branch stops firing.
    if (!_legacyPlaintextWarned && stored && stored.split(' ').length >= 12) {
      _legacyPlaintextWarned = true;
      console.warn('[Wallet] PLAINTEXT mnemonic detected in DB (legacy). ' +
        'It will be re-encrypted on next wallet operation. Consider running scripts/migrate-plaintext-mnemonics.js');
    }
    return stored;
  }
  if (!ENCRYPTION_KEY) throw new Error('WALLET_ENCRYPTION_KEY required to decrypt mnemonic');
  const parts = stored.split(':');
  // New format: enc:salt:iv:tag:ciphertext (5 parts)
  // Legacy format: enc:iv:tag:ciphertext (4 parts)
  let saltHex: string, ivHex: string, tagHex: string, encrypted: string;
  if (parts.length === 5) {
    [, saltHex, ivHex, tagHex, encrypted] = parts;
  } else {
    // Legacy: static salt
    saltHex = '';
    [, ivHex, tagHex, encrypted] = parts;
  }
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : Buffer.from('agentic-wallet-salt');
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgenticRootWallet {
  address: string;
  status: 'pending' | 'active' | 'blocked';
  setupId?: string;
  dashboardUrl?: string;
  network: string;
  createdAt: string;
}

export interface AgenticSubWallet {
  id: number;
  userId: number;
  agentId: number | null;
  walletType: 'root' | 'sub';
  address: string;
  operatorKey?: string;
  label: string;
  isBlocked: boolean;
  balanceTon: number;
  spendLimitTon: number;
  nftIndex?: string;
  collectionAddress?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  hash: string;
  from: string;
  to: string;
  amountTon: number;
  comment?: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
}

// ── MCP Client for Registry Mode ───────────────────────────────────────────

class AgenticMcpBridge {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: string[] = [];

  async connect(mnemonic?: string): Promise<void> {
    const env: Record<string, string> = {
      PATH: process.env.PATH || '',
      NODE_ENV: process.env.NODE_ENV || 'production',
      NETWORK: process.env.TON_NETWORK || 'mainnet',
      WALLET_VERSION: 'agentic',
    };
    if (mnemonic) env.MNEMONIC = mnemonic;
    if (process.env.TONCENTER_API_KEY) env.TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
    if (process.env.TONAPI_KEY) env.TONAPI_KEY = process.env.TONAPI_KEY;

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@ton/mcp@0.1.15-alpha.15'],  // pinned; was @alpha (rolling)
      env,
    });

    this.client = new Client(
      { name: 'ton-agent-platform-agentic', version: '1.0.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
    const res = await this.client.listTools();
    this.tools = ((res as any).tools || []).map((t: any) => t.name);
    console.log(`[AgenticWallet] MCP connected, ${this.tools.length} tools: ${this.tools.join(', ')}`);
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.client) throw new Error('Agentic MCP not connected');
    const result = await this.client.callTool({ name, arguments: args });
    const content = (result as any).content;
    if (!content || !Array.isArray(content) || content.length === 0) return result;
    const text = content[0]?.text || '';
    try { return JSON.parse(text); } catch { return { result: text }; }
  }

  hasTool(name: string): boolean {
    return this.tools.includes(name);
  }

  async destroy(): Promise<void> {
    try { if (this.client) await this.client.close(); } catch (e: any) {
      console.warn('[AgenticWallet] MCP close error:', e.message);
    }
    this.client = null;
    this.transport = null;
  }

  get isConnected(): boolean {
    return this.client !== null;
  }
}

// ── AgenticWalletService (Singleton) ───────────────────────────────────────

class AgenticWalletService {
  private mcpBridge: AgenticMcpBridge | null = null;
  private mcpConnecting: Promise<void> | null = null;

  // ── Init MCP bridge ──
  async ensureMcp(mnemonic?: string): Promise<AgenticMcpBridge> {
    if (this.mcpBridge?.isConnected) return this.mcpBridge;

    if (this.mcpConnecting) {
      await this.mcpConnecting;
      if (!this.mcpBridge) throw new Error('Agentic MCP connection failed (concurrent)');
      return this.mcpBridge;
    }

    this.mcpConnecting = (async () => {
      try {
        this.mcpBridge = new AgenticMcpBridge();
        await this.mcpBridge.connect(mnemonic);
      } catch (e: any) {
        console.error('[AgenticWallet] MCP connect failed:', e.message);
        this.mcpBridge = null;
      } finally {
        this.mcpConnecting = null;
      }
    })();

    await this.mcpConnecting;
    if (!this.mcpBridge) throw new Error('MCP bridge connection failed');
    return this.mcpBridge;
  }

  // ── DB Operations ──

  /** Create agentic_wallets table if needed */
  async runMigration(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS builder_bot.agentic_wallets (
          id              SERIAL PRIMARY KEY,
          user_id         BIGINT NOT NULL,
          agent_id        INTEGER,
          wallet_type     TEXT NOT NULL DEFAULT 'sub',
          address         TEXT NOT NULL,
          operator_key    TEXT,
          label           TEXT DEFAULT '',
          is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
          balance_nano    BIGINT NOT NULL DEFAULT 0,
          spend_limit_ton NUMERIC NOT NULL DEFAULT 50,
          nft_index       TEXT,
          collection_addr TEXT,
          metadata        JSONB DEFAULT '{}',
          created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_aw_user ON builder_bot.agentic_wallets(user_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_aw_agent ON builder_bot.agentic_wallets(agent_id) WHERE agent_id IS NOT NULL
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_aw_address ON builder_bot.agentic_wallets(address)
      `);
      console.log('[AgenticWallet] ✅ Migration applied');
    } catch (e: any) {
      console.warn('[AgenticWallet] Migration warning:', e.message);
    } finally {
      client.release();
    }
  }

  // ── Root Wallet Management ──

  /** Get root wallet for user */
  async getRootWallet(userId: number): Promise<AgenticSubWallet | null> {
    const { rows } = await pool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE user_id = $1 AND wallet_type = 'root' LIMIT 1`,
      [userId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** Setup root wallet — start onboarding via MCP or direct */
  async setupRootWallet(userId: number, opts?: { address?: string; mnemonic?: string }): Promise<{
    success: boolean; wallet?: AgenticSubWallet; dashboardUrl?: string; error?: string;
  }> {
    try {
      // If address provided directly — import it
      if (opts?.address) {
        const existing = await this.getRootWallet(userId);
        if (existing) return { success: false, error: 'Root wallet already exists' };

        const wallet = await this.createWalletRecord(userId, {
          walletType: 'root',
          address: opts.address,
          label: 'Root Wallet',
        });
        return { success: true, wallet };
      }

      // If mnemonic provided — derive address and import
      if (opts?.mnemonic) {
        const { mnemonicToWalletKey } = require('@ton/crypto');
        const { WalletContractV4 } = require('@ton/ton');
        const words = opts.mnemonic.trim().split(/\s+/);
        const keyPair = await mnemonicToWalletKey(words);
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
        const address = wallet.address.toString({ bounceable: false, urlSafe: true });

        const record = await this.createWalletRecord(userId, {
          walletType: 'root',
          address,
          label: 'Root Wallet',
          operatorKey: keyPair.publicKey.toString('hex'),
        });
        return { success: true, wallet: record };
      }

      // ── PRIMARY PATH: try TON Agentic Wallets via @ton/mcp@alpha ─────────
      // agents.ton.org architecture: master/root wallet mints NFT sub-wallets,
      // on-chain enforced limits, freeze/revoke. Significantly safer for
      // autonomous agents than a raw V4R2.
      try {
        const { mnemonicNew, mnemonicToWalletKey } = require('@ton/crypto');
        const masterWords = await mnemonicNew(24);
        const masterKey = await mnemonicToWalletKey(masterWords);
        const masterMnemonic = masterWords.join(' ');

        const mcp = await this.ensureMcp(masterMnemonic);
        if (mcp && (mcp.hasTool('deploy_agentic_root') || mcp.hasTool('deploy_agentic_wallet') || mcp.hasTool('deploy_root_wallet'))) {
          const toolName = mcp.hasTool('deploy_agentic_root') ? 'deploy_agentic_root'
                         : mcp.hasTool('deploy_root_wallet')   ? 'deploy_root_wallet'
                         : 'deploy_agentic_wallet';
          const result = await mcp.callTool(toolName, {
            masterPublicKey: masterKey.publicKey.toString('hex'),
            label: 'Agentic Root',
            amountTon: '0.1',
          });
          const rootAddr = result.address || result.rootAddress;
          if (rootAddr) {
            const record = await this.createWalletRecord(userId, {
              walletType: 'root',
              address: rootAddr,
              label: 'Agentic Root (agents.ton.org)',
              operatorKey: masterKey.publicKey.toString('hex'),
            });
            // Encrypted master mnemonic in user_settings — same key path as legacy
            await pool.query(
              `INSERT INTO builder_bot.user_settings (user_id, key, value) VALUES ($1, 'root_wallet_mnemonic', $2)
               ON CONFLICT ON CONSTRAINT user_settings_unique DO UPDATE SET value = $2, updated_at = NOW()`,
              [userId, encryptMnemonic(masterMnemonic)]
            );
            console.log(`[AgenticWallet] Root deployed via MCP (${toolName}) for user ${userId}: ${rootAddr}`);
            return { success: true, wallet: record };
          }
        }
        console.warn('[AgenticWallet] MCP available but no deploy_agentic_root tool — falling back to V4R2');
      } catch (e: any) {
        console.warn('[AgenticWallet] Agentic root deploy via MCP failed, falling back to V4R2:', e?.message);
      }

      // ── FALLBACK: legacy V4R2 (self-custody, no external redirect) ──────
      // Only reached if @ton/mcp@alpha is unavailable or doesn't expose the
      // root-deploy tool. The user still gets a working wallet — just without
      // the master/operator separation and on-chain limits.
      const { generateAgentWallet } = require('./TonConnect');
      const newWallet = await generateAgentWallet();
      // Safely convert address to string (Address object may be frozen)
      let walletAddress = '';
      try {
        walletAddress = typeof newWallet.address === 'string' ? newWallet.address : String(newWallet.address);
      } catch { walletAddress = newWallet.address + ''; }
      const record = await this.createWalletRecord(userId, {
        walletType: 'root',
        address: walletAddress,
        label: 'Root Wallet (V4R2 fallback)',
        operatorKey: newWallet.publicKey ? Buffer.from(newWallet.publicKey).toString('hex') : undefined,
      });

      // Store mnemonic in user_settings (encrypted)
      await pool.query(
        `INSERT INTO builder_bot.user_settings (user_id, key, value) VALUES ($1, 'root_wallet_mnemonic', $2)
         ON CONFLICT ON CONSTRAINT user_settings_unique DO UPDATE SET value = $2, updated_at = NOW()`,
        [userId, encryptMnemonic(JSON.stringify(newWallet.mnemonic))]
      );

      return { success: true, wallet: record };
    } catch (e: any) {
      console.error('[AgenticWallet] setupRoot error:', e.message, '\n', e.stack?.slice(0, 500));
      return { success: false, error: e.message };
    }
  }

  // ── Sub-Wallet Management ──

  /** Deploy sub-wallet for an agent */
  async deploySubWallet(userId: number, agentId: number, label?: string): Promise<{
    success: boolean; wallet?: AgenticSubWallet; error?: string;
  }> {
    try {
      // Check if agent already has a wallet
      const existing = await this.getAgentWallet(agentId);
      if (existing) return { success: true, wallet: existing };

      // Try MCP deploy_agentic_subwallet
      try {
        const mcp = await this.ensureMcp();
        if (mcp && mcp.hasTool('deploy_agentic_subwallet')) {
          const { mnemonicNew, mnemonicToWalletKey } = require('@ton/crypto');
          const operatorWords = await mnemonicNew(24);
          const operatorKey = await mnemonicToWalletKey(operatorWords);

          const result = await mcp.callTool('deploy_agentic_subwallet', {
            operatorPublicKey: operatorKey.publicKey.toString('hex'),
            metadata: { name: label || `Agent #${agentId} Wallet` },
            amountTon: '0.05',
          });

          if (result.address || result.subwalletAddress) {
            const address = result.address || result.subwalletAddress;
            const record = await this.createWalletRecord(userId, {
              walletType: 'sub',
              agentId,
              address,
              label: label || `Agent #${agentId}`,
              operatorKey: operatorKey.publicKey.toString('hex'),
              nftIndex: result.nftIndex?.toString(),
              collectionAddress: result.collectionAddress,
            });

            // Store operator mnemonic in agent_state
            const { getAgentStateRepository } = require('../db/schema-extensions');
            await getAgentStateRepository().set(agentId, userId, 'agentic_wallet_address', address);
            await getAgentStateRepository().set(agentId, userId, 'agentic_operator_mnemonic', encryptMnemonic(operatorWords.join(' ')));

            return { success: true, wallet: record };
          }
        }
      } catch (e: any) {
        console.warn('[AgenticWallet] MCP deploy failed, falling back to V4R2:', e.message);
      }

      // Fallback — generate separate V4R2 wallet
      const { generateAgentWallet } = require('./TonConnect');
      const newWallet = await generateAgentWallet();

      const record = await this.createWalletRecord(userId, {
        walletType: 'sub',
        agentId,
        address: newWallet.address,
        label: label || `Agent #${agentId}`,
      });

      // Store in agent_state for backwards compatibility
      const { getAgentStateRepository } = require('../db/schema-extensions');
      await getAgentStateRepository().set(agentId, userId, 'wallet_address', newWallet.address);
      await getAgentStateRepository().set(agentId, userId, 'wallet_mnemonic', encryptMnemonic(newWallet.mnemonic));
      await getAgentStateRepository().set(agentId, userId, 'agentic_wallet_id', String(record.id));

      return { success: true, wallet: record };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Get wallet for a specific agent */
  async getAgentWallet(agentId: number): Promise<AgenticSubWallet | null> {
    const { rows } = await pool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE agent_id = $1 LIMIT 1`,
      [agentId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** Get all wallets for a user */
  async getUserWallets(userId: number): Promise<AgenticSubWallet[]> {
    const { rows } = await pool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE user_id = $1 ORDER BY wallet_type DESC, created_at`,
      [userId]
    );
    return rows.map(r => this.mapRow(r));
  }

  /** Get all sub-wallets for a user */
  async getSubWallets(userId: number): Promise<AgenticSubWallet[]> {
    const { rows } = await pool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE user_id = $1 AND wallet_type = 'sub' ORDER BY created_at`,
      [userId]
    );
    return rows.map(r => this.mapRow(r));
  }

  /** Get wallet by ID */
  async getWalletById(walletId: number): Promise<AgenticSubWallet | null> {
    const { rows } = await pool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE id = $1 LIMIT 1`,
      [walletId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** Owner-scoped lookup: returns the wallet only if it belongs to userId. Used by bot
   *  action handlers (refresh, set-limit, etc.) to enforce ownership in one place. */
  async getWallet(walletId: number, userId: number): Promise<AgenticSubWallet | null> {
    const { rows } = await pool.query(
      `SELECT * FROM builder_bot.agentic_wallets WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [walletId, userId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** Block/unblock a wallet */
  async setBlocked(walletId: number, userId: number, blocked: boolean): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE builder_bot.agentic_wallets SET is_blocked = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [blocked, walletId, userId]
    );
    return (rowCount || 0) > 0;
  }

  /** Update spend limit */
  async setSpendLimit(walletId: number, userId: number, limitTon: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE builder_bot.agentic_wallets SET spend_limit_ton = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [limitTon, walletId, userId]
    );
    return (rowCount || 0) > 0;
  }

  /** Assign wallet to agent */
  async assignToAgent(walletId: number, userId: number, agentId: number | null): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE builder_bot.agentic_wallets SET agent_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND wallet_type = 'sub'`,
      [agentId, walletId, userId]
    );
    return (rowCount || 0) > 0;
  }

  /** Update label */
  async setLabel(walletId: number, userId: number, label: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE builder_bot.agentic_wallets SET label = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [label, walletId, userId]
    );
    return (rowCount || 0) > 0;
  }

  /** Delete a sub-wallet */
  async deleteWallet(walletId: number, userId: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM builder_bot.agentic_wallets WHERE id = $1 AND user_id = $2 AND wallet_type = 'sub'`,
      [walletId, userId]
    );
    return (rowCount || 0) > 0;
  }

  /** Refresh balance for a wallet */
  async refreshBalance(walletId: number): Promise<number> {
    const { rows } = await pool.query(
      `SELECT address FROM builder_bot.agentic_wallets WHERE id = $1`,
      [walletId]
    );
    if (!rows[0]) return 0;

    const balanceTon = await this.fetchBalance(rows[0].address);
    const balanceNano = Math.round(balanceTon * 1e9);

    await pool.query(
      `UPDATE builder_bot.agentic_wallets SET balance_nano = $1, updated_at = NOW() WHERE id = $2`,
      [balanceNano, walletId]
    );

    return balanceTon;
  }

  /** Refresh ALL wallet balances for a user */
  async refreshAllBalances(userId: number): Promise<void> {
    const wallets = await this.getUserWallets(userId);
    await Promise.all(wallets.map(w => this.refreshBalance(w.id)));
  }

  /** Get total balance across all wallets */
  async getTotalBalance(userId: number): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(balance_nano), 0) as total FROM builder_bot.agentic_wallets WHERE user_id = $1 AND NOT is_blocked`,
      [userId]
    );
    return Number(rows[0]?.total || 0) / 1e9;
  }

  /** Get transaction history for a wallet */
  async getTransactions(address: string, limit: number = 20): Promise<WalletTransaction[]> {
    try {
      const apiKey = process.env.TONAPI_KEY || '';
      const resp = await fetch(
        `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/events?limit=${limit}`,
        { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
      );
      const data = await resp.json() as any;

      if (!data.events) return [];

      return data.events.map((ev: any) => {
        const action = ev.actions?.[0] || {};
        const tonTransfer = action.TonTransfer || {};
        return {
          hash: ev.event_id || '',
          from: tonTransfer.sender?.address || '',
          to: tonTransfer.recipient?.address || '',
          amountTon: Number(tonTransfer.amount || 0) / 1e9,
          comment: tonTransfer.comment || '',
          timestamp: ev.timestamp || 0,
          status: ev.in_progress ? 'pending' : 'completed',
        };
      }).filter((tx: WalletTransaction) => tx.amountTon > 0);
    } catch (e: any) {
      console.warn('[AgenticWallet] getTransactions error:', e.message);
      return [];
    }
  }

  /** Get wallet stats summary */
  async getStats(userId: number): Promise<{
    totalWallets: number;
    activeWallets: number;
    blockedWallets: number;
    totalBalanceTon: number;
    totalSpentTodayTon: number;
  }> {
    const wallets = await this.getUserWallets(userId);
    const active = wallets.filter(w => !w.isBlocked);
    const blocked = wallets.filter(w => w.isBlocked);
    const totalBalance = wallets.reduce((sum, w) => sum + w.balanceTon, 0);

    // Daily spend from agent_daily_spend
    let totalSpent = 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { rows } = await pool.query(
        `SELECT COALESCE(SUM(spent_nano), 0) as total FROM builder_bot.agent_daily_spend
         WHERE user_id = $1 AND spend_date = $2`,
        [userId, today]
      );
      totalSpent = Number(rows[0]?.total || 0) / 1e9;
    } catch (e: any) {
      console.warn('[AgenticWallet] getStats daily spend query error:', e.message);
    }

    return {
      totalWallets: wallets.length,
      activeWallets: active.length,
      blockedWallets: blocked.length,
      totalBalanceTon: totalBalance,
      totalSpentTodayTon: totalSpent,
    };
  }

  // ── Helpers ──

  private async fetchBalance(address: string): Promise<number> {
    try {
      const apiKey = process.env.TONAPI_KEY || '';
      const resp = await fetch(
        `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`,
        { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
      );
      const data = await resp.json() as any;
      return data.balance !== undefined ? Number(data.balance) / 1e9 : 0;
    } catch {
      return 0;
    }
  }

  private async createWalletRecord(userId: number, opts: {
    walletType: 'root' | 'sub';
    address: string;
    agentId?: number;
    label?: string;
    operatorKey?: string;
    nftIndex?: string;
    collectionAddress?: string;
    metadata?: Record<string, any>;
  }): Promise<AgenticSubWallet> {
    const { rows } = await pool.query(
      `INSERT INTO builder_bot.agentic_wallets
        (user_id, agent_id, wallet_type, address, operator_key, label, nft_index, collection_addr, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (address) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         agent_id = EXCLUDED.agent_id,
         wallet_type = EXCLUDED.wallet_type,
         operator_key = EXCLUDED.operator_key,
         label = EXCLUDED.label,
         nft_index = EXCLUDED.nft_index,
         collection_addr = EXCLUDED.collection_addr,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        opts.agentId || null,
        opts.walletType,
        opts.address,
        opts.operatorKey || null,
        opts.label || '',
        opts.nftIndex || null,
        opts.collectionAddress || null,
        JSON.stringify(opts.metadata || {}),
      ]
    );
    return this.mapRow(rows[0]);
  }

  private mapRow(row: any): AgenticSubWallet {
    return {
      id: row.id,
      userId: Number(row.user_id),
      agentId: row.agent_id ? Number(row.agent_id) : null,
      walletType: row.wallet_type,
      address: row.address,
      operatorKey: row.operator_key,
      label: row.label || '',
      isBlocked: row.is_blocked,
      balanceTon: Number(row.balance_nano || 0) / 1e9,
      spendLimitTon: Number(row.spend_limit_ton || 50),
      nftIndex: row.nft_index,
      collectionAddress: row.collection_addr,
      metadata: row.metadata || {},
      createdAt: row.created_at?.toISOString() || '',
      updatedAt: row.updated_at?.toISOString() || '',
    };
  }

  /** Shutdown */
  async destroy(): Promise<void> {
    if (this.mcpBridge) {
      await this.mcpBridge.destroy();
      this.mcpBridge = null;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _service: AgenticWalletService | null = null;

export function getAgenticWalletService(): AgenticWalletService {
  if (!_service) _service = new AgenticWalletService();
  return _service;
}

export { AgenticWalletService, encryptMnemonic, decryptMnemonic };
