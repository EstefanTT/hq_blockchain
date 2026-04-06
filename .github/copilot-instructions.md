# Copilot Instructions — hq_blockchain

## Project Stack

- **Runtime**: Node.js ESM (v18.20.6) — all files use `import`/`export`, no CommonJS
- **HTTP**: Express 5 — file-based routing via `api/utils/loadRoutes.js`
- **Database**: better-sqlite3 — synchronous SQLite for persistence
- **Unit tests**: `node:test` + `node:assert/strict` (NOT jest, NOT mocha)
- **E2E tests**: Playwright for dashboard

## Coding Conventions

- No TypeScript, no JSDoc type annotations (unless already present in file)
- `const` by default, `let` only when reassignment is needed
- Arrow functions for callbacks, named functions for exports
- Error-first pattern: validate inputs, throw early, catch at boundaries
- Flat imports with explicit `index.js`: `import { x } from '../../services/cache/index.js'`
- Bot functions always take `botName` as first parameter

## Naming

- **Files**: kebab-case (`market-making.js`, `steem-dex-bot`)
- **Exports**: camelCase (`updatePriceFeed`, `getBotData`)
- **Constants**: UPPER_SNAKE (`BOT_NAME`, `CHAIN_NAME`)
- **Config keys**: camelCase in JSON files

## Architecture Patterns

- **Registries**: `register(name, impl)`, `get(name)`, `list()` — used for bots, chains, dex, cex, strategies
- **Bot lifecycle**: `meta` object + `init()`, `startDataCollection()`, `stopDataCollection()`, `startBot()`, `stopBot()`, `shutdown()`, `getStatus()`
- **File-based routing**: `routes/domain/action.method.js` → `METHOD /api/domain/action`
- **Config merge**: static JSON → dynamic overrides → runtime cache
- **Cache namespacing**: per-bot state under `runtimeCache.bots[botName]`, global state at top level

## Testing

- Unit tests in `testing/` mirroring source structure (max 2-level depth: `testing/<category>/<name>.test.js`)
- E2E tests in `tests/e2e/`
- Run unit: `npm test`
- Run E2E: `npm run test:e2e` (requires server running)
- Test runner: `node --test` (built-in, NOT a framework)
- Use `describe`/`it`/`before`/`after` from `node:test`
- Use `assert` from `node:assert/strict`

## Common Mistakes to Avoid

- Don't use `require()` — project is ESM
- Don't import from `apps/bot-name` directly — use `botRegistry`
- Don't add cache keys without `botName` — per-bot state is namespaced under `runtimeCache.bots[botName]`
- Don't hardcode bot names in API routes — get from request params or registry
- Don't create new SQLite tables without `botName` column
- Don't place test files deeper than 2 levels — `testing/**/*.test.js` glob won't find them
