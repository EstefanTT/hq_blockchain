// services/cache/actions/updateStorageStats.js
// Updates in-memory storage counters (lightweight — no DB queries).

export default function updateStorageStats(runtimeCache, fields) {
	Object.assign(runtimeCache.storageStats, fields);
}
