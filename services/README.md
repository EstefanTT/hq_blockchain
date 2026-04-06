# services/

Infrastructure layer — reusable plumbing used by all other layers. Services are singletons, auto-initialized on import. They never import from `core/`, `connectors/`, `strategies/`, or `apps/`.

## File Inventory

| File / Folder | Purpose | Key Exports |
|---|---|---|
| `botRegistry/` | Central registry for bot modules and metadata | `registerBot(name, module, meta)`, `getBot(name)`, `getBotModule(name)`, `listBots()`, `hasBot(name)` |
| `cache/` | In-memory runtime state — prices, balances, per-bot status. Pattern: `actions/` (mutations) and `getters/` (queries) | `runtimeCache`, `initBotCache(botName)`, `getBotData(botName)`, `updatePriceFeed()`, `setLiveOrderBook()`, 20+ more |
| `dynamicConfig/` | Runtime-modifiable config with static → dynamic merge | `registerStaticConfig(botName, config)`, `getEffectiveConfig(botName)`, `updateParam(botName, dotPath, value)`, `setBotControl(botName, fields)` |
| `globalConfig/` | Loads `.env`, sets `global.path`, `global.isProduction`, static configs. Must be first import in `index.js` | Side-effect only (no named exports) |
| `logger/` | Overrides `console.*` with color-coded, context-tagged, file-persisted output | Side-effect (logger), `createBotLogger({ botName, chainName })` via `botLogger.js` |
| `messaging/` | Outbound notifications (Telegram) | `sendTelegramMessage(chatId, text, opts)` |
| `storage/` | Persistence — SQLite for structured data, file I/O for JSONL/snapshots | `getDb()`, `addTrade()`, `getTradeHistory()`, `appendJsonl()`, `readJson()`, `writeJson()`, `saveSnapshot()` |
| `validation/` | Zod schemas and a shared `validate()` helper | `validate(schema, data)` |

## Interface Contract

Each service exposes its public API through `index.js` (or `init.js` for globalConfig). Import from the service root:

```js
import { getBotData, initBotCache } from '../../services/cache/index.js';
import { getDb, addTrade } from '../../services/storage/index.js';
import { registerBot, listBots } from '../../services/botRegistry/index.js';
```

## Dependencies

None — services sit at the bottom of the dependency graph. All other layers depend on services, but services depend on nothing except Node.js built-ins and npm packages.

## Conventions

- Services initialize on import (singleton pattern) — no `new` or factory functions (except `createBotLogger`)
- Per-bot cache state lives under `runtimeCache.bots[botName]` — always pass `botName` to per-bot cache functions
- Storage tables include a `botName` column for multi-bot isolation
- Add new runtime state → `cache/actions/` + `cache/getters/`
- Add new DB queries → `storage/botStore.js`
- Add new schemas → `validation/schemas/`
