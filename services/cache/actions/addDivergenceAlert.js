// services/cache/actions/addDivergenceAlert.js
// Appends a divergence alert to the cache. Keeps the last 50 alerts.

const MAX_ALERTS = 50;

export default function addDivergenceAlert(runtimeCache, alert) {
	runtimeCache.divergenceAlerts.push(alert);
	if (runtimeCache.divergenceAlerts.length > MAX_ALERTS) {
		runtimeCache.divergenceAlerts = runtimeCache.divergenceAlerts.slice(-MAX_ALERTS);
	}
}
