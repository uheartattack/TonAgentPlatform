---
name: acton
description: Acton — Rust-based CLI toolkit for TON smart contract development. Use when the user wants to create, compile, test, deploy, or verify a TON smart contract written in Tolk. Covers project scaffolding, the Acton.toml manifest, deployment scripts, wallet management (local + global), and CI/CD integration. Read BEFORE choosing tools — Acton commands have specific argument structures and the manifest schema is strict.
license: Adapted from https://github.com/ton-blockchain/acton-contracts (Apache 2.0)
compatibility: Requires Acton CLI installed (`cargo install acton-cli` or `npm install -g @ton-blockchain/acton`). Designed for projects with an `Acton.toml` at the root.
metadata:
  category: ton-dev
  version: "1.0"
  upstream: https://ton-blockchain.github.io/acton/
---

# Acton — TON Smart Contract Development CLI

## What Acton is

Acton is TON's all-in-one Rust-based CLI for the contract lifecycle:
**scaffold → compile → lint → test → deploy → verify**.

Equivalent to Hardhat (Solidity) / Foundry for TON's Tolk language.

## Project layout

A standard Acton project:

```
my-contract/
├── Acton.toml          # Manifest: metadata, deps, network, scripts
├── contracts/
│   └── main.tolk       # Source
├── tests/
│   └── main.spec.ts    # Integration tests
├── scripts/
│   └── deploy.ts       # Custom deployment scripts
└── build/              # Compiled artifacts (gitignored)
```

## Acton.toml manifest

Minimal schema:

```toml
[package]
name = "my-contract"
version = "0.1.0"

[contract]
entry = "contracts/main.tolk"
optimize = true

[network.mainnet]
endpoint = "https://toncenter.com/api/v2"
api_key = "${TON_API_KEY}"

[network.testnet]
endpoint = "https://testnet.toncenter.com/api/v2"

[scripts]
deploy = "scripts/deploy.ts"
```

Don't hand-edit `[contract]` fields the user hasn't mentioned — leave Acton's
defaults in place.

## Common commands

| Goal                       | Command                                      |
| -------------------------- | -------------------------------------------- |
| Scaffold new project       | `acton init <name>`                          |
| Compile                    | `acton build`                                |
| Lint                       | `acton check`                                |
| Format                     | `acton fmt`                                  |
| Run tests                  | `acton test`                                 |
| Test with coverage         | `acton test --coverage`                      |
| Mutation testing           | `acton test --mutate`                        |
| Deploy to testnet          | `acton deploy --network testnet`             |
| Verify deployed bytecode   | `acton verify <address>`                     |
| Wallet — list local        | `acton wallet list`                          |
| Wallet — create            | `acton wallet new <name>`                    |

## Wallet management

- **Local wallets**: stored in `~/.acton/wallets/<name>.json` (encrypted).
- **Global wallets**: same dir, available across all Acton projects.
- ⚠️ NEVER `acton wallet export <name>` and put the mnemonic in any output.
  See `ton-wallet` skill for full mnemonic rules.

## CI/CD integration

Acton is designed for `--non-interactive` mode in CI:

```yaml
- name: Build
  run: acton build --strict
- name: Test
  run: acton test --coverage
- name: Lint
  run: acton check --error-on-warn
```

`--strict` fails build on any warning. Use in CI; not for local dev.

## When NOT to use Acton

- Pure read-only blockchain queries → use `ton-blockchain` skill instead.
- Writing FunC (old language) → use `func2tolk` skill to migrate first.
- Quick contract experiments — Acton scaffold is opinionated, lighter setups
  work directly with `func` + `fift` CLIs.

## See also

- `tolk` skill — language-level details.
- `func2tolk` skill — migrate FunC contracts to Tolk.
- `ton-blockchain` skill — runtime/RPC context.
