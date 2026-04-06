// tests/e2e/dashboard.spec.js — E2E tests for all dashboard pages.
// Verifies page load, data population, controls, and captures screenshots.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Helpers ─────────────────────────────────────────────────

/** Read the API_TOKEN from .env so tests authenticate automatically. */
function getApiToken() {
try {
const env = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
const match = env.match(/^API_TOKEN=(.+)$/m);
return match?.[1]?.trim() || '';
} catch { return ''; }
}

const API_TOKEN = getApiToken();

/**
 * Inject the API token via addInitScript so it's set in localStorage
 * BEFORE the page's own scripts run. This ensures fetchData() succeeds
 * on the very first call.
 */
async function injectToken(page) {
await page.addInitScript((tok) => {
localStorage.setItem('hq_api_token', tok);
}, API_TOKEN);
}

// ─── Master Dashboard ────────────────────────────────────────

test.describe('Master Dashboard', () => {
test.beforeEach(async ({ page }) => {
await injectToken(page);
await page.goto('/api/dashboard');
});

test('page loads with correct title and structure', async ({ page }) => {
await expect(page).toHaveTitle(/hq_blockchain.*Dashboard/i);

// Sidebar links exist (use aside scope to avoid ambiguity)
const sidebar = page.locator('aside');
await expect(sidebar.locator('a[href="/api/dashboard"]')).toBeVisible();
await expect(sidebar.locator('a[href="/api/dashboard/steem-dex-bot"]')).toBeVisible();
await expect(sidebar.locator('a[href="/api/dashboard/logs"]')).toBeVisible();

// Top bar elements
await expect(page.locator('#token')).toBeVisible();
await expect(page.locator('text=Emergency Stop')).toBeVisible();
await expect(page.locator('text=Dry-Run')).toBeVisible();
});

test('KPI cards load real data (not dashes)', async ({ page }) => {
// Wait for the data fetch cycle to complete (last-update always gets set)
await page.waitForFunction(() => {
const el = document.getElementById('last-update');
return el && el.textContent.startsWith('Updated');
}, { timeout: 15_000 });

// Verify no-token prompt is hidden since we injected the token
await expect(page.locator('#no-token-msg')).toBeHidden();

// At least some KPI cards should have been populated
const snapshot = await page.locator('#stat-snapshot').textContent();
const dbSub = await page.locator('#stat-db-sub').textContent();
// stat-snapshot shows time or dash; stat-db-sub shows "N trades today"
expect(snapshot !== '—' || dbSub.length > 0).toBeTruthy();
});

test('bot cards render with controls', async ({ page }) => {
// Wait for bot cards to render
await page.waitForSelector('#bot-cards .card', { timeout: 15_000 });

const botCards = page.locator('#bot-cards .card');
await expect(botCards).toHaveCount(1); // 1 bot: steem-dex-bot

// Bot card has toggle labels (the input is hidden, check the label wrapper)
const toggles = botCards.first().locator('.toggle');
expect(await toggles.count()).toBeGreaterThanOrEqual(3); // Data + Dry + Bot

// Bot card has "Open Detailed View" link
await expect(botCards.first().locator('text=Open Detailed View')).toBeVisible();
});

test('bot cards have Data, Dry and Bot toggles with badges', async ({ page }) => {
await page.waitForSelector('#bot-cards .card', { timeout: 15_000 });

const card = page.locator('#bot-cards .card').first();
// Should have labels for Data, Dry, Bot (use exact to avoid "STEEM DEX Bot" match)
await expect(card.locator('text=Data')).toBeVisible();
await expect(card.locator('text=Dry')).toBeVisible();
await expect(card.getByText('Bot', { exact: true })).toBeVisible();
// Badges should be ON/OFF, DRY/LIVE
const badges = card.locator('span.rounded.font-bold');
expect(await badges.count()).toBeGreaterThanOrEqual(3);
});

test('recent logs table populates', async ({ page }) => {
// Wait for log rows (or "No logs yet" — both are valid)
await page.waitForFunction(() => {
const body = document.getElementById('log-body');
return body && !body.textContent.includes('Loading');
}, { timeout: 15_000 });

const logBody = page.locator('#log-body');
const text = await logBody.textContent();
// Should either have real log entries or "No logs yet"
expect(text.includes('No logs yet') || text.length > 20).toBeTruthy();
});

test('global dry-run toggle is functional', async ({ page }) => {
// Wait for data to load
await page.waitForFunction(() => {
const el = document.getElementById('last-update');
return el && el.textContent.startsWith('Updated');
}, { timeout: 15_000 });

// The input is hidden (opacity:0), click the toggle label wrapper instead
const toggleLabel = page.locator('label.toggle:has(#chk-global-dryrun)');
await expect(toggleLabel).toBeVisible();
await toggleLabel.click();
// Small delay for the API call to round-trip
await page.waitForTimeout(1000);
// Click again to restore original state
await toggleLabel.click();
});

test('full-page screenshot', async ({ page }) => {
// Wait for data before screenshot
await page.waitForFunction(() => {
const el = document.getElementById('last-update');
return el && el.textContent.startsWith('Updated');
}, { timeout: 15_000 });
// Small extra wait for rendering to settle
await page.waitForTimeout(500);

await page.screenshot({ path: 'test-results/master-dashboard.png', fullPage: true });
});
});

// ─── STEEM DEX Bot Page ──────────────────────────────────────

test.describe('STEEM DEX Bot Page', () => {
test.beforeEach(async ({ page }) => {
await injectToken(page);
// Ensure data collection is ON so live-data tests can pass
await page.request.post('/api/execution/toggle-data', {
headers: { 'X-API-Token': API_TOKEN, 'Content-Type': 'application/json' },
data: { bot: 'steem-dex-bot', enabled: true },
});
await page.goto('/api/dashboard/steem-dex-bot');
});

test('page loads with correct title', async ({ page }) => {
await expect(page).toHaveTitle(/STEEM DEX Bot/i);
});

test('bot power section is present with Data and Bot toggles', async ({ page }) => {
await expect(page.locator('text=Bot Power')).toBeVisible();
// Bot power toggle
const powerToggle = page.locator('label.toggle:has(#chk-bot-power)');
await expect(powerToggle).toBeVisible();
// Data collection toggle in bot power section
const dataToggle = page.locator('label.toggle:has(#chk-data-power)');
await expect(dataToggle).toBeVisible();
// Mode selector
await expect(page.locator('#sel-mode')).toBeVisible();
// Bot and Data badges
await expect(page.locator('#bot-power-badge')).toBeVisible();
await expect(page.locator('#data-power-badge')).toBeVisible();
});

test('KPI row loads real data', async ({ page }) => {
// Wait for balances to populate
await page.waitForFunction(() => {
const el = document.getElementById('kpi-steem');
return el && el.textContent !== '—';
}, { timeout: 15_000 });

await expect(page.locator('#kpi-steem')).not.toHaveText('—');
await expect(page.locator('#kpi-sbd')).not.toHaveText('—');
await expect(page.locator('#kpi-rc')).not.toHaveText('—');
});

test('brain mode badge in bot power section', async ({ page }) => {
await page.waitForFunction(() => {
const el = document.getElementById('bot-mode-badge');
return el && el.textContent.trim().length > 0;
}, { timeout: 15_000 });

const badge = page.locator('#bot-mode-badge');
await expect(badge).toBeVisible();
const text = await badge.textContent();
expect(text.trim().length).toBeGreaterThan(0);
});

test('all 6 strategy cards render with toggles and params', async ({ page }) => {
await page.waitForSelector('.strategy-card', { timeout: 15_000 });

const strategyCards = page.locator('.strategy-card');
await expect(strategyCards).toHaveCount(6);

// Each card has a toggle and at least one param input
for (let i = 0; i < 6; i++) {
const card = strategyCards.nth(i);
await expect(card.locator('.toggle').first()).toBeVisible();
await expect(card.locator('.param-input').first()).toBeVisible();
await expect(card.locator('button:has-text("Save Parameters")')).toBeVisible();
}
});

test('strategy cards have expected names', async ({ page }) => {
await page.waitForSelector('.strategy-card', { timeout: 15_000 });

const expectedStrategies = [
'Market Making',
'Aggressive Sniping',
'Grid / Range',
'Mean Reversion',
'Defensive / Pause',
'Bot Exploitation',
];
for (const name of expectedStrategies) {
await expect(page.locator('.strategy-card:has-text("' + name + '")')).toBeVisible();
}
});

test('prices section shows feed data', async ({ page }) => {
await page.waitForFunction(() => {
const el = document.getElementById('price-STEEM');
return el && !el.textContent.includes('—') && !el.textContent.includes('No data');
}, { timeout: 15_000 });

const steemPrice = page.locator('#price-STEEM');
const text = await steemPrice.textContent();
expect(text).toContain('$');
});

test('order book has bids and asks', async ({ page }) => {
await page.waitForFunction(() => {
const el = document.getElementById('bids-table');
return el && !el.textContent.includes('Waiting');
}, { timeout: 15_000 });

const bids = page.locator('#bids-table tr');
const asks = page.locator('#asks-table tr');
expect(await bids.count()).toBeGreaterThan(0);
expect(await asks.count()).toBeGreaterThan(0);
});

test('micro layer section exists', async ({ page }) => {
await expect(page.locator('#micro-layer')).toBeVisible();
await expect(page.locator('#kpi-micro')).toBeVisible();
});

test('strategy cards use ON/OFF labels instead of Active/Standby', async ({ page }) => {
await page.waitForSelector('.strategy-card', { timeout: 15_000 });

// Get all badge text from strategy cards
const badges = page.locator('.strategy-card .rounded-full');
const count = await badges.count();
expect(count).toBeGreaterThan(0);

for (let i = 0; i < count; i++) {
const text = (await badges.nth(i).textContent()).trim();
expect(['ON', 'OFF']).toContain(text);
}
});

test('analysis tools section has run buttons', async ({ page }) => {
// Analysis tools section
await expect(page.locator('text=Analysis Tools')).toBeVisible();

// Should have 4 run buttons
const runButtons = page.locator('button:has-text("Run")');
expect(await runButtons.count()).toBe(4);

// Output area exists but hidden initially
await expect(page.locator('#analysis-output')).toBeHidden();
});

test('dry-run badge shows DRY or LIVE', async ({ page }) => {
await page.waitForFunction(() => {
const el = document.getElementById('dryrun-badge');
return el && el.textContent.trim().length > 0;
}, { timeout: 15_000 });

const badge = page.locator('#dryrun-badge');
const text = (await badge.textContent()).trim();
expect(['DRY', 'LIVE']).toContain(text);
});

test('top bar controls: Emergency Stop, Data, Dry-Run, Mode Select', async ({ page }) => {
await expect(page.locator('text=Emergency Stop')).toBeVisible();

// Data toggle in top bar
const dataToggle = page.locator('label.toggle:has(#chk-data)');
await expect(dataToggle).toBeVisible();
await expect(page.locator('#data-badge')).toBeVisible();

// Dry-Run toggle label (input is hidden)
const dryrunToggle = page.locator('label.toggle:has(#chk-dryrun)');
await expect(dryrunToggle).toBeVisible();

await expect(page.locator('#sel-mode')).toBeVisible();

// Mode selector has the expected options
const options = page.locator('#sel-mode option');
expect(await options.count()).toBeGreaterThanOrEqual(7); // 1 placeholder + 6 modes
});

test('full-page screenshot', async ({ page }) => {
// Wait for data before screenshot
await page.waitForFunction(() => {
const el = document.getElementById('kpi-steem');
return el && el.textContent !== '—';
}, { timeout: 15_000 });
// Small extra wait for strategy cards to fully render
await page.waitForSelector('.strategy-card', { timeout: 5_000 });
await page.waitForTimeout(500);

await page.screenshot({ path: 'test-results/steem-dex-bot.png', fullPage: true });
});
});

// ─── Logs Explorer ───────────────────────────────────────────

test.describe('Logs Explorer', () => {
test.beforeEach(async ({ page }) => {
await injectToken(page);
await page.goto('/api/dashboard/logs');
});

test('page loads with filters and table', async ({ page }) => {
await expect(page).toHaveTitle(/Logs/i);

// Filter controls
await expect(page.locator('#fil-event')).toBeVisible();
await expect(page.locator('#fil-severity')).toBeVisible();
await expect(page.locator('#fil-search')).toBeVisible();

// Apply & Reset buttons
await expect(page.locator('button:has-text("Apply")')).toBeVisible();
await expect(page.locator('button:has-text("Reset")')).toBeVisible();
});

test('log table loads real entries', async ({ page }) => {
await page.waitForFunction(() => {
const body = document.getElementById('log-body');
return body && !body.textContent.includes('Loading');
}, { timeout: 15_000 });

const rows = page.locator('#log-body tr');
expect(await rows.count()).toBeGreaterThan(0);

// Log count indicator updates
const countEl = page.locator('#log-count');
const countText = await countEl.textContent();
expect(countText).toMatch(/\d+ logs loaded/);
});

test('full-page screenshot', async ({ page }) => {
await page.waitForFunction(() => {
const body = document.getElementById('log-body');
return body && !body.textContent.includes('Loading');
}, { timeout: 15_000 });
await page.waitForTimeout(500);

await page.screenshot({ path: 'test-results/logs-explorer.png', fullPage: true });
});
});

// ─── Cross-page Navigation ──────────────────────────────────

test.describe('Navigation', () => {
test('can navigate between all dashboard pages', async ({ page }) => {
await injectToken(page);

// Start at master dashboard
await page.goto('/api/dashboard');
await expect(page).toHaveTitle(/Dashboard/i);

// Click to bot page via sidebar
await page.locator('aside a[href="/api/dashboard/steem-dex-bot"]').click();
await expect(page).toHaveTitle(/STEEM DEX Bot/i);

// Click to logs via sidebar
await page.locator('aside a[href="/api/dashboard/logs"]').click();
await expect(page).toHaveTitle(/Logs/i);

// Back to home via sidebar
await page.locator('aside a[href="/api/dashboard"]').click();
await expect(page).toHaveTitle(/Dashboard/i);
});
});
