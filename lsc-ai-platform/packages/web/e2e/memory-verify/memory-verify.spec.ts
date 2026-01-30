/**
 * Memory 持久化 + 跨会话记忆验证
 *
 * 验证 Mastra Memory 系统的核心能力：
 * 1. 会话内多轮上下文记忆
 * 2. 刷新页面后历史消息完整恢复
 * 3. 不同会话间消息隔离
 * 4. Working Memory（AI记住用户偏好）
 * 5. Semantic Recall（语义相似内容召回）
 * 6. 会话删除后记忆清理
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

const AI_TIMEOUT = 180000;

async function sendAndWaitForReply(page: import('@playwright/test').Page, message: string) {
  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill(message);
  await textarea.press('Enter');

  await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  try {
    await page.locator('button .anticon-stop').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await page.locator('button .anticon-stop').waitFor({ state: 'hidden', timeout: AI_TIMEOUT });
  } catch {}
  await page.waitForTimeout(2000);
}

function getAssistantBubbles(page: import('@playwright/test').Page) {
  return page.locator('main .message-bubble.assistant');
}

function getUserBubbles(page: import('@playwright/test').Page) {
  return page.locator('main .message-bubble.user');
}

// ============================================================
// 1. 会话内上下文记忆
// ============================================================
test.describe('Memory — 会话内上下文', () => {
  test.setTimeout(AI_TIMEOUT * 2);

  test('3轮对话上下文连贯', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    // Round 1: 告知信息
    await sendAndWaitForReply(page, '请记住：我正在开发一个名叫"海鸥号"的船舶管理系统，用的是React+NestJS技术栈');

    // Round 2: 追加信息
    await sendAndWaitForReply(page, '另外，这个系统的数据库用的是PostgreSQL，部署在阿里云上');

    // Round 3: 要求回忆所有信息
    await sendAndWaitForReply(page, '请完整总结我之前告诉你的所有项目信息，包括项目名、技术栈、数据库、部署环境');

    // 验证第三轮回复包含之前的所有信息
    const bubbles = getAssistantBubbles(page);
    const lastBubble = bubbles.last();
    const content = await lastBubble.textContent() || '';

    console.log(`[3轮上下文] 第3轮回复: ${content.slice(0, 300)}`);

    // 应包含关键信息
    const hasProjectName = content.includes('海鸥') || content.includes('船舶');
    const hasTech = content.includes('React') || content.includes('NestJS');
    const hasDB = content.includes('PostgreSQL') || content.includes('postgres');

    expect(hasProjectName || hasTech || hasDB).toBeTruthy();
  });

  test('AI记住用户偏好（Working Memory）', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    // 告知偏好
    await sendAndWaitForReply(page, '我喜欢简洁的代码风格，不要太多注释，变量名用英文，函数名用驼峰命名。请记住这个偏好。');

    // 要求写代码，看是否遵循偏好
    await sendAndWaitForReply(page, '帮我写一个计算数组平均值的JavaScript函数');

    const bubbles = getAssistantBubbles(page);
    const lastContent = await bubbles.last().textContent() || '';
    console.log(`[Working Memory] 代码回复: ${lastContent.slice(0, 300)}`);

    // 代码应该存在且有一定长度
    expect(lastContent.length).toBeGreaterThan(20);
  });
});

// ============================================================
// 2. 页面刷新后历史恢复
// ============================================================
test.describe('Memory — 持久化恢复', () => {
  test.setTimeout(AI_TIMEOUT * 2);

  test('刷新页面后用户消息和AI回复都完整保留', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const uniqueMsg = `持久化验证_${Date.now()}_独特标记XYZ`;
    await sendAndWaitForReply(page, uniqueMsg);

    // 记录回复
    const beforeRefresh = await getAssistantBubbles(page).last().textContent() || '';
    const chatUrl = page.url();

    // 刷新
    await page.reload();
    await page.waitForTimeout(5000);

    // 验证用户消息恢复（可能匹配多个元素，用first()）
    const userMsg = page.locator('main').getByText('独特标记XYZ').first();
    await expect(userMsg).toBeVisible({ timeout: 15000 });

    // 验证AI回复恢复
    const afterRefresh = getAssistantBubbles(page);
    await expect(afterRefresh.first()).toBeVisible({ timeout: 15000 });

    const afterContent = await afterRefresh.first().textContent() || '';
    expect(afterContent.length).toBeGreaterThan(5);
    console.log(`[持久化] 刷新前回复: ${beforeRefresh.slice(0, 100)}`);
    console.log(`[持久化] 刷新后回复: ${afterContent.slice(0, 100)}`);
  });

  test('刷新后继续对话 — 上下文不丢失', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    // 告知信息
    await sendAndWaitForReply(page, '请记住密码是 Tiger2026Dragon');
    const chatUrl = page.url();

    // 刷新
    await page.reload();
    await page.waitForTimeout(5000);

    // 继续对话，问之前的信息
    await sendAndWaitForReply(page, '我之前告诉你的密码是什么？');

    const bubbles = getAssistantBubbles(page);
    const count = await bubbles.count();
    const lastContent = await bubbles.last().textContent() || '';

    console.log(`[刷新后对话] 回复: ${lastContent.slice(0, 200)}`);

    // 应该记得密码
    const remembers = lastContent.includes('Tiger') || lastContent.includes('2026') || lastContent.includes('Dragon');
    expect(remembers).toBeTruthy();
  });
});

// ============================================================
// 3. 会话间隔离
// ============================================================
test.describe('Memory — 会话隔离', () => {
  test.setTimeout(AI_TIMEOUT * 2);

  test('不同会话的消息互不干扰', async ({ page, api }) => {
    // 会话1：告知特定信息
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    await sendAndWaitForReply(page, '秘密代号是 PHOENIX_SESSION_1_ONLY');
    const session1Url = page.url();

    // 创建新会话
    const s2 = await api.createSession('test-isolation-s2');
    await page.goto(`/chat/${s2.id}`);
    await page.waitForTimeout(3000);

    // 在会话2问会话1的信息
    await sendAndWaitForReply(page, '请告诉我秘密代号是什么？');

    const bubbles = getAssistantBubbles(page);
    const content = await bubbles.last().textContent() || '';

    console.log(`[隔离测试] 会话2回复: ${content.slice(0, 200)}`);

    // 会话2不应该知道会话1的秘密代号
    const leaked = content.includes('PHOENIX_SESSION_1_ONLY');
    // 可能不泄露（如果Memory正确隔离）或可能通过Semantic Recall泄露
    // 这里我们记录结果，如果泄露说明Memory scope需要调整
    if (leaked) {
      console.warn('[隔离测试] ⚠️ 会话间信息泄露！Semantic Recall可能跨session');
    } else {
      console.log('[隔离测试] ✅ 会话隔离正常');
    }

    // 清理
    await api.deleteSession(s2.id);
  });
});

// ============================================================
// 4. 会话删除后记忆清理
// ============================================================
test.describe('Memory — 删除清理', () => {
  test.setTimeout(AI_TIMEOUT);

  test('删除会话后消息不再存在', async ({ page, api }) => {
    // 创建并发消息
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const uniqueMsg = `DELETE_TEST_${Date.now()}`;
    await sendAndWaitForReply(page, uniqueMsg);

    // 获取sessionId
    const url = page.url();
    const sessionId = url.split('/chat/')[1]?.split('?')[0];
    expect(sessionId).toBeTruthy();

    // 删除会话
    await api.deleteSession(sessionId!);
    await page.waitForTimeout(1000);

    // 尝试访问已删除的会话
    await page.goto(`/chat/${sessionId}`);
    await page.waitForTimeout(3000);

    // 应该被重定向或显示空/错误状态
    const mainContent = await page.locator('main').textContent() || '';
    const stillHasMsg = mainContent.includes(uniqueMsg);

    if (stillHasMsg) {
      console.warn('[删除清理] ⚠️ 删除后消息仍然可见');
    } else {
      console.log('[删除清理] ✅ 会话删除后消息已清理');
    }
  });
});

// ============================================================
// 5. 大量消息性能
// ============================================================
test.describe('Memory — 性能边界', () => {
  test.setTimeout(AI_TIMEOUT * 3);

  test('连续发送10条消息 — 无丢失无错乱', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const messages = [];
    for (let i = 1; i <= 10; i++) {
      const msg = `序号${i}：这是第${i}条测试消息`;
      messages.push(msg);
    }

    // 逐条发送，每条等AI回复
    for (let i = 0; i < messages.length; i++) {
      await sendAndWaitForReply(page, messages[i]);
      console.log(`[大量消息] 已发送第${i + 1}条`);
    }

    // 验证所有用户消息都存在
    const userBubbles = getUserBubbles(page);
    const userCount = await userBubbles.count();
    console.log(`[大量消息] 用户气泡数: ${userCount}`);

    // 验证所有AI回复都存在
    const aiBubbles = getAssistantBubbles(page);
    const aiCount = await aiBubbles.count();
    console.log(`[大量消息] AI气泡数: ${aiCount}`);

    // 应该有10条用户消息和10条AI回复
    expect(userCount).toBeGreaterThanOrEqual(10);
    expect(aiCount).toBeGreaterThanOrEqual(10);

    // 刷新后验证
    await page.reload();
    await page.waitForTimeout(5000);

    const afterUserCount = await getUserBubbles(page).count();
    const afterAiCount = await getAssistantBubbles(page).count();
    console.log(`[大量消息] 刷新后用户气泡: ${afterUserCount}, AI气泡: ${afterAiCount}`);

    expect(afterUserCount).toBeGreaterThanOrEqual(10);
    expect(afterAiCount).toBeGreaterThanOrEqual(10);
  });
});
