# connectors/apis/

Third-party data API adapters — prices, analytics, block explorers.

Each API provider gets its own subdirectory. All use the shared HTTP client with rate limiting.

| Provider | Data |
|---|---|
| **coingecko/** | Token prices, market caps, historical data |
| **etherscan/** | On-chain data, contract ABIs, token transfers, gas prices |
| **dexscreener/** | DEX pair data, trending tokens, price charts |
