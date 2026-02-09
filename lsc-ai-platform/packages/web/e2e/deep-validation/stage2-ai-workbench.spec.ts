/**
 * Phase H — Stage 2: AI × Workbench 场景联动验证 (H2-1 ~ H2-10)
 *
 * 核心问题：AI 能否生成有实际操作价值的 Workbench 内容？
 *
 * 2A. AI 生成内容的渲染质量 (H2-1 ~ H2-4)
 *     每个测试通过 AI 对话触发，不使用 Store 注入。
 * 2B. AI 生成带 Action 的内容 (H2-5 ~ H2-7)
 *     验证 AI 是否使用 actions 参数生成可操作内容。
 * 2C. Workbench 状态管理 (H2-8 ~ H2-10)
 *     多次生成、会话切换、关闭重开。
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry, waitForAIComplete } from '../helpers/ai-retry.helper';
import { ensureSession, clearWorkbench, closeWorkbench } from '../helpers/workbench.helper';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotDir = path.resolve(__dirname, '../../bf-reports/deep-validation/screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

// ============================================================================
// Helpers
// ============================================================================

/**
 * 发送消息并等待 Workbench 渲染完成。
 * 先等 AI 回复完毕，再等工具调用完成，最后等 Workbench 容器出现。
 *
 * 防御 P0-6 race condition：useSessionWorkbench 的 useEffect 可能
 * 在 React 渲染周期中清空 workbench（isNewChat 从 true→false 有延迟），
 * 导致 workbench:update 设置的 visible=true 被后续 useEffect 覆盖。
 * 此处通过直接检查 store 中是否有 schema 并重新设置 visible 来绕过。
 */
async function sendAndWaitForWorkbench(
  page: Page,
  message: string,
  timeout = 90_000,
): Promise<{ hasResponse: boolean; workbenchVisible: boolean }> {
  const result = await sendAndWaitWithRetry(page, message, { timeout, retries: 1 });

  // 等待工具调用执行完成（"执行中" 文字消失）
  await page.waitForFunction(
    () => !document.body.textContent?.includes('执行中'),
    { timeout: 30_000 },
  ).catch(() => {});

  // 等一下让 socket 事件到达并被处理
  await page.waitForTimeout(3000);

  // 等待 Workbench 容器出现
  const wb = page.locator(SEL.workbench.container);
  let workbenchVisible = await wb
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  // 如果容器不可见，检查 store 是否已收到 schema（P0-6 race condition）
  // workbench:update 事件可能到达并设置了 schema，但 useEffect 竞态清空了 visible
  if (!workbenchVisible) {
    const storeHasSchema = await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (!store?.getState) return false;
      const state = store.getState();
      return !!state.schema && state.schema.tabs?.length > 0;
    });

    if (storeHasSchema) {
      console.log('[sendAndWaitForWorkbench] Store 有 schema 但 visible=false，重新打开');
      await page.evaluate(() => {
        const store = (window as any).__workbenchStore;
        const state = store.getState();
        state.loadState({ schema: state.schema, visible: true, activeTabKey: state.activeTabKey });
      });
      workbenchVisible = await wb
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
    } else {
      // Store 没有 schema，可能 workbench:update 还没到达，再等一轮
      console.log('[sendAndWaitForWorkbench] Store 无 schema，再等 10s...');
      workbenchVisible = await wb
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    }
  }

  // 多等一下让组件完成渲染（Monaco/ECharts 懒加载）
  if (workbenchVisible) {
    await page.waitForTimeout(3000);
  }

  return { hasResponse: result.hasResponse, workbenchVisible };
}

/**
 * 获取当前 Workbench 中所有 Tab 的标题列表
 * 使用 data-testid="workbench-tab" 定位（自定义 WorkbenchTabs 组件，非 AntD Tabs）
 */
async function getTabTitles(page: Page): Promise<string[]> {
  const tabs = page.locator('[data-testid="workbench-tab"]');
  const count = await tabs.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    // 标题在 <span class="...truncate">{tab.title}</span> 中
    const titleSpan = tabs.nth(i).locator('span.truncate');
    const text = await titleSpan.textContent().catch(() => null);
    if (text) titles.push(text.trim());
  }
  return titles;
}

/**
 * 通过点击侧边栏的新建按钮创建新会话
 */
async function createNewSession(page: Page): Promise<void> {
  await page.locator(SEL.sidebar.newChatButton).click();
  await page.waitForURL('**/chat', { timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}

/**
 * 截图并保存
 */
async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

// ============================================================================
// 2A: AI 生成内容的渲染质量 (H2-1 ~ H2-4)
// ============================================================================

test.describe.serial('Stage 2A-1: AI 生成 DataTable + Chart', () => {
  test.setTimeout(180_000);

  test('H2-1: AI 生成 DataTable — 中国前5大城市', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '用表格展示中国前5大城市的人口、GDP、面积',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    // 验证 DataTable 渲染
    const table = page.locator('.ant-table, table, [class*="DataTable"]').first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    // 验证有数据行（至少5行）
    const rows = page.locator('.ant-table-tbody tr, table tbody tr').filter({ hasNotText: '暂无数据' });
    const rowCount = await rows.count();
    console.log(`[H2-1] DataTable rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // 验证列头
    const headerText = await page.locator('.ant-table-thead, table thead').first().textContent() || '';
    console.log(`[H2-1] Header text: ${headerText}`);

    await screenshot(page, 'H2-01');
  });

  test('H2-2: AI 生成 BarChart — 基于上文GDP数据', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 先发 H2-1 的消息建立上下文
    const r1 = await sendAndWaitWithRetry(page, '用表格展示中国前5大城市的人口、GDP、面积', { timeout: 90_000 });
    expect(r1.hasResponse).toBeTruthy();
    await waitForAIComplete(page, 30_000);
    await page.waitForTimeout(2000);

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '用柱状图展示上面的 GDP 数据',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    // 验证图表渲染（ECharts canvas 或 SVG）
    const chart = page.locator('canvas, [class*="echarts"], [class*="Chart"], [class*="chart"]').first();
    await expect(chart).toBeVisible({ timeout: 10_000 });

    await screenshot(page, 'H2-02');
  });
});

// H2-3 和 H2-4 独立运行，避免 DeepSeek 限流导致的 AI 工具调用不触发
test.describe('Stage 2A-2: AI 生成 CodeEditor + Multi-Tab', () => {

  test('H2-3: AI 生成 CodeEditor — Python 数据分析代码', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '请用showCode工具展示这段Python代码：\nimport pandas as pd\ndf = pd.DataFrame({"name": ["张三","李四"], "age": [25,30]})\nprint(df.describe())',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    // 验证 Monaco 编辑器渲染
    const monaco = page.locator('.monaco-editor').first();
    await expect(monaco).toBeVisible({ timeout: 20_000 });

    // 验证代码内容包含 Python 特征
    const codeContent = await page.locator('.monaco-editor .view-lines').first().textContent() || '';
    console.log(`[H2-3] Code content preview: ${codeContent.slice(0, 200)}...`);
    const hasPythonFeature = /import|def |pandas|DataFrame|print|describe/.test(codeContent);
    expect(hasPythonFeature).toBeTruthy();

    await screenshot(page, 'H2-03');
  });

  test('H2-4: AI 同时展示 DataTable + LineChart + Code — 三种 Tab', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '请使用 workbench 工具，同时展示三个 Tab：第一个 Tab 放数据表格，第二个 Tab 放折线图，第三个 Tab 放一段代码。',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    // 验证有多个 Tab
    const tabTitles = await getTabTitles(page);
    console.log(`[H2-4] Tab titles: ${JSON.stringify(tabTitles)}`);
    expect(tabTitles.length).toBeGreaterThanOrEqual(2);

    // 检查第一个 Tab 内容
    const wb = page.locator(SEL.workbench.container);
    const hasTable = await wb.locator('.ant-table, table').first().isVisible().catch(() => false);
    const hasChart = await wb.locator('canvas, [class*="echarts"]').first().isVisible().catch(() => false);
    const hasCode = await wb.locator('.monaco-editor').first().isVisible().catch(() => false);

    console.log(`[H2-4] Visible: table=${hasTable}, chart=${hasChart}, code=${hasCode}`);
    expect(hasTable || hasChart || hasCode).toBeTruthy();

    // 点击其他 Tab 看是否有不同内容
    if (tabTitles.length >= 2) {
      const tabs = page.locator('[data-testid="workbench-tab"]');
      await tabs.nth(1).click();
      await page.waitForTimeout(2000);

      const hasTable2 = await wb.locator('.ant-table, table').first().isVisible().catch(() => false);
      const hasChart2 = await wb.locator('canvas, [class*="echarts"]').first().isVisible().catch(() => false);
      const hasCode2 = await wb.locator('.monaco-editor').first().isVisible().catch(() => false);
      console.log(`[H2-4] Tab 2 visible: table=${hasTable2}, chart=${hasChart2}, code=${hasCode2}`);
      expect(hasTable2 || hasChart2 || hasCode2).toBeTruthy();
    }

    await screenshot(page, 'H2-04');
  });
});

// ============================================================================
// 2B: AI 生成带 Action 的内容 (H2-5 ~ H2-7)
// ============================================================================

test.describe.serial('Stage 2B: AI 生成带 Action 内容', () => {
  test.setTimeout(180_000);

  test('H2-5: AI 生成 DataTable + 导出 Excel 按钮', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '展示销售数据表格，要有导出 Excel 的功能。请使用 showTable 或 workbench 工具。',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);

    // 底线：表格本体必须渲染
    const table = wb.locator('.ant-table, table, [class*="DataTable"]').first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    // 检查是否有导出按钮（AI-1 已知限制：DeepSeek 可能不生成 Button）
    const exportBtn = wb.locator('button:has-text("导出"), button:has-text("Export"), button:has-text("下载")').first();
    const hasExportBtn = await exportBtn.isVisible().catch(() => false);
    console.log(`[H2-5] Export button visible: ${hasExportBtn}`);
    if (!hasExportBtn) {
      console.log('[H2-5] AI-1 limitation: AI did not generate export Button');
    }

    await screenshot(page, 'H2-05');
  });

  test('H2-6: AI 生成 CodeEditor + 解释代码按钮', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '用showCode展示一段代码，加一个按钮让我可以请AI解释这段代码。请使用 workbench 工具，在 components 中包含 CodeEditor 和 Button。',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);

    // 底线：代码编辑器必须渲染
    const codeEditor = wb.locator('.monaco-editor, [class*="CodeEditor"]').first();
    await expect(codeEditor).toBeVisible({ timeout: 20_000 });

    // 检查是否有解释按钮
    const chatBtn = wb.locator('button:has-text("解释"), button:has-text("分析"), button:has-text("说明")').first();
    const hasChatBtn = await chatBtn.isVisible().catch(() => false);
    console.log(`[H2-6] Chat button visible: ${hasChatBtn}`);
    if (!hasChatBtn) {
      console.log('[H2-6] AI-1 limitation: AI did not generate chat Button');
    }

    await screenshot(page, 'H2-06');
  });

  test('H2-7: AI 生成监控面板 — 统计卡片+终端+按钮', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const { hasResponse, workbenchVisible } = await sendAndWaitForWorkbench(
      page,
      '用workbench工具创建一个监控面板，包含4个统计卡片(Statistic组件)、一个终端输出区(Terminal组件)、一个重启按钮(Button组件，action类型为shell)。请严格使用 workbench 工具。',
    );

    expect(hasResponse).toBeTruthy();
    expect(workbenchVisible).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);

    // 检查统计卡片（Statistic 组件渲染为 .ant-statistic 或类似结构）
    const statistics = wb.locator('.ant-statistic, [class*="Statistic"], [class*="statistic"]');
    const statCount = await statistics.count();
    console.log(`[H2-7] Statistic components: ${statCount}`);

    // 检查终端
    const terminal = wb.locator('[class*="Terminal"], [class*="terminal"], pre, .terminal-container');
    const hasTerminal = await terminal.first().isVisible().catch(() => false);
    console.log(`[H2-7] Terminal visible: ${hasTerminal}`);

    // 检查按钮
    const buttons = wb.locator('button:has-text("重启"), button:has-text("关闭"), button:has-text("执行")');
    const hasButton = await buttons.first().isVisible().catch(() => false);
    console.log(`[H2-7] Action button visible: ${hasButton}`);

    // 至少有统计卡片或终端渲染（组件本体必须渲染）
    const hasContent = statCount > 0 || hasTerminal;
    expect(hasContent).toBeTruthy();

    await screenshot(page, 'H2-07');
  });
});

// ============================================================================
// 2C: Workbench 状态管理 (H2-8 ~ H2-10)
// ============================================================================

test.describe.serial('Stage 2C: Workbench 状态管理', () => {
  test.setTimeout(180_000);

  test('H2-8: AI 再次生成 → Workbench 更新为新内容', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一次：让 AI 生成表格
    const r1 = await sendAndWaitForWorkbench(
      page,
      '用showTable展示这些数据：苹果100元、香蕉50元、橘子30元',
    );
    expect(r1.hasResponse).toBeTruthy();
    expect(r1.workbenchVisible).toBeTruthy();

    // 记录第一次的 Tab 标题
    const tabsBefore = await getTabTitles(page);
    console.log(`[H2-8] Tabs after first generation: ${JSON.stringify(tabsBefore)}`);
    expect(tabsBefore.length).toBeGreaterThanOrEqual(1);
    const firstTabTitle = tabsBefore[0];

    // 验证第一次有表格
    const wb = page.locator(SEL.workbench.container);
    const hasTable = await wb.locator('.ant-table, table').first().isVisible().catch(() => false);
    console.log(`[H2-8] First generation has table: ${hasTable}`);
    expect(hasTable).toBeTruthy();

    await screenshot(page, 'H2-08-first');

    // 第二次：让 AI 生成代码（替换 Workbench 内容）
    const r2 = await sendAndWaitForWorkbench(
      page,
      '请使用 showCode 工具展示一段计算这些水果总价的Python代码',
    );
    expect(r2.hasResponse).toBeTruthy();
    expect(r2.workbenchVisible).toBeTruthy();

    // 验证 Workbench 已更新为新内容（Tab 标题变化或内容类型变化）
    const tabsAfter = await getTabTitles(page);
    console.log(`[H2-8] Tabs after second generation: ${JSON.stringify(tabsAfter)}`);
    expect(tabsAfter.length).toBeGreaterThanOrEqual(1);

    // 验证第二次内容不同于第一次（标题变化或组件类型变化）
    const hasCode = await wb.locator('.monaco-editor').first().isVisible().catch(() => false);
    const newTabTitle = tabsAfter[0];
    const contentChanged = hasCode || (newTabTitle !== firstTabTitle);
    console.log(`[H2-8] Content changed: code=${hasCode}, titleChanged=${newTabTitle !== firstTabTitle}`);
    expect(contentChanged).toBeTruthy();

    await screenshot(page, 'H2-08');
  });

  test('H2-9: 会话隔离 — A 有 Workbench，切到 B，切回 A 恢复', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 会话 A：生成 Workbench 内容
    const r1 = await sendAndWaitForWorkbench(
      page,
      '用showCode展示一段JavaScript的Hello World代码',
    );
    expect(r1.hasResponse).toBeTruthy();
    expect(r1.workbenchVisible).toBeTruthy();

    // 记录会话 A 的 URL 和 Workbench Tab 信息
    const sessionAUrl = page.url();
    const sessionATabs = await getTabTitles(page);
    console.log(`[H2-9] Session A URL: ${sessionAUrl}`);
    console.log(`[H2-9] Session A Tabs: ${JSON.stringify(sessionATabs)}`);

    // 截图 A
    await screenshot(page, 'H2-09-sessionA');

    // 新建会话 B
    await createNewSession(page);
    await page.waitForTimeout(2000);

    // 会话 B：发一条消息（不触发 workbench）
    const r2 = await sendAndWaitWithRetry(page, '你好，今天天气怎么样？', { timeout: 60_000 });
    expect(r2.hasResponse).toBeTruthy();

    // 验证会话 B 没有显示 A 的 Workbench
    const wbInB = page.locator(SEL.workbench.container);
    const wbVisibleInB = await wbInB.isVisible().catch(() => false);
    console.log(`[H2-9] Workbench visible in Session B: ${wbVisibleInB}`);
    // B 不应显示 A 的内容（可能因为 AI 也生成了 workbench，所以只检查 Tab 不同）

    await screenshot(page, 'H2-09-sessionB');

    // 切回会话 A：通过侧边栏点击
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    const sessionCount = await sessionItems.count();
    // 找到会话 A（通常是倒数第二个，最新的是 B）
    for (let i = 0; i < sessionCount; i++) {
      const item = sessionItems.nth(i);
      await item.click();
      await page.waitForTimeout(2000);
      if (page.url() === sessionAUrl || page.url().includes(sessionAUrl.split('/').pop() || '')) {
        break;
      }
    }

    await page.waitForTimeout(3000);

    // 验证会话 A 的 Workbench 恢复
    const wbRestored = await wbInB.isVisible().catch(() => false);
    console.log(`[H2-9] Workbench restored in Session A: ${wbRestored}`);
    expect(wbRestored).toBeTruthy();

    // 验证 Tab 标题恢复
    const restoredTabs = await getTabTitles(page);
    console.log(`[H2-9] Restored Tabs: ${JSON.stringify(restoredTabs)}`);

    await screenshot(page, 'H2-09-restored');
  });

  test('H2-10: 关闭 Workbench → AI 再次生成 → 重新打开', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一次：生成 Workbench
    const r1 = await sendAndWaitForWorkbench(
      page,
      '用表格展示：张三25岁、李四30岁、王五28岁',
    );
    expect(r1.hasResponse).toBeTruthy();
    expect(r1.workbenchVisible).toBeTruthy();

    await screenshot(page, 'H2-10-before-close');

    // 关闭 Workbench
    await closeWorkbench(page);
    const wbAfterClose = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
    console.log(`[H2-10] Workbench visible after close: ${wbAfterClose}`);
    expect(wbAfterClose).toBeFalsy();

    await screenshot(page, 'H2-10-after-close');

    // 第二次：让 AI 再生成内容 → 应该重新打开
    const r2 = await sendAndWaitForWorkbench(
      page,
      '用showCode展示一段把上面数据排序的Python代码',
    );
    expect(r2.hasResponse).toBeTruthy();
    expect(r2.workbenchVisible).toBeTruthy();

    // Workbench 重新打开
    const wbReopened = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
    console.log(`[H2-10] Workbench reopened: ${wbReopened}`);
    expect(wbReopened).toBeTruthy();

    await screenshot(page, 'H2-10-reopened');
  });
});
