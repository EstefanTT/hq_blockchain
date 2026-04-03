// connectors/apis/coinmarketcap/index.js
// CoinMarketCap API adapter — latest crypto prices.
// Uses shared HTTP client with rate limiting.

import { createHttpClient } from '../shared/httpClient.js';
import { createRateLimiter } from '../shared/rateLimiter.js';

const client = createHttpClient({
	baseURL: 'https://pro-api.coinmarketcap.com',
	timeout: 15000,
	headers: process.env.COINMARKETCAP_API_KEY
		? { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY }
		: {},
});

// Free tier: ~333 calls/day. Conservative per-minute limit.
const limiter = createRateLimiter(10, 60_000);

/**
 * Fetch latest USD prices for multiple symbols in a single batch call.
 * @param {string[]} symbols — e.g. ['STEEM', 'SBD']
 * @returns {Object|null} e.g. { STEEM: { usd: 0.12 }, SBD: { usd: 1.01 } }
 */
export async function getLatestPrices(symbols) {
	if (!process.env.COINMARKETCAP_API_KEY) {
		console.warn('PRICE', 'CMC API key not set — skipping');
		return null;
	}
	await limiter.wait();
	const res = await client.get('/v1/cryptocurrency/quotes/latest', {
		params: { symbol: symbols.join(','), convert: 'USD' },
	});

	const data = res.data?.data;
	if (!data) return null;

	const result = {};
	for (const sym of symbols) {
		const entry = Array.isArray(data[sym]) ? data[sym][0] : data[sym];
		if (entry?.quote?.USD) {
			result[sym] = { usd: entry.quote.USD.price };
		}
	}
	return result;
}
