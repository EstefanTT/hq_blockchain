// services/cache/actions/updateBrainStatus.js
// Updates cached brain status.

export default function updateBrainStatus(botState, fields) {
	Object.assign(botState.brainStatus, fields);
}
