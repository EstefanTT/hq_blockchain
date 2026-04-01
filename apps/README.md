# apps/

Runnable compositions — each wires strategies, core, and services to achieve a specific business goal.

Apps run as **modules in the same Node process** (loaded by `index.js`). Can be extracted to separate processes later if isolation is needed.

Each app has:
- `index.js` — exports `init()` and `shutdown()`, wires dependencies
- `config.json` — app-specific configuration
- `README.md` — what it does, how to enable it

| App | Purpose |
|---|---|
| **portfolio-monitor/** | Track balances and positions across all wallets/chains |
| **spread-bot/** | Run spread-capture strategy on configured pools |
| **dex-execution-engine/** | Accept trade intents, route and execute on DEXes |
| **onchain-analyzer/** | Monitor on-chain data, wallet movements, token flows |
| **research-sandbox/** | Scratch space for testing ideas, one-off scripts |
