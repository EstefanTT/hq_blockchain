// apps/_template/tests/example.test.js
// Template test skeleton — copy to testing/apps/<your-bot>.test.js when scaffolding a new bot.
// Run:  node --test testing/apps/<your-bot>.test.js

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ─── Replace 'your-bot-name' with your bot's directory name ─

const BOT_DIR = 'your-bot-name';

describe(BOT_DIR, () => {
	let mod;

	before(async () => {
		mod = await import(`../../../apps/${BOT_DIR}/index.js`);
	});

	after(async () => {
		if (mod?.shutdown) await mod.shutdown();
	});

	it('exports meta with required fields', () => {
		assert.ok(mod.meta, 'meta export required');
		assert.ok(mod.meta.name, 'meta.name required');
		assert.ok(mod.meta.displayName, 'meta.displayName required');
		assert.ok(mod.meta.chain, 'meta.chain required');
		assert.ok(Array.isArray(mod.meta.pairs), 'meta.pairs must be array');
		assert.ok(mod.meta.description, 'meta.description required');
	});

	it('exports all lifecycle methods', () => {
		const required = ['init', 'startDataCollection', 'stopDataCollection',
			'startBot', 'stopBot', 'shutdown', 'getStatus'];
		for (const method of required) {
			assert.equal(typeof mod[method], 'function', `missing export: ${method}`);
		}
	});

	it('getStatus returns correct shape before init', () => {
		const status = mod.getStatus();
		assert.equal(typeof status.dataCollection, 'boolean');
		assert.equal(typeof status.trading, 'boolean');
		assert.ok('error' in status);
	});

	// TODO: Add your bot-specific tests below
});
