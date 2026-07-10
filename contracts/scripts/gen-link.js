// Standalone генератор деплой-ссылки коллекции агентов (testnet).
// Не трогает ключи: строит ton://transfer-ссылку со stateInit, подпись — в Tonkeeper.
const fs = require('fs');
const path = require('path');
const { Cell, beginCell, contractAddress, storeStateInit, Address, toNano } = require('@ton/core');

const OWNER = process.env.DEPLOY_OWNER || '0QC-iuC_mGkDW46Ix8MmUTkeg4AVaD0rldv-JK8paeqcxSby';
const owner = Address.parse(OWNER);

function loadCode(name) {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', name + '.compiled.json'), 'utf8'));
  return Cell.fromBoc(Buffer.from(j.hex, 'hex'))[0];
}

const collectionCode = loadCode('AgentCollection');
const itemCode = loadCode('AgentItem');

const offchain = (s) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();
const content = beginCell()
  .storeRef(offchain('https://tonagentplatform.com/agents/collection.json'))
  .storeRef(offchain('https://tonagentplatform.com/agents/'))
  .endCell();
// Роялти 2.5% → казна платформы (agentplatform.ton), НЕ владелец-минтер
const treasury = Address.parse(process.env.TAP_TREASURY || 'EQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y6qk');
const royalty = beginCell().storeUint(250, 16).storeUint(10000, 16).storeAddress(treasury).endCell();
const data = beginCell()
  .storeAddress(owner)
  .storeUint(0, 64)
  .storeRef(content)
  .storeRef(itemCode)
  .storeRef(royalty)
  .endCell();

const init = { code: collectionCode, data };
const addr = contractAddress(0, init);
const stateInit = beginCell().store(storeStateInit(init)).endCell();
const initB64 = stateInit.toBoc().toString('base64');
const amount = toNano('0.1').toString();

const MAINNET = process.env.MAINNET === '1';
const addrFriendly = addr.toString({ testOnly: !MAINNET, bounceable: false });
const addrRaw = addr.toString();

const tonLink = `ton://transfer/${addrFriendly}?amount=${amount}&init=${encodeURIComponent(initB64)}`;
const tkLink = `https://app.tonkeeper.com/transfer/${addrFriendly}?amount=${amount}&init=${encodeURIComponent(initB64)}`;

console.log('OWNER=' + owner.toString({ testOnly: true, bounceable: false }));
console.log('COLLECTION_ADDRESS=' + addrFriendly);
console.log('COLLECTION_ADDRESS_RAW=' + addrRaw);
console.log('AMOUNT_NANO=' + amount);
console.log('---TON_LINK_START---');
console.log(tonLink);
console.log('---TON_LINK_END---');
console.log('---TONKEEPER_LINK_START---');
console.log(tkLink);
console.log('---TONKEEPER_LINK_END---');
