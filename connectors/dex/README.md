# connectors/dex/

Decentralized exchange adapters — quoting, swapping, liquidity operations.

Each DEX protocol gets its own subdirectory implementing the shared swap interface.

**Registry**: `registry.js` maps DEX names to adapters. Usage:
```js
const uni = getDex('uniswap-v3', 'ethereum');
const quote = await uni.getQuote({ tokenIn, tokenOut, amountIn });
```

**Streaming**: adapters can expose WebSocket subscriptions for real-time pool/price updates.
