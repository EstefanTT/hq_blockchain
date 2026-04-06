# WP-2: Parameterized Dashboard (One Template, N Bots)

**Priority**: 2  
**Depends on**: WP-1 (bot registry), WP-4 (cache namespacing)  
**Status**: Not started

---

## Goal

Replace the 831-line bot-specific HTML file with one generic bot template that renders ANY registered bot. The master dashboard iterates over all bots dynamically. Adding a new bot requires zero dashboard code.

---

## Problem (current state)

### 1. `steem-dex-bot.get.js` is 831 lines of HTML hardcoded to one bot
- Strategy card names, parameter keys, token symbols — all hardcoded
- Bot page URL is a static file: `/api/dashboard/steem-dex-bot`
- To add bot #2 = duplicate 831 lines, change variable names, create new route file
- At 20 bots = 16,620 lines of duplicated HTML

### 2. `home-data.get.js` hardcodes one bot
```javascript
const { isTradingActive, getBotName, isDataCollectionActive } = await import('apps/steem-dex-bot/index.js');
const bots = [{ name: botName, label: 'STEEM DEX Bot', ... }];
```
Every new bot = add another hardcoded block.

### 3. `steem-prices.get.js` imports one bot directly
```javascript
import('../../../apps/steem-dex-bot/index.js').then(m => { _bot = m; });
```
No way to serve data for a different bot.

### 4. `loadRoutes.js` doesn't support route parameters
Route `routes/dashboard/steem-dex-bot.get.js` → `GET /api/dashboard/steem-dex-bot`  
We need `routes/dashboard/bots/[name].get.js` → `GET /api/dashboard/bots/:name`

### 5. Sidebar is hardcoded
The sidebar `<aside>` in all three dashboard pages has hardcoded `<a>` links. Adding a bot = editing 3 files.

---

## Deliverables

### A. Extend `loadRoutes.js` to support `[param]` in filenames

**File**: `api/utils/loadRoutes.js`

After extracting `name` from the filename regex match, convert bracket params to Express params:

```javascript
// After: const routePath = path.join(routePrefix, name === 'index' ? '' : name);
// Add:   Convert [param] → :param for Express dynamic routes
const routeUrl = routePath.replace(/\\/g, '/')
                          .replace(/\[(\w+)\]/g, ':$1');
```

That's the only change needed. Now:
- `routes/dashboard/bots/[name].get.js` → `GET /api/dashboard/bots/:name`
- `routes/dashboard/bots/[name]-data.get.js` → `GET /api/dashboard/bots/:name-data`

### B. Create generic bot page route

**New file**: `api/routes/dashboard/bots/[name].get.js`

This replaces `steem-dex-bot.get.js`. Key design:

1. **Receives** `req.params.name` (e.g. `steem-dex-bot`)
2. **Validates** bot exists via `getBot(name)` from botRegistry
3. **Loads** `getEffectiveConfig(name)` for that bot's strategy parameters
4. **Renders** HTML using data from the bot's meta + config

Strategy cards are generated from config keys:
```javascript
const config = getEffectiveConfig(botName);
const strategyKeys = Object.keys(config).filter(k =>
  typeof config[k] === 'object' && config[k]?.enabled !== undefined
  && !['risk', 'brain', 'baseToken', 'quoteToken'].includes(k)
);
// strategyKeys = ['microLayer', 'marketMaking', 'aggressiveSniping', ...]
```

Each strategy card:
- Name: derived from key via camelCase → Title Case (e.g. `marketMaking` → `Market Making`)
- Toggle: from `disabledStrategies` array
- Parameters: from config object keys (skip `enabled`, non-primitive sub-objects)
- Badge: ON/OFF from `isStrategyDisabled(botName, key)`

**The HTML template structure** (same sections as current bot page):
- Top bar: token input, Data toggle, Dry-Run toggle, mode select, Emergency Stop
- Bot Power section: Data toggle, Bot toggle, Mode badge
- KPI row: Generated from bot's `getStatus()` + cache data
- Strategy cards: Generated dynamically from config keys
- Prices section: If bot has price data in cache
- Order book: If bot has order book data in cache
- Micro layer: If config has `microLayer`
- Analysis tools: Generic for all bots
- Recent logs: From storage

**What's bot-specific vs generic**:
| Section | Generic? | How |
|---|---|---|
| Top bar controls | YES | All bots have Data/Bot/DryRun toggles |
| KPI row | SEMI | KPI fields come from `meta.pairs` + cache |
| Strategy cards | YES | Generated from config object keys |
| Prices | SEMI | Only shown if price data exists in cache |
| Order book | SEMI | Only shown if order book data exists |
| Micro layer | SEMI | Only shown if `microLayer` in config |
| Analysis tools | YES | Run scripts with `--bot <name>` arg |

### C. Create generic bot data endpoint

**New file**: `api/routes/dashboard/bots/[name]-data.get.js`

Replaces `steem-prices.get.js`. Pattern:

```javascript
import auth from '../../../middlewares/auth.js';
import { getBotModule } from '../../../../services/botRegistry/index.js';
import { getBotData } from '../../../../services/cache/index.js';  // from WP-4

export default [auth, function handler(req, res) {
  const { name } = req.params;
  const bot = getBotModule(name);  // throws if not found

  const data = getBotData(name);   // WP-4: namespaced cache getter
  data.botEnabled = bot.getStatus().trading;
  data.dataCollectionEnabled = bot.getStatus().dataCollection;

  // Include effective config + bot control
  const { getEffectiveConfig, getBotControl } = await import('services/dynamicConfig/index.js');
  data.effectiveConfig = getEffectiveConfig(name);
  data.botControlState = getBotControl(name);

  res.json(data);
}];
```

### D. Update `home-data.get.js` to be multi-bot

**File**: `api/routes/dashboard/home-data.get.js`

Replace hardcoded single-bot with registry loop:

```javascript
import { listBots, getBotModule } from '../../../services/botRegistry/index.js';
import { getBotControl } from '../../../services/dynamicConfig/index.js';

// Build bots array dynamically
const bots = listBots().map(botMeta => {
  const mod = getBotModule(botMeta.name);
  const status = mod.getStatus();
  const control = getBotControl(botMeta.name);

  return {
    name: botMeta.name,
    label: botMeta.displayName,
    chain: botMeta.chain,
    pair: botMeta.pairs.join(', '),
    enabled: status.trading,
    dataCollection: status.dataCollection,
    dryRun: control.dryRun,
    disabledStrategies: control.disabledStrategies,
    error: status.error,
  };
});
```

### E. Update master dashboard for dynamic sidebar + bot cards

**File**: `api/routes/dashboard/index.get.js`

1. **Sidebar**: Generate bot links from `listBots()`:
```javascript
const { listBots } = await import('services/botRegistry/index.js');
const botLinks = listBots().map(b =>
  `<a href="/api/dashboard/bots/${b.name}">${b.displayName}</a>`
).join('');
```

2. **Bot cards in HTML**: Already rendered from the data endpoint, but the `botCard()` JS function needs to handle the generic bot format returned by the updated `home-data.get.js`.

### F. Backward compatibility redirect

**File**: `api/routes/dashboard/steem-dex-bot.get.js`

Replace 831 lines with a redirect:
```javascript
export default function(req, res) {
  res.redirect(301, '/api/dashboard/bots/steem-dex-bot');
}
```

Keep this for bookmarks / old URLs. Can be removed later.

### G. Update sidebar in ALL dashboard pages

The sidebar currently lives inside each HTML template (`index.get.js`, `logs.get.js`, `steem-dex-bot.get.js`). Consider extracting it to a shared function:

```javascript
// api/routes/dashboard/shared/sidebar.js
export function renderSidebar(botList, activePage) {
  return `
    <aside>
      <a href="/api/dashboard" class="${activePage === 'home' ? 'active' : ''}">Dashboard</a>
      ${botList.map(b => `
        <a href="/api/dashboard/bots/${b.name}" class="${activePage === b.name ? 'active' : ''}">${b.displayName}</a>
      `).join('')}
      <a href="/api/dashboard/logs" class="${activePage === 'logs' ? 'active' : ''}">Logs</a>
    </aside>
  `;
}
```

Then each page imports it and passes the active page name. This eliminates the N×edit problem for sidebar changes.

---

## Files to create
- `api/routes/dashboard/bots/[name].get.js` (generic bot page)
- `api/routes/dashboard/bots/[name]-data.get.js` (generic bot data)
- `api/routes/dashboard/shared/sidebar.js` (shared sidebar renderer)

## Files to modify
- `api/utils/loadRoutes.js` (add `[param]` → `:param` conversion)
- `api/routes/dashboard/home-data.get.js` (use registry loop)
- `api/routes/dashboard/index.get.js` (use shared sidebar, dynamic bot cards)
- `api/routes/dashboard/logs.get.js` (use shared sidebar)
- `api/routes/dashboard/steem-dex-bot.get.js` (replace with redirect)
- `api/routes/dashboard/steem-prices.get.js` (replace with redirect or delete — replaced by `[name]-data.get.js`)
- `api/routes/execution/toggle-bot.post.js` (if it exists — use registry)
- `api/routes/execution/toggle-data.post.js` (use registry for bot lookup)

## Files to delete (after migration)
- None immediately. `steem-dex-bot.get.js` becomes a redirect.
- `steem-prices.get.js` can be removed if no frontend code calls it directly.

---

## Strategy card generation logic (critical detail)

The current steem-dex-bot page has 6 hardcoded strategy cards. The generic version must:

1. **Discover strategies from config**:
```javascript
// Known strategy-like keys have: { enabled: bool, ...params }
const PARAM_BLACKLIST = ['name', 'enabled', 'dryRun', 'chainName', 'nodes',
  'baseToken', 'quoteToken', 'risk', 'brain', 'maxOrderSizeBase',
  'maxOrderSizeQuote', 'tinyPyramidBaseSizeQuote'];

const strategies = Object.entries(config)
  .filter(([key, val]) => typeof val === 'object' && val !== null && 'enabled' in val && !PARAM_BLACKLIST.includes(key));
```

2. **Convert camelCase to display name**:
```javascript
function displayName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}
// 'marketMaking' → 'Market Making'
// 'aggressiveSniping' → 'Aggressive Sniping'
// 'microLayer' → 'Micro Layer'
```

3. **Render parameters**: Loop over the strategy object's keys, skip `enabled`, render input fields for primitives (number, string, boolean).

---

## Dependency on WP-4 (Cache Namespacing)

The generic data endpoint (`[name]-data.get.js`) needs `getBotData(botName)` which is part of WP-4. 

**If WP-4 isn't done yet**: we can implement WP-2 with a temporary shim that only works for `steem-dex-bot`:
```javascript
if (name === 'steem-dex-bot') data = getSteemDexBotData();
else data = {};
```
Then WP-4 replaces this with the real generic getter.

---

## E2E test updates needed

- Update URL in steem-dex-bot tests: `/api/dashboard/steem-dex-bot` → `/api/dashboard/bots/steem-dex-bot` (or test the redirect)
- Bot card tests: update selectors if HTML structure changes
- Sidebar tests: verify dynamic bot links appear
- Add test: navigate to generic bot page for steem-dex-bot, verify it loads correctly
- Bot count assertion: keep `toHaveCount(1)` for now since only 1 bot has real data

---

## Verification checklist
- [ ] `node --check` passes for all new/modified files
- [ ] `loadRoutes.js` correctly registers `[name]` as `:name` Express param
- [ ] Navigating to `/api/dashboard/bots/steem-dex-bot` shows the full bot page
- [ ] Old URL `/api/dashboard/steem-dex-bot` redirects to new URL
- [ ] Strategy cards are generated from config (not hardcoded)
- [ ] Sidebar shows all registered bots dynamically
- [ ] Master dashboard bot cards loop over all registered bots
- [ ] `home-data.get.js` returns data for all registered bots
- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass (after URL updates)
- [ ] Adding a new stub bot folder → bot appears in sidebar + master dashboard
