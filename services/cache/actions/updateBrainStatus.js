// services/cache/actions/updateBrainStatus.js
// Updates cached brain status.

export default function updateBrainStatus(runtimeCache, fields) {
	Object.assign(runtimeCache.brainStatus, fields);
}
