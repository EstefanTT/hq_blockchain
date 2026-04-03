// services/cache/actions/updatePriceFeed.js
// Updates a price feed entry for a specific coin symbol and source.

export default function updatePriceFeed(runtimeCache, coinSymbol, source, usd) {
	if (!runtimeCache.priceFeeds[coinSymbol]) {
		runtimeCache.priceFeeds[coinSymbol] = {};
	}
	runtimeCache.priceFeeds[coinSymbol][source] = {
		usd,
		updatedAt: new Date().toISOString(),
	};
}
