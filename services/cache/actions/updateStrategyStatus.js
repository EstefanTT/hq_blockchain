// services/cache/actions/updateStrategyStatus.js
// Updates cached active strategy status.

export default function updateStrategyStatus(runtimeCache, fields) {
	Object.assign(runtimeCache.strategyStatus, fields);
}
