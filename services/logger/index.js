// services/logger/index.js
// Overrides console.* methods with color-coded, context-tagged, file-persisted logging.
// Ported from hq-home with blockchain-specific context tags.

import { createWriteStream } from 'fs';
import path from 'path';

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const logFilePath = path.join('./logs/app.log');
const logStream = createWriteStream(logFilePath, { flags: 'a' });

// ANSI escape codes
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	fg: {
		white: "\x1b[37m",
		green: "\x1b[32m",
		blue: "\x1b[34m",
		yellow: "\x1b[33m",
		red: "\x1b[31m",
		cyan: "\x1b[36m",
		gray: "\x1b[90m",
		magenta: "\x1b[35m",
	},
};

// Context tags — each subsystem gets an emoji for quick visual scanning
const contextMap = {
	// Infrastructure
	START: "🟢",
	CONFIG: "🪛",
	CACHE: "🧮",
	DB: "🗃️",
	FS: "📁",
	API: "🌐",
	AUTH: "👤",
	CRON: "⏰",
	TGRAM: "💬",
	SERVER: "🕋",

	// Connectors
	CHAIN: "⛓️",
	DEX: "🔄",
	CEX: "📊",
	RPC: "📡",
	WS: "🔌",

	// Core domain
	TRADE: "💰",
	EXEC: "⚡",
	MARKET: "📈",
	WALLET: "👛",
	RISK: "🛡️",
	NFT: "🖼️",

	// Strategies & Apps
	STRAT: "🎯",
	BOT: "🤖",
	ORDER: "📝",
	MODE: "🔄",
	SNAPSHOT: "📸",
	ANALYT: "🔬",
	PRICE: "💲",
	ALERT: "🚨",
	STORAGE: "💾",
	MICRO: "🔹",
	MM: "📊",
	BRAIN: "🧠",
	SNIPE: "🎯",
	GRID: "📐",
	REVERT: "🔃",
	PAUSE: "⏸️",
	EXPLOIT: "🕵️",
	// Default
	DEFAULT: "📄",
};

// ####################################################################################################################################
// ############################################################   INIT   ##############################################################
// ####################################################################################################################################

// BigInt JSON safety
BigInt.prototype.toJSON = function () {
	return Number(this);
};

// Save originals
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Override console methods
console.log = (...args) => logWithColor('log', '[ LOG ]', 'green', args);
console.info = (...args) => logWithColor('info', '[ INFO ]', 'blue', args);
console.warn = (...args) => logWithColor('warn', '[ WARN ]', 'yellow', args);
console.error = (...args) => logWithColor('error', '[ ERROR ]', 'red', args);

// ####################################################################################################################################
// ######################################################   HELPER FUNCTIONS   ########################################################
// ####################################################################################################################################

function _getFormattedDateTime() {
	const now = new Date();
	const yy = String(now.getFullYear()).slice(-2);
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const hh = String(now.getHours()).padStart(2, '0');
	const min = String(now.getMinutes()).padStart(2, '0');
	return { date: `${yy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

// ####################################################################################################################################

function formatLevelPrefix(prefix, prefixColor) {
	const levelText = prefix.replace(/\[|\]/g, '').trim().padEnd(5);
	const levelDisplay = `[ ${levelText} ]`;
	return {
		formattedPrefix: `${colors.fg[prefixColor]}${levelDisplay}${colors.reset}`,
		plainPrefix: levelDisplay,
	};
}

// ####################################################################################################################################

function parseContextAndDevice(args) {
	let remainingArgs = args;
	let contextTag = '';
	let contextPlain = '';
	let extraTag = '';
	let extraTagPlain = '';

	if (typeof args[0] === 'string' && contextMap[args[0].toUpperCase()]) {
		const context = args[0].toUpperCase();
		const emoji = contextMap[context] || contextMap.DEFAULT;
		const paddedContext = context.padEnd(7);
		const ctxDisplay = `[ ${emoji}  ${paddedContext} ]`;

		contextTag = `${colors.fg.magenta}${ctxDisplay}${colors.reset}`;
		contextPlain = ctxDisplay;

		// Second arg as sub-context (e.g. chain name, wallet address, strategy ID)
		if (typeof args[1] === 'string' && args.length > 2) {
			const sub = args[1].toUpperCase();
			extraTag = `${colors.fg.cyan}[ ${sub} ]${colors.reset}`;
			extraTagPlain = `[ ${sub} ]`;
			remainingArgs = args.slice(2);
		} else {
			remainingArgs = args.slice(1);
		}
	} else {
		const ctxDisplay = `[ ${contextMap.DEFAULT}  ${'-'.padEnd(7)} ]`;
		contextTag = `${colors.fg.magenta}${ctxDisplay}${colors.reset}`;
		contextPlain = ctxDisplay;
	}

	return { contextTag, contextPlain, extraTag, extraTagPlain, remainingArgs };
}

// ####################################################################################################################################

function logToTerminal(level, terminalMessage, args) {
	if (level === 'log') return originalConsoleLog(terminalMessage, ...args);
	if (level === 'info') return originalConsoleInfo(terminalMessage, ...args);
	if (level === 'warn') return originalConsoleWarn(terminalMessage, ...args);
	if (level === 'error') return originalConsoleError(terminalMessage, ...args);
}

// ####################################################################################################################################

function writeToAppLog(date, time, plainPrefix, contextPlain, extraTagPlain, args) {
	const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
	const logLine = `[ ${date} ${time} ] ${plainPrefix} ${contextPlain}${extraTagPlain ? ' ' + extraTagPlain : ''} ${message}\n`;
	logStream.write(logLine);
}

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

const logWithColor = (level, prefix, prefixColor, args) => {
	const { date, time } = _getFormattedDateTime();
	const { contextTag, contextPlain, extraTag, extraTagPlain, remainingArgs } = parseContextAndDevice(args);
	const { formattedPrefix, plainPrefix } = formatLevelPrefix(prefix, prefixColor);

	const terminalMessage = `[ ${time} ] ${formattedPrefix} ${contextTag}${extraTag ? ' ' + extraTag : ''}`;

	logToTerminal(level, terminalMessage, remainingArgs);

	// Only info/warn/error go to file (log = terminal only)
	if (level !== 'log') {
		writeToAppLog(date, time, plainPrefix, contextPlain, extraTagPlain, remainingArgs);
	}
};
