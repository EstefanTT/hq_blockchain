// api/routes/execution/run-analysis.post.js
// POST /api/execution/run-analysis — run an analysis script from the dashboard.
// Body: { "script": "summary" | "analyze" | "backtest", "args": ["--days", "7"] }
// Returns the script output or error.

import { execFile } from 'child_process';
import path from 'path';
import auth from '../../middlewares/auth.js';

const ALLOWED_SCRIPTS = {
	summary:  'scripts/analysis/dashboard-summary.js',
	analyze:  'scripts/analysis/analyze-log.js',
	backtest: 'scripts/analysis/backtest.js',
};

// Allowed argument patterns (only flags + values, no shell metacharacters)
const SAFE_ARG = /^--?[a-zA-Z][a-zA-Z0-9-]*$|^[a-zA-Z0-9._-]+$/;

export default [auth, async function handler(req, res) {
	try {
		const { script, args = [] } = req.body ?? {};

		if (!script || !ALLOWED_SCRIPTS[script]) {
			return res.status(400).json({ ok: false, error: `Unknown script "${script}". Allowed: ${Object.keys(ALLOWED_SCRIPTS).join(', ')}` });
		}

		if (!Array.isArray(args) || args.some(a => typeof a !== 'string' || !SAFE_ARG.test(a))) {
			return res.status(400).json({ ok: false, error: 'Invalid args — only simple flags and values allowed' });
		}

		const projectRoot = path.resolve(import.meta.dirname, '..', '..', '..');
		const scriptPath = path.join(projectRoot, ALLOWED_SCRIPTS[script]);

		const output = await new Promise((resolve, reject) => {
			execFile(process.execPath, [scriptPath, ...args], {
				cwd: projectRoot,
				timeout: 30_000,
				maxBuffer: 512 * 1024,
				env: { ...process.env },
			}, (err, stdout, stderr) => {
				if (err) reject(new Error(stderr || err.message));
				else resolve(stdout);
			});
		});

		return res.json({ ok: true, script, output: output.trim() });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
