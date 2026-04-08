# apps/

Runnable compositions — each wires strategies, core, and services to achieve a specific business goal. Apps run as **modules in the same Node.js process** (loaded by `index.js`). Can be extracted to separate processes later if isolation is needed.

## File Inventory

| Folder | Purpose | Status |
|---|---|---|
| `steem-dex-bot/` | Market-making and spread-capture on Steem/Hive DEX — full lifecycle with brain, micro-layer, rebalance | Active — fully implemented |
| `spread-bot/` | Run spread-capture strategy on configured pools | Scaffold |
| `dex-execution-engine/` | Accept trade intents, route and execute on DEXes | Scaffold |
| `portfolio-monitor/` | Track balances and positions across wallets/chains | Scaffold |
| `onchain-analyzer/` | Monitor on-chain data, wallet movements, token flows | Scaffold |
| `research-sandbox/` | Scratch space for experiments (run directly, not via main process) | Scaffold |

Each app folder contains:
- `index.js` — exports lifecycle functions
- `config.json` — app-specific configuration
- `README.md` — purpose and how to enable

## Dashboard Visibility (meta.ready)

The `meta.ready` flag controls how the app appears in the dashboard sidebar:

- `ready: true` — Clickable link, normal styling. Use this **only** when the app is fully implemented.
- `ready: false` — Greyed out, non-clickable, grouped at the bottom with other planned features. Use this for stubs/scaffolds.

**When developing a new app:**
1. Copy `_template/` — the template defaults to `ready: false`
2. Implement the bot lifecycle
3. Once fully working, flip `ready: true` in the app's `meta` object

**When deprecating/disabling an app:**
1. Set `ready: false` in the app's `meta` object — it will immediately grey out in the sidebar

## Interface Contract

All apps are registered via `botRegistry` and implement the **bot lifecycle contract**:

```js
export const meta = { name: 'my-bot', description: '...', version: '1.0.0' };
export async function init() { }
export async function startDataCollection() { }
export async function stopDataCollection() { }
export async function startBot() { }
export async function stopBot() { }
export async function shutdown() { }
export function getStatus() { return { running, dataCollecting, ... }; }
```

Apps are auto-discovered by `index.js` at boot — register via `registerBot(meta.name, module, meta)`.

## Dependencies

- `services/botRegistry` — to register the app
- `services/cache` — per-bot runtime state (`initBotCache(botName)`, `getBotData(botName)`)
- `services/dynamicConfig` — for runtime config overrides
- `services/storage` — for persisting trades, snapshots
- `strategies/` — for wiring strategy logic
- `core/` — for execution, risk, and market modules

## Conventions

- Each app's cache state is namespaced under `runtimeCache.bots[botName]`
- Call `initBotCache(BOT_NAME)` during `init()` before using per-bot cache functions
- All per-bot cache calls pass `BOT_NAME` as first argument
- Don't import from other apps — share logic via `core/` or `strategies/`
- New app → create `apps/new-app/` with `index.js` + `config.json` + `README.md`, implement the lifecycle contract
