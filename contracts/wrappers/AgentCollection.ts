import {
  Address, beginCell, Cell, Contract, contractAddress,
  ContractProvider, Sender, SendMode,
} from '@ton/core';

export const AGENT_COLLECTION_OPS = {
  mint: 1,
  batch_mint: 2,
  change_owner: 3,
  change_content: 4,
  get_royalty_params: 0x693d3950,
};

export type RoyaltyParams = {
  numerator: number;     // напр. 250
  denominator: number;   // напр. 10000  → 2.5%
  destination: Address;  // куда роялти (TAP)
};

export type AgentCollectionConfig = {
  ownerAddress: Address;       // TAP
  nextItemIndex: number | bigint;
  collectionContent: Cell;     // напр. offchain metadata cell
  commonContent: Cell;         // base URI для item'ов
  nftItemCode: Cell;           // compiled AgentItem code
  royalty: RoyaltyParams;
};

export function agentCollectionConfigToCell(c: AgentCollectionConfig): Cell {
  const content = beginCell()
    .storeRef(c.collectionContent)
    .storeRef(c.commonContent)
    .endCell();
  const royalty = beginCell()
    .storeUint(c.royalty.numerator, 16)
    .storeUint(c.royalty.denominator, 16)
    .storeAddress(c.royalty.destination)
    .endCell();
  return beginCell()
    .storeAddress(c.ownerAddress)
    .storeUint(c.nextItemIndex, 64)
    .storeRef(content)
    .storeRef(c.nftItemCode)
    .storeRef(royalty)
    .endCell();
}

export class AgentCollection implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new AgentCollection(address);
  }

  static createFromConfig(config: AgentCollectionConfig, code: Cell, workchain = 0) {
    const data = agentCollectionConfigToCell(config);
    const init = { code, data };
    return new AgentCollection(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // Минт одного агента. itemInitPayload = buildItemInitPayload(owner, content, agentData).
  async sendMint(
    provider: ContractProvider, via: Sender, value: bigint,
    opts: { itemIndex: number | bigint; itemValue: bigint; itemInitPayload: Cell },
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(AGENT_COLLECTION_OPS.mint, 32)
        .storeUint(0, 64)
        .storeUint(opts.itemIndex, 64)
        .storeCoins(opts.itemValue)
        .storeRef(opts.itemInitPayload)
        .endCell(),
    });
  }

  async getCollectionData(provider: ContractProvider) {
    const res = await provider.get('get_collection_data', []);
    return {
      nextItemIndex: res.stack.readBigNumber(),
      content: res.stack.readCell(),
      owner: res.stack.readAddress(),
    };
  }

  async getNftAddressByIndex(provider: ContractProvider, index: number | bigint): Promise<Address> {
    const res = await provider.get('get_nft_address_by_index', [
      { type: 'int', value: BigInt(index) },
    ]);
    return res.stack.readAddress();
  }

  async getRoyaltyParams(provider: ContractProvider) {
    const res = await provider.get('royalty_params', []);
    return {
      numerator: res.stack.readBigNumber(),
      denominator: res.stack.readBigNumber(),
      destination: res.stack.readAddress(),
    };
  }
}
