// testing/apps/lifecycle.test.js
// Validates that all bot apps in apps/ conform to the standard lifecycle contract.
// Run: node --test testing/apps/lifecycle.test.js

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync } from 'fs';
import { join } from 'path';

const appsDir = join(process.cwd(), 'apps');
const botDirs = readdirSync(appsDir, { withFileTypes: true })
	.filter(d => d.isDirectory() && !d.name.startsWith('_'))
	.map(d => d.name);

const REQUIRED_METHODS = ['init', 'startDataCollection', 'stopDataCollection', 'startBot', 'stopBot', 'shutdown', 'getStatus'];
const REQUIRED_META_FIELDS = ['name', 'displayName', 'chain', 'pairs', 'description'];

describe('Bot Lifecycle Contract', () => {

	for (const dir of botDirs) {
		describe(dir, () => {
			let mod;

			it('can be imported', async () => {
				mod = await import(`../../apps/${dir}/index.js`);
			});

			it('has meta export or is intentionally excluded', () => {
				// Bots without meta are skipped by auto-discovery (e.g. research-sandbox)
				// No assertion needed — we just skip further checks
				if (!mod.meta) return;

				assert.equal(typeof mod.meta, 'object', 'meta must be an object');
			});

			it('meta has all required fields', () => {
				if (!mod.meta) return;
				for (const field of REQUIRED_META_FIELDS) {
					assert.ok(mod.meta[field] !== undefined && mod.meta[field] !== '', `meta.${field} is required`);
				}
				assert.ok(Array.isArray(mod.meta.pairs), 'meta.pairs must be an array');
			});

			it('exports all required lifecycle methods', () => {
				if (!mod.meta) return;
				for (const method of REQUIRED_METHODS) {
					assert.equal(typeof mod[method], 'function', `missing required export: ${method}()`);
				}
			});

			it('getStatus returns correct shape', () => {
				if (!mod.meta) return;
				const status = mod.getStatus();
				assert.equal(typeof status.dataCollection, 'boolean', 'getStatus().dataCollection must be boolean');
				assert.equal(typeof status.trading, 'boolean', 'getStatus().trading must be boolean');
				assert.ok('error' in status, 'getStatus() must have error field');
			});
		});
	}
});
