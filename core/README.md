# core/

Chain-agnostic domain logic — the business rules of the application.

Core decides **what** to do. Connectors handle **how** to do it on a specific chain/exchange.

| Module | Responsibility |
|---|---|
| **execution/** | Order building, trade routing, simulation, slippage, fees |
| **market/** | Price aggregation, quotes, volatility calculations |
| **portfolio/** | Balance tracking, position management, PnL calculation |
| **risk/** | Position limits, exposure checks, liquidity validation, kill switch |
| **nft/** | NFT domain logic (pricing, discovery, execution) |

**Dependency rule**: core imports from connectors/ and services/. It never imports from strategies/ or apps/.
