// services/storage/index.js
// Aggregates all storage functions — SQLite, file I/O, snapshots.

export { getDb } from './sqlite.js';
// export { appendJsonl, readJson, writeJson } from './files.js';
// export { saveSnapshot, loadLatestSnapshot } from './snapshots.js';

export {
	saveOrderBookSnapshot,
	addTrade,
	addTrades,
	updatePosition,
	logAnalysisEvent,
	getRecentSnapshots,
	getTradeHistory,
	getCurrentPosition,
	countTradesToday,
	getRecentAnalysisLogs,
	countAllTradesToday,
	getAllBotPositions,
} from './botStore.js';
