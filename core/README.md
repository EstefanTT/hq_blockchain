# core/

Chain-agnostic domain logic — the business rules of the application. Core decides **what** to do. Connectors handle **how** to do it on a specific chain/exchange.

## File Inventory

| Folder | Purpose | Key Exports |
|---|---|---|
| `execution/` | Trade pipeline: build → route → simulate → execute | `buildOrder()`, `routeTrade()`, `simulateTrade()`, `executeTrade()`, `setDryRun()`, `isDryRunEnabled()`, `createDryRunWrapper()` |
| `market/` | Price aggregation, quotes from multiple venues, volatility | `PriceEngine` class, `prices.js`, `quotes.js`, `volatility.js` |
| `portfolio/` | Balance tracking, position management, PnL calculation | `balances.js`, `pnl.js`, `positions.js` |
| `risk/` | Guards that run before every trade: limits, liquidity, kill switch, rebalance | `activate()`, `deactivate()`, `isKilled()`, `initRebalance()`, `checkAndRebalance()`, `createSlippageGuard()` |
| `nft/` | NFT domain logic (placeholder — not yet implemented) | — |

## Interface Contract

Core modules are imported directly by strategies and apps:

```js
import { executeTrade } from '../../core/execution/executeTrade.js';
import { PriceEngine } from '../../core/market/priceEngine.js';
import { isKilled, activate } from '../../core/risk/killSwitch.js';
import { initRebalance } from '../../core/risk/rebalance.js';
```

### Execution pipeline

`buildOrder` → `routeTrade` → `simulateTrade` → `executeTrade`

Each step receives the output of the previous one. `slippage.js` and `fees.js` are helpers used within the pipeline. `dryRun.js` wraps adapters to log trades without executing.

### Risk module

All risk checks run before a trade is executed. The kill switch (`killSwitch.js`) halts all trading instantly. Rebalance (`rebalance.js`) adjusts positions to maintain target allocations. Slippage guard (`slippageCheck.js`) wraps adapters with slippage monitoring.

## Dependencies

- `connectors/` — for chain/exchange operations (via registry pattern)
- `services/cache` — for reading/writing runtime state
- `services/storage` — for persisting trades and positions

## Conventions

- If the logic is about **deciding** whether/what/how to trade → it goes in `core/`
- If the logic is about **talking to a specific protocol** → it goes in `connectors/`
- Core never knows which chain or DEX it's talking to — it uses registry lookups
