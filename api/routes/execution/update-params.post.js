// api/routes/execution/update-params.post.js
// POST /api/execution/update-params — update runtime strategy parameters.
// Body: { "bot": "steem-dex-bot", "section": "marketMaking", "params": { "spreadPercent": 0.6 } }
// Merges into dynamic config overlay, persists to disk, hot-reloads into running brain.

import auth from '../../middlewares/auth.js';

const VALID_SECTIONS = new Set([
	'microLayer', 'marketMaking', 'aggressiveSniping', 'gridRange',
	'meanReversion', 'defensivePause', 'botExploitation', 'risk', 'brain',
]);

export default [auth, async function handler(req, res) {
	try {
		const { bot, section, params } = req.body ?? {};
		if (!bot || !section || !params || typeof params !== 'object') {
			return res.status(400).json({ ok: false, error: 'Body must contain { "bot", "section", "params": {...} }' });
		}
		if (!VALID_SECTIONS.has(section)) {
			return res.status(400).json({ ok: false, error: `Invalid section: ${section}. Valid: ${[...VALID_SECTIONS].join(', ')}` });
		}

		const { updateSection, getEffectiveConfig } = await import('../../../services/dynamicConfig/index.js');
		updateSection(bot, section, params);

		// Hot-reload into running bot (if it supports reloadConfig)
		const { getBotModule } = await import('../../../services/botRegistry/index.js');
		try {
			const mod = getBotModule(bot);
			if (mod.reloadConfig) await mod.reloadConfig();
		} catch { /* bot not registered yet or no reloadConfig */ }

		return res.json({ ok: true, bot, section, effective: getEffectiveConfig(bot)[section] });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
