// testing/strategies/aggressiveSniping.test.js
// Tests for Aggressive Sniping — run with: node testing/strategies/aggressiveSniping.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ─── Mock adapter ────────────────────────────────────────────

function createMockAdapter(midPrice = 0.2000) {
	const placed = [];
	const cancelled = [];
	let nextOrderId = 5000;
	const openOrders = new Map();

	return {
		operationsReady: true,
		placed,
		cancelled,
		openOrders,

		getCurrentOrderBook() {
			return {
				midPrice,
				bids: [
					{ price: midPrice - 0.001, amount: 500 },
					{ price: midPrice - 0.002, amount: 300 },
				],
				asks: [
					{ price: midPrice + 0.001, amount: 500 },
					{ price: midPrice + 0.002, amount: 300 },
				],
				spreadPercent: 1.0,
				timestamp: new Date().toISOString(),
			};
		},

		async placeLimitOrder({ side, price, amount, expiration }) {
			const orderId = nextOrderId++;
			placed.push({ orderId, side, price, amount, expiration });
			openOrders.set(orderId, { orderId, side, price, amountBase: amount });
			return { orderId, txId: 'mock-tx', dryRun: false };
		},

		async cancelOrder(orderId) {
			cancelled.push(orderId);
			openOrders.delete(orderId);
			return { orderId, txId: 'mock-tx', dryRun: false };
		},

		async getOpenOrders() {
			return [...openOrders.values()];
		},
	};
}

function createMockLogger() {
	const logs = [];
	const fn = (level) => (context, message, data) => logs.push({ level, context, message, data });
	return { info: fn('info'), warn: fn('warn'), error: fn('error'), analysis: fn('analysis'), logs };
}

function createMockCache(overrides = {}) {
	const strategyUpdates = [];

	const defaultData = {
		priceFeeds: {},
		priceEngine: { mode: 'normal' },
		divergenceAlerts: [],
		orderBooks: {
			'steem:STEEM/SBD': {
				midPrice: 0.2000,
				bids: [
					{ price: 0.199, amount: 5000 },   // heavy bids → imbalance
					{ price: 0.198, amount: 3000 },
				],
				asks: [
					{ price: 0.201, amount: 100 },     // thin asks
					{ price: 0.202, amount: 80 },
				],
				spreadPercent: 1.0,
				timestamp: new Date().toISOString(),
			},
		},
		recentTrades: {},
		accountData: { rc: { percentage: 85 } },
		microLayerStatus: { active: true },
		strategyStatus: {},
	};

	const data = { ...defaultData };
	for (const [key, val] of Object.entries(overrides)) {
		if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
			data[key] = { ...defaultData[key], ...val };
		} else {
			data[key] = val;
		}
	}

	return {
		strategyUpdates,
		getSteemDexBotData: () => data,
		updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		setOverrides(o) {
			for (const [key, val] of Object.entries(o)) {
				if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
					data[key] = { ...data[key], ...val };
				} else {
					data[key] = val;
				}
			}
		},
	};
}

const baseCfg = {
	enabled: true,
	maxSizeQuote: 8.0,
	targetSlippagePercent: 1.0,
	maxDurationSeconds: 60,
	orderExpirationSec: 90,
};

// ─── Tests ───────────────────────────────────────────────────

describe('Aggressive Sniping', async () => {
	let mod;
	let adapter;
	let logger;
	let cache;

	beforeEach(async () => {
		const importPath = `../../strategies/aggressive-sniping/index.js?t=${Date.now()}`;
		mod = await import(importPath);

		adapter = createMockAdapter(0.2000);
		logger = createMockLogger();
	});

	it('should place a buy snipe when bids >> asks (imbalance)', async () => {
		cache = createMockCache();

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		// Should have placed a buy order (heavy bids → buy the thin asks)
		assert.ok(adapter.placed.length > 0, 'Should place at least one order');
		assert.equal(adapter.placed[0].side, 'buy');

		// Log should contain SNIPING_TRIGGERED
		const triggered = logger.logs.find(l => l.data?.eventType === 'SNIPING_TRIGGERED');
		assert.ok(triggered, 'Should log SNIPING_TRIGGERED');
		assert.equal(triggered.data.side, 'buy');

		await mod.stopAggressiveSniping();
	});

	it('should place a sell snipe when asks >> bids', async () => {
		cache = createMockCache({
			orderBooks: {
				'steem:STEEM/SBD': {
					midPrice: 0.2000,
					bids: [{ price: 0.199, amount: 100 }],     // thin bids
					asks: [
						{ price: 0.201, amount: 5000 },         // heavy asks
						{ price: 0.202, amount: 3000 },
					],
					spreadPercent: 1.0,
					timestamp: new Date().toISOString(),
				},
			},
		});

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.ok(adapter.placed.length > 0, 'Should place at least one order');
		assert.equal(adapter.placed[0].side, 'sell');

		await mod.stopAggressiveSniping();
	});

	it('should respect maxSizeQuote limit', async () => {
		cache = createMockCache();

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: { ...baseCfg, maxSizeQuote: 2.0 },
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		if (adapter.placed.length > 0) {
			const order = adapter.placed[0];
			const quote = order.price * order.amount;
			assert.ok(quote <= 2.1, `Quote size ${quote} should be near or under maxSizeQuote 2.0`);
		}

		await mod.stopAggressiveSniping();
	});

	it('should self-complete when no opportunity found (balanced book)', async () => {
		cache = createMockCache({
			orderBooks: {
				'steem:STEEM/SBD': {
					midPrice: 0.2000,
					bids: [{ price: 0.199, amount: 500 }],
					asks: [{ price: 0.201, amount: 500 }],
					spreadPercent: 1.0,
					timestamp: new Date().toISOString(),
				},
			},
		});

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		// No strong imbalance → should self-complete
		assert.equal(mod.isAggressiveSnipingRunning(), false, 'Should have self-completed');
		assert.equal(adapter.placed.length, 0, 'Should not have placed any orders');

		// Status should show inactive
		const lastStatus = cache.strategyUpdates[cache.strategyUpdates.length - 1];
		assert.equal(lastStatus.active, false);
	});

	it('should detect fill via onSnipeTradeEvent', async () => {
		cache = createMockCache();

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isAggressiveSnipingRunning(), true);
		assert.ok(adapter.placed.length > 0);

		const orderId = adapter.placed[0].orderId;
		const price = adapter.placed[0].price;

		// Simulate fill: remove from open orders
		adapter.openOrders.delete(orderId);

		// Fire trade at our price
		await mod.onSnipeTradeEvent({ price, amountBase: 100, type: 'buy' });

		// Should detect fill and self-complete
		assert.equal(mod.isAggressiveSnipingRunning(), false, 'Should have self-completed after fill');

		const filledLog = logger.logs.find(l => l.data?.eventType === 'SNIPING_FILLED');
		assert.ok(filledLog, 'Should log SNIPING_FILLED');
	});

	it('should cancel order on stopAggressiveSniping', async () => {
		cache = createMockCache();

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isAggressiveSnipingRunning(), true);
		const orderId = adapter.placed[0].orderId;

		await mod.stopAggressiveSniping();

		assert.equal(mod.isAggressiveSnipingRunning(), false);
		assert.ok(adapter.cancelled.includes(orderId), 'Should have cancelled the snipe order');
	});

	it('should snipe on divergence > 1%', async () => {
		cache = createMockCache({
			orderBooks: {
				'steem:STEEM/SBD': {
					midPrice: 0.2000,
					bids: [{ price: 0.199, amount: 500 }],
					asks: [{ price: 0.201, amount: 500 }],
					spreadPercent: 1.0,
					timestamp: new Date().toISOString(),
				},
			},
			divergenceAlerts: [
				{ differencePercent: -2.5, timestamp: new Date().toISOString() },
			],
		});

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		// Negative divergence → DEX is cheap → buy
		assert.ok(adapter.placed.length > 0, 'Should place a buy order');
		assert.equal(adapter.placed[0].side, 'buy');

		await mod.stopAggressiveSniping();
	});

	it('should update strategy status with detail', async () => {
		cache = createMockCache();

		await mod.startAggressiveSniping({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		const activeStatus = cache.strategyUpdates.find(s => s.active && s.name === 'aggressive-sniping');
		assert.ok(activeStatus, 'Should push strategy status with name');
		assert.ok(activeStatus.detail, 'Should include detail text');

		await mod.stopAggressiveSniping();
	});
});
