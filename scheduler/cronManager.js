// scheduler/cronManager.js
// Loads cron jobs from crons/ directory and schedules them. Ported from hq-home.
// Each cron file exports a default async function.

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

export const cronStartsEvery = {
	"min": "* * * * *",
	"_5min": "*/5 * * * *",
	"_10min": "*/10 * * * *",
	"_15min": "*/15 * * * *",
	"_30min": "*/30 * * * *",
	"hour": "*/60 * * * *",
	"_3hour": "0 */3 * * *",
	"_6hour": "0 */6 * * *",
	"_12hour": "0 */12 * * *",
	"dayAt00h00": "0 0 * * *",
	"dayAt03h": "0 3 * * *",
	"dayAt06h": "0 6 * * *",
	"dayAt12h": "0 12 * * *",
	"dayAt18h": "0 18 * * *",
	"weekOnMon_00h00": "0 0 * * 1",
	"monthOnDay1_00h00": "0 0 1 * *",
};

// ####################################################################################################################################
// ######################################################   HELPER FUNCTIONS   ########################################################
// ####################################################################################################################################

async function loadCronJobs() {
	const cronJobs = {};
	const cronsPath = path.join(global.path.scheduler, 'crons');
	const files = fs.readdirSync(cronsPath).filter(file => file.endsWith('.js'));

	for (const file of files) {
		const modulePath = path.join(cronsPath, file);
		const jobName = file.replace('.js', '');
		const jobModule = await import(modulePath);
		if (typeof jobModule.default === 'function') {
			cronJobs[jobName] = jobModule.default;
		} else {
			console.warn('CRON', `⚠️ ${file} does not export a default function`);
		}
	}
	return cronJobs;
}

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

export default async function startCrons() {
	const cronJobs = await loadCronJobs();

	// ── Sync balances every 15 minutes ──
	cron.schedule(cronStartsEvery._15min, async () => {
		console.info('CRON', 'syncBalances');
		await cronJobs.syncBalances?.();
	}, { timezone: 'UTC' });

	// ── Refresh prices every 5 minutes ──
	cron.schedule(cronStartsEvery._5min, async () => {
		console.info('CRON', 'refreshPrices');
		await cronJobs.refreshPrices?.();
	}, { timezone: 'UTC' });

	// ── Run strategy ticks every minute ──
	cron.schedule(cronStartsEvery.min, async () => {
		await cronJobs.runStrategies?.();
	}, { timezone: 'UTC' });

	// ── Risk checks every 10 minutes ──
	cron.schedule(cronStartsEvery._10min, async () => {
		console.info('CRON', 'riskChecks');
		await cronJobs.riskChecks?.();
	}, { timezone: 'UTC' });

	// ── App/log size daily at 03:00 UTC ──
	cron.schedule(cronStartsEvery.dayAt03h, async () => {
		console.info('CRON', 'updateAppSize');
		await cronJobs.updateAppSize?.();
	}, { timezone: 'UTC' });

	// Run once at startup too
	await cronJobs.updateAppSize?.();

	console.info('CRON', `Loaded ${Object.keys(cronJobs).length} cron jobs`);
}
