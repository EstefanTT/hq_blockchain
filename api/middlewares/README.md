# api/middlewares/

Express middleware — applied globally by `api/index.js`.

## File Inventory

| File | Purpose | Key Exports |
|---|---|---|
| `auth.js` | Validates `X-API-Token` header against `process.env.API_TOKEN`. Skips auth for health and dashboard routes. | `default` middleware function |
| `errorHandler.js` | Global error catch — logs error and returns structured JSON `{ error, message }` with appropriate status code. | `default` error middleware function |

## Conventions

- Middleware files export `default` function with Express middleware signature
- Auth middleware is applied globally but can be skipped per-route by exporting `[middleware, handler]` from the route file
- Add new middleware here, then wire it in `api/index.js`
