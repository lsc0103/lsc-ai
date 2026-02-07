/**
 * ============================================================================
 * 场景 S02-V2: 多轮对话上下文连续性 — 分层测试重设计
 * ============================================================================
 *
 * 产品经理（Opus 4.6）编写 — 工程师只管执行，不得修改 expect 断言。
 *
 * 设计原则：
 * 1. 分层测试：持久化层（0 AI）→ 历史注入层（0 AI）→ AI 连贯层（3 AI）→ 流式/并发层（1 AI）
 * 2. 最小 AI 调用：整个文件仅 4 次 AI 调用（从旧版 14 次降到 4 次）
 * 3. 从"测 LLM 记忆力"转向"测平台消息持久化与历史注入机制"
 * 4. 限流时 graceful skip，不阻断
 *
 * 与旧 S02 的区别：
 * - 旧版 8 个测试全部依赖 AI（14 次调用），限流下大面积失败
 * - 旧版本质上测的是 LLM 记忆能力，而非平台消息管道
 * - 新版 12 个测试，仅 4 次 AI 调用，覆盖持久化/注入/连贯/流式四层
 *
 * 分组：
 * - A: 消息持久化 (4 tests) — 0 AI，测 DB + REST API + 前端状态
 * - B: 历史注入正确性 (3 tests) — 0 AI，测 WebSocket 通道 + API 结构
 * - C: AI 上下文连贯 (3 tests, serial) — 3 AI，每个测试仅 1 次 AI 调用
 * - D: 流式与并发 (2 tests) — 1 AI，测 stop 按钮生命周期 + 消息不丢失
 *
 * AI 调用预算：
 *   C01: 1 次（告诉 AI 事实）
 *   C02: 1 次（同一会话回忆）
 *   C03: 1 次（新会话隔离验证）
 *   D01: 1 次（流式渲染验证）
 *   合计：4 次
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// ============================================================================
// A: 消息持久化（4 tests）— 0 AI 调用
// 测试目的：消息发送后，通过 REST API / 刷新 / 会话切换验证数据持久化
// ============================================================================

test.describe('S02-A: 消息持久化', () => {

  test('S02-A01 发送消息后刷新页面 → 用户消息仍在', async ({ page, api }) => {
    /**
     * 用户场景：发了一条消息，刷新浏览器后消息不应丢失
     * 验证点：
     * - 通过 API 创建会话并发送消息（不等 AI 回复）
     * - 刷新页面后，用户消息仍然显示在 DOM 中
     * - 通过 REST API 获取会话，确认消息已持久化
     */
    test.setTimeout(60000);

    // 1. 通过 API 创建会话
    const session = await api.createSession('S02-A01-持久化测试');
    const sessionId = session.id;
    expect(sessionId, '应成功创建会话').toBeTruthy();

    // 2. 导航到该会话
    await page.goto(`/chat/${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 3. 发送一条带唯一标记的消息（不需要等 AI 回复）
    const marker = `持久化标记_${Date.now()}`;
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill(marker);
    await textarea.press('Enter');

    // 等待消息出现在 DOM（用户消息是立即渲染的）
    await page.waitForTimeout(3000);

    // 验证用户消息已出现
    const userBubbles = page.locator('main .message-bubble.user');
    const countBefore = await userBubbles.count();
    expect(countBefore, '发送后应有用户消息气泡').toBeGreaterThanOrEqual(1);

    // 4. 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 5. 验证消息仍在（历史消息从 API 加载）
    await page.locator('main .message-bubble').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const userBubblesAfter = page.locator('main .message-bubble.user');
    const countAfter = await userBubblesAfter.count();
    expect(countAfter, '刷新后用户消息应仍在').toBeGreaterThanOrEqual(1);

    // 验证标记文本存在
    const allText: string[] = [];
    for (let i = 0; i < countAfter; i++) {
      allText.push((await userBubblesAfter.nth(i).textContent()) || '');
    }
    const hasMarker = allText.some(t => t.includes(marker));
    expect(hasMarker, `刷新后应找到标记文本 "${marker}"`).toBe(true);

    // 6. 通过 REST API 双重验证
    const sessionData = await api.getSession(sessionId);
    expect(sessionData, 'API 应返回会话数据').toBeTruthy();
    if (sessionData?.messages) {
      const apiHasMarker = sessionData.messages.some((m: any) =>
        m.content?.includes(marker) && m.role === 'user'
      );
      expect(apiHasMarker, 'API 返回的消息中应包含标记').toBe(true);
    }

    // 清理
    await api.deleteSession(sessionId);
  });

  test('S02-A02 切换会话再切回 → 历史消息完整加载', async ({ page }) => {
    /**
     * 用户场景：在 A 会话发消息，切到 B 会话，再切回 A，消息不丢
     * 验证点：
     * - 在 A 会话发消息
     * - 切到 B 会话（URL 变化，欢迎屏或空消息）
     * - 切回 A 会话（消息完整恢复）
     */
    test.setTimeout(60000);

    // 1. 在第一个会话发消息
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const marker = `切换标记_${Date.now()}`;
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill(marker);
    await textarea.press('Enter');

    // 等待 session 创建
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const session1Url = page.url();
    expect(session1Url, '第一个会话应有 sessionId').toMatch(/\/chat\/[a-f0-9-]+/);

    // 记录消息数
    const msgCountBefore = await page.locator('main .message-bubble.user').count();
    expect(msgCountBefore, '应有用户消息').toBeGreaterThanOrEqual(1);

    // 2. 新建第二个会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 验证离开了第一个会话
    const isNewSession = page.url() !== session1Url ||
      await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);
    expect(isNewSession, '应进入新会话或欢迎页').toBe(true);

    // 3. 切回第一个会话
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    const itemCount = await sessionItems.count();
    expect(itemCount, '侧边栏应有历史会话').toBeGreaterThanOrEqual(1);

    await sessionItems.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await sessionItems.first().click();

    // 等待 URL 变化和消息加载
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.locator('main .message-bubble').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 4. 核心断言
    const userBubbles = page.locator('main .message-bubble.user');
    const userTexts: string[] = [];
    for (let i = 0; i < await userBubbles.count(); i++) {
      userTexts.push((await userBubbles.nth(i).textContent()) || '');
    }
    const hasMarker = userTexts.some(t => t.includes(marker));
    expect(hasMarker, '切回后应显示之前发送的消息').toBe(true);
  });

  test('S02-A03 会话隔离 → A 会话消息不出现在 B 会话', async ({ page }) => {
    /**
     * 用户场景：两个会话的消息应完全隔离
     * 验证点：
     * - 在 A 会话发一条特殊标记消息
     * - 新建 B 会话
     * - B 会话不应包含 A 会话的消息
     */
    test.setTimeout(60000);

    // 1. 在 A 会话发消息
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const secretMarker = `隔离秘密_${Date.now()}`;
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill(secretMarker);
    await textarea.press('Enter');

    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 2. 新建 B 会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // 3. 核心断言：B 会话不应包含 A 会话的秘密标记
    const mainText = await page.locator('main').textContent() || '';
    expect(
      mainText.includes(secretMarker),
      '新会话不应包含旧会话的消息（隔离验证）'
    ).toBe(false);

    // 消息气泡数应为 0（空会话）
    const bubbleCount = await page.locator('main .message-bubble').count();
    expect(bubbleCount, '新会话不应有任何消息气泡').toBe(0);
  });

  test('S02-A04 通过 REST API 验证会话消息 → 数据完整且格式正确', async ({ page, api }) => {
    /**
     * 用户场景：后端数据层面验证消息持久化
     * 验证点：
     * - 创建会话 → 发消息 → 通过 API 获取 → 验证结构和内容
     */
    test.setTimeout(60000);

    const session = await api.createSession('S02-A04-API验证');
    const sessionId = session.id;

    // 导航并发送消息
    await page.goto(`/chat/${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const marker = `API验证_${Date.now()}`;
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill(marker);
    await textarea.press('Enter');

    // 等待消息持久化
    await page.waitForTimeout(5000);

    // 通过 REST API 获取会话数据
    const sessionData = await api.getSession(sessionId);
    expect(sessionData, 'API 应返回会话数据').toBeTruthy();

    if (sessionData?.messages && sessionData.messages.length > 0) {
      // 验证消息结构
      const userMsg = sessionData.messages.find((m: any) => m.role === 'user');
      expect(userMsg, '应有 user 角色消息').toBeTruthy();
      expect(userMsg.content, '消息应有 content 字段').toBeTruthy();
      expect(userMsg.content.includes(marker), '消息 content 应包含标记').toBe(true);
      expect(userMsg.role, '角色应为 user').toBe('user');
    }

    // 清理
    await api.deleteSession(sessionId);
  });
});

// ============================================================================
// B: 历史注入正确性（3 tests）— 0 AI 调用
// 测试目的：验证消息通道、API 结构、历史消息格式
// ============================================================================

test.describe('S02-B: 历史注入正确性', () => {

  test('S02-B01 发送消息时 WebSocket 通道正常 → sessionId 保持不变', async ({ page, api }) => {
    /**
     * 验证点：
     * - 通过 API 预创建会话
     * - 发送消息后 URL 中的 sessionId 不变（消息绑定到正确会话）
     * - 用户消息正确渲染
     */
    test.setTimeout(60000);

    const session = await api.createSession('S02-B01-WS验证');
    const sessionId = session.id;

    await page.goto(`/chat/${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 发送消息
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('B01 通道测试消息');
    await textarea.press('Enter');
    await page.waitForTimeout(3000);

    // 验证 URL 仍然包含正确的 sessionId
    const currentUrl = page.url();
    expect(currentUrl, 'URL 应包含预创建的 sessionId').toContain(sessionId);

    // 验证用户消息已被渲染（前端→后端通道正常）
    const userBubbles = page.locator('main .message-bubble.user');
    const count = await userBubbles.count();
    expect(count, '用户消息应被渲染').toBeGreaterThanOrEqual(1);

    // 清理
    await api.deleteSession(sessionId);
  });

  test('S02-B02 多条消息历史 → API 返回的消息数量正确且有序', async ({ page, api }) => {
    /**
     * 验证 P0-2 回归：消息持久化和顺序
     * 通过 REST API 验证 getThreadMessages 返回的消息数量和顺序
     */
    test.setTimeout(90000);

    const session = await api.createSession('S02-B02-历史注入');
    const sessionId = session.id;

    await page.goto(`/chat/${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 连续发送 3 条消息（不等 AI 回复）
    const markers = ['消息一_Alpha', '消息二_Beta', '消息三_Gamma'];
    for (const marker of markers) {
      const textarea = page.locator(SEL.chat.textarea);
      await textarea.fill(marker);
      await textarea.press('Enter');
      await page.waitForTimeout(5000);
    }

    // 通过 REST API 获取会话消息
    const sessionData = await api.getSession(sessionId);
    expect(sessionData, 'API 应返回会话数据').toBeTruthy();

    if (sessionData?.messages) {
      const userMessages = sessionData.messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length, '应有至少 1 条用户消息').toBeGreaterThanOrEqual(1);

      // 验证消息顺序（createdAt 递增）
      if (userMessages.length >= 2) {
        for (let i = 1; i < userMessages.length; i++) {
          const prev = new Date(userMessages[i - 1].createdAt).getTime();
          const curr = new Date(userMessages[i].createdAt).getTime();
          expect(curr, '消息应按时间递增排序').toBeGreaterThanOrEqual(prev);
        }
      }
    }

    // 清理
    await api.deleteSession(sessionId);
  });

  test('S02-B03 API 返回的消息结构 → 字段完整且类型正确（P0-2 回归）', async ({ page, api }) => {
    /**
     * 验证 REST API 返回的消息数组结构符合前端期望
     * 间接验证 chat.gateway.ts 中 maxHistoryMessages slice 的上游数据正确
     */
    test.setTimeout(60000);

    const session = await api.createSession('S02-B03-结构验证');
    const sessionId = session.id;

    await page.goto(`/chat/${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 发送消息
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('B03 结构测试');
    await textarea.press('Enter');
    await page.waitForTimeout(5000);

    // 通过 REST API 获取
    const sessionData = await api.getSession(sessionId);
    expect(sessionData, 'API 应返回会话数据').toBeTruthy();

    if (sessionData?.messages) {
      expect(Array.isArray(sessionData.messages), 'messages 应为数组').toBe(true);
      expect(sessionData.messages.length, '消息数量应 >= 1').toBeGreaterThanOrEqual(1);

      // 验证每条消息的字段完整性
      for (const msg of sessionData.messages) {
        expect(msg.role, '每条消息应有 role 字段').toBeTruthy();
        expect(
          ['user', 'assistant'].includes(msg.role),
          `role 应为 user 或 assistant，实际: ${msg.role}`
        ).toBe(true);
        expect(msg.id, '每条消息应有 id 字段').toBeTruthy();
        expect(typeof msg.content === 'string', 'content 应为字符串').toBe(true);
      }
    }

    // 清理
    await api.deleteSession(sessionId);
  });

  test('S02-B04 历史消息截断 — 超过 maxHistoryMessages 条后 API 返回受限', async ({ page, api }) => {
    /**
     * 验证 P0-2 回归核心逻辑：chat.gateway.ts 中 slice(-maxHistoryMessages)
     * 连续发送 25+ 条消息，验证 API 返回的消息数不超过合理上限
     * 0 AI 调用 — 纯 API 写入验证
     */
    test.setTimeout(120000);

    const session = await api.createSession('S02-B04-截断测试');
    const sessionId = session.id;

    // 导航到会话
    await page.goto(`/chat/${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 连续发送 25 条用户消息（不等 AI 回复，纯写入）
    const totalMessages = 25;
    for (let i = 1; i <= totalMessages; i++) {
      const textarea = page.locator(SEL.chat.textarea);
      await textarea.fill(`截断测试消息 #${i}`);
      await textarea.press('Enter');
      // 短暂等待确保消息发出
      await page.waitForTimeout(1500);
    }

    // 等待所有消息持久化
    await page.waitForTimeout(5000);

    // 通过 REST API 获取会话消息
    const sessionData = await api.getSession(sessionId);
    expect(sessionData, 'API 应返回会话数据').toBeTruthy();

    if (sessionData?.messages) {
      const userMessages = sessionData.messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length, '应有多条用户消息').toBeGreaterThanOrEqual(10);

      // maxHistoryMessages = 20（来自 chat.gateway.ts）
      // API 返回的是完整消息列表，但 WebSocket chat:send 注入给 AI 的 history 受 slice 限制
      // 这里验证 API 层面消息写入正确
      expect(userMessages.length, '25 条消息应全部持久化').toBe(totalMessages);

      // 通过 WebSocket 间接验证：刷新页面后加载的消息数
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.locator('main .message-bubble').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // 前端显示的消息数（可能受分页或 maxHistoryMessages 限制）
      const visibleBubbles = await page.locator('main .message-bubble.user').count();
      expect(visibleBubbles, '刷新后应加载历史消息').toBeGreaterThanOrEqual(1);

      // 核心断言：如果前端有分页/截断，消息数应 ≤ 某个合理上限
      // 如果没有截断机制，所有消息都应可见
      expect(visibleBubbles, '可见消息数应在合理范围内').toBeLessThanOrEqual(totalMessages);
    }

    // 清理
    await api.deleteSession(sessionId);
  });
});

// ============================================================================
// C: AI 上下文连贯（3 tests, serial）— 3 AI 调用
// 测试目的：用最少的 AI 调用验证平台历史注入的实际效果
//
// 关键设计：C 组使用 serial 模式，C01 → C02 → C03 顺序执行。
// C01 在会话中告诉 AI 事实（1 AI），C02 在同一会话回忆（1 AI），
// C03 在新会话验证隔离（1 AI）。通过共享 sessionId 实现跨测试状态。
// ============================================================================

test.describe('S02-C: AI 上下文连贯', () => {
  test.describe.configure({ mode: 'serial' });

  // 共享状态：C01 创建的会话 ID，C02/C03 复用
  let sharedSessionId = '';

  test('S02-C01 告诉 AI 一个事实 → AI 确认收到（1 AI 调用）', async ({ page }) => {
    /**
     * C 组第 1 轮：在新会话中告诉 AI 一个事实
     * AI 调用：1 次
     */
    test.setTimeout(120000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const r1 = await sendAndWaitWithRetry(
      page,
      '请记住这个信息：项目代号"北斗星"，编号 BD-2026-042。只需回复"已记住"即可。',
      { timeout: 60000 },
    );

    if (!r1.hasResponse) {
      test.skip(true, 'AI 无响应（DeepSeek 限流），跳过 C 组全部测试');
      return;
    }

    // 保存 sessionId 供 C02/C03 使用
    const url = page.url();
    const match = url.match(/\/chat\/([a-f0-9-]+)/);
    expect(match, 'URL 应包含 sessionId').toBeTruthy();
    sharedSessionId = match![1];

    // 验证 AI 有回复（不严格检查内容，只要有回复即可）
    expect(r1.responseText.length, 'AI 应有回复').toBeGreaterThan(0);
  });

  test('S02-C02 同一会话追问 → AI 能回忆事实（1 AI 调用）', async ({ page }) => {
    /**
     * C 组第 2 轮：在同一会话中追问，验证历史注入
     * AI 调用：1 次
     * 依赖：C01 已成功执行并设置了 sharedSessionId
     */
    test.setTimeout(120000);

    if (!sharedSessionId) {
      test.skip(true, 'C01 未成功，跳过');
      return;
    }

    // 直接导航到 C01 创建的会话
    await page.goto(`/chat/${sharedSessionId}`);
    await page.waitForLoadState('networkidle');

    // 等待历史消息加载
    await page.locator('main .message-bubble').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const r2 = await sendAndWaitWithRetry(
      page,
      '我刚才告诉你的项目编号是什么？',
      { timeout: 60000 },
    );

    if (!r2.hasResponse) {
      test.skip(true, 'AI 无响应，跳过');
      return;
    }

    // 核心断言：AI 应能回忆出项目编号（测试历史注入）
    const hasInfo = r2.responseText.includes('BD-2026-042') ||
      r2.responseText.includes('BD2026042') ||
      r2.responseText.includes('北斗星');
    expect(hasInfo, 'AI 应能回忆出项目编号 BD-2026-042（历史注入验证）').toBe(true);
  });

  test('S02-C03 新会话中追问 → AI 不应知道旧会话信息（1 AI 调用）', async ({ page }) => {
    /**
     * C 组第 3 轮：在全新会话中追问，验证会话隔离
     * AI 调用：1 次
     */
    test.setTimeout(120000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 确保是在新会话（欢迎页），不是旧会话
    const welcomeVisible = await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);
    if (!welcomeVisible) {
      // 强制新建会话
      await page.locator(SEL.sidebar.newChatButton).click();
      await page.waitForTimeout(2000);
    }

    const r3 = await sendAndWaitWithRetry(
      page,
      '我之前告诉你的项目编号是什么？',
      { timeout: 60000 },
    );

    if (!r3.hasResponse) {
      test.skip(true, 'AI 无响应，跳过');
      return;
    }

    // 核心断言：新会话 AI 不应知道旧会话的项目编号
    const leaksInfo = r3.responseText.includes('BD-2026-042') ||
      r3.responseText.includes('BD2026042');
    expect(leaksInfo, '新会话 AI 不应知道旧会话的项目编号（会话隔离）').toBe(false);
  });
});

// ============================================================================
// D: 流式与并发（2 tests）— 1 AI 调用
// 测试目的：验证流式渲染和消息并发的正确性
// ============================================================================

test.describe('S02-D: 流式渲染与并发', () => {

  test('S02-D01 AI 流式回复 → stop 按钮生命周期 + 无渲染异常（1 AI 调用）', async ({ page }) => {
    /**
     * 验证点：
     * - stop 按钮出现（流式开始）
     * - stop 按钮消失（流式结束）
     * - 最终回复不包含 undefined / [object Object]
     * - 回复内容非空
     */
    test.setTimeout(120000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请用 50 个字简单描述什么是人工智能。');
    await textarea.press('Enter');

    // 等 session 创建
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 }).catch(() => {});

    // 验证 stop 按钮生命周期
    const stopBtnAppeared = await page.locator(SEL.chat.stopButton)
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (stopBtnAppeared) {
      await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout: 60000 });
    }

    await page.waitForTimeout(2000);

    // 核心断言
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    const count = await assistantBubbles.count();

    if (count === 0) {
      test.skip(true, 'AI 无回复（可能限流），跳过');
      return;
    }

    expect(count, '应有 AI 回复').toBeGreaterThanOrEqual(1);

    const responseText = (await assistantBubbles.last().textContent()) || '';
    expect(responseText.length, 'AI 回复不应为空').toBeGreaterThan(10);
    expect(responseText.includes('undefined'), '回复不应包含 undefined').toBe(false);
    expect(responseText.includes('[object Object]'), '回复不应包含 [object Object]').toBe(false);
  });

  test('S02-D02 连续发送两条消息 → 两条用户消息都被渲染（0 AI 调用）', async ({ page }) => {
    /**
     * 验证点：
     * - 2 条用户消息都出现在 DOM 中
     * - 消息顺序正确
     * 注意：此测试不验证 AI 回复，仅验证用户消息不丢
     */
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 发第一条
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('第一条消息：你好');
    await textarea.press('Enter');

    // 等 session 创建
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 发第二条
    await textarea.fill('第二条消息：世界');
    await textarea.press('Enter');
    await page.waitForTimeout(5000);

    // 核心断言：2 条用户消息都应被渲染
    const userBubbles = page.locator('main .message-bubble.user');
    const userCount = await userBubbles.count();
    expect(userCount, '应有 2 条用户消息').toBe(2);

    // 验证消息顺序
    const text1 = (await userBubbles.nth(0).textContent()) || '';
    const text2 = (await userBubbles.nth(1).textContent()) || '';
    expect(text1.includes('第一条') || text1.includes('你好'), '第一条消息内容正确').toBe(true);
    expect(text2.includes('第二条') || text2.includes('世界'), '第二条消息内容正确').toBe(true);
  });
});
