// utils/time.js
// Timestamp helpers, duration formatting, UTC date handling.

/**
 * Current UTC date as YYYY-MM-DD string.
 */
export function utcDateString() {
	return new Date().toISOString().split('T')[0];
}

/**
 * Current UTC ISO timestamp.
 */
export function utcNow() {
	return new Date().toISOString();
}

/**
 * Format milliseconds as human-readable duration: "2m 15s", "1h 30m", etc.
 */
export function formatDuration(ms) {
	const s = Math.floor(ms / 1000) % 60;
	const m = Math.floor(ms / 60000) % 60;
	const h = Math.floor(ms / 3600000);
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}
