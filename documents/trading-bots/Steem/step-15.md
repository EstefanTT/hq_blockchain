# Step 15 – Analysis Scripts + Backtesting Tools (Depth ***)

**Only implement Step 15.**  
This is the final step of the project.

### Overall Goal of Step 15
Provide powerful offline tools to analyse past bot behaviour and backtest strategies using the rich data we have been logging since Step 3 (analysis_log + JSONL + order_book_snapshots + trades_history).

These tools must be easy to run from the terminal and must work for any chain (Steem, Hive, Blurt…).

### Required Scripts (create in a new folder `scripts/analysis/`)

1. **analyze-log.js**  
   - Reads the analysis_log SQLite table or the JSONL file
   - Generates a clean human-readable report:
     - Total profit/loss per strategy
     - Number of mode switches and reasons
     - Fill rates, average slippage, rebalance frequency
     - Bot-exploitation performance (cycles, profit)
     - RC warnings and defensive pauses
   - Accepts parameters: `--days 7`, `--strategy market-making`, `--chain steem`

2. **backtest.js**  
   - Replays historical order_book_snapshots + trades_history
   - Simulates any strategy (Market-Making, Sniping, Grid/Range, Mean-Reversion, Defensive) on past data
   - Outputs PnL, number of trades, max drawdown, win rate
   - Accepts parameters: `--strategy grid-range`, `--days 30`, `--start-date 2026-03-01`

3. **dashboard-summary.js**  
   - Quick one-line summary for the current day (total orders, current position, last brain decision, total micro-layer profit)
   - Can be run as a cron or manually

All scripts must:
- Use the existing `services/storage/steemDexStore.js` for DB access
- Support multi-chain via `--chain steem` (default) or `--chain hive`
- Output clean, emoji-rich console text + optional CSV export
- Be heavily commented so you can understand and extend them later

### Integration
- Add a new section in the dashboard called **“Analysis Tools”** with direct links (or copy-paste commands) to run these scripts.
- Update `package.json` with convenient npm scripts:
  ```json
  "analyze": "node scripts/analysis/analyze-log.js",
  "backtest": "node scripts/analysis/backtest.js",
  "summary": "node scripts/analysis/dashboard-summary.js"
Testing

Run each script manually and confirm they produce correct output using the real data from your test run.
Add basic tests in testing/scripts/ to verify they don’t crash and return expected structure.

Final Requirements

Keep everything generic and multi-chain ready
Respect architecture rules strictly (scripts only read from storage and cache)
Make the tools simple to use and powerful for future strategy tuning
This completes the bot — after this step the project is fully finished

Important note
If you have any important doubts, see a better way to structure the analysis or backtesting tools, or have an improvement that seems important for long-term learning and optimisation, please ask first before coding anything. Do not start implementation until we confirm.