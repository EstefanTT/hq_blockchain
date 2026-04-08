# STEEM DEX Bot — Dashboard Page Explained

This document describes every section visible on the STEEM DEX Bot detail page (`/api/dashboard/bots/steem-dex-bot`).

---

## Top Bar (Header)

The sticky header stays visible as you scroll. It contains:

- **Bot name and icon** — "🤖 STEEM DEX Bot"
- **Last Data Reload** — timestamp of the most recent data fetch (the page auto-refreshes every 10 seconds)
- **Connection dot** — green when the last fetch succeeded, red when it failed
- **API Token field** — paste your API token here; it's saved in your browser's localStorage so you don't have to re-enter it each visit. Every action (toggling, saving parameters, cancelling orders) requires a valid token.
- **Data toggle** — enables/disables *data collection* (price fetching, order book polling, trade monitoring). This does NOT place orders — it only gathers market information. With a badge showing ON/OFF.
- **Dry-Run toggle** — when ON, the bot simulates trading without placing real orders on-chain. Useful for testing strategies. Badge shows DRY or LIVE.
- **Emergency Stop** — immediately halts all trading and cancels pending actions. Requires confirmation. Does not stop data collection — only the trading engine.

---

## Bot Power Section

A prominent card with the master controls for the bot.

- **Bot ON/OFF toggle** — starts or stops the trading engine. When ON the bot actively places and manages orders according to the current strategy. When OFF it does nothing but data collection can still run independently.
- **Data ON/OFF toggle** — duplicate of the header's data toggle, for convenience.
- **Status text** — RUNNING or STOPPED, with the current trading mode shown as a colored badge (e.g., "MARKET-MAKING" in blue, "DEFENSIVE" in red).
- **Mode selector dropdown** — forces the brain to switch to a specific strategy mode. Normally the brain decides automatically, but you can override it here. The dropdown is populated dynamically from the bot's configuration.

---

## KPI Row

Five cards showing key numbers at a glance:

| KPI | What it means |
|-----|---------------|
| **STEEM Balance** | How much STEEM the bot's account currently holds (liquid, available for buy orders). |
| **SBD Balance** | How much SBD (Steem Backed Dollars) the account holds (used for sell-side or as quote currency). |
| **RC** | Resource Credits percentage — Steem's equivalent of "gas". Below ~20% the bot cannot broadcast transactions. The color shifts from green (>50%) to yellow (>20%) to red (<20%). |
| **Open Orders** | Number of limit orders currently sitting on the DEX order book placed by this bot. |
| **Micro Layer** | Quick status of the micro-order layer: ON/OFF, how much value is locked in micro orders, and when the last micro fill happened. |

---

## Prices

Shows the current STEEM price as seen by three independent sources:

- **CG** — CoinGecko API price (USD)
- **CMC** — CoinMarketCap API price (USD)
- **DEX** — Price derived from the on-chain Steem DEX order book itself

The bot's price engine aggregates these to compute a reliable mid-price. If one source diverges significantly from the others (>1.5%), the brain may flag a divergence signal and adjust strategy accordingly.

If both STEEM and SBD are tracked, they appear side by side.

---

## Engine Status

Technical status of the price engine:

- **Running** — whether the price engine loop is active (Yes/No)
- **Mode** — the engine's current aggregation mode
- **CG price / CMC price** — how long ago each external price source was last fetched (e.g., "2m ago"). If a source shows a long time ago, it may be rate-limited or down.

---

## Order Book

A live snapshot of the Steem DEX order book, split into two columns:

- **Bids (Buy)** — the top 8 buy orders, showing price and amount. Green prices.
- **Asks (Sell)** — the top 8 sell orders. Red prices.

Below the book: **Mid** (average of best bid and best ask), **Spread** (percentage gap between best bid and ask — a wider spread means more profit opportunity but less liquidity), and the timestamp of when this book snapshot was taken.

---

## Recent DEX Trades

The last 10 trades that happened on the Steem DEX for this pair, newest first:

- **Time** — when the trade executed
- **Type** — BUY (green) or SELL (red)
- **Price** — execution price
- **Amount** — how much base token (STEEM) changed hands

These are all trades on the pair, not just the bot's trades.

---

## Brain Status

The "brain" is the decision-making layer that chooses which strategy to run based on current market conditions.

- **Active** — whether the brain loop is running
- **Mode** — the current strategy mode (e.g., MARKET-MAKING, AGGRESSIVE-SNIPING, DEFENSIVE)
- **Last switch** — how long ago the brain switched modes
- **Next tick** — countdown to the brain's next evaluation cycle
- **Switch reason** — a human-readable explanation of why the brain chose the current mode (e.g., "Spread narrowed below threshold, switching to market-making")

**Signals row** (appears when data is available):

| Signal | Meaning |
|--------|---------|
| **Imbalance** | Ratio of buy vs sell pressure in the order book. Values far from 1.0× suggest one side dominates. |
| **Velocity** | Rate of recent trades — high velocity means an active market, low means quiet. |
| **Divergence** | Maximum price difference between external sources (CG/CMC) and the DEX. Above ~1.5% is flagged in yellow — it could mean an arbitrage opportunity or a data issue. |
| **RC** | Current Resource Credits percentage. Below 30% turns red — the bot may not be able to broadcast transactions. |

---

## Strategy Control

One card per strategy. Strategies are discovered automatically from the bot's configuration file. Each card shows:

- **Icon and name** — e.g., 📈 Market Making, 🎯 Aggressive Sniping
- **Description** — one-line explanation of what the strategy does
- **ON/OFF badge** — shows whether this strategy is the currently active one (green ON) or inactive (OFF)
- **Enable/Disable toggle** — you can disable a strategy so the brain will never select it, even if conditions would normally trigger it. Useful to prevent a mode you don't trust yet.
- **Parameters** — editable fields for each strategy's tuning knobs. These vary per strategy.

### Strategy Parameters Reference

**Market Making** — places buy and sell limit orders around the mid-price to capture the spread:
- *Half Spread* — how far from mid-price to place orders (as a percentage). Wider = safer but fewer fills.
- *Order Size* — how much STEEM each order is for.
- *Num Levels* — how many price levels to stack orders at.
- *Refresh Interval* — how often (seconds) to cancel and replace stale orders.
- *Min Spread* — won't place orders if the natural spread is below this — not profitable enough.

**Aggressive Sniping** — targets mispriced orders for fast fills:
- *Edge Threshold* — minimum price edge (%) required to trigger a snipe.
- *Max Snipe Size* — maximum STEEM per snipe order.
- *Cooldown* — minimum seconds between snipe attempts.

**Grid Range** — places a grid of orders across a detected price range:
- *Grid Levels* — number of price levels in the grid.
- *Range Width* — total width of the grid (as % of mid-price).
- *Order Size Per Level* — STEEM amount per grid level.

**Mean Reversion** — bets on price returning to the mean after a sharp move:
- *Window* — lookback period (in ticks or minutes) to compute the mean.
- *Deviation Threshold* — how far price must deviate from the mean (%) to trigger.
- *Size* — order size for mean-reversion trades.

**Defensive / Pause** — pauses trading when conditions are unfavorable:
- *Min RC* — if RC drops below this %, enter defensive mode.
- *Min Book Depth* — minimum order book depth (in quote currency) required to trade.
- *Max Spread* — if spread exceeds this %, pause (market too illiquid).

**Bot Exploitation** — detects and exploits predictable bot behavior:
- *Detection Window* — how many order book snapshots to analyze for patterns.
- *Min Confidence* — minimum confidence score to act on a detected pattern.
- *Max Exposure* — maximum total value to risk on exploitation trades.

**Live stats row** — when a strategy is currently active, you'll see additional metrics: total orders placed, value locked, last fill time, and the mid-price the strategy is operating around.

---

## Micro Layer

The micro-order layer places very small orders at tight spreads to gather information and earn tiny profits. It runs alongside the main strategy.

- **Active** — whether the micro layer is currently placing orders
- **Orders** — total micro orders, split into Buy/Sell counts
- **Locked** — total SBD value committed to micro orders
- **Last fill** — when a micro order last got filled
- **Grid mid** — the mid-price the micro grid is centered around
- **Levels** — how many micro grid levels are configured

---

## Risk Status

Tracks risk-management events:

- **Slippage rejects** — how many times an order was rejected because estimated slippage exceeded the configured threshold. A high count suggests the book is too thin.
- **Last reject** — when the most recent slippage reject happened.
- **Last rebalance** — if the bot detected its portfolio was too skewed to one side, it may have auto-rebalanced. Shows the side (buy/sell), amount, price, and when it happened.

---

## Bot Exploitation

Status of the bot-exploitation strategy's detection engine:

- **Active** — whether the exploitation detector is running
- **Cycles** — how many detection cycles have completed
- **Phase** — current phase (e.g., "idle", "detecting", "exploiting")
- **Last action** — description of the most recent exploitation action taken

---

## Open Orders

A table of all limit orders currently on the Steem DEX placed by this bot:

| Column | Meaning |
|--------|---------|
| **ID** | The on-chain order ID |
| **Side** | BUY (green) or SELL (red) |
| **Price** | The limit price |
| **Amount** | STEEM amount |
| **Expires** | When the order will auto-expire if not filled |
| **Cancel** | Button to manually cancel this specific order (requires confirmation) |

---

## Recent Bot Logs

The most recent operational log entries from this bot, color-coded by severity:

- **INFO** (blue) — normal operations (order placed, price fetched, etc.)
- **WARN** (yellow) — something unusual but not broken (high spread, slow response, low RC)
- **ERROR** (red) — something failed (API error, broadcast failure, etc.)
- **DEBUG** (purple) — detailed internal state (only visible if debug logging is enabled)

Each entry shows: timestamp, severity, event type (e.g., `ORDER_PLACED`, `PRICE_FETCH`, `MODE_SWITCH`), and a human-readable message.

A "View Full Logs →" link takes you to the dedicated Logs Explorer page with filtering and search.

---

## Analysis Tools

Run pre-built analysis scripts directly from the dashboard:

| Script | What it does |
|--------|-------------|
| **Daily Summary** (`npm run summary`) | Generates a summary of today's trading activity: fills, P&L, volume. |
| **Log Analysis 7d** (`npm run analyze -- --days 7`) | Parses the last 7 days of logs to surface patterns, errors, and performance trends. |
| **Backtest Market-Making** (`npm run backtest -- --strategy market-making --days 30`) | Replays the last 30 days of market data through the market-making strategy to estimate hypothetical performance. |
| **Backtest Grid-Range + CSV** (`npm run backtest -- --strategy grid-range --csv`) | Same as above but for grid-range, with CSV export for spreadsheet analysis. |

Output appears in a scrollable panel below the buttons.

---

## Footer

- **Auto-refresh 10s** — reminder that data refreshes automatically
- **Current time** — the client's local time at last refresh
- **App / Logs size** — disk usage of the application directory and log files
