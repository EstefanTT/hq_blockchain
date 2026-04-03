# Step 2 – Generic Steem-like Blockchain Connector + WebSocket (Depth ***)

**Only implement Step 2.**  
Do not touch any other part of the project yet.

### Overall Goal of Step 2
Create a **generic, multi-chain-ready** connector for Steem-like blockchains (Steem, Hive, Blurt, and any future clones) so the rest of the bot (cache, strategies, main brain) always sees the exact same data format no matter which chain is used.

The connector must live in `connectors/chains/steem-like/` and follow the existing registry pattern exactly like the other chain connectors (`getChain('steem')`, `getChain('hive')`, etc.).

### What the Generic Connector Must Do

**1. Registry & Configuration**
- Add a new folder `connectors/chains/steem-like/`
- Include the standard files (`index.js`, `registry.js`, `baseAdapter.js` if needed, `README.md`)
- Support configuration via the app’s `config.json` (chainName, baseToken, quoteToken, node URLs, etc.)
- Allow easy addition of new chains (Steem, Hive, Blurt) by simply adding them to the registry with their node list

**2. WebSocket Real-Time Data**
- Connect to the chain’s WebSocket (Steem/Hive style)
- Subscribe to:
  - Live **order book** updates (bids and asks for the baseToken/quoteToken pair)
  - **Recent trades** (filled orders on the DEX)
- Handle reconnection automatically if the WebSocket drops
- Keep a live in-memory order book that is updated in real time

**3. Data Normalization (very important)**
- All data sent to cache and future strategies must be in **exactly the same normalized format**, regardless of the chain:
  - Order book: `{ bids: [{price, amount}, ...], asks: [{price, amount}, ...], timestamp }`
  - Trades: array of `{ id, timestamp, price, amountBase, amountQuote, type (buy/sell) }`
- Create a small internal adapter/normalizer layer so any differences between Steem, Hive, Blurt are hidden from the rest of the bot

**4. Cache Integration**
- Push the normalized live order book and trades into `services/cache/` (add new actions/getters if needed: `orderBook.setLiveBook()`, `orderBook.getCurrentBook()`, `trades.addNewTrade()`, etc.)
- The cache must always reflect the most recent state for the configured chain + pair

**5. Basic Helper Functions**
- `getChainInfo()` → returns current chainName, baseToken, quoteToken
- `getCurrentOrderBook()` → returns the latest normalized book
- `getRecentTrades(limit)` → returns the last N normalized trades
- All functions must be async and heavily logged with the new PRICE / BOT context tags

**6. Testing & Verification**
- Add tests in the existing `testing/` folder so we can verify:
  - WebSocket connects and stays alive
  - Order book updates in real time
  - Data is correctly normalized
  - Cache is updated properly
- After implementation, the dashboard (from Step 1) should still work and we should be able to see live order-book data arriving

### Final Requirements
- Everything must remain **generic** and **multi-chain ready** (use variables `baseToken`, `quoteToken`, `chainName` everywhere)
- Respect the strict architecture rules (no left imports)
- Use existing patterns for registry, logging, cache, and error handling
- Keep the code clean, readable, and future-proof

**Important note**  
If you have any important doubts, see a better way to structure something, or have an improvement that seems important for the long-term multi-chain goal, please ask first before coding anything. Do not start implementation until we confirm.
