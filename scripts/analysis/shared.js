// scripts/analysis/shared.js
// Shared utilities for analysis scripts — arg parsing, chain defaults, CSV export.

import fs from 'fs';
import path from 'path';

// ─── Argument parsing ────────────────────────────────────────

/**
 * Parse CLI args into a simple object.
 * Supports: --days N, --start-date DATE, --strategy NAME, --chain NAME,
 *           --base TOKEN, --quote TOKEN, --csv
 */
export function parseArgs() {
	const argv = process.argv.slice(2);
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		const key = argv[i].replace(/^--/, '');
		if (key === 'csv') { args.csv = true; continue; }
		const val = argv[i + 1];
		if (val && !val.startsWith('--')) { args[key] = val; i++; }
	}
	return args;
}

// ─── Chain → token pair defaults (D7) ────────────────────────

const CHAIN_DEFAULTS = {
	steem: { base: 'STEEM', quote: 'SBD' },
	hive: { base: 'HIVE', quote: 'HBD' },
	blurt: { base: 'BLURT', quote: 'BSD' },
};

/**
 * Resolve chain name and token pair from args.
 */
export function chainDefaults(args) {
	const chain = args.chain || 'steem';
	const defaults = CHAIN_DEFAULTS[chain] || CHAIN_DEFAULTS.steem;
	return {
		chain,
		base: args.base || defaults.base,
		quote: args.quote || defaults.quote,
	};
}

// ─── Date range helpers ──────────────────────────────────────

/**
 * Build ISO since/until from --days or --start-date.
 * Default: all time (since epoch / until now).
 */
export function isoRange(args) {
	let since, until;

	if (args['start-date']) {
		since = new Date(args['start-date']).toISOString();
	} else if (args.days) {
		const d = new Date();
		d.setUTCDate(d.getUTCDate() - Number(args.days));
		d.setUTCHours(0, 0, 0, 0);
		since = d.toISOString();
	} else {
		since = '2000-01-01T00:00:00.000Z';
	}

	until = args['end-date']
		? new Date(args['end-date']).toISOString()
		: new Date().toISOString();

	return { since, until };
}

// ─── CSV export (D5) ─────────────────────────────────────────

/**
 * Ensure data/reports/ exists and return its path.
 */
export function ensureReportsDir() {
	const dir = path.join(global.path.data, 'reports');
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Write a CSV file and return the path.
 * @param {string}   dir      — directory to write in
 * @param {string}   prefix   — filename prefix (e.g. 'analyze-log')
 * @param {string[]} headers  — column headers
 * @param {Array[]}  rows     — array of arrays
 * @returns {string} path to the written file
 */
export function writeCsv(dir, prefix, headers, rows) {
	const date = new Date().toISOString().slice(0, 10);
	const filePath = path.join(dir, `${prefix}-${date}.csv`);
	const escape = (v) => {
		const s = String(v ?? '');
		return s.includes(',') || s.includes('"') || s.includes('\n')
			? '"' + s.replace(/"/g, '""') + '"'
			: s;
	};
	const lines = [headers.join(','), ...rows.map(r => r.map(escape).join(','))];
	fs.writeFileSync(filePath, lines.join('\n') + '\n');
	return filePath;
}
