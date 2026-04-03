// testing/connectors/steem-like/normalizer.test.js
// Unit tests for the Steem-like data normalizer.
// Run: node testing/connectors/steem-like/normalizer.test.js

import assert from 'assert';
import {
	parseAsset,
	normalizeOrderBook,
	normalizeTrades,
} from '../../../connectors/chains/steem-like/normalizer.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
	try {
		fn();
		passed++;
		console.log(`  ✅ ${name}`);
	} catch (err) {
		failed++;
		console.error(`  ❌ ${name}: ${err.message}`);
	}
}

console.log('\n📐 Normalizer tests\n');

// ─── parseAsset ──────────────────────────────────────────────

test('parseAsset: STEEM', () => {
	const r = parseAsset('7.692 STEEM');
	assert.strictEqual(r.symbol, 'STEEM');
	assert.strictEqual(r.amount, 7.692);
});

test('parseAsset: SBD', () => {
	const r = parseAsset('1.000 SBD');
	assert.strictEqual(r.symbol, 'SBD');
	assert.strictEqual(r.amount, 1);
});

test('parseAsset: HBD with trailing space', () => {
	const r = parseAsset('  0.131 HBD  ');
	assert.strictEqual(r.symbol, 'HBD');
	assert.strictEqual(r.amount, 0.131);
});

// ─── normalizeOrderBook ─────────────────────────────────────

const sampleBook = {
	bids: [
		{
			order_price: { base: '1.000 SBD', quote: '7.692 STEEM' },
			real_price: '0.13000000000000000',
			steem: 7692,
			sbd: 1000,
			created: '2025-01-01T00:00:00',
		},
		{
			order_price: { base: '0.500 SBD', quote: '3.876 STEEM' },
			real_price: '0.12900000000000000',
			steem: 3876,
			sbd: 500,
			created: '2025-01-01T00:00:01',
		},
	],
	asks: [
		{
			order_price: { base: '1.000 STEEM', quote: '0.131 SBD' },
			real_price: '0.13100000000000000',
			steem: 1000,
			sbd: 131,
			created: '2025-01-01T00:00:00',
		},
		{
			order_price: { base: '2.000 STEEM', quote: '0.264 SBD' },
			real_price: '0.13200000000000000',
			steem: 2000,
			sbd: 264,
			created: '2025-01-01T00:00:01',
		},
	],
};

test('normalizeOrderBook: correct bid count', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.bids.length, 2);
});

test('normalizeOrderBook: correct ask count', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.asks.length, 2);
});

test('normalizeOrderBook: bid price from real_price', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.bids[0].price, 0.13);
});

test('normalizeOrderBook: bid amount is base token (STEEM)', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.bids[0].amount, 7.692);
});

test('normalizeOrderBook: ask price from real_price', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.asks[0].price, 0.131);
});

test('normalizeOrderBook: ask amount is base token (STEEM)', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.asks[0].amount, 1);
});

test('normalizeOrderBook: midPrice is average of best bid and ask', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.strictEqual(book.midPrice, (0.13 + 0.131) / 2);
});

test('normalizeOrderBook: spread', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	const expected = 0.131 - 0.13;
	assert.ok(Math.abs(book.spread - expected) < 1e-10);
});

test('normalizeOrderBook: has timestamp', () => {
	const book = normalizeOrderBook(sampleBook, 'STEEM');
	assert.ok(book.timestamp);
});

// ─── normalizeOrderBook (Hive) ──────────────────────────────

const hiveBook = {
	bids: [{
		order_price: { base: '1.000 HBD', quote: '3.333 HIVE' },
		real_price: '0.30000000000000000',
	}],
	asks: [{
		order_price: { base: '1.000 HIVE', quote: '0.310 HBD' },
		real_price: '0.31000000000000000',
	}],
};

test('normalizeOrderBook: Hive bid amount in HIVE', () => {
	const book = normalizeOrderBook(hiveBook, 'HIVE');
	assert.strictEqual(book.bids[0].amount, 3.333);
	assert.strictEqual(book.bids[0].price, 0.3);
});

test('normalizeOrderBook: Hive ask amount in HIVE', () => {
	const book = normalizeOrderBook(hiveBook, 'HIVE');
	assert.strictEqual(book.asks[0].amount, 1);
	assert.strictEqual(book.asks[0].price, 0.31);
});

// ─── normalizeTrades ─────────────────────────────────────────

const sampleTrades = [
	{
		date: '2025-01-15T12:00:00',
		current_pays: '1.000 SBD',
		open_pays: '7.692 STEEM',
	},
	{
		date: '2025-01-15T12:00:01',
		current_pays: '10.000 STEEM',
		open_pays: '1.300 SBD',
	},
];

test('normalizeTrades: correct count', () => {
	const trades = normalizeTrades(sampleTrades, 'STEEM', 'SBD');
	assert.strictEqual(trades.length, 2);
});

test('normalizeTrades: buy trade (paid SBD, got STEEM)', () => {
	const trades = normalizeTrades(sampleTrades, 'STEEM', 'SBD');
	assert.strictEqual(trades[0].type, 'buy');
	assert.strictEqual(trades[0].amountBase, 7.692);
	assert.strictEqual(trades[0].amountQuote, 1);
	assert.ok(Math.abs(trades[0].price - 1 / 7.692) < 0.001);
});

test('normalizeTrades: sell trade (paid STEEM, got SBD)', () => {
	const trades = normalizeTrades(sampleTrades, 'STEEM', 'SBD');
	assert.strictEqual(trades[1].type, 'sell');
	assert.strictEqual(trades[1].amountBase, 10);
	assert.strictEqual(trades[1].amountQuote, 1.3);
	assert.strictEqual(trades[1].price, 0.13);
});

test('normalizeTrades: has unique id', () => {
	const trades = normalizeTrades(sampleTrades, 'STEEM', 'SBD');
	assert.ok(trades[0].id);
	assert.notStrictEqual(trades[0].id, trades[1].id);
});

test('normalizeTrades: has timestamp', () => {
	const trades = normalizeTrades(sampleTrades, 'STEEM', 'SBD');
	assert.strictEqual(trades[0].timestamp, '2025-01-15T12:00:00');
});

test('normalizeTrades: empty/null input returns []', () => {
	assert.deepStrictEqual(normalizeTrades(null, 'STEEM', 'SBD'), []);
	assert.deepStrictEqual(normalizeTrades([], 'STEEM', 'SBD'), []);
});

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
