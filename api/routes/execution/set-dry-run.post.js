// api/routes/execution/set-dry-run.post.js
// POST /api/execution/set-dry-run — toggle dry-run mode at runtime.
// Body: { "enabled": true|false }              — global dry-run
// Body: { "enabled": true|false, "bot": "…" }  — per-bot dry-run
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { enabled, bot } = req.body ?? {};
		if (typeof enabled !== 'boolean') {
			return res.status(400).json({ ok: false, error: 'Body must contain { "enabled": true|false }' });
		}

		const { setDryRun, isDryRunEnabled } = await import('../../../core/execution/dryRun.js');

		// Global dry-run (execution module)
		setDryRun(enabled);

		// Per-bot dry-run (persisted + cache)
		if (bot) {
			const { setBotControl, getBotControl } = await import('../../../services/dynamicConfig/index.js');
			const { updateBotControlState, setDryRunFlag } = await import('../../../services/cache/index.js');
			setBotControl(bot, { dryRun: enabled });
			updateBotControlState(bot, getBotControl(bot));
			setDryRunFlag(bot, enabled);
		}

		return res.json({ ok: true, dryRun: isDryRunEnabled(), bot: bot || null });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
