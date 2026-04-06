// testing/services/storage/botStore.test.js
// Tests for SQLite storage: table creation, insert/query, round-trips, per-bot isolation.
// Run: node testing/services/storage/botStore.test.js

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
	countAllTradesToday,
	getAllBotPositions,
} from '../../../services/storage/botStore.js';
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

// Use test-specific constants to avoid polluting real data
const BOT = '_test_bot';
const BOT2 = '_test_bot2';
const CHAIN = '_test_chain';
const BASE = 'TBASE';
const QUOTE = 'TQUOTE';

console.log('\n🗃️  botStore tests\n');

// ─── Schema ──────────────────────────────────────────────────

test('tables exist after first call', () => {
	// Trigger ensureTables by calling any function
	getRecentSnapshots(BOT, CHAIN, BASE, QUOTE, 1);

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
	assert.ok(idxs.includes('idx_obs_bot_chain_pair_ts'), 'snapshot index');
	assert.ok(idxs.includes('idx_th_bot_chain_pair_ts'), 'trades index');
	assert.ok(idxs.includes('idx_al_bot_chain_event_ts'), 'analysis index');
});

test('botName column exists in all tables', () => {
	const db = getDb();
	for (const table of ['order_book_snapshots', 'trades_history', 'bot_positions', 'analysis_log']) {
		const cols = db.pragma(`table_info(${table})`).map(c => c.name);
		assert.ok(cols.includes('botName'), `${table} has botName`);
	}
});

// ─── Order Book Snapshots ────────────────────────────────────

test('saveOrderBookSnapshot + getRecentSnapshots round-trip', () => {
	const book = {
		bids: Array.from({ length: 30 }, (_, i) => ({ price: 0.12 - i * 0.001, amount: 100 + i })),
		asks: Array.from({ length: 30 }, (_, i) => ({ price: 0.13 + i * 0.001, amount: 200 + i })),
		midPrice: 0.125,
		spreadPercent: 1.5,
	};

	saveOrderBookSnapshot(BOT, CHAIN, BASE, QUOTE, book);
	const rows = getRecentSnapshots(BOT, CHAIN, BASE, QUOTE, 5);

	assert.ok(rows.length >= 1, 'at least 1 snapshot');
	const row = rows[0];
	assert.strictEqual(row.chainName, CHAIN);
	assert.strictEqual(row.baseToken, BASE);
	assert.strictEqual(row.quoteToken, QUOTE);
	assert.strictEqual(row.botName, BOT);
	assert.strictEqual(row.midPrice, 0.125);
	assert.strictEqual(row.spreadPercent, 1.5);
});

test('snapshot stores only top 20 bids and 20 asks', () => {
	const rows = getRecentSnapshots(BOT, CHAIN, BASE, QUOTE, 1);
	assert.strictEqual(rows[0].bids.length, 20, 'top 20 bids');
	assert.strictEqual(rows[0].asks.length, 20, 'top 20 asks');
});

test('empty book is not saved', () => {
	const before = getRecentSnapshots(BOT, CHAIN, BASE, QUOTE, 100).length;
	saveOrderBookSnapshot(BOT, CHAIN, BASE, QUOTE, { bids: [], asks: [] });
	const after = getRecentSnapshots(BOT, CHAIN, BASE, QUOTE, 100).length;
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

	const changes = addTrade(BOT, CHAIN, BASE, QUOTE, trade);
	assert.strictEqual(changes, 1, 'inserted');

	const rows = getTradeHistory(BOT, CHAIN, BASE, QUOTE, 5);
	assert.ok(rows.length >= 1, 'at least 1 trade');
	const row = rows[0];
	assert.strictEqual(row.tradeId, 'test-trade-001');
	assert.strictEqual(row.price, 0.13);
	assert.strictEqual(row.type, 'BUY');
	assert.strictEqual(row.botName, BOT);
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

	const changes = addTrade(BOT, CHAIN, BASE, QUOTE, trade);
	assert.strictEqual(changes, 0, 'duplicate ignored');
});

test('addTrades batch insert + dedup', () => {
	const trades = [
		{ id: 'test-trade-002', timestamp: new Date().toISOString(), price: 0.131, amountBase: 100, amountQuote: 13.1, type: 'sell' },
		{ id: 'test-trade-003', timestamp: new Date().toISOString(), price: 0.129, amountBase: 200, amountQuote: 25.8, type: 'buy' },
		{ id: 'test-trade-001', timestamp: new Date().toISOString(), price: 0.13, amountBase: 500, amountQuote: 65, type: 'buy' }, // dupe
	];

	const inserted = addTrades(BOT, CHAIN, BASE, QUOTE, trades);
	assert.strictEqual(inserted, 2, '2 new, 1 dupe');
});

test('countTradesToday returns correct count', () => {
	const count = countTradesToday(BOT, CHAIN, BASE, QUOTE);
	assert.ok(count >= 3, `expected >=3, got ${count}`);
});

// ─── Positions ───────────────────────────────────────────────

test('updatePosition + getCurrentPosition round-trip', () => {
	updatePosition(BOT, CHAIN, BASE, QUOTE, {
		baseBalance: 1000.5,
		quoteBalance: 150.25,
		averageEntryPrice: 0.128,
	});

	const pos = getCurrentPosition(BOT, CHAIN, BASE, QUOTE);
	assert.ok(pos, 'position exists');
	assert.strictEqual(pos.baseBalance, 1000.5);
	assert.strictEqual(pos.quoteBalance, 150.25);
	assert.strictEqual(pos.averageEntryPrice, 0.128);
	assert.ok(pos.lastUpdated, 'has lastUpdated');
	assert.strictEqual(pos.botName, BOT);
});

test('updatePosition upserts correctly', () => {
	updatePosition(BOT, CHAIN, BASE, QUOTE, {
		baseBalance: 2000,
		quoteBalance: 300,
		averageEntryPrice: 0.13,
	});

	const pos = getCurrentPosition(BOT, CHAIN, BASE, QUOTE);
	assert.strictEqual(pos.baseBalance, 2000);
	assert.strictEqual(pos.quoteBalance, 300);
});

test('getCurrentPosition returns null for unknown pair', () => {
	const pos = getCurrentPosition('_nonexistent', '_none', 'X', 'Y');
	assert.strictEqual(pos, null);
});

// ─── Analysis Log ────────────────────────────────────────────

test('logAnalysisEvent inserts correctly', () => {
	logAnalysisEvent(BOT, {
		chainName: CHAIN,
		eventType: 'MODE_SWITCH',
		severity: 'WARN',
		message: 'normal → violent',
		data: { prev: 'normal', next: 'violent' },
	});

	logAnalysisEvent(BOT, {
		chainName: CHAIN,
		eventType: 'SNAPSHOT_TAKEN',
		severity: 'INFO',
		message: 'Book snapshot: mid 0.125',
		data: { midPrice: 0.125 },
		strategy: 'spread-capture',
	});

	const db = getDb();
	const rows = db.prepare(
		"SELECT * FROM analysis_log WHERE botName = ? AND chainName = ? ORDER BY id DESC LIMIT 2"
	).all(BOT, CHAIN);

	assert.strictEqual(rows.length, 2);
	assert.strictEqual(rows[0].eventType, 'SNAPSHOT_TAKEN');
	assert.strictEqual(rows[0].strategy, 'spread-capture');
	assert.strictEqual(rows[0].botName, BOT);
	assert.strictEqual(rows[1].eventType, 'MODE_SWITCH');
	assert.strictEqual(rows[1].severity, 'WARN');

	const parsed = JSON.parse(rows[1].data);
	assert.strictEqual(parsed.prev, 'normal');
});

// ─── Per-bot isolation ───────────────────────────────────────

test('two bots with same pair are isolated', () => {
	// BOT already has 3 trades from above — BOT2 should have 0
	const bot1Trades = getTradeHistory(BOT, CHAIN, BASE, QUOTE, 100);
	const bot2Trades = getTradeHistory(BOT2, CHAIN, BASE, QUOTE, 100);
	assert.ok(bot1Trades.length >= 3, 'bot1 has trades');
	assert.strictEqual(bot2Trades.length, 0, 'bot2 has no trades');

	// Insert a trade for BOT2 with the same tradeId — should succeed
	const changes = addTrade(BOT2, CHAIN, BASE, QUOTE, {
		id: 'test-trade-001',
		timestamp: new Date().toISOString(),
		price: 0.14,
		amountBase: 999,
		amountQuote: 139.86,
		type: 'sell',
	});
	assert.strictEqual(changes, 1, 'same tradeId allowed for different bot');

	const bot2Rows = getTradeHistory(BOT2, CHAIN, BASE, QUOTE, 5);
	assert.strictEqual(bot2Rows.length, 1, 'bot2 has 1 trade');
	assert.strictEqual(bot2Rows[0].price, 0.14);
});

test('positions are isolated per bot', () => {
	updatePosition(BOT2, CHAIN, BASE, QUOTE, {
		baseBalance: 50,
		quoteBalance: 10,
		averageEntryPrice: 0.2,
	});

	const pos1 = getCurrentPosition(BOT, CHAIN, BASE, QUOTE);
	const pos2 = getCurrentPosition(BOT2, CHAIN, BASE, QUOTE);
	assert.strictEqual(pos1.baseBalance, 2000, 'bot1 position unchanged');
	assert.strictEqual(pos2.baseBalance, 50, 'bot2 has own position');
});

// ─── Cross-bot aggregates ────────────────────────────────────

test('countAllTradesToday returns total across bots', () => {
	const total = countAllTradesToday();
	assert.ok(total >= 4, `expected >=4 (3 from BOT + 1 from BOT2), got ${total}`);
});

test('getAllBotPositions returns all positions', () => {
	const positions = getAllBotPositions();
	const testPositions = positions.filter(p => p.chainName === CHAIN);
	assert.ok(testPositions.length >= 2, `expected >=2 test positions, got ${testPositions.length}`);
});

// ─── Cleanup test data ──────────────────────────────────────

test('cleanup test data', () => {
	const db = getDb();
	for (const botN of [BOT, BOT2]) {
		db.exec(`DELETE FROM order_book_snapshots WHERE botName = '${botN}'`);
		db.exec(`DELETE FROM trades_history WHERE botName = '${botN}'`);
		db.exec(`DELETE FROM bot_positions WHERE botName = '${botN}'`);
		db.exec(`DELETE FROM analysis_log WHERE botName = '${botN}'`);
	}

	const count = db.prepare("SELECT COUNT(*) as c FROM order_book_snapshots WHERE botName = ?").get(BOT);
	assert.strictEqual(count.c, 0, 'cleaned up');
});

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
