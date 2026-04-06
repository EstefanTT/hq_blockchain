# WP-1: Bot Registry & Standard Lifecycle

**Priority**: 1 (foundation — all other WPs depend on this)  
**Status**: Not started

---

## Goal

Any bot can be added by creating a folder in `apps/` — it auto-discovers, auto-registers, and plugs into the dashboard/API without editing any other file.

---

## Problem (current state)

### 1. Manual bot startup in `index.js` (line 58–59)
```javascript
const { init: initSteemDexBot } = await import('./apps/steem-dex-bot/index.js');
await initSteemDexBot();
```
At 20 bots this becomes 20 hardcoded import+init lines. Easy to forget one, no way to enable/disable at runtime.

### 2. No standard lifecycle contract
steem-dex-bot exports: `init, startDataCollection, stopDataCollection, startBot, stopBot, emergencyStop, reloadConfig, isTradingActive, isDataCollectionActive, getConfig, getBotName, shutdown`

Stub bots only export: `init, shutdown`

There's no enforced interface — each new bot inventor would invent their own method names.

### 3. No central bot registry
Dashboard, API routes, and cron jobs have no way to ask "what bots exist?" — they all hardcode `steem-dex-bot` by name via direct imports.

---

## Deliverables

### A. Create `services/botRegistry/index.js`

New service following the existing registry pattern (same style as `connectors/chains/registry.js`).

```javascript
// State
const bots = {};   // { 'steem-dex-bot': { module, meta } }

// Exports:
export function registerBot(name, module, meta)
// - Called by each bot in its init()
// - `module` = the bot's index.js module (has lifecycle methods)
// - `meta` = { name, displayName, chain, pairs, description }
// - Validates that module has all required lifecycle methods (see contract below)
// - Throws if a bot with the same name is already registered

export function getBot(name)
// - Returns { module, meta } or throws if not found

export function listBots()
// - Returns array of { name, displayName, chain, pairs, description }

export function getBotModule(name)
// - Returns just the module (for calling lifecycle methods)
```

**Key design decisions**:
- This is a pure lookup service — it does NOT call lifecycle methods itself
- It validates the contract at registration time (fail fast)
- It stores a reference to the module, not a copy (modules are singletons)

### B. Define the Standard Bot Lifecycle Contract

Every `apps/*/index.js` MUST export:

| Export | Type | Required | Purpose |
|---|---|---|---|
| `meta` | object | YES | `{ name, displayName, chain, pairs: ['X/Y'], description }` |
| `init()` | async fn | YES | Load config, register with botRegistry, create resources. NO start. |
| `startDataCollection()` | async fn | YES | Begin market feeds. Independent of trading. |
| `stopDataCollection()` | async fn | YES | Stop market feeds. Must auto-stop trading first if active. |
| `startBot()` | async fn | YES | Engage strategies/trading. Must auto-start data first if inactive. |
| `stopBot()` | async fn | YES | Stop trading. Keep data feeds alive. |
| `shutdown()` | async fn | YES | Full cleanup (calls stopDataCollection). |
| `getStatus()` | fn | YES | Returns `{ dataCollection: bool, trading: bool, error: null\|string }` |

Optional exports (bots may add their own beyond the contract):
- `emergencyStop()`, `reloadConfig()`, `getConfig()`, `getBotName()`, etc.

### C. Update steem-dex-bot to conform

**File**: `apps/steem-dex-bot/index.js`

Changes needed:
1. Add `meta` export at the top:
```javascript
export const meta = {
  name: 'steem-dex-bot',
  displayName: 'STEEM DEX Bot',
  chain: 'steem',
  pairs: ['STEEM/SBD'],
  description: 'Market-making and multi-strategy trading on the Steem internal DEX',
};
```

2. Add `getStatus()` export:
```javascript
export function getStatus() {
  return {
    dataCollection: dataCollectionActive,
    trading: tradingActive,
    error: null,
  };
}
```

3. Add `registerBot()` call inside `init()`:
```javascript
import { registerBot } from '../../services/botRegistry/index.js';
// Inside init(), after config registration:
registerBot(BOT_NAME, { init, startDataCollection, stopDataCollection, startBot, stopBot, shutdown, getStatus }, meta);
```

Wait — we should register the module itself, not individual functions. Since `apps/steem-dex-bot/index.js` is an ES module, we need to pass a reference. Best approach: import `* as self` pattern or pass the exports object. Simplest: the registration call passes `await import(...)` result, which is already done from the caller side.

**Revised approach**: The bot does NOT register itself. The auto-discovery loop registers each bot by importing its module:

```javascript
// In index.js boot:
const mod = await import(`./apps/${dir.name}/index.js`);
registerBot(mod.meta.name, mod, mod.meta);
await mod.init();
```

This is cleaner because:
- Bot doesn't need to know about the registry
- All registration happens in one place
- Module reference is the actual import result (all exports accessible)

So steem-dex-bot just adds `meta` and `getStatus` exports. No import of botRegistry needed.

### D. Update stub bots to conform

**Files**: `apps/spread-bot/index.js`, `apps/dex-execution-engine/index.js`, `apps/portfolio-monitor/index.js`, `apps/onchain-analyzer/index.js`

For each stub bot, expand to the full lifecycle skeleton:

```javascript
export const meta = {
  name: '<from config.json>',
  displayName: '<human name>',
  chain: '<primary chain>',
  pairs: [],
  description: '<one-line purpose>',
};

let dataActive = false;
let tradingActive = false;

export async function init() {
  console.info('BOT', meta.name.toUpperCase(), 'Initialized (stub)');
}

export async function startDataCollection() {
  dataActive = true;
  console.info('BOT', meta.name.toUpperCase(), 'Data collection started (stub)');
}

export async function stopDataCollection() {
  if (tradingActive) await stopBot();
  dataActive = false;
  console.info('BOT', meta.name.toUpperCase(), 'Data collection stopped (stub)');
}

export async function startBot() {
  if (!dataActive) await startDataCollection();
  tradingActive = true;
  console.info('BOT', meta.name.toUpperCase(), 'Bot started (stub)');
}

export async function stopBot() {
  tradingActive = false;
  console.info('BOT', meta.name.toUpperCase(), 'Bot stopped (stub)');
}

export async function shutdown() {
  await stopDataCollection();
  console.info('BOT', meta.name.toUpperCase(), 'Shutdown complete (stub)');
}

export function getStatus() {
  return { dataCollection: dataActive, trading: tradingActive, error: null };
}
```

**Note on `research-sandbox`**: This bot is special — it's designed to be run directly (`node apps/research-sandbox/index.js`), not via the main process. It does NOT get auto-discovered. The auto-discovery loop should skip folders starting with `_` (template) and folders whose `config.json` has no `name` field or has `"autoDiscover": false`. OR simpler: skip it if `meta` export is missing.

### E. Update `index.js` boot sequence

Replace the manual import/init block (lines 52–59) with auto-discovery:

```javascript
// ##########################################    APPS   ##########################################

import { readdirSync } from 'fs';
import { join } from 'path';
import { registerBot } from './services/botRegistry/index.js';

const appsDir = join(global.path.root, 'apps');
for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith('_')) continue;  // skip _template

  let mod;
  try {
    mod = await import(`./apps/${entry.name}/index.js`);
  } catch (err) {
    console.error('BOOT', `Failed to import apps/${entry.name}: ${err.message}`);
    continue;
  }

  // Skip modules without the standard meta export (e.g. research-sandbox)
  if (!mod.meta) {
    console.info('BOOT', `Skipping apps/${entry.name} (no meta export)`);
    continue;
  }

  registerBot(mod.meta.name, mod, mod.meta);

  try {
    await mod.init();
    console.info('BOOT', `✅ ${mod.meta.displayName} initialized`);
  } catch (err) {
    console.error('BOOT', `❌ ${mod.meta.displayName} init failed: ${err.message}`);
  }
}
```

### F. Update API routes that import steem-dex-bot directly

These files currently `import ... from 'apps/steem-dex-bot/index.js'` — they need to use the registry instead:

| File | Current import | Change to |
|---|---|---|
| `api/routes/dashboard/home-data.get.js` | `import ... from apps/steem-dex-bot` | `import { listBots, getBotModule } from botRegistry` then loop |
| `api/routes/dashboard/steem-prices.get.js` | `import ... from apps/steem-dex-bot` | Import via registry by name from query/param |
| `api/routes/execution/toggle-bot.post.js` | hardcoded bot | Use `req.body.bot` to look up via registry |
| `api/routes/execution/toggle-data.post.js` | hardcoded bot | Already uses `req.body.bot` — just swap import for registry lookup |

**Important**: These routes will still work with `steem-dex-bot` — but instead of direct import, they go through the registry. This means they automatically work for any future bot.

---

## Files to create
- `services/botRegistry/index.js`

## Files to modify
- `index.js` (boot sequence)
- `apps/steem-dex-bot/index.js` (add `meta`, `getStatus`)
- `apps/spread-bot/index.js` (full lifecycle skeleton)
- `apps/dex-execution-engine/index.js` (full lifecycle skeleton)
- `apps/portfolio-monitor/index.js` (full lifecycle skeleton)
- `apps/onchain-analyzer/index.js` (full lifecycle skeleton)
- `api/routes/dashboard/home-data.get.js` (use registry instead of direct import)
- `api/routes/dashboard/steem-prices.get.js` (use registry instead of direct import)
- `api/routes/execution/toggle-data.post.js` (use registry for bot lookup)
- Any other route files that directly import from a specific bot app

## Files to NOT touch
- `apps/research-sandbox/index.js` — stays as-is, no meta export, skipped by auto-discovery
- Strategy files, connector files, core files — unchanged

---

## Unit tests to add

**File**: `testing/services/botRegistry.test.js`

| Test | Verifies |
|---|---|
| `registerBot stores bot correctly` | getBot returns what was registered |
| `registerBot rejects duplicate name` | Throws on second registration with same name |
| `registerBot validates lifecycle methods` | Throws if module missing required exports |
| `listBots returns all registered` | Returns array of meta objects |
| `getBot throws for unknown name` | Proper error for nonexistent bot |

**File**: `testing/apps/lifecycle.test.js`

| Test | Verifies |
|---|---|
| `all apps have meta export` | Iterate apps/*, verify meta shape |
| `all apps have required lifecycle methods` | init, startDataCollection, stopDataCollection, startBot, stopBot, shutdown, getStatus |
| `getStatus returns correct shape` | { dataCollection: bool, trading: bool, error: null\|string } |

---

## E2E test updates

In `tests/e2e/dashboard.spec.js`:
- Bot card count assertion may change if more bots are enabled — but stub bots have `enabled: false` in config, so they'll register but not show in dashboard unless the dashboard shows disabled bots too. This depends on WP-2 decisions.
- For now, the E2E tests should still pass as-is because only `steem-dex-bot` has `meta.enabled !== false`.

Wait — `meta` doesn't have an `enabled` field. The enabled state is in `config.json` and `dynamicConfig`. The auto-discovery loop imports and inits ALL bots with `meta` — including disabled ones. `init()` for stubs is a no-op, so this is safe. The dashboard's `home-data.get.js` currently only builds data for steem-dex-bot — that changes in WP-2.

**For WP-1**: E2E tests should pass unchanged. Verify with full test run.

---

## Verification checklist
- [ ] `node --check services/botRegistry/index.js` passes
- [ ] `node --check index.js` passes
- [ ] `node --check` passes for all modified bot files
- [ ] `npm test` — all 122+ unit tests pass
- [ ] `npm run test:e2e` — all 25 E2E tests pass
- [ ] New unit tests for botRegistry pass
- [ ] Server starts and steem-dex-bot initializes via auto-discovery
- [ ] `console.info` shows each bot being registered/initialized
- [ ] Stub bots get registered but remain inactive
- [ ] research-sandbox is skipped (no meta)
