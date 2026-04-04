# Step 8 – Main Brain + Switching Logic (Depth ***)

**Only implement Step 8.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 8
Create the **Main Brain** — the central meta-controller that watches the market and our own orders in real time and decides which sub-strategy (or combination) should be active.

This is the “smart switcher” we planned from the very first conversation. It ties together the micro-layer, Market-Making (Step 7), and the future 4 sub-strategies.

### Core Responsibilities of the Brain

The brain runs on a fast tick (every 5–8 seconds) and must:

1. **Collect signals** (lightweight, from cache only):
   - Fill speed of our last orders (fast vs slow)
   - Price impact after our own orders
   - Order-book imbalance (bids vs asks thickness)
   - Recent trade velocity
   - Current DEX mid-price vs external CG/CMC
   - Volatility level (from price engine)
   - RC / bandwidth remaining
   - Current micro-layer status

2. **Decide active mode** using simple, readable rules:
   - Default → Market-Making
   - Strong one-sided pressure or fast fills → Aggressive Sniping
   - Price chopping inside clear range → Grid/Range
   - Sharp move with quick snap-back expected → Mean-Reversion
   - Book too thin, RC low, or weird divergence → Pause/Defensive

3. **Execute the switch**:
   - Start/stop the chosen strategy cleanly
   - Pause/resume micro-layer when needed (e.g. in Defensive mode)
   - Log every switch with full reason (eventType: "BRAIN_SWITCH")

4. **Safety overrides**:
   - Always respect max exposure caps
   - Immediate switch to Defensive if RC < 20% or divergence > 3%

### Implementation Details
- Create `strategies/engine/brain.js` (or similar) with:
  - `init(config)`
  - `tick()` (self-managed or called by runner)
  - `shutdown()`
  - `getCurrentMode()` and `getLastSwitchReason()`
- Use the new `strategyStatus` cache key (from Step 7) to expose current mode to dashboard and other code.
- Update the bot’s main `index.js` to start the brain automatically.
- Update the dashboard with a clear **“Brain Status”** card showing current mode + last switch reason + next tick time.

### Configuration (add to config.json)
```json
"brain": {
  "enabled": true,
  "tickSeconds": 6,
  "cooldownSeconds": 30
}
Logging

Every brain decision and mode switch must use botLog() with clear emojis and full structured data in analysis_log.

Testing

Add tests in testing/strategies/ that simulate different market conditions and verify correct mode switches.
Run the bot for a few minutes and confirm the brain switches modes appropriately (you can force conditions by placing manual orders or waiting for natural movement).

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly (brain only reads cache and calls strategy start/stop)
Make the switching logic readable and easy to extend for future sub-strategies
The brain must coexist peacefully with the permanent micro-layer

Important note
If you have any important doubts, see a better way to structure the brain, or have an improvement that seems important for long-term strategy tuning / multi-mode coexistence, please ask first before coding anything. Do not start implementation until we confirm.