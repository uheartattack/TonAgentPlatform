// «Обход» индексера: по коллекции находит всех агентов и читает их провенанс
// через get-методы (надёжнее парсинга тел). Проверка на живом testnet.
const { TonClient, Address, TupleBuilder } = require('@ton/ton');

const COLLECTION = process.env.COLLECTION || '0QD8QO307oBYFUxtmCRkDz9OfjhuS1bU6bWgZxuJqcgDEYt9';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (a) => (a ? a.toString({ testOnly: true, bounceable: false }) : 'none');

(async () => {
  const c = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
  const coll = Address.parse(COLLECTION);

  const cd = await c.runMethod(coll, 'get_collection_data');
  const nextIndex = cd.stack.readBigNumber();
  console.log('COLLECTION=' + COLLECTION + '  next_index=' + nextIndex.toString());

  for (let i = 0n; i < nextIndex; i++) {
    await sleep(1500);
    const tb = new TupleBuilder();
    tb.writeNumber(i);
    const r = await c.runMethod(coll, 'get_nft_address_by_index', tb.build());
    const itemAddr = r.stack.readAddress();

    await sleep(1500);
    const pv = await c.runMethod(itemAddr, 'get_provenance');
    const creator = pv.stack.readAddressOpt();
    pv.stack.readBigNumber();            // mint_time
    const sales = pv.stack.readBigNumber();
    const lastSeller = pv.stack.readAddressOpt();

    console.log(`#${i}  ${fmt(itemAddr)}`);
    console.log(`     creator=${fmt(creator)}  sales=${sales}  last_seller=${fmt(lastSeller)}`);
  }
  console.log('OK — индексер обошёл коллекцию и прочитал провенанс каждого агента');
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
