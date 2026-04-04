// strategies/aggressive-sniping/index.js
// Aggressive Sniping Mode — fast & opportunistic.
// Places a single tight limit order on the cheap side when a clear imbalance is
// detected. Short-lived (10–60 s max). After fill or timeout → sets running=false
// and the brain picks the next mode on its next tick.
//
// Never touches the micro-layer. Size-controlled (never moves price >targetSlippage).
// Same lifecycle pattern as microLayer & Market-Making.

// ─── State ───────────────────────────────────────────────────

let running = false;
let timeoutTimer = null;

/** @type {{ orderId: number, side: 'buy'|'sell', price: number, amount: number, sizeQuote: number } | null} */
let activeSnipe = null;

// Injected dependencies
let adapter = null;
let log = null;
let cfg = null;
let updateStatus = null;
let cacheKey = null;
let cacheGetter = null; // getSteemDexBotData

// ─── Public API ──────────────────────────────────────────────

/**
 * Start sniping mode.
 * @param {Object} opts
 * @param {Object} opts.adapter         — chain adapter
 * @param {Object} opts.logger          — botLogger instance
 * @param {Object} opts.config          — aggressiveSniping config block
 * @param {string} opts.cacheKey        — e.g. 'steem:STEEM/SBD'
 * @param {Function} opts.updateStrategyStatus — cache updater
 * @param {Function} opts.getSteemDexBotData   — cache getter for signals
 */
export async function startAggressiveSniping(opts) {
	if (running) return;
	if (!opts.adapter?.operationsReady) {
		opts.logger?.warn('SNIPE', '⚠️  Cannot start sniping — operations not initialized');
		return;
	}

	adapter = opts.adapter;
	log = opts.logger;
	cfg = opts.config;
	cacheKey = opts.cacheKey;
	updateStatus = opts.updateStrategyStatus;
	cacheGetter = opts.getSteemDexBotData;

	running = true;
	activeSnipe = null;

	_pushStatus('Evaluating opportunity…');
	log?.info('SNIPE', '🎯 Sniping mode starting…');

	// Execute the snipe immediately
	await _executeSnipe();

	// If the order didn't fill instantly, arm the max-duration timeout
	if (running && activeSnipe) {
		timeoutTimer = setTimeout(() => _onTimeout(), cfg.maxDurationSeconds * 1000);
	}
}

/**
 * Stop sniping and clean up.
 */
export async function stopAggressiveSniping() {
	if (!running && !activeSnipe) return;
	running = false;

	if (timeoutTimer) {
		clearTimeout(timeoutTimer);
		timeoutTimer = null;
	}

	if (activeSnipe) {
		try {
			await adapter.cancelOrder(activeSnipe.orderId);
			log?.info('SNIPE', `🛑 Cancelled snipe order ${activeSnipe.orderId}`, {
				orderId: activeSnipe.orderId, side: activeSnipe.side,
			});
		} catch {
			// Already filled or expired
		}
		activeSnipe = null;
	}

	_pushStatus('Stopped');
	log?.info('SNIPE', '✅ Sniping stopped');
}

export function isAggressiveSnipingRunning() { return running; }

/**
 * Called externally when a DEX trade is observed.
 * Checks if our snipe order was filled.
 */
export async function onSnipeTradeEvent(trade) {
	if (!running || !activeSnipe) return;

	// Quick overlap check
	if (activeSnipe.side === 'buy' && trade.price > activeSnipe.price) return;
	if (activeSnipe.side === 'sell' && trade.price < activeSnipe.price) return;

	await _detectFill();
}

export function describe() {
	return {
		name: 'aggressive-sniping',
		description: 'Fast & opportunistic — snipes imbalances for quick profit',
		version: '1.0.0',
	};
}

// ─── Internal: Snipe Execution ───────────────────────────────

async function _executeSnipe() {
	try {
		const data = cacheGetter();
		const book = data.orderBooks?.[cacheKey];
		if (!book?.midPrice || !book.bids?.length || !book.asks?.length) {
			log?.warn('SNIPE', '⚠️  No order book — aborting snipe');
			_complete('no-book');
			return;
		}

		const mid = book.midPrice;
		const alerts = data.divergenceAlerts || [];

		// Determine snipe direction from signals
		const direction = _pickDirection(book, alerts);
		if (!direction) {
			log?.info('SNIPE', '🔍 No clear snipe opportunity — exiting');
			_complete('no-opportunity');
			return;
		}

		// Size: never exceed maxSizeQuote, never move price > targetSlippagePercent
		const { side, price, amount, sizeQuote } = _computeOrder(direction, book, mid);

		if (amount <= 0 || sizeQuote <= 0) {
			log?.warn('SNIPE', '⚠️  Computed size too small — aborting');
			_complete('size-zero');
			return;
		}

		log?.info('SNIPE', `🎯 SNIPING_TRIGGERED ${side.toUpperCase()} ${amount} @ ${price}`, {
			eventType: 'SNIPING_TRIGGERED',
			side, price, amount, sizeQuote, midPrice: mid, direction: direction.reason,
		});

		const result = await adapter.placeLimitOrder({
			side,
			price,
			amount,
			expiration: cfg.orderExpirationSec || cfg.maxDurationSeconds,
		});

		activeSnipe = {
			orderId: result.orderId,
			side,
			price,
			amount,
			sizeQuote,
			placedAt: Date.now(),
		};

		_pushStatus(`🎯 ${side.toUpperCase()} ${amount} @ ${price}`);
	} catch (err) {
		log?.error('SNIPE', `Snipe execution failed: ${err.message}`, { error: err.message });
		_complete('error');
	}
}

// ─── Internal: Direction & Sizing ────────────────────────────

function _pickDirection(book, alerts) {
	// Priority 1: DEX price lags external price → snipe the cheap side
	if (alerts.length > 0) {
		const latest = alerts[alerts.length - 1];
		const diff = latest.differencePercent ?? 0;
		// differencePercent > 0 means DEX price > external → sell on DEX; < 0 → buy on DEX
		if (Math.abs(diff) > 1.0) {
			const side = diff < 0 ? 'buy' : 'sell';
			return { side, reason: `divergence ${diff.toFixed(2)}%` };
		}
	}

	// Priority 2: Strong one-sided book pressure → trade into the thin side
	let bidDepth = 0;
	let askDepth = 0;
	for (const b of book.bids) bidDepth += b.price * b.amount;
	for (const a of book.asks) askDepth += a.price * a.amount;

	const ratio = Math.max(bidDepth, askDepth) / Math.max(Math.min(bidDepth, askDepth), 0.001);
	if (ratio >= 2.0) {
		// Heavy bids → price likely going up → buy the thin asks
		// Heavy asks → price likely going down → sell into the thin bids
		const side = bidDepth > askDepth ? 'buy' : 'sell';
		return { side, reason: `imbalance ${ratio.toFixed(1)}× (${side})` };
	}

	return null;
}

function _computeOrder(direction, book, mid) {
	const { side } = direction;

	// Walk the opposite side of the book to determine how much we can eat
	// within targetSlippagePercent
	const levels = side === 'buy' ? book.asks : book.bids;
	const maxSlippagePrice = side === 'buy'
		? mid * (1 + cfg.targetSlippagePercent / 100)
		: mid * (1 - cfg.targetSlippagePercent / 100);

	let totalBase = 0;
	let totalQuote = 0;
	let worstPrice = side === 'buy' ? 0 : Infinity;

	for (const level of levels) {
		const levelPrice = level.price;
		if (side === 'buy' && levelPrice > maxSlippagePrice) break;
		if (side === 'sell' && levelPrice < maxSlippagePrice) break;

		const levelQuote = levelPrice * level.amount;
		if (totalQuote + levelQuote > cfg.maxSizeQuote) {
			// Partial fill of this level
			const remainQuote = cfg.maxSizeQuote - totalQuote;
			const remainBase = remainQuote / levelPrice;
			totalBase += remainBase;
			totalQuote += remainQuote;
			worstPrice = levelPrice;
			break;
		}

		totalBase += level.amount;
		totalQuote += levelQuote;
		worstPrice = levelPrice;
	}

	// Place a single limit order at the worst price within our slippage window
	// (acts like a market eat up to that level)
	const price = +(worstPrice || mid).toFixed(6);
	const amount = +totalBase.toFixed(3);
	const sizeQuote = +totalQuote.toFixed(4);

	return { side, price, amount, sizeQuote };
}

// ─── Internal: Fill Detection ────────────────────────────────

async function _detectFill() {
	if (!activeSnipe) return;

	try {
		const openOrders = await adapter.getOpenOrders();
		const stillOpen = openOrders.some(o => o.orderId === activeSnipe.orderId);

		if (!stillOpen) {
			log?.info('SNIPE', `💰 SNIPING_FILLED ${activeSnipe.side.toUpperCase()} ${activeSnipe.amount} @ ${activeSnipe.price}`, {
				eventType: 'SNIPING_FILLED',
				orderId: activeSnipe.orderId,
				side: activeSnipe.side,
				price: activeSnipe.price,
				amount: activeSnipe.amount,
				sizeQuote: activeSnipe.sizeQuote,
				durationMs: Date.now() - activeSnipe.placedAt,
			});
			_complete('filled');
		}
	} catch (err) {
		log?.warn('SNIPE', `Fill detection error: ${err.message}`, { error: err.message });
	}
}

// ─── Internal: Timeout ───────────────────────────────────────

async function _onTimeout() {
	if (!running) return;

	log?.info('SNIPE', `⏱️ SNIPING_TIMEOUT — cancelling after ${cfg.maxDurationSeconds}s`, {
		eventType: 'SNIPING_TIMEOUT',
		orderId: activeSnipe?.orderId,
		durationMs: activeSnipe ? Date.now() - activeSnipe.placedAt : 0,
	});

	if (activeSnipe) {
		try {
			await adapter.cancelOrder(activeSnipe.orderId);
		} catch {
			// may already be filled or expired
		}
	}

	_complete('timeout');
}

// ─── Internal: Completion (self-terminate) ───────────────────

function _complete(outcome) {
	running = false;
	if (timeoutTimer) {
		clearTimeout(timeoutTimer);
		timeoutTimer = null;
	}

	activeSnipe = null;
	_pushStatus(`Done (${outcome})`);
	log?.info('SNIPE', `🏁 Sniping complete — ${outcome}`, { eventType: 'SNIPING_COMPLETE', outcome });
}

// ─── Internal: Status Push ───────────────────────────────────

function _pushStatus(detail) {
	if (!updateStatus) return;

	updateStatus({
		name: 'aggressive-sniping',
		active: running,
		buyOrders: activeSnipe?.side === 'buy' ? 1 : 0,
		sellOrders: activeSnipe?.side === 'sell' ? 1 : 0,
		totalValueQuote: activeSnipe?.sizeQuote ?? 0,
		lastFillTime: null,
		lastMidPrice: null,
		detail: detail || null,
	});
}
