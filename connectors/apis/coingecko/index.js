// connectors/apis/coingecko/index.js
// CoinGecko API adapter — simple prices and OHLC candles.
// Uses shared HTTP client with rate limiting.

import { createHttpClient } from '../shared/httpClient.js';
import { createRateLimiter } from '../shared/rateLimiter.js';

const client = createHttpClient({
	baseURL: 'https://api.coingecko.com/api/v3',
	timeout: 15000,
	headers: process.env.COINGECKO_API_KEY
		? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
		: {},
});

// Free tier: ~10-30 calls/min. Conservative limit.
const limiter = createRateLimiter(10, 60_000);

/**
 * Fetch latest USD prices for multiple coins in a single batch call.
 * @param {string[]} coinIds — e.g. ['steem', 'steem-dollars']
 * @returns {Object|null} e.g. { steem: { usd: 0.12 }, 'steem-dollars': { usd: 1.01 } }
 */
export async function getSimplePrices(coinIds) {
	await limiter.wait();
	const res = await client.get('/simple/price', {
		params: { ids: coinIds.join(','), vs_currencies: 'usd' },
	});
	return res.data;
}

/**
 * Fetch OHLC candles for a single coin.
 * @param {string} coinId — CoinGecko coin ID (alphanumeric + hyphens only)
 * @param {number} days — 1 = ~30-min candles (free tier), 30 = daily candles
 * @returns {Array|null} [[timestamp_ms, open, high, low, close], ...]
 */
export async function getOhlcCandles(coinId, days = 1) {
	if (!/^[a-z0-9-]+$/.test(coinId)) throw new Error(`Invalid coin ID: ${coinId}`);
	await limiter.wait();
	const res = await client.get(`/coins/${encodeURIComponent(coinId)}/ohlc`, {
		params: { vs_currency: 'usd', days },
	});
	return res.data;
}
