// services/cache/actions/updateMicroLayerStatus.js
// Updates cached micro layer status.

export default function updateMicroLayerStatus(runtimeCache, fields) {
	Object.assign(runtimeCache.microLayerStatus, fields);
}
