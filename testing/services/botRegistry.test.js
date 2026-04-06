// testing/services/botRegistry.test.js
// Tests for the bot registry service.
// Run: node --test testing/services/botRegistry.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { registerBot, getBot, getBotModule, listBots, hasBot, _reset } from '../../services/botRegistry/index.js';

// ─── Helpers ─────────────────────────────────────────────────

function makeMeta(overrides = {}) {
	return {
		name: 'test-bot',
		displayName: 'Test Bot',
		chain: 'ethereum',
		pairs: ['ETH/USDC'],
		description: 'A test bot',
		...overrides,
	};
}

function makeModule(overrides = {}) {
	return {
		init: async () => { },
		startDataCollection: async () => { },
		stopDataCollection: async () => { },
		startBot: async () => { },
		stopBot: async () => { },
		shutdown: async () => { },
		getStatus: () => ({ dataCollection: false, trading: false, error: null }),
		...overrides,
	};
}

// ─── Tests ───────────────────────────────────────────────────

describe('botRegistry', () => {

	beforeEach(() => {
		_reset();
	});

	describe('registerBot', () => {

		it('stores bot correctly', () => {
			const meta = makeMeta();
			const mod = makeModule();
			registerBot('test-bot', mod, meta);

			const bot = getBot('test-bot');
			assert.deepEqual(bot.meta, meta);
			assert.equal(bot.module, mod);
		});

		it('rejects duplicate name', () => {
			registerBot('test-bot', makeModule(), makeMeta());
			assert.throws(
				() => registerBot('test-bot', makeModule(), makeMeta()),
				{ message: /already registered/ },
			);
		});

		it('validates required meta fields', () => {
			assert.throws(
				() => registerBot('x', makeModule(), makeMeta({ name: '' })),
				{ message: /meta missing required field: name/ },
			);
			assert.throws(
				() => registerBot('x', makeModule(), makeMeta({ displayName: '' })),
				{ message: /meta missing required field: displayName/ },
			);
			assert.throws(
				() => registerBot('x', makeModule(), makeMeta({ chain: '' })),
				{ message: /meta missing required field: chain/ },
			);
			assert.throws(
				() => registerBot('x', makeModule(), makeMeta({ description: '' })),
				{ message: /meta missing required field: description/ },
			);
		});

		it('validates meta.pairs is an array', () => {
			assert.throws(
				() => registerBot('x', makeModule(), makeMeta({ pairs: 'ETH/USDC' })),
				{ message: /pairs must be an array/ },
			);
		});

		it('validates required lifecycle methods', () => {
			assert.throws(
				() => registerBot('x', { ...makeModule(), init: undefined }, makeMeta()),
				{ message: /missing required export: init/ },
			);
			assert.throws(
				() => registerBot('x', { ...makeModule(), getStatus: 'not-a-fn' }, makeMeta()),
				{ message: /missing required export: getStatus/ },
			);
			assert.throws(
				() => registerBot('x', { ...makeModule(), startBot: null }, makeMeta()),
				{ message: /missing required export: startBot/ },
			);
		});
	});

	describe('getBot', () => {

		it('returns registered bot', () => {
			registerBot('test-bot', makeModule(), makeMeta());
			const bot = getBot('test-bot');
			assert.equal(bot.meta.name, 'test-bot');
		});

		it('throws for unknown name', () => {
			assert.throws(
				() => getBot('nonexistent'),
				{ message: /Bot not found: nonexistent/ },
			);
		});
	});

	describe('getBotModule', () => {

		it('returns just the module', () => {
			const mod = makeModule();
			registerBot('test-bot', mod, makeMeta());
			assert.equal(getBotModule('test-bot'), mod);
		});
	});

	describe('listBots', () => {

		it('returns empty array when no bots registered', () => {
			assert.deepEqual(listBots(), []);
		});

		it('returns all registered bot metadata', () => {
			registerBot('bot-a', makeModule(), makeMeta({ name: 'bot-a', displayName: 'Bot A' }));
			registerBot('bot-b', makeModule(), makeMeta({ name: 'bot-b', displayName: 'Bot B' }));

			const list = listBots();
			assert.equal(list.length, 2);
			assert.equal(list[0].name, 'bot-a');
			assert.equal(list[1].name, 'bot-b');
		});

		it('returns copies (not references to internal state)', () => {
			registerBot('test-bot', makeModule(), makeMeta());
			const list = listBots();
			list[0].name = 'mutated';
			assert.equal(listBots()[0].name, 'test-bot');
		});
	});

	describe('hasBot', () => {

		it('returns true for registered bot', () => {
			registerBot('test-bot', makeModule(), makeMeta());
			assert.equal(hasBot('test-bot'), true);
		});

		it('returns false for unknown bot', () => {
			assert.equal(hasBot('nonexistent'), false);
		});
	});
});
