// api/routes/execution/switch-mode.post.js
// POST /api/execution/switch-mode — force a specific brain mode.
// Body: { "mode": "market-making" | "aggressive-sniping" | ... }
// Protected by auth middleware.

import auth from '../../middlewares/auth.js';

const VALID_MODES = new Set([
	'market-making',
	'aggressive-sniping',
	'grid-range',
	'mean-reversion',
	'defensive',
	'bot-exploitation',
]);

export default [auth, async function handler(req, res) {
	try {
		const { mode } = req.body ?? {};
		if (!mode || !VALID_MODES.has(mode)) {
			return res.status(400).json({
				ok: false,
				error: `Invalid mode. Valid: ${[...VALID_MODES].join(', ')}`,
			});
		}

		const { isBrainRunning, forceMode } = await import('../../../strategies/engine/brain.js');

		if (!isBrainRunning()) {
			return res.status(409).json({ ok: false, error: 'Brain is not running' });
		}

		await forceMode(mode);
		return res.json({ ok: true, mode });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
