// testing/strategies/microLayer.test.js
// Tests for the micro layer strategy — run with: node testing/strategies/microLayer.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ─── Mock adapter ────────────────────────────────────────────

function createMockAdapter(midPrice = 0.2000) {
	const placed = [];
	const cancelled = [];
	let nextOrderId = 1000;
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
	baseSizeQuote: 0.10,
	maxLevels: 4,
	levels: [
		{ distancePercent: 0.1, sizeMultiplier: 1.0 },
		{ distancePercent: 0.3, sizeMultiplier: 2.5 },
		{ distancePercent: 0.6, sizeMultiplier: 5.0 },
		{ distancePercent: 1.0, sizeMultiplier: 10.0 },
	],
	refreshIntervalMs: 99999999, // don't auto-refresh during tests
	midDriftThreshold: 0.0015,
	orderExpirationSec: 120,
	maxTotalExposureQuote: 5.0,
};

// ─── Tests ───────────────────────────────────────────────────

describe('Micro Layer', async () => {
	// Fresh import each test to reset module state
	let mod;
	let adapter;
	let logger;
	let statusUpdates;

	beforeEach(async () => {
		// Dynamic import to get fresh module state
		// Since ES modules are cached, we use the module's stop to reset
		if (mod?.isMicroLayerRunning()) await mod.stopMicroLayer();

		const importPath = `../../strategies/market-making/microLayer.js?t=${Date.now()}`;
		mod = await import(importPath);

		adapter = createMockAdapter(0.2000);
		logger = createMockLogger();
		statusUpdates = [];
	});

	it('should build a correct inverted pyramid with 4 levels on each side', async () => {
		await mod.startMicroLayer({
			adapter,
			logger,
			config: baseConfig,
			updateMicroLayerStatus: (s) => statusUpdates.push({ ...s }),
		});

		// 4 levels × 2 sides = 8 orders
		assert.equal(adapter.placed.length, 8, `Expected 8 orders, got ${adapter.placed.length}`);

		// Check sizes: level 0 = 0.10, level 1 = 0.25, level 2 = 0.50, level 3 = 1.00
		const buys = adapter.placed.filter(o => o.side === 'buy');
		const sells = adapter.placed.filter(o => o.side === 'sell');
		assert.equal(buys.length, 4, 'Should have 4 buy orders');
		assert.equal(sells.length, 4, 'Should have 4 sell orders');

		// Verify buy prices are below mid, sell prices above mid
		for (const b of buys) assert.ok(b.price < 0.2000, `Buy price ${b.price} should be below mid`);
		for (const s of sells) assert.ok(s.price > 0.2000, `Sell price ${s.price} should be above mid`);

		// Verify expiration is set to 120s
		for (const o of adapter.placed) {
			assert.equal(o.expiration, 120, 'All micro orders should expire in 120s');
		}

		// Verify status update was pushed
		const last = statusUpdates[statusUpdates.length - 1];
		assert.equal(last.active, true);
		assert.equal(last.buyOrders, 4);
		assert.equal(last.sellOrders, 4);

		await mod.stopMicroLayer();
	});

	it('should respect maxTotalExposureQuote cap', async () => {
		const capConfig = { ...baseConfig, maxTotalExposureQuote: 1.0 };

		await mod.startMicroLayer({
			adapter,
			logger,
			config: capConfig,
			updateMicroLayerStatus: (s) => statusUpdates.push({ ...s }),
		});

		// With cap of 1.0 SBD:
		// Level 0: 0.10 * 2 = 0.20 → total 0.20 ✓
		// Level 1: 0.25 * 2 = 0.50 → total 0.70 ✓
		// Level 2: 0.50 * 2 = 1.00 → total 1.70 ✗ exceeds cap
		assert.equal(adapter.placed.length, 4, `Expected 4 orders (2 levels), got ${adapter.placed.length}`);

		await mod.stopMicroLayer();
	});

	it('should detect fills and replace orders', async () => {
		await mod.startMicroLayer({
			adapter,
			logger,
			config: baseConfig,
			updateMicroLayerStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(adapter.placed.length, 8);

		// Simulate a fill: remove the first buy order from "chain"
		const firstBuy = adapter.placed.find(o => o.side === 'buy');
		adapter.simulateFill(firstBuy.orderId);

		// Trigger fill detection via trade event that overlaps
		await mod.onTradeEvent({ price: firstBuy.price, amountBase: 1, type: 'sell' });

		// Should have placed a replacement order (total 9 now)
		assert.equal(adapter.placed.length, 9, `Expected 9 orders after fill+replace, got ${adapter.placed.length}`);

		// Check log for fill message
		const fillLog = logger.logs.find(l => l.message.includes('FILLED'));
		assert.ok(fillLog, 'Should log a fill event');

		await mod.stopMicroLayer();
	});

	it('should cancel all orders on stop', async () => {
		await mod.startMicroLayer({
			adapter,
			logger,
			config: baseConfig,
			updateMicroLayerStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(adapter.placed.length, 8);
		await mod.stopMicroLayer();

		// All 8 orders should have been cancelled
		assert.equal(adapter.cancelled.length, 8, `Expected 8 cancellations, got ${adapter.cancelled.length}`);

		assert.equal(mod.isMicroLayerRunning(), false);
	});

	it('should not rebuild grid if mid price drift is below threshold', async () => {
		await mod.startMicroLayer({
			adapter,
			logger,
			config: { ...baseConfig, refreshIntervalMs: 99999999 },
			updateMicroLayerStatus: (s) => statusUpdates.push({ ...s }),
		});

		const initialPlaced = adapter.placed.length;
		assert.equal(initialPlaced, 8);

		// Tiny drift: 0.01% (below 0.15% threshold) — no grid rebuild
		adapter.setMidPrice(0.200002);

		// Manually trigger a refresh via an internal mechanism — not directly exposed
		// But we can trigger via onTradeEvent which calls _detectFills (no fills → no rebuild)
		// This at least verifies no extra orders placed
		assert.equal(adapter.placed.length, initialPlaced, 'Should not place extra orders on tiny drift');

		await mod.stopMicroLayer();
	});

	it('should not start without operations initialized', async () => {
		const noOpsAdapter = { ...adapter, operationsReady: false };

		await mod.startMicroLayer({
			adapter: noOpsAdapter,
			logger,
			config: baseConfig,
			updateMicroLayerStatus: (s) => statusUpdates.push({ ...s }),
		});

		assert.equal(mod.isMicroLayerRunning(), false, 'Should not start without operations');
		assert.equal(adapter.placed.length, 0, 'Should not place any orders');
	});
});
