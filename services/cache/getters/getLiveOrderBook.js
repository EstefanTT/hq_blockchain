// services/cache/getters/getLiveOrderBook.js
// Returns the current order book for a chain:pair key.

export default function getLiveOrderBook(runtimeCache, cacheKey) {
	return runtimeCache.orderBooks[cacheKey] || null;
}
