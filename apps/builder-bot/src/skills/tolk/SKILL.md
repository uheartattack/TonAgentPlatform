---
name: tolk
description: Tolk — the modern strongly-typed smart contract language for TON. Use when writing, reading, or debugging Tolk contracts. Covers typed storage, message schemas, gas optimization, and the standard library. Read BEFORE choosing tools — Tolk is NOT FunC; syntax and idioms differ significantly. If the user has a FunC file, read `func2tolk` first.
license: Adapted from https://github.com/ton-blockchain/acton-contracts (Apache 2.0)
compatibility: Designed for Tolk language as compiled by Acton CLI. Tolk version pinning is in Acton.toml.
metadata:
  category: ton-dev
  version: "1.0"
  upstream: https://docs.ton.org/develop/dapps/tolk
---

# Tolk — TON's Typed Contract Language

## Why Tolk over FunC

- **Static types**: storage layout, message bodies, return types — all
  checked at compile time.
- **Familiar syntax**: TypeScript-like, easier to learn.
- **Better tooling**: LSP support, formatter, mutation testing.
- **Gas-aware**: compiler hints for hot paths.

## Minimal contract

```tolk
import "@stdlib/common";

global storage: cell;

@inline
fun loadStorage(): (int, slice) {
    val s = storage.beginParse();
    return (s.loadUint(64), s.loadRef());
}

@inline
fun saveStorage(seqno: int, owner: slice) {
    storage = beginCell()
        .storeUint(seqno, 64)
        .storeSlice(owner)
        .endCell();
}

fun onInternalMessage(msgBody: slice) {
    val (seqno, owner) = loadStorage();
    // ... handle message ...
    saveStorage(seqno + 1, owner);
}
```

## Type system

| Tolk type     | Meaning                          | Cost                  |
| ------------- | -------------------------------- | --------------------- |
| `int`         | 257-bit integer                  | 1 cell slot           |
| `slice`       | TVM slice (parsed cell)          | reference             |
| `cell`        | TVM cell (raw)                   | reference             |
| `builder`     | Mutable cell builder             | reference             |
| `tuple<T>`    | Stack tuple                      | runtime tuple         |
| `(T1, T2)`    | Multi-return                     | stack-only            |

There are no booleans — use `int` with 0/-1 (TVM convention; -1 = true).

## Message schemas

Declare message structures with `struct`:

```tolk
struct TransferMessage {
    op: uint32;
    queryId: uint64;
    amount: coins;
    recipient: address;
}

fun parseTransfer(s: slice): TransferMessage {
    return TransferMessage.fromSlice(s);
}
```

This is type-safe and self-documenting; you no longer hand-parse `loadUint`
chains.

## Common patterns

### Op-code dispatch

```tolk
fun onInternalMessage(msgBody: slice) {
    if (msgBody.isEmpty()) return;
    val op = msgBody.loadUint(32);

    if (op == OP_TRANSFER) {
        handleTransfer(msgBody);
    } else if (op == OP_MINT) {
        handleMint(msgBody);
    } else {
        // Bounce unknown op
        throw_unless(0xffff, false);
    }
}
```

### Throwing with codes

```tolk
throw_unless(ERR_INSUFFICIENT_BALANCE, balance >= amount);
throw_if(ERR_DOUBLE_INIT, isInitialized);
```

Define `ERR_*` constants at module top.

## Gas optimization

- Use `@inline` for small helpers (saves CALL overhead).
- Use `@inline_ref` for helpers used in cold paths (reduces code size).
- Avoid `tuple` operations in hot loops — they cost more than `(T1, T2)`.
- Cache `storage` parse: don't `loadStorage()` twice in the same message.

## Testing

Acton runs Tolk contracts in a TVM emulator. Tests live in `tests/*.spec.ts`:

```ts
import { compile, getCode } from '@acton/test';

it('transfers ownership', async () => {
    const contract = await compile('contracts/main.tolk');
    const { result } = await contract.send({ op: OP_TRANSFER, ... });
    expect(result.exitCode).toBe(0);
});
```

## When NOT to use Tolk

- Quick prototyping → FunC is still smaller for trivial contracts.
- Existing FunC codebase → migrate gradually via the `func2tolk` skill.
- Pure deployment scripts (no contract code) → use `acton` skill directly.

## See also

- `acton` skill — CLI and project layout.
- `func2tolk` skill — migrate FunC to Tolk.
- `ton-blockchain` skill — runtime semantics.
