import {
  Address, beginCell, Cell, Contract, contractAddress,
  ContractProvider, Sender, SendMode,
} from '@ton/core';

export const AGENT_ITEM_OPS = {
  transfer: 0x5fcc3d14,
  get_static_data: 0x2fcb26a2,
  update_caps: 0x54415043,
};

export type AgentItemConfig = {
  index: number | bigint;
  collectionAddress: Address;
};

// state_init data: index + collection (остальное приходит init-сообщением от коллекции)
export function agentItemConfigToCell(c: AgentItemConfig): Cell {
  return beginCell().storeUint(c.index, 64).storeAddress(c.collectionAddress).endCell();
}

// agent_data:^[ capabilities_hash:uint256 reputation_ptr:^Cell tap_agent_id:uint64 ]
export function buildAgentData(capsHash: bigint, reputationPtr: Cell, tapAgentId: number | bigint): Cell {
  return beginCell().storeUint(capsHash, 256).storeRef(reputationPtr).storeUint(tapAgentId, 64).endCell();
}

// payload, который коллекция шлёт item'у при минте (item init: owner, content, agent_data)
export function buildItemInitPayload(owner: Address, content: Cell, agentData: Cell): Cell {
  return beginCell().storeAddress(owner).storeRef(content).storeRef(agentData).endCell();
}

export class AgentItem implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new AgentItem(address);
  }

  static createFromConfig(config: AgentItemConfig, code: Cell, workchain = 0) {
    const data = agentItemConfigToCell(config);
    const init = { code, data };
    return new AgentItem(contractAddress(workchain, init), init);
  }

  async sendTransfer(
    provider: ContractProvider, via: Sender, value: bigint,
    opts: { newOwner: Address; responseTo?: Address | null; forwardAmount?: bigint },
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(AGENT_ITEM_OPS.transfer, 32)
        .storeUint(0, 64)
        .storeAddress(opts.newOwner)
        .storeAddress(opts.responseTo ?? via.address ?? null)
        .storeBit(false) // custom_payload: nothing
        .storeCoins(opts.forwardAmount ?? 0n)
        .endCell(),
    });
  }

  async sendUpdateCaps(
    provider: ContractProvider, via: Sender, value: bigint,
    opts: { capsHash: bigint; reputationPtr: Cell },
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(AGENT_ITEM_OPS.update_caps, 32)
        .storeUint(0, 64)
        .storeUint(opts.capsHash, 256)
        .storeRef(opts.reputationPtr)
        .endCell(),
    });
  }

  async getNftData(provider: ContractProvider) {
    const res = await provider.get('get_nft_data', []);
    return {
      init: res.stack.readBoolean(),
      index: res.stack.readBigNumber(),
      collection: res.stack.readAddressOpt(),
      owner: res.stack.readAddressOpt(),
      content: res.stack.readCellOpt(),
    };
  }

  async getAgentData(provider: ContractProvider) {
    const res = await provider.get('get_agent_data', []);
    return {
      capabilitiesHash: res.stack.readBigNumber(),
      reputationPtr: res.stack.readCell(),
      tapAgentId: res.stack.readBigNumber(),
    };
  }

  // Провенанс: оригинальный автор + история продаж
  async getProvenance(provider: ContractProvider) {
    const res = await provider.get('get_provenance', []);
    return {
      creator: res.stack.readAddressOpt(),       // оригинальный автор (не меняется)
      mintTime: res.stack.readBigNumber(),
      transferCount: res.stack.readBigNumber(),   // сколько раз продан
      lastSeller: res.stack.readAddressOpt(),     // кто последний продал
      lastTransferTime: res.stack.readBigNumber(),
    };
  }
}
