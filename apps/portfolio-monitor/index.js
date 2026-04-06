// apps/portfolio-monitor/index.js
// Wires core/portfolio + connectors/chains to track balances across all wallets.

export const meta = {
	name: 'portfolio-monitor',
	displayName: 'Portfolio Monitor',
	chain: 'ethereum',
	pairs: [],
	description: 'Tracks wallet balances and portfolio positions across all chains',
};

let dataActive = false;
let tradingActive = false;

export async function init() {
	console.info('BOT', meta.name.toUpperCase(), 'Initialized (stub)');
}

export async function startDataCollection() {
	dataActive = true;
	console.info('BOT', meta.name.toUpperCase(), 'Data collection started (stub)');
}

export async function stopDataCollection() {
	if (tradingActive) await stopBot();
	dataActive = false;
	console.info('BOT', meta.name.toUpperCase(), 'Data collection stopped (stub)');
}

export async function startBot() {
	if (!dataActive) await startDataCollection();
	tradingActive = true;
	console.info('BOT', meta.name.toUpperCase(), 'Bot started (stub)');
}

export async function stopBot() {
	tradingActive = false;
	console.info('BOT', meta.name.toUpperCase(), 'Bot stopped (stub)');
}

export async function shutdown() {
	await stopDataCollection();
	console.info('BOT', meta.name.toUpperCase(), 'Shutdown complete (stub)');
}

export function getStatus() {
	return { dataCollection: dataActive, trading: tradingActive, error: null };
}
