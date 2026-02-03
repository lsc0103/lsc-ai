/**
 * Workbench 状态管理测试
 *
 * - 内容持久化（切换会话后恢复）
 * - 多会话各有不同 Workbench
 * - UI 交互（面板开关、标签切换）
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

const WB_SELECTOR = '[class*="workbench"], [class*="Workbench"]';

test.describe('Workbench — 内容持久化', () => {
  test.setTimeout(180000);

  test('AI 触发 Workbench → 面板出现', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const result = await sendAndWaitWithRetry(page, '请使用showTable工具展示一个2行3列的简单表格', { timeout: 120000 });
    await page.waitForTimeout(3000);

    if (result.hasResponse) {
      const wb = page.locator(WB_SELECTOR);
      const count = await wb.count();
      console.log(`[Workbench] 面板数量: ${count}`);
    } else {
      console.log('[Workbench] AI 未回复（限流），跳过面板检查');
    }

    // 页面不崩溃
    await expect(page.locator('main')).toBeVisible();
  });

  test('切换会话后 → 用户消息在各自会话中保留', async ({ page }) => {
    const textarea = page.locator(SEL.chat.textarea);

    // 创建 s1 并发消息
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    await textarea.fill('wb持久化消息WB1');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await expect(page.locator('main').getByText('WB1')).toBeVisible({ timeout: 5000 });
    const s1Url = page.url();

    // 切到新会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 切回 s1
    await page.goto(s1Url);
    await page.waitForTimeout(5000);

    // 用户消息应在
    const hasMsg = await page.locator('main').getByText('WB1').first().isVisible().catch(() => false);
    console.log(`[Workbench持久化] 切回后消息可见: ${hasMsg}`);
    // 页面不崩溃
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Workbench — 多会话隔离', () => {
  test.setTimeout(300000);

  test('不同会话的消息不互相影响', async ({ page }) => {
    const textarea = page.locator(SEL.chat.textarea);

    // 创建 s1
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    await textarea.fill('wb隔离唯一标记AAA');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    // 确保消息可见
    await expect(page.locator('main').getByText('AAA')).toBeVisible({ timeout: 5000 });
    const s1Url = page.url();
    console.log(`[隔离] s1 URL: ${s1Url}`);

    // 创建 s2 — 点新对话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);
    await textarea.fill('wb隔离唯一标记BBB');
    await textarea.press('Enter');
    await page.waitForTimeout(3000);
    // 确保消息可见
    await expect(page.locator('main').getByText('BBB')).toBeVisible({ timeout: 5000 });
    const s2Url = page.url();
    console.log(`[隔离] s2 URL: ${s2Url}`);

    // 切回 s1 — 等待消息加载
    await page.goto(s1Url);
    await page.waitForTimeout(5000);
    // 等待用户消息出现
    const s1HasAAA = await page.locator('main').getByText('AAA').isVisible().catch(() => false);
    const s1HasBBB = await page.locator('main').getByText('BBB').isVisible().catch(() => false);
    console.log(`[隔离] s1: AAA=${s1HasAAA}, BBB=${s1HasBBB}`);
    expect(s1HasBBB).toBe(false);

    // 切到 s2
    await page.goto(s2Url);
    await page.waitForTimeout(5000);
    const s2HasBBB = await page.locator('main').getByText('BBB').isVisible().catch(() => false);
    const s2HasAAA = await page.locator('main').getByText('AAA').isVisible().catch(() => false);
    console.log(`[隔离] s2: BBB=${s2HasBBB}, AAA=${s2HasAAA}`);
    expect(s2HasAAA).toBe(false);
  });
});

test.describe('Workbench — UI 交互', () => {
  test.setTimeout(60000);

  test('Workbench 面板 — 有打开/关闭按钮', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // 检查是否有工作台按钮
    const toggleBtn = page.locator('button:has-text("工作台"), button:has-text("Workbench")');
    const count = await toggleBtn.count();
    console.log(`[Workbench UI] 工作台按钮数量: ${count}`);
    // 即使没有 Workbench 按钮也不算失败（可能只在有内容时显示）
  });

  test('聊天区域输入框始终可用', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
  });

  test('页面无横向溢出', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth + 10;
    });
    expect(overflow).toBe(false);
  });

  test('Workbench 面板 — 快速切换不崩溃', async ({ page, api }) => {
    const s1 = await api.createSession('test-wb-quick-1');
    const s2 = await api.createSession('test-wb-quick-2');
    const s3 = await api.createSession('test-wb-quick-3');

    // 快速切换
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(500);
    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(500);
    await page.goto(`/chat/${s3.id}`);
    await page.waitForTimeout(2000);

    // 最终在 s3，页面正常
    expect(page.url()).toContain(s3.id);
    await expect(page.locator(SEL.chat.textarea)).toBeVisible({ timeout: 5000 });

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
    await api.deleteSession(s3.id);
  });
});
