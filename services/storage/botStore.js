// services/storage/botStore.js
// Persistent SQLite storage for all bots (per-bot isolation via botName column).
// Four tables: order_book_snapshots, trades_history, bot_positions, analysis_log.
// Cache stays as source of truth — SQLite is for persistence and later analysis.

import { getDb } from './sqlite.js';

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

let initialized = false;

const SNAPSHOT_TOP_N = 20; // Store top 20 bids + top 20 asks per snapshot

// ####################################################################################################################################
// ###########################################################   SCHEMA   #############################################################
// ####################################################################################################################################

function ensureTables() {
	if (initialized) return;

	const db = getDb();

	// Create tables (without botName-dependent indexes — migration adds those)
	db.exec(`
CREATE TABLE IF NOT EXISTS order_book_snapshots (
id            INTEGER PRIMARY KEY AUTOINCREMENT,
botName       TEXT    NOT NULL DEFAULT 'steem-dex-bot',
timestamp     TEXT    NOT NULL,
chainName     TEXT    NOT NULL,
baseToken     TEXT    NOT NULL,
quoteToken    TEXT    NOT NULL,
bids          TEXT    NOT NULL,
asks          TEXT    NOT NULL,
midPrice      REAL,
spreadPercent REAL
);

CREATE TABLE IF NOT EXISTS trades_history (
id          INTEGER PRIMARY KEY AUTOINCREMENT,
botName     TEXT    NOT NULL DEFAULT 'steem-dex-bot',
timestamp   TEXT    NOT NULL,
chainName   TEXT    NOT NULL,
baseToken   TEXT    NOT NULL,
quoteToken  TEXT    NOT NULL,
tradeId     TEXT    NOT NULL,
price       REAL    NOT NULL,
amountBase  REAL    NOT NULL,
amountQuote REAL    NOT NULL,
type        TEXT    NOT NULL,
txId        TEXT,
UNIQUE(botName, chainName, baseToken, quoteToken, tradeId)
);

CREATE TABLE IF NOT EXISTS bot_positions (
botName           TEXT NOT NULL,
chainName         TEXT NOT NULL,
baseToken         TEXT NOT NULL,
quoteToken        TEXT NOT NULL,
baseBalance       REAL NOT NULL DEFAULT 0,
quoteBalance      REAL NOT NULL DEFAULT 0,
lastUpdated       TEXT NOT NULL,
averageEntryPrice REAL NOT NULL DEFAULT 0,
PRIMARY KEY (botName, chainName, baseToken, quoteToken)
);

CREATE TABLE IF NOT EXISTS analysis_log (
id        INTEGER PRIMARY KEY AUTOINCREMENT,
botName   TEXT    NOT NULL DEFAULT 'steem-dex-bot',
timestamp TEXT    NOT NULL,
chainName TEXT    NOT NULL,
eventType TEXT    NOT NULL,
severity  TEXT    NOT NULL DEFAULT 'INFO',
message   TEXT    NOT NULL,
data      TEXT,
strategy  TEXT
);
`);

	// Run migration (adds botName column to legacy tables), then create indexes
	migrate(db);

	db.exec(`
CREATE INDEX IF NOT EXISTS idx_obs_bot_chain_pair_ts
ON order_book_snapshots (botName, chainName, baseToken, quoteToken, timestamp);

CREATE INDEX IF NOT EXISTS idx_th_bot_chain_pair_ts
ON trades_history (botName, chainName, baseToken, quoteToken, timestamp);

CREATE INDEX IF NOT EXISTS idx_al_bot_chain_event_ts
ON analysis_log (botName, chainName, eventType, timestamp);
`);

	initialized = true;
	console.info('DB', 'BOT-STORE', 'Tables initialized (order_book_snapshots, trades_history, bot_positions, analysis_log)');
}

// ####################################################################################################################################
// ##########################################################   MIGRATION   ###########################################################
// ####################################################################################################################################

function migrate(db) {
	// Check if legacy tables exist without botName column
	const columns = db.pragma('table_info(order_book_snapshots)');
	if (!columns.length) return; // fresh db, CREATE above handled it
	const hasBotName = columns.some(c => c.name === 'botName');

	if (!hasBotName) {
		console.info('DB', 'BOT-STORE', 'Running migration: adding botName column to all tables');

		db.exec(`
ALTER TABLE order_book_snapshots ADD COLUMN botName TEXT NOT NULL DEFAULT 'steem-dex-bot';
ALTER TABLE analysis_log ADD COLUMN botName TEXT NOT NULL DEFAULT 'steem-dex-bot';
`);
	}

	// trades_history: ensure UNIQUE constraint includes botName (recreate if needed)
	const thSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='trades_history'").get()?.sql || '';
	if (!thSql.includes('UNIQUE(botName')) {
		console.info('DB', 'BOT-STORE', 'Recreating trades_history with botName in UNIQUE constraint');
		db.exec(`
CREATE TABLE trades_history_new (
id          INTEGER PRIMARY KEY AUTOINCREMENT,
botName     TEXT    NOT NULL DEFAULT 'steem-dex-bot',
timestamp   TEXT    NOT NULL,
chainName   TEXT    NOT NULL,
baseToken   TEXT    NOT NULL,
quoteToken  TEXT    NOT NULL,
tradeId     TEXT    NOT NULL,
price       REAL    NOT NULL,
amountBase  REAL    NOT NULL,
amountQuote REAL    NOT NULL,
type        TEXT    NOT NULL,
txId        TEXT,
UNIQUE(botName, chainName, baseToken, quoteToken, tradeId)
);
INSERT INTO trades_history_new (id, botName, timestamp, chainName, baseToken, quoteToken, tradeId, price, amountBase, amountQuote, type, txId)
SELECT id, COALESCE(botName, 'steem-dex-bot'), timestamp, chainName, baseToken, quoteToken, tradeId, price, amountBase, amountQuote, type, txId
FROM trades_history;
DROP TABLE trades_history;
ALTER TABLE trades_history_new RENAME TO trades_history;
`);
	}

	// bot_positions: ensure PK includes botName (recreate if needed)
	const bpSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bot_positions'").get()?.sql || '';
	if (!bpSql.includes('botName')) {
		console.info('DB', 'BOT-STORE', 'Recreating bot_positions with botName in PK');
		db.exec(`
CREATE TABLE bot_positions_new (
botName           TEXT NOT NULL,
chainName         TEXT NOT NULL,
baseToken         TEXT NOT NULL,
quoteToken        TEXT NOT NULL,
baseBalance       REAL NOT NULL DEFAULT 0,
quoteBalance      REAL NOT NULL DEFAULT 0,
lastUpdated       TEXT NOT NULL,
averageEntryPrice REAL NOT NULL DEFAULT 0,
PRIMARY KEY (botName, chainName, baseToken, quoteToken)
);
INSERT INTO bot_positions_new (botName, chainName, baseToken, quoteToken, baseBalance, quoteBalance, lastUpdated, averageEntryPrice)
SELECT COALESCE(botName, 'steem-dex-bot'), chainName, baseToken, quoteToken, baseBalance, quoteBalance, lastUpdated, averageEntryPrice
FROM bot_positions;
DROP TABLE bot_positions;
ALTER TABLE bot_positions_new RENAME TO bot_positions;
`);
	}

	// Recreate indexes to include botName
	db.exec(`
DROP INDEX IF EXISTS idx_obs_chain_pair_ts;
CREATE INDEX IF NOT EXISTS idx_obs_bot_chain_pair_ts ON order_book_snapshots (botName, chainName, baseToken, quoteToken, timestamp);

DROP INDEX IF EXISTS idx_th_chain_pair_ts;
CREATE INDEX IF NOT EXISTS idx_th_bot_chain_pair_ts ON trades_history (botName, chainName, baseToken, quoteToken, timestamp);

DROP INDEX IF EXISTS idx_al_chain_event_ts;
CREATE INDEX IF NOT EXISTS idx_al_bot_chain_event_ts ON analysis_log (botName, chainName, eventType, timestamp);
`);

	console.info('DB', 'BOT-STORE', 'Migration complete — botName column added to all tables');
}

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

// --- Prepared statements (lazy-initialized) ---

let _stmts = null;

function stmts() {
	if (_stmts) return _stmts;

	const db = getDb();
	_stmts = {
		insertSnapshot: db.prepare(`
INSERT INTO order_book_snapshots (botName, timestamp, chainName, baseToken, quoteToken, bids, asks, midPrice, spreadPercent)
VALUES (@botName, @timestamp, @chainName, @baseToken, @quoteToken, @bids, @asks, @midPrice, @spreadPercent)
`),
		insertTrade: db.prepare(`
INSERT OR IGNORE INTO trades_history (botName, timestamp, chainName, baseToken, quoteToken, tradeId, price, amountBase, amountQuote, type, txId)
VALUES (@botName, @timestamp, @chainName, @baseToken, @quoteToken, @tradeId, @price, @amountBase, @amountQuote, @type, @txId)
`),
		upsertPosition: db.prepare(`
INSERT INTO bot_positions (botName, chainName, baseToken, quoteToken, baseBalance, quoteBalance, lastUpdated, averageEntryPrice)
VALUES (@botName, @chainName, @baseToken, @quoteToken, @baseBalance, @quoteBalance, @lastUpdated, @averageEntryPrice)
ON CONFLICT(botName, chainName, baseToken, quoteToken) DO UPDATE SET
baseBalance       = @baseBalance,
quoteBalance      = @quoteBalance,
lastUpdated       = @lastUpdated,
averageEntryPrice = @averageEntryPrice
`),
		insertAnalysis: db.prepare(`
INSERT INTO analysis_log (botName, timestamp, chainName, eventType, severity, message, data, strategy)
VALUES (@botName, @timestamp, @chainName, @eventType, @severity, @message, @data, @strategy)
`),
		selectSnapshots: db.prepare(`
SELECT * FROM order_book_snapshots
WHERE botName = @botName AND chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
ORDER BY timestamp DESC LIMIT @limit
`),
		selectTrades: db.prepare(`
SELECT * FROM trades_history
WHERE botName = @botName AND chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
ORDER BY timestamp DESC LIMIT @limit
`),
		selectPosition: db.prepare(`
SELECT * FROM bot_positions
WHERE botName = @botName AND chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
`),
		countTradesToday: db.prepare(`
SELECT COUNT(*) as count FROM trades_history
WHERE botName = @botName AND chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
AND timestamp >= @todayStart
`),
		selectRecentAnalysis: db.prepare(`
SELECT id, timestamp, botName, chainName, eventType, severity, message, data, strategy
FROM analysis_log
WHERE botName = @botName AND chainName = @chainName
ORDER BY id DESC LIMIT @limit
`),
	};

	return _stmts;
}

// --- Writes ---

export function saveOrderBookSnapshot(botName, chainName, baseToken, quoteToken, book) {
	ensureTables();

	if (!book?.bids?.length && !book?.asks?.length) return;

	const row = {
		botName,
		timestamp: new Date().toISOString(),
		chainName,
		baseToken,
		quoteToken,
		bids: JSON.stringify((book.bids || []).slice(0, SNAPSHOT_TOP_N)),
		asks: JSON.stringify((book.asks || []).slice(0, SNAPSHOT_TOP_N)),
		midPrice: book.midPrice ?? null,
		spreadPercent: book.spreadPercent ?? null,
	};

	stmts().insertSnapshot.run(row);
	console.info('DB', chainName.toUpperCase(), 'Snapshot saved (mid: ' + (row.midPrice?.toFixed(4) ?? '-') + ')');
	return row;
}

export function addTrade(botName, chainName, baseToken, quoteToken, trade) {
	ensureTables();

	const row = {
		botName,
		timestamp: trade.timestamp ?? new Date().toISOString(),
		chainName,
		baseToken,
		quoteToken,
		tradeId: trade.id,
		price: trade.price,
		amountBase: trade.amountBase,
		amountQuote: trade.amountQuote,
		type: trade.type?.toUpperCase() ?? 'UNKNOWN',
		txId: trade.txId ?? null,
	};

	const result = stmts().insertTrade.run(row);
	return result.changes;
}

export function addTrades(botName, chainName, baseToken, quoteToken, trades) {
	ensureTables();

	if (!trades?.length) return 0;

	const db = getDb();
	let inserted = 0;

	const runBatch = db.transaction(() => {
		for (const trade of trades) {
			inserted += addTrade(botName, chainName, baseToken, quoteToken, trade);
		}
	});

	runBatch();

	if (inserted > 0) {
		console.info('DB', chainName.toUpperCase(), inserted + ' new trade(s) persisted');
	}

	return inserted;
}

export function updatePosition(botName, chainName, baseToken, quoteToken, balances) {
	ensureTables();

	const row = {
		botName,
		chainName,
		baseToken,
		quoteToken,
		baseBalance: balances.baseBalance ?? 0,
		quoteBalance: balances.quoteBalance ?? 0,
		lastUpdated: new Date().toISOString(),
		averageEntryPrice: balances.averageEntryPrice ?? 0,
	};

	stmts().upsertPosition.run(row);
	console.info('DB', chainName.toUpperCase(), 'Position updated (' + baseToken + ': ' + row.baseBalance + ', ' + quoteToken + ': ' + row.quoteBalance + ')');
	return row;
}

export function logAnalysisEvent(botName, event) {
	ensureTables();

	const row = {
		botName,
		timestamp: event.timestamp ?? new Date().toISOString(),
		chainName: event.chainName,
		eventType: event.eventType,
		severity: event.severity ?? 'INFO',
		message: event.message,
		data: event.data ? JSON.stringify(event.data) : null,
		strategy: event.strategy ?? null,
	};

	stmts().insertAnalysis.run(row);
}

// --- Reads ---

export function getRecentSnapshots(botName, chainName, baseToken, quoteToken, limit = 10) {
	ensureTables();

	const rows = stmts().selectSnapshots.all({ botName, chainName, baseToken, quoteToken, limit });
	return rows.map(r => ({
		...r,
		bids: JSON.parse(r.bids),
		asks: JSON.parse(r.asks),
	}));
}

export function getTradeHistory(botName, chainName, baseToken, quoteToken, limit = 50) {
	ensureTables();
	return stmts().selectTrades.all({ botName, chainName, baseToken, quoteToken, limit });
}

export function getCurrentPosition(botName, chainName, baseToken, quoteToken) {
	ensureTables();
	return stmts().selectPosition.get({ botName, chainName, baseToken, quoteToken }) ?? null;
}

export function getRecentAnalysisLogs(botName, chainName, limit = 10) {
	ensureTables();
	return stmts().selectRecentAnalysis.all({ botName, chainName, limit });
}

export function countTradesToday(botName, chainName, baseToken, quoteToken) {
	ensureTables();
	const todayStart = new Date();
	todayStart.setUTCHours(0, 0, 0, 0);
	const row = stmts().countTradesToday.get({ botName, chainName, baseToken, quoteToken, todayStart: todayStart.toISOString() });
	return row?.count ?? 0;
}

// --- Date-range reads (analysis scripts) ---

export function getAnalysisLogsByDateRange(botName, chainName, since, until) {
	ensureTables();
	const db = getDb();
	return db.prepare(`
SELECT id, timestamp, botName, chainName, eventType, severity, message, data, strategy
FROM analysis_log
WHERE botName = @botName AND chainName = @chainName AND timestamp >= @since AND timestamp <= @until
ORDER BY timestamp ASC
`).all({ botName, chainName, since, until });
}

export function getAnalysisLogsPaginated(botName, chainName, opts) {
	ensureTables();
	const db = getDb();
	const { limit: rawLimit = 50, beforeId = null, eventType = null, severity = null, search = null } = opts || {};
	const limit = rawLimit;

	let sql = 'SELECT id, timestamp, botName, chainName, eventType, severity, message, data, strategy FROM analysis_log WHERE botName = @botName AND chainName = @chainName';
	const params = { botName, chainName, limit };

	if (beforeId) { sql += ' AND id < @beforeId'; params.beforeId = beforeId; }
	if (eventType) { sql += ' AND eventType = @eventType'; params.eventType = eventType; }
	if (severity) { sql += ' AND severity = @severity'; params.severity = severity; }
	if (search) { sql += ' AND message LIKE @search'; params.search = '%' + search + '%'; }

	sql += ' ORDER BY id DESC LIMIT @limit';
	return db.prepare(sql).all(params);
}

export function getDistinctEventTypes(botName, chainName) {
	ensureTables();
	const db = getDb();
	return db.prepare('SELECT DISTINCT eventType FROM analysis_log WHERE botName = @botName AND chainName = @chainName ORDER BY eventType')
		.all({ botName, chainName }).map(r => r.eventType);
}

export function getSnapshotsByDateRange(botName, chainName, baseToken, quoteToken, since, until) {
	ensureTables();
	const db = getDb();
	const rows = db.prepare(`
SELECT * FROM order_book_snapshots
WHERE botName = @botName AND chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
      AND timestamp >= @since AND timestamp <= @until
ORDER BY timestamp ASC
`).all({ botName, chainName, baseToken, quoteToken, since, until });
	return rows.map(r => ({ ...r, bids: JSON.parse(r.bids), asks: JSON.parse(r.asks) }));
}

export function getTradesByDateRange(botName, chainName, baseToken, quoteToken, since, until) {
	ensureTables();
	const db = getDb();
	return db.prepare(`
SELECT * FROM trades_history
WHERE botName = @botName AND chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
      AND timestamp >= @since AND timestamp <= @until
ORDER BY timestamp ASC
`).all({ botName, chainName, baseToken, quoteToken, since, until });
}

// --- Cross-bot aggregates ---

export function countAllTradesToday() {
	ensureTables();
	const db = getDb();
	const today = new Date().toISOString().slice(0, 10);
	return db.prepare('SELECT COUNT(*) as count FROM trades_history WHERE timestamp >= ?').get(today + 'T00:00:00Z').count;
}

export function getAllBotPositions() {
	ensureTables();
	const db = getDb();
	return db.prepare('SELECT * FROM bot_positions').all();
}
