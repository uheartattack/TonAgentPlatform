# TAP v3.0 — On-chain контракты (Phase 1: Identity)

> Канон-дизайн: [../V3_AUTONOMOUS_NETWORK.md](../V3_AUTONOMOUS_NETWORK.md). Это реализация **Phase 1 (Identity)**.
> Язык: **FunC** (на основе каноничных TEP-62 референсов — безопаснее для контрактов с ассетами). При желании → конвертация в Tolk через скилл `func2tolk`.
> Сборка/тесты: TON **Blueprint** (`@ton/blueprint`). Деплой: сначала **testnet** (грант 5000 testnet GRAM), потом mainnet.
>
> ✅ **СТАТУС (2026-06-18): компилируется + 7 sandbox-тестов зелёные + деплой-скрипты готовы.**
> Проверено логикой: SBT непередаваем (411), revoke только authority (403), минт агента+инкремент индекса, transfer меняет владельца, update_caps только owner (401), royalty 2.5%.
> Осталось: запустить деплой на **testnet** (`npx blueprint run ... --testnet`, нужен кошелёк с testnet-GRAM) → прогон на testnet → **аудит** → mainnet. НЕ аудировано.

---

## Нейминг (ребрендинг 2026-06-15)
Сеть = **TON** (контракты, TON DNS, SDK). Монета/суммы = **GRAM** (бывш. Toncoin). В коде используем нативную монету TON-чейна (теперь тикер GRAM); комментарии — GRAM.

## Контракты Phase 1

| Контракт | Файл | Что | Стандарт |
|---|---|---|---|
| **Owner SBT** | `contracts/owner-sbt.fc` | Soulbound «паспорт» владельца. Минт при онбординге, непередаваемый. Хранит непрозрачный TAP-user-id (НЕ Telegram id). | TEP-85 (SBT) |
| **Agent Collection** | `contracts/agent-collection.fc` | TEP-62 коллекция = **реестр** всех агентов. Минтит item'ы, хранит royalty (2.5% вторичка). | TEP-62 + TEP-66 royalty |
| **Agent Item** | `contracts/agent-item.fc` | NFT агента (торгуемый). Хранит agent_id, **capabilities_hash (KYA-манифест)**, указатель на репутацию, **провенанс** (creator/счётчик продаж/last_seller). Передача = передача агента. | TEP-62 |
| **Escrow** | `contracts/escrow.fc` | Эскроу сделки (Phase 1.5): баунти лочится → claim → deliver → accept/auto-release → релиз (−5% TAP) / refund по таймауту/reject. | custom |

> Реестр = сама коллекция: знает все заминченные агенты (next_item_index), адреса item'ов (детерминированы), владельцев (через владение item'ом). Отдельный Registry-контракт не нужен.

## Storage (схемы)

**Owner SBT (item):**
```
index:uint64  collection:MsgAddress  owner:MsgAddress(soulbound, set at mint)
content:^Cell  authority:MsgAddress(TAP, для revoke)  revoked_at:uint64
```
Transfer-op → **throw** (непередаваемый). Поддерживает `prove_ownership` (TEP-85).

**Agent Collection:**
```
owner_address:MsgAddress(TAP)  next_item_index:uint64
content:^[collection_content:^Cell common_content:^Cell]
nft_item_code:^Cell  royalty_params:^[num:uint16 den:uint16 dest:MsgAddress]
```
Ops: `mint`(1), `batch_mint`(2), `change_owner`(3), `change_content`(4), `get_royalty_params`(0x693d3950).

**Agent Item:**
```
index:uint64  collection:MsgAddress  owner:MsgAddress  content:^Cell
agent_data:^[ capabilities_hash:uint256  reputation_ptr:^Cell  tap_agent_id:uint64 ]
```
Ops: `transfer`(0x5fcc3d14) → смена владельца (= продажа агента; индексер ловит и биндит в ЛК), `get_static_data`(0x2fcb26a2), кастомный `update_caps`(owner-only) для обновления capabilities_hash/reputation_ptr.

## Приватность
On-chain НЕТ сырого Telegram id. Owner SBT хранит непрозрачный `tap_user_id`. Маппинг `tap_user_id ↔ tg_id ↔ wallet` — только off-chain в БД (см. канон-дизайн).

## Off-chain мост (вне этого пакета, в builder-bot)
Индексер слушает события коллекции/item'ов → апдейтит `agent-reputation.ts` + общую доску задач + биндинг агента в ЛК при transfer. См. канон-дизайн.

---

## Сборка / тесты / деплой

```bash
cd contracts
npm install
npx blueprint build            # компиляция FunC → BoC
npx blueprint test             # юнит-тесты в @ton/sandbox
npx blueprint run deployAgentCollection --testnet   # деплой на testnet
```

**Prereqs:** нужен `imports/stdlib.fc` (FunC stdlib — Blueprint тянет через `@ton/func`/компилятор; либо скопировать из каноники `ton-core/crypto/func/.../stdlib.fc`).

## Готово
1. ✅ Wrappers (`wrappers/OwnerSbt.ts`, `AgentCollection.ts`, `AgentItem.ts`).
2. ✅ Tests (`tests/Identity.spec.ts`) — 7 sandbox-сценариев, все зелёные.
3. ✅ Deploy scripts (`scripts/deployAgentCollection.ts`, `deployOwnerSbt.ts`).

## Дальше
4. Запустить деплой на testnet (нужен кошелёк): `npx blueprint run deployAgentCollection --testnet`.
5. `*.tonagent.ton` DNS — привязка поддомена к item при минте (отдельный шаг).
6. Off-chain индексер в builder-bot (мост: transfer → бинд агента в ЛК; апдейт репутации/доски).
7. Escrow-контракт — Phase 1.5 (economy).
8. Аудит контрактов перед mainnet.
