// testing/connectors/steem-like/integration.test.js
// Integration test — connects to a real Steem node and verifies data flow.
// Run: node testing/connectors/steem-like/integration.test.js

import '../../../services/globalConfig/init.js';
import '../../../services/logger/index.js';

import assert from 'assert';
import { SteemLikeClient } from '../../../connectors/chains/steem-like/client.js';
import { normalizeOrderBook, normalizeTrades } from '../../../connectors/chains/steem-like/normalizer.js';

const NODES = ['https://api.steemit.com', 'https://api.moecki.online'];
const client = new SteemLikeClient(NODES, 'steem');

let passed = 0;
let failed = 0;

async function test(name, fn) {
	try {
		await fn();
		passed++;
		console.log(`  ✅ ${name}`);
	} catch (err) {
		failed++;
		console.error(`  ❌ ${name}: ${err.message}`);
	}
}

console.log('\n🔌 Integration tests (live Steem node)\n');

// ─── Client tests ────────────────────────────────────────────

await test('getOrderBook returns bids and asks', async () => {
	const book = await client.getOrderBook(10);
	assert.ok(Array.isArray(book.bids), 'bids should be array');
	assert.ok(Array.isArray(book.asks), 'asks should be array');
	assert.ok(book.bids.length > 0, 'should have bids');
	assert.ok(book.asks.length > 0, 'should have asks');
});

await test('order book bid has expected fields', async () => {
	const book = await client.getOrderBook(5);
	const bid = book.bids[0];
	assert.ok(bid.order_price, 'has order_price');
	assert.ok(bid.order_price.base, 'has base');
	assert.ok(bid.order_price.quote, 'has quote');
	assert.ok(bid.real_price, 'has real_price');
});

await test('getTicker returns market data', async () => {
	const ticker = await client.getTicker();
	assert.ok(ticker.latest, 'has latest price');
	assert.ok(ticker.lowest_ask || ticker.highest_bid, 'has bid/ask');
});

// ─── Normalization with real data ────────────────────────────

await test('normalizeOrderBook produces valid structure from real data', async () => {
	const raw = await client.getOrderBook(50);
	const book = normalizeOrderBook(raw, 'STEEM');

	assert.ok(book.bids.length > 0, 'normalized bids');
	assert.ok(book.asks.length > 0, 'normalized asks');
	assert.ok(typeof book.bids[0].price === 'number', 'bid price is number');
	assert.ok(typeof book.bids[0].amount === 'number', 'bid amount is number');
	assert.ok(book.bids[0].price > 0, 'bid price > 0');
	assert.ok(book.asks[0].price > 0, 'ask price > 0');
	assert.ok(book.midPrice > 0, 'midPrice > 0');
	assert.ok(book.bids[0].price <= book.asks[0].price, 'best bid <= best ask');
	console.log(`     ↳ Mid: ${book.midPrice.toFixed(4)} SBD | Spread: ${book.spreadPercent.toFixed(3)}% | ${book.bids.length} bids, ${book.asks.length} asks`);
});

await test('getRecentTrades works and normalizes', async () => {
	const raw = await client.getRecentTrades(20);
	assert.ok(Array.isArray(raw), 'raw trades is array');

	const trades = normalizeTrades(raw, 'STEEM', 'SBD');
	if (trades.length > 0) {
		const t = trades[0];
		assert.ok(t.id, 'has id');
		assert.ok(t.timestamp, 'has timestamp');
		assert.ok(typeof t.price === 'number', 'price is number');
		assert.ok(t.type === 'buy' || t.type === 'sell', 'type is buy or sell');
		console.log(`     ↳ ${trades.length} trades normalized. Latest: ${t.type} ${t.amountBase.toFixed(3)} STEEM @ ${t.price.toFixed(4)}`);
	} else {
		console.log('     ↳ No recent trades (empty market)');
	}
});

// ─── Adapter + cache integration ─────────────────────────────

await test('createSteemLikeAdapter registers in chain registry', async () => {
	const { createSteemLikeAdapter } = await import('../../../connectors/chains/steem-like/index.js');
	const { getChain, listChains } = await import('../../../connectors/chains/registry.js');

	const adapter = createSteemLikeAdapter({
		chainName: 'steem-test',
		nodes: NODES,
		baseToken: { symbol: 'STEEM' },
		quoteToken: { symbol: 'SBD' },
	});

	assert.ok(listChains().includes('steem-test'), 'chain registered');

	const got = getChain('steem-test');
	assert.strictEqual(got, adapter, 'getChain returns same adapter');

	const info = adapter.getChainInfo();
	assert.strictEqual(info.chainName, 'steem-test');
});

await test('market poller updates cache after start', async () => {
	const { createSteemLikeAdapter } = await import('../../../connectors/chains/steem-like/index.js');

	const adapter = createSteemLikeAdapter({
		chainName: 'steem-poll-test',
		nodes: NODES,
		baseToken: { symbol: 'STEEM' },
		quoteToken: { symbol: 'SBD' },
	});

	await adapter.start();

	// Wait for first poll to complete
	await new Promise(r => setTimeout(r, 5000));

	const book = adapter.getCurrentOrderBook();
	assert.ok(book, 'order book is in cache');
	assert.ok(book.bids.length > 0, 'has bids');
	assert.ok(book.asks.length > 0, 'has asks');

	const trades = adapter.getRecentTrades(10);
	// trades may be empty if the API method isn't supported, but should be an array
	assert.ok(Array.isArray(trades), 'trades is array');

	console.log(`     ↳ Cache has ${book.bids.length} bids, ${book.asks.length} asks, ${trades.length} trades`);

	await adapter.stop();
});

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
