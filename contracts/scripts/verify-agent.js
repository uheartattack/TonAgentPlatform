// Проверка минта агента #0 в testnet (read-only, с паузами против rate-limit).
const { TonClient, Address } = require('@ton/ton');

const AGENT = process.env.AGENT || '0QCCirUTus-FFXoqVYFtWuIDYo3-WFp0dk84qKELp0tksRcu';
const COLLECTION = process.env.COLLECTION || '0QDUDoWd4feG55pjOppl73M4xA01CMtrpr05QZBYB41YmPU4';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const client = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
  const agent = Address.parse(AGENT);

  const st = await client.getContractState(agent);
  console.log('AGENT_STATE=' + st.state);
  console.log('AGENT_BALANCE_NANO=' + st.balance.toString());
  if (st.state !== 'active') { console.log('NOT_ACTIVE_YET — минт ещё не подтвердился'); return; }

  await sleep(1800);
  const nd = await client.runMethod(agent, 'get_nft_data');
  const init = nd.stack.readBoolean();
  const index = nd.stack.readBigNumber();
  const coll = nd.stack.readAddressOpt();
  const ownr = nd.stack.readAddressOpt();
  console.log('AGENT_INIT=' + init + ' INDEX=' + index.toString());
  console.log('AGENT_OWNER=' + (ownr ? ownr.toString({ testOnly: true, bounceable: false }) : 'null'));
  console.log('AGENT_COLLECTION=' + (coll ? coll.toString({ testOnly: true, bounceable: false }) : 'null'));

  await sleep(1800);
  const ad = await client.runMethod(agent, 'get_agent_data');
  const caps = ad.stack.readBigNumber();
  ad.stack.readCell();
  const tapId = ad.stack.readBigNumber();
  console.log('AGENT_CAPS_HASH=0x' + caps.toString(16));
  console.log('AGENT_TAP_ID=' + tapId.toString());

  await sleep(1800);
  const cd = await client.runMethod(Address.parse(COLLECTION), 'get_collection_data');
  const next = cd.stack.readBigNumber();
  console.log('COLLECTION_NEXT_INDEX=' + next.toString());
  console.log('OK — агент жив, владелец и данные на месте');
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
