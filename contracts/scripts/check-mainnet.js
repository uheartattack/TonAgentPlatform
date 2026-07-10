// Проверка mainnet-адреса и баланса владельца (read-only).
const { TonClient, Address } = require('@ton/ton');

const TESTNET_ADDR = process.env.OWNER_TESTNET || '0QC-iuC_mGkDW46Ix8MmUTkeg4AVaD0rldv-JK8paeqcxSby';
const a = Address.parse(TESTNET_ADDR);

console.log('OWNER_MAINNET_UQ=' + a.toString({ testOnly: false, bounceable: false }));
console.log('OWNER_MAINNET_EQ=' + a.toString({ testOnly: false, bounceable: true }));

(async () => {
  const c = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC' });
  const bal = await c.getBalance(a);
  console.log('MAINNET_BALANCE_NANO=' + bal.toString());
  console.log('MAINNET_BALANCE_GRAM=' + (Number(bal) / 1e9).toFixed(4));
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
