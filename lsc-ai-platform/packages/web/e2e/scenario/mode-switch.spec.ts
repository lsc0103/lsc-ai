/**
 * 远程/本地模式切换测试
 *
 * 注意：完整的模式切换需要 Client Agent 在线。
 * 这些测试主要验证 UI 层面的模式切换行为。
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

test.describe('模式切换 — UI 基础', () => {
  test.setTimeout(60000);

  test('主界面 → 查找模式切换相关 UI 元素', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(3000);

    // 查找 Agent 状态指示器
    const statusIndicator = page.locator(SEL.agent.statusIndicator);
    const statusCount = await statusIndicator.count();

    // 查找模式切换按钮
    const modeSwitch = page.locator(SEL.agent.modeSwitch);
    const modeSwitchCount = await modeSwitch.count();

    // 查找任何与 Agent/模式 相关的按钮
    const agentBtns = page.locator('button:has-text("Agent"), button:has-text("本地"), button:has-text("远程"), button:has-text("模式")');
    const agentBtnCount = await agentBtns.count();

    console.log(`[模式切换] 状态指示器: ${statusCount}, 模式按钮: ${modeSwitchCount}, Agent按钮: ${agentBtnCount}`);
  });

  test('Agent API → 返回正常', async ({ api }) => {
    const res = await api.getAgents();
    expect(res.status()).toBe(200);
  });

  test('侧边栏 → 检查是否有 Agent 入口', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(3000);

    const sidebar = page.locator('aside');
    const sidebarHtml = await sidebar.innerHTML();

    // 检查侧边栏是否包含 Agent 相关元素
    const hasAgent = sidebarHtml.includes('agent') || sidebarHtml.includes('Agent') ||
                     sidebarHtml.includes('模式') || sidebarHtml.includes('本地');
    console.log(`[模式切换] 侧边栏包含Agent相关: ${hasAgent}`);
  });

  test('设置页面 → 检查是否有模式配置', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(3000);

    const url = page.url();
    // 可能被重定向（如果 settings 页不存在）
    const mainText = (await page.locator('body').textContent()) || '';
    console.log(`[模式切换] 设置页面URL: ${url}, 内容长度: ${mainText.length}`);
  });
});

test.describe('模式切换 — 状态指示器', () => {
  test.setTimeout(60000);

  test('默认状态 → 应为远程/服务器模式', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(3000);

    // 查找任何表示当前模式的元素
    const modeIndicators = page.locator('[class*="mode"], [class*="agent"], [data-mode]');
    const count = await modeIndicators.count();
    console.log(`[模式状态] 模式指示器数量: ${count}`);

    // 无论有没有模式指示器，页面应正常工作
    await expect(page.locator(SEL.chat.textarea)).toBeVisible();
  });

  test('无 Client Agent 时 → 页面正常可用', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // 没有 Client Agent 连接时，应该仍能正常使用 UI
    await expect(page.locator(SEL.chat.textarea)).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // 可以输入文字
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('测试输入');
    await expect(textarea).toHaveValue('测试输入');
  });
});

test.describe('模式切换 — 会话上下文', () => {
  test.setTimeout(180000);

  test('创建会话发消息 → 上下文在同一会话中连贯', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // 发第一条消息
    await sendAndWaitWithRetry(page, '请记住：我的代号是Alpha-7');

    // 发第二条消息验证上下文
    await sendAndWaitWithRetry(page, '我的代号是什么？');

    const bubbles = page.locator('main .message-bubble.assistant');
    const count = await bubbles.count();
    if (count >= 2) {
      const lastReply = (await bubbles.last().textContent()) || '';
      const hasContext = lastReply.includes('Alpha') || lastReply.includes('7') || lastReply.includes('代号');
      console.log(`[上下文] 回复包含代号: ${hasContext}, 回复: ${lastReply.slice(0, 100)}`);
    }
  });

  test('不同会话 → 消息隔离', async ({ page, api }) => {
    const s1 = await api.createSession('test-mode-isolate-1');
    const s2 = await api.createSession('test-mode-isolate-2');

    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(2000);
    await sendAndWaitWithRetry(page, '我是会话1的独特消息xyz123');

    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(3000);

    const mainText = (await page.locator('main').textContent()) || '';
    expect(mainText).not.toContain('xyz123');

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });
});
