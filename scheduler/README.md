# scheduler/

Cron-based task scheduler — auto-discovers and runs jobs. Production only by default.

## File Inventory

| File | Purpose | Key Exports |
|---|---|---|
| `cronManager.js` | Auto-discovers cron files from `crons/`, schedules them with `node-cron` | `cronStartsEvery` (schedule presets), `default startCrons()` |
| `crons/refreshPrices.js` | Fetches latest prices from connected sources | `default` async function |
| `crons/riskChecks.js` | Runs risk checks (exposure limits, position limits) | `default` async function |
| `crons/runStrategies.js` | Triggers strategy tick cycles | `default` async function |
| `crons/syncBalances.js` | Syncs wallet balances from chains/exchanges | `default` async function |
| `crons/updateAppSize.js` | Calculates app/log/data directory sizes | `default` async function |

## Interface Contract

`cronManager.js` provides UTC timezone schedule presets:

```js
export const cronStartsEvery = {
  min:        '* * * * *',
  _5min:      '*/5 * * * *',
  _10min:     '*/10 * * * *',
  _15min:     '*/15 * * * *',
  _30min:     '*/30 * * * *',
  hour:       '*/60 * * * *',
  _3hour:     '0 */3 * * *',
  dayAt03h:   '0 3 * * *',
  // ... more presets
};
```

### Current schedule

| Cron | Frequency |
|---|---|
| `runStrategies` | Every minute |
| `refreshPrices` | Every 5 minutes |
| `riskChecks` | Every 10 minutes |
| `syncBalances` | Every 15 minutes |
| `updateAppSize` | Daily at 03:00 UTC (+ once at startup) |

## Conventions

- New scheduled task → create `crons/taskName.js` exporting `default async function`, then add `cron.schedule()` call in `cronManager.js`
- All schedules use UTC timezone
- All cron files are auto-discovered via directory scan — the file just needs to exist in `crons/`
