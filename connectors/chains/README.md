# connectors/chains/

Blockchain client adapters — connect, read state, sign and send transactions.

Each chain family (EVM, Solana, etc.) has its own subdirectory implementing a common interface.

**Registry**: `registry.js` maps chain names to their adapter. Usage:
```js
const eth = getChain('ethereum');
const balance = await eth.getBalance(address);
```

**Streaming**: adapters can expose `subscribe(event, callback)` for real-time data (new blocks, pending txs).
