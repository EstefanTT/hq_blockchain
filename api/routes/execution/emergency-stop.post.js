// api/routes/execution/emergency-stop.post.js
// POST /api/execution/emergency-stop — hard stop: kill switch + cancel orders + bot OFF.
// Body: {} (no params needed)

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { emergencyStop } = await import('../../../apps/steem-dex-bot/index.js');
		await emergencyStop();

		const { isKilled } = await import('../../../core/risk/killSwitch.js');
		return res.json({ ok: true, killSwitch: isKilled(), message: 'Emergency stop activated — all trading halted' });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
