# scheduler/

Cron-based task scheduler — auto-discovers and runs jobs. Ported from hq-home.

| File | Role |
|---|---|
| `cronManager.js` | Loads all cron files from `crons/`, schedules them with node-cron |
| `crons/` | One file per scheduled task, each exports a default async function |

Crons run in **production only** by default. All schedules use UTC timezone.
