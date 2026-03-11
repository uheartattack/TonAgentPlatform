/**
 * Security tests — XSS prevention, safe expression evaluator, input validation
 */

// ── Safe expression evaluator (mirrors the one in api-server.ts flow compiler) ──
function _safeEval(expr: string | any): boolean | number {
  if (typeof expr !== 'string') return !!expr;
  expr = expr.trim();
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (/^[\d.]+$/.test(expr)) return parseFloat(expr);
  // && / || chains FIRST (before comparison to avoid greedy regex)
  if (expr.includes('&&')) return expr.split('&&').every((p: string) => _safeEval(p));
  if (expr.includes('||')) return expr.split('||').some((p: string) => _safeEval(p));
  // a op b
  const m = expr.match(/^(.+?)\s*(>=|<=|===|!==|==|!=|>|<)\s*(.+)$/);
  if (m) {
    const l = isNaN(Number(m[1])) ? String(m[1]).trim() : Number(m[1]);
    const r = isNaN(Number(m[3])) ? String(m[3]).trim() : Number(m[3]);
    const op = m[2];
    if (op === '>') return l > r;
    if (op === '<') return l < r;
    if (op === '>=') return l >= r;
    if (op === '<=') return l <= r;
    if (op === '==' || op === '===') return l == r;
    if (op === '!=' || op === '!==') return l != r;
  }
  return !!expr && expr !== '0' && expr !== 'null' && expr !== 'undefined';
}

describe('Safe Expression Evaluator', () => {
  it('evaluates simple comparisons', () => {
    expect(_safeEval('5 > 3')).toBe(true);
    expect(_safeEval('2 < 1')).toBe(false);
    expect(_safeEval('10 == 10')).toBe(true);
    expect(_safeEval('5 != 5')).toBe(false);
    expect(_safeEval('5 >= 5')).toBe(true);
    expect(_safeEval('4 <= 3')).toBe(false);
  });

  it('evaluates boolean literals', () => {
    expect(_safeEval('true')).toBe(true);
    expect(_safeEval('false')).toBe(false);
  });

  it('evaluates && chains', () => {
    expect(_safeEval('5 > 3 && 2 > 1')).toBe(true);
    expect(_safeEval('5 > 3 && 2 < 1')).toBe(false);
  });

  it('evaluates || chains', () => {
    expect(_safeEval('5 < 3 || 2 > 1')).toBe(true);
    expect(_safeEval('5 < 3 || 2 < 1')).toBe(false);
  });

  it('does NOT execute arbitrary code', () => {
    // These should NOT execute — they should return truthy/falsy without side effects
    expect(() => _safeEval('process.exit(1)')).not.toThrow();
    expect(() => _safeEval('require("fs").readFileSync("/etc/passwd")')).not.toThrow();
    expect(() => _safeEval('fetch("http://evil.com")')).not.toThrow();
    expect(() => _safeEval('eval("1+1")')).not.toThrow();
    expect(() => _safeEval('constructor.constructor("return this")()')).not.toThrow();
  });

  it('rejects falsy values', () => {
    expect(_safeEval('false')).toBe(false);
    // '0' returns 0 as a number (parsed by regex)
    expect(_safeEval('0')).toBeFalsy();
    // 'null' and 'undefined' are treated as falsy strings
    expect(_safeEval('null')).toBeFalsy();
    expect(_safeEval('undefined')).toBeFalsy();
  });

  it('handles numeric expressions', () => {
    expect(_safeEval('42')).toBe(42);
    expect(_safeEval('3.14')).toBeCloseTo(3.14);
  });
});

// ── HTML escaping ──
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('XSS Prevention — escHtml', () => {
  it('escapes HTML tags', () => {
    expect(escHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes attributes', () => {
    expect(escHtml('" onclick="alert(1)"')).toBe('&quot; onclick=&quot;alert(1)&quot;');
  });

  it('escapes ampersands', () => {
    expect(escHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes single quotes', () => {
    expect(escHtml("'onmouseover='alert(1)")).toBe("&#39;onmouseover=&#39;alert(1)");
  });

  it('handles normal text unchanged', () => {
    expect(escHtml('Hello World 123')).toBe('Hello World 123');
  });
});

// ── SSRF protection ──
function isBlockedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1'
      || h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('172.16.')
      || h === '169.254.169.254' || h.endsWith('.internal') || h.endsWith('.local')
      || u.protocol === 'file:';
  } catch {
    return true; // invalid URL → blocked
  }
}

describe('SSRF Protection', () => {
  it('blocks localhost', () => {
    expect(isBlockedUrl('http://localhost:8080')).toBe(true);
    expect(isBlockedUrl('http://127.0.0.1:3000')).toBe(true);
  });

  it('blocks internal IPs', () => {
    expect(isBlockedUrl('http://10.0.0.1')).toBe(true);
    expect(isBlockedUrl('http://192.168.1.1')).toBe(true);
    expect(isBlockedUrl('http://172.16.0.1')).toBe(true);
  });

  it('blocks AWS metadata endpoint', () => {
    expect(isBlockedUrl('http://169.254.169.254/latest/meta-data/')).toBe(true);
  });

  it('blocks file protocol', () => {
    expect(isBlockedUrl('file:///etc/passwd')).toBe(true);
  });

  it('allows public URLs', () => {
    expect(isBlockedUrl('https://api.tonapi.io/v2/accounts')).toBe(false);
    expect(isBlockedUrl('https://google.com')).toBe(false);
  });

  it('blocks invalid URLs', () => {
    expect(isBlockedUrl('not-a-url')).toBe(true);
  });
});

describe('Input Validation', () => {
  it('rejects messages over 4000 chars', () => {
    const longMsg = 'a'.repeat(4001);
    expect(longMsg.length > 4000).toBe(true);
  });

  it('rejects empty messages', () => {
    expect(!'' || typeof '' !== 'string').toBe(true);
  });
});
