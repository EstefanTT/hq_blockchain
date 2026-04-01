# core/execution/

Trade execution pipeline — from intent to on-chain settlement.

| File | Step |
|---|---|
| `buildOrder.js` | Construct a normalized order object from parameters |
| `routeTrade.js` | Choose the best venue (DEX/CEX) and route for execution |
| `simulateTrade.js` | Dry-run a trade to estimate outcome before committing |
| `executeTrade.js` | Send the trade to the chosen venue and track confirmation |
| `slippage.js` | Slippage calculation, tolerance checks, worst-case estimates |
| `fees.js` | Fee estimation (gas + protocol fees + potential MEV costs) |

All functions are chain-agnostic — they call connectors for chain-specific operations.
