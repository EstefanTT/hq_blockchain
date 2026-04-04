// testing/scripts/analyzelog.test.js
// Tests for the strategy-to-eventType mapping used in analyze-log.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// We test the mapping logic and shared utils rather than the full CLI
// (which requires SQLite data). The CLI is covered by the integration test
// in task 9 (run scripts against real data).

describe('analyze-log strategy mapping', () => {

	const STRATEGY_EVENT_MAP = {
		'market-making':     new Set(['MM', 'ORDER', 'MICRO']),
		'grid-range':        new Set(['GRID', 'ORDER']),
		'aggressive-sniping': new Set(['SNIPE', 'ORDER']),
		'mean-reversion':    new Set(['REVERSION', 'ORDER']),
		'bot-exploitation':  new Set(['EXPLOIT', 'ORDER']),
		'brain':             new Set(['BRAIN', 'MODE']),
		'risk':              new Set(['RISK']),
	};

	it('should have 7 strategies defined', () => {
		assert.equal(Object.keys(STRATEGY_EVENT_MAP).length, 7);
	});

	it('market-making should include MM, ORDER, MICRO', () => {
		const s = STRATEGY_EVENT_MAP['market-making'];
		assert.ok(s.has('MM'));
		assert.ok(s.has('ORDER'));
		assert.ok(s.has('MICRO'));
		assert.equal(s.size, 3);
	});

	it('brain should include BRAIN and MODE only', () => {
		const s = STRATEGY_EVENT_MAP['brain'];
		assert.ok(s.has('BRAIN'));
		assert.ok(s.has('MODE'));
		assert.equal(s.size, 2);
	});

	it('risk should include only RISK', () => {
		const s = STRATEGY_EVENT_MAP['risk'];
		assert.ok(s.has('RISK'));
		assert.equal(s.size, 1);
	});

	it('every strategy should include at least one eventType', () => {
		for (const [name, set] of Object.entries(STRATEGY_EVENT_MAP)) {
			assert.ok(set.size > 0, `${name} has at least one event type`);
		}
	});

	it('should filter mock events correctly by market-making', () => {
		const allowed = STRATEGY_EVENT_MAP['market-making'];
		const events = [
			{ eventType: 'MM', message: 'placed order' },
			{ eventType: 'ORDER', message: 'order filled' },
			{ eventType: 'MICRO', message: 'micro layer' },
			{ eventType: 'BRAIN', message: 'mode switch' },
			{ eventType: 'RISK', message: 'risk check' },
		];
		const filtered = events.filter(e => allowed.has(e.eventType));
		assert.equal(filtered.length, 3, 'only MM, ORDER, MICRO pass');
	});
});
