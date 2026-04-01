// services/storage/sqlite.js
// SQLite database via better-sqlite3. Single-file, no server, synchronous reads.
// Used for structured data: executions, orders, PnL, market snapshots.

import Database from 'better-sqlite3';
import path from 'path';

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

let db = null;

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Returns the SQLite database instance (lazy-initialized singleton).
 */
export function getDb() {
	if (!db) {
		const dbPath = path.join(global.path.data, 'hq_blockchain.db');
		db = new Database(dbPath);
		db.pragma('journal_mode = WAL');  // Write-Ahead Logging for better concurrency
		db.pragma('foreign_keys = ON');
		console.info('DB', `SQLite database opened at ${dbPath}`);
	}
	return db;
}
