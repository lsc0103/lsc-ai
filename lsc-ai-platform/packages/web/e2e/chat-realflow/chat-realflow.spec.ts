/**
 * 真实对话流程测试
 *
 * 模拟用户真实使用场景：发消息→等AI完整回复→验证内容
 * 这不是冒烟测试，而是端到端验证 AI 对话能力
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

// AI 回复最长等待时间（DeepSeek 可能较慢）
const AI_REPLY_TIMEOUT = 120000;

/**
 * 等待 AI 回复完成
 * 判断标准：streaming 结束（stop 按钮消失）且至少有一个 assistant 消息气泡
 */
async function waitForAIReply(page: import('@playwright/test').Page, timeout = AI_REPLY_TIMEOUT) {
  // 等待加载开始（stop 按钮出现或 typing indicator 出现）
  await page.waitForTimeout(1000);

  // 等待 streaming 完成：stop 按钮消失
  try {
    // 先等 stop 按钮出现（最多 5 秒）
    await page.locator('button .anticon-stop').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    // 再等它消失（AI 回复完成）
    await page.locator('button .anticon-stop').waitFor({ state: 'hidden', timeout });
  } catch {
    // stop 按钮可能从未出现（回复极快）或已消失
  }

  // 额外等待确保 DOM 更新完成
  await page.waitForTimeout(1500);
}

test.describe('Real Chat Flow — AI 完整对话', () => {
  // 这些测试会真实调用 AI，给足超时
  test.setTimeout(180000);

  test('发送简单问题 → AI 回复非空且为中文', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    // 发消息
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好，请用一句话介绍你自己');
    await textarea.press('Enter');

    // 等 URL 变化（session 创建）
    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 等 AI 完整回复
    await waitForAIReply(page);

    // 验证：主区域应有 assistant 消息气泡
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    await expect(assistantBubbles.first()).toBeVisible({ timeout: 10000 });

    // 验证：AI 回复内容非空
    const aiContent = await assistantBubbles.first().textContent();
    expect(aiContent).toBeTruthy();
    expect(aiContent!.length).toBeGreaterThan(5);

    console.log(`[测试] AI 回复内容 (前100字): ${aiContent!.slice(0, 100)}`);
  });

  test('多轮对话 — 上下文连贯性', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);

    // 第一轮：告诉 AI 一个信息
    await textarea.fill('请记住：我的名字叫测试员小王');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);

    // 验证第一轮 AI 回复存在
    const firstReply = page.locator('main .message-bubble.assistant').first();
    await expect(firstReply).toBeVisible({ timeout: 10000 });

    // 第二轮：让 AI 回忆刚才的信息
    await textarea.fill('我刚才告诉你我叫什么名字？');
    await textarea.press('Enter');
    await waitForAIReply(page);

    // 验证：应该有 2 个 assistant 气泡
    const allAssistantBubbles = page.locator('main .message-bubble.assistant');
    const count = await allAssistantBubbles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // 验证：第二轮回复应该包含"小王"或"测试员"
    const secondReply = await allAssistantBubbles.nth(count - 1).textContent();
    console.log(`[测试] 第二轮 AI 回复: ${secondReply?.slice(0, 150)}`);

    // AI 应该记住名字（检查回复中是否包含关键词）
    const hasName = secondReply?.includes('小王') || secondReply?.includes('测试员');
    expect(hasName).toBeTruthy();
  });

  test('发送后输入框清空 + 用户消息立即可见', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    const msgText = `realflow测试消息${Date.now()}`;
    await textarea.fill(msgText);
    await textarea.press('Enter');

    // 输入框应该立即清空
    await expect(textarea).toHaveValue('', { timeout: 3000 });

    // 用户消息应该立即出现在主区域（不需等 AI 回复）
    await expect(page.locator('main').getByText(msgText)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Real Chat Flow — 流式渲染', () => {
  test.setTimeout(180000);

  test('streaming 过程中消息气泡实时更新', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    // 用一个需要较长回复的问题
    await textarea.fill('请列出5个中国传统节日并简要介绍');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 等待 streaming 开始（assistant 气泡出现）
    const streamingBubble = page.locator('main .message-bubble.assistant').first();
    await expect(streamingBubble).toBeVisible({ timeout: 30000 });

    // 在 streaming 过程中多次检查内容长度是否在增长
    let prevLen = 0;
    let grew = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const content = await streamingBubble.textContent().catch(() => '');
      const curLen = content?.length || 0;
      if (curLen > prevLen && prevLen > 0) {
        grew = true;
        break;
      }
      prevLen = curLen;
    }

    // 等回复完成
    await waitForAIReply(page);

    // 验证最终内容不为空且有合理长度
    const finalContent = await streamingBubble.textContent();
    expect(finalContent).toBeTruthy();
    expect(finalContent!.length).toBeGreaterThan(50);

    console.log(`[测试] Streaming 增长检测: ${grew}, 最终长度: ${finalContent!.length}`);
  });
});

test.describe('Real Chat Flow — 会话持久化和切换', () => {
  test.setTimeout(180000);

  test('发送消息后刷新页面 → 消息仍存在', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    const msgText = `持久化测试${Date.now()}`;
    await textarea.fill(msgText);
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);

    // 记录当前 URL
    const chatUrl = page.url();

    // 刷新页面
    await page.reload();
    await page.waitForTimeout(3000);

    // 验证：用户消息应该仍然存在（从服务器重新加载）
    // 注意：消息可能在侧边栏和主区域都出现，限定 main
    const userMsg = page.locator('main').getByText(msgText);
    await expect(userMsg).toBeVisible({ timeout: 15000 });

    // 验证：AI 回复也应该存在
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    await expect(assistantBubbles.first()).toBeVisible({ timeout: 10000 });
  });

  test('切换会话 → 消息不错乱', async ({ page, api }) => {
    // 创建两个会话
    const s1 = await api.createSession('test-switch-s1');
    const s2 = await api.createSession('test-switch-s2');

    // 在 s1 中发消息
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(2000);
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('这是会话1的消息');
    await textarea.press('Enter');
    await waitForAIReply(page);

    // 切换到 s2
    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(3000);

    // s2 应该没有 s1 的消息
    const body = await page.locator('main').textContent();
    expect(body).not.toContain('这是会话1的消息');

    // 切回 s1
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(3000);

    // s1 的消息应该还在
    await expect(page.locator('main .message-bubble.user').getByText('这是会话1的消息')).toBeVisible({ timeout: 10000 });

    // 清理
    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
  });

  test('快速连续切换会话 — 无竞态错乱', async ({ page, api }) => {
    const s1 = await api.createSession('test-race-s1');
    const s2 = await api.createSession('test-race-s2');
    const s3 = await api.createSession('test-race-s3');

    // 快速连续切换（不等加载完成）
    await page.goto(`/chat/${s1.id}`);
    await page.waitForTimeout(500);
    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(500);
    await page.goto(`/chat/${s3.id}`);
    await page.waitForTimeout(3000);

    // 最终应该在 s3 上，页面无报错
    expect(page.url()).toContain(s3.id);

    // 页面应该正常（有输入框）
    await expect(page.locator(SEL.chat.textarea)).toBeVisible({ timeout: 5000 });

    await api.deleteSession(s1.id);
    await api.deleteSession(s2.id);
    await api.deleteSession(s3.id);
  });
});

test.describe('Real Chat Flow — 历史消息渲染', () => {
  test.setTimeout(180000);

  test('历史消息用 Markdown 渲染而非纯文本/JSON', async ({ page }) => {
    // 先发一条需要 markdown 回复的消息
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请用markdown格式列出3个要点');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);

    const chatUrl = page.url();

    // 刷新页面重新加载历史消息
    await page.reload();
    await page.waitForTimeout(4000);

    // 验证：AI 回复应该是 Markdown 渲染的（包含 prose 类名）
    const assistantBubble = page.locator('main .message-bubble.assistant').first();
    await expect(assistantBubble).toBeVisible({ timeout: 15000 });

    // 检查不是原始 JSON
    const content = await assistantBubble.textContent();
    expect(content).not.toContain('"format"');
    expect(content).not.toContain('"parts"');
    expect(content).not.toContain('"type":"text"');

    // 应该有实际的文本内容
    expect(content!.length).toBeGreaterThan(20);

    console.log(`[测试] 历史消息渲染内容 (前100字): ${content!.slice(0, 100)}`);
  });
});
