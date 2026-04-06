// testing/services/cache.test.js
// Tests for the per-bot cache namespacing (WP-4).
// Run: node --test testing/services/cache.test.js

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
	runtimeCache,
	initBotCache,
	getBotData,
	getSteemDexBotData,
	updateStorageStats,
	updateAccountData,
	updateMicroLayerStatus,
	updateStrategyStatus,
	updateBrainStatus,
	updateRiskStatus,
	updateExploitationStatus,
	setDryRunFlag,
	updateBotControlState,
	getBotControlState,
	updateAppSizeInfo,
	updatePriceFeed,
} from '../../services/cache/index.js';

// ─── Helpers ─────────────────────────────────────────────────

function resetCache() {
	// Clear per-bot namespaces
	for (const key of Object.keys(runtimeCache.bots)) {
		delete runtimeCache.bots[key];
	}
	// Clear botControl
	for (const key of Object.keys(runtimeCache.botControl)) {
		delete runtimeCache.botControl[key];
	}
}

// ─── Tests ───────────────────────────────────────────────────

describe('cache namespacing (WP-4)', () => {

	beforeEach(() => {
		resetCache();
	});

	// ── initBotCache ──────────────────────────────────────────

	it('initBotCache creates namespace with all default keys', () => {
		initBotCache('test-bot');
		const state = runtimeCache.bots['test-bot'];
		assert.ok(state, 'bot namespace should exist');
		assert.ok('storageStats' in state);
		assert.ok('accountData' in state);
		assert.ok('microLayerStatus' in state);
		assert.ok('strategyStatus' in state);
		assert.ok('brainStatus' in state);
		assert.ok('riskStatus' in state);
		assert.ok('exploitationStatus' in state);
		assert.ok('dryRunEnabled' in state);
		assert.equal(state.dryRunEnabled, false);
		assert.equal(state.storageStats.tradesToday, 0);
	});

	it('initBotCache is idempotent — does not reset existing data', () => {
		initBotCache('test-bot');
		updateStorageStats('test-bot', { tradesToday: 42 });
		initBotCache('test-bot');
		assert.equal(runtimeCache.bots['test-bot'].storageStats.tradesToday, 42);
	});

	// ── getBotCache throws for uninitialized ──────────────────

	it('per-bot updater throws for uninitialized bot', () => {
		assert.throws(
			() => updateStorageStats('ghost-bot', { tradesToday: 1 }),
			/Cache not initialized for bot: ghost-bot/
		);
	});

	// ── Per-bot updaters ──────────────────────────────────────

	it('updateStorageStats stores under bot namespace', () => {
		initBotCache('bot-a');
		updateStorageStats('bot-a', { tradesToday: 7 });
		assert.equal(runtimeCache.bots['bot-a'].storageStats.tradesToday, 7);
	});

	it('updateAccountData stores under bot namespace', () => {
		initBotCache('bot-a');
		updateAccountData('bot-a', { balance: '100 STEEM' });
		assert.equal(runtimeCache.bots['bot-a'].accountData.balance, '100 STEEM');
	});

	it('updateBrainStatus stores under bot namespace', () => {
		initBotCache('bot-a');
		updateBrainStatus('bot-a', { currentMode: 'aggressive' });
		assert.equal(runtimeCache.bots['bot-a'].brainStatus.currentMode, 'aggressive');
	});

	it('updateRiskStatus stores under bot namespace', () => {
		initBotCache('bot-a');
		updateRiskStatus('bot-a', { slippageRejectCount: 3 });
		assert.equal(runtimeCache.bots['bot-a'].riskStatus.slippageRejectCount, 3);
	});

	it('setDryRunFlag stores under bot namespace', () => {
		initBotCache('bot-a');
		setDryRunFlag('bot-a', true);
		assert.equal(runtimeCache.bots['bot-a'].dryRunEnabled, true);
	});

	// ── Two bots don't collide ────────────────────────────────

	it('two bots have isolated state', () => {
		initBotCache('bot-a');
		initBotCache('bot-b');

		updateStorageStats('bot-a', { tradesToday: 10 });
		updateStorageStats('bot-b', { tradesToday: 99 });

		updateBrainStatus('bot-a', { currentMode: 'defensive' });
		updateBrainStatus('bot-b', { currentMode: 'aggressive' });

		updateAccountData('bot-a', { balance: '500 STEEM' });
		updateAccountData('bot-b', { balance: '200 HIVE' });

		assert.equal(runtimeCache.bots['bot-a'].storageStats.tradesToday, 10);
		assert.equal(runtimeCache.bots['bot-b'].storageStats.tradesToday, 99);
		assert.equal(runtimeCache.bots['bot-a'].brainStatus.currentMode, 'defensive');
		assert.equal(runtimeCache.bots['bot-b'].brainStatus.currentMode, 'aggressive');
		assert.equal(runtimeCache.bots['bot-a'].accountData.balance, '500 STEEM');
		assert.equal(runtimeCache.bots['bot-b'].accountData.balance, '200 HIVE');
	});

	// ── getBotData ────────────────────────────────────────────

	it('getBotData returns null for unknown bot', () => {
		assert.equal(getBotData('no-such-bot'), null);
	});

	it('getBotData returns merged global + per-bot state', () => {
		initBotCache('bot-a');
		updateStorageStats('bot-a', { tradesToday: 5 });
		updatePriceFeed('STEEM', 'cg', 0.25);

		const data = getBotData('bot-a');
		assert.equal(data.storageStats.tradesToday, 5);
		assert.ok(data.priceFeeds.STEEM?.cg, 'should include global priceFeeds');
		assert.ok(data.priceEngine, 'should include global priceEngine');
		assert.ok('orderBooks' in data, 'should include global orderBooks');
	});

	// ── getSteemDexBotData backward compat ────────────────────

	it('getSteemDexBotData returns same as getBotData("steem-dex-bot")', () => {
		initBotCache('steem-dex-bot');
		updateStorageStats('steem-dex-bot', { tradesToday: 3 });

		const a = getSteemDexBotData();
		const b = getBotData('steem-dex-bot');
		assert.deepEqual(a, b);
	});

	// ── Global state is shared ────────────────────────────────

	it('updateAppSizeInfo updates global state (not per-bot)', () => {
		updateAppSizeInfo({ appSizeMB: 42, logsSizeMB: 5 });
		assert.equal(runtimeCache.appSizeInfo.appSizeMB, 42);
	});

	it('global state is visible from all bots via getBotData', () => {
		initBotCache('bot-a');
		initBotCache('bot-b');
		updatePriceFeed('STEEM', 'cg', 0.30);

		const a = getBotData('bot-a');
		const b = getBotData('bot-b');
		assert.equal(a.priceFeeds.STEEM.cg.usd, 0.30);
		assert.equal(b.priceFeeds.STEEM.cg.usd, 0.30);
	});

	// ── botControl ────────────────────────────────────────────

	it('updateBotControlState and getBotControlState work per-bot', () => {
		updateBotControlState('bot-a', { enabled: true, dryRun: false });
		updateBotControlState('bot-b', { enabled: false, dryRun: true });

		assert.deepEqual(getBotControlState('bot-a'), { enabled: true, dryRun: false });
		assert.deepEqual(getBotControlState('bot-b'), { enabled: false, dryRun: true });
	});

	it('getBotControlState returns null for unknown bot', () => {
		assert.equal(getBotControlState('nope'), null);
	});
});
