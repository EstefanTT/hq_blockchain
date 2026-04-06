// api/routes/execution/emergency-stop.post.js
// POST /api/execution/emergency-stop — hard stop: kill switch + cancel orders + bot OFF.
// Body: { "bot": "steem-dex-bot" } or {} (defaults to all bots)

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { bot } = req.body ?? {};
		const { getBotModule, listBots } = await import('../../../services/botRegistry/index.js');

		if (bot) {
			// Stop a specific bot
			const mod = getBotModule(bot);
			if (mod.emergencyStop) {
				await mod.emergencyStop();
			} else {
				await mod.stopBot();
			}
		} else {
			// Stop all bots
			for (const { name } of listBots()) {
				const mod = getBotModule(name);
				if (mod.emergencyStop) {
					await mod.emergencyStop();
				} else {
					await mod.stopBot();
				}
			}
		}

		const { isKilled } = await import('../../../core/risk/killSwitch.js');
		return res.json({ ok: true, killSwitch: isKilled(), message: 'Emergency stop activated — all trading halted' });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
