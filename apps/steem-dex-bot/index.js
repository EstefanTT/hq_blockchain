// apps/steem-dex-bot/index.js
// STEEM/SBD DEX trading bot — multi-chain ready skeleton.
// Wires the price engine (Step 1), chain connector (Step 2), SQLite storage (Step 3),
// and order operations (Step 4). Double logging via botLogger (Step 5).
// Micro layer market-making (Step 6). Market-making strategy (Step 7). Brain (Step 8).
// Aggressive sniping (Step 9). Grid/Range (Step 10). Mean-reversion (Step 11). Defensive/Pause (Step 12).
// Risk & Rebalance Layer + Bot-Exploitation (Step 13).
// Full Integration + Dry-Run Mode (Step 14).

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBotLogger } from '../../services/logger/botLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const SNAPSHOT_INTERVAL_MS = 30_000;     // 30s periodic order book snapshots
const ACCOUNT_REFRESH_MS = 60_000;       // 60s periodic account data refresh

const log = createBotLogger({ botName: config.name, chainName: config.chainName });

let priceEngine = null;
let chainAdapter = null;
let snapshotTimer = null;
let accountTimer = null;

export async function init() {
	if (!config.enabled) {
		log.info('BOT', '⏸️  Disabled in config — skipping');
		return;
	}

	log.info('BOT', '🚀 Initializing STEEM DEX Bot...', { nodes: config.nodes });
	log.info('BOT', `Chain: ${config.chainName} | Base: ${config.baseToken.symbol} | Quote: ${config.quoteToken.symbol}`);

	// Initialize SQLite tables (lazy, but we want them ready at boot)
	const { saveOrderBookSnapshot, addTrades, getCurrentPosition, countTradesToday } = await import('../../services/storage/steemDexStore.js');
	const { getLiveOrderBook, updateStorageStats, updateAccountData, updateMicroLayerStatus, updateStrategyStatus, updateBrainStatus, updateRiskStatus, setDryRunFlag, getSteemDexBotData } = await import('../../services/cache/index.js');

	const { chainName } = config;
	const base = config.baseToken.symbol;
	const quote = config.quoteToken.symbol;
	const cacheKey = `${chainName}:${base}/${quote}`;

	// Seed storage stats from DB (in case of restart)
	const pos = getCurrentPosition(chainName, base, quote);
	const tradesToday = countTradesToday(chainName, base, quote);
	updateStorageStats({
		tradesToday,
		currentPosition: pos,
	});

	// Start the price engine (external feeds)
	const { PriceEngine } = await import('../../core/market/priceEngine.js');
	priceEngine = new PriceEngine({
		chainName: config.chainName,
		baseToken: config.baseToken,
		quoteToken: config.quoteToken,
		logger: log,
	});
	await priceEngine.start();

	// Start the chain connector (DEX order book + trades)
	const { createSteemLikeAdapter } = await import('../../connectors/chains/steem-like/index.js');
	chainAdapter = createSteemLikeAdapter({
		chainName: config.chainName,
		nodes: config.nodes,
		baseToken: config.baseToken,
		quoteToken: config.quoteToken,
	});

	// Subscribe to new trades → persist to SQLite + notify strategies
	const { onTradeEvent } = await import('../../strategies/market-making/microLayer.js');
	const { onMMTradeEvent } = await import('../../strategies/market-making/index.js');
	const { onSnipeTradeEvent } = await import('../../strategies/aggressive-sniping/index.js');
	const { onGridTradeEvent } = await import('../../strategies/grid-range/index.js');
	const { onMeanReversionTradeEvent } = await import('../../strategies/mean-reversion/index.js');
	const { onDefensiveTradeEvent } = await import('../../strategies/defensive-pause/index.js');
	const { onBotExploitTradeEvent } = await import('../../strategies/bot-exploitation/index.js');
	const { onRebalanceTradeEvent } = await import('../../core/risk/rebalance.js');
	chainAdapter.subscribe('trade', (trade) => {
		const inserted = addTrades(chainName, base, quote, [trade]);
		if (inserted > 0) {
			updateStorageStats({ tradesToday: (countTradesToday(chainName, base, quote)) });
			log.info('TRADE', `${trade.type.toUpperCase()} ${trade.amountBase} ${base} @ ${trade.price.toFixed(4)}`, trade);
		}
		onTradeEvent(trade);
		onMMTradeEvent(trade);
		onSnipeTradeEvent(trade);
		onGridTradeEvent(trade);
		onMeanReversionTradeEvent(trade);
		onDefensiveTradeEvent(trade);
		onBotExploitTradeEvent(trade);
		onRebalanceTradeEvent(trade);
	});

	await chainAdapter.start();

	// ─── Initialize order operations (Step 4) ────────────────────
	const steemAccount = process.env.STEEM_ACCOUNT;
	const steemActiveKey = process.env.STEEM_ACTIVE_KEY;

	if (steemAccount && steemActiveKey) {
		chainAdapter.initOperations({ account: steemAccount, activeKey: steemActiveKey, logger: log });

		// ─── Install dry-run wrapper on adapter (Step 14) ─────────────
		const { createDryRunWrapper, setDryRun } = await import('../../core/execution/dryRun.js');
		setDryRun(config.dryRun ?? false);
		setDryRunFlag(config.dryRun ?? false);
		const { wrappedPlace, wrappedCancel } = createDryRunWrapper(chainAdapter, log);
		chainAdapter.placeLimitOrder = wrappedPlace;
		chainAdapter.cancelOrder = wrappedCancel;
		if (config.dryRun) log.info('BOT', '🧪 DRY-RUN mode active — no real orders will be broadcast');

		// ─── Install slippage guard on adapter (Step 13) ────────────────
		if (config.risk) {
			const { createSlippageGuard } = await import('../../core/risk/slippageCheck.js');
			chainAdapter.placeLimitOrder = createSlippageGuard(chainAdapter, config.risk, log, updateRiskStatus);
			log.info('RISK', '🛡️ Slippage guard installed', { maxSlippage: `${config.risk.maxAllowedSlippagePercent}%` });
		}

		// ─── Initialize rebalance safety net (Step 13) ─────────────────
		if (config.risk) {
			const { initRebalance } = await import('../../core/risk/rebalance.js');
			initRebalance({
				adapter: chainAdapter,
				logger: log,
				config: config.risk,
				cacheKey,
				getSteemDexBotData,
				updateRiskStatus,
			});
		}

		// Helper: refresh account data and push to cache
		async function refreshAccountData() {
			try {
				const [balances, openOrders, rc] = await Promise.all([
					chainAdapter.getAccountBalances(),
					chainAdapter.getOpenOrders(),
					chainAdapter.getAccountRC(),
				]);
				updateAccountData({
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

		// Initial fetch + periodic refresh
		await refreshAccountData();
		accountTimer = setInterval(refreshAccountData, ACCOUNT_REFRESH_MS);

		// ─── Start micro layer (Step 6) ─────────────────────────────
		if (config.microLayer?.enabled) {
			const { startMicroLayer } = await import('../../strategies/market-making/microLayer.js');
			await startMicroLayer({
				adapter: chainAdapter,
				logger: log,
				config: config.microLayer,
				updateMicroLayerStatus,
			});
		}

		// ─── Start market-making strategy (Step 7) — now managed by brain ─
		// (Brain starts MM on its first tick — no direct start here)

		// ─── Start brain (Step 8) ────────────────────────────────────
		if (config.brain?.enabled) {
			const { startBrain } = await import('../../strategies/engine/brain.js');
			await startBrain({
				adapter: chainAdapter,
				logger: log,
				config: config.brain,
				strategyConfigs: { marketMaking: config.marketMaking, aggressiveSniping: config.aggressiveSniping, gridRange: config.gridRange, meanReversion: config.meanReversion, defensivePause: config.defensivePause, botExploitation: config.botExploitation, risk: config.risk },
				cacheKey: cacheKey,
				cache: { getSteemDexBotData, updateBrainStatus, updateStrategyStatus },
			});
		} else if (config.marketMaking?.enabled) {
			// Fallback: no brain → start MM directly (backward compat)
			const { startMarketMaking } = await import('../../strategies/market-making/index.js');
			await startMarketMaking({
				adapter: chainAdapter,
				logger: log,
				config: config.marketMaking,
				updateStrategyStatus,
			});
		}
	} else {
		log.warn('WALLET', '⚠️  STEEM_ACCOUNT / STEEM_ACTIVE_KEY not set — operations disabled');
	}

	// Periodic order book snapshots (every 30s)
	snapshotTimer = setInterval(() => {
		const book = getLiveOrderBook(cacheKey);
		if (!book?.bids?.length) return;

		saveOrderBookSnapshot(chainName, base, quote, book);
		const stats = getSteemDexBotData().storageStats;
		updateStorageStats({
			lastSnapshotTime: new Date().toISOString(),
			snapshotsToday: (stats.snapshotsToday ?? 0) + 1,
		});

		log.analysis('SNAPSHOT', 'INFO',
			`Book snapshot: mid ${book.midPrice?.toFixed(4)}, spread ${book.spreadPercent?.toFixed(2)}%`,
			{ midPrice: book.midPrice, spreadPercent: book.spreadPercent, bidsCount: book.bids.length, asksCount: book.asks.length });
	}, SNAPSHOT_INTERVAL_MS);

	// Log bot start
	log.info('BOT', `✅ STEEM DEX Bot ready 🟢 (${config.nodes.length} nodes)`, { nodes: config.nodes, base, quote });
}

/**
 * Emergency stop — halt all trading but keep dashboard feeds alive.
 * Stops brain, all strategies, micro-layer, cancels open orders.
 * Does NOT stop price engine, chain polling, or snapshot timers.
 */
export async function emergencyStop() {
	log.warn('BOT', '🚨 Emergency stop triggered — halting all trading');

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

	log.warn('BOT', '🛑 Emergency stop complete — dashboard feeds still active');
}

export async function shutdown() {
	log.info('BOT', '🛑 Shutting down...');
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
	if (snapshotTimer) clearInterval(snapshotTimer);
	if (accountTimer) clearInterval(accountTimer);
	if (chainAdapter) await chainAdapter.stop();
	if (priceEngine) await priceEngine.stop();

	log.info('BOT', '✅ Shutdown complete');
}
