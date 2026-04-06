# api/routes/

File-based route definitions. Directory structure maps directly to URL paths.

## Naming Convention

`domain/action.method.js` → `METHOD /api/domain/action`

| Pattern | Example File | Generated Route |
|---|---|---|
| Basic | `health/ping.get.js` | `GET /api/health/ping` |
| Nested | `dashboard/home-data.get.js` | `GET /api/dashboard/home-data` |
| Dynamic param | `dashboard/bots/[name].get.js` | `GET /api/dashboard/bots/:name` |
| Deep nested | `dashboard/bots/data/[name].get.js` | `GET /api/dashboard/bots/data/:name` |

Supported methods: `.get`, `.post`, `.put`, `.delete`, `.patch`

## File Inventory

| Folder | Purpose | Endpoints |
|---|---|---|
| `health/` | Health checks | `ping.get.js` |
| `dashboard/` | Dashboard pages and data APIs | `index.get.js`, `home-data.get.js`, `logs.get.js`, `logs-data.get.js`, `steem-dex-bot.get.js`, `steem-prices.get.js`, `bots/[name].get.js`, `bots/data/[name].get.js` |
| `execution/` | Trade control actions | `set-dry-run.post.js`, `toggle-bot.post.js`, `toggle-data.post.js`, `toggle-strategy.post.js`, `emergency-stop.post.js`, `pause.post.js`, `switch-mode.post.js`, `run-analysis.post.js`, `update-params.post.js` |
| `admin/` | System administration | — |
| `market/` | Price lookups, quotes | — |
| `portfolio/` | Balance queries, positions | — |
| `strategies/` | Strategy management | — |

## Conventions

- Each route file exports `default` — either a handler function or `[middleware, handler]` array
- Route files are auto-discovered by `api/utils/loadRoutes.js` on boot — no manual registration needed
- `dashboard/shared/sidebar.js` is a shared helper (not a route) — exports `renderSidebar(activePage)`
- Add a new endpoint → create `domain/action.method.js` in the appropriate folder
