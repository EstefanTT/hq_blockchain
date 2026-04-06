// services/cache/actions/updateMicroLayerStatus.js
// Updates cached micro layer status.

export default function updateMicroLayerStatus(botState, fields) {
	Object.assign(botState.microLayerStatus, fields);
}
