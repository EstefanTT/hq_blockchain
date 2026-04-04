// api/routes/execution/set-dry-run.post.js
// POST /api/execution/set-dry-run — toggle dry-run mode at runtime.
// Body: { "enabled": true|false }
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { enabled } = req.body ?? {};
		if (typeof enabled !== 'boolean') {
			return res.status(400).json({ ok: false, error: 'Body must contain { "enabled": true|false }' });
		}

		const { setDryRun, isDryRunEnabled } = await import('../../../core/execution/dryRun.js');
		const { setDryRunFlag } = await import('../../../services/cache/index.js');

		setDryRun(enabled);
		setDryRunFlag(enabled);

		return res.json({ ok: true, dryRun: isDryRunEnabled() });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
