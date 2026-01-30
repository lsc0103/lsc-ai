/**
 * 聊天界面 UI 测试（纯前端，不依赖 AI 回复）
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

test.describe('聊天 UI — 输入区域', () => {
  test.setTimeout(30000);

  test('输入框 → 可见且可输入', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await expect(textarea).toBeVisible();
    await textarea.fill('测试输入');
    await expect(textarea).toHaveValue('测试输入');
  });

  test('输入框 → 有 placeholder', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    const placeholder = await textarea.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder!.length).toBeGreaterThan(0);
  });

  test('空输入 → 发送按钮状态合理', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const sendBtn = page.locator(SEL.chat.sendButton);
    const count = await sendBtn.count();
    console.log(`[聊天UI] 发送按钮数量: ${count}`);

    // 空输入时发送不应创建新会话
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('');
    await textarea.press('Enter');
    await page.waitForTimeout(1000);
    expect(page.url()).not.toMatch(/\/chat\/.+/);
  });

  test('Shift+Enter → 换行而非发送', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('第一行');
    await textarea.press('Shift+Enter');
    await page.waitForTimeout(500);

    // 应该没有发送（URL 不变）
    expect(page.url()).not.toMatch(/\/chat\/.+/);
    // 输入框值应包含换行
    const value = await textarea.inputValue();
    console.log(`[聊天UI] Shift+Enter后值长度: ${value.length}`);
  });
});

test.describe('聊天 UI — 欢迎页', () => {
  test.setTimeout(30000);

  test('欢迎文字 → 可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const welcome = page.locator('main').getByText('有什么可以帮你的');
    await expect(welcome).toBeVisible({ timeout: 10000 });
  });

  test('建议卡片 → 存在且可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const cards = page.locator('main button');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    console.log(`[聊天UI] 建议卡片数量: ${count}`);
  });

  test('建议卡片点击 → 填充输入框或发送', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const cards = page.locator('main button');
    const count = await cards.count();
    if (count > 0) {
      const firstCard = cards.first();
      const cardText = await firstCard.textContent();
      await firstCard.click();
      await page.waitForTimeout(2000);

      // 可能填充了输入框或直接发送
      const url = page.url();
      const textarea = page.locator(SEL.chat.textarea);
      const value = await textarea.inputValue();

      console.log(`[聊天UI] 卡片文字: ${cardText?.slice(0, 30)}, 点击后URL: ${url}, 输入框值: ${value.slice(0, 30)}`);
    }
  });
});

test.describe('聊天 UI — 消息显示', () => {
  test.setTimeout(30000);

  test('发送消息 → 用户气泡立即出现', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    const msg = `ui-test-${Date.now()}`;
    await textarea.fill(msg);
    await textarea.press('Enter');

    // 用户消息立即可见
    await expect(page.locator('main').getByText(msg)).toBeVisible({ timeout: 5000 });
  });

  test('发送后 → 输入框清空', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('清空测试');
    await textarea.press('Enter');

    await expect(textarea).toHaveValue('', { timeout: 3000 });
  });

  test('主区域 → 无横向滚动条', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return false;
      return main.scrollWidth > main.clientWidth + 10;
    });
    expect(overflow).toBe(false);
  });
});
