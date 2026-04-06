// api/routes/dashboard/home-data.get.js
// GET /api/dashboard/home-data — JSON payload for the master dashboard.
// Returns: bot list with statuses, app overview, kill switch, global dry-run.

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(_req, res) {
	try {
		const { getBotData } = await import('../../../services/cache/index.js');
		const { isKilled } = await import('../../../core/risk/killSwitch.js');
		const { getBotControl, getEffectiveConfig } = await import('../../../services/dynamicConfig/index.js');
		const { isDryRunEnabled } = await import('../../../core/execution/dryRun.js');
		const { isBrainRunning, getCurrentMode } = await import('../../../strategies/engine/brain.js');
		const { getRecentAnalysisLogs } = await import('../../../services/storage/botStore.js');
		const { listBots, getBotModule } = await import('../../../services/botRegistry/index.js');

		const registeredBots = listBots();

		const bots = registeredBots.map(botMeta => {
			const mod = getBotModule(botMeta.name);
			const status = mod.getStatus();
			const control = getBotControl(botMeta.name);

			const bot = {
				name: botMeta.name,
				label: botMeta.displayName,
				chain: botMeta.chain,
				pair: botMeta.pairs.join(' / '),
				enabled: status.trading,
				dataCollection: status.dataCollection,
				dryRun: control.dryRun,
				disabledStrategies: control.disabledStrategies,
				error: status.error,
			};

			// Enrich with brain info and cache data for bots that have it
			const botData = getBotData(botMeta.name);
			if (botData) {
				if (botMeta.name === 'steem-dex-bot') {
					bot.brainRunning = isBrainRunning();
					bot.currentMode = getCurrentMode();
				}
				bot.accountData = botData.accountData;
				bot.priceEngine = botData.priceEngine;
			}

			return bot;
		});

		// Overview data (from primary bot for now)
		const botData = getBotData('steem-dex-bot');
		const overview = {
			appSizeInfo: botData?.appSizeInfo ?? {},
			storageStats: botData?.storageStats ?? {},
		};

		const killSwitchState = isKilled();

		// Recent logs for the dashboard
		let recentLogs = [];
		try { recentLogs = getRecentAnalysisLogs('steem-dex-bot', 'steem', 10); } catch { /* empty */ }

		return res.json({
			ok: true,
			bots,
			overview,
			recentLogs,
			globalDryRun: isDryRunEnabled(),
			killSwitch: { active: killSwitchState.killed, reason: killSwitchState.killedReason, at: killSwitchState.killedAt },
			timestamp: new Date().toISOString(),
		});
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
