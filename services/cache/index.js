// services/cache/index.js
// In-memory runtime state. Aggregates actions (mutations) and getters (queries).

// ─── State ───────────────────────────────────────────────────

export const runtimeCache = {
	prices: {},         // { 'ETH/USDT': { price, source, updatedAt } }
	balances: {},       // { walletAddress: { chain, tokens: [...] } }
	positions: [],      // Active positions across all strategies
	strategies: {},     // { strategyId: { status, lastTick, ... } }

	// Price engine (Step 1)
	priceFeeds: {},         // { STEEM: { cg: { usd, updatedAt }, cmc: { usd, updatedAt } } }
	candles: {},            // { coinCgId: { raw: [], hourly: [], daily: [] } }
	priceEngine: {
		mode: 'normal',
		running: false,
		violentSince: null,
		lastCandleFetch: null,
		lastCgPriceFetch: null,
		lastCmcPriceFetch: null,
		next_candles: null,
		next_cgPrice: null,
		next_cmcPrice: null,
	},
	divergenceAlerts: [],

	// Chain connector (Step 2)
	orderBooks: {},      // { 'steem:STEEM/SBD': { bids, asks, timestamp, midPrice, spread } }
	recentTrades: {},    // { 'steem:STEEM/SBD': [trade, ...] }

	// Storage stats (Step 3) — lightweight in-memory counters
	storageStats: {
		lastSnapshotTime: null,
		tradesToday: 0,
		snapshotsToday: 0,
		currentPosition: null,   // { baseBalance, quoteBalance, averageEntryPrice, lastUpdated }
	},
};

// ─── Actions ─────────────────────────────────────────────────

import _updatePriceFeed from './actions/updatePriceFeed.js';
import _updateCandles from './actions/updateCandles.js';
import _updatePriceEngineStatus from './actions/updatePriceEngineStatus.js';
import _addDivergenceAlert from './actions/addDivergenceAlert.js';

export function updatePriceFeed(coinSymbol, source, usd) {
	return _updatePriceFeed(runtimeCache, coinSymbol, source, usd);
}
export function updateCandles(coinCgId, type, candles) {
	return _updateCandles(runtimeCache, coinCgId, type, candles);
}
export function updatePriceEngineStatus(fields) {
	return _updatePriceEngineStatus(runtimeCache, fields);
}
export function addDivergenceAlert(alert) {
	return _addDivergenceAlert(runtimeCache, alert);
}

import _setLiveOrderBook from './actions/setLiveOrderBook.js';
import _addRecentTrades from './actions/addRecentTrades.js';

export function setLiveOrderBook(cacheKey, book) {
	return _setLiveOrderBook(runtimeCache, cacheKey, book);
}
export function addRecentTrades(cacheKey, trades) {
	return _addRecentTrades(runtimeCache, cacheKey, trades);
}

import _updateStorageStats from './actions/updateStorageStats.js';

export function updateStorageStats(fields) {
	return _updateStorageStats(runtimeCache, fields);
}

// ─── Getters ─────────────────────────────────────────────────

import _getSteemDexBotData from './getters/getSteemDexBotData.js';
import _getLiveOrderBook from './getters/getLiveOrderBook.js';
import _getRecentTrades from './getters/getRecentTrades.js';

export function getSteemDexBotData() {
	return _getSteemDexBotData(runtimeCache);
}
export function getLiveOrderBook(cacheKey) {
	return _getLiveOrderBook(runtimeCache, cacheKey);
}
export function getRecentTrades(cacheKey, limit) {
	return _getRecentTrades(runtimeCache, cacheKey, limit);
}
