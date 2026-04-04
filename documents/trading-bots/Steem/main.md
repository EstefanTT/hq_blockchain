# STEEM/SBD DEX Trading Bot – Full Project Instructions (Multi-Chain Ready)

## Project Vision
We are adding a **smart adaptive trading bot** for STEEM/SBD (and future Hive/HBD, Blurt, etc.) on Steem-like DEXes.

The bot will run as a new app: `apps/steem-dex-bot/`.

**Multi-Chain Design (mandatory from day 1)**
- The code must be written so we can run multiple independent instances on different chains (Steem, Hive, Blurt, …) using the same codebase.
- Use generic naming: `baseToken` (STEEM / HIVE / BLURT), `quoteToken` (SBD / HBD / …), `chainName`.

**UI / Control Panel (Option A – Built-in Express dashboard)**
- Lightweight dashboard served from `api/dashboard/` (static HTML + Tailwind + vanilla JS).
- Protected by existing `auth.js` middleware.

### Candle & Price Storage Strategy
- CoinGecko: every 30 min → 5-min OHLC candles for baseToken + quoteToken (batch)
- CoinMarketCap: every 6 min → latest prices
- Store in services/cache/:
  - Last 1 hour of 5-min candles
  - Last 24 hours of 1-hour candles
  - Last 30 days of daily candles
- 4-hour rolling buffer for alerts

### Rate-Limit & Credit Management
- Stay well under free-tier limits.
- Normal mode + violent-market burst mode.

### Core Features (implemented step by step)
- External price feeds + divergence alerts
- Built-in dashboard (from Step 1)
- Real-time order book via generic Steem-like connector
- Permanent tiny inverted-pyramid micro layer
- Sub-strategies one by one
- Main brain + switching logic
- Risk & rebalance layer + bot-exploitation
- Rich double logging + SQLite persistence
- Full testing suite

## Full Development Steps
(One step at a time — each fully tested)

**Step 0** – App skeleton + basic registration  
**Step 1** – External price feeds, candles, divergence alerts + first dashboard page  
**Step 2** – Generic Steem-like blockchain connector + polling  
**Step 3** – SQLite storage  
**Step 4** – Basic order operations (generic)  
**Step 5** – Double logging system  
**Step 6** – Permanent tiny inverted-pyramid micro layer  
**Step 7** – First sub-strategy: Market-Making Mode  
**Step 8** – Main brain + switching logic  
**Step 9** – Second sub-strategy: Aggressive Sniping Mode  
**Step 10** – Third sub-strategy: Grid / Range Mode  
**Step 11** – Fourth sub-strategy: Mean-Reversion Mode  
**Step 12** – Fifth sub-strategy: Defensive / Pause Mode  
**Step 13** – Risk & rebalance layer + bot-exploitation  
**Step 14** – Full integration + expanded dashboard  
**Step 15** – Analysis scripts + backtesting tools

## Testing Requirement
- Use existing `testing/` folder
- Every major function/route must be testable

**Reminder**: Always follow the architecture in `README.md`. Focus on **what** the code must do.