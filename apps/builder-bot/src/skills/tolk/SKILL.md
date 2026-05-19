---
name: tolk
description: Tolk — the recommended language for TON smart contracts (replaces FunC). Statically typed, declarative cell layouts, automatic serialization via `lazy`, pattern-matched message handling via `match`, contract ABI/TS-wrappers/source-maps generated from the `contract` declaration. Use when writing, reading, or debugging Tolk contracts. Compiles via Acton toolchain to Fift → TVM. Read BEFORE picking tools — syntax is NOT FunC.
license: Reflects official TON Foundation docs (docs.ton.org/blockchain-basics/tolk). Local skill content under TAP proprietary license.
compatibility: Requires Acton toolchain for compile/test/deploy. IDE: JetBrains plugin, VS Code extension, or any LSP client (Vim/Neovim/Helix) via ton-language-server.
metadata:
  category: ton-dev
  version: "2.0"
  upstream: https://docs.ton.org/blockchain-basics/tolk/overview
---

# Tolk — TON's typed contract language

## Why Tolk (and why NOT FunC for new code)

Official position: Tolk is the **recommended** language for TON smart contracts.
FunC is now legacy. Reasons Tolk wins:

- **Static types** for storage layouts, message bodies, return values — compile-time checked.
- **Declarative data structures** — `struct` + `type` define the wire format once; serialize/deserialize is automatic.
- **`lazy` deserialization** — skip fields you don't read on this code path; saves gas.
- **`match` expressions** — pattern-match on union message types, exhaustively.
- **`contract` keyword** drives codegen: ABI export, TypeScript wrapper, source maps for debugger.
- **TypeScript-like syntax** — easier to read than stack-based FunC.

## Minimal contract — modern Tolk

```tolk
// Storage struct
struct Storage {
    counter: uint32;
    owner: address;
}

// Message variants — union type
struct CounterIncrement { by: uint32; }
struct CounterReset { newOwner: address; }
type AllowedMessage = CounterIncrement | CounterReset;

// Contract declaration — drives ABI/TS-wrapper codegen
contract Counter {
    storage: Storage;
    incomingMessages: AllowedMessage;
}

// Main internal-message entry point
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        CounterIncrement => {
            val storage = lazy Storage.load();
            storage.counter += msg.by;
            storage.save();
        }
        CounterReset => {
            val storage = lazy Storage.load();
            storage.counter = 0;
            storage.owner = msg.newOwner;
            storage.save();
        }
    }
}

// Get-method (read-only RPC)
get fun currentCounter(): uint32 {
    val storage = lazy Storage.load();
    return storage.counter;
}
```

This is the **canonical pattern** (per docs.ton.org). Notice:
- `val` for immutable bindings (use `var` for mutable).
- `lazy` on `Storage.load()` and `AllowedMessage.fromSlice()` — deferred
  parsing; fields are only decoded when accessed.
- `match` exhaustively dispatches across union variants.
- `get fun` declares an externally callable get-method (read-only).
- No manual `beginParse` / `loadUint(64)` chains — `lazy` + the struct
  definition handle that.

## Key concepts

### `lazy` — deferred deserialization

```tolk
val msg = lazy AllowedMessage.fromSlice(in.body);
```

The slice is NOT fully parsed up front. Fields are decoded only when read.
On hot paths where only the discriminator is needed (to route via `match`),
this skips parsing the rest of the body → measurable gas savings.

Always prefer `lazy` for inbound messages unless you'll definitely read
every field.

### Union types via `type ... = A | B | C`

```tolk
type AllowedMessage = CounterIncrement | CounterReset | Withdraw;
```

Each variant is a struct. The compiler synthesizes a `op` (opcode)
discriminator from the wire layout and routes correctly.

### `match` — exhaustive pattern matching

```tolk
match (msg) {
    CounterIncrement => { /* msg fields accessible here */ }
    CounterReset => { /* … */ }
    Withdraw => { /* … */ }
}
```

If you forget a variant, the compiler refuses to build. If you handle an
impossible variant, it warns. This eliminates the entire class of
"forgot to handle op=0xXXX" bugs that plague FunC.

### `contract Counter { … }` declaration

Replaces FunC's implicit "this file is a contract". Drives:
- **ABI export** — JSON describing all message types + get-methods.
- **TypeScript wrapper** — auto-generated `class Counter { ... }` for dApp side.
- **Source maps** — debugger can step through `.tolk` lines in TVM emulator.

## Standard library

Lives in the Acton repo (`ton-blockchain.github.io/acton/docs/tolk_standard_library/overview`).
Imports look like:

```tolk
import "@stdlib/common";
import "@stdlib/jetton";
```

Covers: cell ops, addresses, math, jetton helpers, NFT helpers, time,
signatures.

## Tooling

| Need                       | Tool                                                         |
| -------------------------- | ------------------------------------------------------------ |
| Compile                    | `acton build` (via Acton CLI; see `acton` skill)            |
| IDE — JetBrains            | TON / Tolk plugin                                            |
| IDE — VS Code              | TON / Tolk extension                                         |
| IDE — Vim / Neovim / Helix | LSP via `github.com/ton-blockchain/ton-language-server`      |
| Gas benchmarks             | `github.com/ton-blockchain/tolk-bench`                       |
| Migration from FunC        | `func2tolk` converter (see `func2tolk` skill)                |
| Tests                      | Acton test runner, integration with TVM emulator             |

## Migration from FunC

Official path:
1. Run the FunC → Tolk converter on the existing `.fc` file.
2. Review the generated `.tolk` — the converter is conservative; some
   patterns require manual rewrite into idiomatic `struct` + `lazy` + `match`.
3. Compile both versions, compare gas profile via `tolk-bench`.
4. Acton supports mixed `.fc` + `.tolk` in one project during migration.

For details see the `func2tolk` skill or the official "Tolk vs FunC" guide.

## Performance / gas

- `lazy` deserialization is a meaningful win when message bodies are large
  but only some fields are read on the hot path.
- Get-methods that read few storage fields benefit from `lazy Storage.load()`.
- The compiler is smart about inlining; `@inline` annotations are usually
  unnecessary in Tolk (were needed in FunC for hot helpers).
- Real numbers live in `tolk-bench` repo.

## Common pitfalls (NOT in upstream docs but stuff agents will hit)

- **`lazy` + writes**: `lazy Storage.load()` returns a handle. Writing to its
  fields and calling `.save()` works, BUT only fields you actually wrote get
  re-serialized; unread fields stay as in the original slice. If you want to
  re-emit everything, force-read each field first or skip `lazy`.
- **`match` is exhaustive**: you cannot have a "default" arm without
  explicitly enumerating all union members. Add a catch-all variant to the
  union if you need fallback behavior.
- **`contract` keyword is required** for ABI/TS-wrapper generation. If you
  see "no ABI emitted" from Acton, you forgot it.
- **Booleans**: TVM has none. Tolk maps `bool` to `int` (0 = false, -1 = true).
  Don't compare `bool` to numeric literals other than 0 / -1.
- **No floating-point**: keep TON amounts in `nanoCoins` (uint128). Use
  fixed-point integer math for fractional logic.

## See also

- `acton` skill — CLI, build, deploy, project layout.
- `func2tolk` skill — migrate FunC contracts.
- `ton-blockchain` skill — runtime model, message semantics, TIPs.
- Official Tolk overview: `docs.ton.org/blockchain-basics/tolk/overview`
- Tolk language server: `github.com/ton-blockchain/ton-language-server`
- Tolk gas benchmarks: `github.com/ton-blockchain/tolk-bench`
- Standard library docs: `ton-blockchain.github.io/acton/docs/tolk_standard_library/overview`
