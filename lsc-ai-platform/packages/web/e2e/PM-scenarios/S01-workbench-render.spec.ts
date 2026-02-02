/**
 * 场景 S01: Workbench 渲染正确性（V2 — 修正选择器 + 改进测试设计）
 *
 * 产品经理编写 — 工程师只管执行，不得修改 expect 断言。
 * 如需调整选择器或等待时间，在 pm-engineer-chat.md 中说明原因。
 *
 * 测试目标：验证 Workbench 能否正确渲染各种内容类型。
 * 覆盖审计发现：P0-1, P0-4, P0-5, P1-F3
 *
 * V2 变更（基于 S01-A 首轮执行结果）：
 * - 修正 tab 选择器：.workbench-tab（实际 DOM 结构）
 * - S01-01/02/03 不再要求 AI 调用特定工具名，改为验证"AI 使用 workbench 后渲染是否正确"
 * - 新增 S01-08：不依赖 AI，通过 page.evaluate 直接模拟 socket workbench:update 事件
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// ============================================================================
// 第一组：AI 触发 Workbench，验证渲染结果
// 不要求 AI 调用特定工具，只关注"Workbench 打开后内容对不对"
// ============================================================================

test.describe('S01-A: AI 触发 Workbench 内容渲染', () => {

  test('S01-01 AI 展示代码 → Workbench 里有代码高亮，不是 JSON 文本', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '在工作台中展示一段 Python 快速排序算法的代码',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      // 检查 AI 是否尝试了但 Workbench 没打开
      const mainText = await page.locator('main').innerText();
      const aiTriedWorkbench = mainText.includes('Workbench') ||
        mainText.includes('工作台') ||
        mainText.includes('展示') ||
        mainText.includes('Schema');

      if (aiTriedWorkbench) {
        // AI 尝试了但面板没打开 → 产品 bug（P0-1 或 P0-4）
        expect(wbVisible, 'AI 尝试创建 Workbench 但面板未打开（P0-1 或 P0-4）').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench，跳过');
      }
    }

    // ===== 核心断言 =====

    // 1. Workbench 内容不是原始 JSON
    const wbText = await wb.innerText();
    const looksLikeRawJson = wbText.includes('"type"') && wbText.includes('"code"') && wbText.startsWith('{');
    expect(looksLikeRawJson, '不应显示原始 JSON schema 文本').toBe(false);

    // 2. 应该有代码编辑器或代码高亮块
    const codeElement = wb.locator('pre code, .monaco-editor, [class*="CodeEditor"], [class*="code-editor"], .cm-editor').first();
    await expect(codeElement, '应该有代码块或代码编辑器').toBeVisible({ timeout: 5000 });
  });

  test('S01-02 AI 展示表格 → Workbench 里有真实表格，不是 JSON 文本', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '在工作台中用表格展示以下数据：张三 25岁 北京，李四 30岁 上海，王五 28岁 广州',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      const mainText = await page.locator('main').innerText();
      const aiTriedWorkbench = mainText.includes('Workbench') || mainText.includes('工作台') || mainText.includes('表格');
      if (aiTriedWorkbench) {
        expect(wbVisible, 'AI 尝试创建表格但 Workbench 未打开').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench，跳过');
      }
    }

    // ===== 核心断言 =====

    // 1. 不是原始 JSON
    const wbText = await wb.innerText();
    const looksLikeRawJson = wbText.includes('"headers"') && wbText.includes('"rows"');
    expect(looksLikeRawJson, '不应显示原始 JSON（headers/rows）').toBe(false);

    // 2. 应该有表格元素
    const table = wb.locator('table, .ant-table, [class*="DataTable"], [class*="data-table"]').first();
    await expect(table, '应该有表格元素').toBeVisible({ timeout: 5000 });
  });

  test('S01-03 AI 展示图表 → Workbench 里有 canvas/SVG，不是 JSON 文本', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '在工作台中画一个柱状图，展示2024年1月到6月的销售额：150万 200万 180万 250万 220万 300万',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    if (!wbVisible) {
      const mainText = await page.locator('main').innerText();
      const aiTriedWorkbench = mainText.includes('Workbench') || mainText.includes('工作台') || mainText.includes('图表') || mainText.includes('柱状图');
      if (aiTriedWorkbench) {
        expect(wbVisible, 'AI 尝试创建图表但 Workbench 未打开').toBe(true);
      } else {
        test.skip(true, 'AI 未使用 Workbench，跳过');
      }
    }

    // ===== 核心断言（这就是你截图里看到的 bug 场景）=====

    // 1. 不是 JSON 文本
    const wbText = await wb.innerText();
    const looksLikeChartJson = wbText.includes('"chartType"') || wbText.includes('"series"') && wbText.includes('"option"');
    expect(looksLikeChartJson, 'P0-5: 图表渲染成了原始 JSON 文本').toBe(false);

    // 2. 应该有 ECharts canvas 或 SVG
    const chart = wb.locator('canvas, [_echarts_instance_], [class*="echarts"]').first();
    await expect(chart, '应该有图表 canvas 元素').toBeVisible({ timeout: 5000 });
  });

  test('S01-04 AI 多 tab Workbench → tab 可切换，每个 tab 内容正确', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse } = await sendAndWaitWithRetry(
      page,
      '在工作台中创建两个标签页：第一个标签页展示一段Python代码，第二个标签页展示一个数据表格',
      { timeout: 90000, retries: 2 },
    );
    expect(hasResponse).toBe(true);
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 10000 });

    // ===== 核心断言（修正选择器：实际 DOM 是 div.workbench-tab）=====

    // 1. 至少有 2 个 tab
    const tabs = wb.locator('.workbench-tab');
    const tabCount = await tabs.count();
    expect(tabCount, '应该至少有 2 个 tab').toBeGreaterThanOrEqual(2);

    // 2. 当前 tab 内容不是 JSON
    const wbText = await wb.innerText();
    const looksLikeRawSchema = wbText.includes('"type":') && wbText.includes('"blocks"');
    expect(looksLikeRawSchema, 'tab 内容不应是原始 JSON schema').toBe(false);

    // 3. 切换到第二个 tab
    await tabs.nth(1).click();
    await page.waitForTimeout(1000);

    // 第二个 tab 也不应该是 JSON
    const wbText2 = await wb.innerText();
    const looksLikeRawSchema2 = wbText2.includes('"type":') && wbText2.includes('"blocks"');
    expect(looksLikeRawSchema2, '第二个 tab 内容不应是原始 JSON schema').toBe(false);
  });
});

// ============================================================================
// 第二组：通过模拟 socket 事件注入 Schema（不依赖 AI，100% 确定性）
// 这组测试不需要 AI，直接验证渲染器是否工作
// ============================================================================

test.describe('S01-B: Socket 事件注入渲染验证', () => {

  /**
   * 工程师前置准备：
   * 在 packages/web/src/main.tsx 中添加（仅 DEV 环境）：
   *
   * if (import.meta.env.DEV) {
   *   import('./components/workbench/context/WorkbenchStore').then(mod => {
   *     (window as any).__workbenchStore = mod.useWorkbenchStore;
   *   });
   * }
   */

  test('S01-05 注入新格式 LineChart → canvas 图表渲染', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 先发一条消息创建 session（workbench 需要 session 才能渲染，见 BUG-1）
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // 通过 window.__workbenchStore 注入 schema
    const injected = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (!store || !store.getState) return { success: false, reason: 'store not found' };

      try {
        store.getState().open({
          type: 'workbench',
          title: 'PM 测试 — 折线图',
          tabs: [{
            key: 'chart-test-1',
            title: '销售趋势',
            components: [{
              type: 'LineChart',
              title: '月度销售趋势 2024',
              xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
              series: [
                { name: '销售额', data: [120, 200, 150, 280, 220, 310] },
                { name: '利润', data: [50, 80, 60, 120, 90, 150] },
              ],
            }],
          }],
        });
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    });

    if (!injected.success) {
      test.skip(true, `无法注入 Store: ${injected.reason}。请确认已在 main.tsx 中暴露 __workbenchStore`);
      return;
    }

    await page.waitForTimeout(2000);

    const wb = page.locator('.workbench-container');
    await expect(wb, 'Workbench 应在注入后打开').toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 有 canvas（ECharts 渲染的图表）
    const canvas = wb.locator('canvas').first();
    await expect(canvas, '应有 ECharts canvas').toBeVisible({ timeout: 5000 });

    // 2. 没有原始 JSON / 类型名泄露
    const wbText = await wb.innerText();
    expect(wbText.includes('"LineChart"'), '不应显示 "LineChart" 类型名').toBe(false);
    expect(wbText.includes('"xAxis"'), '不应显示 "xAxis" JSON key').toBe(false);
  });

  test('S01-06 注入新格式 DataTable → 表格渲染', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const injected = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (!store || !store.getState) return { success: false, reason: 'store not found' };

      try {
        store.getState().open({
          type: 'workbench',
          title: 'PM 测试 — 数据表格',
          tabs: [{
            key: 'table-test-1',
            title: '员工数据',
            components: [{
              type: 'DataTable',
              title: '员工信息表',
              headers: ['姓名', '年龄', '城市', '职位'],
              rows: [
                ['张三', '25', '北京', '工程师'],
                ['李四', '30', '上海', '设计师'],
                ['王五', '28', '广州', '产品经理'],
              ],
            }],
          }],
        });
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    });

    if (!injected.success) {
      test.skip(true, `无法注入 Store: ${injected.reason}`);
      return;
    }

    await page.waitForTimeout(2000);

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 有表格
    const table = wb.locator('table, .ant-table, [class*="DataTable"]').first();
    await expect(table, '应有表格元素').toBeVisible({ timeout: 5000 });

    // 2. 表格有数据（至少能看到"张三"）
    const cellWithData = wb.locator('text=张三');
    await expect(cellWithData, '表格应包含注入的数据"张三"').toBeVisible({ timeout: 3000 });
  });

  test('S01-07 注入旧格式 chart schema → transformer 转换后渲染', async ({ page }) => {
    // 验证 P0-5：旧格式 { version: "1.0", blocks: [{ type: "chart" }] } 能否被正确转换
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // 注入旧格式 — 这是 server workbench 工具实际输出的格式
    const injected = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (!store || !store.getState) return { success: false, reason: 'store not found' };

      try {
        // 模拟 ensureNewSchema + open 的完整路径
        // 旧格式需要经过 schema-transformer 转换
        store.getState().open({
          version: '1.0',
          title: '旧格式图表测试',
          blocks: [{
            type: 'chart',
            chartType: 'bar',
            title: '月度销售',
            option: {
              xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月'] },
              yAxis: { type: 'value' },
              series: [{ data: [120, 200, 150, 280], type: 'bar', name: '销售额' }],
            },
          }],
        });
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    });

    if (!injected.success) {
      test.skip(true, `无法注入 Store: ${injected.reason}`);
      return;
    }

    await page.waitForTimeout(2000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    // ===== 核心断言 =====

    if (!wbVisible) {
      // 旧格式 schema 被拒绝了 → P0-4（校验过严）或 P0-5（转换失败）
      expect(wbVisible, 'P0-4/P0-5: 旧格式 schema 注入后 Workbench 未打开').toBe(true);
    }

    // 不应该显示原始 JSON
    const wbText = await wb.innerText();
    const hasRawJson = wbText.includes('"chartType"') || wbText.includes('"option"');
    expect(hasRawJson, 'P0-5: 旧格式图表渲染成了 JSON 文本').toBe(false);

    // 应该有 canvas 图表
    const canvas = wb.locator('canvas').first();
    await expect(canvas, '旧格式图表应转换后渲染为 canvas').toBeVisible({ timeout: 5000 });
  });

  test('S01-08 注入多 tab 混合内容 → 所有 tab 正确渲染', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const injected = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (!store || !store.getState) return { success: false, reason: 'store not found' };

      try {
        store.getState().open({
          type: 'workbench',
          title: 'PM 综合测试',
          tabs: [
            {
              key: 'tab-code',
              title: '代码示例',
              components: [{
                type: 'CodeEditor',
                title: 'Python 示例',
                language: 'python',
                code: 'def hello():\n    print("Hello World")\n\nhello()',
              }],
            },
            {
              key: 'tab-table',
              title: '数据表格',
              components: [{
                type: 'DataTable',
                headers: ['产品', '销量', '金额'],
                rows: [['商品A', '100', '5000'], ['商品B', '200', '10000']],
              }],
            },
            {
              key: 'tab-chart',
              title: '销售图表',
              components: [{
                type: 'BarChart',
                title: '季度销售',
                xAxis: ['Q1', 'Q2', 'Q3', 'Q4'],
                series: [{ name: '销售额', data: [300, 450, 380, 520] }],
              }],
            },
          ],
        });
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    });

    if (!injected.success) {
      test.skip(true, `无法注入 Store: ${injected.reason}`);
      return;
    }

    await page.waitForTimeout(2000);

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // ===== 核心断言 =====

    // 1. 有 3 个 tab
    const tabs = wb.locator('.workbench-tab');
    const tabCount = await tabs.count();
    expect(tabCount, '应有 3 个 tab').toBe(3);

    // 2. 第一个 tab（代码）— 验证有代码编辑器
    // 默认应该显示第一个 tab
    const codeElement = wb.locator('pre code, .monaco-editor, [class*="CodeEditor"], .cm-editor').first();
    await expect(codeElement, 'Tab 1 应有代码编辑器').toBeVisible({ timeout: 5000 });

    // 3. 切到第二个 tab（表格）— 验证有表格
    await tabs.nth(1).click();
    await page.waitForTimeout(1000);
    const table = wb.locator('table, .ant-table, [class*="DataTable"]').first();
    await expect(table, 'Tab 2 应有表格').toBeVisible({ timeout: 5000 });

    // 4. 切到第三个 tab（图表）— 验证有 canvas
    await tabs.nth(2).click();
    await page.waitForTimeout(1000);
    const canvas = wb.locator('canvas').first();
    await expect(canvas, 'Tab 3 应有图表 canvas').toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// 第三组：Workbench 校验容错性
// ============================================================================

test.describe('S01-C: Workbench 校验容错', () => {

  test('S01-09 schema 部分组件有瑕疵时不应整体拒绝', async ({ page }) => {
    // 直接注入一个 "有瑕疵" 的 schema — 5 个 tab 中 1 个类型不存在
    test.setTimeout(60000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const injected = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (!store || !store.getState) return { success: false, reason: 'store not found' };

      try {
        store.getState().open({
          type: 'workbench',
          title: '容错测试',
          tabs: [
            {
              key: 'good-tab-1',
              title: '正常代码',
              components: [{
                type: 'CodeEditor',
                language: 'javascript',
                code: 'console.log("hello")',
              }],
            },
            {
              key: 'bad-tab',
              title: '异常组件',
              components: [{
                type: 'NonExistentComponent',  // 不存在的组件类型
                data: 'test',
              }],
            },
            {
              key: 'good-tab-2',
              title: '正常表格',
              components: [{
                type: 'DataTable',
                headers: ['A', 'B'],
                rows: [['1', '2']],
              }],
            },
          ],
        });
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    });

    if (!injected.success) {
      test.skip(true, `无法注入 Store: ${injected.reason}`);
      return;
    }

    await page.waitForTimeout(2000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    // ===== 核心断言 =====

    // P0-4：即使有一个坏组件，其余正常 tab 也应该显示
    expect(wbVisible, 'P0-4: 一个坏组件不应导致整个 Workbench 拒绝打开').toBe(true);

    if (wbVisible) {
      // 至少应该有 2 个可用 tab（2 个好的）
      const tabs = wb.locator('.workbench-tab');
      const tabCount = await tabs.count();
      expect(tabCount, '至少应有 2 个正常 tab（坏的可以被过滤）').toBeGreaterThanOrEqual(2);
    }
  });
});
