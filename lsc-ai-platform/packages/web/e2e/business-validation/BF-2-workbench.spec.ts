/**
 * BF-2：Workbench 数据可视化 — 数据采集
 *
 * 用户故事：生产经理想看数据分析结果，希望 AI 用表格、图表展示。
 * 通过标准：≥ 4/5（由 PM 判定）
 *
 * 关键观察：如果 AI 返回的是 Markdown 文本表格而不是 Workbench 面板，记为不通过。
 * PM 确认：允许重试一次，两次结果都记录。
 */
import { test, expect } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';
import { closeWorkbench } from '../helpers/workbench.helper';

test.describe.serial('BF-2 Workbench 数据可视化', () => {
  test('BF-2 数据采集', async ({ page }) => {
    test.setTimeout(900_000); // 15 分钟
    const collector = new BFCollector(page, 'BF-2', 'Workbench 数据可视化');

    try {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ==================== BF-2.1 表格展示 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-2.1',
        '用表格展示以下数据：2024年每个季度的销售额分别是120万、150万、180万、200万',
        { timeout: 120_000, expectWorkbench: true },
      );

      // 检查 Workbench 是否打开
      const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
      const hasTable = await page.locator('table, .ant-table').isVisible().catch(() => false);
      result.notes += ` Workbench可见=${wbVisible} 表格可见=${hasTable}`;

      // 如果 Workbench 未打开，PM 允许重试一次
      if (!wbVisible) {
        console.log('[BF-2.1] Workbench 未打开，等待后重试');
        await page.waitForTimeout(30_000);

        const retryResult = await collector.sendAndCollect(
          'BF-2.1-retry',
          '请用工作台的表格展示以下数据：2024年每个季度的销售额分别是120万、150万、180万、200万',
          { timeout: 120_000, expectWorkbench: true },
        );

        const retryWb = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        const retryTable = await page.locator('table, .ant-table').isVisible().catch(() => false);
        retryResult.notes += ` [重试] Workbench可见=${retryWb} 表格可见=${retryTable}`;
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== BF-2.2 柱状图 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-2.2',
        '用柱状图展示上面的季度销售数据',
        { timeout: 120_000, expectWorkbench: true },
      );

      const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
      const hasChart = await page.locator('canvas, [class*="echarts"]').isVisible().catch(() => false);
      result.notes += ` Workbench可见=${wbVisible} 图表可见=${hasChart}`;

      if (!wbVisible) {
        await page.waitForTimeout(30_000);
        const retryResult = await collector.sendAndCollect(
          'BF-2.2-retry',
          '请用工作台的柱状图展示2024年四个季度的销售额：Q1=120万，Q2=150万，Q3=180万，Q4=200万',
          { timeout: 120_000, expectWorkbench: true },
        );
        const retryWb = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        retryResult.notes += ` [重试] Workbench可见=${retryWb}`;
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== BF-2.3 代码展示 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-2.3',
        '展示一段 Python 快速排序的代码',
        { timeout: 120_000, expectWorkbench: true },
      );

      const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
      const hasCode = await page.locator('.monaco-editor').isVisible().catch(() => false);
      result.notes += ` Workbench可见=${wbVisible} 代码编辑器可见=${hasCode}`;

      if (!wbVisible) {
        await page.waitForTimeout(30_000);
        const retryResult = await collector.sendAndCollect(
          'BF-2.3-retry',
          '请在工作台中用代码编辑器展示一段 Python 快速排序代码',
          { timeout: 120_000, expectWorkbench: true },
        );
        const retryWb = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        retryResult.notes += ` [重试] Workbench可见=${retryWb}`;
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== BF-2.4 多 Tab 展示 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-2.4',
        '用工作台同时展示：1.一个季度销售表格 2.对应的折线图 3.分析总结',
        { timeout: 120_000, expectWorkbench: true },
      );

      const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
      const tabCount = await page.locator(SEL.workbench.tab).count().catch(() => 0);
      result.notes += ` Workbench可见=${wbVisible} Tab数量=${tabCount}`;

      if (!wbVisible) {
        await page.waitForTimeout(30_000);
        const retryResult = await collector.sendAndCollect(
          'BF-2.4-retry',
          '请在工作台中用多个标签页同时展示：第一个标签页放季度销售数据表格，第二个标签页放对应的折线图，第三个标签页放分析总结',
          { timeout: 120_000, expectWorkbench: true },
        );
        const retryWb = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        const retryTabs = await page.locator(SEL.workbench.tab).count().catch(() => 0);
        retryResult.notes += ` [重试] Workbench可见=${retryWb} Tab数量=${retryTabs}`;
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== BF-2.5 关闭→重新打开 ====================
    {
      // 关闭 Workbench
      await closeWorkbench(page);
      await page.waitForTimeout(2000);

      const closedOk = !(await page.locator(SEL.workbench.container).isVisible().catch(() => false));

      // 发送重新展示请求
      const result = await collector.sendAndCollect(
        'BF-2.5',
        '重新展示刚才的表格',
        { timeout: 120_000, expectWorkbench: true },
      );

      const reopened = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
      result.notes += ` 关闭成功=${closedOk} 重新打开=${reopened}`;

      if (!reopened) {
        await page.waitForTimeout(30_000);
        const retryResult = await collector.sendAndCollect(
          'BF-2.5-retry',
          '请用工作台重新展示一个季度销售额的表格',
          { timeout: 120_000, expectWorkbench: true },
        );
        const retryWb = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        retryResult.notes += ` [重试] Workbench可见=${retryWb}`;
      }
    }

    } finally {
      // 确保报告不因超时丢失
      collector.saveReport();
    }
  });
});
