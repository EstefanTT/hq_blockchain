// scheduler/crons/updateAppSize.js
// Daily cron: calculates app + logs directory sizes and pushes to cache.

import { execSync } from 'child_process';
import { updateAppSizeInfo } from '../../services/cache/index.js';

function getDirSizeMB(dirPath) {
	try {
		const out = execSync(`du -sm "${dirPath}" 2>/dev/null`, { encoding: 'utf-8' });
		return parseInt(out.split('\t')[0], 10) || 0;
	} catch {
		return 0;
	}
}

export default async function updateAppSize() {
	const root = global.path?.root || process.cwd();
	const appMB = getDirSizeMB(root);
	const logsMB = getDirSizeMB(`${root}/logs`);

	updateAppSizeInfo({
		appSizeMB: appMB,
		logsSizeMB: logsMB,
		updatedAt: new Date().toISOString(),
	});

	console.info('CRON', `App size: ${appMB} MB | Logs: ${logsMB} MB`);
}
