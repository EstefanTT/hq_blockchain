# strategies/spread-capture/

Captures bid-ask spread on DEX liquidity pools.

**How it works**: monitors pool prices, places small trades when spread exceeds threshold, exits quickly.

**Parameters** (see `config.schema.js`): pool address, min spread %, trade size, max slippage, cooldown.

**Risks**: impermanent loss, gas costs eating profits, MEV sandwich attacks.
