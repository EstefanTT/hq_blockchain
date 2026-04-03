# connectors/chains/steem-like/

Generic connector for Steem-like blockchains (Steem, Hive, Blurt, and future clones).

## Architecture

| File | Role |
|---|---|
| `client.js` | HTTP JSON-RPC client with node rotation + automatic failover |
| `normalizer.js` | Transforms raw chain responses into a normalized format |
| `market.js` | Polling loop for order book + trades, exposes `subscribe(event, cb)` |
| `registry.js` | Default configurations for known Steem-like chains |
| `index.js` | `createSteemLikeAdapter(config)` factory, registers in main chain registry |

## Usage

```js
import { createSteemLikeAdapter } from './connectors/chains/steem-like/index.js';

const adapter = createSteemLikeAdapter({
    chainName: 'steem',
    nodes: ['https://api.steemit.com'],
    baseToken: { symbol: 'STEEM' },
    quoteToken: { symbol: 'SBD' },
});

await adapter.start();

// Now available via registry:
// const steem = getChain('steem');
// const book = steem.getCurrentOrderBook();
```

## Normalized formats

**Order book:**
```json
{ "bids": [{"price": 0.13, "amount": 100}], "asks": [...], "midPrice": 0.131, "spread": 0.002, "spreadPercent": 1.52, "timestamp": "..." }
```

**Trade:**
```json
{ "id": "...", "timestamp": "...", "price": 0.13, "amountBase": 100, "amountQuote": 13, "type": "buy" }
```

## Adding a new chain

1. Add defaults to `registry.js`
2. Configure `nodes` + tokens in the app's `config.json`
3. Call `createSteemLikeAdapter(config)` — done
