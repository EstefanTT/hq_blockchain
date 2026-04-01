# services/cache/

In-memory runtime state. Fast reads, no disk I/O for hot data.

Holds things like: active positions, latest prices, strategy states, wallet balances.

**Pattern** (from hq-home):
- `actions/` — mutations that update cache (and optionally sync to disk/DB)
- `getters/` — read-only queries against the runtime cache
- `index.js` — aggregates and re-exports all actions and getters

Cache is the single source of truth during runtime. Persistent state lives in `services/storage/`.
