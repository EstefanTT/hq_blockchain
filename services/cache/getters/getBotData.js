// services/cache/getters/getBotData.js
// Returns merged global + per-bot state for a given bot.

export default function getBotData(runtimeCache, botName) {
	const botState = runtimeCache.bots[botName];
	if (!botState) return null;
	return {
		// Global/shared state
		priceFeeds: runtimeCache.priceFeeds,
		candles: runtimeCache.candles,
		priceEngine: runtimeCache.priceEngine,
		divergenceAlerts: runtimeCache.divergenceAlerts,
		orderBooks: runtimeCache.orderBooks,
		recentTrades: runtimeCache.recentTrades,
		appSizeInfo: runtimeCache.appSizeInfo,
		botControl: runtimeCache.botControl,
		// Per-bot state
		...botState,
	};
}
