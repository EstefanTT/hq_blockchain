// connectors/chains/steem-like/market.js
// Polling loop for order book + recent trades on Steem-like DEXes.
// Exposes subscribe(event, callback) so the rest of the bot sees "streaming" data.
// Automatically updates the cache on every poll.

import { normalizeOrderBook, normalizeTrades } from './normalizer.js';
import {
	setLiveOrderBook,
	addRecentTrades,
	updatePriceFeed,
	runtimeCache,
} from '../../../services/cache/index.js';

const POLL_INTERVAL_MS = 3_000;
const IDLE_POLL_INTERVAL_MS = 10_000;
const MAX_SEEN_IDS = 400;

export class MarketPoller {

	constructor(client, config) {
		this.client = client;
		this.chainName = config.chainName;
		this.baseSymbol = config.baseToken.symbol;
		this.quoteSymbol = config.quoteToken.symbol;
		this.cacheKey = `${config.chainName}:${config.baseToken.symbol}/${config.quoteToken.symbol}`;

		this.running = false;
		this.paused = false;
		this.timer = null;
		this.tradesAvailable = true;
		this._tradesInit = false;
		this._firstBook = false;
		this.seenTradeIds = new Set();

		this.listeners = { orderBook: [], trade: [] };
	}

	// ─── Public API ──────────────────────────────────────────

	subscribe(event, callback) {
		if (!this.listeners[event]) throw new Error(`Unknown event: ${event}`);
		this.listeners[event].push(callback);
		return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.paused = false;
		console.info('CHAIN', this.chainName.toUpperCase(), `📡 Market poller started (${this.cacheKey})`);
		this._poll();
	}

	stop() {
		this.running = false;
		clearTimeout(this.timer);
		this.timer = null;
		console.info('CHAIN', this.chainName.toUpperCase(), '🛑 Market poller stopped');
	}

	pause() { this.paused = true; console.info('CHAIN', this.chainName.toUpperCase(), '⏸️  Poller idle'); }
	resume() { this.paused = false; console.info('CHAIN', this.chainName.toUpperCase(), '▶️  Poller resumed'); }

	// ─── Poll loop ───────────────────────────────────────────

	async _poll() {
		if (!this.running) return;

		try {
			await this._fetchOrderBook();
		} catch (err) {
			console.warn('CHAIN', this.chainName.toUpperCase(), `Order book poll failed: ${err.message}`);
		}

		if (this.tradesAvailable) {
			try {
				await this._fetchTrades();
			} catch (err) {
				this.tradesAvailable = false;
				console.warn('CHAIN', this.chainName.toUpperCase(), `Trades API unavailable — disabling: ${err.message}`);
			}
		}

		const ms = this.paused ? IDLE_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
		this.timer = setTimeout(() => this._poll(), ms);
	}

	// ─── Order book ──────────────────────────────────────────

	async _fetchOrderBook() {
		const raw = await this.client.getOrderBook(500);
		const book = normalizeOrderBook(raw, this.baseSymbol);

		// Cache the normalized book
		setLiveOrderBook(this.cacheKey, book);

		// Also push DEX mid-price into the price feed cache (converted to USD)
		if (book.midPrice) {
			const quoteFeed = runtimeCache.priceFeeds[this.quoteSymbol];
			const quoteUsd = quoteFeed?.cg?.usd ?? quoteFeed?.cmc?.usd ?? null;
			const dexUsd = quoteUsd ? book.midPrice * quoteUsd : book.midPrice;
			updatePriceFeed(this.baseSymbol, 'dex', dexUsd);
		}

		// First-fetch log
		if (!this._firstBook) {
			this._firstBook = true;
			console.info('CHAIN', this.chainName.toUpperCase(),
				`📖 Book: ${book.bids.length} bids, ${book.asks.length} asks | ` +
				`Mid: ${book.midPrice?.toFixed(4)} | Spread: ${book.spreadPercent?.toFixed(2)}%`);
		}

		this._emit('orderBook', book);
	}

	// ─── Recent trades ───────────────────────────────────────

	async _fetchTrades() {
		const raw = await this.client.getRecentTrades(100);
		const trades = normalizeTrades(raw, this.baseSymbol, this.quoteSymbol);

		// First poll: seed cache + seen-set silently (no events)
		if (!this._tradesInit) {
			for (const t of trades) this.seenTradeIds.add(t.id);
			addRecentTrades(this.cacheKey, trades);
			this._tradesInit = true;
			console.info('CHAIN', this.chainName.toUpperCase(), `📊 Loaded ${trades.length} recent trades`);
			return;
		}

		// Subsequent polls: only emit genuinely new trades
		const newTrades = trades.filter(t => !this.seenTradeIds.has(t.id));
		if (newTrades.length === 0) return;

		for (const t of newTrades) this.seenTradeIds.add(t.id);

		// Trim seen-set
		if (this.seenTradeIds.size > MAX_SEEN_IDS) {
			const arr = [...this.seenTradeIds];
			this.seenTradeIds = new Set(arr.slice(-MAX_SEEN_IDS / 2));
		}

		addRecentTrades(this.cacheKey, newTrades);
		for (const t of newTrades) this._emit('trade', t);
	}

	// ─── Helpers ─────────────────────────────────────────────

	_emit(event, data) {
		for (const cb of this.listeners[event]) {
			try { cb(data); } catch (err) {
				console.error('CHAIN', this.chainName.toUpperCase(), `Listener error (${event}): ${err.message}`);
			}
		}
	}
}
