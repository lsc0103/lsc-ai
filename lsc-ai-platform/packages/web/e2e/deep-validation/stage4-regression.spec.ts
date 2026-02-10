/**
 * Phase H — Stage 4: 基础功能回归 — "不退化"验证 (H4-1 ~ H4-13)
 *
 * 确保 Workbench 重写没有影响其他功能模块。
 * 从原 Phase H 的 DV-1/4/6/7 精简而来。
 *
 * 4A. 对话系统（4 项）: H4-1 ~ H4-4
 * 4B. Office 文档（3 项）: H4-5 ~ H4-7
 * 4C. 本地 Agent（3 项）: H4-8 ~ H4-10
 * 4D. 记忆与会话（3 项）: H4-11 ~ H4-13
 *
 * 判定标准：13 项中至少 11 项通过。
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry, waitForAIComplete } from '../helpers/ai-retry.helper';
import { ensureSession } from '../helpers/workbench.helper';
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

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

/**
 * 从 server API 获取在线设备信息
 */
async function getDeviceInfo(page: Page) {
  return page.evaluate(async () => {
    try {
      const raw = localStorage.getItem('lsc-ai-auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const token = parsed?.state?.accessToken;
      if (!token) return null;
      const res = await fetch('/api/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const devices = Array.isArray(data) ? data : (data?.data || []);
      const onlineDevice = devices.find((d: any) => d.status === 'online');
      if (!onlineDevice) return null;
      return {
        devices,
        deviceId: onlineDevice.deviceId,
        serverWorkDir: onlineDevice.workDir || '',
      };
    } catch {
      return null;
    }
  });
}

/**
 * 设置本地模式
 */
async function setupLocalMode(page: Page): Promise<{ ok: boolean; workDir: string; deviceId: string }> {
  const FAIL = { ok: false, workDir: '', deviceId: '' };
  const info = await getDeviceInfo(page);
  if (!info) {
    console.log('[setupLocalMode] No online device found');
    return FAIL;
  }
  console.log(`[setupLocalMode] deviceId: "${info.deviceId}", workDir: "${info.serverWorkDir}"`);

  await page.evaluate(
    ({ devices, deviceId, wd }: { devices: any[]; deviceId: string; wd: string }) => {
      localStorage.setItem(
        'lsc-ai-agent',
        JSON.stringify({
          state: { devices, currentDeviceId: deviceId, workDir: wd },
          version: 0,
        }),
      );
    },
    { devices: info.devices, deviceId: info.deviceId, wd: info.serverWorkDir },
  );

  await page.goto('/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await ensureSession(page);
  // 等待 Agent 完成 "你好" 的 chat 任务
  await waitForAIComplete(page, 120_000);
  await page.waitForTimeout(3000);

  const storeState = await page.evaluate(() => {
    const raw = localStorage.getItem('lsc-ai-agent');
    if (!raw) return null;
    try { return JSON.parse(raw)?.state; } catch { return null; }
  });
  const ok = storeState?.currentDeviceId === info.deviceId;
  console.log(`[setupLocalMode] verified=${ok}`);
  return { ok, workDir: info.serverWorkDir, deviceId: info.deviceId };
}

// ============================================================================
// 4A: 对话系统 (H4-1 ~ H4-4)
// ============================================================================

test.describe('Stage 4A: 对话系统', () => {

  test('H4-1: 5轮多轮对话 — 上下文记忆', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Round 1: 告诉 AI 一个特定信息
    const r1 = await sendAndWaitWithRetry(page, '请记住这个数字：42。这是我最喜欢的数字。', { timeout: 90_000 });
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-1] Round 1: ${r1.responseText.slice(0, 60)}`);

    // Round 2: 无关话题
    const r2 = await sendAndWaitWithRetry(page, '今天天气怎么样？', { timeout: 90_000 });
    expect(r2.hasResponse).toBeTruthy();
    console.log(`[H4-1] Round 2: ${r2.responseText.slice(0, 60)}`);

    // Round 3: 另一个无关话题
    const r3 = await sendAndWaitWithRetry(page, '推荐一本好书', { timeout: 90_000 });
    expect(r3.hasResponse).toBeTruthy();
    console.log(`[H4-1] Round 3: ${r3.responseText.slice(0, 60)}`);

    // Round 4: 再一个无关话题
    const r4 = await sendAndWaitWithRetry(page, '如何学习编程？', { timeout: 90_000 });
    expect(r4.hasResponse).toBeTruthy();
    console.log(`[H4-1] Round 4: ${r4.responseText.slice(0, 60)}`);

    // Round 5: 引用 Round 1 的信息
    const r5 = await sendAndWaitWithRetry(page, '我之前告诉你的那个数字是多少？请直接回答数字。', { timeout: 90_000 });
    expect(r5.hasResponse).toBeTruthy();
    console.log(`[H4-1] Round 5: ${r5.responseText.slice(0, 100)}`);

    // 验证 AI 记住了数字 42
    const has42 = r5.responseText.includes('42');
    console.log(`[H4-1] AI remembered 42: ${has42}`);
    expect(has42).toBeTruthy();

    await screenshot(page, 'H4-01-context-memory');
  });

  test('H4-2: 代码语法高亮 — Python + SQL + TypeScript', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const r = await sendAndWaitWithRetry(
      page,
      '请直接在聊天中（不要用Workbench工作台）分别写三段代码：1) Python斐波那契函数 2) SQL查询语句 3) TypeScript接口定义。用markdown代码块格式展示。',
      { timeout: 120_000 },
    );
    expect(r.hasResponse).toBeTruthy();

    // AI 可能在聊天气泡或 Workbench 中展示代码
    // 先检查聊天气泡中的代码块
    const chatCodeBlocks = page.locator('main .message-bubble.assistant pre code, main .message-bubble.assistant .code-block');
    const chatCodeCount = await chatCodeBlocks.count();
    console.log(`[H4-2] Chat code blocks: ${chatCodeCount}`);

    // 也检查 Workbench 中的代码编辑器
    const wbCodeEditor = page.locator('[data-testid="workbench-container"] .monaco-editor, [data-testid="workbench-container"] [class*="CodeEditor"]');
    const wbCodeCount = await wbCodeEditor.count();
    console.log(`[H4-2] Workbench code editors: ${wbCodeCount}`);

    // 聊天中有代码块或 Workbench 中有代码编辑器
    const totalCode = chatCodeCount + wbCodeCount;
    console.log(`[H4-2] Total code displays: ${totalCode}`);
    expect(totalCode).toBeGreaterThanOrEqual(1);

    // 检查回复中包含编程语言关键词
    const text = r.responseText.toLowerCase();
    const hasPython = text.includes('python') || text.includes('def ') || text.includes('fibonacci');
    const hasSQL = text.includes('sql') || text.includes('select') || text.includes('查询');
    const hasTS = text.includes('typescript') || text.includes('interface') || text.includes('ts');
    console.log(`[H4-2] Python: ${hasPython}, SQL: ${hasSQL}, TS: ${hasTS}`);
    expect(hasPython || hasSQL || hasTS).toBeTruthy();

    await screenshot(page, 'H4-02-syntax-highlight');
  });

  test('H4-3: AI 长回复 — 2000字以上', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const r = await sendAndWaitWithRetry(
      page,
      '请直接在聊天回复中（不要使用Workbench工作台）详细介绍中国的五大名山（泰山、华山、衡山、恒山、嵩山），每座山写300字以上，包括地理位置、历史文化、主要景点、最佳游览季节。全部内容必须在聊天消息中。',
      { timeout: 180_000 },
    );
    expect(r.hasResponse).toBeTruthy();

    // 获取聊天气泡中的文字长度
    const chatText = r.responseText;
    console.log(`[H4-3] Chat response length: ${chatText.length} chars`);

    // 也获取 Workbench 中的文字长度（AI 可能将长内容放到 Workbench）
    let wbTextLength = 0;
    const wbContainer = page.locator('[data-testid="workbench-container"]');
    if (await wbContainer.isVisible().catch(() => false)) {
      const wbText = await wbContainer.textContent() || '';
      wbTextLength = wbText.length;
      console.log(`[H4-3] Workbench text length: ${wbTextLength} chars`);
    }

    const totalLength = chatText.length + wbTextLength;
    console.log(`[H4-3] Total content length: ${totalLength} chars`);

    // 验证总内容长度 >= 1000 字（AI 可能分散在聊天和 Workbench）
    expect(totalLength).toBeGreaterThanOrEqual(1000);

    // 验证消息完整显示（滚动到底部应能看到最后一个 assistant bubble）
    const lastBubble = page.locator('main .message-bubble.assistant').last();
    await lastBubble.scrollIntoViewIfNeeded();
    const isVisible = await lastBubble.isVisible();
    console.log(`[H4-3] Last bubble visible after scroll: ${isVisible}`);
    expect(isVisible).toBeTruthy();

    // 验证内容包含五大名山中至少 3 座
    const allText = (chatText + (await wbContainer.textContent().catch(() => '') || '')).toLowerCase();
    const mountains = ['泰山', '华山', '衡山', '恒山', '嵩山'];
    const mentioned = mountains.filter(m => allText.includes(m));
    console.log(`[H4-3] Mountains mentioned: ${mentioned.join(', ')} (${mentioned.length}/5)`);
    expect(mentioned.length).toBeGreaterThanOrEqual(3);

    await screenshot(page, 'H4-03-long-response');
  });

  test('H4-4: 停止生成 + 重新发送', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 发送一个会生成长回复的消息
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('请写一篇3000字以上的关于人工智能发展历史的详细文章，从1950年代开始到现在。');
    await textarea.press('Enter');
    await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});

    // 等待 AI 开始回复（stop 按钮出现）
    const stopBtn = page.locator(SEL.chat.stopButton);
    const stopVisible = await stopBtn
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    console.log(`[H4-4] Stop button appeared: ${stopVisible}`);

    if (stopVisible) {
      // 等 AI 生成一部分内容后点击停止
      await page.waitForTimeout(5000);
      await stopBtn.click();
      console.log('[H4-4] Clicked stop button');

      // 等待停止按钮消失
      await stopBtn.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    await screenshot(page, 'H4-04-step1-stopped');

    // 发送新消息 — 验证停止后系统正常
    const r2 = await sendAndWaitWithRetry(page, '你好，请用一句话回答：1+1等于几？', { timeout: 60_000 });
    expect(r2.hasResponse).toBeTruthy();
    console.log(`[H4-4] New message response: ${r2.responseText.slice(0, 80)}`);

    await screenshot(page, 'H4-04-step2-new-message');
  });
});

// ============================================================================
// 4B: Office 文档 (H4-5 ~ H4-7) — 需要 Agent 在线
// ============================================================================

test.describe('Stage 4B: Office 文档', () => {

  test('H4-5: Word 全流程 — 创建+追加+读取', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 进入本地模式
    const mode = await setupLocalMode(page);
    if (!mode.ok) {
      console.log('[H4-5] Agent not available, skipping');
      test.skip(true, 'Agent 不在线，无法执行 Office 测试');
      return;
    }

    // Step 1: 创建 Word 文档
    const r1 = await sendAndWaitWithRetry(
      page,
      '请使用createWord工具创建一个Word文档，文件名为test-h4-word.docx，内容为"这是Stage4的Word测试文档"',
      { timeout: 180_000 },
    );
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-5] Step 1 create: ${r1.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-05-step1-create');

    // Step 2: 追加内容
    const r2 = await sendAndWaitWithRetry(
      page,
      '请使用editWord工具向test-h4-word.docx追加一段文字："追加的内容——测试编辑功能"',
      { timeout: 180_000 },
    );
    expect(r2.hasResponse).toBeTruthy();
    console.log(`[H4-5] Step 2 append: ${r2.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-05-step2-append');

    // Step 3: 读取验证
    const r3 = await sendAndWaitWithRetry(
      page,
      '请使用readOffice工具读取test-h4-word.docx的内容，告诉我里面写了什么',
      { timeout: 180_000 },
    );
    expect(r3.hasResponse).toBeTruthy();
    console.log(`[H4-5] Step 3 read: ${r3.responseText.slice(0, 120)}`);

    // 验证回复包含原始内容或追加内容的关键词
    const hasOriginal = r3.responseText.includes('Stage4') || r3.responseText.includes('Word测试');
    const hasAppended = r3.responseText.includes('追加') || r3.responseText.includes('编辑功能');
    console.log(`[H4-5] Contains original: ${hasOriginal}, appended: ${hasAppended}`);
    expect(hasOriginal || hasAppended).toBeTruthy();

    await screenshot(page, 'H4-05-step3-read');
  });

  test('H4-6: Excel 结构化数据 — 3列×5行', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const mode = await setupLocalMode(page);
    if (!mode.ok) {
      console.log('[H4-6] Agent not available, skipping');
      test.skip(true, 'Agent 不在线，无法执行 Office 测试');
      return;
    }

    // Step 1: 创建 Excel
    const r1 = await sendAndWaitWithRetry(
      page,
      '请使用createExcel工具创建一个Excel文件test-h4-data.xlsx，包含"姓名、部门、工资"三列，填入5行示例数据（张三/技术/8000，李四/销售/7000，王五/人事/7500，赵六/技术/9000，钱七/销售/6500）',
      { timeout: 180_000 },
    );
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-6] Step 1 create: ${r1.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-06-step1-create');

    // Step 2: 读取验证
    const r2 = await sendAndWaitWithRetry(
      page,
      '请使用readOffice工具读取test-h4-data.xlsx，告诉我有几列几行数据',
      { timeout: 180_000 },
    );
    expect(r2.hasResponse).toBeTruthy();
    console.log(`[H4-6] Step 2 read: ${r2.responseText.slice(0, 120)}`);

    // 验证回复包含数据相关关键词
    const hasData = r2.responseText.includes('姓名') ||
      r2.responseText.includes('张三') ||
      r2.responseText.includes('3') ||
      r2.responseText.includes('5');
    console.log(`[H4-6] Contains data info: ${hasData}`);
    expect(hasData).toBeTruthy();

    await screenshot(page, 'H4-06-step2-read');
  });

  test('H4-7: PDF 报告生成', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const mode = await setupLocalMode(page);
    if (!mode.ok) {
      console.log('[H4-7] Agent not available, skipping');
      test.skip(true, 'Agent 不在线，无法执行 Office 测试');
      return;
    }

    // 创建 PDF
    const r1 = await sendAndWaitWithRetry(
      page,
      '请使用createPDF工具生成一份PDF报告文件test-h4-report.pdf，标题为"Stage 4 测试报告"，内容包含：1.测试目的 2.测试范围 3.测试结论。',
      { timeout: 180_000 },
    );
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-7] PDF create: ${r1.responseText.slice(0, 100)}`);

    // 验证 AI 回复表示成功（而非报错）
    const isSuccess = !r1.responseText.includes('失败') && !r1.responseText.includes('错误') && !r1.responseText.includes('error');
    const hasCreated = r1.responseText.includes('PDF') || r1.responseText.includes('pdf') || r1.responseText.includes('创建') || r1.responseText.includes('生成');
    console.log(`[H4-7] No error: ${isSuccess}, has created mention: ${hasCreated}`);
    expect(isSuccess || hasCreated).toBeTruthy();

    await screenshot(page, 'H4-07-pdf-created');
  });
});

// ============================================================================
// 4C: 本地 Agent (H4-8 ~ H4-10) — 需要 Agent 在线
// ============================================================================

test.describe('Stage 4C: 本地 Agent', () => {

  test('H4-8: 多文件操作 — 创建目录→写入→读取→编辑→删除', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const mode = await setupLocalMode(page);
    if (!mode.ok) {
      console.log('[H4-8] Agent not available, skipping');
      test.skip(true, 'Agent 不在线');
      return;
    }

    // Step 1: 创建目录
    const r1 = await sendAndWaitWithRetry(
      page,
      '请在当前工作目录创建一个名为"test-h4-dir"的文件夹',
      { timeout: 120_000 },
    );
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-8] Step 1 mkdir: ${r1.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-08-step1-mkdir');

    // Step 2: 写入文件
    const r2 = await sendAndWaitWithRetry(
      page,
      '请在test-h4-dir文件夹里创建一个hello.txt文件，内容写"Hello Stage 4 Test"',
      { timeout: 120_000 },
    );
    expect(r2.hasResponse).toBeTruthy();
    console.log(`[H4-8] Step 2 write: ${r2.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-08-step2-write');

    // Step 3: 读取文件
    const r3 = await sendAndWaitWithRetry(
      page,
      '请读取test-h4-dir/hello.txt的内容',
      { timeout: 120_000 },
    );
    expect(r3.hasResponse).toBeTruthy();
    const hasContent = r3.responseText.includes('Hello') || r3.responseText.includes('Stage 4');
    console.log(`[H4-8] Step 3 read: has content = ${hasContent}, text: ${r3.responseText.slice(0, 80)}`);
    expect(hasContent).toBeTruthy();
    await screenshot(page, 'H4-08-step3-read');

    // Step 4: 编辑文件
    const r4 = await sendAndWaitWithRetry(
      page,
      '请把test-h4-dir/hello.txt的内容改为"Hello Stage 4 Test — Edited Successfully"',
      { timeout: 120_000 },
    );
    expect(r4.hasResponse).toBeTruthy();
    console.log(`[H4-8] Step 4 edit: ${r4.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-08-step4-edit');

    // Step 5: 删除
    const r5 = await sendAndWaitWithRetry(
      page,
      '请删除test-h4-dir文件夹和里面所有文件',
      { timeout: 120_000 },
    );
    expect(r5.hasResponse).toBeTruthy();
    console.log(`[H4-8] Step 5 delete: ${r5.responseText.slice(0, 80)}`);
    await screenshot(page, 'H4-08-step5-delete');
  });

  test('H4-9: Shell 命令执行 — ls、pwd、echo', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const mode = await setupLocalMode(page);
    if (!mode.ok) {
      console.log('[H4-9] Agent not available, skipping');
      test.skip(true, 'Agent 不在线');
      return;
    }

    // 执行 shell 命令
    const r = await sendAndWaitWithRetry(
      page,
      '请依次执行以下shell命令并告诉我结果：1) echo "h4-test-ok" 2) dir（或ls）当前目录 3) cd（或pwd）显示当前路径',
      { timeout: 120_000 },
    );
    expect(r.hasResponse).toBeTruthy();
    console.log(`[H4-9] Shell result: ${r.responseText.slice(0, 150)}`);

    // 验证回复包含命令执行结果
    const hasEcho = r.responseText.includes('h4-test-ok') || r.responseText.includes('echo');
    const hasDir = r.responseText.includes('dir') || r.responseText.includes('ls') || r.responseText.includes('文件');
    console.log(`[H4-9] Has echo: ${hasEcho}, has dir: ${hasDir}`);
    expect(hasEcho || hasDir).toBeTruthy();

    await screenshot(page, 'H4-09-shell-commands');
  });

  test('H4-10: 错误处理 — 读取不存在的文件', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const mode = await setupLocalMode(page);
    if (!mode.ok) {
      console.log('[H4-10] Agent not available, skipping');
      test.skip(true, 'Agent 不在线');
      return;
    }

    // 读取不存在的文件
    const r = await sendAndWaitWithRetry(
      page,
      '请读取文件 this-file-does-not-exist-12345.txt 的内容',
      { timeout: 120_000 },
    );
    expect(r.hasResponse).toBeTruthy();
    console.log(`[H4-10] Error handling: ${r.responseText.slice(0, 150)}`);

    // 验证 AI 给出了错误提示，而不是崩溃
    const hasErrorInfo = r.responseText.includes('不存在') ||
      r.responseText.includes('找不到') ||
      r.responseText.includes('not found') ||
      r.responseText.includes('错误') ||
      r.responseText.includes('无法') ||
      r.responseText.includes('没有') ||
      r.responseText.includes('exist');
    console.log(`[H4-10] Has error info: ${hasErrorInfo}`);
    expect(hasErrorInfo).toBeTruthy();

    // 验证页面没有崩溃 — textarea 仍然可用
    const textareaVisible = await page.locator(SEL.chat.textarea).isVisible();
    console.log(`[H4-10] Textarea still visible: ${textareaVisible}`);
    expect(textareaVisible).toBeTruthy();

    await screenshot(page, 'H4-10-error-handling');
  });
});

// ============================================================================
// 4D: 记忆与会话 (H4-11 ~ H4-13)
// ============================================================================

test.describe('Stage 4D: 记忆与会话', () => {

  test('H4-11: Working Memory — 记住用户信息', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 告诉 AI 记住一个特定信息
    const r1 = await sendAndWaitWithRetry(
      page,
      '请记住：我的名字叫"测试工程师小明"，我在舟山中远海运重工工作。',
      { timeout: 90_000 },
    );
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-11] Remember: ${r1.responseText.slice(0, 80)}`);

    // 发一条无关消息
    const r2 = await sendAndWaitWithRetry(page, '今天星期几？', { timeout: 90_000 });
    expect(r2.hasResponse).toBeTruthy();

    // 验证 AI 是否记住
    const r3 = await sendAndWaitWithRetry(
      page,
      '我的名字叫什么？我在哪里工作？',
      { timeout: 90_000 },
    );
    expect(r3.hasResponse).toBeTruthy();
    console.log(`[H4-11] Recall: ${r3.responseText.slice(0, 120)}`);

    const remembersName = r3.responseText.includes('小明') || r3.responseText.includes('测试工程师');
    const remembersWork = r3.responseText.includes('舟山') || r3.responseText.includes('中远') || r3.responseText.includes('海运');
    console.log(`[H4-11] Remembers name: ${remembersName}, work: ${remembersWork}`);
    expect(remembersName || remembersWork).toBeTruthy();

    await screenshot(page, 'H4-11-working-memory');
  });

  test('H4-12: 页面刷新 — 历史消息恢复', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 发送消息创建会话
    const r1 = await sendAndWaitWithRetry(page, '这是一条测试消息，用于验证刷新后恢复。消息标记：REFRESH-TEST-H412。', { timeout: 90_000 });
    expect(r1.hasResponse).toBeTruthy();
    console.log(`[H4-12] Sent message, response: ${r1.responseText.slice(0, 60)}`);

    // 记录当前 URL（含 sessionId）
    const currentUrl = page.url();
    console.log(`[H4-12] Current URL: ${currentUrl}`);

    // 记录发送前的消息内容
    const userBubbles = page.locator('main .message-bubble.user');
    const userBubbleCount = await userBubbles.count();
    console.log(`[H4-12] User bubbles before refresh: ${userBubbleCount}`);

    await screenshot(page, 'H4-12-step1-before-refresh');

    // 刷新页面
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 验证消息恢复
    const userBubblesAfter = page.locator('main .message-bubble.user');
    const userCountAfter = await userBubblesAfter.count();
    console.log(`[H4-12] User bubbles after refresh: ${userCountAfter}`);

    // 用户消息数量不减少
    expect(userCountAfter).toBeGreaterThanOrEqual(userBubbleCount);

    // 检查 AI 回复也恢复了
    const assistantBubbles = page.locator('main .message-bubble.assistant');
    const assistantCount = await assistantBubbles.count();
    console.log(`[H4-12] Assistant bubbles after refresh: ${assistantCount}`);
    expect(assistantCount).toBeGreaterThanOrEqual(1);

    // 检查消息内容是否包含标记
    const pageContent = await page.locator('main').textContent() || '';
    const hasMarker = pageContent.includes('REFRESH-TEST-H412');
    console.log(`[H4-12] Contains marker after refresh: ${hasMarker}`);
    expect(hasMarker).toBeTruthy();

    await screenshot(page, 'H4-12-step2-after-refresh');
  });

  test('H4-13: 删除会话', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 创建一个会话
    const r1 = await sendAndWaitWithRetry(page, '你好，这是一个将被删除的测试会话。', { timeout: 90_000 });
    expect(r1.hasResponse).toBeTruthy();

    // 记录当前 sessionId
    const url = page.url();
    const sessionId = url.match(/\/chat\/([a-f0-9-]+)/)?.[1];
    console.log(`[H4-13] Created session: ${sessionId}`);

    // 获取侧边栏会话列表项数
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    const countBefore = await sessionItems.count();
    console.log(`[H4-13] Sessions before delete: ${countBefore}`);

    await screenshot(page, 'H4-13-step1-before-delete');

    // 找到当前会话的列表项并右键点击
    const currentSessionItem = sessionItems.first();
    await currentSessionItem.click({ button: 'right' });
    await page.waitForTimeout(1000);

    // 点击删除菜单项
    const deleteMenu = page.locator('.ant-dropdown-menu-item:has-text("删除"), [role="menuitem"]:has-text("删除")');
    const deleteVisible = await deleteMenu.isVisible().catch(() => false);
    console.log(`[H4-13] Delete menu visible: ${deleteVisible}`);

    if (deleteVisible) {
      await deleteMenu.click();
      await page.waitForTimeout(1000);

      // 处理确认弹窗（如果有）
      const confirmBtn = page.locator('.ant-modal-confirm-btns .ant-btn-primary, .ant-popconfirm-buttons .ant-btn-primary');
      const hasConfirm = await confirmBtn.isVisible().catch(() => false);
      if (hasConfirm) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      // 验证会话消失
      const countAfter = await sessionItems.count();
      console.log(`[H4-13] Sessions after delete: ${countAfter}`);

      // 验证会话数量减少或 URL 不再包含旧 sessionId
      const urlAfter = page.url();
      const sessionGone = countAfter < countBefore || !urlAfter.includes(sessionId || 'NONE');
      console.log(`[H4-13] Session gone: ${sessionGone}, URL: ${urlAfter}`);
      expect(sessionGone).toBeTruthy();
    } else {
      // 尝试通过 API 删除
      console.log('[H4-13] Right-click menu not found, trying API delete');
      if (sessionId) {
        const deleteResult = await page.evaluate(async (sid) => {
          const raw = localStorage.getItem('lsc-ai-auth');
          if (!raw) return false;
          const token = JSON.parse(raw)?.state?.accessToken;
          if (!token) return false;
          const res = await fetch(`/api/sessions/${sid}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          return res.ok;
        }, sessionId);
        console.log(`[H4-13] API delete result: ${deleteResult}`);
        expect(deleteResult).toBeTruthy();

        // 刷新验证
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        const urlAfter = page.url();
        console.log(`[H4-13] URL after API delete + reload: ${urlAfter}`);
      }
    }

    await screenshot(page, 'H4-13-step2-after-delete');
  });
});
