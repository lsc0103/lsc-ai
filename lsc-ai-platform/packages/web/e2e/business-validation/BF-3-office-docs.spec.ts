/**
 * BF-3：Office 文档生成 — 数据采集
 *
 * 用户故事：员工需要 AI 帮忙生成一份工作报告、一个数据表格。
 * 通过标准：≥ 3/4（由 PM 判定）
 */
import { test, expect } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';

test.describe.serial('BF-3 Office 文档生成', () => {
  test('BF-3 数据采集', async ({ page }) => {
    test.setTimeout(900_000); // 15 分钟
    const collector = new BFCollector(page, 'BF-3', 'Office 文档生成');

    try {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ==================== BF-3.1 Word 文档 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-3.1',
        '帮我写一份项目周报的 Word 文档，项目名"船舶改造"，本周完成了设计评审和材料采购',
        { timeout: 120_000 },
      );

      // 检查下载链接
      const downloads = await collector.checkDownloadLinks();
      const hasDocx = downloads.some(d => d.includes('.docx') || d.includes('word'));
      if (downloads.length > 0 || hasDocx) {
        result.notes += ` 下载链接: ${downloads.join('; ')}`;
      }

      // 也检查消息中是否有文件卡片/附件标识
      const fileCards = await page.locator('[class*="file"], [class*="attachment"], [class*="download"]').count().catch(() => 0);
      result.notes += ` 文件卡片数=${fileCards}`;
    }

    await page.waitForTimeout(60_000);

    // ==================== BF-3.2 Excel 表格 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-3.2',
        '创建一个 Excel 表格，包含5个员工的姓名、部门、工号',
        { timeout: 120_000 },
      );

      const downloads = await collector.checkDownloadLinks();
      const hasXlsx = downloads.some(d => d.includes('.xlsx') || d.includes('excel'));
      result.notes += ` 下载链接: ${downloads.join('; ')} xlsx=${hasXlsx}`;
    }

    await page.waitForTimeout(60_000);

    // ==================== BF-3.3 PDF 文件 ====================
    {
      const result = await collector.sendAndCollect(
        'BF-3.3',
        '把上面的员工信息生成一份 PDF',
        { timeout: 120_000 },
      );

      const downloads = await collector.checkDownloadLinks();
      const hasPdf = downloads.some(d => d.includes('.pdf'));
      result.notes += ` 下载链接: ${downloads.join('; ')} pdf=${hasPdf}`;
    }

    await page.waitForTimeout(60_000);

    // ==================== BF-3.4 修改已有 Word ====================
    {
      const result = await collector.sendAndCollect(
        'BF-3.4',
        '在刚才的 Word 周报里追加一段：下周计划是开始钢板切割',
        {
          timeout: 120_000,
          notes: 'PM确认：重新创建也算通过，标记"变通实现"',
        },
      );

      const downloads = await collector.checkDownloadLinks();
      result.notes += ` 下载链接: ${downloads.join('; ')}`;
    }

    } finally {
      // 确保报告不因超时丢失
      collector.saveReport();
    }
  });
});
