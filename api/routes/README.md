# api/routes/

File-based route definitions. Directory structure maps to URL paths.

**Convention**: `domain/action.method.js` → `METHOD /api/domain/action`

| Route domain | Purpose |
|---|---|
| `health/` | Health checks, ping |
| `portfolio/` | Balance queries, position overview |
| `market/` | Price lookups, quotes |
| `execution/` | Submit trades, check execution status |
| `strategies/` | Start/stop strategies, view status |
| `admin/` | Kill switch, config management |
