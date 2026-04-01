# core/risk/

Risk management — guards and limits that run before every trade execution.

| File | Role |
|---|---|
| `positionLimits.js` | Max position size per asset/strategy |
| `exposureLimits.js` | Max total portfolio exposure checks |
| `liquidityChecks.js` | Verify sufficient liquidity exists before trading |
| `killSwitch.js` | Emergency stop — halts all trading immediately |

Risk checks are called by `core/execution/executeTrade.js` before every trade.
