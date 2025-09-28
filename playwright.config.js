const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000,
  fullyParallel: true,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    storageState: 'playwright/.auth/state.json',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  globalSetup: require.resolve('./tests/global-setup.js'),
});
