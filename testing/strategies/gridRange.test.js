// testing/strategies/gridRange.test.js
// Tests for Grid/Range mode — run with: node testing/strategies/gridRange.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

// ─── Mock adapter ────────────────────────────────────────────

function createMockAdapter(midPrice = 0.1200) {
	const placed = [];
	const cancelled = [];
	let nextOrderId = 5000;
	const openOrders = new Map();

	return {
		operationsReady: true,
		placed,
		cancelled,
		openOrders,

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

// ─── Mock cache ──────────────────────────────────────────────

function createMockCache(overrides = {}) {
	const now = new Date();
	const defaultTrades = Array.from({ length: 10 }, (_, i) => ({
		id: i,
		// Prices bounce between 0.1180 and 0.1220 (range ~3.3%)
		price: 0.1180 + (i % 3) * 0.0020,
		amountBase: 5,
		type: i % 2 === 0 ? 'buy' : 'sell',
		timestamp: new Date(now - (10 - i) * 60000).toISOString(),
	}));

	const data = {
		orderBooks: {
			'steem:STEEM/SBD': {
				midPrice: 0.1200,
				bids: [{ price: 0.1195, amount: 100 }],
				asks: [{ price: 0.1205, amount: 100 }],
				spreadPercent: 0.84,
				timestamp: now.toISOString(),
			},
		},
		recentTrades: {
			'steem:STEEM/SBD': defaultTrades,
		},
		...overrides,
	};

	const strategyUpdates = [];
	return {
		strategyUpdates,
		getSteemDexBotData: () => data,
		updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
	};
}

const baseCfg = {
	enabled: true,
	minRangeWidthPercent: 1.2,
	baseSizeQuote: 0.5,
	maxLevels: 5,
	refreshSeconds: 75,
	lookbackMinutes: 30,
	minTradesForRange: 6,
	orderExpirationSec: 120,
};

// ─── Tests ───────────────────────────────────────────────────

describe('Grid / Range Mode', async () => {
	let mod;
	let adapter;
	let logger;
	let cache;

	beforeEach(async () => {
		const importPath = `../../strategies/grid-range/index.js?t=${Date.now()}`;
		mod = await import(importPath);
		adapter = createMockAdapter(0.1200);
		logger = createMockLogger();
	});

	afterEach(async () => {
		if (mod.isGridRangeRunning()) await mod.stopGridRange();
	});

	it('should detect range and place inverted-pyramid grid', async () => {
		cache = createMockCache();

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isGridRangeRunning(), true);

		// Should place orders on both sides (up to maxLevels per side)
		const buys = adapter.placed.filter(o => o.side === 'buy');
		const sells = adapter.placed.filter(o => o.side === 'sell');

		assert.ok(buys.length > 0, 'Should place buy grid orders');
		assert.ok(sells.length > 0, 'Should place sell grid orders');

		// Inverted pyramid: closer levels should have smaller sizes
		if (buys.length >= 2) {
			// First buy (closer to mid) should have smaller amount*price than last buy (farther)
			const firstQuote = buys[0].price * buys[0].amount;
			const lastQuote = buys[buys.length - 1].price * buys[buys.length - 1].amount;
			assert.ok(firstQuote < lastQuote, `Inverted pyramid: L0 (${firstQuote.toFixed(4)}) < L${buys.length - 1} (${lastQuote.toFixed(4)})`);
		}

		// Log should mention range detection
		const rangeLog = logger.logs.find(l => l.message.includes('GRID_RANGE_DETECTED'));
		assert.ok(rangeLog, 'Should log range detection');
	});

	it('should stay idle when too few trades for range detection', async () => {
		cache = createMockCache({
			recentTrades: {
				'steem:STEEM/SBD': [
					{ id: 0, price: 0.12, amountBase: 5, type: 'buy', timestamp: new Date().toISOString() },
				],
			},
		});

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isGridRangeRunning(), true);
		assert.equal(adapter.placed.length, 0, 'Should place no orders when range cannot be detected');

		// Status should mention idle
		const lastStatus = cache.strategyUpdates[cache.strategyUpdates.length - 1];
		assert.ok(lastStatus.detail.includes('idle'), 'Detail should mention idle');
	});

	it('should place counter-order on opposite side when fill detected', async () => {
		cache = createMockCache();

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		const initialCount = adapter.placed.length;
		const buys = adapter.placed.filter(o => o.side === 'buy');
		assert.ok(buys.length > 0, 'Should have buy orders');

		// Simulate fill: remove buy order from open orders, send matching trade
		const filledBuy = buys[0];
		adapter.openOrders.delete(filledBuy.orderId);

		await mod.onGridTradeEvent({
			price: filledBuy.price,
			amountBase: filledBuy.amount,
			type: 'buy',
			timestamp: new Date().toISOString(),
		});

		// Should have placed a counter sell order
		const afterCount = adapter.placed.length;
		assert.ok(afterCount > initialCount, 'Should place counter-order after fill');

		const counterOrder = adapter.placed[adapter.placed.length - 1];
		assert.equal(counterOrder.side, 'sell', 'Counter-order should be on opposite side');

		// Fill log
		const fillLog = logger.logs.find(l => l.message.includes('GRID_FILLED'));
		assert.ok(fillLog, 'Should log grid fill');
	});

	it('should cancel all orders on stop', async () => {
		cache = createMockCache();

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.ok(adapter.placed.length > 0, 'Should have placed orders');
		const orderCount = adapter.openOrders.size;
		assert.ok(orderCount > 0, 'Should have open orders');

		await mod.stopGridRange();

		assert.equal(mod.isGridRangeRunning(), false);
		assert.ok(adapter.cancelled.length > 0, 'Should cancel orders on stop');
	});

	it('should stay idle when range is too narrow', async () => {
		// All trades at nearly same price → range < minRangeWidthPercent
		const now = new Date();
		cache = createMockCache({
			recentTrades: {
				'steem:STEEM/SBD': Array.from({ length: 10 }, (_, i) => ({
					id: i,
					price: 0.1200 + (i % 2) * 0.0001, // only 0.08% range
					amountBase: 5,
					type: 'buy',
					timestamp: new Date(now - i * 60000).toISOString(),
				})),
			},
		});

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(adapter.placed.length, 0, 'No orders when range too narrow');
	});

	it('should update strategy status with detail string', async () => {
		cache = createMockCache();

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		const lastStatus = cache.strategyUpdates[cache.strategyUpdates.length - 1];
		assert.equal(lastStatus.name, 'grid-range');
		assert.equal(lastStatus.active, true);
		assert.ok(lastStatus.detail.includes('📐'), 'Detail should include grid emoji');
		assert.ok(lastStatus.detail.includes('Range'), 'Detail should include Range text');
	});

	it('should mirror grid symmetrically around mid', async () => {
		cache = createMockCache();

		await mod.startGridRange({
			adapter,
			logger,
			config: { ...baseCfg, maxLevels: 3 },
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		const buys = adapter.placed.filter(o => o.side === 'buy');
		const sells = adapter.placed.filter(o => o.side === 'sell');

		// Should have same number of buy and sell levels
		assert.equal(buys.length, sells.length, `Should mirror: ${buys.length} buys vs ${sells.length} sells`);
	});

	it('should coexist with micro-layer (track own order IDs only)', async () => {
		cache = createMockCache();

		// Simulate micro-layer having its own orders by pre-populating adapter open orders
		adapter.openOrders.set(9999, { orderId: 9999, side: 'buy', price: 0.1190, amountBase: 1 });

		await mod.startGridRange({
			adapter,
			logger,
			config: baseCfg,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		// Should not have cancelled micro-layer order 9999
		assert.ok(!adapter.cancelled.includes(9999), 'Should not touch micro-layer orders');
		// Micro-layer order should still be open
		assert.ok(adapter.openOrders.has(9999), 'Micro-layer order should remain');

		await mod.stopGridRange();
		// Still should not cancel 9999
		assert.ok(!adapter.cancelled.includes(9999), 'Stop should not cancel micro-layer orders');
	});
});
