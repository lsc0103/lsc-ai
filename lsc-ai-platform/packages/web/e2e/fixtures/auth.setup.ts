import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#login_username', 'admin');
  await page.fill('#login_password', 'Admin@123');
  await page.click('button[type="submit"]');

  // Wait for redirect to /chat
  await page.waitForURL('**/chat**', { timeout: 15000 });

  // Save auth state
  await page.context().storageState({ path: './e2e/.auth/user.json' });
});
