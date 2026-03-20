import { Pool } from 'pg';

let _pool: Pool | null = null;
const TONAPI_BASE = 'https://tonapi.io/v2';

export function initTonDNS(pool: Pool) {
  _pool = pool;
  pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.agent_domains (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      resolved_address TEXT,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      status TEXT DEFAULT 'claimed'
    );
    CREATE INDEX IF NOT EXISTS idx_agent_domains_domain ON builder_bot.agent_domains(domain);
    CREATE INDEX IF NOT EXISTS idx_agent_domains_user ON builder_bot.agent_domains(user_id);
  `).catch(e => console.warn('[TonDNS] Migration error:', e.message));
}

/** Resolve a .ton domain to wallet address via TonAPI */
export async function resolveDomain(domain: string): Promise<{ ok: boolean; address?: string; error?: string }> {
  try {
    const clean = domain.replace(/\.ton$/i, '');
    const tonapiKey = process.env.TONAPI_KEY || '';
    const headers: Record<string, string> = {};
    if (tonapiKey) headers['Authorization'] = `Bearer ${tonapiKey}`;

    const resp = await fetch(`${TONAPI_BASE}/dns/${encodeURIComponent(clean + '.ton')}/resolve`, {
      headers, signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
      if (resp.status === 404) return { ok: false, error: 'Domain not found' };
      return { ok: false, error: `TonAPI ${resp.status}` };
    }
    const data = await resp.json() as any;
    const addr = data?.wallet?.address || data?.records?.wallet || null;
    return { ok: true, address: addr || 'no wallet record' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Get full DNS records for a .ton domain */
export async function getDomainInfo(domain: string): Promise<any> {
  try {
    const clean = domain.replace(/\.ton$/i, '');
    const tonapiKey = process.env.TONAPI_KEY || '';
    const headers: Record<string, string> = {};
    if (tonapiKey) headers['Authorization'] = `Bearer ${tonapiKey}`;

    const resp = await fetch(`${TONAPI_BASE}/dns/${encodeURIComponent(clean + '.ton')}/resolve`, {
      headers, signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) return { ok: false, error: `Status ${resp.status}` };
    return { ok: true, data: await resp.json() };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Check if .ton domain is available (not registered on-chain) */
export async function checkDomainAvailable(domain: string): Promise<{ available: boolean; error?: string }> {
  const result = await resolveDomain(domain);
  if (result.error === 'Domain not found') return { available: true };
  if (result.ok) return { available: false };
  return { available: false, error: result.error };
}

/** Claim a .ton domain for an agent in our DB */
export async function claimAgentDomain(agentId: number, userId: number, domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!_pool) return { ok: false, error: 'DB not initialized' };

  const clean = domain.replace(/\.ton$/i, '').toLowerCase();
  if (!/^[a-z0-9-]{3,126}$/.test(clean)) {
    return { ok: false, error: 'Invalid domain. Use 3-126 chars: a-z, 0-9, hyphens.' };
  }

  try {
    const existing = await _pool.query('SELECT agent_id FROM builder_bot.agent_domains WHERE domain=$1', [clean + '.ton']);
    if (existing.rows.length) {
      if (existing.rows[0].agent_id === agentId) return { ok: true };
      return { ok: false, error: 'Domain already claimed by another agent' };
    }

    const agentDomain = await _pool.query('SELECT domain FROM builder_bot.agent_domains WHERE agent_id=$1', [agentId]);
    if (agentDomain.rows.length) {
      return { ok: false, error: `Agent already has domain: ${agentDomain.rows[0].domain}` };
    }

    await _pool.query(
      'INSERT INTO builder_bot.agent_domains (agent_id, user_id, domain, status) VALUES ($1,$2,$3,$4)',
      [agentId, userId, clean + '.ton', 'claimed']
    );
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Find agent by its .ton domain */
export async function getAgentByDomain(domain: string): Promise<{ agentId: number; userId: number } | null> {
  if (!_pool) return null;
  const clean = domain.replace(/\.ton$/i, '').toLowerCase() + '.ton';
  const res = await _pool.query('SELECT agent_id, user_id FROM builder_bot.agent_domains WHERE domain=$1', [clean]);
  return res.rows[0] ? { agentId: res.rows[0].agent_id, userId: res.rows[0].user_id } : null;
}

/** Get domain claimed by an agent */
export async function getAgentDomain(agentId: number): Promise<string | null> {
  if (!_pool) return null;
  const res = await _pool.query('SELECT domain FROM builder_bot.agent_domains WHERE agent_id=$1', [agentId]);
  return res.rows[0]?.domain || null;
}

/** List all domains for a user */
export async function getUserDomains(userId: number): Promise<Array<{ agentId: number; domain: string; status: string }>> {
  if (!_pool) return [];
  const res = await _pool.query('SELECT agent_id, domain, status FROM builder_bot.agent_domains WHERE user_id=$1 ORDER BY registered_at DESC', [userId]);
  return res.rows.map(r => ({ agentId: r.agent_id, domain: r.domain, status: r.status }));
}

/** Release a domain claim */
export async function releaseDomain(agentId: number, userId: number): Promise<boolean> {
  if (!_pool) return false;
  const res = await _pool.query('DELETE FROM builder_bot.agent_domains WHERE agent_id=$1 AND user_id=$2', [agentId, userId]);
  return (res.rowCount || 0) > 0;
}
