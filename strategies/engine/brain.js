// strategies/engine/brain.js
// Main Brain — meta-controller that watches market signals and decides which
// sub-strategy should be active. Runs on a fast tick (every ~6s), reads only
// from runtimeCache (zero API calls). Sole owner of strategy start/stop.
//
// Modes: market-making (default), aggressive-sniping, grid-range,
//        mean-reversion, defensive, bot-exploitation.

// ─── Constants ───────────────────────────────────────────────

const MODES = {
	MARKET_MAKING: 'market-making',
	AGGRESSIVE_SNIPING: 'aggressive-sniping',
	GRID_RANGE: 'grid-range',
	MEAN_REVERSION: 'mean-reversion',
	DEFENSIVE: 'defensive',
	BOT_EXPLOITATION: 'bot-exploitation',
};

const AVAILABLE_MODES = new Set([MODES.MARKET_MAKING, MODES.AGGRESSIVE_SNIPING, MODES.GRID_RANGE, MODES.MEAN_REVERSION, MODES.DEFENSIVE, MODES.BOT_EXPLOITATION]);

// ─── State ───────────────────────────────────────────────────

let running = false;
let tickTimer = null;
let currentMode = null;
let lastSwitchTime = null;
let lastSwitchReason = null;
let lastSignals = {};

// Injected dependencies
let cfg = null;
let log = null;
let adapter = null;
let cache = null;          // { getSteemDexBotData, updateBrainStatus, updateStrategyStatus }
let strategyConfigs = null; // { marketMaking, aggressiveSniping, gridRange, meanReversion, defensivePause, botExploitation, risk }
let cacheKey = null;       // e.g. 'steem:STEEM/SBD'

// Strategy module references (lazy-loaded)
let mmModule = null;
let snipeModule = null;
let gridModule = null;
let reversionModule = null;
let defensiveModule = null;
let exploitModule = null;
let rebalanceModule = null;
let rcWarningLogged = false;

// ─── Public API ──────────────────────────────────────────────

/**
 * Start the brain.
 * @param {Object} opts
 * @param {Object} opts.adapter         — chain adapter
 * @param {Object} opts.logger          — botLogger instance
 * @param {Object} opts.config          — brain config block
 * @param {Object} opts.strategyConfigs — { marketMaking, aggressiveSniping, gridRange }
 * @param {string} opts.cacheKey        — e.g. 'steem:STEEM/SBD'
 * @param {Object} opts.cache           — { getSteemDexBotData, updateBrainStatus, updateStrategyStatus }
 */
export async function startBrain(opts) {
	if (running) return;

	adapter = opts.adapter;
	log = opts.logger;
	cfg = opts.config;
	strategyConfigs = opts.strategyConfigs;
	cacheKey = opts.cacheKey;
	cache = opts.cache;

	running = true;
	currentMode = null;
	lastSwitchTime = null;
	lastSwitchReason = null;
	lastSignals = {};

	_pushStatus();
	log?.info('BRAIN', '🧠 Brain starting...', {
		tickMs: cfg.tickIntervalMs,
		cooldownMs: cfg.cooldownMs,
	});

	// First tick immediately (will start default strategy)
	await _tick();

	// Schedule recurring ticks
	tickTimer = setInterval(() => _tick(), cfg.tickIntervalMs);

	log?.info('BRAIN', '✅ Brain active');
}

/**
 * Stop the brain and its managed strategy.
 */
export async function stopBrain() {
	if (!running) return;
	running = false;

	if (tickTimer) {
		clearInterval(tickTimer);
		tickTimer = null;
	}

	log?.info('BRAIN', '🛑 Stopping brain — shutting down active strategy');
	await _stopCurrentStrategy();
	currentMode = null;
	_pushStatus();
	log?.info('BRAIN', '✅ Brain stopped');
}

export function isBrainRunning() { return running; }
export function getCurrentMode() { return currentMode; }
export function getLastSwitchReason() { return lastSwitchReason; }

/**
 * Force a specific mode (bypasses _decide for one tick).
 * Used by the /api/execution/switch-mode endpoint.
 * @param {string} mode — one of MODES values
 */
export async function forceMode(mode) {
	if (!running) return;
	if (!AVAILABLE_MODES.has(mode)) return;
	if (mode === currentMode) return;

	log?.info('BRAIN', `⚡ Forced mode switch → ${mode}`, { eventType: 'FORCED_SWITCH', from: currentMode, to: mode });

	await _stopCurrentStrategy();
	currentMode = mode;
	lastSwitchTime = new Date().toISOString();
	lastSwitchReason = `Manual override → ${mode}`;
	await _startStrategy(mode);
	_pushStatus();
}

// ─── Internal: Tick ──────────────────────────────────────────

async function _tick() {
	if (!running) return;

	try {
		// Self-completion: if current strategy finished on its own, reset
		if (currentMode && !_isCurrentStrategyRunning()) {
			log?.info('BRAIN', `📋 Strategy "${currentMode}" self-completed — re-evaluating`);
			currentMode = null;
		}

		const signals = _collectSignals();
		lastSignals = signals;

		const desired = _decide(signals);

		if (desired !== currentMode) {
			await _switchTo(desired, signals);
		}

		// RC warning zone (D4): warn when approaching the threshold
		_checkRCWarning(signals);

		// Rebalance safety net: check on every tick
		await _checkRebalance();

		_pushStatus();
	} catch (err) {
		log?.error('BRAIN', `Tick error: ${err.message}`, { error: err.message });
	}
}

// ─── Internal: Signal Collection ─────────────────────────────

function _collectSignals() {
	const data = cache.getSteemDexBotData();
	const book = data.orderBooks?.[cacheKey];
	const trades = data.recentTrades?.[cacheKey] || [];
	const account = data.accountData || {};
	const engine = data.priceEngine || {};
	const alerts = data.divergenceAlerts || [];
	const microLayer = data.microLayerStatus || {};
	const strategy = data.strategyStatus || {};

	// ─── Order book imbalance ────────────────────────────────
	let bidDepth = 0;
	let askDepth = 0;
	if (book?.bids) for (const b of book.bids) bidDepth += b.price * b.amount;
	if (book?.asks) for (const a of book.asks) askDepth += a.price * a.amount;
	const totalDepth = bidDepth + askDepth;
	const imbalanceRatio = totalDepth > 0
		? Math.max(bidDepth, askDepth) / Math.max(Math.min(bidDepth, askDepth), 0.001)
		: 1;
	const imbalanceSide = bidDepth > askDepth ? 'buy' : 'sell';

	// ─── Trade velocity (trades in last N seconds) ───────────
	const velocityWindowMs = (cfg.tradeVelocityWindow || 60) * 1000;
	const now = Date.now();
	const recentCount = trades.filter(t => {
		const ts = new Date(t.timestamp + (t.timestamp.endsWith('Z') ? '' : 'Z')).getTime();
		return (now - ts) < velocityWindowMs;
	}).length;

	// ─── Fill speed (from strategy status) ───────────────────
	const lastFill = strategy.lastFillTime;
	const timeSinceLastFillMs = lastFill ? (now - new Date(lastFill).getTime()) : Infinity;

	// ─── DEX vs external divergence ──────────────────────────
	let maxDivergencePercent = 0;
	if (alerts.length > 0) {
		const latest = alerts[alerts.length - 1];
		maxDivergencePercent = Math.abs(latest.differencePercent || 0);
	}

	// ─── RC / bandwidth ─────────────────────────────────────
	const rcPercent = account.rc?.percentage ?? 100;

	// ─── Volatility (price engine mode) ──────────────────────
	const volatileMode = engine.mode === 'violent';

	// ─── Spread ──────────────────────────────────────────────
	const spreadPercent = book?.spreadPercent ?? null;

	return {
		midPrice: book?.midPrice ?? null,
		spreadPercent,
		bidDepth: +bidDepth.toFixed(4),
		askDepth: +askDepth.toFixed(4),
		imbalanceRatio: +imbalanceRatio.toFixed(2),
		imbalanceSide,
		tradeVelocity: recentCount,
		timeSinceLastFillMs,
		maxDivergencePercent: +maxDivergencePercent.toFixed(2),
		rcPercent: +rcPercent.toFixed(1),
		volatileMode,
		microLayerActive: microLayer.active ?? false,
		currentStrategyActive: strategy.active ?? false,
		totalBookDepth: +(bidDepth + askDepth).toFixed(4),
	};
}

// ─── Internal: Decision Tree ─────────────────────────────────

function _decide(s) {
	// ─── Safety overrides (always first) ─────────────────────
	if (s.rcPercent < (strategyConfigs?.risk?.minRCPercent ?? cfg.rcMinPercent)) {
		return MODES.DEFENSIVE;
	}
	if (s.maxDivergencePercent > cfg.divergenceMaxPercent) {
		return MODES.DEFENSIVE;
	}

	// ─── No market data yet → stay defensive ────────────────
	if (s.midPrice === null) {
		return MODES.DEFENSIVE;
	}

	// ─── Thin book → defensive ──────────────────────────────
	const thinThreshold = strategyConfigs?.defensivePause?.thinBookThreshold;
	if (thinThreshold && s.totalBookDepth < thinThreshold) {
		return MODES.DEFENSIVE;
	}

	// ─── Strong one-sided pressure → Aggressive Sniping ─────
	if (s.imbalanceRatio > cfg.imbalanceRatioThreshold && s.tradeVelocity >= 3) {
		return MODES.AGGRESSIVE_SNIPING;
	}

	// ─── Volatile with quick snap-back expected → Mean-Reversion
	if (s.volatileMode && s.tradeVelocity >= 5) {
		return MODES.MEAN_REVERSION;
	}

	// ─── Tight spread + low velocity → Grid/Range ───────────
	if (s.spreadPercent !== null && s.spreadPercent < 0.5 && s.tradeVelocity <= 1) {
		return MODES.GRID_RANGE;
	}

	// ─── Bot exploitation (brain-disabled by default) ────────
	// Not auto-triggered yet; reserved for manual/tuned activation.

	// ─── Default → Market-Making ─────────────────────────────
	return MODES.MARKET_MAKING;
}

// ─── Internal: Mode Switching ────────────────────────────────

async function _switchTo(newMode, signals) {
	// Cooldown: don't switch too fast
	if (lastSwitchTime) {
		const elapsed = Date.now() - new Date(lastSwitchTime).getTime();
		if (elapsed < cfg.cooldownMs) {
			return; // Still in cooldown
		}
	}

	const reason = _buildSwitchReason(newMode, signals);

	log?.info('BRAIN', `🔀 Mode switch: ${currentMode || 'none'} → ${newMode}`, {
		from: currentMode, to: newMode, reason, signals,
	});

	// Stop current strategy
	await _stopCurrentStrategy();

	// Start new strategy
	currentMode = newMode;
	lastSwitchTime = new Date().toISOString();
	lastSwitchReason = reason;

	await _startStrategy(newMode);
}

function _buildSwitchReason(newMode, s) {
	switch (newMode) {
		case MODES.DEFENSIVE:
			if (s.rcPercent < cfg.rcMinPercent) return `RC too low (${s.rcPercent}%)`;
			if (s.maxDivergencePercent > cfg.divergenceMaxPercent) return `Divergence too high (${s.maxDivergencePercent}%)`;
			if (s.midPrice === null) return 'No market data';
			if (strategyConfigs?.defensivePause?.thinBookThreshold && s.totalBookDepth < strategyConfigs.defensivePause.thinBookThreshold) return `Book too thin (depth ${s.totalBookDepth})`;
			return 'Safety override';
		case MODES.AGGRESSIVE_SNIPING:
			return `Imbalance ${s.imbalanceRatio}× (${s.imbalanceSide}), velocity ${s.tradeVelocity}`;
		case MODES.MEAN_REVERSION:
			return `Volatile mode + high velocity (${s.tradeVelocity})`;
		case MODES.GRID_RANGE:
			return `Tight spread (${s.spreadPercent?.toFixed(2)}%) + low velocity (${s.tradeVelocity})`;
		case MODES.BOT_EXPLOITATION:
			return `Bot exploitation — ${s.tradeVelocity} trades, pattern detected`;
		case MODES.MARKET_MAKING:
			return 'Default — normal conditions';
		default:
			return 'Unknown';
	}
}

async function _startStrategy(mode) {
	if (!AVAILABLE_MODES.has(mode)) {
		// Mode not yet implemented — fall back to market-making
		if (mode !== MODES.MARKET_MAKING) {
			log?.info('BRAIN', `⚠️ Mode "${mode}" not available yet — falling back to market-making`, {
				requestedMode: mode, fallback: MODES.MARKET_MAKING,
			});
			currentMode = MODES.MARKET_MAKING;
			lastSwitchReason += ` (fallback → market-making)`;
		}
		// If even MM isn't available, do nothing
		if (!AVAILABLE_MODES.has(MODES.MARKET_MAKING)) return;
		mode = MODES.MARKET_MAKING;
	}

	if (mode === MODES.MARKET_MAKING) {
		if (!mmModule) {
			mmModule = await import('../../strategies/market-making/index.js');
		}
		if (!mmModule.isMarketMakingRunning()) {
			await mmModule.startMarketMaking({
				adapter,
				logger: log,
				config: strategyConfigs.marketMaking,
				updateStrategyStatus: cache.updateStrategyStatus,
			});
		}
	} else if (mode === MODES.AGGRESSIVE_SNIPING) {
		if (!snipeModule) {
			snipeModule = await import('../../strategies/aggressive-sniping/index.js');
		}
		if (!snipeModule.isAggressiveSnipingRunning()) {
			await snipeModule.startAggressiveSniping({
				adapter,
				logger: log,
				config: strategyConfigs.aggressiveSniping,
				cacheKey,
				updateStrategyStatus: cache.updateStrategyStatus,
				getSteemDexBotData: cache.getSteemDexBotData,
			});
		}
	} else if (mode === MODES.GRID_RANGE) {
		if (!gridModule) {
			gridModule = await import('../../strategies/grid-range/index.js');
		}
		if (!gridModule.isGridRangeRunning()) {
			await gridModule.startGridRange({
				adapter,
				logger: log,
				config: strategyConfigs.gridRange,
				cacheKey,
				updateStrategyStatus: cache.updateStrategyStatus,
				getSteemDexBotData: cache.getSteemDexBotData,
			});
		}
	} else if (mode === MODES.MEAN_REVERSION) {
		if (!reversionModule) {
			reversionModule = await import('../../strategies/mean-reversion/index.js');
		}
		if (!reversionModule.isMeanReversionRunning()) {
			await reversionModule.startMeanReversion({
				adapter,
				logger: log,
				config: strategyConfigs.meanReversion,
				cacheKey,
				updateStrategyStatus: cache.updateStrategyStatus,
				getSteemDexBotData: cache.getSteemDexBotData,
			});
		}
	} else if (mode === MODES.DEFENSIVE) {
		if (!defensiveModule) {
			defensiveModule = await import('../../strategies/defensive-pause/index.js');
		}
		if (!defensiveModule.isDefensivePauseRunning()) {
			await defensiveModule.startDefensivePause({
				logger: log,
				config: strategyConfigs.defensivePause,
				reason: lastSwitchReason,
				updateStrategyStatus: cache.updateStrategyStatus,
			});
		}
	} else if (mode === MODES.BOT_EXPLOITATION) {
		if (!exploitModule) {
			exploitModule = await import('../../strategies/bot-exploitation/index.js');
		}
		if (!exploitModule.isBotExploitationRunning()) {
			await exploitModule.startBotExploitation({
				adapter,
				logger: log,
				config: strategyConfigs.botExploitation,
				cacheKey,
				updateStrategyStatus: cache.updateStrategyStatus,
				getSteemDexBotData: cache.getSteemDexBotData,
			});
		}
	}
}

async function _stopCurrentStrategy() {
	if (!currentMode) return;

	// Stop MM (also covers fallback modes that fell back to MM)
	if (!mmModule) mmModule = await import('../../strategies/market-making/index.js');
	if (mmModule.isMarketMakingRunning()) await mmModule.stopMarketMaking();

	// Stop sniping
	if (!snipeModule) snipeModule = await import('../../strategies/aggressive-sniping/index.js');
	if (snipeModule.isAggressiveSnipingRunning()) await snipeModule.stopAggressiveSniping();

	// Stop grid
	if (!gridModule) gridModule = await import('../../strategies/grid-range/index.js');
	if (gridModule.isGridRangeRunning()) await gridModule.stopGridRange();

	// Stop mean-reversion
	if (!reversionModule) reversionModule = await import('../../strategies/mean-reversion/index.js');
	if (reversionModule.isMeanReversionRunning()) await reversionModule.stopMeanReversion();

	// Stop defensive
	if (!defensiveModule) defensiveModule = await import('../../strategies/defensive-pause/index.js');
	if (defensiveModule.isDefensivePauseRunning()) await defensiveModule.stopDefensivePause();

	// Stop bot-exploitation
	if (!exploitModule) exploitModule = await import('../../strategies/bot-exploitation/index.js');
	if (exploitModule.isBotExploitationRunning()) await exploitModule.stopBotExploitation();
}

function _isCurrentStrategyRunning() {
	if (currentMode === MODES.MARKET_MAKING) {
		return mmModule?.isMarketMakingRunning() ?? false;
	}
	if (currentMode === MODES.AGGRESSIVE_SNIPING) {
		return snipeModule?.isAggressiveSnipingRunning() ?? false;
	}
	if (currentMode === MODES.GRID_RANGE) {
		return gridModule?.isGridRangeRunning() ?? false;
	}
	if (currentMode === MODES.MEAN_REVERSION) {
		return reversionModule?.isMeanReversionRunning() ?? false;
	}
	if (currentMode === MODES.DEFENSIVE) {
		return defensiveModule?.isDefensivePauseRunning() ?? false;
	}
	if (currentMode === MODES.BOT_EXPLOITATION) {
		return exploitModule?.isBotExploitationRunning() ?? false;
	}
	// Unavailable modes that fell back to MM
	return mmModule?.isMarketMakingRunning() ?? false;
}

// ─── Internal: Status Push ───────────────────────────────────

function _pushStatus() {
	if (!cache?.updateBrainStatus) return;

	cache.updateBrainStatus({
		currentMode,
		active: running,
		lastSwitchTime,
		lastSwitchReason,
		nextTickTime: running && tickTimer
			? new Date(Date.now() + cfg.tickIntervalMs).toISOString()
			: null,
		signals: lastSignals,
	});
}

// ─── Internal: RC Warning Zone (D4) ─────────────────────────

function _checkRCWarning(signals) {
	const minRC = strategyConfigs?.risk?.minRCPercent ?? cfg.rcMinPercent;
	const warnZone = minRC + 5;

	if (signals.rcPercent < warnZone && signals.rcPercent >= minRC) {
		if (!rcWarningLogged) {
			rcWarningLogged = true;
			log?.warn('RISK', `⚠️ RC approaching threshold — ${signals.rcPercent}% (switch at ${minRC}%)`, {
				eventType: 'RC_WARNING', rcPercent: signals.rcPercent, threshold: minRC,
			});
		}
	} else {
		rcWarningLogged = false;
	}
}

// ─── Internal: Rebalance Safety Net ──────────────────────────

async function _checkRebalance() {
	if (!strategyConfigs?.risk) return;
	try {
		if (!rebalanceModule) {
			rebalanceModule = await import('../../core/risk/rebalance.js');
		}
		await rebalanceModule.checkAndRebalance();
	} catch (err) {
		log?.error('RISK', `Rebalance tick error: ${err.message}`, { error: err.message });
	}
}
