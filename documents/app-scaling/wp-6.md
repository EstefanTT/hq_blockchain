# WP-6: Bot Template (`apps/_template/`)

**Priority**: 4 (after WP-1 and WP-3/4 so the template uses the final APIs)  
**Depends on**: WP-1 (lifecycle contract), WP-3 (storage with botName), WP-4 (cache with botName)  
**Status**: Not started

---

## Goal

Creating a new bot is a 5-minute copy-rename-configure task. The template provides the correct skeleton with all lifecycle methods, config schema, and README — so developers (and AI agents) never start from scratch.

---

## Problem (current state)

There's no template. The only reference implementation is `steem-dex-bot` at ~450 lines, which mixes generic lifecycle with steem-specific trading logic. Copying it means deleting 400 lines and hoping you kept the right 50.

The stub bots (after WP-1 upgrades) are too minimal — they don't show *how* to use storage, cache, config, etc.

---

## Deliverables

### A. Create `apps/_template/index.js`

Full lifecycle skeleton with explanatory comments. The `_` prefix ensures auto-discovery skips it (WP-1 rule: skip dirs starting with `_`).

```javascript
/**
 * Bot Template — Copy this folder and rename to create a new bot.
 *
 * Steps:
 * 1. Copy `apps/_template/` → `apps/your-bot-name/`
 * 2. Edit `config.json` — set name, chain, pairs, strategies
 * 3. Edit `index.js` — update meta, implement collectData() and runStrategy()
 * 4. Start the server — your bot auto-discovers and registers
 */

import { getEffectiveConfig, registerStaticConfig, getBotControl } from '../../services/dynamicConfig/index.js';
import {
  updatePriceFeed, updateBrainStatus, updatePositions,
  updateBotControlState, updateDataStatus, updateEffectiveConfig,
  initBotCache,
} from '../../services/cache/index.js';
import {
  saveOrderBookSnapshot, logAnalysisEvent, updatePosition,
} from '../../services/storage/botStore.js';

// ─── META ───────────────────────────────────────────────────────────
// Required. Used by botRegistry for identification and dashboard display.
export const meta = {
  name: 'your-bot-name',           // Must match folder name and config.json name
  displayName: 'Your Bot Name',    // Human-readable, shown in dashboard
  chain: 'chain-name',             // e.g. 'steem', 'ethereum', 'solana'
  pairs: ['TOKEN_A/TOKEN_B'],      // Trading pairs
  description: 'One-line description of what this bot does.',
};

// ─── STATE ──────────────────────────────────────────────────────────
const BOT_NAME = meta.name;
let dataCollectionActive = false;
let tradingActive = false;
let dataInterval = null;
let tradeInterval = null;

// ─── LIFECYCLE: init ────────────────────────────────────────────────
// Called once at boot. Load config, register with services. Do NOT start yet.
export async function init() {
  const config = await import('./config.json', { assert: { type: 'json' } });
  registerStaticConfig(BOT_NAME, config.default);
  initBotCache(BOT_NAME);

  console.info('BOT', BOT_NAME.toUpperCase(), 'Initialized');
}

// ─── LIFECYCLE: startDataCollection ─────────────────────────────────
// Begin fetching market data. Independent of trading.
export async function startDataCollection() {
  if (dataCollectionActive) return;
  dataCollectionActive = true;
  updateDataStatus(BOT_NAME, { collecting: true });

  // TODO: Replace with your data collection logic
  // Example: fetch order book, prices, etc. on an interval
  dataInterval = setInterval(() => collectData(), 10_000);
  await collectData(); // run once immediately

  console.info('BOT', BOT_NAME.toUpperCase(), 'Data collection started');
}

// ─── LIFECYCLE: stopDataCollection ──────────────────────────────────
// Stop market data feeds. Auto-stops trading first if active.
export async function stopDataCollection() {
  if (tradingActive) await stopBot();
  clearInterval(dataInterval);
  dataInterval = null;
  dataCollectionActive = false;
  updateDataStatus(BOT_NAME, { collecting: false });

  console.info('BOT', BOT_NAME.toUpperCase(), 'Data collection stopped');
}

// ─── LIFECYCLE: startBot ────────────────────────────────────────────
// Engage trading strategies. Auto-starts data collection if inactive.
export async function startBot() {
  if (tradingActive) return;
  if (!dataCollectionActive) await startDataCollection();
  tradingActive = true;
  updateBotControlState(BOT_NAME, { ...getBotControl(BOT_NAME), enabled: true });

  // TODO: Replace with your strategy execution logic
  // Example: run strategy on an interval
  tradeInterval = setInterval(() => runStrategy(), 30_000);

  console.info('BOT', BOT_NAME.toUpperCase(), 'Trading started');
}

// ─── LIFECYCLE: stopBot ─────────────────────────────────────────────
// Stop trading. Keep data feeds alive.
export async function stopBot() {
  clearInterval(tradeInterval);
  tradeInterval = null;
  tradingActive = false;
  updateBotControlState(BOT_NAME, { ...getBotControl(BOT_NAME), enabled: false });

  console.info('BOT', BOT_NAME.toUpperCase(), 'Trading stopped');
}

// ─── LIFECYCLE: shutdown ────────────────────────────────────────────
// Full cleanup. Called on process exit.
export async function shutdown() {
  await stopDataCollection();
  console.info('BOT', BOT_NAME.toUpperCase(), 'Shutdown complete');
}

// ─── LIFECYCLE: getStatus ───────────────────────────────────────────
// Returns current operational status. Called by dashboard and health checks.
export function getStatus() {
  return {
    dataCollection: dataCollectionActive,
    trading: tradingActive,
    error: null,
  };
}

// ─── YOUR CODE ──────────────────────────────────────────────────────

async function collectData() {
  // TODO: Implement your data collection
  // - Fetch prices from connector
  // - Fetch order book
  // - Update cache:
  //   updatePriceFeed(BOT_NAME, prices);
  //   updatePositions(BOT_NAME, positions);
  // - Save to storage:
  //   saveOrderBookSnapshot(BOT_NAME, chain, base, quote, book);
}

async function runStrategy() {
  // TODO: Implement your trading strategy
  // - Read latest data from cache
  // - Run strategy logic (from strategies/ folder)
  // - Build and execute orders (from core/execution/)
  // - Log results:
  //   logAnalysisEvent(BOT_NAME, { eventType: 'strategy_run', ... });
}
```

### B. Create `apps/_template/config.json`

```json
{
  "name": "your-bot-name",
  "displayName": "Your Bot Name",
  "chain": "chain-name",
  "baseToken": "TOKEN_A",
  "quoteToken": "TOKEN_B",

  "dryRun": true,
  "enabled": false,

  "dataCollectionIntervalMs": 10000,
  "strategyIntervalMs": 30000,

  "risk": {
    "maxPositionSize": 1000,
    "maxDailyTrades": 50,
    "stopLossPercent": 5
  },

  "strategies": {
    "exampleStrategy": {
      "enabled": false,
      "param1": 0.5,
      "param2": 100
    }
  }
}
```

### C. Create `apps/_template/README.md`

```markdown
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
| `init()` | Boot | Load config, register with services |
| `startDataCollection()` | User clicks Data ON | Start fetching market data |
| `stopDataCollection()` | User clicks Data OFF | Stop feeds (auto-stops trading) |
| `startBot()` | User clicks Bot ON | Start trading (auto-starts data) |
| `stopBot()` | User clicks Bot OFF | Stop trading (keeps data alive) |
| `shutdown()` | Process exit | Full cleanup |
| `getStatus()` | Dashboard poll | Return `{ dataCollection, trading, error }` |

## File Structure

| File | Purpose |
|---|---|
| `index.js` | Bot lifecycle + main logic |
| `config.json` | Static configuration (merged with dynamic overrides) |
| `README.md` | This file |

## Services Available

- `services/cache` — in-memory state: `updatePriceFeed(botName, data)`, `getBotData(botName)`
- `services/storage/botStore` — SQLite persistence: `saveOrderBookSnapshot(botName, ...)`, `logAnalysisEvent(botName, ...)`
- `services/dynamicConfig` — config management: `getEffectiveConfig(botName)`, `getBotControl(botName)`
- `strategies/engine` — strategy execution: register strategies via `strategies/engine/registry.js`
- `core/execution` — order building + execution: `buildOrder()`, `executeTrade()`, `simulateTrade()`
- `connectors/` — chain/dex/cex connectors via registries
```

---

## Files to create
- `apps/_template/index.js`
- `apps/_template/config.json`
- `apps/_template/README.md`

## Files to modify
- None

---

## Verification checklist
- [ ] `node --check apps/_template/index.js` passes (syntax valid)
- [ ] `config.json` is valid JSON
- [ ] Template is NOT auto-discovered (skip `_` prefix check in WP-1 boot loop)
- [ ] Copying template to `apps/test-bot/`, updating meta.name → `test-bot`, and starting server → bot registers and appears in dashboard
- [ ] All imports in template resolve to real files (no dead imports)
- [ ] README accurately describes the lifecycle and available services
