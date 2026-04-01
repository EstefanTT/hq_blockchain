# connectors/cex/

Centralized exchange API adapters — order placement, balance queries, market data.

Each exchange gets its own subdirectory. All implement the shared CEX interface.

**Registry**: `registry.js` maps exchange names to adapters. Usage:
```js
const binance = getCex('binance');
const balance = await binance.getBalance('USDT');
```
