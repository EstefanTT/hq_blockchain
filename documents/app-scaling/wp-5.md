# WP-5: Documentation System (README Upgrade + AI Context)

**Priority**: 5 (can be done any time after WP-1; no code dependencies)  
**Depends on**: WP-1 (so the new botRegistry has a README), WP-6 (so template has a README)  
**Status**: Not started

---

## Goal

Every folder's README is useful enough that an AI agent reading it can understand what the folder does, how files relate, and what conventions to follow — without reading every file. READMEs become the AI's "table of contents" for the codebase.

---

## Problem (current state)

### README quality varies wildly (rated 1–5):

| Rating | Files | Issue |
|---|---|---|
| 5/5 | `README.md` (root) | Excellent — architecture overview, boot flow, project map |
| 4/5 | `strategies/README.md` | Good — file inventory, how to add strategies |
| 3/5 | 8 files | Describe purpose but lack: file inventory, interface contracts, dependency info |
| 2/5 | 8 files | Stubs — just a title and one-line description, no useful context |
| 1/5 | 2 files | Near-empty placeholders |

### No `.github/copilot-instructions.md`
There's no global instructions file for AI agents. Conventions, preferences, and patterns are only discoverable by reading code.

### No enforced README structure
Each README has a different format. An AI loading a README doesn't know what sections to expect.

---

## Deliverables

### A. Define standard README template

Every folder-level README MUST have these sections:

```markdown
# Folder Name

One-paragraph purpose description.

## File Inventory

| File | Purpose | Key Exports |
|---|---|---|
| `file.js` | What it does | `export1, export2` |
| `subfolder/` | What the subfolder contains | — |

## Interface Contract

What this folder exposes to the rest of the app:
- Main entry point: `index.js`
- Key exports: `functionA(params) → returnType`, `functionB(params) → returnType`

## Dependencies

What this folder depends on:
- `services/cache` — for runtime state
- `services/storage` — for persistence

## Conventions

Rules for adding/modifying files in this folder.
```

Not every section applies to every folder. Use judgment:
- Small folders (1–2 files): skip Interface Contract, just list exports in File Inventory
- Leaf folders (no subfolders): skip subfolder entries
- Pure data folders: skip Interface Contract and Dependencies

### B. Upgrade 12 stub READMEs

Priority order (most impactful first):

**Tier 1 — Core infrastructure** (most referenced by AI):
1. `services/README.md` — list all 6 services with purpose + entry point
2. `connectors/README.md` — explain registry pattern, list all connector types
3. `core/README.md` — explain execution/market/portfolio/risk modules
4. `api/README.md` — explain file-based routing, middleware chain, auth flow

**Tier 2 — App-level** (needed for bot development):
5. `apps/README.md` — explain bot lifecycle contract, auto-discovery, how to add a bot
6. `config/README.md` — explain static vs dynamic config, config merge flow
7. `config/dynamic/README.md` — explain wallet/chain/strategy override files

**Tier 3 — Supporting** (useful but less critical):
8. `api/middlewares/README.md` — explain auth.js and errorHandler.js
9. `api/routes/README.md` — explain file naming convention, route generation
10. `scheduler/README.md` — explain cronManager, how to add crons
11. `connectors/apis/README.md` — explain API connector pattern
12. `testing/README.md` — explain test structure, how to run, what to cover

### C. Create `.github/copilot-instructions.md`

Global instructions for AI agents working on this codebase:

```markdown
# Copilot Instructions — hq_blockchain

## Project Stack
- Node.js ESM (v18.20.6) — all files use `import/export`, no CommonJS
- Express 5 (beta) — file-based routing via `api/utils/loadRoutes.js`
- better-sqlite3 — synchronous SQLite for persistence
- node:test + assert — unit test runner (NOT jest, NOT mocha)
- Playwright — E2E tests for dashboard

## Coding Conventions
- No TypeScript, no JSDoc type annotations (unless already present in file)
- Use `const` by default, `let` only when reassignment needed
- Arrow functions for callbacks, named functions for exports
- Error-first pattern: validate inputs, throw early, catch at boundaries
- Flat imports: `import { x } from '../../services/cache/index.js'` (always include index.js)
- Bot functions always take `botName` as first parameter

## Naming
- Files: kebab-case (`market-making.js`, `steem-dex-bot`)
- Exports: camelCase (`updatePriceFeed`, `getBotData`)
- Constants: UPPER_SNAKE (`BOT_NAME`, `CHAIN_NAME`)
- Config keys: camelCase in JSON files

## Architecture Patterns
- **Registries**: `register(name, impl)`, `get(name)`, `list()` — used for bots, chains, dex, cex, strategies
- **Bot lifecycle**: `meta` object + `init()`, `startDataCollection()`, `stopDataCollection()`, `startBot()`, `stopBot()`, `shutdown()`, `getStatus()`
- **File-based routing**: `routes/domain/action.method.js` → `METHOD /api/domain/action`
- **Config merge**: static JSON → dynamic overrides → runtime cache
- **Cache namespacing**: `runtimeCache.bots[botName].field`

## Testing
- Unit tests go in `testing/` mirroring source structure
- E2E tests go in `tests/e2e/`
- Run unit: `npm test`
- Run E2E: `npm run test:e2e` (requires server running)
- Test runner: `node --test` (built-in, NOT a framework)
- Use `describe/it/before/after` from `node:test`
- Use `assert` from `node:assert/strict`

## Common Mistakes to Avoid
- Don't use `require()` — project is ESM
- Don't import from `apps/bot-name` directly — use `botRegistry`
- Don't add cache keys without `botName` — all state is per-bot
- Don't hardcode bot names in API routes — get from request params or registry
- Don't create new SQLite tables without `botName` column
- Don't skip `node --check` before committing — catches syntax errors
```

### D. Update root README if needed

The root `README.md` is already 5/5. After WP-1–4, update it to mention:
- Bot registry and auto-discovery
- Standard lifecycle contract
- How to add a new bot (pointer to template from WP-6)
- Updated folder purpose descriptions if any changed

---

## Files to create
- `.github/copilot-instructions.md`

## Files to modify (upgrade READMEs)
- `services/README.md`
- `connectors/README.md`
- `core/README.md`
- `api/README.md`
- `apps/README.md`
- `config/README.md`
- `config/dynamic/README.md`
- `api/middlewares/README.md`
- `api/routes/README.md`
- `scheduler/README.md`
- `connectors/apis/README.md`
- `testing/README.md`
- `README.md` (root — minor updates)

---

## Process for each README upgrade

1. **Read** the folder's current README
2. **List** all files in the folder
3. **Read** each file's exports (just the export lines, not full content)
4. **Write** the README using the standard template
5. **Verify** accuracy by cross-referencing exports

Do NOT:
- Invent exports that don't exist
- Copy large code blocks into READMEs (keep it reference-level)
- Add usage examples for simple utilities (overkill)
- Document internal implementation details (only interfaces)

---

## Verification checklist
- [ ] All 12 stub READMEs upgraded to standard template
- [ ] Each README has accurate File Inventory table
- [ ] `.github/copilot-instructions.md` created with correct conventions
- [ ] Root README updated with post-WP-1 architecture info
- [ ] No broken markdown (headers, tables, links)
- [ ] No invented/fictional exports or file names in READMEs
