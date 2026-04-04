// strategies/grid-range/index.js
// Grid / Range Mode — "set-it-and-forget-it" sideways strategy.
// Detects a tight sideways range from recent DEX trades in cache, then places an
// inverted-pyramid ladder of limit orders inside that range (smallest near mid,
// biggest at the edges). When a grid order fills, an opposite-side counter-order
// is placed at the same distance from mid to stay neutral.
//
// Long-lived lifecycle (like Market-Making): stays active with its own refresh
// timer until the brain switches away. Never touches the micro-layer.

// ─── State ───────────────────────────────────────────────────

let running = false;
let refreshTimer = null;

/** @type {Map<number, { side: 'buy'|'sell', level: number, price: number, amount: number, sizeQuote: number }>} */
const activeOrders = new Map();

/** @type {{ support: number, resistance: number, mid: number } | null} */
let currentRange = null;

// Injected dependencies
let adapter = null;
let log = null;
let cfg = null;
let updateStatus = null;
let cacheKey = null;
let cacheGetter = null; // getSteemDexBotData

// ─── Public API ──────────────────────────────────────────────

/**
 * Start grid/range mode.
 * @param {Object} opts
 * @param {Object} opts.adapter              — chain adapter
 * @param {Object} opts.logger               — botLogger instance
 * @param {Object} opts.config               — gridRange config block
 * @param {string} opts.cacheKey             — e.g. 'steem:STEEM/SBD'
 * @param {Function} opts.updateStrategyStatus — cache updater
 * @param {Function} opts.getSteemDexBotData   — cache getter
 */
export async function startGridRange(opts) {
	if (running) return;
	if (!opts.adapter?.operationsReady) {
		opts.logger?.warn('GRID', '⚠️  Cannot start grid — operations not initialized');
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
	currentRange = null;

	_pushStatus('Starting…');
	log?.info('GRID', '📐 Grid/Range mode starting…', {
		maxLevels: cfg.maxLevels,
		baseSizeQuote: cfg.baseSizeQuote,
		refreshSeconds: cfg.refreshSeconds,
	});

	// Initial grid placement
	await _refresh();

	// Periodic refresh
	refreshTimer = setInterval(() => _refresh(), cfg.refreshSeconds * 1000);

	log?.info('GRID', '✅ Grid/Range mode active', { refreshSec: cfg.refreshSeconds });
}

/**
 * Stop grid/range mode and cancel all grid orders.
 */
export async function stopGridRange() {
	if (!running) return;
	running = false;

	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}

	log?.info('GRID', '🛑 Stopping grid — cancelling all grid orders');
	await _cancelAllOrders();
	currentRange = null;
	_pushStatus('Stopped');
	log?.info('GRID', '✅ Grid/Range stopped');
}

export function isGridRangeRunning() { return running; }

/**
 * Called externally when a DEX trade is observed.
 * Checks if any grid order was filled and places a counter-order.
 */
export async function onGridTradeEvent(trade) {
	if (!running || activeOrders.size === 0 || !currentRange) return;

	// Find matching grid order (price overlap check)
	let filledEntry = null;
	for (const [orderId, order] of activeOrders) {
		if (order.side === 'buy' && trade.price <= order.price) {
			filledEntry = [orderId, order];
			break;
		}
		if (order.side === 'sell' && trade.price >= order.price) {
			filledEntry = [orderId, order];
			break;
		}
	}

	if (!filledEntry) return;

	const [filledId, filledOrder] = filledEntry;

	// Verify it's actually gone from the book
	try {
		const openOrders = await adapter.getOpenOrders();
		const stillOpen = openOrders.some(o => o.orderId === filledId);
		if (stillOpen) return;
	} catch {
		return;
	}

	activeOrders.delete(filledId);
	log?.info('GRID', `💰 GRID_FILLED ${filledOrder.side.toUpperCase()} ${filledOrder.amount} @ ${filledOrder.price}`, {
		eventType: 'GRID_FILLED',
		orderId: filledId,
		side: filledOrder.side,
		price: filledOrder.price,
		amount: filledOrder.amount,
		level: filledOrder.level,
	});

	// Place counter-order on opposite side at same distance from mid
	await _placeCounterOrder(filledOrder);

	_pushStatus(_buildDetailString());
}

export function describe() {
	return {
		name: 'grid-range',
		description: 'Sideways ladder — inverted pyramid grid inside a detected range',
		version: '1.0.0',
	};
}

// ─── Internal: Refresh Cycle ─────────────────────────────────

async function _refresh() {
	if (!running) return;

	try {
		const range = _detectRange();

		if (!range) {
			// No clear range — cancel existing grid, wait for next refresh
			if (activeOrders.size > 0) {
				log?.info('GRID', '🔍 Range lost — cancelling grid orders');
				await _cancelAllOrders();
			}
			currentRange = null;
			_pushStatus('📐 No clear range — idle');
			return;
		}

		const rangeChanged = !currentRange
			|| Math.abs(range.support - currentRange.support) / currentRange.support > 0.002
			|| Math.abs(range.resistance - currentRange.resistance) / currentRange.resistance > 0.002;

		if (rangeChanged) {
			log?.info('GRID', `📐 GRID_RANGE_DETECTED ${range.support.toFixed(6)}–${range.resistance.toFixed(6)} (width ${range.widthPercent.toFixed(2)}%)`, {
				eventType: 'GRID_RANGE_DETECTED',
				support: range.support,
				resistance: range.resistance,
				mid: range.mid,
				widthPercent: range.widthPercent,
			});

			currentRange = range;

			// Full rebuild: cancel all, re-place
			await _cancelAllOrders();
			await _placeGrid(range);
		} else {
			// Same range — verify orders still alive, re-place missing ones
			await _repairGrid(range);
		}

		_pushStatus(_buildDetailString());
	} catch (err) {
		log?.error('GRID', `Refresh error: ${err.message}`, { error: err.message });
	}
}

// ─── Internal: Range Detection ───────────────────────────────

function _detectRange() {
	const data = cacheGetter();
	const trades = data.recentTrades?.[cacheKey] || [];
	const book = data.orderBooks?.[cacheKey];

	if (!book?.midPrice) return null;

	// Filter trades within lookback window
	const lookbackMs = (cfg.lookbackMinutes || 30) * 60 * 1000;
	const cutoff = Date.now() - lookbackMs;
	const recent = trades.filter(t => {
		const ts = new Date(t.timestamp + (t.timestamp.endsWith('Z') ? '' : 'Z')).getTime();
		return ts >= cutoff;
	});

	if (recent.length < (cfg.minTradesForRange || 6)) return null;

	// Support = min price, Resistance = max price from recent trades
	let minPrice = Infinity;
	let maxPrice = 0;
	for (const t of recent) {
		if (t.price < minPrice) minPrice = t.price;
		if (t.price > maxPrice) maxPrice = t.price;
	}

	if (minPrice <= 0 || maxPrice <= 0 || minPrice >= maxPrice) return null;

	const mid = (minPrice + maxPrice) / 2;
	const widthPercent = ((maxPrice - minPrice) / mid) * 100;

	if (widthPercent < cfg.minRangeWidthPercent) return null;

	return {
		support: +minPrice.toFixed(6),
		resistance: +maxPrice.toFixed(6),
		mid: +mid.toFixed(6),
		widthPercent: +widthPercent.toFixed(2),
	};
}

// ─── Internal: Grid Placement ────────────────────────────────

async function _placeGrid(range) {
	const levels = cfg.maxLevels;
	const halfRange = (range.resistance - range.support) / 2;
	const step = halfRange / levels;

	// Place buy levels below mid, sell levels above mid
	for (let i = 0; i < levels; i++) {
		const distance = step * (i + 1);
		const sizeQuote = cfg.baseSizeQuote * (i + 1);

		// Buy side: mid - distance
		const buyPrice = +(range.mid - distance).toFixed(6);
		if (buyPrice >= range.support) {
			await _placeGridOrder('buy', i, buyPrice, sizeQuote);
		}

		// Sell side: mid + distance
		const sellPrice = +(range.mid + distance).toFixed(6);
		if (sellPrice <= range.resistance) {
			await _placeGridOrder('sell', i, sellPrice, sizeQuote);
		}
	}
}

async function _placeGridOrder(side, level, price, sizeQuote) {
	const amount = +(sizeQuote / price).toFixed(3);
	if (amount <= 0) return;

	try {
		const result = await adapter.placeLimitOrder({
			side,
			price,
			amount,
			expiration: cfg.orderExpirationSec || 120,
		});

		activeOrders.set(result.orderId, {
			side,
			level,
			price,
			amount,
			sizeQuote: +sizeQuote.toFixed(4),
		});

		log?.info('GRID', `📌 GRID_PLACED L${level} ${side.toUpperCase()} ${amount} @ ${price}`, {
			eventType: 'GRID_PLACED',
			orderId: result.orderId,
			side,
			level,
			price,
			amount,
			sizeQuote: +sizeQuote.toFixed(4),
		});
	} catch (err) {
		log?.warn('GRID', `Failed to place grid L${level} ${side}: ${err.message}`, {
			error: err.message, side, level, price,
		});
	}
}

// ─── Internal: Counter-Order (opposite side on fill) ─────────

async function _placeCounterOrder(filledOrder) {
	if (!currentRange) return;

	const distance = Math.abs(filledOrder.price - currentRange.mid);
	const counterSide = filledOrder.side === 'buy' ? 'sell' : 'buy';
	const counterPrice = counterSide === 'buy'
		? +(currentRange.mid - distance).toFixed(6)
		: +(currentRange.mid + distance).toFixed(6);

	// Keep same size as the filled order
	await _placeGridOrder(counterSide, filledOrder.level, counterPrice, filledOrder.sizeQuote);

	log?.info('GRID', `🔄 GRID_COUNTER ${counterSide.toUpperCase()} @ ${counterPrice} (replacing filled ${filledOrder.side})`, {
		eventType: 'GRID_COUNTER',
		counterSide,
		counterPrice,
		filledSide: filledOrder.side,
		filledPrice: filledOrder.price,
		level: filledOrder.level,
	});
}

// ─── Internal: Repair (verify orders still alive) ────────────

async function _repairGrid(range) {
	try {
		const openOrders = await adapter.getOpenOrders();
		const openIds = new Set(openOrders.map(o => o.orderId));

		// Remove orders that disappeared (filled or expired without trade event)
		for (const [orderId] of activeOrders) {
			if (!openIds.has(orderId)) {
				const order = activeOrders.get(orderId);
				activeOrders.delete(orderId);
				log?.info('GRID', `🗑️ Grid order ${orderId} gone (L${order.level} ${order.side})`, {
					eventType: 'GRID_EXPIRED', orderId, side: order.side, level: order.level,
				});
			}
		}

		// Re-place missing levels
		const levels = cfg.maxLevels;
		const halfRange = (range.resistance - range.support) / 2;
		const step = halfRange / levels;

		for (let i = 0; i < levels; i++) {
			const distance = step * (i + 1);
			const sizeQuote = cfg.baseSizeQuote * (i + 1);

			// Check if buy level exists
			const hasBuy = [...activeOrders.values()].some(o => o.side === 'buy' && o.level === i);
			if (!hasBuy) {
				const buyPrice = +(range.mid - distance).toFixed(6);
				if (buyPrice >= range.support) {
					await _placeGridOrder('buy', i, buyPrice, sizeQuote);
				}
			}

			// Check if sell level exists
			const hasSell = [...activeOrders.values()].some(o => o.side === 'sell' && o.level === i);
			if (!hasSell) {
				const sellPrice = +(range.mid + distance).toFixed(6);
				if (sellPrice <= range.resistance) {
					await _placeGridOrder('sell', i, sellPrice, sizeQuote);
				}
			}
		}
	} catch (err) {
		log?.warn('GRID', `Repair error: ${err.message}`, { error: err.message });
	}
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
	if (!currentRange) return '📐 No clear range — idle';
	const buys = [...activeOrders.values()].filter(o => o.side === 'buy').length;
	const sells = [...activeOrders.values()].filter(o => o.side === 'sell').length;
	return `📐 Range ${currentRange.support.toFixed(4)}–${currentRange.resistance.toFixed(4)} | ${buys + sells} orders (${buys}B/${sells}S)`;
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
		name: 'grid-range',
		active: running,
		buyOrders: buyCount,
		sellOrders: sellCount,
		totalValueQuote: +totalQuote.toFixed(4),
		lastFillTime: null,
		lastMidPrice: currentRange?.mid ?? null,
		detail: detail || null,
	});
}
