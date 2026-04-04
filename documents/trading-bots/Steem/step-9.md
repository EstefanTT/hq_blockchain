# Step 9 – Second Sub-Strategy: Aggressive Sniping Mode (Depth ***)

**Only implement Step 9 (Aggressive Sniping Mode).**  
Do not touch any other remaining sub-strategies yet.

### Overall Goal of Step 9
Add the **Aggressive Sniping Mode** as the second full sub-strategy.

This is the “fast & opportunistic” mode: it waits for clear short-term imbalances or mispricings and hits them aggressively for quick profits, then returns control to the brain.

The strategy must integrate cleanly with:
- The permanent micro-layer
- The Market-Making strategy (Step 7)
- The Main Brain (Step 8)
- The new botLogger (Step 5)

### Exact Behaviour Required (Aggressive Sniping Mode)

- **Trigger conditions** (evaluated by the brain, but the strategy must react instantly when activated):
  - Strong one-sided book pressure (e.g. bids >> asks or vice-versa)
  - Our micro or MM orders get eaten unusually fast
  - DEX price lags CG/CMC by >1%
  - Sudden trade velocity spike

- **Action**:
  - Place a **single tight limit order** or small market eat on the cheap side
  - Size is still controlled (never more than what moves price <0.5–1%)
  - Immediately cancel/replace the micro-layer pyramid if needed to avoid over-exposure
  - Exit fast: either take the quick fill or flip to a mean-reversion sell/buy within seconds/minutes
  - After the snipe is complete (filled or cancelled), the brain decides the next mode

- The mode is **short-lived** (usually 10–60 seconds max) and should return control quickly.

### Integration & Control
- Create `strategies/aggressive-sniping/index.js` following the exact strategy contract:
  - `init(config)`
  - `tick(config)` (self-managed or called by engine)
  - `shutdown(config)`
  - `describe()`
- The brain (Step 8) must be able to start/stop this strategy cleanly.
- Use `botLog()` for every snipe attempt, fill, and exit (eventType: "SNIPING_TRIGGERED", "SNIPING_FILLED", etc.).
- Update the dashboard **Active Strategy** card to show when Sniping is active (with short description of the current snipe).

### Configuration (add to config.json)
```json
"aggressiveSniping": {
  "enabled": true,
  "maxSizeQuote": 8.0,
  "targetSlippagePercent": 0.4,
  "maxDurationSeconds": 60
}
Testing

Add tests in testing/strategies/ to verify:
Correct trigger detection and order placement
Proper size control and quick exit
Coexistence with micro-layer and Market-Making

Run the bot and manually create conditions (or wait for natural ones) to confirm the brain activates Sniping and the strategy behaves correctly.

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly (strategy only uses connector API)
Make the code clean, readable, and easy to extend for the remaining 3 modes
The strategy must work seamlessly with the Main Brain’s switching logic

Important note
If you have any important doubts, see a better way to structure the sniping logic, or have an improvement that seems important for the long-term (especially for the remaining 3 modes), please ask first before coding anything. Do not start implementation until we confirm.