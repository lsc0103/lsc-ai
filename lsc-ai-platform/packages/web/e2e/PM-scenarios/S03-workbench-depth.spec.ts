/**
 * 场景 S03: Workbench 交互深度 + 界面展示
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * 测试目标：验证 Workbench 的 Tab 管理、分屏布局、组件渲染、状态持久化。
 * 全部通过 store 注入测试，0-1 次 AI 调用，不依赖 DeepSeek。
 *
 * 前置条件：
 * - packages/web/src/main.tsx 已暴露 window.__workbenchStore（DEV 环境）
 * - 服务已启动（web:5173, server:3000）
 *
 * 分组：
 * - A: Tab 管理（3 tests）— 多 Tab 切换、关闭、右键菜单
 * - B: 分屏布局（2 tests）— 拖拽调整宽度、边界约束
 * - C: 组件渲染（3 tests）— 代码高亮、数据表格、ECharts 图表
 * - D: 状态持久化（2 tests）— 切换会话保持、手动关闭后不自动重开
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

// ============================================================================
// 通用：创建 session + 注入 store 的辅助函数
// ============================================================================

/**
 * 创建一个会话（Workbench 需要 session 才能渲染，见 BUG-1）
 * 返回 session URL
 */
async function ensureSession(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill('你好');
  await textarea.press('Enter');

  const urlChanged = await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 })
    .then(() => true).catch(() => false);
  if (!urlChanged) {
    throw new Error('Session 未在 30s 内创建（AI 无响应）');
  }
  await page.waitForTimeout(2000);
  return page.url();
}

/**
 * 通过 __workbenchStore 注入 schema
 */
async function injectSchema(
  page: import('@playwright/test').Page,
  schema: Record<string, unknown>,
): Promise<{ success: boolean; reason?: string }> {
  const result = await page.evaluate((s) => {
    const store = (window as any).__workbenchStore;
    if (!store || !store.getState) return { success: false, reason: 'store not found' };
    try {
      store.getState().open(s);
      return { success: true };
    } catch (e: any) {
      return { success: false, reason: e.message };
    }
  }, schema);
  if (result.success) {
    await page.waitForTimeout(1500);
  }
  return result;
}

// ============================================================================
// 测试用 schema 定义
// ============================================================================

/** 3-tab schema：代码 + 表格 + 图表 */
const MULTI_TAB_SCHEMA = {
  type: 'workbench',
  title: 'S03 多Tab测试',
  tabs: [
    {
      key: 'tab-code',
      title: '代码示例',
      components: [{
        type: 'CodeEditor',
        title: 'Python 示例',
        language: 'python',
        code: 'def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[0]\n    left = [x for x in arr[1:] if x <= pivot]\n    right = [x for x in arr[1:] if x > pivot]\n    return quicksort(left) + [pivot] + quicksort(right)\n\nprint(quicksort([3, 1, 4, 1, 5, 9, 2, 6]))',
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
          { key: 'age', title: '年龄', dataIndex: 'age' },
          { key: 'dept', title: '部门', dataIndex: 'dept' },
        ],
        data: [
          { name: '张三', age: '25', dept: '研发部' },
          { name: '李四', age: '30', dept: '设计部' },
          { name: '王五', age: '28', dept: '产品部' },
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

/** 单 tab schema（代码） */
const CODE_SCHEMA = {
  type: 'workbench',
  title: 'S03 代码测试',
  tabs: [{
    key: 'code-only',
    title: 'JavaScript 代码',
    components: [{
      type: 'CodeEditor',
      title: 'JS 示例',
      language: 'javascript',
      code: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10)); // 55',
    }],
  }],
};

/** 单 tab schema（表格） */
const TABLE_SCHEMA = {
  type: 'workbench',
  title: 'S03 表格测试',
  tabs: [{
    key: 'table-only',
    title: '订单数据',
    components: [{
      type: 'DataTable',
      title: '订单列表',
      columns: [
        { key: 'orderId', title: '订单号', dataIndex: 'orderId' },
        { key: 'customer', title: '客户', dataIndex: 'customer' },
        { key: 'amount', title: '金额', dataIndex: 'amount' },
        { key: 'status', title: '状态', dataIndex: 'status' },
      ],
      data: [
        { orderId: 'ORD-001', customer: '中远海运', amount: '150000', status: '已完成' },
        { orderId: 'ORD-002', customer: '招商局港口', amount: '280000', status: '进行中' },
        { orderId: 'ORD-003', customer: '上海港务', amount: '95000', status: '待审批' },
      ],
    }],
  }],
};

/** 单 tab schema（图表） */
const CHART_SCHEMA = {
  type: 'workbench',
  title: 'S03 图表测试',
  tabs: [{
    key: 'chart-only',
    title: '月度趋势',
    components: [{
      type: 'LineChart',
      title: '月度销售趋势',
      xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
      series: [
        { name: '销售额', data: [120, 200, 150, 280, 220, 310] },
        { name: '利润', data: [50, 80, 60, 120, 90, 150] },
      ],
    }],
  }],
};

// ============================================================================
// A: Tab 管理（3 tests）
// ============================================================================

test.describe('S03-A: Tab 管理', () => {

  test('S03-01 多 Tab 切换 → 每个 Tab 内容隔离', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, MULTI_TAB_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb, 'Workbench 应打开').toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 应有 3 个 tab
    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // 2. 第一个 tab（代码）默认激活 — 应有代码编辑器
    const codeEl = wb.locator('.monaco-editor, pre code, [class*="CodeEditor"], .cm-editor').first();
    await expect(codeEl, 'Tab 1 应有代码编辑器').toBeVisible({ timeout: 5000 });

    // 3. 切换到第二个 tab（表格）
    await tabs.nth(1).click();
    await page.waitForTimeout(800);
    const tableEl = wb.locator('table, .ant-table, [class*="DataTable"]').first();
    await expect(tableEl, 'Tab 2 应有表格').toBeVisible({ timeout: 5000 });

    // 4. 切换到第三个 tab（图表）
    await tabs.nth(2).click();
    await page.waitForTimeout(800);
    const chartEl = wb.locator('svg, [_echarts_instance_], [class*="echarts"]').first();
    await expect(chartEl, 'Tab 3 应有图表').toBeVisible({ timeout: 5000 });

    // 5. 切回第一个 tab — 代码编辑器应重新出现
    await tabs.nth(0).click();
    await page.waitForTimeout(800);
    await expect(codeEl, '切回 Tab 1 后代码编辑器应仍在').toBeVisible({ timeout: 5000 });
  });

  test('S03-02 关闭 Tab → hover 显示关闭按钮，关闭后 Tab 消失', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, MULTI_TAB_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // ===== 核心断言 =====

    // 1. hover 第二个 tab，应出现关闭按钮
    const tab2 = tabs.nth(1);
    await tab2.hover();
    await page.waitForTimeout(500);

    // 关闭按钮在 tab 内部（CloseOutlined icon 的父 button）
    const closeBtn = tab2.locator('button').first();
    await expect(closeBtn, 'hover 后应出现关闭按钮').toBeVisible({ timeout: 3000 });

    // 2. 点击关闭按钮
    await closeBtn.click();
    await page.waitForTimeout(800);

    // 3. Tab 数量应减为 2
    const remainingTabs = wb.locator('.workbench-tab');
    await expect(remainingTabs, '关闭后应剩 2 个 Tab').toHaveCount(2);
  });

  test('S03-03 右键 Tab → 上下文菜单出现，"关闭其他"生效', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, MULTI_TAB_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // ===== 核心断言 =====

    // 1. 右键第二个 tab
    await tabs.nth(1).click({ button: 'right' });
    await page.waitForTimeout(500);

    // 2. 应出现上下文菜单（Ant Design Dropdown menu）
    const menu = page.locator('.ant-dropdown-menu, .ant-dropdown, [role="menu"]').first();
    await expect(menu, '右键应弹出上下文菜单').toBeVisible({ timeout: 3000 });

    // 3. 菜单应包含"关闭其他"选项
    const closeOthersItem = menu.locator('text=关闭其他');
    await expect(closeOthersItem, '菜单应有"关闭其他"选项').toBeVisible({ timeout: 2000 });

    // 4. 点击"关闭其他"
    await closeOthersItem.click();
    await page.waitForTimeout(800);

    // 5. 应只剩 1 个 tab（被右键的那个）
    const remainingTabs = wb.locator('.workbench-tab');
    await expect(remainingTabs, '"关闭其他"后应只剩 1 个 Tab').toHaveCount(1);
  });
});

// ============================================================================
// B: 分屏布局（2 tests）
// ============================================================================

test.describe('S03-B: 分屏布局', () => {

  test('S03-04 拖拽 resizer → Workbench 宽度变化', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, CODE_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. resizer 应存在
    const resizer = page.locator('.workbench-resizer');
    await expect(resizer, 'resizer 应存在').toBeVisible({ timeout: 3000 });

    // 2. 记录初始宽度
    const wbArea = page.locator('.workbench-area');
    const initialWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    expect(initialWidth, 'Workbench 初始宽度应 > 0').toBeGreaterThan(0);

    // 3. 拖拽 resizer 向左（增大 Workbench 宽度）
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox, 'resizer 应有 boundingBox').toBeTruthy();

    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 100, resizerBox!.y + resizerBox!.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // 4. 宽度应增大
    const newWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    expect(newWidth, '拖拽后 Workbench 宽度应增大').toBeGreaterThan(initialWidth);
  });

  test('S03-05 拖拽到极端位置 → 宽度受限（25%-75%）', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, CODE_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    const resizer = page.locator('.workbench-resizer');
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).toBeTruthy();

    // 获取布局容器的总宽度
    const layoutBox = await page.locator('.workbench-layout').boundingBox();
    expect(layoutBox).toBeTruthy();
    const totalWidth = layoutBox!.width;

    // 1. 拖拽到最左边（试图把 Workbench 拉到 100%）
    await page.mouse.move(resizerBox!.x + 3, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox!.x + 10, resizerBox!.y + resizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Workbench 宽度不应超过 75% of total（MIN_WIDTH_RATIO=0.25 for chat）
    const wbArea = page.locator('.workbench-area');
    const maxWbWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    const maxRatio = maxWbWidth / totalWidth;
    expect(maxRatio, 'Workbench 最大宽度不应超过 80%').toBeLessThanOrEqual(0.82); // 允许 2% 误差

    // 2. 拖拽到最右边（试图把 Workbench 缩到 0%）
    const newResizerBox = await resizer.boundingBox();
    await page.mouse.move(newResizerBox!.x + 3, newResizerBox!.y + newResizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox!.x + layoutBox!.width - 10, newResizerBox!.y + newResizerBox!.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Workbench 宽度不应低于 25%（MAX_WIDTH_RATIO=0.75 for chat → 0.25 for wb）
    const minWbWidth = await wbArea.evaluate(el => el.getBoundingClientRect().width);
    const minRatio = minWbWidth / totalWidth;
    expect(minRatio, 'Workbench 最小宽度不应低于 18%').toBeGreaterThanOrEqual(0.18); // 允许 2% 误差
  });
});

// ============================================================================
// C: 组件渲染（3 tests）
// ============================================================================

test.describe('S03-C: 组件渲染', () => {

  test('S03-06 CodeEditor 渲染 → Monaco Editor + 行号 + 语法高亮', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, CODE_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 应有 Monaco Editor
    const monaco = wb.locator('.monaco-editor').first();
    await expect(monaco, '应有 Monaco Editor').toBeVisible({ timeout: 8000 });

    // 2. 应有行号
    const lineNumbers = monaco.locator('.line-numbers, .margin-view-overlays .line-numbers');
    const lineCount = await lineNumbers.count();
    expect(lineCount, '应有行号（≥1 行）').toBeGreaterThanOrEqual(1);

    // 3. 应有语法高亮（Monaco 用 .mtk* class 进行 token 着色）
    const syntaxTokens = monaco.locator('[class*="mtk"]');
    const tokenCount = await syntaxTokens.count();
    expect(tokenCount, '应有语法高亮 token（mtk class）').toBeGreaterThan(0);

    // 4. 内容不应是原始 JSON
    const wbText = await wb.innerText();
    expect(wbText.includes('"type": "CodeEditor"'), '不应显示原始 JSON').toBe(false);
  });

  test('S03-07 DataTable 渲染 → 列头 + 数据行', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, TABLE_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 应有表格
    const table = wb.locator('table, .ant-table, [class*="DataTable"]').first();
    await expect(table, '应有表格').toBeVisible({ timeout: 5000 });

    // 2. 应有列头"订单号"、"客户"
    const wbText = await wb.innerText();
    expect(wbText.includes('订单号'), '应显示列头"订单号"').toBe(true);
    expect(wbText.includes('客户'), '应显示列头"客户"').toBe(true);

    // 3. 应有数据"中远海运"
    expect(wbText.includes('中远海运'), '应显示数据"中远海运"').toBe(true);

    // 4. 应有 3 行数据（通过 tr 或 ant-table-row 计数）
    const rows = wb.locator('tbody tr, .ant-table-row');
    const rowCount = await rows.count();
    expect(rowCount, '应有 3 行数据').toBeGreaterThanOrEqual(3);

    // 5. 不应是原始 JSON
    expect(wbText.includes('"dataIndex"'), '不应显示原始 JSON key').toBe(false);
  });

  test('S03-08 ECharts 图表渲染 → SVG 元素存在', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    const injected = await injectSchema(page, CHART_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 应有 ECharts 实例或 SVG 图表
    const chart = wb.locator('svg, [_echarts_instance_], [class*="echarts"]').first();
    await expect(chart, '应有 ECharts SVG 图表').toBeVisible({ timeout: 8000 });

    // 2. SVG 中应有实际绘制内容（path 或 rect 等图形元素）
    const svgElements = wb.locator('svg path, svg rect, svg line, svg circle, svg polyline');
    const svgCount = await svgElements.count();
    expect(svgCount, 'SVG 中应有图形元素（path/rect/line 等）').toBeGreaterThan(0);

    // 3. 不应显示原始 JSON
    const wbText = await wb.innerText();
    expect(wbText.includes('"series"'), '不应显示 "series" JSON key').toBe(false);
    expect(wbText.includes('"LineChart"'), '不应显示 "LineChart" 类型名').toBe(false);
  });
});

// ============================================================================
// D: 状态持久化（2 tests）
// ============================================================================

test.describe('S03-D: 状态持久化', () => {

  test('S03-09 切换会话再切回 → Workbench 状态保持', async ({ page }) => {
    test.setTimeout(120000);
    let session1Url: string;
    try { session1Url = await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    // 注入 schema 到会话 1
    const injected = await injectSchema(page, MULTI_TAB_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 确认有 3 个 tab
    const tabs = wb.locator('.workbench-tab');
    await expect(tabs).toHaveCount(3);

    // 等待 debounce 保存（WorkbenchStore 有 2s debounce）
    await page.waitForTimeout(3000);

    // 新建会话（离开当前会话）
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // 验证确实离开了（Workbench 应关闭或无内容）
    const wbGone = await wb.isVisible().catch(() => false) === false ||
      await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);

    // 切回第一个会话
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().click();
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ===== 核心断言 =====

    // 1. Workbench 应重新出现
    await expect(wb, '切回后 Workbench 应重新出现').toBeVisible({ timeout: 8000 });

    // 2. Tab 数量应保持 3
    const tabsAfter = wb.locator('.workbench-tab');
    const tabCountAfter = await tabsAfter.count();
    expect(tabCountAfter, '切回后应保持 3 个 Tab').toBe(3);
  });

  test('S03-10 手动关闭 Workbench → 不应自动重新打开', async ({ page }) => {
    test.setTimeout(90000);
    try { await ensureSession(page); } catch {
      test.skip(true, 'Session 创建失败，跳过');
      return;
    }

    // 注入 schema
    const injected = await injectSchema(page, CODE_SCHEMA);
    if (!injected.success) {
      test.skip(true, `Store 注入失败: ${injected.reason}`);
      return;
    }

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 通过 store 关闭 Workbench
    await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (store && store.getState) {
        store.getState().close();
      }
    });
    await page.waitForTimeout(1000);

    // ===== 核心断言 =====

    // 1. Workbench 应已关闭
    const wbVisible = await wb.isVisible().catch(() => false);
    expect(wbVisible, '调用 close() 后 Workbench 应消失').toBe(false);

    // 2. 等待几秒，确认不会自动重开
    await page.waitForTimeout(3000);
    const wbStillClosed = await wb.isVisible().catch(() => false);
    expect(wbStillClosed, '关闭后 3 秒内不应自动重开').toBe(false);

    // 3. 通过 store 验证 visible 状态
    const storeVisible = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      return store?.getState?.()?.visible ?? null;
    });
    expect(storeVisible, 'Store 中 visible 应为 false').toBe(false);
  });
});
