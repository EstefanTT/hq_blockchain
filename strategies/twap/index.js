// strategies/twap/index.js
// TWAP strategy — Time-Weighted Average Price execution.
// Exports: init, tick, shutdown, describe

export async function init(config) {
	console.info('STRAT', 'TWAP', `Initializing: ${config.totalAmount} ${config.tokenIn} over ${config.slices} slices`);
}

export async function tick(config) {
	// 1. Check if more slices remain
	// 2. Build order for one slice
	// 3. Risk check → simulate → execute
	// 4. Track progress (slices completed, avg price so far)
}

export async function shutdown(config) {
	console.info('STRAT', 'TWAP', 'Shutting down');
}

export function describe() {
	return {
		name: 'twap',
		description: 'Time-Weighted Average Price — split large orders over time',
		version: '0.1.0',
	};
}
