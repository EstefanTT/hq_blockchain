// core/risk/slippageCheck.js
// Self-inflicted slippage calculator.
// Walk-the-book simulation: computes the effective average fill price for an
// order of a given size, then compares it against midPrice.
// Used as a transparent wrapper around adapter.placeLimitOrder at boot time.

/**
 * Compute self-inflicted slippage % for a prospective order.
 *
 * @param {Object}   book          — live order book { bids: [{price,amount},...], asks: [...], midPrice }
 * @param {'buy'|'sell'} side      — order side
 * @param {number}   price         — limit price
 * @param {number}   amount        — order size in base units
 * @returns {{ slippagePercent: number, effectiveAvgPrice: number, wouldCross: boolean }}
 */
export function computeSlippage(book, side, price, amount) {
	if (!book?.midPrice || !amount || amount <= 0) {
		return { slippagePercent: 0, effectiveAvgPrice: price, wouldCross: false };
	}

	const mid = book.midPrice;

	// Determine if this order would cross the spread (be an aggressor)
	const levels = side === 'buy' ? (book.asks || []) : (book.bids || []);

	// A buy crosses if price >= best ask; a sell crosses if price <= best bid
	const bestOpposite = levels[0]?.price;
	if (bestOpposite == null) {
		return { slippagePercent: 0, effectiveAvgPrice: price, wouldCross: false };
	}

	const wouldCross = side === 'buy' ? price >= bestOpposite : price <= bestOpposite;

	if (!wouldCross) {
		// Pure resting order — no slippage
		return { slippagePercent: 0, effectiveAvgPrice: price, wouldCross: false };
	}

	// Walk the opposite side of the book
	let remaining = amount;
	let totalCost = 0; // in quote terms

	for (const level of levels) {
		// For a buy: consume asks from cheapest up to our price limit
		// For a sell: consume bids from highest down to our price limit
		const canFill = side === 'buy' ? level.price <= price : level.price >= price;
		if (!canFill) break;

		const fillAmount = Math.min(remaining, level.amount);
		totalCost += fillAmount * level.price;
		remaining -= fillAmount;

		if (remaining <= 0) break;
	}

	const filled = amount - remaining;
	if (filled <= 0) {
		return { slippagePercent: 0, effectiveAvgPrice: price, wouldCross: true };
	}

	const effectiveAvgPrice = totalCost / filled;
	const slippagePercent = Math.abs(effectiveAvgPrice - mid) / mid * 100;

	return {
		slippagePercent: +slippagePercent.toFixed(4),
		effectiveAvgPrice: +effectiveAvgPrice.toFixed(6),
		wouldCross: true,
	};
}

/**
 * Create a wrapper around adapter.placeLimitOrder that checks slippage first.
 *
 * @param {Object}   adapter             — chain adapter with placeLimitOrder + getCurrentOrderBook
 * @param {Object}   riskConfig          — { maxAllowedSlippagePercent }
 * @param {Object}   [logger]            — botLogger instance
 * @param {Function} [updateRiskStatus]  — cache updater for riskStatus
 * @returns {Function} wrapped placeLimitOrder
 */
export function createSlippageGuard(adapter, riskConfig, logger, updateRiskStatus) {
	const maxSlippage = riskConfig.maxAllowedSlippagePercent ?? 0.3;
	const originalPlace = adapter.placeLimitOrder.bind(adapter);
	let rejectCount = 0;

	return async function guardedPlaceLimitOrder(params) {
		const { side, price, amount } = params;
		const book = adapter.getCurrentOrderBook();

		const { slippagePercent, wouldCross } = computeSlippage(book, side, price, amount);

		if (wouldCross && slippagePercent > maxSlippage) {
			rejectCount++;
			const reason = `Slippage ${slippagePercent.toFixed(3)}% > max ${maxSlippage}% for ${side} ${amount} @ ${price}`;

			logger?.warn('RISK', `🛡️ Order rejected — ${reason}`, {
				eventType: 'SLIPPAGE_REJECTED',
				side, price, amount, slippagePercent, maxSlippage,
			});

			if (updateRiskStatus) {
				updateRiskStatus({ slippageRejectCount: rejectCount, lastSlippageReject: new Date().toISOString() });
			}

			return { rejected: true, reason: 'slippage_too_high', slippagePercent };
		}

		return originalPlace(params);
	};
}
