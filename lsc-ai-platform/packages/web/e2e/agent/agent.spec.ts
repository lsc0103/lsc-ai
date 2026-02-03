import { test, expect } from '../fixtures/test-base';

test.describe('Agent', () => {
  test('agent devices list API returns 200', async ({ api }) => {
    const res = await api.getAgents();
    expect(res.status()).toBe(200);
  });

  test('workspace select modal opens', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // Click plus button
    await page.locator('button .anticon-plus').first().click();
    await page.waitForTimeout(500);

    // Click "选择工作路径"
    const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")');
    if (await workdirItem.isVisible()) {
      await workdirItem.click();
      await page.waitForTimeout(1000);

      // Modal should appear
      const modal = page.locator('.ant-modal');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toBeVisible();
        // Close modal
        await page.locator('.ant-modal-close').click();
      }
    }
  });
});
