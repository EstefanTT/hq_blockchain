// apps/steem-dex-bot/index.js
// STEEM/SBD DEX trading bot — multi-chain ready skeleton.
// Wires the price engine (Step 1), chain connector (Step 2), SQLite storage (Step 3),
// and order operations (Step 4). Double logging via botLogger (Step 5).
// Micro layer market-making (Step 6). Market-making strategy (Step 7). Brain (Step 8).
// Aggressive sniping (Step 9). Grid/Range (Step 10). Mean-reversion (Step 11). Defensive/Pause (Step 12).
// Risk & Rebalance Layer + Bot-Exploitation (Step 13).
// Full Integration + Dry-Run Mode (Step 14).
// Dashboard improvement: init() = data feeds only, startBot()/stopBot() = trading lifecycle.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBotLogger } from '../../services/logger/botLogger.js';
import { registerStaticConfig, getEffectiveConfig, getBotControl, setBotControl, isStrategyDisabled } from '../../services/dynamicConfig/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticConfig = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const BOT_NAME = staticConfig.name;

export const meta = {
	name: 'steem-dex-bot',
	displayName: 'STEEM DEX Bot',
	chain: 'steem',
	pairs: ['STEEM/SBD'],
	description: 'Market-making and multi-strategy trading on the Steem internal DEX',
};

const SNAPSHOT_INTERVAL_MS = 30_000;     // 30s periodic order book snapshots
const ACCOUNT_REFRESH_MS = 60_000;       // 60s periodic account data refresh

const log = createBotLogger({ botName: BOT_NAME, chainName: staticConfig.chainName });

let priceEngine = null;
let chainAdapter = null;
let snapshotTimer = null;
let accountTimer = null;
let tradingActive = false;          // true when brain + strategies are running
let dataCollectionActive = false;   // true when price engine + chain poller are running
let operationsReady = false;        // true when chain credentials are set up
let initDone = false;               // true after init() completes (modules loaded)

// Module-level references set by init(), used by startBot()/stopBot()
let cacheKey = null;
let cacheModule = null;

// ####################################################################################################################################
// ###########################################################   INIT   ###############################################################
// ####################################################################################################################################

/**
 * Phase 1: Initialize modules (price engine, chain connector, snapshots).
 * Sets up all components but only starts data collection if persisted flag says so.
 * Does NOT start trading — call startBot() for that.
 */
export async function init() {
	if (!staticConfig.enabled) {
		log.info('BOT', '⏸️  Disabled in config — skipping');
		return;
	}

	// Register with dynamic config system
	registerStaticConfig(BOT_NAME, staticConfig);

	log.info('BOT', '🚀 Initializing STEEM DEX Bot...', { nodes: staticConfig.nodes });
	log.info('BOT', `Chain: ${staticConfig.chainName} | Base: ${staticConfig.baseToken.symbol} | Quote: ${staticConfig.quoteToken.symbol}`);

	const config = getEffectiveConfig(BOT_NAME);

	// Initialize SQLite tables
	const { saveOrderBookSnapshot, addTrades, getCurrentPosition, countTradesToday } = await import('../../services/storage/botStore.js');
	cacheModule = await import('../../services/cache/index.js');
	const { getLiveOrderBook, updateStorageStats, updateBotControlState, getBotData } = cacheModule;

	// Initialize per-bot cache namespace
	cacheModule.initBotCache(BOT_NAME);

	const { chainName } = config;
	const base = config.baseToken.symbol;
	const quote = config.quoteToken.symbol;
	cacheKey = `${chainName}:${base}/${quote}`;

	// Push initial bot control state to cache
	updateBotControlState(BOT_NAME, getBotControl(BOT_NAME));

	// Seed storage stats from DB
	const pos = getCurrentPosition(BOT_NAME, chainName, base, quote);
	const tradesToday = countTradesToday(BOT_NAME, chainName, base, quote);
	updateStorageStats(BOT_NAME, { tradesToday, currentPosition: pos });

	// Create the price engine (but don't start yet)
	const { PriceEngine } = await import('../../core/market/priceEngine.js');
	priceEngine = new PriceEngine({
		chainName: config.chainName,
		baseToken: config.baseToken,
		quoteToken: config.quoteToken,
		logger: log,
	});

	// Create the chain connector (but don't start yet)
	const { createSteemLikeAdapter } = await import('../../connectors/chains/steem-like/index.js');
	chainAdapter = createSteemLikeAdapter({
		chainName: config.chainName,
		nodes: config.nodes,
		baseToken: config.baseToken,
		quoteToken: config.quoteToken,
	});

	// Subscribe to trades → persist + notify strategies (only fires when data collection is active)
	const { onTradeEvent } = await import('../../strategies/market-making/microLayer.js');
	const { onMMTradeEvent } = await import('../../strategies/market-making/index.js');
	const { onSnipeTradeEvent } = await import('../../strategies/aggressive-sniping/index.js');
	const { onGridTradeEvent } = await import('../../strategies/grid-range/index.js');
	const { onMeanReversionTradeEvent } = await import('../../strategies/mean-reversion/index.js');
	const { onDefensiveTradeEvent } = await import('../../strategies/defensive-pause/index.js');
	const { onBotExploitTradeEvent } = await import('../../strategies/bot-exploitation/index.js');
	const { onRebalanceTradeEvent } = await import('../../core/risk/rebalance.js');
	chainAdapter.subscribe('trade', (trade) => {
		const inserted = addTrades(BOT_NAME, chainName, base, quote, [trade]);
		if (inserted > 0) {
			updateStorageStats(BOT_NAME, { tradesToday: (countTradesToday(BOT_NAME, chainName, base, quote)) });
			log.info('TRADE', `${trade.type.toUpperCase()} ${trade.amountBase} ${base} @ ${trade.price.toFixed(4)}`, trade);
		}
		onTradeEvent(trade);
		onMMTradeEvent(trade);
		onSnipeTradeEvent(trade);
		onGridTradeEvent(trade);
		onMeanReversionTradeEvent(trade);
		onDefensiveTradeEvent(trade);
		onBotExploitTradeEvent(trade);
		// Only run rebalance if trading is active
		if (tradingActive) onRebalanceTradeEvent(trade);
	});

	// ─── Initialize order operations (Step 4) ────────────────────
	const steemAccount = process.env.STEEM_ACCOUNT;
	const steemActiveKey = process.env.STEEM_ACTIVE_KEY;

	if (steemAccount && steemActiveKey) {
		chainAdapter.initOperations({ account: steemAccount, activeKey: steemActiveKey, logger: log });

		// Install dry-run wrapper
		const { createDryRunWrapper, setDryRun } = await import('../../core/execution/dryRun.js');
		setDryRun(config.dryRun ?? false);
		cacheModule.setDryRunFlag(BOT_NAME, config.dryRun ?? false);
		const { wrappedPlace, wrappedCancel } = createDryRunWrapper(chainAdapter, log);
		chainAdapter.placeLimitOrder = wrappedPlace;
		chainAdapter.cancelOrder = wrappedCancel;
		if (config.dryRun) log.info('BOT', '🧪 DRY-RUN mode active — no real orders will be broadcast');

		// Install slippage guard
		if (config.risk) {
			const { createSlippageGuard } = await import('../../core/risk/slippageCheck.js');
			chainAdapter.placeLimitOrder = createSlippageGuard(chainAdapter, config.risk, log, (fields) => cacheModule.updateRiskStatus(BOT_NAME, fields));
			log.info('RISK', '🛡️ Slippage guard installed', { maxSlippage: `${config.risk.maxAllowedSlippagePercent}%` });
		}

		// Initialize rebalance safety net
		if (config.risk) {
			const { initRebalance } = await import('../../core/risk/rebalance.js');
			initRebalance({
				adapter: chainAdapter,
				logger: log,
				config: config.risk,
				cacheKey,
				getSteemDexBotData: () => getBotData(BOT_NAME),
				updateRiskStatus: (fields) => cacheModule.updateRiskStatus(BOT_NAME, fields),
			});
		}

		operationsReady = true;
	} else {
		log.warn('WALLET', '⚠️  STEEM_ACCOUNT / STEEM_ACTIVE_KEY not set — operations disabled');
	}

	initDone = true;

	// Auto-start data collection if persisted flag says so
	const control = getBotControl(BOT_NAME);
	if (control.dataCollection) {
		await startDataCollection();
	}

	log.info('BOT', `✅ STEEM DEX Bot initialized (data: ${dataCollectionActive ? 'ON' : 'OFF'}, trading: OFF)`);
}

// ####################################################################################################################################
// ####################################################   DATA COLLECTION   ###########################################################
// ####################################################################################################################################

/** Account refresh helper — fetches balances, open orders, RC from chain. */
async function refreshAccountData() {
	try {
		const [balances, openOrders, rc] = await Promise.all([
			chainAdapter.getAccountBalances(),
			chainAdapter.getOpenOrders(),
			chainAdapter.getAccountRC(),
		]);
		cacheModule.updateAccountData(BOT_NAME, {
			account: balances.account,
			balance: balances.balance,
			quoteBalance: balances.quoteBalance,
			vestingShares: balances.vestingShares,
			openOrders,
			rc,
			lastRefresh: new Date().toISOString(),
		});
	} catch (err) {
		log.warn('WALLET', `Account refresh failed: ${err.message}`, { error: err.message });
	}
}

/**
 * Start data collection: price engine, chain poller, snapshots, account refresh.
 * Called when user toggles Data ON. Also auto-called when Bot is turned ON.
 */
export async function startDataCollection() {
	if (dataCollectionActive) return;
	if (!initDone) {
		log.warn('BOT', '⚠️ Cannot start data collection — init not complete');
		return;
	}

	dataCollectionActive = true;
	setBotControl(BOT_NAME, { dataCollection: true });
	cacheModule.updateBotControlState(BOT_NAME, getBotControl(BOT_NAME));

	log.info('BOT', '📡 Starting data collection...');

	// Start price engine
	await priceEngine.start();

	// Start chain poller
	await chainAdapter.start();

	// Start account refresh timer
	if (operationsReady) {
		await refreshAccountData();
		accountTimer = setInterval(refreshAccountData, ACCOUNT_REFRESH_MS);
	}

	// Start periodic order book snapshots
	const { saveOrderBookSnapshot } = await import('../../services/storage/botStore.js');
	const { getLiveOrderBook, updateStorageStats, getBotData: getBotDataFn } = cacheModule;
	const config = getEffectiveConfig(BOT_NAME);
	const { chainName } = config;
	const base = config.baseToken.symbol;
	const quote = config.quoteToken.symbol;

	snapshotTimer = setInterval(() => {
		const book = getLiveOrderBook(cacheKey);
		if (!book?.bids?.length) return;

		saveOrderBookSnapshot(BOT_NAME, chainName, base, quote, book);
		const stats = getBotDataFn(BOT_NAME).storageStats;
		updateStorageStats(BOT_NAME, {
			lastSnapshotTime: new Date().toISOString(),
			snapshotsToday: (stats.snapshotsToday ?? 0) + 1,
		});

		log.analysis('SNAPSHOT', 'INFO',
			`Book snapshot: mid ${book.midPrice?.toFixed(4)}, spread ${book.spreadPercent?.toFixed(2)}%`,
			{ midPrice: book.midPrice, spreadPercent: book.spreadPercent, bidsCount: book.bids.length, asksCount: book.asks.length });
	}, SNAPSHOT_INTERVAL_MS);

	log.info('BOT', '📡 Data collection active 🟢');
}

/**
 * Stop data collection: price engine, chain poller, snapshots, account refresh.
 * Also stops trading if it was active.
 */
export async function stopDataCollection() {
	if (!dataCollectionActive) return;

	// Must stop trading first — can't trade without data
	if (tradingActive) {
		await stopBot();
	}

	dataCollectionActive = false;
	setBotControl(BOT_NAME, { dataCollection: false });
	cacheModule.updateBotControlState(BOT_NAME, getBotControl(BOT_NAME));

	log.warn('BOT', '📡 Stopping data collection...');

	if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = null; }
	if (accountTimer) { clearInterval(accountTimer); accountTimer = null; }
	if (chainAdapter) await chainAdapter.stop();
	if (priceEngine) await priceEngine.stop();

	log.warn('BOT', '📡 Data collection stopped 🔴');
}

// ####################################################################################################################################
// ########################################################   START BOT   #############################################################
// ####################################################################################################################################

/**
 * Phase 2: Start trading (brain + micro layer + all enabled strategies).
 * Called when user toggles the bot ON from the dashboard.
 */
export async function startBot() {
	if (tradingActive) return;
	if (!operationsReady) {
		log.warn('BOT', '⚠️ Cannot start bot — operations not ready (no credentials)');
		return;
	}

	// Auto-enable data collection if not active
	if (!dataCollectionActive) {
		await startDataCollection();
	}

	const config = getEffectiveConfig(BOT_NAME);
	tradingActive = true;

	// Enable all strategies (clear disabled list) when turning ON
	setBotControl(BOT_NAME, { enabled: true, disabledStrategies: [] });
	cacheModule.updateBotControlState(BOT_NAME, getBotControl(BOT_NAME));

	// Deactivate kill switch if it was active
	const { deactivate } = await import('../../core/risk/killSwitch.js');
	deactivate();

	log.info('BOT', '🟢 Starting trading...');

	// Start micro layer
	if (config.microLayer?.enabled) {
		const { startMicroLayer, isMicroLayerRunning } = await import('../../strategies/market-making/microLayer.js');
		if (!isMicroLayerRunning()) {
			await startMicroLayer({
				adapter: chainAdapter,
				logger: log,
				config: config.microLayer,
				updateMicroLayerStatus: (fields) => cacheModule.updateMicroLayerStatus(BOT_NAME, fields),
			});
		}
	}

	// Start brain
	if (config.brain?.enabled) {
		const { startBrain, isBrainRunning } = await import('../../strategies/engine/brain.js');
		if (!isBrainRunning()) {
			await startBrain({
				adapter: chainAdapter,
				logger: log,
				config: config.brain,
				strategyConfigs: {
					marketMaking: config.marketMaking,
					aggressiveSniping: config.aggressiveSniping,
					gridRange: config.gridRange,
					meanReversion: config.meanReversion,
					defensivePause: config.defensivePause,
					botExploitation: config.botExploitation,
					risk: config.risk,
				},
				cacheKey,
				cache: {
					getSteemDexBotData: () => cacheModule.getBotData(BOT_NAME),
					updateBrainStatus: (fields) => cacheModule.updateBrainStatus(BOT_NAME, fields),
					updateStrategyStatus: (fields) => cacheModule.updateStrategyStatus(BOT_NAME, fields),
				},
				isStrategyDisabled: (mode) => isStrategyDisabled(BOT_NAME, mode),
			});
		}
	}

	log.info('BOT', '✅ Trading active 🟢');
}

// ####################################################################################################################################
// ########################################################   STOP BOT   ##############################################################
// ####################################################################################################################################

/**
 * Stop trading cleanly: stop brain, all strategies, micro layer, cancel open orders.
 * Data feeds (price engine, chain polling, snapshots) stay alive.
 */
export async function stopBot() {
	if (!tradingActive) return;
	tradingActive = false;

	setBotControl(BOT_NAME, { enabled: false });
	cacheModule.updateBotControlState(BOT_NAME, getBotControl(BOT_NAME));

	log.warn('BOT', '🔴 Stopping trading...');

	const { stopBrain, isBrainRunning } = await import('../../strategies/engine/brain.js');
	if (isBrainRunning()) await stopBrain();
	const { stopMarketMaking, isMarketMakingRunning } = await import('../../strategies/market-making/index.js');
	if (isMarketMakingRunning()) await stopMarketMaking();
	const { stopAggressiveSniping, isAggressiveSnipingRunning } = await import('../../strategies/aggressive-sniping/index.js');
	if (isAggressiveSnipingRunning()) await stopAggressiveSniping();
	const { stopGridRange, isGridRangeRunning } = await import('../../strategies/grid-range/index.js');
	if (isGridRangeRunning()) await stopGridRange();
	const { stopMeanReversion, isMeanReversionRunning } = await import('../../strategies/mean-reversion/index.js');
	if (isMeanReversionRunning()) await stopMeanReversion();
	const { stopDefensivePause, isDefensivePauseRunning } = await import('../../strategies/defensive-pause/index.js');
	if (isDefensivePauseRunning()) await stopDefensivePause();
	const { stopBotExploitation, isBotExploitationRunning } = await import('../../strategies/bot-exploitation/index.js');
	if (isBotExploitationRunning()) await stopBotExploitation();
	const { stopMicroLayer } = await import('../../strategies/market-making/microLayer.js');
	await stopMicroLayer();

	// Cancel any remaining open orders
	if (chainAdapter?.operationsReady) {
		try {
			const open = await chainAdapter.getOpenOrders();
			for (const o of open) await chainAdapter.cancelOrder(o.orderId);
			if (open.length) log.info('BOT', `Cancelled ${open.length} open orders`);
		} catch { /* non-critical */ }
	}

	log.warn('BOT', '🔴 Trading stopped — dashboard feeds still active');
}

// ####################################################################################################################################
// #####################################################   EMERGENCY STOP   ###########################################################
// ####################################################################################################################################

/**
 * Emergency stop — halt all trading + activate kill switch.
 */
export async function emergencyStop() {
	log.warn('BOT', '🚨 Emergency stop triggered — halting all trading');

	const { activate } = await import('../../core/risk/killSwitch.js');
	activate('Manual emergency stop from dashboard');

	await stopBot();

	log.warn('BOT', '🛑 Emergency stop complete — kill switch activated');
}

// ####################################################################################################################################
// ########################################################   HELPERS   ###############################################################
// ####################################################################################################################################

/**
 * Reload effective config and push updated strategy configs to brain.
 */
export async function reloadConfig() {
	const config = getEffectiveConfig(BOT_NAME);
	const { updateStrategyConfigs, isBrainRunning } = await import('../../strategies/engine/brain.js');
	if (isBrainRunning()) {
		updateStrategyConfigs({
			marketMaking: config.marketMaking,
			aggressiveSniping: config.aggressiveSniping,
			gridRange: config.gridRange,
			meanReversion: config.meanReversion,
			defensivePause: config.defensivePause,
			botExploitation: config.botExploitation,
			risk: config.risk,
		});
	}

	// Sync dry-run flag
	const { setDryRun } = await import('../../core/execution/dryRun.js');
	const control = getBotControl(BOT_NAME);
	setDryRun(control.dryRun ?? config.dryRun ?? false);
	cacheModule?.setDryRunFlag(BOT_NAME, control.dryRun ?? config.dryRun ?? false);
}

export function isTradingActive() { return tradingActive; }
export function isDataCollectionActive() { return dataCollectionActive; }
export function getConfig() { return getEffectiveConfig(BOT_NAME); }
export function getBotName() { return BOT_NAME; }

export function getStatus() {
	return {
		dataCollection: dataCollectionActive,
		trading: tradingActive,
		error: null,
	};
}

export async function shutdown() {
	log.info('BOT', '🛑 Shutting down...');
	await stopBot();
	await stopDataCollection();
	log.info('BOT', '✅ Shutdown complete');
}
