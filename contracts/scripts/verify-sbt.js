// Проверка деплоя Owner SBT в testnet (read-only, с паузами).
const { TonClient, Address } = require('@ton/ton');

const SBT = process.env.SBT || '0QAtZuLn-81NiD0Mmfo82MK28d4mMMKr4ztpz1geKhpxDydN';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const client = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
  const a = Address.parse(SBT);

  const st = await client.getContractState(a);
  console.log('SBT_STATE=' + st.state);
  console.log('SBT_BALANCE_NANO=' + st.balance.toString());
  if (st.state !== 'active') { console.log('NOT_ACTIVE_YET'); return; }

  await sleep(1800);
  const nd = await client.runMethod(a, 'get_nft_data');
  const init = nd.stack.readBoolean();
  const index = nd.stack.readBigNumber();
  const coll = nd.stack.readAddressOpt();
  const ownr = nd.stack.readAddressOpt();
  console.log('SBT_INIT=' + init + ' INDEX(tap_user_id)=' + index.toString());
  console.log('SBT_OWNER=' + (ownr ? ownr.toString({ testOnly: true, bounceable: false }) : 'null'));
  console.log('SBT_COLLECTION=' + (coll ? coll.toString({ testOnly: true, bounceable: false }) : 'null (standalone)'));

  await sleep(1800);
  const au = await client.runMethod(a, 'get_authority_address');
  const auth = au.stack.readAddressOpt();
  console.log('SBT_AUTHORITY=' + (auth ? auth.toString({ testOnly: true, bounceable: false }) : 'null'));

  await sleep(1800);
  const rv = await client.runMethod(a, 'get_revoked_time');
  console.log('SBT_REVOKED_TIME=' + rv.stack.readBigNumber().toString());
  console.log('OK — паспорт жив (soulbound/непередаваемость проверена юнит-тестами)');
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
