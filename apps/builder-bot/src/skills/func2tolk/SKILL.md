---
name: func2tolk
description: Migrate FunC smart contracts to Tolk. Use when the user has an existing FunC (.fc) contract and wants to upgrade to Tolk, or wants to understand FunC-vs-Tolk equivalents. Covers syntax mapping, compatibility shims, and the gradual-migration strategy. Read BEFORE migrating — common idioms differ and naive conversion breaks contracts.
license: Adapted from https://github.com/ton-blockchain/acton-contracts (Apache 2.0)
compatibility: Requires both FunC source and Tolk compiler (via Acton CLI). Tolk versions ≥0.4 recommended for full FunC parity.
metadata:
  category: ton-dev
  version: "1.0"
---

# FunC → Tolk Migration

## When to migrate

Migrate FunC to Tolk when:
- Contract is < 1000 LOC (sweet spot for clean rewrite).
- You're already adding new features — migrate as part of the change.
- Audit feedback flagged type-confusion bugs (Tolk's types prevent those).

Do NOT migrate:
- Production contracts under active load — too risky for marginal benefit.
- Tiny one-off contracts (< 50 LOC) — translation overhead exceeds savings.

## Syntax mapping (quick reference)

| FunC                          | Tolk                            |
| ----------------------------- | ------------------------------- |
| `int balance`                 | `var balance: int`              |
| `(int, slice)` return         | `(int, slice)` (same)           |
| `~load_uint(s, 64)`           | `s.loadUint(64)`                |
| `~store_uint(b, x, 64)`       | `b.storeUint(x, 64)`            |
| `throw_unless(n, cond)`       | `throw_unless(n, cond)` (same)  |
| `inline` modifier             | `@inline` annotation            |
| `() get_balance() method_id`  | `get fun getBalance(): int`     |
| `cell get_data()`             | `getContractData(): cell`       |

## Gas-equivalence preservation

Tolk often compiles to SLIGHTLY larger TVM bytecode than hand-tuned FunC.
After migration, run:

```bash
acton build --compare path/to/original.fc
```

This shows side-by-side cell count + gas estimate. Tolk should be within
5% of original. Larger? File a Tolk issue OR add `@inline` annotations.

## Common pitfalls

### 1. Implicit type coercion gone

FunC freely treats `slice` as `int` when convenient. Tolk does NOT.
Always parse explicitly:

```tolk
// WRONG (won't compile):
val sender = msgBody.loadUint(256);
if (sender == storage.owner) { ... }

// RIGHT:
val senderSlice = msgBody.loadAddress();
if (senderSlice.bitsEqual(storage.owner)) { ... }
```

### 2. Storage layout changes need migration

If you change storage struct between versions, deploy a migration contract
that reads the OLD layout, transforms, and writes the NEW. Tolk's `struct`
makes this explicit:

```tolk
struct StorageV1 { seqno: uint64; owner: address; }
struct StorageV2 { seqno: uint64; owner: address; pause: bool; }

fun migrate(): cell {
    val v1 = StorageV1.fromSlice(storage.beginParse());
    val v2 = StorageV2 { seqno: v1.seqno, owner: v1.owner, pause: false };
    return v2.toCell();
}
```

### 3. Get-methods naming

FunC: `() get_balance() method_id` (snake_case, special syntax).
Tolk: `get fun getBalance(): int` (camelCase, normal fun keyword).

External callers (TonAPI, runtime) DON'T care — get-methods are looked up
by `method_id` hash. But you must explicitly set the same `method_id` for
ABI compatibility:

```tolk
@method_id(83229)  // hash of "get_balance"
get fun getBalance(): int { ... }
```

## Migration strategy (gradual)

1. **Inventory**: list all FunC files. Group by complexity (LOC, dependencies).
2. **Start small**: pick a leaf module (no callers). Translate. Run tests.
3. **Mixed mode**: Tolk and FunC can co-exist in one project. Acton compiles
   both. Migrate file-by-file.
4. **Tests first**: write tests for the FunC version BEFORE translating.
   They'll catch translation bugs immediately.
5. **Final pass**: when all `.fc` files are gone, simplify imports + delete
   FunC compatibility shims.

## See also

- `tolk` skill — language reference.
- `acton` skill — CLI commands for mixed-language builds.
