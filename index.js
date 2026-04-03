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
		console.info('CRON', '🔴 DEV MODE | Crons Scheduler disabled');
	}

	// ##########################################    APPS   ##########################################

	// Apps are loaded as modules in the same process.
	// To enable an app, import and call its init function here.
	// Example:
	// const { init: initSpreadBot } = await import('./apps/spread-bot/index.js');
	// await initSpreadBot();

	const { init: initSteemDexBot } = await import('./apps/steem-dex-bot/index.js');
	await initSteemDexBot();

	console.info('START', 'App ready ✅');
}

run();
