#!/usr/bin/env node
// scripts/analysis/analyze-log.js
// ─────────────────────────────────────────────────────────────
// Reads analysis_log (SQLite) and generates a human-readable report:
//   - Total events per strategy / event type
//   - Mode switches and reasons
//   - Fill rates, slippage rejects, rebalance frequency
//   - Bot-exploitation performance
//   - RC warnings and defensive pauses
//
// Usage:
//   node scripts/analysis/analyze-log.js
//   node scripts/analysis/analyze-log.js --days 7
//   node scripts/analysis/analyze-log.js --strategy market-making --days 30
//   node scripts/analysis/analyze-log.js --chain hive --csv
//
// Params:
//   --days N            Look back N days (default: all)
//   --start-date DATE   ISO start date (e.g. 2026-03-01)
//   --strategy NAME     Filter by strategy (market-making, grid-range, etc.)
//   --chain NAME        Chain name (default: steem)
//   --base TOKEN        Base token override (default: per chain)
//   --quote TOKEN       Quote token override (default: per chain)
//   --csv               Also export CSV to data/reports/

import '../../services/globalConfig/init.js';
import { getAnalysisLogsByDateRange } from '../../services/storage/steemDexStore.js';
import { parseArgs, chainDefaults, isoRange, ensureReportsDir, writeCsv } from './shared.js';

// ─── Strategy → eventType mapping (D4) ──────────────────────

const STRATEGY_EVENT_MAP = {
	'market-making': new Set(['MM', 'ORDER', 'MICRO']),
	'grid-range': new Set(['GRID', 'ORDER']),
	'aggressive-sniping': new Set(['SNIPE', 'ORDER']),
	'mean-reversion': new Set(['REVERSION', 'ORDER']),
	'bot-exploitation': new Set(['EXPLOIT', 'ORDER']),
	'brain': new Set(['BRAIN', 'MODE']),
	'risk': new Set(['RISK']),
};

// ─── Main ────────────────────────────────────────────────────

const args = parseArgs();
const { chain, base, quote } = chainDefaults(args);
const { since, until } = isoRange(args);

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       📊  ANALYSIS LOG REPORT                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Chain: ${chain}  |  Pair: ${base}/${quote}`);
console.log(`  Range: ${since.slice(0, 10)} → ${until.slice(0, 10)}`);
if (args.strategy) console.log(`  Filter: ${args.strategy}`);
console.log('');

// ─── Fetch ───────────────────────────────────────────────────

let rows = getAnalysisLogsByDateRange(chain, since, until);

// Strategy filter (D4)
if (args.strategy) {
	const allowed = STRATEGY_EVENT_MAP[args.strategy];
	if (!allowed) {
		console.error(`❌ Unknown strategy "${args.strategy}". Valid: ${Object.keys(STRATEGY_EVENT_MAP).join(', ')}`);
		process.exit(1);
	}
	rows = rows.filter(r => allowed.has(r.eventType));
}

if (!rows.length) {
	console.log('  ⚠️  No events found for this range / filter.\n');
	process.exit(0);
}

// ─── Event type breakdown ────────────────────────────────────

const byType = {};
const bySeverity = {};
for (const r of rows) {
	byType[r.eventType] = (byType[r.eventType] || 0) + 1;
	bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
}

console.log('📋 Event Breakdown');
console.log('─'.repeat(50));
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${type.padEnd(18)} ${String(count).padStart(6)}`);
}
console.log(`  ${'TOTAL'.padEnd(18)} ${String(rows.length).padStart(6)}`);
console.log('');

console.log('⚡ Severity Distribution');
console.log('─'.repeat(50));
for (const [sev, count] of Object.entries(bySeverity).sort((a, b) => b[1] - a[1])) {
	const bar = '█'.repeat(Math.min(Math.round(count / rows.length * 40), 40));
	console.log(`  ${sev.padEnd(8)} ${String(count).padStart(6)}  ${bar}`);
}
console.log('');

// ─── Mode switches (BRAIN events with "Mode switch") ────────

const modeEvents = rows.filter(r => r.eventType === 'BRAIN' && r.message?.includes('Mode switch'));
if (modeEvents.length) {
	console.log('🧠 Mode Switches');
	console.log('─'.repeat(50));
	const reasons = {};
	for (const e of modeEvents) {
		const reason = e.message.replace(/.*→\s*/, '').trim() || 'unknown';
		reasons[reason] = (reasons[reason] || 0) + 1;
	}
	for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
		console.log(`  ${count}× → ${reason}`);
	}
	console.log(`  Total switches: ${modeEvents.length}`);
	console.log('');
}

// ─── Forced switches (Manual override) ──────────────────────

const forcedEvents = rows.filter(r => r.eventType === 'BRAIN' && r.message?.includes('Forced'));
if (forcedEvents.length) {
	console.log('⚡ Forced Mode Overrides');
	console.log('─'.repeat(50));
	console.log(`  Total forced overrides: ${forcedEvents.length}`);
	for (const e of forcedEvents.slice(-5)) {
		console.log(`  ${e.timestamp.slice(0, 19)}  ${e.message}`);
	}
	console.log('');
}

// ─── Orders & fills ─────────────────────────────────────────

const orderEvents = rows.filter(r => r.eventType === 'ORDER');
if (orderEvents.length) {
	const placed = orderEvents.filter(r => r.message?.includes('Placed') || r.message?.includes('placed'));
	const cancelled = orderEvents.filter(r => r.message?.includes('Cancel') || r.message?.includes('cancel'));
	const filled = orderEvents.filter(r => r.message?.includes('Fill') || r.message?.includes('fill'));
	const dryRun = orderEvents.filter(r => r.message?.includes('DRY-RUN'));

	console.log('📝 Order Activity');
	console.log('─'.repeat(50));
	console.log(`  Placed:     ${placed.length}`);
	console.log(`  Cancelled:  ${cancelled.length}`);
	console.log(`  Filled:     ${filled.length}`);
	if (dryRun.length) console.log(`  Dry-run:    ${dryRun.length}`);
	if (placed.length) {
		const fillRate = filled.length / placed.length * 100;
		console.log(`  Fill rate:  ${fillRate.toFixed(1)}%`);
	}
	console.log('');
}

// ─── Slippage & Risk ────────────────────────────────────────

const riskEvents = rows.filter(r => r.eventType === 'RISK');
if (riskEvents.length) {
	const slippageRejects = riskEvents.filter(r => r.message?.includes('lippage'));
	const rebalances = riskEvents.filter(r => r.message?.includes('ebalance'));

	console.log('🛡️  Risk Events');
	console.log('─'.repeat(50));
	console.log(`  Slippage rejects:  ${slippageRejects.length}`);
	console.log(`  Rebalance events:  ${rebalances.length}`);
	console.log(`  Total risk events: ${riskEvents.length}`);
	console.log('');
}

// ─── Bot Exploitation ───────────────────────────────────────

const exploitEvents = rows.filter(r => r.eventType === 'EXPLOIT');
if (exploitEvents.length) {
	const cycles = exploitEvents.filter(r => r.message?.includes('cycle') || r.message?.includes('Cycle'));

	console.log('🕵️  Bot Exploitation');
	console.log('─'.repeat(50));
	console.log(`  Total events: ${exploitEvents.length}`);
	console.log(`  Cycles:       ${cycles.length}`);
	for (const e of exploitEvents.slice(-3)) {
		console.log(`  ${e.timestamp.slice(0, 19)}  ${e.message}`);
	}
	console.log('');
}

// ─── RC Warnings & Defensive ────────────────────────────────

const rcWarnings = rows.filter(r => r.message?.includes('RC') && (r.severity === 'WARN' || r.message?.includes('warning')));
const defensiveEvents = rows.filter(r => r.message?.includes('defensive') || r.message?.includes('Defensive'));

if (rcWarnings.length || defensiveEvents.length) {
	console.log('⚠️  Warnings & Defensive Pauses');
	console.log('─'.repeat(50));
	console.log(`  RC warnings:       ${rcWarnings.length}`);
	console.log(`  Defensive entries:  ${defensiveEvents.length}`);
	console.log('');
}

// ─── Micro Layer summary ────────────────────────────────────

const microEvents = rows.filter(r => r.eventType === 'MICRO');
if (microEvents.length) {
	console.log('🔹 Micro Layer Activity');
	console.log('─'.repeat(50));
	console.log(`  Total micro events: ${microEvents.length}`);
	console.log('');
}

// ─── Timeline (first & last event) ─────────────────────────

console.log('📅 Timeline');
console.log('─'.repeat(50));
console.log(`  First event: ${rows[0].timestamp}`);
console.log(`  Last event:  ${rows[rows.length - 1].timestamp}`);
const durationMs = new Date(rows[rows.length - 1].timestamp) - new Date(rows[0].timestamp);
const durationHrs = (durationMs / 3_600_000).toFixed(1);
console.log(`  Duration:    ${durationHrs} hours`);
console.log('');

// ─── CSV export ─────────────────────────────────────────────

if (args.csv) {
	const dir = ensureReportsDir();
	const headers = ['timestamp', 'eventType', 'severity', 'strategy', 'message'];
	const csvRows = rows.map(r => [r.timestamp, r.eventType, r.severity, r.strategy || '', r.message]);
	const file = writeCsv(dir, 'analyze-log', headers, csvRows);
	console.log(`💾 CSV exported → ${file}`);
	console.log('');
}

console.log('✅ Report complete.\n');
