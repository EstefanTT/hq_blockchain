// api/routes/execution/toggle-data.post.js
// POST /api/execution/toggle-data — turn data collection ON/OFF for a bot.
// Body: { "bot": "steem-dex-bot", "enabled": true|false }
// ON  → starts price engine, chain poller, snapshots, account refresh
// OFF → stops all data feeds (also stops trading if active)

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { bot, enabled } = req.body ?? {};
		if (!bot || typeof enabled !== 'boolean') {
			return res.status(400).json({ ok: false, error: 'Body must contain { "bot": "steem-dex-bot", "enabled": true|false }' });
		}

		if (bot === 'steem-dex-bot') {
			const { startDataCollection, stopDataCollection, isDataCollectionActive } = await import('../../../apps/steem-dex-bot/index.js');
			if (enabled) {
				await startDataCollection();
			} else {
				await stopDataCollection();
			}
			return res.json({ ok: true, bot, dataCollection: isDataCollectionActive() });
		}

		return res.status(404).json({ ok: false, error: `Unknown bot: ${bot}` });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
