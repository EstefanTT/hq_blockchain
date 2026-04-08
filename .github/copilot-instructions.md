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
- **Dashboard readiness**: `meta.ready` controls sidebar visibility — `true` = clickable link, `false` = greyed-out placeholder. Flip this flag when an app becomes fully implemented (see `apps/README.md`)
- **File-based routing**: `routes/domain/action.method.js` → `METHOD /api/domain/action`
- **Config merge**: `static/general.json` → `apps/<bot>/config.json` → `config/dynamic/` overrides → runtime cache. **Single source of truth**: always call `getEffectiveConfig(botName)` — never read a bot's `config.json` directly
- **Cache namespacing**: per-bot state under `runtimeCache.bots[botName]`, global state at top level
- **Bot template**: `apps/_template/` — always copy this when scaffolding a new bot; auto-discovery skips `_` prefixed dirs

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
- Don't let bots read their own `config.json` — always go through `getEffectiveConfig(botName)`
- Don't create custom test runners — all tests must use `node:test` and run under `npm test`
- Don't add `if (botName === 'xxx')` branches in dashboard/API code — use registry-driven logic
- Don't set `meta.ready: true` on stub/scaffold bots — they must stay greyed out in the sidebar

## Scaling Rules

### Shim Elimination
- `home-data.get.js` and `bots/data/[name].get.js` currently contain `if (name === 'steem-dex-bot')` shims from the single-bot era
- When adding bot #2: **refactor these shims into generic registry-driven logic** — do not add a second `if` branch
- Dashboard pages and data endpoints must work from `listBots()` + bot metadata, not hardcoded names

### Config Discipline
- `getEffectiveConfig(botName)` is the **only** way to read bot config at runtime
- Merge order: `static/general.json` → `apps/<bot>/config.json` → `config/dynamic/` overrides → runtime cache
- When adding new config fields: update the config schema + dynamic config handler
- Never create bot-specific config reading shortcuts

### Test Integrity
- All unit tests live in `testing/` and run with `npm test` (`node --test`)
- E2E tests are bot-count-agnostic — they query the registry, not hardcoded counts
- Lifecycle contract test (`testing/apps/lifecycle.test.js`) auto-validates every bot in `apps/`
- When adding a new bot, existing tests must pass without modification

## Self-Maintenance

When working on this codebase, **update this file** as part of the task:
- **New service added** → add a one-line entry under Architecture Patterns
- **New anti-pattern discovered** → add it to Common Mistakes to Avoid
- **New convention solidified** (e.g. "all cron jobs accept botName") → document it here
- **Work package series** → add the self-maintenance step as the last item in the final WP
