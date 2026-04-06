// api/routes/execution/toggle-bot.post.js
// POST /api/execution/toggle-bot — turn a bot ON/OFF from the dashboard.
// Body: { "bot": "steem-dex-bot", "enabled": true|false }
// ON  → clears disabled strategies, deactivates kill switch, starts brain + strategies
// OFF → cancels open orders, stops brain + strategies

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
			await mod.startBot();
		} else {
			await mod.stopBot();
		}
		return res.json({ ok: true, bot, enabled: mod.getStatus().trading });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
