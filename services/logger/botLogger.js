// services/logger/botLogger.js
// Double logging system for trading bots (Step 5).
//
// Human log  → console (via existing logger) + logs/bot.log (emoji-rich, readable)
// Analysis   → data/analysis/<botName>.log.jsonl (structured JSON per line)
//            → analysis_log SQLite table (via botStore.logAnalysisEvent)
//
// Usage:
//   import { createBotLogger } from '../../services/logger/botLogger.js';
//   const log = createBotLogger({ botName: 'steem-dex-bot', chainName: 'steem' });
//   log.info('ORDER', 'BUY 12.34 STEEM @ 0.1182', { side: 'BUY', price: 0.1182, ... });
//   log.warn('ALERT', 'RC below 20%', { rc: 18.5 });

import { createWriteStream, mkdirSync } from 'fs';
import path from 'path';

// ─── Context emoji map (bot-domain only) ─────────────────────

const BOT_CONTEXTS = {
	BOT: '🤖',
	ORDER: '📝',
	TRADE: '💰',
	MODE: '🔄',
	ALERT: '🚨',
	PRICE: '💲',
	SNAPSHOT: '📸',
	RISK: '🛡️',
	CHAIN: '⛓️',
	WALLET: '👛',
	STORAGE: '💾',
	MICRO: '🔹',
	MM: '📊',
	BRAIN: '🧠',
	SNIPE: '🎯',
	GRID: '📐',
	REVERT: '🔃',
	PAUSE: '⏸️',
	EXPLOIT: '🕵️',
};

// ─── Severity → level mapping ────────────────────────────────

const SEVERITY_CONSOLE = {
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error',
	DEBUG: 'info',
};

// ─── Formatter helpers ───────────────────────────────────────

function ts() {
	const now = new Date();
	const hh = String(now.getHours()).padStart(2, '0');
	const mm = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
}

function datestamp() {
	const now = new Date();
	const yy = String(now.getFullYear()).slice(-2);
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

// ═════════════════════════════════════════════════════════════
//  Factory
// ═════════════════════════════════════════════════════════════

/**
 * Create a bot logger instance.
 * @param {Object} opts
 * @param {string} opts.botName   — e.g. 'steem-dex-bot' (used for JSONL file name)
 * @param {string} opts.chainName — e.g. 'steem' (stored in every analysis record)
 * @returns {{ info, warn, error, analysis }}
 */
export function createBotLogger({ botName, chainName }) {
	// ─── Bot log file stream ────────────────────────────────
	const botLogPath = path.resolve('./logs/bot.log');
	const botStream = createWriteStream(botLogPath, { flags: 'a' });

	// ─── JSONL analysis stream ──────────────────────────────
	const analysisDir = path.resolve('./data/analysis');
	mkdirSync(analysisDir, { recursive: true });
	const jsonlPath = path.join(analysisDir, `${botName}.log.jsonl`);
	const jsonlStream = createWriteStream(jsonlPath, { flags: 'a' });

	// Lazy-load SQLite writer to avoid circular imports at module load time
	let _logAnalysisEvent = null;
	async function getLogAnalysisEvent() {
		if (!_logAnalysisEvent) {
			const mod = await import('../storage/botStore.js');
			_logAnalysisEvent = mod.logAnalysisEvent;
		}
		return _logAnalysisEvent;
	}

	// ─── Write to bot.log (human-readable, no ANSI) ─────────
	function writeBotLog(severity, context, message) {
		const emoji = BOT_CONTEXTS[context] || '📄';
		const line = `[${datestamp()} ${ts()}] [${severity.padEnd(5)}] [${emoji}  ${context.padEnd(8)}] [${chainName.toUpperCase()}] ${message}\n`;
		botStream.write(line);
	}

	// ─── Write analysis to JSONL + SQLite ────────────────────
	function writeAnalysis(eventType, severity, message, data, strategy) {
		const record = {
			timestamp: new Date().toISOString(),
			chainName,
			eventType,
			severity,
			strategy: strategy || 'NONE',
			message,
			data: data || null,
		};

		// JSONL — one JSON object per line, fast append
		jsonlStream.write(JSON.stringify(record) + '\n');

		// SQLite — fire-and-forget (lazy loaded)
		getLogAnalysisEvent().then(fn => fn(botName, record)).catch(() => { });
	}

	// ─── Public API ──────────────────────────────────────────

	/**
	 * Log a bot event at a specific severity.
	 * Writes to: console (existing logger) + bot.log + analysis (JSONL + SQLite).
	 *
	 * @param {'INFO'|'WARN'|'ERROR'} severity
	 * @param {string} context  — BOT, ORDER, TRADE, MODE, ALERT, PRICE, SNAPSHOT, RISK, CHAIN, WALLET, STORAGE
	 * @param {string} message  — human-readable text (emoji encouraged)
	 * @param {Object} [data]   — structured data for analysis log
	 * @param {string} [strategy='NONE'] — strategy name for filtering
	 */
	function log(severity, context, message, data, strategy) {
		const ctx = (context || 'BOT').toUpperCase();
		const sev = (severity || 'INFO').toUpperCase();
		const consoleFn = SEVERITY_CONSOLE[sev] || 'info';

		// 1. Console + app.log (via existing overridden console.*)
		console[consoleFn](ctx, chainName.toUpperCase(), message);

		// 2. bot.log (human-readable, file only)
		writeBotLog(sev, ctx, message);

		// 3. Analysis (JSONL + SQLite)
		writeAnalysis(ctx, sev, message, data, strategy);
	}

	return {
		/** Info-level bot event */
		info(context, message, data, strategy) {
			log('INFO', context, message, data, strategy);
		},

		/** Warning-level bot event */
		warn(context, message, data, strategy) {
			log('WARN', context, message, data, strategy);
		},

		/** Error-level bot event */
		error(context, message, data, strategy) {
			log('ERROR', context, message, data, strategy);
		},

		/**
		 * Write analysis record only (no console output).
		 * For high-frequency events you don't want cluttering the terminal.
		 */
		analysis(eventType, severity, message, data, strategy) {
			writeAnalysis(eventType, severity || 'INFO', message, data, strategy);
		},
	};
}
