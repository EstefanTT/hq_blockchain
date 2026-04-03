// apps/steem-dex-bot/index.js
// STEEM/SBD DEX trading bot — multi-chain ready skeleton.
// Wires the price engine (Step 1) and future strategies.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

let priceEngine = null;
let chainAdapter = null;

export async function init() {
	if (!config.enabled) {
		console.info('BOT', 'STEEM-DEX', '⏸️  Disabled in config — skipping');
		return;
	}

	console.info('BOT', 'STEEM-DEX', '🚀 Initializing STEEM DEX Bot...');
	console.info('BOT', 'STEEM-DEX', `Chain: ${config.chainName} | Base: ${config.baseToken.symbol} | Quote: ${config.quoteToken.symbol}`);

	// Start the price engine (external feeds)
	const { PriceEngine } = await import('../../core/market/priceEngine.js');
	priceEngine = new PriceEngine({
		chainName: config.chainName,
		baseToken: config.baseToken,
		quoteToken: config.quoteToken,
	});
	await priceEngine.start();

	// Start the chain connector (DEX order book + trades)
	const { createSteemLikeAdapter } = await import('../../connectors/chains/steem-like/index.js');
	chainAdapter = createSteemLikeAdapter({
		chainName: config.chainName,
		nodes: config.nodes,
		baseToken: config.baseToken,
		quoteToken: config.quoteToken,
	});
	await chainAdapter.start();

	console.info('BOT', 'STEEM-DEX', '✅ STEEM DEX Bot ready 🟢');
}

export async function shutdown() {
	console.info('BOT', 'STEEM-DEX', '🛑 Shutting down...');
	if (chainAdapter) await chainAdapter.stop();
	if (priceEngine) await priceEngine.stop();
	console.info('BOT', 'STEEM-DEX', '✅ Shutdown complete');
}
