// strategies/market-making/index.js
// Market-making strategy — provide liquidity on both sides, profit from spread.
// Exports: init, tick, shutdown, describe

export async function init(config) {
	console.info('STRAT', 'MARKET-MAKING', `Initializing on ${config.pair}`);
}

export async function tick(config) {
	// 1. Get current price and orderbook state
	// 2. Calculate bid/ask prices based on spread config
	// 3. Check inventory balance (avoid accumulating one side)
	// 4. Place/update orders
}

export async function shutdown(config) {
	console.info('STRAT', 'MARKET-MAKING', 'Shutting down — cancelling open orders');
}

export function describe() {
	return {
		name: 'market-making',
		description: 'Provide liquidity on both sides, profit from spread',
		version: '0.1.0',
	};
}
