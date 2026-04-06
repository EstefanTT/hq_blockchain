// api/routes/dashboard/home-data.get.js
// GET /api/dashboard/home-data — JSON payload for the master dashboard.
// Returns: bot list with statuses, app overview, kill switch, global dry-run.

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(_req, res) {
	try {
		const { getSteemDexBotData, getBotControlState } = await import('../../../services/cache/index.js');
		const { isKilled } = await import('../../../core/risk/killSwitch.js');
		const { isTradingActive, getBotName, isDataCollectionActive } = await import('../../../apps/steem-dex-bot/index.js');
		const { getBotControl, getEffectiveConfig } = await import('../../../services/dynamicConfig/index.js');
		const { isDryRunEnabled } = await import('../../../core/execution/dryRun.js');
		const { isBrainRunning, getCurrentMode } = await import('../../../strategies/engine/brain.js');
		const { getRecentAnalysisLogs } = await import('../../../services/storage/steemDexStore.js');

		const botName = getBotName();
		const botData = getSteemDexBotData();
		const control = getBotControl(botName);

		const bots = [
			{
				name: botName,
				label: 'STEEM DEX Bot',
				chain: 'Steem',
				pair: 'STEEM / SBD',
				enabled: isTradingActive(),
				dataCollection: isDataCollectionActive(),
				dryRun: control.dryRun,
				disabledStrategies: control.disabledStrategies,
				brainRunning: isBrainRunning(),
				currentMode: getCurrentMode(),
				accountData: botData.accountData,
				priceEngine: botData.priceEngine,
			},
		];

		const overview = {
			appSizeInfo: botData.appSizeInfo,
			storageStats: botData.storageStats,
		};

		const killSwitchState = isKilled();

		// Recent logs for the dashboard
		let recentLogs = [];
		try { recentLogs = getRecentAnalysisLogs('steem', 10); } catch { /* empty */ }

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
