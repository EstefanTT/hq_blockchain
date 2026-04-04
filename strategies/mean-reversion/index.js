// strategies/mean-reversion/index.js
// Mean-Reversion Mode — "snap-back" strategy.
// Detects a sharp short-term price move away from the recent mean, then places
// counter-orders (inverted pyramid) betting on a quick return. Self-completing:
// exits on snap-back, timeout, or no-opportunity — brain picks next mode.
//
// Never touches the micro-layer. Same lifecycle pattern as Aggressive Sniping.

// ─── Constants ───────────────────────────────────────────────

const NUM_LEVELS = 3;

// ─── State ───────────────────────────────────────────────────

let running = false;
let timeoutTimer = null;

/** @type {Map<number, { side: 'buy'|'sell', level: number, price: number, amount: number, sizeQuote: number }>} */
const activeOrders = new Map();

/** @type {{ mean: number, midAtTrigger: number, moveSide: 'up'|'down', movePercent: number } | null} */
let triggerInfo = null;

// Injected dependencies
let adapter = null;
let log = null;
let cfg = null;
let updateStatus = null;
let cacheKey = null;
let cacheGetter = null; // getSteemDexBotData

// ─── Public API ──────────────────────────────────────────────

/**
 * Start mean-reversion mode.
 * @param {Object} opts
 * @param {Object} opts.adapter              — chain adapter
 * @param {Object} opts.logger               — botLogger instance
 * @param {Object} opts.config               — meanReversion config block
 * @param {string} opts.cacheKey             — e.g. 'steem:STEEM/SBD'
 * @param {Function} opts.updateStrategyStatus — cache updater
 * @param {Function} opts.getSteemDexBotData   — cache getter
 */
export async function startMeanReversion(opts) {
	if (running) return;
	if (!opts.adapter?.operationsReady) {
		opts.logger?.warn('REVERT', '⚠️  Cannot start mean-reversion — operations not initialized');
		return;
	}

	adapter = opts.adapter;
	log = opts.logger;
	cfg = opts.config;
	cacheKey = opts.cacheKey;
	updateStatus = opts.updateStrategyStatus;
	cacheGetter = opts.getSteemDexBotData;

	running = true;
	activeOrders.clear();
	triggerInfo = null;

	_pushStatus('Evaluating opportunity…');
	log?.info('REVERT', '🔃 Mean-reversion mode starting…');

	// Check trigger and place counter-orders
	await _evaluate();

	// Arm timeout if we placed orders
	if (running && activeOrders.size > 0) {
		timeoutTimer = setTimeout(() => _onTimeout(), cfg.maxDurationSeconds * 1000);
	}
}

/**
 * Stop mean-reversion and cancel all orders.
 */
export async function stopMeanReversion() {
	if (!running && activeOrders.size === 0) return;
	running = false;

	if (timeoutTimer) {
		clearTimeout(timeoutTimer);
		timeoutTimer = null;
	}

	await _cancelAllOrders();
	triggerInfo = null;
	_pushStatus('Stopped');
	log?.info('REVERT', '✅ Mean-reversion stopped');
}

export function isMeanReversionRunning() { return running; }

/**
 * Called externally when a DEX trade is observed.
 * Checks for snap-back condition.
 */
export async function onMeanReversionTradeEvent(trade) {
	if (!running || !triggerInfo) return;

	// Check if price has snapped back toward the mean
	const snapbackTarget = cfg.targetSnapbackPercent / 100;
	const distanceFromMean = Math.abs(trade.price - triggerInfo.mean) / triggerInfo.mean;
	const originalDistance = Math.abs(triggerInfo.midAtTrigger - triggerInfo.mean) / triggerInfo.mean;

	// Snap-back = price moved back at least targetSnapbackPercent toward mean
	const recoveredDistance = originalDistance - distanceFromMean;
	if (recoveredDistance >= snapbackTarget) {
		log?.info('REVERT', `💰 REVERSION_SNAPBACK — price recovered ${(recoveredDistance * 100).toFixed(2)}%`, {
			eventType: 'REVERSION_SNAPBACK',
			tradePrice: trade.price,
			mean: triggerInfo.mean,
			recoveredPercent: +(recoveredDistance * 100).toFixed(2),
			originalMovePercent: triggerInfo.movePercent,
		});
		await _complete('snapback');
	}
}

export function describe() {
	return {
		name: 'mean-reversion',
		description: 'Snap-back — counter-trades sharp moves betting on return to mean',
		version: '1.0.0',
	};
}

// ─── Internal: Evaluate & Place ──────────────────────────────

async function _evaluate() {
	try {
		const data = cacheGetter();
		const book = data.orderBooks?.[cacheKey];
		const trades = data.recentTrades?.[cacheKey] || [];

		if (!book?.midPrice) {
			log?.warn('REVERT', '⚠️  No order book — aborting');
			_complete('no-book');
			return;
		}

		// Compute recent mean from trades in lookback window
		const lookbackMs = (cfg.lookbackMinutes || 30) * 60 * 1000;
		const cutoff = Date.now() - lookbackMs;
		const recentPrices = [];
		for (const t of trades) {
			const ts = new Date(t.timestamp + (t.timestamp.endsWith('Z') ? '' : 'Z')).getTime();
			if (ts >= cutoff) recentPrices.push(t.price);
		}

		if (recentPrices.length < 3) {
			log?.info('REVERT', '🔍 Too few recent trades for mean — exiting');
			_complete('no-data');
			return;
		}

		const mean = recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length;
		const mid = book.midPrice;
		const movePercent = ((mid - mean) / mean) * 100;
		const absMovePercent = Math.abs(movePercent);

		if (absMovePercent < cfg.triggerMovePercent) {
			log?.info('REVERT', `🔍 Move ${absMovePercent.toFixed(2)}% < trigger ${cfg.triggerMovePercent}% — no opportunity`);
			_complete('no-opportunity');
			return;
		}

		// Move detected — place counter-orders on opposite side
		const moveSide = movePercent > 0 ? 'up' : 'down';
		const counterSide = moveSide === 'up' ? 'sell' : 'buy';

		triggerInfo = {
			mean: +mean.toFixed(6),
			midAtTrigger: +mid.toFixed(6),
			moveSide,
			movePercent: +absMovePercent.toFixed(2),
		};

		log?.info('REVERT', `🔃 REVERSION_TRIGGERED ${moveSide.toUpperCase()} move ${absMovePercent.toFixed(2)}% from mean ${mean.toFixed(6)}`, {
			eventType: 'REVERSION_TRIGGERED',
			moveSide,
			movePercent: +absMovePercent.toFixed(2),
			mean: +mean.toFixed(6),
			midPrice: +mid.toFixed(6),
			counterSide,
		});

		// Place inverted pyramid: 3 levels between current price and mean
		const distanceToMean = Math.abs(mid - mean);
		const step = distanceToMean / NUM_LEVELS;

		for (let i = 0; i < NUM_LEVELS; i++) {
			const fraction = (i + 1) / NUM_LEVELS;
			const sizeQuote = cfg.baseSizeQuote * (i + 1);

			let price;
			if (counterSide === 'sell') {
				// Price moved up → sell between mid and mean (going down toward mean)
				price = mid - step * fraction;
			} else {
				// Price moved down → buy between mid and mean (going up toward mean)
				price = mid + step * fraction;
			}
			price = +price.toFixed(6);

			const amount = +(sizeQuote / price).toFixed(3);
			if (amount <= 0) continue;

			try {
				const result = await adapter.placeLimitOrder({
					side: counterSide,
					price,
					amount,
					expiration: cfg.orderExpirationSec || 120,
				});

				activeOrders.set(result.orderId, {
					side: counterSide,
					level: i,
					price,
					amount,
					sizeQuote: +sizeQuote.toFixed(4),
				});

				log?.info('REVERT', `📌 REVERSION_PLACED L${i} ${counterSide.toUpperCase()} ${amount} @ ${price}`, {
					eventType: 'REVERSION_PLACED',
					orderId: result.orderId,
					side: counterSide,
					level: i,
					price,
					amount,
					sizeQuote: +sizeQuote.toFixed(4),
				});
			} catch (err) {
				log?.warn('REVERT', `Failed to place L${i} ${counterSide}: ${err.message}`, {
					error: err.message, level: i, price,
				});
			}
		}

		if (activeOrders.size === 0) {
			log?.warn('REVERT', '⚠️  No orders placed — aborting');
			_complete('placement-failed');
			return;
		}

		_pushStatus(_buildDetailString());
	} catch (err) {
		log?.error('REVERT', `Evaluation failed: ${err.message}`, { error: err.message });
		_complete('error');
	}
}

// ─── Internal: Timeout ───────────────────────────────────────

async function _onTimeout() {
	if (!running) return;

	log?.info('REVERT', `⏱️ REVERSION_TIMEOUT — cancelling after ${cfg.maxDurationSeconds}s`, {
		eventType: 'REVERSION_TIMEOUT',
		durationSec: cfg.maxDurationSeconds,
		ordersActive: activeOrders.size,
	});

	await _complete('timeout');
}

// ─── Internal: Completion (self-terminate) ───────────────────

async function _complete(outcome) {
	running = false;

	if (timeoutTimer) {
		clearTimeout(timeoutTimer);
		timeoutTimer = null;
	}

	await _cancelAllOrders();
	triggerInfo = null;

	_pushStatus(`Done (${outcome})`);
	log?.info('REVERT', `🏁 Mean-reversion complete — ${outcome}`, { eventType: 'REVERSION_COMPLETE', outcome });
}

// ─── Internal: Cancel All ────────────────────────────────────

async function _cancelAllOrders() {
	for (const [orderId] of activeOrders) {
		try {
			await adapter.cancelOrder(orderId);
		} catch {
			// already filled or expired
		}
	}
	activeOrders.clear();
}

// ─── Internal: Status Push ───────────────────────────────────

function _buildDetailString() {
	if (!triggerInfo) return '🔃 Evaluating…';
	return `🔃 ${triggerInfo.moveSide.toUpperCase()} move ${triggerInfo.movePercent}% | ${activeOrders.size} counter-orders | target snap-back ${cfg.targetSnapbackPercent}%`;
}

function _pushStatus(detail) {
	if (!updateStatus) return;

	let totalQuote = 0;
	let buyCount = 0;
	let sellCount = 0;
	for (const order of activeOrders.values()) {
		totalQuote += order.sizeQuote;
		if (order.side === 'buy') buyCount++;
		else sellCount++;
	}

	updateStatus({
		name: 'mean-reversion',
		active: running,
		buyOrders: buyCount,
		sellOrders: sellCount,
		totalValueQuote: +totalQuote.toFixed(4),
		lastFillTime: null,
		lastMidPrice: triggerInfo?.midAtTrigger ?? null,
		detail: detail || null,
	});
}
