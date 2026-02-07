/**
 * BF-6：完整工作场景（跨功能组合）— 数据采集
 *
 * 用户故事：生产经理做月度总结 — 对话 + 数据分析 + 文档生成。
 * 这是最重要的验收 — 模拟真实用户的完整工作日。
 * 通过标准：≥ 5/6，第 3/4 步至少 1 步成功，第 5 步必须成功（由 PM 判定）
 *
 * PM 确认：遇到 DeepSeek 限流等恢复后重做，连续 3 次限流从头重来。
 */
import { test, expect } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';

test.describe.serial('BF-6 完整工作场景', () => {
  test('BF-6 数据采集', async ({ page }) => {
    test.setTimeout(900_000); // 15 分钟
    const collector = new BFCollector(page, 'BF-6', '完整工作场景（生产经理月度总结）');

    try {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    let consecutiveFailures = 0;

    // ==================== 步骤 1：打招呼 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-6.1',
        '你好，我是生产部的经理，需要你帮我做本月的工作总结',
        { timeout: 90_000 },
      );

      if (!result.aiResponse) {
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }
      result.notes += ` 预期：AI询问具体内容或提供模板`;
    }

    await page.waitForTimeout(30_000);

    // ==================== 步骤 2：提供数据 ====================
    {
      if (consecutiveFailures >= 3) {
        await collector.collectUIStep('BF-6.2', '连续3次失败，中止', '❌', '连续限流导致中止');
      } else {
        const result = await collector.sendAndCollect(
          'BF-6.2',
          '本月数据如下：A产线产量500件、B产线600件、C产线450件。合格率分别是98%、95%、99%',
          { timeout: 90_000 },
        );

        if (!result.aiResponse) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }
        result.notes += ` 预期：AI理解并回应数据`;
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== 步骤 3：表格展示 ====================
    {
      if (consecutiveFailures >= 3) {
        await collector.collectUIStep('BF-6.3', '连续3次失败，中止', '❌', '连续限流导致中止');
      } else {
        const result = await collector.sendAndCollect(
          'BF-6.3',
          '用表格展示这些产线数据',
          { timeout: 120_000, expectWorkbench: true },
        );

        const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        const hasTable = await page.locator('table, .ant-table').isVisible().catch(() => false);
        result.notes += ` 预期：Workbench打开+3行表格。Workbench可见=${wbVisible}, 表格=${hasTable}`;

        if (!result.aiResponse) {
          consecutiveFailures++;
          // PM 确认：限流时等恢复后重做
          if (consecutiveFailures < 3) {
            console.log('[BF-6.3] 无响应，等待60s后重试');
            await page.waitForTimeout(60_000);
            const retry = await collector.sendAndCollect(
              'BF-6.3-retry',
              '请用工作台表格展示产线数据：A产线500件98%，B产线600件95%，C产线450件99%',
              { timeout: 120_000, expectWorkbench: true },
            );
            if (retry.aiResponse) consecutiveFailures = 0;
          }
        } else {
          consecutiveFailures = 0;
        }
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== 步骤 4：柱状图 ====================
    {
      if (consecutiveFailures >= 3) {
        await collector.collectUIStep('BF-6.4', '连续3次失败，中止', '❌', '连续限流导致中止');
      } else {
        const result = await collector.sendAndCollect(
          'BF-6.4',
          '再用柱状图对比三条产线的产量',
          { timeout: 120_000, expectWorkbench: true },
        );

        const wbVisible = await page.locator(SEL.workbench.container).isVisible().catch(() => false);
        const hasChart = await page.locator('canvas, [class*="echarts"]').isVisible().catch(() => false);
        result.notes += ` 预期：Workbench柱状图。Workbench可见=${wbVisible}, 图表=${hasChart}`;

        if (!result.aiResponse) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== 步骤 5：Word 文档生成 ====================
    {
      if (consecutiveFailures >= 3) {
        await collector.collectUIStep('BF-6.5', '连续3次失败，中止', '❌', '连续限流导致中止');
      } else {
        const result = await collector.sendAndCollect(
          'BF-6.5',
          '根据以上数据，帮我生成一份 Word 版的月度生产总结报告',
          { timeout: 120_000 },
        );

        // 检查文件下载
        const downloads = await collector.checkDownloadLinks();
        const hasDocx = downloads.some(d => d.includes('.docx') || d.includes('word'));
        result.notes += ` 预期：生成.docx文件。下载链接: ${downloads.join('; ')} docx=${hasDocx}`;

        const fileCards = await page.locator('[class*="file"], [class*="attachment"], [class*="download"]').count().catch(() => 0);
        result.notes += ` 文件卡片数=${fileCards}`;

        if (!result.aiResponse) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }
      }
    }

    await page.waitForTimeout(30_000);

    // ==================== 步骤 6：B产线分析 ====================
    {
      if (consecutiveFailures >= 3) {
        await collector.collectUIStep('BF-6.6', '连续3次失败，中止', '❌', '连续限流导致中止');
      } else {
        const result = await collector.sendAndCollect(
          'BF-6.6',
          '最后总结一下B产线合格率偏低的原因可能有哪些',
          { timeout: 90_000 },
        );

        result.notes += ` 预期：AI基于上下文（95%合格率）给出合理分析`;

        if (!result.aiResponse) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }
      }
    }

    } finally {
      // 确保报告不因超时丢失
      collector.saveReport();
    }
  });
});
