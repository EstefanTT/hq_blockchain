// services/cache/index.js
// In-memory runtime state. Aggregates actions (mutations) and getters (queries).
// Per-bot state lives under runtimeCache.bots[botName]. Shared/global state at top level.

// ─── Default per-bot state shape ─────────────────────────────

function defaultBotState() {
	return {
		storageStats: {
			lastSnapshotTime: null,
			tradesToday: 0,
			snapshotsToday: 0,
			currentPosition: null,
		},
		accountData: {
			account: null,
			balance: null,
			quoteBalance: null,
			vestingShares: null,
			openOrders: [],
			rc: null,
			lastRefresh: null,
		},
		microLayerStatus: {
			active: false,
			buyOrders: 0,
			sellOrders: 0,
			totalValueQuote: 0,
			lastFillTime: null,
			lastMidPrice: null,
			levelsConfigured: 0,
		},
		strategyStatus: {
			name: null,
			active: false,
			buyOrders: 0,
			sellOrders: 0,
			totalValueQuote: 0,
			lastFillTime: null,
			lastMidPrice: null,
		},
		brainStatus: {
			currentMode: null,
			active: false,
			lastSwitchTime: null,
			lastSwitchReason: null,
			nextTickTime: null,
			signals: {},
		},
		riskStatus: {
			slippageRejectCount: 0,
			lastSlippageReject: null,
			lastRebalanceTime: null,
			lastRebalanceSide: null,
			lastRebalanceAmount: null,
			lastRebalancePrice: null,
		},
		exploitationStatus: {
			active: false,
			cycleCount: 0,
			phase: 'idle',
			lastAction: null,
		},
		dryRunEnabled: false,
	};
}

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

	// App/log sizes (system-level)
	appSizeInfo: {
		appSizeMB: null,
		logsSizeMB: null,
		updatedAt: null,
	},

	// Bot control state (Dashboard improvement)
	botControl: {},  // { 'steem-dex-bot': { enabled, dryRun, disabledStrategies } }

	// Per-bot namespaced state
	bots: {},  // { 'steem-dex-bot': { storageStats, accountData, brainStatus, ... } }
};

// ─── Per-Bot Cache Management ────────────────────────────────

/** Initialize a bot's cache namespace. Idempotent — won't reset existing data. */
export function initBotCache(botName) {
	if (runtimeCache.bots[botName]) return;
	runtimeCache.bots[botName] = defaultBotState();
}

/** Get a bot's cache namespace, throwing if not initialized. */
function getBotCache(botName) {
	if (!runtimeCache.bots[botName]) {
		throw new Error(`Cache not initialized for bot: ${botName}. Call initBotCache() first.`);
	}
	return runtimeCache.bots[botName];
}

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

export function updateStorageStats(botName, fields) {
	return _updateStorageStats(getBotCache(botName), fields);
}
export function updateAccountData(botName, fields) {
	return _updateAccountData(getBotCache(botName), fields);
}
export function updateMicroLayerStatus(botName, fields) {
	return _updateMicroLayerStatus(getBotCache(botName), fields);
}
export function updateStrategyStatus(botName, fields) {
	return _updateStrategyStatus(getBotCache(botName), fields);
}
export function updateBrainStatus(botName, fields) {
	return _updateBrainStatus(getBotCache(botName), fields);
}
export function updateAppSizeInfo(fields) {
	Object.assign(runtimeCache.appSizeInfo, fields);
}

export function getAppSizeInfo() {
	return { ...runtimeCache.appSizeInfo };
}
export function updateRiskStatus(botName, fields) {
	Object.assign(getBotCache(botName).riskStatus, fields);
}
export function updateExploitationStatus(botName, fields) {
	Object.assign(getBotCache(botName).exploitationStatus, fields);
}
export function setDryRunFlag(botName, enabled) {
	getBotCache(botName).dryRunEnabled = !!enabled;
}
export function updateBotControlState(botName, control) {
	runtimeCache.botControl[botName] = { ...control };
}
export function getBotControlState(botName) {
	return runtimeCache.botControl[botName] || null;
}

// ─── Getters ─────────────────────────────────────────────────

import _getBotData from './getters/getBotData.js';
import _getLiveOrderBook from './getters/getLiveOrderBook.js';
import _getRecentTrades from './getters/getRecentTrades.js';

/** Returns merged global + per-bot state for the given bot. */
export function getBotData(botName) {
	return _getBotData(runtimeCache, botName);
}

/** @deprecated Use getBotData(botName) instead */
export function getSteemDexBotData() {
	return _getBotData(runtimeCache, 'steem-dex-bot');
}
export function getLiveOrderBook(cacheKey) {
	return _getLiveOrderBook(runtimeCache, cacheKey);
}
export function getRecentTrades(cacheKey, limit) {
	return _getRecentTrades(runtimeCache, cacheKey, limit);
}
