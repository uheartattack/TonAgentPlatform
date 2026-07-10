// Читает on-chain историю агент-NFT и реконструирует события (mint/transfer).
// Это «мозг» off-chain индексера — проверяем на живых testnet-данных.
const { TonClient, Address } = require('@ton/ton');

const AGENT = process.env.AGENT || '0QARCFv5XMGyOUmxkUNPtIbaKInDWK0dlU1iFxSo_yRcHvwA';
const OP_TRANSFER = 0x5fcc3d14;
const fmt = (a) => (a ? a.toString({ testOnly: true, bounceable: false }) : 'external');

(async () => {
  const c = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
  const a = Address.parse(AGENT);
  const txs = await c.getTransactions(a, { limit: 20 });

  const events = [];
  for (const tx of [...txs].reverse()) { // oldest → newest
    const inMsg = tx.inMessage;
    if (!inMsg) continue;
    const src = inMsg.info && inMsg.info.src ? fmt(inMsg.info.src) : 'external';
    let label = 'other';
    try {
      const body = inMsg.body.beginParse();
      if (body.remainingBits >= 32) {
        const op = body.loadUint(32);
        if (op === OP_TRANSFER) {
          body.loadUint(64); // query_id
          const newOwner = body.loadAddress();
          label = 'TRANSFER (продажа): seller=' + src + ' → buyer=' + fmt(newOwner);
          events.push({ event: 'transfer', from: src, to: fmt(newOwner), lt: tx.lt.toString(), at: tx.now });
        } else {
          label = 'op=0x' + op.toString(16).padStart(8, '0');
        }
      } else {
        label = 'empty body';
      }
    } catch (e) {
      // тело без op-префикса — вероятно init/mint от коллекции
      label = 'init/deploy (likely MINT from ' + src + ')';
      events.push({ event: 'mint', from: src, to: null, lt: tx.lt.toString(), at: tx.now });
    }
    console.log(`lt=${tx.lt}  t=${tx.now}  from=${src}  :: ${label}`);
  }

  console.log('--- RECONSTRUCTED EVENTS ---');
  console.log(JSON.stringify(events, null, 2));
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
