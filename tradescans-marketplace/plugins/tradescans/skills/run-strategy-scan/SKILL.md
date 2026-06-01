---
name: run-strategy-scan
description: >
  Run the TradeScans options strategy engine for a ticker. Use when the user
  asks for strategy ideas, an options scan, "what should I trade on X",
  "scan AAPL", "find me a play on", or wants the engine's ranked option
  strategies for a symbol.
---

# Run a TradeScans strategy scan

Use the `run_strategy_scan` MCP tool to run the engine for a symbol.

## Steps

1. Get the `symbol` (required). Ask for it if missing. The user's usual
   watchlist is SPY, QQQ, and TSLA — if they ask for a scan without naming a
   symbol, suggest one of these.
2. Pick `profile` and `overlay` if the user expressed risk appetite or intent.
   Otherwise default to this user's preferences: `conservative` profile,
   `income` overlay.
   - `profile`: ultra_conservative | conservative (default) | moderate |
     aggressive | ultra_aggressive.
   - `overlay`: income (default) or growth.
3. Call `run_strategy_scan`. The engine fetches live option-chain data server
   side and returns the top ranked candidates with scores and structure.
4. Present the ranked results clearly: strategy type, legs/strikes, key metrics
   (probability of profit, max profit/loss, score). Summarize why the top pick
   ranked highest based on the returned data.

## Important

- Present this as what the engine computed from current market data, not as
  financial advice or a recommendation to trade.
- A 404 "no scan result" means there was no usable option chain for the symbol.
  A 503 means the server's market-data key isn't configured. A scope error means
  the key lacks `strategy:run` — see the plugin README.
