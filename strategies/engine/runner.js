// strategies/engine/runner.js
// Runs a strategy instance — calls tick() on its configured interval.
// Wraps each tick with: risk checks (kill switch, limits), error handling, logging, timing.

import { isKilled } from '../../core/risk/killSwitch.js';

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Start running a strategy.
 * @param {object} strategy - Strategy module (must export tick, init, shutdown)
 * @param {object} config - Strategy-specific config (validated against config.schema.js)
 * @param {number} intervalMs - Tick interval in milliseconds
 */
export function runStrategy(strategy, config, intervalMs = 10000) {
	let timer = null;

	const tick = async () => {
		const { killed, killedReason } = isKilled();
		if (killed) {
			console.warn('STRAT', config.name, `Skipped tick — kill switch active: ${killedReason}`);
			return;
		}

		try {
			await strategy.tick(config);
		} catch (err) {
			console.error('STRAT', config.name, `Tick error: ${err.message}`);
		}
	};

	const start = async () => {
		console.info('STRAT', config.name, 'Starting');
		await strategy.init(config);
		timer = setInterval(tick, intervalMs);
	};

	const stop = async () => {
		if (timer) clearInterval(timer);
		await strategy.shutdown(config);
		console.info('STRAT', config.name, 'Stopped');
	};

	return { start, stop };
}
