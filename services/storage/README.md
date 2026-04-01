# services/storage/

Persistence layer — abstracts where and how data is stored.

| File | Role |
|---|---|
| `index.js` | Aggregator — re-exports all storage functions |
| `sqlite.js` | SQLite database (better-sqlite3) — structured data: executions, orders, PnL |
| `files.js` | File I/O helpers — JSONL append, JSON read/write |
| `snapshots.js` | Point-in-time snapshots of portfolio, balances, positions |
| `serializers/` | Data format converters (JSON, CSV, etc.) |

SQLite is the default for anything that needs querying. File storage (JSONL) is for append-heavy logs and raw data dumps.
