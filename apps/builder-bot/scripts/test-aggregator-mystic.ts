import { getGiftAssetClient } from '../src/services/giftasset';

(async () => {
  const ga = getGiftAssetClient();

  console.log('=== Test 1: backdrop-only, all markets ===');
  const r1 = await ga.aggregate({
    name: '',
    backdrop: 'Mystic Pearl',
    toPrice: 5,
    market: ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'],
  }).catch((e: any) => ({ items: [], total: 0, error: e.message }));
  console.log('total:', r1.total, 'items:', (r1.items || []).length, (r1 as any).error || '');
  for (const it of (r1.items || []).slice(0, 5)) {
    console.log(' ', it.provider, it.title || it.name, it.price_ton, 'TON', 'bg=', it.backdrop, 'buy=', it.can_buy_now);
  }

  console.log('\n=== Test 2: backdrop-only, no price limit ===');
  const r2 = await ga.aggregate({
    name: '',
    backdrop: 'Mystic Pearl',
    market: ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'],
  }).catch((e: any) => ({ items: [], total: 0, error: e.message }));
  console.log('total:', r2.total, 'items:', (r2.items || []).length);
  for (const it of (r2.items || []).slice(0, 5)) {
    console.log(' ', it.provider, it.title || it.name, it.price_ton, 'TON', 'bg=', it.backdrop);
  }

  console.log('\n=== Test 3: no filters at all, up to 5 TON ===');
  const r3 = await ga.aggregate({
    name: '',
    toPrice: 5,
    market: ['tonnel', 'portals', 'Mrkt', 'getgems', 'fragment'],
  }).catch((e: any) => ({ items: [], total: 0, error: e.message }));
  console.log('total:', r3.total, 'items:', (r3.items || []).length);
  for (const it of (r3.items || []).slice(0, 3)) {
    console.log(' ', it.provider, it.title || it.name, it.price_ton, 'TON', 'bg=', it.backdrop);
  }

  console.log('\n=== Test 4: backdrop=Mystic Pearl on Portals only, no limit ===');
  const r4 = await ga.aggregate({
    name: '',
    backdrop: 'Mystic Pearl',
    market: ['portals'],
  }).catch((e: any) => ({ items: [], total: 0, error: e.message }));
  console.log('total:', r4.total, 'items:', (r4.items || []).length);
  for (const it of (r4.items || []).slice(0, 3)) {
    console.log(' ', it.provider, it.title || it.name, it.price_ton, 'TON', 'bg=', it.backdrop);
  }

  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
