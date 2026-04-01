# config/dynamic/

Runtime-modifiable configuration. Updated via API, scripts, or manual edits. Persisted to disk.

| Subdirectory | Contents |
|---|---|
| `wallets/` | Per-wallet config: address, chains, risk limits |
| `strategies/` | Per-strategy instance parameters |
| `chains/` | Per-chain overrides (gas multipliers, custom RPCs, etc.) |
