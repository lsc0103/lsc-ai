import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  // Wait for form to be ready
  await page.waitForSelector('input[placeholder="用户名"]');

  // Fill form fields
  await page.fill('input[placeholder="用户名"]', 'admin');
  await page.fill('input[placeholder="密码"]', 'Admin@123');

  // Click login button and wait for navigation
  await Promise.all([
    page.waitForURL('**/chat**', { timeout: 30000 }),
    page.click('button:has-text("登")'),
  ]);

  // Wait a bit for auth state to settle
  await page.waitForTimeout(1000);

  // Save auth state
  await page.context().storageState({ path: './e2e/.auth/user.json' });
});
