const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const storagePath = path.resolve(__dirname, '../playwright/.auth/state.json');
  if (fs.existsSync(storagePath)) {
    return; // already logged in
  }

  const email = process.env.CI_LOGIN_EMAIL;
  const pass = process.env.CI_LOGIN_PASSWORD;

  if (!email || !pass) {
    console.warn('[global-setup] Missing CI_LOGIN_EMAIL/CI_LOGIN_PASSWORD, skipping login.');
    return;
  }

  const storageDir = path.dirname(storagePath);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    // Navigate directly to login route (adjust if your path differs)
    const base = process.env.PW_BASE_URL || 'http://localhost:5173';
    await page.goto(`${base}/login`, { waitUntil: 'networkidle' });

    // Fill login form (adjust selectors to your app if needed)
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(pass);
    await page.getByRole('button', { name: /(sign in|log in)/i }).click();

    // Wait for a post-login route or unique element
    await page.waitForURL(/\/(timeclock|rides|dashboard|home)/i, { timeout: 30000 });

    // Ensure storage directory exists and save authenticated storage
    await page.context().storageState({ path: storagePath });
  } catch (error) {
    console.error('[global-setup] Failed to save authenticated storage state.', error);
    throw error;
  } finally {
    await browser.close();
  }
};
