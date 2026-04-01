# strategies/twap/

Time-Weighted Average Price — splits a large order into many small trades spread over time.

**How it works**: divides target amount into N equal slices, executes one slice per interval.

**Parameters**: token pair, total amount, duration, slice count, max slippage per slice.

**Use case**: buying/selling a large position without moving the market.
