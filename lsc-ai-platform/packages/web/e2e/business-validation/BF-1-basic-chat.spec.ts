/**
 * BF-1：基础对话体验 — 数据采集
 *
 * 用户故事：员工打开 LSC-AI，想问 AI 一些问题，获得有用的回答。
 * 通过标准：6/6 全过（由 PM 判定）
 */
import { test, expect } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';

test.describe.serial('BF-1 基础对话体验', () => {
  let collector: BFCollector;

  test.beforeAll(() => {
    test.setTimeout(600_000); // 10 分钟总超时
  });

  test('BF-1 数据采集', async ({ page }) => {
    test.setTimeout(600_000);
    collector = new BFCollector(page, 'BF-1', '基础对话体验');

    // ==================== 导航到聊天页 ====================
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ==================== BF-1.1 登录系统 ====================
    {
      const start = Date.now();
      const chatReady = await page.locator(SEL.chat.textarea).isVisible().catch(() => false);
      const welcomeVisible = await page.locator('text=有什么可以帮你的').isVisible().catch(() => false);
      const loadTime = Date.now() - start;

      await collector.collectUIStep(
        'BF-1.1',
        '登录系统，看到聊天界面',
        chatReady ? '✅' : '❌',
        `聊天界面加载=${chatReady}, 欢迎页=${welcomeVisible}, 加载耗时=${loadTime}ms`,
      );
    }

    // ==================== BF-1.2 自我介绍 ====================
    await collector.sendAndCollect('BF-1.2', '你好，介绍一下你自己', {
      timeout: 60_000,
    });

    // 30s 间隔避免限流
    await page.waitForTimeout(30_000);

    // ==================== BF-1.3 写请假邮件 ====================
    await collector.sendAndCollect('BF-1.3', '帮我写一封请假邮件，理由是家里有事，请假两天', {
      timeout: 60_000,
    });

    await page.waitForTimeout(30_000);

    // ==================== BF-1.4 翻译成英文 ====================
    await collector.sendAndCollect('BF-1.4', '上一封邮件改成英文', {
      timeout: 60_000,
    });

    await page.waitForTimeout(30_000);

    // ==================== BF-1.5 超长消息 ====================
    {
      const longMessage = '这是一条超长消息测试。' +
        '我需要验证系统能否正确处理超过500字的输入。'.repeat(10) +
        '以下是一些具体内容：船舶改造项目涉及多个工序，包括船体结构修改、管路系统更换、电气系统升级、涂装作业等。' +
        '每个工序都需要严格按照规范执行，确保质量和安全。项目管理方面，需要协调多个部门的配合，包括设计部、工艺部、质量部、安全部等。' +
        '同时还需要与船东保持密切沟通，及时反馈进度和问题。在材料采购方面，需要提前做好计划，确保关键材料及时到位。' +
        '质量控制方面，需要建立完善的检验流程，从原材料进厂检验到过程检验再到最终检验，每个环节都不能疏忽。' +
        '安全管理方面，需要做好风险评估和应急预案，确保施工安全。请对以上内容进行总结归纳。';

      await collector.sendAndCollect('BF-1.5', longMessage, {
        timeout: 90_000,
        notes: `消息长度=${longMessage.length}字符`,
      });
    }

    await page.waitForTimeout(30_000);

    // ==================== BF-1.6 快速连发 3 条消息 ====================
    {
      const textarea = page.locator(SEL.chat.textarea);
      const assistantBubbles = page.locator('main .message-bubble.assistant');
      const countBefore = await assistantBubbles.count().catch(() => 0);

      // 快速连发 3 条
      const messages = ['第一条快速消息：1+1等于几？', '第二条快速消息：2+2等于几？', '第三条快速消息：3+3等于几？'];

      for (const msg of messages) {
        await textarea.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
        await textarea.fill(msg);
        await textarea.press('Enter');
        await page.waitForTimeout(2000); // 2s 间隔
      }

      // 等待所有回复（最多 3 分钟）
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        const stopVisible = await page.locator(SEL.chat.stopButton).isVisible().catch(() => false);
        if (!stopVisible) {
          await page.waitForTimeout(5000);
          const stillStopping = await page.locator(SEL.chat.stopButton).isVisible().catch(() => false);
          if (!stillStopping) break;
        }
        await page.waitForTimeout(3000);
      }

      await page.waitForTimeout(3000);

      const countAfter = await assistantBubbles.count().catch(() => 0);
      const newResponses = countAfter - countBefore;

      // 截图
      const screenshotPath = 'screenshots/BF-1.6.png';
      await page.screenshot({
        path: `bf-reports/${screenshotPath}`,
        fullPage: true,
      }).catch(() => {});

      // 获取最后几条回复
      const responseTexts: string[] = [];
      for (let i = Math.max(0, countAfter - 3); i < countAfter; i++) {
        const text = await assistantBubbles.nth(i).textContent().catch(() => '');
        responseTexts.push(text || '');
      }

      await collector.collectUIStep(
        'BF-1.6',
        '快速连发 3 条消息',
        newResponses >= 2 ? '✅' : (newResponses >= 1 ? '⚠️' : '❌'),
        `发送3条消息, 收到${newResponses}条新回复。回复摘要: ${responseTexts.map(t => t.slice(0, 50)).join(' | ')}`,
      );
    }

    // ==================== 保存报告 ====================
    collector.saveReport();
  });
});
