# Bot Template

Copy this folder to create a new bot.

## Quick Start

1. Copy folder: `cp -r apps/_template apps/my-new-bot`
2. Edit `config.json`:
   - Set `name` to match folder name (`my-new-bot`)
   - Set `chain`, `baseToken`, `quoteToken`
   - Configure strategy parameters
3. Edit `index.js`:
   - Update `meta` object to match config
   - Implement `collectData()` — your market data fetching logic
   - Implement `runStrategy()` — your trading strategy logic
4. Start server: `node index.js`
   - Bot auto-discovers via `apps/` scan
   - Registers with botRegistry
   - Appears in dashboard sidebar

## Lifecycle Methods

| Method | When called | What to do |
|---|---|---|
| `init()` | Boot | Load config, register with services, init cache namespace |
| `startDataCollection()` | User clicks Data ON | Start fetching market data on interval |
| `stopDataCollection()` | User clicks Data OFF | Stop feeds (auto-stops trading first) |
| `startBot()` | User clicks Bot ON | Start trading (auto-starts data if needed) |
| `stopBot()` | User clicks Bot OFF | Stop trading (keeps data alive) |
| `shutdown()` | Process exit | Full cleanup |
| `getStatus()` | Dashboard poll | Return `{ dataCollection, trading, error }` |

## File Structure

| File | Purpose |
|---|---|
| `index.js` | Bot lifecycle + main logic |
| `config.json` | Static configuration (merged with dynamic overrides at runtime) |
| `README.md` | This file |

## Services Available

| Service | Import | Key Functions |
|---|---|---|
| Cache | `services/cache/index.js` | `initBotCache(botName)`, `getBotData(botName)`, `updateAccountData(botName, fields)`, `updateStrategyStatus(botName, fields)` |
| Storage | `services/storage/index.js` | `saveOrderBookSnapshot(botName, ...)`, `addTrade(botName, ...)`, `logAnalysisEvent(botName, ...)`, `getCurrentPosition(botName, ...)` |
| Config | `services/dynamicConfig/index.js` | `registerStaticConfig(botName, config)`, `getEffectiveConfig(botName)`, `getBotControl(botName)` |
| Strategies | `strategies/engine/registry.js` | `getStrategy(name)`, `listStrategies()` |
| Execution | `core/execution/` | `buildOrder()`, `executeTrade()`, `simulateTrade()` |
| Connectors | `connectors/chains/registry.js` | `getChain(name)`, `getDex(name, chain)`, `getCex(name)` |
