# hq_blockchain

Modular blockchain operations center — trading, DEX execution, on-chain analytics, NFTs, and more.

This document is the **primary reference** for understanding where every piece of code lives and where new code should go. Read it before developing.

---

## Architecture overview

```
apps → strategies → core → connectors
                      ↘        ↗
                     services (used by all)
```

**Dependency rule — the one rule that keeps everything clean:**
- A layer can only import from layers to its **right** or from **services**.
- A layer **never** imports from layers to its **left**.
- Concretely: `connectors/` never imports from `core/`. `core/` never imports from `strategies/`. `strategies/` never imports from `apps/`.
- `services/` is used by everyone but imports from **no other layer**.

---

## Layers — what they are and what goes where

### `services/` — Infrastructure (used by all layers)

Reusable plumbing. No business logic. Initialized as singletons on import.

| Module | What it does | When to add code here |
|---|---|---|
| `globalConfig/` | Loads `.env`, sets `global.path`, `global.isProduction`, static configs. Auto-executed on import — must be first import in `index.js`. | Adding a new global config value, a new static config file, or a new path constant. |
| `logger/` | Overrides `console.log/info/warn/error` with color-coded, context-tagged, file-persisted output. | Adding a new context tag (e.g. a new emoji for a new subsystem). |
| `cache/` | In-memory runtime state (prices, balances, positions, strategy states). Pattern: `actions/` (mutations) and `getters/` (queries). | Adding a new piece of runtime state that multiple modules need fast access to. |
| `messaging/` | Outbound notifications (Telegram, Discord, webhooks). | Adding a new notification channel or a new message template. |
| `storage/` | Persistence. `sqlite.js` for structured data (executions, orders, PnL). `files.js` for JSONL/JSON I/O. `snapshots.js` for point-in-time portfolio state. | Adding a new DB table, a new file storage pattern, or a new serializer. |
| `validation/` | Zod schemas and a `validate()` helper. | Adding a new schema (put it in `schemas/`) or a new validation helper. |

### `connectors/` — Adapters to external systems

Each connector wraps an external protocol/API behind a **consistent internal interface**. Core and strategies never talk to the outside world directly — they go through connectors.

**Registry pattern**: each subdirectory has a `registry.js`. Instead of importing a specific adapter directly, code calls `getChain('ethereum')`, `getDex('uniswap-v3', 'ethereum')`, or `getCex('binance')`. This means adding a new adapter requires zero changes in core or strategies.

| Module | External system | Files per adapter |
|---|---|---|
| `chains/` | Blockchain RPCs (EVM, Solana, ...) | `client.js` (connect, read, send), `wallet.js` (sign), `gas.js` (fees), `contracts/` (ABIs), `utils/` |
| `dex/` | Decentralized exchanges (Uniswap, Jupiter, ...) | `index.js` implementing: `getQuote()`, `buildSwap()`, `getPools()`, `subscribe()` |
| `cex/` | Centralized exchanges (Binance, ...) | `index.js` implementing: `getBalance()`, `placeOrder()`, `cancelOrder()`, `getTicker()`, `subscribe()` |
| `apis/` | Third-party data (CoinGecko, Etherscan, DexScreener, ...) | `index.js` per provider. All use `shared/httpClient.js` (Axios + retry) and `shared/rateLimiter.js`. |

Each connector category has a `shared/` with:
- `baseAdapter.js` — documents the interface methods all adapters in that category should implement.
- Common utilities for that category.

**When to add code here:**
- Adding support for a new blockchain → `connectors/chains/newchain/`
- Adding a new DEX → `connectors/dex/newdex/`
- Adding a new CEX → `connectors/cex/newcex/`
- Adding a new data API → `connectors/apis/newapi/`
- Improving how all adapters in a category work → `shared/` in that category
- **Streaming/WebSocket**: adapters expose `subscribe(event, callback)` for real-time data. The streaming logic lives inside the connector, not in a separate layer.

### `core/` — Domain logic (chain-agnostic business rules)

Core decides **what** to do. It calls connectors to do it on a specific chain/exchange. Core never knows which chain or DEX it's talking to — it uses the registry pattern.

| Module | What it does | When to add code here |
|---|---|---|
| `execution/` | Trade pipeline: `buildOrder` → `routeTrade` → `simulateTrade` → `executeTrade`. Plus `slippage.js` and `fees.js`. | Adding a new step in the trade pipeline, improving routing logic, adding a new fee model. |
| `market/` | Price aggregation, quotes from multiple venues, volatility calculations. | Adding a new price source, a new market indicator, a new quoting strategy. |
| `portfolio/` | Balance tracking, position management, PnL (realized + unrealized). | Adding a new portfolio metric, a new position type, improving PnL calculations. |
| `risk/` | Guards that run before every trade: position limits, exposure limits, liquidity checks, **kill switch**. | Adding a new risk check, adjusting limit logic, adding anomaly detection. |
| `nft/` | NFT domain logic (pricing, discovery, execution). Placeholder for now. | Any NFT business logic. |

**Key principle**: if the logic is about *deciding* whether/what/how to trade — it goes in `core/`. If it's about *talking to a specific protocol* — it goes in `connectors/`.

### `strategies/` — Trading strategies

First-class, self-contained modules. Each strategy is a folder with a consistent interface.

**Strategy interface** (every strategy exports these):
- `init(config)` — setup, subscribe to streams, load state
- `tick(config)` — one decision cycle (check market, maybe trade)
- `shutdown(config)` — cleanup, cancel orders, save state
- `describe()` — returns `{ name, description, version }`

**Each strategy folder contains:**
- `index.js` — exports the 4 functions above
- `config.schema.js` — Zod schema for that strategy's configuration
- `README.md` — what it does, parameters, risks

| Module | Role |
|---|---|
| `engine/runner.js` | Runs a strategy instance: calls `tick()` on interval, wraps with risk checks and error handling. |
| `engine/registry.js` | Maps strategy names to modules. `getStrategy('spread-capture')` → module. |
| `engine/backtest.js` | Replays historical data through a strategy. |
| `shared/` | Utilities used across strategies (indicators, signals, position sizing). |

**When to add code here:**
- New trading strategy → `strategies/new-strategy/` with `index.js`, `config.schema.js`, `README.md`
- New shared indicator → `strategies/shared/indicators.js`
- Improving the strategy lifecycle → `strategies/engine/`

### `apps/` — Runnable compositions

Each app wires strategies + core + connectors to achieve a specific business goal. Apps run as **modules in the same Node.js process** (loaded by `index.js`). Can be extracted to separate processes later if isolation is needed.

**Each app folder contains:**
- `index.js` — exports `init()` and `shutdown()`
- `config.json` — app-specific configuration
- `README.md` — purpose and how to enable

| App | Purpose |
|---|---|
| `portfolio-monitor/` | Track balances/positions across wallets and chains |
| `spread-bot/` | Run spread-capture strategy on configured pools |
| `dex-execution-engine/` | Accept trade intents, route and execute on DEXes |
| `onchain-analyzer/` | Monitor on-chain data, wallet movements, token flows |
| `research-sandbox/` | Scratch space for experiments (run directly, not via main process) |

**When to add code here:**
- New use case that composes existing strategies/core → `apps/new-app/`
- Enabling an app → uncomment its import in `index.js`

### `api/` — HTTP interface

Express.js with **file-based routing** (Nuxt 3 style, ported from hq-home).

**Route convention:** `routes/domain/action.method.js` → `METHOD /api/domain/action`
- Example: `routes/portfolio/balances.get.js` → `GET /api/portfolio/balances`
- Example: `routes/admin/kill-switch.post.js` → `POST /api/admin/kill-switch`
- Supported methods: `.get`, `.post`, `.put`, `.delete`, `.patch`
- Without method suffix → registered as middleware via `app.use()`

| Directory | Endpoints for |
|---|---|
| `routes/health/` | Health checks, ping |
| `routes/portfolio/` | Balances, positions, PnL |
| `routes/market/` | Prices, quotes |
| `routes/execution/` | Submit trades, check status |
| `routes/strategies/` | Start/stop strategies, list, status |
| `routes/admin/` | Kill switch, config, system status |

**Middlewares:** `auth.js` (X-API-Token header), `errorHandler.js` (global catch).

**When to add code here:**
- New endpoint → create `routes/domain/action.method.js`, it's auto-discovered.
- New middleware → `middlewares/`

### `scheduler/` — Cron jobs

`cronManager.js` auto-discovers all `.js` files in `crons/`, each exporting a `default async function`. Schedules are assigned in `cronManager.js` using UTC timezone presets.

**When to add code here:**
- New scheduled task → create `crons/taskName.js` with `export default async function`, then schedule it in `cronManager.js`.

---

## Other directories

| Path | Purpose |
|---|---|
| `config/static/` | Immutable config loaded at boot: `general.json`, `logger.json`, `networks.json`. Change requires restart. |
| `config/dynamic/` | Runtime-modifiable config: `wallets/`, `strategies/`, `chains/`. Updated via API or manually. |
| `data/` | Persistent data: `executions/`, `market/`, `snapshots/`, `research/`. SQLite DB (`hq_blockchain.db`) also lives here. |
| `logs/` | Log files. `app.log` written by the logger (info/warn/error only). |
| `testing/` | Tests. Mirrors source structure: `connectors/`, `core/`, `strategies/`, `api/`, `fixtures/`, `utils/`. |
| `utils/` | General-purpose helpers (no business logic): `sleep.js`, `math.js`, `formatting.js`, `time.js`, `ids.js`. |

---

## "Where does this go?" — quick decision guide

| I need to... | It goes in... |
|---|---|
| Talk to a new blockchain | `connectors/chains/newchain/` + register in `registry.js` |
| Add a new DEX | `connectors/dex/newdex/` + register in `registry.js` |
| Add a new CEX | `connectors/cex/newcex/` + register in `registry.js` |
| Fetch data from a new API | `connectors/apis/newapi/` |
| Add business logic for trading decisions | `core/execution/` or `core/market/` |
| Add a new risk check | `core/risk/` |
| Track a new portfolio metric | `core/portfolio/` |
| Create a new trading strategy | `strategies/new-strategy/` (index.js + config.schema.js + README.md) |
| Build a new bot / app | `apps/new-app/` (index.js + config.json + README.md) |
| Expose a new HTTP endpoint | `api/routes/domain/action.method.js` |
| Add a scheduled task | `scheduler/crons/task.js` + wire in `cronManager.js` |
| Add a new notification channel | `services/messaging/` |
| Store structured data | `services/storage/sqlite.js` (new table) |
| Store append-only logs/data | `services/storage/files.js` (JSONL) |
| Add a new config value | `config/static/` (boot-time) or `config/dynamic/` (runtime) |
| Add a shared utility | `utils/` (if no business logic) or `strategies/shared/` (if strategy-specific) |
| Cache runtime state | `services/cache/` (new action + getter) |
| Add a new log context tag | `services/logger/index.js` contextMap |
| Add a Zod schema | `services/validation/schemas/` |

---

## Bootstrap flow

`index.js` runs in this order:
1. `import './services/globalConfig/init.js'` — loads `.env`, sets `global.path`, `global.isProduction`
2. `import './services/logger/index.js'` — overrides `console.*` with enhanced logging
3. Delayed imports (so `global.*` is available):
   - API server (Express) → listen on PORT
   - `startCrons()` → production only
   - Apps → `init()` each enabled app

---

## Conventions

- **ES Modules** everywhere (`import`/`export`, `"type": "module"` in package.json)
- **Logger**: use `console.info('CONTEXT', 'message')` or `console.info('CONTEXT', 'SUB-CTX', 'message')` — the logger adds timestamp, color, emoji, and writes to file
- **Singletons**: services auto-initialize on import. No `new`, no factory functions
- **Registry pattern**: connectors expose `register*()` / `get*()` / `list*()` in `registry.js`
- **Strategy contract**: every strategy exports `init()`, `tick()`, `shutdown()`, `describe()` + has `config.schema.js`
- **App contract**: every app exports `init()` and `shutdown()` + has `config.json`
- **File routing**: `routes/domain/action.method.js` → auto-registered HTTP endpoint
- **Cron pattern**: `crons/taskName.js` default export async function, scheduled in `cronManager.js`
- **Config**: secrets in `.env`, static config in `config/static/*.json`, runtime config in `config/dynamic/`
- **Persistence**: SQLite for queries, JSONL for append-only, JSON for config files

---

## Quick start

```bash
cp .env.example .env     # configure environment variables
npm install
npm run dev              # development with --watch
npm start                # production
```

## Human notes to be integrated nicely here above : 
