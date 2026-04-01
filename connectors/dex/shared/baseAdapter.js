// connectors/dex/shared/baseAdapter.js
// Defines the interface contract for DEX adapters.

/**
 * Base DEX adapter interface:
 *
 * - getQuote({ tokenIn, tokenOut, amountIn })     → { amountOut, priceImpact, route }
 * - buildSwap({ tokenIn, tokenOut, amountIn, slippage })  → unsigned transaction
 * - getPools({ tokenA, tokenB })                  → pool info (liquidity, fees, etc.)
 * - subscribe(event, callback)                     → unsubscribe function (for streaming)
 */

export const DEX_ADAPTER_METHODS = [
	'getQuote',
	'buildSwap',
	'getPools',
	'subscribe',
];
