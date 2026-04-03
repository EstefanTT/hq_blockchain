# apps/steem-dex-bot/

STEEM/SBD DEX trading bot — multi-chain ready.

## Config

| Key | Description |
|---|---|
| `enabled` | Enable/disable the bot |
| `chainName` | Blockchain name (steem, hive, blurt, …) |
| `baseToken` | Base token config (symbol, CoinGecko ID, CMC symbol) |
| `quoteToken` | Quote token config |
| `maxOrderSizeBase` | Max order size in base token |
| `maxOrderSizeQuote` | Max order size in quote token |
| `tinyPyramidBaseSizeQuote` | Tiny pyramid layer size in quote |

## Activation

Import and call `init()` in the main `index.js`. Set `enabled: true` in `config.json`.
