import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { Escrow, ESCROW_STATUS } from '../wrappers/Escrow';

const BASE = 1800000000;          // фикс. unix для детерминизма
const DEADLINE = BASE + 3600;     // дедлайн сдачи
const ACCEPT_WINDOW = 86400;      // 1 день на приёмку
const AMOUNT = toNano('1');       // баунти 1 GRAM
const FEE_BPS = 500;              // 5%

describe('TAP v3.0 — Job Escrow', () => {
  let code: Cell;
  let blockchain: Blockchain;
  let poster: SandboxContract<TreasuryContract>;
  let executor: SandboxContract<TreasuryContract>;
  let tap: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;

  beforeAll(async () => { code = await compile('Escrow'); });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = BASE;
    poster = await blockchain.treasury('poster');
    executor = await blockchain.treasury('executor');
    tap = await blockchain.treasury('tap');
    outsider = await blockchain.treasury('outsider');

    escrow = blockchain.openContract(
      Escrow.createFromConfig(
        { poster: poster.address, tap: tap.address, amount: AMOUNT, feeBps: FEE_BPS, deadline: DEADLINE, acceptWindow: ACCEPT_WINDOW },
        code,
      ),
    );
    // фандинг: poster кладёт баунти + газ
    const r = await escrow.sendDeploy(poster.getSender(), AMOUNT + toNano('0.1'));
    expect(r.transactions).toHaveTransaction({ to: escrow.address, deploy: true, success: true });
  });

  it('happy path: claim → deliver → accept → релиз с комиссией 5%', async () => {
    expect(await escrow.getStatus()).toBe(ESCROW_STATUS.FUNDED);

    await escrow.sendClaim(executor.getSender(), toNano('0.05'));
    expect(await escrow.getStatus()).toBe(ESCROW_STATUS.CLAIMED);
    expect((await escrow.getDeal()).executor!.equals(executor.address)).toBe(true);

    await escrow.sendDeliver(executor.getSender(), toNano('0.05'));
    expect(await escrow.getStatus()).toBe(ESCROW_STATUS.DELIVERED);

    const r = await escrow.sendAccept(poster.getSender(), toNano('0.05'));
    // комиссия → tap, основное → executor
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: tap.address, success: true });
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: executor.address, success: true });
    expect(await escrow.getStatus()).toBe(ESCROW_STATUS.RELEASED);
  });

  it('executor получает ~95%, TAP ~5%', async () => {
    await escrow.sendClaim(executor.getSender(), toNano('0.05'));
    await escrow.sendDeliver(executor.getSender(), toNano('0.05'));
    const tapBefore = await tap.getBalance();
    const exBefore = await executor.getBalance();
    await escrow.sendAccept(poster.getSender(), toNano('0.05'));
    const tapGain = (await tap.getBalance()) - tapBefore;
    const exGain = (await executor.getBalance()) - exBefore;
    // tap ~0.05, executor ~0.95 (минус газ)
    expect(tapGain).toBeGreaterThanOrEqual(toNano('0.049'));
    expect(tapGain).toBeLessThanOrEqual(toNano('0.051'));
    expect(exGain).toBeGreaterThanOrEqual(toNano('0.93'));
  });

  it('auto-release: окно приёмки вышло → кто угодно релизит исполнителю', async () => {
    await escrow.sendClaim(executor.getSender(), toNano('0.05'));
    await escrow.sendDeliver(executor.getSender(), toNano('0.05'));

    // рано — должно отбиться
    const early = await escrow.sendAutoRelease(outsider.getSender(), toNano('0.05'));
    expect(early.transactions).toHaveTransaction({ to: escrow.address, success: false, exitCode: 423 });

    blockchain.now = BASE + ACCEPT_WINDOW + 10;
    const r = await escrow.sendAutoRelease(outsider.getSender(), toNano('0.05'));
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: executor.address, success: true });
    expect(await escrow.getStatus()).toBe(ESCROW_STATUS.RELEASED);
  });

  it('timeout refund: дедлайн без сдачи → возврат заказчику', async () => {
    await escrow.sendClaim(executor.getSender(), toNano('0.05'));
    // дедлайн прошёл, сдачи не было
    blockchain.now = DEADLINE + 10;
    const r = await escrow.sendRefund(outsider.getSender(), toNano('0.05'));
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: poster.address, success: true });
  });

  it('guards: deliver только исполнитель (422), accept только заказчик (421)', async () => {
    await escrow.sendClaim(executor.getSender(), toNano('0.05'));

    const badDeliver = await escrow.sendDeliver(outsider.getSender(), toNano('0.05'));
    expect(badDeliver.transactions).toHaveTransaction({ to: escrow.address, success: false, exitCode: 422 });

    await escrow.sendDeliver(executor.getSender(), toNano('0.05'));
    const badAccept = await escrow.sendAccept(outsider.getSender(), toNano('0.05'));
    expect(badAccept.transactions).toHaveTransaction({ to: escrow.address, success: false, exitCode: 421 });
  });

  it('reject: заказчик отклонил сдачу → возврат заказчику', async () => {
    await escrow.sendClaim(executor.getSender(), toNano('0.05'));
    await escrow.sendDeliver(executor.getSender(), toNano('0.05'));
    const r = await escrow.sendReject(poster.getSender(), toNano('0.05'));
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: poster.address, success: true });
  });
});
