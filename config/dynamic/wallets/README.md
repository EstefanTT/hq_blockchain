# config/dynamic/wallets/

Per-wallet configuration files. Each file is a JSON object with the wallet address, associated chains, and risk limits.

Example:
```json
{
  "address": "0x...",
  "label": "main-trading",
  "chains": ["ethereum", "arbitrum"],
  "maxExposureUsd": 10000
}
```
