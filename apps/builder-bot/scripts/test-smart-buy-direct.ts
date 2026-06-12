import { getGiftAssetClient } from '../src/services/giftasset';

(async () => {
  const ga = getGiftAssetClient();
  const tgId = 130806013;

  console.log('=== Test: Hex Pot on portals, to_price=5, receiver=real ===');
  try {
    const r = await ga.swAggregate({
      name: 'Hex Pot',
      model: 'All',
      symbol: 'All',
      backdrop: 'All',
      number: null,
      fromPrice: null,
      toPrice: 5,
      market: ['portals'],
      receiver: tgId,
    });
    console.log('ok total:', r.total, 'items:', (r.items || []).length);
    if ((r.items || []).length > 0) {
      const it = r.items[0];
      console.log('first item:', it.provider, it.title, it.price, 'TON');
    }
  } catch (e: any) {
    console.log('ERROR:', e.message);
  }

  console.log('\n=== Test: Hex Pot on all markets ===');
  try {
    const r = await ga.swAggregate({
      name: 'Hex Pot',
      model: 'All',
      symbol: 'All',
      backdrop: 'All',
      number: null,
      fromPrice: null,
      toPrice: 5,
      market: ['tonnel', 'portals', 'Mrkt'],
      receiver: tgId,
    });
    console.log('ok total:', r.total, 'items:', (r.items || []).length);
  } catch (e: any) {
    console.log('ERROR:', e.message);
  }

  console.log('\n=== Test: Mystic Pearl on all markets, probing 5 names ===');
  const names = ['Hex Pot', 'Plush Pepe', 'Lol Pop', 'Jelly Bunny', 'Durov\'s Cap'];
  for (const n of names) {
    try {
      const r = await ga.swAggregate({
        name: n,
        model: 'All',
        symbol: 'All',
        backdrop: 'Mystic Pearl',
        number: null,
        fromPrice: null,
        toPrice: 5,
        market: ['tonnel', 'portals', 'Mrkt'],
        receiver: tgId,
      });
      console.log(` ${n}: total=${r.total} items=${(r.items || []).length}`);
    } catch (e: any) {
      console.log(` ${n}: ERR ${e.message.slice(0, 100)}`);
    }
  }

  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
