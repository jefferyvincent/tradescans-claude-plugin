---
name: log-trade
description: >
  Log, edit, or close a trade in TradeScans. Use when the user says they
  "bought", "sold", "opened", "entered", or "closed" a position, wants to record
  a trade, add notes or lessons to a trade, mark a trade closed, or update trade
  details.
---

# Log a trade in TradeScans

Record or update trades through the TradeScans MCP tools.

## Creating a trade

Use `create_trade`. Required fields: `symbol`, `spread_type`, `entry_date`
(YYYY-MM-DD), `entry_price`. Gather anything the user states and pass it through:
`status` (defaults to open), `legs`, `notes`, `tags`, `setup_rationale`,
`max_profit`, `max_loss`.

- Confirm the parsed details back to the user before writing if anything is
  ambiguous (especially the symbol, direction, strikes, and price).
- `spread_type` is a free string the app understands. This user trades mostly
  long calls and puts, so assume `long_call` or `long_put` (inferred from
  direction) unless they say otherwise. Other valid values: `bull_put_credit`,
  `covered_call`, `iron_condor`.
- `legs` is a JSON array of option legs. Only include it if the user gives leg
  detail; otherwise omit it.

## Editing a trade

Use `update_trade` with the trade `id` plus only the fields to change (notes,
tags, lessons_learned, is_favorite, status). Get the `id` from a prior
`get_trades` call if you don't have it.

## Closing a trade

Use `close_trade` with `id`, `exit_date`, `exit_price`, and optionally
`realized_pnl`, `exit_reason`, `closing_remarks`. It sets status to closed.

## After writing

Report what was created or changed, echoing the returned trade `id` so the user
can reference it. If the call returns a scope/auth error, the key is missing
`trades:write` — point the user to the plugin README.
