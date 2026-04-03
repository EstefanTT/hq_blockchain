// services/cache/actions/updatePriceEngineStatus.js
// Merges fields into the price engine status object.

export default function updatePriceEngineStatus(runtimeCache, fields) {
	Object.assign(runtimeCache.priceEngine, fields);
}
