# connectors/apis/

Third-party data API adapters — prices, analytics, block explorers. Each provider gets its own subfolder. All use the shared HTTP client with automatic retry and rate limiting.

## File Inventory

| Folder | Purpose | Key Exports |
|---|---|---|
| `coingecko/` | Token prices, OHLC candles, market caps | `getSimplePrices(coinIds)`, `getOhlcCandles(coinId, days)` |
| `coinmarketcap/` | Latest token prices by symbol | `getLatestPrices(symbols)` |
| `dexscreener/` | DEX pair data, trending tokens (stub) | — |
| `etherscan/` | On-chain data, contract ABIs, gas prices (stub) | — |
| `shared/httpClient.js` | Axios wrapper with retry logic | `createHttpClient({ baseURL, timeout, headers, maxRetries })` |
| `shared/rateLimiter.js` | Token-bucket rate limiter | `createRateLimiter(maxRequests, windowMs)` |

## Interface Contract

API adapters are standalone — no registry pattern. Import directly:

```js
import { getSimplePrices } from '../../connectors/apis/coingecko/index.js';
import { createHttpClient } from '../../connectors/apis/shared/httpClient.js';
```

All adapters should use `shared/httpClient.js` for HTTP calls and `shared/rateLimiter.js` to respect API rate limits.

## Conventions

- New API provider → create `apis/provider-name/index.js`
- Use `createHttpClient()` for all HTTP requests — provides retry and timeout handling
- Wrap calls with a rate limiter to avoid hitting provider limits
- Keep adapters focused on data fetching — data transformation belongs in `core/market/`
