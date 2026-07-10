import {
  Address, beginCell, Cell, Contract, contractAddress,
  ContractProvider, Sender, SendMode,
} from '@ton/core';

export const ESCROW_OPS = {
  claim: 0x4a434c41,
  deliver: 0x4a444c56,
  accept: 0x4a414350,
  autorelease: 0x4a415552,
  refund: 0x4a524644,
  reject: 0x4a524a54,
};

export const ESCROW_STATUS = {
  FUNDED: 0, CLAIMED: 1, DELIVERED: 2, RELEASED: 3, REFUNDED: 4,
};

export type EscrowConfig = {
  poster: Address;
  tap: Address;            // комиссия TAP
  amount: bigint;          // залоченный баунти
  feeBps: number;          // 500 = 5%
  deadline: number;        // unix: дедлайн сдачи
  acceptWindow: number;    // сек после сдачи до авто-релиза
  executor?: Address | null;
};

export function escrowConfigToCell(c: EscrowConfig): Cell {
  // Init-time валидация (контракт не исполняет код при деплое — гейтим здесь).
  // Предотвращает: fee > 100% (исполнитель получит 0), мгновенный авто-релиз без окна приёмки,
  // и дедлайн в прошлом (мгновенный refund в обход эскроу).
  if (!Number.isInteger(c.feeBps) || c.feeBps < 0 || c.feeBps > 10000) {
    throw new Error('Escrow: feeBps must be an integer in [0, 10000]');
  }
  if (!Number.isInteger(c.acceptWindow) || c.acceptWindow <= 0) {
    throw new Error('Escrow: acceptWindow must be a positive integer (seconds)');
  }
  if (!Number.isInteger(c.deadline) || c.deadline <= Math.floor(Date.now() / 1000)) {
    throw new Error('Escrow: deadline must be a unix timestamp in the future');
  }
  if (c.amount <= 0n) {
    throw new Error('Escrow: amount must be > 0');
  }
  return beginCell()
    .storeUint(ESCROW_STATUS.FUNDED, 8)
    .storeAddress(c.poster)
    .storeAddress(c.executor ?? null)
    .storeAddress(c.tap)
    .storeCoins(c.amount)
    .storeUint(c.feeBps, 16)
    .storeUint(c.deadline, 64)
    .storeUint(c.acceptWindow, 32)
    .storeUint(0, 64) // delivered_at
    .endCell();
}

const body = (op: number) => beginCell().storeUint(op, 32).storeUint(0, 64).endCell();

export class Escrow implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new Escrow(address);
  }

  static createFromConfig(config: EscrowConfig, code: Cell, workchain = 0) {
    const data = escrowConfigToCell(config);
    const init = { code, data };
    return new Escrow(contractAddress(workchain, init), init);
  }

  // Деплой = фандинг: value должен покрыть amount + газ
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: beginCell().endCell() });
  }

  private async op(provider: ContractProvider, via: Sender, value: bigint, op: number) {
    await provider.internal(via, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: body(op) });
  }

  sendClaim(p: ContractProvider, via: Sender, value: bigint) { return this.op(p, via, value, ESCROW_OPS.claim); }
  sendDeliver(p: ContractProvider, via: Sender, value: bigint) { return this.op(p, via, value, ESCROW_OPS.deliver); }
  sendAccept(p: ContractProvider, via: Sender, value: bigint) { return this.op(p, via, value, ESCROW_OPS.accept); }
  sendAutoRelease(p: ContractProvider, via: Sender, value: bigint) { return this.op(p, via, value, ESCROW_OPS.autorelease); }
  sendRefund(p: ContractProvider, via: Sender, value: bigint) { return this.op(p, via, value, ESCROW_OPS.refund); }
  sendReject(p: ContractProvider, via: Sender, value: bigint) { return this.op(p, via, value, ESCROW_OPS.reject); }

  async getStatus(provider: ContractProvider): Promise<number> {
    const res = await provider.get('get_status', []);
    return res.stack.readNumber();
  }

  async getDeal(provider: ContractProvider) {
    const res = await provider.get('get_deal', []);
    return {
      status: res.stack.readNumber(),
      poster: res.stack.readAddress(),
      executor: res.stack.readAddressOpt(),
      tap: res.stack.readAddress(),
      amount: res.stack.readBigNumber(),
      feeBps: res.stack.readNumber(),
      deadline: res.stack.readBigNumber(),
      acceptWindow: res.stack.readNumber(),
      deliveredAt: res.stack.readBigNumber(),
    };
  }
}
