import { Address, beginCell, toNano } from '@ton/core';
import { AgentCollection } from '../wrappers/AgentCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

// Деплой коллекции агентов (= реестр). owner коллекции + royalty dest = TAP.
// Адрес владельца можно задать env DEPLOY_OWNER (иначе — подписант).
// Запуск: npx blueprint run deployAgentCollection --testnet --deeplink
export async function run(provider: NetworkProvider) {
  const tap = process.env.DEPLOY_OWNER
    ? Address.parse(process.env.DEPLOY_OWNER)
    : provider.sender().address!;

  const offchain = (s: string) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();

  const collection = provider.open(
    AgentCollection.createFromConfig(
      {
        ownerAddress: tap,
        nextItemIndex: 0,
        // TODO: заменить на реальные metadata URL перед mainnet
        collectionContent: offchain('https://tonagentplatform.com/agents/collection.json'),
        commonContent: offchain('https://tonagentplatform.com/agents/'),
        nftItemCode: await compile('AgentItem'),
        royalty: { numerator: 250, denominator: 10000, destination: tap }, // 2.5%
      },
      await compile('AgentCollection'),
    ),
  );

  await collection.sendDeploy(provider.sender(), toNano('0.05'));
  await provider.waitForDeploy(collection.address);

  console.log('AgentCollection deployed at:', collection.address.toString());
  const data = await collection.getCollectionData();
  console.log('next_item_index:', data.nextItemIndex.toString());
}
