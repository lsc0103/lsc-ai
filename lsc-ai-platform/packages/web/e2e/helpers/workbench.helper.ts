/**
 * Workbench 测试辅助工具
 *
 * 统一 Workbench schema 注入、会话创建和预定义 schema 工厂。
 * 消除 S01-V2 / S03 之间的重复代码。
 *
 * 前置条件：
 * - main.tsx 已在 DEV 模式暴露 window.__workbenchStore
 */
import type { Page } from '@playwright/test';
import { SEL } from './selectors';

// ============================================================================
// 会话管理
// ============================================================================

/**
 * 创建会话：发送"你好"并等待 URL 变为 /chat/<id>。
 * Workbench Store 注入需要先有活跃会话。
 *
 * @returns true 如果会话创建成功
 */
export async function ensureSession(page: Page): Promise<boolean> {
  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill('你好');
  await textarea.press('Enter');
  const ok = await page
    .waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (ok) await page.waitForTimeout(1000);
  return ok;
}

/**
 * 创建会话并等待 AI 响应完成，然后清理可能由 AI 打开的 Workbench。
 * 适用于需要干净 Workbench 状态的测试（如 S03 注入测试）。
 *
 * @returns 当前页面 URL
 * @throws 如果会话未创建
 */
export async function ensureCleanSession(page: Page): Promise<string> {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill('你好');
  await textarea.press('Enter');

  const ok = await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) throw new Error('Session 未创建');

  // 等待 AI 响应完成
  const stopBtn = page.locator(SEL.chat.stopButton);
  await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 清理 AI 可能打开的 Workbench
  await closeWorkbench(page);

  return page.url();
}

// ============================================================================
// Schema 注入
// ============================================================================

export interface InjectResult {
  success: boolean;
  reason?: string;
}

/**
 * 通过 window.__workbenchStore.open() 注入 schema。
 * 替换当前 Workbench 内容。
 */
export async function injectSchema(
  page: Page,
  schema: Record<string, unknown>,
): Promise<InjectResult> {
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
  if (result.success) await page.waitForTimeout(1500);
  return result;
}

/**
 * 通过 window.__workbenchStore.mergeSchema() 追加 tab。
 * 模拟 AI 第二次调用 workbench 工具时的 tab 累积。
 */
export async function mergeSchema(
  page: Page,
  schema: Record<string, unknown>,
): Promise<InjectResult> {
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

/**
 * 关闭 Workbench（通过 store.close()）。
 * 如果 Workbench 不可见则无操作。
 */
export async function closeWorkbench(page: Page): Promise<void> {
  const wb = page.locator('.workbench-container');
  if (await wb.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (store?.getState) store.getState().close();
    });
    await page.waitForTimeout(500);
  }
}

/**
 * 清空 Workbench schema 和状态（通过 store.clear()）。
 */
export async function clearWorkbench(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__workbenchStore;
    if (store?.getState) store.getState().clear();
  });
  await page.waitForTimeout(500);
}

// ============================================================================
// 组合操作
// ============================================================================

/**
 * 完整前置准备：导航 → 创建会话 → 注入 schema。
 * 如果任何步骤失败，返回 { ok: false, reason }。
 *
 * 用法：
 * ```ts
 * const r = await setupAndInject(page, SCHEMAS.codeEditor);
 * if (!r.ok) { test.skip(true, r.reason); return; }
 * ```
 */
export async function setupAndInject(
  page: Page,
  schema: Record<string, unknown>,
): Promise<{ ok: boolean; reason: string }> {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const hasSession = await ensureSession(page);
  if (!hasSession) {
    return { ok: false, reason: 'Session 未在 30s 内创建（AI 无响应），跳过注入测试' };
  }

  const result = await injectSchema(page, schema);
  if (!result.success) {
    return { ok: false, reason: `无法注入 Store: ${result.reason}。请确认 main.tsx 已暴露 __workbenchStore` };
  }

  await page.waitForTimeout(500); // injectSchema already waits 1500ms
  return { ok: true, reason: '' };
}

// ============================================================================
// Schema 工厂
// ============================================================================

/**
 * 预定义测试 schema 工厂。
 * 提供常用的 Workbench schema 模板，避免各测试文件重复定义。
 */
export const TestSchemas = {
  /** 单 tab: Python 代码编辑器 */
  codeEditor(options?: { title?: string; language?: string; code?: string }) {
    return {
      type: 'workbench',
      title: options?.title || '代码测试',
      tabs: [{
        key: 'code-1',
        title: '代码',
        components: [{
          type: 'CodeEditor',
          language: options?.language || 'python',
          code: options?.code || [
            'def quicksort(arr):',
            '    if len(arr) <= 1:',
            '        return arr',
            '    pivot = arr[len(arr) // 2]',
            '    left = [x for x in arr if x < pivot]',
            '    middle = [x for x in arr if x == pivot]',
            '    right = [x for x in arr if x > pivot]',
            '    return quicksort(left) + middle + quicksort(right)',
          ].join('\n'),
        }],
      }],
    };
  },

  /** 单 tab: 数据表格 */
  dataTable(options?: {
    title?: string;
    columns?: Array<{ key: string; title: string; dataIndex: string }>;
    data?: Record<string, string>[];
  }) {
    return {
      type: 'workbench',
      title: options?.title || '表格测试',
      tabs: [{
        key: 'table-1',
        title: '数据',
        components: [{
          type: 'DataTable',
          columns: options?.columns || [
            { key: 'name', title: '姓名', dataIndex: 'name' },
            { key: 'age', title: '年龄', dataIndex: 'age' },
            { key: 'city', title: '城市', dataIndex: 'city' },
          ],
          data: options?.data || [
            { name: '张三', age: '25', city: '北京' },
            { name: '李四', age: '30', city: '上海' },
            { name: '王五', age: '28', city: '广州' },
          ],
        }],
      }],
    };
  },

  /** 单 tab: 柱状图 */
  barChart(options?: {
    title?: string;
    xAxis?: string[];
    series?: Array<{ name: string; data: number[] }>;
  }) {
    return {
      type: 'workbench',
      title: options?.title || '图表测试',
      tabs: [{
        key: 'chart-1',
        title: '图表',
        components: [{
          type: 'BarChart',
          title: options?.title || '月度销售额',
          xAxis: options?.xAxis || ['1月', '2月', '3月', '4月', '5月', '6月'],
          series: options?.series || [
            { name: '销售额', data: [150, 200, 180, 250, 220, 300] },
          ],
        }],
      }],
    };
  },

  /** 单 tab: 折线图 */
  lineChart(options?: {
    title?: string;
    xAxis?: string[];
    series?: Array<{ name: string; data: number[] }>;
  }) {
    return {
      type: 'workbench',
      title: options?.title || '折线图测试',
      tabs: [{
        key: 'line-1',
        title: '趋势',
        components: [{
          type: 'LineChart',
          title: options?.title || '月度趋势',
          xAxis: options?.xAxis || ['1月', '2月', '3月', '4月', '5月', '6月'],
          series: options?.series || [
            { name: '销售额', data: [120, 200, 150, 280, 220, 310] },
            { name: '利润', data: [50, 80, 60, 120, 90, 150] },
          ],
        }],
      }],
    };
  },

  /** 单 tab: Markdown 文档 */
  markdown(options?: { title?: string; content?: string }) {
    return {
      type: 'workbench',
      title: options?.title || 'Markdown 测试',
      tabs: [{
        key: 'md-1',
        title: '文档',
        components: [{
          type: 'MarkdownView',
          content: options?.content || [
            '# 项目说明',
            '',
            '## 功能特性',
            '',
            '- **多标签页** — 支持同时查看多个内容',
            '- **Schema 驱动** — JSON 自动渲染为组件',
            '',
            '```javascript',
            'console.log("Hello");',
            '```',
          ].join('\n'),
        }],
      }],
    };
  },

  /** 多 tab: 代码 + 表格 + 图表 */
  multiTab() {
    return {
      type: 'workbench',
      title: '多 Tab 综合',
      tabs: [
        {
          key: 'tab-code',
          title: '代码示例',
          components: [{
            type: 'CodeEditor',
            language: 'javascript',
            code: 'function greet(name) {\n  return `Hello, ${name}!`;\n}',
          }],
        },
        {
          key: 'tab-table',
          title: '数据表格',
          components: [{
            type: 'DataTable',
            columns: [
              { key: 'product', title: '产品', dataIndex: 'product' },
              { key: 'sales', title: '销量', dataIndex: 'sales' },
            ],
            data: [
              { product: '商品A', sales: '100' },
              { product: '商品B', sales: '200' },
            ],
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
    };
  },

  /** 旧格式 schema（version 1.0 + blocks）— 用于 P0-5 回归测试 */
  oldFormat() {
    return {
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
    };
  },

  /** 畸形 schema（含不存在的组件类型）— 用于 P0-4 容错回归测试 */
  malformed() {
    return {
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
            type: 'NonExistentComponent',
            data: 'test',
          }],
        },
        {
          key: 'good-tab-2',
          title: '正常表格',
          components: [{
            type: 'DataTable',
            columns: [
              { key: 'a', title: 'A', dataIndex: 'a' },
              { key: 'b', title: 'B', dataIndex: 'b' },
            ],
            data: [{ a: '1', b: '2' }],
          }],
        },
      ],
    };
  },
};
