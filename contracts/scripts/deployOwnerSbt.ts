import { beginCell, toNano } from '@ton/core';
import { OwnerSbt } from '../wrappers/OwnerSbt';
import { compile, NetworkProvider } from '@ton/blueprint';

// Деплой одного Owner SBT (паспорт владельца). В проде TAP минтит по одному на юзера
// при онбординге. Здесь — демо: owner = деплоер, authority = деплоер (TAP).
// index = непрозрачный tap_user_id (НЕ Telegram id).
// Запуск: npx blueprint run deployOwnerSbt --testnet
export async function run(provider: NetworkProvider, args: string[]) {
  const me = provider.sender().address!;
  const tapUserId = args.length > 0 ? Number(args[0]) : 1;

  const offchain = (s: string) => beginCell().storeUint(0x01, 8).storeStringTail(s).endCell();

  const sbt = provider.open(
    OwnerSbt.createFromConfig(
      {
        index: tapUserId,
        ownerAddress: me,
        authorityAddress: me, // TAP (в проде — отдельный authority-кошелёк)
        content: offchain(`https://tonagentplatform.com/owner/${tapUserId}.json`),
      },
      await compile('OwnerSbt'),
    ),
  );

  await sbt.sendDeploy(provider.sender(), toNano('0.05'));
  await provider.waitForDeploy(sbt.address);

  console.log('OwnerSbt deployed at:', sbt.address.toString());
  const d = await sbt.getNftData();
  console.log('owner:', d.owner?.toString(), '| index(tap_user_id):', d.index.toString());
}
