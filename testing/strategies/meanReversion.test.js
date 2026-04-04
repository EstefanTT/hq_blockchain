// testing/strategies/meanReversion.test.js
// Tests for Mean-Reversion — run with: node testing/strategies/meanReversion.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

// ─── Mock adapter ────────────────────────────────────────────

function createMockAdapter() {
	const placed = [];
	const cancelled = [];
	let nextOrderId = 9000;

	return {
		operationsReady: true,
		placed,
		cancelled,

		async placeLimitOrder({ side, price, amount, expiration }) {
			const orderId = nextOrderId++;
			placed.push({ orderId, side, price, amount, expiration });
			return { orderId, txId: 'mock-tx', dryRun: false };
		},

		async cancelOrder(orderId) {
			cancelled.push(orderId);
			return { orderId, txId: 'mock-tx', dryRun: false };
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
	const data = {
		orderBooks: { 'steem:STEEM/SBD': overrides.orderBook ?? null },
		recentTrades: { 'steem:STEEM/SBD': overrides.trades ?? [] },
	};

	return {
		strategyUpdates,
		getSteemDexBotData: () => data,
		updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
	};
}

// ─── Config ──────────────────────────────────────────────────

const baseConfig = {
	enabled: true,
	triggerMovePercent: 0.9,
	targetSnapbackPercent: 0.6,
	maxDurationSeconds: 5,       // short for tests
	baseSizeQuote: 2.0,
	lookbackMinutes: 30,
	orderExpirationSec: 120,
};

// Helper: generate recent trades at a given mean price
function recentTradesAtMean(mean, count = 10) {
	const now = Date.now();
	return Array.from({ length: count }, (_, i) => ({
		price: mean + (i % 2 === 0 ? 0.0001 : -0.0001),
		amountBase: 100,
		type: 'buy',
		timestamp: new Date(now - (count - i) * 60_000).toISOString(),
	}));
}

// ─── Tests ───────────────────────────────────────────────────

describe('Mean-Reversion', async () => {
	let mod;
	let adapter;
	let logger;

	beforeEach(async () => {
		// Fresh import each time to reset module state
		mod = await import(`../../strategies/mean-reversion/index.js?t=${Date.now()}_${Math.random()}`);
		adapter = createMockAdapter();
		logger = createMockLogger();
	});

	afterEach(async () => {
		try { await mod.stopMeanReversion(); } catch { /* already stopped */ }
	});

	it('should self-complete with no-book when cache has no order book', async () => {
		const cache = createMockCache({ orderBook: null, trades: [] });

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), false);
		const doneLog = logger.logs.find(l => l.message?.includes('complete'));
		assert.ok(doneLog, 'Should log completion');
	});

	it('should self-complete with no-data when too few trades', async () => {
		const cache = createMockCache({
			orderBook: { midPrice: 0.2000 },
			trades: [
				{ price: 0.200, amountBase: 100, type: 'buy', timestamp: new Date().toISOString() },
			],
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), false);
	});

	it('should self-complete with no-opportunity when move is too small', async () => {
		const mean = 0.2000;
		const midPrice = 0.2001; // 0.05% move — below 0.9% trigger
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), false);
		const noOpLog = logger.logs.find(l => l.message?.includes('no opportunity'));
		assert.ok(noOpLog, 'Should log no-opportunity');
	});

	it('should place 3 counter-orders when move exceeds trigger (upward move → sell orders)', async () => {
		const mean = 0.2000;
		const midPrice = 0.2020; // 1% move up — above 0.9% trigger
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), true);
		assert.equal(adapter.placed.length, 3, 'Should place 3 counter-orders');

		// All should be sell orders (counter to upward move)
		for (const order of adapter.placed) {
			assert.equal(order.side, 'sell');
		}

		// Inverted pyramid: sizes should increase (L0: 2, L1: 4, L2: 6)
		const sizes = adapter.placed.map(o => +(o.amount * o.price).toFixed(1));
		assert.ok(sizes[0] < sizes[1], `L0 (${sizes[0]}) < L1 (${sizes[1]})`);
		assert.ok(sizes[1] < sizes[2], `L1 (${sizes[1]}) < L2 (${sizes[2]})`);

		await mod.stopMeanReversion();
	});

	it('should place buy orders when move is downward', async () => {
		const mean = 0.2000;
		const midPrice = 0.1980; // 1% move down
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), true);
		assert.equal(adapter.placed.length, 3);
		for (const order of adapter.placed) {
			assert.equal(order.side, 'buy');
		}

		await mod.stopMeanReversion();
	});

	it('should snap-back exit when price returns toward mean', async () => {
		const mean = 0.2000;
		const midPrice = 0.2020; // 1% up
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), true);

		// Simulate price snapping back to near the mean
		// Original distance = 1% (0.01), targetSnapbackPercent = 0.6%,
		// so price needs to recover 0.6% toward mean:
		// recovered = |originalDist| - |newDist| >= 0.006
		// price at 0.2006 → newDist = 0.0030 → recovered = 0.0100 - 0.0030 = 0.0070 = 0.70% ≥ 0.6%
		await mod.onMeanReversionTradeEvent({ price: 0.2006, type: 'sell' });

		assert.equal(mod.isMeanReversionRunning(), false, 'Should have self-completed on snap-back');
		const snapLog = logger.logs.find(l => l.message?.includes('SNAPBACK'));
		assert.ok(snapLog, 'Should log snap-back');
	});

	it('should NOT snap-back exit when price recovery is insufficient', async () => {
		const mean = 0.2000;
		const midPrice = 0.2020;
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), true);

		// Price at 0.2018: recovered only 0.10% — below 0.6% threshold
		await mod.onMeanReversionTradeEvent({ price: 0.2018, type: 'sell' });
		assert.equal(mod.isMeanReversionRunning(), true, 'Should still be running — not enough recovery');

		await mod.stopMeanReversion();
	});

	it('should timeout and self-complete', async () => {
		const mean = 0.2000;
		const midPrice = 0.2020;
		const shortConfig = { ...baseConfig, maxDurationSeconds: 1 };
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: shortConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), true);

		// Wait for timeout
		await new Promise((r) => setTimeout(r, 1500));

		assert.equal(mod.isMeanReversionRunning(), false, 'Should have self-completed on timeout');
		const timeoutLog = logger.logs.find(l => l.message?.includes('TIMEOUT'));
		assert.ok(timeoutLog, 'Should log timeout');
	});

	it('should cancel all orders on stop', async () => {
		const mean = 0.2000;
		const midPrice = 0.2020;
		const cache = createMockCache({
			orderBook: { midPrice },
			trades: recentTradesAtMean(mean),
		});

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(adapter.placed.length, 3);

		await mod.stopMeanReversion();

		assert.equal(adapter.cancelled.length, 3, 'Should cancel all 3 orders');
		assert.equal(mod.isMeanReversionRunning(), false);
	});

	it('should not start without adapter.operationsReady', async () => {
		const cache = createMockCache({
			orderBook: { midPrice: 0.2020 },
			trades: recentTradesAtMean(0.2000),
		});

		adapter.operationsReady = false;

		await mod.startMeanReversion({
			adapter,
			logger,
			config: baseConfig,
			cacheKey: 'steem:STEEM/SBD',
			updateStrategyStatus: cache.updateStrategyStatus,
			getSteemDexBotData: cache.getSteemDexBotData,
		});

		assert.equal(mod.isMeanReversionRunning(), false);
		assert.equal(adapter.placed.length, 0);
	});

	it('describe() should return correct metadata', () => {
		const desc = mod.describe();
		assert.equal(desc.name, 'mean-reversion');
		assert.ok(desc.description.length > 0);
		assert.ok(desc.version);
	});
});
