// connectors/chains/shared/baseAdapter.js
// Defines the interface contract that all chain adapters should implement.
// Not enforced at runtime (JS has no interfaces), but serves as documentation and reference.

/**
 * Base chain adapter interface:
 *
 * - getBalance(address)              → { native, tokens[] }
 * - getBlock(blockNumber?)           → block object
 * - getTransaction(txHash)           → transaction object
 * - sendTransaction(signedTx)        → txHash
 * - estimateFee(txParams)            → fee estimate
 * - subscribe(event, callback)       → unsubscribe function (for streaming)
 */

export const CHAIN_ADAPTER_METHODS = [
	'getBalance',
	'getBlock',
	'getTransaction',
	'sendTransaction',
	'estimateFee',
	'subscribe',
];
