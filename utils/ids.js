// utils/ids.js
// Unique ID generation for orders, executions, strategy instances.

import { randomBytes } from 'crypto';

/**
 * Generate a short unique ID (12 hex chars). Good for order/execution IDs.
 */
export function shortId() {
	return randomBytes(6).toString('hex');
}

/**
 * Generate a prefixed ID: "exec-a1b2c3d4e5f6"
 */
export function prefixedId(prefix) {
	return `${prefix}-${shortId()}`;
}
