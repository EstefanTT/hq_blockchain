// connectors/chains/steem-like/registry.js
// Default configurations for known Steem-like blockchains.
// These serve as fallbacks; the app's config.json can override everything.

export const STEEM_LIKE_DEFAULTS = {
	steem: {
		nodes: [
			'https://api.steemit.com',
			'https://api.moecki.online',
		],
		baseToken: 'STEEM',
		quoteToken: 'SBD',
	},
	hive: {
		nodes: [
			'https://api.hive.blog',
			'https://api.deathwing.me',
			'https://api.openhive.network',
		],
		baseToken: 'HIVE',
		quoteToken: 'HBD',
	},
	blurt: {
		nodes: [
			'https://rpc.blurt.world',
		],
		baseToken: 'BLURT',
		quoteToken: 'BSD',
	},
};

/**
 * Get default config for a known Steem-like chain.
 * @param {string} chainName
 * @returns {Object|null}
 */
export function getSteemLikeDefaults(chainName) {
	return STEEM_LIKE_DEFAULTS[chainName.toLowerCase()] || null;
}
