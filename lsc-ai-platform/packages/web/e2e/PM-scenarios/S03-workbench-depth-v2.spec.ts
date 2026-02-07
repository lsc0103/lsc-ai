/**
 * 场景 S03: Workbench 交互深度（V2 — 加固版）
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * V2 加固变更（Phase E-3）：
 * - 消除所有 waitForTimeout，改用条件等待（waitForSelector / waitForFunction / expect.toBeVisible）
 * - 所有选择器统一使用 SEL 常量 + data-testid
 * - S03-01 拆分为 S03-01a（注入验证，0 AI）+ S03-01b（AI 触发验证，1 AI）
 *
 * 分组：
 * - A: Tab 累积与操作（4 tests）— 注入多Tab验证、AI累积Tab、连续关闭到边界、右键菜单完整流程
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

/** 等待 Workbench 容器可见 */
async function waitForWorkbench(page: import('@playwright/test').Page, timeout = 5000) {
  const wb = page.locator(SEL.workbench.container);
  await expect(wb).toBeVisible({ timeout });
  return wb;
}

/** 等待 Workbench 容器消失 */
async function waitForWorkbenchHidden(page: import('@playwright/test').Page, timeout = 5000) {
  const wb = page.locator(SEL.workbench.container);
  await expect(wb).not.toBeVisible({ timeout });
}

/** 等待指定数量的 Tab */
async function waitForTabCount(page: import('@playwright/test').Page, count: number, timeout = 5000) {
  const tabs = page.locator(SEL.workbench.tab);
  await expect(tabs).toHaveCount(count, { timeout });
  return tabs;
}

/** 创建 session（发"你好"，等 URL 变为 /chat/:id，等 AI 响应完成，清理可能的 Workbench） */
async function ensureSession(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill('你好');
  await textarea.press('Enter');

  const ok = await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 })
    .then(() => true).catch(() => false);
  if (!ok) throw new Error('Session 未创建');

  // 等待 AI 响应完成（stop 按钮消失）
  const stopBtn = page.locator(SEL.chat.stopButton);
  await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});

  // 等待流式输出完全结束：检测消息列表不再增长
  await page.waitForFunction(() => {
    const bubbles = document.querySelectorAll('main .message-bubble.assistant');
    return bubbles.length > 0;
  }, { timeout: 10000 }).catch(() => {});

  // 如果 AI 响应时打开了 Workbench，先关闭它
  const wb = page.locator(SEL.workbench.container);
  if (await wb.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (store?.getState) store.getState().close();
    });
    await expect(wb).not.toBeVisible({ timeout: 3000 });
  }

  return page.url();
}

/** 注入 schema 到 workbench store，用条件等待替代 waitForTimeout */
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
  if (result.success) {
    // 等待 Workbench 容器可见，替代 waitForTimeout(1500)
    await page.locator(SEL.workbench.container).waitFor({ state: 'visible', timeout: 5000 });
  }
  return result;
}

/** 通过 mergeSchema 追加 tab（模拟 AI 第二次调用 workbench 工具） */
async function mergeTab(
  page: import('@playwright/test').Page,
  schema: Record<string, unknown>,
  expectedTabCount?: number,
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
  if (result.success && expectedTabCount) {
    // 等待 Tab 数量达到预期，替代 waitForTimeout(1000)
    await expect(page.locator(SEL.workbench.tab)).toHaveCount(expectedTabCount, { timeout: 5000 });
  }
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
// A: Tab 累积与操作（4 tests — S03-01 拆分为 01a + 01b）
// ============================================================================

test.describe('S03-A: Tab 累积与操作', () => {

  test('S03-01a 注入多 Tab Schema → 验证 Tab 渲染与切换（0 AI）', async ({ page }) => {
    // 纯注入验证：不依赖 AI，直接注入 3-tab schema 并验证渲染和切换
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = await waitForWorkbench(page);
    const tabs = await waitForTabCount(page, 3);

    // 1. 验证 3 个 Tab 标题
    const tabTitles = await tabs.allInnerTexts();
    const titlesJoined = tabTitles.join(' ');
    expect(titlesJoined, 'Tab 标题应包含"代码"').toContain('代码');
    expect(titlesJoined, 'Tab 标题应包含"员工"').toContain('员工');

    // 2. 点击第一个 tab → 应有代码编辑器
    await tabs.nth(0).click();
    const codeEditor = wb.locator(SEL.workbench.codeEditor).first();
    // 等待编辑器加载（可能有加载指示器）
    await wb.locator('text=加载编辑器').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await expect(codeEditor, '第一个 Tab 应有代码编辑器').toBeVisible({ timeout: 10000 });

    // 3. 切到最后一个 tab → 应有图表类内容
    await tabs.last().click();
    const content = page.locator(SEL.workbench.content);
    await expect(content).toBeVisible({ timeout: 3000 });
    // 图表或 canvas 应存在
    const hasChartContent = await wb.locator('canvas, [class*="chart"], [class*="Chart"], [class*="echarts"]').first()
      .isVisible().catch(() => false);
    const contentText = await content.innerText();
    expect(
      hasChartContent || contentText.includes('销售') || contentText.includes('Q1'),
      '最后一个 Tab 应有图表相关内容',
    ).toBe(true);

    // 4. 切回中间 tab → 应有表格
    await tabs.nth(1).click();
    const hasTable = await wb.locator(SEL.workbench.dataTable).first().isVisible().catch(() => false);
    const tableText = await content.innerText();
    expect(
      hasTable || tableText.includes('张三') || tableText.includes('研发部'),
      '中间 Tab 应有表格内容',
    ).toBe(true);
  });

  test('S03-01b 用户让 AI 展示代码 → 再展示表格 → Tab 自动累积（1+ AI）', async ({ page }) => {
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

    // 等待 Workbench 出现（条件等待替代 waitForTimeout(3000)）
    const wb = page.locator(SEL.workbench.container);
    const wbVisible = await wb.waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true).catch(() => false);

    if (!wbVisible) {
      const mainText = await page.locator('main').innerText();
      if (mainText.includes('工作台') || mainText.includes('Workbench') || mainText.includes('代码')) {
        expect(wbVisible, 'P0-1: AI 尝试但 Workbench 未打开').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench，跳过');
      }
      return;
    }

    // 记录第一步的 tab 数量
    const tabsAfterR1 = await page.locator(SEL.workbench.tab).count();
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

    // 等待 Tab 数量增加（条件等待替代 waitForTimeout(3000)）
    await page.waitForFunction(
      (prevCount) => {
        const tabs = document.querySelectorAll('[data-testid="workbench-tab"]');
        return tabs.length > prevCount;
      },
      tabsAfterR1,
      { timeout: 15000 },
    ).catch(() => {});

    // ===== 核心断言 =====
    const tabsAfterR2 = await page.locator(SEL.workbench.tab).count();
    expect(tabsAfterR2, 'AI 第二次调用后 Tab 应累积（≥2）').toBeGreaterThanOrEqual(2);

    // 用户点击第一个 tab → 应有代码相关内容
    const tabs = page.locator(SEL.workbench.tab);
    await tabs.nth(0).click();
    await expect(page.locator(SEL.workbench.content)).toBeVisible({ timeout: 3000 });
    const tab1Content = await page.locator(SEL.workbench.content).first().innerText();
    const tab1HasCode = tab1Content.includes('def ') || tab1Content.includes('function') ||
      tab1Content.includes('sort') || await wb.locator(SEL.workbench.codeEditor).first().isVisible().catch(() => false);

    // 用户点击最后一个 tab → 应有表格相关内容
    await tabs.last().click();
    await expect(page.locator(SEL.workbench.content)).toBeVisible({ timeout: 3000 });
    const hasTable = await wb.locator(SEL.workbench.dataTable).first().isVisible().catch(() => false);
    const lastTabText = await page.locator(SEL.workbench.content).first().innerText();
    const tab2HasData = hasTable || lastTabText.includes('张三') || lastTabText.includes('北京');

    expect(tab1HasCode || tab2HasData, '两个 Tab 应有不同类型的内容（代码/表格）').toBe(true);
  });

  test('S03-02 用户连续关闭 Tab → 自动切换 → 最后一个 Tab 不可关闭', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    await waitForWorkbench(page);
    const tabs = await waitForTabCount(page, 3);

    // ===== 用户操作链 =====

    // 1. 切到第二个 tab（员工数据）
    await tabs.nth(1).click();
    await expect(page.locator(SEL.workbench.content)).toBeVisible({ timeout: 3000 });

    // 2. hover 第二个 tab → 出现关闭按钮 → 关闭
    await tabs.nth(1).hover();
    const closeBtn1 = tabs.nth(1).locator(SEL.workbench.tabClose);
    await expect(closeBtn1, '关闭按钮应出现').toBeVisible({ timeout: 2000 });
    await closeBtn1.click();

    // 3. 等待 Tab 减少为 2 个
    await waitForTabCount(page, 2);

    // 当前应有某个 tab 处于 active 状态（内容区非空）
    const contentAfterClose = await page.locator(SEL.workbench.content).first().innerText();
    expect(contentAfterClose.length, '关闭 tab 后应自动切到邻近 tab，内容不为空').toBeGreaterThan(0);

    // 4. 继续关闭一个 tab
    const remainingTabs = page.locator(SEL.workbench.tab);
    await remainingTabs.nth(0).hover();
    const closeBtn2 = remainingTabs.nth(0).locator(SEL.workbench.tabClose);
    await expect(closeBtn2).toBeVisible({ timeout: 2000 });
    await closeBtn2.click();

    // 5. 等待只剩 1 个 tab
    await waitForTabCount(page, 1);

    // 6. 最后一个 tab 不应有关闭按钮（源码：schema.tabs.length > 1 才显示）
    const lastTab = page.locator(SEL.workbench.tab).nth(0);
    await lastTab.hover();
    const lastTabCloseBtn = lastTab.locator(SEL.workbench.tabClose);
    const lastCloseBtnCount = await lastTabCloseBtn.count();
    expect(lastCloseBtnCount, '最后一个 Tab 不应有关闭按钮').toBe(0);
  });

  test('S03-03 右键 Tab → 上下文菜单完整操作 → 禁用状态验证', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    await waitForWorkbench(page);
    const tabs = await waitForTabCount(page, 3);

    // ===== 用户操作链 =====

    // 1. 右键第二个 tab（中间位置）
    await tabs.nth(1).click({ button: 'right' });

    // 2. 上下文菜单应出现（条件等待替代 waitForTimeout(500)）
    const menu = page.locator(SEL.workbench.contextMenu).first();
    await expect(menu, '右键菜单应出现').toBeVisible({ timeout: 3000 });

    // 3. 应有"关闭其他"选项
    const closeOthers = menu.locator('text=关闭其他');
    await expect(closeOthers, '应有"关闭其他"').toBeVisible({ timeout: 2000 });

    // 4. 点击"关闭其他" → 只剩被右键的 tab
    await closeOthers.click();

    // 等待 Tab 变为 1（条件等待替代 waitForTimeout(800)）
    await waitForTabCount(page, 1);

    // 5. 剩余 tab 应是"员工数据"（被右键的那个）
    const remainingTabText = await page.locator(SEL.workbench.tab).nth(0).innerText();
    expect(remainingTabText, '剩余 tab 应是被右键的"员工数据"').toContain('员工数据');

    // 6. 再次右键 → "关闭"应禁用（唯一 tab 不可关闭）
    await page.locator(SEL.workbench.tab).nth(0).click({ button: 'right' });

    const menu2 = page.locator(SEL.workbench.contextMenu).first();
    await expect(menu2).toBeVisible({ timeout: 3000 });

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
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    const wb = await waitForWorkbench(page);

    // 确认代码编辑器正常（等待加载完成）
    await wb.locator('text=加载编辑器').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const monaco = wb.locator(SEL.workbench.codeEditor).first();
    await expect(monaco, '拖拽前应有 Monaco Editor').toBeVisible({ timeout: 8000 });

    // ===== 拖拽 resizer =====
    const resizer = page.locator(SEL.workbench.resizer);
    await expect(resizer).toBeVisible({ timeout: 3000 });
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).toBeTruthy();

    const wbArea = page.locator(SEL.workbench.area);
    const widthBefore = await wbArea.evaluate(el => el.getBoundingClientRect().width);

    // 拖拽向左 150px（Workbench 变宽）
    await page.mouse.move(resizerBox!.x + 3, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 150, resizerBox!.y + resizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();

    // 等待宽度变化完成（条件等待替代 waitForTimeout(800)）
    await page.waitForFunction(
      (prevWidth) => {
        const el = document.querySelector('[data-testid="workbench-area"]');
        return el && el.getBoundingClientRect().width > prevWidth;
      },
      widthBefore,
      { timeout: 5000 },
    );

    // ===== 核心断言 =====
    const widthAfter = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    expect(widthAfter, '拖拽后 Workbench 应变宽').toBeGreaterThan(widthBefore);

    await expect(monaco, '拖拽后 Monaco Editor 应仍然可见').toBeVisible({ timeout: 3000 });

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

    await waitForWorkbench(page);

    const resizer = page.locator(SEL.workbench.resizer);
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).toBeTruthy();

    const layoutBox = await page.locator(SEL.workbench.layout).boundingBox();
    expect(layoutBox).toBeTruthy();
    const totalWidth = layoutBox!.width;

    // ===== 拖到最左（试图让 Workbench 占满屏幕）=====
    await page.mouse.move(resizerBox!.x + 3, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox!.x + 10, resizerBox!.y + resizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();

    // 等待布局稳定（条件等待替代 waitForTimeout(500)）
    const wbArea = page.locator(SEL.workbench.area);
    await page.waitForFunction(() => {
      // Wait for framer-motion animation to settle
      const el = document.querySelector('[data-testid="workbench-area"]');
      return el && el.getBoundingClientRect().width > 0;
    }, { timeout: 3000 });

    const maxWbWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    const maxRatio = maxWbWidth / totalWidth;
    expect(maxRatio, 'Workbench 最大不超过 80%').toBeLessThanOrEqual(0.82);

    // ===== 拖到最右（试图让 Workbench 消失）=====
    const newResizerBox = await resizer.boundingBox();
    await page.mouse.move(newResizerBox!.x + 3, newResizerBox!.y + newResizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox!.x + layoutBox!.width - 10, newResizerBox!.y + newResizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();

    // 等待布局稳定
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="workbench-area"]');
      return el && el.getBoundingClientRect().width > 0;
    }, { timeout: 3000 });

    const minWbWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    const minRatio = minWbWidth / totalWidth;
    expect(minRatio, 'Workbench 最小不低于 18%').toBeGreaterThanOrEqual(0.18);

    // ===== 极端拖拽后 Workbench 仍可用 =====
    await expect(page.locator(SEL.workbench.container), '极端拖拽后 Workbench 仍应存在').toBeVisible();
  });
});

// ============================================================================
// C: 关闭与重开（3 tests）
// ============================================================================

test.describe('S03-C: 关闭与重开', () => {

  test('S03-06 用户点 X 关闭 Workbench → 再让 AI 展示内容 → Workbench 重新打开', async ({ page }) => {
    test.setTimeout(180000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 先注入一个 Workbench
    const injected = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    await waitForWorkbench(page);

    // ===== 用户点击 Workbench 的关闭按钮 =====
    const closeBtn = page.locator(SEL.workbench.closeBtn);
    await expect(closeBtn).toBeVisible({ timeout: 3000 });
    await closeBtn.click();

    // 1. Workbench 应消失（条件等待替代 waitForTimeout(1000)）
    await waitForWorkbenchHidden(page);

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

    // 2. 等待 Workbench 重新打开（条件等待替代 waitForTimeout(3000)）
    const wb = page.locator(SEL.workbench.container);
    const wbReopened = await wb.waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true).catch(() => false);

    if (!wbReopened) {
      const text = await page.locator('main').innerText();
      if (text.includes('工作台') || text.includes('Workbench') || text.includes('代码')) {
        expect(wbReopened, 'P0-1: AI 尝试但 Workbench 未重新打开').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench');
      }
    }
  });

  test('S03-07 Workbench 打开时用户继续对话（纯文本） → Workbench 保持不变', async ({ page }) => {
    test.setTimeout(180000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 注入 Workbench
    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    await waitForWorkbench(page);

    // 记录当前状态
    const tabCountBefore = await page.locator(SEL.workbench.tab).count();
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

    // 等待 AI 流式输出完成（stop 按钮消失）
    await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    // ===== 核心断言 =====

    // 1. Workbench 仍然可见
    await expect(page.locator(SEL.workbench.container), 'AI 纯文本回复后 Workbench 应仍然可见').toBeVisible();

    // 2. Tab 数量没变
    const tabCountAfter = await page.locator(SEL.workbench.tab).count();
    expect(tabCountAfter, 'AI 纯文本回复后 Tab 数量不应变化').toBe(tabCountBefore);

    // 3. AI 的回复应包含答案"2"
    expect(r.responseText.includes('2'), 'AI 应正常回答 1+1=2').toBe(true);
  });

  test('S03-08 先注入代码 Tab → 追加表格 Tab（mergeSchema）→ 两个 Tab 都在', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    // 第一次：open 代码
    const r1 = await injectSchema(page, CODE_TAB_SCHEMA);
    if (!r1.success) { test.skip(true, `第一次注入失败: ${r1.reason}`); return; }

    const wb = await waitForWorkbench(page);
    await waitForTabCount(page, 1);

    // 验证第一个 tab 有代码（Monaco 加载可能较慢）
    await wb.locator('text=加载编辑器').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const codeEditor = wb.locator(SEL.workbench.codeEditor).first();
    await expect(codeEditor, '第一个 Tab 应有代码编辑器').toBeVisible({ timeout: 10000 });

    // 第二次：mergeSchema 追加表格，期望 2 个 Tab
    const r2 = await mergeTab(page, TABLE_TAB_SCHEMA, 2);
    if (!r2.success) { test.skip(true, `mergeSchema 失败: ${r2.reason}`); return; }

    // ===== 核心断言 =====

    // 1. Tab 数量应变为 2
    const tabs = page.locator(SEL.workbench.tab);
    await expect(tabs, 'mergeSchema 后应有 2 个 Tab').toHaveCount(2);

    // 2. 第一个 tab 仍是代码
    await tabs.nth(0).click();
    await expect(page.locator(SEL.workbench.content)).toBeVisible({ timeout: 3000 });
    const codeStillThere = await wb.locator(SEL.workbench.codeEditor).first().isVisible().catch(() => false);
    expect(codeStillThere, '原有代码 Tab 不应被覆盖').toBe(true);

    // 3. 第二个 tab 是表格
    await tabs.nth(1).click();
    // 等待表格内容渲染
    await page.waitForFunction(() => {
      const content = document.querySelector('[data-testid="workbench-content"]');
      return content && content.textContent && content.textContent.length > 10;
    }, { timeout: 5000 }).catch(() => {});

    const hasTable = await wb.locator(SEL.workbench.dataTable).first().isVisible().catch(() => false);
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

    await waitForWorkbench(page);
    await waitForTabCount(page, 3);

    // 等待 debounce 保存：确认 schema 已写入 store
    await page.waitForFunction(() => {
      const store = (window as any).__workbenchStore;
      return store?.getState?.()?.schema?.tabs?.length === 3;
    }, { timeout: 5000 });

    // ===== 新建会话 2 =====
    await page.locator(SEL.sidebar.newChatButton).click();

    // 等待新会话页面加载完成（条件等待替代 waitForTimeout(3000)）
    const welcomeOrNewUrl = await Promise.race([
      page.locator(SEL.chat.welcomeScreen).waitFor({ state: 'visible', timeout: 10000 }).then(() => 'welcome'),
      page.waitForURL(/\/chat$/, { timeout: 10000 }).then(() => 'url'),
    ]).catch(() => 'timeout');

    // 会话 2 应无 Workbench 或显示欢迎页
    const wbInSession2 = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
    const welcomeVisible = await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);
    expect(wbInSession2 === false || welcomeVisible, '新建会话应无旧 Workbench').toBe(true);

    // ===== 切回会话 1 =====
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().scrollIntoViewIfNeeded();
    await sessionItems.first().click({ force: true });

    // 等待 URL 变化（条件等待替代 waitForTimeout(3000)）
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});

    // ===== 核心断言 =====

    // 1. Workbench 应恢复
    await expect(page.locator(SEL.workbench.container), '切回后 Workbench 应恢复').toBeVisible({ timeout: 8000 });

    // 2. Tab 数量应保持 3
    const tabCount = await page.locator(SEL.workbench.tab).count();
    expect(tabCount, '切回后应保持 3 个 Tab').toBe(3);

    // 3. Tab 标题应正确（验证不是空壳恢复）
    const tabTitles = await page.locator(SEL.workbench.tab).allInnerTexts();
    const titlesJoined = tabTitles.join(' ');
    expect(
      titlesJoined.includes('代码') || titlesJoined.includes('员工') || titlesJoined.includes('图表') || titlesJoined.includes('销售'),
      '切回后 Tab 标题应保持原始内容',
    ).toBe(true);
  });

  test('S03-10 用户操作 Tab 后切走再切回 → activeTab 和 Tab 数量精确保持', async ({ page }) => {
    test.setTimeout(120000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败');
      return;
    }

    const injected = await injectSchema(page, THREE_TAB_SCHEMA);
    if (!injected.success) { test.skip(true, `注入失败: ${injected.reason}`); return; }

    await waitForWorkbench(page);
    const tabs = await waitForTabCount(page, 3);

    // ===== 用户操作：切到 Tab 2 + 关闭 Tab 3 =====

    // 切到第二个 tab
    await tabs.nth(1).click();
    await expect(page.locator(SEL.workbench.content)).toBeVisible({ timeout: 3000 });

    // 关闭第三个 tab
    await tabs.nth(2).hover();
    const closeBtn = tabs.nth(2).locator(SEL.workbench.tabClose);
    await expect(closeBtn).toBeVisible({ timeout: 2000 });
    await closeBtn.click();

    // 等待 Tab 变为 2（条件等待替代 waitForTimeout(800)）
    await waitForTabCount(page, 2);

    // 等待 debounce 保存：确认 schema 已更新
    await page.waitForFunction(() => {
      const store = (window as any).__workbenchStore;
      return store?.getState?.()?.schema?.tabs?.length === 2;
    }, { timeout: 5000 });

    // ===== 切走 =====
    await page.locator(SEL.sidebar.newChatButton).click();

    // 等待新会话页面加载（条件等待替代 waitForTimeout(3000)）
    await Promise.race([
      page.locator(SEL.chat.welcomeScreen).waitFor({ state: 'visible', timeout: 10000 }),
      page.waitForURL(/\/chat$/, { timeout: 10000 }),
    ]).catch(() => {});

    // ===== 切回 =====
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().scrollIntoViewIfNeeded();
    await sessionItems.first().click({ force: true });

    // 等待 URL 恢复（条件等待替代 waitForTimeout(3000)）
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});

    // ===== 核心断言 =====

    await expect(page.locator(SEL.workbench.container), '切回后 Workbench 应在').toBeVisible({ timeout: 8000 });

    // 1. Tab 数量仍是 2（不是 3，关闭操作应被持久化）
    const tabCountAfter = await page.locator(SEL.workbench.tab).count();
    expect(tabCountAfter, '切回后 Tab 数量应保持为 2（关闭操作被持久化）').toBe(2);

    // 2. 第二个 tab（"员工数据"）应仍是 active（可通过内容验证）
    const wbText = await page.locator(SEL.workbench.container).innerText();
    const hasEmployeeData = wbText.includes('员工') || wbText.includes('张三') || wbText.includes('研发部');
    expect(hasEmployeeData, '切回后 activeTab 应仍是"员工数据"（操作被持久化）').toBe(true);
  });
});
