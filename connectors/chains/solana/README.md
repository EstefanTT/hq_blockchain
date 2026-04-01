# connectors/chains/solana/

Solana blockchain adapter.

| File | Role |
|---|---|
| `client.js` | RPC client — connect, read accounts, send transactions |
| `wallet.js` | Keypair management, transaction signing |

Uses `@solana/web3.js`. Chain config comes from `config/static/networks.json`.
