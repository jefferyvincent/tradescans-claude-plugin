---
name: analyze-performance
description: >
  Analyze the user's TradeScans trading performance. Use when the user asks to
  review their trades, "how did my trades do", win rate, P&L, performance by
  symbol or setup, open positions review, or wants insights from their trade
  history.
---

# Analyze TradeScans performance

Pull the user's trades through the TradeScans MCP tools and analyze them.

## Steps

1. Decide the window. If the user gives a date range or symbol, pass it through.
   Otherwise default to the last 30 days of closed trades.
2. Call `get_trades` (use `status: "closed"` for realized performance, or no
   status for everything). For a positions review, call `get_open_positions`.
   Page with `limit`/`offset` if there are more than ~100 rows.
3. Compute the metrics that answer the question. Common ones:
   - Win rate = winning trades / closed trades (use `realized_pnl > 0`).
   - Total and average realized P&L; best and worst trades.
   - Breakdowns by `symbol`, `spread_type`, or `setup_tag`.
   - Average hold time from `entry_date` to `exit_date`.
4. Report the numbers plainly, then 2-3 concrete observations. Reference
   specific trades by symbol and date. Do not give financial advice or tell the
   user what to trade next — summarize what their own data shows.

## Notes

- `realized_pnl` is in dollars; `legs` is JSON describing the option legs.
- If `get_trades` returns an auth error, the user's API key is missing the
  `trades:read` scope or `TRADESCANS_API_KEY` is unset — tell them how to fix it
  (see the plugin README).
