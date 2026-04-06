# WP-7: Test Infrastructure (Bot-Count-Agnostic Tests)

**Priority**: Runs alongside each WP (tests update with each WP)  
**Depends on**: WP-1 through WP-6 (tests validate all changes)  
**Status**: Not started

---

## Goal

Tests don't break when a new bot folder is added. E2E tests dynamically verify whatever bots are registered. Unit tests validate the bot lifecycle contract generically. A template test skeleton ships with WP-6.

---

## Problem (current state)

### E2E tests (`tests/e2e/dashboard.spec.js` — 321 lines, 25 tests)

Hardcoded assumptions:
- `await expect(botCards).toHaveCount(1)` — fails if 2 bots register
- `await page.click('text=STEEM DEX Bot')` — bot name hardcoded
- `page.goto('/api/dashboard/steem-dex-bot')` — URL hardcoded
- Strategy card names, parameter labels, toggle IDs — all steem-specific

### Unit tests (`testing/` — 122 tests)

- `testing/api/execution.test.js` — tests POST endpoints that currently hardcode steem-dex-bot
- `testing/services/storage/steemDexStore.test.js` — file name is bot-specific, calls don't pass botName
- Cache tests — if they exist, don't pass botName

### No contract validation test

Nothing verifies that all bots in `apps/` conform to the lifecycle contract. A bot with a typo in `getStatus` → silent failure at runtime.

---

## Deliverables

### A. Make E2E bot card count dynamic

**File**: `tests/e2e/dashboard.spec.js`

Replace:
```javascript
await expect(botCards).toHaveCount(1);
```

With:
```javascript
const botCount = await botCards.count();
expect(botCount).toBeGreaterThanOrEqual(1);
```

Or better — fetch the expected count from the API:
```javascript
const response = await page.request.get('/api/dashboard/home-data');
const data = await response.json();
const expectedBotCount = data.bots.length;
await expect(botCards).toHaveCount(expectedBotCount);
```

### B. Make E2E bot page tests parameterized

Replace hardcoded steem-dex-bot tests with a loop:

```javascript
test.describe('Bot Pages', () => {
  let bots;

  test.beforeAll(async ({ request }) => {
    const response = await request.get('/api/dashboard/home-data');
    const data = await response.json();
    bots = data.bots;
  });

  test('each registered bot has a working page', async ({ page }) => {
    for (const bot of bots) {
      await page.goto(`/api/dashboard/bots/${bot.name}`);
      await expect(page.locator('h1, .bot-title')).toContainText(bot.label);
      // Verify basic sections exist
      await expect(page.locator('.bot-power, [data-section="controls"]')).toBeVisible();
    }
  });

  test('each bot page loads data', async ({ page }) => {
    for (const bot of bots) {
      const response = await page.request.get(`/api/dashboard/bots/${bot.name}-data`);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('botControlState');
    }
  });
});
```

### C. Keep steem-dex-bot specific tests

Some tests must stay bot-specific (testing steem-specific features like SBD/STEEM pairs, micro layer, etc.). Keep them but:
1. Move into a `test.describe('STEEM DEX Bot Specific', () => { ... })` block
2. Guard with a check:
```javascript
test.skip(!bots.some(b => b.name === 'steem-dex-bot'), 'steem-dex-bot not registered');
```

### D. Add lifecycle contract validation test

**New file**: `testing/apps/lifecycle-contract.test.js`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'fs';
import { join } from 'path';

describe('Bot Lifecycle Contract', () => {
  const appsDir = join(process.cwd(), 'apps');
  const botDirs = readdirSync(appsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name);

  for (const dir of botDirs) {
    describe(dir, () => {
      let mod;

      it('can be imported', async () => {
        mod = await import(`../../apps/${dir}/index.js`);
      });

      it('has meta export (or is intentionally excluded)', () => {
        // Bots without meta are skipped by auto-discovery (e.g. research-sandbox)
        if (!mod.meta) return; // skip further checks
      });

      it('meta has required fields', () => {
        if (!mod.meta) return;
        assert.ok(mod.meta.name, 'meta.name required');
        assert.ok(mod.meta.displayName, 'meta.displayName required');
        assert.ok(mod.meta.chain, 'meta.chain required');
        assert.ok(Array.isArray(mod.meta.pairs), 'meta.pairs must be array');
        assert.ok(mod.meta.description, 'meta.description required');
      });

      it('exports all required lifecycle methods', () => {
        if (!mod.meta) return;
        const required = ['init', 'startDataCollection', 'stopDataCollection',
                          'startBot', 'stopBot', 'shutdown', 'getStatus'];
        for (const method of required) {
          assert.equal(typeof mod[method], 'function', `missing export: ${method}`);
        }
      });

      it('getStatus returns correct shape', () => {
        if (!mod.meta) return;
        const status = mod.getStatus();
        assert.equal(typeof status.dataCollection, 'boolean', 'dataCollection must be boolean');
        assert.equal(typeof status.trading, 'boolean', 'trading must be boolean');
        assert.ok('error' in status, 'error field must exist');
      });
    });
  }
});
```

### E. Update storage tests for botName

**File**: `testing/services/storage/botStore.test.js` (renamed from steemDexStore.test.js in WP-3)

All test calls gain `botName` as first argument:
```javascript
// Before:
saveOrderBookSnapshot('steem', 'STEEM', 'SBD', book);

// After:
saveOrderBookSnapshot('test-bot', 'steem', 'STEEM', 'SBD', book);
```

Add new test:
```javascript
it('two bots with same pair have isolated data', () => {
  updatePosition('bot-a', 'steem', 'STEEM', 'SBD', { base: 100, quote: 200 });
  updatePosition('bot-b', 'steem', 'STEEM', 'SBD', { base: 300, quote: 400 });

  const posA = getCurrentPosition('bot-a', 'steem', 'STEEM', 'SBD');
  const posB = getCurrentPosition('bot-b', 'steem', 'STEEM', 'SBD');

  assert.equal(posA.baseBalance, 100);
  assert.equal(posB.baseBalance, 300);
});
```

### F. Update cache tests for botName

**File**: `testing/services/cache/cache.test.js`

All updater/getter calls gain `botName`. Add isolation test:
```javascript
it('two bots have independent cache state', () => {
  initBotCache('bot-a');
  initBotCache('bot-b');

  updatePriceFeed('bot-a', { price: 1.5 });
  updatePriceFeed('bot-b', { price: 2.5 });

  assert.deepEqual(getBotData('bot-a').priceFeed, { price: 1.5 });
  assert.deepEqual(getBotData('bot-b').priceFeed, { price: 2.5 });
});
```

### G. Update execution API tests

**File**: `testing/api/execution.test.js`

Tests for POST endpoints need to send `bot` in request body:
```javascript
// Before:
const res = await fetch('/api/execution/toggle-bot', { method: 'POST', body: '{}' });

// After:
const res = await fetch('/api/execution/toggle-bot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bot: 'steem-dex-bot' }),
});
```

### H. Template test skeleton in WP-6

**New file**: `apps/_template/tests/example.test.js`

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('your-bot-name', () => {
  before(async () => {
    // Setup: init bot, start data collection if needed
  });

  after(async () => {
    // Cleanup: shutdown bot
  });

  it('initializes without error', async () => {
    const { init, getStatus } = await import('../index.js');
    await init();
    const status = getStatus();
    assert.equal(status.dataCollection, false);
    assert.equal(status.trading, false);
  });

  // TODO: Add your bot-specific tests
});
```

### I. Update bot registry tests

**File**: `testing/services/botRegistry.test.js` (created in WP-1)

Already defined in WP-1 doc. Ensure:
- Registration / dedup / validation tests
- `listBots()` returns all registered

---

## Test count expectations

| WP | New tests | Modified tests | Net change |
|---|---|---|---|
| WP-1 | ~8 (registry + lifecycle) | ~3 (execution routes) | +8 |
| WP-2 | ~5 (route params, bot page) | ~10 (E2E URL updates) | +5 |
| WP-3 | ~4 (isolation, migration) | ~8 (storage botName) | +4 |
| WP-4 | ~6 (namespace, isolation) | ~4 (cache botName) | +6 |
| WP-5 | 0 (docs only) | 0 | 0 |
| WP-6 | ~2 (template syntax) | 0 | +2 |
| WP-7 | ~5 (contract, parameterized) | ~15 (bot-count-agnostic) | +5 |

**Target**: ~152 unit tests + ~25 E2E tests = ~177 total (up from 147).

---

## Files to create
- `testing/apps/lifecycle-contract.test.js`
- `apps/_template/tests/example.test.js` (part of WP-6)

## Files to modify
- `tests/e2e/dashboard.spec.js` (bot-count-agnostic, URL updates, parameterized)
- `testing/services/storage/botStore.test.js` (botName in all calls, isolation test)
- `testing/services/cache/cache.test.js` (botName in all calls, isolation test)
- `testing/api/execution.test.js` (bot name in request body)
- `testing/services/botRegistry.test.js` (created in WP-1, verified here)

---

## Verification checklist
- [ ] All 122+ existing unit tests still pass after updates
- [ ] All 25 E2E tests still pass after URL/selector updates
- [ ] New lifecycle contract test passes for all bots
- [ ] Adding a new bot folder doesn't break any test
- [ ] Removing a bot folder doesn't break any test (bot-count-agnostic)
- [ ] Storage isolation test proves two bots don't collide
- [ ] Cache isolation test proves two bots don't collide
- [ ] `npm test` runs all unit tests including new ones
- [ ] `npm run test:e2e` runs all E2E tests
