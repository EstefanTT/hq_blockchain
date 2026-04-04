// api/routes/dashboard/steem-prices.get.js
// GET /api/dashboard/steem-prices — returns price engine data for the dashboard.
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';
import { getSteemDexBotData } from '../../../services/cache/index.js';
import { getRecentAnalysisLogs } from '../../../services/storage/steemDexStore.js';

function handler(_req, res) {
	const data = getSteemDexBotData();
	data.recentBotLogs = getRecentAnalysisLogs('steem', 10);
	res.json(data);
}

export default [auth, handler];
