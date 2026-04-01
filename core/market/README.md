# core/market/

Market data aggregation — prices, quotes, volatility.

| File | Role |
|---|---|
| `prices.js` | Aggregate prices from multiple sources (DEXes, CEXes, APIs) |
| `quotes.js` | Get best quote for a token pair across all available venues |
| `volatility.js` | Volatility calculations (realized vol, ATR, Bollinger bands) |

Pulls data from connectors and caches results via `services/cache/`.
