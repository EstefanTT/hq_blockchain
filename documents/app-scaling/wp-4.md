# WP-4: Cache Namespacing (Per-Bot In-Memory State)

**Priority**: 3 (parallel with WP-3)  
**Depends on**: WP-1 (bot registry for bot names)  
**Status**: Not started

---

## Goal

Two bots can run simultaneously without overwriting each other's in-memory state. Every cache read/write is scoped to a specific bot. Shared data (system-level) remains global.

---

## Problem (current state)

### `services/cache/index.js` is a flat singleton

```javascript
const runtimeCache = {
  priceFeed: null,
  riskStatus: {},
  brainStatus: null,
  orderBook: null,
  recentTrades: [],
  positions: null,
  botControlState: {},
  // ... ~20 more keys
};
```

All keys are global. When `updatePriceFeed(feed)` is called by steem-dex-bot, it sets `runtimeCache.priceFeed = feed`. If bot-B also calls `updatePriceFeed(feed)`, it overwrites bot-A's data.

### Current exports (~17 action functions):
```
updatePriceFeed, updateRiskStatus, updateBrainStatus, updateVolatility,
updateLiveOrderBook, updateRecentTrades, updatePositions, updateBotControlState,
updateExecutionStatus, updateDryRunStatus, updateDataStatus, updateBrainCalc,
updateAmountCalc, updateMicroLayerStatus, updatePnL, updateMarketMetrics,
updateEffectiveConfig
```

### Current getters:
```
getSteemDexBotData()  — aggregates ALL cache fields into one object
getLiveOrderBook()    — returns runtimeCache.orderBook
getRecentTrades()     — returns runtimeCache.recentTrades
getBotControlState()  — returns runtimeCache.botControlState
```

---

## Deliverables

### A. Restructure `runtimeCache` with per-bot namespacing

```javascript
const runtimeCache = {
  // Shared global state (not per-bot)
  system: {
    startedAt: null,
    lastHealthCheck: null,
  },

  // Per-bot state
  bots: {
    // 'steem-dex-bot': { priceFeed: null, brainStatus: null, ... }
  },
};
```

### B. Bot state initializer

When a bot registers (WP-1), its cache namespace is created:

```javascript
export function initBotCache(botName) {
  if (runtimeCache.bots[botName]) return;  // idempotent
  runtimeCache.bots[botName] = {
    priceFeed: null,
    riskStatus: {},
    brainStatus: null,
    orderBook: null,
    recentTrades: [],
    positions: null,
    botControlState: {},
    executionStatus: null,
    dryRunStatus: null,
    dataStatus: null,
    brainCalc: null,
    amountCalc: null,
    microLayerStatus: null,
    pnl: null,
    marketMetrics: null,
    effectiveConfig: null,
    volatility: null,
  };
}
```

Called from the auto-discovery loop in `index.js` (WP-1), right after `registerBot()`.

### C. Update all action functions to require `botName`

**Pattern** — every updater gains `botName` as first param:

```javascript
// Before:
export function updatePriceFeed(feed) {
  runtimeCache.priceFeed = feed;
}

// After:
export function updatePriceFeed(botName, feed) {
  runtimeCache.bots[botName].priceFeed = feed;
}
```

Full list of changes:
| Function | Signature change |
|---|---|
| `updatePriceFeed(feed)` | `updatePriceFeed(botName, feed)` |
| `updateRiskStatus(status)` | `updateRiskStatus(botName, status)` |
| `updateBrainStatus(status)` | `updateBrainStatus(botName, status)` |
| `updateVolatility(data)` | `updateVolatility(botName, data)` |
| `updateLiveOrderBook(book)` | `updateLiveOrderBook(botName, book)` |
| `updateRecentTrades(trades)` | `updateRecentTrades(botName, trades)` |
| `updatePositions(pos)` | `updatePositions(botName, pos)` |
| `updateBotControlState(state)` | `updateBotControlState(botName, state)` |
| `updateExecutionStatus(status)` | `updateExecutionStatus(botName, status)` |
| `updateDryRunStatus(isDry)` | `updateDryRunStatus(botName, isDry)` |
| `updateDataStatus(status)` | `updateDataStatus(botName, status)` |
| `updateBrainCalc(calc)` | `updateBrainCalc(botName, calc)` |
| `updateAmountCalc(calc)` | `updateAmountCalc(botName, calc)` |
| `updateMicroLayerStatus(status)` | `updateMicroLayerStatus(botName, status)` |
| `updatePnL(pnl)` | `updatePnL(botName, pnl)` |
| `updateMarketMetrics(metrics)` | `updateMarketMetrics(botName, metrics)` |
| `updateEffectiveConfig(config)` | `updateEffectiveConfig(botName, config)` |

### D. Update getter functions

```javascript
// Replace:
export function getSteemDexBotData() { ... aggregates all fields ... }

// With:
export function getBotData(botName) {
  const botCache = runtimeCache.bots[botName];
  if (!botCache) return null;
  return { ...botCache };  // shallow copy to prevent mutation
}

export function getLiveOrderBook(botName) {
  return runtimeCache.bots[botName]?.orderBook ?? null;
}

export function getRecentTrades(botName) {
  return runtimeCache.bots[botName]?.recentTrades ?? [];
}

export function getBotControlState(botName) {
  return runtimeCache.bots[botName]?.botControlState ?? {};
}
```

### E. Backward-compatible alias (temporary)

To avoid a big-bang change, keep the old name as an alias during transition:

```javascript
/** @deprecated Use getBotData(botName) instead */
export function getSteemDexBotData() {
  return getBotData('steem-dex-bot');
}
```

Remove in a later cleanup pass once all callers are updated.

### F. Update all callers

**`apps/steem-dex-bot/index.js`** — Every cache call gains `BOT_NAME`:
```javascript
// Before:
import { updatePriceFeed, updateBrainStatus, ... } from '../../services/cache/index.js';
updatePriceFeed(prices);

// After:
updatePriceFeed(BOT_NAME, prices);
```

Steem-dex-bot calls cache functions in these key areas:
- `collectData()` — ~5 cache updates (prices, order book, trades, positions, etc.)
- `runBrain()` — ~4 cache updates (brainStatus, brainCalc, amountCalc, etc.)
- `executeTrade()` — ~2 cache updates (executionStatus, positions)
- `toggleData()` / `toggleBot()` — control state updates
- Config reload — effectiveConfig update

**Dashboard routes** — Use `getBotData(botName)` instead of `getSteemDexBotData()`.

**Cron jobs** — If `scheduler/crons/syncBalances.js` or others touch cache, update them.

---

## What stays global

Some state isn't per-bot:
- System startup time
- API server state
- Health check timestamp
- Log level

These go under `runtimeCache.system` or stay as-is if they're not in cache today.

---

## Edge case: bot not initialized

If code calls `updatePriceFeed('unknown-bot', data)`, it would crash because `runtimeCache.bots['unknown-bot']` is undefined.

**Guard**: Either throw a clear error, or silently init:
```javascript
function getBotCache(botName) {
  if (!runtimeCache.bots[botName]) {
    throw new Error(`Cache not initialized for bot: ${botName}. Call initBotCache() first.`);
  }
  return runtimeCache.bots[botName];
}
```

Use `getBotCache()` inside every action/getter. Fail fast = easier debugging.

---

## Files to modify
- `services/cache/index.js` (restructure cache, update all functions)
- `apps/steem-dex-bot/index.js` (add BOT_NAME to all cache calls)
- `api/routes/dashboard/home-data.get.js` (use `getBotData`)
- `api/routes/dashboard/steem-prices.get.js` (use `getBotData`)
- `api/routes/dashboard/bots/[name]-data.get.js` (if created in WP-2 already)
- `scheduler/crons/*.js` (update any cache calls)
- `testing/services/cache/cache.test.js` (update tests with botName)

---

## Unit tests

**File**: `testing/services/cache/cache.test.js` (update existing or add new)

| Test | Verifies |
|---|---|
| `initBotCache creates namespace` | `runtimeCache.bots['test-bot']` exists with all default keys |
| `initBotCache is idempotent` | Calling twice doesn't reset data |
| `updatePriceFeed stores under bot namespace` | After update, getBotData returns the feed |
| `two bots don't collide` | Update bot-A price, update bot-B price — each getBotData returns its own |
| `getBotData returns null for unknown bot` | Returns null, not crash |
| `getBotCache throws for uninitialized bot` | Clear error message |
| `getSteemDexBotData backward compat` | Alias returns same as getBotData('steem-dex-bot') |

---

## Verification checklist
- [ ] `node --check services/cache/index.js` passes
- [ ] All cache callers pass botName as first arg
- [ ] Two bots can update the same cache keys independently
- [ ] `getSteemDexBotData()` still works (backward compat)
- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] Dashboard data endpoint returns correct data for `steem-dex-bot`
