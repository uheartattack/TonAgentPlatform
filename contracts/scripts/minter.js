// TAP Minter — авто-деплой коллекции + авто-минт агентов.
// ⚠️ Сид берётся ТОЛЬКО из env V3_MINTER_MNEMONIC (твоя рука). Скрипт его не
//    принимает аргументом, не логирует, нигде не сохраняет. Адрес минтера
//    выводится из сида. Деньги/роялти → agentplatform.ton (TAP_TREASURY).
//
// Использование (сид кладёшь в env САМ, лучше сперва на testnet):
//   set V3_MINTER_MNEMONIC=word1 word2 ... word24
//   set V3_TON_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC   (или mainnet)
//   node scripts/minter.js deploy-collection
//   node scripts/minter.js mint <ownerAddress> [tapAgentId] [capsHashHex]
const fs = require('fs');
const path = require('path');
const { TonClient, WalletContractV4, internal } = require('@ton/ton');
const { mnemonicToWalletKey } = require('@ton/crypto');
const { Cell, beginCell, contractAddress, storeStateInit, Address, toNano } = require('@ton/core');

const MN = process.env.V3_MINTER_MNEMONIC;
if (!MN) { console.error('ERR: set V3_MINTER_MNEMONIC env (24 words) — сид только в env, не в чате'); process.exit(1); }
const ENDPOINT = process.env.V3_TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TREASURY = Address.parse(process.env.TAP_TREASURY || 'EQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y6qk');

const loadCode = (n) => Cell.fromBoc(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.compiled.json'), 'utf8')).hex, 'hex'))[0];
const offchain = (s) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();

function collectionConfigCell(minter) {
  const content = beginCell()
    .storeRef(offchain('https://tonagentplatform.com/agents/collection.json'))
    .storeRef(offchain('https://tonagentplatform.com/agents/'))
    .endCell();
  const royalty = beginCell().storeUint(250, 16).storeUint(10000, 16).storeAddress(TREASURY).endCell();
  return beginCell()
    .storeAddress(minter).storeUint(0, 64)
    .storeRef(content).storeRef(loadCode('AgentItem')).storeRef(royalty)
    .endCell();
}

(async () => {
  const key = await mnemonicToWalletKey(MN.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const client = new TonClient({ endpoint: ENDPOINT });
  const w = client.open(wallet);
  const minter = wallet.address;
  console.log('MINTER=' + minter.toString({ bounceable: false }));

  const cmd = process.argv[2];
  const collData = collectionConfigCell(minter);
  const collInit = { code: loadCode('AgentCollection'), data: collData };
  const collAddr = contractAddress(0, collInit);
  console.log('COLLECTION=' + collAddr.toString({ bounceable: false }));

  if (cmd === 'deploy-collection') {
    const seqno = await w.getSeqno();
    await w.sendTransfer({
      seqno, secretKey: key.secretKey,
      messages: [internal({ to: collAddr, value: toNano('0.1'), init: { code: collInit.code, data: collInit.data }, body: beginCell().endCell(), bounce: false })],
    });
    console.log('deploy-collection sent, seqno=' + seqno + ' → ' + collAddr.toString({ bounceable: false }));
  } else if (cmd === 'mint') {
    const owner = Address.parse(process.argv[3]);
    const tapAgentId = BigInt(process.argv[4] || '1');
    const capsHash = BigInt(process.argv[5] || '0x0');
    const agentData = beginCell().storeUint(capsHash, 256).storeRef(beginCell().endCell()).storeUint(tapAgentId, 64).endCell();
    const itemPayload = beginCell().storeAddress(owner).storeRef(offchain('https://tonagentplatform.com/agents/' + tapAgentId + '.json')).storeRef(agentData).endCell();
    const mintBody = beginCell().storeUint(1, 32).storeUint(0, 64).storeUint(0, 64).storeCoins(toNano('0.05')).storeRef(itemPayload).endCell();
    const seqno = await w.getSeqno();
    await w.sendTransfer({ seqno, secretKey: key.secretKey, messages: [internal({ to: collAddr, value: toNano('0.1'), body: mintBody, bounce: true })] });
    console.log('mint sent (owner=' + owner.toString({ bounceable: false }) + ', tapAgentId=' + tapAgentId + '), seqno=' + seqno);
  } else {
    console.log('usage: node scripts/minter.js deploy-collection | mint <ownerAddr> [tapAgentId] [capsHashHex]');
  }
})().catch((e) => { console.error('ERR ' + (e && e.message)); process.exit(1); });
