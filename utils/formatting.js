// utils/formatting.js
// Number/string formatting — currency, percentage, address truncation.

/**
 * Format a number as USD currency.
 */
export function formatUsd(amount) {
	return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a percentage value.
 */
export function formatPercent(value, decimals = 2) {
	return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Truncate a blockchain address: 0x1234...abcd
 */
export function truncateAddress(address, start = 6, end = 4) {
	if (!address || address.length < start + end) return address;
	return `${address.slice(0, start)}...${address.slice(-end)}`;
}
