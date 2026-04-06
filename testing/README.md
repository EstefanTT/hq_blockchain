# testing/

Test files — mirrors the source structure for easy navigation.

## File Inventory

| Folder / File | Tests for |
|---|---|
| `api/execution.test.js` | Execution API endpoints (toggle-bot, toggle-data, set-dry-run, etc.) |
| `apps/lifecycle.test.js` | Bot lifecycle contract (init, start, stop, shutdown) |
| `connectors/steem-like/integration.test.js` | Steem-like adapter end-to-end flow |
| `connectors/steem-like/normalizer.test.js` | Order book and trade normalization |
| `core/dryRun.test.js` | Dry-run wrapper and flag |
| `core/rebalance.test.js` | Rebalance module logic |
| `core/slippageCheck.test.js` | Slippage guard and computation |
| `services/botRegistry.test.js` | Bot registry CRUD operations |
| `services/cache.test.js` | Cache namespacing, per-bot state, getters |
| `services/storage/botStore.test.js` | Bot-specific SQLite storage (standalone — run directly) |
| `strategies/brain.test.js` | Brain mode switching and strategy selection |
| `strategies/marketMaking.test.js` | Market-making strategy tick logic |
| `strategies/microLayer.test.js` | Micro-layer order placement |
| `strategies/aggressiveSniping.test.js` | Aggressive sniping strategy |
| `strategies/botExploitation.test.js` | Bot exploitation strategy |
| `strategies/defensivePause.test.js` | Defensive pause strategy |
| `strategies/gridRange.test.js` | Grid range strategy |
| `strategies/meanReversion.test.js` | Mean reversion strategy |
| `scripts/analyzelog.test.js` | Log analysis utilities |
| `scripts/backtest.test.js` | Backtesting utilities |
| `scripts/shared.test.js` | Shared test helpers |
| `fixtures/` | Shared test data (mock prices, fake orders, sample configs) |
| `utils/` | Test helper utilities |

## Running Tests

```bash
# All unit tests (discovers testing/**/*.test.js — max 2-level depth)
npm test

# Standalone botStore tests (3-level deep, must run directly)
node testing/services/storage/botStore.test.js

# E2E tests (requires server running)
npm run test:e2e
```

## Conventions

- Test runner: `node --test` (built-in) — NOT jest, NOT mocha
- Use `describe`/`it`/`before`/`after` from `node:test`
- Use `assert` from `node:assert/strict`
- Test files must be at max 2-level depth: `testing/<category>/<name>.test.js` — deeper files won't be discovered by `npm test`
- Mirror the source structure: tests for `core/risk/rebalance.js` → `testing/core/rebalance.test.js`
- Fixtures in `testing/fixtures/` — shared mock data
- Each test file should be self-contained — mock dependencies, don't rely on running server
