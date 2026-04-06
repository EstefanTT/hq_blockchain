// playwright.config.js — E2E test configuration
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: false, // sequential — we share one server
	retries: 0,
	reporter: [['html', { open: 'never' }], ['list']],
	outputDir: './test-results',

	use: {
		baseURL: 'http://localhost:3001',
		screenshot: 'on',           // always take screenshots
		trace: 'retain-on-failure',
		headless: true,
	},

	projects: [
		{ name: 'chromium', use: { channel: 'chromium' } },
	],

	webServer: {
		command: 'node index.js',
		port: 3001,
		timeout: 20_000,
		reuseExistingServer: true,
		env: { NODE_ENV: 'development' },
	},
});
