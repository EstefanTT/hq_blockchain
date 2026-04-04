# Step 6 – Permanent Tiny Inverted-Pyramid Micro Layer (Depth ***)

**Only implement Step 6.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 6
Add the **always-on tiny inverted-pyramid micro layer** we discussed at the beginning.

This layer places very small limit orders on both sides of the current mid-price at all times (except when the bot is in Defensive/Pause mode). It is the “background liquidity” that generates the small recurrent profits ($10–20/month) even on low-volume days.

The layer must be **generic** (works for STEEM/SBD, future HIVE/HBD, etc.) and controlled by the main bot logic.

### Exact Behaviour Required

- **Inverted pyramid sizing** (example with tinyPyramidBaseSizeQuote = 0.10 SBD):
  - Closest to mid-price (0.1% away): 0.10 SBD worth
  - 0.3% away: 0.25 SBD worth
  - 0.6% away: 0.50 SBD worth
  - 1.0% away: 1.00 SBD worth
  - (Maximum 4–5 levels on each side)

- Orders are placed on **both sides** (bids and asks) of the current DEX mid-price.
- When one order is filled → immediately replace it on the **same side** at the same distance to keep the pyramid balanced.
- Refresh/cancel stale orders every 45–60 seconds.
- The layer is **always active** unless the bot is in Pause/Defensive mode.
- All orders must be **extremely small** (never more than what would move the price by 0.2%).

### Integration Points
- Add the logic inside the `steem-like` connector (new `microLayer.js` or inside `market.js` is fine).
- Expose simple `startMicroLayer()` / `stopMicroLayer()` functions.
- Call `startMicroLayer()` automatically when the bot starts (unless config says disabled).
- The main brain (future Step 8) must be able to pause/resume this layer.
- Update the dashboard with a small “Micro Layer Status” card showing:
  - How many micro orders are currently placed
  - Total value locked in micro layer
  - Last fill time (if any)

### Logging
- Use the new `botLog()` from Step 5 for every placement, fill, and cancel.
- Log eventType: "MICRO_ORDER_PLACED", "MICRO_ORDER_FILLED", etc.

### Testing
- Add tests in `testing/` to verify:
  - Pyramid is built correctly with correct sizes/distances
  - Orders are replaced after fill
  - Layer can be started/stopped safely
- Run the bot for a few minutes and confirm tiny orders appear on the real DEX (you can see them in the order book).

### Final Requirements
- Keep everything **generic and multi-chain ready**
- Respect architecture rules strictly
- Make the micro layer configurable via `config.json` (enable/disable, base size, max levels, distances)
- Keep the code clean, readable, and future-proof

**Important note**  
If you have any important doubts, see a better way to structure the micro layer, or have an improvement that seems important for long-term use, please ask first before coding anything. Do not start implementation until we confirm.