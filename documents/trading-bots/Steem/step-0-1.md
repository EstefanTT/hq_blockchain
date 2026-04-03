# Step 0 + Step 1 – Detailed Functional Instructions (Depth ***)

**Only implement Step 0 and Step 1.**  
Do not touch any other part of the project yet.

### Step 0 – STEEM DEX Bot App Skeleton (Multi-Chain Ready)
Create folder `apps/steem-dex-bot/` exactly like `apps/spread-bot/`.

The app must:
- Have `config.json` with: `name`, `enabled`, `chainName` (default "steem"), `baseToken`, `quoteToken`, `maxOrderSizeBase`, `maxOrderSizeQuote`, `tinyPyramidBaseSizeQuote`.
- Have `index.js` exporting `init()` and `shutdown()` that log a clear emoji-rich message using the existing logger.
- Be registerable/toggleable via `config/dynamic/strategies/` or main `index.js`.
- After `npm run dev` we must see the “ready” log line.

### Step 1 – External Price Feeds, Candle Storage, Divergence Alerts + First Dashboard Page

**Overall goal**
Create a credit-efficient price engine that is already multi-chain aware (even though we only use STEEM/SBD for now) and deliver the first dashboard page.

**CoinGecko candles (generic)**
- Every 30 minutes: one batch call to CoinGecko for 5-min OHLC candles of baseToken + quoteToken.
- Merge new candles, keep exactly:
  - Last 1 hour of 5-min candles
  - Last 24 hours of 1-hour candles
  - Last 30 days of daily candles
- Keep 4-hour rolling buffer.
- Auto-delete old candles.

**CoinMarketCap latest prices**
- Every 6 minutes: one batch call for latest prices of baseToken + quoteToken.

**Volatility detection**
- Violent = 5-min high-low change > 1.2% in any of the last 4 candles for baseToken or quoteToken.

**Rate-limit & cycling**
- Normal: CG every 30 min, CMC every 6 min.
- Violent: temporarily CG every 2 min, CMC every 30 sec.
- Auto-return to normal after 15 min calm.
- Allow one-off urgent refresh calls from future strategies.

**Divergence Alert System**
- Compare CG vs CMC after every update.
- Gap > 0.8% → Telegram alert with exact JSON:
  ```json
  {
    "alert": "PRICE_DIVERGENCE",
    "coin": "STEEM" or "SBD",
    "differencePercent": 1.24,
    "cgPrice": 0.1199,
    "cmcPrice": 0.1184,
    "dexMidPrice": null,
    "conclusion": "...",
    "pastTrend": "...",
    "timestamp": "..."
  }