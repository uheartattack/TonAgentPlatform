// Проверка минта + провенанса агента в testnet (read-only, с паузами).
const { TonClient, Address } = require('@ton/ton');

const AGENT = process.env.AGENT || '0QARCFv5XMGyOUmxkUNPtIbaKInDWK0dlU1iFxSo_yRcHvwA';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (s) => (s ? s.toString({ testOnly: true, bounceable: false }) : 'none');

(async () => {
  const c = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
  const a = Address.parse(AGENT);

  const st = await c.getContractState(a);
  console.log('STATE=' + st.state);
  if (st.state !== 'active') { console.log('NOT_ACTIVE_YET — минт не подтвердился'); return; }

  await sleep(1800);
  const nd = await c.runMethod(a, 'get_nft_data');
  nd.stack.readBoolean();
  const idx = nd.stack.readBigNumber();
  nd.stack.readAddressOpt(); // collection
  const owner = nd.stack.readAddressOpt();
  console.log('OWNER=' + fmt(owner) + ' INDEX=' + idx.toString());

  await sleep(1800);
  const pv = await c.runMethod(a, 'get_provenance');
  const creator = pv.stack.readAddressOpt();
  const mintTime = pv.stack.readBigNumber();
  const tcount = pv.stack.readBigNumber();
  const lastSeller = pv.stack.readAddressOpt();
  const lastT = pv.stack.readBigNumber();
  console.log('CREATOR=' + fmt(creator) + '   <- оригинальный автор');
  console.log('MINT_TIME=' + mintTime.toString());
  console.log('TRANSFER_COUNT=' + tcount.toString());
  console.log('LAST_SELLER=' + fmt(lastSeller) + ' LAST_TRANSFER_TIME=' + lastT.toString());
  console.log('OK — провенанс на месте');
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
