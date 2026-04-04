// strategies/market-making/index.js
// Market-Making Mode — tight bid/ask around DEX mid-price to earn the spread.
// Self-managed lifecycle (internal timer + onTradeEvent hook), same pattern as microLayer.
// Never touches micro-layer orders — each strategy tracks its own IDs.

// ─── State ───────────────────────────────────────────────────

let running = false;
let refreshTimer = null;

/** @type {Map<number, { side: 'buy'|'sell', price: number, sizeQuote: number }>} */
const activeOrders = new Map();

let lastMidPrice = null;
let lastFillTime = null;

// Injected dependencies
let adapter = null;
let log = null;
let cfg = null;
let updateStatus = null;

// ─── Public API ──────────────────────────────────────────────

/**
 * Start market-making mode.
 * @param {Object} opts
 * @param {Object} opts.adapter — chain adapter (must have operationsReady)
 * @param {Object} opts.logger — botLogger instance
 * @param {Object} opts.config — marketMaking config block
 * @param {Function} opts.updateStrategyStatus — cache updater
 */
export async function startMarketMaking({ adapter: _adapter, logger, config, updateStrategyStatus }) {
	if (running) return;
	if (!_adapter?.operationsReady) {
		logger?.warn('MM', '⚠️  Cannot start market-making — operations not initialized');
		return;
	}

	adapter = _adapter;
	log = logger;
	cfg = config;
	updateStatus = updateStrategyStatus;
	running = true;

	_pushStatus();
	log?.info('MM', '🔄 Market-making mode starting...', {
		spreadPercent: cfg.spreadPercent,
		orderSizeQuote: cfg.orderSizeQuote,
		maxExposure: cfg.maxTotalExposureQuote,
	});

	// Initial order placement
	await _refreshOrders();

	// Periodic refresh
	refreshTimer = setInterval(() => _refreshOrders(), cfg.refreshIntervalMs);

	log?.info('MM', '✅ Market-making mode active', { refreshMs: cfg.refreshIntervalMs });
}

/**
 * Stop market-making and cancel all MM orders.
 */
export async function stopMarketMaking() {
	if (!running) return;
	running = false;

	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}

	log?.info('MM', '🛑 Stopping market-making — cancelling all MM orders');
	await _cancelAllOrders();
	_pushStatus();
	log?.info('MM', '✅ Market-making stopped');
}

export function isMarketMakingRunning() { return running; }

/**
 * Called externally when a DEX trade is detected.
 * Checks if any of our MM orders were filled.
 */
export async function onMMTradeEvent(trade) {
	if (!running || activeOrders.size === 0) return;

	// Quick overlap check
	let possibleFill = false;
	for (const [, meta] of activeOrders) {
		if (meta.side === 'buy' && trade.price <= meta.price) { possibleFill = true; break; }
		if (meta.side === 'sell' && trade.price >= meta.price) { possibleFill = true; break; }
	}
	if (!possibleFill) return;

	await _detectFills();
}

export function describe() {
	return {
		name: 'market-making',
		description: 'Tight bid/ask around mid-price — earn the spread',
		version: '1.0.0',
	};
}

// ─── Internal: Order Management ──────────────────────────────

async function _refreshOrders() {
	if (!running) return;

	try {
		const book = adapter.getCurrentOrderBook();
		if (!book?.midPrice || book.midPrice <= 0) return;

		const mid = book.midPrice;

		// If orders exist and mid hasn't drifted much, just check fills
		if (lastMidPrice !== null && activeOrders.size > 0) {
			const drift = Math.abs(mid - lastMidPrice) / lastMidPrice;
			// Rebuild if spread moved more than half the configured spread
			const driftThreshold = (cfg.spreadPercent / 100) / 2;
			if (drift < driftThreshold) {
				await _detectFills();
				return;
			}
			log?.info('MM', `📐 Mid drifted ${(drift * 100).toFixed(3)}% — re-quoting`, {
				oldMid: lastMidPrice, newMid: mid, drift: +(drift * 100).toFixed(3),
			});
		}

		// Cancel stale and place fresh
		await _cancelAllOrders();
		await _placeOrders(mid);
	} catch (err) {
		log?.error('MM', `Order refresh failed: ${err.message}`, { error: err.message });
	}
}

async function _placeOrders(mid) {
	lastMidPrice = mid;

	const halfSpread = cfg.spreadPercent / 100 / 2;
	const bidPrice = +(mid * (1 - halfSpread)).toFixed(6);
	const askPrice = +(mid * (1 + halfSpread)).toFixed(6);

	if (bidPrice <= 0 || askPrice <= 0) return;

	// Enforce exposure cap: each side = orderSizeQuote, total = 2 × orderSizeQuote
	const totalExposure = cfg.orderSizeQuote * 2;
	if (totalExposure > cfg.maxTotalExposureQuote) {
		log?.warn('MM', `Exposure ${totalExposure} SBD exceeds cap ${cfg.maxTotalExposureQuote} — skipping`, {
			total: totalExposure, cap: cfg.maxTotalExposureQuote,
		});
		return;
	}

	const planned = [
		{ side: 'buy', price: bidPrice, sizeQuote: cfg.orderSizeQuote },
		{ side: 'sell', price: askPrice, sizeQuote: cfg.orderSizeQuote },
	];

	for (const p of planned) {
		try {
			const amount = +(p.sizeQuote / p.price).toFixed(3);
			if (amount <= 0) continue;

			const result = await adapter.placeLimitOrder({
				side: p.side,
				price: p.price,
				amount,
				expiration: cfg.orderExpirationSec,
			});

			activeOrders.set(result.orderId, {
				side: p.side,
				price: p.price,
				sizeQuote: p.sizeQuote,
			});

			log?.info('MM', `📌 ${p.side.toUpperCase()} ${amount} @ ${p.price}`, {
				orderId: result.orderId, side: p.side, price: p.price, amount, sizeQuote: p.sizeQuote,
			});
		} catch (err) {
			log?.warn('MM', `Failed to place ${p.side}: ${err.message}`, {
				side: p.side, error: err.message,
			});
		}
	}

	_pushStatus();
}

// ─── Internal: Fill Detection ────────────────────────────────

async function _detectFills() {
	if (!running || activeOrders.size === 0) return;

	try {
		const openOrders = await adapter.getOpenOrders();
		const openIds = new Set(openOrders.map(o => o.orderId));

		const filledEntries = [];
		for (const [orderId, meta] of activeOrders) {
			if (!openIds.has(orderId)) {
				filledEntries.push([orderId, meta]);
			}
		}

		for (const [orderId, meta] of filledEntries) {
			activeOrders.delete(orderId);
			lastFillTime = new Date().toISOString();

			log?.info('MM', `💰 FILLED ${meta.side.toUpperCase()} @ ${meta.price}`, {
				orderId, side: meta.side, price: meta.price, sizeQuote: meta.sizeQuote,
			});

			// Replace on the SAME side to stay balanced
			await _replaceSide(meta);
		}

		if (filledEntries.length > 0) _pushStatus();
	} catch (err) {
		log?.warn('MM', `Fill detection failed: ${err.message}`, { error: err.message });
	}
}

async function _replaceSide(meta) {
	if (!running || !lastMidPrice) return;

	const halfSpread = cfg.spreadPercent / 100 / 2;
	const price = meta.side === 'buy'
		? +(lastMidPrice * (1 - halfSpread)).toFixed(6)
		: +(lastMidPrice * (1 + halfSpread)).toFixed(6);

	if (price <= 0) return;

	const amount = +(meta.sizeQuote / price).toFixed(3);
	if (amount <= 0) return;

	try {
		const result = await adapter.placeLimitOrder({
			side: meta.side,
			price,
			amount,
			expiration: cfg.orderExpirationSec,
		});

		activeOrders.set(result.orderId, {
			side: meta.side,
			price,
			sizeQuote: meta.sizeQuote,
		});

		log?.info('MM', `🔁 Replaced ${meta.side.toUpperCase()} ${amount} @ ${price}`, {
			orderId: result.orderId, side: meta.side, price, amount,
		});
	} catch (err) {
		log?.warn('MM', `Replace failed ${meta.side}: ${err.message}`, {
			side: meta.side, error: err.message,
		});
	}
}

// ─── Internal: Order Cleanup ─────────────────────────────────

async function _cancelAllOrders() {
	const ids = [...activeOrders.keys()];
	for (const orderId of ids) {
		try {
			await adapter.cancelOrder(orderId);
		} catch {
			// Order may have expired or been filled
		}
		activeOrders.delete(orderId);
	}
}

// ─── Internal: Status Push ───────────────────────────────────

function _pushStatus() {
	if (!updateStatus) return;

	let buyOrders = 0;
	let sellOrders = 0;
	let totalValueQuote = 0;

	for (const [, meta] of activeOrders) {
		if (meta.side === 'buy') buyOrders++;
		else sellOrders++;
		totalValueQuote += meta.sizeQuote;
	}

	updateStatus({
		name: 'market-making',
		active: running,
		buyOrders,
		sellOrders,
		totalValueQuote: +totalValueQuote.toFixed(4),
		lastFillTime,
		lastMidPrice,
	});
}
