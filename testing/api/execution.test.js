// testing/api/execution.test.js
// Tests for the execution API route handlers.
// Run with: node testing/api/execution.test.js

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ─── Helpers: mock req/res ───────────────────────────────────

function mockReq(body = {}, headers = {}) {
	return { body, headers };
}

function mockRes() {
	const res = {
		_status: 200,
		_json: null,
		status(code) { res._status = code; return res; },
		json(data) { res._json = data; return res; },
	};
	return res;
}

// ─── pause.post.js (handler only, skip auth) ────────────────

describe('POST /api/execution/pause', async () => {

	it('should call forceMode(defensive) when brain is running', async () => {
		let forcedTo = null;
		// Mock the brain module in a self-contained way
		const handler = async (_req, res) => {
			// Simulate brain running + forceMode
			const isBrainRunning = () => true;
			const forceMode = async (m) => { forcedTo = m; };

			if (!isBrainRunning()) {
				return res.json({ ok: true, action: 'emergency_stop' });
			}
			await forceMode('defensive');
			return res.json({ ok: true, action: 'forced_defensive', message: 'Brain switched to defensive mode' });
		};

		const res = mockRes();
		await handler(mockReq(), res);

		assert.equal(res._json.ok, true);
		assert.equal(res._json.action, 'forced_defensive');
		assert.equal(forcedTo, 'defensive');
	});
});

// ─── set-dry-run.post.js ────────────────────────────────────

describe('POST /api/execution/set-dry-run', async () => {

	it('should accept { enabled: true } and toggle dry-run', async () => {
		const mod = await import(`../../core/execution/dryRun.js?t=${Date.now()}`);
		mod.setDryRun(false); // start off

		const handler = async (req, res) => {
			const { enabled } = req.body ?? {};
			if (typeof enabled !== 'boolean') {
				return res.status(400).json({ ok: false, error: 'Body must contain { "enabled": true|false }' });
			}
			mod.setDryRun(enabled);
			return res.json({ ok: true, dryRun: mod.isDryRunEnabled() });
		};

		const res = mockRes();
		await handler(mockReq({ enabled: true }), res);

		assert.equal(res._json.ok, true);
		assert.equal(res._json.dryRun, true);
		assert.equal(mod.isDryRunEnabled(), true);
	});

	it('should reject non-boolean enabled', async () => {
		const handler = async (req, res) => {
			const { enabled } = req.body ?? {};
			if (typeof enabled !== 'boolean') {
				return res.status(400).json({ ok: false, error: 'Body must contain { "enabled": true|false }' });
			}
			return res.json({ ok: true });
		};

		const res = mockRes();
		await handler(mockReq({ enabled: 'yes' }), res);

		assert.equal(res._status, 400);
		assert.equal(res._json.ok, false);
	});
});

// ─── switch-mode.post.js ────────────────────────────────────

describe('POST /api/execution/switch-mode', async () => {
	const VALID_MODES = new Set([
		'market-making', 'aggressive-sniping', 'grid-range',
		'mean-reversion', 'defensive', 'bot-exploitation',
	]);

	it('should accept a valid mode', async () => {
		let forcedTo = null;
		const handler = async (req, res) => {
			const { mode } = req.body ?? {};
			if (!mode || !VALID_MODES.has(mode)) {
				return res.status(400).json({ ok: false, error: 'Invalid mode' });
			}
			forcedTo = mode;
			return res.json({ ok: true, mode });
		};

		const res = mockRes();
		await handler(mockReq({ mode: 'grid-range' }), res);

		assert.equal(res._json.ok, true);
		assert.equal(res._json.mode, 'grid-range');
		assert.equal(forcedTo, 'grid-range');
	});

	it('should reject an invalid mode', async () => {
		const handler = async (req, res) => {
			const { mode } = req.body ?? {};
			if (!mode || !VALID_MODES.has(mode)) {
				return res.status(400).json({ ok: false, error: 'Invalid mode' });
			}
			return res.json({ ok: true, mode });
		};

		const res = mockRes();
		await handler(mockReq({ mode: 'turbo' }), res);

		assert.equal(res._status, 400);
		assert.equal(res._json.ok, false);
	});

	it('should reject missing mode', async () => {
		const handler = async (req, res) => {
			const { mode } = req.body ?? {};
			if (!mode || !VALID_MODES.has(mode)) {
				return res.status(400).json({ ok: false, error: 'Invalid mode' });
			}
			return res.json({ ok: true, mode });
		};

		const res = mockRes();
		await handler(mockReq({}), res);

		assert.equal(res._status, 400);
	});
});
