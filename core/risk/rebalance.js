// core/risk/rebalance.js
// Quick Rebalance Safety Net.
// Monitors inventory balance and places a small opposing order when position
// deviates beyond the configured threshold.

// ─── State ───────────────────────────────────────────────────

let log = null;
let adapter = null;
let cfg = null;                // risk config block
let cacheGetter = null;        // getSteemDexBotData
let cacheKey = null;
let updateRiskStatus = null;
let pendingRebalanceId = null; // orderId of active rebalance order

// ─── Public API ──────────────────────────────────────────────

/**
 * Initialize rebalance module (call once at boot).
 * @param {Object} opts
 * @param {Object} opts.adapter          — chain adapter
 * @param {Object} opts.logger           — botLogger
 * @param {Object} opts.config           — risk config block
 * @param {string} opts.cacheKey         — e.g. 'steem:STEEM/SBD'
 * @param {Function} opts.getSteemDexBotData — cache getter
 * @param {Function} opts.updateRiskStatus   — cache updater
 */
export function initRebalance(opts) {
	adapter = opts.adapter;
	log = opts.logger;
	cfg = opts.config;
	cacheKey = opts.cacheKey;
	cacheGetter = opts.getSteemDexBotData;
	updateRiskStatus = opts.updateRiskStatus;
	pendingRebalanceId = null;

	log?.info('RISK', '🛡️ Rebalance safety net initialized', {
		deviationThreshold: `${cfg.rebalanceDeviationPercent}%`,
		maxRebalance: `${cfg.rebalanceMaxPercent * 100}%`,
	});
}

/**
 * Check if rebalance is needed and execute if so.
 * Safe to call frequently (brain tick, trade events).
 * No-ops if adapter/config not initialized or rebalance already pending.
 */
export async function checkAndRebalance() {
	if (!adapter || !cfg || !cacheGetter) return;
	if (!adapter.operationsReady) return;
	if (pendingRebalanceId) return; // already have a pending rebalance order

	try {
		const data = cacheGetter();
		const account = data.accountData;
		const book = data.orderBooks?.[cacheKey];

		if (!account?.balance || !account?.quoteBalance || !book?.midPrice) return;

		const mid = book.midPrice;
		const baseAmount = parseFloat(account.balance);     // e.g. "549.822 STEEM" → 549.822
		const quoteAmount = parseFloat(account.quoteBalance); // e.g. "3.410 SBD" → 3.410

		if (isNaN(baseAmount) || isNaN(quoteAmount) || mid <= 0) return;

		// Compute value in quote terms
		const baseValueQuote = baseAmount * mid;
		const totalValueQuote = baseValueQuote + quoteAmount;

		if (totalValueQuote <= 0) return;

		// Deviation: how far from 50/50 are we?
		const baseRatio = baseValueQuote / totalValueQuote;   // ideal = 0.5
		const deviationPercent = Math.abs(baseRatio - 0.5) * 200; // 0..100 scale

		const threshold = cfg.rebalanceDeviationPercent ?? 1.0;
		if (deviationPercent <= threshold) return; // within bounds

		// We need to rebalance. Determine side + size.
		const excessSide = baseRatio > 0.5 ? 'sell' : 'buy'; // too much base → sell base
		const excessQuote = Math.abs(baseValueQuote - quoteAmount) / 2; // excess in quote terms
		const maxRebalanceQuote = excessQuote * (cfg.rebalanceMaxPercent ?? 0.2); // cap at 20%

		if (maxRebalanceQuote < 0.001) return; // too small to bother

		// Price: tight limit off midPrice
		const offset = cfg.rebalanceLimitOffsetPercent ?? 0.05;
		const price = excessSide === 'sell'
			? +(mid * (1 - offset / 100)).toFixed(6)
			: +(mid * (1 + offset / 100)).toFixed(6);

		const amount = +(maxRebalanceQuote / price).toFixed(3);
		if (amount <= 0) return;

		log?.info('RISK', `🔄 Rebalance triggered — ${excessSide} ${amount} @ ${price}`, {
			eventType: 'REBALANCE_TRIGGERED',
			excessSide, amount, price, deviationPercent: +deviationPercent.toFixed(2),
			baseValueQuote: +baseValueQuote.toFixed(4), quoteAmount: +quoteAmount.toFixed(4),
		});

		const result = await adapter.placeLimitOrder({
			side: excessSide,
			price,
			amount,
			expiration: 60, // 1 minute expiration
		});

		if (result?.rejected) {
			log?.warn('RISK', `🛡️ Rebalance order rejected by slippage guard: ${result.reason}`, {
				eventType: 'REBALANCE_REJECTED', reason: result.reason,
			});
			return;
		}

		pendingRebalanceId = result.orderId;

		log?.info('RISK', `✅ Rebalance order placed — orderId ${result.orderId}`, {
			eventType: 'REBALANCE_COMPLETED',
			orderId: result.orderId, side: excessSide, price, amount,
		});

		if (updateRiskStatus) {
			updateRiskStatus({
				lastRebalanceTime: new Date().toISOString(),
				lastRebalanceSide: excessSide,
				lastRebalanceAmount: amount,
				lastRebalancePrice: price,
			});
		}
	} catch (err) {
		log?.error('RISK', `Rebalance error: ${err.message}`, { error: err.message });
	}
}

/**
 * Called on trade events — clears pending rebalance if filled, then checks again.
 * @param {Object} trade
 */
export async function onRebalanceTradeEvent(trade) {
	if (!adapter || !cfg) return;

	// If we had a pending rebalance, check if it got filled
	if (pendingRebalanceId) {
		try {
			const open = await adapter.getOpenOrders();
			const stillOpen = open.some(o => o.orderId === pendingRebalanceId);
			if (!stillOpen) {
				log?.info('RISK', `♻️ Rebalance order ${pendingRebalanceId} filled/expired`, {
					eventType: 'REBALANCE_FILLED', orderId: pendingRebalanceId,
				});
				pendingRebalanceId = null;
			}
		} catch {
			// ignore — next check will pick it up
		}
	}

	// Check if new rebalance needed
	await checkAndRebalance();
}

/**
 * Get current rebalance state (for testing / inspection).
 */
export function getRebalanceState() {
	return { pendingRebalanceId };
}

/**
 * Reset module state (for testing).
 */
export function resetRebalance() {
	log = null;
	adapter = null;
	cfg = null;
	cacheGetter = null;
	cacheKey = null;
	updateRiskStatus = null;
	pendingRebalanceId = null;
}
