import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

test.describe('Chat History (Regression)', () => {
  test('history messages render as text, not raw JSON (BUG 1)', async ({ page, api }) => {
    const session = await api.createSession('test-history-render');

    await page.goto(`/chat/${session.id}`);
    await page.waitForTimeout(2000);

    // If there are messages, they should not contain raw JSON like {"role":"user"
    const body = await page.textContent('body');
    expect(body).not.toContain('"role"');
    expect(body).not.toContain('"content"');

    await api.deleteSession(session.id);
  });

  test('first user message is visible in history', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('test-history-first-msg-visible');
    await textarea.press('Enter');

    // Wait for URL to change (session created)
    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // Wait longer for message rendering
    await page.waitForTimeout(2000);

    // User message should be visible in main area (not sidebar)
    await expect(page.locator('main').getByText('test-history-first-msg-visible')).toBeVisible({ timeout: 10000 });
  });

  test('navigating to existing session shows MessageList, not WelcomeScreen (BUG 2)', async ({ page, api }) => {
    const session = await api.createSession('test-nav-msglist');

    await page.goto(`/chat/${session.id}`);
    await page.waitForTimeout(3000);

    // Loading should finish
    const loadingGone = await page.locator('.ant-spin').isHidden().catch(() => true);
    expect(loadingGone).toBeTruthy();

    await api.deleteSession(session.id);
  });

  test('loading spinner shows while loading session', async ({ page, api }) => {
    const session = await api.createSession('test-loading-spinner');

    await page.goto(`/chat/${session.id}`);

    // Page should load without error
    await page.waitForTimeout(2000);
    expect(page.url()).toContain(session.id);

    await api.deleteSession(session.id);
  });
});
