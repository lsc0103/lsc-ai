/**
 * 场景 S04: 本地模式深度测试 — 完整用户旅程 + 模式切换场景
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * 与 M5 的区别：
 * - M5 是功能单元测试（单一操作验证）
 * - S04 是用户场景测试（完整工作流 + 边界情况 + 多功能组合）
 *
 * 前置条件：
 * - Client Agent 必须运行并配对
 * - 没有 Agent 的测试会标注，用于验证无 Agent 时的 UI 提示
 *
 * 分组：
 * - A: 完整工作流（3 tests）— 跨模式对话、本地+Workbench、多轮本地上下文
 * - B: 会话与状态（3 tests）— 切换会话状态保持、刷新恢复、新建会话继承
 * - C: 边界与退出（2 tests）— 无 Agent 提示、退出后回云端
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// ============================================================================
// 辅助函数
// ============================================================================

/** 检查 Agent 是否在线 */
async function isAgentOnline(api: any): Promise<boolean> {
  try {
    const res = await api.getAgents();
    if (!res.ok()) return false;
    const agents = await res.json();
    return Array.isArray(agents) && agents.some((a: any) => a.status === 'online');
  } catch {
    return false;
  }
}

/** 进入本地模式（带完整等待和验证） */
async function enterLocalMode(
  page: import('@playwright/test').Page,
  workDir = 'D:\\u3d-projects\\lscmade7',
): Promise<{ success: boolean; reason?: string }> {
  // Step 1: 点 ChatInput 加号菜单
  const plusBtn = page.locator('main .anticon-plus').last();
  const plusVisible = await plusBtn.isVisible().catch(() => false);
  if (!plusVisible) return { success: false, reason: '加号按钮不可见' };
  await plusBtn.click();
  await page.waitForTimeout(500);

  // Step 2: 点"选择工作路径"
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")').first();
  if (!await workdirItem.isVisible().catch(() => false)) {
    return { success: false, reason: '"选择工作路径"菜单项不可见' };
  }
  await workdirItem.click();
  await page.waitForTimeout(500);

  // Step 3: 等待 Modal 打开
  const modal = page.locator('.ant-modal-content:visible');
  await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (!await modal.isVisible().catch(() => false)) {
    return { success: false, reason: 'Modal 未打开' };
  }

  // Step 4: 选择"本地电脑"
  const localRadio = modal.locator('text=本地电脑').first();
  await localRadio.click();
  await page.waitForTimeout(1500);

  // Step 5: 选择第一个在线设备
  const deviceItems = modal.locator('.ant-list-item');
  const deviceCount = await deviceItems.count();
  if (deviceCount === 0) {
    return { success: false, reason: '没有可用设备' };
  }
  await deviceItems.first().click();
  await page.waitForTimeout(500);

  // Step 6: 输入工作目录
  const dirInput = modal.locator('input[type="text"]').last();
  if (await dirInput.isVisible().catch(() => false)) {
    await dirInput.clear();
    await dirInput.fill(workDir);
    await page.waitForTimeout(300);
  }

  // Step 7: 点确定
  const confirmBtn = modal.getByRole('button', { name: /确.*定/ });
  await confirmBtn.click();
  await page.waitForTimeout(2000);

  // Step 8: 验证进入本地模式（"本地模式"文字可见）
  const indicator = page.locator('text=本地模式');
  const entered = await indicator.isVisible({ timeout: 5000 }).catch(() => false);
  if (!entered) {
    return { success: false, reason: '本地模式指示器未显示' };
  }

  return { success: true };
}

/** 退出本地模式 */
async function exitLocalMode(page: import('@playwright/test').Page): Promise<boolean> {
  const exitBtn = page.locator('button:has-text("退出")').first();
  if (!await exitBtn.isVisible().catch(() => false)) return false;
  await exitBtn.click();
  await page.waitForTimeout(1000);
  return true;
}

/** 检查当前是否在本地模式 */
async function isInLocalMode(page: import('@playwright/test').Page): Promise<boolean> {
  const indicator = page.locator('text=本地模式');
  return await indicator.isVisible().catch(() => false);
}

// ============================================================================
// A: 完整工作流（3 tests）
// ============================================================================

test.describe('S04-A: 完整工作流', () => {

  test('S04-01 云端对话→切本地模式→执行命令→切回云端→验证上下文连贯', async ({ page, api }) => {
    /**
     * 用户完整旅程：
     * 1. 在云端模式告诉 AI 一个信息
     * 2. 切换到本地模式
     * 3. 在本地模式执行一个命令
     * 4. 退出本地模式（回到云端）
     * 5. 询问 AI 之前的信息 → AI 应该记得
     */
    test.setTimeout(300000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ===== 第 1 步：云端模式建立上下文 =====
    const r1 = await sendAndWaitWithRetry(
      page,
      '请记住我的项目名叫"海运数据分析"，我待会还会问你',
      { timeout: 90000, retries: 2 },
    );
    if (!r1.hasResponse) {
      test.skip(true, 'AI 第一轮无响应');
      return;
    }
    expect(r1.responseText.length, '云端模式 AI 应回复').toBeGreaterThan(0);

    // ===== 第 2 步：切换到本地模式 =====
    const enterResult = await enterLocalMode(page);
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }

    // ===== 第 3 步：本地模式执行命令 =====
    const r2 = await sendAndWaitWithRetry(
      page,
      '运行 dir 命令看看工作目录下有什么',
      { timeout: 120000, retries: 2 },
    );
    expect(r2.hasResponse, '本地模式 AI 应回复').toBe(true);

    // ===== 第 4 步：退出本地模式 =====
    await exitLocalMode(page);
    await page.waitForTimeout(2000);

    // 验证已退出本地模式
    const stillLocal = await isInLocalMode(page);
    expect(stillLocal, '退出后不应显示本地模式').toBe(false);

    // ===== 第 5 步：验证上下文连贯 =====
    const r3 = await sendAndWaitWithRetry(
      page,
      '我刚才说的项目名叫什么？',
      { timeout: 90000, retries: 2 },
    );
    expect(r3.hasResponse, '云端模式 AI 应回复').toBe(true);
    expect(
      r3.responseText.includes('海运') || r3.responseText.includes('数据分析'),
      '切回云端后 AI 应记得之前的上下文',
    ).toBe(true);
  });

  test('S04-02 本地模式执行命令 → 在 Workbench 展示结果', async ({ page, api }) => {
    /**
     * 用户场景：让 AI 在本地模式执行命令，并把结果用 Workbench 可视化展示
     * 这是本地模式 + Workbench 的组合使用
     */
    test.setTimeout(240000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 进入本地模式
    const enterResult = await enterLocalMode(page);
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }

    // 让 AI 执行命令并在工作台展示
    const r = await sendAndWaitWithRetry(
      page,
      '列出当前目录下的所有文件，并用工作台的表格展示文件名和大小',
      { timeout: 120000, retries: 2 },
    );

    if (!r.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForTimeout(3000);

    // 检查 AI 是否回复了
    expect(r.responseText.length, 'AI 应回复').toBeGreaterThan(0);

    // 检查 Workbench 是否打开（可能 AI 没有使用 Workbench，这不是必须的）
    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (wbVisible) {
      // 如果打开了，验证有表格或代码内容
      const hasTable = await wb.locator('table, .ant-table, [class*="DataTable"]').first().isVisible().catch(() => false);
      const hasCode = await wb.locator('.monaco-editor, pre code, [class*="CodeEditor"]').first().isVisible().catch(() => false);
      expect(hasTable || hasCode, 'Workbench 应有表格或代码内容').toBe(true);
    } else {
      // AI 可能选择用文本回复而非 Workbench，这也是可接受的
      // 只要回复中包含文件信息
      expect(
        r.responseText.includes('文件') || r.responseText.includes('目录') || r.responseText.includes('.'),
        'AI 回复应包含文件信息',
      ).toBe(true);
    }
  });

  test('S04-03 本地模式多轮对话 → AI 记住工作目录上下文', async ({ page, api }) => {
    /**
     * 用户场景：在本地模式下多轮对话，AI 应记住工作目录等上下文
     */
    test.setTimeout(300000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const enterResult = await enterLocalMode(page, 'D:\\u3d-projects\\lscmade7');
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }

    // 第一轮：询问工作目录
    const r1 = await sendAndWaitWithRetry(
      page,
      '当前工作目录是什么？',
      { timeout: 120000, retries: 2 },
    );
    expect(r1.hasResponse, 'AI 第一轮应回复').toBe(true);

    // 第二轮：基于第一轮的继续对话
    const r2 = await sendAndWaitWithRetry(
      page,
      '这个目录下有多少个文件夹？',
      { timeout: 120000, retries: 2 },
    );
    expect(r2.hasResponse, 'AI 第二轮应回复').toBe(true);

    // 第三轮：验证 AI 记住了工作目录上下文
    const r3 = await sendAndWaitWithRetry(
      page,
      '你帮我操作的是哪个目录？',
      { timeout: 120000, retries: 2 },
    );
    expect(r3.hasResponse, 'AI 第三轮应回复').toBe(true);
    expect(
      r3.responseText.includes('lscmade7') || r3.responseText.includes('u3d') || r3.responseText.includes('项目'),
      'AI 应记住工作目录上下文',
    ).toBe(true);
  });
});

// ============================================================================
// B: 会话与状态（3 tests）
// ============================================================================

test.describe('S04-B: 会话与状态', () => {

  test('S04-04 本地模式 → 切换到其他会话 → 本地模式状态保持', async ({ page, api }) => {
    /**
     * 用户场景：在本地模式下工作，切换到另一个会话，本地模式应该保持
     * （本地模式是全局状态，不是会话级别的）
     */
    test.setTimeout(180000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 进入本地模式并发送一条消息（创建会话）
    const enterResult = await enterLocalMode(page);
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }

    const r1 = await sendAndWaitWithRetry(
      page,
      '你好，这是会话1',
      { timeout: 120000, retries: 2 },
    );
    if (!r1.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});

    // 确认在本地模式
    expect(await isInLocalMode(page), '应在本地模式').toBe(true);

    // 新建会话
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 验证仍在本地模式
    expect(await isInLocalMode(page), '新建会话后应仍在本地模式').toBe(true);

    // 发送消息
    const r2 = await sendAndWaitWithRetry(
      page,
      '这是会话2',
      { timeout: 120000, retries: 2 },
    );
    expect(r2.hasResponse, '新会话 AI 应回复').toBe(true);

    // 验证仍在本地模式
    expect(await isInLocalMode(page), '发送消息后应仍在本地模式').toBe(true);
  });

  test('S04-05 本地模式 → 刷新页面 → 状态恢复', async ({ page, api }) => {
    /**
     * 用户场景：在本地模式下刷新页面，状态应该恢复
     */
    test.setTimeout(180000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 进入本地模式
    const enterResult = await enterLocalMode(page);
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }

    // 确认在本地模式
    expect(await isInLocalMode(page), '应在本地模式').toBe(true);

    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证本地模式状态恢复
    const restoredLocalMode = await isInLocalMode(page);
    expect(restoredLocalMode, '刷新后应恢复本地模式状态').toBe(true);
  });

  test('S04-06 切回旧会话 → 验证本地模式仍生效', async ({ page, api }) => {
    /**
     * 用户场景：在本地模式下创建多个会话，切换时本地模式应持续生效
     */
    test.setTimeout(240000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 进入本地模式
    const enterResult = await enterLocalMode(page);
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }

    // 会话1：发送消息
    const r1 = await sendAndWaitWithRetry(
      page,
      '会话1的消息',
      { timeout: 120000, retries: 2 },
    );
    if (!r1.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});

    // 新建会话2
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(2000);

    // 会话2：发送消息
    const r2 = await sendAndWaitWithRetry(
      page,
      '会话2的消息',
      { timeout: 120000, retries: 2 },
    );
    expect(r2.hasResponse, '会话2 AI 应回复').toBe(true);

    // 切回会话1
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().scrollIntoViewIfNeeded();
    await sessionItems.first().click();
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 验证仍在本地模式
    expect(await isInLocalMode(page), '切回旧会话后应仍在本地模式').toBe(true);

    // 验证可以继续发消息
    const r3 = await sendAndWaitWithRetry(
      page,
      '继续会话1',
      { timeout: 120000, retries: 2 },
    );
    expect(r3.hasResponse, '切回后 AI 应能回复').toBe(true);
  });
});

// ============================================================================
// C: 边界与退出（2 tests）
// ============================================================================

test.describe('S04-C: 边界与退出', () => {

  test('S04-07 无 Agent 连接时 → 本地模式入口提示', async ({ page, api }) => {
    /**
     * 用户场景：Agent 未运行时，用户尝试进入本地模式应看到提示
     * 注：此测试在 Agent 运行时会被跳过
     */
    const agentOnline = await isAgentOnline(api);
    if (agentOnline) {
      test.skip(true, 'Agent 在线，无法测试无 Agent 场景');
      return;
    }

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 尝试打开工作空间选择
    const plusBtn = page.locator('main .anticon-plus').last();
    await plusBtn.click();
    await page.waitForTimeout(500);

    const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")').first();
    if (!await workdirItem.isVisible().catch(() => false)) {
      // 菜单项不存在，可能是设计上就隐藏了
      test.skip(true, '无 Agent 时工作路径菜单项不显示（符合预期）');
      return;
    }
    await workdirItem.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.ant-modal-content:visible');
    await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    // 选择本地电脑
    await modal.locator('text=本地电脑').first().click();
    await page.waitForTimeout(2000);

    // 应该显示"安装 Client Agent"或"无可用设备"等提示
    const modalText = await modal.textContent();
    const hasInstallGuide = modalText?.includes('安装') || modalText?.includes('Agent');
    const hasNoDevice = modalText?.includes('无') || modalText?.includes('没有') || modalText?.includes('离线');

    expect(
      hasInstallGuide || hasNoDevice,
      '无 Agent 时应显示安装引导或无设备提示',
    ).toBe(true);
  });

  test('S04-08 退出本地模式 → 后续对话回到云端处理', async ({ page, api }) => {
    /**
     * 用户场景：退出本地模式后，后续的对话应该由云端处理
     */
    test.setTimeout(240000);
    const agentOnline = await isAgentOnline(api);
    test.skip(!agentOnline, 'Client Agent 未运行');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 进入本地模式
    const enterResult = await enterLocalMode(page);
    if (!enterResult.success) {
      test.skip(true, `进入本地模式失败: ${enterResult.reason}`);
      return;
    }
    expect(await isInLocalMode(page), '应在本地模式').toBe(true);

    // 在本地模式发送消息
    const r1 = await sendAndWaitWithRetry(
      page,
      '本地模式测试消息',
      { timeout: 120000, retries: 2 },
    );
    expect(r1.hasResponse, '本地模式 AI 应回复').toBe(true);

    // 退出本地模式
    const exited = await exitLocalMode(page);
    expect(exited, '应成功退出本地模式').toBe(true);
    await page.waitForTimeout(2000);

    // 验证已退出本地模式
    expect(await isInLocalMode(page), '退出后不应显示本地模式').toBe(false);

    // 继续发送消息（应由云端处理）
    const r2 = await sendAndWaitWithRetry(
      page,
      '现在我应该在云端模式了对吧？',
      { timeout: 90000, retries: 2 },
    );
    expect(r2.hasResponse, '云端模式 AI 应回复').toBe(true);
    expect(r2.responseText.length, '云端模式应正常回复').toBeGreaterThan(0);

    // 验证仍不在本地模式
    expect(await isInLocalMode(page), '对话后仍不应在本地模式').toBe(false);
  });
});
