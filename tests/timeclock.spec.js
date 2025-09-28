const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const screenshotDir = path.resolve(process.cwd(), 'playwright/screenshots');

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test('TimeClock page screenshot (auth required)', async ({ page }) => {
  await page.goto('/timeclock');
  await expect(page.getByRole('heading', { name: /time clock/i })).toBeVisible();
  await page.screenshot({ path: 'playwright/screenshots/timeclock.png', fullPage: true });
});
