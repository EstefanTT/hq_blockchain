#!/usr/bin/env node
// scripts/analysis/backtest.js
// ─────────────────────────────────────────────────────────────
// Replays historical order_book_snapshots + trades_history and simulates
// any strategy on past data. Outputs PnL, trades, max drawdown, win rate.
//
// Usage:
//   node scripts/analysis/backtest.js --strategy market-making
//   node scripts/analysis/backtest.js --strategy grid-range --days 30
//   node scripts/analysis/backtest.js --strategy mean-reversion --start-date 2026-03-01 --csv
//
// Params:
//   --strategy NAME     Required. One of: market-making, aggressive-sniping,
//                       grid-range, mean-reversion, defensive
//   --days N            Look back N days (default: all)
//   --start-date DATE   ISO start date
//   --chain NAME        Chain name (default: steem)
//   --base / --quote    Token overrides
//   --csv               Export results to CSV

import '../../services/globalConfig/init.js';
import { getSnapshotsByDateRange, getTradesByDateRange } from '../../services/storage/steemDexStore.js';
import { parseArgs, chainDefaults, isoRange, ensureReportsDir, writeCsv } from './shared.js';

import { fileURLToPath } from 'url';

// ####################################################################################################################################
// ##########################################################  BACKTEST ENGINE  #######################################################
// ####################################################################################################################################

/**
 * Self-contained BacktestEngine (D2).
 * Replays snapshots, simulates order matching, tracks virtual P&L.
 */
class BacktestEngine {
	constructor() {
		this.quoteBalance = 100;      // starting virtual quote balance
		this.baseBalance = 0;         // starting virtual base balance
		this.trades = [];             // { tick, side, price, amount, quoteValue }
		this.peakEquity = 100;
		this.maxDrawdown = 0;
		this.initialEquity = 100;
	}

	// Compute equity at a given mid price
	equity(midPrice) {
		return this.quoteBalance + this.baseBalance * midPrice;
	}

	// Record a virtual fill
	fill(tick, side, price, amount) {
		const quoteValue = price * amount;
		if (side === 'buy') {
			if (this.quoteBalance < quoteValue) return false; // insufficient
			this.quoteBalance -= quoteValue;
			this.baseBalance += amount;
		} else {
			if (this.baseBalance < amount) return false;
			this.baseBalance -= amount;
			this.quoteBalance += quoteValue;
		}
		this.trades.push({ tick, side, price, amount, quoteValue });
		return true;
	}

	// Update drawdown tracking
	updateDrawdown(midPrice) {
		const eq = this.equity(midPrice);
		if (eq > this.peakEquity) this.peakEquity = eq;
		const dd = (this.peakEquity - eq) / this.peakEquity * 100;
		if (dd > this.maxDrawdown) this.maxDrawdown = dd;
	}

	// Calculate final stats
	stats(lastMidPrice) {
		const finalEquity = this.equity(lastMidPrice);
		const pnl = finalEquity - this.initialEquity;
		const pnlPercent = (pnl / this.initialEquity) * 100;

		// Win rate: a "winning" trade is a sell at > avg buy price or buy below current mid
		const buys = this.trades.filter(t => t.side === 'buy');
		const sells = this.trades.filter(t => t.side === 'sell');
		const avgBuyPrice = buys.length
			? buys.reduce((s, t) => s + t.price, 0) / buys.length
			: 0;
		const wins = sells.filter(t => t.price > avgBuyPrice).length;
		const winRate = sells.length ? (wins / sells.length * 100) : 0;

		return {
			totalTrades: this.trades.length,
			buys: buys.length,
			sells: sells.length,
			pnl: +pnl.toFixed(4),
			pnlPercent: +pnlPercent.toFixed(2),
			maxDrawdown: +this.maxDrawdown.toFixed(2),
			winRate: +winRate.toFixed(1),
			finalEquity: +finalEquity.toFixed(4),
			avgBuyPrice: +avgBuyPrice.toFixed(6),
		};
	}
}

// ####################################################################################################################################
// ##########################################################  STRATEGY SIMS  #########################################################
// ####################################################################################################################################

// Each strategy function receives (engine, snapshots, realTrades) and runs the sim.

/**
 * Market-Making sim: place balanced buy/sell orders around mid, fill when
 * real trade prices cross our levels.
 */
function simMarketMaking(engine, snapshots, realTrades) {
	const spreadPct = 0.005;       // 0.5% spread
	const orderSize = 15;          // 15 base units per side

	for (let i = 0; i < snapshots.length; i++) {
		const snap = snapshots[i];
		const mid = snap.midPrice;
		if (!mid) continue;

		const buyPrice = mid * (1 - spreadPct / 2);
		const sellPrice = mid * (1 + spreadPct / 2);

		// Check if any real trade in this window crosses our levels
		const windowTrades = realTradesInWindow(realTrades, snap.timestamp, snapshots[i + 1]?.timestamp);

		for (const t of windowTrades) {
			if (t.price <= buyPrice && engine.quoteBalance >= buyPrice * orderSize) {
				engine.fill(i, 'buy', buyPrice, orderSize);
			}
			if (t.price >= sellPrice && engine.baseBalance >= orderSize) {
				engine.fill(i, 'sell', sellPrice, orderSize);
			}
		}

		engine.updateDrawdown(mid);
	}
}

/**
 * Aggressive-Sniping sim: buy when price drops sharply, sell when it recovers.
 */
function simAggressiveSniping(engine, snapshots, realTrades) {
	const dropThreshold = -0.008;  // -0.8% drop triggers buy
	const recoverTarget = 0.004;   // +0.4% recovery triggers sell
	const orderSize = 20;
	let lastMid = null;

	for (let i = 0; i < snapshots.length; i++) {
		const mid = snapshots[i].midPrice;
		if (!mid) continue;

		if (lastMid) {
			const change = (mid - lastMid) / lastMid;

			if (change <= dropThreshold && engine.quoteBalance >= mid * orderSize) {
				engine.fill(i, 'buy', mid, orderSize);
			}
			if (change >= recoverTarget && engine.baseBalance >= orderSize) {
				engine.fill(i, 'sell', mid, orderSize);
			}
		}

		lastMid = mid;
		engine.updateDrawdown(mid);
	}
}

/**
 * Grid-Range sim: place buy orders below mid, sell above, in a grid.
 */
function simGridRange(engine, snapshots, realTrades) {
	const levels = 5;
	const stepPct = 0.003;         // 0.3% per level
	const sizePerLevel = 10;

	for (let i = 0; i < snapshots.length; i++) {
		const snap = snapshots[i];
		const mid = snap.midPrice;
		if (!mid) continue;

		const windowTrades = realTradesInWindow(realTrades, snap.timestamp, snapshots[i + 1]?.timestamp);

		for (const t of windowTrades) {
			for (let lvl = 1; lvl <= levels; lvl++) {
				const buyLevel = mid * (1 - stepPct * lvl);
				const sellLevel = mid * (1 + stepPct * lvl);

				if (t.price <= buyLevel && engine.quoteBalance >= buyLevel * sizePerLevel) {
					engine.fill(i, 'buy', buyLevel, sizePerLevel);
				}
				if (t.price >= sellLevel && engine.baseBalance >= sizePerLevel) {
					engine.fill(i, 'sell', sellLevel, sizePerLevel);
				}
			}
		}

		engine.updateDrawdown(mid);
	}
}

/**
 * Mean-Reversion sim: buy after sharp drop, sell after sharp recovery.
 */
function simMeanReversion(engine, snapshots) {
	const triggerPct = 0.009;      // 0.9% move triggers
	const orderSize = 15;
	const lookback = 5;            // compare to N snapshots ago

	for (let i = lookback; i < snapshots.length; i++) {
		const mid = snapshots[i].midPrice;
		const refMid = snapshots[i - lookback].midPrice;
		if (!mid || !refMid) continue;

		const change = (mid - refMid) / refMid;

		// Price dropped → expect reversion up → buy
		if (change <= -triggerPct && engine.quoteBalance >= mid * orderSize) {
			engine.fill(i, 'buy', mid, orderSize);
		}
		// Price rose → expect reversion down → sell
		if (change >= triggerPct && engine.baseBalance >= orderSize) {
			engine.fill(i, 'sell', mid, orderSize);
		}

		engine.updateDrawdown(mid);
	}
}

/**
 * Defensive sim: stay in quote, do nothing. Baseline comparison.
 */
function simDefensive(engine, snapshots) {
	for (const snap of snapshots) {
		if (snap.midPrice) engine.updateDrawdown(snap.midPrice);
	}
}

// ─── Helpers ─────────────────────────────────────────────────

function realTradesInWindow(trades, fromIso, toIso) {
	if (!trades.length) return [];
	return trades.filter(t => {
		if (t.timestamp < fromIso) return false;
		if (toIso && t.timestamp >= toIso) return false;
		return true;
	});
}

const STRATEGIES = {
	'market-making':      simMarketMaking,
	'aggressive-sniping': simAggressiveSniping,
	'grid-range':         simGridRange,
	'mean-reversion':     simMeanReversion,
	'defensive':          simDefensive,
};

// ####################################################################################################################################
// ##############################################################  MAIN  ##############################################################
// ####################################################################################################################################

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {

const args = parseArgs();
const { chain, base, quote } = chainDefaults(args);
const { since, until } = isoRange(args);

const strategyName = args.strategy;
if (!strategyName || !STRATEGIES[strategyName]) {
	console.error(`❌ --strategy is required. Valid: ${Object.keys(STRATEGIES).join(', ')}`);
	process.exit(1);
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       🔬  BACKTEST ENGINE                               ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Strategy: ${strategyName}`);
console.log(`  Chain: ${chain}  |  Pair: ${base}/${quote}`);
console.log(`  Range: ${since.slice(0, 10)} → ${until.slice(0, 10)}`);
console.log('');

// ─── Load data ──────────────────────────────────────────────

const snapshots = getSnapshotsByDateRange(chain, base, quote, since, until);
const realTrades = getTradesByDateRange(chain, base, quote, since, until);

console.log(`  📸 Snapshots loaded: ${snapshots.length}`);
console.log(`  🔄 Real trades loaded: ${realTrades.length}`);

if (!snapshots.length) {
	console.log('\n  ⚠️  No snapshots found — cannot backtest without order book history.\n');
	process.exit(0);
}

// ─── Run simulation ─────────────────────────────────────────

const engine = new BacktestEngine();
const simFn = STRATEGIES[strategyName];
simFn(engine, snapshots, realTrades);

const lastMid = snapshots[snapshots.length - 1].midPrice || 0.20;
const s = engine.stats(lastMid);

console.log('');
console.log('📊 Backtest Results');
console.log('═'.repeat(50));
console.log(`  Strategy:       ${strategyName}`);
console.log(`  Total trades:   ${s.totalTrades} (${s.buys} buys, ${s.sells} sells)`);
console.log(`  Initial equity: ${engine.initialEquity.toFixed(4)} ${quote}`);
console.log(`  Final equity:   ${s.finalEquity} ${quote}`);
console.log(`  P&L:            ${s.pnl >= 0 ? '🟢' : '🔴'} ${s.pnl} ${quote} (${s.pnlPercent}%)`);
console.log(`  Max drawdown:   ${s.maxDrawdown}%`);
console.log(`  Win rate:       ${s.winRate}%`);
console.log(`  Avg buy price:  ${s.avgBuyPrice}`);
console.log(`  Last mid price: ${lastMid.toFixed(6)}`);
console.log('');

// ─── Trade log ──────────────────────────────────────────────

if (engine.trades.length) {
	console.log('📋 Trade Log (last 20)');
	console.log('─'.repeat(60));
	const recent = engine.trades.slice(-20);
	for (const t of recent) {
		const emoji = t.side === 'buy' ? '🟢' : '🔴';
		console.log(`  ${emoji} tick ${String(t.tick).padStart(4)} | ${t.side.padEnd(4)} ${t.amount.toFixed(3)} @ ${t.price.toFixed(6)} = ${t.quoteValue.toFixed(4)} ${quote}`);
	}
	console.log('');
}

// ─── CSV export ─────────────────────────────────────────────

if (args.csv) {
	const dir = ensureReportsDir();
	const headers = ['tick', 'side', 'price', 'amount', 'quoteValue'];
	const csvRows = engine.trades.map(t => [t.tick, t.side, t.price, t.amount, t.quoteValue]);
	const file = writeCsv(dir, `backtest-${strategyName}`, headers, csvRows);
	console.log(`💾 CSV exported → ${file}`);
	console.log('');
}

console.log('✅ Backtest complete.\n');

} // end if (isMainModule)

// Export for testing
export { BacktestEngine, STRATEGIES };
