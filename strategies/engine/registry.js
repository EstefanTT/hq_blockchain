// strategies/engine/registry.js
// Discovers and lists available strategies. Maps strategy names to their modules.
// Strategies register themselves or are auto-discovered from the strategies/ directory.

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const strategies = {};

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

export function registerStrategy(name, module) {
	strategies[name.toLowerCase()] = module;
	console.info('STRAT', name.toUpperCase(), 'Registered');
}

export function getStrategy(name) {
	const strategy = strategies[name.toLowerCase()];
	if (!strategy) throw new Error(`Strategy not found: ${name}`);
	return strategy;
}

export function listStrategies() {
	return Object.keys(strategies);
}
