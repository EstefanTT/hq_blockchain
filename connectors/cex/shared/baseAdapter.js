// connectors/cex/shared/baseAdapter.js
// Defines the interface contract for CEX adapters.

/**
 * Base CEX adapter interface:
 *
 * - getBalance(asset?)                → { asset, free, locked }[]
 * - placeOrder({ symbol, side, type, quantity, price? })  → order result
 * - cancelOrder(orderId)              → cancellation result
 * - getOpenOrders(symbol?)            → open orders[]
 * - getOrderBook(symbol, depth?)      → { bids, asks }
 * - getTicker(symbol)                 → { price, volume24h, change24h }
 * - subscribe(stream, callback)       → unsubscribe function (WebSocket)
 */

export const CEX_ADAPTER_METHODS = [
	'getBalance',
	'placeOrder',
	'cancelOrder',
	'getOpenOrders',
	'getOrderBook',
	'getTicker',
	'subscribe',
];
