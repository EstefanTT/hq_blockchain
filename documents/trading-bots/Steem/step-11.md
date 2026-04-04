# Step 11 – Fourth Sub-Strategy: Mean-Reversion Mode (Depth ***)

**Only implement Step 11 (Mean-Reversion Mode).**  
Do not touch the last sub-strategy (Defensive / Pause) yet.

### Overall Goal of Step 11
Add the **Mean-Reversion Mode** as the fourth full sub-strategy.

This is the “snap-back” mode: it detects sharp short-term moves (often caused by our own orders or sudden fills) and bets on a quick return to the recent average price.

The strategy must integrate cleanly with:
- The permanent micro-layer
- Market-Making, Aggressive Sniping and Grid/Range
- The Main Brain
- The botLogger

### Exact Behaviour Required (Mean-Reversion Mode)

- **Trigger**: sharp price move (>0.8–1% in seconds) away from the recent mean (last 30–60 min average).
- **Action**:
  - Place a **counter-order** on the opposite side of the move using inverted-pyramid sizing.
  - Closest to current price → tiniest order
  - Further away → gradually bigger (still safe size)
- Hold the position only for a short time (30–120 seconds max).
- Exit fast when price snaps back even 0.5–1% toward the mean.
- If no snap-back within timeout, cancel and let the brain decide next mode.
- Use quick rebalance safety net if the move continues against us.

### Integration & Control
- Create `strategies/mean-reversion/index.js` following the exact pattern used by the previous strategies:
  - `startMeanReversion(opts)`
  - `stopMeanReversion()`
  - `isMeanReversionRunning()`
  - `onMeanReversionTradeEvent(trade)`
  - `describe()`
- The brain must be able to start/stop this strategy cleanly.
- Use `botLog()` for every reversion placement, snap-back exit, and timeout (eventType: "REVERSION_TRIGGERED", "REVERSION_SNAPBACK", etc.).
- Update the dashboard **Active Strategy** card to show when Mean-Reversion is active (with move size and snap-back target).

### Configuration (add to config.json)
```json
"meanReversion": {
  "enabled": true,
  "triggerMovePercent": 0.9,
  "targetSnapbackPercent": 0.6,
  "maxDurationSeconds": 90,
  "baseSizeQuote": 2.0
}
Testing

Add tests in testing/strategies/ to verify:
Correct trigger detection
Counter-order pyramid placement
Snap-back exit and timeout handling
Coexistence with all previous strategies

Run the bot and create (or wait for) sharp moves to confirm the brain activates Mean-Reversion correctly.

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly
Make the code clean, readable, and easy to extend for the final Defensive mode
The strategy must work seamlessly with the Main Brain’s switching logic

Important note
If you have any important doubts, see a better way to structure the reversion logic, or have an improvement that seems important for the long-term, please ask first before coding anything. Do not start implementation until we confirm.