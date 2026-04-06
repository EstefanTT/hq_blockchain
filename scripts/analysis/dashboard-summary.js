#!/usr/bin/env node
// scripts/analysis/dashboard-summary.js
// ─────────────────────────────────────────────────────────────
// Quick one-line daily summary for terminal / cron output.
// Shows: total orders, position, last brain decision, micro-layer profit.
//
// Usage:
//   node scripts/analysis/dashboard-summary.js
//   node scripts/analysis/dashboard-summary.js --chain hive
//   node scripts/analysis/dashboard-summary.js --days 1

import '../../services/globalConfig/init.js';
import { getAnalysisLogsByDateRange, getSnapshotsByDateRange, getTradesByDateRange } from '../../services/storage/botStore.js';
import { parseArgs, chainDefaults, isoRange } from './shared.js';

const args = parseArgs();
if (!args.days) args.days = '1';   // default to last 24h
const { chain, base, quote } = chainDefaults(args);
const { since, until } = isoRange(args);
const bot = args.bot || 'steem-dex-bot';

const logs = getAnalysisLogsByDateRange(bot, chain, since, until);
const snapshots = getSnapshotsByDateRange(bot, chain, base, quote, since, until);
const trades = getTradesByDateRange(bot, chain, base, quote, since, until);

// ─── Event counts ────────────────────────────────────────────

const orderEvents = logs.filter(r => r.eventType === 'ORDER').length;
const microEvents = logs.filter(r => r.eventType === 'MICRO').length;
const riskEvents = logs.filter(r => r.eventType === 'RISK').length;

// ─── Last brain decision ────────────────────────────────────

const brainEvents = logs.filter(r => r.eventType === 'BRAIN');
const lastBrain = brainEvents.length
	? brainEvents[brainEvents.length - 1].message
	: 'none';

// ─── Last snapshot mid price ────────────────────────────────

const lastSnap = snapshots.length ? snapshots[snapshots.length - 1] : null;
const midPrice = lastSnap?.midPrice;

// ─── Output ─────────────────────────────────────────────────

const period = args.days === '1' ? 'today' : `last ${args.days}d`;

console.log('');
console.log(`┌─────────────────────────────────────────────────────────┐`);
console.log(`│  📊 ${chain.toUpperCase()} ${base}/${quote} Summary (${period})`.padEnd(58) + '│');
console.log(`├─────────────────────────────────────────────────────────┤`);
console.log(`│  Orders:      ${String(orderEvents).padEnd(8)} Micro:  ${String(microEvents).padEnd(8)} Risk: ${String(riskEvents).padEnd(5)}│`);
console.log(`│  Snapshots:   ${String(snapshots.length).padEnd(8)} Trades: ${String(trades.length).padEnd(13)}│`);
if (midPrice) {
	console.log(`│  Mid price:   ${midPrice.toFixed(6).padEnd(43)}│`);
}
console.log(`│  Brain:       ${lastBrain.slice(0, 43).padEnd(43)}│`);
console.log(`│  Events:      ${String(logs.length).padEnd(8)} (${since.slice(0, 10)} → ${until.slice(0, 10)})`.padEnd(58) + '│');
console.log(`└─────────────────────────────────────────────────────────┘`);
console.log('');
