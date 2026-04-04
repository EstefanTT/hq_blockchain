// connectors/chains/steem-like/index.js
// Factory for Steem-like blockchain adapters.
// Creates an adapter and registers it in the main chain registry.

import { SteemLikeClient } from './client.js';
import { MarketPoller } from './market.js';
import { SteemLikeOperations } from './operations.js';
import { registerChain } from '../registry.js';
import { getLiveOrderBook, getRecentTrades } from '../../../services/cache/index.js';

/**
 * Create a Steem-like blockchain adapter.
 * @param {Object} config — { chainName, nodes, baseToken, quoteToken }
 * @returns {Object} adapter with start/stop/subscribe/getters
 */
export function createSteemLikeAdapter(config) {
	const { chainName, nodes, baseToken, quoteToken } = config;

	if (!nodes?.length) throw new Error(`No nodes configured for ${chainName}`);

	const client = new SteemLikeClient(nodes, chainName);
	const poller = new MarketPoller(client, config);
	const cacheKey = `${chainName}:${baseToken.symbol}/${quoteToken.symbol}`;

	let ops = null; // initialized lazily via initOperations()

	const adapter = {
		getChainInfo() {
			return { chainName, baseToken, quoteToken, currentNode: client.getCurrentNode() };
		},

		getCurrentOrderBook() {
			return getLiveOrderBook(cacheKey);
		},

		getRecentTrades(limit = 50) {
			return getRecentTrades(cacheKey, limit);
		},

		subscribe(event, callback) {
			return poller.subscribe(event, callback);
		},

		async start() {
			console.info('CHAIN', chainName.toUpperCase(), `🚀 Connector starting (${nodes.length} nodes)`);
			poller.start();
		},

		async stop() {
			poller.stop();
		},

		pause() { poller.pause(); },
		resume() { poller.resume(); },

		get client() { return client; },

		// ─── Operations (Step 4) ────────────────────────────────

		/**
		 * Initialize order operations with account credentials.
		 * Must be called before using place/cancel/balance/RC methods.
		 * @param {{ account: string, activeKey: string, logger?: Object }} creds
		 */
		initOperations({ account, activeKey, logger }) {
			ops = new SteemLikeOperations({
				nodeUrl: nodes[0],
				chainName,
				account,
				activeKey,
				baseSymbol: baseToken.symbol,
				quoteSymbol: quoteToken.symbol,
				logger,
			});
			console.info('CHAIN', chainName.toUpperCase(), `🔑 Operations initialized for @${account}`);
		},

		get operationsReady() { return ops !== null; },

		async placeLimitOrder(params) {
			if (!ops) throw new Error('Operations not initialized — call initOperations() first');
			return ops.placeLimitOrder(params);
		},

		async cancelOrder(orderId, opts) {
			if (!ops) throw new Error('Operations not initialized — call initOperations() first');
			return ops.cancelOrder(orderId, opts);
		},

		async getOpenOrders() {
			if (!ops) throw new Error('Operations not initialized — call initOperations() first');
			return ops.getOpenOrders();
		},

		async getAccountBalances() {
			if (!ops) throw new Error('Operations not initialized — call initOperations() first');
			return ops.getAccountBalances();
		},

		async getAccountRC() {
			if (!ops) throw new Error('Operations not initialized — call initOperations() first');
			return ops.getAccountRC();
		},
	};

	// Register in the main chain registry so getChain('steem') works
	registerChain(chainName, adapter);

	return adapter;
}
