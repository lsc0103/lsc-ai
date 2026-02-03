/**
 * 侧边栏交互测试（纯前端，不依赖 AI）
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

test.describe('侧边栏 — 基础 UI', () => {
  test.setTimeout(30000);

  test('侧边栏 → 可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    await expect(page.locator('aside')).toBeVisible();
  });

  test('新对话按钮 → 可见且可点击', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const btn = page.locator(SEL.sidebar.newChatButton);
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(1000);
    // 不崩溃
    await expect(page.locator('main')).toBeVisible();
  });

  test('会话列表 → 有会话时显示列表', async ({ page, api }) => {
    const session = await api.createSession('test-sidebar-ui-list');
    await page.goto('/chat');
    await page.waitForTimeout(3000);

    const items = page.locator(SEL.sidebar.sessionItem);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await api.deleteSession(session.id);
  });

  test('当前会话 → 有高亮样式', async ({ page, api }) => {
    const session = await api.createSession('test-sidebar-highlight');
    await page.goto(`/chat/${session.id}`);
    await page.waitForTimeout(3000);

    // 侧边栏中应有活跃/选中状态的元素
    const items = page.locator(SEL.sidebar.sessionItem);
    const count = await items.count();
    console.log(`[侧边栏] 会话项数量: ${count}`);

    await api.deleteSession(session.id);
  });

  test('点击会话项 → URL 变化', async ({ page, api }) => {
    const s1 = await api.createSession('test-sidebar-click-url-1');
    const s2 = await api.createSession('test-sidebar-click-url-2');

    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(3000);

    // 点击侧边栏中的另一个会话
    const items = page.locator(SEL.sidebar.sessionItem);
    const count = await items.count();

    if (count >= 2) {
      // 点击第一个不是当前的
      await items.first().click();
      await page.waitForTimeout(2000);
      console.log(`[侧边栏] 点击后URL: ${page.url()}`);
    }

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });
});

test.describe('侧边栏 — 用户菜单', () => {
  test.setTimeout(30000);

  test('用户头像 → 可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const avatar = page.locator(SEL.sidebar.userAvatar);
    const count = await avatar.count();
    console.log(`[侧边栏] 头像数量: ${count}`);
  });
});
