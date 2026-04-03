// connectors/chains/steem-like/index.js
// Factory for Steem-like blockchain adapters.
// Creates an adapter and registers it in the main chain registry.

import { SteemLikeClient } from './client.js';
import { MarketPoller } from './market.js';
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

	const client   = new SteemLikeClient(nodes, chainName);
	const poller   = new MarketPoller(client, config);
	const cacheKey = `${chainName}:${baseToken.symbol}/${quoteToken.symbol}`;

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

		pause()  { poller.pause();  },
		resume() { poller.resume(); },

		get client() { return client; },
	};

	// Register in the main chain registry so getChain('steem') works
	registerChain(chainName, adapter);

	return adapter;
}
