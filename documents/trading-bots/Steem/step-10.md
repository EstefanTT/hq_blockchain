# Step 10 – Third Sub-Strategy: Grid / Range Mode (Depth ***)

**Only implement Step 10 (Grid / Range Mode).**  
Do not touch the remaining sub-strategies (Mean-Reversion, Defensive) yet.

### Overall Goal of Step 10
Add the **Grid / Range Mode** as the third full sub-strategy.

This is the “set-it-and-forget-it” mode: it detects when price is chopping sideways inside a clear range and places a ladder of limit orders (inverted pyramid style) to collect small profits on every bounce.

The strategy must integrate cleanly with:
- The permanent micro-layer
- Market-Making (Step 7)
- Aggressive Sniping (Step 9)
- The Main Brain (Step 8)
- The botLogger (Step 5)

### Exact Behaviour Required (Grid / Range Mode)

- **Range detection**: automatically detect a tight sideways range (e.g. price stuck between support and resistance for the last 30–60 min).
- **Inverted pyramid grid** inside the range:
  - Closest to current price → tiniest orders (e.g. 0.10 SBD)
  - Further away → gradually bigger (but still small enough not to move the market)
  - Same logic mirrored on both sides of the range
- When one order fills → instantly place a new order on the **opposite side** at the same distance to stay neutral.
- Refresh/cancel stale grid orders every 60–90 seconds.
- The mode is only active when the brain decides the market is ranging (low velocity, balanced book).

### Integration & Control
- Create `strategies/grid-range/index.js` following the exact pattern already used by Market-Making and Aggressive Sniping:
  - `startGridRange(opts)`
  - `stopGridRange()`
  - `isGridRangeRunning()`
  - `onGridTradeEvent(trade)`
  - `describe()`
- The brain must be able to start/stop this strategy cleanly.
- Use `botLog()` for every grid placement, fill, and range change (eventType: "GRID_PLACED", "GRID_FILLED", etc.).
- Update the dashboard **Active Strategy** card to show when Grid/Range is active (with range bounds and number of active grid orders).

### Configuration (add to config.json)
```json
"gridRange": {
  "enabled": true,
  "minRangeWidthPercent": 1.2,
  "baseSizeQuote": 0.5,
  "maxLevels": 5,
  "refreshSeconds": 75
}
Testing

Add tests in testing/strategies/ to verify:
Correct range detection
Grid pyramid construction and opposite-side replacement
Coexistence with micro-layer and other strategies

Run the bot and create ranging conditions (or wait for natural ones) to confirm the brain activates Grid/Range correctly.

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly (strategy only uses connector API)
Make the code clean, readable, and easy to extend for the last two modes
The strategy must work seamlessly with the Main Brain’s switching logic

Important note
If you have any important doubts, see a better way to structure the grid logic, or have an improvement that seems important for the long-term (especially for the remaining two modes), please ask first before coding anything. Do not start implementation until we confirm.