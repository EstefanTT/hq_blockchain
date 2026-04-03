// services/cache/getters/getSteemDexBotData.js
// Returns all bot data (prices, candles, engine status, alerts, order book, trades, storage stats, account).

export default function getSteemDexBotData(runtimeCache) {
	return {
		priceFeeds: runtimeCache.priceFeeds,
		candles: runtimeCache.candles,
		priceEngine: runtimeCache.priceEngine,
		divergenceAlerts: runtimeCache.divergenceAlerts,
		orderBooks: runtimeCache.orderBooks,
		recentTrades: runtimeCache.recentTrades,
		storageStats: runtimeCache.storageStats,
		accountData: runtimeCache.accountData,
	};
}
