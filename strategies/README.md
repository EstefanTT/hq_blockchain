# strategies/

Self-contained trading strategies — the main business value of this app.

Each strategy is a self-contained folder with a consistent interface:
- `index.js` — exports: `init()`, `tick()`, `shutdown()`, `describe()`
- `config.schema.js` — Zod schema for the strategy's configuration
- `README.md` — what it does, parameters, risks

**Engine** (`engine/`) manages strategy lifecycle: register, start, stop, pause, backtest.

| Strategy | Description |
|---|---|
| **spread-capture/** | Captures bid-ask spread on DEX pools |
| **twap/** | Time-Weighted Average Price — split large orders over time |
| **market-making/** | Provide liquidity on both sides, profit from spread |
| **arbitrage/** | Exploit price differences across venues |
| **shared/** | Common utilities: indicators, signals, position sizing |

**Dependency rule**: strategies import from core/ and connectors/. They never import from apps/.
