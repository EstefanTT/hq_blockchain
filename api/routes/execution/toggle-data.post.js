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
			return res.status(400).json({ ok: false, error: 'Body must contain { "bot": "<name>", "enabled": true|false }' });
		}

		const { getBotModule } = await import('../../../services/botRegistry/index.js');
		let mod;
		try { mod = getBotModule(bot); } catch {
			return res.status(404).json({ ok: false, error: `Unknown bot: ${bot}` });
		}

		if (enabled) {
			await mod.startDataCollection();
		} else {
			await mod.stopDataCollection();
		}
		return res.json({ ok: true, bot, dataCollection: mod.getStatus().dataCollection });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
