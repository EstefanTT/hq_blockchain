// services/cache/actions/addRecentTrades.js
// Appends new trades for a specific chain:pair key. Keeps the last MAX_TRADES.

const MAX_TRADES = 200;

export default function addRecentTrades(runtimeCache, cacheKey, newTrades) {
	if (!runtimeCache.recentTrades[cacheKey]) {
		runtimeCache.recentTrades[cacheKey] = [];
	}
	runtimeCache.recentTrades[cacheKey].push(...newTrades);
	if (runtimeCache.recentTrades[cacheKey].length > MAX_TRADES) {
		runtimeCache.recentTrades[cacheKey] = runtimeCache.recentTrades[cacheKey].slice(-MAX_TRADES);
	}
}
