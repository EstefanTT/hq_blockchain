# connectors/

Adapters to external systems — blockchains, DEXes, CEXes, public APIs. Each connector wraps an external protocol/API behind a consistent internal interface. Core and strategies never talk to the outside world directly — they go through connectors.

## File Inventory

| File / Folder | Purpose | Key Exports |
|---|---|---|
| `chains/` | Blockchain RPC adapters (EVM, Solana, Steem-like) — read state, sign & send transactions | `registry.js`: `registerChain(name, adapter)`, `getChain(name)`, `listChains()` |
| `dex/` | Decentralized exchange adapters (Uniswap, Jupiter) — quote, swap, liquidity | `registry.js`: `registerDex(name, chain, adapter)`, `getDex(name, chain)`, `listDexes()` |
| `cex/` | Centralized exchange adapters (Binance) — orders, balances, market data | `registry.js`: `registerCex(name, adapter)`, `getCex(name)`, `listCexes()` |
| `apis/` | Third-party data APIs (CoinGecko, CoinMarketCap, DexScreener, Etherscan) — prices, analytics | Per-provider `index.js` with data-fetching functions |

## Interface Contract

**Registry pattern**: each subdirectory has a `registry.js`. Instead of importing an adapter directly, use the registry:

```js
import { getChain } from '../../connectors/chains/registry.js';
import { getDex } from '../../connectors/dex/registry.js';
import { getCex } from '../../connectors/cex/registry.js';

const chain = getChain('steem');
const dex = getDex('jupiter', 'solana');
const cex = getCex('binance');
```

Each connector category has a `shared/baseAdapter.js` documenting the interface methods all adapters must implement.

| Category | Required Adapter Methods |
|---|---|
| `chains/` | `connect()`, `getBalance()`, `sendTransaction()`, `subscribe()` |
| `dex/` | `getQuote()`, `buildSwap()`, `getPools()`, `subscribe()` |
| `cex/` | `getBalance()`, `placeOrder()`, `cancelOrder()`, `getTicker()`, `subscribe()` |

## Dependencies

- `services/cache` — connectors push data (prices, order books) into runtime cache
- `services/globalConfig` — for environment-specific endpoints

## Conventions

- One subfolder per adapter (e.g., `chains/evm/`, `dex/uniswap/`)
- All adapters in a category share `shared/httpClient.js` and `shared/rateLimiter.js` (for `apis/`)
- Register new adapters in the category's `registry.js` — zero changes needed in core or strategies
- Streaming/WebSocket logic lives inside the connector's `subscribe()`, not in a separate layer
