# services/

Infrastructure layer — reusable plumbing used by all other layers.

| Service | Role |
|---|---|
| **globalConfig/** | Loads `.env`, sets `global.path`, `global.isProduction`, static configs |
| **logger/** | Overrides `console.*` with color-coded, context-tagged, file-persisted logging |
| **cache/** | In-memory runtime state (positions, prices, active strategies) |
| **messaging/** | Outbound notifications (Telegram, Discord, webhooks) |
| **storage/** | Persistence — SQLite for structured data, file I/O for JSONL/snapshots |
| **validation/** | Zod schemas and shared validators |

Services are singletons, auto-initialized on import. They never import from core/, connectors/, strategies/, or apps/.
