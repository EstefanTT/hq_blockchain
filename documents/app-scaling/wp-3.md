# WP-3: Per-Bot Storage Isolation

**Priority**: 3 (can be done in parallel with WP-4)  
**Depends on**: WP-1 (bot registry for bot names)  
**Status**: Not started

---

## Goal

Two bots trading the same pair (e.g. both trading STEEM/SBD) won't have their data collide. Every storage query is scoped to a specific bot.

---

## Problem (current state)

### `steemDexStore.js` table schemas have no botName

Current primary key / index patterns:
```sql
-- order_book_snapshots
INDEX idx_obs_chain_pair_ts ON (chainName, baseToken, quoteToken, timestamp)

-- trades_history
UNIQUE(chainName, baseToken, quoteToken, tradeId)
INDEX idx_th_chain_pair_ts ON (chainName, baseToken, quoteToken, timestamp)

-- bot_positions
PRIMARY KEY (chainName, baseToken, quoteToken)

-- analysis_log
INDEX idx_al_chain_event_ts ON (chainName, eventType, timestamp)
```

If `bot-A` and `bot-B` both trade STEEM/SBD on chain `steem`:
- They share the same `bot_positions` row (PRIMARY KEY collision)
- Their `order_book_snapshots` are mixed (same chainName + pair)
- Their `trades_history` could conflict on tradeId
- Their `analysis_log` entries are indistinguishable

---

## Deliverables

### A. Add `botName` column to all 4 tables

**Migration approach**: Since this is SQLite and better-sqlite3 doesn't support `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a default, we use a two-step migration:

1. Add column with a default: `ALTER TABLE x ADD COLUMN botName TEXT NOT NULL DEFAULT 'steem-dex-bot'`
2. Update indexes to include botName

This way existing data gets the correct bot attribution, and new rows must provide it.

### B. Rename file: `steemDexStore.js` → `botStore.js`

The store is now generic — not steem-dex-specific. Rename the file and update all imports.

Current import locations (to update):
- `apps/steem-dex-bot/index.js` — imports `saveOrderBookSnapshot, addTrade(s), updatePosition, logAnalysisEvent, countTradesToday, getCurrentPosition`
- `api/routes/dashboard/home-data.get.js` — imports `getRecentAnalysisLogs`
- `api/routes/dashboard/steem-prices.get.js` — imports `getRecentAnalysisLogs`
- `api/routes/dashboard/logs.get.js` — imports `getAnalysisLogsPaginated, getDistinctEventTypes`
- `scripts/analysis/` — various imports
- `testing/services/storage/steemDexStore.test.js` — rename test file too

### C. Update all function signatures to require `botName`

Every exported function gains `botName` as first parameter:

**Write functions**:
```javascript
// Before:
saveOrderBookSnapshot(chainName, baseToken, quoteToken, book)
addTrade(chainName, baseToken, quoteToken, trade)
addTrades(chainName, baseToken, quoteToken, trades)
updatePosition(chainName, baseToken, quoteToken, balances)
logAnalysisEvent(event)

// After:
saveOrderBookSnapshot(botName, chainName, baseToken, quoteToken, book)
addTrade(botName, chainName, baseToken, quoteToken, trade)
addTrades(botName, chainName, baseToken, quoteToken, trades)
updatePosition(botName, chainName, baseToken, quoteToken, balances)
logAnalysisEvent(botName, event)
```

**Read functions**:
```javascript
// Before:
getRecentSnapshots(chainName, baseToken, quoteToken, limit)
getTradeHistory(chainName, baseToken, quoteToken, limit)
getCurrentPosition(chainName, baseToken, quoteToken)
getRecentAnalysisLogs(chainName, limit)
countTradesToday(chainName, baseToken, quoteToken)
getAnalysisLogsByDateRange(chainName, since, until)
getAnalysisLogsPaginated(chainName, opts)
getDistinctEventTypes(chainName)
getSnapshotsByDateRange(chainName, baseToken, quoteToken, since, until)
getTradesByDateRange(chainName, baseToken, quoteToken, since, until)

// After — all gain botName as first param:
getRecentSnapshots(botName, chainName, baseToken, quoteToken, limit)
getTradeHistory(botName, chainName, baseToken, quoteToken, limit)
getCurrentPosition(botName, chainName, baseToken, quoteToken)
getRecentAnalysisLogs(botName, chainName, limit)
countTradesToday(botName, chainName, baseToken, quoteToken)
getAnalysisLogsByDateRange(botName, chainName, since, until)
getAnalysisLogsPaginated(botName, chainName, opts)
getDistinctEventTypes(botName, chainName)
getSnapshotsByDateRange(botName, chainName, baseToken, quoteToken, since, until)
getTradesByDateRange(botName, chainName, baseToken, quoteToken, since, until)
```

### D. Update SQL queries

Every SELECT, INSERT, UPDATE gains the `botName` clause:

```sql
-- Example: order_book_snapshots INSERT
INSERT INTO order_book_snapshots (botName, timestamp, chainName, baseToken, quoteToken, bids, asks, midPrice, spreadPercent)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

-- Example: order_book_snapshots SELECT
SELECT * FROM order_book_snapshots
WHERE botName = ? AND chainName = ? AND baseToken = ? AND quoteToken = ?
ORDER BY timestamp DESC LIMIT ?

-- bot_positions PRIMARY KEY changes:
PRIMARY KEY (botName, chainName, baseToken, quoteToken)
```

### E. Schema migration function

Add a `migrate()` function that runs on startup:

```javascript
function migrate() {
  const db = getDb();

  // Check if botName column exists
  const columns = db.pragma('table_info(order_book_snapshots)');
  const hasBotName = columns.some(c => c.name === 'botName');

  if (!hasBotName) {
    console.info('STORE', 'Running migration: adding botName column to all tables');

    db.exec(`
      ALTER TABLE order_book_snapshots ADD COLUMN botName TEXT NOT NULL DEFAULT 'steem-dex-bot';
      ALTER TABLE trades_history ADD COLUMN botName TEXT NOT NULL DEFAULT 'steem-dex-bot';
      ALTER TABLE analysis_log ADD COLUMN botName TEXT NOT NULL DEFAULT 'steem-dex-bot';
    `);

    // bot_positions needs to be recreated (can't change PK with ALTER)
    db.exec(`
      CREATE TABLE bot_positions_new (
        botName TEXT NOT NULL,
        chainName TEXT NOT NULL,
        baseToken TEXT NOT NULL,
        quoteToken TEXT NOT NULL,
        baseBalance REAL NOT NULL DEFAULT 0,
        quoteBalance REAL NOT NULL DEFAULT 0,
        lastUpdated TEXT NOT NULL,
        averageEntryPrice REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (botName, chainName, baseToken, quoteToken)
      );
      INSERT INTO bot_positions_new (botName, chainName, baseToken, quoteToken, baseBalance, quoteBalance, lastUpdated, averageEntryPrice)
        SELECT 'steem-dex-bot', chainName, baseToken, quoteToken, baseBalance, quoteBalance, lastUpdated, averageEntryPrice
        FROM bot_positions;
      DROP TABLE bot_positions;
      ALTER TABLE bot_positions_new RENAME TO bot_positions;
    `);

    // Recreate indexes to include botName
    db.exec(`
      DROP INDEX IF EXISTS idx_obs_chain_pair_ts;
      CREATE INDEX idx_obs_bot_chain_pair_ts ON order_book_snapshots (botName, chainName, baseToken, quoteToken, timestamp);

      DROP INDEX IF EXISTS idx_th_chain_pair_ts;
      CREATE INDEX idx_th_bot_chain_pair_ts ON trades_history (botName, chainName, baseToken, quoteToken, timestamp);

      DROP INDEX IF EXISTS idx_al_chain_event_ts;
      CREATE INDEX idx_al_bot_chain_event_ts ON analysis_log (botName, chainName, eventType, timestamp);
    `);

    console.info('STORE', '✅ Migration complete');
  }
}
```

Call `migrate()` inside `ensureTables()`, after creating tables.

### F. Update all callers

**`apps/steem-dex-bot/index.js`** — all storage calls gain `BOT_NAME` as first argument:
```javascript
// Before:
saveOrderBookSnapshot(CHAIN, BASE, QUOTE, book);
// After:
saveOrderBookSnapshot(BOT_NAME, CHAIN, BASE, QUOTE, book);
```

**Dashboard/API routes** — pass bot name from request or registry.

**Scripts** — `scripts/analysis/*.js` — update to accept `--bot` argument.

### G. Update prepared statements

The file uses lazy-initialized prepared statements. All need botName in their SQL:

```javascript
// Before:
if (!_stmts.insertSnapshot) {
  _stmts.insertSnapshot = db.prepare(`INSERT INTO order_book_snapshots (timestamp, chainName, ...) VALUES (?, ?, ...)`);
}

// After:
if (!_stmts.insertSnapshot) {
  _stmts.insertSnapshot = db.prepare(`INSERT INTO order_book_snapshots (botName, timestamp, chainName, ...) VALUES (?, ?, ?, ...)`);
}
```

---

## Cross-bot query support

The dashboard overview needs "all trades today across all bots" and similar. Add aggregate functions:

```javascript
export function countAllTradesToday() {
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(`SELECT COUNT(*) as count FROM trades_history WHERE timestamp >= ?`).get(today + 'T00:00:00Z').count;
}

export function getAllBotPositions() {
  return db.prepare(`SELECT * FROM bot_positions`).all();
}
```

Keep these simple — they don't need botName because they intentionally span all bots.

---

## Files to create
- None (renaming existing file)

## Files to rename
- `services/storage/steemDexStore.js` → `services/storage/botStore.js`
- `testing/services/storage/steemDexStore.test.js` → `testing/services/storage/botStore.test.js`

## Files to modify
- `services/storage/botStore.js` (all schemas, queries, function signatures, migration)
- `apps/steem-dex-bot/index.js` (update import path, add BOT_NAME to all storage calls)
- `api/routes/dashboard/home-data.get.js` (update import path)
- `api/routes/dashboard/steem-prices.get.js` (update import path)
- `api/routes/dashboard/logs.get.js` (update import path + add botName param)
- `scripts/analysis/*.js` (update import paths + add --bot argument)
- `testing/services/storage/botStore.test.js` (update all test calls with botName)

---

## Verification checklist
- [ ] Migration runs cleanly on existing database (existing data gets `botName = 'steem-dex-bot'`)
- [ ] All prepared statements include botName
- [ ] `npm test` — all unit tests pass (including renamed test file)
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] `node --check` passes for all modified files
- [ ] Storage test covers: insert with botName, query filtering by botName, two bots same pair don't collide
- [ ] Cross-bot aggregate queries work
