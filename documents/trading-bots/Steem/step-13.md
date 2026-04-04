# Step 13 – Risk & Rebalance Layer + Bot-Exploitation (Depth ***)

**Only implement Step 13.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 13
Add the **Risk & Rebalance Layer** + the **Bot-Exploitation** sub-mode.

This is the final safety + advanced layer that protects the bot and turns the other bots’ predictable behaviour into an advantage.

### 1. Risk & Rebalance Layer (mandatory safety net)

- **Self-Inflicted Slippage Calculator**  
  Before **any** order is placed (micro-layer, MM, sniping, grid, reversion), calculate exact price impact using the current live order book.  
  If the order would move price more than `maxAllowedSlippagePercent` (config), reject it and log a warning.

- **Quick Rebalance Safety Net**  
  If one side gets fully filled and the position becomes unbalanced (>1% deviation from target ratio), automatically:
  - Place a small opposing market or tight limit order to bring inventory back toward neutral.
  - Limit rebalance size to max 20% of the unbalanced side.
  - Log eventType: "REBALANCE_TRIGGERED" and "REBALANCE_COMPLETED".

- **Resource Credit Guardrails**  
  - If RC/bandwidth < `minRCPercent` (config, default 25%), force switch to Defensive/Pause.
  - Log warning before it happens.

### 2. Bot-Exploitation Mode (cat-and-mouse layer)

- **Detection**: watch the other 1-2 bots’ behaviour (how tight they keep their spread, how fast they replace orders).
- **Action**:
  - Place a tiny “bait” order just 0.01–0.02% inside their limit.
  - Wait for them to fill or add on top.
  - Then hit a small market order (~$10) to push price 1–2% (possible because book is thin).
  - Immediately flip: place new orders on the new side where they will chase.
  - Repeat 5–10 times while they remain predictable, then exit back to normal modes.
- Only activate when the brain detects the other bots are active and following a pattern.
- Max exposure and cooldowns apply.

### Integration
- Create `core/risk/rebalance.js` and `strategies/bot-exploitation/index.js` (following the same pattern as other strategies).
- The Main Brain (Step 8) must be able to start/stop Bot-Exploitation.
- Update `runtimeCache` with `riskStatus` and `exploitationStatus`.
- Update the dashboard with two new small cards: “Risk Status” and “Bot Exploitation Status”.
- All actions must use `botLog()` with clear emojis and full structured data.

### Configuration (add to config.json)
```json
"risk": {
  "maxAllowedSlippagePercent": 0.3,
  "minRCPercent": 25,
  "rebalanceMaxPercent": 0.2
},
"botExploitation": {
  "enabled": true,
  "baitDistancePercent": 0.015,
  "pushSizeQuote": 10,
  "maxCycles": 8
}
Testing

Add tests in testing/ for:
Slippage calculator (rejects oversized orders)
Rebalance trigger and execution
Bot-exploitation bait → push → flip cycle
Coexistence with all strategies and micro-layer

Run the bot and confirm safety rules never allow dangerous orders.

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly
Make the code clean, readable, and powerful for future chains
This layer must protect the entire bot (micro + all 5 strategies)

Important note
If you have any important doubts, see a better way to structure the risk/rebalance or bot-exploitation logic, or have an improvement that seems important for long-term safety and profitability, please ask first before coding anything. Do not start implementation until we confirm.