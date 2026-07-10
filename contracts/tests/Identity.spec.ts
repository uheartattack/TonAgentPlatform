import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { OwnerSbt } from '../wrappers/OwnerSbt';
import { AgentCollection } from '../wrappers/AgentCollection';
import { AgentItem, buildAgentData, buildItemInitPayload } from '../wrappers/AgentItem';

const emptyCell = () => beginCell().endCell();
const contentCell = (s: string) => beginCell().storeUint(0, 8).storeStringTail(s).endCell();

describe('TAP v3.0 Identity contracts', () => {
  let sbtCode: Cell;
  let collectionCode: Cell;
  let itemCode: Cell;

  beforeAll(async () => {
    sbtCode = await compile('OwnerSbt');
    collectionCode = await compile('AgentCollection');
    itemCode = await compile('AgentItem');
  });

  // ───────────────────────── Owner SBT (soulbound) ─────────────────────────
  describe('Owner SBT', () => {
    let blockchain: Blockchain;
    let tap: SandboxContract<TreasuryContract>;       // authority
    let owner: SandboxContract<TreasuryContract>;
    let stranger: SandboxContract<TreasuryContract>;
    let sbt: SandboxContract<OwnerSbt>;

    beforeEach(async () => {
      blockchain = await Blockchain.create();
      tap = await blockchain.treasury('tap');
      owner = await blockchain.treasury('owner');
      stranger = await blockchain.treasury('stranger');

      sbt = blockchain.openContract(
        OwnerSbt.createFromConfig(
          {
            index: 4821,
            ownerAddress: owner.address,
            authorityAddress: tap.address,
            content: contentCell('owner-4821'),
          },
          sbtCode,
        ),
      );
      const r = await sbt.sendDeploy(tap.getSender(), toNano('0.05'));
      expect(r.transactions).toHaveTransaction({ to: sbt.address, deploy: true, success: true });
    });

    it('stores owner + authority, index = tap_user_id', async () => {
      const d = await sbt.getNftData();
      expect(d.init).toBe(true);
      expect(d.index).toBe(4821n);
      expect(d.owner!.equals(owner.address)).toBe(true);
      expect((await sbt.getAuthority())!.equals(tap.address)).toBe(true);
      expect(await sbt.getRevokedTime()).toBe(0n);
    });

    it('is SOULBOUND — transfer is rejected (exit 411)', async () => {
      const r = await sbt.sendTransfer(owner.getSender(), toNano('0.05'), stranger.address);
      expect(r.transactions).toHaveTransaction({ to: sbt.address, success: false, exitCode: 411 });
      // owner unchanged
      const d = await sbt.getNftData();
      expect(d.owner!.equals(owner.address)).toBe(true);
    });

    it('only authority can revoke', async () => {
      const bad = await sbt.sendRevoke(stranger.getSender(), toNano('0.05'));
      expect(bad.transactions).toHaveTransaction({ to: sbt.address, success: false, exitCode: 403 });
      expect(await sbt.getRevokedTime()).toBe(0n);

      const ok = await sbt.sendRevoke(tap.getSender(), toNano('0.05'));
      expect(ok.transactions).toHaveTransaction({ to: sbt.address, success: true });
      expect(await sbt.getRevokedTime()).toBeGreaterThan(0n);
    });
  });

  // ──────────────────── Agent Collection + Item ────────────────────
  describe('Agent Collection + Item', () => {
    let blockchain: Blockchain;
    let tap: SandboxContract<TreasuryContract>;        // collection owner + royalty dest
    let agentOwner: SandboxContract<TreasuryContract>;
    let buyer: SandboxContract<TreasuryContract>;
    let stranger: SandboxContract<TreasuryContract>;
    let collection: SandboxContract<AgentCollection>;

    beforeEach(async () => {
      blockchain = await Blockchain.create();
      tap = await blockchain.treasury('tap');
      agentOwner = await blockchain.treasury('agentOwner');
      buyer = await blockchain.treasury('buyer');
      stranger = await blockchain.treasury('stranger');

      collection = blockchain.openContract(
        AgentCollection.createFromConfig(
          {
            ownerAddress: tap.address,
            nextItemIndex: 0,
            collectionContent: contentCell('tap-agents'),
            commonContent: contentCell('https://tonagentplatform.com/agent/'),
            nftItemCode: itemCode,
            royalty: { numerator: 250, denominator: 10000, destination: tap.address }, // 2.5%
          },
          collectionCode,
        ),
      );
      const r = await collection.sendDeploy(tap.getSender(), toNano('0.1'));
      expect(r.transactions).toHaveTransaction({ to: collection.address, deploy: true, success: true });
    });

    async function mintAgent(ownerAddr = agentOwner.address) {
      const agentData = buildAgentData(0x1234n, emptyCell(), 777);
      const payload = buildItemInitPayload(ownerAddr, contentCell('agent-0'), agentData);
      const r = await collection.sendMint(tap.getSender(), toNano('0.1'), {
        itemIndex: 0,
        itemValue: toNano('0.05'),
        itemInitPayload: payload,
      });
      const itemAddr = await collection.getNftAddressByIndex(0);
      return { r, item: blockchain.openContract(AgentItem.createFromAddress(itemAddr)) };
    }

    it('royalty params = 2.5% to TAP', async () => {
      const rp = await collection.getRoyaltyParams();
      expect(rp.numerator).toBe(250n);
      expect(rp.denominator).toBe(10000n);
      expect(rp.destination.equals(tap.address)).toBe(true);
    });

    it('mints an agent NFT, next index increments', async () => {
      const { r, item } = await mintAgent();
      expect(r.transactions).toHaveTransaction({ from: collection.address, to: item.address, deploy: true, success: true });
      expect((await collection.getCollectionData()).nextItemIndex).toBe(1n);

      const d = await item.getNftData();
      expect(d.init).toBe(true);
      expect(d.owner!.equals(agentOwner.address)).toBe(true);

      const ad = await item.getAgentData();
      expect(ad.capabilitiesHash).toBe(0x1234n);
      expect(ad.tapAgentId).toBe(777n);

      // провенанс при минте: creator = первый владелец, 0 продаж
      const p = await item.getProvenance();
      expect(p.creator!.equals(agentOwner.address)).toBe(true);
      expect(p.transferCount).toBe(0n);
      expect(p.mintTime).toBeGreaterThan(0n);
    });

    it('transfer changes owner + штампует провенанс (creator неизменен)', async () => {
      const { item } = await mintAgent(); // creator = agentOwner
      const r = await item.sendTransfer(agentOwner.getSender(), toNano('0.1'), { newOwner: buyer.address });
      expect(r.transactions).toHaveTransaction({ to: item.address, success: true });

      const d = await item.getNftData();
      expect(d.owner!.equals(buyer.address)).toBe(true);

      const p = await item.getProvenance();
      expect(p.creator!.equals(agentOwner.address)).toBe(true);  // оригинальный автор сохранён
      expect(p.transferCount).toBe(1n);                          // 1 продажа
      expect(p.lastSeller!.equals(agentOwner.address)).toBe(true); // продал agentOwner
      expect(p.lastTransferTime).toBeGreaterThan(0n);

      // вторая продажа: buyer → stranger; creator всё ещё agentOwner, счётчик = 2
      const r2 = await item.sendTransfer(buyer.getSender(), toNano('0.1'), { newOwner: stranger.address });
      expect(r2.transactions).toHaveTransaction({ to: item.address, success: true });
      const p2 = await item.getProvenance();
      expect(p2.creator!.equals(agentOwner.address)).toBe(true);
      expect(p2.transferCount).toBe(2n);
      expect(p2.lastSeller!.equals(buyer.address)).toBe(true);
    });

    it('only owner can update_caps (KYA/reputation)', async () => {
      const { item } = await mintAgent();

      const bad = await item.sendUpdateCaps(stranger.getSender(), toNano('0.05'), { capsHash: 0x9999n, reputationPtr: emptyCell() });
      expect(bad.transactions).toHaveTransaction({ to: item.address, success: false, exitCode: 401 });

      const ok = await item.sendUpdateCaps(agentOwner.getSender(), toNano('0.05'), { capsHash: 0x9999n, reputationPtr: emptyCell() });
      expect(ok.transactions).toHaveTransaction({ to: item.address, success: true });

      const ad = await item.getAgentData();
      expect(ad.capabilitiesHash).toBe(0x9999n);
      expect(ad.tapAgentId).toBe(777n); // сохранился
    });
  });
});
