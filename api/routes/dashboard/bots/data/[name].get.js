// api/routes/dashboard/bots/data/[name].get.js
// GET /api/dashboard/bots/data/:name — JSON data for a specific bot dashboard.
// WP-4 shim: for steem-dex-bot returns full cache, for others returns empty object.

import auth from '../../../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { name } = req.params;
		const { getBot, getBotModule } = await import('../../../../../services/botRegistry/index.js');

		let bot;
		try { bot = getBot(name); } catch {
			return res.status(404).json({ ok: false, error: `Unknown bot: ${name}` });
		}

		// Fetch cache data for this bot (returns null if not initialized)
		let data;
		const { getBotData } = await import('../../../../../services/cache/index.js');
		data = getBotData(name);
		if (!data) data = {};

		if (name === 'steem-dex-bot') {
			const { getRecentAnalysisLogs } = await import('../../../../../services/storage/botStore.js');
			data.recentBotLogs = getRecentAnalysisLogs('steem-dex-bot', 'steem', 10);
		}

		// Enrich with bot status + config for all bots
		const mod = getBotModule(name);
		const status = mod.getStatus();
		data.botMeta = bot.meta;
		data.botEnabled = status.trading;
		data.dataCollectionEnabled = status.dataCollection;

		try {
			const { getEffectiveConfig, getBotControl } = await import('../../../../../services/dynamicConfig/index.js');
			data.effectiveConfig = getEffectiveConfig(name);
			data.botControlState = getBotControl(name);
		} catch { /* dynamicConfig not ready */ }

		res.json(data);
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
