// services/dynamicConfig/index.js
// ─────────────────────────────────────────────────────────────
// Dynamic config layer. Reads static config from apps/*/config.json,
// merges runtime overrides from config/dynamic/strategies/*.json,
// and persists changes to disk so they survive restarts.
//
// Usage:
//   import { getEffectiveConfig, updateParam, getBotControl, setBotControl } from '…/dynamicConfig/index.js';
//   const cfg = getEffectiveConfig('steem-dex-bot');
//   updateParam('steem-dex-bot', 'marketMaking.spreadPercent', 0.6);

import fs from 'fs';
import path from 'path';

// ─── State ───────────────────────────────────────────────────

const staticConfigs = {};    // { 'steem-dex-bot': { …config.json } }
const dynamicOverrides = {}; // { 'steem-dex-bot': { marketMaking: { spreadPercent: 0.6 }, … } }
const botControl = {};       // { 'steem-dex-bot': { enabled: false, dryRun: false, disabledStrategies: [] } }

// ─── Paths ───────────────────────────────────────────────────

function dynamicDir() {
	return path.join(global.path.config, 'dynamic', 'strategies');
}

function dynamicFilePath(botName) {
	return path.join(dynamicDir(), `${botName}.json`);
}

function controlFilePath(botName) {
	return path.join(global.path.config, 'dynamic', `${botName}-control.json`);
}

// ─── Load ────────────────────────────────────────────────────

/**
 * Register a bot's static config (called once at init).
 */
export function registerStaticConfig(botName, config) {
	staticConfigs[botName] = structuredClone(config);

	// Load dynamic overrides from disk if they exist
	const dynPath = dynamicFilePath(botName);
	if (fs.existsSync(dynPath)) {
		try {
			dynamicOverrides[botName] = JSON.parse(fs.readFileSync(dynPath, 'utf-8'));
		} catch {
			dynamicOverrides[botName] = {};
		}
	} else {
		dynamicOverrides[botName] = {};
	}

	// Load control state from disk
	// enabled + dataCollection always start OFF regardless of persisted state;
	// dryRun and disabledStrategies are preferences and are preserved across restarts.
	const ctrlPath = controlFilePath(botName);
	if (fs.existsSync(ctrlPath)) {
		try {
			const persisted = JSON.parse(fs.readFileSync(ctrlPath, 'utf-8'));
			botControl[botName] = {
				...persisted,
				enabled: false,
				dataCollection: false,
			};
		} catch {
			botControl[botName] = { enabled: false, dryRun: false, dataCollection: false, disabledStrategies: [] };
		}
	} else {
		// OFF by default on fresh start
		botControl[botName] = { enabled: false, dryRun: false, dataCollection: false, disabledStrategies: [] };
	}
}

/**
 * Get the merged config (static + dynamic overrides).
 */
export function getEffectiveConfig(botName) {
	const base = structuredClone(staticConfigs[botName] || {});
	const overrides = dynamicOverrides[botName] || {};
	return deepMerge(base, overrides);
}

/**
 * Get only the dynamic overrides (for display/diff).
 */
export function getDynamicOverrides(botName) {
	return structuredClone(dynamicOverrides[botName] || {});
}

// ─── Update ──────────────────────────────────────────────────

/**
 * Update a single parameter via dot-path.
 * Example: updateParam('steem-dex-bot', 'marketMaking.spreadPercent', 0.6)
 */
export function updateParam(botName, dotPath, value) {
	if (!dynamicOverrides[botName]) dynamicOverrides[botName] = {};
	setByPath(dynamicOverrides[botName], dotPath, value);
	_saveDynamic(botName);
}

/**
 * Bulk-update parameters for a strategy section.
 * Example: updateSection('steem-dex-bot', 'marketMaking', { spreadPercent: 0.6, orderSizeQuote: 5 })
 */
export function updateSection(botName, section, params) {
	if (!dynamicOverrides[botName]) dynamicOverrides[botName] = {};
	if (!dynamicOverrides[botName][section]) dynamicOverrides[botName][section] = {};
	Object.assign(dynamicOverrides[botName][section], params);
	_saveDynamic(botName);
}

// ─── Bot Control ─────────────────────────────────────────────

export function getBotControl(botName) {
	return structuredClone(botControl[botName] || { enabled: false, dryRun: false, dataCollection: false, disabledStrategies: [] });
}

export function setBotControl(botName, fields) {
	if (!botControl[botName]) botControl[botName] = { enabled: false, dryRun: false, dataCollection: false, disabledStrategies: [] };
	Object.assign(botControl[botName], fields);
	_saveControl(botName);
}

export function isStrategyDisabled(botName, strategyMode) {
	return (botControl[botName]?.disabledStrategies || []).includes(strategyMode);
}

export function setStrategyDisabled(botName, strategyMode, disabled) {
	if (!botControl[botName]) botControl[botName] = { enabled: false, dryRun: false, dataCollection: false, disabledStrategies: [] };
	const list = botControl[botName].disabledStrategies;
	const idx = list.indexOf(strategyMode);
	if (disabled && idx === -1) list.push(strategyMode);
	if (!disabled && idx !== -1) list.splice(idx, 1);
	_saveControl(botName);
}

/**
 * Get all registered bot names.
 */
export function getRegisteredBots() {
	return Object.keys(staticConfigs);
}

// ─── Persistence ─────────────────────────────────────────────

function _saveDynamic(botName) {
	const dir = dynamicDir();
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(dynamicFilePath(botName), JSON.stringify(dynamicOverrides[botName], null, '\t') + '\n');
}

function _saveControl(botName) {
	const dir = path.join(global.path.config, 'dynamic');
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(controlFilePath(botName), JSON.stringify(botControl[botName], null, '\t') + '\n');
}

// ─── Helpers ─────────────────────────────────────────────────

function deepMerge(target, source) {
	for (const key of Object.keys(source)) {
		if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
			if (!target[key] || typeof target[key] !== 'object') target[key] = {};
			deepMerge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}

function setByPath(obj, dotPath, value) {
	const parts = dotPath.split('.');
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = value;
}
