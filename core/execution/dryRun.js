// core/execution/dryRun.js
// Dry-run wrapper for chain adapter order operations.
// When enabled, placeLimitOrder and cancelOrder return mock results
// instead of broadcasting to the blockchain. All other behaviour
// (slippage checks, logging, strategy logic) runs normally.

let dryRunEnabled = false;
let nextDryId = 1;

/**
 * Set the live dry-run flag (can be toggled at runtime via API).
 * @param {boolean} enabled
 */
export function setDryRun(enabled) {
	dryRunEnabled = !!enabled;
}

/**
 * Get the current dry-run state.
 * @returns {boolean}
 */
export function isDryRunEnabled() {
	return dryRunEnabled;
}

/**
 * Wrap adapter.placeLimitOrder and adapter.cancelOrder with dry-run logic.
 * Call BEFORE the slippage guard so slippage still validates normally.
 *
 * @param {Object}   adapter  — chain adapter (must already have initOperations called)
 * @param {Object}   [logger] — botLogger instance
 * @returns {{ wrappedPlace: Function, wrappedCancel: Function }}
 */
export function createDryRunWrapper(adapter, logger) {
	const originalPlace = adapter.placeLimitOrder.bind(adapter);
	const originalCancel = adapter.cancelOrder.bind(adapter);

	async function dryPlaceLimitOrder(params) {
		if (!dryRunEnabled) return originalPlace(params);

		const orderId = nextDryId++;
		const tag = `dry-${orderId}`;
		logger?.info('BOT', `🧪 DRY-RUN: would place ${params.side} ${params.amount} @ ${params.price} (exp ${params.expiration ?? '—'}s)`, {
			eventType: 'DRY_RUN_ORDER', orderId: tag, ...params,
		});
		return { orderId: tag, txId: 'dry-run', dryRun: true };
	}

	async function dryCancelOrder(orderIdOrParams) {
		if (!dryRunEnabled) return originalCancel(orderIdOrParams);

		const id = typeof orderIdOrParams === 'object' ? orderIdOrParams.orderId : orderIdOrParams;
		logger?.info('BOT', `🧪 DRY-RUN: would cancel order ${id}`, {
			eventType: 'DRY_RUN_CANCEL', orderId: id,
		});
		return { orderId: id, txId: 'dry-run', dryRun: true };
	}

	return { wrappedPlace: dryPlaceLimitOrder, wrappedCancel: dryCancelOrder };
}
