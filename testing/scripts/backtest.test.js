// testing/scripts/backtest.test.js
// Tests for the BacktestEngine class from scripts/analysis/backtest.js.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

describe('BacktestEngine', () => {
	let BacktestEngine, STRATEGIES;

	beforeEach(async () => {
		// Set up global.path so storage init doesn't crash on import
		const path = await import('path');
		const url = await import('url');
		const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
		global.path = global.path || {};
		global.path.data = global.path.data || path.resolve(__dirname, '../../data');
		global.path.root = global.path.root || path.resolve(__dirname, '../..');

		const mod = await import(`../../scripts/analysis/backtest.js?t=${Date.now()}`);
		BacktestEngine = mod.BacktestEngine;
		STRATEGIES = mod.STRATEGIES;
	});

	it('should start with 100 quote, 0 base', () => {
		const e = new BacktestEngine();
		assert.equal(e.quoteBalance, 100, 'starts with 100 quote');
		assert.equal(e.baseBalance, 0, 'starts with 0 base');
	});

	it('should execute a buy fill correctly', () => {
		const e = new BacktestEngine();
		const ok = e.fill(0, 'buy', 0.20, 10);
		assert.equal(ok, true, 'fill succeeds');
		assert.equal(e.baseBalance, 10, 'base balance increased');
		assert.equal(e.quoteBalance, 98, 'quote balance decreased by price*amount');
	});

	it('should reject buy when insufficient quote balance', () => {
		const e = new BacktestEngine();
		const ok = e.fill(0, 'buy', 0.20, 10000);
		assert.equal(ok, false, 'fill rejected');
		assert.equal(e.baseBalance, 0, 'base unchanged');
	});

	it('should execute a sell fill correctly', () => {
		const e = new BacktestEngine();
		e.fill(0, 'buy', 0.20, 50);  // buy 50 @ 0.20 = 10 quote
		const ok = e.fill(1, 'sell', 0.25, 20);
		assert.equal(ok, true, 'sell fill succeeds');
		assert.equal(e.baseBalance, 30, 'base reduced to 30');
	});

	it('should reject sell when insufficient base balance', () => {
		const e = new BacktestEngine();
		const ok = e.fill(0, 'sell', 0.20, 10);
		assert.equal(ok, false, 'sell rejected — no base');
	});

	it('should compute equity correctly', () => {
		const e = new BacktestEngine();
		e.fill(0, 'buy', 0.20, 50); // spent 10, have 90 quote + 50 base
		const eq = e.equity(0.20);
		assert.equal(eq, 100, 'equity equals initial at same price');
	});

	it('should track max drawdown', () => {
		const e = new BacktestEngine();
		e.fill(0, 'buy', 0.20, 100);  // spent 20 quote, have 80q + 100b
		e.updateDrawdown(0.20);         // equity = 100, peak = 100
		e.updateDrawdown(0.10);         // equity = 80 + 10 = 90, dd = 10%
		assert.ok(e.maxDrawdown > 0, 'drawdown tracked');
	});

	it('should calculate stats with PnL', () => {
		const e = new BacktestEngine();
		e.fill(0, 'buy', 0.20, 50);   // 90 quote, 50 base
		e.fill(1, 'sell', 0.22, 50);  // 90 + 11 = 101 quote, 0 base
		const s = e.stats(0.22);
		assert.ok(s.pnl > 0, 'positive PnL expected');
		assert.equal(s.totalTrades, 2, '2 trades');
		assert.equal(s.buys, 1, '1 buy');
		assert.equal(s.sells, 1, '1 sell');
	});

	it('should have all expected strategy simulators', () => {
		const expected = ['market-making', 'aggressive-sniping', 'grid-range', 'mean-reversion', 'defensive'];
		for (const name of expected) {
			assert.ok(STRATEGIES[name], `Strategy "${name}" exists`);
			assert.equal(typeof STRATEGIES[name], 'function', `Strategy "${name}" is a function`);
		}
	});

	it('should run defensive strategy without trades', () => {
		const e = new BacktestEngine();
		const snapshots = [
			{ midPrice: 0.20, timestamp: '2026-01-01T00:00:00Z' },
			{ midPrice: 0.21, timestamp: '2026-01-01T01:00:00Z' },
			{ midPrice: 0.19, timestamp: '2026-01-01T02:00:00Z' },
		];
		STRATEGIES['defensive'](e, snapshots, []);
		const s = e.stats(0.19);
		assert.equal(s.totalTrades, 0, 'defensive makes no trades');
		assert.equal(s.pnl, 0, 'no PnL change');
	});

	it('should run mean-reversion with enough snapshots', () => {
		const e = new BacktestEngine();
		const snapshots = [];
		for (let i = 0; i < 10; i++) {
			const price = 0.20 + (i % 2 === 0 ? -0.005 : 0.005);
			snapshots.push({ midPrice: price, timestamp: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z` });
		}
		STRATEGIES['mean-reversion'](e, snapshots);
		const s = e.stats(0.20);
		assert.ok(s.totalTrades >= 0, 'mean-reversion ran without error');
	});
});
