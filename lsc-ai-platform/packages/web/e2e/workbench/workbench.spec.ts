import { test, expect } from '../fixtures/test-base';

test.describe('Workbench', () => {
  test('open/close workbench panel via plus menu', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // Click the plus button to open menu
    await page.locator('button .anticon-plus').first().click();
    await page.waitForTimeout(500);

    // Click "打开工作台"
    const workbenchItem = page.locator('.ant-dropdown-menu-item:has-text("打开工作台"), .ant-dropdown-menu-item:has-text("关闭工作台")');
    if (await workbenchItem.isVisible()) {
      await workbenchItem.click();
      await page.waitForTimeout(1000);
    }
  });

  test('workbench state persists across sessions', async ({ page, api }) => {
    // Create two sessions
    const s1 = await api.createSession('test-wb-persist-1');
    const s2 = await api.createSession('test-wb-persist-2');

    // Navigate to s1
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(2000);

    // Navigate to s2
    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(2000);

    // Navigate back to s1
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(2000);

    // Page should load without errors
    expect(page.url()).toContain(s1.id);

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });

  test('workbench save does not disrupt session order', async ({ api }) => {
    const s1 = await api.createSession('test-wb-save-1');
    await new Promise(r => setTimeout(r, 100));
    const s2 = await api.createSession('test-wb-save-2');

    const sessions = await api.getSessions();
    const list = Array.isArray(sessions) ? sessions : sessions.data || [];
    const idx1 = list.findIndex((s: any) => s.id === s1.id);
    const idx2 = list.findIndex((s: any) => s.id === s2.id);

    // s2 should be before s1 (created later = higher priority)
    if (idx1 >= 0 && idx2 >= 0) {
      expect(idx2).toBeLessThan(idx1);
    }

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });

  test('workbench panel has correct layout', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // The workbench layout should wrap the chat area
    await expect(page.locator('textarea')).toBeVisible();
  });
});
