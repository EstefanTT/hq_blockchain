# Step 5 – Double Logging System (Human + Analysis) (Depth ***)

**Only implement Step 5.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 5
Implement the **double logging system** we planned from the beginning:
- One clean, human-friendly log for you (easy to read in real time)
- One rich, structured analysis log for future offline review and strategy tuning

Both logs must work for the entire STEEM DEX Bot (and future multi-chain instances).

### 1. Human Log (what you see)
- File: `logs/bot.log` (and console output)
- Style: emoji-rich, clean, spacious, easy to read
- Use the existing logger with new context tags (BOT, ORDER, TRADE, MODE, ALERT, etc.)
- Every important event must appear here in a nice format, for example:
[20:08] [🤖 BOT] [STEEM-DEX] ✅ Order placed BUY 12.34 STEEM @ 0.1182
[20:09] [🔄 MODE] Switched to AGGRESSIVE_SNIPING (reason: imbalance detected)
text### 2. Analysis Log (for offline scripts)
- Two destinations:
- Append-only **JSONL file**: `data/analysis/steem-dex-bot.log.jsonl` (one JSON object per line)
- The existing **analysis_log** SQLite table (already created in Step 3)
- Every event must contain full structured data:
```json
{
  "timestamp": "2026-04-03T20:08:45Z",
  "chainName": "steem",
  "eventType": "ORDER_PLACED",
  "severity": "INFO",
  "strategy": "MARKET_MAKING",
  "data": {
    "side": "BUY",
    "price": 0.1182,
    "amountBase": 12.34,
    "orderId": 5486471799,
    "reason": "tight bid placed"
  }
}

What Must Be Logged (minimum)

Bot start / shutdown
Mode switches (including reason)
Price engine events (divergence, violent mode)
Order placed / cancelled / filled
Every trade (with full details)
Snapshot saved
RC / bandwidth warnings
Any error or safety trigger

Integration

Update the price engine, market connector, operations, and bot index.js to call the new logging functions
Add a small "Recent Logs" section to the dashboard (last 10 human-readable lines + link to full log file)
Make sure the logger is still fast and does not slow down the 3-second polling

Testing

Add tests in testing/ to verify:
Human log contains emoji and readable text
Analysis log contains full structured JSON in both file and SQLite

Run the bot for 2–3 minutes and confirm both logs are populated correctly

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly
Use existing logger, storage, and cache patterns
Make the logs pleasant for daily use and powerful for future analysis

Important note
If you have any important doubts, see a better way to structure the logs, or have an improvement that seems important for long-term strategy tuning / backtesting, please ask first before coding anything. Do not start implementation until we confirm.