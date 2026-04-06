// services/storage/steemDexStore.js
// Persistent SQLite storage for the STEEM DEX Bot (and future multi-chain bots).
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

	db.exec(`
		CREATE TABLE IF NOT EXISTS order_book_snapshots (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp     TEXT    NOT NULL,
			chainName     TEXT    NOT NULL,
			baseToken     TEXT    NOT NULL,
			quoteToken    TEXT    NOT NULL,
			bids          TEXT    NOT NULL,
			asks          TEXT    NOT NULL,
			midPrice      REAL,
			spreadPercent REAL
		);

		CREATE INDEX IF NOT EXISTS idx_obs_chain_pair_ts
			ON order_book_snapshots (chainName, baseToken, quoteToken, timestamp);

		CREATE TABLE IF NOT EXISTS trades_history (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
			UNIQUE(chainName, baseToken, quoteToken, tradeId)
		);

		CREATE INDEX IF NOT EXISTS idx_th_chain_pair_ts
			ON trades_history (chainName, baseToken, quoteToken, timestamp);

		CREATE TABLE IF NOT EXISTS bot_positions (
			chainName         TEXT NOT NULL,
			baseToken         TEXT NOT NULL,
			quoteToken        TEXT NOT NULL,
			baseBalance       REAL NOT NULL DEFAULT 0,
			quoteBalance      REAL NOT NULL DEFAULT 0,
			lastUpdated       TEXT NOT NULL,
			averageEntryPrice REAL NOT NULL DEFAULT 0,
			PRIMARY KEY (chainName, baseToken, quoteToken)
		);

		CREATE TABLE IF NOT EXISTS analysis_log (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT    NOT NULL,
			chainName TEXT    NOT NULL,
			eventType TEXT    NOT NULL,
			severity  TEXT    NOT NULL DEFAULT 'INFO',
			message   TEXT    NOT NULL,
			data      TEXT,
			strategy  TEXT
		);

		CREATE INDEX IF NOT EXISTS idx_al_chain_event_ts
			ON analysis_log (chainName, eventType, timestamp);
	`);

	initialized = true;
	console.info('DB', 'STEEM-DEX', 'Tables initialized (order_book_snapshots, trades_history, bot_positions, analysis_log)');
}

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

// ─── Prepared statements (lazy-initialized) ──────────────────

let _stmts = null;

function stmts() {
	if (_stmts) return _stmts;

	const db = getDb();
	_stmts = {
		insertSnapshot: db.prepare(`
			INSERT INTO order_book_snapshots (timestamp, chainName, baseToken, quoteToken, bids, asks, midPrice, spreadPercent)
			VALUES (@timestamp, @chainName, @baseToken, @quoteToken, @bids, @asks, @midPrice, @spreadPercent)
		`),
		insertTrade: db.prepare(`
			INSERT OR IGNORE INTO trades_history (timestamp, chainName, baseToken, quoteToken, tradeId, price, amountBase, amountQuote, type, txId)
			VALUES (@timestamp, @chainName, @baseToken, @quoteToken, @tradeId, @price, @amountBase, @amountQuote, @type, @txId)
		`),
		upsertPosition: db.prepare(`
			INSERT INTO bot_positions (chainName, baseToken, quoteToken, baseBalance, quoteBalance, lastUpdated, averageEntryPrice)
			VALUES (@chainName, @baseToken, @quoteToken, @baseBalance, @quoteBalance, @lastUpdated, @averageEntryPrice)
			ON CONFLICT(chainName, baseToken, quoteToken) DO UPDATE SET
				baseBalance       = @baseBalance,
				quoteBalance      = @quoteBalance,
				lastUpdated       = @lastUpdated,
				averageEntryPrice = @averageEntryPrice
		`),
		insertAnalysis: db.prepare(`
			INSERT INTO analysis_log (timestamp, chainName, eventType, severity, message, data, strategy)
			VALUES (@timestamp, @chainName, @eventType, @severity, @message, @data, @strategy)
		`),
		selectSnapshots: db.prepare(`
			SELECT * FROM order_book_snapshots
			WHERE chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
			ORDER BY timestamp DESC LIMIT @limit
		`),
		selectTrades: db.prepare(`
			SELECT * FROM trades_history
			WHERE chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
			ORDER BY timestamp DESC LIMIT @limit
		`),
		selectPosition: db.prepare(`
			SELECT * FROM bot_positions
			WHERE chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
		`),
		countTradesToday: db.prepare(`
			SELECT COUNT(*) as count FROM trades_history
			WHERE chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
			AND timestamp >= @todayStart
		`),
		selectRecentAnalysis: db.prepare(`
			SELECT id, timestamp, chainName, eventType, severity, message, data, strategy
			FROM analysis_log
			WHERE chainName = @chainName
			ORDER BY id DESC LIMIT @limit
		`),
	};

	return _stmts;
}

// ─── Writes ──────────────────────────────────────────────────

/**
 * Save a snapshot of the live order book (top 20 bids + 20 asks).
 * @param {string} chainName
 * @param {string} baseToken
 * @param {string} quoteToken
 * @param {Object} book — normalized order book from cache
 */
export function saveOrderBookSnapshot(chainName, baseToken, quoteToken, book) {
	ensureTables();

	if (!book?.bids?.length && !book?.asks?.length) return;

	const row = {
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
	console.info('DB', chainName.toUpperCase(), `📸 Snapshot saved (mid: ${row.midPrice?.toFixed(4) ?? '—'})`);
	return row;
}

/**
 * Record a trade. Duplicates (same tradeId) are silently ignored.
 * @param {string} chainName
 * @param {string} baseToken
 * @param {string} quoteToken
 * @param {Object} trade — normalized trade from connector
 * @returns {number} 0 if duplicate, 1 if inserted
 */
export function addTrade(chainName, baseToken, quoteToken, trade) {
	ensureTables();

	const row = {
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

/**
 * Batch-insert trades inside a transaction for efficiency.
 * @returns {number} count of newly inserted trades (ignoring duplicates)
 */
export function addTrades(chainName, baseToken, quoteToken, trades) {
	ensureTables();

	if (!trades?.length) return 0;

	const db = getDb();
	let inserted = 0;

	const runBatch = db.transaction(() => {
		for (const trade of trades) {
			inserted += addTrade(chainName, baseToken, quoteToken, trade);
		}
	});

	runBatch();

	if (inserted > 0) {
		console.info('DB', chainName.toUpperCase(), `💾 ${inserted} new trade(s) persisted`);
	}

	return inserted;
}

/**
 * Create or update the bot's position for a chain + pair.
 */
export function updatePosition(chainName, baseToken, quoteToken, balances) {
	ensureTables();

	const row = {
		chainName,
		baseToken,
		quoteToken,
		baseBalance: balances.baseBalance ?? 0,
		quoteBalance: balances.quoteBalance ?? 0,
		lastUpdated: new Date().toISOString(),
		averageEntryPrice: balances.averageEntryPrice ?? 0,
	};

	stmts().upsertPosition.run(row);
	console.info('DB', chainName.toUpperCase(), `📍 Position updated (${baseToken}: ${row.baseBalance}, ${quoteToken}: ${row.quoteBalance})`);
	return row;
}

/**
 * Log a rich analysis event.
 */
export function logAnalysisEvent(event) {
	ensureTables();

	const row = {
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

// ─── Reads ───────────────────────────────────────────────────

/**
 * Get the N most recent order book snapshots.
 */
export function getRecentSnapshots(chainName, baseToken, quoteToken, limit = 10) {
	ensureTables();

	const rows = stmts().selectSnapshots.all({ chainName, baseToken, quoteToken, limit });
	return rows.map(r => ({
		...r,
		bids: JSON.parse(r.bids),
		asks: JSON.parse(r.asks),
	}));
}

/**
 * Get the N most recent trades.
 */
export function getTradeHistory(chainName, baseToken, quoteToken, limit = 50) {
	ensureTables();
	return stmts().selectTrades.all({ chainName, baseToken, quoteToken, limit });
}

/**
 * Get the current position for a chain + pair.
 */
export function getCurrentPosition(chainName, baseToken, quoteToken) {
	ensureTables();
	return stmts().selectPosition.get({ chainName, baseToken, quoteToken }) ?? null;
}

/**
 * Get the N most recent analysis log entries for a chain.
 */
export function getRecentAnalysisLogs(chainName, limit = 10) {
	ensureTables();
	return stmts().selectRecentAnalysis.all({ chainName, limit });
}

/**
 * Count trades persisted today for a chain + pair.
 */
export function countTradesToday(chainName, baseToken, quoteToken) {
	ensureTables();
	const todayStart = new Date();
	todayStart.setUTCHours(0, 0, 0, 0);
	const row = stmts().countTradesToday.get({ chainName, baseToken, quoteToken, todayStart: todayStart.toISOString() });
	return row?.count ?? 0;
}

// ─── Date-range reads (Step 15 — analysis scripts) ──────────

/**
 * Get analysis log entries for a chain within a date range.
 * @param {string} chainName
 * @param {string} since  — ISO 8601 start (inclusive)
 * @param {string} until  — ISO 8601 end   (inclusive)
 * @returns {Array}
 */
export function getAnalysisLogsByDateRange(chainName, since, until) {
	ensureTables();
	const db = getDb();
	return db.prepare(`
		SELECT id, timestamp, chainName, eventType, severity, message, data, strategy
		FROM analysis_log
		WHERE chainName = @chainName AND timestamp >= @since AND timestamp <= @until
		ORDER BY timestamp ASC
	`).all({ chainName, since, until });
}

/**
 * Paginated analysis logs with optional filters.
 * Cursor-based: pass beforeId (smallest id from previous page) for next page.
 */
export function getAnalysisLogsPaginated(chainName, { limit = 50, beforeId = null, eventType = null, severity = null, search = null } = {}) {
	ensureTables();
	const db = getDb();

	let sql = `SELECT id, timestamp, chainName, eventType, severity, message, data, strategy
	           FROM analysis_log WHERE chainName = @chainName`;
	const params = { chainName, limit };

	if (beforeId) { sql += ` AND id < @beforeId`; params.beforeId = beforeId; }
	if (eventType) { sql += ` AND eventType = @eventType`; params.eventType = eventType; }
	if (severity) { sql += ` AND severity = @severity`; params.severity = severity; }
	if (search) { sql += ` AND message LIKE @search`; params.search = '%' + search + '%'; }

	sql += ` ORDER BY id DESC LIMIT @limit`;
	return db.prepare(sql).all(params);
}

/**
 * Get distinct event types from analysis_log (for filter dropdown).
 */
export function getDistinctEventTypes(chainName) {
	ensureTables();
	const db = getDb();
	return db.prepare(`SELECT DISTINCT eventType FROM analysis_log WHERE chainName = @chainName ORDER BY eventType`)
		.all({ chainName }).map(r => r.eventType);
}

/**
 * Get order book snapshots for a chain+pair within a date range.
 */
export function getSnapshotsByDateRange(chainName, baseToken, quoteToken, since, until) {
	ensureTables();
	const db = getDb();
	const rows = db.prepare(`
		SELECT * FROM order_book_snapshots
		WHERE chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
		      AND timestamp >= @since AND timestamp <= @until
		ORDER BY timestamp ASC
	`).all({ chainName, baseToken, quoteToken, since, until });
	return rows.map(r => ({ ...r, bids: JSON.parse(r.bids), asks: JSON.parse(r.asks) }));
}

/**
 * Get trades for a chain+pair within a date range.
 */
export function getTradesByDateRange(chainName, baseToken, quoteToken, since, until) {
	ensureTables();
	const db = getDb();
	return db.prepare(`
		SELECT * FROM trades_history
		WHERE chainName = @chainName AND baseToken = @baseToken AND quoteToken = @quoteToken
		      AND timestamp >= @since AND timestamp <= @until
		ORDER BY timestamp ASC
	`).all({ chainName, baseToken, quoteToken, since, until });
}
