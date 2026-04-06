// services/cache/actions/updateStrategyStatus.js
// Updates cached active strategy status.

export default function updateStrategyStatus(botState, fields) {
	Object.assign(botState.strategyStatus, fields);
}
