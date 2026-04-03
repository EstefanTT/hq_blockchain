# Step 3 – SQLite Storage for Order Book Snapshots, Trades, Positions, Analysis Log (Depth ***)

**Only implement Step 3.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 3
Extend the existing `services/storage/sqlite.js` to add persistent storage for the STEEM DEX Bot (and future multi-chain instances).

We need four clean, well-indexed tables so we can:
- Save periodic snapshots of the live order book (for later analysis and backtesting)
- Record every filled trade (historical trade log)
- Track the bot’s current positions/inventory per chain and pair
- Store rich analysis events (the “analysis log” part of our double-logging system)

All tables must be **multi-chain ready** (use `chainName`, `baseToken`, `quoteToken` everywhere).

### Required Tables & Fields (exact specification)

1. **order_book_snapshots**
   - `id` (auto-increment)
   - `timestamp` (ISO string)
   - `chainName` (e.g. "steem", "hive")
   - `baseToken`
   - `quoteToken`
   - `bids` (JSON string or TEXT – full normalized bids array)
   - `asks` (JSON string or TEXT – full normalized asks array)
   - `midPrice`
   - `spreadPercent`

2. **trades_history**
   - `id` (auto-increment)
   - `timestamp`
   - `chainName`
   - `baseToken`
   - `quoteToken`
   - `tradeId` (from chain)
   - `price`
   - `amountBase`
   - `amountQuote`
   - `type` (BUY or SELL)
   - `txId` (optional – blockchain transaction hash if available)

3. **bot_positions**
   - `chainName` (primary key part)
   - `baseToken`
   - `quoteToken`
   - `baseBalance` (current STEEM/HIVE/etc. balance held by bot)
   - `quoteBalance` (current SBD/HBD/etc. balance)
   - `lastUpdated`
   - `averageEntryPrice` (for future PnL calculations)

4. **analysis_log** (rich events for offline review)
   - `id` (auto-increment)
   - `timestamp`
   - `chainName`
   - `eventType` (e.g. "MODE_SWITCH", "DIVERGENCE_ALERT", "ORDER_PLACED", "TRADE_FILLED", "SNAPSHOT_TAKEN")
   - `severity` (INFO, WARN, ERROR)
   - `message`
   - `data` (JSON string – full context object for later analysis scripts)
   - `strategy` (optional – name of active sub-strategy)

### What the Storage Layer Must Provide
- Helper functions (added to `services/storage/sqlite.js` or a new `storage/steemDex.js` wrapper if cleaner):
  - `saveOrderBookSnapshot(normalizedBook)`
  - `addTrade(tradeObject)`
  - `updatePosition(chainName, baseToken, quoteToken, newBalances)`
  - `logAnalysisEvent(eventObject)`
  - `getRecentSnapshots(chainName, pair, limit)`
  - `getTradeHistory(chainName, pair, limit)`
  - `getCurrentPosition(chainName, baseToken, quoteToken)`

- Automatic periodic snapshots of the live order book (every 30 seconds when the bot is active).

- All operations must be **async**, heavily logged (using PRICE / BOT / STORAGE context tags), and safe (transactions where needed).

### Integration Requirements
- The price engine and market connector (from Step 2) must automatically call the snapshot and logging functions.
- The cache must stay as the source of truth; SQLite is only for persistence and later analysis.
- Update the dashboard (from Step 1) to show a small “Storage Status” section (last snapshot time, total trades logged today, current position).

### Testing
- Add tests in the existing `testing/` folder:
  - Table creation / schema
  - Insert + query for each table
  - Snapshot + trade + position + analysis log round-trip
- All tests must pass against the real SQLite file.

### Final Requirements
- Everything must remain **generic and multi-chain ready**.
- Respect the strict architecture rules (connectors → core → strategies → apps).
- Use existing patterns for SQLite, logging, and cache.
- Keep the code clean, readable, and future-proof.

**Important note**  
If you have any important doubts, see a better way to structure the tables, or have an improvement that seems important for long-term analysis/backtesting/multi-chain use, please ask first before coding anything. Do not start implementation until we confirm.