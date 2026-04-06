# api/

HTTP interface — Express 5 with file-based routing.

## File Inventory

| File / Folder | Purpose | Key Exports |
|---|---|---|
| `index.js` | Express app setup — mounts middleware, calls `loadRoutes()`, starts listening | `default` (Express app instance) |
| `middlewares/` | Global middleware: auth and error handling | `auth.js`, `errorHandler.js` |
| `routes/` | File-based route definitions — directory structure maps to URL paths | One handler file per endpoint |
| `utils/loadRoutes.js` | Auto-discovers route files, registers them on the Express app | `loadRoutes(app, dir, baseRoute)` |

## Interface Contract

### File-based routing

Route files follow the convention `routes/domain/action.method.js` → `METHOD /api/domain/action`:

```
routes/health/ping.get.js        → GET  /api/health/ping
routes/execution/set-dry-run.post.js → POST /api/execution/set-dry-run
routes/dashboard/home-data.get.js → GET  /api/dashboard/home-data
```

- Supported methods: `.get`, `.post`, `.put`, `.delete`, `.patch`
- Dynamic params: `[name].get.js` → `:name` param
- Files without method suffix → registered as middleware via `app.use()`

Each route file exports `default` — either a handler function or `[middleware, handler]` array.

### Middleware chain

1. `auth.js` — validates `X-API-Token` header (skipped for health + dashboard routes)
2. Route handler
3. `errorHandler.js` — global error catch, returns structured JSON errors

### Route domains

| Domain | Endpoints |
|---|---|
| `health/` | Health checks (`ping.get.js`) |
| `dashboard/` | Dashboard pages and data APIs (`home-data.get.js`, `bots/[name].get.js`, `steem-prices.get.js`, etc.) |
| `execution/` | Trade actions (`set-dry-run`, `toggle-bot`, `toggle-data`, `emergency-stop`, `switch-mode`, etc.) |
| `admin/` | System administration |
| `market/` | Price lookups, quotes |
| `portfolio/` | Balance queries, position overview |
| `strategies/` | Strategy management |

## Dependencies

- `services/cache` — for reading runtime state in dashboard/data routes
- `services/botRegistry` — for listing bots and looking up bot modules
- `services/storage` — for querying trade history, positions
- `core/risk` — for kill switch status
- `strategies/engine` — for brain/strategy status

## Conventions

- Add a new endpoint → create `routes/domain/action.method.js` — it's auto-discovered by `loadRoutes()`
- Route handlers receive `(req, res)` and should return JSON via `res.json()`
- Don't hardcode bot names in routes — get from `req.params` or `botRegistry`
