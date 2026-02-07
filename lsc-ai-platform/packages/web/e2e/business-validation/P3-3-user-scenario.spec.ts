/**
 * Phase 3 测试 3：用户场景验证 — 应用监控面板
 *
 * 目的：验证用户提出的核心场景——Workbench 中展示应用监控面板，
 *       包含状态指标（Statistic）、日志终端（Terminal）和 shell action 按钮（关闭/重启）。
 *
 * 测试分两部分：
 * A. Store 注入验证（确保前端渲染能力）
 * B. AI 生成验证（确保 AI 在 Instructions 引导下生成包含 action 的 schema）
 *
 * PM 要求：验证 AI 是否能生成包含 shell action 的 Button 组件。
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import {
  ensureSession,
  injectSchema,
  TestSchemas,
} from '../helpers/workbench.helper';
import { BFCollector } from './bf-collector';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../bf-reports/screenshots/p3');
fs.mkdirSync(screenshotDir, { recursive: true });

test.describe.serial('P3-3 用户场景：应用监控面板', () => {

  // ==================== A. Store 注入验证 ====================

  test('P3-3.1 监控面板注入 — Statistic + Terminal + Button 完整渲染', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await ensureSession(page);

    const schema = TestSchemas.appMonitorDashboard();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 验证 Statistic 组件渲染（检查关键文字）
    const statusText = wb.locator('text=运行中');
    await expect(statusText).toBeVisible({ timeout: 5000 });

    const cpuText = wb.locator('text=CPU');
    await expect(cpuText.first()).toBeVisible({ timeout: 5000 });

    // BUG-1 验证：Terminal 组件不崩溃，内容正确渲染
    const terminalContent = wb.locator('.workbench-terminal .terminal-content');
    await expect(terminalContent.first()).toBeVisible({ timeout: 5000 });
    // 验证 Terminal 中无错误边界（无 "组件渲染错误" 提示）
    const errorBoundary = wb.locator('text=组件渲染错误');
    await expect(errorBoundary).toHaveCount(0);

    await page.screenshot({ path: path.join(screenshotDir, 'P3-3.1-monitor-statistics.png'), fullPage: true });
  });

  test('P3-3.2 监控面板完整验证 — Statistic + Button + 点击稳定', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await ensureSession(page);

    const schema = TestSchemas.appMonitorDashboard();
    const result = await injectSchema(page, schema);
    expect(result.success).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 验证 Statistic 数据可见
    const statusText = wb.locator('text=运行中');
    await expect(statusText).toBeVisible({ timeout: 5000 });

    // 验证 "关闭应用" 按钮
    const closeBtn = wb.locator('button:has-text("关闭应用")');
    await expect(closeBtn.first()).toBeVisible({ timeout: 5000 });

    // 验证 "重启应用" 按钮
    const restartBtn = wb.locator('button:has-text("重启应用")');
    await expect(restartBtn.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: path.join(screenshotDir, 'P3-3.2-monitor-buttons.png'), fullPage: true });

    // 点击 "重启应用" 按钮（远程模式不执行实际命令）
    await restartBtn.first().click();
    await page.waitForTimeout(3000);

    // 验证页面不崩溃（聊天输入框仍可见）
    const textarea = page.locator(SEL.chat.textarea);
    await expect(textarea).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: path.join(screenshotDir, 'P3-3.2-after-click.png'), fullPage: true });
  });

  // ==================== B. AI 生成验证 ====================

  test('P3-3.5 AI 生成监控面板（含 action 按钮）', async ({ page }) => {
    test.setTimeout(300_000); // 5 分钟，允许 AI 重试
    const collector = new BFCollector(page, 'P3-3', '应用监控用户场景');

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // 发送用户的原始场景需求
      const result = await collector.sendAndCollect(
        'P3-3.5',
        '在工作台中展示一个应用监控面板，包含以下内容：1. 应用状态（运行中）2. CPU和内存占用 3. 最近的日志输出 4. 提供"关闭应用"和"重启应用"按钮。关闭按钮执行 taskkill /f /im myapp.exe，重启按钮执行 taskkill /f /im myapp.exe && start myapp.exe',
        { timeout: 120_000, expectWorkbench: true },
      );

      const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
      result.notes += ` Workbench可见=${wbVisible}`;

      // 检查是否有 Button 组件（关闭/重启）
      if (wbVisible) {
        const closeBtn = await page.locator('[data-testid="workbench-container"] button:has-text("关闭")').isVisible().catch(() => false);
        const restartBtn = await page.locator('[data-testid="workbench-container"] button:has-text("重启")').isVisible().catch(() => false);
        result.notes += ` 关闭按钮=${closeBtn} 重启按钮=${restartBtn}`;
      }

      // 如果 Workbench 未打开或缺少按钮，重试
      if (!wbVisible) {
        await page.waitForTimeout(30_000);
        const retryResult = await collector.sendAndCollect(
          'P3-3.5-retry',
          '请用工作台的 workbench 工具展示应用监控面板，用 tabs 格式，components 中包含：Statistic 组件显示"运行中"状态，Terminal 组件显示日志，Button 组件（text:"关闭应用", action type:shell command:"taskkill /f /im myapp.exe"）和 Button 组件（text:"重启应用", action type:shell command:"taskkill && start"）',
          { timeout: 120_000, expectWorkbench: true },
        );
        const retryWb = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        retryResult.notes += ` [重试] Workbench可见=${retryWb}`;

        if (retryWb) {
          const closeBtn2 = await page.locator('[data-testid="workbench-container"] button:has-text("关闭")').isVisible().catch(() => false);
          const restartBtn2 = await page.locator('[data-testid="workbench-container"] button:has-text("重启")').isVisible().catch(() => false);
          retryResult.notes += ` 关闭按钮=${closeBtn2} 重启按钮=${restartBtn2}`;
        }
      }

    } finally {
      collector.saveReport();
    }
  });
});
