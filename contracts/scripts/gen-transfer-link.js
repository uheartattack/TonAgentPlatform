// Генерит ton://-ссылку для передачи (продажи) агент-NFT.
// По умолчанию передаём самому себе (TARGET=OWNER) — чтобы проверить счётчик
// продаж, не теряя тестового агента. В реале TARGET = адрес покупателя.
const { beginCell, Address, toNano } = require('@ton/core');

const AGENT = process.env.AGENT || '0QARCFv5XMGyOUmxkUNPtIbaKInDWK0dlU1iFxSo_yRcHvwA';
const OWNER = process.env.DEPLOY_OWNER || '0QC-iuC_mGkDW46Ix8MmUTkeg4AVaD0rldv-JK8paeqcxSby';
const TARGET = process.env.TARGET || OWNER;

const agent = Address.parse(AGENT);
const newOwner = Address.parse(TARGET);
const resp = Address.parse(OWNER);

const body = beginCell()
  .storeUint(0x5fcc3d14, 32) // op transfer (TEP-62)
  .storeUint(0, 64)          // query_id
  .storeAddress(newOwner)    // new owner
  .storeAddress(resp)        // response destination (excesses)
  .storeBit(false)           // custom_payload: nothing
  .storeCoins(0)             // forward_amount
  .endCell();
const bin = body.toBoc().toString('base64');
const amount = toNano('0.1').toString();

const link = `ton://transfer/${agent.toString({ testOnly: true, bounceable: true })}?amount=${amount}&bin=${encodeURIComponent(bin)}`;
console.log('TRANSFER_TO=' + newOwner.toString({ testOnly: true, bounceable: false }));
console.log('---LINK---');
console.log(link);
