// strategies/defensive-pause/index.js
// Defensive / Pause Mode — the brain's safety-first emergency brake.
// When market conditions look sketchy (thin book, low RC, high divergence,
// no market data), the bot stops placing new orders and waits.
//
// Long-lived: the brain decides when to enter AND exit. The strategy does not
// self-complete — it stays running until the brain switches to another mode.
//
// Does NOT cancel other strategies' orders — the brain's _stopCurrentStrategy()
// already handles that before starting this mode.
//
// The permanent micro-layer continues independently (it's not managed by brain).

// ─── State ───────────────────────────────────────────────────

let running = false;
let enteredAt = null;
let entryReason = null;

// Injected dependencies
let log = null;
let updateStatus = null;

// ─── Public API ──────────────────────────────────────────────

/**
 * Start defensive/pause mode.
 * @param {Object} opts
 * @param {Object} opts.logger               — botLogger instance
 * @param {Object} opts.config               — defensivePause config block
 * @param {string} [opts.reason]             — why the brain entered defensive
 * @param {Function} opts.updateStrategyStatus — cache updater
 */
export async function startDefensivePause(opts) {
	if (running) return;

	log = opts.logger;
	updateStatus = opts.updateStrategyStatus;

	running = true;
	enteredAt = new Date().toISOString();
	entryReason = opts.reason || 'Safety override';

	log?.info('PAUSE', `⏸️ DEFENSIVE_ENTER — ${entryReason}`, {
		eventType: 'DEFENSIVE_ENTER',
		reason: entryReason,
		enteredAt,
	});

	_pushStatus();
}

/**
 * Stop defensive/pause mode (brain switches to another strategy).
 */
export async function stopDefensivePause() {
	if (!running) return;

	const duration = enteredAt
		? Math.round((Date.now() - new Date(enteredAt).getTime()) / 1000)
		: 0;

	log?.info('PAUSE', `▶️ DEFENSIVE_EXIT — held for ${duration}s`, {
		eventType: 'DEFENSIVE_EXIT',
		durationSec: duration,
		reason: entryReason,
	});

	running = false;
	enteredAt = null;
	entryReason = null;

	_pushStatus();
}

export function isDefensivePauseRunning() { return running; }

/**
 * Called externally when a DEX trade is observed.
 * Purely observational — logs the trade but takes no action.
 */
export async function onDefensiveTradeEvent(trade) {
	if (!running) return;

	log?.info('PAUSE', `👁️ Trade observed while paused: ${trade.type?.toUpperCase()} @ ${trade.price}`, {
		eventType: 'DEFENSIVE_TRADE_OBSERVED',
		price: trade.price,
		type: trade.type,
	});
}

export function describe() {
	return {
		name: 'defensive-pause',
		description: 'Safety brake — no new orders, hold position, wait for conditions to improve',
		version: '1.0.0',
	};
}

// ─── Internal: Status Push ───────────────────────────────────

function _pushStatus() {
	if (!updateStatus) return;

	const durationSec = running && enteredAt
		? Math.round((Date.now() - new Date(enteredAt).getTime()) / 1000)
		: 0;

	updateStatus({
		name: 'defensive-pause',
		active: running,
		buyOrders: 0,
		sellOrders: 0,
		totalValueQuote: 0,
		lastFillTime: null,
		lastMidPrice: null,
		detail: running
			? `⏸️ Paused — ${entryReason} (${durationSec}s)`
			: null,
	});
}
