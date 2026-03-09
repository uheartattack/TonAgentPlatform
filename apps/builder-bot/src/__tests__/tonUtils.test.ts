/**
 * Tests for TON blockchain utilities:
 * - Address validation and conversion
 * - Amount formatting (nanoTON ↔ TON)
 * - Transaction hash validation
 */

// ── Pure utility functions ──────────────────────────────────────────────────

/** Convert TON to nanoTON (1 TON = 1_000_000_000 nano) */
function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * 1_000_000_000));
}

/** Convert nanoTON to TON, rounded to 4 decimal places */
function nanoToTon(nano: bigint | number): number {
  const n = typeof nano === 'bigint' ? Number(nano) : nano;
  return Math.round((n / 1_000_000_000) * 10_000) / 10_000;
}

/** Check if a TON address looks valid (EQ.../UQ.../0:hex format) */
function isValidTonAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  const trimmed = addr.trim();
  // EQ/UQ base64url format (48 chars after prefix)
  if (/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(trimmed)) return true;
  // Raw 0:hex format
  if (/^0:[0-9a-fA-F]{64}$/.test(trimmed)) return true;
  return false;
}

/** Format TON amount for display */
function formatTon(amount: number, decimals = 2): string {
  return amount.toFixed(decimals) + ' TON';
}

/** Check if a tx hash looks valid (64 hex chars) */
function isValidTxHash(hash: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(hash || '');
}

/** Calculate withdrawal fee (platform takes 0.05 TON for network fee) */
const WITHDRAWAL_FEE_TON = 0.05;
function calcWithdrawalAmount(requestedTon: number): { send: number; fee: number; total: number } {
  return {
    send: requestedTon,
    fee: WITHDRAWAL_FEE_TON,
    total: requestedTon + WITHDRAWAL_FEE_TON,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('tonToNano / nanoToTon', () => {
  it('converts 1 TON → 1_000_000_000 nano', () => {
    expect(tonToNano(1)).toBe(1_000_000_000n);
  });

  it('converts 0.1 TON → 100_000_000 nano', () => {
    expect(tonToNano(0.1)).toBe(100_000_000n);
  });

  it('converts 5 TON → 5_000_000_000 nano', () => {
    expect(tonToNano(5)).toBe(5_000_000_000n);
  });

  it('round-trips TON → nano → TON', () => {
    const original = 12.3456;
    const back = nanoToTon(tonToNano(original));
    expect(back).toBeCloseTo(original, 3);
  });

  it('converts 1_000_000_000 nano → 1 TON', () => {
    expect(nanoToTon(1_000_000_000n)).toBe(1);
  });

  it('converts 500_000_000 nano → 0.5 TON', () => {
    expect(nanoToTon(500_000_000)).toBe(0.5);
  });
});

describe('isValidTonAddress', () => {
  it('validates EQ... address', () => {
    expect(isValidTonAddress('EQAo92DYMokxghKcq-CkCGSk_MgXY5Fo1SPW20gkvZl75iCN')).toBe(true);
  });

  it('validates UQ... address', () => {
    expect(isValidTonAddress('UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh')).toBe(true);
  });

  it('validates raw 0:hex address', () => {
    expect(isValidTonAddress('0:9dd1dfc276588412f79b64e4d659d8427d61add13014125c30133c17d3c99044')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidTonAddress('')).toBe(false);
  });

  it('rejects too-short EQ address', () => {
    expect(isValidTonAddress('EQshort')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isValidTonAddress('not-an-address')).toBe(false);
  });

  it('rejects null/undefined gracefully', () => {
    expect(isValidTonAddress(null as any)).toBe(false);
    expect(isValidTonAddress(undefined as any)).toBe(false);
  });
});

describe('formatTon', () => {
  it('formats with 2 decimal places by default', () => {
    expect(formatTon(5)).toBe('5.00 TON');
    expect(formatTon(12.3456)).toBe('12.35 TON');
  });

  it('formats with custom decimals', () => {
    expect(formatTon(5.1, 4)).toBe('5.1000 TON');
  });
});

describe('isValidTxHash', () => {
  it('validates 64-char hex hash', () => {
    const hash = 'a'.repeat(64);
    expect(isValidTxHash(hash)).toBe(true);
  });

  it('rejects short hash', () => {
    expect(isValidTxHash('abc123')).toBe(false);
  });

  it('rejects hash with special chars', () => {
    expect(isValidTxHash('g'.repeat(64))).toBe(false); // 'g' not hex
  });

  it('rejects empty string', () => {
    expect(isValidTxHash('')).toBe(false);
  });
});

describe('calcWithdrawalAmount', () => {
  it('adds platform fee to withdrawal', () => {
    const result = calcWithdrawalAmount(5);
    expect(result.send).toBe(5);
    expect(result.fee).toBe(0.05);
    expect(result.total).toBeCloseTo(5.05, 2);
  });

  it('fee is always 0.05 TON', () => {
    expect(calcWithdrawalAmount(100).fee).toBe(0.05);
    expect(calcWithdrawalAmount(0.1).fee).toBe(0.05);
  });
});
