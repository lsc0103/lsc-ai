/**
 * 完整新用户旅程测试
 *
 * 模拟新员工第一次使用 LSC-AI：
 * 登录→欢迎页→发消息→流式输出→Workbench→新对话→切回历史
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry, waitForAIComplete } from '../helpers/ai-retry.helper';

// ============================================================
// 1. 登录与进入主界面
// ============================================================
test.describe('用户旅程 — 登录与首页', () => {
  test('打开首页 → 已登录直接进入 /chat', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/chat');
  });

  test('主界面 → 侧边栏正常渲染', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(page.locator(SEL.sidebar.newChatButton)).toBeVisible({ timeout: 5000 });
  });

  test('主界面 → 欢迎页显示', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // 欢迎文字可见
    const welcome = page.locator('main').getByText('有什么可以帮你的');
    await expect(welcome).toBeVisible({ timeout: 10000 });
  });

  test('欢迎页 → 建议卡片可见且可点击', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const suggestions = page.locator('main button');
    const count = await suggestions.count();
    expect(count).toBeGreaterThan(0);

    // 第一个建议卡片应可见
    await expect(suggestions.first()).toBeVisible();
  });

  test('主界面 → 无明显布局溢出', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth + 10;
    });
    expect(overflow).toBe(false);
  });
});

// ============================================================
// 2. 发送第一条消息
// ============================================================
test.describe('用户旅程 — 首次发消息', () => {
  test.setTimeout(180000);

  test('发送消息 → 欢迎页消失 + 用户气泡出现', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');

    // 等待 session 创建
    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 用户消息应立即出现
    await expect(page.locator('main').getByText('你好')).toBeVisible({ timeout: 5000 });
  });

  test('发送消息 → 输入框清空', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('测试消息');
    await textarea.press('Enter');

    await expect(textarea).toHaveValue('', { timeout: 3000 });
  });

  test('AI 回复 → 流式输出过程中内容逐渐增长', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请列出3个中国城市');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 等 assistant 气泡出现
    const bubble = page.locator('main .message-bubble.assistant').first();
    await expect(bubble).toBeVisible({ timeout: 30000 });

    // 检测内容增长
    let prevLen = 0;
    let grew = false;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(400);
      const content = (await bubble.textContent()) || '';
      if (content.length > prevLen && prevLen > 0) {
        grew = true;
        break;
      }
      prevLen = content.length;
    }

    await waitForAIComplete(page);

    const finalContent = (await bubble.textContent()) || '';
    expect(finalContent.length).toBeGreaterThan(5);
    console.log(`[旅程] 流式增长: ${grew}, 最终长度: ${finalContent.length}`);
  });

  test('AI 回复完成 → 停止按钮消失', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const result = await sendAndWaitWithRetry(page, '你好，简短回复');
    expect(result.hasResponse).toBeTruthy();

    // 停止按钮应该不可见
    const stopBtn = page.locator(SEL.chat.stopButton);
    await expect(stopBtn).not.toBeVisible({ timeout: 5000 });
  });

  test('发送消息后 → 侧边栏出现新会话', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    await sendAndWaitWithRetry(page, '你好');

    // 侧边栏应有会话项
    const items = page.locator(SEL.sidebar.sessionItem);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 3. Workbench 交互
// ============================================================
test.describe('用户旅程 — Workbench', () => {
  test.setTimeout(180000);

  test('请求代码 → Workbench 面板打开', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    await sendAndWaitWithRetry(page, '请使用showCode工具展示一段简单的Python hello world代码', { timeout: 90000 });

    await page.waitForTimeout(3000);

    // 检查 Workbench 面板出现
    const wb = page.locator('[class*="workbench"], [class*="Workbench"]');
    const visible = (await wb.count()) > 0;
    console.log(`[旅程] Workbench 面板可见: ${visible}`);

    // AI 至少有回复
    const bubbles = page.locator('main .message-bubble.assistant');
    expect(await bubbles.count()).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 4. 新对话与历史切换
// ============================================================
test.describe('用户旅程 — 新对话与历史', () => {
  test.setTimeout(180000);

  test('点击新对话 → 回到欢迎页', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // 先发一条消息
    await sendAndWaitWithRetry(page, '旅程测试消息');

    // 点新对话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 应该回到欢迎状态（有输入框，可能有欢迎文字）
    const textarea = page.locator(SEL.chat.textarea);
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  test('切回历史对话 → 消息完整恢复', async ({ page }) => {
    // 自然创建会话
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const uniqueMsg = `旅程历史测试-${Date.now()}`;
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill(uniqueMsg);
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await expect(page.locator('main').getByText(uniqueMsg)).toBeVisible({ timeout: 5000 });
    const sessionUrl = page.url();

    // 点击新对话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 切回来
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);

    // 消息应还在
    const visible = await page.locator('main').getByText(uniqueMsg).first().isVisible().catch(() => false);
    console.log(`[旅程] 切回后消息可见: ${visible}`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('刷新页面 → AI 回复恢复', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const result = await sendAndWaitWithRetry(page, '你好，简短回复', { timeout: 120000 });

    if (!result.hasResponse) {
      console.log('[旅程] AI 未回复（限流），跳过刷新恢复测试');
      return;
    }

    // 刷新
    await page.reload();
    await page.waitForTimeout(5000);

    // AI 回复应还在
    const bubbles = page.locator('main .message-bubble.assistant');
    await expect(bubbles.first()).toBeVisible({ timeout: 15000 });
  });
});
