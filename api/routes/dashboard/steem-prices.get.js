// api/routes/dashboard/steem-prices.get.js
// GET /api/dashboard/steem-prices — returns price engine data + effective config for the bot dashboard.
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';
import { getSteemDexBotData } from '../../../services/cache/index.js';
import { getRecentAnalysisLogs } from '../../../services/storage/steemDexStore.js';

function handler(_req, res) {
	const data = getSteemDexBotData();
	data.recentBotLogs = getRecentAnalysisLogs('steem', 10);

	// Include effective config + bot control for the strategy editor
	try {
		const { getEffectiveConfig, getBotControl } = require_dynamicConfig();
		const { getBotName, isTradingActive, isDataCollectionActive } = require_bot();
		const botName = getBotName();
		data.effectiveConfig = getEffectiveConfig(botName);
		data.botControlState = getBotControl(botName);
		data.botEnabled = isTradingActive();
		data.dataCollectionEnabled = isDataCollectionActive();
	} catch { /* ignore if not ready */ }

	res.json(data);
}

// Lazy imports to avoid circular deps at module level
let _dc, _bot;
function require_dynamicConfig() {
	if (!_dc) { throw new Error('not ready'); }
	return _dc;
}
function require_bot() {
	if (!_bot) { throw new Error('not ready'); }
	return _bot;
}
import('../../../services/dynamicConfig/index.js').then(m => { _dc = m; });
import('../../../apps/steem-dex-bot/index.js').then(m => { _bot = m; });

export default [auth, handler];
