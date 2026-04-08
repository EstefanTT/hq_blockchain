// index.js — Bootstrap: globalConfig → logger → cache → API → scheduler → apps

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ####################################################################################################################################
// ######################################################   LOCAL IMPORTS   ###########################################################
// ####################################################################################################################################

import './services/globalConfig/init.js';				// Auto-executed on import | loads .env, sets global paths & config
import './services/logger/index.js';					// Auto-executed on import | overrides console.* methods
// import { runtimeCache } from './services/cache/index.js';
import startCrons from './scheduler/cronManager.js';

// ####################################################################################################################################
// ########################################################   VARIABLES   #############################################################
// ####################################################################################################################################

const defaultPort = global.isProduction ? 3000 : 3001;
const PORT = process.env.PORT || defaultPort;
const HOST = process.env.HOST || '0.0.0.0';

// ####################################################################################################################################
// ###########################################################   RUN   ################################################################
// ####################################################################################################################################

async function run() {

	console.info('START', 'App starting ...');

	// ##########################################    API    ##########################################

	const { default: app } = await import('./api/index.js');

	app.listen(PORT, HOST, () => {
		console.info('API', `API server running at http://${HOST}:${PORT}`);
	});

	// ##########################################   CRONS   ##########################################

	if (global.isProduction) {
		startCrons();
		console.info('CRON', '🟢 PRODUCTION | Crons Scheduler enabled');
	} else {
		// In dev mode, skip recurring schedules but still run one-shot startup tasks
		const { default: updateAppSize } = await import('./scheduler/crons/updateAppSize.js');
		await updateAppSize();
		console.info('CRON', '🔴 DEV MODE | Crons Scheduler disabled (startup tasks ran once)');
	}

	// ##########################################    APPS   ##########################################

	// Auto-discover all bot apps from apps/ directory.
	// Each bot must export a `meta` object to be registered. Folders without meta are skipped.
	// Folders starting with _ are skipped (e.g. _template).

	const { readdirSync } = await import('fs');
	const { join } = await import('path');
	const { registerBot } = await import('./services/botRegistry/index.js');

	const appsDir = join(global.path.root, 'apps');
	for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith('_')) continue;

		let mod;
		try {
			mod = await import(`./apps/${entry.name}/index.js`);
		} catch (err) {
			console.error('BOOT', `Failed to import apps/${entry.name}: ${err.message}`);
			continue;
		}

		if (!mod.meta) {
			console.info('BOOT', `Skipping apps/${entry.name} (no meta export)`);
			continue;
		}

		registerBot(mod.meta.name, mod, mod.meta);

		try {
			await mod.init();
		} catch (err) {
			console.error('BOOT', `${mod.meta.displayName} init failed: ${err.message}`);
		}
	}

	console.info('START', 'App ready ✅');
}

run();
