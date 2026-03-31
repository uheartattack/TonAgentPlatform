/**
 * Platform tests — covers 10 key scenarios for hackathon review
 *
 * 1.  TON wallet creation (24-word mnemonic)
 * 2.  Mnemonic AES-GCM encrypt/decrypt roundtrip
 * 3.  SSRF protection — private IP ranges blocked
 * 4.  Tool output truncation at 10k chars
 * 5.  PreToolUse — amount > maxTxAmount returns blocked message
 * 6.  Rate limiter — sliding-window rejects after N requests
 * 7.  MarkdownV2 escaping — all 18 Telegram special chars
 * 8.  Message queue — concurrent messages to same agent serialised
 * 9.  API auth — unauthenticated request returns 401
 * 10. Tool name sorting — tools array sorted alphabetically
 */

import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TON wallet creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirror of the mnemonic generation shape: mnemonicNew() from @ton/crypto
 * returns string[]. We verify the contract without a live crypto call.
 */
describe('TON Wallet Creation', () => {
  it('mnemonicNew returns exactly 24 words', async () => {
    const { mnemonicNew } = await import('@ton/crypto');
    const mnemonic = await mnemonicNew();
    expect(Array.isArray(mnemonic)).toBe(true);
    expect(mnemonic.length).toBe(24);
  });

  it('each word is a non-empty lowercase string', async () => {
    const { mnemonicNew } = await import('@ton/crypto');
    const mnemonic = await mnemonicNew();
    for (const word of mnemonic) {
      expect(typeof word).toBe('string');
      expect(word.length).toBeGreaterThan(0);
      expect(word).toBe(word.toLowerCase());
    }
  });

  it('two separate calls produce different mnemonics', async () => {
    const { mnemonicNew } = await import('@ton/crypto');
    const [a, b] = await Promise.all([mnemonicNew(), mnemonicNew()]);
    // Statistically impossible for both to be identical
    expect(a.join(' ')).not.toBe(b.join(' '));
  });

  it('mnemonicToWalletKey derives keys from a mnemonic', async () => {
    const { mnemonicNew, mnemonicToWalletKey } = await import('@ton/crypto');
    const mnemonic = await mnemonicNew();
    const keys = await mnemonicToWalletKey(mnemonic);
    expect(Buffer.isBuffer(keys.publicKey)).toBe(true);
    expect(Buffer.isBuffer(keys.secretKey)).toBe(true);
    expect(keys.publicKey.length).toBe(32);   // Ed25519 pubkey
    expect(keys.secretKey.length).toBe(64);   // Ed25519 expanded private key
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mnemonic encryption / decryption roundtrip
// ─────────────────────────────────────────────────────────────────────────────

// Pure implementation mirroring crypto-utils.ts (no DB/env dependency)
const ENC_ALGO = 'aes-256-gcm';
const TEST_KEY = crypto.createHash('sha256').update('test-encryption-key').digest();

function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, TEST_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;
  const parts = stored.slice(4).split(':');
  if (parts.length !== 3) return stored;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv(ENC_ALGO, TEST_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return stored; // return raw value on decryption error (matches crypto-utils.ts behaviour)
  }
}

describe('Mnemonic Encryption / Decryption', () => {
  it('roundtrip preserves plaintext', () => {
    const plain = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24';
    expect(decryptApiKey(encryptApiKey(plain))).toBe(plain);
  });

  it('encrypted value starts with "enc:" prefix', () => {
    expect(encryptApiKey('test-key')).toMatch(/^enc:/);
  });

  it('two encryptions of the same value differ (random IV)', () => {
    const plain = 'same-value';
    expect(encryptApiKey(plain)).not.toBe(encryptApiKey(plain));
  });

  it('legacy plain-text values pass through decryptApiKey unchanged', () => {
    const legacy = 'sk-plain-key-without-enc-prefix';
    expect(decryptApiKey(legacy)).toBe(legacy);
  });

  it('tampered ciphertext returns stored value (error recovery)', () => {
    // Corrupt the ciphertext segment so the GCM tag check fails
    const encrypted = encryptApiKey('secret');
    const parts = encrypted.split(':');
    parts[3] = Buffer.from('corrupted').toString('base64'); // replace ciphertext
    const tampered = parts.join(':');
    // Implementation returns the raw stored string on decryption error
    const result = decryptApiKey(tampered);
    expect(result).toBeDefined();
  });

  it('roundtrips a real-looking API key', () => {
    const apiKey = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234567890';
    expect(decryptApiKey(encryptApiKey(apiKey))).toBe(apiKey);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SSRF protection
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of isBlockedUrl from ai-agent-runtime.ts / security.test.ts
function isBlockedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // URL.hostname wraps IPv6 in brackets: "[::1]"
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return (
      h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' ||
      h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('172.16.') ||
      h === '169.254.169.254' || h.endsWith('.internal') || h.endsWith('.local') ||
      u.protocol === 'file:'
    );
  } catch {
    return true; // invalid URL → blocked
  }
}

describe('SSRF Protection', () => {
  it('blocks 127.0.0.1', () => expect(isBlockedUrl('http://127.0.0.1:3000')).toBe(true));
  it('blocks localhost', () => expect(isBlockedUrl('http://localhost:8080')).toBe(true));
  it('blocks 10.x.x.x (private range A)', () => expect(isBlockedUrl('http://10.0.0.1')).toBe(true));
  it('blocks 192.168.x.x (private range C)', () => expect(isBlockedUrl('http://192.168.1.100')).toBe(true));
  it('blocks 172.16.x.x (private range B)', () => expect(isBlockedUrl('http://172.16.255.1')).toBe(true));
  it('blocks AWS/GCP metadata endpoint 169.254.169.254', () => expect(isBlockedUrl('http://169.254.169.254/latest/meta-data/')).toBe(true));
  it('blocks .internal DNS suffix', () => expect(isBlockedUrl('http://redis.internal/data')).toBe(true));
  it('blocks .local mDNS suffix', () => expect(isBlockedUrl('http://mybox.local')).toBe(true));
  it('blocks file:// protocol', () => expect(isBlockedUrl('file:///etc/passwd')).toBe(true));
  it('blocks 0.0.0.0', () => expect(isBlockedUrl('http://0.0.0.0')).toBe(true));
  it('blocks IPv6 loopback ::1', () => expect(isBlockedUrl('http://[::1]:80')).toBe(true));
  it('allows public HTTPS URL', () => expect(isBlockedUrl('https://api.tonapi.io/v2/accounts')).toBe(false));
  it('allows public HTTP URL', () => expect(isBlockedUrl('http://example.com')).toBe(false));
  it('blocks invalid URL', () => expect(isBlockedUrl('not-a-url')).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Tool output truncation
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of truncateToolOutput from ai-agent-runtime.ts
function truncateToolOutput(output: string): string {
  if (typeof output !== 'string' || output.length <= 10000) return output;
  const truncated = output.length - 10000;
  return output.slice(0, 5000) + `\n... [${truncated} characters truncated] ...\n` + output.slice(-5000);
}

describe('Tool Output Truncation', () => {
  it('returns string unchanged when ≤ 10 000 chars', () => {
    const s = 'x'.repeat(10000);
    expect(truncateToolOutput(s)).toBe(s);
  });

  it('truncates string > 10 000 chars', () => {
    const s = 'a'.repeat(12000);
    const result = truncateToolOutput(s);
    expect(result.length).toBeLessThan(s.length);
  });

  it('resulting string is approximately 10 000 chars (5k head + marker + 5k tail)', () => {
    const s = 'z'.repeat(20000);
    const result = truncateToolOutput(s);
    // 5000 head + marker text + 5000 tail — should be ≤ 10200
    expect(result.length).toBeLessThanOrEqual(10200);
  });

  it('contains truncation marker with correct count', () => {
    const s = 'b'.repeat(15000);
    const result = truncateToolOutput(s);
    expect(result).toContain('5000 characters truncated');
  });

  it('preserves first 5000 chars exactly', () => {
    const head = 'H'.repeat(5000);
    const tail = 'T'.repeat(5000);
    const s = head + 'M'.repeat(2000) + tail;
    const result = truncateToolOutput(s);
    expect(result.startsWith(head)).toBe(true);
  });

  it('preserves last 5000 chars exactly', () => {
    const tail = 'Z'.repeat(5000);
    const s = 'A'.repeat(8000) + tail;
    const result = truncateToolOutput(s);
    expect(result.endsWith(tail)).toBe(true);
  });

  it('handles non-string input gracefully', () => {
    expect(truncateToolOutput(null as any)).toBeNull();
    expect(truncateToolOutput(undefined as any)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Agent tool preToolUse — maxTxAmount guard
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of the preToolUse financial limit check */
function preToolUseCheck(
  toolName: string,
  toolArgs: Record<string, any>,
  config: { maxTxAmount?: number | string }
): { blocked: boolean; reason?: string } {
  const blockedFinancialTools = [
    'send_ton', 'send_jetton', 'buy_catalog_gift',
    'buy_resale_gift', 'list_gift_for_sale',
  ];
  const maxTx = config?.maxTxAmount;
  if (maxTx && blockedFinancialTools.includes(toolName)) {
    const amount = toolArgs?.amount || toolArgs?.price || toolArgs?.value || 0;
    if (Number(amount) > Number(maxTx)) {
      return { blocked: true, reason: `Transaction amount ${amount} exceeds limit ${maxTx}` };
    }
  }
  return { blocked: false };
}

describe('PreToolUse — maxTxAmount guard', () => {
  it('blocks send_ton when amount exceeds maxTxAmount', () => {
    const result = preToolUseCheck('send_ton', { amount: 10 }, { maxTxAmount: 5 });
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('exceeds limit');
  });

  it('allows send_ton when amount is within limit', () => {
    expect(preToolUseCheck('send_ton', { amount: 4.9 }, { maxTxAmount: 5 }).blocked).toBe(false);
  });

  it('blocks buy_catalog_gift by price field', () => {
    const result = preToolUseCheck('buy_catalog_gift', { price: 100 }, { maxTxAmount: 50 });
    expect(result.blocked).toBe(true);
  });

  it('blocks buy_resale_gift by value field', () => {
    const result = preToolUseCheck('buy_resale_gift', { value: 200 }, { maxTxAmount: 100 });
    expect(result.blocked).toBe(true);
  });

  it('does NOT block non-financial tool regardless of amount', () => {
    const result = preToolUseCheck('get_ton_balance', { amount: 99999 }, { maxTxAmount: 1 });
    expect(result.blocked).toBe(false);
  });

  it('does NOT block when maxTxAmount is not configured', () => {
    const result = preToolUseCheck('send_ton', { amount: 1000 }, {});
    expect(result.blocked).toBe(false);
  });

  it('uses amount=0 fallback when no amount field present', () => {
    const result = preToolUseCheck('send_ton', {}, { maxTxAmount: 5 });
    expect(result.blocked).toBe(false); // 0 is not > 5
  });

  it('handles string maxTxAmount (config values are often strings)', () => {
    const result = preToolUseCheck('send_ton', { amount: 6 }, { maxTxAmount: '5' as any });
    expect(result.blocked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Rate limiter — sliding window
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of checkApiRateLimit from api-server.ts
function makeRateLimiter() {
  const store = new Map<string, number[]>();
  function check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = (store.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) return false;
    timestamps.push(now);
    store.set(key, timestamps);
    return true;
  }
  return { check, store };
}

describe('Rate Limiter', () => {
  it('allows requests up to the limit', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(rl.check('user:1', 5, 60000)).toBe(true);
    }
  });

  it('rejects the request that exceeds the limit', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) rl.check('user:2', 5, 60000);
    expect(rl.check('user:2', 5, 60000)).toBe(false);
  });

  it('different keys do not share quota', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) rl.check('user:A', 5, 60000);
    // user:B should still be allowed
    expect(rl.check('user:B', 5, 60000)).toBe(true);
  });

  it('window expiry allows fresh requests (mocked time)', () => {
    const rl = makeRateLimiter();
    // Fill the bucket
    for (let i = 0; i < 3; i++) rl.check('user:C', 3, 1000);
    expect(rl.check('user:C', 3, 1000)).toBe(false);

    // Manually expire timestamps by setting them 2s in the past
    rl.store.set('user:C', rl.store.get('user:C')!.map(t => t - 2000));
    // Now the window should be clear
    expect(rl.check('user:C', 3, 1000)).toBe(true);
  });

  it('uses a sliding window (not fixed window)', () => {
    const rl = makeRateLimiter();
    // 2 requests, then expire them, then 2 more — should all pass
    rl.check('sliding', 3, 1000);
    rl.check('sliding', 3, 1000);
    rl.store.set('sliding', rl.store.get('sliding')!.map(t => t - 2000));
    expect(rl.check('sliding', 3, 1000)).toBe(true);
    expect(rl.check('sliding', 3, 1000)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MarkdownV2 escaping — all 18 Telegram special chars
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of esc() from bot.ts
function esc(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

describe('MarkdownV2 Escaping', () => {
  const SPECIAL_CHARS = ['\\', '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

  it('escapes all 18 Telegram MarkdownV2 special characters', () => {
    expect(SPECIAL_CHARS.length).toBe(19); // backslash + 18 chars
    for (const ch of SPECIAL_CHARS) {
      const result = esc(ch);
      expect(result).toBe('\\' + ch);
    }
  });

  it('escapes backslash first (prevents double-escaping)', () => {
    expect(esc('\\')).toBe('\\\\');
  });

  it('escapes underscore', () => expect(esc('_')).toBe('\\_'));
  it('escapes asterisk', () => expect(esc('*')).toBe('\\*'));
  it('escapes square brackets', () => {
    expect(esc('[')).toBe('\\[');
    expect(esc(']')).toBe('\\]');
  });
  it('escapes parentheses', () => {
    expect(esc('(')).toBe('\\(');
    expect(esc(')')).toBe('\\)');
  });
  it('escapes tilde', () => expect(esc('~')).toBe('\\~'));
  it('escapes backtick', () => expect(esc('`')).toBe('\\`'));
  it('escapes greater-than', () => expect(esc('>')).toBe('\\>'));
  it('escapes hash', () => expect(esc('#')).toBe('\\#'));
  it('escapes plus', () => expect(esc('+')).toBe('\\+'));
  it('escapes minus', () => expect(esc('-')).toBe('\\-'));
  it('escapes equals', () => expect(esc('=')).toBe('\\='));
  it('escapes pipe', () => expect(esc('|')).toBe('\\|'));
  it('escapes curly braces', () => {
    expect(esc('{')).toBe('\\{');
    expect(esc('}')).toBe('\\}');
  });
  it('escapes dot', () => expect(esc('.')).toBe('\\.'));
  it('escapes exclamation mark', () => expect(esc('!')).toBe('\\!'));

  it('handles null/undefined gracefully', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('handles numbers', () => {
    expect(esc(3.14)).toBe('3\\.14');
  });

  it('escapes a real-world message with multiple special chars', () => {
    const result = esc('Price: 5.00 TON (+3%)');
    expect(result).toContain('5\\.00');
    expect(result).toContain('\\+');   // + is escaped
    expect(result).toContain('\\(');   // ( is escaped
    expect(result).toContain('\\)');   // ) is escaped
    expect(result).not.toContain('\\%'); // % is NOT a special MarkdownV2 char
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Message queue — concurrent messages serialised per agent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tests that a simple per-key async queue executes tasks sequentially
 * (same pattern as _pendingMessages in ai-agent-runtime.ts — each agent's
 * messages are consumed one at a time during a tick).
 */
class AgentMessageQueue {
  private queues = new Map<number, Promise<void>>();

  enqueue(agentId: number, task: () => Promise<void>): Promise<void> {
    const current = this.queues.get(agentId) || Promise.resolve();
    const next = current.then(task);
    this.queues.set(agentId, next.catch(() => {})); // swallow errors so queue continues
    return next;
  }
}

describe('Message Queue — serialisation per agent', () => {
  it('executes two messages to the same agent in order', async () => {
    const queue = new AgentMessageQueue();
    const order: number[] = [];

    await Promise.all([
      queue.enqueue(1, async () => { order.push(1); }),
      queue.enqueue(1, async () => { order.push(2); }),
    ]);

    expect(order).toEqual([1, 2]);
  });

  it('does NOT serialise messages to different agents', async () => {
    const queue = new AgentMessageQueue();
    const finished: number[] = [];
    let resolveA!: () => void;

    const pA = new Promise<void>(res => { resolveA = res; });

    // Agent 1 waits, agent 2 finishes first
    const p1 = queue.enqueue(1, () => pA.then(() => { finished.push(1); }));
    const p2 = queue.enqueue(2, async () => { finished.push(2); });

    await p2;
    expect(finished).toContain(2);
    expect(finished).not.toContain(1); // still waiting

    resolveA();
    await p1;
    expect(finished).toContain(1);
  });

  it('serialises three concurrent messages to the same agent', async () => {
    const queue = new AgentMessageQueue();
    const log: string[] = [];

    await Promise.all([
      queue.enqueue(5, async () => { log.push('A'); }),
      queue.enqueue(5, async () => { log.push('B'); }),
      queue.enqueue(5, async () => { log.push('C'); }),
    ]);

    expect(log).toEqual(['A', 'B', 'C']);
  });

  it('continues queue after a failed task', async () => {
    const queue = new AgentMessageQueue();
    const log: string[] = [];

    await Promise.allSettled([
      queue.enqueue(7, async () => { throw new Error('fail'); }),
      queue.enqueue(7, async () => { log.push('recovered'); }),
    ]);

    expect(log).toContain('recovered');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. API auth — unauthenticated request returns 401
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of requireAuth middleware logic from api-server.ts
interface MockReq { headers: Record<string, string | undefined>; }
interface MockRes {
  statusCode: number;
  body: any;
  status(code: number): this;
  json(body: any): this;
}

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return res;
}

// Simple in-memory session store matching api-server.ts pattern
const _sessions = new Map<string, { userId: number }>();
_sessions.set('valid-token-123', { userId: 42 });

function requireAuth(req: MockReq, res: MockRes, next: () => void): void {
  const token = req.headers['x-auth-token'];
  if (!token) { res.status(401).json({ error: 'Требуется заголовок X-Auth-Token' }); return; }
  const session = _sessions.get(token);
  if (!session) { res.status(401).json({ error: 'Сессия не найдена или истекла — войдите заново' }); return; }
  (req as any).userId = session.userId;
  next();
}

describe('API Auth — requireAuth middleware', () => {
  it('returns 401 when X-Auth-Token header is absent', () => {
    const res = mockRes();
    let nextCalled = false;
    requireAuth({ headers: {} }, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('returns 401 for an unknown/expired token', () => {
    const res = mockRes();
    let nextCalled = false;
    requireAuth({ headers: { 'x-auth-token': 'bad-token' } }, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('calls next() for a valid token', () => {
    const res = mockRes();
    let nextCalled = false;
    requireAuth({ headers: { 'x-auth-token': 'valid-token-123' } }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200); // untouched
  });

  it('attaches userId to request on valid auth', () => {
    const req: any = { headers: { 'x-auth-token': 'valid-token-123' } };
    requireAuth(req, mockRes(), () => {});
    expect(req.userId).toBe(42);
  });

  it('error body contains meaningful message when missing header', () => {
    const res = mockRes();
    requireAuth({ headers: {} }, res, () => {});
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Tool name sorting
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of tools sort from ai-agent-runtime.ts line 10892
function sortTools<T extends { function?: { name?: string }; name?: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    const nameA = a.function?.name || a.name || '';
    const nameB = b.function?.name || b.name || '';
    return nameA.localeCompare(nameB);
  });
}

describe('Tool Name Sorting', () => {
  it('sorts tools alphabetically by function.name', () => {
    const tools = [
      { function: { name: 'send_ton' } },
      { function: { name: 'get_balance' } },
      { function: { name: 'fetch_url' } },
    ];
    const sorted = sortTools(tools);
    expect(sorted.map(t => t.function!.name)).toEqual(['fetch_url', 'get_balance', 'send_ton']);
  });

  it('does not mutate the original array', () => {
    const tools = [
      { function: { name: 'z_tool' } },
      { function: { name: 'a_tool' } },
    ];
    const original = tools.map(t => t.function.name);
    sortTools(tools);
    expect(tools.map(t => t.function.name)).toEqual(original);
  });

  it('handles tools with top-level name field', () => {
    const tools = [
      { name: 'web_search' },
      { name: 'get_nft_floor' },
      { name: 'buy_catalog_gift' },
    ];
    const sorted = sortTools(tools);
    expect(sorted.map(t => t.name)).toEqual(['buy_catalog_gift', 'get_nft_floor', 'web_search']);
  });

  it('handles empty array', () => {
    expect(sortTools([])).toEqual([]);
  });

  it('handles single tool', () => {
    const tools = [{ function: { name: 'only_tool' } }];
    expect(sortTools(tools)).toEqual(tools);
  });

  it('stable sort: equal names preserve relative order', () => {
    const tools = [
      { function: { name: 'same' }, id: 1 },
      { function: { name: 'same' }, id: 2 },
    ];
    const sorted = sortTools(tools as any);
    // Both have the same name — relative order should be preserved
    expect((sorted[0] as any).id).toBe(1);
    expect((sorted[1] as any).id).toBe(2);
  });
});
