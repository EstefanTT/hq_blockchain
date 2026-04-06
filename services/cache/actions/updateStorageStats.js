// services/cache/actions/updateStorageStats.js
// Updates in-memory storage counters (lightweight — no DB queries).

export default function updateStorageStats(botState, fields) {
	Object.assign(botState.storageStats, fields);
}
