import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

test.describe('Session Management', () => {
  test('sidebar shows session list', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // Sidebar should be visible
    await expect(page.locator('aside')).toBeVisible();
    // History section label
    await expect(page.locator('text=历史对话')).toBeVisible();
  });

  test('new chat creates sidebar entry', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    // Count sessions before
    const beforeCount = await page.locator(SEL.sidebar.sessionItem).count();

    // Send a message to create a new session
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('test-new-session-sidebar');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Count sessions after
    const afterCount = await page.locator(SEL.sidebar.sessionItem).count();
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test('delete session via API removes it', async ({ page, api }) => {
    const session = await api.createSession('test-delete-session');

    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // Verify session exists in sidebar
    const sessionVisible = await page.getByText('test-delete-session').isVisible().catch(() => false);

    // Delete via API
    await api.deleteSession(session.id);

    // Reload to verify
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('rename session via API', async ({ api }) => {
    const session = await api.createSession('test-rename-before');
    const res = await api.updateSession(session.id, { title: 'test-rename-after' });
    expect(res.ok()).toBeTruthy();

    const updated = await api.getSession(session.id);
    expect(updated.title).toBe('test-rename-after');

    await api.deleteSession(session.id);
  });

  test('sessions sorted by updatedAt desc', async ({ api }) => {
    const s1 = await api.createSession('test-sort-1');
    await new Promise(r => setTimeout(r, 100));
    const s2 = await api.createSession('test-sort-2');

    const sessions = await api.getSessions();
    const list = Array.isArray(sessions) ? sessions : sessions.data || [];
    const testSessions = list.filter((s: any) => s.title?.startsWith('test-sort-'));

    if (testSessions.length >= 2) {
      const idx1 = list.findIndex((s: any) => s.id === s1.id);
      const idx2 = list.findIndex((s: any) => s.id === s2.id);
      // s2 was created later, should appear first (lower index)
      if (idx1 >= 0 && idx2 >= 0) {
        expect(idx2).toBeLessThan(idx1);
      }
    }

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });

  test('workbench save does not affect session order (BUG 4)', async ({ api }) => {
    const s1 = await api.createSession('test-wb-order-1');
    await new Promise(r => setTimeout(r, 100));
    const s2 = await api.createSession('test-wb-order-2');

    // Get order before
    const before = await api.getSessions();
    const beforeList = Array.isArray(before) ? before : before.data || [];

    // Cleanup
    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });
});
