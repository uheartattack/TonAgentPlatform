---
name: web3-monitor
description: On-chain monitoring — wallet activity, contract events, price alerts, and threshold-based notifications. Use when the user wants to be notified about TON wallet movements, jetton price thresholds, NFT sales of a watched collection, or any "tell me when X happens" task. Read BEFORE picking tools — monitoring agents have STRICT anti-spam rules and dedup requirements.
license: Proprietary. TON Agent Platform.
compatibility: Requires `blockchain` + `notify` capabilities. Monitoring agents typically run on an interval (ai_agent trigger).
metadata:
  category: monitoring
  version: "1.0"
---

# On-Chain Monitoring

## Tool selection

- `ton_get_transactions(addr, limit)` — get recent transactions on an address.
- `ton_emulate_tx(boc)` — preview a transaction (read-only, no fee).
- `dex_get_prices(token)` — current token prices.
- `get_nft_floor(addr)` — collection floor for a watched NFT.
- `set_state` / `get_state` — store the "last seen" cursor for dedup.

## Monitoring loop pattern

```
1. Read last_seen_lt from agent_state.
2. ton_get_transactions(addr, limit=20) → list of txs.
3. Filter tx.lt > last_seen_lt → new txs only.
4. For each new tx:
   - Apply user's filter (amount > X, sender=Y, etc.)
   - If match → push to findings array.
5. If findings non-empty → notify_rich() ONCE with summary.
6. set_state('last_seen_lt', max(tx.lt)).
```

**Critical**: the cursor (`last_seen_lt`) prevents re-notifying about the
same tx on the next tick. ALWAYS update it after a successful run.

## Anti-spam rules (STRICT)

- **One notify per tick.** Combine all findings into ONE message.
- If no findings → finish silently. NO "no new activity" notifications.
- If the same event was already notified within `dedup_window_sec` (default 1h)
  → skip.
- Respect `tick_interval_sec` — don't auto-decrease it. If you need faster
  monitoring, surface it to the user via `update_my_interval` with reasoning.

## Threshold notifications

```
1. Read threshold from agent config (e.g. notify_above_ton: 10000).
2. Read current price via dex_get_prices.
3. Compare: if price ≥ threshold and last_alert_state ≠ 'above' →
   notify, set_state('last_alert_state', 'above').
4. If price < threshold and last_alert_state ≠ 'below' →
   notify, set_state('last_alert_state', 'below').
```

The `last_alert_state` flag prevents oscillation spam when price is near
the threshold.

## Failure modes

- TonAPI rate limit (429): back off 60s, retry. Don't escalate.
- Address not found: tell user, then disable monitoring (`request_pause`).
- Empty transaction list: address has no activity — set cursor to 0 and
  poll less frequently (suggest 30 min interval).

## Composability

If user wants "monitor gift floor AND notify me" → READ the `gifts` skill
too. The monitoring loop above is generic; the data-fetching tools come
from the domain skill.
