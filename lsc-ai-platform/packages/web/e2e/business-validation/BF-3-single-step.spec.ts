/**
 * BF-3 单步独立测试 — 避免连续 Office 操作导致限流
 *
 * 每次只运行一个 BF-3 步骤，通过环境变量 BF3_STEP 指定（2/3/4）
 */
import { test } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';

const STEP = process.env.BF3_STEP || '2';

const STEP_CONFIG: Record<string, { id: string; message: string; notes: string }> = {
  '2': {
    id: 'BF-3.2',
    message: '创建一个 Excel 表格，包含5个员工的姓名、部门、工号',
    notes: '独立运行 Excel 测试',
  },
  '3': {
    id: 'BF-3.3',
    message: '帮我生成一份包含5个员工信息的 PDF 文档',
    notes: '独立运行 PDF 测试（不依赖上一步 Excel）',
  },
  '4': {
    id: 'BF-3.4',
    message: '帮我写一份项目周报的 Word 文档，项目名"船舶改造"，本周完成了设计评审和材料采购，下周计划是开始钢板切割',
    notes: 'PM确认：重新创建也算通过（变通实现）。独立运行。',
  },
};

test(`BF-3 单步: step ${STEP}`, async ({ page }) => {
  test.setTimeout(300_000); // 5 分钟

  const cfg = STEP_CONFIG[STEP]!;
  const collector = new BFCollector(page, 'BF-3', `Office 单步 ${cfg.id}`);

  try {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const result = await collector.sendAndCollect(cfg.id, cfg.message, {
      timeout: 180_000, // 3 分钟超时（Office 操作较慢）
      notes: cfg.notes,
    });

    // 检查下载链接
    const downloads = await collector.checkDownloadLinks();
    result.notes += ` 下载链接: ${downloads.join('; ')}`;

    const fileCards = await page.locator('[class*="file"], [class*="attachment"], [class*="download"]').count().catch(() => 0);
    result.notes += ` 文件卡片数=${fileCards}`;
  } finally {
    collector.saveReport();
  }
});
