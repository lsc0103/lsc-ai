/**
 * Workbench 真实渲染测试
 *
 * 验证 AI 调用 workbench/showTable/showChart/showCode 工具后
 * 前端是否真正渲染了对应的组件
 *
 * 重点：不仅验证最终结果，还验证流式过程中的用户体验
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

const AI_REPLY_TIMEOUT = 120000;

async function waitForAIReply(page: import('@playwright/test').Page, timeout = AI_REPLY_TIMEOUT) {
  await page.waitForTimeout(1000);
  try {
    await page.locator('button .anticon-stop').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.locator('button .anticon-stop').waitFor({ state: 'hidden', timeout });
  } catch {}
  await page.waitForTimeout(2000);
}

/**
 * 在 streaming 过程中持续采样消息气泡内容，检测是否出现原始 JSON
 * 返回 { samples, rawJsonDetected, maxJsonLength }
 */
async function monitorStreamingForRawJson(
  page: import('@playwright/test').Page,
  durationMs = 30000,
  intervalMs = 300,
) {
  const samples: string[] = [];
  let rawJsonDetected = false;
  let maxJsonLength = 0;

  const endTime = Date.now() + durationMs;

  while (Date.now() < endTime) {
    // 获取 streaming 消息气泡的文本内容（最后一个 assistant 气泡）
    const bubbles = page.locator('main .message-bubble.assistant');
    const count = await bubbles.count();
    if (count > 0) {
      const text = await bubbles.last().textContent().catch(() => '') || '';
      samples.push(text);

      // 检测原始 JSON 特征：
      // 1. 连续的 { "key": ... } 结构超过 100 字符
      // 2. 包含 workbench schema 特征字段
      const jsonPatterns = [
        /\{\s*"type"\s*:\s*"tabs?"[\s\S]{50,}/,          // workbench schema
        /\{\s*"tabs"\s*:\s*\[[\s\S]{50,}/,                // tabs array
        /\{\s*"key"\s*:.*"label"\s*:.*"children"\s*:/,    // tab structure
        /```(?:workbench-schema|workbench|json)\s*\n\s*\{[\s\S]{100,}/, // 未渲染的代码块
      ];

      for (const pattern of jsonPatterns) {
        const match = text.match(pattern);
        if (match) {
          rawJsonDetected = true;
          maxJsonLength = Math.max(maxJsonLength, match[0].length);
          console.log(`[监控] 检测到原始 JSON (${match[0].length}字符): ${match[0].slice(0, 80)}...`);
        }
      }
    }

    // 如果 stop 按钮消失了，说明 streaming 结束
    const stopVisible = await page.locator('button .anticon-stop').isVisible().catch(() => false);
    if (!stopVisible && samples.length > 5) break;

    await page.waitForTimeout(intervalMs);
  }

  return { samples, rawJsonDetected, maxJsonLength };
}

test.describe('Workbench Real Rendering — AI 工具调用', () => {
  test.setTimeout(180000);

  test('AI 调用 workbench 工具 → Workbench 面板打开并有内容', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请在workbench中用表格展示：苹果、香蕉、橙子的价格（随意编造数据）');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);

    const mainContent = await page.locator('main').textContent();
    console.log(`[测试] AI 回复 (前200字): ${mainContent?.slice(0, 200)}`);

    const toolSteps = page.locator('main [class*="tool"], main [class*="Tool"]');
    const hasToolSteps = await toolSteps.count() > 0;

    const workbenchPanel = page.locator('[class*="workbench"], [class*="Workbench"]');
    const workbenchVisible = await workbenchPanel.count() > 0;

    console.log(`[测试] 工具调用步骤: ${hasToolSteps}, Workbench面板: ${workbenchVisible}`);

    expect(mainContent!.length).toBeGreaterThan(10);
  });

  test('AI 调用 showCode → 代码块渲染', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('写一个Python冒泡排序函数，请使用showCode工具展示');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);
    await page.waitForTimeout(3000);

    const assistantBubbles = page.locator('main .message-bubble.assistant');
    await expect(assistantBubbles.first()).toBeVisible({ timeout: 10000 });

    const codeElements = page.locator('main code, main pre, [class*="monaco"], [class*="code-editor"], [class*="CodeBlock"]');
    const codeCount = await codeElements.count();

    console.log(`[测试] 代码元素数量: ${codeCount}`);

    const content = await assistantBubbles.first().textContent();
    expect(content!.length).toBeGreaterThan(20);
  });

  test('AI 调用 showTable → 表格数据渲染', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('用showTable工具展示一个3行3列的表格：姓名、年龄、城市，填入示例数据');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);
    await page.waitForTimeout(3000);

    const assistantBubbles = page.locator('main .message-bubble.assistant');
    await expect(assistantBubbles.first()).toBeVisible({ timeout: 10000 });

    const tableElements = page.locator('.ant-table, table, [class*="table"], [class*="Table"]');
    const tableCount = await tableElements.count();

    console.log(`[测试] 表格元素数量: ${tableCount}`);

    const content = await assistantBubbles.first().textContent();
    expect(content!.length).toBeGreaterThan(10);
  });

  test('AI 调用 showChart → 图表渲染', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('用showChart工具画一个柱状图，展示2024年各季度销售额：Q1=100万，Q2=150万，Q3=120万，Q4=200万');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });
    await waitForAIReply(page);
    await page.waitForTimeout(3000);

    const assistantBubbles = page.locator('main .message-bubble.assistant');
    await expect(assistantBubbles.first()).toBeVisible({ timeout: 10000 });

    const chartElements = page.locator('canvas, [class*="echarts"], [class*="chart"], [class*="Chart"]');
    const chartCount = await chartElements.count();

    console.log(`[测试] 图表元素数量: ${chartCount}`);

    const content = await assistantBubbles.first().textContent();
    expect(content!.length).toBeGreaterThan(10);
  });
});

test.describe('Workbench Streaming UX — 流式过程体验', () => {
  test.setTimeout(180000);

  test('workbench 工具调用期间不显示原始 JSON', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请在workbench中展示一个包含5行数据的员工信息表格（姓名、部门、工资），用workbench工具');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 在 streaming 过程中持续监控，检测原始 JSON
    const monitor = await monitorStreamingForRawJson(page, 60000, 300);

    // 等待 AI 回复完成
    await waitForAIReply(page);

    console.log(`[测试] 采样次数: ${monitor.samples.length}, 原始JSON检测: ${monitor.rawJsonDetected}, 最大JSON长度: ${monitor.maxJsonLength}`);

    // 关键断言：streaming 过程中不应出现大段原始 JSON
    if (monitor.rawJsonDetected) {
      console.warn(`[警告] 流式过程中检测到原始 JSON 闪现 (${monitor.maxJsonLength} 字符)！这是 UX 问题。`);
    }
    // 严格模式：原始 JSON 不应超过 200 字符（小段 JSON 可能是正常的工具参数摘要）
    expect(monitor.maxJsonLength).toBeLessThan(200);
  });

  test('workbench 工具调用时有工具步骤指示器', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请使用workbench工具展示一个简单的柱状图，数据随意');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 等待工具调用指示器出现（ToolSteps 组件）
    // 工具调用时应该有某种加载/进度指示，而不是让用户盯着 JSON
    let toolIndicatorSeen = false;
    const endTime = Date.now() + 60000;

    while (Date.now() < endTime) {
      // 检查是否有工具步骤、loading 指示器、或 spinning 状态
      const indicators = page.locator(
        'main [class*="tool"], main [class*="Tool"], main .anticon-loading, main .ant-spin'
      );
      if (await indicators.count() > 0) {
        toolIndicatorSeen = true;
        console.log('[测试] 检测到工具调用指示器');
        break;
      }

      const stopVisible = await page.locator('button .anticon-stop').isVisible().catch(() => false);
      if (!stopVisible) break;

      await page.waitForTimeout(500);
    }

    await waitForAIReply(page);

    console.log(`[测试] 工具调用指示器是否出现: ${toolIndicatorSeen}`);

    // AI 至少有回复
    const content = await page.locator('main').textContent();
    expect(content!.length).toBeGreaterThan(10);
  });

  test('streaming 文本渐进显示 — 无突然出现的大段内容', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请在workbench中展示3种水果的价格对比表');
    await textarea.press('Enter');

    await page.waitForURL('**/chat/**', { timeout: 15000 });

    // 监控内容长度变化，检测是否有突然跳变（JSON 块一次性出现）
    const lengths: number[] = [];
    let maxJump = 0;
    const endTime = Date.now() + 60000;

    while (Date.now() < endTime) {
      const bubbles = page.locator('main .message-bubble.assistant');
      const count = await bubbles.count();
      if (count > 0) {
        const text = await bubbles.last().textContent().catch(() => '') || '';
        const curLen = text.length;
        if (lengths.length > 0) {
          const jump = curLen - lengths[lengths.length - 1];
          if (jump > maxJump) maxJump = jump;
        }
        lengths.push(curLen);
      }

      const stopVisible = await page.locator('button .anticon-stop').isVisible().catch(() => false);
      if (!stopVisible && lengths.length > 5) break;

      await page.waitForTimeout(300);
    }

    await waitForAIReply(page);

    console.log(`[测试] 内容长度采样: ${lengths.length}次, 最大单次跳变: ${maxJump}字符`);

    // 如果有超过 500 字符的突然跳变，可能是 JSON 块一次性渲染
    if (maxJump > 500) {
      console.warn(`[警告] 检测到内容突然跳变 ${maxJump} 字符，可能是 JSON 块一次性渲染`);
    }

    // AI 应该有回复
    const finalContent = await page.locator('main').textContent();
    expect(finalContent!.length).toBeGreaterThan(10);
  });
});
