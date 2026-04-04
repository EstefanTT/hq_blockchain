// testing/strategies/defensivePause.test.js
// Tests for Defensive / Pause Mode — run with: node testing/strategies/defensivePause.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

// ─── Mock logger ─────────────────────────────────────────────

function createMockLogger() {
	const logs = [];
	const fn = (level) => (context, message, data) => logs.push({ level, context, message, data });
	return { info: fn('info'), warn: fn('warn'), error: fn('error'), analysis: fn('analysis'), logs };
}

// ─── Config ──────────────────────────────────────────────────

const baseConfig = {
	enabled: true,
	thinBookThreshold: 500,
	minRCPercent: 25,
};

// ─── Tests ───────────────────────────────────────────────────

describe('Defensive / Pause Mode', async () => {
	let mod;
	let logger;
	let strategyUpdates;

	beforeEach(async () => {
		mod = await import(`../../strategies/defensive-pause/index.js?t=${Date.now()}_${Math.random()}`);
		logger = createMockLogger();
		strategyUpdates = [];
	});

	afterEach(async () => {
		try { await mod.stopDefensivePause(); } catch { /* already stopped */ }
	});

	it('should enter defensive mode and log DEFENSIVE_ENTER', async () => {
		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'RC too low (15%)',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		assert.equal(mod.isDefensivePauseRunning(), true);

		const enterLog = logger.logs.find(l => l.message?.includes('DEFENSIVE_ENTER'));
		assert.ok(enterLog, 'Should log DEFENSIVE_ENTER');
		assert.ok(enterLog.data.reason.includes('RC too low'), 'Should include reason');
	});

	it('should exit defensive mode and log DEFENSIVE_EXIT with duration', async () => {
		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'Divergence too high',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		assert.equal(mod.isDefensivePauseRunning(), true);

		// Wait a tiny bit so duration > 0
		await new Promise(r => setTimeout(r, 50));
		await mod.stopDefensivePause();

		assert.equal(mod.isDefensivePauseRunning(), false);

		const exitLog = logger.logs.find(l => l.message?.includes('DEFENSIVE_EXIT'));
		assert.ok(exitLog, 'Should log DEFENSIVE_EXIT');
		assert.ok(exitLog.data.durationSec >= 0, 'Should include duration');
	});

	it('should not place any orders (no adapter interaction)', async () => {
		// Defensive mode takes no adapter — it never places orders
		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'No market data',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		assert.equal(mod.isDefensivePauseRunning(), true);
		// No adapter means no orders can ever be placed — that's the point
	});

	it('should push strategy status on enter and exit', async () => {
		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'Book too thin',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		assert.ok(strategyUpdates.length >= 1, 'Should push status on enter');
		const enterStatus = strategyUpdates[strategyUpdates.length - 1];
		assert.equal(enterStatus.name, 'defensive-pause');
		assert.equal(enterStatus.active, true);
		assert.equal(enterStatus.buyOrders, 0);
		assert.equal(enterStatus.sellOrders, 0);
		assert.ok(enterStatus.detail.includes('Paused'), 'Detail should mention Paused');

		await mod.stopDefensivePause();

		const exitStatus = strategyUpdates[strategyUpdates.length - 1];
		assert.equal(exitStatus.active, false);
	});

	it('onDefensiveTradeEvent should log trade observation', async () => {
		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'Testing',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		await mod.onDefensiveTradeEvent({ price: 0.2000, type: 'buy' });

		const observeLog = logger.logs.find(l => l.message?.includes('Trade observed'));
		assert.ok(observeLog, 'Should log trade observation while paused');
	});

	it('onDefensiveTradeEvent should be silent when not running', async () => {
		await mod.onDefensiveTradeEvent({ price: 0.2000, type: 'buy' });

		const observeLog = logger.logs.find(l => l.message?.includes('Trade observed'));
		assert.equal(observeLog, undefined, 'Should NOT log when defensive is not running');
	});

	it('should be idempotent — double start does nothing', async () => {
		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'First',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		const logCount = logger.logs.length;

		await mod.startDefensivePause({
			logger,
			config: baseConfig,
			reason: 'Second',
			updateStrategyStatus: (s) => strategyUpdates.push({ ...s }),
		});

		// No additional ENTER logged
		const enterLogs = logger.logs.filter(l => l.message?.includes('DEFENSIVE_ENTER'));
		assert.equal(enterLogs.length, 1, 'Should only enter once');
	});

	it('describe() should return correct metadata', () => {
		const desc = mod.describe();
		assert.equal(desc.name, 'defensive-pause');
		assert.ok(desc.description.length > 0);
		assert.ok(desc.version);
	});
});
