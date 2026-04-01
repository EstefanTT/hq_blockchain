# services/globalConfig/

Auto-executed on import. Responsible for:
- Loading `.env` via dotenv
- Determining environment (production vs development)
- Setting `global.path` with all project paths
- Loading static config files into globals (`global.general`, `global.networks`, etc.)

Must be the **first import** in `index.js` — everything else depends on it.
