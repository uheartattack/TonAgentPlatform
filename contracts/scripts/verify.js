// Проверка деплоя коллекции в testnet (read-only).
const { TonClient, Address } = require('@ton/ton');

const ADDR = process.env.VERIFY_ADDR || '0QDUDoWd4feG55pjOppl73M4xA01CMtrpr05QZBYB41YmPU4';

(async () => {
  const client = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
  const addr = Address.parse(ADDR);
  const state = await client.getContractState(addr);
  console.log('STATE=' + state.state);
  console.log('BALANCE_NANO=' + state.balance.toString());
  if (state.state !== 'active') {
    console.log('NOT_ACTIVE — контракт ещё не задеплоен/не подтвердился');
    return;
  }
  const cd = await client.runMethod(addr, 'get_collection_data');
  const nextIndex = cd.stack.readBigNumber();
  cd.stack.readCell(); // content
  const owner = cd.stack.readAddress();
  console.log('NEXT_INDEX=' + nextIndex.toString());
  console.log('OWNER=' + owner.toString({ testOnly: true, bounceable: false }));

  const rp = await client.runMethod(addr, 'royalty_params');
  const num = rp.stack.readBigNumber();
  const den = rp.stack.readBigNumber();
  const dest = rp.stack.readAddress();
  console.log('ROYALTY=' + num.toString() + '/' + den.toString() + ' -> ' + dest.toString({ testOnly: true, bounceable: false }));
  console.log('OK — коллекция жива и отвечает на get-методы');
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
