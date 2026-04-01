// connectors/dex/registry.js
// Central registry for DEX adapters. Returns the correct adapter by name + chain.
// Usage: const uni = getDex('uniswap-v3', 'ethereum');

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const dexes = {};

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Register a DEX adapter.
 * @param {string} name - DEX identifier (e.g. 'uniswap-v3')
 * @param {string} chain - Chain identifier (e.g. 'ethereum')
 * @param {object} adapter - Adapter implementing the DEX interface
 */
export function registerDex(name, chain, adapter) {
	const key = `${name.toLowerCase()}:${chain.toLowerCase()}`;
	dexes[key] = adapter;
	console.info('DEX', name.toUpperCase(), `Registered on ${chain}`);
}

/**
 * Get a DEX adapter by name and chain.
 */
export function getDex(name, chain) {
	const key = `${name.toLowerCase()}:${chain.toLowerCase()}`;
	const adapter = dexes[key];
	if (!adapter) throw new Error(`DEX adapter not found: ${key}`);
	return adapter;
}

/**
 * List all registered DEX keys.
 */
export function listDexes() {
	return Object.keys(dexes);
}
