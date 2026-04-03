// services/cache/actions/setLiveOrderBook.js
// Replaces the live order book for a specific chain:pair key.

export default function setLiveOrderBook(runtimeCache, cacheKey, book) {
	runtimeCache.orderBooks[cacheKey] = book;
}
