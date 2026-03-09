/**
 * Tests for gift rarity and arbitrage utilities.
 * These are pure functions that don't require external dependencies.
 */

// ── Pure utility functions extracted for testing ─────────────────────────

/** Parse rarity percentage from GiftAsset API (e.g. "2%" → 2, "0.5%" → 0.5) */
function parseRarityPct(r: any): number {
  if (!r) return 100;
  const n = parseFloat(String(r).replace('%', ''));
  return isNaN(n) ? 100 : n;
}

/** Check if a gift is considered "rare" based on backdrop rarity */
function isRareBackdrop(rarityStr: string): boolean {
  return parseRarityPct(rarityStr) <= 2;
}

/** Check if a gift model is considered "ultra-rare" */
function isUltraRareModel(rarityStr: string): boolean {
  return parseRarityPct(rarityStr) <= 1;
}

/** Calculate expected profit % for an arbitrage opportunity */
function calcProfitPct(buyPrice: number, sellPrice: number, fee = 0.05): number {
  if (buyPrice <= 0) return 0;
  return ((sellPrice - buyPrice - fee) / buyPrice) * 100;
}

/** Sort gifts by rarity (rarest first = lowest %) */
function sortByRarity(gifts: Array<{ backdrop_rarity_pct: string }>): typeof gifts {
  return [...gifts].sort((a, b) =>
    parseRarityPct(a.backdrop_rarity_pct) - parseRarityPct(b.backdrop_rarity_pct)
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('parseRarityPct', () => {
  it('parses "2%" → 2', () => expect(parseRarityPct('2%')).toBe(2));
  it('parses "0.5%" → 0.5', () => expect(parseRarityPct('0.5%')).toBe(0.5));
  it('parses "10%" → 10', () => expect(parseRarityPct('10%')).toBe(10));
  it('returns 100 for null', () => expect(parseRarityPct(null)).toBe(100));
  it('returns 100 for undefined', () => expect(parseRarityPct(undefined)).toBe(100));
  it('returns 100 for invalid string', () => expect(parseRarityPct('N/A')).toBe(100));
  it('parses numeric value without %', () => expect(parseRarityPct(5)).toBe(5));
});

describe('isRareBackdrop', () => {
  it('returns true for ≤2% rarity', () => {
    expect(isRareBackdrop('2%')).toBe(true);
    expect(isRareBackdrop('1%')).toBe(true);
    expect(isRareBackdrop('0.5%')).toBe(true);
  });

  it('returns false for >2% rarity (common)', () => {
    expect(isRareBackdrop('3%')).toBe(false);
    expect(isRareBackdrop('10%')).toBe(false);
    expect(isRareBackdrop('50%')).toBe(false);
  });

  it('returns false for missing rarity (treated as 100%)', () => {
    expect(isRareBackdrop('')).toBe(false);
  });
});

describe('isUltraRareModel', () => {
  it('returns true for ≤1% model rarity', () => {
    expect(isUltraRareModel('0.5%')).toBe(true);
    expect(isUltraRareModel('1%')).toBe(true);
  });

  it('returns false for >1% (not ultra-rare)', () => {
    expect(isUltraRareModel('1.1%')).toBe(false);
    expect(isUltraRareModel('5%')).toBe(false);
  });
});

describe('calcProfitPct', () => {
  it('calculates correct profit for basic arbitrage', () => {
    // Buy 4 TON, sell 5 TON, fee 0.05 → (5 - 4 - 0.05) / 4 * 100 = 23.75%
    expect(calcProfitPct(4, 5)).toBeCloseTo(23.75, 1);
  });

  it('returns 0 for zero buy price', () => {
    expect(calcProfitPct(0, 5)).toBe(0);
  });

  it('returns negative for unprofitable trades', () => {
    // Buy 5 TON, sell 4 TON → loss
    expect(calcProfitPct(5, 4)).toBeLessThan(0);
  });

  it('accounts for network fee', () => {
    const withFee = calcProfitPct(10, 11, 0.05);
    const noFee = calcProfitPct(10, 11, 0);
    expect(withFee).toBeLessThan(noFee);
  });

  it('5% spread is worth reporting (above threshold)', () => {
    // Example: buy 20 TON, sell 21.1 TON → ~5% after fee
    const profit = calcProfitPct(20, 21.1);
    expect(profit).toBeGreaterThan(5);
  });
});

describe('sortByRarity', () => {
  it('sorts rarest items first (lowest %)', () => {
    const gifts = [
      { backdrop_rarity_pct: '10%' },
      { backdrop_rarity_pct: '2%' },
      { backdrop_rarity_pct: '0.5%' },
      { backdrop_rarity_pct: '5%' },
    ];
    const sorted = sortByRarity(gifts);
    expect(sorted[0].backdrop_rarity_pct).toBe('0.5%');
    expect(sorted[1].backdrop_rarity_pct).toBe('2%');
    expect(sorted[2].backdrop_rarity_pct).toBe('5%');
    expect(sorted[3].backdrop_rarity_pct).toBe('10%');
  });

  it('does not mutate original array', () => {
    const gifts = [{ backdrop_rarity_pct: '5%' }, { backdrop_rarity_pct: '1%' }];
    const original = [...gifts];
    sortByRarity(gifts);
    expect(gifts).toEqual(original);
  });

  it('treats missing rarity as 100% (last in sort)', () => {
    const gifts = [
      { backdrop_rarity_pct: '' },
      { backdrop_rarity_pct: '2%' },
    ];
    const sorted = sortByRarity(gifts);
    expect(sorted[0].backdrop_rarity_pct).toBe('2%');
    expect(sorted[1].backdrop_rarity_pct).toBe('');
  });
});
