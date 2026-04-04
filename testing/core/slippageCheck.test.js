// testing/core/slippageCheck.test.js
// Tests for slippage calculator + guard — run with: node testing/core/slippageCheck.test.js

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSlippage, createSlippageGuard } from '../../core/risk/slippageCheck.js';

// ─── Helpers ─────────────────────────────────────────────────

function makeBook({ bids = [], asks = [], midPrice } = {}) {
	return { bids, asks, midPrice };
}

function createMockLogger() {
	const logs = [];
	const fn = (level) => (context, message, data) => logs.push({ level, context, message, data });
	return { info: fn('info'), warn: fn('warn'), error: fn('error'), analysis: fn('analysis'), logs };
}

// ─── computeSlippage ─────────────────────────────────────────

describe('computeSlippage', () => {
	it('returns zero for resting buy below best ask', () => {
		const book = makeBook({
			asks: [{ price: 0.20, amount: 1000 }],
			bids: [{ price: 0.19, amount: 1000 }],
			midPrice: 0.195,
		});
		const result = computeSlippage(book, 'buy', 0.19, 100);
		assert.equal(result.slippagePercent, 0);
		assert.equal(result.wouldCross, false);
	});

	it('returns zero for resting sell above best bid', () => {
		const book = makeBook({
			asks: [{ price: 0.20, amount: 1000 }],
			bids: [{ price: 0.19, amount: 1000 }],
			midPrice: 0.195,
		});
		const result = computeSlippage(book, 'sell', 0.20, 100);
		assert.equal(result.slippagePercent, 0);
		assert.equal(result.wouldCross, false);
	});

	it('computes slippage for crossing buy order', () => {
		const book = makeBook({
			asks: [
				{ price: 0.20, amount: 500 },
				{ price: 0.21, amount: 500 },
			],
			bids: [{ price: 0.19, amount: 1000 }],
			midPrice: 0.195,
		});
		// Buy 800 @ 0.21 limit → fills 500 @ 0.20 + 300 @ 0.21
		const result = computeSlippage(book, 'buy', 0.21, 800);
		assert.equal(result.wouldCross, true);
		assert.ok(result.slippagePercent > 0, 'Should have positive slippage');
		// Effective avg = (500*0.20 + 300*0.21)/800 = 0.20375
		assert.ok(Math.abs(result.effectiveAvgPrice - 0.20375) < 0.001);
	});

	it('computes slippage for crossing sell order', () => {
		const book = makeBook({
			bids: [
				{ price: 0.19, amount: 500 },
				{ price: 0.18, amount: 500 },
			],
			asks: [{ price: 0.20, amount: 1000 }],
			midPrice: 0.195,
		});
		// Sell 700 @ 0.18 limit → fills 500 @ 0.19 + 200 @ 0.18
		const result = computeSlippage(book, 'sell', 0.18, 700);
		assert.equal(result.wouldCross, true);
		assert.ok(result.slippagePercent > 0);
	});

	it('returns zero slippage for empty book', () => {
		const result = computeSlippage(makeBook(), 'buy', 0.20, 100);
		assert.equal(result.slippagePercent, 0);
		assert.equal(result.wouldCross, false);
	});

	it('returns zero slippage for zero amount', () => {
		const book = makeBook({
			asks: [{ price: 0.20, amount: 1000 }],
			bids: [{ price: 0.19, amount: 1000 }],
			midPrice: 0.195,
		});
		const result = computeSlippage(book, 'buy', 0.20, 0);
		assert.equal(result.slippagePercent, 0);
	});
});

// ─── createSlippageGuard ─────────────────────────────────────

describe('createSlippageGuard', () => {
	it('passes through low-slippage orders', async () => {
		const placed = [];
		const adapter = {
			placeLimitOrder: async (p) => { placed.push(p); return { orderId: 'ok' }; },
			getCurrentOrderBook: () => makeBook({
				asks: [{ price: 0.20, amount: 10000 }],
				bids: [{ price: 0.19, amount: 10000 }],
				midPrice: 0.195,
			}),
		};

		const guard = createSlippageGuard(adapter, { maxAllowedSlippagePercent: 5.0 }, createMockLogger());

		const result = await guard({ side: 'buy', price: 0.20, amount: 100 });
		assert.equal(result.orderId, 'ok');
		assert.equal(placed.length, 1);
	});

	it('rejects high-slippage orders', async () => {
		const adapter = {
			placeLimitOrder: async () => ({ orderId: 'never' }),
			getCurrentOrderBook: () => makeBook({
				asks: [
					{ price: 0.20, amount: 10 },
					{ price: 0.30, amount: 100 },
				],
				bids: [{ price: 0.19, amount: 1000 }],
				midPrice: 0.195,
			}),
		};

		const logger = createMockLogger();
		const riskUpdates = [];
		const guard = createSlippageGuard(
			adapter,
			{ maxAllowedSlippagePercent: 0.3 },
			logger,
			(fields) => riskUpdates.push(fields),
		);

		// Buy 100 @ 0.30 → thin book, huge slippage
		const result = await guard({ side: 'buy', price: 0.30, amount: 100 });
		assert.equal(result.rejected, true);
		assert.equal(result.reason, 'slippage_too_high');
		assert.ok(riskUpdates.length === 1);
		assert.equal(riskUpdates[0].slippageRejectCount, 1);
	});

	it('passes through resting (non-crossing) orders unconditionally', async () => {
		const placed = [];
		const adapter = {
			placeLimitOrder: async (p) => { placed.push(p); return { orderId: 'resting' }; },
			getCurrentOrderBook: () => makeBook({
				asks: [{ price: 0.20, amount: 10 }],
				bids: [{ price: 0.19, amount: 10 }],
				midPrice: 0.195,
			}),
		};

		const guard = createSlippageGuard(adapter, { maxAllowedSlippagePercent: 0.01 }, createMockLogger());

		// Resting buy below best ask
		const result = await guard({ side: 'buy', price: 0.19, amount: 1000 });
		assert.equal(result.orderId, 'resting');
	});

	it('increments reject count across multiple rejections', async () => {
		const adapter = {
			placeLimitOrder: async () => ({ orderId: 'x' }),
			getCurrentOrderBook: () => makeBook({
				asks: [
					{ price: 0.20, amount: 5 },
					{ price: 0.40, amount: 1000 },
				],
				bids: [{ price: 0.19, amount: 1000 }],
				midPrice: 0.195,
			}),
		};

		const riskUpdates = [];
		const guard = createSlippageGuard(
			adapter,
			{ maxAllowedSlippagePercent: 0.1 },
			createMockLogger(),
			(fields) => riskUpdates.push(fields),
		);

		await guard({ side: 'buy', price: 0.40, amount: 100 });
		await guard({ side: 'buy', price: 0.40, amount: 100 });
		assert.equal(riskUpdates.length, 2);
		assert.equal(riskUpdates[1].slippageRejectCount, 2);
	});
});
