// api/routes/execution/toggle-strategy.post.js
// POST /api/execution/toggle-strategy — enable/disable a specific strategy within a bot.
// Body: { "bot": "steem-dex-bot", "strategy": "market-making", "enabled": true|false }
// Brain will skip disabled strategies in its next _decide() tick.

import auth from '../../middlewares/auth.js';

const VALID_STRATEGIES = new Set([
	'market-making', 'aggressive-sniping', 'grid-range',
	'mean-reversion', 'defensive', 'bot-exploitation',
]);

export default [auth, async function handler(req, res) {
	try {
		const { bot, strategy, enabled } = req.body ?? {};
		if (!bot || !strategy || typeof enabled !== 'boolean') {
			return res.status(400).json({ ok: false, error: 'Body must contain { "bot", "strategy", "enabled" }' });
		}
		if (!VALID_STRATEGIES.has(strategy)) {
			return res.status(400).json({ ok: false, error: `Invalid strategy: ${strategy}. Valid: ${[...VALID_STRATEGIES].join(', ')}` });
		}

		const { setStrategyDisabled, getBotControl } = await import('../../../services/dynamicConfig/index.js');
		const { updateBotControlState } = await import('../../../services/cache/index.js');

		setStrategyDisabled(bot, strategy, !enabled);
		updateBotControlState(bot, getBotControl(bot));

		return res.json({ ok: true, bot, strategy, enabled, control: getBotControl(bot) });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
