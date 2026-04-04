// testing/core/rebalance.test.js
// Tests for rebalance safety net — run with: node testing/core/rebalance.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

// ─── Helpers ─────────────────────────────────────────────────

function createMockLogger() {
	const logs = [];
	const fn = (level) => (context, message, data) => logs.push({ level, context, message, data });
	return { info: fn('info'), warn: fn('warn'), error: fn('error'), analysis: fn('analysis'), logs };
}

function makeRiskConfig(overrides = {}) {
	return {
		maxAllowedSlippagePercent: 0.3,
		minRCPercent: 25,
		rebalanceDeviationPercent: 1.0,
		rebalanceMaxPercent: 0.2,
		rebalanceLimitOffsetPercent: 0.05,
		...overrides,
	};
}

// ─── Tests ───────────────────────────────────────────────────

describe('Rebalance Safety Net', async () => {
	let mod;
	let logger;
	let riskUpdates;
	let placedOrders;
	let mockAdapter;
	let mockAccountData;
	let mockBook;

	beforeEach(async () => {
		// Fresh import to reset module state
		mod = await import(`../../core/risk/rebalance.js?t=${Date.now()}_${Math.random()}`);
		logger = createMockLogger();
		riskUpdates = [];
		placedOrders = [];

		mockAccountData = {
			balance: '500.000 STEEM',
			quoteBalance: '100.000 SBD',
		};

		mockBook = {
			bids: [{ price: 0.20, amount: 1000 }],
			asks: [{ price: 0.21, amount: 1000 }],
			midPrice: 0.205,
		};

		mockAdapter = {
			operationsReady: true,
			placeLimitOrder: async (params) => {
				placedOrders.push(params);
				return { orderId: `rebal-${placedOrders.length}` };
			},
			getOpenOrders: async () => [],
		};
	});

	afterEach(async () => {
		try { mod.resetRebalance(); } catch { /* ok */ }
	});

	it('should not rebalance when within threshold', async () => {
		const cacheKey = 'steem:STEEM/SBD';

		// 500 STEEM * 0.205 = 102.5 quote, quote = 100 → ratio ≈ 0.506 → dev ≈ 1.2%
		// Use threshold of 2% so it stays within bounds
		mod.initRebalance({
			adapter: mockAdapter,
			logger,
			config: makeRiskConfig({ rebalanceDeviationPercent: 2.0 }),
			cacheKey,
			getSteemDexBotData: () => ({
				accountData: mockAccountData,
				orderBooks: { [cacheKey]: mockBook },
			}),
			updateRiskStatus: (f) => riskUpdates.push(f),
		});

		await mod.checkAndRebalance();
		assert.equal(placedOrders.length, 0, 'Should not place order within threshold');
	});

	it('should trigger sell rebalance when base-heavy', async () => {
		const cacheKey = 'steem:STEEM/SBD';

		// 1000 STEEM * 0.205 = 205 quote, quote = 10 SBD → ratio ≈ 0.95 → dev ≈ 90%
		const heavyAccount = {
			balance: '1000.000 STEEM',
			quoteBalance: '10.000 SBD',
		};

		mod.initRebalance({
			adapter: mockAdapter,
			logger,
			config: makeRiskConfig(),
			cacheKey,
			getSteemDexBotData: () => ({
				accountData: heavyAccount,
				orderBooks: { [cacheKey]: mockBook },
			}),
			updateRiskStatus: (f) => riskUpdates.push(f),
		});

		await mod.checkAndRebalance();
		assert.equal(placedOrders.length, 1, 'Should place one rebalance order');
		assert.equal(placedOrders[0].side, 'sell', 'Should sell excess base');
		assert.ok(placedOrders[0].price > 0, 'Price should be positive');
		assert.ok(placedOrders[0].amount > 0, 'Amount should be positive');

		// Verify risk status was updated
		assert.equal(riskUpdates.length, 1);
		assert.equal(riskUpdates[0].lastRebalanceSide, 'sell');

		// Verify log
		const triggerLog = logger.logs.find(l => l.data?.eventType === 'REBALANCE_TRIGGERED');
		assert.ok(triggerLog, 'Should log REBALANCE_TRIGGERED');
	});

	it('should trigger buy rebalance when quote-heavy', async () => {
		const cacheKey = 'steem:STEEM/SBD';

		// 10 STEEM * 0.205 = 2.05 quote, quote = 200 SBD → ratio ≈ 0.01 → dev ≈ 98%
		const quoteHeavy = {
			balance: '10.000 STEEM',
			quoteBalance: '200.000 SBD',
		};

		mod.initRebalance({
			adapter: mockAdapter,
			logger,
			config: makeRiskConfig(),
			cacheKey,
			getSteemDexBotData: () => ({
				accountData: quoteHeavy,
				orderBooks: { [cacheKey]: mockBook },
			}),
			updateRiskStatus: (f) => riskUpdates.push(f),
		});

		await mod.checkAndRebalance();
		assert.equal(placedOrders.length, 1);
		assert.equal(placedOrders[0].side, 'buy', 'Should buy to rebalance');
	});

	it('should not double-rebalance while pending', async () => {
		const cacheKey = 'steem:STEEM/SBD';

		const heavyAccount = {
			balance: '1000.000 STEEM',
			quoteBalance: '10.000 SBD',
		};

		mod.initRebalance({
			adapter: mockAdapter,
			logger,
			config: makeRiskConfig(),
			cacheKey,
			getSteemDexBotData: () => ({
				accountData: heavyAccount,
				orderBooks: { [cacheKey]: mockBook },
			}),
			updateRiskStatus: (f) => riskUpdates.push(f),
		});

		await mod.checkAndRebalance();
		assert.equal(placedOrders.length, 1);

		// Second call should no-op because pendingRebalanceId is set
		await mod.checkAndRebalance();
		assert.equal(placedOrders.length, 1, 'Should not place duplicate rebalance');
	});

	it('should clear pending after fill and check again', async () => {
		const cacheKey = 'steem:STEEM/SBD';

		const heavyAccount = {
			balance: '1000.000 STEEM',
			quoteBalance: '10.000 SBD',
		};

		// Mock: getOpenOrders returns empty → order is "filled"
		mockAdapter.getOpenOrders = async () => [];

		mod.initRebalance({
			adapter: mockAdapter,
			logger,
			config: makeRiskConfig(),
			cacheKey,
			getSteemDexBotData: () => ({
				accountData: heavyAccount,
				orderBooks: { [cacheKey]: mockBook },
			}),
			updateRiskStatus: (f) => riskUpdates.push(f),
		});

		await mod.checkAndRebalance();
		assert.equal(placedOrders.length, 1);

		// Simulate trade event → clears pending + checks again
		await mod.onRebalanceTradeEvent({ type: 'buy', price: 0.205, amountBase: 100 });

		// Should have placed a second order because account is still imbalanced
		assert.equal(placedOrders.length, 2, 'Should rebalance again after fill');
	});

	it('should handle slippage guard rejection gracefully', async () => {
		const cacheKey = 'steem:STEEM/SBD';

		const heavyAccount = {
			balance: '1000.000 STEEM',
			quoteBalance: '10.000 SBD',
		};

		mockAdapter.placeLimitOrder = async () => ({ rejected: true, reason: 'slippage_too_high' });

		mod.initRebalance({
			adapter: mockAdapter,
			logger,
			config: makeRiskConfig(),
			cacheKey,
			getSteemDexBotData: () => ({
				accountData: heavyAccount,
				orderBooks: { [cacheKey]: mockBook },
			}),
			updateRiskStatus: (f) => riskUpdates.push(f),
		});

		await mod.checkAndRebalance();
		const rejectLog = logger.logs.find(l => l.data?.eventType === 'REBALANCE_REJECTED');
		assert.ok(rejectLog, 'Should log REBALANCE_REJECTED');

		// State should not be stuck — no pendingRebalanceId
		const state = mod.getRebalanceState();
		assert.equal(state.pendingRebalanceId, null, 'Should not set pending on rejection');
	});

	it('should skip when adapter not initialized', async () => {
		// Don't init — just call directly
		mod.resetRebalance();
		await mod.checkAndRebalance();
		// No error thrown, no orders placed
		assert.equal(placedOrders.length, 0);
	});
});
