/**
 * BF-4：本地 Agent 文件操作 — 数据采集
 *
 * 用户故事：工程师连接本地 Agent，让 AI 操作本地文件和执行命令。
 * 前置条件：Client Agent 已配对并在线。
 * 通过标准：6/6（由 PM 判定）
 */
import { test, expect } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';
import { enterLocalMode, exitLocalMode, isAgentOnline, isInLocalMode } from '../helpers/agent.helper';

test.describe.serial('BF-4 本地 Agent 文件操作', () => {
  test('BF-4 数据采集', async ({ page, api }) => {
    test.setTimeout(600_000);
    const collector = new BFCollector(page, 'BF-4', '本地 Agent 文件操作');

    // 检查 Agent 在线状态
    const agentOnline = await isAgentOnline(api);
    if (!agentOnline) {
      await collector.collectUIStep('BF-4.0', '前置检查', '❌', 'Client Agent 不在线，无法执行 BF-4');
      collector.saveReport();
      return;
    }

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ==================== BF-4.1 进入本地模式 ====================
    // 先进入本地模式，再创建会话（避免初始消息的 isLoading 阻塞后续发送）
    {
      const result = await enterLocalMode(page);
      const inLocal = await isInLocalMode(page);

      await collector.collectUIStep(
        'BF-4.1',
        '进入本地模式',
        result.success && inLocal ? '✅' : '❌',
        `enterLocalMode=${result.success}, reason=${result.reason || 'OK'}, indicator=${inLocal}`,
      );

      if (!result.success) {
        collector.saveReport();
        return;
      }
    }

    await page.waitForTimeout(3_000);

    // ==================== BF-4.2 列出文件 ====================
    // 第一条消息会同时创建会话并路由到 Client Agent
    await collector.sendAndCollect(
      'BF-4.2',
      '列出当前工作目录下的文件',
      { timeout: 120_000 },
    );

    await page.waitForTimeout(10_000);

    // ==================== BF-4.3 创建文件 ====================
    await collector.sendAndCollect(
      'BF-4.3',
      '在当前目录创建一个文件 test-bf4.txt，内容写"业务验收测试"',
      { timeout: 120_000 },
    );

    await page.waitForTimeout(10_000);

    // ==================== BF-4.4 读取文件 ====================
    await collector.sendAndCollect(
      'BF-4.4',
      '读取刚才创建的 test-bf4.txt',
      { timeout: 120_000 },
    );

    await page.waitForTimeout(10_000);

    // ==================== BF-4.5 删除文件 ====================
    await collector.sendAndCollect(
      'BF-4.5',
      '删除 test-bf4.txt',
      { timeout: 120_000 },
    );

    await page.waitForTimeout(10_000);

    // ==================== BF-4.6 退出本地模式 ====================
    {
      const exited = await exitLocalMode(page);
      const stillLocal = await isInLocalMode(page);

      await collector.collectUIStep(
        'BF-4.6',
        '退出本地模式',
        exited && !stillLocal ? '✅' : '❌',
        `exitLocalMode=${exited}, indicator消失=${!stillLocal}`,
      );
    }

    // ==================== 保存报告 ====================
    collector.saveReport();
  });
});
