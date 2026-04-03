// testing/services/storage/steemDexStore.test.js
// Tests for SQLite storage: table creation, insert/query, round-trips.
// Run: node testing/services/storage/steemDexStore.test.js

import '../../../services/globalConfig/init.js';
import '../../../services/logger/index.js';

import assert from 'assert';
import {
	saveOrderBookSnapshot,
	addTrade,
	addTrades,
	updatePosition,
	logAnalysisEvent,
	getRecentSnapshots,
	getTradeHistory,
	getCurrentPosition,
	countTradesToday,
} from '../../../services/storage/steemDexStore.js';
import { getDb } from '../../../services/storage/sqlite.js';

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

// Use a test-specific chain name to avoid polluting real data
const CHAIN = '_test_chain';
const BASE = 'TBASE';
const QUOTE = 'TQUOTE';

console.log('\n🗃️  steemDexStore tests\n');

// ─── Schema ──────────────────────────────────────────────────

test('tables exist after first call', () => {
	// Trigger ensureTables by calling any function
	getRecentSnapshots(CHAIN, BASE, QUOTE, 1);

	const db = getDb();
	const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
	assert.ok(tables.includes('order_book_snapshots'), 'order_book_snapshots exists');
	assert.ok(tables.includes('trades_history'), 'trades_history exists');
	assert.ok(tables.includes('bot_positions'), 'bot_positions exists');
	assert.ok(tables.includes('analysis_log'), 'analysis_log exists');
});

test('indexes exist', () => {
	const db = getDb();
	const idxs = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name);
	assert.ok(idxs.includes('idx_obs_chain_pair_ts'), 'snapshot index');
	assert.ok(idxs.includes('idx_th_chain_pair_ts'), 'trades index');
	assert.ok(idxs.includes('idx_al_chain_event_ts'), 'analysis index');
});

// ─── Order Book Snapshots ────────────────────────────────────

test('saveOrderBookSnapshot + getRecentSnapshots round-trip', () => {
	const book = {
		bids: Array.from({ length: 30 }, (_, i) => ({ price: 0.12 - i * 0.001, amount: 100 + i })),
		asks: Array.from({ length: 30 }, (_, i) => ({ price: 0.13 + i * 0.001, amount: 200 + i })),
		midPrice: 0.125,
		spreadPercent: 1.5,
	};

	saveOrderBookSnapshot(CHAIN, BASE, QUOTE, book);
	const rows = getRecentSnapshots(CHAIN, BASE, QUOTE, 5);

	assert.ok(rows.length >= 1, 'at least 1 snapshot');
	const row = rows[0];
	assert.strictEqual(row.chainName, CHAIN);
	assert.strictEqual(row.baseToken, BASE);
	assert.strictEqual(row.quoteToken, QUOTE);
	assert.strictEqual(row.midPrice, 0.125);
	assert.strictEqual(row.spreadPercent, 1.5);
});

test('snapshot stores only top 20 bids and 20 asks', () => {
	const rows = getRecentSnapshots(CHAIN, BASE, QUOTE, 1);
	assert.strictEqual(rows[0].bids.length, 20, 'top 20 bids');
	assert.strictEqual(rows[0].asks.length, 20, 'top 20 asks');
});

test('empty book is not saved', () => {
	const before = getRecentSnapshots(CHAIN, BASE, QUOTE, 100).length;
	saveOrderBookSnapshot(CHAIN, BASE, QUOTE, { bids: [], asks: [] });
	const after = getRecentSnapshots(CHAIN, BASE, QUOTE, 100).length;
	assert.strictEqual(after, before, 'count unchanged');
});

// ─── Trades ──────────────────────────────────────────────────

test('addTrade + getTradeHistory round-trip', () => {
	const trade = {
		id: 'test-trade-001',
		timestamp: new Date().toISOString(),
		price: 0.13,
		amountBase: 500,
		amountQuote: 65,
		type: 'buy',
		txId: null,
	};

	const changes = addTrade(CHAIN, BASE, QUOTE, trade);
	assert.strictEqual(changes, 1, 'inserted');

	const rows = getTradeHistory(CHAIN, BASE, QUOTE, 5);
	assert.ok(rows.length >= 1, 'at least 1 trade');
	const row = rows[0];
	assert.strictEqual(row.tradeId, 'test-trade-001');
	assert.strictEqual(row.price, 0.13);
	assert.strictEqual(row.type, 'BUY');
});

test('duplicate tradeId is silently ignored', () => {
	const trade = {
		id: 'test-trade-001',
		timestamp: new Date().toISOString(),
		price: 0.13,
		amountBase: 500,
		amountQuote: 65,
		type: 'buy',
	};

	const changes = addTrade(CHAIN, BASE, QUOTE, trade);
	assert.strictEqual(changes, 0, 'duplicate ignored');
});

test('addTrades batch insert + dedup', () => {
	const trades = [
		{ id: 'test-trade-002', timestamp: new Date().toISOString(), price: 0.131, amountBase: 100, amountQuote: 13.1, type: 'sell' },
		{ id: 'test-trade-003', timestamp: new Date().toISOString(), price: 0.129, amountBase: 200, amountQuote: 25.8, type: 'buy' },
		{ id: 'test-trade-001', timestamp: new Date().toISOString(), price: 0.13, amountBase: 500, amountQuote: 65, type: 'buy' }, // dupe
	];

	const inserted = addTrades(CHAIN, BASE, QUOTE, trades);
	assert.strictEqual(inserted, 2, '2 new, 1 dupe');
});

test('countTradesToday returns correct count', () => {
	const count = countTradesToday(CHAIN, BASE, QUOTE);
	assert.ok(count >= 3, `expected >=3, got ${count}`);
});

// ─── Positions ───────────────────────────────────────────────

test('updatePosition + getCurrentPosition round-trip', () => {
	updatePosition(CHAIN, BASE, QUOTE, {
		baseBalance: 1000.5,
		quoteBalance: 150.25,
		averageEntryPrice: 0.128,
	});

	const pos = getCurrentPosition(CHAIN, BASE, QUOTE);
	assert.ok(pos, 'position exists');
	assert.strictEqual(pos.baseBalance, 1000.5);
	assert.strictEqual(pos.quoteBalance, 150.25);
	assert.strictEqual(pos.averageEntryPrice, 0.128);
	assert.ok(pos.lastUpdated, 'has lastUpdated');
});

test('updatePosition upserts correctly', () => {
	updatePosition(CHAIN, BASE, QUOTE, {
		baseBalance: 2000,
		quoteBalance: 300,
		averageEntryPrice: 0.13,
	});

	const pos = getCurrentPosition(CHAIN, BASE, QUOTE);
	assert.strictEqual(pos.baseBalance, 2000);
	assert.strictEqual(pos.quoteBalance, 300);
});

test('getCurrentPosition returns null for unknown pair', () => {
	const pos = getCurrentPosition('_nonexistent', 'X', 'Y');
	assert.strictEqual(pos, null);
});

// ─── Analysis Log ────────────────────────────────────────────

test('logAnalysisEvent inserts correctly', () => {
	logAnalysisEvent({
		chainName: CHAIN,
		eventType: 'MODE_SWITCH',
		severity: 'WARN',
		message: 'normal → violent',
		data: { prev: 'normal', next: 'violent' },
	});

	logAnalysisEvent({
		chainName: CHAIN,
		eventType: 'SNAPSHOT_TAKEN',
		severity: 'INFO',
		message: 'Book snapshot: mid 0.125',
		data: { midPrice: 0.125 },
		strategy: 'spread-capture',
	});

	const db = getDb();
	const rows = db.prepare(
		"SELECT * FROM analysis_log WHERE chainName = ? ORDER BY id DESC LIMIT 2"
	).all(CHAIN);

	assert.strictEqual(rows.length, 2);
	assert.strictEqual(rows[0].eventType, 'SNAPSHOT_TAKEN');
	assert.strictEqual(rows[0].strategy, 'spread-capture');
	assert.strictEqual(rows[1].eventType, 'MODE_SWITCH');
	assert.strictEqual(rows[1].severity, 'WARN');

	const parsed = JSON.parse(rows[1].data);
	assert.strictEqual(parsed.prev, 'normal');
});

// ─── Cleanup test data ──────────────────────────────────────

test('cleanup test data', () => {
	const db = getDb();
	db.exec(`DELETE FROM order_book_snapshots WHERE chainName = '${CHAIN}'`);
	db.exec(`DELETE FROM trades_history WHERE chainName = '${CHAIN}'`);
	db.exec(`DELETE FROM bot_positions WHERE chainName = '${CHAIN}'`);
	db.exec(`DELETE FROM analysis_log WHERE chainName = '${CHAIN}'`);

	const count = db.prepare("SELECT COUNT(*) as c FROM order_book_snapshots WHERE chainName = ?").get(CHAIN);
	assert.strictEqual(count.c, 0, 'cleaned up');
});

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
