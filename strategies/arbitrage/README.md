# strategies/arbitrage/

Exploits price differences for the same asset across different venues (cross-DEX, DEX↔CEX).

**How it works**: monitors prices on multiple venues, executes simultaneous buy/sell when spread exceeds threshold + fees.

**Risks**: execution latency, gas cost vs profit, liquidity drying up mid-execution.
