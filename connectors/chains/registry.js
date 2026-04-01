// connectors/chains/registry.js
// Central registry for chain adapters. Returns the correct adapter by chain name.
// Usage: const eth = getChain('ethereum');

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const chains = {};

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Register a chain adapter.
 * @param {string} name - Chain identifier (e.g. 'ethereum', 'arbitrum', 'solana')
 * @param {object} adapter - Adapter object implementing the chain interface
 */
export function registerChain(name, adapter) {
	chains[name.toLowerCase()] = adapter;
	console.info('CHAIN', name.toUpperCase(), 'Adapter registered');
}

/**
 * Get a chain adapter by name.
 * @param {string} name - Chain identifier
 * @returns {object} Chain adapter
 */
export function getChain(name) {
	const adapter = chains[name.toLowerCase()];
	if (!adapter) throw new Error(`Chain adapter not found: ${name}`);
	return adapter;
}

/**
 * List all registered chain names.
 */
export function listChains() {
	return Object.keys(chains);
}
