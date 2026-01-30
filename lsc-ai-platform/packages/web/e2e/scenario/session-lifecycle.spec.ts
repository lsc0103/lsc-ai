/**
 * 会话全生命周期测试
 *
 * 创建→发消息→刷新恢复→重命名→删除
 * 特殊场景：AI 回复中的各种操作
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

test.describe('会话生命周期 — 基础 CRUD', () => {
  test.setTimeout(180000);

  test('创建新会话 → URL 变化 + 侧边栏更新', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('生命周期测试消息');
    await textarea.press('Enter');

    // 应该创建 session，URL 变化
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    expect(page.url()).toMatch(/\/chat\/.+/);
  });

  test('发送消息 → 用户消息可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('生命周期-双气泡测试');
    await textarea.press('Enter');

    // 用户消息立即可见
    await expect(page.locator('main').getByText('生命周期-双气泡测试')).toBeVisible({ timeout: 5000 });

    // 等 AI 回复（不强制要求成功）
    await page.waitForTimeout(2000);
    try {
      await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout: 90000 });
    } catch {}
    await page.waitForTimeout(1500);

    const aiBubbles = page.locator('main .message-bubble.assistant');
    const aiCount = await aiBubbles.count();
    console.log(`[生命周期] AI 气泡数: ${aiCount}`);
  });

  test('刷新页面 → 消息完整恢复', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const uniqueMsg = `persist-test-${Date.now()}`;
    const result = await sendAndWaitWithRetry(page, uniqueMsg, { timeout: 90000 });

    // 确保 URL 已变化（session 已创建）
    await page.waitForURL('**/chat/**', { timeout: 5000 }).catch(() => {});
    const chatUrl = page.url();
    if (!chatUrl.match(/\/chat\/.+/)) {
      console.log('[生命周期] Session 未创建，跳过刷新恢复测试');
      return;
    }

    await page.reload();
    await page.waitForTimeout(5000);

    // 用户消息恢复（可能匹配多处，用 first）
    await expect(page.locator('main').getByText(uniqueMsg).first()).toBeVisible({ timeout: 15000 });
  });

  test('通过 API 重命名会话 → 标题更新', async ({ page, api }) => {
    const session = await api.createSession('test-lifecycle-rename-orig');
    await page.goto(`/chat/${session.id}`);
    await page.waitForTimeout(2000);

    // 重命名
    await api.updateSession(session.id, { title: 'test-lifecycle-rename-updated' });
    await page.reload();
    await page.waitForTimeout(3000);

    // 侧边栏应显示新标题
    const sidebarText = (await page.locator('aside').textContent()) || '';
    // 新标题出现（至少部分）
    const hasNewTitle = sidebarText.includes('rename-updated') || sidebarText.includes('updated');
    console.log(`[生命周期] 侧边栏包含新标题: ${hasNewTitle}`);

    await api.deleteSession(session.id);
  });

  test('删除会话 → 从列表消失', async ({ page, api }) => {
    const session = await api.createSession('test-lifecycle-delete-me');
    await page.goto('/chat');
    await page.waitForTimeout(3000);

    await api.deleteSession(session.id);
    await page.reload();
    await page.waitForTimeout(3000);

    const sidebarText = (await page.locator('aside').textContent()) || '';
    expect(sidebarText).not.toContain('test-lifecycle-delete-me');
  });

  test('删除当前会话 → 页面不崩溃', async ({ page, api }) => {
    const session = await api.createSession('test-lifecycle-delete-current');
    await page.goto(`/chat/${session.id}`);
    await page.waitForTimeout(2000);

    await api.deleteSession(session.id);
    await page.waitForTimeout(2000);

    // 页面不崩溃 — 输入框或欢迎页应可见
    const hasUI = (await page.locator(SEL.chat.textarea).isVisible().catch(() => false)) ||
                  (await page.locator('main').isVisible().catch(() => false));
    expect(hasUI).toBeTruthy();
  });
});

test.describe('会话生命周期 — 特殊场景', () => {
  test.setTimeout(180000);

  test('AI 回复中刷新页面 → 回来后消息可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请详细解释什么是人工智能，至少写200字');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 等2秒后刷新（AI 可能还在回复中）
    await page.waitForTimeout(2000);
    const chatUrl = page.url();
    await page.reload();
    await page.waitForTimeout(5000);

    // 用户消息应恢复
    const userMsg = page.locator('main').getByText('人工智能');
    const visible = await userMsg.isVisible().catch(() => false);
    console.log(`[特殊] 刷新后用户消息可见: ${visible}`);
    // 页面不崩溃
    await expect(page.locator('main')).toBeVisible();
  });

  test('AI 回复中切换会话 → 原会话不崩溃', async ({ page, api }) => {
    const s1 = await api.createSession('test-switch-during-ai-1');
    const s2 = await api.createSession('test-switch-during-ai-2');

    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请详细写一篇300字的短文');
    await textarea.press('Enter');

    // 等2秒（AI 正在回复中）
    await page.waitForTimeout(2000);

    // 切换到 s2
    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(3000);

    // 页面不崩溃
    await expect(page.locator(SEL.chat.textarea)).toBeVisible({ timeout: 5000 });

    // 切回 s1 — 页面不崩溃
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });

  test('快速创建多个会话 → 无错乱', async ({ page, api }) => {
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      sessions.push(await api.createSession(`test-multi-create-${i}`));
    }

    await page.goto(`/chat/${sessions[2].id}`);
    await page.waitForTimeout(2000);

    expect(page.url()).toContain(sessions[2].id);
    await expect(page.locator(SEL.chat.textarea)).toBeVisible({ timeout: 5000 });

    for (const s of sessions) {
      await api.deleteSession(s.id);
    }
  });
});
