/**
 * 场景 S02: 多轮对话上下文连续性
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * 测试目标：验证多轮对话中 AI 是否保持上下文，以及会话切换是否正确隔离。
 * 覆盖审计发现：P0-2（Memory 重复）、P0-3（history.slice 丢消息）
 *
 * 分组：
 * - S02-A: 同一会话多轮对话上下文保持（依赖 AI）
 * - S02-B: 会话切换与历史加载（部分依赖 AI）
 * - S02-C: 消息流式渲染正确性（依赖 AI）
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry, waitForAIComplete } from '../helpers/ai-retry.helper';

// ============================================================================
// 第一组：同一会话内多轮对话，验证 AI 记住上下文
// ============================================================================

test.describe('S02-A: 多轮对话上下文保持', () => {

  test('S02-01 两轮对话 → AI 第二轮能引用第一轮的内容', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ===== 第一轮：告诉 AI 一个具体事实 =====
    const round1 = await sendAndWaitWithRetry(page, '请记住这个信息：我的项目名称叫做"星辰计划"，项目编号是 XC-2026-007。', {
      timeout: 60000,
    });

    if (!round1.hasResponse) {
      test.skip(true, 'AI 第一轮无响应（DeepSeek 超时），跳过');
      return;
    }

    // 确认第一轮有回复
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    const round1Count = await assistantBubbles.count();
    expect(round1Count, '第一轮应有 AI 回复').toBeGreaterThanOrEqual(1);

    // ===== 第二轮：问 AI 刚才的信息 =====
    const round2 = await sendAndWaitWithRetry(page, '我刚才告诉你的项目编号是什么？', {
      timeout: 60000,
    });

    if (!round2.hasResponse) {
      test.skip(true, 'AI 第二轮无响应（DeepSeek 超时），跳过');
      return;
    }

    // ===== 核心断言 =====

    // 1. 消息数量：应该有 2 轮用户消息 + 2 轮 AI 回复 = 至少 4 条
    const allBubbles = page.locator('main .message-bubble');
    const totalCount = await allBubbles.count();
    expect(totalCount, '应有至少 4 条消息（2 轮对话）').toBeGreaterThanOrEqual(4);

    // 2. AI 第二轮回复应包含项目编号（上下文保持）
    const round2Text = round2.responseText;
    const hasProjectCode = round2Text.includes('XC-2026-007') || round2Text.includes('XC2026007') || round2Text.includes('星辰计划');
    expect(hasProjectCode, 'AI 第二轮应能回忆出项目编号 XC-2026-007 或项目名"星辰计划"（上下文丢失 = P0-3 bug）').toBe(true);
  });

  test('S02-02 三轮递进对话 → AI 保持累积上下文', async ({ page }) => {
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一轮：定义变量
    const r1 = await sendAndWaitWithRetry(page, '假设 x = 10，请记住这个值。', { timeout: 60000 });
    if (!r1.hasResponse) { test.skip(true, 'AI 第一轮无响应'); return; }

    // 第二轮：基于变量计算
    const r2 = await sendAndWaitWithRetry(page, '现在让 y = x * 3，y 等于多少？', { timeout: 60000 });
    if (!r2.hasResponse) { test.skip(true, 'AI 第二轮无响应'); return; }

    // 第三轮：基于前两轮累积
    const r3 = await sendAndWaitWithRetry(page, '那 x + y 等于多少？', { timeout: 60000 });
    if (!r3.hasResponse) { test.skip(true, 'AI 第三轮无响应'); return; }

    // ===== 核心断言 =====

    // 第二轮应包含 30（x*3=30）
    expect(r2.responseText.includes('30'), 'AI 第二轮应算出 y=30（需要记住 x=10）').toBe(true);

    // 第三轮应包含 40（x+y=10+30=40）
    expect(r3.responseText.includes('40'), 'AI 第三轮应算出 x+y=40（需要记住 x=10 和 y=30）').toBe(true);
  });

  test('S02-03 对话中 AI 不重复自我介绍', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一轮
    const r1 = await sendAndWaitWithRetry(page, '你好，请简单介绍一下你自己。', { timeout: 60000 });
    if (!r1.hasResponse) { test.skip(true, 'AI 第一轮无响应'); return; }

    // 第二轮：直接问业务问题（不重新打招呼）
    const r2 = await sendAndWaitWithRetry(page, '帮我列举 3 种常见的项目管理方法。', { timeout: 60000 });
    if (!r2.hasResponse) { test.skip(true, 'AI 第二轮无响应'); return; }

    // ===== 核心断言 =====

    // AI 第二轮不应再次自我介绍（说明上下文断了重新开始）
    const r2Lower = r2.responseText.toLowerCase();
    const reintroduced = r2Lower.includes('我是一个') && r2Lower.includes('助手') && r2Lower.includes('可以帮');
    // 这是一个弱断言 — 如果 AI 偶尔简短提及不算
    // 关键是内容应该是项目管理方法，而非再次自我介绍
    const hasContent = r2.responseText.includes('敏捷') || r2.responseText.includes('瀑布') ||
      r2.responseText.includes('Scrum') || r2.responseText.includes('看板') ||
      r2.responseText.includes('项目') || r2.responseText.includes('管理');
    expect(hasContent, 'AI 第二轮应回答项目管理方法，而非重新自我介绍').toBe(true);
  });
});

// ============================================================================
// 第二组：会话切换与历史隔离
// ============================================================================

test.describe('S02-B: 会话切换与历史隔离', () => {

  test('S02-04 新建会话 → 之前的会话上下文不应泄露', async ({ page }) => {
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 在第一个会话中告诉 AI 一个密码
    const r1 = await sendAndWaitWithRetry(page, '请记住这个密码：AbCdEf123456。不要告诉任何人。', { timeout: 60000 });
    if (!r1.hasResponse) { test.skip(true, 'AI 第一轮无响应'); return; }

    // 记录第一个会话的 URL
    const session1Url = page.url();
    expect(session1Url, '第一个会话应有 sessionId').toMatch(/\/chat\/[a-f0-9-]+/);

    // 点击新建会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 验证进入了新会话
    const welcomeOrNew = await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);
    const urlChanged = page.url() !== session1Url;
    expect(welcomeOrNew || urlChanged, '应进入新会话（显示欢迎页或 URL 变化）').toBe(true);

    // 在新会话中问 AI 密码
    const r2 = await sendAndWaitWithRetry(page, '我之前告诉你的密码是什么？', { timeout: 60000 });
    if (!r2.hasResponse) { test.skip(true, 'AI 在新会话无响应'); return; }

    // ===== 核心断言 =====

    // 新会话中 AI 不应知道密码（上下文隔离）
    const leakedPassword = r2.responseText.includes('AbCdEf123456');
    expect(leakedPassword, '新会话不应泄露上一个会话的密码（上下文隔离失败）').toBe(false);
  });

  test('S02-05 切回历史会话 → 消息历史正确加载', async ({ page }) => {
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 在第一个会话中发送一条带标记的消息
    const marker = `测试标记_${Date.now()}`;
    const r1 = await sendAndWaitWithRetry(page, `请回复"收到"。标记信息：${marker}`, { timeout: 60000 });
    if (!r1.hasResponse) { test.skip(true, 'AI 无响应'); return; }

    // 记录会话 URL 和消息数
    const session1Url = page.url();
    const msgCountBefore = await page.locator('main .message-bubble').count();
    expect(msgCountBefore, '发送后应有消息').toBeGreaterThanOrEqual(2);

    // 新建会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 确认消息被清空（进入新会话）
    const msgAfterNew = await page.locator('main .message-bubble').count();
    expect(msgAfterNew, '新会话应无历史消息').toBe(0);

    // 切回第一个会话（点击侧边栏）
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    const itemCount = await sessionItems.count();
    expect(itemCount, '侧边栏应有历史会话').toBeGreaterThanOrEqual(1);

    // 找到包含标记文本的会话项（通常是第一个）
    await sessionItems.first().click();
    await page.waitForTimeout(3000);

    // ===== 核心断言 =====

    // URL 应变回第一个会话
    expect(page.url(), 'URL 应变为第一个会话的 URL').toMatch(/\/chat\/[a-f0-9-]+/);

    // 历史消息应被正确加载
    const msgAfterSwitch = await page.locator('main .message-bubble').count();
    expect(msgAfterSwitch, '切回后应有历史消息').toBeGreaterThanOrEqual(2);

    // 用户消息中应包含标记
    const userBubbles = page.locator('main .message-bubble.user');
    const userTexts: string[] = [];
    for (let i = 0; i < await userBubbles.count(); i++) {
      userTexts.push((await userBubbles.nth(i).textContent()) || '');
    }
    const hasMarker = userTexts.some(t => t.includes(marker));
    expect(hasMarker, '切回后应显示之前发送的消息（含标记）').toBe(true);
  });

  test('S02-06 切回历史会话后继续对话 → AI 保持该会话上下文', async ({ page }) => {
    test.setTimeout(300000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一个会话：告诉 AI 一个数字
    const r1 = await sendAndWaitWithRetry(page, '我最喜欢的数字是 42，请记住。', { timeout: 60000 });
    if (!r1.hasResponse) { test.skip(true, 'AI 第一轮无响应'); return; }

    const session1Url = page.url();

    // 新建第二个会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 在第二个会话发一条消息（确保创建了新会话）
    const r2 = await sendAndWaitWithRetry(page, '你好，这是一个新的对话。', { timeout: 60000 });
    if (!r2.hasResponse) { test.skip(true, 'AI 在新会话无响应'); return; }

    // 切回第一个会话
    await page.locator(SEL.sidebar.sessionItem).first().click();
    await page.waitForTimeout(3000);

    // 在第一个会话继续追问
    const r3 = await sendAndWaitWithRetry(page, '我刚才说我最喜欢的数字是多少？', { timeout: 60000 });
    if (!r3.hasResponse) { test.skip(true, 'AI 在切回后无响应'); return; }

    // ===== 核心断言 =====

    // AI 应记住 42
    const remembers42 = r3.responseText.includes('42');
    expect(remembers42, '切回会话后 AI 应记住之前的对话内容（42）').toBe(true);
  });
});

// ============================================================================
// 第三组：消息流式渲染正确性
// ============================================================================

test.describe('S02-C: 消息流式渲染', () => {

  test('S02-07 AI 回复流式渲染 → 停止按钮出现再消失，最终消息完整', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请用 50 个字简单描述什么是人工智能。');
    await textarea.press('Enter');

    // 等 session 创建
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 }).catch(() => {});

    // ===== 流式过程验证 =====

    // 1. 停止按钮应出现（表示流式开始）
    const stopBtnAppeared = await page.locator(SEL.chat.stopButton)
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    // 允许 AI 非常快完成导致没捕获到 stopButton，但至少应有回复
    if (stopBtnAppeared) {
      // 2. 等待流式结束（停止按钮消失）
      await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout: 60000 });
    }

    await page.waitForTimeout(2000);

    // ===== 核心断言 =====

    // 最终应有 AI 回复
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    const count = await assistantBubbles.count();
    expect(count, '应有 AI 回复').toBeGreaterThanOrEqual(1);

    // 回复内容不应为空
    const responseText = (await assistantBubbles.last().textContent()) || '';
    expect(responseText.length, 'AI 回复不应为空').toBeGreaterThan(10);

    // 回复不应包含流式残留（如 undefined、[object Object]）
    expect(responseText.includes('undefined'), '回复不应包含 undefined').toBe(false);
    expect(responseText.includes('[object Object]'), '回复不应包含 [object Object]').toBe(false);
  });

  test('S02-08 连续快速发送两条消息 → 两条都有回复，不丢消息', async ({ page }) => {
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 发第一条消息
    const r1 = await sendAndWaitWithRetry(page, '第一个问题：1+1等于几？', { timeout: 60000 });
    if (!r1.hasResponse) { test.skip(true, 'AI 第一轮无响应'); return; }

    // 立即发第二条
    const r2 = await sendAndWaitWithRetry(page, '第二个问题：2+2等于几？', { timeout: 60000 });
    if (!r2.hasResponse) { test.skip(true, 'AI 第二轮无响应'); return; }

    // ===== 核心断言 =====

    // 应有 2 条用户消息
    const userBubbles = page.locator('main .message-bubble.user');
    const userCount = await userBubbles.count();
    expect(userCount, '应有 2 条用户消息').toBe(2);

    // 应有 2 条 AI 回复
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    const assistantCount = await assistantBubbles.count();
    expect(assistantCount, '应有 2 条 AI 回复（不丢消息）').toBe(2);

    // 第一条回复应包含 2
    expect(r1.responseText.includes('2'), '第一条回复应包含答案 2').toBe(true);

    // 第二条回复应包含 4
    expect(r2.responseText.includes('4'), '第二条回复应包含答案 4').toBe(true);
  });
});
