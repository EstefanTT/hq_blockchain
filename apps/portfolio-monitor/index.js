// apps/portfolio-monitor/index.js
// Wires core/portfolio + connectors/chains to track balances across all wallets.
// Exports init() and shutdown() for the main process to manage.

export async function init() {
	console.info('BOT', 'PORTFOLIO-MONITOR', 'Initializing');
	// Load wallet configs, register chain connectors, start periodic balance sync
}

export async function shutdown() {
	console.info('BOT', 'PORTFOLIO-MONITOR', 'Shutting down');
}
