// strategies/market-making/microLayer.js
// Inverted-pyramid micro market-making layer.
// Places tiny orders on both sides of the DEX mid-price at configurable distances.
// Generic — works with any chain adapter that exposes placeLimitOrder / cancelOrder / getOpenOrders / getCurrentOrderBook.

// ─── State ───────────────────────────────────────────────────

let running = false;
let refreshTimer = null;

/** @type {Map<number, { side: 'buy'|'sell', levelIdx: number, price: number, sizeQuote: number }>} */
const activeOrders = new Map();   // orderId → order meta

let lastMidPrice = null;          // mid-price the current grid is based on
let lastFillTime = null;

// Injected dependencies (set in start())
let adapter = null;   // chain adapter (placeLimitOrder, cancelOrder, getOpenOrders, getCurrentOrderBook)
let log = null;       // botLogger instance
let cfg = null;       // microLayer config block
let updateStatus = null;  // cache updater function

// ─── Public API ──────────────────────────────────────────────

/**
 * Start the micro layer.
 * @param {Object} opts
 * @param {Object} opts.adapter — chain adapter (must have operations initialized)
 * @param {Object} opts.logger — botLogger instance
 * @param {Object} opts.config — microLayer config block from config.json
 * @param {Function} opts.updateMicroLayerStatus — cache updater
 */
export async function startMicroLayer({ adapter: _adapter, logger, config, updateMicroLayerStatus }) {
	if (running) return;
	if (!_adapter?.operationsReady) {
		logger?.warn('MICRO', '⚠️  Cannot start micro layer — operations not initialized');
		return;
	}

	adapter = _adapter;
	log = logger;
	cfg = config;
	updateStatus = updateMicroLayerStatus;
	running = true;

	_pushStatus();
	log?.info('MICRO', '🔄 Micro layer starting...', {
		levels: cfg.levels.length,
		baseSizeQuote: cfg.baseSizeQuote,
		maxExposure: cfg.maxTotalExposureQuote,
	});

	// Initial grid placement
	await _refreshGrid();

	// Schedule recurring refresh
	refreshTimer = setInterval(() => _refreshGrid(), cfg.refreshIntervalMs);

	log?.info('MICRO', '✅ Micro layer active', { refreshMs: cfg.refreshIntervalMs });
}

/**
 * Stop the micro layer and cancel all active orders.
 */
export async function stopMicroLayer() {
	if (!running) return;
	running = false;

	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}

	log?.info('MICRO', '🛑 Stopping micro layer — cancelling all micro orders');
	await _cancelAllOrders();
	_pushStatus();
	log?.info('MICRO', '✅ Micro layer stopped');
}

/**
 * Check if the micro layer is currently running.
 */
export function isMicroLayerRunning() { return running; }

/**
 * Called externally when a new DEX trade is detected.
 * Fast-checks if any of our orders may have been filled.
 */
export async function onTradeEvent(trade) {
	if (!running || activeOrders.size === 0) return;

	// Quick overlap check: does this trade's price touch any of our orders?
	let possibleFill = false;
	for (const [, meta] of activeOrders) {
		if (meta.side === 'buy' && trade.price <= meta.price) { possibleFill = true; break; }
		if (meta.side === 'sell' && trade.price >= meta.price) { possibleFill = true; break; }
	}
	if (!possibleFill) return;

	// Confirm fills by querying open orders
	await _detectFills();
}

// ─── Internal: Grid Management ───────────────────────────────

async function _refreshGrid() {
	if (!running) return;

	try {
		const book = adapter.getCurrentOrderBook();
		if (!book?.midPrice || book.midPrice <= 0) return;

		const mid = book.midPrice;

		// If we have an existing grid and mid hasn't drifted enough, just check for fills
		if (lastMidPrice !== null && activeOrders.size > 0) {
			const drift = Math.abs(mid - lastMidPrice) / lastMidPrice;
			if (drift < cfg.midDriftThreshold) {
				await _detectFills();
				return;
			}
			// Mid drifted — cancel and rebuild
			log?.info('MICRO', `📐 Mid drifted ${(drift * 100).toFixed(3)}% — rebuilding grid`, {
				oldMid: lastMidPrice, newMid: mid, drift: +(drift * 100).toFixed(3),
			});
		}

		// Cancel stale orders and place new grid
		await _cancelAllOrders();
		await _placeGrid(mid);
	} catch (err) {
		log?.error('MICRO', `Grid refresh failed: ${err.message}`, { error: err.message });
	}
}

async function _placeGrid(mid) {
	lastMidPrice = mid;
	const levels = cfg.levels.slice(0, cfg.maxLevels);

	// Calculate total exposure to enforce cap
	let totalExposure = 0;
	const planned = [];

	for (let i = 0; i < levels.length; i++) {
		const level = levels[i];
		const sizeQuote = cfg.baseSizeQuote * level.sizeMultiplier;
		// Each level places one buy + one sell → 2 × sizeQuote
		if (totalExposure + sizeQuote * 2 > cfg.maxTotalExposureQuote) break;
		totalExposure += sizeQuote * 2;

		const buyPrice = +(mid * (1 - level.distancePercent / 100)).toFixed(6);
		const sellPrice = +(mid * (1 + level.distancePercent / 100)).toFixed(6);

		if (buyPrice <= 0 || sellPrice <= 0) continue;

		planned.push({ levelIdx: i, side: 'buy', price: buyPrice, sizeQuote });
		planned.push({ levelIdx: i, side: 'sell', price: sellPrice, sizeQuote });
	}

	// Place all orders
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
				levelIdx: p.levelIdx,
				price: p.price,
				sizeQuote: p.sizeQuote,
			});

			log?.info('MICRO', `📌 L${p.levelIdx} ${p.side.toUpperCase()} ${amount} @ ${p.price}`, {
				orderId: result.orderId, side: p.side, level: p.levelIdx, price: p.price, amount, sizeQuote: p.sizeQuote,
			});
		} catch (err) {
			log?.warn('MICRO', `Failed to place L${p.levelIdx} ${p.side}: ${err.message}`, {
				level: p.levelIdx, side: p.side, error: err.message,
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

			log?.info('MICRO', `💰 FILLED L${meta.levelIdx} ${meta.side.toUpperCase()} @ ${meta.price}`, {
				orderId, side: meta.side, level: meta.levelIdx, price: meta.price, sizeQuote: meta.sizeQuote,
			});

			// Replace the filled order at the same level
			await _replaceOrder(meta);
		}

		if (filledEntries.length > 0) _pushStatus();
	} catch (err) {
		log?.warn('MICRO', `Fill detection failed: ${err.message}`, { error: err.message });
	}
}

async function _replaceOrder(meta) {
	if (!running || !lastMidPrice) return;

	const level = cfg.levels[meta.levelIdx];
	if (!level) return;

	const price = meta.side === 'buy'
		? +(lastMidPrice * (1 - level.distancePercent / 100)).toFixed(6)
		: +(lastMidPrice * (1 + level.distancePercent / 100)).toFixed(6);

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
			levelIdx: meta.levelIdx,
			price,
			sizeQuote: meta.sizeQuote,
		});

		log?.info('MICRO', `🔁 Replaced L${meta.levelIdx} ${meta.side.toUpperCase()} ${amount} @ ${price}`, {
			orderId: result.orderId, side: meta.side, level: meta.levelIdx, price, amount,
		});
	} catch (err) {
		log?.warn('MICRO', `Replace failed L${meta.levelIdx} ${meta.side}: ${err.message}`, {
			level: meta.levelIdx, side: meta.side, error: err.message,
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
			// Order may have expired or been filled — silently remove
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
		active: running,
		buyOrders,
		sellOrders,
		totalValueQuote: +totalValueQuote.toFixed(4),
		lastFillTime,
		lastMidPrice,
		levelsConfigured: cfg?.levels?.length ?? 0,
	});
}

// ─── Exports for testing ─────────────────────────────────────

export { activeOrders as _activeOrders, lastFillTime as _lastFillTime };
