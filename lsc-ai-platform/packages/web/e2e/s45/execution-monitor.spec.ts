/**
 * M4: Execution Monitor E2E Tests
 *
 * 测试执行监控 Tab 的完整功能：
 * - Tab 加载与切换
 * - 队列状态统计卡片
 * - ECharts 趋势图渲染
 * - Dashboard API 返回结构验证
 * - 最近执行日志列表
 */
import { test, expect } from '../fixtures/test-base';

const BASE_API = 'http://localhost:3000/api';

test.describe('M4: Execution Monitor', () => {
  // ──────────────────────────────────────────────
  // EM-1: Tab 加载
  // ──────────────────────────────────────────────
  test('EM-1 Tab 加载 — 导航到 /tasks 并切换到执行监控 Tab', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // 验证 Tasks 页面标题
    const heading = page.locator('h1:has-text("自动化任务中心")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 验证三个 Tab 存在
    await expect(page.locator('.ant-tabs-tab:has-text("定时任务")')).toBeVisible();
    await expect(page.locator('.ant-tabs-tab:has-text("自动化流程")')).toBeVisible();
    await expect(page.locator('.ant-tabs-tab:has-text("执行监控")')).toBeVisible();

    // 点击"执行监控" Tab
    await page.locator('.ant-tabs-tab:has-text("执行监控")').click();
    await page.waitForTimeout(1000);

    // 验证 Tab 激活
    const activeTab = page.locator('.ant-tabs-tab-active:has-text("执行监控")');
    await expect(activeTab).toBeVisible();

    // 验证刷新按钮存在（用 .ant-btn 避免匹配侧边栏会话预览中的"刷新"文字）
    const refreshButton = page.locator('.ant-btn:has-text("刷新")');
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
  });

  // ──────────────────────────────────────────────
  // EM-2: 队列状态卡片
  // ──────────────────────────────────────────────
  test('EM-2 队列状态卡片 — 验证统计卡片展示', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // 切换到执行监控 Tab
    await page.locator('.ant-tabs-tab:has-text("执行监控")').click();
    await page.waitForTimeout(2000);

    // 验证 4 个队列状态卡片存在（用 .ant-statistic-title 限定范围，避免匹配表格中的状态文字）
    await expect(page.locator('.ant-statistic-title:has-text("等待中")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.ant-statistic-title:has-text("执行中")')).toBeVisible();
    await expect(page.locator('.ant-statistic-title:has-text("已完成")')).toBeVisible();
    await expect(page.locator('.ant-statistic-title:has-text("失败")')).toBeVisible();

    // 验证每个卡片有数字统计值
    const statValues = page.locator('.ant-statistic-content-value');
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // 每个数字应该是有效的数值（>=0）
    for (let i = 0; i < Math.min(count, 4); i++) {
      const text = await statValues.nth(i).textContent();
      expect(text).not.toBeNull();
      const num = parseInt(text?.replace(/,/g, '') || '0');
      expect(num).toBeGreaterThanOrEqual(0);
    }
  });

  // ──────────────────────────────────────────────
  // EM-3: 趋势图
  // ──────────────────────────────────────────────
  test('EM-3 趋势图 — 验证 ECharts 容器渲染', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // 切换到执行监控 Tab
    await page.locator('.ant-tabs-tab:has-text("执行监控")').click();
    await page.waitForTimeout(2000);

    // 验证 "执行趋势" 区域标题存在
    await expect(page.locator('h3:has-text("执行趋势"), div:has-text("执行趋势")').first()).toBeVisible({ timeout: 15000 });

    // 验证 ECharts 容器存在（echarts-for-react 渲染为 div[_echarts_instance_]）
    const chartContainer = page.locator('.echarts-for-react').first();
    await expect(chartContainer).toBeVisible({ timeout: 10000 });

    // 验证 "运行健康度" 区域存在
    await expect(page.locator('text=运行健康度')).toBeVisible();

    // 验证成功率 Progress 组件（用 role=progressbar 精确匹配）
    const progressCircle = page.getByRole('progressbar');
    await expect(progressCircle).toBeVisible({ timeout: 5000 });
  });

  // ──────────────────────────────────────────────
  // EM-4: Dashboard API
  // ──────────────────────────────────────────────
  test('EM-4 Dashboard API — 验证 /workflows/dashboard 返回有效结构', async ({ page, api }) => {
    const token = api.getToken();

    // 直接调用 Dashboard API
    const res = await page.request.get(`${BASE_API}/workflows/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();

    const data = await res.json();
    // 处理可能的双层 data 包裹
    const dashboard = data?.data || data;

    // 验证 queue 字段
    expect(dashboard).toHaveProperty('queue');
    expect(dashboard.queue).toHaveProperty('waiting');
    expect(dashboard.queue).toHaveProperty('active');
    expect(dashboard.queue).toHaveProperty('completed');
    expect(dashboard.queue).toHaveProperty('failed');
    expect(typeof dashboard.queue.waiting).toBe('number');
    expect(typeof dashboard.queue.active).toBe('number');

    // 验证 trend 字段
    expect(dashboard).toHaveProperty('trend');
    expect(dashboard.trend).toHaveProperty('labels');
    expect(dashboard.trend).toHaveProperty('success');
    expect(dashboard.trend).toHaveProperty('failed');
    expect(Array.isArray(dashboard.trend.labels)).toBeTruthy();
    expect(Array.isArray(dashboard.trend.success)).toBeTruthy();

    // 验证 health 字段
    expect(dashboard).toHaveProperty('health');
    expect(dashboard.health).toHaveProperty('successRate');
    expect(dashboard.health).toHaveProperty('avgDuration');
    expect(dashboard.health).toHaveProperty('totalExecutions');
    expect(typeof dashboard.health.successRate).toBe('number');

    // 验证 recentLogs 字段
    expect(dashboard).toHaveProperty('recentLogs');
    expect(Array.isArray(dashboard.recentLogs)).toBeTruthy();
  });

  // ──────────────────────────────────────────────
  // EM-5: 最近执行日志
  // ──────────────────────────────────────────────
  test('EM-5 最近执行日志 — 验证最近执行列表区域', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // 切换到执行监控 Tab
    await page.locator('.ant-tabs-tab:has-text("执行监控")').click();
    await page.waitForTimeout(2000);

    // 验证 "最近执行记录" 标题
    await expect(page.locator('text=最近执行记录')).toBeVisible({ timeout: 15000 });

    // 验证表格区域存在
    const logTable = page.locator('.ant-table').last();
    await expect(logTable).toBeVisible({ timeout: 10000 });

    // 验证表格有必要的列头
    const tableHeader = logTable.locator('.ant-table-thead');
    await expect(tableHeader).toBeVisible();
    await expect(tableHeader.locator('text=任务名称')).toBeVisible();
    await expect(tableHeader.locator('text=状态')).toBeVisible();
    await expect(tableHeader.locator('text=开始时间')).toBeVisible();

    // 表格可能有数据，也可能为空，两者都是有效状态
    const rowCount = await logTable.locator('.ant-table-row').count();
    const emptyState = logTable.locator('.ant-empty');
    // 至少满足其一：有数据行或显示空态
    const hasRows = rowCount > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasRows || hasEmpty).toBeTruthy();
  });
});
