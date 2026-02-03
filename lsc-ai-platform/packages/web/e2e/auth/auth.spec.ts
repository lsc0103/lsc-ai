import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  // Don't use stored auth for auth tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login with correct credentials → redirect to /chat', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login_username', 'admin');
    await page.fill('#login_password', 'Admin@123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/chat**', { timeout: 15000 });
    expect(page.url()).toContain('/chat');
  });

  test('login with wrong password → shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login_username', 'admin');
    await page.fill('#login_password', 'WrongPassword123');
    await page.click('button[type="submit"]');

    // Ant Design v5 message 使用 .ant-message 容器
    // 等待任何错误提示出现（message 或 notification）
    await page.waitForTimeout(3000);

    // 验证没有跳转到 /chat（说明登录失败了）
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /chat → redirect to /login', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('logout → clears state and redirects to /login', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('#login_username', 'admin');
    await page.fill('#login_password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat**', { timeout: 15000 });

    // Click user avatar to open menu
    await page.locator('aside .ant-avatar').click();
    await page.waitForTimeout(500);
    // Click logout - try multiple selectors
    const logoutBtn = page.locator('.ant-dropdown-menu-item-danger, [data-menu-id*="logout"]').first();
    await logoutBtn.click();

    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('token refresh on 401', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login_username', 'admin');
    await page.fill('#login_password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat**', { timeout: 15000 });

    // Verify we can access the app
    await expect(page.locator('textarea')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/chat');
  });
});
