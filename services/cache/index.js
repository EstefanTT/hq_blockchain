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

	// Account data (Step 4) — balances, open orders, RC
	accountData: {
		account: null,
		balance: null,        // e.g. "549.822 STEEM"
		quoteBalance: null,   // e.g. "3.410 SBD"
		vestingShares: null,
		openOrders: [],
		rc: null,             // { percentage, currentMana, maxMana }
		lastRefresh: null,
	},

	// Micro layer (Step 6) — inverted-pyramid market-making status
	microLayerStatus: {
		active: false,
		buyOrders: 0,
		sellOrders: 0,
		totalValueQuote: 0,
		lastFillTime: null,
		lastMidPrice: null,
		levelsConfigured: 0,
	},

	// Active strategy status (Step 7)
	strategyStatus: {
		name: null,
		active: false,
		buyOrders: 0,
		sellOrders: 0,
		totalValueQuote: 0,
		lastFillTime: null,
		lastMidPrice: null,
	},

	// Brain status (Step 8)
	brainStatus: {
		currentMode: null,
		active: false,
		lastSwitchTime: null,
		lastSwitchReason: null,
		nextTickTime: null,
		signals: {},
	},

	// App/log sizes (Step 6)
	appSizeInfo: {
		appSizeMB: null,
		logsSizeMB: null,
		updatedAt: null,
	},

	// Risk status (Step 13)
	riskStatus: {
		slippageRejectCount: 0,
		lastSlippageReject: null,
		lastRebalanceTime: null,
		lastRebalanceSide: null,
		lastRebalanceAmount: null,
		lastRebalancePrice: null,
	},

	// Bot-exploitation status (Step 13)
	exploitationStatus: {
		active: false,
		cycleCount: 0,
		phase: 'idle',
		lastAction: null,
	},

	// Dry-run flag (Step 14)
	dryRunEnabled: false,
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
import _updateAccountData from './actions/updateAccountData.js';
import _updateMicroLayerStatus from './actions/updateMicroLayerStatus.js';
import _updateStrategyStatus from './actions/updateStrategyStatus.js';
import _updateBrainStatus from './actions/updateBrainStatus.js';

export function updateStorageStats(fields) {
	return _updateStorageStats(runtimeCache, fields);
}
export function updateAccountData(fields) {
	return _updateAccountData(runtimeCache, fields);
}
export function updateMicroLayerStatus(fields) {
	return _updateMicroLayerStatus(runtimeCache, fields);
}
export function updateStrategyStatus(fields) {
	return _updateStrategyStatus(runtimeCache, fields);
}
export function updateBrainStatus(fields) {
	return _updateBrainStatus(runtimeCache, fields);
}
export function updateAppSizeInfo(fields) {
	Object.assign(runtimeCache.appSizeInfo, fields);
}
export function updateRiskStatus(fields) {
	Object.assign(runtimeCache.riskStatus, fields);
}
export function updateExploitationStatus(fields) {
	Object.assign(runtimeCache.exploitationStatus, fields);
}
export function setDryRunFlag(enabled) {
	runtimeCache.dryRunEnabled = !!enabled;
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
