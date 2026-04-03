# Step 4 – Basic Order Operations (place, cancel, check, balance, RC) (Depth ***)

**Only implement Step 4.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 4
Add the fundamental order-management functions so the bot can actually place, cancel and monitor real orders on any Steem-like DEX (Steem, Hive, Blurt…).

All functions must be **generic and multi-chain ready** (use `baseToken`, `quoteToken`, `chainName` everywhere) and live in the `connectors/chains/steem-like/` layer so the rest of the bot never talks directly to the blockchain.

### Required Functions (exact specification)

Using the existing `steem-like` connector (from Step 2), expose these clean async functions:

1. **placeLimitOrder**
   - Parameters: `{ side: "BUY"|"SELL", price, amountBase, amountQuote? }`
   - Returns the order ID + raw transaction result
   - Must calculate exact amounts and use the correct RPC call (`condenser_api.limit_order_create` or equivalent)

2. **cancelOrder**
   - Parameters: `orderId`
   - Cancels a specific open order on the current chain/pair
   - Returns success status

3. **getOpenOrders**
   - Returns array of normalized open orders:
     ```json
     [{
       id, price, amountBase, amountQuote, side, createdTimestamp
     }]
4. **getAccountBalances**
Returns current balances for the configured account:JSON{
  baseBalance,          // STEEM / HIVE / BLURT
  quoteBalance,         // SBD / HBD / …
  steemPower,           // SP / HP / …
  rcPercentage          // Resource Credits % remaining
}

5. **getAccountRC**

Convenience function that returns only the RC percentage + mana regeneration info


### All functions must:

Use the generic steem-like client (no direct RPC calls from anywhere else)
Automatically update the cache (services/cache) after every successful operation
Log every action with the existing BOT / PRICE / STORAGE context tags
Trigger an analysis_log event (ORDER_PLACED, ORDER_CANCELLED, etc.)

### Integration Requirements

Add these functions to the steem-like adapter so they are available via getChain('steem').market.placeLimitOrder(...)
Update the bot’s index.js to expose them cleanly for future strategies
Update the dashboard (from Step 1) with a new “Account & Orders” section:
Current balances + RC %
List of open orders (with Cancel button that calls the real cancel function)
Last order status


### Testing

Add comprehensive tests in testing/ for:
Placing and cancelling test orders (use very small amounts on testnet or with tiny real amounts)
Balance & RC fetching
Open orders list
Cache updates after each operation

All tests must pass and be safe to run repeatedly

### Final Requirements

Everything must remain generic and multi-chain ready
Respect the strict architecture rules (connectors do the actual calls)
Keep the code clean, readable, and future-proof
Add any necessary error handling and safety checks (minimum order size, max slippage preview, etc.)

Important note
If you have any important doubts, see a better way to structure the order functions, or have an improvement that seems important for the long-term multi-chain / strategy use, please ask first before coding anything. Do not start implementation until we confirm.