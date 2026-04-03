// connectors/chains/steem-like/client.js
// HTTP JSON-RPC client for Steem-like blockchains (Steem, Hive, Blurt).
// Handles node rotation and automatic failover.

import { createHttpClient } from '../../apis/shared/httpClient.js';

export class SteemLikeClient {

	constructor(nodes, chainName) {
		if (!nodes?.length) throw new Error('At least one node URL required');
		this.nodes = nodes;
		this.chainName = chainName;
		this.currentIndex = 0;
		this._tradeMethod = null; // cached: 'condenser_api' or 'market_history_api'

		this.clients = nodes.map(url =>
			createHttpClient({ baseURL: url, timeout: 8000, maxRetries: 0 })
		);
	}

	_rotate() {
		const prev = this.currentIndex;
		this.currentIndex = (this.currentIndex + 1) % this.nodes.length;
		if (this.nodes.length > 1) {
			console.warn('CHAIN', this.chainName.toUpperCase(),
				`Node rotation: ${this.nodes[prev]} → ${this.nodes[this.currentIndex]}`);
		}
	}

	/**
	 * Execute a JSON-RPC call, trying all nodes on failure.
	 */
	async call(method, params = []) {
		const maxAttempts = this.nodes.length;
		let lastError;

		for (let i = 0; i < maxAttempts; i++) {
			try {
				const res = await this.clients[this.currentIndex].post('/', {
					jsonrpc: '2.0',
					method,
					params,
					id: 1,
				});
				if (res.data?.error) {
					throw new Error(res.data.error.message || JSON.stringify(res.data.error));
				}
				return res.data?.result;
			} catch (err) {
				lastError = err;
				if (i < maxAttempts - 1) this._rotate();
			}
		}
		throw lastError;
	}

	async getOrderBook(limit = 500) {
		return this.call('condenser_api.get_order_book', [limit]);
	}

	async getRecentTrades(limit = 100) {
		// If we already discovered the working method, use it directly
		if (this._tradeMethod) {
			return this.call(`${this._tradeMethod}.get_recent_trades`, [limit]);
		}

		// Try condenser_api first, fall back to market_history_api
		try {
			const result = await this.call('condenser_api.get_recent_trades', [limit]);
			this._tradeMethod = 'condenser_api';
			return result;
		} catch {
			const result = await this.call('market_history_api.get_recent_trades', [limit]);
			this._tradeMethod = 'market_history_api';
			return result;
		}
	}

	async getTicker() {
		return this.call('condenser_api.get_ticker');
	}

	getCurrentNode() {
		return this.nodes[this.currentIndex];
	}
}
