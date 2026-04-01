# connectors/apis/shared/

Shared API utilities — base HTTP client with retry logic and rate limiting.

| File | Role |
|---|---|
| `httpClient.js` | Axios wrapper with timeout, retries, error normalization |
| `rateLimiter.js` | Per-provider rate limiting (token bucket or sliding window) |
