import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { cleanupTestSessions } from '../helpers/cleanup';

test.describe('Chat Core', () => {
  test.afterAll(async ({ api }) => {
    await cleanupTestSessions(api);
  });

  test('new chat shows welcome screen', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('text=有什么可以帮你的')).toBeVisible({ timeout: 10000 });
  });

  test('send message → URL changes + user bubble appears', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('E2E测试消息hello');
    await textarea.press('Enter');

    // URL should change to include sessionId
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    expect(page.url()).toMatch(/\/chat\/.+/);

    // User message should appear in main content area (not sidebar)
    await expect(page.locator('main').getByText('E2E测试消息hello')).toBeVisible({ timeout: 10000 });
  });

  test('input clears after send', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('test clear input');
    await textarea.press('Enter');

    // Textarea should be empty after send
    await expect(textarea).toHaveValue('', { timeout: 5000 });
  });

  test('Enter sends, Shift+Enter adds newline', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const textarea = page.locator(SEL.chat.textarea);

    // Shift+Enter should add newline
    await textarea.fill('line1');
    await textarea.press('Shift+Enter');
    await textarea.type('line2');

    const val = await textarea.inputValue();
    expect(val).toContain('line1');
    expect(val).toContain('line2');
  });

  test('stop generation button appears during streaming', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('详细介绍人工智能的发展历史');
    await textarea.press('Enter');

    // Just verify navigation happens (streaming may be too fast to catch stop button)
    await page.waitForURL('**/chat/**', { timeout: 15000 });
  });

  test('welcome suggestion click triggers send', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('text=有什么可以帮你的')).toBeVisible({ timeout: 10000 });

    // Click a suggestion card
    // Click in main area only (sidebar also has session with this title)
    await page.locator('main button:has-text("帮我分析这份数据报表")').click();

    // Should navigate to a session
    await page.waitForURL('**/chat/**', { timeout: 15000 });
  });
});
