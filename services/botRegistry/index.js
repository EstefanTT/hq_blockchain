// services/botRegistry/index.js
// Central registry for bot modules. Auto-discovery registers bots at boot.
// Usage: import { getBot, listBots, getBotModule } from './services/botRegistry/index.js';

const bots = {};

const REQUIRED_METHODS = ['init', 'startDataCollection', 'stopDataCollection', 'startBot', 'stopBot', 'shutdown', 'getStatus'];
const REQUIRED_META = ['name', 'displayName', 'chain', 'pairs', 'description'];

/**
 * Register a bot module.
 * @param {string} name - Bot identifier (must match meta.name)
 * @param {object} module - The bot's ES module (all lifecycle exports)
 * @param {object} meta - { name, displayName, chain, pairs, description }
 */
export function registerBot(name, module, meta) {
	if (bots[name]) throw new Error(`Bot already registered: ${name}`);

	for (const field of REQUIRED_META) {
		if (!meta[field] && meta[field] !== false) throw new Error(`Bot "${name}" meta missing required field: ${field}`);
	}
	if (!Array.isArray(meta.pairs)) throw new Error(`Bot "${name}" meta.pairs must be an array`);

	for (const method of REQUIRED_METHODS) {
		if (typeof module[method] !== 'function') throw new Error(`Bot "${name}" missing required export: ${method}()`);
	}

	bots[name] = { module, meta };
	console.info('REGISTRY', `${meta.displayName} registered`);
}

/**
 * Get a bot entry by name.
 * @param {string} name
 * @returns {{ module: object, meta: object }}
 */
export function getBot(name) {
	const bot = bots[name];
	if (!bot) throw new Error(`Bot not found: ${name}`);
	return bot;
}

/**
 * Get just the module for a bot (for calling lifecycle methods).
 * @param {string} name
 * @returns {object}
 */
export function getBotModule(name) {
	return getBot(name).module;
}

/**
 * List metadata for all registered bots.
 * @returns {Array<{ name, displayName, chain, pairs, description }>}
 */
export function listBots() {
	return Object.values(bots).map(b => ({ ...b.meta }));
}

/**
 * Check if a bot is registered.
 * @param {string} name
 * @returns {boolean}
 */
export function hasBot(name) {
	return name in bots;
}

/**
 * Clear all registrations (for testing).
 */
export function _reset() {
	for (const key of Object.keys(bots)) delete bots[key];
}
