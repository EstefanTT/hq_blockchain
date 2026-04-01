# config/

Application configuration — split into static (checked-in) and dynamic (runtime-modifiable).

| Path | Description |
|---|---|
| `static/` | Immutable at runtime — loaded at boot. Change requires restart. |
| `dynamic/` | Modifiable at runtime — updated via API or scripts. Persisted to disk. |
