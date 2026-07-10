import { Config } from '@ton/blueprint';

// Blueprint config for TAP v3.0 Identity contracts.
// Network is chosen per-run via `--testnet` / `--mainnet`.
// Default: testnet (см. README — обкатка на testnet перед mainnet).
export const config: Config = {
  network: {
    type: 'testnet',
  },
};
