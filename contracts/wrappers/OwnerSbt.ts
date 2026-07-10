import {
  Address, beginCell, Cell, Contract, contractAddress,
  ContractProvider, Sender, SendMode,
} from '@ton/core';

export const OWNER_SBT_OPS = {
  transfer: 0x5fcc3d14,
  prove_ownership: 0x04ded148,
  request_owner: 0xd0c3bfea,
  destroy: 0x1f04537a,
  revoke: 0x6f89f5e3,
};

export type OwnerSbtConfig = {
  index: number | bigint;      // непрозрачный tap_user_id
  ownerAddress: Address;
  authorityAddress: Address;   // TAP — может revoke
  content: Cell;
  collectionAddress?: Address | null; // standalone → null (addr_none)
};

export function ownerSbtConfigToCell(c: OwnerSbtConfig): Cell {
  return beginCell()
    .storeUint(c.index, 64)
    .storeAddress(c.collectionAddress ?? null)
    .storeAddress(c.ownerAddress)
    .storeRef(c.content)
    .storeAddress(c.authorityAddress)
    .storeUint(0, 64) // revoked_at
    .endCell();
}

export class OwnerSbt implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new OwnerSbt(address);
  }

  static createFromConfig(config: OwnerSbtConfig, code: Cell, workchain = 0) {
    const data = ownerSbtConfigToCell(config);
    const init = { code, data };
    return new OwnerSbt(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // Попытка передачи — контракт ДОЛЖЕН бросить (soulbound, exit 411).
  async sendTransfer(provider: ContractProvider, via: Sender, value: bigint, newOwner: Address) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(OWNER_SBT_OPS.transfer, 32)
        .storeUint(0, 64)
        .storeAddress(newOwner)
        .storeAddress(via.address ?? null)
        .storeBit(false)   // custom_payload: nothing
        .storeCoins(0)     // forward_amount
        .endCell(),
    });
  }

  async sendRevoke(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OWNER_SBT_OPS.revoke, 32).storeUint(0, 64).endCell(),
    });
  }

  async getNftData(provider: ContractProvider) {
    const res = await provider.get('get_nft_data', []);
    return {
      init: res.stack.readBoolean(),
      index: res.stack.readBigNumber(),
      collection: res.stack.readAddressOpt(),
      owner: res.stack.readAddressOpt(),
      content: res.stack.readCell(),
    };
  }

  async getAuthority(provider: ContractProvider) {
    const res = await provider.get('get_authority_address', []);
    return res.stack.readAddressOpt();
  }

  async getRevokedTime(provider: ContractProvider): Promise<bigint> {
    const res = await provider.get('get_revoked_time', []);
    return res.stack.readBigNumber();
  }
}
