/**
 * Phase G 业务验收 — 数据采集工具
 *
 * 不做 pass/fail 判定，只采集原始数据供 PM 审阅。
 * 采集内容：AI 原始回复全文、工具调用记录、Workbench 状态、截图、console.error。
 */
import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SEL } from '../helpers/selectors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 类型定义
// ============================================================================

export interface StepResult {
  id: string;
  userInput: string;
  techResult: '✅' | '❌' | '⚠️';
  aiResponse: string;
  toolCalls: string[];
  workbenchState: string;
  screenshotPath: string;
  consoleErrors: string[];
  notes: string;
  durationMs: number;
}

export interface BFReport {
  bfId: string;
  bfName: string;
  steps: StepResult[];
  totalConsoleErrors: string[];
  startTime: string;
  endTime: string;
}

// ============================================================================
// BFCollector
// ============================================================================

export class BFCollector {
  private steps: StepResult[] = [];
  private toolCallLog: string[] = [];
  private consoleErrors: string[] = [];
  private startTime: string;
  private reportDir: string;
  private screenshotDir: string;

  constructor(
    private page: Page,
    private bfId: string,
    private bfName: string,
  ) {
    this.startTime = new Date().toISOString();
    this.reportDir = path.resolve(__dirname, '../../bf-reports');
    this.screenshotDir = path.join(this.reportDir, 'screenshots');
    fs.mkdirSync(this.screenshotDir, { recursive: true });

    // 拦截 console 日志
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[Socket] 工具调用:')) {
        this.toolCallLog.push(text.replace('[Socket] 工具调用: ', '').trim());
      }
      if (msg.type() === 'error') {
        this.consoleErrors.push(text.slice(0, 500));
      }
    });
  }

  /**
   * 发送消息并采集 AI 回复的完整数据。
   */
  async sendAndCollect(
    stepId: string,
    message: string,
    options: {
      timeout?: number;
      expectWorkbench?: boolean;
      expectDownload?: boolean;
      skipSend?: boolean;
      notes?: string;
    } = {},
  ): Promise<StepResult> {
    const { timeout = 120_000, expectWorkbench = false, skipSend = false, notes = '' } = options;
    const startMs = Date.now();

    // 记录发送前的状态
    const assistantBubbles = this.page.locator('main .message-bubble.assistant');
    const countBefore = await assistantBubbles.count().catch(() => 0);
    const toolCallsBefore = this.toolCallLog.length;

    if (!skipSend) {
      // 发送消息
      const textarea = this.page.locator(SEL.chat.textarea);
      await textarea.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      await textarea.fill(message);
      await textarea.press('Enter');

      // 首次发送可能创建会话
      await this.page.waitForURL('**/chat/**', { timeout: 15_000 }).catch(() => {});
    }

    // 等待 AI 响应
    let hasResponse = false;
    let responseText = '';

    try {
      // 等待 stop 按钮出现（AI 开始生成）
      await this.page.locator(SEL.chat.stopButton)
        .waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});

      // 等待 stop 按钮消失（AI 完成生成）
      await this.page.locator(SEL.chat.stopButton)
        .waitFor({ state: 'hidden', timeout });
    } catch {
      // 超时 — 继续采集当前状态
    }

    // 额外等待确保渲染完成
    await this.page.waitForTimeout(3000);

    // 采集 AI 回复
    const countAfter = await assistantBubbles.count().catch(() => 0);
    if (countAfter > countBefore) {
      hasResponse = true;
      responseText = (await assistantBubbles.last().textContent()) || '';
    }

    // 采集工具调用
    const newToolCalls = this.toolCallLog.slice(toolCallsBefore);

    // 采集 Workbench 状态
    const wbState = await this.getWorkbenchState();

    // 截图
    const screenshotName = `${stepId}.png`;
    const screenshotPath = path.join(this.screenshotDir, screenshotName);
    await this.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const durationMs = Date.now() - startMs;

    // 技术结果判定（纯客观：有无响应）
    let techResult: '✅' | '❌' | '⚠️' = '❌';
    if (hasResponse && responseText.length > 0) {
      techResult = '✅';
    } else if (hasResponse) {
      techResult = '⚠️';
    }

    const result: StepResult = {
      id: stepId,
      userInput: message,
      techResult,
      aiResponse: responseText,
      toolCalls: newToolCalls,
      workbenchState: wbState,
      screenshotPath: `screenshots/${screenshotName}`,
      consoleErrors: [...this.consoleErrors].slice(-10),
      notes: notes || '',
      durationMs,
    };

    this.steps.push(result);
    console.log(`[BF] ${stepId} ${techResult} (${(durationMs / 1000).toFixed(1)}s) response=${responseText.length}字符 tools=[${newToolCalls.join(',')}] wb=${wbState}`);

    return result;
  }

  /**
   * 采集非对话步骤（UI 操作、页面检查等）。
   */
  async collectUIStep(
    stepId: string,
    description: string,
    techResult: '✅' | '❌' | '⚠️',
    notes: string,
  ): Promise<StepResult> {
    const screenshotName = `${stepId}.png`;
    const screenshotPath = path.join(this.screenshotDir, screenshotName);
    await this.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const wbState = await this.getWorkbenchState();

    const result: StepResult = {
      id: stepId,
      userInput: description,
      techResult,
      aiResponse: '',
      toolCalls: [],
      workbenchState: wbState,
      screenshotPath: `screenshots/${screenshotName}`,
      consoleErrors: [...this.consoleErrors].slice(-10),
      notes,
      durationMs: 0,
    };

    this.steps.push(result);
    console.log(`[BF] ${stepId} ${techResult} — ${notes}`);
    return result;
  }

  /**
   * 获取 Workbench 当前状态。
   */
  async getWorkbenchState(): Promise<string> {
    const wb = this.page.locator(SEL.workbench.container);
    const isVisible = await wb.isVisible().catch(() => false);
    if (!isVisible) return '关闭';

    const tabs = this.page.locator(SEL.workbench.tab);
    const tabCount = await tabs.count().catch(() => 0);

    // 检测内容类型
    const hasTable = await this.page.locator('table, .ant-table').isVisible().catch(() => false);
    const hasChart = await this.page.locator('canvas, [class*="echarts"]').isVisible().catch(() => false);
    const hasCode = await this.page.locator('.monaco-editor').isVisible().catch(() => false);

    const types: string[] = [];
    if (hasTable) types.push('表格');
    if (hasChart) types.push('图表');
    if (hasCode) types.push('代码');

    const typeStr = types.length > 0 ? `(${types.join('+')})` : '';
    return `打开/${tabCount}个Tab${typeStr}`;
  }

  /**
   * 检查是否有文件下载链接。
   */
  async checkDownloadLinks(): Promise<string[]> {
    const links = this.page.locator('a[href*="/api/"], a[download]');
    const count = await links.count().catch(() => 0);
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href').catch(() => '');
      const text = await links.nth(i).textContent().catch(() => '');
      if (href) results.push(`${text || 'link'}: ${href}`);
    }
    return results;
  }

  /**
   * 生成 Markdown 报告。
   */
  generateReport(): string {
    const endTime = new Date().toISOString();
    const passCount = this.steps.filter(s => s.techResult === '✅').length;
    const totalCount = this.steps.length;

    let md = `## ${this.bfId} ${this.bfName} 验收采集报告\n\n`;
    md += `**采集时间**: ${this.startTime} ~ ${endTime}\n\n`;

    // 汇总表
    md += `| 编号 | 技术结果 | AI 回复摘要 | 工具调用记录 | Workbench 状态 | 截图路径 |\n`;
    md += `|------|---------|------------|------------|---------------|----------|\n`;

    for (const step of this.steps) {
      const summary = step.aiResponse
        ? `"${step.aiResponse.replace(/\n/g, ' ').slice(0, 80)}..."`
        : step.notes || '(无 AI 回复)';
      const tools = step.toolCalls.length > 0 ? step.toolCalls.join(', ') : '无';
      md += `| ${step.id} | ${step.techResult} | ${summary} | ${tools} | ${step.workbenchState} | ${step.screenshotPath} |\n`;
    }

    md += `\n**技术通过率**: ${passCount}/${totalCount}\n`;
    md += `**console.error**: ${this.consoleErrors.length > 0 ? `有 (${this.consoleErrors.length}条)` : '无'}\n\n`;

    // 每步详细数据
    md += `---\n\n### 详细采集数据\n\n`;

    for (const step of this.steps) {
      md += `#### ${step.id}\n\n`;
      md += `**用户输入**: ${step.userInput}\n\n`;
      md += `**技术结果**: ${step.techResult} (耗时 ${(step.durationMs / 1000).toFixed(1)}s)\n\n`;

      if (step.aiResponse) {
        md += `**AI 原始回复全文**:\n\n`;
        md += `\`\`\`\n${step.aiResponse}\n\`\`\`\n\n`;
      }

      if (step.toolCalls.length > 0) {
        md += `**工具调用**: ${step.toolCalls.join(', ')}\n\n`;
      }

      md += `**Workbench 状态**: ${step.workbenchState}\n\n`;

      if (step.notes) {
        md += `**备注**: ${step.notes}\n\n`;
      }

      if (step.consoleErrors.length > 0) {
        md += `**console.error**:\n`;
        step.consoleErrors.forEach(e => { md += `- ${e.slice(0, 200)}\n`; });
        md += '\n';
      }

      md += `---\n\n`;
    }

    // 全局 console errors
    if (this.consoleErrors.length > 0) {
      md += `### 全局 Console Errors\n\n`;
      this.consoleErrors.forEach(e => { md += `- ${e.slice(0, 300)}\n`; });
      md += '\n';
    }

    return md;
  }

  /**
   * 保存报告到文件。
   */
  saveReport(): string {
    const report = this.generateReport();
    const reportPath = path.join(this.reportDir, `${this.bfId}-report.md`);
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`[BF] 报告已保存: ${reportPath}`);
    return reportPath;
  }

  getSteps() { return this.steps; }
  getConsoleErrors() { return this.consoleErrors; }
}
