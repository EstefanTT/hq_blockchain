# Proposal: Preparing hq_blockchain for 20–30 Bots

**Date**: 2026-04-06   |   **Status**: Draft for review

---

## 1. Executive Summary

The codebase has a strong foundation — modular layers, registry pattern, strategy interface, file-based routing, and solid test coverage (122 unit + 25 E2E). But several pieces are **hardcoded to a single bot** (steem-dex-bot). Scaling to 20–30 bots without addressing these will create a maintenance nightmare.

This proposal defines **7 work packages** in priority order. Each is independent and can be reviewed/merged separately. The first 4 are structural prerequisites; the last 3 are quality-of-life improvements that compound over time.

---

## 2. Current State Assessment

### What works well (preserve as-is)
| Pattern | Why it's strong |
|---|---|
| Layer dependency rule (`apps → strategies → core → connectors ← services`) | Clear boundaries, no circular deps |
| Registry pattern (chains, dex, cex, strategies) | Zero-change extensibility for new adapters |
| Strategy interface (`init / tick / shutdown / describe`) | Uniform contract across all strategies |
| Dynamic config (static + overrides + control.json) | Safe runtime tuning, survives restarts |
| File-based routing (`loadRoutes.js`) | Zero config to add endpoints |
| Brain coordinator (680 lines of battle-tested decision logic) | Adaptive strategy switching |
| 147 tests (122 unit + 25 E2E) all green | Safety net for refactoring |

### What breaks at 20 bots

| Problem | Current state | Impact at 20 bots |
|---|---|---|
| **Bot startup is manual** | `index.js` has `const { init } = await import('./apps/steem-dex-bot/index.js')` hardcoded | 20 manual import lines, easy to forget one, no runtime enable/disable |
| **Dashboard is bot-specific HTML** | `steem-dex-bot.get.js` = 831 lines of HTML for one bot | 20 × 831 = 16,620 lines of duplicated HTML templates |
| **Data endpoint returns one bot** | `home-data.get.js` hardcodes `steem-dex-bot` bot name and imports | 20 separate data endpoints, each importing different modules |
| **Storage has no bot identity** | `steemDexStore.js` tables use `(chainName, baseToken, quoteToken)` as keys — no botName | Two bots trading the same pair = data collision |
| **Cache is a flat singleton** | `runtimeCache` holds steem-dex-bot state as top-level keys | 20 bots' state mixed in one flat object, key naming conflicts |
| **No bot lifecycle contract** | steem-dex-bot has `init/startDataCollection/startBot/stopBot/stopDataCollection/shutdown` — but this isn't standardized | Each developer invents their own lifecycle, impossible to manage generically |
| **Tests assume 1 bot** | `await expect(botCards).toHaveCount(1)` | Breaks the moment bot #2 appears |
| **Route loader doesn't support params** | `/api/dashboard/steem-dex-bot` is a static file | Can't do `/api/dashboard/bots/:name` without modifying loadRoutes |

---

## 3. Work Packages (in priority order)

### WP-1: Bot Registry & Standard Lifecycle

**Goal**: Any bot can be added by creating a folder in `apps/` — it auto-discovers, auto-registers, and plugs into the dashboard/API without editing other files.

**New file**: `services/botRegistry/index.js`

```
Exports:
  registerBot(name, module)     — called by each bot's init
  getBot(name)                  — returns { module, meta, status }
  listBots()                    — returns all registered bots
  getBotStatus(name)            — running / stopped / error / disabled
```

**Standard bot lifecycle contract** (enforced for all bots):

```
Every apps/*/index.js MUST export:
  meta                          — { name, displayName, chain, pairs, description }
  init()                        — load config, register with botRegistry, create resources (NO start)
  startDataCollection()         — begin market feeds
  stopDataCollection()          — stop market feeds (auto-stops trading first)
  startBot()                    — engage strategies (auto-starts data first)
  stopBot()                     — disengage strategies
  shutdown()                    — full cleanup
  getStatus()                   — { dataCollection: bool, trading: bool, error: null|string }
```

**Auto-discovery** in `index.js` (replaces manual imports):

```javascript
import { readdirSync } from 'fs';
import { join } from 'path';

const appsDir = join(global.path.root, 'apps');
for (const dir of readdirSync(appsDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const mod = await import(`./apps/${dir.name}/index.js`);
  if (mod.meta?.enabled !== false) await mod.init();
}
```

**How steem-dex-bot changes**: Minimal. It already has all the lifecycle methods. Just add the `meta` export and call `registerBot()` inside `init()`.

**How stub bots change**: They gain the same lifecycle skeleton. They remain disabled via `config.json` `"enabled": false` and simply don't start data/trading.

---

### WP-2: Parameterized Dashboard (One Template, N Bots)

**Goal**: Replace 831-line bot-specific HTML files with one generic bot template that renders any bot.

**Changes**:

1. **Extend `loadRoutes.js`** to support `[param]` in filenames:
   - `routes/dashboard/bots/[name].get.js` → `GET /api/dashboard/bots/:name`
   - One line change: detect `[` in filename, convert to `:param` in Express

2. **Create `routes/dashboard/bots/[name].get.js`** — the generic bot page:
   - Receives `req.params.name`
   - Calls `getBot(name)` from botRegistry to get metadata
   - Calls `getEffectiveConfig(name)` for strategy params
   - Renders the same HTML template for all bots
   - Strategy cards generated from config — not hardcoded per-bot

3. **Create `routes/dashboard/bots/[name]-data.get.js`** — generic data endpoint:
   - Returns data for any bot based on its registered name
   - Replaces the current `steem-prices.get.js` 1-bot pattern

4. **Update `home-data.get.js`** to loop over `listBots()` instead of hardcoding one bot

5. **Keep `steem-dex-bot.get.js` alive temporarily** as a redirect to `/api/dashboard/bots/steem-dex-bot` for backward compatibility. Remove after migration.

**Sidebar navigation**: Generated dynamically from `listBots()` in the HTML template shared by all pages.

**What stays bot-specific**: Only the `apps/*/config.json` and `apps/*/index.js` business logic. The dashboard, API, and control layer become fully generic.

---

### WP-3: Per-Bot Storage Isolation

**Goal**: No data collision when two bots trade the same pair.

**Option A — Add `botName` column** (recommended — simplest):
- Add `botName TEXT NOT NULL` to all 4 tables in steemDexStore
- Update all queries to include `WHERE botName = ?`
- Rename `steemDexStore.js` → `botStore.js` (it's generic now)

**Option B — Per-bot SQLite databases**:
- `data/bots/steem-dex-bot.db`, `data/bots/spread-bot.db`, etc.
- Pros: Total isolation, easy to delete/backup one bot
- Cons: Cross-bot queries become harder (dashboard overview)

**Recommendation**: Option A. It keeps the single-DB simplicity for dashboard queries while adding proper isolation. One migration script adds the column to existing tables.

---

### WP-4: Per-Bot Cache Namespacing

**Goal**: 20 bots don't step on each other's cache keys.

**Current**: `runtimeCache.accountData`, `runtimeCache.brainStatus` — flat, single-bot.

**New pattern**: Cache entries keyed by bot name:
```javascript
runtimeCache.bots = {
  'steem-dex-bot':  { accountData, brainStatus, microLayerStatus, ... },
  'spread-bot':     { accountData, brainStatus, ... },
}
```

**Changes**:
- All cache action functions gain a `botName` parameter: `updateBrainStatus(botName, status)`
- All getter functions gain it too: `getBrainStatus(botName)`
- `getSteemDexBotData()` → `getBotData(botName)` — generic aggregator
- Global state (price feeds, candles, divergence alerts) stays at the top level — it's shared across bots that trade the same assets

**Shared data deduplication**: If 3 bots trade STEEM/SBD, they share one set of price feeds and candles. Only bot-specific state (positions, brain, strategy, micro layer) is namespaced.

---

### WP-5: Documentation System for AI Context Loading

**Goal**: An AI can understand any part of the codebase fast, without reading all the code.

Your intuition about documentation as AI context is correct and important. Here's the refined system:

**Three tiers of documentation**:

| Tier | File | Purpose | When updated |
|---|---|---|---|
| **1 — Master** | `README.md` (root) | Architecture, layer rules, conventions, decision guide | When a new layer/pattern is added |
| **2 — Layer** | `*/README.md` (each folder) | What this folder does, interface contracts, file inventory with function signatures | When a file is added/changed in that folder |
| **3 — Copilot** | `.github/copilot-instructions.md` | Concise rules for AI: naming conventions, file patterns, what NOT to do, registry patterns | When conventions change |

**What to improve in the current READMEs**:

The root README is excellent (5/5). But 12 of 21 folder READMEs are stubs (1-2/5). The specific upgrade:

- **Every folder README must have** (enforced on new additions):
  1. One-paragraph purpose
  2. File inventory table: `| File | Exports | Purpose |`
  3. Interface contract (if applicable): function signatures with param/return types
  4. "How to add a new X" recipe (1-3 steps)

- **Create `.github/copilot-instructions.md`** with:
  - Layer dependency rule (copy from root README)
  - File naming conventions
  - Bot lifecycle contract
  - Registry pattern (register → get → list)
  - "Never do this" list (import from wrong layer, hardcode bot names, skip tests)
  - Test commands (`npm test`, `npm run test:e2e`)

**Why NOT a separate "Master Context Document"**: The root README already serves this role and is in the natural place developers (and AI) look first. Splitting context across a separate doc creates a maintenance burden. Better to keep one authoritative source and make it excellent.

**Important**: READMEs should document **interfaces and contracts** (what functions exist, what they accept, what they return) more than implementation details. The AI can read implementation from code — what it needs from docs is the *shape* of the system.

---

### WP-6: Bot Template (Scaffolding for New Bots)

**Goal**: Adding bot #2 is a 15-minute copy + adapt, not a multi-hour engineering task.

**Create `apps/_template/`** containing:

```
apps/_template/
  index.js       — lifecycle skeleton with all 8 required exports
  config.json    — schema with required fields + placeholders
  README.md      — template README with fill-in sections
```

The `_` prefix means it's sorted first and clearly marked as a template, never auto-discovered as a real bot.

**`index.js` template** provides:
- All lifecycle method signatures pre-wired
- `registerBot()` call in `init()`
- PriceEngine + adapter initialization pattern
- Data collection start/stop pattern
- Brain + strategy wiring pattern
- Proper shutdown cleanup

**Adding a new bot** becomes:
1. Copy `apps/_template/` → `apps/my-new-bot/`
2. Edit `config.json` (name, chain, pairs, strategy params)
3. Implement the bot-specific logic in `init()` wiring
4. Run `npm test && npm run test:e2e`

---

### WP-7: Test Infrastructure for Multi-Bot

**Goal**: Tests don't break when new bots appear, and adding a new bot includes mandatory test coverage.

**Changes**:

1. **E2E tests become bot-count-agnostic**:
   - Replace `await expect(botCards).toHaveCount(1)` → `expect(count).toBeGreaterThanOrEqual(1)`
   - Parameterized bot page tests: loop over discovered bots instead of hardcoding `steem-dex-bot`
   
2. **Bot template includes test skeleton**:
   - `apps/_template/` references test templates in `testing/apps/`
   - Template test file covers: init/shutdown lifecycle, data collection toggle, bot start/stop

3. **Generic API tests**:
   - Test `toggle-data`, `toggle-bot`, `switch-mode` with any registered bot name
   - Currently `testing/api/execution.test.js` exists — extend it for multi-bot

4. **Test registry validation**:
   - A test that iterates all `apps/*/index.js` and verifies each exports the required lifecycle methods
   - Catches broken contracts immediately

---

## 4. Evaluation of Your Suggestions

### "Generic Dashboard Components — one template, loads strategies automatically"
**Verdict**: Adopted as WP-2. This is the highest-impact change for dashboard scalability. The key insight: strategy cards should be generated from `config.json` keys, not hardcoded in HTML.

### "Standard Bot Template"
**Verdict**: Adopted as WP-6. Using `apps/_template/` with `_` prefix to prevent auto-discovery. Slightly different from your suggestion of `apps/template-bot/` — a folder starting with `_` is the convention for non-runnable templates.

### "Self-Healing & Auto-Debug service (services/debug-assistant.js)"
**Verdict**: Not included in this proposal. Here's why:
- The value of a debug assistant comes from understanding failures — but we already have comprehensive test coverage + Playwright screenshots on failure
- Adding a new service that runs tests and analyzes logs would duplicate what the AI operator (me) already does in conversation
- Better investment: make the test suite so thorough that failures are self-documenting via assertion messages
- If this becomes needed later, it would be a scheduler cron that runs `npm test` on an interval and posts results via messaging — not a core service

### "Keep the Master Context Alive (Master Document updates)"
**Verdict**: Reframed as WP-5. Rather than a separate "Master Context Document", the existing README.md system is the right vehicle. The key improvement is making folder READMEs consistently useful (interface contracts, not just overviews) and adding `.github/copilot-instructions.md` for AI-specific rules.

### "Brain getting smarter (priority queue, confidence scores, conflict resolution)"
**Verdict**: Not in this proposal — this is a feature enhancement, not a scaling prerequisite. The brain at 680 lines is already sophisticated. Making it smarter is valuable but orthogonal to the structural work needed to support 20 bots. Can be done anytime as a separate effort.

### "Config hell — JSON schemas for every bot/strategy"
**Verdict**: Partially addressed. Each strategy already has `config.schema.js` (Zod). The dynamicConfig system already validates and persists. What's missing is documented in WP-5 (README schema documentation). Full runtime schema validation on config changes would be a good follow-up.

---

## 5. What We DON'T Do (And Why)

| Tempting idea | Why we skip it |
|---|---|
| **Microservices** (each bot as a separate process) | The single-process model works well — shared cache, no IPC overhead, simple deployment. Extract only if memory/CPU isolation becomes necessary |
| **Database per bot** (separate SQLite files) | One database with `botName` column is simpler and enables cross-bot dashboard queries |
| **GraphQL** | REST + file routing is working great. GraphQL adds complexity without clear benefit for this use case |
| **Frontend framework** (React/Vue) | Server-rendered HTML with vanilla JS is fast, simple, and AI-friendly. A framework would triple the complexity |
| **Config hot-reload (pub/sub)** | Nice to have, but strategies already re-read config on each `tick()` via `getEffectiveConfig()`. Not a scaling blocker |
| **WebSocket dashboard** | Current polling (fetch every N seconds) is adequate. WebSocket adds connection management complexity |

---

## 6. Proposed Execution Order

```
WP-1  Bot Registry & Lifecycle     ← Foundation (everything depends on this)
  ↓
WP-3  Storage Isolation            ← Can be done in parallel with WP-4
WP-4  Cache Namespacing            ← Can be done in parallel with WP-3
  ↓
WP-2  Parameterized Dashboard      ← Needs WP-1 (listBots) + WP-4 (getBotData)
  ↓
WP-6  Bot Template                 ← Needs WP-1 (lifecycle contract finalized)
WP-5  Documentation Upgrade        ← Can happen anytime, ideally after WP-1/WP-2
WP-7  Test Infrastructure          ← Evolves with each WP, formalized last
```

Each WP ends with all 147+ tests passing. No WP is merged until tests are green.

---

## 7. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Breaking steem-dex-bot during refactor | Full test suite runs after every change. steem-dex-bot is the golden reference |
| Regression in dashboard | Playwright E2E catches visual/functional regressions. Screenshots archived |
| Over-engineering the registry | Keep it to 4 functions: register, get, list, status. No plugin system, no hooks |
| Template becoming stale | Template is tested — a test imports it and verifies all exports exist |
| README drift | Convention: update the folder README in the same PR that changes the folder |

---

## 8. Summary: What Changes vs What Stays

### Changes
- `index.js` boot sequence → auto-discover from `apps/`
- New `services/botRegistry/index.js` → central bot management
- `loadRoutes.js` → support `[param]` in filenames
- New `routes/dashboard/bots/[name].get.js` → generic bot page
- `steemDexStore.js` → add `botName` column, rename to `botStore.js`
- `services/cache/index.js` → per-bot namespacing under `runtimeCache.bots`
- New `apps/_template/` → bot scaffolding
- New `.github/copilot-instructions.md` → AI rules
- All folder READMEs → upgraded with interface contracts
- E2E tests → bot-count-agnostic

### Stays the same
- Layer architecture (`apps → strategies → core → connectors ← services`)
- Strategy interface (`init / tick / shutdown / describe`)
- Registry pattern (chains, dex, cex, strategies)
- File-based routing (enhanced, not replaced)
- Dynamic config system (enhanced, not replaced)
- Brain coordinator logic
- All existing unit tests (may gain parameters)
- Server-rendered HTML approach (no frontend framework)
- SQLite + JSONL storage pattern
- Logger, messaging, validation services
