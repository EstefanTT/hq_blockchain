# api/

HTTP interface — Express.js with file-based routing (ported from hq-home).

| Path | Role |
|---|---|
| `index.js` | Express app setup, middleware, route auto-loading |
| `middlewares/` | Auth, error handling, rate limiting |
| `routes/` | File-based route definitions (Nuxt 3 style) |
| `utils/` | API utilities (loadRoutes, response helpers) |

**Route convention**: `routes/domain/action.method.js` → `METHOD /api/domain/action`
Example: `routes/portfolio/balances.get.js` → `GET /api/portfolio/balances`
