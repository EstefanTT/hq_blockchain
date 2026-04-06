# config/

Application configuration — split into static (checked-in, immutable at runtime) and dynamic (runtime-modifiable).

## File Inventory

| File / Folder | Purpose |
|---|---|
| `static/general.json` | General app settings (port, environment flags, feature toggles) |
| `static/logger.json` | Logger configuration (log level, file paths, context tags) |
| `static/networks.json` | Blockchain network definitions (RPC URLs, chain IDs, explorer URLs) |
| `dynamic/` | Runtime-modifiable config — updated via API, scripts, or manual edits |

## Interface Contract

### Config merge flow

Static configs are loaded at boot by `services/globalConfig`. Dynamic overrides are managed by `services/dynamicConfig`:

```
static JSON (config/static/) → dynamic overrides (config/dynamic/) → runtime cache
```

Use `getEffectiveConfig(botName)` from `services/dynamicConfig` to get the merged result.

### Static vs Dynamic

| | Static (`config/static/`) | Dynamic (`config/dynamic/`) |
|---|---|---|
| **When loaded** | Boot time only | Read/written at runtime |
| **How to change** | Edit file, restart app | API call or `updateParam()` |
| **Persisted** | Git-tracked JSON files | Disk-persisted JSON files |
| **Use for** | Network definitions, logger config | Bot control, strategy params, wallet config |

## Conventions

- Secrets go in `.env`, never in config files
- Config keys use camelCase
- Static config files should not be modified at runtime — change requires restart
- Dynamic config files can include per-bot control files (e.g., `steem-dex-bot-control.json`)
