// connectors/cex/registry.js
// Central registry for CEX adapters. Returns the correct adapter by exchange name.
// Usage: const binance = getCex('binance');

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const cexes = {};

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Register a CEX adapter.
 */
export function registerCex(name, adapter) {
	cexes[name.toLowerCase()] = adapter;
	console.info('CEX', name.toUpperCase(), 'Adapter registered');
}

/**
 * Get a CEX adapter by name.
 */
export function getCex(name) {
	const adapter = cexes[name.toLowerCase()];
	if (!adapter) throw new Error(`CEX adapter not found: ${name}`);
	return adapter;
}

export function listCexes() {
	return Object.keys(cexes);
}
