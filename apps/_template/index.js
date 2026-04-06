/**
 * Bot Template — Copy this folder and rename to create a new bot.
 *
 * Steps:
 * 1. Copy `apps/_template/` → `apps/your-bot-name/`
 * 2. Edit `config.json` — set name, chain, pairs, strategies
 * 3. Edit `index.js` — update meta, implement collectData() and runStrategy()
 * 4. Start the server — your bot auto-discovers and registers
 */

import { getEffectiveConfig, registerStaticConfig, getBotControl } from '../../services/dynamicConfig/index.js';
import {
	initBotCache,
	getBotData,
	updateAccountData,
	updateStrategyStatus,
	updateBotControlState,
} from '../../services/cache/index.js';
import {
	saveOrderBookSnapshot,
	addTrade,
	logAnalysisEvent,
	getCurrentPosition,
} from '../../services/storage/index.js';

// ─── META ───────────────────────────────────────────────────────────
// Required. Used by botRegistry for identification and dashboard display.
export const meta = {
	name: 'your-bot-name',           // Must match folder name and config.json name
	displayName: 'Your Bot Name',    // Human-readable, shown in dashboard
	chain: 'chain-name',             // e.g. 'steem', 'ethereum', 'solana'
	pairs: ['TOKEN_A/TOKEN_B'],      // Trading pairs
	description: 'One-line description of what this bot does.',
};

// ─── STATE ──────────────────────────────────────────────────────────
const BOT_NAME = meta.name;
let dataCollectionActive = false;
let tradingActive = false;
let dataInterval = null;
let tradeInterval = null;

// ─── LIFECYCLE: init ────────────────────────────────────────────────
// Called once at boot. Load config, register with services. Do NOT start yet.
export async function init() {
	const config = await import('./config.json', { assert: { type: 'json' } });
	registerStaticConfig(BOT_NAME, config.default);
	initBotCache(BOT_NAME);

	console.info('BOT', BOT_NAME.toUpperCase(), 'Initialized');
}

// ─── LIFECYCLE: startDataCollection ─────────────────────────────────
// Begin fetching market data. Independent of trading.
export async function startDataCollection() {
	if (dataCollectionActive) return;
	dataCollectionActive = true;

	// TODO: Replace with your data collection logic
	// Example: fetch order book, prices, etc. on an interval
	const config = getEffectiveConfig(BOT_NAME);
	const intervalMs = config.dataCollectionIntervalMs || 10_000;
	dataInterval = setInterval(() => collectData(), intervalMs);
	await collectData(); // run once immediately

	console.info('BOT', BOT_NAME.toUpperCase(), 'Data collection started');
}

// ─── LIFECYCLE: stopDataCollection ──────────────────────────────────
// Stop market data feeds. Auto-stops trading first if active.
export async function stopDataCollection() {
	if (tradingActive) await stopBot();
	clearInterval(dataInterval);
	dataInterval = null;
	dataCollectionActive = false;

	console.info('BOT', BOT_NAME.toUpperCase(), 'Data collection stopped');
}

// ─── LIFECYCLE: startBot ────────────────────────────────────────────
// Engage trading strategies. Auto-starts data collection if inactive.
export async function startBot() {
	if (tradingActive) return;
	if (!dataCollectionActive) await startDataCollection();
	tradingActive = true;
	updateBotControlState(BOT_NAME, { ...getBotControl(BOT_NAME), enabled: true });

	// TODO: Replace with your strategy execution logic
	const config = getEffectiveConfig(BOT_NAME);
	const intervalMs = config.strategyIntervalMs || 30_000;
	tradeInterval = setInterval(() => runStrategy(), intervalMs);

	console.info('BOT', BOT_NAME.toUpperCase(), 'Trading started');
}

// ─── LIFECYCLE: stopBot ─────────────────────────────────────────────
// Stop trading. Keep data feeds alive.
export async function stopBot() {
	clearInterval(tradeInterval);
	tradeInterval = null;
	tradingActive = false;
	updateBotControlState(BOT_NAME, { ...getBotControl(BOT_NAME), enabled: false });

	console.info('BOT', BOT_NAME.toUpperCase(), 'Trading stopped');
}

// ─── LIFECYCLE: shutdown ────────────────────────────────────────────
// Full cleanup. Called on process exit.
export async function shutdown() {
	await stopDataCollection();
	console.info('BOT', BOT_NAME.toUpperCase(), 'Shutdown complete');
}

// ─── LIFECYCLE: getStatus ───────────────────────────────────────────
// Returns current operational status. Called by dashboard and health checks.
export function getStatus() {
	return {
		dataCollection: dataCollectionActive,
		trading: tradingActive,
		error: null,
	};
}

// ─── YOUR CODE ──────────────────────────────────────────────────────

async function collectData() {
	// TODO: Implement your data collection
	// - Fetch prices from connector:
	//     import { getChain } from '../../connectors/chains/registry.js';
	//     const chain = getChain('steem');
	// - Update cache:
	//     updateAccountData(BOT_NAME, { balance: ..., available: ... });
	// - Save to storage:
	//     saveOrderBookSnapshot(BOT_NAME, chain, base, quote, book);
}

async function runStrategy() {
	// TODO: Implement your trading strategy
	// - Read latest data from cache:
	//     const data = getBotData(BOT_NAME);
	// - Read config:
	//     const config = getEffectiveConfig(BOT_NAME);
	// - Run strategy logic (from strategies/ folder)
	// - Build and execute orders (from core/execution/)
	// - Update strategy status:
	//     updateStrategyStatus(BOT_NAME, { lastRun: Date.now(), ... });
	// - Log results:
	//     logAnalysisEvent(BOT_NAME, { eventType: 'strategy_run', ... });
}
