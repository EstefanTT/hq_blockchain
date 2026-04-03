// api/routes/dashboard/steem-prices.get.js
// GET /api/dashboard/steem-prices — returns price engine data for the dashboard.
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';
import { getSteemDexBotData } from '../../../services/cache/index.js';

function handler(_req, res) {
	res.json(getSteemDexBotData());
}

export default [auth, handler];
