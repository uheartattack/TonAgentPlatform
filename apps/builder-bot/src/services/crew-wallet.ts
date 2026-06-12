/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CREW WALLET — shared TON wallet for an entire crew
 *
 * Lives on the `crews` table (wallet_address + wallet_mnemonic columns).
 * Generated once, mnemonic encrypted at rest via crypto-utils.
 *
 * Permissions (enforced at REST + tool layer):
 *   • create wallet — only manager_agent_id's owner, OR the user that owns the crew
 *   • get balance / address — any active member of the crew
 *   • send TON — any active member, subject to:
 *       (a) agent's role.maxSpendPerAction (per-tx hard cap)
 *       (b) crew.budget_ton_month (monthly cap across all members)
 *
 * All outgoing transactions logged in crew_wallet_log so audit + budget tracking
 * works end-to-end.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { pool } from '../db/index';
import { encryptApiKey, decryptApiKey } from '../crypto-utils';

export interface CrewWalletInfo {
  crewId: number;
  address: string;
  workchain: number;
  createdAt: string;
  balanceTon?: number;        // populated on demand via TonAPI
  monthSpendTon?: number;     // current month outgoing
  budgetTonMonth?: number;
}

export interface CrewWalletPolicy {
  agentCap: number;           // role.maxSpendPerAction TON for the caller agent
  monthlyBudget: number;      // crew.budget_ton_month
  alreadySpentThisMonth: number;
}

/** Create wallet for crew. Idempotent — if wallet exists returns existing. */
export async function createCrewWallet(crewId: number, userId: number): Promise<{ address: string; isNew: boolean }> {
  const cur = await pool.query(
    `SELECT wallet_address FROM builder_bot.crews WHERE id = $1 AND user_id = $2`,
    [crewId, userId],
  );
  if (!cur.rows[0]) throw new Error(`Crew #${crewId} not found`);
  if (cur.rows[0].wallet_address) {
    return { address: cur.rows[0].wallet_address, isNew: false };
  }
  // Generate fresh V4R2 mnemonic via @ton/crypto
  const { mnemonicNew, mnemonicToWalletKey } = require('@ton/crypto');
  const words: string[] = await mnemonicNew(24);
  const key = await mnemonicToWalletKey(words);
  const { WalletContractV4 } = require('@ton/ton');
  const { internal: _i } = require('@ton/core'); void _i;
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const address = wallet.address.toString({ bounceable: false });
  const encryptedMnemonic = encryptApiKey(words.join(' '));
  await pool.query(
    `UPDATE builder_bot.crews
        SET wallet_address = $1, wallet_mnemonic = $2, wallet_workchain = 0,
            wallet_created_at = NOW(), updated_at = NOW()
      WHERE id = $3`,
    [address, encryptedMnemonic, crewId],
  );
  console.log(`[CrewWallet] Created wallet for crew #${crewId}: ${address}`);
  return { address, isNew: true };
}

/** Get crew wallet info. Includes live balance (TonAPI) and current-month spend. */
export async function getCrewWallet(crewId: number): Promise<CrewWalletInfo | null> {
  const r = await pool.query(
    `SELECT id, wallet_address, wallet_workchain, wallet_created_at, budget_ton_month
       FROM builder_bot.crews WHERE id = $1`,
    [crewId],
  );
  if (!r.rows[0] || !r.rows[0].wallet_address) return null;
  const row = r.rows[0];
  // Live balance via TonAPI (best-effort, cached briefly upstream)
  let balanceTon: number | undefined;
  try {
    const tonApiKey = process.env.TONAPI_KEY || '';
    const headers: Record<string, string> = {};
    if (tonApiKey) headers['Authorization'] = `Bearer ${tonApiKey}`;
    const accResp = await fetch(`https://tonapi.io/v2/accounts/${row.wallet_address}`, { headers });
    if (accResp.ok) {
      const j: any = await accResp.json();
      if (j && typeof j.balance === 'number') balanceTon = j.balance / 1e9;
    }
  } catch { /* network — leave undefined */ }
  // Current-month spend (sum of outgoing)
  const spendRes = await pool.query(
    `SELECT COALESCE(SUM(amount_ton), 0) AS s
       FROM builder_bot.crew_wallet_log
      WHERE crew_id = $1 AND direction = 'out'
        AND created_at >= date_trunc('month', NOW())`,
    [crewId],
  );
  const monthSpendTon = Number(spendRes.rows[0]?.s) || 0;
  return {
    crewId,
    address: row.wallet_address,
    workchain: row.wallet_workchain || 0,
    createdAt: row.wallet_created_at,
    balanceTon,
    monthSpendTon,
    budgetTonMonth: Number(row.budget_ton_month) || 0,
  };
}

/** Recent transactions log (incl. our own outgoing + manually-logged incoming). */
export async function getCrewWalletLog(crewId: number, limit = 50): Promise<any[]> {
  const r = await pool.query(
    `SELECT id, agent_id, user_id, direction, amount_ton, destination, tx_hash, comment, created_at
       FROM builder_bot.crew_wallet_log
      WHERE crew_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [crewId, Math.min(200, limit)],
  );
  return r.rows;
}

/** Check whether `agentId` is allowed to spend `amount` from this crew's wallet
 *  right now. Combines role cap + crew monthly budget. Returns policy details
 *  + structured error or { ok: true } if go. */
export async function checkCrewSpendPolicy(
  crewId: number, agentId: number, amount: number,
): Promise<{ ok: boolean; error?: string; policy?: CrewWalletPolicy }> {
  // 1) Agent must be a member of this crew
  const mem = await pool.query(
    `SELECT user_id, agent_ids, budget_ton_month FROM builder_bot.crews
      WHERE id = $1 AND is_active = true`,
    [crewId],
  );
  if (!mem.rows[0]) return { ok: false, error: `Crew #${crewId} not found or inactive` };
  const memberIds: number[] = mem.rows[0].agent_ids || [];
  if (!memberIds.includes(agentId)) return { ok: false, error: `Agent #${agentId} is not a member of crew #${crewId}` };
  const monthlyBudget = Number(mem.rows[0].budget_ton_month) || 0;
  // 2) Role cap
  const agentRow = await pool.query(`SELECT role, user_id FROM builder_bot.agents WHERE id = $1`, [agentId]);
  if (!agentRow.rows[0]) return { ok: false, error: 'Agent not found' };
  const role = agentRow.rows[0].role || 'worker';
  const userId = agentRow.rows[0].user_id;
  const { getRoleProfileAsync } = await import('../agents/role-profiles');
  const rp = await getRoleProfileAsync(role, userId);
  const agentCap = Number(rp.maxSpendPerAction) || 0;
  if (agentCap === 0) return { ok: false, error: `Role "${rp.id}" has no financial permissions` };
  if (amount > agentCap) return { ok: false, error: `Role "${rp.id}" max per-tx is ${agentCap} TON; got ${amount}` };
  // 3) Monthly crew budget (0 = unlimited)
  const spendRes = await pool.query(
    `SELECT COALESCE(SUM(amount_ton), 0) AS s
       FROM builder_bot.crew_wallet_log
      WHERE crew_id = $1 AND direction = 'out'
        AND created_at >= date_trunc('month', NOW())`,
    [crewId],
  );
  const alreadySpentThisMonth = Number(spendRes.rows[0]?.s) || 0;
  if (monthlyBudget > 0 && alreadySpentThisMonth + amount > monthlyBudget) {
    return { ok: false, error: `Crew monthly budget exhausted: ${alreadySpentThisMonth.toFixed(4)} + ${amount} > ${monthlyBudget} TON. Wait until next month or raise budget.` };
  }
  return { ok: true, policy: { agentCap, monthlyBudget, alreadySpentThisMonth } };
}

/** Execute TON transfer from crew wallet. Logs to crew_wallet_log on success. */
export async function sendFromCrewWallet(
  crewId: number, agentId: number, to: string, amount: number, comment?: string,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const policy = await checkCrewSpendPolicy(crewId, agentId, amount);
  if (!policy.ok) return { ok: false, error: policy.error };
  const w = await pool.query(
    `SELECT wallet_address, wallet_mnemonic, user_id FROM builder_bot.crews WHERE id = $1`,
    [crewId],
  );
  if (!w.rows[0] || !w.rows[0].wallet_mnemonic) return { ok: false, error: 'Crew has no wallet yet — create one first' };
  let mnemonic: string;
  try {
    mnemonic = decryptApiKey(w.rows[0].wallet_mnemonic);
  } catch (e: any) {
    return { ok: false, error: `Cannot decrypt crew mnemonic: ${e?.message}` };
  }
  try {
    const { walletFromMnemonic, sendAgentTransaction } = await import('./TonConnect');
    const wallet = await walletFromMnemonic(mnemonic, 'v4r2');
    const result = await sendAgentTransaction(wallet, to, amount, comment || '');
    if ((result as any)?.ok) {
      const hash = (result as any).hash;
      await pool.query(
        `INSERT INTO builder_bot.crew_wallet_log
           (crew_id, agent_id, user_id, direction, amount_ton, destination, tx_hash, comment)
         VALUES ($1, $2, $3, 'out', $4, $5, $6, $7)`,
        [crewId, agentId, w.rows[0].user_id, amount, to, hash, (comment || '').slice(0, 400)],
      );
      return { ok: true, hash };
    }
    return { ok: false, error: (result as any)?.error || 'Transaction failed' };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRINT 6b — Wallet TIER permissions + distribute to members
// ═══════════════════════════════════════════════════════════════════════════

/** Treasurer = crew.manager_agent_id, OR any director-role member in crew.agent_ids.
 *  Member = any agent in crew.agent_ids that is not the treasurer.
 *  Returns 'treasurer' | 'member' | 'outsider' relative to this crew. */
export async function getCrewWalletRole(crewId: number, agentId: number): Promise<'treasurer' | 'member' | 'outsider'> {
  const r = await pool.query(
    `SELECT c.manager_agent_id, c.agent_ids, a.role
       FROM builder_bot.crews c
       LEFT JOIN builder_bot.agents a ON a.id = $2
      WHERE c.id = $1`,
    [crewId, agentId],
  );
  if (!r.rows[0]) return 'outsider';
  const row = r.rows[0];
  const isMember = Array.isArray(row.agent_ids) && row.agent_ids.includes(agentId);
  if (!isMember) return 'outsider';
  const isManager = row.manager_agent_id === agentId;
  const isDirector = (row.role || '').startsWith('director');
  if (isManager || isDirector) return 'treasurer';
  return 'member';
}

/** Set/update monthly allowance for a crew member. Treasurer-only. */
export async function setMemberAllowance(
  crewId: number, callerAgentId: number, memberAgentId: number, monthlyAllowanceTon: number,
): Promise<{ ok: boolean; error?: string; row?: any }> {
  const callerRole = await getCrewWalletRole(crewId, callerAgentId);
  if (callerRole !== 'treasurer') return { ok: false, error: `Only treasurer can set allowances (you are: ${callerRole})` };
  const memberRole = await getCrewWalletRole(crewId, memberAgentId);
  if (memberRole === 'outsider') return { ok: false, error: `Agent #${memberAgentId} is not a member of crew #${crewId}` };
  if (monthlyAllowanceTon < 0) return { ok: false, error: 'monthly_allowance_ton must be >= 0' };
  const r = await pool.query(
    `INSERT INTO builder_bot.crew_member_allowances (crew_id, agent_id, monthly_allowance_ton)
     VALUES ($1, $2, $3)
     ON CONFLICT (crew_id, agent_id) DO UPDATE SET monthly_allowance_ton = $3, updated_at = NOW()
     RETURNING *`,
    [crewId, memberAgentId, monthlyAllowanceTon],
  );
  return { ok: true, row: r.rows[0] };
}

/** Distribute TON from crew treasury to a member's personal wallet.
 *  Treasurer-only. Capped by member's monthly allowance (rolling calendar month). */
export async function distributeToMember(
  crewId: number, callerAgentId: number, memberAgentId: number, amountTon: number, comment?: string,
): Promise<{ ok: boolean; error?: string; hash?: string; remainingAllowanceTon?: number }> {
  if (!Number.isFinite(amountTon) || amountTon <= 0) return { ok: false, error: 'amount_ton must be > 0' };
  const callerRole = await getCrewWalletRole(crewId, callerAgentId);
  if (callerRole !== 'treasurer') return { ok: false, error: `Only treasurer can distribute (you are: ${callerRole})` };
  const memberRole = await getCrewWalletRole(crewId, memberAgentId);
  if (memberRole === 'outsider') return { ok: false, error: `Agent #${memberAgentId} not in crew #${crewId}` };
  const wRes = await pool.query(
    `SELECT address FROM builder_bot.agentic_wallets WHERE agent_id = $1 AND wallet_type = 'sub' ORDER BY created_at DESC LIMIT 1`,
    [memberAgentId],
  );
  if (!wRes.rows[0]) {
    return { ok: false, error: `Member #${memberAgentId} has no personal wallet. They need to deploy one first via Studio → Wallets.` };
  }
  const memberAddress: string = wRes.rows[0].address;
  const monthKey = new Date().toISOString().slice(0, 7);
  await pool.query(
    `INSERT INTO builder_bot.crew_member_allowances (crew_id, agent_id) VALUES ($1, $2)
     ON CONFLICT (crew_id, agent_id) DO NOTHING`,
    [crewId, memberAgentId],
  );
  await pool.query(
    `UPDATE builder_bot.crew_member_allowances
        SET current_month_received_ton = 0, current_month_key = $1, updated_at = NOW()
      WHERE crew_id = $2 AND agent_id = $3 AND current_month_key <> $1`,
    [monthKey, crewId, memberAgentId],
  );
  const allow = await pool.query(
    `SELECT monthly_allowance_ton, current_month_received_ton
       FROM builder_bot.crew_member_allowances WHERE crew_id = $1 AND agent_id = $2`,
    [crewId, memberAgentId],
  );
  const cap = Number(allow.rows[0].monthly_allowance_ton);
  const used = Number(allow.rows[0].current_month_received_ton);
  if (cap > 0 && used + amountTon > cap) {
    return { ok: false, error: `Would exceed member's monthly allowance (used ${used.toFixed(4)} + ${amountTon} > cap ${cap} TON). Raise allowance via crew_set_allowance.` };
  }
  const sendResult = await sendFromCrewWallet(crewId, callerAgentId, memberAddress, amountTon, comment || `Distribute to agent #${memberAgentId}`);
  if (!sendResult.ok) return { ok: false, error: sendResult.error };
  await pool.query(
    `UPDATE builder_bot.crew_member_allowances
        SET current_month_received_ton = current_month_received_ton + $1,
            last_distribution_at = NOW(),
            last_distribution_amount_ton = $1,
            updated_at = NOW()
      WHERE crew_id = $2 AND agent_id = $3`,
    [amountTon, crewId, memberAgentId],
  );
  return { ok: true, hash: sendResult.hash, remainingAllowanceTon: cap > 0 ? cap - used - amountTon : undefined };
}

/** Treasury overview for a crew. Treasurer sees everything; member sees own row only. */
export async function getCrewTreasuryView(crewId: number, callerAgentId: number): Promise<any> {
  const role = await getCrewWalletRole(crewId, callerAgentId);
  if (role === 'outsider') return { error: `You are not a member of crew #${crewId}` };
  const crew = await pool.query(`SELECT id, name, agent_ids, manager_agent_id, budget_ton_month FROM builder_bot.crews WHERE id = $1`, [crewId]);
  if (!crew.rows[0]) return { error: 'Crew not found' };
  const c = crew.rows[0];
  const wallet = await getCrewWallet(crewId);
  const monthKey = new Date().toISOString().slice(0, 7);
  const memberIds: number[] = role === 'treasurer' ? (c.agent_ids || []) : [callerAgentId];
  const m = await pool.query<{ id: number; name: string; role: string; is_active: boolean }>(
    `SELECT id, name, role, is_active FROM builder_bot.agents WHERE id = ANY($1::int[])`,
    [memberIds],
  );
  const w = await pool.query<{ agent_id: number; address: string }>(
    `SELECT DISTINCT ON (agent_id) agent_id, address
       FROM builder_bot.agentic_wallets
      WHERE agent_id = ANY($1::int[]) AND wallet_type = 'sub'
      ORDER BY agent_id, created_at DESC`,
    [memberIds],
  );
  const a = await pool.query<{ agent_id: number; monthly_allowance_ton: string; current_month_received_ton: string; current_month_key: string }>(
    `SELECT agent_id, monthly_allowance_ton, current_month_received_ton, current_month_key
       FROM builder_bot.crew_member_allowances WHERE crew_id = $1 AND agent_id = ANY($2::int[])`,
    [crewId, memberIds],
  );
  const walletByAgent = new Map(w.rows.map(r => [r.agent_id, r.address]));
  const allowByAgent = new Map(a.rows.map(r => [r.agent_id, r]));
  const members = m.rows.map(mr => {
    const al = allowByAgent.get(mr.id);
    const sameMonth = al && al.current_month_key === monthKey;
    return {
      agent_id: mr.id, name: mr.name, role: mr.role || 'worker', is_active: mr.is_active,
      is_treasurer: mr.id === c.manager_agent_id || (mr.role || '').startsWith('director'),
      personal_wallet: walletByAgent.get(mr.id) || null,
      monthly_allowance_ton: al ? Number(al.monthly_allowance_ton) : 0,
      current_month_received_ton: sameMonth ? Number(al.current_month_received_ton) : 0,
    };
  });
  return {
    crew: { id: c.id, name: c.name, manager_agent_id: c.manager_agent_id, budget_ton_month: Number(c.budget_ton_month) || 0 },
    caller_role: role,
    crew_wallet: wallet,
    members,
  };
}

/** List which crews this agent belongs to (helper for tool discovery). */
export async function getAgentCrews(agentId: number, userId: number): Promise<Array<{ id: number; name: string; hasWallet: boolean }>> {
  const r = await pool.query(
    `SELECT id, name, (wallet_address IS NOT NULL) AS has_wallet
       FROM builder_bot.crews
      WHERE user_id = $1 AND $2 = ANY(agent_ids) AND is_active = true
      ORDER BY id`,
    [userId, agentId],
  );
  return r.rows.map((row: any) => ({ id: row.id, name: row.name, hasWallet: !!row.has_wallet }));
}
