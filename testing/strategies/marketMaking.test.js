// testing/strategies/marketMaking.test.js
// Tests for the market-making strategy — run with: node testing/strategies/marketMaking.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ─── Mock adapter ────────────────────────────────────────────

function createMockAdapter(midPrice = 0.2000) {
	const placed = [];
	const cancelled = [];
	let nextOrderId = 2000;
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

		setMidPrice(p) { midPrice = p; },
		simulateFill(orderId) { openOrders.delete(orderId); },
	};
}

function createMockLogger() {
	const logs = [];
	const fn = (level) => (context, message, data) => logs.push({ level, context, message, data });
	return { info: fn('info'), warn: fn('warn'), error: fn('error'), analysis: fn('analysis'), logs };
}

const baseConfig = {
	enabled: true,
	spreadPercent: 0.5,
	orderSizeQuote: 3.0,
	refreshIntervalMs: 99999999, // don't auto-refresh during tests
	orderExpirationSec: 120,
	maxTotalExposureQuote: 10.0,
};

// ─── Tests ───────────────────────────────────────────────────

describe('Market-Making Strategy', async () => {
	let mod;
	let adapter;
	let logger;
	let statusUpdates;

	beforeEach(async () => {
		if (mod?.isMarketMakingRunning()) await mod.stopMarketMaking();

		const importPath = `../../strategies/market-making/index.js?t=${Date.now()}`;
		mod = await import(importPath);

		adapter = createMockAdapter(0.2000);
		logger = createMockLogger();
		statusUpdates = [];
	});

	it('should place 1 buy + 1 sell at correct spread distance', async () => {
		await mod.startMarketMaking({
			adapter,
			logger,
			config: baseConfig,
			updateStrategyStatus: (s) => statusUpdates.push({ ...s }),
		});

		// 1 buy + 1 sell = 2 orders
		assert.equal(adapter.placed.length, 2, `Expected 2 orders, got ${adapter.placed.length}`);

		const buys = adapter.placed.filter(o => o.side === 'buy');
		const sells = adapter.placed.filter(o => o.side === 'sell');
		assert.equal(buys.length, 1, 'Should have 1 buy order');
		assert.equal(sells.length, 1, 'Should have 1 sell order');

		// Verify bid/ask distances: spreadPercent=0.5 → halfSpread=0.25%
		// bid = 0.2000 * (1 - 0.0025) = 0.1995
		// ask = 0.2000 * (1 + 0.0025) = 0.2005
		const expectedBid = +(0.2000 * (1 - 0.005 / 2)).toFixed(6);
		const expectedAsk = +(0.2000 * (1 + 0.005 / 2)).toFixed(6);
		assert.equal(buys[0].price, expectedBid, `Buy price should be ${expectedBid}`);
		assert.equal(sells[0].price, expectedAsk, `Sell price should be ${expectedAsk}`);

		// Buy below mid, sell above mid
		assert.ok(buys[0].price < 0.2000, 'Buy price below mid');
		assert.ok(sells[0].price > 0.2000, 'Sell price above mid');

		// Expiration = 120s
		for (const o of adapter.placed) {
			assert.equal(o.expiration, 120, 'Orders should expire in 120s');
		}

		// Status update
		const last = statusUpdates[statusUpdates.length - 1];
		assert.equal(last.active, true);
		assert.equal(last.name, 'market-making');
		assert.equal(last.buyOrders, 1);
		assert.equal(last.sellOrders, 1);

		await mod.stopMarketMaking();
	});

	it('should detect fill and replace on the SAME side', async () => {
		await mod.startMarketMaking({
			adapter,
			logger,
			config: baseConfig,
			updateStrategyStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(adapter.placed.length, 2);

		// Simulate fill of the buy order
		const buyOrder = adapter.placed.find(o => o.side === 'buy');
		adapter.simulateFill(buyOrder.orderId);

		// Trade event at the buy price → triggers fill detection
		await mod.onMMTradeEvent({ price: buyOrder.price, amountBase: 15, type: 'sell' });

		// Should have replaced → total 3 orders placed
		assert.equal(adapter.placed.length, 3, `Expected 3 orders after replace, got ${adapter.placed.length}`);

		// The replacement is a buy (same side)
		const replacement = adapter.placed[2];
		assert.equal(replacement.side, 'buy', 'Replacement should be on buy side');

		// Check FILLED log
		const fillLog = logger.logs.find(l => l.message.includes('FILLED'));
		assert.ok(fillLog, 'Should log a fill event');

		await mod.stopMarketMaking();
	});

	it('should cancel all orders on stop', async () => {
		await mod.startMarketMaking({
			adapter,
			logger,
			config: baseConfig,
			updateStrategyStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(adapter.placed.length, 2);
		await mod.stopMarketMaking();

		assert.equal(adapter.cancelled.length, 2, `Expected 2 cancellations, got ${adapter.cancelled.length}`);
		assert.equal(mod.isMarketMakingRunning(), false);

		// Status should show inactive
		const last = statusUpdates[statusUpdates.length - 1];
		assert.equal(last.active, false);
	});

	it('should respect maxTotalExposureQuote cap', async () => {
		// orderSizeQuote=3 × 2 sides = 6 → cap at 5 blocks placement
		const capConfig = { ...baseConfig, maxTotalExposureQuote: 5.0 };

		await mod.startMarketMaking({
			adapter,
			logger,
			config: capConfig,
			updateStrategyStatus: (s) => statusUpdates.push({ ...s }),
		});

		// Exposure 6 > cap 5 → no orders placed
		assert.equal(adapter.placed.length, 0, 'Should not place orders exceeding cap');

		// Warn log
		const warnLog = logger.logs.find(l => l.level === 'warn' && l.message.includes('cap'));
		assert.ok(warnLog, 'Should log exposure cap warning');

		await mod.stopMarketMaking();
	});

	it('should not start without operations ready', async () => {
		adapter.operationsReady = false;

		await mod.startMarketMaking({
			adapter,
			logger,
			config: baseConfig,
			updateStrategyStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(mod.isMarketMakingRunning(), false);
		assert.equal(adapter.placed.length, 0);
	});

	it('should not rebuild orders if mid drift is small', async () => {
		await mod.startMarketMaking({
			adapter,
			logger,
			config: baseConfig,
			updateStrategyStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(adapter.placed.length, 2);

		// Tiny drift: 0.01% (threshold is spreadPercent/2 = 0.25%)
		adapter.setMidPrice(0.2000 * 1.0001);

		// Manually trigger a trade that doesn't overlap our orders → no fill detection
		await mod.onMMTradeEvent({ price: 0.18, amountBase: 1, type: 'buy' });

		// No new orders placed (just the initial 2)
		assert.equal(adapter.placed.length, 2, 'Should not re-quote on small drift');
		assert.equal(adapter.cancelled.length, 0, 'Should not cancel on small drift');

		await mod.stopMarketMaking();
	});
});
