require('dotenv').config();
console.log('SWIFTGIFTS_API_KEY:', process.env.SWIFTGIFTS_API_KEY ? `present (${process.env.SWIFTGIFTS_API_KEY.slice(0,10)}...)` : 'MISSING');

(async () => {
  const key = process.env.SWIFTGIFTS_API_KEY;
  if (!key) { console.log('No key — abort'); return; }
  const r = await fetch('https://partners.swiftgifts.tg/api/aggregator?page=0', {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Hex Pot',
      model: 'All', symbol: 'All', backdrop: 'All',
      number: null, from_price: null, to_price: 5,
      market: ['portals'], receiver: 130806013,
    }),
  });
  const j = await r.json();
  console.log('status:', r.status, 'total:', j.total, 'items:', (j.items || []).length);
  if (j.error) console.log('error:', j.error);
})().catch(e => console.error('ERR:', e.message));
