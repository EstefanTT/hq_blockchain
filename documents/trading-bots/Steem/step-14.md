# Step 14 – Full Integration + Expanded Dashboard + Dry-Run Mode (Depth ***)

**Only implement Step 14.**  
This is the final integration step before live testing.

### Overall Goal of Step 14
Put **everything** together into a cohesive, production-ready bot:
- All 5 sub-strategies + micro-layer + main brain + risk layer + bot-exploitation
- A clean **dry-run mode** (no real orders broadcast)
- An **expanded dashboard** that shows the full picture
- Emergency controls (stop button, force-pause, manual mode switch)

### What Must Be Done

1. **Dry-Run Mode**
   - Add `dryRun: true` flag in `config.json` (default: false)
   - When `dryRun` is true:
     - All `placeLimitOrder` and `cancelOrder` calls go through the slippage/rebalance wrapper but **never broadcast**
     - Log clearly: "DRY-RUN: would have placed order X"
     - The bot behaves exactly as in live mode for all decisions and logging

2. **Expanded Dashboard**
   - Update `/api/dashboard/steem-dex-bot` to show **all** sections in a clean, logical layout:
     - Engine Status
     - Prices + Divergence
     - DEX Order Book + Recent Trades
     - Recent Candles
     - Micro Layer Status
     - Active Strategy + detail
     - Brain Status (current mode, signals, last switch reason)
     - Risk Status (slippage rejects, rebalance history, RC warning)
     - Bot Exploitation Status (cycles, last action)
     - Recent Bot Logs
     - Storage & App size info
   - Add top-right controls:
     - "Emergency Pause" button (forces Defensive mode)
     - "Force Dry-Run On/Off" toggle
     - "Manual Mode Switch" dropdown (for testing)
   - All buttons must call new protected API endpoints

3. **New API Endpoints (protected)**
   - `POST /api/execution/pause` → force Defensive mode
   - `POST /api/execution/set-dry-run` → toggle dry-run
   - `POST /api/execution/switch-mode` → force a specific mode (for testing)

4. **Final Wiring**
   - Ensure the brain, risk layer, and all strategies start cleanly together
   - Add a global `emergencyStop()` that cancels everything and pauses the bot
   - Update the main `index.js` shutdown to cleanly stop all layers

### Testing
- Run full boot test in **dry-run mode** for at least 5 minutes — confirm no real orders are placed
- Verify all dashboard sections update live
- Test emergency pause and manual mode switch buttons
- Confirm risk layer blocks oversized orders and rebalances correctly
- Confirm bot-exploitation can be manually triggered in dry-run

### Final Requirements
- Keep everything **generic and multi-chain ready**
- Respect architecture rules strictly
- Make the dashboard clean, spacious, and useful for daily monitoring
- This step turns the bot into a complete, safe, testable system

**Important note**  
If you have any important doubts, see a better way to structure the dry-run mode or dashboard controls, or have an improvement that seems important before we go live, please ask first before coding anything. Do not start implementation until we confirm.