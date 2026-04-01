# connectors/chains/evm/

EVM-compatible blockchain adapter (Ethereum, Arbitrum, Polygon, BSC, etc.).

| File | Role |
|---|---|
| `client.js` | RPC client — connect, read blocks, call contracts, send raw transactions |
| `wallet.js` | Wallet management — load from private key, sign transactions |
| `gas.js` | Gas estimation and fee strategies (legacy, EIP-1559) |
| `contracts/` | Contract ABI definitions and typed interaction helpers |
| `utils/` | EVM-specific utilities (address validation, unit conversion, etc.) |

Uses a single library (ethers.js or viem — TBD) for all EVM chains. Chain-specific config (RPC URLs, chain IDs) comes from `config/static/networks.json`.
