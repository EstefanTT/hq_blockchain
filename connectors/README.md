# connectors/

Adapters to external systems — blockchains, DEXes, CEXes, public APIs.

Each connector wraps an external protocol/API behind a consistent internal interface. Core and strategies never talk to the outside world directly — they go through connectors.

| Subdirectory | Connects to |
|---|---|
| **chains/** | Blockchain RPCs — EVM, Solana, etc. (read state, sign & send transactions) |
| **dex/** | Decentralized exchanges — Uniswap, Jupiter, etc. (quote, swap, liquidity) |
| **cex/** | Centralized exchanges — Binance, etc. (orders, balances, market data) |
| **apis/** | Third-party data APIs — CoinGecko, Etherscan, DexScreener (prices, analytics) |

**Registry pattern**: each subdirectory has a `registry.js` that maps names to adapters.
Call `getChain('ethereum')` or `getDex('uniswap-v3', 'ethereum')` instead of importing a specific adapter.
