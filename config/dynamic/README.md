# config/dynamic/

Runtime-modifiable configuration. Updated via API calls (`services/dynamicConfig`), scripts, or manual edits. Persisted to disk and survives restarts.

## File Inventory

| File / Folder | Purpose |
|---|---|
| `wallets/` | Per-wallet config: addresses, chains, risk limits (e.g., `steem-trading.json`) |
| `strategies/` | Per-strategy instance parameters and overrides |
| `chains/` | Per-chain overrides (gas multipliers, custom RPCs, etc.) |
| `steem-dex-bot-control.json` | Runtime control state for steem-dex-bot (strategy toggles, mode, dry-run flag) |

## Interface Contract

Dynamic config is accessed through `services/dynamicConfig`:

```js
import { getEffectiveConfig, updateParam, setBotControl } from '../../services/dynamicConfig/index.js';

const config = getEffectiveConfig('steem-dex-bot');
updateParam('steem-dex-bot', 'strategy.spreadTarget', 0.03);
setBotControl('steem-dex-bot', { dryRun: true });
```

## Conventions

- One control file per bot: `<bot-name>-control.json`
- Wallet files go in `wallets/`, strategy overrides in `strategies/`, chain overrides in `chains/`
- Config keys use camelCase
- Files are JSON — keep them small and focused
