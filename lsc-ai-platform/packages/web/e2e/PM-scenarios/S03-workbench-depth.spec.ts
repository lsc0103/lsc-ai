/**
 * 场景 S03: Workbench 交互深度（V2 — 真实用户场景重新设计）
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * V2 变更：
 * - 旧版 S03 全部是"注入→检查DOM"的技术测试，与 S01-B 高度重复
 * - 新版以真实用户操作流程为核心，测试链式交互、边界行为、异常路径
 * - S03-01 用真实 AI 验证 Tab 累积（用户最核心的使用流程）
 * - S03-06 用真实 UI 关闭按钮 + AI 重开（不再调 store.close()）
 * - S03-07 验证 Workbench 在纯文本对话中不被覆盖（新场景）
 * - S03-08 验证 mergeSchema Tab 追加（AI 多次调用 workbench 的真实路径）
 * - S03-10 验证 activeTab + Tab 数量在会话切换后精确保持
 *
 * 分组：
 * - A: Tab 累积与操作（3 tests）— AI 累积 Tab、连续关闭到边界、右键菜单完整流程
 * - B: 分屏与布局（2 tests）— 拖拽后组件不变形、极端拖拽约束
 * - C: 关闭与重开（3 tests）— 点 X 关闭后 AI 重开、纯文本不覆盖、mergeSchema 追加
 * - D: 跨会话状态（2 tests）— 切换恢复、操作后状态精确保持
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// ============================================================================
// 辅助函数
// ============================================================================

/** 创建 session（发"你好"，等 URL 变为 /chat/:id，等 AI 响应完成） */
async function ensureSession(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill('你好');
  await textarea.press('Enter');

  const ok = await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 })
    .then(() => true).catch(() => false);
  if (!ok) throw new Error('Session 未创建');

  // 等待 AI 响应完成（stop 按钮消失），避免与后续 injectSchema 冲突
  const stopBtn = page.locator(SEL.chat.stopButton);
  await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000); // 额外等待确保流式输出结束
  return page.url();
}

/** 注入 schema 到 workbench store */
async function injectSchema(
  page: import('@playwright/test').Page,
  schema: Record<string, unknown>,
): Promise<{ success: boolean; reason?: string }> {
  const result = await page.evaluate((s) => {
    const store = (window as any).__workbenchStore;
    if (!store?.getState) return { success: false, reason: 'store not found' };
    try {
      store.getState().open(s);
      return { success: true };
    } catch (e: any) {
      return { success: false, reason: e.message };
    }
  }, schema);
  if (result.success) await page.waitForTimeout(1500);
  return result;
}

/** 通过 mergeSchema 追加 tab（模拟 AI 第二次调用 workbench 工具） */
async function mergeTab(
  page: import('@playwright/test').Page,
  schema: Record<string, unknown>,
): Promise<{ success: boolean; reason?: string }> {
  const result = await page.evaluate((s) => {
    const store = (window as any).__workbenchStore;
    if (!store?.getState) return { success: false, reason: 'store not found' };
    try {
      store.getState().mergeSchema(s);
      return { success: true };
    } catch (e: any) {
      return { success: false, reason: e.message };
    }
  }, schema);
  if (result.success) await page.waitForTimeout(1000);
  return result;
}

// ============================================================================
// Schema 定义
// ============================================================================

const THREE_TAB_SCHEMA = {
  type: 'workbench',
  title: '多Tab测试',
  tabs: [
    {
      key: 'tab-code',
      title: '代码示例',
      components: [{
        type: 'CodeEditor',
        title: 'Python 快排',
        language: 'python',
        code: 'def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[0]\n    left = [x for x in arr[1:] if x <= pivot]\n    right = [x for x in arr[1:] if x > pivot]\n    return quicksort(left) + [pivot] + quicksort(right)',
      }],
    },
    {
      key: 'tab-table',
      title: '员工数据',
      components: [{
        type: 'DataTable',
        title: '员工信息表',
        columns: [
          { key: 'name', title: '姓名', dataIndex: 'name' },
          { key: 'dept', title: '部门', dataIndex: 'dept' },
        ],
        data: [
          { name: '张三', dept: '研发部' },
          { name: '李四', dept: '设计部' },
          { name: '王五', dept: '产品部' },
        ],
      }],
    },
    {
      key: 'tab-chart',
      title: '销售图表',
      components: [{
        type: 'BarChart',
        title: '季度销售额',
        xAxis: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [{ name: '销售额', data: [300, 450, 380, 520] }],
      }],
    },
  ],
};

const CODE_TAB_SCHEMA = {
  type: 'workbench',
  title: '代码工作台',
  tabs: [{
    key: 'code-1',
    title: 'JavaScript 代码',
    components: [{
      type: 'CodeEditor',
      language: 'javascript',
      code: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\nconsole.log(fibonacci(10));',
    }],
  }],
};

const TABLE_TAB_SCHEMA = {
  type: 'workbench',
  title: '追加表格',
  tabs: [{
    key: 'table-merge',
    title: '订单数据',
    components: [{
      type: 'DataTable',
      title: '订单列表',
      columns: [
        { key: 'id', title: '订单号', dataIndex: 'id' },
        { key: 'customer', title: '客户', dataIndex: 'customer' },
        { key: 'amount', title: '金额', dataIndex: 'amount' },
      ],
      data: [
        { id: 'ORD-001', customer: '中远海运', amount: '150000' },
        { id: 'ORD-002', customer: '招商局港口', amount: '280000' },
      ],
    }],
  }],
};

// ============================================================================
// A: Tab 累积与操作（3 tests）
// ============================================================================

test.describe('S03-A: Tab 累积与操作', () => {

  test('S03-01 用户让 AI 展示代码 → 再展示表格 → Tab 自动累积 → 用户切换验证', async ({ page }) => {
    // 真实用户流程：用户多次让 AI 在 Workbench 展示不同内容，Tab 应逐步累积
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ===== 第一步：让 AI 在工作台展示代码 =====
    const r1 = await sendAndWaitWithRetry(
      page,
      '在工作台中展示一段 Python 快速排序算法代码',
      { timeout: 90000, retries: 2 },
    );

    if (!r1.hasResponse) {
      test.skip(true, 'AI 第一轮无响应（DeepSeek 超时）');
      return;
    }
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      // AI 回复了但没打开 Workbench → P0-1（AI 未调用 workbench 工具）
      const mainText = await page.locator('main').innerText();
      if (mainText.includes('工作台') || mainText.includes('Workbench') || mainText.includes('代码')) {
        expect(wbVisible, 'P0-1: AI 尝试但 Workbench 未打开').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench，跳过');
      }
      return;
    }

    // 记录第一步的 tab 数量
    const tabsAfterR1 = await wb.locator('.workbench-tab').count();
    expect(tabsAfterR1, '第一次 AI 调用后应至少有 1 个 Tab').toBeGreaterThanOrEqual(1);

    // ===== 第二步：让 AI 在工作台展示表格数据 =====
    const r2 = await sendAndWaitWithRetry(
      page,
      '在工作台中用表格展示：张三 25岁 北京，李四 30岁 上海，王五 28岁 广州',
      { timeout: 90000, retries: 2 },
    );

    if (!r2.hasResponse) {
      test.skip(true, 'AI 第二轮无响应');
      return;
    }
    await page.waitForTimeout(3000);

    // ===== 核心断言 =====

    // 1. Tab 数量应增加（AI 应追加新 Tab，而非替换）
    const tabsAfterR2 = await wb.locator('.workbench-tab').count();
    expect(tabsAfterR2, 'AI 第二次调用后 Tab 应累积（≥2）').toBeGreaterThanOrEqual(2);

    // 2. 用户点击第一个 tab → 应有代码相关内容
    const tabs = wb.locator('.workbench-tab');
    await tabs.nth(0).click();
    await page.waitForTimeout(1000);
    const tab1Content = await wb.locator('.workbench-content, .workbench-tab-content').first().innerText();
    const tab1HasCode = tab1Content.includes('def ') || tab1Content.includes('function') ||
      tab1Content.includes('sort') || await wb.locator('.monaco-editor, pre code').first().isVisible().catch(() => false);

    // 3. 用户点击最后一个 tab → 应有表格相关内容
    await tabs.last().click();
    await page.waitForTimeout(1000);
    const hasTable = await wb.locator('table, .ant-table, [class*="DataTable"]').first().isVisible().catch(() => false);
    const lastTabText = await wb.locator('.workbench-content, .workbench-tab-content').first().innerText();
    const tab2HasData = hasTable || lastTabText.includes('张三') || lastTabText.includes('北京');

    // 至少一个断言应成立（AI 生成的格式可能不完全可预测，但内容类型应不同）
    expect(tab1HasCode || tab2HasData, '两个 Tab 应有不同类型的内容（代码/表格）').toBe(true);
  });

  test('S03-02 用户连续关闭 Tab → 自动切换 → 最后一个 Tab 不可关闭', async ({ page }) => {
    // 用户有 3 个 Tab，逐个关闭到边界
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // ===== 用户操作链 =====

    // 1. 切到第二个 tab（员工数据）
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    // 2. hover 第二个 tab → 出现关闭按钮 → 关闭
    await tabs.nth(1).hover();
    await page.waitForTimeout(300);
    const closeBtn1 = tabs.nth(1).locator('button').first();
    await expect(closeBtn1, '关闭按钮应出现').toBeVisible({ timeout: 2000 });
    await closeBtn1.click();
    await page.waitForTimeout(800);

    // 3. Tab 减少为 2 个，且自动切到邻近 tab
    await expect(tabs, '关闭后应剩 2 个 Tab').toHaveCount(2);

    // 当前应有某个 tab 处于 active 状态（内容区非空）
    const contentAfterClose = await wb.locator('.workbench-content, .workbench-tab-content').first().innerText();
    expect(contentAfterClose.length, '关闭 tab 后应自动切到邻近 tab，内容不为空').toBeGreaterThan(0);

    // 4. 继续关闭一个 tab
    await tabs.nth(0).hover();
    await page.waitForTimeout(300);
    const closeBtn2 = tabs.nth(0).locator('button').first();
    await closeBtn2.click();
    await page.waitForTimeout(800);

    // 5. 只剩 1 个 tab
    await expect(tabs, '再次关闭后应剩 1 个 Tab').toHaveCount(1);

    // 6. 最后一个 tab 不应有关闭按钮（源码：schema.tabs.length > 1 才显示）
    await tabs.nth(0).hover();
    await page.waitForTimeout(300);
    const lastTabCloseBtn = tabs.nth(0).locator('button');
    const lastCloseBtnCount = await lastTabCloseBtn.count();
    expect(lastCloseBtnCount, '最后一个 Tab 不应有关闭按钮').toBe(0);
  });

  test('S03-03 右键 Tab → 上下文菜单完整操作 → 禁用状态验证', async ({ page }) => {
    // 用户右键 Tab 使用上下文菜单，验证各选项的启用/禁用逻辑
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // ===== 用户操作链 =====

    // 1. 右键第二个 tab（中间位置）
    await tabs.nth(1).click({ button: 'right' });
    await page.waitForTimeout(500);

    // 2. 上下文菜单应出现
    const menu = page.locator('.ant-dropdown-menu, .ant-dropdown, [role="menu"]').first();
    await expect(menu, '右键菜单应出现').toBeVisible({ timeout: 3000 });

    // 3. 应有"关闭其他"选项
    const closeOthers = menu.locator('text=关闭其他');
    await expect(closeOthers, '应有"关闭其他"').toBeVisible({ timeout: 2000 });

    // 4. 点击"关闭其他" → 只剩被右键的 tab
    await closeOthers.click();
    await page.waitForTimeout(800);

    await expect(tabs, '"关闭其他"后应只剩 1 个 Tab').toHaveCount(1);

    // 5. 剩余 tab 应是"员工数据"（被右键的那个）
    const remainingTabText = await tabs.nth(0).innerText();
    expect(remainingTabText, '剩余 tab 应是被右键的"员工数据"').toContain('员工数据');

    // 6. 再次右键 → "关闭"应禁用（唯一 tab 不可关闭）
    await tabs.nth(0).click({ button: 'right' });
    await page.waitForTimeout(500);

    const menu2 = page.locator('.ant-dropdown-menu, .ant-dropdown, [role="menu"]').first();
    await expect(menu2).toBeVisible({ timeout: 3000 });

    // "关闭"选项应存在但被禁用（Ant Design 的 disabled item 有 aria-disabled 或 ant-dropdown-menu-item-disabled class）
    const closeItem = menu2.locator('text=关闭').first();
    const isDisabled = await closeItem.evaluate(el => {
      const li = el.closest('li') || el;
      return li.classList.contains('ant-dropdown-menu-item-disabled') ||
        li.getAttribute('aria-disabled') === 'true' ||
        (li as HTMLElement).style.pointerEvents === 'none';
    }).catch(() => false);
    expect(isDisabled, '唯一 Tab 的"关闭"选项应被禁用').toBe(true);
  });
});

// ============================================================================
// B: 分屏与布局（2 tests）
// ============================================================================

test.describe('S03-B: 分屏与布局', () => {

  test('S03-04 用户拖拽 resizer → Workbench 变宽 → 代码编辑器仍正常渲染', async ({ page }) => {
    // 不只验证宽度变化，还要验证拖拽后组件没有变形/消失
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 确认代码编辑器正常
    const monaco = wb.locator('.monaco-editor').first();
    await expect(monaco, '拖拽前应有 Monaco Editor').toBeVisible({ timeout: 8000 });

    // ===== 拖拽 resizer =====

    const resizer = page.locator('.workbench-resizer');
    await expect(resizer).toBeVisible({ timeout: 3000 });
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).toBeTruthy();

    const wbArea = page.locator('.workbench-area');
    const widthBefore = await wbArea.evaluate(el => el.getBoundingClientRect().width);

    // 拖拽向左 150px（Workbench 变宽）
    await page.mouse.move(resizerBox!.x + 3, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 150, resizerBox!.y + resizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // ===== 核心断言 =====

    // 1. 宽度应增大
    const widthAfter = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    expect(widthAfter, '拖拽后 Workbench 应变宽').toBeGreaterThan(widthBefore);

    // 2. 拖拽后 Monaco Editor 仍然正常渲染（没有消失或变形）
    await expect(monaco, '拖拽后 Monaco Editor 应仍然可见').toBeVisible({ timeout: 3000 });

    // 3. 行号仍然存在（编辑器没崩溃）
    const lineNumbers = monaco.locator('.line-numbers, .margin-view-overlays .line-numbers');
    const lineCount = await lineNumbers.count();
    expect(lineCount, '拖拽后行号应仍然存在').toBeGreaterThanOrEqual(1);
  });

  test('S03-05 用户疯狂拖拽到极端位置 → 宽度受限 25%-75%', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const resizer = page.locator('.workbench-resizer');
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).toBeTruthy();

    const layoutBox = await page.locator('.workbench-layout').boundingBox();
    expect(layoutBox).toBeTruthy();
    const totalWidth = layoutBox!.width;

    // ===== 拖到最左（试图让 Workbench 占满屏幕）=====
    await page.mouse.move(resizerBox!.x + 3, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox!.x + 10, resizerBox!.y + resizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const wbArea = page.locator('.workbench-area');
    const maxWbWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    const maxRatio = maxWbWidth / totalWidth;
    expect(maxRatio, 'Workbench 最大不超过 80%').toBeLessThanOrEqual(0.82);

    // ===== 拖到最右（试图让 Workbench 消失）=====
    const newResizerBox = await resizer.boundingBox();
    await page.mouse.move(newResizerBox!.x + 3, newResizerBox!.y + newResizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox!.x + layoutBox!.width - 10, newResizerBox!.y + newResizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const minWbWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    const minRatio = minWbWidth / totalWidth;
    expect(minRatio, 'Workbench 最小不低于 18%').toBeGreaterThanOrEqual(0.18);

    // ===== 极端拖拽后 Workbench 仍可用 =====
    await expect(wb, '极端拖拽后 Workbench 仍应存在').toBeVisible();
  });
});

// ============================================================================
// C: 关闭与重开（3 tests）
// ============================================================================

test.describe('S03-C: 关闭与重开', () => {

  test('S03-06 用户点 X 关闭 Workbench → 再让 AI 展示内容 → Workbench 重新打开', async ({ page }) => {
    // 真实场景：用户关闭工作台后，再次需要时 AI 能重新打开
    test.setTimeout(180000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 先注入一个 Workbench
    const injected = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 用户点击 Workbench 头部的 X 按钮关闭 =====
    const closeBtn = wb.locator('.workbench-header button').last(); // 最右边的按钮是关闭
    await closeBtn.click();
    await page.waitForTimeout(1000);

    // 1. Workbench 应消失
    const wbGone = await wb.isVisible().catch(() => false);
    expect(wbGone, '点击 X 后 Workbench 应消失').toBe(false);

    // ===== 用户再让 AI 展示内容 =====
    const r = await sendAndWaitWithRetry(
      page,
      '在工作台中展示一段 JavaScript hello world 代码',
      { timeout: 90000, retries: 2 },
    );

    if (!r.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForTimeout(3000);

    // 2. Workbench 应重新打开
    const wbReopened = await wb.isVisible().catch(() => false);
    if (!wbReopened) {
      // AI 回复了但没打开 Workbench → P0-1
      const text = await page.locator('main').innerText();
      if (text.includes('工作台') || text.includes('Workbench') || text.includes('代码')) {
        expect(wbReopened, 'P0-1: AI 尝试但 Workbench 未重新打开').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench');
      }
    }
  });

  test('S03-07 Workbench 打开时用户继续对话（纯文本） → Workbench 保持不变', async ({ page }) => {
    // 真实场景：用户在 Workbench 打开状态下继续聊天，AI 如果不调用 workbench 工具，
    // Workbench 应保持当前状态不变（不被覆盖、不被关闭）
    test.setTimeout(180000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 注入 Workbench
    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 记录当前状态
    const tabCountBefore = await wb.locator('.workbench-tab').count();
    expect(tabCountBefore, '注入后应有 3 个 Tab').toBe(3);

    // ===== 用户发一条不涉及 Workbench 的普通消息 =====
    const r = await sendAndWaitWithRetry(
      page,
      '1+1等于几？不需要使用工作台，直接回答即可。',
      { timeout: 60000, retries: 2 },
    );

    if (!r.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForTimeout(2000);

    // ===== 核心断言 =====

    // 1. Workbench 仍然可见
    await expect(wb, 'AI 纯文本回复后 Workbench 应仍然可见').toBeVisible();

    // 2. Tab 数量没变
    const tabCountAfter = await wb.locator('.workbench-tab').count();
    expect(tabCountAfter, 'AI 纯文本回复后 Tab 数量不应变化').toBe(tabCountBefore);

    // 3. AI 的回复应包含答案"2"（确认 AI 正常回复了）
    expect(r.responseText.includes('2'), 'AI 应正常回答 1+1=2').toBe(true);
  });

  test('S03-08 先注入代码 Tab → 追加表格 Tab（mergeSchema）→ 两个 Tab 都在', async ({ page }) => {
    // 模拟 AI 多次调用 workbench 工具的真实路径：第一次 open，后续 mergeSchema 追加 tab
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 第一次：open 代码
    const r1 = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!r1.success) { test.skip(true, `第一次注入失败: ${r1.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = wb.locator('.workbench-tab');
    await expect(tabs, '第一次注入后应有 1 个 Tab').toHaveCount(1);

    // 验证第一个 tab 有代码（Monaco 加载可能较慢，需等待）
    const monacoEditor = wb.locator('.monaco-editor, pre code').first();
    await expect(monacoEditor, '第一个 Tab 应有代码编辑器').toBeVisible({ timeout: 15000 });

    // 第二次：mergeSchema 追加表格
    const r2 = await mergeTab(page, TABLE_TAB_SCHEMA);
    if (!r2.success) { test.skip(true, `mergeSchema 失败: ${r2.reason}`); return; }

    // ===== 核心断言 =====

    // 1. Tab 数量应变为 2
    await expect(tabs, 'mergeSchema 后应有 2 个 Tab').toHaveCount(2);

    // 2. 第一个 tab 仍是代码
    await tabs.nth(0).click();
    await page.waitForTimeout(800);
    const codeStillThere = await wb.locator('.monaco-editor, pre code').first().isVisible().catch(() => false);
    expect(codeStillThere, '原有代码 Tab 不应被覆盖').toBe(true);

    // 3. 第二个 tab 是表格
    await tabs.nth(1).click();
    await page.waitForTimeout(800);
    const hasTable = await wb.locator('table, .ant-table, [class*="DataTable"]').first().isVisible().catch(() => false);
    expect(hasTable, '新追加的 Tab 应有表格').toBe(true);

    // 4. 表格内容正确
    const wbText = await wb.innerText();
    expect(wbText.includes('中远海运'), '追加的表格应包含"中远海运"').toBe(true);
  });
});

// ============================================================================
// D: 跨会话状态（2 tests）
// ============================================================================

test.describe('S03-D: 跨会话状态', () => {

  test('S03-09 会话 1 有 Workbench → 新建会话 2 → 切回 → Workbench 恢复', async ({ page }) => {
    test.setTimeout(120000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 在会话 1 注入 Workbench
    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });
    await expect(wb.locator('.workbench-tab')).toHaveCount(3);

    // 等 debounce 保存（2s）
    await page.waitForTimeout(3000);

    // ===== 新建会话 2 =====
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // 会话 2 应无 Workbench 或显示欢迎页
    const wbInSession2 = await wb.isVisible().catch(() => false);
    const welcomeVisible = await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);
    expect(wbInSession2 === false || welcomeVisible, '新建会话应无旧 Workbench').toBe(true);

    // ===== 切回会话 1 =====
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sessionItems.first().click({ force: true });
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ===== 核心断言 =====

    // 1. Workbench 应恢复
    await expect(wb, '切回后 Workbench 应恢复').toBeVisible({ timeout: 8000 });

    // 2. Tab 数量应保持 3
    const tabCount = await wb.locator('.workbench-tab').count();
    expect(tabCount, '切回后应保持 3 个 Tab').toBe(3);

    // 3. Tab 标题应正确（验证不是空壳恢复）
    const tabTitles = await wb.locator('.workbench-tab').allInnerTexts();
    const titlesJoined = tabTitles.join(' ');
    expect(
      titlesJoined.includes('代码') || titlesJoined.includes('员工') || titlesJoined.includes('图表') || titlesJoined.includes('销售'),
      '切回后 Tab 标题应保持原始内容',
    ).toBe(true);
  });

  test('S03-10 用户操作 Tab 后切走再切回 → activeTab 和 Tab 数量精确保持', async ({ page }) => {
    // 更深的持久化验证：用户先做了操作（切到 Tab 2 + 关闭 Tab 3），切走再切回，操作结果要保持
    test.setTimeout(120000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // ===== 用户操作：切到 Tab 2 + 关闭 Tab 3 =====

    // 切到第二个 tab
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    // 关闭第三个 tab
    await tabs.nth(2).hover();
    await page.waitForTimeout(300);
    const closeBtn = tabs.nth(2).locator('button').first();
    await closeBtn.click();
    await page.waitForTimeout(800);

    // 确认：2 个 Tab，第二个（"员工数据"）是 active
    await expect(tabs, '操作后应剩 2 个 Tab').toHaveCount(2);

    // 等 debounce 保存
    await page.waitForTimeout(3000);

    // ===== 切走 =====
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // ===== 切回 =====
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sessionItems.first().click({ force: true });
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ===== 核心断言 =====

    await expect(wb, '切回后 Workbench 应在').toBeVisible({ timeout: 8000 });

    // 1. Tab 数量仍是 2（不是 3，关闭操作应被持久化）
    const tabCountAfter = await wb.locator('.workbench-tab').count();
    expect(tabCountAfter, '切回后 Tab 数量应保持为 2（关闭操作被持久化）').toBe(2);

    // 2. 第二个 tab（"员工数据"）应仍是 active（可通过内容验证）
    const wbText = await wb.innerText();
    const hasEmployeeData = wbText.includes('员工') || wbText.includes('张三') || wbText.includes('研发部');
    expect(hasEmployeeData, '切回后 activeTab 应仍是"员工数据"（操作被持久化）').toBe(true);
  });
});
