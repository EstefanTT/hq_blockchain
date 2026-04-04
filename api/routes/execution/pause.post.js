// api/routes/execution/pause.post.js
// POST /api/execution/pause — force emergency pause (defensive mode).
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(_req, res) {
	try {
		const { isBrainRunning, forceMode } = await import('../../../strategies/engine/brain.js');

		if (!isBrainRunning()) {
			// Brain not running — try direct emergencyStop
			const { emergencyStop } = await import('../../../apps/steem-dex-bot/index.js');
			await emergencyStop();
			return res.json({ ok: true, action: 'emergency_stop', message: 'Trading stopped (brain was not running)' });
		}

		await forceMode('defensive');
		return res.json({ ok: true, action: 'forced_defensive', message: 'Brain switched to defensive mode' });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
