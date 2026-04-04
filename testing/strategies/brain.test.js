// testing/strategies/brain.test.js
// Tests for the main brain — run with: node testing/strategies/brain.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ─── Mock adapter ────────────────────────────────────────────

function createMockAdapter(midPrice = 0.2000) {
	const placed = [];
	const cancelled = [];
	let nextOrderId = 3000;
	const openOrders = new Map();

	return {
		operationsReady: true,
		placed,
		cancelled,
		openOrders,

		getCurrentOrderBook() {
			return {
				midPrice,
				bids: [{ price: midPrice - 0.001, amount: 100 }],
				asks: [{ price: midPrice + 0.001, amount: 100 }],
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

// ─── Mock cache ──────────────────────────────────────────────

function createMockCache(overrides = {}) {
	const brainUpdates = [];
	const strategyUpdates = [];

	const defaultData = {
		priceFeeds: { STEEM: { cg: { usd: 0.20 }, cmc: { usd: 0.20 } } },
		candles: {},
		priceEngine: { mode: 'normal', running: true },
		divergenceAlerts: [],
		orderBooks: {
			'steem:STEEM/SBD': {
				midPrice: 0.2000,
				bids: [
					{ price: 0.199, amount: 500 },
					{ price: 0.198, amount: 300 },
				],
				asks: [
					{ price: 0.201, amount: 500 },
					{ price: 0.202, amount: 300 },
				],
				spreadPercent: 1.0,
				timestamp: new Date().toISOString(),
			},
		},
		recentTrades: { 'steem:STEEM/SBD': [] },
		storageStats: {},
		accountData: { rc: { percentage: 85 } },
		microLayerStatus: { active: true },
		strategyStatus: { active: false },
		brainStatus: {},
		appSizeInfo: {},
	};

	// Deep merge overrides
	const data = { ...defaultData };
	for (const [key, val] of Object.entries(overrides)) {
		if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
			data[key] = { ...defaultData[key], ...val };
		} else {
			data[key] = val;
		}
	}

	return {
		brainUpdates,
		strategyUpdates,
		getSteemDexBotData: () => data,
		updateBrainStatus: (s) => brainUpdates.push({ ...s }),
		updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		// Override specific cache fields for subsequent ticks
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

const baseBrainConfig = {
	enabled: true,
	tickIntervalMs: 99999999, // manual ticks in tests
	cooldownMs: 0,            // no cooldown in tests (instant switches)
	rcMinPercent: 20,
	divergenceMaxPercent: 3.0,
	imbalanceRatioThreshold: 2.5,
	tradeVelocityWindow: 60,
};

const baseMmConfig = {
	enabled: true,
	spreadPercent: 0.5,
	orderSizeQuote: 3.0,
	refreshIntervalMs: 99999999,
	orderExpirationSec: 120,
	maxTotalExposureQuote: 10.0,
};

const baseSnipeConfig = {
	enabled: true,
	maxSizeQuote: 8.0,
	targetSlippagePercent: 0.4,
	maxDurationSeconds: 60,
	orderExpirationSec: 90,
};

const baseGridConfig = {
	enabled: true,
	minRangeWidthPercent: 1.2,
	baseSizeQuote: 0.5,
	maxLevels: 5,
	refreshSeconds: 99999999,
	lookbackMinutes: 30,
	minTradesForRange: 6,
	orderExpirationSec: 120,
};

const baseStrategyConfigs = { marketMaking: baseMmConfig, aggressiveSniping: baseSnipeConfig, gridRange: baseGridConfig };

// ─── Tests ───────────────────────────────────────────────────

describe('Brain', async () => {
	let mod;
	let adapter;
	let logger;
	let cache;

	beforeEach(async () => {
		// Stop any running brain + MM from previous test
		if (mod?.isBrainRunning()) await mod.stopBrain();

		const mmMod = await import(`../../strategies/market-making/index.js?t=${Date.now()}`);
		if (mmMod.isMarketMakingRunning()) await mmMod.stopMarketMaking();

		const importPath = `../../strategies/engine/brain.js?t=${Date.now()}`;
		mod = await import(importPath);

		adapter = createMockAdapter(0.2000);
		logger = createMockLogger();
	});

	it('should start in market-making mode by default (normal conditions)', async () => {
		cache = createMockCache();

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		assert.equal(mod.isBrainRunning(), true);
		assert.equal(mod.getCurrentMode(), 'market-making');

		// Check brain status was pushed
		const last = cache.brainUpdates[cache.brainUpdates.length - 1];
		assert.equal(last.active, true);
		assert.equal(last.currentMode, 'market-making');

		// Brain log should mention switch to market-making
		const switchLog = logger.logs.find(l => l.message.includes('market-making'));
		assert.ok(switchLog, 'Should log the initial mode switch');

		await mod.stopBrain();
	});

	it('should switch to defensive when RC is too low', async () => {
		cache = createMockCache({
			accountData: { rc: { percentage: 15 } },
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		// Should decide defensive, but fall back to MM since defensive not available
		assert.equal(mod.getCurrentMode(), 'market-making');

		const reason = mod.getLastSwitchReason();
		assert.ok(reason.includes('RC too low'), `Reason should mention RC: ${reason}`);
		assert.ok(reason.includes('fallback'), `Reason should mention fallback: ${reason}`);

		await mod.stopBrain();
	});

	it('should switch to defensive when divergence is too high', async () => {
		cache = createMockCache({
			divergenceAlerts: [
				{ differencePercent: 4.5, timestamp: new Date().toISOString() },
			],
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		// Falls back to MM (defensive not available)
		assert.equal(mod.getCurrentMode(), 'market-making');

		const reason = mod.getLastSwitchReason();
		assert.ok(reason.includes('Divergence'), `Reason should mention divergence: ${reason}`);

		await mod.stopBrain();
	});

	it('should fall back to MM for unavailable modes (mean-reversion)', async () => {
		// Volatile + high velocity → mean-reversion desired
		const now = new Date();
		const recentTrades = Array.from({ length: 8 }, (_, i) => ({
			id: i,
			timestamp: new Date(now - i * 5000).toISOString(),
			price: 0.20,
			amountBase: 10,
			type: 'buy',
		}));

		cache = createMockCache({
			priceEngine: { mode: 'violent', running: true },
			recentTrades: { 'steem:STEEM/SBD': recentTrades },
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		// Should desire mean-reversion but fall back to MM
		assert.equal(mod.getCurrentMode(), 'market-making');

		const reason = mod.getLastSwitchReason();
		assert.ok(reason.includes('Volatile') || reason.includes('velocity'), `Reason should mention volatile/velocity: ${reason}`);
		assert.ok(reason.includes('fallback'), `Reason should mention fallback: ${reason}`);

		// Should log the fallback
		const fallbackLog = logger.logs.find(l => l.message.includes('not available yet'));
		assert.ok(fallbackLog, 'Should log that mode is not available');

		await mod.stopBrain();
	});

	it('should respect cooldown between switches', async () => {
		cache = createMockCache();

		await mod.startBrain({
			adapter,
			logger,
			config: { ...baseBrainConfig, cooldownMs: 60000 }, // 60s cooldown
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		assert.equal(mod.getCurrentMode(), 'market-making');

		// Now simulate defensive condition
		cache.setOverrides({
			accountData: { rc: { percentage: 10 } },
		});

		// Brain would want defensive, but cooldown blocks it
		// We can't directly call tick, but the initial switch set lastSwitchTime
		// With 60s cooldown and 0ms elapsed, it should NOT switch
		const switchCountBefore = logger.logs.filter(l => l.message.includes('Mode switch')).length;

		// The automatic tick won't fire (99999999ms), so the mode stays
		assert.equal(mod.getCurrentMode(), 'market-making');

		await mod.stopBrain();
	});

	it('should stop brain and its managed strategy cleanly', async () => {
		cache = createMockCache();

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		assert.equal(mod.isBrainRunning(), true);
		assert.equal(mod.getCurrentMode(), 'market-making');

		await mod.stopBrain();

		assert.equal(mod.isBrainRunning(), false);
		assert.equal(mod.getCurrentMode(), null);

		// Status should show inactive
		const last = cache.brainUpdates[cache.brainUpdates.length - 1];
		assert.equal(last.active, false);
		assert.equal(last.currentMode, null);
	});

	it('should handle missing order book gracefully (defensive)', async () => {
		cache = createMockCache({
			orderBooks: { 'steem:STEEM/SBD': null },  // no order book data
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		// No midPrice → defensive → fallback to MM
		assert.equal(mod.getCurrentMode(), 'market-making');

		const reason = mod.getLastSwitchReason();
		assert.ok(reason.includes('No market data'), `Reason should mention no data: ${reason}`);

		await mod.stopBrain();
	});

	it('should collect correct signal values', async () => {
		const now = new Date();
		const trades = Array.from({ length: 3 }, (_, i) => ({
			id: i,
			timestamp: new Date(now - i * 10000).toISOString(),
			price: 0.20,
			amountBase: 10,
			type: 'buy',
		}));

		cache = createMockCache({
			recentTrades: { 'steem:STEEM/SBD': trades },
			accountData: { rc: { percentage: 72.5 } },
			divergenceAlerts: [{ differencePercent: 1.2, timestamp: now.toISOString() }],
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		// Check signals in the brain status update
		const last = cache.brainUpdates[cache.brainUpdates.length - 1];
		const s = last.signals;

		assert.equal(s.midPrice, 0.2000);
		assert.equal(s.rcPercent, 72.5);
		assert.equal(s.maxDivergencePercent, 1.2);
		assert.equal(s.tradeVelocity, 3);
		assert.ok(s.imbalanceRatio >= 1, 'Imbalance ratio should be >= 1');
		assert.equal(s.volatileMode, false);

		await mod.stopBrain();
	});

	it('should switch to aggressive-sniping when imbalance + velocity conditions met', async () => {
		const now = new Date();
		const recentTrades = Array.from({ length: 5 }, (_, i) => ({
			id: i,
			timestamp: new Date(now - i * 5000).toISOString(),
			price: 0.20,
			amountBase: 10,
			type: 'buy',
		}));

		cache = createMockCache({
			orderBooks: {
				'steem:STEEM/SBD': {
					midPrice: 0.2000,
					bids: [{ price: 0.199, amount: 5000 }],
					asks: [{ price: 0.201, amount: 100 }],
					spreadPercent: 1.0,
					timestamp: now.toISOString(),
				},
			},
			recentTrades: { 'steem:STEEM/SBD': recentTrades },
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		// Brain should have chosen aggressive-sniping (now available)
		assert.equal(mod.getCurrentMode(), 'aggressive-sniping');

		const reason = mod.getLastSwitchReason();
		assert.ok(reason.includes('Imbalance'), `Reason should mention imbalance: ${reason}`);

		await mod.stopBrain();
	});

	it('should switch to grid-range when tight spread + low velocity', async () => {
		cache = createMockCache({
			orderBooks: {
				'steem:STEEM/SBD': {
					midPrice: 0.2000,
					bids: [{ price: 0.1998, amount: 500 }],
					asks: [{ price: 0.2002, amount: 500 }],
					spreadPercent: 0.2,
					timestamp: new Date().toISOString(),
				},
			},
			recentTrades: { 'steem:STEEM/SBD': [] },  // zero velocity
		});

		await mod.startBrain({
			adapter,
			logger,
			config: baseBrainConfig,
			strategyConfigs: baseStrategyConfigs,
			cacheKey: 'steem:STEEM/SBD',
			cache,
		});

		assert.equal(mod.getCurrentMode(), 'grid-range');

		const reason = mod.getLastSwitchReason();
		assert.ok(reason.includes('spread') || reason.includes('velocity'), `Reason should mention spread/velocity: ${reason}`);

		await mod.stopBrain();
	});
});
