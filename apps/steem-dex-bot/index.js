// apps/steem-dex-bot/index.js
// STEEM/SBD DEX trading bot — multi-chain ready skeleton.
// Wires the price engine (Step 1), chain connector (Step 2), SQLite storage (Step 3),
// and order operations (Step 4).

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const SNAPSHOT_INTERVAL_MS = 30_000;     // 30s periodic order book snapshots
const ACCOUNT_REFRESH_MS = 60_000;       // 60s periodic account data refresh

let priceEngine = null;
let chainAdapter = null;
let snapshotTimer = null;
let accountTimer = null;

export async function init() {
	if (!config.enabled) {
		console.info('BOT', 'STEEM-DEX', '⏸️  Disabled in config — skipping');
		return;
	}

	console.info('BOT', 'STEEM-DEX', '🚀 Initializing STEEM DEX Bot...');
	console.info('BOT', 'STEEM-DEX', `Chain: ${config.chainName} | Base: ${config.baseToken.symbol} | Quote: ${config.quoteToken.symbol}`);

	// Initialize SQLite tables (lazy, but we want them ready at boot)
	const { saveOrderBookSnapshot, addTrades, logAnalysisEvent, getCurrentPosition, countTradesToday } = await import('../../services/storage/steemDexStore.js');
	const { getLiveOrderBook, updateStorageStats, updateAccountData, getSteemDexBotData } = await import('../../services/cache/index.js');

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

	// Subscribe to new trades → persist to SQLite
	chainAdapter.subscribe('trade', (trade) => {
		const inserted = addTrades(chainName, base, quote, [trade]);
		if (inserted > 0) {
			updateStorageStats({ tradesToday: (countTradesToday(chainName, base, quote)) });
			logAnalysisEvent({
				chainName,
				eventType: 'TRADE_FILLED',
				severity: 'INFO',
				message: `${trade.type.toUpperCase()} ${trade.amountBase} ${base} @ ${trade.price}`,
				data: trade,
			});
		}
	});

	await chainAdapter.start();

	// ─── Initialize order operations (Step 4) ────────────────────
	const steemAccount = process.env.STEEM_ACCOUNT;
	const steemActiveKey = process.env.STEEM_ACTIVE_KEY;

	if (steemAccount && steemActiveKey) {
		chainAdapter.initOperations({ account: steemAccount, activeKey: steemActiveKey });

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
				console.warn('BOT', 'STEEM-DEX', `Account refresh failed: ${err.message}`);
			}
		}

		// Initial fetch + periodic refresh
		await refreshAccountData();
		accountTimer = setInterval(refreshAccountData, ACCOUNT_REFRESH_MS);
	} else {
		console.warn('BOT', 'STEEM-DEX', '⚠️  STEEM_ACCOUNT / STEEM_ACTIVE_KEY not set — operations disabled');
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

		logAnalysisEvent({
			chainName,
			eventType: 'SNAPSHOT_TAKEN',
			severity: 'INFO',
			message: `Book snapshot: mid ${book.midPrice?.toFixed(4)}, spread ${book.spreadPercent?.toFixed(2)}%`,
			data: { midPrice: book.midPrice, spreadPercent: book.spreadPercent, bidsCount: book.bids.length, asksCount: book.asks.length },
		});
	}, SNAPSHOT_INTERVAL_MS);

	// Log bot start as analysis event
	logAnalysisEvent({
		chainName,
		eventType: 'BOT_STARTED',
		severity: 'INFO',
		message: `STEEM DEX Bot initialized (${config.nodes.length} nodes)`,
		data: { nodes: config.nodes, base, quote },
	});

	console.info('BOT', 'STEEM-DEX', '✅ STEEM DEX Bot ready 🟢');
}

export async function shutdown() {
	console.info('BOT', 'STEEM-DEX', '🛑 Shutting down...');
	if (snapshotTimer) clearInterval(snapshotTimer);
	if (accountTimer) clearInterval(accountTimer);
	if (chainAdapter) await chainAdapter.stop();
	if (priceEngine) await priceEngine.stop();

	try {
		const { logAnalysisEvent } = await import('../../services/storage/steemDexStore.js');
		logAnalysisEvent({
			chainName: config.chainName,
			eventType: 'BOT_STOPPED',
			severity: 'INFO',
			message: 'STEEM DEX Bot shutdown',
		});
	} catch { /* storage may already be closed */ }

	console.info('BOT', 'STEEM-DEX', '✅ Shutdown complete');
}
