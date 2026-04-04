// testing/scripts/shared.test.js
// Tests for scripts/analysis/shared.js — utility functions.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ─── parseArgs ──────────────────────────────────────────────

describe('shared parseArgs', () => {
	let parseArgs;

	it('should dynamically import shared', async () => {
		const mod = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		parseArgs = mod.parseArgs;
		assert.ok(typeof parseArgs === 'function', 'parseArgs is a function');
	});
});

// ─── chainDefaults ──────────────────────────────────────────

describe('shared chainDefaults', () => {
	it('should return STEEM/SBD defaults for steem chain', async () => {
		const { chainDefaults } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const result = chainDefaults({ chain: 'steem' });
		assert.equal(result.chain, 'steem');
		assert.equal(result.base, 'STEEM');
		assert.equal(result.quote, 'SBD');
	});

	it('should return HIVE/HBD defaults for hive chain', async () => {
		const { chainDefaults } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const result = chainDefaults({ chain: 'hive' });
		assert.equal(result.chain, 'hive');
		assert.equal(result.base, 'HIVE');
		assert.equal(result.quote, 'HBD');
	});

	it('should default to steem when no chain specified', async () => {
		const { chainDefaults } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const result = chainDefaults({});
		assert.equal(result.chain, 'steem');
		assert.equal(result.base, 'STEEM');
	});

	it('should override base/quote from args', async () => {
		const { chainDefaults } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const result = chainDefaults({ chain: 'steem', base: 'XYZ', quote: 'ABC' });
		assert.equal(result.base, 'XYZ');
		assert.equal(result.quote, 'ABC');
	});
});

// ─── isoRange ───────────────────────────────────────────────

describe('shared isoRange', () => {
	it('should return full range when no days or start-date', async () => {
		const { isoRange } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const { since, until } = isoRange({});
		assert.equal(since, '2000-01-01T00:00:00.000Z', 'since is epoch');
		assert.ok(until.endsWith('Z'), 'until is ISO');
	});

	it('should compute since from --days', async () => {
		const { isoRange } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const { since } = isoRange({ days: '7' });
		const expected = new Date();
		expected.setUTCDate(expected.getUTCDate() - 7);
		expected.setUTCHours(0, 0, 0, 0);
		assert.equal(since, expected.toISOString());
	});

	it('should parse --start-date', async () => {
		const { isoRange } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);
		const { since } = isoRange({ 'start-date': '2026-06-01' });
		assert.ok(since.startsWith('2026-06-01'), 'since starts with given date');
	});
});

// ─── writeCsv ───────────────────────────────────────────────

describe('shared writeCsv', async () => {
	it('should write a CSV file with correct content', async () => {
		const fs = await import('fs');
		const os = await import('os');
		const path = await import('path');
		const { writeCsv } = await import(`../../scripts/analysis/shared.js?t=${Date.now()}`);

		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-test-'));
		const file = writeCsv(tmpDir, 'test-export', ['a', 'b'], [[1, 'hello'], [2, 'world,quoted']]);

		assert.ok(fs.existsSync(file), 'CSV file created');
		const content = fs.readFileSync(file, 'utf8');
		assert.ok(content.startsWith('a,b\n'), 'CSV header is correct');
		assert.ok(content.includes('"world,quoted"'), 'CSV escapes commas');

		// Cleanup
		fs.rmSync(tmpDir, { recursive: true });
	});
});
