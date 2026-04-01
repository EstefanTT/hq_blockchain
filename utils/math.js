// utils/math.js
// Precision math for financial calculations. Avoids floating-point errors on currency amounts.

/**
 * Round a number to N decimal places (avoids floating-point drift).
 */
export function round(value, decimals = 8) {
	return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

/**
 * Calculate percentage change between two values.
 */
export function percentChange(from, to) {
	if (from === 0) return 0;
	return ((to - from) / Math.abs(from)) * 100;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}
