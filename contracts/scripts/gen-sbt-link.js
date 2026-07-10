// Генерит ton://-ссылку для деплоя Owner SBT (паспорт владельца, soulbound).
const fs = require('fs');
const path = require('path');
const { Cell, beginCell, contractAddress, storeStateInit, Address, toNano } = require('@ton/core');

const OWNER = process.env.DEPLOY_OWNER || '0QC-iuC_mGkDW46Ix8MmUTkeg4AVaD0rldv-JK8paeqcxSby';
const TAP_USER_ID = Number(process.env.TAP_USER_ID || 1); // непрозрачный id, НЕ Telegram id
const owner = Address.parse(OWNER);

function loadCode(n) {
  return Cell.fromBoc(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.compiled.json'), 'utf8')).hex, 'hex'))[0];
}
const code = loadCode('OwnerSbt');

const offchain = (s) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();
// data: index(tap_user_id), collection=addr_none, owner, content, authority=owner(TAP), revoked_at=0
const data = beginCell()
  .storeUint(TAP_USER_ID, 64)
  .storeAddress(null)            // collection_address = addr_none (standalone)
  .storeAddress(owner)
  .storeRef(offchain('https://tonagentplatform.com/owner/' + TAP_USER_ID + '.json'))
  .storeAddress(owner)           // authority = TAP (демо: тот же кошелёк)
  .storeUint(0, 64)
  .endCell();

const init = { code, data };
const addr = contractAddress(0, init);
const stateInit = beginCell().store(storeStateInit(init)).endCell();
const initB64 = stateInit.toBoc().toString('base64');
const amount = toNano('0.05').toString();

const addrT = addr.toString({ testOnly: true, bounceable: false });
const link = `ton://transfer/${addrT}?amount=${amount}&init=${encodeURIComponent(initB64)}`;

console.log('OWNER_SBT_ADDRESS=' + addrT);
console.log('---SBT_LINK---');
console.log(link);
