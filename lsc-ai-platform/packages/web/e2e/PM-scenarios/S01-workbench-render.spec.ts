/**
 * 场景 S01: Workbench 渲染正确性
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * 测试目标：验证 Workbench 能否正确渲染各种内容类型。
 * 覆盖审计发现：P0-1, P0-4, P0-5, P1-F3
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// ============================================================================
// 第一组：通过 AI 触发 workbench 工具，验证渲染结果（非"容器可见"）
// ============================================================================

test.describe('S01-A: AI 触发 Workbench 内容渲染', () => {

  test('S01-01 AI 展示代码 → 代码块有语法高亮，不是 JSON 文本', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '请用 showCode 工具展示一段 Python 快速排序代码',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);

    // 等待 Workbench 面板出现
    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      // P0-1: showCode 工具结果没推送到 Workbench — 这本身就是 bug
      // 记录：检查 chat:stream 里是否有 tool_result for showCode
      const toolResults = page.locator('text=代码已展示');
      const hasToolResult = await toolResults.isVisible().catch(() => false);

      // 如果 AI 调用了 showCode 但 Workbench 没打开 → 确认 P0-1 bug
      // 如果 AI 没调用 showCode → 跳过（AI 行为问题，非产品 bug）
      test.skip(!hasToolResult, 'AI 未调用 showCode 工具，无法验证 P0-1');

      // 如果到了这里，说明工具调用了但 Workbench 没打开 → P0-1 确认
      expect(wbVisible, 'P0-1: showCode 工具执行成功但 Workbench 未打开').toBe(true);
    }

    // 核心断言：Workbench 内容不是原始 JSON
    const rawJson = wb.locator('text=/^\\s*\\{.*"type".*"code".*\\}/');
    await expect(rawJson, '不应显示原始 JSON schema').not.toBeVisible();

    // 核心断言：应该有代码高亮（pre/code 标签或 Monaco editor）
    const codeElement = wb.locator('pre code, .monaco-editor, [class*="CodeEditor"], [class*="code-editor"]').first();
    await expect(codeElement, '应该有代码块或代码编辑器').toBeVisible({ timeout: 5000 });
  });

  test('S01-02 AI 展示表格 → 表格有行有列，不是 JSON 文本', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '请用 showTable 工具展示一个包含姓名、年龄、城市三列的示例表格，至少3行数据',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      const toolResults = page.locator('text=表格已展示');
      const hasToolResult = await toolResults.isVisible().catch(() => false);
      test.skip(!hasToolResult, 'AI 未调用 showTable 工具');
      expect(wbVisible, 'P0-1: showTable 工具执行成功但 Workbench 未打开').toBe(true);
    }

    // 核心断言：不是 JSON
    const rawJson = wb.locator('text=/^\\s*\\{.*"type".*"table".*\\}/');
    await expect(rawJson, '不应显示原始 JSON schema').not.toBeVisible();

    // 核心断言：应该有真实表格
    const table = wb.locator('table, .ant-table, [class*="DataTable"], [class*="data-table"]').first();
    await expect(table, '应该有表格元素').toBeVisible({ timeout: 5000 });

    // 验证表格有内容（至少有表头）
    const headerCells = wb.locator('th, .ant-table-thead .ant-table-cell, [class*="header"]');
    const headerCount = await headerCells.count();
    expect(headerCount, '表格应至少有1个表头').toBeGreaterThan(0);
  });

  test('S01-03 AI 展示图表 → 图表是 canvas/SVG 渲染，不是 JSON 文本', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '请用 showChart 工具展示一个柱状图，X轴是1月到6月，Y轴是销售额数据',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      const toolResults = page.locator('text=图表已展示');
      const hasToolResult = await toolResults.isVisible().catch(() => false);
      test.skip(!hasToolResult, 'AI 未调用 showChart 工具');
      expect(wbVisible, 'P0-1: showChart 工具执行成功但 Workbench 未打开').toBe(true);
    }

    // 核心断言：不是 JSON 文本（这就是你截图里看到的 bug）
    const rawJson = wb.locator('text=/\\{.*"chartType".*"option".*"series".*\\}/');
    const hasRawJson = await rawJson.isVisible().catch(() => false);
    expect(hasRawJson, 'P0-5: 图表渲染成了原始 JSON 文本').toBe(false);

    // 核心断言：应该有 ECharts canvas 或 SVG
    const chart = wb.locator('canvas, svg[class*="bindto"], [class*="echarts"], [_echarts_instance_]').first();
    await expect(chart, '应该有图表 canvas 或 SVG 元素').toBeVisible({ timeout: 5000 });
  });

  test('S01-04 AI 展示多 tab Workbench → 所有 tab 可切换且内容正确渲染', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '请用 workbench 工具创建一个包含两个标签页的展示：第一个标签页是一段Python代码，第二个标签页是一个数据表格',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 10000 });

    // 核心断言：至少有 2 个 tab
    const tabs = wb.locator('[role="tab"], .ant-tabs-tab, [class*="tab-item"], [class*="TabItem"]');
    const tabCount = await tabs.count();
    expect(tabCount, '应该至少有 2 个 tab').toBeGreaterThanOrEqual(2);

    // 核心断言：当前 tab 内容不是 JSON
    const rawJson = wb.locator('text=/^\\s*\\{.*"type".*\\}/');
    await expect(rawJson, 'tab 内容不应是原始 JSON').not.toBeVisible();

    // 切换到第二个 tab
    if (tabCount >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(1000);

      // 第二个 tab 也不应该是 JSON
      const rawJson2 = wb.locator('text=/^\\s*\\{.*"type".*\\}/');
      await expect(rawJson2, '第二个 tab 内容不应是原始 JSON').not.toBeVisible();
    }
  });
});

// ============================================================================
// 第二组：直接注入 Schema 验证渲染（不依赖 AI，100% 确定性）
// ============================================================================

test.describe('S01-B: Schema 注入渲染验证', () => {

  test('S01-05 注入 LineChart schema → 渲染为 canvas 图表', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 先创建一个 session
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('测试');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 通过浏览器控制台直接注入 workbench schema（新格式）
    const injectResult = await page.evaluate(() => {
      // @ts-ignore — 直接访问 Zustand store
      const workbenchStore = window.__zustand_stores?.workbench
        || (document.querySelector('[data-workbench-store]') as any)?.__store;

      // 尝试通过 React devtools 或全局引用找到 store
      // 如果找不到 store，尝试通过 socket 注入
      try {
        const stores = (window as any).__ZUSTAND_DEVTOOLS__ || {};
        for (const [key, store] of Object.entries(stores)) {
          if (key.includes('workbench') || key.includes('Workbench')) {
            const s = store as any;
            if (s.getState && s.getState().open) {
              s.getState().open({
                type: 'workbench',
                title: 'PM 测试图表',
                tabs: [{
                  key: 'chart-test',
                  title: '折线图测试',
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
              });
              return { injected: true, method: 'zustand-devtools' };
            }
          }
        }
      } catch (e) {
        // continue
      }

      return { injected: false, method: 'not-found' };
    });

    // 如果 Zustand store 不可直接访问，通过 UI 方式手动打开 workbench
    // 然后用 page.evaluate 找到 useWorkbenchStore
    if (!injectResult.injected) {
      // 备用方案：通过 evaluate 查找模块导出
      const injected2 = await page.evaluate(() => {
        // React 18 的 store 可能挂在 fiber 上，尝试另一种方式
        try {
          // 在 window 上查找所有可能的 store 引用
          const keys = Object.keys(window).filter(k =>
            k.toLowerCase().includes('store') ||
            k.toLowerCase().includes('zustand') ||
            k.startsWith('__')
          );
          return { keys, injected: false };
        } catch {
          return { keys: [], injected: false };
        }
      });

      // 如果无法注入 store，改为通过 socket 事件模拟
      // 跳过此测试，标记为"需要工程师协助暴露 store"
      test.skip(!injectResult.injected, '无法直接访问 Zustand WorkbenchStore，需要工程师在 window 上暴露 store 供测试使用（见执行指令）');
    }

    if (injectResult.injected) {
      await page.waitForTimeout(2000);

      const wb = page.locator('.workbench-container');
      await expect(wb).toBeVisible({ timeout: 5000 });

      // 核心断言：有 canvas（ECharts 渲染）
      const chart = wb.locator('canvas').first();
      await expect(chart, '应有 ECharts canvas').toBeVisible({ timeout: 5000 });

      // 核心断言：没有原始 JSON
      const rawJson = wb.locator('text=/LineChart|"xAxis"|"series"/');
      await expect(rawJson, '不应显示原始 JSON/类型名').not.toBeVisible();
    }
  });

  test('S01-06 注入旧格式 chart schema → transformer 正确转换并渲染', async ({ page }) => {
    // 此测试验证 P0-5：旧格式 schema 能否被 schema-transformer 正确转换
    test.skip(true, '依赖 S01-05 的 store 注入机制，待 S01-05 跑通后启用');
  });
});

// ============================================================================
// 第三组：验证 Workbench 校验容错性
// ============================================================================

test.describe('S01-C: Workbench 校验容错', () => {

  test('S01-07 AI 生成的 schema 有小瑕疵时不应整体拒绝', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 让 AI 生成复杂的 workbench（多 tab，增加出现校验 warning 的概率）
    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '请用 workbench 工具创建一个包含5个标签页的展示：代码、表格、图表、Markdown文档、JSON数据',
      { timeout: 120000, retries: 2 },
    );
    expect(hasResponse).toBe(true);
    await page.waitForTimeout(3000);

    // 检查 Workbench 是否打开
    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    // 检查控制台是否有校验相关的 warning/error
    // （test-base 的 consoleErrors fixture 会收集）
    // 如果 Workbench 没打开但 AI 确实调用了 workbench 工具 → P0-4 或 P0-1

    if (!wbVisible) {
      // 检查是否有工具调用成功的迹象
      const fullText = await page.locator('main').innerText();
      const mentionsWorkbench = fullText.includes('Workbench') || fullText.includes('工作台') || fullText.includes('展示');

      if (mentionsWorkbench) {
        // AI 声称创建了 workbench 但面板没打开 → bug
        expect(wbVisible, 'AI 声称创建了 Workbench 但面板未打开（P0-1 或 P0-4）').toBe(true);
      } else {
        test.skip(true, 'AI 未尝试创建 Workbench');
      }
    } else {
      // Workbench 打开了 — 验证至少有一些 tab 可用
      const tabs = wb.locator('[role="tab"], .ant-tabs-tab, [class*="tab-item"]');
      const tabCount = await tabs.count();
      expect(tabCount, 'Workbench 打开但 tab 数量为 0').toBeGreaterThan(0);

      // 至少能看到一个 tab 的实际内容（非空白/非错误）
      const content = wb.locator('.workbench-content, [class*="tab-content"], [class*="TabContent"]').first();
      if (await content.isVisible().catch(() => false)) {
        const text = await content.innerText().catch(() => '');
        expect(text.length, '第一个 tab 内容不应为空').toBeGreaterThan(0);
      }
    }
  });
});
