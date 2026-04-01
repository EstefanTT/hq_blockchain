# services/logger/

Overrides native `console.log/info/warn/error` with enhanced output. Ported from hq-home.

**Features:**
- Color-coded terminal output (ANSI)
- Context tags with emojis (`console.info('CHAIN', 'connected')`)
- Timestamps in terminal (`HH:MM`) and file (`YY-MM-DD HH:MM`)
- File logging to `logs/app.log` (info/warn/error only, not log)
- BigInt JSON serialization safety

**Usage:**
```js
console.info('TRADE', 'Bought 0.5 ETH on Uniswap');
console.warn('RISK', 'Position limit approaching');
console.error('CHAIN', 'RPC connection failed');
console.log('DEBUG', 'Quote details:', quoteObj);   // terminal only
```

Auto-executed on import — must be imported early in `index.js`.
