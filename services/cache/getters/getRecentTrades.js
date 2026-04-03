// services/cache/getters/getRecentTrades.js
// Returns the last N trades for a chain:pair key.

export default function getRecentTrades(runtimeCache, cacheKey, limit = 50) {
	const trades = runtimeCache.recentTrades[cacheKey] || [];
	return trades.slice(-limit);
}
