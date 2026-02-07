/**
 * Phase 3 测试 1：BF-2 回归验证
 *
 * 目的：验证 showTable/showChart/showCode 在不传 actions 时仍然正常渲染。
 * 方法：通过 Store 注入（不依赖 AI）验证纯渲染能力。
 *
 * PM 要求：这是回归底线，必须全部通过。
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import {
  ensureSession,
  injectSchema,
  closeWorkbench,
  clearWorkbench,
  TestSchemas,
} from '../helpers/workbench.helper';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../bf-reports/screenshots/p3');
fs.mkdirSync(screenshotDir, { recursive: true });

test.describe.serial('P3-1 BF-2 回归：无 actions 的 Workbench 渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await ensureSession(page);
    // 清除前一个测试可能残留的 Workbench 状态
    await clearWorkbench(page);
  });

  test('P3-1.1 DataTable 无 actions — 表格正常渲染', async ({ page }) => {
    test.setTimeout(60_000);

    const schema = TestSchemas.dataTable();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    // 验证 Workbench 打开
    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 验证表格存在
    const table = page.locator('.ant-table').first();
    await expect(table).toBeVisible({ timeout: 5000 });

    // 验证无 Button 组件（因为没传 actions）
    const buttons = page.locator('[data-testid="workbench-container"] button:not([class*="tab"])');
    const buttonTexts = await buttons.allTextContents();
    const actionButtons = buttonTexts.filter(t => t.includes('导出') || t.includes('分析'));
    expect(actionButtons.length).toBe(0);

    await page.screenshot({ path: path.join(screenshotDir, 'P3-1.1-table-no-actions.png'), fullPage: true });
  });

  test('P3-1.2 BarChart 无 actions — 图表正常渲染', async ({ page }) => {
    test.setTimeout(60_000);

    const schema = TestSchemas.barChart();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 验证图表 canvas 存在
    const chart = page.locator('canvas, [class*="echarts"], [class*="Chart"]');
    await expect(chart.first()).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: path.join(screenshotDir, 'P3-1.2-chart-no-actions.png'), fullPage: true });
  });

  test('P3-1.3 CodeEditor 无 actions — 代码正常渲染', async ({ page }) => {
    test.setTimeout(60_000);

    const schema = TestSchemas.codeEditor();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // Monaco Editor 是懒加载的，需要更长时间
    // 检查 CodeEditor 组件或 Monaco 实例
    const codeEditor = page.locator('.monaco-editor, [class*="CodeEditor"], [class*="code-editor"]').first();
    await expect(codeEditor).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: path.join(screenshotDir, 'P3-1.3-code-no-actions.png'), fullPage: true });
  });

  test('P3-1.4 多 Tab 无 actions — 多标签页渲染', async ({ page }) => {
    test.setTimeout(60_000);

    const schema = TestSchemas.multiTab();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 验证多个 Tab 存在（Ant Design Tabs 渲染为 .ant-tabs-tab）
    const antTabs = page.locator('.ant-tabs-tab');
    const antTabCount = await antTabs.count().catch(() => 0);

    // 也检查 data-testid 格式的 tab
    const customTabs = page.locator(SEL.workbench.tab);
    const customTabCount = await customTabs.count().catch(() => 0);

    const totalTabs = Math.max(antTabCount, customTabCount);
    console.log(`[P3-1.4] ant-tabs-tab: ${antTabCount}, custom-tab: ${customTabCount}`);
    expect(totalTabs).toBeGreaterThanOrEqual(2);

    // 验证 Workbench 内有实际内容（不是空白）
    const wbContent = await wb.textContent();
    expect(wbContent).toBeTruthy();
    expect(wbContent!.length).toBeGreaterThan(10);

    // 尝试点击第二个 Tab（使用任一可用的 tab 选择器）
    const tabsToUse = antTabCount >= 2 ? antTabs : customTabs;
    if (await tabsToUse.count() >= 2) {
      await tabsToUse.nth(1).click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: path.join(screenshotDir, 'P3-1.4-multitab-no-actions.png'), fullPage: true });
  });

  test('P3-1.5 旧格式 blocks — ensureNewSchema 正确转换', async ({ page }) => {
    test.setTimeout(60_000);

    const schema = TestSchemas.oldFormat();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 旧格式的 chart block 应转换为图表
    const chart = page.locator('canvas, [class*="echarts"], [class*="Chart"]');
    await expect(chart.first()).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: path.join(screenshotDir, 'P3-1.5-old-format-compat.png'), fullPage: true });
  });
});
