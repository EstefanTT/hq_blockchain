# AI Session Checklist

Paste the relevant section into your opening prompt, or just say "read .github/ai-session-checklist.md first".

---

## Before Starting a New Chat

### Context to provide
- Point to the **task spec** (e.g. `documents/app-scaling/wp-8.md`)
- Point to the **reference implementation** (e.g. `apps/steem-dex-bot/index.js`)
- Point to **2-3 key files** the task touches — don't say "read everything"
- Mention the **current test baseline** (e.g. "200 unit tests passing")

### Example opening prompt
```
I'm continuing work on hq_blockchain. Read these files for context:
- documents/app-scaling/wp-9.md (current task)
- apps/steem-dex-bot/index.js (reference bot)
- services/cache/index.js (will be modified)

Test baseline: 181 unit tests passing. Then implement WP-9.
```

---

## Before Adding a New Bot

### Remind the AI
- Copy `apps/_template/` — don't write from scratch
- Run `npm test` before and after — lifecycle contract test auto-validates new bots
- Eliminate steem-specific shims in `home-data.get.js` and `bots/data/[name].get.js` — replace `if (name === 'steem-dex-bot')` with generic registry-driven logic
- Config must go through `getEffectiveConfig(botName)` — never read `config.json` directly
- All cache state under `runtimeCache.bots[botName]` — call `initBotCache(botName)` in `init()`
- All storage calls take `botName` as first argument
- Dashboard sidebar, bot cards, and E2E tests are already dynamic — no hardcoded counts

### Prompt addition
```
This is a new bot. Check .github/ai-session-checklist.md for the bot creation checklist. Eliminate any steem-dex-bot shims while integrating this bot.
```

---

## Before Editing Existing Functionality

### Remind the AI
- Read the file before editing — don't propose changes blind
- Check if the change affects the lifecycle contract (`meta`, `init`, `getStatus`, etc.)
- Check if the change needs a config field — if so, update schema + `getEffectiveConfig` path
- Check if the change needs a cache key — if so, namespace it under `runtimeCache.bots[botName]`
- Check if the change needs a storage table/column — if so, include `botName`
- Run `npm test` after every change

---

## After Completing a Task

### Remind the AI
- Run `npm test` — all unit tests must pass
- botStore tests are included in `npm test` (no separate run needed)
- Verify `node --check` on any new/modified files
- If a new service was added → update `copilot-instructions.md` Architecture Patterns
- If a new anti-pattern was found → update `copilot-instructions.md` Common Mistakes
- If a new convention emerged → update `copilot-instructions.md` (conventions section or scaling rules)
- If working through a WP series → the last WP should include a "update copilot-instructions.md" step

### Prompt addition
```
After finishing, update .github/copilot-instructions.md if any new patterns, services, or anti-patterns were introduced.
```

---

## Danger Zones to Watch

| Risk | What to check | When |
|---|---|---|
| Shim accumulation | `if (name === 'xxx')` in dashboard/API code | Adding any bot |
| Config sprawl | Direct `config.json` reads bypassing `getEffectiveConfig` | Adding config fields |
| Test drift | Custom test runners outside `npm test` | Adding test files |
| Cache collision | Missing `botName` prefix on cache keys | Touching cache code |
| Storage collision | Missing `botName` column or parameter | Touching storage code |
| Import depth | Test files deeper than `testing/<category>/<name>.test.js` | Adding tests |
| Registry bypass | Direct `import` from `apps/<bot>/` instead of `botRegistry` | Any cross-bot code |

---

## Quick Reference: Key File Locations

| What | Where |
|---|---|
| AI instructions | `.github/copilot-instructions.md` |
| Bot template | `apps/_template/` |
| Lifecycle contract test | `testing/apps/lifecycle.test.js` |
| Bot registry | `services/botRegistry/index.js` |
| Cache (per-bot) | `services/cache/index.js` |
| Storage (per-bot) | `services/storage/botStore.js` |
| Config (effective) | `services/dynamicConfig/index.js` |
| Dashboard data API | `api/routes/dashboard/home-data.get.js` |
| Bot page data API | `api/routes/dashboard/bots/data/[name].get.js` |
| E2E tests | `tests/e2e/dashboard.spec.js` |
| Work packages | `documents/app-scaling/wp-*.md` |
