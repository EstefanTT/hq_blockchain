// scheduler/crons/runStrategies.js
// Triggers a tick on all active strategies. Called frequently (every minute).

export default async function runStrategies() {
	// 1. Get active strategies from cache/strategy registry
	// 2. For each: call strategy.tick() via engine/runner.js
	// Note: strategies with their own interval timers skip this cron
}
