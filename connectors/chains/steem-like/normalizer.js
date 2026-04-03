// connectors/chains/steem-like/normalizer.js
// Transforms raw Steem/Hive/Blurt API responses into normalized format.
// Chain-agnostic: works with any Steem-like chain.

/**
 * Parse a Steem-like asset string, e.g. "1.234 STEEM" → { amount: 1.234, symbol: 'STEEM' }
 */
export function parseAsset(str) {
	const parts = str.trim().split(' ');
	return { amount: parseFloat(parts[0]), symbol: parts[1] };
}

/**
 * Normalize raw order book from condenser_api.get_order_book.
 * @param {Object} raw — raw API response { bids: [...], asks: [...] }
 * @param {string} baseSymbol — e.g. 'STEEM', 'HIVE'
 * @returns {{ bids, asks, timestamp, midPrice, spread, spreadPercent }}
 */
export function normalizeOrderBook(raw, baseSymbol) {
	const bids = (raw.bids || []).map(o => normalizeOrder(o, baseSymbol));
	const asks = (raw.asks || []).map(o => normalizeOrder(o, baseSymbol));

	const bestBid = bids[0]?.price || 0;
	const bestAsk = asks[0]?.price || 0;
	const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;
	const spread = bestBid && bestAsk ? bestAsk - bestBid : null;

	return {
		bids,
		asks,
		timestamp: new Date().toISOString(),
		midPrice,
		spread,
		spreadPercent: midPrice ? (spread / midPrice) * 100 : null,
	};
}

/**
 * Normalize a single order entry.
 * Works for both bids and asks by detecting which field holds the base token.
 *
 * Steem bids:  order_price.base = SBD,   order_price.quote = STEEM
 * Steem asks:  order_price.base = STEEM, order_price.quote = SBD
 */
function normalizeOrder(order, baseSymbol) {
	const base = parseAsset(order.order_price.base);
	const quote = parseAsset(order.order_price.quote);

	const price = parseFloat(order.real_price);
	// Amount of the base token in this order
	const amount = quote.symbol === baseSymbol ? quote.amount : base.amount;

	return { price, amount };
}

/**
 * Normalize raw recent trades from get_recent_trades.
 * @param {Array} raw — array of raw trade objects
 * @param {string} baseSymbol — e.g. 'STEEM'
 * @param {string} quoteSymbol — e.g. 'SBD'
 * @returns {Array<{ id, timestamp, price, amountBase, amountQuote, type }>}
 */
export function normalizeTrades(raw, baseSymbol, quoteSymbol) {
	if (!Array.isArray(raw)) return [];

	return raw.map(t => {
		const currentPays = parseAsset(t.current_pays);
		const openPays = parseAsset(t.open_pays);

		let amountBase, amountQuote, type;

		if (currentPays.symbol === quoteSymbol) {
			// Taker paid quote (SBD) to get base (STEEM) → BUY
			amountQuote = currentPays.amount;
			amountBase = openPays.amount;
			type = 'buy';
		} else {
			// Taker paid base (STEEM) to get quote (SBD) → SELL
			amountBase = currentPays.amount;
			amountQuote = openPays.amount;
			type = 'sell';
		}

		const price = amountBase > 0 ? amountQuote / amountBase : 0;

		return {
			id: `${t.date}_${t.current_pays}_${t.open_pays}`,
			timestamp: t.date,
			price,
			amountBase,
			amountQuote,
			type,
		};
	});
}
