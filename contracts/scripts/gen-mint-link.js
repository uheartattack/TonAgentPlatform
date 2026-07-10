// Генерит ton://-ссылку для минта первого агента через коллекцию (owner-only).
const fs = require('fs');
const path = require('path');
const { Cell, beginCell, contractAddress, Address, toNano } = require('@ton/core');

const COLLECTION = process.env.COLLECTION || '0QDUDoWd4feG55pjOppl73M4xA01CMtrpr05QZBYB41YmPU4';
const OWNER = process.env.DEPLOY_OWNER || '0QC-iuC_mGkDW46Ix8MmUTkeg4AVaD0rldv-JK8paeqcxSby';
const collectionAddr = Address.parse(COLLECTION);
const owner = Address.parse(OWNER);

function loadCode(n) {
  return Cell.fromBoc(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.compiled.json'), 'utf8')).hex, 'hex'))[0];
}
const itemCode = loadCode('AgentItem');

const offchain = (s) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();
// agent_data: capabilities_hash=0x1234, reputation_ptr=empty, tap_agent_id=1
const agentData = beginCell().storeUint(0x1234n, 256).storeRef(beginCell().endCell()).storeUint(1, 64).endCell();
const itemContent = offchain('https://tonagentplatform.com/agents/0.json');
// init payload, который коллекция передаст item'у: owner, content, agent_data
const itemInitPayload = beginCell().storeAddress(owner).storeRef(itemContent).storeRef(agentData).endCell();

const ITEM_INDEX = 0;
const ITEM_VALUE = toNano('0.05');
const mintBody = beginCell()
  .storeUint(1, 32)   // op::mint
  .storeUint(0, 64)   // query_id
  .storeUint(ITEM_INDEX, 64)
  .storeCoins(ITEM_VALUE)
  .storeRef(itemInitPayload)
  .endCell();
const binB64 = mintBody.toBoc().toString('base64');
const amount = toNano('0.1').toString();

// детерминированный адрес будущего агент-NFT
const itemData = beginCell().storeUint(ITEM_INDEX, 64).storeAddress(collectionAddr).endCell();
const itemAddr = contractAddress(0, { code: itemCode, data: itemData });

const link = `ton://transfer/${collectionAddr.toString({ testOnly: true, bounceable: true })}?amount=${amount}&bin=${encodeURIComponent(binB64)}`;

console.log('AGENT_ITEM_ADDRESS=' + itemAddr.toString({ testOnly: true, bounceable: false }));
console.log('SEND_TO_COLLECTION=' + collectionAddr.toString({ testOnly: true, bounceable: true }));
console.log('---MINT_LINK---');
console.log(link);
