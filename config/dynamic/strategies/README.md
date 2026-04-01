# config/dynamic/strategies/

Per-strategy instance configuration files. Each file defines parameters for one running strategy instance.

Example:
```json
{
  "strategy": "spread-capture",
  "chain": "ethereum",
  "pool": "0x...",
  "minSpreadPercent": 0.3,
  "tradeSize": 0.1,
  "enabled": true
}
```
