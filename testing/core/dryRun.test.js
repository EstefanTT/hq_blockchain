// testing/core/dryRun.test.js
// Tests for the dry-run wrapper — run with: node testing/core/dryRun.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

describe('Dry-Run Wrapper', async () => {
	let mod;

	beforeEach(async () => {
		mod = await import(`../../core/execution/dryRun.js?t=${Date.now()}`);
		mod.setDryRun(false); // reset
	});

	it('setDryRun / isDryRunEnabled should toggle flag', () => {
		assert.equal(mod.isDryRunEnabled(), false);
		mod.setDryRun(true);
		assert.equal(mod.isDryRunEnabled(), true);
		mod.setDryRun(false);
		assert.equal(mod.isDryRunEnabled(), false);
	});

	it('should pass through to original when dry-run disabled', async () => {
		const placed = [];
		const cancelled = [];
		const adapter = {
			placeLimitOrder: async (params) => { placed.push(params); return { orderId: 1, txId: 'real' }; },
			cancelOrder: async (id) => { cancelled.push(id); return { orderId: id, txId: 'real' }; },
		};

		const logs = [];
		const logger = { info: (_ctx, msg, data) => logs.push({ msg, data }) };

		const { wrappedPlace, wrappedCancel } = mod.createDryRunWrapper(adapter, logger);

		const placeResult = await wrappedPlace({ side: 'buy', price: 0.20, amount: 100 });
		assert.equal(placeResult.orderId, 1);
		assert.equal(placed.length, 1);

		const cancelResult = await wrappedCancel(42);
		assert.equal(cancelResult.orderId, 42);
		assert.equal(cancelled.length, 1);

		// No dry-run logs
		assert.equal(logs.filter(l => l.msg.includes('DRY-RUN')).length, 0);
	});

	it('should intercept when dry-run enabled', async () => {
		mod.setDryRun(true);

		const placed = [];
		const cancelled = [];
		const adapter = {
			placeLimitOrder: async (params) => { placed.push(params); return { orderId: 99 }; },
			cancelOrder: async (id) => { cancelled.push(id); return { orderId: id }; },
		};

		const logs = [];
		const logger = { info: (_ctx, msg, data) => logs.push({ msg, data }) };

		const { wrappedPlace, wrappedCancel } = mod.createDryRunWrapper(adapter, logger);

		const placeResult = await wrappedPlace({ side: 'sell', price: 0.21, amount: 50, expiration: 120 });
		assert.equal(placeResult.dryRun, true);
		assert.ok(String(placeResult.orderId).startsWith('dry-'), 'orderId should be dry-prefixed');
		assert.equal(placed.length, 0, 'Original placeLimitOrder should NOT be called');

		const cancelResult = await wrappedCancel(7);
		assert.equal(cancelResult.dryRun, true);
		assert.equal(cancelled.length, 0, 'Original cancelOrder should NOT be called');

		// Should have logged
		assert.ok(logs.some(l => l.msg.includes('DRY-RUN') && l.msg.includes('sell')), 'Should log dry-run place');
		assert.ok(logs.some(l => l.msg.includes('DRY-RUN') && l.msg.includes('cancel')), 'Should log dry-run cancel');
	});

	it('should respond to runtime toggle mid-flight', async () => {
		const placed = [];
		const adapter = {
			placeLimitOrder: async (params) => { placed.push(params); return { orderId: 1 }; },
			cancelOrder: async () => ({}),
		};
		const logger = { info: () => {} };
		const { wrappedPlace } = mod.createDryRunWrapper(adapter, logger);

		// Start live
		await wrappedPlace({ side: 'buy', price: 0.20, amount: 10 });
		assert.equal(placed.length, 1, 'Should broadcast in live mode');

		// Toggle to dry-run
		mod.setDryRun(true);
		const res = await wrappedPlace({ side: 'buy', price: 0.20, amount: 10 });
		assert.equal(res.dryRun, true);
		assert.equal(placed.length, 1, 'Should NOT broadcast in dry-run mode');

		// Toggle back
		mod.setDryRun(false);
		await wrappedPlace({ side: 'buy', price: 0.20, amount: 10 });
		assert.equal(placed.length, 2, 'Should broadcast again in live mode');
	});

	it('should work without a logger', async () => {
		mod.setDryRun(true);

		const adapter = {
			placeLimitOrder: async () => ({ orderId: 1 }),
			cancelOrder: async () => ({}),
		};

		const { wrappedPlace, wrappedCancel } = mod.createDryRunWrapper(adapter, null);

		const res = await wrappedPlace({ side: 'buy', price: 0.20, amount: 10 });
		assert.equal(res.dryRun, true);

		const res2 = await wrappedCancel(5);
		assert.equal(res2.dryRun, true);
	});
});
