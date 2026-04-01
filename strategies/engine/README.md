# strategies/engine/

Strategy lifecycle management — register, start, stop, pause, backtest.

| File | Role |
|---|---|
| `runner.js` | Runs a strategy instance — calls `tick()` on schedule, handles errors, checks risk |
| `registry.js` | Discovers and lists available strategies, maps names to modules |
| `backtest.js` | Replays historical data through a strategy to evaluate performance |
