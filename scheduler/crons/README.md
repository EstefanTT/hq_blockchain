# scheduler/crons/

One file per scheduled task. Each file exports a `default async function`.

Auto-discovered by `cronManager.js`. Schedule assignment is done in `cronManager.js`.
